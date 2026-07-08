// スフェリコン — geometry + exact rolling kinematics.
//
// Construction: a bicone (two 90°-apex cones base-to-base) is cut along a
// plane containing its axis and one half is rotated 90°. In body space the
// four vertices sit at ±X and ±Y; the surface pieces are four half-cones:
//   apex ±Y half-cones occupy body z >= 0,  apex ±X half-cones occupy z <= 0.
//
// Rolling: the sphericon always touches the floor along a straight slant
// line from one ground vertex (the "apex" of the currently rolling
// half-cone). It pivots around that apex, sweeping PHASE_MAX = π/√2, then
// hands off to the next vertex at the far end of the contact line and turns
// the other way — the signature serpentine "henteko" path. The centre stays
// at constant height r/√2.

import * as THREE from '../vendor/three.module.min.js';

export const SQRT2 = Math.SQRT2;
export const PHASE_MAX = Math.PI / SQRT2; // apex sweep per half-cone segment

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- geometry

function halfCone(r, radialSegs, heightSegs, thetaStart, transform) {
  const g = new THREE.ConeGeometry(r, r, radialSegs, heightSegs, true, thetaStart, Math.PI);
  g.translate(0, r / 2, 0); // apex at (0, r, 0), base ring in y=0 plane
  transform(g);
  return g.toNonIndexed();
}

// Merged sphericon with two material groups (cone-family A = ±Y apexes,
// cone-family B = ±X apexes) so the two families can be tinted differently.
export function createSphericonGeometry(r = 1, radialSegs = 56, heightSegs = 8) {
  const parts = [
    // family A (apex ±Y), surface z >= 0 : base ring x = r·sinθ, z = r·cosθ → θ∈[-π/2, π/2]
    halfCone(r, radialSegs, heightSegs, -Math.PI / 2, () => {}),
    halfCone(r, radialSegs, heightSegs, -Math.PI / 2, (g) => g.rotateZ(Math.PI)),
    // family B (apex ±X), surface z <= 0 : need base z<=0 pre-rotation → θ∈[π/2, 3π/2]
    halfCone(r, radialSegs, heightSegs, Math.PI / 2, (g) => g.rotateZ(-Math.PI / 2)),
    halfCone(r, radialSegs, heightSegs, Math.PI / 2, (g) => { g.rotateZ(-Math.PI / 2); g.rotateZ(Math.PI); }),
  ];
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const geo = new THREE.BufferGeometry();
  let off = 0;
  parts.forEach((p, i) => {
    const n = p.attributes.position.count;
    pos.set(p.attributes.position.array, off * 3);
    nor.set(p.attributes.normal.array, off * 3);
    uv.set(p.attributes.uv.array, off * 2);
    geo.addGroup(off, n, i < 2 ? 0 : 1);
    off += n;
    p.dispose();
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ---------------------------------------------------------------- kinematics

export class SphericonRoller {
  constructor(r = 0.5) {
    this.r = r;
    this.H = r / SQRT2;       // centre height + horizontal offset from apex
    this.SLANT = r * SQRT2;   // contact-line length (apex to next vertex)
    this.apex = new THREE.Vector3();      // current ground pivot vertex
    this.u = new THREE.Vector3(1, 0, 0);  // unit dir of contact line from apex
    this.s = 1;               // sweep sign for this segment (alternates)
    this.phase = 0;           // swept angle within segment, [0, PHASE_MAX)
    this.v = 0;               // signed speed of the centre along its path
    this.quat = new THREE.Quaternion();
    this.center = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.coneIndex = 0;       // increments each handoff; parity = cone family
    this.onHandoff = null;    // callback(coneIndex, speed)
    this.airborne = 0;        // hop: remaining air time
    this.vy = 0;
    this.yOffset = 0;
    this._syncOrientation();
    this._updateCenter();
  }

  // Place body so that at phase 0 the current apex vertex maps to the ground
  // pivot and the previous vertex sits at apex + u·SLANT.
  _syncOrientation() {
    const u = this.u;
    // body +X vertex → current apex : dir −(u+ŷ)/√2 ; body +Y → previous vertex : (u−ŷ)/√2
    const xb = new THREE.Vector3(-u.x / SQRT2, -1 / SQRT2, -u.z / SQRT2);
    const yb = new THREE.Vector3(u.x / SQRT2, -1 / SQRT2, u.z / SQRT2);
    const zb = new THREE.Vector3().crossVectors(xb, yb);
    const m = new THREE.Matrix4().makeBasis(xb, yb, zb);
    this.quat.setFromRotationMatrix(m);
  }

  _updateCenter() {
    this.center.set(
      this.apex.x + this.u.x * this.H,
      this.H + this.yOffset,
      this.apex.z + this.u.z * this.H
    );
  }

  reset(x, z, headingAngle = 0) {
    this.u.set(Math.cos(headingAngle), 0, Math.sin(headingAngle));
    this.s = 1;
    this.phase = 0;
    this.v = 0;
    this.coneIndex = 0;
    this.yOffset = 0;
    this.airborne = 0;
    this.vy = 0;
    this.apex.set(x - this.u.x * this.H, 0, z - this.u.z * this.H);
    this._syncOrientation();
    this._updateCenter();
  }

  // Rotate the whole configuration around the centre's vertical axis —
  // gentle steering that preserves the rolling state.
  steer(angle) {
    if (angle === 0) return;
    const cx = this.apex.x + this.u.x * this.H;
    const cz = this.apex.z + this.u.z * this.H;
    _q.setFromAxisAngle(_up, angle);
    this.u.applyQuaternion(_q);
    _v.set(this.apex.x - cx, 0, this.apex.z - cz).applyQuaternion(_q);
    this.apex.set(cx + _v.x, 0, cz + _v.z);
    this.quat.premultiply(_q);
    this._updateCenter();
  }

  // Current travel direction of the centre (unit, horizontal).
  tangent(out) {
    out.crossVectors(_up, this.u).multiplyScalar(this.s);
    return out;
  }

  hop(power = 2.2) {
    if (this.airborne <= 0) { this.vy = power; this.airborne = 1; }
  }

  step(dt) {
    if (this.airborne > 0) {
      this.vy -= 9.8 * dt;
      this.yOffset += this.vy * dt;
      if (this.yOffset <= 0) { this.yOffset = 0; this.airborne = 0; this.vy = 0; }
      this._updateCenter();
      return;
    }
    let rest = dt;
    let guard = 8;
    const px = this.center.x, pz = this.center.z;
    while (rest > 1e-6 && Math.abs(this.v) > 1e-5 && guard-- > 0) {
      const dphaseRate = this.v * SQRT2 / this.r;       // signed
      // clamp step to the segment boundary
      let sub = rest;
      if (dphaseRate > 0) sub = Math.min(sub, (PHASE_MAX - this.phase) / dphaseRate);
      else sub = Math.min(sub, this.phase / -dphaseRate);
      sub = Math.max(1e-6, Math.min(sub, rest));
      const dphase = dphaseRate * sub;
      const dalpha = this.s * dphase;                    // apex-sweep of u
      // body rotates about the contact line: ω = −α̇·u
      _q.setFromAxisAngle(this.u, -dalpha);
      this.quat.premultiply(_q);
      // contact line sweeps around the vertical through the apex
      _q.setFromAxisAngle(_up, dalpha);
      this.u.applyQuaternion(_q);
      this.phase += dphase;
      rest -= sub;
      if (this.phase >= PHASE_MAX - 1e-9 || this.phase <= 1e-9) {
        // handoff: next pivot is the far end of the contact line
        if ((dphaseRate > 0 && this.phase >= PHASE_MAX - 1e-9) ||
            (dphaseRate < 0 && this.phase <= 1e-9)) {
          this.apex.addScaledVector(this.u, this.SLANT);
          this.u.multiplyScalar(-1);
          this.s = -this.s;
          this.phase = dphaseRate > 0 ? 0 : PHASE_MAX;
          this.coneIndex++;
          if (this.onHandoff) this.onHandoff(this.coneIndex, Math.abs(this.v));
        }
      }
    }
    this._updateCenter();
    this.velocity.set((this.center.x - px) / dt, 0, (this.center.z - pz) / dt);
  }
}
