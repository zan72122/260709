// physics.test.mjs — 自作物理の基本挙動
import * as THREE from '../vendor/three.module.min.js';
import { PhysicsWorld, BoxCollider, CylinderZCollider } from '../src/physics.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}

function makeBall(x, y, z = 0) {
  return {
    p: new THREE.Vector3(x, y, z),
    v: new THREE.Vector3(),
    omega: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    r: 0.32,
    active: true,
  };
}

function run(world, ball, seconds) {
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) world.step(ball, dt);
}

// 1. 水平な床に静止する
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(3, 0.1, 1) }));
  const b = makeBall(0, 2);
  run(w, b, 2.5);
  ok(Math.abs(b.p.y - (0.1 + 0.32)) < 0.03, `床の上で静止 y=${b.p.y.toFixed(3)} (期待 0.42)`);
  ok(b.v.length() < 0.3, `速度が収まる |v|=${b.v.length().toFixed(3)}`);
}

// 2. 傾いた床を下る(低い側へ)
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 5, 0), half: new THREE.Vector3(3, 0.1, 1), angleZ: -0.25, friction: 0.02 }));
  const b = makeBall(-1, 6);
  run(w, b, 1.0);
  ok(b.p.x > -0.5, `右下がりの坂を右へ転がる x=${b.p.x.toFixed(2)}`);
  ok(b.v.x > 0.5, `右向きの速度を得る vx=${b.v.x.toFixed(2)}`);
}

// 3. 高速でも床を貫通しない(CCD 代わりのサブステップ)
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(3, 0.1, 1) }));
  const b = makeBall(0, 8);
  b.v.set(0, -13, 0);
  run(w, b, 1.5);
  ok(b.p.y > 0.3, `高速落下でも貫通しない y=${b.p.y.toFixed(3)}`);
}

// 4. 円柱(ペグ)に当たると弾かれる
{
  const w = new PhysicsWorld();
  w.add(new CylinderZCollider({ center: new THREE.Vector3(0.05, 3, 0), radius: 0.13 }));
  const b = makeBall(0.0, 5);
  let hit = false;
  const dt = 1 / 60;
  for (let i = 0; i < 90; i++) {
    w.step(b, dt, () => { hit = true; });
  }
  ok(hit, 'ペグとの衝突イベントが発生する');
  ok(Math.abs(b.p.x) > 0.1, `ペグで左右に逸れる x=${b.p.x.toFixed(2)}`);
}

// 5. 動く床(キネマティック)に乗ると持ち上がる
{
  const w = new PhysicsWorld();
  const plat = w.add(new BoxCollider({ center: new THREE.Vector3(0, 1, 0), half: new THREE.Vector3(0.5, 0.1, 0.5) }));
  const b = makeBall(0, 2);
  run(w, b, 1.0); // 着地
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) {
    plat.center.y += 1.5 * dt;
    plat.linVel.set(0, 1.5, 0);
    w.step(b, dt);
  }
  ok(b.p.y > 2.7, `上昇する床と一緒に持ち上がる y=${b.p.y.toFixed(2)}`);
}

// 6. z=0 平面へ緩やかに復元される
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(3, 0.1, 2) }));
  const b = makeBall(0, 1, 0.8);
  run(w, b, 3);
  ok(Math.abs(b.p.z) < 0.15, `z が平面へ戻る z=${b.p.z.toFixed(3)}`);
}

if (failures) { console.error(`physics.test: ${failures} failure(s)`); process.exit(1); }
console.log('physics.test: all ok');
