// スイーツ工場 — every sweet is built from primitives + canvas textures.
// Each factory returns a THREE.Group whose origin sits at the *bottom centre*
// of the sweet; metadata (h = stack height, r = support radius) rides along.

import * as THREE from '../vendor/three.module.min.js';

// ---------------------------------------------------------------- helpers

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.62, metalness: 0.0, ...opts.extra,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0.35,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
}

function add(group, geo, material, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.sx || opts.sy || opts.sz) m.scale.set(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// kawaii sleepy-smile face, drawn once, reused as a decal plane
let _faceTex = null;
function faceTexture() {
  if (_faceTex) return _faceTex;
  _faceTex = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = '#6b4a2f';
    g.fillStyle = '#6b4a2f';
    g.lineWidth = 6;
    g.lineCap = 'round';
    // eyes
    g.beginPath(); g.arc(s * 0.30, s * 0.42, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(s * 0.70, s * 0.42, 7, 0, Math.PI * 2); g.fill();
    // smile
    g.beginPath(); g.arc(s * 0.5, s * 0.52, s * 0.13, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
    // cheeks
    g.fillStyle = 'rgba(255,150,160,0.75)';
    g.beginPath(); g.arc(s * 0.16, s * 0.58, 11, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(s * 0.84, s * 0.58, 11, 0, Math.PI * 2); g.fill();
  });
  return _faceTex;
}

function addFace(group, y, dist, scale = 0.4) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(scale, scale),
    new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false })
  );
  m.position.set(0, y, dist);
  group.add(m);
  return m;
}

const PASTELS = [0xffb3c8, 0xbfe6b2, 0xfff2a8, 0xc4d9ff, 0xe6c9f2, 0xffd9ad];
function pastel(rng) { return PASTELS[Math.floor(rng() * PASTELS.length)]; }

// ---------------------------------------------------------------- textures

let _waffleTex = null;
function waffleTexture() {
  if (_waffleTex) return _waffleTex;
  _waffleTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#e8a34f';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#c97f2e';
    const n = 6, cell = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        g.fillRect(i * cell + 6, j * cell + 6, cell - 12, cell - 12);
    g.fillStyle = 'rgba(255,220,150,0.35)';
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        g.fillRect(i * cell + 6, j * cell + 6, cell - 12, 6);
  });
  return _waffleTex;
}

let _swirlTex = null;
function swirlTexture() {
  if (_swirlTex) return _swirlTex;
  _swirlTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#fff6f0';
    g.fillRect(0, 0, s, s);
    const cols = ['#ff5f8f', '#ffb13d', '#3dc46e', '#3f8fff', '#a45fff'];
    g.translate(s / 2, s / 2);
    g.lineCap = 'round';
    for (let a = 0; a < 5; a++) {
      g.strokeStyle = cols[a % cols.length];
      g.lineWidth = 14;
      g.beginPath();
      for (let t = 0; t < Math.PI * 6; t += 0.08) {
        const r = 4 + t * 6.4;
        const x = Math.cos(t + a * (Math.PI * 2 / 5)) * r;
        const y = Math.sin(t + a * (Math.PI * 2 / 5)) * r;
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  return _swirlTex;
}

let _stripeTex = null;
function cakeStripeTexture() {
  if (_stripeTex) return _stripeTex;
  _stripeTex = canvasTex(128, (g, s) => {
    g.fillStyle = '#fffdf7'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#ffd1de'; g.fillRect(0, s * 0.42, s, s * 0.2);
    g.fillStyle = '#f7e9b8'; g.fillRect(0, s * 0.72, s, s * 0.12);
  });
  return _stripeTex;
}

// small strawberry used by several sweets
function strawberry(scale = 1) {
  const g = new THREE.Group();
  const body = add(g, new THREE.SphereGeometry(0.16 * scale, 14, 12),
    mat(0xff4d6b, { rough: 0.35 }));
  body.scale.y = 1.25;
  body.position.y = 0.18 * scale;
  add(g, new THREE.ConeGeometry(0.07 * scale, 0.09 * scale, 8),
    mat(0x4fae52), 0, 0.4 * scale, 0);
  return g;
}

// ---------------------------------------------------------------- sweets

function makePancake(rng, big = false) {
  const g = new THREE.Group();
  const R = big ? 1.55 : 1.0, H = big ? 0.5 : 0.38;
  const dough = mat(0xf0b05e, { rough: 0.7 });
  const doughTop = mat(0xd98e3a, { rough: 0.7 });
  add(g, new THREE.CylinderGeometry(R, R * 0.96, H * 0.55, 28), dough, 0, H * 0.27, 0);
  add(g, new THREE.CylinderGeometry(R * 0.97, R, H * 0.45, 28), doughTop, 0, H * 0.77, 0);
  // butter + syrup
  add(g, new THREE.BoxGeometry(0.26 * (big ? 1.5 : 1), 0.12, 0.26 * (big ? 1.5 : 1)),
    mat(0xfff1a3, { rough: 0.3 }), 0, H + 0.06, 0);
  const syr = add(g, new THREE.CylinderGeometry(R * 0.6, R * 0.62, 0.05, 20),
    mat(0xd97b16, { rough: 0.15, emissive: 0x552800 }), 0, H + 0.012, 0);
  syr.receiveShadow = false;
  if (big) addFace(g, H * 0.5, R * 0.99, 0.6);
  return { group: g, h: H, r: R * 0.94 };
}

function makeShortcake() {
  const g = new THREE.Group();
  const R = 0.92, H = 0.72;
  add(g, new THREE.CylinderGeometry(R, R, H * 0.8, 28),
    mat(0xffffff, { map: cakeStripeTexture(), rough: 0.55 }), 0, H * 0.4, 0);
  add(g, new THREE.CylinderGeometry(R * 1.01, R * 1.01, H * 0.16, 28),
    mat(0xfffdf7, { rough: 0.45 }), 0, H * 0.86, 0);
  // whipped blobs + strawberries around the top
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.13, 12, 10), mat(0xfffef9, { rough: 0.4 }),
      Math.cos(a) * R * 0.66, H * 0.96, Math.sin(a) * R * 0.66);
    if (i % 2 === 0) {
      const s = strawberry(0.9);
      s.position.set(Math.cos(a) * R * 0.66, H * 0.96, Math.sin(a) * R * 0.66);
      g.add(s);
    }
  }
  const c = strawberry(1.15); c.position.y = H * 0.94; g.add(c);
  return { group: g, h: H + 0.02, r: R * 0.95 };
}

function makePudding() {
  const g = new THREE.Group();
  const H = 0.62;
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.78 - t * 0.24 + Math.sin(t * Math.PI) * 0.03, t * H));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), mat(0xf7c451, { rough: 0.4 }));
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  add(g, new THREE.CylinderGeometry(0.42, 0.55, 0.1, 22),
    mat(0x8a4a12, { rough: 0.25, emissive: 0x30150 }), 0, H - 0.02, 0);
  // caramel drips
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    add(g, new THREE.SphereGeometry(0.07, 8, 8), mat(0x8a4a12, { rough: 0.25 }),
      Math.cos(a) * 0.5, H - 0.12, Math.sin(a) * 0.5, { sy: 1.8 });
  }
  add(g, new THREE.SphereGeometry(0.09, 10, 8), mat(0xff5f7a, { rough: 0.35 }), 0, H + 0.05, 0);
  addFace(g, H * 0.42, 0.7, 0.42);
  return { group: g, h: H + 0.02, r: 0.74 };
}

function makeMacaron(rng) {
  const g = new THREE.Group();
  const col = pastel(rng);
  const H = 0.42, R = 0.72;
  const shell = mat(col, { rough: 0.55 });
  const top = add(g, new THREE.SphereGeometry(R, 22, 14), shell, 0, H * 0.62, 0, { sy: 0.42 });
  top.geometry = top.geometry; // shells are squashed spheres
  add(g, new THREE.SphereGeometry(R, 22, 14), shell, 0, H * 0.32, 0, { sy: 0.42 });
  add(g, new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.1, 22),
    mat(0xfff8ee, { rough: 0.5 }), 0, H * 0.47, 0);
  addFace(g, H * 0.62, R * 0.86, 0.36);
  return { group: g, h: H, r: R * 0.95 };
}

function makeDonut(rng) {
  const g = new THREE.Group();
  const icingCol = pastel(rng);
  const R = 0.6, tube = 0.26;
  add(g, new THREE.TorusGeometry(R, tube, 14, 28), mat(0xdf9f57, { rough: 0.7 }),
    0, tube, 0, { rx: -Math.PI / 2 });
  const icing = add(g, new THREE.TorusGeometry(R, tube * 0.88, 14, 28),
    mat(icingCol, { rough: 0.35 }), 0, tube * 1.22, 0, { rx: -Math.PI / 2 });
  icing.scale.set(1, 1, 0.6); // flatten icing on top (local z after rotation = world y)
  // sprinkles
  const sg = new THREE.BoxGeometry(0.05, 0.016, 0.016);
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const rr = R + (rng() - 0.5) * tube * 1.1;
    add(g, sg, mat(PASTELS[i % PASTELS.length], { rough: 0.3 }),
      Math.cos(a) * rr, tube * 1.95 + (rng() - 0.5) * 0.03, Math.sin(a) * rr,
      { ry: rng() * Math.PI, rz: (rng() - 0.5) });
  }
  return { group: g, h: tube * 1.9, r: (R + tube) * 0.92 };
}

function makeDango() {
  const g = new THREE.Group();
  const cols = [0xffc2d1, 0xfffaf0, 0xa8d8a0];
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8),
    mat(0xd9b38c, { rough: 0.8 }), 0, 0.26, 0, { rz: Math.PI / 2 });
  for (let i = 0; i < 3; i++)
    add(g, new THREE.SphereGeometry(0.26, 18, 14), mat(cols[i], { rough: 0.5 }),
      (i - 1) * 0.5, 0.26, 0);
  return { group: g, h: 0.52, r: 0.72 };
}

function makeIcecream(rng) {
  const g = new THREE.Group();
  const H = 0.46;
  // waffle cup
  const pts = [new THREE.Vector2(0.3, 0), new THREE.Vector2(0.52, H), new THREE.Vector2(0.44, H)];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 22),
    mat(0xe0a35c, { map: waffleTexture(), rough: 0.75, extra: { side: THREE.DoubleSide } }));
  cup.castShadow = cup.receiveShadow = true;
  g.add(cup);
  const scoopCol = pastel(rng);
  add(g, new THREE.SphereGeometry(0.44, 20, 16), mat(scoopCol, { rough: 0.5 }), 0, H + 0.2, 0);
  add(g, new THREE.SphereGeometry(0.3, 16, 12), mat(0xfffef8, { rough: 0.5 }), 0, H + 0.52, 0);
  add(g, new THREE.SphereGeometry(0.09, 10, 8), mat(0xd63b52, { rough: 0.3 }), 0, H + 0.82, 0);
  return { group: g, h: H + 0.68, r: 0.62 };
}

function makeCupcake(rng) {
  const g = new THREE.Group();
  const H = 0.4;
  // pleated paper cup
  const paper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.36, H, 24, 1),
    mat(0xff9db8, { rough: 0.65, extra: { flatShading: true } })
  );
  paper.position.y = H / 2;
  paper.castShadow = paper.receiveShadow = true;
  g.add(paper);
  // frosting swirl
  const fc = pastel(rng);
  let y = H, r = 0.48;
  while (r > 0.12) {
    add(g, new THREE.TorusGeometry(r, 0.12, 10, 20), mat(fc, { rough: 0.45 }),
      0, y, 0, { rx: -Math.PI / 2 });
    y += 0.14; r -= 0.13;
  }
  add(g, new THREE.SphereGeometry(0.1, 10, 8), mat(0xd63b52, { rough: 0.3 }), 0, y + 0.05, 0);
  return { group: g, h: y + 0.02, r: 0.6 };
}

function makeWaffle() {
  const g = new THREE.Group();
  const S = 1.3, H = 0.26;
  const box = add(g, new THREE.BoxGeometry(S, H, S),
    mat(0xe8a34f, { map: waffleTexture(), rough: 0.75 }), 0, H / 2, 0);
  box.rotation.y = Math.PI / 7;
  add(g, new THREE.SphereGeometry(0.14, 12, 10), mat(0xfffef9, { rough: 0.4 }), 0.2, H + 0.08, 0.1);
  const s = strawberry(0.9); s.position.set(-0.2, H, -0.1); g.add(s);
  return { group: g, h: H + 0.02, r: 0.78 };
}

function makeChoco() {
  const g = new THREE.Group();
  const H = 0.3;
  add(g, new THREE.BoxGeometry(1.2, H * 0.6, 0.85), mat(0x6f4021, { rough: 0.35 }), 0, H * 0.3, 0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      add(g, new THREE.BoxGeometry(0.32, H * 0.5, 0.34), mat(0x815031, { rough: 0.3 }),
        (i - 1) * 0.37, H * 0.62, (j - 0.5) * 0.4);
  return { group: g, h: H, r: 0.72 };
}

function makeMochi() {
  const g = new THREE.Group();
  const H = 0.46;
  const body = add(g, new THREE.SphereGeometry(0.55, 22, 16), mat(0xfffbf2, { rough: 0.75 }),
    0, H * 0.52, 0, { sy: 0.78 });
  body.scale.x = 1.05;
  add(g, new THREE.SphereGeometry(0.16, 12, 10), mat(0xff5f7a, { rough: 0.35 }), 0, H * 0.95, 0);
  addFace(g, H * 0.5, 0.52, 0.4);
  return { group: g, h: H, r: 0.62 };
}

function makeCookie(rng) {
  const g = new THREE.Group();
  const H = 0.2, R = 0.8;
  add(g, new THREE.CylinderGeometry(R, R * 0.94, H, 24), mat(0xcf8f4a, { rough: 0.8 }), 0, H / 2, 0);
  for (let i = 0; i < 8; i++) {
    const a = rng() * Math.PI * 2, rr = rng() * R * 0.72;
    add(g, new THREE.SphereGeometry(0.06, 8, 6), mat(0x5a3417, { rough: 0.4 }),
      Math.cos(a) * rr, H + 0.01, Math.sin(a) * rr);
  }
  return { group: g, h: H, r: R * 0.95 };
}

function makeHoneypot() {
  const g = new THREE.Group();
  const H = 0.62;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.36 + Math.sin(t * Math.PI) * 0.3, t * H));
  }
  const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 24),
    mat(0xf2b64e, { rough: 0.4, emissive: 0x4a2c00 }));
  pot.castShadow = pot.receiveShadow = true;
  g.add(pot);
  add(g, new THREE.TorusGeometry(0.34, 0.07, 10, 20), mat(0xd99a2b, { rough: 0.4 }),
    0, H, 0, { rx: -Math.PI / 2 });
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 18),
    mat(0xffdf7e, { rough: 0.15, emissive: 0x6a4300 }), 0, H, 0);
  // little label
  const label = add(g, new THREE.BoxGeometry(0.34, 0.22, 0.02), mat(0xfff6dd, { rough: 0.6 }),
    0, H * 0.5, 0.63);
  label.rotation.x = -0.1;
  addFace(g, H * 0.52, 0.655, 0.24);
  return { group: g, h: H, r: 0.66 };
}

function makeRainbowCandy() {
  const g = new THREE.Group();
  const H = 0.24, R = 0.8;
  add(g, new THREE.CylinderGeometry(R, R, H, 28),
    mat(0xffffff, { map: swirlTexture(), rough: 0.25, emissive: 0x222222, emissiveIntensity: 0.15 }),
    0, H / 2, 0);
  // twisted wrapper ends
  for (const s of [-1, 1])
    add(g, new THREE.ConeGeometry(0.14, 0.3, 10), mat(0xcfefff, { rough: 0.2, opacity: 0.85, transparent: true }),
      s * (R + 0.14), H / 2, 0, { rz: s * -Math.PI / 2 });
  return { group: g, h: H, r: R * 0.95 };
}

// ---------------------------------------------------------------- registry

export const SWEETS = [
  { id: 'pancake', name: 'ホットケーキ', emoji: '🥞', make: (rng) => makePancake(rng), w: 3 },
  { id: 'shortcake', name: 'ショートケーキ', emoji: '🍰', make: () => makeShortcake(), w: 2 },
  { id: 'pudding', name: 'プリン', emoji: '🍮', make: () => makePudding(), w: 2.5 },
  { id: 'macaron', name: 'マカロン', emoji: '🍥', make: (rng) => makeMacaron(rng), w: 3 },
  { id: 'donut', name: 'ドーナツ', emoji: '🍩', make: (rng) => makeDonut(rng), w: 3 },
  { id: 'dango', name: 'おだんご', emoji: '🍡', make: () => makeDango(), w: 2 },
  { id: 'icecream', name: 'アイスクリーム', emoji: '🍦', make: (rng) => makeIcecream(rng), w: 2 },
  { id: 'cupcake', name: 'カップケーキ', emoji: '🧁', make: (rng) => makeCupcake(rng), w: 2 },
  { id: 'waffle', name: 'ワッフル', emoji: '🧇', make: () => makeWaffle(), w: 2 },
  { id: 'choco', name: 'チョコレート', emoji: '🍫', make: () => makeChoco(), w: 2 },
  { id: 'mochi', name: 'いちごだいふく', emoji: '🍓', make: () => makeMochi(), w: 2 },
  { id: 'cookie', name: 'クッキー', emoji: '🍪', make: (rng) => makeCookie(rng), w: 2.5 },
];

export const SPECIALS = {
  honeypot: { id: 'honeypot', name: 'はちみつポット', emoji: '🍯', make: () => makeHoneypot() },
  rainbow: { id: 'rainbow', name: 'にじいろキャンディ', emoji: '🍬', make: () => makeRainbowCandy() },
  giant: { id: 'giant', name: 'おおきなホットケーキ', emoji: '🥞', make: (rng) => makePancake(rng, true) },
};

export const ALL_SWEET_IDS = [...SWEETS.map(s => s.id), 'honeypot', 'rainbow', 'giant'];

export function sweetInfo(id) {
  return SWEETS.find(s => s.id === id) || SPECIALS[id];
}

/** weighted random pick, avoiding immediate repeats */
export function pickSweet(rng, lastId) {
  const pool = SWEETS.filter(s => s.id !== lastId);
  const total = pool.reduce((a, s) => a + s.w, 0);
  let roll = rng() * total;
  for (const s of pool) {
    roll -= s.w;
    if (roll <= 0) return s;
  }
  return pool[pool.length - 1];
}

/** build a sweet instance: { group, h, r, id, name, emoji } */
export function buildSweet(entry, rng) {
  const built = entry.make(rng || Math.random);
  built.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return { ...built, id: entry.id, name: entry.name, emoji: entry.emoji };
}
