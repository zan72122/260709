// layout.test.mjs — 玉の旅の接続整合性: 各パーツの受け渡し位置が正しく繋がっているか
import {
  RAILS, SEESAW, PEGS, PEG_GUARD, SIDE_CHUTE, WHEEL, ELEVATOR, SWITCH,
  DROP_TUBE, CATAPULT, HOOP, GOAL, HOPPER, BALL_SPAWN, BALL_RADIUS,
} from '../src/layout.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}
// レール上の x における床中心の y
function railY(rail, x) {
  const [ax, ay] = rail.a, [bx, by] = rail.b;
  return ay + (x - ax) * ((by - ay) / (bx - ax));
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('layout: ホッパー → R1');
ok(BALL_SPAWN.x < HOPPER.pos[0] + 0.7 && BALL_SPAWN.y > HOPPER.pos[1], '玉はホッパーの中に出現する');
ok(RAILS.R1.a[1] < HOPPER.pos[1] + 0.2, 'R1 開始はホッパー床より下(玉が流れ込める)');
ok(RAILS.R1.a[1] > RAILS.R1.b[1], 'R1 は右下がり(a→b で下る)');

console.log('layout: R1 → シーソー');
const seesawLeftX = SEESAW.pivot[0] - SEESAW.halfLen;
ok(RAILS.R1.b[0] > seesawLeftX - 0.6, 'R1 出口はシーソー左端の近く');
const plankTopAtDrop = SEESAW.pivot[1] + Math.tan(SEESAW.tilt) * (RAILS.R1.b[0] + 0.3 - SEESAW.pivot[0]);
ok(RAILS.R1.b[1] > plankTopAtDrop, 'R1 出口はシーソー板より上(落ちて乗れる)');
ok(SEESAW.restTilt > 0, '初期は左下がり(玉が左端で待機)');
// 右に傾いてせり上がった左端ストッパーが、R1 から入ってくる玉を塞がない
const raisedTipTop = SEESAW.pivot[1] + SEESAW.halfLen * Math.sin(SEESAW.tilt) + 0.08 + SEESAW.tipWall;
const entryCenter = RAILS.R1.b[1] + 0.08 + BALL_RADIUS;
ok(entryCenter - raisedTipTop > 0.25, `せり上がった壁の上を新しい玉が通れる(余裕${(entryCenter - raisedTipTop).toFixed(2)})`);

console.log('layout: シーソー → ペグ → R2');
const seesawRightX = SEESAW.pivot[0] + SEESAW.halfLen;
const seesawRightYDown = SEESAW.pivot[1] - Math.sin(SEESAW.tilt) * SEESAW.halfLen;
for (const [px, py] of PEGS) {
  ok(py < seesawRightYDown, `ペグ(${px},${py})はシーソー右端(y=${seesawRightYDown.toFixed(2)})より下`);
  ok(px > PEG_GUARD.x && px < SIDE_CHUTE.x, 'ペグは落下路の内側');
}
ok(railY(RAILS.R2, 2.8) < PEGS[1][1] - 0.3, 'R2 はペグより下で受ける');
ok(RAILS.R2.a[1] > RAILS.R2.b[1], 'R2 は右下がり');

console.log('layout: R2 → 縦チュート → 水車');
// R2 のレール実端(+0.17 延長)から外壁内面までの隙間に玉が落ちられる
const railEnd = RAILS.R2.b[0] + 0.17;
const outerFace = SIDE_CHUTE.x + 0.33 - 0.08;
ok(outerFace - railEnd > BALL_RADIUS * 2 + 0.15, `R2端→外壁の隙間(${(outerFace - railEnd).toFixed(2)})は玉より広い`);
const deflRight = SIDE_CHUTE.deflector.x + (SIDE_CHUTE.deflector.w / 2) * Math.cos(SIDE_CHUTE.deflector.angle);
ok(outerFace - deflRight < BALL_RADIUS, 'スキージャンプ右端と外壁の間に玉が挟まる隙間がない');
ok(SIDE_CHUTE.deflector.angle > 0, 'スキージャンプは右が高い(玉を左へ)');
const dxIntake = Math.abs(WHEEL.intake.x - WHEEL.center[0]);
ok(dxIntake < 0.2, '受け口は水車の真下付近');
ok(WHEEL.intake.y < WHEEL.center[1], '受け口は水車中心より下');

console.log('layout: 水車 → R3');
ok(near(WHEEL.release.x, RAILS.R3.a[0], 0.5), '放出位置は R3 開始付近');
ok(WHEEL.release.y > railY(RAILS.R3, WHEEL.release.x), '放出は R3 より上');
ok(WHEEL.release.vx < 0, '放出は左向き');
ok(RAILS.R3.a[1] > RAILS.R3.b[1], 'R3 は左下がり(左へ運ぶ)');

console.log('layout: R3 → エレベーター');
ok(RAILS.R3.b[0] > ELEVATOR.x - ELEVATOR.platform.hw - 0.4 && RAILS.R3.b[0] < ELEVATOR.x + ELEVATOR.platform.hw + 0.6,
  'R3 出口はプラットフォームの上空');
ok(RAILS.R3.b[1] > ELEVATOR.bottom, 'R3 出口は待機プラットフォームより上');
ok(ELEVATOR.top > ELEVATOR.bottom + 2, 'エレベーターは十分に持ち上げる');

console.log('layout: エレベーター → R4 → スイッチ');
ok(ELEVATOR.handoff.y > railY(RAILS.R4, ELEVATOR.handoff.x) , '受け渡し位置は R4 より上');
ok(near(RAILS.R4.a[0], ELEVATOR.x + 0.5, 0.6), 'R4 開始はエレベーター頂上の右');
ok(RAILS.R4.a[1] > RAILS.R4.b[1], 'R4 は右下がり');
ok(RAILS.R4.b[0] < SWITCH.pivot[0], 'R4 出口はスイッチの左(フリッパーに乗る)');
ok(RAILS.R4.b[1] > SWITCH.pivot[1], 'R4 出口はスイッチ軸より上');

console.log('layout: スイッチ分岐');
const hl = SWITCH.halfLen, sa = SWITCH.angle;
const tipXoff = hl * Math.cos(sa), tipYoff = hl * Math.sin(sa);
// フリッパー(下がった側の先端)の下面が、R3 を転がる玉の頭上を横切らない
const tipDownBottom = SWITCH.pivot[1] - tipYoff - 0.09;
for (const tx of [SWITCH.pivot[0] - tipXoff, SWITCH.pivot[0] + tipXoff]) {
  const ballTop = railY(RAILS.R3, tx) + 0.08 + BALL_RADIUS * 2;
  ok(tipDownBottom > ballTop + 0.05, `フリッパー先端(x=${tx.toFixed(2)})の下を R3 の玉が通れる(隙間${(tipDownBottom - ballTop).toFixed(2)})`);
}
// R4 から飛んでくる玉(レール端の上 +r)が、上がった側の先端を越えられる
const r4EndX = RAILS.R4.b[0] + 0.17;
const incomingCenter = railY(RAILS.R4, r4EndX) + 0.08 + BALL_RADIUS;
const tipUpTop = SWITCH.pivot[1] + tipYoff + 0.09;
ok(incomingCenter - tipUpTop > BALL_RADIUS * 0.9, `上がった先端を玉が越えられる(余裕${(incomingCenter - tipUpTop).toFixed(2)})`);
// 左分岐: 左先端から落ちた玉は R3 に乗ってループできる
const leftTipX = SWITCH.pivot[0] - tipXoff;
const dropL = (SWITCH.pivot[1] - tipYoff) - railY(RAILS.R3, leftTipX - 0.3);
ok(dropL > 0.4 && dropL < 2.0, `左分岐の落差(${dropL.toFixed(2)})は妥当`);
// 右分岐: 右先端から出た玉がチューブ捕捉圏に入る
const tipR = [SWITCH.pivot[0] + tipXoff, SWITCH.pivot[1] - tipYoff + BALL_RADIUS];
const dEntry = Math.hypot(tipR[0] - DROP_TUBE.entry.x, tipR[1] - DROP_TUBE.entry.y);
ok(dEntry < DROP_TUBE.entry.r + 0.45, `フリッパー右端→チューブ入口の距離(${dEntry.toFixed(2)})は捕捉圏内`);

console.log('layout: チューブ → R6 → カタパルト');
const tubeEnd = DROP_TUBE.path[DROP_TUBE.path.length - 1];
ok(tubeEnd[1] > railY(RAILS.R6, tubeEnd[0]), 'チューブ出口は R6 より上');
ok(DROP_TUBE.exitVel.vx < 0, 'チューブ出口は左向き');
ok(RAILS.R6.a[1] > RAILS.R6.b[1], 'R6 は左下がり');
ok(RAILS.R6.b[0] > CATAPULT.cup.x, 'R6 出口はカップより右(飛び込める)');
ok(RAILS.R6.b[1] > CATAPULT.cup.y - 0.5, 'R6 出口の高さはカップ捕捉圏');

console.log('layout: カタパルト → リング → ゴール');
ok(near(CATAPULT.arc.ring[0], HOOP.x, 0.05) && near(CATAPULT.arc.ring[1], HOOP.y, 0.05), '発射弧はリングの中心を通る');
ok(HOOP.r > BALL_RADIUS + 0.15, 'リングは玉より十分大きい');
const mouthY = GOAL.funnel.y + GOAL.funnel.height / 2;
ok(near(CATAPULT.arc.to[0], GOAL.funnel.x, 0.15), '弧の終点は漏斗の真上');
ok(CATAPULT.arc.to[1] > mouthY - 0.1, '弧の終点は漏斗の口以上の高さ');
ok(CATAPULT.arc.ring[1] > CATAPULT.arc.from[1] && CATAPULT.arc.ring[1] > CATAPULT.arc.to[1], '弧は山なり');

if (failures) { console.error(`layout.test: ${failures} failure(s)`); process.exit(1); }
console.log('layout.test: all ok');
