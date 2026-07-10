// physics.test.mjs — 平面物理+複数玉の検証
import * as THREE from '../vendor/three.module.min.js';
import { PhysicsWorld, BoxCollider, CylinderZCollider } from '../src/physics.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failures++; console.error(`  NG - ${msg}`); }
}

function makeBall(x, y, z = 0) {
  return {
    p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(),
    omega: new THREE.Vector3(), quat: new THREE.Quaternion(),
    r: 0.32, active: true,
  };
}
function run(world, balls, seconds) {
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) world.step(balls, dt);
}

// 1. 床に静止
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(3, 0.1, 1) }));
  const b = makeBall(0, 2);
  run(w, [b], 2.5);
  ok(Math.abs(b.p.y - 0.42) < 0.03, `床の上で静止 y=${b.p.y.toFixed(3)}`);
}

// 2. 坂を下る
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 5, 0), half: new THREE.Vector3(3, 0.1, 1), angleZ: -0.25, friction: 0.02 }));
  const b = makeBall(-1, 6);
  run(w, [b], 1.0);
  ok(b.p.x > -0.5 && b.v.x > 0.5, `坂を下る x=${b.p.x.toFixed(2)} vx=${b.v.x.toFixed(2)}`);
}

// 3. 高速でも貫通しない
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(3, 0.1, 1) }));
  const b = makeBall(0, 8);
  b.v.set(0, -13, 0);
  run(w, [b], 1.5);
  ok(b.p.y > 0.3, `貫通しない y=${b.p.y.toFixed(3)}`);
}

// 4. ペグ(円柱)
{
  const w = new PhysicsWorld();
  w.add(new CylinderZCollider({ center: new THREE.Vector3(0.05, 3, 0), radius: 0.13 }));
  const b = makeBall(0, 5);
  let hit = false;
  for (let i = 0; i < 90; i++) w.step([b], 1 / 60, () => { hit = true; });
  ok(hit && Math.abs(b.p.x) > 0.1, `ペグで弾かれる x=${b.p.x.toFixed(2)}`);
}

// 5. 動く床に乗って上昇
{
  const w = new PhysicsWorld();
  const plat = w.add(new BoxCollider({ center: new THREE.Vector3(0, 1, 0), half: new THREE.Vector3(0.5, 0.1, 0.5) }));
  const b = makeBall(0, 2);
  run(w, [b], 1.0);
  for (let i = 0; i < 120; i++) {
    plat.center.y += 1.5 / 60;
    plat.linVel.set(0, 1.5, 0);
    w.step([b], 1 / 60);
  }
  ok(b.p.y > 2.7, `動く床で上昇 y=${b.p.y.toFixed(2)}`);
}

// 6. 玉同士の衝突: 転がってきた玉が静止玉を押し出し、音イベントが出る
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(6, 0.1, 1), friction: 0.01 }));
  const a = makeBall(-2, 0.45);
  a.v.set(3, 0, 0);
  const b = makeBall(0, 0.45);
  let hit = false;
  for (let i = 0; i < 120; i++) w.step([a, b], 1 / 60, null, () => { hit = true; });
  ok(hit, '玉同士の衝突イベント');
  ok(b.p.x > 0.3, `静止玉が押し出される x=${b.p.x.toFixed(2)}`);
  ok(a.p.x < b.p.x, '追突側は前に出ない(順序が保たれる)');
}

// 7. 重なった玉は分離される
{
  const w = new PhysicsWorld();
  w.add(new BoxCollider({ center: new THREE.Vector3(0, 0, 0), half: new THREE.Vector3(6, 0.1, 1) }));
  const a = makeBall(0, 0.45);
  const b = makeBall(0.1, 0.45);
  run(w, [a, b], 1.0);
  const d = a.p.distanceTo(b.p);
  ok(d > 0.6, `重なりが解消される dist=${d.toFixed(2)}`);
}

if (failures) { console.error(`physics.test: ${failures} failure(s)`); process.exit(1); }
console.log('physics.test: all ok');
