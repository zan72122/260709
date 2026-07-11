// Procedural low-poly toys & furniture, v2. Every builder returns a
// THREE.Group with its origin at the bottom-centre plus a physics
// descriptor whose extents match the visual. No external assets.
//
// v2 additions: expressive faces (normal / scared / closed) exposed as
// group.userData.face, a wind-up chick family, a bunk bed, a bolted
// wall shelf (fixture), tall block towers and a piñata toy chest.

import * as THREE from '../vendor/three.module.min.js';
import { makeDesc } from './physics.js';

// ---------------------------------------------------------------- palettes
export const PALETTES = [
  { // round 0: ひだまりのへや (warm daylight)
    name: 'hidamari',
    wall: '#ffe9c9', wallLow: '#ffd9a6', floorA: '#e8b57c', floorB: '#dfa768',
    rug: '#8fd0c5', rugRim: '#63b3a6', sky: '#aee3ff',
    accents: ['#ff8fa3', '#ffd166', '#6cc5ff', '#8ce99a', '#c9a8ff', '#ffa94d'],
    bear: '#c98d5f', duck: '#ffd43b', bed: '#74c0fc', tub: '#f3fbff', hen: '#fff4e0',
  },
  { // round 1: ゆうやけのへや (sunset)
    name: 'yuuyake',
    wall: '#ffd2b3', wallLow: '#ffb98f', floorA: '#d99a68', floorB: '#cc8b58',
    rug: '#f7b1c8', rugRim: '#e58cae', sky: '#ffbf8a',
    accents: ['#ff922b', '#f783ac', '#9775fa', '#ffd43b', '#63e6be', '#ff6b6b'],
    bear: '#a97142', duck: '#ffa94d', bed: '#f783ac', tub: '#fff4ec', hen: '#ffe9d0',
  },
  { // round 2: よぞらのへや (starry night)
    name: 'yozora',
    wall: '#b9c6ff', wallLow: '#9aa8f0', floorA: '#8d7bc4', floorB: '#7d6bb4',
    rug: '#ffd43b', rugRim: '#f0b429', sky: '#3f4c9e',
    accents: ['#74c0fc', '#f783ac', '#ffe066', '#63e6be', '#b197fc', '#ffa8a8'],
    bear: '#8d6e63', duck: '#fff59d', bed: '#b197fc', tub: '#eef2ff', hen: '#f4f0ff',
  },
];

// ---------------------------------------------------------------- helpers
const matCache = new Map();
function mat(color, opt = {}) {
  const key = color + JSON.stringify(opt);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opt }));
  }
  return matCache.get(key);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function add(group, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  group.add(m);
  return m;
}

const geoCache = new Map();
function G(kind, ...args) {
  const key = kind + args.join(',');
  if (!geoCache.has(key)) {
    let g;
    switch (kind) {
      case 'box': g = new THREE.BoxGeometry(...args); break;
      case 'sph': g = new THREE.SphereGeometry(...args); break;
      case 'cyl': g = new THREE.CylinderGeometry(...args); break;
      case 'cone': g = new THREE.ConeGeometry(...args); break;
      case 'tor': g = new THREE.TorusGeometry(...args); break;
    }
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

// expressive googly eyes: normal / scared (tiny pupils) / closed (>< lines)
function addFace(group, spacing, y, z, size = 0.05) {
  const parts = { whites: [], pupils: [], lids: [] };
  for (const s of [-1, 1]) {
    const w = add(group, G('sph', size, 8, 6), mat('#ffffff'), s * spacing, y, z);
    const p = add(group, G('sph', size * 0.55, 8, 6), mat('#332222'), s * spacing, y, z + size * 0.6);
    const lid = add(group, G('box', size * 1.5, size * 0.35, size * 0.3), mat('#4a3428'), s * spacing, y, z + size * 0.55, 0, 0, s * 0.5);
    lid.visible = false;
    parts.whites.push(w); parts.pupils.push(p); parts.lids.push(lid);
  }
  const face = {
    mood: 'normal',
    set(mood) {
      if (mood === this.mood) return;
      this.mood = mood;
      const closed = mood === 'closed';
      for (const w of parts.whites) w.visible = !closed;
      for (const p of parts.pupils) { p.visible = !closed; p.scale.setScalar(mood === 'scared' ? 0.55 : 1); }
      for (const l of parts.lids) l.visible = closed;
    },
  };
  group.userData.face = face;
  return face;
}

// ---------------------------------------------------------------- builders
export function buildBall(color, r = 0.28, stripe = '#ffffff') {
  const g = new THREE.Group();
  const tex = canvasTex(128, 64, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.3, h * 0.1, 0, 7); ctx.fill();
  });
  const m = new THREE.Mesh(G('sph', r, 20, 14), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.y = r; m.castShadow = true;
  g.add(m);
  return { group: g, desc: makeDesc('ball', r * 2, r * 2, r * 2, { round: true, name: 'ball' }) };
}

export function buildBlock(color, letter, s = 0.34) {
  const g = new THREE.Group();
  const tex = canvasTex(96, 96, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
    ctx.fillStyle = color;
    ctx.font = `800 ${h * 0.55}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, w / 2, h * 0.55);
  });
  const m = new THREE.Mesh(G('box', s, s, s), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.y = s / 2; m.castShadow = true;
  g.add(m);
  return { group: g, desc: makeDesc('block', s, s, s, { name: 'block' }) };
}

export function buildCrayon(color) {
  const g = new THREE.Group();
  const r = 0.09, len = 0.72;
  add(g, G('cyl', r, r, len, 10), mat(color), 0, r, 0, 0, 0, Math.PI / 2);
  add(g, G('cone', r, 0.16, 10), mat(color), len / 2 + 0.08, r, 0, 0, 0, -Math.PI / 2);
  add(g, G('cyl', r * 1.06, r * 1.06, len * 0.4, 10), mat('#f5eee2'), 0, r, 0, 0, 0, Math.PI / 2);
  return { group: g, desc: makeDesc('crayon', len + 0.16, r * 2, r * 2, { name: 'crayon' }) };
}

export function buildDice() {
  const g = new THREE.Group();
  const s = 0.3;
  const tex = canvasTex(96, 96, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.16, 0, 7); ctx.fill();
  });
  const m = new THREE.Mesh(G('box', s, s, s), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.y = s / 2; m.castShadow = true; g.add(m);
  return { group: g, desc: makeDesc('dice', s, s, s, { name: 'dice' }) };
}

export function buildDuck(color) {
  const g = new THREE.Group();
  const body = add(g, G('sph', 0.26, 16, 12), mat(color), 0, 0.24, 0);
  body.scale.set(1.15, 0.9, 1);
  add(g, G('sph', 0.16, 14, 10), mat(color), 0.16, 0.5, 0);
  const beak = add(g, G('cone', 0.07, 0.14, 8), mat('#ff922b'), 0.34, 0.48, 0, 0, 0, -Math.PI / 2);
  beak.scale.set(1, 1, 1.4);
  addFace(g, 0.07, 0.56, 0.12, 0.035);
  add(g, G('sph', 0.12, 10, 8), mat(color), -0.05, 0.28, 0.2).scale.set(1.4, 0.7, 0.5);
  add(g, G('sph', 0.12, 10, 8), mat(color), -0.05, 0.28, -0.2).scale.set(1.4, 0.7, 0.5);
  return { group: g, desc: makeDesc('duck', 0.6, 0.66, 0.52, { round: true, buoyant: true, name: 'duck' }) };
}

export function buildBoat(color) {
  const g = new THREE.Group();
  const hull = add(g, G('cyl', 0.34, 0.22, 0.24, 12), mat(color), 0, 0.12, 0);
  hull.scale.set(1.5, 1, 1);
  add(g, G('box', 0.34, 0.2, 0.26), mat('#ffffff'), -0.04, 0.33, 0);
  add(g, G('cyl', 0.06, 0.06, 0.18, 8), mat('#ff6b6b'), 0.12, 0.5, 0);
  return { group: g, desc: makeDesc('boat', 1.0, 0.6, 0.5, { buoyant: true, name: 'boat' }) };
}

export function buildBear(color) {
  const g = new THREE.Group();
  const belly = mat('#f1dcc4');
  add(g, G('sph', 0.3, 16, 12), mat(color), 0, 0.34, 0).scale.set(1, 1.1, 0.9);
  add(g, G('sph', 0.18, 12, 10), belly, 0, 0.36, 0.16).scale.set(1, 1.25, 0.7);
  add(g, G('sph', 0.22, 16, 12), mat(color), 0, 0.78, 0);
  add(g, G('sph', 0.12, 10, 8), belly, 0, 0.72, 0.16).scale.set(1, 0.8, 0.6);
  add(g, G('sph', 0.08, 10, 8), mat(color), -0.16, 0.94, 0);
  add(g, G('sph', 0.08, 10, 8), mat(color), 0.16, 0.94, 0);
  add(g, G('sph', 0.04, 8, 6), mat('#5b4032'), 0, 0.77, 0.26);
  addFace(g, 0.09, 0.84, 0.18, 0.032);
  for (const s of [-1, 1]) {
    add(g, G('sph', 0.1, 10, 8), mat(color), s * 0.3, 0.42, 0).scale.set(0.8, 1.3, 0.8);
    add(g, G('sph', 0.11, 10, 8), mat(color), s * 0.17, 0.1, 0.08).scale.set(0.9, 0.8, 1.2);
  }
  return { group: g, desc: makeDesc('bear', 0.72, 1.0, 0.62, { name: 'teddy bear' }) };
}

export function buildRobot(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 0.42, 0.44, 0.3), mat(color), 0, 0.44, 0);
  add(g, G('box', 0.3, 0.24, 0.26), mat(color), 0, 0.8, 0);
  add(g, G('box', 0.2, 0.08, 0.02), mat('#25313f'), 0, 0.82, 0.14);
  add(g, G('sph', 0.03, 8, 6), new THREE.MeshLambertMaterial({ color: '#9ff2ff', emissive: '#3ad6ff' }), -0.05, 0.82, 0.15);
  add(g, G('sph', 0.03, 8, 6), new THREE.MeshLambertMaterial({ color: '#9ff2ff', emissive: '#3ad6ff' }), 0.05, 0.82, 0.15);
  add(g, G('cyl', 0.02, 0.02, 0.12, 6), mat('#8895a5'), 0, 0.98, 0);
  add(g, G('sph', 0.045, 8, 6), new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 }), 0, 1.05, 0);
  add(g, G('sph', 0.09, 8, 6), mat(accent), 0, 0.5, 0.16);
  for (const s of [-1, 1]) {
    add(g, G('cyl', 0.05, 0.05, 0.3, 8), mat('#8895a5'), s * 0.27, 0.5, 0, 0, 0, 0.3 * s);
    add(g, G('sph', 0.07, 8, 6), mat(accent), s * 0.32, 0.34, 0);
    add(g, G('box', 0.13, 0.22, 0.16), mat('#8895a5'), s * 0.11, 0.11, 0);
  }
  return { group: g, desc: makeDesc('robot', 0.66, 1.08, 0.34, { name: 'robot' }) };
}

export function buildTrain(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 0.8, 0.3, 0.36), mat(color), 0, 0.32, 0);
  add(g, G('cyl', 0.15, 0.15, 0.5, 12), mat(accent), -0.15, 0.5, 0, 0, 0, Math.PI / 2);
  add(g, G('box', 0.3, 0.34, 0.34), mat(accent), 0.25, 0.62, 0);
  add(g, G('box', 0.34, 0.08, 0.38), mat(color), 0.25, 0.83, 0);
  add(g, G('cyl', 0.05, 0.08, 0.14, 8), mat('#4a4238'), -0.3, 0.62, 0);
  const wheelM = mat('#3f3a33');
  for (const wx of [-0.26, 0.02, 0.28]) for (const s of [-1, 1]) {
    add(g, G('cyl', 0.1, 0.1, 0.05, 10), wheelM, wx, 0.1, s * 0.2, Math.PI / 2, 0, 0);
  }
  return {
    group: g,
    desc: makeDesc('train', 0.96, 0.9, 0.44, {
      name: 'train',
      wheels: [{ x: -0.26, z: 0, r: 0.1 }, { x: 0.28, z: 0, r: 0.1 }],
    }),
  };
}

export function buildMiniCar(color) {
  const g = new THREE.Group();
  add(g, G('box', 0.46, 0.13, 0.24), mat(color), 0, 0.14, 0);
  add(g, G('box', 0.24, 0.12, 0.2), mat('#d5ecff'), -0.02, 0.27, 0);
  const wheelM = mat('#3f3a33');
  for (const wx of [-0.15, 0.15]) for (const s of [-1, 1]) {
    add(g, G('cyl', 0.07, 0.07, 0.05, 10), wheelM, wx, 0.07, s * 0.13, Math.PI / 2, 0, 0);
  }
  return { group: g, desc: makeDesc('minicar', 0.5, 0.35, 0.3, { name: 'mini car' }) };
}

export function buildTricycle(color, accent) {
  const g = new THREE.Group();
  const wheelM = mat('#40352c');
  const hubM = mat('#f5f0e6');
  add(g, G('cyl', 0.3, 0.3, 0.09, 16), wheelM, 0.45, 0.3, 0, Math.PI / 2, 0, 0);
  add(g, G('cyl', 0.08, 0.08, 0.1, 8), hubM, 0.45, 0.3, 0, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]) {
    add(g, G('cyl', 0.18, 0.18, 0.07, 14), wheelM, -0.4, 0.18, s * 0.3, Math.PI / 2, 0, 0);
    add(g, G('cyl', 0.05, 0.05, 0.08, 8), hubM, -0.4, 0.18, s * 0.3, Math.PI / 2, 0, 0);
  }
  add(g, G('cyl', 0.045, 0.045, 0.75, 8), mat(color), 0.05, 0.42, 0, 0, 0, Math.PI / 2 - 0.35);
  add(g, G('cyl', 0.045, 0.045, 0.5, 8), mat(color), 0.45, 0.62, 0, 0, 0, 0.15);
  add(g, G('cyl', 0.035, 0.035, 0.5, 8), mat(accent), 0.52, 0.88, 0, Math.PI / 2, 0, 0);
  add(g, G('sph', 0.05, 8, 6), mat(accent), 0.52, 0.88, 0.25);
  add(g, G('sph', 0.05, 8, 6), mat(accent), 0.52, 0.88, -0.25);
  add(g, G('box', 0.26, 0.07, 0.22), mat(accent), -0.28, 0.56, 0);
  add(g, G('cyl', 0.04, 0.04, 0.25, 8), mat(color), -0.28, 0.44, 0);
  return {
    group: g,
    desc: makeDesc('tricycle', 1.3, 0.95, 0.68, {
      name: 'tricycle',
      wheels: [{ x: 0.45, z: 0, r: 0.3 }, { x: -0.4, z: 0.3, r: 0.18 }, { x: -0.4, z: -0.3, r: 0.18 }],
    }),
  };
}

export function buildWagon(color) {
  const g = new THREE.Group();
  add(g, G('box', 0.8, 0.3, 0.5), mat(color), 0, 0.4, 0);
  const wheelM = mat('#3f3a33');
  for (const wx of [-0.28, 0.28]) for (const s of [-1, 1]) {
    add(g, G('cyl', 0.13, 0.13, 0.06, 12), wheelM, wx, 0.13, s * 0.27, Math.PI / 2, 0, 0);
  }
  add(g, G('cyl', 0.025, 0.025, 0.5, 6), mat('#8895a5'), 0.55, 0.34, 0, 0, 0, 1.1);
  add(g, G('cyl', 0.04, 0.04, 0.16, 6), mat('#8895a5'), 0.72, 0.5, 0, Math.PI / 2, 0, 0);
  return {
    group: g,
    desc: makeDesc('wagon', 1.0, 0.62, 0.62, {
      name: 'wagon',
      wheels: [{ x: -0.28, z: 0.27, r: 0.13 }, { x: 0.28, z: 0.27, r: 0.13 }, { x: -0.28, z: -0.27, r: 0.13 }, { x: 0.28, z: -0.27, r: 0.13 }],
    }),
  };
}

export function buildXylophone(colors) {
  const g = new THREE.Group();
  add(g, G('box', 1.0, 0.1, 0.44), mat('#c98d5f'), 0, 0.09, 0);
  for (let i = 0; i < 6; i++) {
    const w = 0.4 - i * 0.04;
    add(g, G('box', 0.12, 0.05, 1), mat(colors[i % colors.length]), -0.42 + i * 0.17, 0.17, 0).scale.z = w;
  }
  return { group: g, desc: makeDesc('xylophone', 1.06, 0.22, 0.5, { name: 'xylophone' }) };
}

export function buildDrum(color, accent) {
  const g = new THREE.Group();
  const r = 0.32;
  add(g, G('cyl', r, r, 0.36, 18), mat(color), 0, 0.18, 0);
  add(g, G('cyl', r * 1.04, r * 1.04, 0.05, 18), mat('#fff8ec'), 0, 0.37, 0);
  add(g, G('tor', r, 0.03, 8, 18), mat(accent), 0, 0.05, 0, Math.PI / 2, 0, 0);
  return { group: g, desc: makeDesc('drum', r * 2, 0.42, r * 2, { round: true, name: 'drum' }) };
}

export function buildBook(color, w = 0.5, t = 0.09) {
  const g = new THREE.Group();
  add(g, G('box', w, t, w * 0.72), mat(color), 0, t / 2, 0);
  add(g, G('box', w * 0.94, t * 0.6, w * 0.66), mat('#fdf6e3'), 0.008, t / 2, 0);
  return { group: g, desc: makeDesc('book', w, t, w * 0.72, { name: 'book' }) };
}

export function buildTeapot(color) {
  const g = new THREE.Group();
  add(g, G('sph', 0.17, 14, 10), mat(color), 0, 0.17, 0).scale.set(1, 0.85, 1);
  add(g, G('cyl', 0.05, 0.02, 0.05, 8), mat(color), 0, 0.32, 0);
  add(g, G('sph', 0.035, 8, 6), mat('#ffffff'), 0, 0.36, 0);
  add(g, G('cyl', 0.03, 0.05, 0.16, 8), mat(color), 0.18, 0.22, 0, 0, 0, -1.0);
  add(g, G('tor', 0.08, 0.02, 6, 12), mat(color), -0.17, 0.18, 0);
  return { group: g, desc: makeDesc('teapot', 0.42, 0.38, 0.34, { round: true, name: 'teapot' }) };
}

export function buildCup(color) {
  const g = new THREE.Group();
  add(g, G('cyl', 0.09, 0.07, 0.12, 12), mat(color), 0, 0.06, 0);
  add(g, G('tor', 0.05, 0.014, 6, 10), mat(color), 0.1, 0.07, 0);
  return { group: g, desc: makeDesc('cup', 0.2, 0.13, 0.18, { round: true, name: 'cup' }) };
}

export function buildRockingHorse(color, accent) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const r = add(g, G('tor', 0.55, 0.045, 8, 20, Math.PI * 0.85), mat(accent), 0, 0.58, s * 0.16, 0, 0, Math.PI + Math.PI * 0.075);
    r.scale.set(1, 0.9, 1);
  }
  add(g, G('box', 0.62, 0.3, 0.3), mat(color), 0, 0.62, 0);
  add(g, G('box', 0.2, 0.34, 0.18), mat(color), 0.32, 0.9, 0, 0, 0, -0.2);
  add(g, G('box', 0.2, 0.12, 0.14), mat(color), 0.44, 1.0, 0, 0, 0, -0.2);
  add(g, G('cone', 0.05, 0.12, 6), mat(accent), 0.3, 1.12, 0.03, 0, 0, -0.2);
  addFace(g, 0.055, 1.0, 0.09, 0.028);
  add(g, G('cyl', 0.03, 0.03, 0.3, 6), mat(accent), 0.18, 0.85, 0, 0, 0, 0.5);
  add(g, G('box', 0.16, 0.05, 0.2), mat(accent), -0.1, 0.79, 0);
  for (const sx of [-0.22, 0.22]) for (const sz of [-1, 1]) {
    add(g, G('cyl', 0.035, 0.035, 0.34, 6), mat(color), sx, 0.42, sz * 0.13, 0.16 * sz, 0, 0.12 * Math.sign(sx));
  }
  return { group: g, desc: makeDesc('rockinghorse', 1.16, 1.2, 0.42, { name: 'rocking horse' }) };
}

export function buildLamp(color, accent) {
  const g = new THREE.Group();
  add(g, G('cyl', 0.22, 0.26, 0.06, 14), mat(color), 0, 0.03, 0);
  add(g, G('cyl', 0.035, 0.035, 1.15, 8), mat(color), 0, 0.62, 0);
  add(g, G('cone', 0.3, 0.34, 14, 1, true), mat(accent), 0, 1.32, 0);
  const bulb = new THREE.MeshLambertMaterial({ color: '#fff6d8', emissive: '#ffdf8a', emissiveIntensity: 0.7 });
  add(g, G('sph', 0.09, 10, 8), bulb, 0, 1.24, 0);
  return { group: g, desc: makeDesc('lamp', 0.52, 1.5, 0.52, { round: true, name: 'lamp' }) };
}

export function buildStool(color) {
  const g = new THREE.Group();
  add(g, G('cyl', 0.3, 0.3, 0.08, 14), mat(color), 0, 0.5, 0);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    add(g, G('cyl', 0.035, 0.045, 0.5, 8), mat('#b98a5e'), Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2, 0.14 * Math.sin(a), 0, -0.14 * Math.cos(a));
  }
  return { group: g, desc: makeDesc('stool', 0.62, 0.55, 0.62, { round: true, topR: 0.24, topY: 0.55, name: 'stool' }) };
}

export function buildChair(color) {
  const g = new THREE.Group();
  add(g, G('box', 0.55, 0.08, 0.5), mat(color), 0, 0.5, 0);
  add(g, G('box', 0.55, 0.55, 0.08), mat(color), 0, 0.82, -0.23);
  for (const sx of [-0.22, 0.22]) for (const sz of [-0.19, 0.19]) {
    add(g, G('box', 0.07, 0.5, 0.07), mat('#c9a077'), sx, 0.25, sz);
  }
  return { group: g, desc: makeDesc('chair', 0.72, 1.1, 0.66, { name: 'chair' }) };
}

export function buildTable(color) {
  const g = new THREE.Group();
  add(g, G('cyl', 0.85, 0.85, 0.09, 20), mat(color), 0, 1.0, 0);
  add(g, G('cyl', 0.08, 0.1, 1.0, 10), mat('#c9a077'), 0, 0.5, 0);
  add(g, G('cyl', 0.4, 0.44, 0.06, 14), mat('#c9a077'), 0, 0.03, 0);
  return { group: g, desc: makeDesc('table', 1.74, 1.06, 1.74, { round: true, topR: 0.72, topY: 1.05, name: 'table' }), topY: 1.05 };
}

export function buildToyChest(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 1.15, 0.6, 0.68), mat(color), 0, 0.3, 0);
  add(g, G('cyl', 0.34, 0.34, 1.15, 14, 1, false, Math.PI, Math.PI), mat(accent), 0, 0.6, 0, 0, 0, Math.PI / 2);
  add(g, G('box', 0.16, 0.14, 0.03), mat('#ffe066'), 0, 0.42, 0.35);
  // confetti sticker so it reads as a party box
  const star = canvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.font = '44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', w / 2, h / 2 + 2);
  });
  const st = new THREE.Mesh(G('box', 0.3, 0.3, 0.01), new THREE.MeshBasicMaterial({ map: star, transparent: true }));
  st.position.set(-0.3, 0.32, 0.35);
  g.add(st);
  return {
    group: g,
    desc: makeDesc('toychest', 1.15, 0.95, 0.68, { pinata: true, topR: 0.5, topY: 0.94, name: 'toy chest' }),
    topY: 0.94,
  };
}

export function buildShelf(color) {
  const g = new THREE.Group();
  const m = mat(color);
  add(g, G('box', 0.08, 1.5, 0.5), m, -0.66, 0.75, 0);
  add(g, G('box', 0.08, 1.5, 0.5), m, 0.66, 0.75, 0);
  add(g, G('box', 1.4, 0.07, 0.5), m, 0, 1.46, 0);
  add(g, G('box', 1.4, 0.07, 0.5), m, 0, 0.72, 0);
  add(g, G('box', 1.4, 0.07, 0.5), m, 0, 0.06, 0);
  const backPanel = new THREE.MeshLambertMaterial({ color: '#7a5433', transparent: true, opacity: 0.4 });
  add(g, G('box', 1.4, 1.5, 0.06), backPanel, 0, 0.75, -0.22);
  return {
    group: g,
    desc: makeDesc('shelf', 1.4, 1.5, 0.52, { topR: 0.55, topY: 1.5, name: 'shelf' }),
    topY: 1.5, midY: 0.76,
  };
}

// bolted wall shelf: a FIXTURE — can only be shaken, never swallowed
export function buildWallShelf(color) {
  const g = new THREE.Group();
  const m = mat(color);
  add(g, G('box', 2.3, 0.08, 0.55), m, 0, 1.92, 0);
  for (const sx of [-0.85, 0.85]) {
    add(g, G('box', 0.07, 0.5, 0.45), m, sx, 1.65, -0.03, 0.6, 0, 0);
  }
  // little bolts so it clearly belongs to the wall
  for (const sx of [-1.0, 1.0]) add(g, G('sph', 0.04, 6, 5), mat('#8895a5'), sx, 1.94, 0.24);
  return {
    group: g,
    desc: makeDesc('wallshelf', 2.3, 2.0, 0.6, { fixture: true, topR: 0.8, topY: 1.96, name: 'wall shelf' }),
    topY: 1.96,
  };
}

// two-storey bunk bed — the biggest prize in the room
export function buildBunkBed(color, accent) {
  const g = new THREE.Group();
  const wood = mat('#c9a077');
  for (const sx of [-1.05, 1.05]) for (const sz of [-0.55, 0.55]) {
    add(g, G('box', 0.12, 1.7, 0.12), wood, sx, 0.85, sz);
  }
  // lower bunk
  add(g, G('box', 2.3, 0.22, 1.3), wood, 0, 0.42, 0);
  add(g, G('box', 2.2, 0.18, 1.16), mat('#ffffff'), 0, 0.58, 0);
  add(g, G('box', 1.5, 0.14, 1.14), mat(color), -0.3, 0.68, 0);
  add(g, G('box', 0.55, 0.14, 0.8), mat(accent), 0.75, 0.7, 0, 0, 0, 0.05);
  // upper bunk
  add(g, G('box', 2.3, 0.22, 1.3), wood, 0, 1.42, 0);
  add(g, G('box', 2.2, 0.16, 1.16), mat('#ffffff'), 0, 1.56, 0);
  add(g, G('box', 1.4, 0.12, 1.12), mat(accent), -0.35, 1.64, 0);
  // guard rail + ladder
  add(g, G('box', 2.3, 0.07, 0.06), wood, 0, 1.82, 0.62);
  for (const sx of [-0.8, 0, 0.8]) add(g, G('box', 0.06, 0.24, 0.06), wood, sx, 1.7, 0.62);
  add(g, G('box', 0.09, 1.5, 0.06), wood, 1.0, 0.75, 0.68, 0.12, 0, 0);
  add(g, G('box', 0.09, 1.5, 0.06), wood, 1.28, 0.75, 0.68, 0.12, 0, 0);
  for (let i = 0; i < 4; i++) add(g, G('box', 0.32, 0.05, 0.06), wood, 1.14, 0.3 + i * 0.36, 0.68 + i * 0.043, 0.12, 0, 0);
  return {
    group: g,
    desc: makeDesc('bunkbed', 2.3, 1.9, 1.3, { topR: 0.85, topY: 1.66, name: 'bunk bed' }),
    topY: 1.66,
  };
}

// --------------------------------------------------- the wind-up family
export function buildHen(color) {
  const g = new THREE.Group();
  const body = add(g, G('sph', 0.24, 14, 10), mat(color), 0, 0.26, 0);
  body.scale.set(1.1, 1, 0.95);
  add(g, G('sph', 0.15, 12, 8), mat(color), 0, 0.5, 0.1);
  add(g, G('cone', 0.05, 0.11, 6), mat('#ff922b'), 0, 0.5, 0.27, Math.PI / 2, 0, 0);
  // comb + wattle
  for (const [cx, cy] of [[-0.04, 0.63], [0.02, 0.66], [0.08, 0.62]]) {
    add(g, G('sph', 0.045, 8, 6), mat('#ff6b6b'), cx, cy, 0.08);
  }
  add(g, G('sph', 0.035, 8, 6), mat('#ff6b6b'), 0, 0.43, 0.26);
  addFace(g, 0.075, 0.55, 0.2, 0.03);
  // tail + wings
  add(g, G('sph', 0.12, 10, 8), mat(color), 0, 0.34, -0.22).scale.set(0.8, 1.1, 0.9);
  for (const s of [-1, 1]) add(g, G('sph', 0.1, 10, 8), mat(color), s * 0.2, 0.28, 0).scale.set(0.5, 0.8, 1.1);
  // wind-up key on the back
  add(g, G('cyl', 0.02, 0.02, 0.12, 6), mat('#8895a5'), 0, 0.42, -0.3, Math.PI / 2, 0, 0);
  add(g, G('tor', 0.06, 0.018, 6, 10), mat('#ffd166'), 0, 0.42, -0.38);
  for (const s of [-1, 1]) {
    add(g, G('cyl', 0.02, 0.02, 0.12, 5), mat('#ff922b'), s * 0.07, 0.06, 0.02);
    add(g, G('sph', 0.035, 6, 5), mat('#ff922b'), s * 0.07, 0.01, 0.05).scale.set(1, 0.4, 1.6);
  }
  return {
    group: g,
    desc: makeDesc('hen', 0.5, 0.7, 0.5, {
      round: true, name: 'hen',
      walker: { speed: 0.85, flee: 2.3 },
    }),
  };
}

export function buildChick(color = '#ffe066') {
  const g = new THREE.Group();
  add(g, G('sph', 0.11, 12, 8), mat(color), 0, 0.12, 0);
  add(g, G('sph', 0.08, 10, 8), mat(color), 0, 0.24, 0.02);
  add(g, G('cone', 0.025, 0.06, 6), mat('#ff922b'), 0, 0.24, 0.1, Math.PI / 2, 0, 0);
  addFace(g, 0.04, 0.27, 0.07, 0.02);
  add(g, G('sph', 0.03, 6, 5), mat('#ffd43b'), 0, 0.33, 0);
  for (const s of [-1, 1]) {
    add(g, G('sph', 0.02, 6, 5), mat('#ff922b'), s * 0.04, 0.01, 0.02).scale.set(1, 0.4, 1.6);
  }
  return {
    group: g,
    desc: makeDesc('chick', 0.24, 0.35, 0.24, {
      round: true, name: 'chick',
      walker: { speed: 1.1, flee: 2.0 },
    }),
  };
}

// --------------------------------------------------- piñata contents
export function buildMini(i, pal) {
  const A = pal.accents;
  const kind = i % 3;
  if (kind === 0) {
    // candy: little wrapped sweet
    const g = new THREE.Group();
    const c = A[i % A.length];
    add(g, G('sph', 0.09, 10, 8), mat(c), 0, 0.09, 0).scale.set(1.3, 1, 1);
    add(g, G('cone', 0.05, 0.09, 6), mat(c), 0.16, 0.09, 0, 0, 0, -Math.PI / 2);
    add(g, G('cone', 0.05, 0.09, 6), mat(c), -0.16, 0.09, 0, 0, 0, Math.PI / 2);
    return { group: g, desc: makeDesc('candy', 0.36, 0.18, 0.18, { name: 'candy' }) };
  }
  if (kind === 1) return buildBall(A[(i + 2) % A.length], 0.12);
  return buildBlock(A[(i + 4) % A.length], 'ABCDEF'[i % 6], 0.2);
}

export function spawnPinataContents(scene, engine, paletteIndex, x, z, count = 9) {
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const out = [];
  for (let i = 0; i < count; i++) {
    const built = buildMini(i, pal);
    const [p] = engine.burstSpawn([built.desc], x, z);
    built.group.position.set(p.x, p.y, p.z);
    scene.add(built.group);
    out.push({ prop: p, group: built.group, built });
  }
  return out;
}

export function buildBathtub(color) {
  const g = new THREE.Group();
  const tub = add(g, G('cyl', 0.62, 0.5, 0.55, 18), mat(color), 0, 0.35, 0);
  tub.scale.set(1.35, 1, 1);
  const inner = add(g, G('cyl', 0.54, 0.46, 0.5, 18), mat('#bfe7f2'), 0, 0.4, 0);
  inner.scale.set(1.3, 1, 0.92);
  const water = new THREE.Mesh(
    G('cyl', 0.52, 0.52, 0.02, 18),
    new THREE.MeshLambertMaterial({ color: '#6fd2f2', transparent: true, opacity: 0.85 })
  );
  water.position.y = 0.56; water.scale.set(1.28, 1, 0.9);
  g.add(water);
  g.userData.water = water;
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.3, 0.3]) {
    add(g, G('sph', 0.09, 8, 6), mat('#ffd166'), sx, 0.06, sz);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    add(g, G('sph', 0.06 + (i % 3) * 0.02, 8, 6), mat('#ffffff'), Math.cos(a) * 0.4, 0.6, Math.sin(a) * 0.28);
  }
  return { group: g, desc: makeDesc('bathtub', 1.7, 0.75, 1.15, { round: true, waterSource: true, name: 'bathtub' }) };
}

export function buildBalloonGift(boxColor, ribbonColor, balloonColor) {
  const g = new THREE.Group();
  const s = 0.42;
  add(g, G('box', s, s, s), mat(boxColor), 0, s / 2, 0);
  add(g, G('box', s * 1.04, s * 1.04, s * 0.16), mat(ribbonColor), 0, s / 2, 0);
  add(g, G('box', s * 0.16, s * 1.04, s * 1.04), mat(ribbonColor), 0, s / 2, 0);
  add(g, G('sph', 0.09, 8, 6), mat(ribbonColor), 0, s + 0.03, 0);
  const balloon = new THREE.Group();
  const line = new THREE.Mesh(G('cyl', 0.008, 0.008, 0.75, 4), mat('#e8e2d5'));
  line.position.y = s + 0.4;
  balloon.add(line);
  const b = new THREE.Mesh(G('sph', 0.3, 16, 12), new THREE.MeshLambertMaterial({ color: balloonColor }));
  b.position.y = s + 1.05; b.scale.set(1, 1.15, 1); b.castShadow = true;
  balloon.add(b);
  const knot = new THREE.Mesh(G('cone', 0.05, 0.08, 6), mat(balloonColor));
  knot.position.y = s + 0.72; knot.rotation.x = Math.PI;
  balloon.add(knot);
  g.add(balloon);
  g.userData.balloon = balloon;
  return { group: g, desc: makeDesc('gift', s, s, s, { balloon: true, name: 'gift' }) };
}

// --------------------------------------------------- v4: the contraptions
export function buildSlide(color, accent) {
  const g = new THREE.Group();
  const m = mat(color);
  // platform + ladder at local -x, chute sweeping down to +x
  add(g, G('box', 0.9, 0.08, 0.9), m, -0.95, 1.9, 0);
  for (const sz of [-0.38, 0.38]) {
    add(g, G('box', 0.06, 1.9, 0.06), mat('#c9a077'), -1.3, 0.95, sz);
    add(g, G('box', 0.06, 1.9, 0.06), mat('#c9a077'), -0.6, 0.95, sz);
  }
  for (let i = 0; i < 4; i++) {
    add(g, G('box', 0.5, 0.05, 0.7), mat('#c9a077'), -1.3, 0.35 + i * 0.42, 0);
  }
  // chute: sloped from platform down to the lip
  const chute = add(g, G('box', 2.4, 0.07, 0.72), mat(accent), 0.35, 1.15, 0);
  chute.rotation.z = -0.58;
  for (const sz of [-0.38, 0.38]) {
    const rail = add(g, G('box', 2.4, 0.2, 0.05), m, 0.35, 1.28, sz);
    rail.rotation.z = -0.58;
  }
  add(g, G('box', 0.6, 0.07, 0.72), mat(accent), 1.45, 0.42, 0);
  // guard rails on the platform
  add(g, G('box', 0.9, 0.3, 0.05), m, -0.95, 2.1, 0.43);
  add(g, G('box', 0.9, 0.3, 0.05), m, -0.95, 2.1, -0.43);
  return {
    group: g,
    desc: makeDesc('slide', 3.4, 2.3, 1.0, {
      fixture: true, topR: 0.5, topY: 1.95, name: 'slide',
      device: { type: 'slide', topX: -0.95, exitX: 1.6, topH: 1.95, exitH: 0.45, lean: 0.55 },
    }),
    topY: 1.95,
  };
}

export function buildSeesaw(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 0.5, 0.45, 0.5), mat(accent), 0, 0.22, 0).rotation.z = Math.PI / 4;
  const plank = new THREE.Group();
  const pm = add(plank, G('box', 2.6, 0.08, 0.55), mat(color), 0, 0, 0);
  add(plank, G('box', 0.1, 0.22, 0.55), mat(accent), -1.25, 0.12, 0);
  add(plank, G('box', 0.1, 0.22, 0.55), mat(accent), 1.25, 0.12, 0);
  plank.position.y = 0.42;
  plank.rotation.z = 0.3;                     // -x end resting on the floor
  g.add(plank);
  g.userData.plank = plank;
  return {
    group: g,
    desc: makeDesc('seesaw', 2.6, 1.1, 0.55, {
      // plank end height: pivot 0.42 + 1.3·sin(0.3) ≈ 0.80
      topR: 0.45, topY: 0.82, name: 'seesaw',
      device: { type: 'seesaw', lowerId: 0, upperId: 0, launchDir: 1, flipped: false },
    }),
  };
}

export function buildCupboard(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 1.7, 1.9, 0.7), mat(color), 0, 0.95, 0);
  add(g, G('box', 1.6, 0.06, 0.6), mat('#c9a077'), 0, 0.62, 0.02);
  add(g, G('box', 1.6, 0.06, 0.6), mat('#c9a077'), 0, 1.24, 0.02);
  // hinged doors (opened by main.js on the cupboardOpen event)
  const doors = [];
  for (const s of [-1, 1]) {
    const door = new THREE.Group();       // hinge at the outer edge
    add(door, G('box', 0.8, 1.7, 0.06), mat(accent), -s * 0.4, 0, 0);
    add(door, G('sph', 0.05, 8, 6), mat('#ffe066'), -s * 0.72, 0, 0.06);
    door.position.set(s * 0.82, 0.98, 0.36);
    door.userData.openAngle = s * 2.1;
    g.add(door);
    doors.push(door);
  }
  g.userData.doors = doors;
  return {
    group: g,
    desc: makeDesc('cupboard', 1.7, 1.9, 0.75, {
      fixture: true, topR: 0, topY: 1.9, name: 'cupboard',
      device: { type: 'cupboard', open: false, face: 1 },
    }),
  };
}

export function buildTrampoline(color, accent) {
  const g = new THREE.Group();
  const surface = add(g, G('cyl', 0.72, 0.72, 0.05, 22), mat(accent), 0, 0.33, 0);
  g.userData.surface = surface;
  add(g, G('tor', 0.78, 0.09, 10, 24), mat(color), 0, 0.33, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(g, G('cyl', 0.04, 0.05, 0.32, 8), mat('#8895a5'), Math.cos(a) * 0.62, 0.16, Math.sin(a) * 0.62);
  }
  return {
    group: g,
    desc: makeDesc('trampoline', 1.74, 0.42, 1.74, {
      round: true, fixture: true, topR: 0.75, topY: 0.38, name: 'trampoline',
      device: { type: 'tramp', topY: 0.38 },
    }),
  };
}

export function buildRail(color, from, to, h) {
  const g = new THREE.Group();
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2;
  const yaw = Math.atan2(to.z - from.z, to.x - from.x);
  const railM = mat(color);
  for (const off of [-0.14, 0.14]) {
    const r = add(g, G('cyl', 0.035, 0.035, 1, 8), railM, 0, h, off, 0, 0, Math.PI / 2);
    r.scale.y = len;
  }
  for (let i = 0; i <= 3; i++) {
    add(g, G('cyl', 0.05, 0.06, h, 8), mat('#c9a077'), -len / 2 + (len / 3) * i, h / 2, 0);
  }
  // entry funnel at the "from" end
  const funnel = add(g, G('cone', 0.55, 0.6, 12, 1, true), mat('#ffd166'), -len / 2, h + 0.28, 0);
  funnel.rotation.x = Math.PI;
  g.position.set(cx, 0, cz);
  g.rotation.y = -yaw;
  return {
    group: g,
    desc: makeDesc('rail', 0.6, h + 0.6, 0.6, {
      fixture: true, name: 'rail',
      device: { type: 'rail', fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z, h },
    }),
    pos: { x: cx, z: cz },
  };
}

export function buildWardrobe(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 2.0, 2.1, 0.85), mat(color), 0, 1.05, 0);
  add(g, G('box', 0.05, 1.9, 0.02), mat('#ffffff'), 0, 1.05, 0.44);
  for (const s of [-1, 1]) {
    add(g, G('sph', 0.05, 8, 6), mat('#ffe066'), s * 0.14, 1.05, 0.45);
    add(g, G('box', 0.85, 0.4, 0.02), mat(accent), s * 0.5, 1.75, 0.44);
  }
  return {
    group: g,
    desc: makeDesc('wardrobe', 2.0, 2.1, 0.85, { topR: 0.6, topY: 2.12, name: 'wardrobe' }),
    topY: 2.12,
  };
}

// --------------------------------------------------- v4: dog & cat
export function buildDog(color = '#e8d3b0') {
  const g = new THREE.Group();
  const body = add(g, G('sph', 0.24, 14, 10), mat(color), 0, 0.28, 0);
  body.scale.set(1.35, 0.95, 0.9);
  add(g, G('sph', 0.17, 12, 10), mat(color), 0.3, 0.5, 0);
  add(g, G('sph', 0.09, 10, 8), mat('#f7ede0'), 0.42, 0.44, 0).scale.set(1.2, 0.9, 0.9);
  add(g, G('sph', 0.035, 8, 6), mat('#4a3428'), 0.51, 0.47, 0);
  addFace(g, 0.07, 0.57, 0.13, 0.028);
  for (const s of [-1, 1]) {
    add(g, G('sph', 0.07, 8, 6), mat('#b98a5e'), s * 0.1, 0.62, -0.02).scale.set(0.6, 1.4, 0.8);
  }
  const tail = add(g, G('cyl', 0.03, 0.05, 0.26, 6), mat(color), -0.34, 0.42, 0, 0, 0, 1.0);
  g.userData.tail = tail;
  for (const sx of [-0.14, 0.2]) for (const sz of [-1, 1]) {
    add(g, G('cyl', 0.045, 0.05, 0.16, 6), mat(color), sx, 0.08, sz * 0.11);
  }
  return {
    group: g,
    desc: makeDesc('dog', 0.62, 0.72, 0.46, {
      round: true, name: 'puppy',
      walker: { kind: 'dog', speed: 1.4, flee: 2.6 },
    }),
  };
}

export function buildCat(color = '#9aa5b1') {
  const g = new THREE.Group();
  const body = add(g, G('sph', 0.2, 14, 10), mat(color), 0, 0.24, 0);
  body.scale.set(1.4, 0.95, 0.85);
  add(g, G('sph', 0.15, 12, 10), mat(color), 0.28, 0.46, 0);
  addFace(g, 0.065, 0.52, 0.11, 0.026);
  add(g, G('cone', 0.045, 0.09, 4), mat(color), 0.2, 0.62, 0.06);
  add(g, G('cone', 0.045, 0.09, 4), mat(color), 0.2, 0.62, -0.06);
  add(g, G('sph', 0.025, 6, 5), mat('#f5a9b8'), 0.42, 0.44, 0);
  const tail = add(g, G('cyl', 0.025, 0.035, 0.42, 6), mat(color), -0.3, 0.4, 0, 0, 0, 0.7);
  g.userData.tail = tail;
  add(g, G('box', 0.16, 0.03, 0.01), mat('#ffffff'), 0.44, 0.46, 0.08);
  add(g, G('box', 0.16, 0.03, 0.01), mat('#ffffff'), 0.44, 0.46, -0.08);
  for (const sx of [-0.12, 0.18]) for (const sz of [-1, 1]) {
    add(g, G('cyl', 0.04, 0.045, 0.14, 6), mat(color), sx, 0.07, sz * 0.09);
  }
  return {
    group: g,
    desc: makeDesc('cat', 0.56, 0.66, 0.4, {
      round: true, name: 'cat',
      walker: { kind: 'cat', speed: 0.7, flee: 2.4 },
    }),
  };
}

// ------------------------------------------------------------- room layout
export function buildRound(scene, engine, paletteIndex, rand, stage = 0) {
  return stage === 1
    ? layoutPlayRoom(scene, engine, paletteIndex, rand)
    : layoutToyRoom(scene, engine, paletteIndex, rand);
}

function layoutToyRoom(scene, engine, paletteIndex, rand) {
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const A = pal.accents;
  const out = [];
  const J = (v) => v + (rand() - 0.5) * 0.5;

  const put = (built, x, z, opt = {}) => {
    const p = engine.addProp(built.desc, x, z, opt);
    built.group.position.set(x, opt.y || 0, z);
    if (opt.yaw) built.group.rotation.y = opt.yaw;
    scene.add(built.group);
    out.push({ prop: p, group: built.group, built });
    return p;
  };

  // --- rug zone: small starter toys
  put(buildCrayon(A[0]), J(-1.6), J(1.6), { yaw: 0.4 });
  put(buildCrayon(A[1]), J(-0.6), J(2.3), { yaw: -0.9 });
  put(buildCrayon(A[2]), J(0.9), J(1.8), { yaw: 1.8 });
  put(buildBall(A[4], 0.22), J(-2.4), J(0.6));
  put(buildBall(A[5], 0.28), J(2.2), J(0.4));
  put(buildBall(A[0], 0.34), J(0.4), J(3.4));
  put(buildDice(), J(-1.0), J(0.4));
  put(buildDice(), J(1.2), J(0.9));
  put(buildDuck(pal.duck), J(-3.2), J(2.4));
  put(buildBoat(A[2]), J(-4.2), J(1.0), { yaw: 0.7 });
  put(buildMiniCar(A[1]), J(3.4), J(1.6), { yaw: -0.5 });
  put(buildMiniCar(A[3]), J(4.2), J(2.8), { yaw: 2.2 });

  // --- TALL block towers: the showpiece stacks
  {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const bx = -2.4, bz = 3.8;
    let below = put(buildBlock(A[0], letters[0]), bx, bz);
    for (let i = 1; i < 5; i++) {
      below = put(buildBlock(A[i % A.length], letters[i]), bx, bz, { y: 0.34 * i, supportId: below.id });
    }
    const cx = 4.8, cz = 0.8;
    let below2 = put(buildBlock(A[3], letters[3]), cx, cz);
    for (let i = 1; i < 4; i++) {
      below2 = put(buildBlock(A[(i + 3) % A.length], letters[(i + 2) % 6]), cx, cz, { y: 0.34 * i, supportId: below2.id });
    }
    put(buildBlock(A[1], 'G'), J(3.0), J(3.8));
  }
  // --- book stack
  {
    const bx = J(0.3), bz = J(-2.5);
    const b1 = put(buildBook(A[0], 0.52), bx, bz, { yaw: 0.3 });
    const b2 = put(buildBook(A[4], 0.46), bx, bz, { y: 0.09, yaw: -0.2, supportId: b1.id });
    put(buildBook(A[2], 0.4), bx, bz, { y: 0.18, yaw: 0.5, supportId: b2.id });
  }

  // --- the wind-up chick family
  {
    const hen = put(buildHen(pal.hen), 2.0, -1.5);
    let prev = hen;
    for (let i = 0; i < 3; i++) {
      const chick = buildChick(i === 1 ? '#ffd43b' : '#ffe066');
      const p = engine.addProp(chick.desc, 2.6 + i * 0.45, -1.2, { followId: prev.id });
      chick.group.position.set(p.x, 0, p.z);
      scene.add(chick.group);
      out.push({ prop: p, group: chick.group, built: chick });
      prev = p;
    }
  }

  // --- mid toys
  put(buildBear(pal.bear), J(-5.6), J(3.4), { yaw: 0.5 });
  put(buildRobot('#9fb4c7', A[1]), J(6.0), J(1.2), { yaw: -0.6 });
  put(buildTrain(A[5], A[2]), J(-6.4), J(0.2), { yaw: 0.25 });
  put(buildDrum(A[3], A[0]), J(5.6), J(3.8));
  put(buildXylophone(A), J(-4.8), J(5.2), { yaw: -0.3 });
  put(buildRockingHorse(A[0], A[4]), J(6.8), J(4.6), { yaw: 2.4 });
  put(buildWagon(A[2]), J(-7.6), J(4.4), { yaw: 1.1 });
  put(buildTricycle(A[1], A[5]), J(0.6), J(5.2), { yaw: -2.0 });

  // --- tea table with tea set on top (park the hole under it → rattle!)
  {
    const t = buildTable(A[4]);
    const tp = put(t, -6.2, -2.6);
    put(buildTeapot(A[0]), -6.5, -2.8, { y: t.topY, supportId: tp.id });
    put(buildCup(A[2]), -5.8, -2.4, { y: t.topY, supportId: tp.id });
    put(buildCup(A[5]), -6.0, -3.1, { y: t.topY, supportId: tp.id });
  }

  // --- bolted wall shelf (fixture): shake it to rain toys down
  {
    const ws = buildWallShelf('#c98d5f');
    const wp = put(ws, 1.2, -6.5);
    put(buildBall(A[2], 0.2), 0.5, -6.45, { y: ws.topY, supportId: wp.id });
    put(buildTeapot(A[3]), 1.3, -6.5, { y: ws.topY, supportId: wp.id });
    put(buildBook(A[5], 0.42), 2.0, -6.42, { y: ws.topY, supportId: wp.id });
    put(buildBall(A[0], 0.16), 1.65, -6.55, { y: ws.topY, supportId: wp.id });
  }

  // --- floor shelf with items
  {
    const s = buildShelf('#c98d5f');
    const sp = put(s, 5.4, -5.4);
    put(buildBook(A[1], 0.5), 5.1, -5.4, { y: s.topY, supportId: sp.id });
    put(buildBook(A[3], 0.44), 5.7, -5.35, { y: s.topY, supportId: sp.id });
    put(buildBall(A[0], 0.2), 5.4, -5.2, { y: s.midY, supportId: sp.id });
  }

  // --- furniture & the rest
  put(buildStool(A[3]), J(-8.4), J(-0.6));
  put(buildLamp('#d7c4ac', A[1]), -9.2, -4.6);
  put(buildChair(A[2]), J(2.6), J(-4.4), { yaw: 0.4 });
  put(buildChair(A[5]), J(-3.4), J(-4.8), { yaw: -0.5 });
  {
    const chest = buildToyChest(A[4], A[0]);   // piñata!
    const chestP = put(chest, 8.6, -1.6, { yaw: -0.2 });
    put(buildBall(A[2], 0.24), 8.5, -1.6, { y: chest.topY, supportId: chestP.id });
  }
  put(buildBathtub(pal.tub), -8.6, 3.2, { yaw: 0.3 });

  // --- bunk bed finale with a teddy sleeping on top
  {
    const bed = buildBunkBed(pal.bed, A[1]);
    const bp = put(bed, 8.2, 4.2, { yaw: Math.PI * 0.97 });
    put(buildBall(A[5], 0.2), 8.0, 4.1, { y: bed.topY, supportId: bp.id });
    put(buildDice(), 8.5, 4.35, { y: bed.topY, supportId: bp.id });
  }

  // --- balloon gifts
  put(buildBalloonGift(A[5], A[0], A[2]), J(-0.8), J(-5.2));
  put(buildBalloonGift(A[1], A[4], A[3]), J(7.4), J(-3.6));

  // --- the puppy, forever poking balls around
  put(buildDog(), J(-4.5), J(-1.5));

  return out;
}

// あそびのへや: the contraption playground — slide, seesaw, cupboard,
// trampoline, marble rail, wardrobe finale, and one very smug cat.
function layoutPlayRoom(scene, engine, paletteIndex, rand) {
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const A = pal.accents;
  const out = [];
  const J = (v) => v + (rand() - 0.5) * 0.5;

  const put = (built, x, z, opt = {}) => {
    const p = engine.addProp(built.desc, x, z, opt);
    built.group.position.set(x, opt.y || 0, z);
    if (opt.yaw) built.group.rotation.y = opt.yaw;
    scene.add(built.group);
    out.push({ prop: p, group: built.group, built });
    return p;
  };

  // --- rug starter toys
  put(buildCrayon(A[0]), J(-1.2), J(1.8), { yaw: 0.6 });
  put(buildCrayon(A[3]), J(0.8), J(2.4), { yaw: -1.2 });
  put(buildBall(A[4], 0.24), J(-2.6), J(0.8));
  put(buildBall(A[1], 0.3), J(2.4), J(0.6));
  put(buildBall(A[5], 0.26), J(0.2), J(3.6));
  put(buildDice(), J(-0.6), J(0.6));
  put(buildDice(), J(1.6), J(1.2));
  put(buildDuck(pal.duck), J(-3.6), J(2.6));
  put(buildMiniCar(A[2]), J(3.8), J(2.2), { yaw: 1.4 });
  put(buildMiniCar(A[0]), J(-4.6), J(0.4), { yaw: -0.4 });

  // --- block tower + book stack
  {
    let below = put(buildBlock(A[2], 'A'), -3.2, 4.2);
    for (let i = 1; i < 4; i++) {
      below = put(buildBlock(A[(i + 2) % A.length], 'ABCD'[i]), -3.2, 4.2, { y: 0.34 * i, supportId: below.id });
    }
    const b1 = put(buildBook(A[1], 0.5), J(4.6), J(-1.8), { yaw: 0.5 });
    put(buildBook(A[5], 0.44), b1.x, b1.z, { y: 0.09, yaw: 0.1, supportId: b1.id });
  }

  // --- THE SLIDE: three riders queued on the platform
  {
    const sl = buildSlide(A[2], A[0]);
    const sp = put(sl, -6.8, -2.8, { yaw: 0.5 });
    const riders = [buildBall(A[0], 0.22), buildDice(), buildBlock(A[4], 'S', 0.3)];
    riders.forEach((r, i) => {
      // queue them across the platform (local -x end), THREE yaw convention
      const lx = -0.95 - i * 0.02, lz = (i - 1) * 0.24;
      const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw);
      const p = put(r, sp.x + c * lx + s * lz, sp.z - s * lx + c * lz, { y: 1.99, supportId: sp.id });
      p._slideQueue = i;
    });
  }

  // --- THE SEESAW: eat the low toy, launch the high one
  {
    const ss = buildSeesaw(A[1], A[3]);
    const sp = put(ss, 4.8, 4.0, { yaw: -0.5 });
    // plank ends in THREE yaw convention: local ±X → (±c, ∓s)
    const c = Math.cos(sp.yaw), s = Math.sin(sp.yaw);
    // low end (local -x) rests on the floor with a drum on it
    const low = put(buildDrum(A[3], A[0]), sp.x - c * 1.1, sp.z + s * 1.1);
    const high = put(buildBall(A[5], 0.26), sp.x + c * 1.1, sp.z - s * 1.1, { y: 0.82, supportId: sp.id });
    sp.desc.device.lowerId = low.id;
    sp.desc.device.upperId = high.id;
    sp.desc.device.launchDir = 1;
  }

  // --- THE CUPBOARD: sealed treasure until the hole rattles it
  {
    const cb = buildCupboard('#c98d5f', A[4]);
    const cp = put(cb, 8.9, -3.6, { yaw: -Math.PI / 2 });
    const treats = [
      buildBall(A[0], 0.18), buildBall(A[2], 0.16), buildCup(A[5]),
      buildBook(A[3], 0.4), buildTeapot(A[1]), buildDice(),
    ];
    treats.forEach((t, i) => {
      put(t, cp.x, cp.z + (i % 3 - 1) * 0.3, { y: i < 3 ? 0.28 : 0.9, supportId: cp.id });
    });
  }

  // --- THE TRAMPOLINE: two balls that never stop bouncing
  {
    const tr = buildTrampoline(A[0], A[2]);
    put(tr, -2.2, 4.6);
    const b1 = buildBall(A[3], 0.2);
    const p1 = put(b1, -2.4, 4.5, { y: 1.6, state: 'tossed', vx: 0, vy: 2, vz: 0 });
    p1.bounces = 0;
    const b2 = buildBall(A[1], 0.24);
    const p2 = put(b2, -2.0, 4.8, { y: 2.4, state: 'tossed', vx: 0, vy: 0.5, vz: 0 });
    p2.bounces = 0;
  }

  // --- THE MARBLE RAIL along the back wall (feed it with the rocket!)
  {
    const rl = buildRail('#8895a5', { x: -4.6, z: -6.3 }, { x: 4.6, z: -6.3 }, 2.7);
    const p = engine.addProp(rl.desc, rl.pos.x, rl.pos.z);
    scene.add(rl.group);
    out.push({ prop: p, group: rl.group, built: rl });
  }

  // --- furniture & friends
  {
    const t = buildTable(A[4]);
    const tp = put(t, -7.6, 3.6);
    put(buildCup(A[2]), -7.4, 3.5, { y: t.topY, supportId: tp.id });
    put(buildTeapot(A[0]), -7.9, 3.8, { y: t.topY, supportId: tp.id });
  }
  put(buildChair(A[5]), J(-5.4), J(-4.8), { yaw: 0.7 });
  put(buildStool(A[3]), J(2.2), J(-4.6));
  put(buildLamp('#d7c4ac', A[0]), 9.0, 1.8);
  put(buildXylophone(A), J(6.4), J(1.2), { yaw: 0.9 });
  put(buildRockingHorse(A[0], A[4]), J(-8.3), J(0.2), { yaw: 1.1 });
  put(buildWagon(A[2]), J(6.8), J(-5.2), { yaw: -0.9 });
  put(buildRobot('#9fb4c7', A[1]), J(-6.2), J(5.4), { yaw: 0.4 });
  put(buildTrain(A[5], A[2]), J(1.2), J(-2.6), { yaw: -0.3 });

  // --- wardrobe finale + balloons + the cat
  put(buildWardrobe(pal.bed, A[1]), 8.4, 4.6, { yaw: Math.PI });
  put(buildBalloonGift(A[2], A[0], A[5]), J(-0.6), J(-5.4));
  put(buildBalloonGift(A[4], A[3], A[1]), J(6.2), J(3.0));
  put(buildCat(), J(0.5), J(-0.8));

  return out;
}
