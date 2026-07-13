// Particles & flourishes: soft-dot points for dust / sparkle / splash,
// instanced spinning quads for confetti, expanding floor rings for impacts.

import * as THREE from '../vendor/three.module.min.js';

const MAX_P = 520;
const MAX_C = 160;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // --- point particles
    this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_P * 3);
    this.pCol = new Float32Array(MAX_P * 3);
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, map: dotTexture(),
      transparent: true, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX_P; i++) this.parts.push({ life: 0 });
    this.pCursor = 0;

    // --- confetti quads
    this.confGeo = new THREE.PlaneGeometry(0.24, 0.15);
    this.confMesh = new THREE.InstancedMesh(
      this.confGeo,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      MAX_C
    );
    this.confMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confMesh.frustumCulled = false;
    const colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#cc5de8', '#ff9f43'];
    this.confColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_C * 3), 3);
    for (let i = 0; i < MAX_C; i++) {
      const c = new THREE.Color(colors[i % colors.length]);
      this.confColor.setXYZ(i, c.r, c.g, c.b);
    }
    this.confGeo.setAttribute('color', this.confColor);
    this.confMesh.material.vertexColors = true;
    scene.add(this.confMesh);
    this.conf = [];
    for (let i = 0; i < MAX_C; i++) this.conf.push({ life: 0, rot: new THREE.Euler(), rv: new THREE.Vector3() });
    this._dummy = new THREE.Object3D();

    // --- impact rings
    // where particles come to rest (lowered during the bottom-world finale)
    this.floorY = 0;

    this.rings = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 40),
        new THREE.MeshBasicMaterial({ color: '#fff6dd', transparent: true, opacity: 0, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.03;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 1, dur: 1, from: 0, to: 1 });
    }
  }

  _spawn(x, y, z, vx, vy, vz, color, life, grav = 1) {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % MAX_P;
    const p = this.parts[i];
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life; p.grav = grav;
    const c = new THREE.Color(color);
    this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
  }

  // dust puff on landings & rim
  dust(x, z, scale = 1, color = '#e8cfa8') {
    const n = Math.min(14, 6 + scale * 6 | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random()) * scale;
      this._spawn(x + Math.cos(a) * 0.2, 0.08, z + Math.sin(a) * 0.2,
        Math.cos(a) * sp, 0.8 + Math.random() * 1.2 * scale, Math.sin(a) * sp,
        color, 0.5 + Math.random() * 0.3, 0.35);
    }
  }

  // sparkle stars when something is swallowed
  swallowSparkle(x, z, size, color = '#ffe066') {
    const n = Math.min(20, 8 + size * 12 | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 1.4 + Math.random() * 1.6 + size;
      this._spawn(x + Math.cos(a) * size * 0.5, 0.15, z + Math.sin(a) * size * 0.5,
        Math.cos(a) * sp, 2.2 + Math.random() * 2 + size, Math.sin(a) * sp,
        Math.random() < 0.5 ? color : '#fff5d5', 0.6 + Math.random() * 0.4, 0.9);
    }
  }

  // balloon pop burst at height
  popFlash(x, y, z, color) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const el = Math.random() * Math.PI - Math.PI / 2;
      const sp = 2.5 + Math.random() * 2;
      this._spawn(x, y, z,
        Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 1.5, Math.sin(a) * Math.cos(el) * sp,
        color, 0.5 + Math.random() * 0.3, 0.8);
    }
  }

  // よるのくに: a slow drifting glow-fly
  firefly(x, y, z) {
    this._spawn(x, y, z,
      (Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5,
      Math.random() < 0.7 ? '#b7ff7a' : '#fff3b0', 1.6 + Math.random() * 1.2, 0);
  }

  splash(x, z, big = false) {
    const n = big ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.4;
      this._spawn(x + Math.cos(a) * 0.3, 0.1, z + Math.sin(a) * 0.3,
        Math.cos(a) * sp, 3 + Math.random() * (big ? 4 : 2.4), Math.sin(a) * sp,
        Math.random() < 0.4 ? '#d5f2ff' : '#6fd2f2', 0.7 + Math.random() * 0.3, 1.1);
    }
  }

  ring(x, z, from, to, dur = 0.5, color = '#fff6dd') {
    for (const r of this.rings) {
      if (r.t < r.dur) continue;
      r.mesh.position.x = x; r.mesh.position.z = z;
      r.mesh.material.color.set(color);
      r.t = 0; r.dur = dur; r.from = from; r.to = to;
      r.mesh.visible = true;
      return;
    }
  }

  confettiBurst(x, z, count = 60, baseY = 5) {
    let placed = 0;
    for (const c of this.conf) {
      if (placed >= count) break;
      if (c.life > 0) continue;
      placed++;
      c.x = x + (Math.random() - 0.5) * 3;
      c.y = baseY + Math.random() * 3.5;
      c.z = z + (Math.random() - 0.5) * 3;
      c.vx = (Math.random() - 0.5) * 2;
      c.vy = -(0.4 + Math.random() * 0.8);
      c.vz = (Math.random() - 0.5) * 2;
      c.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.rv.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      c.life = 3.2 + Math.random() * 1.6;
    }
  }

  update(dt) {
    // points
    for (let i = 0; i < MAX_P; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { this.pPos[i * 3 + 1] = -999; continue; }
      p.life -= dt;
      p.vy -= 9.8 * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const fy = this.floorY + 0.02;
      if (p.y < fy && p.vy < 0) { p.vy *= -0.3; p.y = fy; p.vx *= 0.7; p.vz *= 0.7; }
      this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.y; this.pPos[i * 3 + 2] = p.z;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;

    // confetti
    let any = false;
    for (let i = 0; i < MAX_C; i++) {
      const c = this.conf[i];
      if (c.life <= 0) {
        this._dummy.position.set(0, -999, 0);
        this._dummy.updateMatrix();
        this.confMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      any = true;
      c.life -= dt;
      // flutter: sway sideways as it falls
      c.vx += Math.sin(c.life * 7 + i) * 2.4 * dt;
      c.vz += Math.cos(c.life * 6 + i * 1.3) * 2.4 * dt;
      c.vx *= 0.98; c.vz *= 0.98;
      c.vy = Math.max(c.vy - 1.4 * dt, -1.4);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const cfy = this.floorY + 0.03;
      if (c.y < cfy) { c.y = cfy; c.vy = 0; c.vx *= 0.9; c.vz *= 0.9; }
      c.rot.x += c.rv.x * dt; c.rot.y += c.rv.y * dt; c.rot.z += c.rv.z * dt;
      this._dummy.position.set(c.x, c.y, c.z);
      this._dummy.rotation.copy(c.rot);
      this._dummy.updateMatrix();
      this.confMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.confMesh.instanceMatrix.needsUpdate = true;
    this.confMesh.visible = any;

    // rings
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const e = 1 - (1 - k) * (1 - k);
      const rad = r.from + (r.to - r.from) * e;
      r.mesh.scale.set(rad, rad, 1);
      r.mesh.material.opacity = (1 - k) * 0.75;
    }
  }
}
