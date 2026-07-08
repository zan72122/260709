// きらきら・紙ふぶき・霧つぶ をぜんぶ引きうけるパーティクル
import * as THREE from 'three';
import { rand, TAU, hsl } from './utils.js';
import { makeGlowTexture } from './scene3d.js';

const MAX = 800;

export class SparkleSystem {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.sizeAttr = new Float32Array(MAX);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    // PointsMaterial は per-point size 不可なので shader を軽く使う
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.sizeAttr, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeGlowTexture() } },
      vertexShader: `
        attribute float psize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * tex;
        }`,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.parts = []; // {x,y,z, vx,vy,vz, life,maxLife, size, r,g,b, grav, drag, twinkle}
  }

  _spawn(p) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push(p);
  }

  _color3(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  // ぱっと弾ける
  burst(pos, hex, n = 10, speed = 2.2, size = 0.28, life = 0.7) {
    const [r, g, b] = this._color3(hex);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), el = rand(-0.6, 0.9);
      const sp = speed * rand(0.3, 1);
      this._spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.abs(el) * sp * 0.6,
        life: 0, maxLife: life * rand(0.6, 1.3),
        size: size * rand(0.6, 1.4), r, g, b,
        grav: -1.6, drag: 3, twinkle: 8,
      });
    }
  }

  // その場でチカッ(光あそび用)
  twinkle(pos, hex = 0xffffff, size = 0.4, life = 0.5) {
    const [r, g, b] = this._color3(hex);
    this._spawn({
      x: pos.x + rand(-0.06, 0.06), y: pos.y + rand(-0.06, 0.06), z: pos.z + 0.12,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: life * rand(0.7, 1.3),
      size: size * rand(0.7, 1.3), r, g, b,
      grav: 0, drag: 0, twinkle: 14,
    });
  }

  // 霧のこまかいつぶ
  mist(pos, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(0.6, 2.4);
      this._spawn({
        x: pos.x, y: pos.y, z: pos.z + rand(0, 0.6),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 0.3, vz: rand(0.2, 1),
        life: 0, maxLife: rand(0.35, 0.8),
        size: rand(0.06, 0.16), r: 0.85, g: 0.94, b: 1,
        grav: -0.9, drag: 2.2, twinkle: 0,
      });
    }
  }

  // おいわいの虹ふぶき
  confetti(n = 60) {
    for (let i = 0; i < n; i++) {
      const hex = hsl(rand(0, 360), 0.75, 0.68);
      const [r, g, b] = this._color3(hex);
      this._spawn({
        x: rand(-6, 6), y: rand(7, 10), z: rand(1.5, 4),
        vx: rand(-0.8, 0.8), vy: rand(-1.5, -0.4), vz: rand(-0.2, 0.4),
        life: 0, maxLife: rand(1.8, 3),
        size: rand(0.18, 0.4), r, g, b,
        grav: -2.2, drag: 1.1, twinkle: 5,
      });
    }
  }

  tick(dt, now) {
    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { parts.splice(i, 1); continue; }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    // バッファへ
    let n = 0;
    for (const p of parts) {
      const t = p.life / p.maxLife;
      const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const tw = p.twinkle ? 0.6 + 0.4 * Math.sin(now * p.twinkle + p.x * 13) : 1;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r * fade * tw;
      this.col[n * 3 + 1] = p.g * fade * tw;
      this.col[n * 3 + 2] = p.b * fade * tw;
      this.sizeAttr[n] = p.size;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.psize.needsUpdate = true;
  }
}
