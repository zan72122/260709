// machine.js — 装置の静的構造(土台・背板・レール・チュート・リング・ゴール・飾り)
import * as THREE from '../vendor/three.module.min.js';
import { BoxCollider, CylinderZCollider } from './physics.js';
import { getMaterials, makePegboardTexture } from './materials.js';
import {
  RAILS, PEGS, PEG_RADIUS, PEG_GUARD, SIDE_CHUTE, HOOP, GOAL, MACHINE_BOUNDS,
} from './layout.js';

// 角丸ボックス(見た目用) — 低ポリで柔らかく
export function roundedBox(w, h, d, r = 0.06, seg = 2) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  // 頂点を丸める(疑似角丸: 法線方向へ収縮+球面化)
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

function boxMesh(mat, w, h, d, rounded = 0.05) {
  const m = new THREE.Mesh(rounded > 0 ? roundedBox(w, h, d, rounded) : new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---- レール(チャンネル)構築: 床板+奥/手前の縁 ----
// a → b の傾いた溝。物理コライダーも返す。
export function buildRail(def, mats, world, group, opts = {}) {
  const [ax, ay] = def.a, [bx, by] = def.b;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay) + (opts.extend || 0.34);
  const ang = Math.atan2(by - ay, bx - ax);
  const w = def.w, lip = def.lip;
  const floorTh = 0.16;

  const g = new THREE.Group();
  g.position.set(cx, cy, 0);
  g.rotation.z = ang;

  // 床板(ウォルナット)
  const floor = boxMesh(mats.walnut, len, floorTh, w, 0.04);
  g.add(floor);
  // 縁(手前と奥) — 交互に色を変えて可愛く
  const lipMat = opts.lipMat || mats.yellow;
  const lipF = boxMesh(lipMat, len, lip + floorTh, 0.09, 0.03);
  lipF.position.set(0, lip / 2, w / 2 - 0.045);
  const lipB = boxMesh(lipMat, len, lip + floorTh, 0.09, 0.03);
  lipB.position.set(0, lip / 2, -w / 2 + 0.045);
  g.add(lipF, lipB);
  // 支柱(下へ伸びる細い柱・見た目のみ)
  if (opts.posts !== false) {
    for (const t of [-0.42, 0.42]) {
      const px = cx + Math.cos(ang) * len * t;
      const py = cy + Math.sin(ang) * len * t;
      if (py > 1.6) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.9, 8), mats.beechV);
        post.position.set(px, py - 0.55, -0.55);
        post.castShadow = true;
        group.add(post);
      }
    }
  }
  group.add(g);

  // 物理: 床 + 両縁
  world.add(new BoxCollider({
    center: new THREE.Vector3(cx, cy, 0),
    half: new THREE.Vector3(len / 2, floorTh / 2, w / 2),
    angleZ: ang, friction: 0.012, restitution: 0.12, name: opts.name || 'rail',
  }));
  const lipHalf = new THREE.Vector3(len / 2, (lip + floorTh) / 2, 0.045);
  const off = new THREE.Vector2(-Math.sin(ang), Math.cos(ang)).multiplyScalar(lip / 2);
  for (const s of [1, -1]) {
    const zc = s * (w / 2 - 0.045);
    world.add(new BoxCollider({
      center: new THREE.Vector3(cx + off.x, cy + off.y, zc),
      half: lipHalf, angleZ: ang, friction: 0.01, restitution: 0.2, name: (opts.name || 'rail') + '-lip',
    }));
  }
  return g;
}

// 壁(見えないガード or 見える板)
export function addWall(world, group, mats, { x, y, z = 0, w, h, d = 1.0, ang = 0, visible = true, mat = null, name = 'wall', rest = 0.2 }) {
  if (visible) {
    const m = boxMesh(mat || mats.beech, w, h, d, 0.04);
    m.position.set(x, y, z);
    m.rotation.z = ang;
    group.add(m);
  }
  world.add(new BoxCollider({
    center: new THREE.Vector3(x, y, z),
    half: new THREE.Vector3(w / 2, h / 2, d / 2),
    angleZ: ang, friction: 0.01, restitution: rest, name,
  }));
}

export function buildMachine(world, mats) {
  const group = new THREE.Group();

  // ---- 土台(どっしりした木のテーブル) ----
  const base = boxMesh(mats.beech, 11.4, 0.7, 4.6, 0.1);
  base.position.set(0, 0.35, 0);
  group.add(base);
  world.add(new BoxCollider({
    center: new THREE.Vector3(0, 0.35, 0), half: new THREE.Vector3(5.7, 0.35, 2.3),
    friction: 0.02, restitution: 0.3, name: 'base',
  }));
  // 幕板(赤いアクセント)
  const skirt = boxMesh(mats.red, 11.0, 0.24, 4.3, 0.05);
  skirt.position.set(0, 0.78, 0);
  group.add(skirt);
  // 脚
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 10), mats.walnut);
    leg.position.set(sx * 5.0, -0.25, sz * 1.7);
    leg.castShadow = true;
    group.add(leg);
  }

  // ---- 背板(ペグボード) ----
  const pegTex = makePegboardTexture();
  pegTex.repeat.set(2.4, 3.4);
  const backMat = new THREE.MeshStandardMaterial({ map: pegTex, roughness: 0.8 });
  const back = boxMesh(backMat, 10.6, 13.9, 0.28, 0.08);
  back.position.set(0, 7.6, -1.05);
  group.add(back);
  // 背板の枠
  const frameMat = mats.walnut;
  for (const [fx, fy, fw, fh] of [
    [0, 14.62, 10.9, 0.34], [0, 0.62, 10.9, 0.30],
    [-5.42, 7.6, 0.34, 13.9], [5.42, 7.6, 0.34, 13.9],
  ]) {
    const f = boxMesh(frameMat, fw, fh, 0.42, 0.06);
    f.position.set(fx, fy, -1.05);
    group.add(f);
  }
  // 背板の飾り: 太陽と雲(塗装木の薄板)
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24), mats.yellow);
  sun.rotation.x = Math.PI / 2;
  sun.position.set(3.6, 12.9, -0.85);
  group.add(sun);
  for (let i = 0; i < 8; i++) {
    const ray = boxMesh(mats.yellow, 0.3, 0.1, 0.08, 0.03);
    const a = (i / 8) * Math.PI * 2;
    ray.position.set(3.6 + Math.cos(a) * 0.8, 12.9 + Math.sin(a) * 0.8, -0.85);
    ray.rotation.z = a;
    group.add(ray);
  }
  // 吊り看板(タイトル)
  const signCv = document.createElement('canvas');
  signCv.width = 512; signCv.height = 128;
  const sctx = signCv.getContext('2d');
  sctx.fillStyle = '#f6e7c8';
  sctx.fillRect(0, 0, 512, 128);
  sctx.strokeStyle = '#c99b5f';
  sctx.lineWidth = 10;
  sctx.strokeRect(7, 7, 498, 114);
  sctx.fillStyle = '#7c4a24';
  sctx.font = 'bold 58px "Hiragino Maru Gothic ProN", sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('コロコロからくり', 256, 70);
  const signTex = new THREE.CanvasTexture(signCv);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = boxMesh(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }), 3.1, 0.78, 0.12, 0.04);
  sign.position.set(0.6, 13.75, -0.8);
  group.add(sign);
  for (const sx of [-1.05, 1.05]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), mats.walnut);
    rope.position.set(0.6 + sx, 14.3, -0.8);
    group.add(rope);
  }

  const cloudG = new THREE.Group();
  for (const [dx, dy, r] of [[0, 0, 0.32], [0.36, 0.05, 0.24], [-0.36, 0.04, 0.22]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mats.cream);
    c.scale.z = 0.35;
    c.position.set(dx, dy, 0);
    cloudG.add(c);
  }
  cloudG.position.set(-2.2, 13.3, -0.85);
  group.add(cloudG);

  // ---- レール ----
  const lipColors = { R1: mats.blue, R2: mats.green, R3: mats.yellow, R4: mats.red, R6: mats.blue };
  for (const key of Object.keys(RAILS)) {
    buildRail(RAILS[key], mats, world, group, { name: key, lipMat: lipColors[key] || mats.yellow });
  }


  // ---- ペグ落下路 ----
  for (const [px, py] of PEGS) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(PEG_RADIUS, PEG_RADIUS, 0.85, 12), mats.brass);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(px, py, 0);
    peg.castShadow = true;
    group.add(peg);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(PEG_RADIUS * 1.4, 10, 8), mats.red);
    cap.position.set(px, py, 0.45);
    group.add(cap);
    world.add(new CylinderZCollider({
      center: new THREE.Vector3(px, py, 0), radius: PEG_RADIUS, halfDepth: 0.42,
      restitution: 0.5, name: 'peg',
    }));
  }
  // 落下路の左ガード
  addWall(world, group, mats, {
    x: PEG_GUARD.x, y: (PEG_GUARD.y0 + PEG_GUARD.y1) / 2, w: 0.13,
    h: PEG_GUARD.y1 - PEG_GUARD.y0, d: 0.95, mat: mats.green, name: 'peg-guard',
  });

  // ---- 右壁の縦チュート(R2 → 水車) ----
  // 右外壁
  addWall(world, group, mats, {
    x: SIDE_CHUTE.x + 0.33, y: (SIDE_CHUTE.top + SIDE_CHUTE.bottom) / 2 + 0.4,
    w: 0.16, h: SIDE_CHUTE.top - SIDE_CHUTE.bottom + 1.6, d: 0.95, mat: mats.beechV, name: 'chute-outer',
  });
  // R3 右端のバックストップ(水車から放たれた玉のこぼれ止め)
  addWall(world, group, mats, {
    x: 2.78, y: 8.95, w: 0.14, h: 0.72, d: 0.95, mat: mats.yellow, name: 'r3-backstop',
  });
  // スキージャンプ(左へ流す斜面)
  addWall(world, group, mats, {
    x: SIDE_CHUTE.deflector.x, y: SIDE_CHUTE.deflector.y,
    w: SIDE_CHUTE.deflector.w, h: 0.15, d: 0.95, ang: SIDE_CHUTE.deflector.angle, mat: mats.walnut, name: 'ski-jump', rest: 0.05,
  });

  // ---- 木のリング(カタパルトの的) ----
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(HOOP.r, 0.09, 12, 32), mats.yellow);
  hoop.position.set(HOOP.x, HOOP.y, 0);
  hoop.castShadow = true;
  group.add(hoop);
  // リングを支える柱
  const hoopPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, HOOP.y - HOOP.r - 0.7, 10), mats.beechV);
  hoopPost.position.set(HOOP.x, (HOOP.y - HOOP.r + 0.7) / 2, -0.4);
  group.add(hoopPost);

  // ---- ゴール漏斗+鐘のアーチ ----
  const fn = GOAL.funnel;
  const funnelGeo = new THREE.CylinderGeometry(fn.rTop, fn.rBottom, fn.height, 28, 1, true);
  const funnel = new THREE.Mesh(funnelGeo, new THREE.MeshStandardMaterial({
    map: mats.yellow.map, roughness: 0.4, side: THREE.DoubleSide,
  }));
  funnel.position.set(fn.x, fn.y, 0);
  funnel.castShadow = true;
  group.add(funnel);
  const funnelRim = new THREE.Mesh(new THREE.TorusGeometry(fn.rTop, 0.07, 10, 32), mats.red);
  funnelRim.rotation.x = Math.PI / 2;
  funnelRim.position.set(fn.x, fn.y + fn.height / 2, 0);
  group.add(funnelRim);
  // 漏斗の受け箱(玉が中に落ちて消える)
  const box = boxMesh(mats.walnut, 1.5, fn.y - fn.height / 2 - 0.7, 1.5, 0.06);
  box.position.set(fn.x, (fn.y - fn.height / 2 + 0.7) / 2, 0);
  group.add(box);
  // 鐘のアーチ
  const arch = new THREE.Group();
  const archMat = mats.red;
  const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 10), archMat);
  post1.position.set(fn.x - 1.05, fn.y + 0.6, 0);
  const post2 = post1.clone();
  post2.position.x = fn.x + 1.05;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 10), archMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(fn.x, GOAL.bell.y + 0.35, 0);
  arch.add(post1, post2, beam);
  arch.children.forEach((c) => { c.castShadow = true; });
  group.add(arch);
  // 鐘(金の釣鐘)
  const bellGeo = new THREE.CylinderGeometry(0.14, 0.34, 0.42, 16, 1, true);
  const bell = new THREE.Mesh(bellGeo, new THREE.MeshStandardMaterial({ color: 0xd9b45c, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide }));
  bell.position.set(GOAL.bell.x, GOAL.bell.y, 0);
  bell.castShadow = true;
  group.add(bell);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mats.brass);
  clapper.position.set(GOAL.bell.x, GOAL.bell.y - 0.2, 0);
  group.add(clapper);

  // ---- 飾り: 回る歯車(右下)・積み木の街(左下) ----
  const gears = [];
  for (const [gx, gy, gr, speed] of [[4.3, 2.35, 0.55, 0.6], [3.35, 1.9, 0.4, -0.85], [4.15, 1.25, 0.34, 1.1]]) {
    const gear = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr, 0.16, 20), mats.blue);
    disc.rotation.x = Math.PI / 2;
    gear.add(disc);
    const teeth = Math.round(gr * 14);
    for (let i = 0; i < teeth; i++) {
      const th = boxMesh(mats.blue, 0.14, 0.14, 0.16, 0.03);
      const a = (i / teeth) * Math.PI * 2;
      th.position.set(Math.cos(a) * (gr + 0.06), Math.sin(a) * (gr + 0.06), 0);
      th.rotation.z = a;
      gear.add(th);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), mats.brass);
    hub.rotation.x = Math.PI / 2;
    gear.add(hub);
    gear.position.set(gx, gy, -0.35);
    gear.userData.speed = speed;
    gear.children.forEach((c) => { c.castShadow = true; });
    group.add(gear);
    gears.push(gear);
  }
  // 積み木の家と木
  const house = new THREE.Group();
  const hw1 = boxMesh(mats.cream, 0.7, 0.6, 0.6, 0.05);
  hw1.position.y = 0.3;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 4), mats.red);
  roof.position.y = 0.85;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(hw1, roof);
  house.position.set(-4.6, 0.7, 1.2);
  group.add(house);
  for (const [tx, tz, s] of [[-3.6, 1.3, 1], [-4.2, 0.6, 0.8]]) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), mats.walnut);
    trunk.position.y = 0.2;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mats.green);
    crown.position.y = 0.55;
    crown.castShadow = true;
    tree.add(trunk, crown);
    tree.scale.setScalar(s);
    tree.position.set(tx, 0.7, tz);
    group.add(tree);
  }

  // ---- 場外ガード(見えない壁: 左右) ----
  for (const s of [-1, 1]) {
    world.add(new BoxCollider({
      center: new THREE.Vector3(s * 5.6, 7.5, 0), half: new THREE.Vector3(0.2, 8, 2),
      friction: 0, restitution: 0.3, name: 'guard',
    }));
  }

  return { group, gears, bell, clapper };
}

export function machineCenter() {
  return new THREE.Vector3(MACHINE_BOUNDS.centerX, MACHINE_BOUNDS.centerY, 0);
}
