// Soap-bubble rendering: one InstancedMesh drives thousands of little foam
// bubbles (read from the sim grid), a few drifting ambient bubbles, and the
// big corner "collector" bubbles that swell and pop.

import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */`
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vData; // x: phase, y: shimmer seed, z: alpha
uniform float time;
void main() {
  vData = instanceColor;
  vec3 p = position;
  // gentle pukupuku breathing per bubble
  float b = 1.0 + 0.06 * sin(time * 2.2 + vData.x * 17.0);
  p *= b;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vData;
uniform float time;
vec3 rainbow(float t) {
  return 0.62 + 0.38 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67)));
}
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
  vec3 film = rainbow(vData.y + fres * 0.9 + time * 0.06);
  vec3 col = mix(vec3(0.9, 0.95, 1.0), film, 0.35 + 0.65 * fres);
  // highlight dot
  float hl = pow(max(dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 0.45))), 0.0), 42.0);
  col += vec3(hl * 0.9);
  float a = (0.16 + 0.62 * fres + hl * 0.5) * vData.z;
  gl_FragColor = vec4(col, a);
}`;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export class BubbleSystem {
  constructor(scene, sim, maxInstances = 2600) {
    this.sim = sim;
    this.max = maxInstances;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { time: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, maxInstances);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxInstances * 3), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    scene.add(this.mesh);

    this.floaters = [];      // ambient rising bubbles {x,y,z,vy,drift,size,age,ttl,seed}
    this.bigBubbles = [];    // {collector, size, popAt, wobble}
    this.onBigPop = null;
    this._frame = 0;
    this._floatTimer = 0;
  }

  addBigBubble(collector, popAt = 3.2) {
    const b = { col: collector, size: 0, popAt, seed: Math.random() * 10, popping: 0 };
    this.bigBubbles.push(b);
    return b;
  }

  update(dt, time) {
    this.mat.uniforms.time.value = time;
    this._frame++;

    // ambient floaters rise out of foamy areas
    this._floatTimer -= dt;
    if (this._floatTimer <= 0 && this.sim.cfg.foam) {
      this._floatTimer = 0.35;
      const N = this.sim.N;
      for (let k = 0; k < 3; k++) {
        const i = (Math.random() * N * N) | 0;
        if (this.sim.foam[i] > 0.35 && this.floaters.length < 26) {
          const [wx, wz] = this.sim.worldOf(i % N, (i / N) | 0);
          this.floaters.push({
            x: wx, y: 0.15, z: wz, vy: 0.25 + Math.random() * 0.3,
            drift: Math.random() * 6.28, size: 0.05 + Math.random() * 0.09,
            age: 0, ttl: 3 + Math.random() * 3, seed: Math.random(),
          });
        }
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      f.y += f.vy * dt;
      f.x += Math.sin(time * 1.3 + f.drift) * 0.12 * dt;
      f.z += Math.cos(time * 1.1 + f.drift) * 0.12 * dt;
      if (f.age > f.ttl) this.floaters.splice(i, 1);
    }

    // big bubbles swell with collected foam
    for (const b of this.bigBubbles) {
      const grown = 0.2 + 0.17 * Math.sqrt(b.col.amount); // slow, satisfying swell
      const target = Math.min(b.popAt * 0.42, grown);
      b.size += (target - b.size) * Math.min(1, dt * 2.5);
      if (b.popping > 0) {
        b.popping -= dt;
        if (b.popping <= 0) { b.col.amount = 0; b.size = 0; }
      } else if (grown >= b.popAt * 0.42 && b.size > b.popAt * 0.40) {
        b.popping = 0.22; // brief over-swell before the burst
        b.col.popped++;
        if (this.onBigPop) this.onBigPop(b);
      }
    }

    if (this._frame % 2 === 0) this._rebuildInstances(time);
  }

  _rebuildInstances(time) {
    const sim = this.sim, N = sim.N;
    let count = 0;
    const cap = this.max - 40; // reserve room for floaters/big bubbles
    const colAttr = this.mesh.instanceColor;

    if (sim.cfg.foam) {
      for (let i = 0; i < N * N && count < cap; i++) {
        const f = sim.foam[i];
        if (f < 0.10) continue;
        const cx = i % N, cz = (i / N) | 0;
        const [wx, wz] = sim.worldOf(cx, cz);
        const nb = f > 1.2 ? 3 : f > 0.45 ? 2 : 1;
        for (let k = 0; k < nb && count < cap; k++) {
          const h1 = hash(i * 3 + k), h2 = hash(i * 7 + k * 13 + 5), h3 = hash(i * 11 + k * 29 + 9);
          const size = (0.07 + 0.12 * h1) * Math.min(1.35, 0.5 + f);
          _p.set(
            wx + (h2 - 0.5) * sim.cell * 1.7,
            size * (0.5 + 0.7 * h3) + (k * 0.5) * size,
            wz + (h3 - 0.5) * sim.cell * 1.7
          );
          _s.setScalar(size);
          _m.compose(_p, _q, _s);
          this.mesh.setMatrixAt(count, _m);
          colAttr.setXYZ(count, h1 * 10, h2, 1);
          count++;
        }
      }
    }

    for (const f of this.floaters) {
      if (count >= this.max - 8) break;
      const fade = Math.min(1, (f.ttl - f.age)) * Math.min(1, f.age * 3);
      _p.set(f.x, f.y, f.z);
      _s.setScalar(f.size);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(count, _m);
      colAttr.setXYZ(count, f.seed * 10, f.seed, fade);
      count++;
    }

    for (const b of this.bigBubbles) {
      if (b.size < 0.03 || count >= this.max) continue;
      const wob = 1 + 0.05 * Math.sin(time * 3 + b.seed) + (b.popping > 0 ? (0.22 - b.popping) * 1.6 : 0);
      _p.set(b.col.x, b.size * 0.85, b.col.z);
      _s.set(b.size * wob, b.size * (2 - wob) * 0.96, b.size * wob);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(count, _m);
      colAttr.setXYZ(count, b.seed, b.seed * 0.7, b.popping > 0 ? 0.65 : 1);
      count++;
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
