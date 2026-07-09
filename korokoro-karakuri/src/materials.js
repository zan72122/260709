// materials.js — プロシージャル木目テクスチャと材質パレット(外部アセットなし)
import * as THREE from '../vendor/three.module.min.js';

// 疑似乱数(シード付き・生成の再現性)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

// 木目キャンバス生成: 縦方向の年輪ストライプ+ゆらぎ+細かなノイズ
function woodCanvas({ base, dark, light, seed = 1, grainScale = 1, ringStrength = 1, size = 256 }) {
  const rnd = mulberry32(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const [br, bg, bb] = hexToRgb(base);
  const [dr, dg, db] = hexToRgb(dark);
  const [lr, lg, lb] = hexToRgb(light);

  const img = ctx.createImageData(size, size);
  const d = img.data;
  // 年輪の波パラメータ
  const waves = [];
  for (let i = 0; i < 4; i++) {
    waves.push({ f: (2 + rnd() * 5) * grainScale, a: 4 + rnd() * 10, ph: rnd() * Math.PI * 2, yf: 0.004 + rnd() * 0.012 });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let gx = x;
      for (const w of waves) gx += Math.sin(y * w.yf * w.f + w.ph + Math.sin(y * 0.02 + w.ph) * 1.7) * w.a * 0.22;
      // 縦ストライプ(年輪)
      let t = Math.sin(gx * 0.16 * grainScale) * 0.5 + Math.sin(gx * 0.045 * grainScale + 1.3) * 0.5;
      t = (t * 0.5 + 0.5) * ringStrength;
      // 細ノイズ
      const n = (rnd() - 0.5) * 0.16;
      let f = Math.max(0, Math.min(1, t + n));
      // base との合成: f<0.5 → dark 寄り, f>0.5 → light 寄り
      let r, g, b;
      if (f < 0.5) {
        const k = 1 - f * 2;
        r = br + (dr - br) * k * 0.55; g = bg + (dg - bg) * k * 0.55; b = bb + (db - bb) * k * 0.55;
      } else {
        const k = (f - 0.5) * 2;
        r = br + (lr - br) * k * 0.5; g = bg + (lg - bg) * k * 0.5; b = bb + (lb - bb) * k * 0.5;
      }
      const i = (y * size + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function makeWoodTexture(opts) {
  const tex = new THREE.CanvasTexture(woodCanvas(opts));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 塗装木: 木目がうっすら透ける塗り色
function paintedCanvas({ paint, seed = 3, size = 128 }) {
  const rnd = mulberry32(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const [r, g, b] = hexToRgb(paint);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  // うっすら木目筋
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    ctx.strokeStyle = rnd() > 0.5 ? '#000' : '#fff';
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 14, size * 0.33, x + (rnd() - 0.5) * 14, size * 0.66, x + (rnd() - 0.5) * 10, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let cache = null;

export function getMaterials() {
  if (cache) return cache;

  const beechTex = makeWoodTexture({ base: 0xdcbd8f, dark: 0xb99266, light: 0xefd9b2, seed: 11, grainScale: 1.0, ringStrength: 0.9 });
  const beechTexV = makeWoodTexture({ base: 0xd7b88a, dark: 0xb28c60, light: 0xecd4aa, seed: 23, grainScale: 1.4, ringStrength: 0.8 });
  const walnutTex = makeWoodTexture({ base: 0x8a6242, dark: 0x64432b, light: 0xa97e58, seed: 7, grainScale: 1.2, ringStrength: 1.0 });
  const birchTex = makeWoodTexture({ base: 0xf0e0c0, dark: 0xd8c39c, light: 0xfbf1dd, seed: 31, grainScale: 0.8, ringStrength: 0.6 });

  const wood = (map, rough = 0.72) => new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0.0 });
  const painted = (hex, seed, rough = 0.42) => new THREE.MeshStandardMaterial({ map: paintedCanvas({ paint: hex, seed }), roughness: rough, metalness: 0.0 });

  cache = {
    beech: wood(beechTex),          // フレーム・土台
    beechV: wood(beechTexV),        // 縦材
    walnut: wood(walnutTex, 0.68),  // レール床
    birch: wood(birchTex, 0.75),    // 背板
    red: painted(0xd0544a, 41),
    blue: painted(0x4d80bd, 42),
    yellow: painted(0xe8b23e, 43),
    green: painted(0x6aa465, 44),
    cream: painted(0xf6ead2, 45, 0.5),
    coral: painted(0xe98a6f, 46),
    // 玉: 塗装木・つやあり
    ballRed: new THREE.MeshStandardMaterial({ map: paintedCanvas({ paint: 0xd0544a, seed: 51 }), roughness: 0.28, metalness: 0.0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.35, metalness: 0.75 }),
    handGlove: new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.55, metalness: 0 }),
  };
  return cache;
}

// 玉のストライプ模様(回転が見えるように)
export function makeBallTexture(colorA = '#d0544a', colorB = '#f6ead2', star = '#e8b23e') {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, size, size);
  // 赤道の帯
  ctx.fillStyle = colorB;
  ctx.fillRect(0, size * 0.40, size, size * 0.20);
  // 帯の中の丸ドット
  ctx.fillStyle = star;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(size * (i + 0.5) / 6, size * 0.5, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  // 極の丸
  ctx.fillStyle = colorB;
  ctx.beginPath(); ctx.arc(size * 0.5, size * 0.06, size * 0.10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(size * 0.5, size * 0.94, size * 0.10, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 背景ドーム用グラデーション(暖かい子供部屋の光)
export function makeBackdropTexture() {
  const w = 512, h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffedd2');
  g.addColorStop(0.45, '#ffdfc2');
  g.addColorStop(0.8, '#f3c9a8');
  g.addColorStop(1, '#e0b18f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // やわらかいボケ玉(部屋のボケ味)
  const rnd = mulberry32(99);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h * 0.75, r = 18 + rnd() * 70;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.09;
    rg.addColorStop(0, `rgba(255,250,235,${a})`);
    rg.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 背板のペグボード穴模様
export function makePegboardTexture() {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.drawImage(woodCanvas({ base: 0xf0e0c0, dark: 0xd8c39c, light: 0xfbf1dd, seed: 31, grainScale: 0.8, ringStrength: 0.6, size: 512 }), 0, 0);
  ctx.fillStyle = 'rgba(120,90,60,0.35)';
  const step = size / 10;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.beginPath(); ctx.arc(x, y, size * 0.010, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
