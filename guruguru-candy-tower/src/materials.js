// materials.js — お菓子素材のプロシージャル生成(外部アセットなし)
import * as THREE from '../vendor/three.module.min.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(size, draw, { repeat = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

// ビスケット地: 温かい小麦色+焼き目の斑点
function biscuitTex(seed = 5, base = '#e0b070', dark = '#c08a4a') {
  const rnd = mulberry32(seed);
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * s, y = rnd() * s, r = 0.6 + rnd() * 2.2;
      ctx.fillStyle = rnd() > 0.5 ? `rgba(150,95,45,${0.05 + rnd() * 0.12})` : `rgba(255,235,190,${0.05 + rnd() * 0.1})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // 焼き色のムラ
    for (let i = 0; i < 12; i++) {
      const x = rnd() * s, y = rnd() * s, r = 20 + rnd() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(170,110,55,${0.05 + rnd() * 0.08})`);
      g.addColorStop(1, 'rgba(170,110,55,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = dark; ctx.globalAlpha = 0.0; ctx.globalAlpha = 1;
  });
}

// スポンジ生地
function spongeTex(seed = 9) {
  const rnd = mulberry32(seed);
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#f3d98d';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * s, y = rnd() * s, r = 0.5 + rnd() * 1.8;
      ctx.fillStyle = `rgba(210,165,80,${0.06 + rnd() * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// ストライプ飴(斜めしましま)
function stripeTex(colA, colB, stripes = 8) {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = colA;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = colB;
    const w = s / stripes;
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    for (let i = -stripes; i < stripes; i += 2) {
      ctx.fillRect(i * w, -s, w, s * 2);
    }
    ctx.restore();
  });
}

// ロリポップ渦巻き
export function lollipopTex(colA = '#ff6f9c', colB = '#fff4ec') {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = colB;
    ctx.fillRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    ctx.fillStyle = colA;
    const turns = 3.2;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.004) {
        const a = t * turns * Math.PI * 2 + arm * Math.PI;
        const r = t * s * 0.5;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let t = 1; t >= 0; t -= 0.004) {
        const a = t * turns * Math.PI * 2 + arm * Math.PI + 0.5 * (1 - t * 0.4);
        const r = t * s * 0.5;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
}

// ギンガムチェック(テーブルクロス)
function ginghamTex(col = '#ff9db8') {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#fff8f2';
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, s / 2, s);
    ctx.fillRect(0, 0, s, s / 2);
    ctx.globalAlpha = 1;
  }, { repeat: [14, 14] });
}

// スプリンクル(お砂糖トッピング)
function sprinkleTex(seed = 21) {
  const rnd = mulberry32(seed);
  const cols = ['#ff6f9c', '#5db9ff', '#ffd24a', '#7fd97f', '#c792ff', '#ff9d5c'];
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#fff6ee';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      ctx.save();
      ctx.translate(rnd() * s, rnd() * s);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillStyle = cols[(rnd() * cols.length) | 0];
      ctx.beginPath();
      ctx.roundRect(-5, -1.6, 10, 3.2, 1.6);
      ctx.fill();
      ctx.restore();
    }
  });
}

let cache = null;

export function getMaterials() {
  if (cache) return cache;
  const std = (opt) => new THREE.MeshStandardMaterial(opt);
  cache = {
    biscuit: std({ map: biscuitTex(5), roughness: 0.8 }),
    biscuitDark: std({ map: biscuitTex(11, '#c89055', '#a06a35'), roughness: 0.85 }),
    sponge: std({ map: spongeTex(), roughness: 0.9 }),
    chocolate: std({ color: 0x5a341f, roughness: 0.28, metalness: 0.0 }),
    icing: std({ color: 0xfff6ee, roughness: 0.42 }),
    cream: std({ color: 0xfff9f0, roughness: 0.55 }),
    strawberry: std({ color: 0xe8465a, roughness: 0.35 }),
    mint: std({ color: 0x8fdcc3, roughness: 0.5 }),
    lemon: std({ color: 0xffd24a, roughness: 0.5 }),
    berryBlue: std({ color: 0x5db9ff, roughness: 0.5 }),
    grape: std({ color: 0xc792ff, roughness: 0.5 }),
    orange: std({ color: 0xff9d5c, roughness: 0.5 }),
    pinkStripe: std({ map: stripeTex('#ff6f9c', '#fff4ec'), roughness: 0.35 }),
    mintStripe: std({ map: stripeTex('#67c9ab', '#fff4ec'), roughness: 0.35 }),
    caneStripe: std({ map: stripeTex('#e8465a', '#fff6ee', 6), roughness: 0.3 }),
    gummy: std({ color: 0xff8a5c, roughness: 0.2, transparent: true, opacity: 0.82 }),
    gummyGreen: std({ color: 0x7fd97f, roughness: 0.2, transparent: true, opacity: 0.82 }),
    glass: std({ color: 0xdff2ff, roughness: 0.08, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    gold: std({ color: 0xd9b45c, roughness: 0.3, metalness: 0.7 }),
    gingham: std({ map: ginghamTex(), roughness: 0.9 }),
    sprinklePlate: std({ map: sprinkleTex(), roughness: 0.6 }),
    handGlove: std({ color: 0xfff6e8, roughness: 0.55 }),
  };
  return cache;
}

// キャンディ玉のテクスチャ(色違い)
export function makeBallTexture(colA, colB) {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = colA;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = colB;
    // ぐるっと波帯
    ctx.beginPath();
    for (let x = 0; x <= s; x += 4) {
      const y = s * 0.5 + Math.sin((x / s) * Math.PI * 4) * s * 0.06 - s * 0.09;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let x = s; x >= 0; x -= 4) {
      const y = s * 0.5 + Math.sin((x / s) * Math.PI * 4) * s * 0.06 + s * 0.09;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // 極の丸
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.07, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.93, s * 0.1, 0, Math.PI * 2); ctx.fill();
  });
}

// 背景: パステルの空+わたあめ雲
export function makeBackdropTexture() {
  const rnd = mulberry32(77);
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 1024;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#aee3ff');
  g.addColorStop(0.45, '#cdeeff');
  g.addColorStop(0.75, '#ffe3ef');
  g.addColorStop(1, '#ffd1e4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * 512, y = 80 + rnd() * 620, r = 26 + rnd() * 54;
    for (const [dx, dy, rr] of [[0, 0, 1], [0.9, 0.12, 0.7], [-0.9, 0.1, 0.66], [0.4, -0.3, 0.6], [-0.4, -0.28, 0.55]]) {
      const gg = ctx.createRadialGradient(x + dx * r, y + dy * r, 0, x + dx * r, y + dy * r, r * rr);
      gg.addColorStop(0, 'rgba(255,255,255,0.85)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * rr, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
