// melody.test.mjs — きらきらぼしメロディの検証
import { MELODY, noteFreq } from '../src/audio.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}

// きらきらぼしの冒頭: ドドソソララソ
const head = [0, 0, 7, 7, 9, 9, 7];
ok(MELODY.slice(0, 7).every((v, i) => v === head[i]), '冒頭は「ドドソソララソ」');
// 全音が C メジャースケール内
const CMAJ = new Set([0, 2, 4, 5, 7, 9, 11]);
ok(MELODY.every((s) => CMAJ.has(((s % 12) + 12) % 12)), '全音が C メジャー内');
ok(MELODY.length === 42, '6フレーズ42音');
// 周波数
ok(Math.abs(noteFreq(0) - 523.25) < 0.01, 'ド(基準)は C5');
ok(Math.abs(noteFreq(0, 1) - 1046.5) < 0.1, 'オクターブ上は2倍');
ok(noteFreq(7) > noteFreq(0), 'ソはドより高い');

if (failures) { console.error(`melody.test: ${failures} failure(s)`); process.exit(1); }
console.log('melody.test: all ok');
