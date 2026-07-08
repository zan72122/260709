// Pooled point-sprite particles: sparkles, bubble-pop droplets, petals,
// confetti. One THREE.Points with a soft star/dot texture.

import * as THREE from '../vendor/three.module.min.js';

const MAX = 1600;

const VERT = /* glsl */`
attribute float size;
attribute vec3 pcolor;
attribute float alpha;
attribute float spin;
varying vec3 vColor;
varying float vAlpha;
varying float vSpin;
void main() {
  vColor = pcolor;
  vAlpha = alpha;
  vSpin = spin;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D map;
varying vec3 vColor;
varying float vAlpha;
varying float vSpin;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vSpin), s = sin(vSpin);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  vec4 t = texture2D(map, uv);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  if (gl_FragColor.a < 0.02) discard;
}`;

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  // 4-point sparkle star with soft glow
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(-32, -32, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.98)';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 26 : 6.5;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class ParticleSystem {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.sizeA = new Float32Array(MAX);
    this.alphaA = new Float32Array(MAX);
    this.spinA = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizeA, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphaA, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('spin', new THREE.BufferAttribute(this.spinA, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { map: { value: starTexture() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
    scene.add(this.points);

    // particle state
    this.p = [];
    for (let i = 0; i < MAX; i++) {
      this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ttl: 0, age: 0, size: 0, r: 1, g: 1, b: 1, grav: 0, spin: 0, dspin: 0, twinkle: 0, drag: 0 });
    }
    this._next = 0;
  }

  burst(x, y, z, opt = {}) {
    const count = opt.count ?? 10;
    const colors = opt.colors ?? [0xffffff];
    const speed = opt.speed ?? 1.2;
    const up = opt.up ?? 1.0;
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const P = this.p[this._next];
      this._next = (this._next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.85);
      c.set(colors[(Math.random() * colors.length) | 0]);
      P.alive = true;
      P.x = x + (Math.random() - 0.5) * (opt.spread ?? 0.1);
      P.y = y + Math.random() * 0.05;
      P.z = z + (Math.random() - 0.5) * (opt.spread ?? 0.1);
      P.vx = Math.cos(a) * sp;
      P.vz = Math.sin(a) * sp;
      P.vy = up * (0.5 + Math.random() * 0.9);
      P.ttl = (opt.ttl ?? 0.9) * (0.7 + Math.random() * 0.6);
      P.age = 0;
      P.size = (opt.size ?? 0.16) * (0.6 + Math.random() * 0.8);
      P.r = c.r; P.g = c.g; P.b = c.b;
      P.grav = opt.gravity ?? 2.4;
      P.spin = Math.random() * 6.28;
      P.dspin = (Math.random() - 0.5) * (opt.dspin ?? 6);
      P.twinkle = opt.twinkle ?? 0;
      P.drag = opt.drag ?? 0.5;
    }
  }

  confettiRain(cx, cz, area = 5) {
    const colors = [0xff8fb3, 0xffd166, 0x7ae0c3, 0x9ecbff, 0xc9a8ff, 0xfff3b0];
    for (let k = 0; k < 130; k++) {
      const P = this.p[this._next];
      this._next = (this._next + 1) % MAX;
      const c = new THREE.Color(colors[(Math.random() * colors.length) | 0]);
      P.alive = true;
      P.x = cx + (Math.random() - 0.5) * area;
      P.y = 4.5 + Math.random() * 2.5;
      P.z = cz + (Math.random() - 0.5) * area;
      P.vx = (Math.random() - 0.5) * 0.6;
      P.vy = -0.4;
      P.vz = (Math.random() - 0.5) * 0.6;
      P.ttl = 3.4 + Math.random() * 1.5;
      P.age = 0;
      P.size = 0.13 + Math.random() * 0.1;
      P.r = c.r; P.g = c.g; P.b = c.b;
      P.grav = 0.55;
      P.spin = Math.random() * 6.28;
      P.dspin = (Math.random() - 0.5) * 10;
      P.twinkle = 0.4;
      P.drag = 0.35;
    }
  }

  update(dt, time) {
    for (let i = 0; i < MAX; i++) {
      const P = this.p[i];
      const j = i * 3;
      if (!P.alive) { this.alphaA[i] = 0; continue; }
      P.age += dt;
      if (P.age >= P.ttl) { P.alive = false; this.alphaA[i] = 0; continue; }
      P.vy -= P.grav * dt;
      const dr = Math.max(0, 1 - P.drag * dt);
      P.vx *= dr; P.vz *= dr;
      P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
      if (P.y < 0.02 && P.vy < 0) { P.y = 0.02; P.vy *= -0.25; }
      P.spin += P.dspin * dt;
      const lifeK = 1 - P.age / P.ttl;
      let a = Math.min(1, lifeK * 2.4);
      if (P.twinkle > 0) a *= 1 - P.twinkle * 0.5 * (1 + Math.sin(time * 14 + i));
      this.pos[j] = P.x; this.pos[j + 1] = P.y; this.pos[j + 2] = P.z;
      this.col[j] = P.r; this.col[j + 1] = P.g; this.col[j + 2] = P.b;
      this.sizeA[i] = P.size * (0.7 + 0.5 * lifeK);
      this.alphaA[i] = a;
      this.spinA[i] = P.spin;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.pcolor.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.spin.needsUpdate = true;
  }
}
