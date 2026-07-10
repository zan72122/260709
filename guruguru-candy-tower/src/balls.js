// balls.js — キャンディ玉(複数対応)。物理/捕捉/ライド/待機(グローブ内)/非表示 の5モード。
// 物理は平面座標、描画は円筒ラップ。
import * as THREE from '../vendor/three.module.min.js';
import { makeBallTexture } from './materials.js';
import { BALL_RADIUS, BALL_HOME } from './layout.js';
import { wrapPos, wrapQuat } from './wrap.js';

const FLAVORS = [
  ['#e8465a', '#fff4ec'],   // いちご
  ['#5db9ff', '#fff4ec'],   // ソーダ
  ['#ffd24a', '#fff4ec'],   // レモン
];

const _q = new THREE.Quaternion();

export class Ball {
  constructor(index) {
    this.index = index;
    this.r = BALL_RADIUS;
    this.p = new THREE.Vector3(BALL_HOME.x, BALL_HOME.y, 0);
    this.v = new THREE.Vector3();
    this.omega = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.mode = 'queued'; // physics | captured | ride | queued | hidden
    this.active = false;
    this.chocoT = 0;      // チョコの滝の残り時間

    const [a, b] = FLAVORS[index % FLAVORS.length];
    this.baseMap = makeBallTexture(a, b);
    this.mat = new THREE.MeshStandardMaterial({ map: this.baseMap, roughness: 0.22 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.r, 28, 22), this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this._ride = null;
    this._capture = null;
    this._prev = new THREE.Vector3();
    this._spawnScale = 1;
    this._queueSeed = Math.random() * 10;
  }

  setMode(m) {
    this.mode = m;
    this.active = (m === 'physics');
    this.mesh.visible = (m !== 'hidden');
  }

  startRide(points, duration, onDone, { spin = 8 } = {}) {
    const vecs = points.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0));
    this._ride = { curve: new THREE.CatmullRomCurve3(vecs, false, 'catmullrom', 0.4), dur: duration, t: 0, onDone, spin };
    this.setMode('ride');
  }

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

  // グローブへ戻す(待機列へ)
  toQueue() {
    this._ride = null;
    this._capture = null;
    this.p.set(BALL_HOME.x, BALL_HOME.y, 0);
    this.v.set(0, 0, 0);
    this.omega.set(0, 0, 0);
    this._spawnScale = 0.01;
    this.setMode('queued');
  }

  // グローブから物理で放たれる
  launchFromHome() {
    this.p.set(BALL_HOME.x - 0.25 + this.index * 0.1, BALL_HOME.y + 0.15, 0);
    this.v.set(0, 0, 0);
    this._spawnScale = Math.max(this._spawnScale, 0.6);
    this.setMode('physics');
  }

  setChoco(sec) { this.chocoT = sec; }

  update(dt, time) {
    if (this.mode === 'ride' && this._ride) {
      const r = this._ride;
      r.t = Math.min(1, r.t + dt / r.dur);
      this._prev.copy(this.p);
      r.curve.getPointAt(Math.min(1, r.t), this.p);
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
    } else if (this.mode === 'queued') {
      // グローブの中でコロコロ揺れる
      const t = time * 1.7 + this._queueSeed;
      this.p.set(
        BALL_HOME.x + Math.sin(t) * 0.28 + Math.sin(this._queueSeed) * 0.1,
        BALL_HOME.y - 0.12 + Math.abs(Math.sin(t * 1.4)) * 0.09,
        Math.cos(t * 0.8) * 0.2,
      );
      this.omega.set(0, 0, -Math.cos(t) * 3);
    }

    // チョココーティングの残り
    if (this.chocoT > 0) {
      this.chocoT -= dt;
      this.mat.color.setHex(0x6b4226);
      this.mat.roughness = 0.35;
      if (this.chocoT <= 0) {
        this.mat.color.setHex(0xffffff);
        this.mat.roughness = 0.22;
      }
    }

    // 回転
    const w = this.omega, len = w.length();
    if (len > 1e-5) {
      _q.setFromAxisAngle(new THREE.Vector3(w.x / len, w.y / len, w.z / len), len * dt);
      this.quat.premultiply(_q);
    }
    if (this._spawnScale < 1) {
      this._spawnScale = Math.min(1, this._spawnScale + dt * 3.2);
      this.mesh.scale.setScalar(this._spawnScale * (1 + Math.sin(this._spawnScale * Math.PI) * 0.18));
    } else {
      this.mesh.scale.setScalar(1);
    }

    // ラップ描画
    wrapPos(this.p.x, this.p.y, this.p.z, this.mesh.position);
    wrapQuat(this.p.x, 0, this.mesh.quaternion).multiply(this.quat);
  }
}
