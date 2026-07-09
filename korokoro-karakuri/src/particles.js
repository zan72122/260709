// particles.js — 紙吹雪 / 木くず / ポフッ / 漂う埃の光
import * as THREE from '../vendor/three.module.min.js';

const CONFETTI_COLORS = [0xd0544a, 0x4d80bd, 0xe8b23e, 0x6aa465, 0xe98a6f, 0xf6ead2];

export class Particles {
  constructor(scene) {
    this.scene = scene;

    // ---- 紙吹雪(InstancedMesh) ----
    this.confettiN = 160;
    const geo = new THREE.PlaneGeometry(0.14, 0.2);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
    this.confetti = new THREE.InstancedMesh(geo, mat, this.confettiN);
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colors = new Float32Array(this.confettiN * 3);
    const c = new THREE.Color();
    for (let i = 0; i < this.confettiN; i++) {
      c.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    this.confetti.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.confetti.frustumCulled = false;
    scene.add(this.confetti);
    this.cp = []; // {p,v,rot,rv,life,phase}
    for (let i = 0; i < this.confettiN; i++) {
      this.cp.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), rot: new THREE.Euler(), rv: new THREE.Vector3(), life: 0, phase: Math.random() * 10 });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);

    // ---- 小さな球バースト(木くず/キラ) ----
    this.puffN = 60;
    this.puff = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff3d8, transparent: true, opacity: 0.9 }),
      this.puffN,
    );
    this.puff.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puff.frustumCulled = false;
    scene.add(this.puff);
    this.pp = [];
    for (let i = 0; i < this.puffN; i++) {
      this.pp.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0, size: 1 });
    }
    this._nextPuff = 0;

    // ---- 漂う埃の光(加算ポイント) ----
    const dustN = 80;
    const dustPos = new Float32Array(dustN * 3);
    this.dustSeeds = [];
    for (let i = 0; i < dustN; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 11;
      dustPos[i * 3 + 1] = 1 + Math.random() * 13;
      dustPos[i * 3 + 2] = -0.8 + Math.random() * 2.4;
      this.dustSeeds.push(Math.random() * 100);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffdfae, size: 0.07, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.dust.frustumCulled = false;
    scene.add(this.dust);
    this.time = 0;
  }

  confettiBurst(pos, count = 90) {
    let n = 0;
    for (const f of this.cp) {
      if (n >= count) break;
      if (f.life > 0) continue;
      n++;
      f.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const sp = 2.2 + Math.random() * 3.4;
      f.v.set(Math.cos(a) * sp * 0.7, 2.6 + Math.random() * 3.2, Math.sin(a) * sp * 0.4);
      f.rv.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      f.life = 2.6 + Math.random() * 1.2;
    }
  }

  // 着地の木くず/キラッ
  burst(pos, count = 6, speed = 1.6) {
    for (let i = 0; i < count; i++) {
      const f = this.pp[this._nextPuff];
      this._nextPuff = (this._nextPuff + 1) % this.puffN;
      f.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      f.v.set(Math.cos(a) * speed * (0.4 + Math.random() * 0.6), speed * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * speed * 0.5);
      f.life = 0.45 + Math.random() * 0.3;
      f.size = 0.6 + Math.random() * 0.8;
    }
  }

  // 発射の残像キラ
  trailBurst(pos) { this.burst(pos, 14, 2.6); }

  // ポフッ(リスポーン)
  poof(pos) { this.burst(pos, 12, 1.2); }

  update(dt) {
    this.time += dt;
    // 紙吹雪
    for (let i = 0; i < this.confettiN; i++) {
      const f = this.cp[i];
      if (f.life > 0) {
        f.life -= dt;
        f.v.y -= 5.5 * dt;
        f.v.multiplyScalar(1 - 1.1 * dt);
        // ひらひら
        f.v.x += Math.sin(this.time * 6 + f.phase) * 1.6 * dt;
        f.p.addScaledVector(f.v, dt);
        f.rot.x += f.rv.x * dt; f.rot.y += f.rv.y * dt; f.rot.z += f.rv.z * dt;
        const s = Math.min(1, f.life * 2);
        this._q.setFromEuler(f.rot);
        this._s.setScalar(Math.max(0.001, s));
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
        f.v.y -= 3.5 * dt;
        f.p.addScaledVector(f.v, dt);
        const s = Math.max(0.001, f.life * 2 * f.size);
        this._m.makeScale(s, s, s).setPosition(f.p);
      } else {
        this._m.makeScale(0.0001, 0.0001, 0.0001);
      }
      this.puff.setMatrixAt(i, this._m);
    }
    this.puff.instanceMatrix.needsUpdate = true;

    // 埃はゆっくり漂う
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = this.dustSeeds[i];
      pos.setY(i, pos.getY(i) + Math.sin(this.time * 0.35 + s) * 0.0012);
      pos.setX(i, pos.getX(i) + Math.cos(this.time * 0.22 + s * 1.7) * 0.0012);
    }
    pos.needsUpdate = true;
  }
}
