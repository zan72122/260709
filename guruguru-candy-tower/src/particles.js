// particles.js — スプリンクル紙吹雪 / キラ・クリームはね / 打ち上げ軌跡 / 漂う砂糖の光
import * as THREE from '../vendor/three.module.min.js';
import { wrapPos } from './wrap.js';

const SPRINKLE_COLORS = [0xff6f9c, 0x5db9ff, 0xffd24a, 0x7fd97f, 0xc792ff, 0xff9d5c];

export class Particles {
  constructor(scene) {
    this.scene = scene;

    // ---- スプリンクル紙吹雪(細長い棒) ----
    this.confettiN = 170;
    this.confetti = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.035, 0.16, 3, 6),
      new THREE.MeshBasicMaterial({}),
      this.confettiN,
    );
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(this.confettiN * 3);
    const c = new THREE.Color();
    for (let i = 0; i < this.confettiN; i++) {
      c.setHex(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    this.confetti.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.confetti.frustumCulled = false;
    scene.add(this.confetti);
    this.cp = [];
    for (let i = 0; i < this.confettiN; i++) {
      this.cp.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), rot: new THREE.Euler(), rv: new THREE.Vector3(), life: 0, phase: Math.random() * 10 });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);

    // ---- 小さな球バースト(キラ/クリーム/チョコ) ----
    this.puffN = 70;
    this.puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.puff = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), this.puffMat, this.puffN);
    this.puff.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pcolors = new Float32Array(this.puffN * 3);
    for (let i = 0; i < this.puffN; i++) { pcolors[i * 3] = 1; pcolors[i * 3 + 1] = 1; pcolors[i * 3 + 2] = 1; }
    this.puff.instanceColor = new THREE.InstancedBufferAttribute(pcolors, 3);
    this.puff.frustumCulled = false;
    scene.add(this.puff);
    this.pp = [];
    for (let i = 0; i < this.puffN; i++) {
      this.pp.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0, size: 1 });
    }
    this._nextPuff = 0;

    // ---- 砂糖の光(漂う) ----
    const dustN = 90;
    const dustPos = new Float32Array(dustN * 3);
    this.dustSeeds = [];
    for (let i = 0; i < dustN; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 6.5;
      dustPos[i * 3] = Math.cos(a) * r;
      dustPos[i * 3 + 1] = Math.random() * 15;
      dustPos[i * 3 + 2] = Math.sin(a) * r;
      this.dustSeeds.push(Math.random() * 100);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xfff0d8, size: 0.08, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    this.time = 0;
    this._trails = []; // {ball, until}
  }

  confettiBurst(pos, count = 110) {
    let n = 0;
    for (const f of this.cp) {
      if (n >= count) break;
      if (f.life > 0) continue;
      n++;
      f.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const sp = 2.2 + Math.random() * 3.6;
      f.v.set(Math.cos(a) * sp * 0.8, 2.8 + Math.random() * 3.4, Math.sin(a) * sp * 0.8);
      f.rv.set(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      f.life = 2.8 + Math.random() * 1.3;
    }
  }

  burst(pos, count = 6, speed = 1.6, colorHex = 0xfff3d8) {
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      const f = this.pp[this._nextPuff];
      const idx = this._nextPuff;
      this._nextPuff = (this._nextPuff + 1) % this.puffN;
      f.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      f.v.set(Math.cos(a) * speed * (0.4 + Math.random() * 0.6), speed * (0.6 + Math.random() * 0.8), Math.sin(a) * speed * 0.5);
      f.life = 0.45 + Math.random() * 0.3;
      f.size = 0.6 + Math.random() * 0.8;
      this.puff.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    }
    this.puff.instanceColor.needsUpdate = true;
  }

  // 打ち上げ中の玉の後ろにキラキラを撒く
  trailFollow(ball, seconds) {
    this._trails.push({ ball, until: this.time + seconds });
  }

  poof(pos) { this.burst(pos, 12, 1.2); }

  update(dt) {
    this.time += dt;
    // 軌跡
    for (let i = this._trails.length - 1; i >= 0; i--) {
      const t = this._trails[i];
      if (this.time > t.until || t.ball.mode === 'hidden') { this._trails.splice(i, 1); continue; }
      if (Math.random() < 0.7) {
        this.burst(wrapPos(t.ball.p.x, t.ball.p.y, t.ball.p.z), 2, 0.8, SPRINKLE_COLORS[(Math.random() * 6) | 0]);
      }
    }
    // 紙吹雪
    for (let i = 0; i < this.confettiN; i++) {
      const f = this.cp[i];
      if (f.life > 0) {
        f.life -= dt;
        f.v.y -= 5.5 * dt;
        f.v.multiplyScalar(1 - 1.1 * dt);
        f.v.x += Math.sin(this.time * 6 + f.phase) * 1.4 * dt;
        f.p.addScaledVector(f.v, dt);
        f.rot.x += f.rv.x * dt; f.rot.y += f.rv.y * dt; f.rot.z += f.rv.z * dt;
        this._q.setFromEuler(f.rot);
        this._s.setScalar(Math.max(0.001, Math.min(1, f.life * 2)));
        this._m.compose(f.p, this._q, this._s);
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.confetti.setMatrixAt(i, this._m);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
    // パフ
    for (let i = 0; i < this.puffN; i++) {
      const f = this.pp[i];
      if (f.life > 0) {
        f.life -= dt;
        f.v.y -= 3.2 * dt;
        f.p.addScaledVector(f.v, dt);
        const s = Math.max(0.001, f.life * 2 * f.size);
        this._m.makeScale(s, s, s).setPosition(f.p);
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.puff.setMatrixAt(i, this._m);
    }
    this.puff.instanceMatrix.needsUpdate = true;
    // 砂糖の光
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = this.dustSeeds[i];
      pos.setY(i, pos.getY(i) + Math.sin(this.time * 0.35 + s) * 0.0013);
      pos.setX(i, pos.getX(i) + Math.cos(this.time * 0.22 + s * 1.7) * 0.0012);
    }
    pos.needsUpdate = true;
  }
}
