// Pushable toys: rubber duck, strawberries, blueberries. Simple circle
// physics — the roller bumps them, they glide, bounce off walls and each
// other, and wobble happily.

import * as THREE from '../vendor/three.module.min.js';

function duckMesh() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshPhongMaterial({ color: 0xffd93d, shininess: 60, specular: 0x666655 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), yellow);
  body.scale.set(1.15, 0.82, 1);
  body.position.y = 0.26;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), yellow);
  head.position.set(0.24, 0.6, 0);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), new THREE.MeshPhongMaterial({ color: 0xff8c42, shininess: 40 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.44, 0.58, 0);
  g.add(beak);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x33302a });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat);
    eye.position.set(0.33, 0.67, 0.1 * s);
    g.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.345, 0.68, 0.105 * s);
    g.add(hl);
  }
  const wingMat = new THREE.MeshPhongMaterial({ color: 0xffc93d, shininess: 50 });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), wingMat);
    wing.scale.set(1.2, 0.6, 0.5);
    wing.position.set(-0.02, 0.32, 0.28 * s);
    g.add(wing);
  }
  return g;
}

function strawberryMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 12),
    new THREE.MeshPhongMaterial({ color: 0xe8384f, shininess: 70, specular: 0x884444 })
  );
  body.scale.set(1, 1.2, 1);
  body.position.y = 0.22;
  g.add(body);
  const seedMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 14; i++) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), seedMat);
    const a = (i / 14) * Math.PI * 2 * 2.4, y = 0.1 + (i / 14) * 0.24;
    const r = 0.195 * Math.sin(Math.acos(Math.min(1, Math.abs(y - 0.22) / 0.24)));
    seed.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(seed);
  }
  const leafMat = new THREE.MeshPhongMaterial({ color: 0x51a54b });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.07, 0.45, Math.sin(a) * 0.07);
    leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    g.add(leaf);
  }
  return g;
}

function blueberryMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 10),
    new THREE.MeshPhongMaterial({ color: 0x5a6fd6, shininess: 80, specular: 0x9999cc })
  );
  body.scale.y = 0.9;
  body.position.y = 0.14;
  g.add(body);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.045, 5), new THREE.MeshBasicMaterial({ color: 0x39457e }));
  star.rotation.x = -Math.PI / 2;
  star.position.y = 0.285;
  g.add(star);
  return g;
}

const BUILDERS = { duck: duckMesh, strawberry: strawberryMesh, blueberry: blueberryMesh };
const SCALES = { duck: 1.35, strawberry: 1.9, blueberry: 1.9 };
const RADII = { duck: 0.55, strawberry: 0.42, blueberry: 0.3 };

export class PropWorld {
  constructor(scene, floorHalf) {
    this.scene = scene;
    this.half = floorHalf;
    this.props = [];
    this.onBump = null; // (type, speed)
  }

  add(type, x, z) {
    const mesh = BUILDERS[type]();
    mesh.scale.setScalar(SCALES[type]);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * 6.28;
    this.scene.add(mesh);
    const p = { type, mesh, x, z, vx: 0, vz: 0, r: RADII[type], baseScale: SCALES[type], wobble: 0, seed: Math.random() * 9 };
    this.props.push(p);
    return p;
  }

  // roller: {x, z, r, vx, vz}
  update(dt, time, roller) {
    const H = this.half - 0.5;
    for (const p of this.props) {
      // bump from the roller
      const dx = p.x - roller.x, dz = p.z - roller.z;
      const d = Math.hypot(dx, dz), minD = p.r + roller.r;
      if (d < minD && d > 1e-4) {
        const nx = dx / d, nz = dz / d;
        const rel = (roller.vx * nx + roller.vz * nz);
        const push = Math.max(0.6, rel * 1.15);
        p.vx += nx * push; p.vz += nz * push;
        p.x = roller.x + nx * minD; p.z = roller.z + nz * minD;
        p.wobble = 1;
        if (this.onBump) this.onBump(p.type, Math.abs(push));
      }
      // prop ↔ prop
      for (const q of this.props) {
        if (q === p) continue;
        const ddx = p.x - q.x, ddz = p.z - q.z;
        const dd = Math.hypot(ddx, ddz), md = p.r + q.r;
        if (dd < md && dd > 1e-4) {
          const nx = ddx / dd, nz = ddz / dd, ov = (md - dd) * 0.5;
          p.x += nx * ov; p.z += nz * ov;
          q.x -= nx * ov; q.z -= nz * ov;
          const t = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz;
          if (t < 0) {
            p.vx -= t * nx * 0.9; p.vz -= t * nz * 0.9;
            q.vx += t * nx * 0.9; q.vz += t * nz * 0.9;
          }
        }
      }
      // integrate + wall bounce + friction
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.x < -H) { p.x = -H; p.vx = Math.abs(p.vx) * 0.6; }
      if (p.x > H) { p.x = H; p.vx = -Math.abs(p.vx) * 0.6; }
      if (p.z < -H) { p.z = -H; p.vz = Math.abs(p.vz) * 0.6; }
      if (p.z > H) { p.z = H; p.vz = -Math.abs(p.vz) * 0.6; }
      const fr = Math.max(0, 1 - 1.7 * dt);
      p.vx *= fr; p.vz *= fr;
      p.wobble = Math.max(0, p.wobble - dt * 1.6);

      const sp = Math.hypot(p.vx, p.vz);
      p.mesh.position.set(p.x, Math.abs(Math.sin(time * 5 + p.seed)) * 0.02 * (1 + p.wobble * 3), p.z);
      if (sp > 0.05) p.mesh.rotation.y += (Math.atan2(p.vx, p.vz) - p.mesh.rotation.y) * Math.min(1, dt * 4);
      const wob = 1 + Math.sin(time * 13 + p.seed) * 0.12 * p.wobble;
      p.mesh.scale.set(p.baseScale * wob, p.baseScale * (2 - wob), p.baseScale * wob);
    }
  }
}
