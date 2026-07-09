// GPU-billboarded sparkle pool. One THREE.Points with per-particle size /
// color / alpha attributes drives every effect in the game: tap bursts,
// fairy stardust trails, gem glitter, rainbow spirals, fireworks, confetti,
// firefly ambience and the door's sparkle rain.

import * as THREE from '../vendor/three.module.min.js';

function makeStarTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const cx = s / 2;
  // soft glow
  const grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // 4-point star flare
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  const R = cx * 0.95, r = cx * 0.10;
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    g[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * rad, cx + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vA;
varying vec3 vC;
void main() {
  vC = aColor;
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (280.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D map;
varying float vA;
varying vec3 vC;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC * t.rgb, t.a * vA);
  if (gl_FragColor.a < 0.01) discard;
}`;

export class SparkleField {
  constructor(scene, max = 2000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.twinkle = new Float32Array(max);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    // huge static bounding sphere: particles roam everywhere, never cull
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 100);

    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeStarTexture() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  spawn(x, y, z, vx, vy, vz, color, life, size, grav = 0, drag = 0.9, twinkle = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this._c.set(color);
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = size;
    this.grav[i] = grav; this.drag[i] = drag; this.twinkle[i] = twinkle;
  }

  /** Radial burst of n sparkles. */
  burst(p, colors, n = 20, speed = 2.4, life = 0.9, size = 0.5, grav = 0.6, twinkle = 0) {
    const list = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.spawn(
        p.x, p.y, p.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.9 + speed * 0.2, Math.sin(ph) * Math.sin(th) * sp,
        list[(Math.random() * list.length) | 0],
        life * (0.7 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), grav, 0.94, twinkle
      );
    }
  }

  /** Single soft trail mote. */
  trail(p, color, size = 0.34) {
    this.spawn(
      p.x + (Math.random() - 0.5) * 0.16, p.y + (Math.random() - 0.5) * 0.16, p.z + (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3,
      color, 0.8 + Math.random() * 0.5, size, -0.2, 0.9, 1
    );
  }

  /** Big twinkling firework at p. */
  firework(p, colors) {
    this.burst(p, colors, 70, 4.6, 1.7, 0.62, 2.2, 1);
    this.burst(p, 0xffffff, 16, 1.6, 1.1, 0.4, 1.4, 1);
  }

  /** Slow falling sparkle rain above p (door opening, wishes). */
  rain(p, colors, n = 30, radius = 3) {
    const list = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      this.spawn(
        p.x + Math.cos(a) * r, p.y + 3 + Math.random() * 3, p.z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.3, -0.4 - Math.random() * 0.5, (Math.random() - 0.5) * 0.3,
        list[(Math.random() * list.length) | 0], 2.2 + Math.random() * 1.4, 0.5, 0.25, 0.99, 1
      );
    }
  }

  update(dt, t) {
    const n = this.max;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const i3 = i * 3;
      const dragK = Math.pow(this.drag[i], dt * 60);
      this.vel[i3] *= dragK;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dragK - this.grav[i] * dt;
      this.vel[i3 + 2] *= dragK;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.04) { this.pos[i3 + 1] = 0.04; this.vel[i3 + 1] *= -0.3; }
      let a = k < 0.3 ? k / 0.3 : 1;
      if (this.twinkle[i] > 0) a *= 0.55 + 0.45 * Math.sin(t * 18 + i * 1.7);
      this.alpha[i] = a;
      this.size[i] = this.size0[i] * (0.5 + 0.5 * k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }
}

/** Ambient fireflies / stardust motes drifting around the garden. */
export class Fireflies {
  constructor(scene) {
    this.field = null;
    this.scene = scene;
    this.count = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sprites = [];
  }

  setCount(n, color = 0xfff3a8) {
    for (const s of this.sprites) this.group.remove(s);
    this.sprites.length = 0;
    if (!Fireflies._tex) Fireflies._tex = makeStarTexture();
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({
        map: Fireflies._tex, color, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 16;
      s.position.set(Math.cos(a) * r, 0.6 + Math.random() * 4.5, Math.sin(a) * r);
      s.scale.setScalar(0.12 + Math.random() * 0.16);
      s.userData = { seed: Math.random() * 100, base: s.position.clone() };
      this.group.add(s);
      this.sprites.push(s);
    }
  }

  update(t) {
    for (const s of this.sprites) {
      const u = s.userData;
      s.position.x = u.base.x + Math.sin(t * 0.4 + u.seed) * 0.9;
      s.position.y = u.base.y + Math.sin(t * 0.7 + u.seed * 2) * 0.5;
      s.position.z = u.base.z + Math.cos(t * 0.5 + u.seed) * 0.9;
      s.material.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + u.seed * 5));
    }
  }
}

export { makeStarTexture };
