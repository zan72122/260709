// layout.test.mjs — 14ギミックの旅の接続整合性
import {
  RAILS, CRANE, PEGS, PEG_WALLS, SEESAW, MUSIC_DRUM, WHEEL, CHOCO_FALL,
  WHIP_LIFT, FLIPPER, DROP_TUBE, TURNTABLE, HAMMER, LOOP, DOMINO, CANNON,
  GOAL, TOWER, BALL_RADIUS, BALL_HOME, MAX_BALLS,
} from '../src/layout.js';
import { CIRC } from '../src/wrap.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}
function railY(rail, x) {
  const [ax, ay] = rail.a, [bx, by] = rail.b;
  return ay + (x - ax) * ((by - ay) / (bx - ax));
}
const ballTopOn = (rail, x) => railY(rail, x) + 0.08 + BALL_RADIUS * 2;
const restCenterOn = (rail, x) => railY(rail, x) + 0.08 + BALL_RADIUS;

console.log('layout: 全レールが進行方向へ下る');
for (const [k, r] of Object.entries(RAILS)) {
  if (k === 'RET') ok(r.a[0] > r.b[0] && r.a[1] > r.b[1], `${k} は -x へ下る(ループ帰還)`);
  else ok(r.b[0] > r.a[0] && r.a[1] > r.b[1], `${k} は +x へ下る`);
}

console.log('layout: クレーン → R1 → ペグ → R2');
ok(BALL_HOME.y > RAILS.R1.a[1], '玉のホームは R1 より上');
ok(CRANE.hatch.x < RAILS.R1.a[0] + 0.6, 'ハッチは R1 開始の近く');
for (const [px, py] of PEGS) {
  ok(px > PEG_WALLS.left + 0.2 && px < PEG_WALLS.right - 0.2, `ペグ(${px})はガード壁の内側`);
  ok(py < RAILS.R1.b[1] && py > RAILS.R2.a[1], `ペグ(${py})は R1 と R2 の間`);
}
ok(RAILS.R1.b[0] + 0.17 > PEG_WALLS.left, 'R1 出口はペグ落下路に届く');

console.log('layout: シーソー');
const raisedTipTop = SEESAW.pivot[1] + SEESAW.halfLen * Math.sin(SEESAW.tilt) + 0.08 + SEESAW.tipWall;
const entryBottom = RAILS.R2.b[1] + 0.08; // 玉の底(レール床上)
ok(entryBottom - raisedTipTop > 0.05, `せり上がった左壁の上を玉の底が通れる(余裕${(entryBottom - raisedTipTop).toFixed(2)})`);
const seesawRightDrop = SEESAW.pivot[1] - Math.sin(SEESAW.tilt) * SEESAW.halfLen;
ok(seesawRightDrop > RAILS.R3.a[1], 'シーソー右端は R3 より上');
ok(SEESAW.pivot[0] + SEESAW.halfLen < RAILS.R3.a[0] + 0.6, 'シーソー右端は R3 開始付近');

console.log('layout: オルゴール → 風車');
ok(MUSIC_DRUM.x0 > RAILS.R4.a[0] - 0.5 && MUSIC_DRUM.x1 < RAILS.R4.b[0] + 0.5, 'メロディゾーンは R4 上');
ok(RAILS.R4.b[0] + 0.17 < WHEEL.center[0] - WHEEL.physRadius + 0.6, 'R4 出口は風車の左肩に落ちる');
const chuteRight = WHEEL.chute.x + (WHEEL.chute.w / 2) * Math.cos(WHEEL.chute.angle);
ok(chuteRight > WHEEL.center[0] - WHEEL.physRadius - 0.4, 'チュートは風車の受け口まで届く');
ok(WHEEL.chute.angle < 0, 'チュートは +x(風車側)へ下る');
ok(WHEEL.intake.y < WHEEL.center[1], '受け口は風車の下側');
ok(WHEEL.release.x > WHEEL.center[0] && WHEEL.release.vx > 0, '放出は +x(R5)へ');
ok(WHEEL.release.y > railY(RAILS.R5, WHEEL.release.x), '放出は R5 より上');

console.log('layout: チョコの滝 → ホイップリフト');
ok(CHOCO_FALL.x > RAILS.R5.a[0] && CHOCO_FALL.x < RAILS.R5.b[0], '滝は R5 の途中');
ok(Math.abs(CHOCO_FALL.y - restCenterOn(RAILS.R5, CHOCO_FALL.x)) < 0.5, '滝の判定は玉の高さ');
ok(RAILS.R5.b[0] + 0.17 < WHIP_LIFT.walls.right, 'R5 出口はリフトの器へ落ちる');
ok(RAILS.R5.b[1] > WHIP_LIFT.bottom, 'R5 出口は待機プラットフォームより上');
ok(WHIP_LIFT.handoff.y > railY(RAILS.R6, RAILS.R6.a[0]), 'リフトの受け渡しは R6 より上');
ok(WHIP_LIFT.top - WHIP_LIFT.bottom > 1.8, 'リフトは十分持ち上げる');

console.log('layout: フリッパー分岐');
const hl = FLIPPER.halfLen, sa = FLIPPER.angle;
const tipXoff = hl * Math.cos(sa), tipYoff = hl * Math.sin(sa);
const r6EndX = RAILS.R6.b[0] + 0.17;
const incoming = railY(RAILS.R6, r6EndX) + 0.08 + BALL_RADIUS;
const tipUpTop = FLIPPER.pivot[1] + tipYoff + 0.09;
ok(incoming - tipUpTop > BALL_RADIUS * 0.8, `上がった先端を玉が越えられる(余裕${(incoming - tipUpTop).toFixed(2)})`);
// 左分岐: 左先端 → RET に乗る
const leftTipX = FLIPPER.pivot[0] - tipXoff;
const dropL = (FLIPPER.pivot[1] - tipYoff) - railY(RAILS.RET, Math.max(RAILS.RET.b[0], leftTipX - 0.3));
ok(dropL > 0.3 && dropL < 2.0, `左分岐の落差(${dropL.toFixed(2)})は妥当`);
// RET 出口はリフトの器の中へ
const retEnd = RAILS.RET.b[0] - 0.17;
ok(retEnd > WHIP_LIFT.walls.left && retEnd < WHIP_LIFT.walls.right, 'RET 出口はリフトの器の上');
ok(RAILS.RET.b[1] > WHIP_LIFT.bottom, 'RET 出口はプラットフォームより上');
// RET はフリッパーの下を通る玉と干渉しない(RET 自体が通り道なので、フリッパー先端との間に玉1個分)
const tipDownBottom = FLIPPER.pivot[1] - tipYoff - 0.09;
ok(tipDownBottom - ballTopOn(RAILS.RET, leftTipX) > -0.05, 'フリッパー先端の真下に玉がいても大きく食い込まない');
// 右分岐 → チューブ捕捉
const tipR = [FLIPPER.pivot[0] + tipXoff, FLIPPER.pivot[1] - tipYoff + BALL_RADIUS];
const dEntry = Math.hypot(tipR[0] - DROP_TUBE.entry.x, tipR[1] - DROP_TUBE.entry.y);
ok(dEntry < DROP_TUBE.entry.r + 0.5, `右先端→チューブ入口(${dEntry.toFixed(2)})は捕捉圏`);

console.log('layout: チューブ → ターンテーブル → ハンマー');
const tubeEnd = DROP_TUBE.path[DROP_TUBE.path.length - 1];
ok(tubeEnd[1] > railY(RAILS.R7, tubeEnd[0]), 'チューブ出口は R7 より上');
ok(DROP_TUBE.exitVel.vx > 0, 'チューブ出口は +x');
ok(RAILS.R7.b[0] + 0.17 < TURNTABLE.entry.x + 0.5, 'R7 出口は溝の入口付近');
const dTT = Math.hypot((RAILS.R7.b[0] + 0.3) - TURNTABLE.entry.x, restCenterOn(RAILS.R7, RAILS.R7.b[0]) - TURNTABLE.entry.y);
ok(dTT < TURNTABLE.entry.r + 0.6, 'R7 から溝に飛び込める');
ok(TURNTABLE.release.x > TURNTABLE.center[0] && TURNTABLE.release.y > railY(RAILS.R8, RAILS.R8.a[0]), '放出は R8 の上');
// ハンマーの窪み
ok(HAMMER.dip.x > RAILS.R8.b[0], '窪みは R8 の先');
const wedgeGap = HAMMER.wedges[1].x - HAMMER.wedges[0].x;
ok(wedgeGap > 0.6 && wedgeGap < 2.0, 'くさび2枚が窪みを形成');
ok(HAMMER.arc.to[0] === HAMMER.basket.x && HAMMER.arc.to[1] > HAMMER.basket.y, '打球はかごに入る');
ok(HAMMER.basket.x < RAILS.R9.a[0], 'かごから R9 へ流れ出る');

console.log('layout: ループ → ドミノゲート → 大砲');
ok(LOOP.entry.x > RAILS.R9.b[0], 'ループ入口は R9 の先');
ok(LOOP.exit.x < RAILS.R10.a[0] + 0.5 && LOOP.exit.y > railY(RAILS.R10, RAILS.R10.a[0]), 'ループ出口は R10 の上');
ok(DOMINO.gate.x > RAILS.R10.a[0] && DOMINO.gate.x < RAILS.R10.b[0], 'ゲートは R10 の途中');
ok(DOMINO.button.x < DOMINO.gate.x, 'ボタンはゲートの手前');
ok(DOMINO.row.x1 < DOMINO.gate.x, 'ドミノ列はゲートの手前で終わる');
ok(CANNON.cup.x > RAILS.R10.b[0], '大砲カップは R10 の先');
ok(CANNON.cup.y < railY(RAILS.R10, RAILS.R10.b[0]) + 0.6, 'カップは R10 出口の下');
// 打ち上げ: 終点は頂上ケーキの上
const last = CANNON.path[CANNON.path.length - 1];
ok(last[1] > TOWER.summit.topY + 0.3, '打ち上げ終点は頂上ケーキより上');
ok(Math.abs(last[2]) < 4.2, '終点の半径オフセットが円筒の内側に収まる');
ok(GOAL.splash.y > TOWER.summit.topY, 'クリーム着地点はケーキ上面より上');

console.log('layout: 全体');
ok(CANNON.cup.x < CIRC * 4.2, '旅は約4周に収まる');
ok(MAX_BALLS === 3, '玉は最大3個');
// 主要な待ち場所同士が塔の同じ方位に重ならない(±0.5 の弧長差があればカメラで区別できる)
const stations = [CRANE.knob.x, SEESAW.pivot[0], WHEEL.center[0], WHIP_LIFT.x, FLIPPER.pivot[0], TURNTABLE.center[0], HAMMER.dip.x, DOMINO.button.x, CANNON.cup.x];
for (let i = 0; i < stations.length - 1; i++) {
  ok(stations[i + 1] - stations[i] > 2.0, `ステーション${i}→${i + 1} は十分離れている`);
}

if (failures) { console.error(`layout.test: ${failures} failure(s)`); process.exit(1); }
console.log('layout.test: all ok');
