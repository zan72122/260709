// physics.js — 玉転がし特化の自作物理(球 vs 有向ボックス/円柱)。決定論的な固定サブステップ。
import * as THREE from '../vendor/three.module.min.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

// ---- 有向ボックスコライダー ----
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
    // キネマティック: 速度供給用(剛体運動 v + ω×r)
    this.linVel = new THREE.Vector3();
    this.angVelZ = 0;
    this.pivot = null; // 回転運動の中心(null なら center)
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
      // ω×r,  ω = (0,0,angVelZ)
      const rx = p.x - piv.x, ry = p.y - piv.y;
      out.x += -this.angVelZ * ry;
      out.y += this.angVelZ * rx;
    }
    return out;
  }

  // 球との接触: {normal, depth, point} / null
  contact(p, r, out) {
    if (!this.enabled) return null;
    // ローカルへ
    _v1.copy(p).sub(this.center).applyQuaternion(this.invQuat);
    const hx = this.half.x, hy = this.half.y, hz = this.half.z;
    const cx = Math.max(-hx, Math.min(hx, _v1.x));
    const cy = Math.max(-hy, Math.min(hy, _v1.y));
    const cz = Math.max(-hz, Math.min(hz, _v1.z));
    let nx = _v1.x - cx, ny = _v1.y - cy, nz = _v1.z - cz;
    let d2 = nx * nx + ny * ny + nz * nz;
    if (d2 > r * r) return null;

    let depth, dist;
    if (d2 > 1e-12) {
      dist = Math.sqrt(d2);
      nx /= dist; ny /= dist; nz /= dist;
      depth = r - dist;
    } else {
      // 中心がボックス内部: 最短の面から押し出す
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

// ---- Z軸円柱コライダー(ペグ・水車の外周) ----
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
    out.point.set(
      this.center.x + (dx / dist) * this.radius,
      this.center.y + (dy / dist) * this.radius,
      p.z,
    );
    return out;
  }
}

// ---- センサー(AABB トリガー / 円ゾーン) ----
export class CircleSensor {
  constructor({ x, y, r, id }) { this.x = x; this.y = y; this.r = r; this.id = id; this.enabled = true; }
  test(p) {
    if (!this.enabled) return false;
    const dx = p.x - this.x, dy = p.y - this.y;
    return dx * dx + dy * dy < this.r * this.r;
  }
}

// ---- 物理世界 ----
export class PhysicsWorld {
  constructor({ gravity = -14.5, substep = 1 / 240 } = {}) {
    this.gravity = gravity;
    this.substep = substep;
    this.colliders = [];
    this.sensors = [];
    this._acc = 0;
    this._contact = { normal: new THREE.Vector3(), depth: 0, point: new THREE.Vector3() };
    this.maxSpeed = 14;
  }

  add(c) { this.colliders.push(c); return c; }
  addSensor(s) { this.sensors.push(s); return s; }

  // ball: {p:Vector3, v:Vector3, r, omega:Vector3, active}
  // onImpact(speed, point, normal, collider) — 効果音・パーティクル用
  step(ball, dt, onImpact) {
    if (!ball.active) return;
    this._acc += Math.min(dt, 0.05);
    const h = this.substep;
    while (this._acc >= h) {
      this._acc -= h;
      this._integrate(ball, h, onImpact);
    }
  }

  _integrate(ball, h, onImpact) {
    const v = ball.v, p = ball.p;
    v.y += this.gravity * h;
    // z を平面に緩く引き戻す(装置は基本 z=0 で進行)
    v.z += (-p.z * 14 - v.z * 6) * h;
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
        // 押し出し
        p.addScaledVector(ct.normal, ct.depth);
        // 相対速度
        const pv = c.pointVelocity ? c.pointVelocity(ct.point, _v3) : _v3.set(0, 0, 0);
        _v1.copy(v).sub(pv);
        const vn = _v1.dot(ct.normal);
        if (vn < 0) {
          const e = -vn > 1.0 ? c.restitution : 0; // 低速接触は反発なし(安定)
          v.addScaledVector(ct.normal, -(1 + e) * vn);
          if (-vn > 1.2 && onImpact) onImpact(-vn, ct.point, ct.normal, c);
        }
        // 接線摩擦(転がり抵抗) — friction は毎秒スケール(サブステップ数に依存しない)
        _v1.copy(v).sub(pv);
        const vn2 = _v1.dot(ct.normal);
        _v2.copy(_v1).addScaledVector(ct.normal, -vn2); // 接線成分
        v.addScaledVector(_v2, -Math.min(0.5, c.friction * h * 60));
        if (ct.normal.y > 0.35) grounded = ct;
      }
      if (!any) break;
    }

    ball.groundedFlag = !!grounded; // 転がり音用
    // 転がり回転(見た目): 接地中は滑りなし条件 ω = (n × v)/r
    if (grounded) {
      _v1.copy(grounded.normal).cross(v).divideScalar(ball.r);
      ball.omega.lerp(_v1, 0.5);
    } else {
      ball.omega.multiplyScalar(1 - 0.4 * h);
    }
  }

  // 玉のクォータニオンを ω で回す(描画側で毎フレーム)
  static spin(ball, dt) {
    const w = ball.omega;
    const len = w.length();
    if (len < 1e-5) return;
    _q1.setFromAxisAngle(_v1.copy(w).divideScalar(len), len * dt);
    ball.quat.premultiply(_q1);
  }

  checkSensors(p, cb) {
    for (const s of this.sensors) if (s.test(p)) cb(s.id, s);
  }
}
