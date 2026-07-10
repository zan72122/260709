// wrap.test.mjs — 円筒ラップ座標変換の検証
import { R0, CIRC, wrapPos, wrapQuat, phiOf, shortestArc } from '../src/wrap.js';
import * as THREE from '../vendor/three.module.min.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// x=0 は正面(+Z)
const p0 = wrapPos(0, 5, 0);
ok(near(p0.x, 0) && near(p0.y, 5) && near(p0.z, R0), 'x=0 は正面 (0, y, R0)');

// 1周で同じ場所に戻る
const p1 = wrapPos(CIRC, 5, 0);
ok(near(p1.x, p0.x, 1e-4) && near(p1.z, p0.z, 1e-4), '1周(x=CIRC)で同じ位置に戻る');

// 1/4周で +X 側
const pq = wrapPos(CIRC / 4, 5, 0);
ok(near(pq.x, R0, 1e-4) && near(pq.z, 0, 1e-4), '1/4周で +X 側に来る');

// z オフセットは半径方向
const pz = wrapPos(0, 5, 0.5);
ok(near(pz.z, R0 + 0.5, 1e-6), 'z=+0.5 は半径方向外側');

// 接線方向: x=0 での +X ローカルはワールド +X
const q = wrapQuat(0, 0);
const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
ok(near(tangent.x, 1, 1e-6) && near(tangent.z, 0, 1e-6), 'x=0 の接線は +X');
// 1/4周では接線が -Z を向く
const q2 = wrapQuat(CIRC / 4, 0);
const t2 = new THREE.Vector3(1, 0, 0).applyQuaternion(q2);
ok(near(t2.z, -1, 1e-4), '1/4周の接線は -Z');
// ローカルZ(外向き)は位置の半径方向と一致
const out2 = new THREE.Vector3(0, 0, 1).applyQuaternion(q2);
ok(near(out2.x, 1, 1e-4), '1/4周の外向きは +X');

// 隣接セグメントの弦誤差: 0.75 のセグメントで矢高が玉より十分小さい
const sagitta = R0 - Math.sqrt(R0 * R0 - 0.375 * 0.375);
ok(sagitta < 0.03, `セグメント弦の矢高(${sagitta.toFixed(4)})が小さい`);

// shortestArc
ok(near(shortestArc(0.1, 0.3), 0.2, 1e-9), 'shortestArc 通常');
ok(shortestArc(0.1, 0.1 + Math.PI * 2) < 1e-9, 'shortestArc 1周差はゼロ');
ok(near(Math.abs(shortestArc(0, Math.PI + 0.2)), Math.PI - 0.2, 1e-9), 'shortestArc は近い方を回る');

ok(near(phiOf(CIRC), Math.PI * 2, 1e-9), 'phiOf(CIRC) = 2π');

if (failures) { console.error(`wrap.test: ${failures} failure(s)`); process.exit(1); }
console.log('wrap.test: all ok');
