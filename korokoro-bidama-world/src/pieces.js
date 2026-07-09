// Gimmick pieces: each helper registers colliders on the sim and builds a
// matching pretty mesh. Headless-safe (no canvas textures — materials use
// plain colors; the env map is applied globally at runtime).
import * as THREE from '../vendor/three.module.min.js';

function glassMat(color, opacity = 0.35) {
  return new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness: 0.08, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// big open cone that swirls marbles into its bottom hole
export function addFunnel(sim, parent, { x, z, yTop, rTop, yBot, rBot, color = 0xa8e6ff, accent = 0xffffff }) {
  sim.addCone({ x, z, yTop, rTop, yBot, rBot, e: 0.1 });
  const h = yTop - yBot;
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 48, 1, true);
  const mesh = new THREE.Mesh(geo, glassMat(color));
  mesh.position.set(x, yBot + h / 2, z);
  parent.add(mesh);
  // rim torus + spiral stripe for readability
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rTop, 0.07, 10, 48),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, yTop, z);
  rim.castShadow = true;
  parent.add(rim);
  const rim2 = rim.clone();
  rim2.scale.setScalar(rBot / rTop);
  rim2.position.y = yBot;
  parent.add(rim2);
  // support legs
  const legMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const lx = x + Math.cos(a) * (rBot + 0.25), lz = z + Math.sin(a) * (rBot + 0.25);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, yBot, 8), legMat);
    leg.position.set(lx, yBot / 2, lz);
    leg.castShadow = true;
    parent.add(leg);
  }
  return { mesh };
}

// short glass drop-tube that tames the swirl under a funnel hole
export function addTube(sim, parent, { x, z, yTop, yBot, r, color = 0xa8e6ff }) {
  sim.addCylinder({ x, z, yMin: yBot, yMax: yTop, r, inside: true, e: 0.15 });
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.04, r + 0.04, yTop - yBot, 24, 1, true),
    glassMat(color, 0.25));
  mesh.position.set(x, (yTop + yBot) / 2, z);
  parent.add(mesh);
  return { mesh };
}

// descending xylophone bars flanked by low glass walls; returns bar meshes
// so the runtime can flash them on 'chime' events (event id = bar index base+i)
export function addChimeStairs(sim, parent, { x, y, z, dirX = -1, n = 5, idBase = 0, colors, stepDY = 0.19 }) {
  const bars = [];
  const wallMat = glassMat(0xffffff, 0.18);
  const stepDX = 0.62;
  const barCols = colors || [0xff6b8a, 0xffb056, 0xffe066, 0x7fe08a, 0x6db9ff, 0xb58aff];
  // back wall behind the first bar so marbles dropping in from the tube can
  // only leave down the staircase
  {
    const c = new THREE.Vector3(x - dirX * 0.5, y + 0.72, z);
    sim.addBox({ c, h: new THREE.Vector3(0.06, 0.85, 0.63), e: 0.25 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 1.2), wallMat);
    wall.position.copy(c);
    parent.add(wall);
  }
  for (let i = 0; i < n; i++) {
    const bx = x + dirX * stepDX * i;
    const by = y - stepDY * i;
    const c = new THREE.Vector3(bx, by, z);
    const h = new THREE.Vector3(i === 0 ? 0.44 : 0.26, 0.09, 0.63);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -dirX * (i === 0 ? 0.3 : 0.24));
    sim.addBox({ c, h, q, e: 0.52, kind: 'chime', id: idBase + i, mu: 0.01 });
    const mat = new THREE.MeshPhysicalMaterial({
      color: barCols[i % barCols.length], roughness: 0.25, clearcoat: 0.8,
      emissive: barCols[i % barCols.length], emissiveIntensity: 0.12,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2), mat);
    mesh.position.copy(c);
    mesh.quaternion.copy(q);
    mesh.castShadow = true;
    parent.add(mesh);
    bars.push(mesh);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, Math.max(0.1, by - 0.05), 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    leg.position.set(bx, Math.max(0.05, (by - 0.05) / 2), z);
    parent.add(leg);
  }
  // side walls to keep marbles hopping straight down the stairs
  const wallLen = stepDX * n + 1.4;
  const wallCx = x + dirX * (stepDX * (n - 1)) / 2;
  const wallY = y - stepDY * (n - 1) / 2 + 0.25;
  for (const side of [-1, 1]) {
    const c = new THREE.Vector3(wallCx, wallY, z + side * 0.62);
    const h = new THREE.Vector3(wallLen / 2, 0.72, 0.05);
    sim.addBox({ c, h, e: 0.2, mu: 0.1 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2), wallMat);
    wall.position.copy(c);
    parent.add(wall);
  }
  return { bars, idBase, count: n };
}

// mushroom bumper that pops marbles away
export function addBumper(sim, parent, { x, z, y = 0, r = 0.42, id = 0, color = 0xff5f8f }) {
  sim.addCylinder({ x, z, yMin: y, yMax: y + 0.62, r, e: 0.9, kind: 'bumper', id });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.82, r * 0.92, 0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0xfff6ec, roughness: 0.35 }));
  body.position.set(x, y + 0.25, z);
  body.castShadow = true;
  const capMat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.2, clearcoat: 1, emissive: color, emissiveIntensity: 0.25,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r + 0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
  cap.position.set(x, y + 0.52, z);
  cap.castShadow = true;
  parent.add(body, cap);
  return { cap, capMat, id, pos: new THREE.Vector3(x, y + 0.6, z) };
}

// glowing ring that accelerates marbles along `dir`
export function addBoostRing(sim, parent, { x, y, z, dir, id = 0, color = 0x64f0c8, strength = 26 }) {
  const d = dir.clone().normalize();
  sim.addZone({ x, y, z, r: 0.62, kind: 'boost', dir: d, strength, id });
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3,
    transparent: true, opacity: 0.92,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.075, 10, 36), mat);
  ring.position.set(x, y, z);
  ring.lookAt(x + d.x, y + d.y, z + d.z);
  parent.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(0.78);
  ring2.position.addScaledVector(d, 0.3);
  parent.add(ring2);
  return { ring, ring2, mat, id, dir: d, pos: new THREE.Vector3(x, y, z) };
}

// rotating star paddle wheel
export function addSpinner(sim, parent, { x, y, z, arms = 4, len = 1.5, speed = 1.4, color = 0xffc94d }) {
  const s = sim.addSpinner({ x, y, z, arms, len, hh: 0.26, ht: 0.09, speed });
  const group = new THREE.Group();
  const armMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.7 });
  const tipMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 });
  for (let a = 0; a < arms; a++) {
    const ang = (a * Math.PI * 2) / arms;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.17), armMat);
    arm.position.set(Math.cos(ang) * len / 2, 0, Math.sin(ang) * len / 2);
    arm.rotation.y = -ang;
    arm.castShadow = true;
    group.add(arm);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), tipMat);
    tip.position.set(Math.cos(ang) * len, 0, Math.sin(ang) * len);
    group.add(tip);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.66, 16), tipMat);
  hub.castShadow = true;
  group.add(hub);
  group.position.set(x, y, z);
  parent.add(group);
  return { sim: s, group, pos: new THREE.Vector3(x, y, z) };
}

// sunken glass pool that collects marbles (goal)
export function addGoalPool(sim, parent, { x, z, r = 1.5, color = 0x8ad9ff }) {
  const cy = r * 0.62;                    // bowl centre above ground
  sim.addBowl({ x, y: cy, z, r, e: 0.2 });
  sim.addZone({ x, y: cy - r * 0.2, z, r: r * 1.15, kind: 'goal' });
  const geo = new THREE.SphereGeometry(r + 0.06, 40, 20, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const bowl = new THREE.Mesh(geo, glassMat(color, 0.4));
  bowl.position.set(x, cy, z);
  parent.add(bowl);
  const rimY = cy;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(r + 0.05, 0.09, 12, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xffe27a, roughness: 0.25, metalness: 0.55, clearcoat: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, rimY, z);
  rim.castShadow = true;
  parent.add(rim);
  // pedestal skirt so the bowl reads as sitting in the ground
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.28, r + 0.55, rimY, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }));
  skirt.position.set(x, rimY / 2, z);
  skirt.receiveShadow = true;
  parent.add(skirt);
  return { pos: new THREE.Vector3(x, cy, z), r, rim };
}

// wide open catch bowl with a hole feeding whatever sits below
export function addCatchBowl(sim, parent, { x, z, yTop, rTop, yBot, rBot = 0.34, color = 0xbfe8ff }) {
  addFunnel(sim, parent, { x, z, yTop, rTop, yBot, rBot, color });
}

// flat plaza disc with optional walls and a drain gap
export function addPlazaDisc(sim, parent, { x, y, z, r, hole = 0, wall = 0, wallGapAt = null, wallGapWidth = 1.2, color = 0xfff3fa, wallColor = 0xffffff }) {
  sim.addDisc({ x, y, z, r, hole });
  const shape = new THREE.Mesh(
    hole > 0
      ? new THREE.RingGeometry(hole, r, 48)
      : new THREE.CircleGeometry(r, 48),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide }));
  shape.rotation.x = -Math.PI / 2;
  shape.position.set(x, y + 0.001, z);
  shape.receiveShadow = true;
  parent.add(shape);
  const rimGeo = new THREE.CylinderGeometry(r + 0.05, r + 0.12, 0.16, 48, 1, true);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.4, side: THREE.DoubleSide }));
  rim.position.set(x, y - 0.07, z);
  parent.add(rim);
  if (wall > 0) {
    // wall ring built out of box segments so we can leave a drain gap
    const segs = 26;
    const wallMat = glassMat(0xffffff, 0.22);
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      if (wallGapAt !== null) {
        let da = Math.abs(((a - wallGapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < wallGapWidth / (2 * r)) continue;
      }
      const segLen = (Math.PI * 2 * r) / segs * 0.62;
      const c = new THREE.Vector3(x + Math.cos(a) * r, y + wall / 2, z + Math.sin(a) * r);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      sim.addBox({ c, h: new THREE.Vector3(0.06, wall / 2, segLen), q, e: 0.35 });
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.1, wall, segLen * 2), wallMat);
      seg.position.copy(c);
      seg.quaternion.copy(q);
      parent.add(seg);
    }
  }
}

// pastel cloud-teapot spout that visually marks the marble spawn point
export function addSpawnerDeco(parent, { pos, color = 0xffffff }) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const blobs = [
    [0, 0, 0, 0.5], [0.42, 0.05, 0.12, 0.36], [-0.4, 0.02, -0.05, 0.38],
    [0.1, 0.12, 0.36, 0.33], [-0.1, 0.14, -0.36, 0.31], [0.05, 0.3, 0, 0.4],
  ];
  for (const [bx, by, bz, br] of blobs) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(br, 18, 12), mat);
    b.position.set(bx, by, bz);
    b.castShadow = true;
    g.add(b);
  }
  // rainbow drip ring under the cloud
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd76e, emissive: 0xffd76e, emissiveIntensity: 0.5 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.42;
  g.add(ring);
  g.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
  parent.add(g);
  return g;
}
