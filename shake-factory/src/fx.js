// ---------------------------------------------------------------------------
// fx.js — juicy feedback: syrup droplets, sparkles, confetti, pop rings.
// Everything is pooled & instanced so it stays fast on iPhones.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const G = -9.5;

// ============================ syrup droplets ================================
export class Drops {
  constructor(scene, capacity = 160) {
    this.cap = capacity;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }),
      capacity
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < capacity; i++) this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, s: 1, color: new THREE.Color(), colorHex: 0xffffff });
    this._mat4 = new THREE.Matrix4();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    // callback set by main: (drop) => 'caught' | 'floor' | null
    this.onLand = null;
  }

  spawn(x, y, colorHex, vx = 0, vy = 0, scale = 1) {
    const d = this.items.find(i => !i.alive);
    if (!d) return;
    d.alive = true;
    d.x = x + (Math.random() - 0.5) * 0.05;
    d.y = y; d.z = (Math.random() - 0.5) * 0.06;
    d.vx = vx + (Math.random() - 0.5) * 0.4;
    d.vy = vy - Math.random() * 0.4;
    d.s = scale * (0.8 + Math.random() * 0.6);
    d.color.set(colorHex);
    d.colorHex = colorHex;
  }

  update(dt) {
    const M = this._mat4;
    for (let i = 0; i < this.cap; i++) {
      const d = this.items[i];
      if (!d.alive) { this.mesh.setMatrixAt(i, this._zero); continue; }
      d.vy += G * dt * 1.15;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // stretch along velocity → looks liquid
      const stretch = 1 + Math.min(1.4, Math.abs(d.vy) * 0.12);
      M.makeScale(d.s, d.s * stretch, d.s);
      M.setPosition(d.x, d.y, d.z);
      this.mesh.setMatrixAt(i, M);
      this.mesh.setColorAt(i, d.color);
      if (d.y < 2.4 && this.onLand) {           // near cup-rim height and below
        const hit = this.onLand(d);
        if (hit) d.alive = false;
      }
      if (d.y < 0.05) {
        if (this.onLand) this.onLand(d, true);
        d.alive = false;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ============================ sparkles ======================================
export class Sparkles {
  constructor(scene, capacity = 120) {
    this.cap = capacity;
    const tex = makeStarTexture();
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex } },
      vertexShader: /* glsl */`
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * t;
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.items = [];
    for (let i = 0; i < capacity; i++) this.items.push({ alive: false, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, color: new THREE.Color() });
  }

  burst(x, y, z, colorHex, n = 8, speed = 1.6) {
    for (let k = 0; k < n; k++) {
      const s = this.items.find(i => !i.alive);
      if (!s) return;
      s.alive = true; s.life = 0; s.max = 0.4 + Math.random() * 0.5;
      s.x = x; s.y = y; s.z = z;
      const a = Math.random() * Math.PI * 2, up = Math.random();
      s.vx = Math.cos(a) * speed * (0.4 + Math.random() * 0.8);
      s.vy = up * speed * 1.2;
      s.vz = Math.sin(a) * speed * 0.4;
      s.size = 0.7 + Math.random() * 1.1;
      if (colorHex === 'rainbow') s.color.setHSL(Math.random(), 0.8, 0.7);
      else s.color.set(colorHex).lerp(new THREE.Color(0xffffff), 0.3);
    }
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      const s = this.items[i];
      if (!s.alive) { this.sizes[i] = 0; continue; }
      s.life += dt;
      const u = s.life / s.max;
      if (u >= 1) { s.alive = false; this.sizes[i] = 0; continue; }
      s.vy += G * 0.35 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      this.positions[i * 3] = s.x; this.positions[i * 3 + 1] = s.y; this.positions[i * 3 + 2] = s.z;
      this.colors[i * 3] = s.color.r; this.colors[i * 3 + 1] = s.color.g; this.colors[i * 3 + 2] = s.color.b;
      this.sizes[i] = s.size * (1 - u * 0.8);
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }
}

function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  // 4-point twinkle
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath();
  g.moveTo(32, 2); g.quadraticCurveTo(35, 28, 62, 32); g.quadraticCurveTo(35, 36, 32, 62);
  g.quadraticCurveTo(29, 36, 2, 32); g.quadraticCurveTo(29, 28, 32, 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ============================ confetti ======================================
export class Confetti {
  constructor(scene, capacity = 110) {
    this.cap = capacity;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.1),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      capacity
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < capacity; i++) this.items.push({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, rx: 0, rz: 0, wx: 0, wz: 0, life: 0,
      color: new THREE.Color(),
    });
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  celebrate(cx = 0, cy = 6) {
    for (const c of this.items) {
      c.alive = true;
      c.life = 2.4 + Math.random() * 1.4;
      c.x = cx + (Math.random() - 0.5) * 3;
      c.y = cy + Math.random() * 2.5;
      c.z = 1.4 + Math.random() * 1.6;
      c.vx = (Math.random() - 0.5) * 2.4;
      c.vy = 1 + Math.random() * 2.2;
      c.rx = Math.random() * 7; c.rz = Math.random() * 7;
      c.wx = (Math.random() - 0.5) * 9; c.wz = (Math.random() - 0.5) * 9;
      c.color.setHSL(Math.random(), 0.85, 0.62);
    }
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      const c = this.items[i];
      if (!c.alive) { this.mesh.setMatrixAt(i, this._zero); continue; }
      c.life -= dt;
      if (c.life <= 0 || c.y < 0.02) { c.alive = false; this.mesh.setMatrixAt(i, this._zero); continue; }
      c.vy += G * 0.16 * dt;
      c.vy = Math.max(c.vy, -1.6);        // flutter terminal velocity
      c.x += c.vx * dt + Math.sin(c.rx * 2) * dt * 0.6;
      c.y += c.vy * dt;
      c.rx += c.wx * dt; c.rz += c.wz * dt;
      this._e.set(c.rx, c.rz, c.rx * 0.7);
      this._q.setFromEuler(this._e);
      this._m.makeRotationFromQuaternion(this._q);
      this._m.setPosition(c.x, c.y, c.z);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, c.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
