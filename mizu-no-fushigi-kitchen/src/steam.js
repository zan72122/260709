// みずのふしぎキッチン — ゆげの表現。
// あたためると泡が立ちのぼり、水面からゆげが生まれ、なべの上の
// 「くも」へたまっていく。冷やすと、くもから雨が降ってなべへ戻る。

import * as THREE from '../vendor/three.module.min.js';
import { POT_R, POT_FLOOR_Y } from './pot.js';

const CLOUD_Y = 3.35;

function puffTexture(soft = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, `rgba(255,255,255,${0.85 - soft * 0.3})`);
  gr.addColorStop(0.55, `rgba(245,250,255,${0.4 - soft * 0.15})`);
  gr.addColorStop(1, 'rgba(245,250,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// くも用: ふちのはっきりした「もくもく」テクスチャ
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 60, 8, 64, 64, 58);
  gr.addColorStop(0, 'rgba(255,255,255,0.98)');
  gr.addColorStop(0.62, 'rgba(250,253,255,0.9)');
  gr.addColorStop(0.85, 'rgba(238,247,252,0.4)');
  gr.addColorStop(1, 'rgba(238,247,252,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Steam {
  constructor(scene, pot) {
    this.pot = pot;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.onEvent = null;

    // ---------------------------------------------------- 泡 (InstancedMesh)
    this.N_BUB = 46;
    this.bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0xdcf6ff, roughness: 0.05, transparent: true, opacity: 0.55,
        clearcoat: 1, envMapIntensity: 1.4, depthWrite: false,
      }),
      this.N_BUB);
    this.bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bub = [];
    for (let i = 0; i < this.N_BUB; i++) {
      this.bub.push({ alive: false, x: 0, y: 0, z: 0, r: 0.02, vy: 0, wob: Math.random() * 7 });
    }
    this.group.add(this.bubbles);
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();

    // ---------------------------------------------------- ゆげのすぷらいと
    this.N_PUFF = 60;
    const puffTex = puffTexture(0.5);
    this.puffs = [];
    for (let i = 0; i < this.N_PUFF; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTex, transparent: true, depthWrite: false, opacity: 0,
        rotation: Math.random() * 7,
      }));
      sp.visible = false;
      sp.userData = { alive: false, life: 0, maxLife: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.3, spin: (Math.random() - 0.5) * 0.8 };
      this.puffs.push(sp);
      this.group.add(sp);
    }

    // ---------------------------------------------------- くも
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.position.set(0, CLOUD_Y, 0);
    this.group.add(this.cloudGroup);
    const cloudTex = cloudTexture();
    this.cloudPuffs = [];
    // まんなかが大きく、はしへ小さくなる「もくもく」の並び
    const lobes = [
      [0, 0.12, 0, 1.0], [-0.52, 0, 0.1, 0.78], [0.52, 0, -0.1, 0.78],
      [-0.95, -0.1, 0, 0.55], [0.95, -0.1, 0, 0.55],
      [-0.28, 0.3, -0.15, 0.6], [0.3, 0.3, 0.12, 0.62],
      [0, -0.16, 0.2, 0.7],
    ];
    for (const [bx, by, bz, base] of lobes) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, opacity: 0,
      }));
      sp.userData = { bx, by, bz, phase: Math.random() * 7, base };
      this.cloudPuffs.push(sp);
      this.cloudGroup.add(sp);
    }
    this.cloudAmount = 0;

    // ---------------------------------------------------- 雨つぶ
    this.N_RAIN = 34;
    this.rainMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshPhysicalMaterial({
        color: 0x9fdcf0, roughness: 0.05, transparent: true, opacity: 0.85,
        clearcoat: 1, envMapIntensity: 1.3,
      }),
      this.N_RAIN);
    this.rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rain = [];
    for (let i = 0; i < this.N_RAIN; i++) {
      this.rain.push({ alive: false, x: 0, y: 0, z: 0, vy: 0 });
    }
    this.group.add(this.rainMesh);
  }

  /** 指でゆげを払う */
  blow(px, py, pz, vx, vz) {
    for (const sp of this.puffs) {
      const d = sp.userData;
      if (!d.alive) continue;
      const dist = Math.hypot(d.x - px, d.y - py, d.z - pz);
      if (dist < 1.1) {
        const f = (1.1 - dist) * 2.6;
        d.vx += vx * f; d.vz += vz * f; d.vy += 0.4 * f;
      }
    }
  }

  _spawnPuff(x, y, z, big = false) {
    const sp = this.puffs.find(p => !p.userData.alive);
    if (!sp) return;
    const d = sp.userData;
    d.alive = true; d.life = 0;
    d.maxLife = 2.2 + Math.random() * 1.6;
    d.x = x; d.y = y; d.z = z;
    d.vx = (Math.random() - 0.5) * 0.24;
    d.vy = 0.5 + Math.random() * 0.45;
    d.vz = (Math.random() - 0.5) * 0.24;
    d.size = (big ? 0.5 : 0.3) + Math.random() * 0.25;
    sp.visible = true;
  }

  _spawnBubble(intensity) {
    const b = this.bub.find(p => !p.alive);
    if (!b) return;
    b.alive = true;
    const a = Math.random() * Math.PI * 2, r = Math.random() * POT_R * 0.72;
    b.x = Math.cos(a) * r; b.z = Math.sin(a) * r;
    b.y = POT_FLOOR_Y + 0.05;
    b.r = 0.02 + Math.random() * 0.035 * (0.5 + intensity);
    b.vy = 0.3 + Math.random() * 0.35;
  }

  _spawnRain() {
    const r = this.rain.find(p => !p.alive);
    if (!r) return;
    const a = Math.random() * Math.PI * 2, rr = Math.random() * POT_R * 0.8;
    r.alive = true;
    r.x = Math.cos(a) * rr; r.z = Math.sin(a) * rr;
    r.y = CLOUD_Y - 0.4;
    r.vy = -0.4;
  }

  update(dt, t, thermo) {
    const surfY = this.pot.surfaceY;
    const hasWater = thermo.water > 0.02;

    // ---------------------------------------------------- 泡
    const heat = Math.max(0, (thermo.temp - 76) / 24); // 0..1
    if (hasWater && heat > 0 && thermo.ice < 0.3) {
      const rate = thermo.boiling ? 26 : heat * heat * 7;
      if (Math.random() < rate * dt) this._spawnBubble(heat);
    }
    let bi = 0;
    for (const b of this.bub) {
      if (b.alive) {
        b.vy += dt * 0.5;
        b.y += b.vy * dt;
        b.x += Math.sin(t * 6 + b.wob) * dt * 0.12;
        b.r += dt * 0.012;
        if (b.y >= surfY - b.r * 0.5) {
          b.alive = false;
          this.pot.disturb(b.x, b.z, 0.10 + b.r, 0.1);
          if (this.onEvent && Math.random() < 0.5) {
            this.onEvent('bubble-pop', new THREE.Vector3(b.x, surfY, b.z));
          }
          if (thermo.temp > 90) this._spawnPuff(b.x, surfY + 0.1, b.z, thermo.boiling);
        }
      }
      this._m4.compose(
        b.alive ? new THREE.Vector3(b.x, b.y, b.z) : new THREE.Vector3(0, -50, 0),
        this._q, this._s.setScalar(b.alive ? b.r : 0.001));
      this.bubbles.setMatrixAt(bi++, this._m4);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;

    // ---------------------------------------------------- ゆげ
    const steamRate = thermo.boiling ? 20 : (thermo.temp > 84 && hasWater ? (thermo.temp - 84) / 16 * 6 : 0);
    if (steamRate > 0 && Math.random() < steamRate * dt) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * POT_R * 0.7;
      this._spawnPuff(Math.cos(a) * r, surfY + 0.12, Math.sin(a) * r, thermo.boiling);
    }
    const cloudPull = thermo.cloud > 0.01 || thermo.boiling;
    for (const sp of this.puffs) {
      const d = sp.userData;
      if (!d.alive) continue;
      d.life += dt;
      if (d.life >= d.maxLife) { d.alive = false; sp.visible = false; continue; }
      // くもへ吸いよせられる
      if (cloudPull && d.y > 2.0) {
        d.vx += (0 - d.x) * dt * 0.55;
        d.vz += (0 - d.z) * dt * 0.55;
        d.vy += (CLOUD_Y - d.y) * dt * 0.4;
        if (Math.abs(d.y - CLOUD_Y) < 0.45 && Math.hypot(d.x, d.z) < 1.2) {
          d.alive = false; sp.visible = false; continue;
        }
      }
      d.vy += dt * 0.10;
      d.vx *= Math.pow(0.55, dt); d.vz *= Math.pow(0.55, dt);
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const f = d.life / d.maxLife;
      const grow = d.size * (0.6 + f * 2.1);
      sp.position.set(d.x, d.y, d.z);
      sp.scale.setScalar(grow);
      sp.material.rotation += d.spin * dt;
      sp.material.opacity = Math.sin(Math.min(1, f * 1.15) * Math.PI) * 0.62;
    }

    // ---------------------------------------------------- くも
    this.cloudAmount += (thermo.cloud - this.cloudAmount) * Math.min(1, dt * 1.5);
    const ca = this.cloudAmount;
    const grow = 0.45 + Math.min(1, ca) * 0.75; // くも全体の大きさ 0.45..1.2
    for (const sp of this.cloudPuffs) {
      const d = sp.userData;
      const breathe = 1 + Math.sin(t * 0.9 + d.phase) * 0.06;
      sp.position.set(
        d.bx * grow * 1.5 + Math.sin(t * 0.5 + d.phase) * 0.05,
        d.by * grow * 1.5,
        d.bz * grow);
      sp.scale.setScalar(Math.max(0.001, d.base * grow * 1.15 * breathe));
      const grey = thermo.raining ? 0.84 : 1;
      sp.material.color.setRGB(grey, grey, Math.min(1, grey + 0.02));
      sp.material.opacity = Math.min(0.95, ca * 4);
    }
    this.cloudGroup.position.y = CLOUD_Y + Math.sin(t * 0.7) * 0.06;
    this.cloudGroup.visible = ca > 0.01;

    // ---------------------------------------------------- 雨
    if (thermo.raining && Math.random() < 18 * dt * Math.min(1, this.cloudAmount * 4)) {
      this._spawnRain();
    }
    let ri = 0;
    for (const r of this.rain) {
      if (r.alive) {
        r.vy -= dt * 7;
        r.y += r.vy * dt;
        if (r.y <= surfY + 0.02) {
          r.alive = false;
          this.pot.disturb(r.x, r.z, 0.24, 0.1);
          this.onEvent && this.onEvent('rain-drop', new THREE.Vector3(r.x, surfY, r.z));
        }
      }
      this._m4.compose(
        r.alive ? new THREE.Vector3(r.x, r.y, r.z) : new THREE.Vector3(0, -50, 0),
        this._q, this._s.set(0.05, 0.11, 0.05));
      this.rainMesh.setMatrixAt(ri++, this._m4);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }
}
