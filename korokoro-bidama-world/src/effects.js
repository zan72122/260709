// Particles: sparkles (points), confetti (instanced quads) and mesh pulses.
import * as THREE from '../vendor/three.module.min.js';
import { makeStarTexture } from './environment.js';

export class Sparkles {
  constructor(scene, max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: makeStarTexture() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D tex;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(tex, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * t;
        }`,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.scene = scene;
  }

  emit(x, y, z, color, n = 8, spread = 1.6, up = 1.2, size = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.vel[i * 3] = Math.cos(a) * r;
      this.vel[i * 3 + 1] = Math.random() * up + up * 0.4;
      this.vel[i * 3 + 2] = Math.sin(a) * r;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.maxLife[i] = this.life[i] = 0.5 + Math.random() * 0.6;
      this.size[i] = (0.5 + Math.random() * 0.7) * size;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= 3.4 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = f * f * 1.2;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.uniforms.tex.value.dispose();
    this.points.material.dispose();
  }
}

const CONFETTI_COLORS = [0xff5f7e, 0xffd94d, 0x7fe062, 0x53a6ff, 0xff9d4d, 0xff7ce4, 0x4dd2c2];

export class Confetti {
  constructor(scene, max = 130) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(0.16, 0.24);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
    this.items = [];
    for (let i = 0; i < max; i++) {
      this.items.push({
        p: new THREE.Vector3(), v: new THREE.Vector3(),
        rot: new THREE.Euler(), rv: new THREE.Vector3(), life: 0,
      });
    }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
    scene.add(this.mesh);
    this.scene = scene;
  }

  burst(x, y, z, n = 60) {
    let spawned = 0;
    for (const it of this.items) {
      if (it.life > 0) continue;
      it.p.set(x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5));
      const a = Math.random() * Math.PI * 2;
      it.v.set(Math.cos(a) * (1 + Math.random() * 2), 3 + Math.random() * 3.5, Math.sin(a) * (1 + Math.random() * 2));
      it.rv.set(Math.random() * 7, Math.random() * 7, Math.random() * 7);
      it.life = 2.2 + Math.random();
      if (++spawned >= n) break;
    }
  }

  update(dt) {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (it.life <= 0) continue;
      any = true;
      it.life -= dt;
      it.v.y -= 5.5 * dt;
      it.v.multiplyScalar(1 - 0.7 * dt);
      it.v.y = Math.max(it.v.y, -1.6); // flutter fall
      it.p.addScaledVector(it.v, dt);
      it.rot.x += it.rv.x * dt; it.rot.y += it.rv.y * dt; it.rot.z += it.rv.z * dt;
      q.setFromEuler(it.rot);
      const sc = Math.min(1, it.life * 2);
      s.setScalar(sc);
      m4.compose(it.p, q, s);
      this.mesh.setMatrixAt(i, m4);
      if (it.life <= 0) {
        m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, m4);
      }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// scale/emissive pulses on gimmick meshes (chime flash, bumper pop...)
export class Pulses {
  constructor() { this.items = []; }
  add(obj, { scale = 1.35, emissive = 1.2 } = {}) {
    let it = this.items.find(i => i.obj === obj);
    if (!it) {
      it = {
        obj,
        baseScale: obj.scale.x,
        baseEmissive: obj.material && obj.material.emissiveIntensity !== undefined ? obj.material.emissiveIntensity : null,
        t: 0,
      };
      this.items.push(it);
    }
    it.t = 1;
    it.scale = scale;
    it.emissive = emissive;
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t = Math.max(0, it.t - dt * 3.2);
      const f = it.t * it.t;
      const s = it.baseScale * (1 + (it.scale - 1) * f);
      it.obj.scale.setScalar(s);
      if (it.baseEmissive !== null && it.obj.material) {
        it.obj.material.emissiveIntensity = it.baseEmissive + it.emissive * f;
      }
      if (it.t <= 0) {
        it.obj.scale.setScalar(it.baseScale);
        if (it.baseEmissive !== null && it.obj.material) it.obj.material.emissiveIntensity = it.baseEmissive;
        this.items.splice(i, 1);
      }
    }
  }
}
