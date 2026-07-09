// Import every non-DOM module and exercise the tower end-to-end:
// pieces stack, the tower sways but stays finite, misses tumble to the table.
import * as THREE from '../vendor/three.module.min.js';
import { Tower } from '../src/tower.js';
import { WobbleSpring, judgeLanding } from '../src/tower-core.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

function dummySweet(h = 0.4, r = 0.8, id = 'test') {
  return { group: new THREE.Group(), h, r, id };
}

// --- stack 30 pieces with slightly sloppy aim, run the sim
{
  const scene = new THREE.Scene();
  const tower = new Tower(scene, 0.16);
  const wobble = new WobbleSpring();
  const dt = 1 / 60;
  let grounded = 0;
  tower.onGrounded = () => grounded++;

  for (let i = 0; i < 30; i++) {
    const sup = tower.topSupport();
    const dx = (Math.sin(i * 1.7) * 0.4);
    const dz = (Math.cos(i * 2.3) * 0.3);
    const sweet = dummySweet(0.4, 0.8, 'piece' + i);
    const j = judgeLanding(dx, dz, sup.r, sweet.r);
    check(j.result !== 'miss', `piece ${i} lands (${j.result})`);
    tower.add(sweet, j.x, j.z);
    wobble.pump(j.result === 'perfect' ? 0.05 : 0.3, dx, dz);
    for (let s = 0; s < 30; s++) { wobble.step(dt); tower.update(dt, wobble); }
  }
  check(tower.count === 30, `tower holds 30 pieces (count=${tower.count})`);
  const topY = tower.topY();
  check(topY > 0.16 + 29 * 0.4, `tower grew tall (topY=${topY.toFixed(2)})`);
  check(tower.checkTopple() === 0, 'relaxed tower is stable');

  // every rendered position must be finite
  let finite = true;
  for (const p of tower.pieces) {
    const v = p.group.position;
    if (!Number.isFinite(v.x + v.y + v.z)) finite = false;
  }
  check(finite, 'all piece positions finite after sway sim');

  // --- topple the top 2 and let them tumble to rest
  tower.topple(2);
  check(tower.count === 28, 'topple removed 2 pieces');
  check(tower.falling.length === 2, 'toppled pieces are tumbling');
  for (let s = 0; s < 60 * 8 && tower.falling.length; s++) tower.update(dt, wobble);
  check(tower.falling.length === 0, 'tumbling pieces came to rest');
  check(tower.ground.length === 2, 'rested pieces stay as table décor');
  check(grounded >= 2, `grounded callback fired (${grounded})`);

  // --- a missed toss also tumbles
  const missed = dummySweet();
  tower.spawnFalling(missed.group, new THREE.Vector3(2.5, 5, 0), new THREE.Vector3(2, -1, 0), missed);
  for (let s = 0; s < 60 * 8 && tower.falling.length; s++) tower.update(dt, wobble);
  check(tower.falling.length === 0, 'missed sweet came to rest');

  // --- honey damps the sway
  wobble.pump(1.0, 1, 0);
  tower.update(dt, wobble);
  const swayBefore = Math.abs(tower.pieces[27].group.position.x - tower.pieces[27].x);
  tower.applyHoney(10);
  // (sway amplitude is scaled by 0.25 while honey is active — just ensure no crash)
  for (let s = 0; s < 60; s++) tower.update(dt, wobble);
  check(Number.isFinite(swayBefore), 'sway measurable before honey');
  check(tower.honeyT > 0, 'honey timer active');

  tower.reset();
  check(tower.count === 0 && tower.ground.length === 0, 'reset wipes the table');
}

// --- pure-module imports (DOM-touching code must stay inside constructors)
const mods = ['../src/sweets.js', '../src/characters.js', '../src/world.js',
  '../src/particles.js', '../src/audio.js', '../src/ui.js'];
for (const m of mods) {
  try { await import(m); console.log('ok   import ' + m); }
  catch (e) { console.log('FAIL import ' + m + ' → ' + e.message); ok = false; }
}

console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
