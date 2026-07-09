// Pure-logic tests for tower-core.js (no browser needed).
import { strict as assert } from 'node:assert';
import {
  judgeLanding, WobbleSpring, relaxOffsets, absoluteCenters,
  countToppling, scoreStars, isMilestone,
} from '../src/tower-core.js';

// ---- judgeLanding
{
  const r = 1.0;
  assert.equal(judgeLanding(0, 0, r, 0.8).result, 'perfect');
  const p = judgeLanding(0.1, 0.1, r, 0.8);
  assert.equal(p.result, 'perfect');
  assert.equal(p.x, 0, 'perfect snaps to centre');

  const g = judgeLanding(0.5, 0, r, 0.8);
  assert.equal(g.result, 'good');
  assert.ok(g.x > 0 && g.x < 0.5, 'good is pulled toward centre');

  const e = judgeLanding(0.95, 0, r, 0.8);
  assert.equal(e.result, 'edge');
  assert.ok(Math.hypot(e.x, e.z) <= r * 0.72 + 1e-9, 'edge clamps inside support');

  assert.equal(judgeLanding(2.5, 0, r, 0.8).result, 'miss');
}

// ---- WobbleSpring decays and stays non-negative
{
  const w = new WobbleSpring();
  w.pump(0.9, 1, 0);
  assert.ok(w.energy > 0.8);
  for (let i = 0; i < 600; i++) w.step(1 / 60);
  assert.ok(w.energy < 0.35, `energy decays (got ${w.energy})`);
  w.calm(10);
  assert.equal(w.energy, 0);
  const l = w.lean();
  assert.ok(Number.isFinite(l.x) && Number.isFinite(l.z));
}

// ---- relaxOffsets pulls the stack straight
{
  const pieces = [
    { x: 0, z: 0, r: 1 },
    { x: 0.4, z: 0, r: 1 },
    { x: 0.3, z: 0.2, r: 1 },
  ];
  const before = Math.hypot(0.7, 0.2);
  let drift = Infinity;
  for (let i = 0; i < 600; i++) drift = relaxOffsets(pieces, 1 / 60); // ~10s
  assert.ok(drift < before * 0.65, `drift shrinks (${drift})`);
  const abs = absoluteCenters(pieces);
  assert.equal(abs.length, 3);
  assert.ok(Math.abs(abs[2].x) < 0.7);
}

// ---- countToppling
{
  const stable = [
    { x: 0, z: 0, r: 1 },
    { x: 0.3, z: 0, r: 1 },
    { x: -0.2, z: 0.1, r: 1 },
  ];
  assert.equal(countToppling(stable), 0);

  const bad = [
    { x: 0, z: 0, r: 1 },
    { x: 1.5, z: 0, r: 0.8 },  // way past the support radius
    { x: 0.1, z: 0, r: 0.8 },
  ];
  assert.equal(countToppling(bad), 2, 'everything above the break falls (max 3)');

  const check = [
    { x: 0, z: 0, r: 1 },
    { x: 1.5, z: 0, r: 0.8, checkpoint: true }, // giant pancake never falls
  ];
  assert.equal(countToppling(check), 0);
}

// ---- score & milestones
{
  assert.equal(scoreStars(3, 0), 1);
  assert.equal(scoreStars(14, 0), 2);
  assert.equal(scoreStars(30, 0), 3);
  assert.equal(scoreStars(5, 11), 3);
  assert.ok(isMilestone(5) && isMilestone(10) && !isMilestone(7) && !isMilestone(0));
}

console.log('core-test: all assertions passed ✔');
