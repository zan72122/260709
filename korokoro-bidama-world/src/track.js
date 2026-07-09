// Rail building: a Catmull-Rom spine is sampled into parallel-transport
// frames with automatic banking, then turned into (a) twin-wire capsule
// colliders for the sim and (b) pretty tube/sleeper/pillar geometry.
// No canvas/DOM usage so it can run headless in tests.
import * as THREE from '../vendor/three.module.min.js';

export const WIRE_R = 0.065;
export const WIRE_OFFSET = 0.175;

const UP = new THREE.Vector3(0, 1, 0);

// ---- spine sampling ----------------------------------------------------
export function sampleSpine(ctrlPts, opts = {}) {
  const ptsPerUnit = opts.ptsPerUnit ?? 8;
  const bankFactor = opts.bank ?? 1.15;
  const maxBank = opts.maxBank ?? 0.62;
  const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'centripetal', 0.5);
  const approxLen = curve.getLength();
  const n = Math.max(8, Math.round(approxLen * ptsPerUnit));
  const pts = curve.getSpacedPoints(n);

  // parallel transport frames
  const tangents = [];
  for (let i = 0; i <= n; i++) {
    const t = new THREE.Vector3();
    if (i === 0) t.subVectors(pts[1], pts[0]);
    else if (i === n) t.subVectors(pts[n], pts[n - 1]);
    else t.subVectors(pts[i + 1], pts[i - 1]);
    tangents.push(t.normalize());
  }
  const normals = [];
  const binormals = [];
  let normal = new THREE.Vector3().crossVectors(UP, tangents[0]);
  if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
  normal.crossVectors(tangents[0], normal.normalize()).normalize(); // roughly up
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i]);
      const l = axis.length();
      if (l > 1e-8) {
        axis.divideScalar(l);
        const angle = Math.asin(Math.min(1, l));
        normal = normal.clone().applyAxisAngle(axis, angle);
      } else {
        normal = normal.clone();
      }
    }
    // gently pull the frame back towards world-up so long spirals do not
    // accumulate roll (keeps the channel opening skyward)
    const idealN = new THREE.Vector3().crossVectors(tangents[i], new THREE.Vector3().crossVectors(UP, tangents[i]));
    if (idealN.lengthSq() > 1e-6) {
      idealN.normalize();
      normal.lerp(idealN, opts.upBias ?? 0.18).normalize();
    }
    normals.push(normal.clone());
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], normal).normalize());
  }

  // banking from horizontal curvature (signed, smoothed)
  const bank = new Float32Array(n + 1);
  for (let i = 1; i < n; i++) {
    const a = tangents[i - 1], b = tangents[i + 1];
    // signed turn rate around Y
    const cross = a.x * b.z - a.z * b.x;
    const segLen = pts[i + 1].distanceTo(pts[i - 1]);
    bank[i] = THREE.MathUtils.clamp(-cross / Math.max(segLen, 1e-4) * bankFactor, -maxBank, maxBank);
  }
  // smooth
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < n; i++) bank[i] = (bank[i - 1] + bank[i] * 2 + bank[i + 1]) / 4;
  }
  for (let i = 0; i <= n; i++) {
    if (bank[i] !== 0) {
      normals[i].applyAxisAngle(tangents[i], bank[i]);
      binormals[i].crossVectors(tangents[i], normals[i]).normalize();
    }
  }
  return { pts, tangents, normals, binormals, length: approxLen };
}

export function offsetPolyline(spine, side, up) {
  const out = [];
  for (let i = 0; i < spine.pts.length; i++) {
    out.push(new THREE.Vector3()
      .copy(spine.pts[i])
      .addScaledVector(spine.binormals[i], side)
      .addScaledVector(spine.normals[i], up));
  }
  return out;
}

// ---- tube geometry along an arbitrary polyline --------------------------
export function polylineTube(pts, radius, radialSegs = 7) {
  const n = pts.length;
  const verts = [], norms = [], idx = [];
  // frames per point (simple parallel transport)
  let prevT = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  let ref = Math.abs(prevT.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  let bn = new THREE.Vector3().crossVectors(prevT, ref).normalize();
  let nn = new THREE.Vector3().crossVectors(bn, prevT).normalize();
  for (let i = 0; i < n; i++) {
    const t = new THREE.Vector3();
    if (i === 0) t.copy(prevT);
    else if (i === n - 1) t.subVectors(pts[i], pts[i - 1]).normalize();
    else t.subVectors(pts[i + 1], pts[i - 1]).normalize();
    const axis = new THREE.Vector3().crossVectors(prevT, t);
    const l = axis.length();
    if (l > 1e-8) {
      axis.divideScalar(l);
      const ang = Math.asin(Math.min(1, l));
      bn.applyAxisAngle(axis, ang);
      nn.applyAxisAngle(axis, ang);
    }
    prevT = t;
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const dir = new THREE.Vector3().addScaledVector(bn, Math.cos(a)).addScaledVector(nn, Math.sin(a));
      verts.push(pts[i].x + dir.x * radius, pts[i].y + dir.y * radius, pts[i].z + dir.z * radius);
      norms.push(dir.x, dir.y, dir.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * radialSegs + j;
      const b = i * radialSegs + ((j + 1) % radialSegs);
      const c = a + radialSegs, d = b + radialSegs;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(idx);
  return g;
}

// ---- full rail: colliders + visuals -------------------------------------
// opts: { covered, guardFrom, guardTo, supports, mats: {rail, sleeper, support}, groundY }
export function buildRail(sim, parent, ctrlPts, opts = {}) {
  const spine = sampleSpine(ctrlPts, opts);
  const left = offsetPolyline(spine, -WIRE_OFFSET, 0);
  const right = offsetPolyline(spine, WIRE_OFFSET, 0);
  sim.addCapsuleChain(left, WIRE_R);
  sim.addCapsuleChain(right, WIRE_R);

  const group = new THREE.Group();
  const mats = opts.mats || {};
  const railMat = mats.rail || new THREE.MeshStandardMaterial({ color: 0xffffff });
  const sleeperMat = mats.sleeper || railMat;
  const supportMat = mats.support || railMat;

  group.add(new THREE.Mesh(polylineTube(left, WIRE_R), railMat));
  group.add(new THREE.Mesh(polylineTube(right, WIRE_R), railMat));

  // guard wires (deep channel): explicit arc-length range plus automatic
  // coverage wherever the spine curves hard (marbles would fly off there)
  const nPts = spine.pts.length;
  const guardMask = new Array(nPts).fill(false);
  if (opts.guardFrom !== undefined) {
    const from = opts.guardFrom, to = opts.guardTo ?? spine.length;
    const per = spine.length / (nPts - 1);
    const i0 = Math.max(0, Math.floor(from / per));
    const i1 = Math.min(nPts - 1, Math.ceil(to / per));
    for (let i = i0; i <= i1; i++) guardMask[i] = true;
  }
  if (opts.autoGuard !== false) {
    // turn rate per arc length ~ curvature
    for (let i = 1; i < nPts - 1; i++) {
      const dot = THREE.MathUtils.clamp(spine.tangents[i - 1].dot(spine.tangents[i + 1]), -1, 1);
      const seg = spine.pts[i + 1].distanceTo(spine.pts[i - 1]);
      const kappa = Math.acos(dot) / Math.max(seg, 1e-4);
      if (kappa > (opts.guardKappa ?? 0.42)) {
        for (let k = Math.max(0, i - 3); k <= Math.min(nPts - 1, i + 3); k++) guardMask[k] = true;
      }
    }
  }
  {
    let i = 0;
    while (i < nPts) {
      if (!guardMask[i]) { i++; continue; }
      let j = i;
      while (j < nPts && guardMask[j]) j++;
      if (j - i >= 2) {
        for (const side of [-1, 1]) {
          const wire = [];
          for (let k = i; k < j; k++) {
            // flare the ends outwards so marbles cannot hit a wire tip head-on
            const edge = Math.min(k - i, j - 1 - k);
            const flare = edge < 3 ? (3 - edge) * 0.08 : 0;
            wire.push(new THREE.Vector3().copy(spine.pts[k])
              .addScaledVector(spine.binormals[k], side * (WIRE_OFFSET + 0.16 + flare))
              .addScaledVector(spine.normals[k], 0.24 + flare * 0.5));
          }
          sim.addCapsuleChain(wire, WIRE_R * 0.85);
          group.add(new THREE.Mesh(polylineTube(wire, WIRE_R * 0.85), railMat));
        }
      }
      i = j;
    }
  }

  // covered sections: wherever the channel tilts past ~65° (loops, steep
  // banks) add a ceiling wire pair so marbles stay captive. Detected
  // automatically from the frame normals.
  {
    const low = [];
    for (let i = 0; i < spine.pts.length; i++) low.push(spine.normals[i].y < 0.5);
    let i = 0;
    while (i < spine.pts.length) {
      if (!low[i]) { i++; continue; }
      let j = i;
      while (j < spine.pts.length && low[j]) j++;
      const i0 = Math.max(0, i - 5), i1 = Math.min(spine.pts.length - 1, j + 4);
      if (i1 - i0 >= 2) {
        for (const side of [-1, 1]) {
          const wire = [];
          for (let k = i0; k <= i1; k++) {
            // flare the ceiling up at both ends so entering marbles never
            // slam into the wire tip
            const edge = Math.min(k - i0, i1 - k);
            const flare = edge < 4 ? (4 - edge) * 0.11 : 0;
            wire.push(new THREE.Vector3().copy(spine.pts[k])
              .addScaledVector(spine.binormals[k], side * WIRE_OFFSET)
              .addScaledVector(spine.normals[k], 0.44 + WIRE_R + flare));
          }
          sim.addCapsuleChain(wire, WIRE_R * 0.8);
          group.add(new THREE.Mesh(polylineTube(wire, WIRE_R * 0.8), railMat));
        }
      }
      i = j;
    }
  }

  // sleepers: small rounded crossbars
  const per = spine.length / (spine.pts.length - 1);
  const sleeperEvery = Math.max(1, Math.round((opts.sleeperEvery ?? 0.8) / per));
  const sleeperGeo = new THREE.CylinderGeometry(0.045, 0.045, WIRE_OFFSET * 2 + 0.22, 8);
  sleeperGeo.rotateZ(Math.PI / 2);
  const sleeperCount = Math.floor((spine.pts.length - 1) / sleeperEvery);
  if (sleeperCount > 0) {
    const inst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
    const m4 = new THREE.Matrix4();
    const basis = new THREE.Matrix4();
    let si = 0;
    for (let i = sleeperEvery; i < spine.pts.length - 1 && si < sleeperCount; i += sleeperEvery, si++) {
      const pos = new THREE.Vector3().copy(spine.pts[i]).addScaledVector(spine.normals[i], -WIRE_R * 1.5);
      basis.makeBasis(spine.binormals[i], spine.normals[i], spine.tangents[i]);
      m4.copy(basis).setPosition(pos);
      inst.setMatrixAt(si, m4);
    }
    inst.count = si;
    inst.castShadow = true;
    group.add(inst);
  }

  // support pillars down to the ground
  if (opts.supports !== false) {
    const groundY = opts.groundY ?? 0;
    const every = Math.max(1, Math.round((opts.supportEvery ?? 3.2) / per));
    for (let i = Math.floor(every / 2); i < spine.pts.length; i += every) {
      const p = spine.pts[i];
      const h = p.y - groundY - 0.15;
      if (h < 0.5) continue;
      const geo = new THREE.CylinderGeometry(0.06, 0.09, h, 8);
      const mesh = new THREE.Mesh(geo, supportMat);
      mesh.position.set(p.x, groundY + h / 2, p.z);
      mesh.castShadow = true;
      group.add(mesh);
      const capGeo = new THREE.SphereGeometry(0.1, 10, 8);
      const cap = new THREE.Mesh(capGeo, supportMat);
      cap.position.set(p.x, groundY + h + 0.02, p.z);
      group.add(cap);
    }
  }

  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (parent) parent.add(group);

  const n = spine.pts.length - 1;
  return {
    group, spine,
    start: spine.pts[0].clone(), startDir: spine.tangents[0].clone(),
    end: spine.pts[n].clone(), endDir: spine.tangents[n].clone(),
    length: spine.length,
  };
}

// ---- point-list helpers for authoring courses ---------------------------
export function helixPoints({ cx, cz, r, y0, y1, turns, a0 = 0, dir = 1, segsPerTurn = 10 }) {
  const pts = [];
  const n = Math.max(4, Math.round(turns * segsPerTurn));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const a = a0 + dir * f * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(cx + r * Math.cos(a), y0 + (y1 - y0) * f, cz + r * Math.sin(a)));
  }
  return pts;
}

export function wavePoints({ from, to, waves = 3, amp = 1.2, segs = 26 }) {
  // a lateral slalom between two points, amplitude perpendicular to the line
  const pts = [];
  const dirv = new THREE.Vector3().subVectors(to, from);
  const perp = new THREE.Vector3(-dirv.z, 0, dirv.x).normalize();
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    const fade = Math.sin(Math.PI * Math.min(1, f * 1.06)); // calm ends
    const off = Math.sin(f * waves * Math.PI * 2) * amp * fade;
    pts.push(new THREE.Vector3(
      from.x + dirv.x * f + perp.x * off,
      from.y + dirv.y * f,
      from.z + dirv.z * f + perp.z * off));
  }
  return pts;
}

export function loopPoints({ entry, dir, r = 1.15, tilt = 0.55 }) {
  // vertical loop starting at `entry` heading `dir` (horizontal, normalized);
  // the loop plane is offset sideways by `tilt` per radian so exit clears entry
  const pts = [];
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3()
      .copy(entry)
      .addScaledVector(dir, Math.sin(a) * r)
      .addScaledVector(side, (a / (Math.PI * 2)) * tilt)
      .add(new THREE.Vector3(0, r * (1 - Math.cos(a)), 0)));
  }
  return pts;
}

export function catmullThrough(list) {
  return list.map(p => Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : p);
}
