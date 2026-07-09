// audio.test.mjs — 衝突音の音階量子化(ペンタトニック)の検証
import { yToNote } from '../src/audio.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}

const PENTA = new Set([0, 2, 4, 7, 9]);
const C4 = 261.63;

for (let y = 0; y <= 14; y += 0.5) {
  const f = yToNote(y);
  const semis = Math.round(12 * Math.log2(f / C4));
  const cls = ((semis % 12) + 12) % 12;
  if (!PENTA.has(cls)) { failures++; console.error(`  NG - y=${y} → ${f.toFixed(1)}Hz (半音 ${semis}) はペンタトニック外`); }
}
console.log('  ok - すべての高さがペンタトニックに量子化される');

ok(yToNote(14) > yToNote(0), '高い場所ほど高い音');
ok(Math.abs(yToNote(0) - C4) < 1, '最低音は C4');
const top = yToNote(14);
ok(top < C4 * 8.01 && top > C4 * 3.9, `最高音は妥当な範囲 (${top.toFixed(0)}Hz)`);

if (failures) { console.error(`audio.test: ${failures} failure(s)`); process.exit(1); }
console.log('audio.test: all ok');
