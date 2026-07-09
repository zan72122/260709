// ball.js — 玉。物理 / 捕捉(ギミックに保持) / スクリプト移動(ライド) の3モード。
import * as THREE from '../vendor/three.module.min.js';
import { makeBallTexture } from './materials.js';
import { BALL_RADIUS, BALL_SPAWN } from './layout.js';

export class Ball {
  constructor() {
    this.r = BALL_RADIUS;
    this.p = new THREE.Vector3(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z);
    this.v = new THREE.Vector3();
    this.omega = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.mode = 'physics'; // physics | captured | ride | hidden
    this.active = true;    // 物理有効(PhysicsWorld 用)

    const geo = new THREE.SphereGeometry(this.r, 28, 22);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: makeBallTexture(), roughness: 0.26, metalness: 0.0,
    }));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this._ride = null;
    this._capture = null;
    this._prev = new THREE.Vector3();
    this._spawnScale = 1;
  }

  setMode(m) {
    this.mode = m;
    this.active = (m === 'physics');
    this.mesh.visible = (m !== 'hidden');
  }

  // スクリプト移動: points [[x,y,z]...] を通る曲線に沿って duration 秒
  startRide(points, duration, onDone, { spin = 8 } = {}) {
    const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0));
    this._ride = {
      curve: new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.4),
      dur: duration, t: 0, onDone, spin,
    };
    this.setMode('ride');
  }

  // ギミック捕捉: 毎フレーム getter() の位置に追従
  captureTo(getter) {
    this._capture = getter;
    this.setMode('captured');
    this.v.set(0, 0, 0);
  }

  release(vx = 0, vy = 0, vz = 0) {
    this._ride = null;
    this._capture = null;
    this.v.set(vx, vy, vz);
    this.setMode('physics');
  }

  respawn() {
    this._ride = null;
    this._capture = null;
    this.p.set(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z);
    this.v.set(0, 0, 0);
    this.omega.set(0, 0, 0);
    this._spawnScale = 0.01;
    this.setMode('physics');
  }

  update(dt) {
    if (this.mode === 'ride' && this._ride) {
      const r = this._ride;
      r.t = Math.min(1, r.t + dt / r.dur);
      this._prev.copy(this.p);
      r.curve.getPointAt(Math.min(1, r.t), this.p);
      // 疑似速度(ライド終了時の受け渡し・回転表現用)
      if (dt > 0) {
        this.v.copy(this.p).sub(this._prev).divideScalar(dt);
        const sp = this.v.length();
        this.omega.set(0, 0, -Math.sign(this.v.x || 1) * sp / this.r * 0.8);
      }
      if (r.t >= 1) {
        const done = r.onDone;
        this._ride = null;
        if (done) done(this);
      }
    } else if (this.mode === 'captured' && this._capture) {
      const target = this._capture();
      this.p.lerp(target, Math.min(1, dt * 14));
      this.omega.multiplyScalar(1 - Math.min(1, dt * 3));
    }

    // 回転の適用
    const w = this.omega, len = w.length();
    if (len > 1e-5) {
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(w.x / len, w.y / len, w.z / len), len * dt,
      );
      this.quat.premultiply(q);
    }
    // ポンと登場するスケールイン
    if (this._spawnScale < 1) {
      this._spawnScale = Math.min(1, this._spawnScale + dt * 3.2);
      const s = 1 + Math.sin(this._spawnScale * Math.PI) * 0.18; // ぷるん
      this.mesh.scale.setScalar(this._spawnScale * s);
    } else {
      this.mesh.scale.setScalar(1);
    }
    this.mesh.position.copy(this.p);
    this.mesh.quaternion.copy(this.quat);
  }
}
