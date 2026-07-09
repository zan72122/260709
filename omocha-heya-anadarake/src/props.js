// Procedural low-poly toys & furniture. Every builder returns a THREE.Group
// whose origin is the bottom-centre of the object, plus a physics descriptor
// (makeDesc) whose extents match the visual. No external assets.

import * as THREE from '../vendor/three.module.min.js';
import { makeDesc } from './physics.js';

// ---------------------------------------------------------------- palettes
export const PALETTES = [
  { // round 0: ひだまりのへや (warm daylight)
    name: 'hidamari',
    wall: '#ffe9c9', wallLow: '#ffd9a6', floorA: '#e8b57c', floorB: '#dfa768',
    rug: '#8fd0c5', rugRim: '#63b3a6', sky: '#aee3ff',
    accents: ['#ff8fa3', '#ffd166', '#6cc5ff', '#8ce99a', '#c9a8ff', '#ffa94d'],
    bear: '#c98d5f', duck: '#ffd43b', bed: '#74c0fc', tub: '#f3fbff',
  },
  { // round 1: ゆうやけのへや (sunset)
    name: 'yuuyake',
    wall: '#ffd2b3', wallLow: '#ffb98f', floorA: '#d99a68', floorB: '#cc8b58',
    rug: '#f7b1c8', rugRim: '#e58cae', sky: '#ffbf8a',
    accents: ['#ff922b', '#f783ac', '#9775fa', '#ffd43b', '#63e6be', '#ff6b6b'],
    bear: '#a97142', duck: '#ffa94d', bed: '#f783ac', tub: '#fff4ec',
  },
  { // round 2: よぞらのへや (starry night)
    name: 'yozora',
    wall: '#b9c6ff', wallLow: '#9aa8f0', floorA: '#8d7bc4', floorB: '#7d6bb4',
    rug: '#ffd43b', rugRim: '#f0b429', sky: '#3f4c9e',
    accents: ['#74c0fc', '#f783ac', '#ffe066', '#63e6be', '#b197fc', '#ffa8a8'],
    bear: '#8d6e63', duck: '#fff59d', bed: '#b197fc', tub: '#eef2ff',
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
  m.receiveShadow = false;
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

// simple googly eyes: white disc + black pupil, always cheap
function eyes(group, spacing, y, z, size = 0.05) {
  for (const s of [-1, 1]) {
    add(group, G('sph', size, 8, 6), mat('#ffffff'), s * spacing, y, z);
    add(group, G('sph', size * 0.55, 8, 6), mat('#332222'), s * spacing, y, z + size * 0.6);
  }
}

// ---------------------------------------------------------------- builders
// Each returns { group, desc }.

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
  const body = add(g, G('cyl', r, r, len, 10), mat(color), 0, r, 0, 0, 0, Math.PI / 2);
  body.scale.set(1, 1, 1);
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
  eyes(g, 0.07, 0.56, 0.12, 0.035);
  const wing = add(g, G('sph', 0.12, 10, 8), mat(color), -0.05, 0.28, 0.2);
  wing.scale.set(1.4, 0.7, 0.5);
  const wing2 = add(g, G('sph', 0.12, 10, 8), mat(color), -0.05, 0.28, -0.2);
  wing2.scale.set(1.4, 0.7, 0.5);
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
  const bl = add(g, G('sph', 0.18, 12, 10), belly, 0, 0.36, 0.16); bl.scale.set(1, 1.25, 0.7);
  add(g, G('sph', 0.22, 16, 12), mat(color), 0, 0.78, 0);
  add(g, G('sph', 0.12, 10, 8), belly, 0, 0.72, 0.16).scale.set(1, 0.8, 0.6);
  add(g, G('sph', 0.08, 10, 8), mat(color), -0.16, 0.94, 0);
  add(g, G('sph', 0.08, 10, 8), mat(color), 0.16, 0.94, 0);
  add(g, G('sph', 0.04, 8, 6), mat('#5b4032'), 0, 0.77, 0.26);
  eyes(g, 0.09, 0.84, 0.18, 0.032);
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
  // big front wheel
  const fw = add(g, G('cyl', 0.3, 0.3, 0.09, 16), wheelM, 0.45, 0.3, 0, Math.PI / 2, 0, 0);
  add(g, G('cyl', 0.08, 0.08, 0.1, 8), hubM, 0.45, 0.3, 0, Math.PI / 2, 0, 0);
  // rear wheels
  for (const s of [-1, 1]) {
    add(g, G('cyl', 0.18, 0.18, 0.07, 14), wheelM, -0.4, 0.18, s * 0.3, Math.PI / 2, 0, 0);
    add(g, G('cyl', 0.05, 0.05, 0.08, 8), hubM, -0.4, 0.18, s * 0.3, Math.PI / 2, 0, 0);
  }
  // frame
  add(g, G('cyl', 0.045, 0.045, 0.75, 8), mat(color), 0.05, 0.42, 0, 0, 0, Math.PI / 2 - 0.35);
  add(g, G('cyl', 0.045, 0.045, 0.5, 8), mat(color), 0.45, 0.62, 0, 0, 0, 0.15);
  // handlebar
  add(g, G('cyl', 0.035, 0.035, 0.5, 8), mat(accent), 0.52, 0.88, 0, Math.PI / 2, 0, 0);
  add(g, G('sph', 0.05, 8, 6), mat(accent), 0.52, 0.88, 0.25);
  add(g, G('sph', 0.05, 8, 6), mat(accent), 0.52, 0.88, -0.25);
  // seat
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
  const n = 6;
  for (let i = 0; i < n; i++) {
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
  // rockers
  for (const s of [-1, 1]) {
    const r = add(g, G('tor', 0.55, 0.045, 8, 20, Math.PI * 0.85), mat(accent), 0, 0.58, s * 0.16, 0, 0, Math.PI + Math.PI * 0.075);
    r.scale.set(1, 0.9, 1);
  }
  add(g, G('box', 0.62, 0.3, 0.3), mat(color), 0, 0.62, 0);
  const head = add(g, G('box', 0.2, 0.34, 0.18), mat(color), 0.32, 0.9, 0, 0, 0, -0.2);
  add(g, G('box', 0.2, 0.12, 0.14), mat(color), 0.44, 1.0, 0, 0, 0, -0.2);
  add(g, G('cone', 0.05, 0.12, 6), mat(accent), 0.3, 1.12, 0.03, 0, 0, -0.2);
  eyes(g, 0.0, 1.02, 0.1, 0.028);
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
  return { group: g, desc: makeDesc('stool', 0.62, 0.55, 0.62, { round: true, name: 'stool' }) };
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
  return { group: g, desc: makeDesc('table', 1.74, 1.06, 1.74, { round: true, name: 'table' }), topY: 1.05 };
}

export function buildToyChest(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 1.15, 0.6, 0.68), mat(color), 0, 0.3, 0);
  const lid = add(g, G('cyl', 0.34, 0.34, 1.15, 14, 1, false, Math.PI, Math.PI), mat(accent), 0, 0.6, 0, 0, 0, Math.PI / 2);
  lid.scale.set(1, 1, 0.68 / 0.68);
  add(g, G('box', 0.16, 0.14, 0.03), mat('#ffe066'), 0, 0.42, 0.35);
  return { group: g, desc: makeDesc('toychest', 1.15, 0.95, 0.68, { name: 'toy chest' }), topY: 0.94 };
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
  return { group: g, desc: makeDesc('shelf', 1.4, 1.5, 0.52, { name: 'shelf' }), topY: 1.5, midY: 0.76 };
}

export function buildBed(color, accent) {
  const g = new THREE.Group();
  add(g, G('box', 2.3, 0.28, 1.3), mat('#c9a077'), 0, 0.3, 0);
  add(g, G('box', 2.3, 0.6, 0.12), mat('#c9a077'), 0, 0.5, -0.6);
  add(g, G('box', 2.3, 0.4, 0.12), mat('#c9a077'), 0, 0.4, 0.6);
  add(g, G('box', 2.2, 0.22, 1.16), mat('#ffffff'), 0, 0.5, 0);
  add(g, G('box', 1.5, 0.18, 1.18), mat(color), -0.3, 0.56, 0);
  add(g, G('box', 0.55, 0.16, 0.8), mat(accent), 0.75, 0.66, 0, 0, 0, 0.06);
  for (const sx of [-1.05, 1.05]) for (const sz of [-0.55, 0.55]) {
    add(g, G('box', 0.12, 0.3, 0.12), mat('#b98a5e'), sx, 0.15, sz);
  }
  return { group: g, desc: makeDesc('bed', 2.3, 1.0, 1.3, { name: 'bed' }), topY: 0.62 };
}

export function buildBathtub(color) {
  const g = new THREE.Group();
  const tub = add(g, G('cyl', 0.62, 0.5, 0.55, 18), mat(color), 0, 0.35, 0);
  tub.scale.set(1.35, 1, 1);
  const inner = add(g, G('cyl', 0.54, 0.46, 0.5, 18), mat('#bfe7f2'), 0, 0.4, 0);
  inner.scale.set(1.3, 1, 0.92);
  // water surface (removed visually when swallowed)
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
  // little foam bubbles
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
  // string + balloon (removable on pop)
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

// ------------------------------------------------------------- room layout
// One big sandbox. Placement tuned so early play (small hole) happens on the
// rug and difficulty spreads outward. Returns [{prop, group, ...}].
export function buildRound(scene, engine, paletteIndex, rand) {
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const A = pal.accents;
  const out = [];
  const J = (v) => v + (rand() - 0.5) * 0.5;   // slight per-round jitter

  const put = (built, x, z, opt = {}) => {
    const p = engine.addProp(built.desc, x, z, opt);
    built.group.position.set(x, opt.y || 0, z);
    if (opt.yaw) built.group.rotation.y = opt.yaw;
    scene.add(built.group);
    out.push({ prop: p, group: built.group, built });
    return p;
  };

  // --- rug zone (centre): small starter toys
  put(buildCrayon(A[0]), J(-1.6), J(1.6), { yaw: 0.4 });
  put(buildCrayon(A[1]), J(-0.6), J(2.3), { yaw: -0.9 });
  put(buildCrayon(A[2]), J(0.9), J(1.8), { yaw: 1.8 });
  put(buildCrayon(A[3]), J(1.8), J(2.6), { yaw: 2.6 });
  put(buildBall(A[4], 0.22), J(-2.4), J(0.6));
  put(buildBall(A[5], 0.28), J(2.2), J(0.4));
  put(buildBall(A[0], 0.34), J(0.4), J(3.4));
  put(buildDice(), J(-1.0), J(0.4));
  put(buildDice(), J(1.2), J(0.9));
  put(buildDuck(pal.duck), J(-3.2), J(2.4));
  put(buildBoat(A[2]), J(-4.2), J(1.0), { yaw: 0.7 });
  put(buildMiniCar(A[1]), J(3.4), J(1.6), { yaw: -0.5 });
  put(buildMiniCar(A[3]), J(4.2), J(2.8), { yaw: 2.2 });

  // --- block tower (stack: base + two on top)
  {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const bx = J(-2.2), bz = J(3.6);
    const b1 = put(buildBlock(A[0], letters[0]), bx, bz);
    const b2 = put(buildBlock(A[2], letters[1]), bx, bz, { y: 0.34, supportId: b1.id });
    put(buildBlock(A[4], letters[2]), bx, bz, { y: 0.68, supportId: b2.id });
    put(buildBlock(A[1], letters[3]), J(3.0), J(3.8));
    const b5 = put(buildBlock(A[3], letters[4]), J(4.6), J(0.6));
    put(buildBlock(A[5], letters[5]), b5.x, b5.z, { y: 0.34, supportId: b5.id });
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

  // --- tea table with tea set on top
  {
    const t = buildTable(A[4]);
    const tp = put(t, -6.2, -2.6);
    put(buildTeapot(A[0]), -6.5, -2.8, { y: t.topY, supportId: tp.id });
    put(buildCup(A[2]), -5.8, -2.4, { y: t.topY, supportId: tp.id });
    put(buildCup(A[5]), -6.0, -3.1, { y: t.topY, supportId: tp.id });
  }

  // --- bookshelf against the back wall, books on top + inside
  {
    const s = buildShelf('#c98d5f');
    const sp = put(s, 5.4, -5.4);
    put(buildBook(A[1], 0.5), 5.1, -5.4, { y: s.topY, supportId: sp.id });
    put(buildBook(A[3], 0.44), 5.7, -5.35, { y: s.topY + 0.0, supportId: sp.id });
    put(buildBall(A[0], 0.2), 5.4, -5.2, { y: s.midY, supportId: sp.id });
    put(buildBook(A[5], 0.48), 5.35, -5.5, { y: s.midY, supportId: sp.id });
  }

  // --- stool + lamp, chair, chest, books on floor
  put(buildStool(A[3]), J(-8.4), J(-0.6));
  put(buildLamp('#d7c4ac', A[1]), -9.2, -4.6);
  put(buildChair(A[2]), J(2.6), J(-4.4), { yaw: 0.4 });
  put(buildChair(A[5]), J(-3.4), J(-4.8), { yaw: -0.5 });
  const chest = buildToyChest(A[4], A[0]);
  const chestP = put(chest, 8.6, -1.6, { yaw: -0.2 });
  put(buildBall(A[2], 0.24), 8.5, -1.6, { y: chest.topY, supportId: chestP.id });
  put(buildBook(A[0], 0.52), J(0.2), J(-2.6), { yaw: 1.2 });
  put(buildBook(A[4], 0.46), J(0.9), J(-2.2), { yaw: 0.4 });

  // --- bath corner + big furniture
  put(buildBathtub(pal.tub), -8.6, 3.2, { yaw: 0.3 });
  put(buildBed(pal.bed, A[1]), 8.2, 4.2, { yaw: Math.PI * 0.97 });

  // --- balloon gifts (need the launcher to pop)
  put(buildBalloonGift(A[5], A[0], A[2]), J(-0.8), J(-5.2));
  put(buildBalloonGift(A[1], A[4], A[3]), J(7.4), J(-3.6));

  return out;
}
