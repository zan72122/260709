// きらきら — confetti quads + sparkle points, pooled for mobile perf.

import * as THREE from '../vendor/three.module.min.js';

const CONFETTI_COLS = [0xff6d9d, 0xffc94d, 0x6fd08c, 0x6fa8ff, 0xc98cff, 0xfff3a8, 0xff8f5e];

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 10 : 26;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;

    // ---- confetti quads
    this.NQ = 260;
    this.quads = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.22),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: false }),
      this.NQ
    );
    this.quads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.quads.frustumCulled = false;
    this.qd = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.NQ; i++) {
      this.qd.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), rv: new THREE.Vector3() });
      this.quads.setMatrixAt(i, zero);
      this.quads.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    scene.add(this.quads);
    this.qNext = 0;

    // ---- sparkle points
    this.NP = 420;
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(this.NP * 3);
    this.pCol = new Float32Array(this.NP * 3);
    this.pPos.fill(-9999);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: starTexture(), size: 0.5, transparent: true, depthWrite: false,
      vertexColors: true, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pd = [];
    for (let i = 0; i < this.NP; i++)
      this.pd.push({ life: 0, max: 1, vel: new THREE.Vector3(), col: new THREE.Color() });
    this.pNext = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  // ---------------------------------------------------------- emitters

  confetti(pos, count = 30, spread = 2.6, up = 4.2) {
    for (let i = 0; i < count; i++) {
      const d = this.qd[this.qNext];
      this.qNext = (this.qNext + 1) % this.NQ;
      d.life = d.max = 1.4 + Math.random() * 1.2;
      d.pos.copy(pos);
      d.vel.set((Math.random() - 0.5) * spread, up * (0.5 + Math.random() * 0.8), (Math.random() - 0.5) * spread);
      d.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.rv.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      this._c.setHex(CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)]);
      this.quads.setColorAt((this.qNext + this.NQ - 1) % this.NQ, this._c);
    }
    if (this.quads.instanceColor) this.quads.instanceColor.needsUpdate = true;
  }

  sparkle(pos, count = 12, colorHex = 0xfff4a8, speed = 2.0) {
    for (let i = 0; i < count; i++) {
      const d = this.pd[this.pNext];
      const idx = this.pNext;
      this.pNext = (this.pNext + 1) % this.NP;
      d.life = d.max = 0.5 + Math.random() * 0.7;
      d.vel.set((Math.random() - 0.5), Math.random() * 0.9 + 0.15, (Math.random() - 0.5)).multiplyScalar(speed);
      d.col.setHex(colorHex);
      this.pPos.set([pos.x, pos.y, pos.z], idx * 3);
    }
  }

  firework(pos, colorHex) {
    const col = colorHex ?? CONFETTI_COLS[Math.floor(Math.random() * CONFETTI_COLS.length)];
    for (let i = 0; i < 46; i++) {
      const d = this.pd[this.pNext];
      const idx = this.pNext;
      this.pNext = (this.pNext + 1) % this.NP;
      d.life = d.max = 1.1 + Math.random() * 0.5;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const sp = 3.6 + Math.random() * 2.2;
      d.vel.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).multiplyScalar(sp);
      d.col.setHex(i % 5 === 0 ? 0xffffff : col);
      this.pPos.set([pos.x, pos.y, pos.z], idx * 3);
    }
  }

  hearts(pos, count = 8) {
    // pink confetti burst standing in for hearts (cheap and cheerful)
    for (let i = 0; i < count; i++) {
      const d = this.qd[this.qNext];
      this.qNext = (this.qNext + 1) % this.NQ;
      d.life = d.max = 1.2;
      d.pos.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
      d.vel.set((Math.random() - 0.5) * 0.8, 2.4 + Math.random(), (Math.random() - 0.5) * 0.8);
      d.rot.set(0, Math.random() * 6, 0);
      d.rv.set(0, 3, 0);
      this._c.setHex(i % 2 ? 0xff86ad : 0xff5f8f);
      this.quads.setColorAt((this.qNext + this.NQ - 1) % this.NQ, this._c);
    }
    if (this.quads.instanceColor) this.quads.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------- update

  update(dt) {
    // confetti
    for (let i = 0; i < this.NQ; i++) {
      const d = this.qd[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vel.y -= 6.5 * dt;
      d.vel.multiplyScalar(1 - 0.6 * dt);
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.rv.x * dt; d.rot.y += d.rv.y * dt; d.rot.z += d.rv.z * dt;
      const f = Math.max(0, Math.min(1, d.life / 0.4));
      this._q.setFromEuler(d.rot);
      this._s.setScalar(f);
      this._m.compose(d.pos, this._q, this._s);
      this.quads.setMatrixAt(i, this._m);
      if (d.life <= 0) {
        this._m.makeScale(0, 0, 0);
        this.quads.setMatrixAt(i, this._m);
      }
    }
    this.quads.instanceMatrix.needsUpdate = true;

    // sparkles
    for (let i = 0; i < this.NP; i++) {
      const d = this.pd[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vel.y -= 1.6 * dt;
      const o = i * 3;
      this.pPos[o] += d.vel.x * dt;
      this.pPos[o + 1] += d.vel.y * dt;
      this.pPos[o + 2] += d.vel.z * dt;
      const f = Math.max(0, d.life / d.max);
      this.pCol[o] = d.col.r * f;
      this.pCol[o + 1] = d.col.g * f;
      this.pCol[o + 2] = d.col.b * f;
      if (d.life <= 0) this.pPos[o + 1] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
