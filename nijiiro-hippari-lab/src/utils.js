// 小さな数学・色ヘルパー
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

// 2Dセグメント同士の交点 ({x,y} or null)
export function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax, rY = by - ay;
  const sX = dx - cx, sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / denom;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / denom;
  const M = 0.02; // 端すれすれは交点にしない
  if (t <= M || t >= 1 - M || u <= M || u >= 1 - M) return null;
  return { x: ax + rX * t, y: ay + rY * t, t, u };
}

// やわらかいイージング
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => t * t * (3 - 2 * t);

// hsl → hex 数値
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

export function hexToCss(hex, alpha = 1) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// 2色まぜる(にじみ用) t=0..1
export function mixHex(h1, h2, t) {
  const r = Math.round(lerp((h1 >> 16) & 255, (h2 >> 16) & 255, t));
  const g = Math.round(lerp((h1 >> 8) & 255, (h2 >> 8) & 255, t));
  const b = Math.round(lerp(h1 & 255, h2 & 255, t));
  return (r << 16) | (g << 8) | b;
}
