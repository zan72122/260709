// physics.js — 平面(x,y,z)の球物理。前作 korokoro-karakuri で実証済みのエンジンに
// 複数玉対応と球同士の衝突を追加。z=0 平面へ緩く復元(レール溝と合わせて円筒面上を保つ)。
import * as THREE from '../vendor/three.module.min.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class BoxCollider {
  constructor({ center, half, angleZ = 0, friction = 0.06, restitution = 0.18, name = '' }) {
    this.center = center.clone();
    this.half = half.clone();
    this.quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angleZ);
    this.invQuat = this.quat.clone().invert();
    this.friction = friction;
    this.restitution = restitution;
    this.name = name;
    this.enabled = true;
    this.linVel = new THREE.Vector3();
    this.angVelZ = 0;
    this.pivot = null;
  }

  setTransform(center, angleZ) {
    this.center.copy(center);
    this.quat.setFromAxisAngle(_v1.set(0, 0, 1), angleZ);
    this.invQuat.copy(this.quat).invert();
  }

  pointVelocity(p, out) {
    out.copy(this.linVel);
    if (this.angVelZ !== 0) {
      const piv = this.pivot || this.center;
      const rx = p.x - piv.x, ry = p.y - piv.y;
      out.x += -this.angVelZ * ry;
      out.y += this.angVelZ * rx;
    }
    return out;
  }

  contact(p, r, out) {
    if (!this.enabled) return null;
    _v1.copy(p).sub(this.center).applyQuaternion(this.invQuat);
    const hx = this.half.x, hy = this.half.y, hz = this.half.z;
    const cx = Math.max(-hx, Math.min(hx, _v1.x));
    const cy = Math.max(-hy, Math.min(hy, _v1.y));
    const cz = Math.max(-hz, Math.min(hz, _v1.z));
    let nx = _v1.x - cx, ny = _v1.y - cy, nz = _v1.z - cz;
    const d2 = nx * nx + ny * ny + nz * nz;
    if (d2 > r * r) return null;
    let depth;
    if (d2 > 1e-12) {
      const dist = Math.sqrt(d2);
      nx /= dist; ny /= dist; nz /= dist;
      depth = r - dist;
    } else {
      const dx = hx - Math.abs(_v1.x), dy = hy - Math.abs(_v1.y), dz = hz - Math.abs(_v1.z);
      if (dx <= dy && dx <= dz) { nx = Math.sign(_v1.x) || 1; ny = 0; nz = 0; depth = r + dx; }
      else if (dy <= dz) { nx = 0; ny = Math.sign(_v1.y) || 1; nz = 0; depth = r + dy; }
      else { nx = 0; ny = 0; nz = Math.sign(_v1.z) || 1; depth = r + dz; }
    }
    _v2.set(nx, ny, nz).applyQuaternion(this.quat);
    out.normal.copy(_v2);
    out.depth = depth;
    out.point.set(cx, cy, cz).applyQuaternion(this.quat).add(this.center);
    return out;
  }
}

export class CylinderZCollider {
  constructor({ center, radius, halfDepth = 0.6, friction = 0.04, restitution = 0.35, name = '' }) {
    this.center = center.clone();
    this.radius = radius;
    this.halfDepth = halfDepth;
    this.friction = friction;
    this.restitution = restitution;
    this.name = name;
    this.enabled = true;
    this.linVel = new THREE.Vector3();
    this.angVelZ = 0;
    this.pivot = null;
  }

  pointVelocity(p, out) {
    out.copy(this.linVel);
    if (this.angVelZ !== 0) {
      const piv = this.pivot || this.center;
      const rx = p.x - piv.x, ry = p.y - piv.y;
      out.x += -this.angVelZ * ry;
      out.y += this.angVelZ * rx;
    }
    return out;
  }

  contact(p, r, out) {
    if (!this.enabled) return null;
    const dz = p.z - this.center.z;
    if (Math.abs(dz) > this.halfDepth + r) return null;
    const dx = p.x - this.center.x, dy = p.y - this.center.y;
    const d2 = dx * dx + dy * dy;
    const rr = this.radius + r;
    if (d2 > rr * rr || d2 < 1e-12) return null;
    const dist = Math.sqrt(d2);
    out.normal.set(dx / dist, dy / dist, 0);
    out.depth = rr - dist;
    out.point.set(this.center.x + (dx / dist) * this.radius, this.center.y + (dy / dist) * this.radius, p.z);
    return out;
  }
}

export class PhysicsWorld {
  constructor({ gravity = -14.5, substep = 1 / 240 } = {}) {
    this.gravity = gravity;
    this.substep = substep;
    this.colliders = [];
    this._acc = 0;
    this._contact = { normal: new THREE.Vector3(), depth: 0, point: new THREE.Vector3() };
    this.maxSpeed = 14;
  }

  add(c) { this.colliders.push(c); return c; }

  // balls: 配列。active な玉のみ積分し、玉同士も衝突させる。
  step(balls, dt, onImpact, onBallHit) {
    this._acc += Math.min(dt, 0.05);
    const h = this.substep;
    while (this._acc >= h) {
      this._acc -= h;
      for (const b of balls) if (b.active) this._integrate(b, h, onImpact);
      this._ballPairs(balls, onBallHit);
    }
  }

  _integrate(ball, h, onImpact) {
    const v = ball.v, p = ball.p;
    v.y += this.gravity * h;
    v.z += (-p.z * 14 - v.z * 6) * h; // 円筒面(z=0)へ緩く復元
    const sp = v.length();
    if (sp > this.maxSpeed) v.multiplyScalar(this.maxSpeed / sp);
    p.addScaledVector(v, h);

    let grounded = null;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const c of this.colliders) {
        const ct = c.contact(p, ball.r, this._contact);
        if (!ct) continue;
        any = true;
        p.addScaledVector(ct.normal, ct.depth);
        const pv = c.pointVelocity ? c.pointVelocity(ct.point, _v3) : _v3.set(0, 0, 0);
        _v1.copy(v).sub(pv);
        const vn = _v1.dot(ct.normal);
        if (vn < 0) {
          const e = -vn > 1.0 ? c.restitution : 0;
          v.addScaledVector(ct.normal, -(1 + e) * vn);
          if (-vn > 1.2 && onImpact) onImpact(-vn, ct.point, ct.normal, c, ball);
        }
        _v1.copy(v).sub(pv);
        const vn2 = _v1.dot(ct.normal);
        _v2.copy(_v1).addScaledVector(ct.normal, -vn2);
        v.addScaledVector(_v2, -Math.min(0.5, c.friction * h * 60));
        if (ct.normal.y > 0.35) grounded = ct;
      }
      if (!any) break;
    }

    ball.groundedFlag = !!grounded;
    if (grounded) {
      _v1.copy(grounded.normal).cross(v).divideScalar(ball.r);
      ball.omega.lerp(_v1, 0.5);
    } else {
      ball.omega.multiplyScalar(1 - 0.4 * h);
    }
  }

  // 玉同士: 等質量の弾性寄り衝突
  _ballPairs(balls, onBallHit) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.active) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (!b.active) continue;
        _v1.copy(b.p).sub(a.p);
        const dist = _v1.length();
        const minD = a.r + b.r;
        if (dist >= minD || dist < 1e-9) continue;
        _v1.divideScalar(dist); // 法線 a→b
        const pen = (minD - dist) / 2;
        a.p.addScaledVector(_v1, -pen);
        b.p.addScaledVector(_v1, pen);
        _v2.copy(b.v).sub(a.v);
        const vn = _v2.dot(_v1);
        if (vn < 0) {
          const e = 0.5;
          const imp = -(1 + e) * vn / 2;
          a.v.addScaledVector(_v1, -imp);
          b.v.addScaledVector(_v1, imp);
          if (-vn > 0.8 && onBallHit) onBallHit(-vn, a, b);
        }
      }
    }
  }
}
