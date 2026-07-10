// tower.js — 塔の静的構造。物理は平面座標に、見た目は円筒ラップして構築する。
import * as THREE from '../vendor/three.module.min.js';
import { BoxCollider, CylinderZCollider } from './physics.js';
import { getMaterials, lollipopTex } from './materials.js';
import { wrapPos, wrapQuat, placeAt, R0 } from './wrap.js';
import {
  RAILS, PEGS, PEG_RADIUS, PEG_WALLS, TOWER, WHEEL, WHIP_LIFT, HAMMER, LOOP, DOMINO, CANNON, GOAL,
} from './layout.js';

// 角丸ボックス
export function roundedBox(w, h, d, r = 0.06, seg = 2) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = Math.max(-hw, Math.min(hw, v.x));
    const cy = Math.max(-hh, Math.min(hh, v.y));
    const cz = Math.max(-hd, Math.min(hd, v.z));
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    pos.setXYZ(i, cx + (dx / len) * r, cy + (dy / len) * r, cz + (dz / len) * r);
  }
  geo.computeVertexNormals();
  return geo;
}

export function bMesh(mat, w, h, d, r = 0.04) {
  const m = new THREE.Mesh(roundedBox(w, h, d, r), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// 平面座標の壁: 物理コライダー+ラップ描画をまとめて追加
export function addFlatWall(world, group, { x, y, z = 0, w, h, d = 1.0, ang = 0, mat = null, visible = true, name = 'wall', rest = 0.2, fric = 0.01 }) {
  world.add(new BoxCollider({
    center: new THREE.Vector3(x, y, z),
    half: new THREE.Vector3(w / 2, h / 2, d / 2),
    angleZ: ang, friction: fric, restitution: rest, name,
  }));
  if (visible && mat) {
    const m = bMesh(mat, w, h, d, 0.04);
    placeAt(m, x, y, z, ang);
    group.add(m);
  }
}

// レール(チャンネル): 平面の a→b を短い区間に分割し、物理は平面・描画はラップで構築
export function buildRail(def, mats, world, group, { name = 'rail', lipMat = null, extend = 0.34, struts = true } = {}) {
  const [ax, ay] = def.a, [bx, by] = def.b;
  const totalLen = Math.hypot(bx - ax, by - ay) + extend;
  const ang = Math.atan2(by - ay, bx - ax);
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const cx0 = (ax + bx) / 2 - (extend / 2) * 0; // 中心はそのまま、延長は両端に分配
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  const w = def.w, lip = def.lip, floorTh = 0.16;
  const lm = lipMat || mats.icing;

  const segLen = 0.72;
  const nSeg = Math.max(1, Math.ceil(totalLen / segLen));
  for (let i = 0; i < nSeg; i++) {
    const t = (i + 0.5) / nSeg - 0.5; // -0.5..0.5
    const sx = midX + dirX * totalLen * t;
    const sy = midY + dirY * totalLen * t;
    const sl = totalLen / nSeg + 0.03; // わずかに重ねて隙間を消す
    // 物理: 床+両縁
    world.add(new BoxCollider({
      center: new THREE.Vector3(sx, sy, 0),
      half: new THREE.Vector3(sl / 2, floorTh / 2, w / 2),
      angleZ: ang, friction: 0.012, restitution: 0.12, name,
    }));
    const off = { x: -dirY * (lip / 2), y: dirX * (lip / 2) };
    for (const s of [1, -1]) {
      world.add(new BoxCollider({
        center: new THREE.Vector3(sx + off.x, sy + off.y, s * (w / 2 - 0.045)),
        half: new THREE.Vector3(sl / 2, (lip + floorTh) / 2, 0.045),
        angleZ: ang, friction: 0.01, restitution: 0.2, name: name + '-lip',
      }));
    }
    // 描画: ビスケットの床+アイシングの縁
    const seg = new THREE.Group();
    const floor = bMesh(mats.biscuit, sl, floorTh, w, 0.03);
    seg.add(floor);
    for (const s of [1, -1]) {
      const lipM = bMesh(lm, sl, lip + floorTh, 0.09, 0.03);
      lipM.position.set(0, lip / 2, s * (w / 2 - 0.045));
      seg.add(lipM);
    }
    placeAt(seg, sx, sy, 0, ang);
    group.add(seg);
    // 支柱: 内側(塔側)へ
    if (struts && i % 3 === 1) {
      const p0 = wrapPos(sx, sy - 0.15, -w / 2);
      const tier = TOWER.tiers.find((tt) => sy >= tt[1] && sy <= tt[2] + 0.6);
      const rIn = tier ? tier[0] : 2.2;
      const p1 = p0.clone().setLength ? null : null;
      // 塔面へ向かう水平梁
      const dir = new THREE.Vector3(p0.x, 0, p0.z).normalize();
      const inner = new THREE.Vector3(dir.x * rIn, sy - 0.15, dir.z * rIn);
      const len = p0.distanceTo(inner);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 8), mats.caneStripe);
      strut.position.copy(p0).add(inner).multiplyScalar(0.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inner.clone().sub(p0).normalize());
      strut.castShadow = true;
      group.add(strut);
      void p1;
    }
  }
}

export function buildTower(world, mats) {
  const group = new THREE.Group();

  // ---- テーブルクロス+大皿 ----
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.3, 48), mats.gingham);
  cloth.position.y = TOWER.baseY - 0.15;
  cloth.receiveShadow = true;
  group.add(cloth);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.5, 48), mats.icing);
  plate.position.y = -0.25;
  plate.receiveShadow = true;
  plate.castShadow = true;
  group.add(plate);
  const plateRim = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.18, 12, 48), mats.strawberry);
  plateRim.rotation.x = Math.PI / 2;
  plateRim.position.y = 0.0;
  group.add(plateRim);

  // ---- ケーキ段(スポンジ+アイシングの垂れ) ----
  const tierMats = [mats.sponge, mats.pinkStripe, mats.sponge, mats.mintStripe, mats.sponge];
  TOWER.tiers.forEach(([r, y0, y1], i) => {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 40), tierMats[i % tierMats.length]);
    tier.position.y = (y0 + y1) / 2;
    tier.castShadow = true;
    tier.receiveShadow = true;
    group.add(tier);
    // 上面
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.14, 40), mats.icing);
    top.position.y = y1 + 0.07;
    top.castShadow = true;
    group.add(top);
    // アイシングの垂れ(ぷっくりした球を一周)
    const drips = 18 + i * 2;
    for (let k = 0; k < drips; k++) {
      const a = (k / drips) * Math.PI * 2;
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (k % 3) * 0.05, 10, 8), mats.icing);
      drip.scale.y = 1.6 + (k % 2) * 0.5;
      drip.position.set(Math.cos(a) * r, y1 - 0.12 - (k % 3) * 0.09, Math.sin(a) * r);
      group.add(drip);
    }
  });

  // ---- 頂上ケーキ(デコが育つ) ----
  const summit = new THREE.Group();
  const sBase = new THREE.Mesh(new THREE.CylinderGeometry(TOWER.summit.r, TOWER.summit.r + 0.1, TOWER.summit.topY - TOWER.summit.y, 32), mats.pinkStripe);
  sBase.position.y = (TOWER.summit.y + TOWER.summit.topY) / 2;
  sBase.castShadow = true;
  summit.add(sBase);
  const sTop = new THREE.Mesh(new THREE.CylinderGeometry(TOWER.summit.r + 0.12, TOWER.summit.r + 0.12, 0.22, 32), mats.cream);
  sTop.position.y = TOWER.summit.topY + 0.11;
  summit.add(sTop);
  group.add(summit);

  // デコ段階(クリアごとに追加)
  const decoGroups = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  decoGroups.forEach((g) => { g.visible = false; summit.add(g); });
  // 1: いちご+クリーム
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const straw = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 10), mats.strawberry);
    straw.position.set(Math.cos(a) * 1.15, TOWER.summit.topY + 0.4, Math.sin(a) * 1.15);
    straw.castShadow = true;
    const dollop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mats.cream);
    dollop.scale.y = 1.4;
    dollop.position.set(Math.cos(a + 0.5) * 0.7, TOWER.summit.topY + 0.34, Math.sin(a + 0.5) * 0.7);
    decoGroups[0].add(straw, dollop);
  }
  // 2: チョコがけ+クッキー
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.3;
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mats.chocolate);
    drip.scale.y = 1.9;
    drip.position.set(Math.cos(a) * TOWER.summit.r, TOWER.summit.topY - 0.28, Math.sin(a) * TOWER.summit.r);
    decoGroups[1].add(drip);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 1.1;
    const cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 16), mats.biscuitDark);
    cookie.rotation.z = 0.5;
    cookie.rotation.y = a;
    cookie.position.set(Math.cos(a) * 0.75, TOWER.summit.topY + 0.32, Math.sin(a) * 0.75);
    cookie.castShadow = true;
    decoGroups[1].add(cookie);
  }
  // 3: ロウソク(火は main がゆらめかせる)
  const flames = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 10), mats.caneStripe);
    candle.position.set(Math.cos(a) * 0.55, TOWER.summit.topY + 0.55, Math.sin(a) * 0.55);
    candle.castShadow = true;
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 }),
    );
    flame.scale.y = 1.7;
    flame.position.set(Math.cos(a) * 0.55, TOWER.summit.topY + 1.05, Math.sin(a) * 0.55);
    decoGroups[2].add(candle, flame);
    flames.push(flame);
  }

  // ---- レール一式 ----
  const lipColors = {
    R1: mats.strawberry, R2: mats.mint, R3: mats.lemon, R4: mats.berryBlue,
    R5: mats.strawberry, R6: mats.grape, RET: mats.mint, R7: mats.orange,
    R8: mats.berryBlue, R9: mats.lemon, R10: mats.strawberry,
  };
  for (const key of Object.keys(RAILS)) {
    buildRail(RAILS[key], mats, world, group, { name: key, lipMat: lipColors[key] });
  }

  // ---- ペグ落下路 ----
  for (const [px, py] of PEGS) {
    world.add(new CylinderZCollider({
      center: new THREE.Vector3(px, py, 0), radius: PEG_RADIUS, halfDepth: 0.42, restitution: 0.5, name: 'peg',
    }));
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(PEG_RADIUS, PEG_RADIUS, 0.85, 12), mats.gold);
    peg.rotation.x = Math.PI / 2;
    placeAt(peg, px, py, 0, 0);
    peg.rotateX(Math.PI / 2);
    peg.castShadow = true;
    group.add(peg);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(PEG_RADIUS * 1.5, 10, 8), mats.strawberry);
    placeAt(cap, px, py, 0.45, 0);
    group.add(cap);
  }
  // ペグのガード壁(左右)
  addFlatWall(world, group, {
    x: PEG_WALLS.left, y: (PEG_WALLS.top + PEG_WALLS.bottom) / 2,
    w: 0.14, h: PEG_WALLS.top - PEG_WALLS.bottom, mat: mats.mint, name: 'peg-guard-l',
  });
  addFlatWall(world, group, {
    x: PEG_WALLS.right, y: (PEG_WALLS.top + PEG_WALLS.rightBottom) / 2,
    w: 0.14, h: PEG_WALLS.top - PEG_WALLS.rightBottom, mat: mats.mint, name: 'peg-guard-r',
  });

  // ---- 風車への落としチュート ----
  addFlatWall(world, group, {
    x: WHEEL.chute.x, y: WHEEL.chute.y, w: WHEEL.chute.w, h: 0.15,
    ang: WHEEL.chute.angle, mat: mats.biscuit, name: 'wheel-chute', rest: 0.05,
  });

  // ---- ホイップリフトの器 ----
  const WL = WHIP_LIFT.walls;
  addFlatWall(world, group, { x: WL.left, y: (WL.leftTop + WL.bottom) / 2, w: 0.14, h: WL.leftTop - WL.bottom, mat: mats.grape, name: 'lift-wall-l' });
  // 右壁は置かない: RET(ループ帰還レール)が器の中まで通り抜ける。玉の保持は台の縁で行う
  // 器の底(プラットフォームが下がりきった時の受け)
  addFlatWall(world, group, { x: WHIP_LIFT.x, y: WHIP_LIFT.bottom - 0.35, w: 1.9, h: 0.16, mat: mats.icing, name: 'lift-floor' });

  // ---- ハンマーの窪み+ウエハースかご ----
  for (const wgd of HAMMER.wedges) {
    addFlatWall(world, group, { x: wgd.x, y: wgd.y, w: wgd.w, h: 0.15, ang: wgd.angle, mat: mats.biscuit, name: 'hammer-dip', rest: 0.02, fric: 0.05 });
  }
  // かご: 底+左右の壁(ウエハース)
  addFlatWall(world, group, { x: HAMMER.basket.x, y: HAMMER.basket.y - 0.15, w: 1.2, h: 0.16, mat: mats.biscuitDark, name: 'basket-floor', rest: 0.05 });
  addFlatWall(world, group, { x: HAMMER.basket.x - 0.62, y: HAMMER.basket.y + 0.28, w: 0.14, h: 0.75, mat: mats.biscuitDark, name: 'basket-l' });
  // 右壁は置かない: 送り出し床がそのまま R9 へ繋がる
  addFlatWall(world, group, { x: HAMMER.basket.x + 0.35, y: HAMMER.basket.y - 0.05, w: 0.85, h: 0.14, ang: -0.18, mat: mats.biscuitDark, name: 'basket-out', rest: 0.02 });

  // ---- ループザループ(見た目のみ・通過はスクリプト) ----
  const loopG = new THREE.Group();
  for (const zz of [0.3, -0.3]) {
    const ringRail = new THREE.Mesh(new THREE.TorusGeometry(LOOP.r, 0.055, 10, 40), mats.caneStripe);
    ringRail.position.z = zz;
    ringRail.castShadow = true;
    loopG.add(ringRail);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), mats.gold);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(Math.cos(a) * LOOP.r, Math.sin(a) * LOOP.r, 0);
    loopG.add(bar);
  }
  placeAt(loopG, LOOP.center[0], LOOP.center[1], 0, 0);
  group.add(loopG);

  // ---- ドミノの棚 ----
  const shelf = new THREE.Group();
  const shelfLen = DOMINO.row.x1 - DOMINO.row.x0 + 1.2;
  const shelfM = bMesh(mats.chocolate, shelfLen, 0.14, 0.8, 0.03);
  shelf.add(shelfM);
  placeAt(shelf, (DOMINO.row.x0 + DOMINO.row.x1) / 2, DOMINO.row.y - 0.1, DOMINO.row.z, -0.0);
  group.add(shelf);

  // ---- 大砲の台座 ----
  const cannonBase = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.4, 18), mats.mintStripe);
  pedestal.position.y = -0.85;
  pedestal.castShadow = true;
  cannonBase.add(pedestal);
  placeAt(cannonBase, CANNON.base[0], CANNON.base[1], 0, 0);
  group.add(cannonBase);
  // 大砲前の受け床(玉がカップに収まる窪み)
  addFlatWall(world, group, { x: CANNON.cup.x - 0.15, y: CANNON.cup.y - 0.5, w: 1.6, h: 0.16, ang: -0.06, mat: mats.icing, name: 'cannon-floor', rest: 0.02 });
  addFlatWall(world, group, { x: CANNON.cup.x + 0.75, y: CANNON.cup.y - 0.1, w: 0.14, h: 0.7, mat: mats.strawberry, name: 'cannon-stop' });

  // ---- 地面のお菓子飾り(皿の上) ----
  const decoRnd = [
    [0.7, 5.2, 'lolli', 0], [2.4, 5.6, 'gum', 1], [4.4, 5.4, 'cane', 2],
    [1.6, 6.1, 'gum', 3], [3.4, 6.3, 'lolli', 4], [5.5, 5.9, 'gum', 5],
  ];
  const gumMats = [mats.strawberry, mats.berryBlue, mats.lemon, mats.grape, mats.mint, mats.orange];
  for (const [angRaw, rad, kind, i] of decoRnd) {
    const a = angRaw;
    const px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
    if (kind === 'lolli') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), mats.icing);
      stick.position.set(px, 0.75, pz);
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.16, 24),
        new THREE.MeshStandardMaterial({ map: lollipopTex(i % 2 ? '#5db9ff' : '#ff6f9c'), roughness: 0.3 }),
      );
      head.rotation.x = Math.PI / 2;
      head.rotation.z = 0.2 * i;
      head.position.set(px, 1.7, pz);
      head.castShadow = true;
      stick.castShadow = true;
      group.add(stick, head);
    } else if (kind === 'gum') {
      const gum = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), gumMats[i % gumMats.length]);
      gum.scale.y = 0.85;
      gum.position.set(px, 0.28, pz);
      gum.castShadow = true;
      group.add(gum);
    } else {
      const cane = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 10), mats.caneStripe);
      stem.position.y = 0.65;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 16, Math.PI), mats.caneStripe);
      hook.position.y = 1.3;
      hook.rotation.y = a;
      cane.add(stem, hook);
      cane.position.set(px, 0, pz);
      cane.traverse((c) => { if (c.isMesh) c.castShadow = true; });
      group.add(cane);
    }
  }

  return { group, decoGroups, flames, summit };
}
