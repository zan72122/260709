// みずのふしぎキッチン — きらきら・しぶき・波紋・こごえる霧などの演出。

import * as THREE from '../vendor/three.module.min.js';
import { POT_R } from './pot.js';

function spriteTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  return new THREE.CanvasTexture(c);
}

const starTex = () => spriteTex(g => {
  g.translate(32, 32);
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const r = i % 2 ? 6 : 26;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
});

const dotTex = () => spriteTex(g => {
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
});

const flakeTex = () => spriteTex(g => {
  g.translate(32, 32);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -24); g.stroke();
    g.beginPath(); g.moveTo(0, -13); g.lineTo(6, -19); g.stroke();
    g.beginPath(); g.moveTo(0, -13); g.lineTo(-6, -19); g.stroke();
  }
});

export class Effects {
  constructor(scene, pot) {
    this.pot = pot;
    this.group = new THREE.Group();
    scene.add(this.group);

    const mk = (tex, n, blending = THREE.AdditiveBlending) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, depthWrite: false, blending, opacity: 0,
        }));
        sp.visible = false;
        sp.userData = { alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 0.2, grav: 0, col: new THREE.Color(1, 1, 1) };
        arr.push(sp);
        this.group.add(sp);
      }
      return arr;
    };

    this.stars = mk(starTex(), 40);
    this.dots = mk(dotTex(), 60);
    this.flakes = mk(flakeTex(), 30, THREE.NormalBlending);

    // --- しぶき (水玉、InstancedMesh)
    this.N_DROP = 40;
    this.dropMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshPhysicalMaterial({
        color: 0x9adef2, roughness: 0.05, transparent: true, opacity: 0.9,
        clearcoat: 1, envMapIntensity: 1.4,
      }),
      this.N_DROP);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops = [];
    for (let i = 0; i < this.N_DROP; i++) this.drops.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.03 });
    this.group.add(this.dropMesh);
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();

    // --- 波紋リング
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1, 36);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.userData = { alive: false, life: 0 };
      this.rings.push(m);
      this.group.add(m);
    }

    // --- こごえる霧 (なべのまわりの冷気)
    this.mist = [];
    const mistTex = dotTex();
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mistTex, transparent: true, depthWrite: false, opacity: 0,
        color: 0xcfeeff,
      }));
      sp.userData = { phase: Math.random() * 7, r: POT_R + 0.35 + Math.random() * 0.4, speed: 0.2 + Math.random() * 0.3 };
      this.mist.push(sp);
      this.group.add(sp);
    }
    this.coldPower = 0;

    // --- ただよう ほこり (窓の光にきらめく)
    this.motes = [];
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mistTex, transparent: true, depthWrite: false, opacity: 0.10 + Math.random() * 0.10,
        blending: THREE.AdditiveBlending,
      }));
      sp.userData = {
        x: 0.6 + Math.random() * 2.4, y: 0.6 + Math.random() * 2.8, z: -1.9 + Math.random() * 1.4,
        phase: Math.random() * 7,
      };
      sp.scale.setScalar(0.03 + Math.random() * 0.04);
      this.motes.push(sp);
      this.group.add(sp);
    }
  }

  _fire(pool, pos, opts) {
    const sp = pool.find(p => !p.userData.alive);
    if (!sp) return;
    const d = sp.userData;
    d.alive = true; d.life = 0;
    d.maxLife = opts.life || 0.8;
    sp.position.copy(pos);
    const sp2 = opts.spread || 0.6;
    d.vx = (Math.random() - 0.5) * sp2 * 2 + (opts.vx || 0);
    d.vy = (opts.vy != null ? opts.vy : Math.random() * sp2 * 1.6);
    d.vz = (Math.random() - 0.5) * sp2 * 2 + (opts.vz || 0);
    d.size = opts.size || 0.12;
    d.grav = opts.grav != null ? opts.grav : 1.2;
    sp.material.color.set(opts.color || 0xffffff);
    sp.visible = true;
  }

  /** きらきらバースト (氷が割れた・状態が変わったなど) */
  sparkle(pos, n = 10, color = 0xbfefff, size = 0.14) {
    for (let i = 0; i < n; i++) {
      this._fire(this.stars, pos, { color, size: size * (0.6 + Math.random() * 0.8), spread: 1.1, life: 0.7 + Math.random() * 0.4 });
    }
    for (let i = 0; i < n; i++) {
      this._fire(this.dots, pos, { color: 0xffffff, size: size * 0.7, spread: 0.9, life: 0.5 + Math.random() * 0.4 });
    }
  }

  /** ゆきのけっしょう (凍るとき) */
  snow(pos, n = 6) {
    for (let i = 0; i < n; i++) {
      this._fire(this.flakes, pos, {
        color: 0xe8f8ff, size: 0.1 + Math.random() * 0.1,
        spread: 0.7, vy: 0.4 + Math.random() * 0.6, grav: 0.5,
        life: 1.1 + Math.random() * 0.6,
      });
    }
  }

  /** 水しぶき */
  splash(pos, n = 5, power = 1) {
    for (let i = 0; i < n; i++) {
      const d = this.drops.find(p => !p.alive);
      if (!d) return;
      d.alive = true;
      d.x = pos.x; d.y = pos.y; d.z = pos.z;
      const a = Math.random() * Math.PI * 2;
      const v = (0.5 + Math.random() * 0.9) * power;
      d.vx = Math.cos(a) * v * 0.5;
      d.vz = Math.sin(a) * v * 0.5;
      d.vy = (1.0 + Math.random() * 1.2) * power;
      d.r = 0.02 + Math.random() * 0.03;
    }
  }

  /** 波紋リング */
  ripple(x, z, y, big = false) {
    const m = this.rings.find(r => !r.userData.alive);
    if (!m) return;
    m.userData.alive = true;
    m.userData.life = 0;
    m.userData.big = big;
    m.position.set(x, y + 0.015, z);
    m.visible = true;
  }

  setCold(power) { this.coldPower = power; }

  update(dt, t) {
    const step = (pool) => {
      for (const sp of pool) {
        const d = sp.userData;
        if (!d.alive) continue;
        d.life += dt;
        if (d.life >= d.maxLife) { d.alive = false; sp.visible = false; continue; }
        d.vy -= d.grav * dt;
        sp.position.x += d.vx * dt;
        sp.position.y += d.vy * dt;
        sp.position.z += d.vz * dt;
        const f = d.life / d.maxLife;
        sp.scale.setScalar(d.size * (1 - f * 0.4));
        sp.material.opacity = Math.sin(Math.min(1, f * 1.2) * Math.PI);
        sp.material.rotation += dt * 2;
      }
    };
    step(this.stars); step(this.dots); step(this.flakes);

    // しぶき
    let di = 0;
    for (const d of this.drops) {
      if (d.alive) {
        d.vy -= 6.5 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        const inPot = Math.hypot(d.x, d.z) < POT_R;
        const floorY = inPot ? this.pot.surfaceY : 0.02;
        if (d.y <= floorY && d.vy < 0) {
          d.alive = false;
          if (inPot) this.pot.disturb(d.x, d.z, 0.12, 0.08);
        }
      }
      this._m4.compose(
        d.alive ? new THREE.Vector3(d.x, d.y, d.z) : new THREE.Vector3(0, -50, 0),
        this._q, this._s.setScalar(d.alive ? d.r : 0.001));
      this.dropMesh.setMatrixAt(di++, this._m4);
    }
    this.dropMesh.instanceMatrix.needsUpdate = true;

    // 波紋
    for (const m of this.rings) {
      const d = m.userData;
      if (!d.alive) continue;
      d.life += dt;
      const dur = d.big ? 1.0 : 0.6;
      if (d.life >= dur) { d.alive = false; m.visible = false; continue; }
      const f = d.life / dur;
      m.scale.setScalar(0.06 + f * (d.big ? 0.9 : 0.45));
      m.material.opacity = (1 - f) * 0.5;
    }

    // 冷気の霧
    for (const sp of this.mist) {
      const d = sp.userData;
      const a = t * d.speed + d.phase;
      sp.position.set(
        Math.cos(a) * d.r,
        0.35 + Math.sin(t * 0.9 + d.phase) * 0.22,
        Math.sin(a) * d.r);
      sp.scale.setScalar(0.4 + Math.sin(t + d.phase) * 0.1);
      sp.material.opacity = this.coldPower * (0.16 + Math.sin(t * 1.3 + d.phase) * 0.07);
    }
    // 冷気が強いときは雪も舞う
    if (this.coldPower > 0.5 && Math.random() < dt * 3) {
      const a = Math.random() * Math.PI * 2;
      this.snow(new THREE.Vector3(Math.cos(a) * (POT_R + 0.5), 1.6 + Math.random(), Math.sin(a) * (POT_R + 0.5)), 1);
    }

    // ほこり
    for (const sp of this.motes) {
      const d = sp.userData;
      sp.position.set(
        d.x + Math.sin(t * 0.23 + d.phase) * 0.3,
        d.y + Math.sin(t * 0.31 + d.phase * 2) * 0.25,
        d.z + Math.cos(t * 0.19 + d.phase) * 0.2);
    }
  }
}
