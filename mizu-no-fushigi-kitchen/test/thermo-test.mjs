// 温度・状態変化モデルの単体テスト: 全サイクル (沸騰→雨→凍結→融解) を
// 実時間シミュレートし、保存則・プラトー・イベント発火を検証する。

import { Thermo, T_MIN, T_MAX } from '../src/thermo.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };
// 毎フレーム回す不変条件は、破れたときだけ 1 回報告する
const invariant = (cond, msg) => { if (!cond && !invariant.seen.has(msg)) { invariant.seen.add(msg); check(false, msg); } };
invariant.seen = new Set();

const th = new Thermo();
const events = [];
th.onEvent(name => events.push(name));

const run = (seconds, assertFn) => {
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    th.update(dt);
    const tot = th.total;
    if (Math.abs(tot - 1) > 1e-6) {
      check(false, `保存則くずれ: total=${tot}`);
      return;
    }
    if (assertFn) assertFn();
  }
};

// --- 初期状態
check(th.water === 1 && th.ice === 0 && th.cloud === 0, '初期状態は水 100%');
check(th.temp === 20, '初期温度は 20℃');

// --- 加熱: 100℃ で沸騰し、プラトーで温度が止まる
th.setTarget(T_MAX);
let sawPlateau100 = false;
run(60, () => {
  invariant(th.temp <= 100.0001 || th.water < 0.01, '水があるうちは温度が 100℃ を超えない');
  if (th.temp === 100 && th.water > 0.1 && th.boiling) sawPlateau100 = true;
});
check(sawPlateau100, '100℃ プラトーで沸騰した');
check(events.includes('boil-start'), 'boil-start イベント発火');
run(120);
check(th.water < 0.01 && th.cloud > 0.98, '全部ゆげ (くも) になった');
check(events.includes('all-steam'), 'all-steam イベント発火');
check(th.temp > 100, '水がなくなったら温度は 100℃ を超えられる');

// --- 冷却: くもから雨が降って水が戻り、そのあと凍る
events.length = 0;
th.setTarget(T_MIN);
let sawPlateau0 = false;
const watchFreeze = () => { if (th.temp === 0 && th.freezing) sawPlateau0 = true; };
run(90, watchFreeze);
check(events.includes('rain-start'), 'rain-start イベント発火');
check(events.includes('rained'), 'rained イベント発火 (くもが雨で戻った)');
check(th.cloud < 0.01, 'くもがなくなった');
run(90, watchFreeze);
check(sawPlateau0, '0℃ プラトーで凍結した');
check(events.includes('frozen'), 'frozen イベント発火');
check(th.ice > 0.98 && th.water < 0.01, '全部こおりになった');
run(60);
check(th.temp < -15, '全凍結後は氷点下まで下がる');
check(th.phaseName() === 'ice', 'phaseName は ice');

// --- 再加熱: 0℃ プラトーで溶けてから温度が上がる
events.length = 0;
th.setTarget(60);
let sawMeltPlateau = false;
run(120, () => {
  if (th.temp === 0 && th.melting) sawMeltPlateau = true;
  if (th.ice > 0.05) invariant(th.temp <= 0.0001, '氷があるうちは 0℃ 以下');
});
check(sawMeltPlateau, '0℃ プラトーで融解した');
check(events.includes('melted'), 'melted イベント発火');
check(th.ice < 0.01 && th.water > 0.98, '全部みずに戻った');
check(Math.abs(th.temp - 60) < 5, '目標 60℃ 付近まで上がった');

// --- setTarget の範囲クランプ
th.setTarget(999); check(th.target === T_MAX, 'target は T_MAX でクランプ');
th.setTarget(-999); check(th.target === T_MIN, 'target は T_MIN でクランプ');

console.log(ok ? '\nすべて OK' : '\nテスト失敗あり');
process.exit(ok ? 0 : 1);
