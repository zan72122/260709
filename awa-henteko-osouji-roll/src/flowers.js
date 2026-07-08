// Garden life: instanced sprouts + flowers that bloom along watered trails,
// and simple flapping butterflies that visit the blossoms.

import * as THREE from '../vendor/three.module.min.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

function hash(i) { const x = Math.sin(i * 91.7 + 33.3) * 43758.5453; return x - Math.floor(x); }

function flowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.018, 0.028, 0.34, 5);
  stem.translate(0, 0.17, 0);
  parts.push({ g: stem, c: new THREE.Color(0x4f9e46) });
  const centre = new THREE.SphereGeometry(0.055, 8, 6);
  centre.translate(0, 0.37, 0);
  parts.push({ g: centre, c: new THREE.Color(0xffd75e) });
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.SphereGeometry(0.062, 7, 5);
    petal.scale(1.5, 0.5, 1);                 // long axis along X
    const a = (i / 6) * Math.PI * 2;
    petal.rotateY(-a);                        // point the long axis radially
    petal.translate(Math.cos(a) * 0.105, 0.37, Math.sin(a) * 0.105);
    parts.push({ g: petal, c: new THREE.Color(1, 1, 1) }); // white → tinted per-instance
  }
  // merge with vertex colors
  let total = 0;
  for (const p of parts) total += p.g.toNonIndexed().attributes.position.count;
  const pos = []; const nor = []; const col = [];
  for (const p of parts) {
    const g = p.g.toNonIndexed();
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i += 3) {
      pos.push(pa[i], pa[i + 1], pa[i + 2]);
      nor.push(na[i], na[i + 1], na[i + 2]);
      col.push(p.c.r, p.c.g, p.c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const PETAL_TINTS = [0xff8fb3, 0xffb3c9, 0xff9d76, 0xc9a8ff, 0x9ecbff, 0xffd166, 0xff8080];

export class GardenLife {
  constructor(scene, sim, maxFlowers = 420) {
    this.sim = sim;
    this.max = maxFlowers;

    const fmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.flowers = new THREE.InstancedMesh(flowerGeometry(), fmat, maxFlowers);
    this.flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxFlowers * 3).fill(1), 3);
    this.flowers.count = 0;
    this.flowers.frustumCulled = false;
    scene.add(this.flowers);
    this.list = []; // {x,z,age,seed}

    const sgeo = new THREE.ConeGeometry(0.05, 0.16, 5);
    sgeo.translate(0, 0.08, 0);
    this.sprouts = new THREE.InstancedMesh(sgeo, new THREE.MeshLambertMaterial({ color: 0x62b656 }), 500);
    this.sprouts.count = 0;
    this.sprouts.frustumCulled = false;
    scene.add(this.sprouts);

    // butterflies: two-triangle wings
    this.butterflies = [];
    this.bfGroup = new THREE.Group();
    scene.add(this.bfGroup);
    this._frame = 0;
  }

  addFlower(x, z) {
    if (this.list.length >= this.max) return;
    this.list.push({ x, z, age: 0, seed: Math.random() });
    if (this.butterflies.length < 4 && this.list.length >= 6 * (this.butterflies.length + 1)) {
      this._spawnButterfly();
    }
  }

  _spawnButterfly() {
    const colors = [0xffa64d, 0x9ecbff, 0xff8fb3, 0xfff08f];
    const c = colors[this.butterflies.length % colors.length];
    const g = new THREE.Group();
    const wingGeo = new THREE.CircleGeometry(0.14, 6, 0, Math.PI);
    const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const w1 = new THREE.Mesh(wingGeo, mat);
    const w2 = new THREE.Mesh(wingGeo, mat);
    w1.position.x = -0.02; w2.position.x = 0.02;
    w1.rotation.z = Math.PI / 2; w2.rotation.z = -Math.PI / 2;
    g.add(w1); g.add(w2);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.12, 3, 5), new THREE.MeshBasicMaterial({ color: 0x5a4632 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    this.bfGroup.add(g);
    this.butterflies.push({ g, w1, w2, x: 0, y: 2.5, z: 0, tx: 0, ty: 1, tz: 0, seed: Math.random() * 9, retarget: 0 });
  }

  update(dt, time) {
    this._frame++;
    // flowers grow in with a springy pop
    let n = Math.min(this.list.length, this.max);
    for (let i = 0; i < n; i++) {
      const f = this.list[i];
      f.age += dt;
      const t = Math.min(1, f.age * 1.6);
      const spring = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 9) : 1;
      const sc = Math.max(0.01, spring) * (0.8 + 0.45 * f.seed);
      _p.set(f.x, 0, f.z);
      _e.set(Math.sin(f.seed * 9) * 0.12, f.seed * 6.28, Math.cos(f.seed * 7) * 0.12 + Math.sin(time * 1.4 + f.seed * 8) * 0.05);
      _q.setFromEuler(_e);
      _s.set(sc, sc, sc);
      _m.compose(_p, _q, _s);
      this.flowers.setMatrixAt(i, _m);
      if (f.age < 2) {
        const c = new THREE.Color(PETAL_TINTS[(f.seed * PETAL_TINTS.length) | 0]);
        this.flowers.instanceColor.setXYZ(i, c.r, c.g, c.b);
      }
    }
    this.flowers.count = n;
    this.flowers.instanceMatrix.needsUpdate = true;
    this.flowers.instanceColor.needsUpdate = true;

    // sprouts from sim.grow (rebuild every few frames)
    if (this._frame % 3 === 0 && this.sim.cfg.grow) {
      const sim = this.sim, N = sim.N;
      let c = 0;
      for (let i = 0; i < N * N && c < 500; i++) {
        const gr = sim.grow[i];
        if (gr <= 0.25 || gr >= 1) continue;
        if (hash(i) > 0.5) continue; // thin them out
        const [wx, wz] = sim.worldOf(i % N, (i / N) | 0);
        _p.set(wx + (hash(i * 3) - 0.5) * sim.cell, 0, wz + (hash(i * 5) - 0.5) * sim.cell);
        _q.identity();
        const sc = 0.4 + gr;
        _s.set(sc, sc * (0.5 + gr), sc);
        _m.compose(_p, _q, _s);
        this.sprouts.setMatrixAt(c, _m);
        c++;
      }
      this.sprouts.count = c;
      this.sprouts.instanceMatrix.needsUpdate = true;
    }

    // butterflies flutter between flowers
    for (const b of this.butterflies) {
      b.retarget -= dt;
      if (b.retarget <= 0 && this.list.length > 0) {
        const f = this.list[(Math.random() * this.list.length) | 0];
        b.tx = f.x; b.tz = f.z; b.ty = 0.55 + Math.random() * 1.4;
        b.retarget = 2.5 + Math.random() * 3;
      }
      const k = Math.min(1, dt * 0.8);
      b.x += (b.tx - b.x) * k + Math.sin(time * 2.2 + b.seed) * dt * 0.5;
      b.y += (b.ty - b.y) * k + Math.cos(time * 3.1 + b.seed) * dt * 0.3;
      b.z += (b.tz - b.z) * k + Math.cos(time * 1.9 + b.seed * 2) * dt * 0.5;
      b.g.position.set(b.x, b.y, b.z);
      b.g.rotation.y = Math.atan2(b.tx - b.x, b.tz - b.z);
      const flap = Math.sin(time * 16 + b.seed * 5) * 0.9;
      b.w1.rotation.y = flap;
      b.w2.rotation.y = -flap;
    }
  }
}
