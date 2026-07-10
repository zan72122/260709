// みずのふしぎキッチン — こおりの表現。
// 冷やすと 1) 浮かぶ氷キューブが増える → 2) 水面に霜のまくが広がる →
// 3) 全体がひとつの氷ブロックになる。タップで氷をパキッと割れる。

import * as THREE from '../vendor/three.module.min.js';
import { POT_R, POT_FLOOR_Y, WATER_DEPTH } from './pot.js';

const MAX_CUBES = 9;

function frostTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // 樹枝状のこおりのすじ (シード付き疑似乱数で毎回同じ)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineCap = 'round';
  const branch = (x, y, a, len, w, depth) => {
    if (depth <= 0 || len < 4) return;
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    g.lineWidth = w;
    g.globalAlpha = 0.25 + 0.5 * (depth / 5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
    branch(nx, ny, a + 0.5 + rnd() * 0.3, len * 0.62, w * 0.7, depth - 1);
    branch(nx, ny, a - 0.5 - rnd() * 0.3, len * 0.62, w * 0.7, depth - 1);
    branch(nx, ny, a + (rnd() - 0.5) * 0.2, len * 0.75, w * 0.8, depth - 1);
  };
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + rnd() * 0.4;
    branch(128, 128, a, 34 + rnd() * 20, 3.2, 5);
  }
  // 中心のかがやき
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 120);
  gr.addColorStop(0, 'rgba(235,250,255,0.5)');
  gr.addColorStop(1, 'rgba(235,250,255,0)');
  g.globalAlpha = 1;
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ice {
  constructor(scene, pot) {
    this.pot = pot;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.onEvent = null; // (name, worldPos) => {}

    this.cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe8fb,
      roughness: 0.1,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.6,
      emissive: 0x224455,
      emissiveIntensity: 0.12,
    });

    // --- 浮かぶ氷キューブのプール
    this.cubes = [];
    const geo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    // かどをほんの少し丸める (頂点を球方向へ混ぜる)
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const s = v.clone().normalize().multiplyScalar(0.62);
      v.lerp(s, 0.35);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    for (let i = 0; i < MAX_CUBES; i++) {
      const m = new THREE.Mesh(geo, this.cubeMat);
      m.castShadow = true;
      m.visible = false;
      m.userData = {
        active: false, scale: 0, targetScale: 0,
        x: 0, z: 0, vx: 0, vz: 0,
        phase: Math.random() * 7, spin: (Math.random() - 0.5) * 0.6,
        cracks: 0, jiggle: 0,
      };
      this.cubes.push(m);
      this.group.add(m);
    }

    // --- 霜のまく (水面に広がる)
    this.sheet = new THREE.Mesh(
      new THREE.CircleGeometry(POT_R * 0.99, 48),
      new THREE.MeshStandardMaterial({
        map: frostTexture(),
        transparent: true, opacity: 0,
        roughness: 0.55, metalness: 0,
        color: 0xeafaff,
        depthWrite: false,
      }));
    this.sheet.rotation.x = -Math.PI / 2;
    this.group.add(this.sheet);

    // --- こおりのブロック (全部こおったとき)
    this.blockMat = new THREE.MeshPhysicalMaterial({
      color: 0xaddcf2,
      roughness: 0.32,
      transparent: true,
      opacity: 0.93,
      clearcoat: 0.8,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.2,
      emissive: 0x335566,
      emissiveIntensity: 0.1,
    });
    this.block = new THREE.Mesh(
      new THREE.CylinderGeometry(POT_R * 0.985, POT_R * 0.92, 1, 40), this.blockMat);
    this.block.visible = false;
    this.group.add(this.block);
    this.blockTop = new THREE.Mesh(
      new THREE.CircleGeometry(POT_R * 0.985, 48),
      new THREE.MeshStandardMaterial({
        map: frostTexture(), transparent: true, opacity: 0.9,
        color: 0xffffff, roughness: 0.5, depthWrite: false,
      }));
    this.blockTop.rotation.x = -Math.PI / 2;
    this.blockTop.visible = false;
    this.group.add(this.blockTop);
    this.blockJiggle = 0;
  }

  /** タップ対象のメッシュ */
  tappables() {
    const list = this.cubes.filter(c => c.visible);
    if (this.block.visible) list.push(this.block);
    return list;
  }

  /** 氷をタップ。割れたら true */
  tap(mesh) {
    if (mesh === this.block) {
      this.blockJiggle = 1;
      this.onEvent && this.onEvent('block-knock', new THREE.Vector3(0, this.block.position.y + 0.4, 0));
      return true;
    }
    const d = mesh.userData;
    if (!d.active) return false;
    d.cracks++;
    d.jiggle = 1;
    const pos = mesh.position.clone();
    if (d.cracks >= 2 && d.scale > 0.16) {
      // ふたつに割れる!
      d.cracks = 0;
      d.targetScale = d.scale * 0.68;
      const free = this.cubes.find(c => !c.userData.active);
      if (free) {
        const fd = free.userData;
        fd.active = true; fd.cracks = 0; fd.jiggle = 1;
        fd.scale = 0.01; fd.targetScale = d.targetScale;
        fd.x = d.x + (Math.random() - 0.5) * 0.2;
        fd.z = d.z + (Math.random() - 0.5) * 0.2;
        fd.vx = (Math.random() - 0.5) * 1.6;
        fd.vz = (Math.random() - 0.5) * 1.6;
        free.visible = true;
      }
      d.vx += (Math.random() - 0.5) * 1.6;
      d.vz += (Math.random() - 0.5) * 1.6;
      this.onEvent && this.onEvent('cube-split', pos);
    } else {
      this.onEvent && this.onEvent('cube-knock', pos);
    }
    return true;
  }

  update(dt, t, thermo) {
    const ice = thermo.ice;
    const level = Math.max(0.03, thermo.inPot);
    const surfY = this.pot.surfaceY;

    // ---- キューブの数 (凍りはじめ〜半分で最大、全凍結で消えてブロックへ)
    let want = 0;
    if (ice > 0.02 && ice < 0.8) {
      const f = ice < 0.5 ? ice / 0.5 : (0.8 - ice) / 0.3;
      want = Math.round(Math.min(1, f) * 7);
    }
    const activeCubes = this.cubes.filter(c => c.userData.active);
    if (activeCubes.length < want) {
      const free = this.cubes.find(c => !c.userData.active);
      if (free && Math.random() < dt * 3) {
        const d = free.userData;
        const a = Math.random() * Math.PI * 2, r = Math.random() * POT_R * 0.6;
        d.active = true; d.cracks = 0;
        d.x = Math.cos(a) * r; d.z = Math.sin(a) * r;
        d.vx = d.vz = 0;
        d.scale = 0.01; d.targetScale = 0.24 + Math.random() * 0.12;
        free.visible = true;
        this.onEvent && this.onEvent('cube-born', new THREE.Vector3(d.x, surfY, d.z));
      }
    } else if (activeCubes.length > want) {
      // いちばん小さいのから溶けて消える
      const victim = activeCubes.sort((a, b) => a.userData.scale - b.userData.scale)[0];
      victim.userData.targetScale = 0;
    }

    // ---- キューブの動き
    for (const c of this.cubes) {
      const d = c.userData;
      if (!d.active) continue;
      d.scale += (d.targetScale - d.scale) * Math.min(1, dt * 4);
      if (d.targetScale <= 0.011 && d.scale < 0.03) {
        d.active = false; c.visible = false; continue;
      }
      // ぷかぷか + ゆっくり漂う
      d.vx += (Math.random() - 0.5) * dt * 0.4;
      d.vz += (Math.random() - 0.5) * dt * 0.4;
      // おたがい反発
      for (const o of this.cubes) {
        if (o === c || !o.userData.active) continue;
        const dx = d.x - o.userData.x, dz = d.z - o.userData.z;
        const dist = Math.hypot(dx, dz);
        const min = (d.scale + o.userData.scale) * 0.62;
        if (dist < min && dist > 0.001) {
          const push = (min - dist) / min * dt * 2.4;
          d.vx += dx / dist * push; d.vz += dz / dist * push;
        }
      }
      // なべの縁で跳ね返る
      const rr = Math.hypot(d.x, d.z);
      const maxR = POT_R * 0.92 - d.scale * 0.55;
      if (rr > maxR) {
        d.vx -= d.x / rr * dt * 4; d.vz -= d.z / rr * dt * 4;
      }
      d.vx *= Math.pow(0.35, dt); d.vz *= Math.pow(0.35, dt);
      d.x += d.vx * dt; d.z += d.vz * dt;
      d.jiggle = Math.max(0, d.jiggle - dt * 3);
      const bob = Math.sin(t * 1.7 + d.phase) * 0.02;
      const jig = Math.sin(t * 40) * d.jiggle * 0.06;
      c.position.set(d.x, surfY + bob + d.scale * 0.18 + jig * 0.4, d.z);
      c.rotation.set(
        Math.sin(t * 0.8 + d.phase) * 0.14 + jig,
        d.phase + t * d.spin * 0.3,
        Math.cos(t * 0.9 + d.phase) * 0.14 - jig);
      const s = d.scale * (1 + d.jiggle * 0.12);
      c.scale.set(s, s * 0.82, s);
    }

    // ---- 霜のまく (凍結 30%〜 で広がる)
    const sheetF = Math.max(0, Math.min(1, (ice - 0.25) / 0.45));
    this.sheet.visible = sheetF > 0.01 && ice < 0.92;
    if (this.sheet.visible) {
      this.sheet.position.y = surfY + 0.012;
      this.sheet.scale.setScalar(0.2 + sheetF * 0.8);
      this.sheet.material.opacity = sheetF * 0.85;
    }

    // ---- ブロック (凍結 80%〜)
    const blockF = Math.max(0, Math.min(1, (ice - 0.75) / 0.25));
    this.block.visible = this.blockTop.visible = blockF > 0.02;
    if (this.block.visible) {
      this.blockJiggle = Math.max(0, this.blockJiggle - dt * 2.5);
      const jig = Math.sin(t * 35) * this.blockJiggle * 0.02;
      const h = Math.max(0.05, WATER_DEPTH * level * (0.35 + 0.65 * blockF));
      this.block.scale.y = h;
      this.block.position.y = POT_FLOOR_Y + h / 2 + jig;
      this.block.scale.x = this.block.scale.z = 0.9 + 0.1 * blockF + jig * 2;
      this.blockMat.opacity = 0.5 + blockF * 0.45;
      this.blockTop.position.y = POT_FLOOR_Y + h + 0.012 + jig;
      this.blockTop.material.opacity = blockF * 0.95;
    }
  }
}
