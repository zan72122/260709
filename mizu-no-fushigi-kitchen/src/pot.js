// みずのふしぎキッチン — ガラスのおなべと水の描画。
// 水面は WaterSim の高さ場を毎フレーム頂点へ流し込み、法線を再計算して
// 環境マップの反射がゆらゆら踊るようにする。

import * as THREE from '../vendor/three.module.min.js';
import { WaterSim } from './watersim.js';

export const POT_R = 1.0;        // 水面の半径
export const POT_FLOOR_Y = 0.34; // なべの内底
export const WATER_DEPTH = 0.72; // まんたんの深さ
export const POT_RIM_Y = 1.42;   // なべのふち

const COL_COLD = new THREE.Color(0xa8ddf2);
const COL_MILD = new THREE.Color(0x3eb5d6);
const COL_HOT = new THREE.Color(0x38bfae);

export class Pot {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sim = new WaterSim(52, POT_R);
    this.level = 1;              // 0..1 (なべの中身の量)
    this.surfaceY = POT_FLOOR_Y + WATER_DEPTH;
    this._buildGlass();
    this._buildWater();
  }

  // ---------------------------------------------------------- ガラス鍋
  _buildGlass() {
    // 注意: transmission は「不透明物しか透かさない」ため、中の水・氷・泡
    // (すべて transparent) が見えなくなる。ここではアルファ合成のガラスに
    // 環境マップ反射とクリアコートを重ねて、軽くて iOS でも速い表現にする。
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeaf7ff,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // 側面 (少し外へ膨らむプロファイルを LatheGeometry で)
    const pts = [];
    const R0 = POT_R + 0.035, H = POT_RIM_Y - 0.24;
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const bulge = Math.sin(f * Math.PI) * 0.055;
      pts.push(new THREE.Vector2(R0 + bulge + f * 0.02, 0.24 + f * H));
    }
    // ふちを外へ少しめくる
    pts.push(new THREE.Vector2(R0 + 0.09, POT_RIM_Y + 0.03));
    const side = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), this.glassMat);
    side.castShadow = true;
    side.renderOrder = 10; // 中身 (水・氷・泡) を描いたあとに重ねる
    this.group.add(side);
    // 底
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(R0 + 0.005, R0 - 0.06, 0.11, 48), this.glassMat);
    bottom.position.y = 0.285;
    bottom.renderOrder = 10;
    this.group.add(bottom);
    // とって
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xe8b04b, roughness: 0.3, metalness: 0.5 });
    for (const sgn of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 10, 20, Math.PI), handleMat);
      h.position.set(sgn * (R0 + 0.1), POT_RIM_Y - 0.28, 0);
      h.rotation.z = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;
      h.castShadow = true;
      this.group.add(h);
    }
  }

  // ---------------------------------------------------------- 水
  _buildWater() {
    // 水面: リング×セクターの極座標メッシュ (正方形グリッドを円へ潰すと
    // 折り返し三角形でギザギザが出るため、最初から円形に張る)
    const RINGS = 30, SECTORS = 96;
    const verts = [];
    verts.push(0, 0, 0); // 中心
    for (let r = 1; r <= RINGS; r++) {
      const rad = (r / RINGS) * POT_R * 0.995;
      for (let s = 0; s < SECTORS; s++) {
        const a = (s / SECTORS) * Math.PI * 2;
        verts.push(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      }
    }
    const idx = [];
    const vi = (r, s) => 1 + (r - 1) * SECTORS + (s % SECTORS);
    for (let s = 0; s < SECTORS; s++) idx.push(0, vi(1, s + 1), vi(1, s));
    for (let r = 1; r < RINGS; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const a = vi(r, s), b = vi(r, s + 1), c = vi(r + 1, s + 1), d = vi(r + 1, s);
        idx.push(a, b, c, a, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.surfMat = new THREE.MeshPhysicalMaterial({
      color: COL_MILD.clone(),
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.85,
      emissive: 0x0a2833,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
    this.surface = new THREE.Mesh(geo, this.surfMat);
    this.surface.position.y = this.surfaceY;
    this.surface.renderOrder = 2;
    this.group.add(this.surface);

    // 水のからだ (側面+底、ガラス越しに見える部分)
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: COL_MILD.clone(),
      roughness: 0.18,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.body = new THREE.Mesh(
      new THREE.CylinderGeometry(POT_R * 0.995, POT_R * 0.93, 1, 40, 1, false), this.bodyMat);
    this.body.renderOrder = 1;
    this.group.add(this.body);
  }

  /** なべの中身の量 (0..1)。水+こおり の合計を渡す */
  setLevel(frac) {
    this.level = Math.max(0, Math.min(1, frac));
  }

  /** ワールド座標 (x,z はなべ中心基準) で波を起こす */
  disturb(x, z, amount, r) { this.sim.disturb(x, z, amount, r); }

  update(dt, t, thermo) {
    const th = thermo;
    // --- 水位 (すこし遅れて追従すると気持ちいい)
    const targetY = POT_FLOOR_Y + WATER_DEPTH * Math.max(0.03, this.level);
    this.surfaceY += (targetY - this.surfaceY) * Math.min(1, dt * 3);
    const visible = this.level > 0.015 && th.ice < 0.95;
    this.surface.visible = visible;
    this.body.visible = this.level > 0.015;

    // --- 沸騰のゆらぎ / おだやかな揺れ (大きめ・やわらかめの山で
    //     「ぐつぐつ」のうねりを作る。小さく多いと引っかき傷に見える)
    if (th.boiling) {
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * POT_R * 0.75;
        this.sim.disturb(Math.cos(a) * rr, Math.sin(a) * rr, 0.09 + Math.random() * 0.07, 0.24);
      }
    } else if (th.temp > 75 && Math.random() < (th.temp - 75) / 25 * dt * 8) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * POT_R * 0.7;
      this.sim.disturb(Math.cos(a) * rr, Math.sin(a) * rr, 0.035, 0.18);
    }
    // 凍りはじめたら波はすっと静まる (霜のまくと重ならないように)
    if (th.ice > 0.08) this.sim.calm(Math.pow(0.25, dt));
    this.sim.step(dt);

    // --- 高さ場 → 頂点 (位置からバイリニア補間。円縁へ寄せて重なった
    //     頂点も同じ高さになり、ふちがギザギザにならない)
    if (visible) {
      const n = this.sim.n;
      const u = this.sim.u;
      const pos = this.surface.geometry.attributes.position;
      const amp = 0.12 * (0.4 + 0.6 * Math.min(1, this.level * 2));
      const c = (n - 1) / 2;
      for (let i = 0; i < pos.count; i++) {
        const gx = (pos.getX(i) / POT_R) * c + c;
        const gz = (pos.getZ(i) / POT_R) * c + c;
        const x0 = Math.max(0, Math.min(n - 2, Math.floor(gx)));
        const z0 = Math.max(0, Math.min(n - 2, Math.floor(gz)));
        const fx = Math.min(1, Math.max(0, gx - x0));
        const fz = Math.min(1, Math.max(0, gz - z0));
        const h =
          u[z0 * n + x0] * (1 - fx) * (1 - fz) +
          u[z0 * n + x0 + 1] * fx * (1 - fz) +
          u[(z0 + 1) * n + x0] * (1 - fx) * fz +
          u[(z0 + 1) * n + x0 + 1] * fx * fz;
        // ふちに近いほど波をおさえる (壁ぎわでおだやかに)
        const rr = Math.hypot(pos.getX(i), pos.getZ(i)) / POT_R;
        const edge = rr > 0.85 ? Math.max(0, (1 - rr) / 0.15) : 1;
        pos.setY(i, h * amp * edge);
      }
      pos.needsUpdate = true;
      this.surface.geometry.computeVertexNormals();
      this.surface.position.y = this.surfaceY;
    }

    // --- からだの高さ・色 (上面キャップは波の下限より下げて、
    //     波打つ水面メッシュと z-fight しないようにする)
    const h = Math.max(0.02, this.surfaceY - POT_FLOOR_Y - 0.075);
    this.body.scale.y = h;
    this.body.position.y = POT_FLOOR_Y - 0.02 + h / 2;

    // 温度で色を変える (つめたい水色 → ふつう → あたたかい緑青)
    const tp = th.temp;
    const col = this.surfMat.color;
    if (tp < 15) col.lerpColors(COL_COLD, COL_MILD, Math.max(0, tp / 15));
    else col.lerpColors(COL_MILD, COL_HOT, Math.min(1, (tp - 15) / 85));
    this.bodyMat.color.copy(col);
    // 沸騰で内側からきらめく
    this.surfMat.emissiveIntensity = 0.22 + (th.boiling ? 0.25 + Math.sin(t * 9) * 0.1 : 0);
    // 凍りかけはにごる
    const slush = Math.min(1, th.ice * 3);
    this.surfMat.opacity = 0.86 + slush * 0.1;
    this.surfMat.roughness = 0.05 + slush * 0.5;
  }

  /** 低品質モード: 高コストな質感を切る */
  setQuality(high) {
    this.glassMat.clearcoat = high ? 1 : 0;
    this.surfMat.clearcoat = high ? 1 : 0;
    this.glassMat.needsUpdate = true;
    this.surfMat.needsUpdate = true;
  }
}
