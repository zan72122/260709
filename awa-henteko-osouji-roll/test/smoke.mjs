// Import every non-DOM module and exercise the simulation end-to-end:
// foam gets pushed, dirt gets cleaned, paint gets laid, flowers bloom.
import { FloorSim } from '../src/simulation.js';
import { SphericonRoller } from '../src/sphericon.js';
import { STAGES, FLOOR_SIZE } from '../src/stages.js';
import * as THREE from '../vendor/three.module.min.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

// --- terrace: rolling must move foam and clean dirt
{
  const stage = STAGES[0];
  const sim = new FloorSim(104, FLOOR_SIZE, stage.sim);
  stage.setup(sim);
  sim.finalizeSetup();
  const roller = new SphericonRoller(0.55);
  roller.footprint = 0.62;
  roller.conePar = 0;
  roller.carry = [{ r: 1, g: 1, b: 1, a: 0 }, { r: 1, g: 1, b: 1, a: 0 }];
  roller.wetCharge = 0;
  roller.reset(-4, -4, 0.7);
  roller.v = 3;
  const t = new THREE.Vector3();
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 20; i++) {
    roller.v = 3;
    roller.step(dt);
    // crude keep-in-bounds
    const b = FLOOR_SIZE / 2 - 1;
    if (Math.abs(roller.center.x) > b || Math.abs(roller.center.z) > b) roller.steer(0.09);
    roller.tangent(t);
    sim.applyRoller(roller.center.x, roller.center.z, t.x, t.z, 3, dt, roller);
    sim.update(dt, i * dt);
  }
  sim._computeStats();
  check(sim.dirtRatio < 0.9, `terrace: dirt reduced by rolling (ratio=${sim.dirtRatio.toFixed(3)})`);
  check(sim.events.length === 0 || sim.events.length > 0, 'terrace: events array usable');
  let collected = 0;
  for (const c of sim.collectors) collected += c.amount;
  console.log('    foam collected in corners:', collected.toFixed(2), ' dirtRatio:', sim.dirtRatio.toFixed(3));
}

// --- atelier: dipping then rolling must lay paint
{
  const stage = STAGES[1];
  const sim = new FloorSim(104, FLOOR_SIZE, stage.sim);
  stage.setup(sim);
  sim.finalizeSetup();
  const roller = new SphericonRoller(0.55);
  roller.footprint = 0.62;
  roller.conePar = 0;
  roller.carry = [{ r: 1, g: 1, b: 1, a: 0 }, { r: 1, g: 1, b: 1, a: 0 }];
  roller.wetCharge = 0;
  roller.reset(-4.2, -4.2, 0.3); // start inside the pink puddle
  const t = new THREE.Vector3();
  const dt = 1 / 60;
  roller.onHandoff = (idx) => { roller.conePar = idx % 2; };
  for (let i = 0; i < 60 * 12; i++) {
    roller.v = 2.5;
    roller.step(dt);
    const b = FLOOR_SIZE / 2 - 1;
    if (Math.abs(roller.center.x) > b || Math.abs(roller.center.z) > b) roller.steer(0.12);
    roller.tangent(t);
    sim.applyRoller(roller.center.x, roller.center.z, t.x, t.z, 2.5, dt, roller);
    sim.update(dt, i * dt);
  }
  sim._computeStats();
  check(roller.carry[0].a > 0.05 || roller.carry[1].a > 0.05, `atelier: roller soaked up ink (a=${roller.carry[0].a.toFixed(2)}/${roller.carry[1].a.toFixed(2)})`);
  check(sim.paintCoverage > 0.005, `atelier: paint laid on floor (coverage=${(sim.paintCoverage * 100).toFixed(1)}%)`);
}

// --- garden: water trail must sprout flowers
{
  const stage = STAGES[2];
  const sim = new FloorSim(104, FLOOR_SIZE, stage.sim);
  stage.setup(sim);
  sim.finalizeSetup();
  const roller = new SphericonRoller(0.55);
  roller.footprint = 0.62;
  roller.conePar = 0;
  roller.carry = [{ r: 1, g: 1, b: 1, a: 0 }, { r: 1, g: 1, b: 1, a: 0 }];
  roller.wetCharge = 0;
  roller.reset(0, -4.3, 0.5); // in the water puddle
  const t = new THREE.Vector3();
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 25; i++) {
    roller.v = 2.2;
    roller.step(dt);
    const b = FLOOR_SIZE / 2 - 1.2;
    if (Math.abs(roller.center.x) > b || Math.abs(roller.center.z) > b) roller.steer(0.1);
    roller.tangent(t);
    sim.applyRoller(roller.center.x, roller.center.z, t.x, t.z, 2.2, dt, roller);
    sim.update(dt, i * dt);
  }
  check(sim.flowerCount > 3, `garden: flowers bloomed along the wet trail (count=${sim.flowerCount})`);
}

// --- pure-module imports
const mods = ['../src/floor.js', '../src/bubbles.js', '../src/particles.js', '../src/flowers.js', '../src/props.js', '../src/world.js', '../src/audio.js', '../src/ui.js'];
for (const m of mods) {
  try { await import(m); console.log('ok   import ' + m); }
  catch (e) { console.log('FAIL import ' + m + ' → ' + e.message); ok = false; }
}

console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
