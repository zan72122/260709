// キラキラ・紙ふぶきエフェクト
import * as THREE from 'three';

const COLORS = [0xffd43b, 0xff8ac2, 0x59b9ff, 0x69c95e, 0xb197fc, 0xffa94d];

export class FxSystem {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  // 中心から放射状にはじけるキラキラ(colors指定でクラム等の色替え可)
  burst(center, count = 26, speed = 4.2, life = 0.9, colors = COLORS) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = center.x;
      pos[i * 3 + 1] = center.y;
      pos[i * 3 + 2] = center.z;
      c.setHex(colors[(Math.random() * colors.length) | 0]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      vel.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * s,
        Math.sin(phi) * Math.sin(theta) * s,
        Math.cos(phi) * s * 0.5
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mtl = new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mtl);
    this.scene.add(points);
    this.bursts.push({ points, vel, age: 0, life, gravity: -3.5 });
  }

  // 上から降ってくる紙ふぶき
  confetti(count = 60, spreadX = 8) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spreadX;
      pos[i * 3 + 1] = 4 + Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
      c.setHex(COLORS[(Math.random() * COLORS.length) | 0]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 1.2, -(1.2 + Math.random() * 1.4), 0));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mtl = new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
    });
    const points = new THREE.Points(geo, mtl);
    this.scene.add(points);
    this.bursts.push({ points, vel, age: 0, life: 4.2, gravity: 0, sway: true });
  }

  update(dt, t) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const posAttr = b.points.geometry.getAttribute('position');
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j];
        v.y += b.gravity * dt;
        posAttr.array[j * 3] += v.x * dt + (b.sway ? Math.sin(t * 3 + j) * 0.9 * dt : 0);
        posAttr.array[j * 3 + 1] += v.y * dt;
        posAttr.array[j * 3 + 2] += v.z * dt;
      }
      posAttr.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
