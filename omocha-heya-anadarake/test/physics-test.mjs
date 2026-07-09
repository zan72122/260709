// Unit tests for the v2 gravity-based hole behaviours.
// The golden rule under test: things FALL — nothing is sucked sideways.

import { HoleEngine, S, makeDesc, circleOverlapArea } from '../src/physics.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

function makeEngine(r, x = 0, z = 0) {
  const e = new HoleEngine({ roomW: 20, roomD: 14, holeR: r, holeX: x, holeZ: z, seed: 7 });
  e.hole.rTarget = r; e.hole.rShow = r;
  e.setHoleTarget(x, z);
  return e;
}

function run(eng, seconds) {
  const evs = [];
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    eng.update(dt);
    evs.push(...eng.events);
    eng.events.length = 0;
  }
  return evs;
}

function chase(eng, prop, seconds) {
  const evs = [];
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    if (prop.state !== S.GONE) eng.setHoleTarget(prop.x, prop.z);
    eng.update(dt);
    evs.push(...eng.events);
    eng.events.length = 0;
  }
  return evs;
}

const has = (evs, type, pred = () => true) => evs.some((e) => e.type === type && pred(e));

// ---------------------------------------------------------------- geometry
{
  const a = circleOverlapArea(1, 2, 0);
  check(Math.abs(a - Math.PI) < 1e-6, 'overlap: small circle fully inside big one');
  check(circleOverlapArea(1, 1, 3) === 0, 'overlap: distant circles do not overlap');
}

// ---------------------------------------------------------------- 吸引ゼロ回帰
{
  const eng = makeEngine(0.5, 0, 0);
  // COM safely outside the hole: it must lean at most — NEVER slide closer
  const box = eng.addProp(makeDesc('box', 0.5, 0.4, 0.5), 0.72, 0);
  const x0 = box.x;
  run(eng, 3);
  check(Math.abs(box.x - x0) < 0.02, `no-suction: box does not creep toward the hole (moved ${(box.x - x0).toFixed(3)})`);
  check(box.state !== S.GONE, 'no-suction: box not swallowed while COM is supported');
  const ball = eng.addProp(makeDesc('ball', 0.4, 0.4, 0.4, { round: true }), 0, 0.78);
  const z0 = ball.z;
  run(eng, 3);
  check(Math.abs(ball.z - z0) < 0.02, 'no-suction: even a ball stays put at the edge');
}

// ---------------------------------------------------------------- ストン
{
  const eng = makeEngine(0.6);
  const ball = eng.addProp(makeDesc('ball', 0.4, 0.4, 0.4, { round: true }), 0.05, 0);
  const evs = run(eng, 2);
  check(has(evs, 'fallStart', (e) => e.style === 'clean'), 'ston: fully-over ball free-falls cleanly');
  check(ball.state === S.GONE, 'ston: ball swallowed');
  check(eng.hole.rTarget > 0.6, 'ston: hole grew');
}

// ---------------------------------------------------------------- ゴロン (rim topple)
{
  const eng = makeEngine(0.5);
  // COM just over the hole, footprint still on the rim → pivots in
  const ball = eng.addProp(makeDesc('ball', 0.5, 0.5, 0.5, { round: true }), 0.42, 0);
  const evs = run(eng, 3);
  check(has(evs, 'topple'), 'topple: rim ball commits by tipping over the edge');
  check(has(evs, 'fallStart', (e) => e.style === 'topple'), 'topple: converts into a real fall');
  check(ball.state === S.GONE, 'topple: swallowed after the tumble');
}

// ---------------------------------------------------------------- コツン (shaft wall bounce)
{
  const eng = makeEngine(0.55);
  // a toy tumbling in with sideways speed must clang off the shaft wall
  const box = eng.addProp(makeDesc('box', 0.42, 0.42, 0.42), 0.1, 0);
  box.state = S.FALLING;
  box.vx = 3; box.vy = -1; box.y = -0.5;
  const evs = run(eng, 3);
  check(has(evs, 'wallBump'), 'bump: falling toy knocks against the shaft wall');
  check(box.state === S.GONE, 'bump: still ends up swallowed');
  // and it must not have been re-centred: bumps mean real wall contact
  const bump = evs.find((e) => e.type === 'wallBump');
  check(bump && Math.abs(bump.x) > 0.1, 'bump: contact happened at the wall, not the centre');
}

// ---------------------------------------------------------------- ぐらぐら
{
  const eng = makeEngine(0.5, 0, 0);
  const box = eng.addProp(makeDesc('box', 1.4, 0.6, 1.4), 1.1, 0);
  let evs = run(eng, 1.5);
  check(has(evs, 'teeter'), 'teeter: big box leans over the edge');
  check(Math.abs(box.tiltZ) + Math.abs(box.tiltX) > 0.02, 'teeter: visibly leaning');
  eng.setHoleTarget(6, 0);
  run(eng, 3);
  check(box.state === S.REST, 'teeter: springs back when the hole leaves');
}

// ---------------------------------------------------------------- するっ (end-first dive)
{
  const eng = makeEngine(0.3);
  const crayon = eng.addProp(makeDesc('crayon', 0.9, 0.18, 0.18), 0.5, 0);
  // hole sits under the LEFT end of the crayon (endpoint at x≈0.14)
  const evs = run(eng, 3);
  check(has(evs, 'tipStart'), 'endtip: crayon dives in end-first');
  check(crayon.state === S.GONE, 'endtip: crayon swallowed lengthwise');
}

// ---------------------------------------------------------------- 正直な橋渡し
{
  const eng = makeEngine(0.3);
  // hole under the MIDDLE: both ends still on the floor → honest bridge
  const crayon = eng.addProp(makeDesc('crayon', 0.9, 0.18, 0.18), 0.02, 0);
  const evs = run(eng, 4);
  check(has(evs, 'bridge'), 'bridge: crayon spans a small central hole');
  check(crayon.state === S.BRIDGE, 'bridge: still bridging');
  check(crayon.state !== S.GONE, 'bridge: NOT swallowed from the middle (v2 rule)');
  // slide the hole toward one end → now it goes
  eng.setHoleTarget(0.45, 0);
  const evs2 = run(eng, 4);
  check(crayon.state === S.GONE, 'bridge: moving the hole to the end swallows it');
}

// ---------------------------------------------------------------- ぎゅっ / ぽんっ
{
  const eng = makeEngine(0.34);
  const ball = eng.addProp(makeDesc('ball', 0.68, 0.68, 0.68, { round: true }), 0.03, 0);
  const evs = run(eng, 4);
  check(has(evs, 'stuckStart'), 'squeeze: near-size ball wedges');
  check(has(evs, 'squeezeThrough'), 'squeeze: then pops through');
  check(ball.state === S.GONE, 'squeeze: swallowed');
}
{
  const eng = makeEngine(0.3);
  const ball = eng.addProp(makeDesc('ball', 0.69, 0.69, 0.69, { round: true }), 0.02, 0);
  const evs = run(eng, 5);
  check(has(evs, 'stuckStart') && has(evs, 'popOut'), 'popout: too-big ball wedges then pops out');
  check(ball.state === S.REST && ball.y >= 0, 'popout: back on the floor');
}

// ---------------------------------------------------------------- ガタガタ (wheel catch)
{
  const eng = makeEngine(0.4, 0, 0);
  const trikeDesc = makeDesc('tricycle', 1.3, 0.95, 0.68, {
    wheels: [{ x: 0.45, z: 0, r: 0.3 }, { x: -0.4, z: 0.3, r: 0.18 }, { x: -0.4, z: -0.3, r: 0.18 }],
  });
  const trike = eng.addProp(trikeDesc, -0.45, 0);
  let evs = run(eng, 1.5);
  check(has(evs, 'wheelCatch') && has(evs, 'wheelRattle'), 'wheel: front wheel dips and rattles');
  check(trike.state === S.WHEEL && trike.sink > 0.02, 'wheel: trike caught, visibly dipped');
  eng.setHoleTarget(6, 0);
  evs = run(eng, 3);
  check(has(evs, 'wheelFree') && trike.state === S.REST, 'wheel: freed when hole leaves');
  eng.hole.rTarget = 0.75; eng.hole.r = 0.75;
  chase(eng, trike, 6);
  check(trike.state === S.GONE, 'wheel: bigger hole gets the whole trike');
}

// ---------------------------------------------------------------- 積み木タワー崩壊
{
  const eng = makeEngine(0.42, 0, 0);
  const blocks = [];
  let below = eng.addProp(makeDesc('block', 0.34, 0.34, 0.34), 0.02, 0);
  blocks.push(below);
  for (let i = 1; i < 5; i++) {
    below = eng.addProp(makeDesc('block', 0.34, 0.34, 0.34), 0.02, 0, { y: 0.34 * i, supportId: below.id });
    blocks.push(below);
  }
  const evs = run(eng, 4);
  check(blocks[0].state === S.GONE, 'tower: base block swallowed');
  check(evs.filter((e) => e.type === 'detach').length >= 4, 'tower: whole tower cascades loose');
  for (const b of blocks.slice(1)) {
    check(b.supportId === null, `tower: block became dynamic`);
  }
  for (const b of blocks.slice(1)) {
    if (b.state !== S.GONE) chase(eng, b, 5);
  }
  check(blocks.every((b) => b.state === S.GONE), 'tower: chasing the scattered blocks eats them all');
}

// ---------------------------------------------------------------- 揺すり落とし (fixture shake-off)
{
  const eng = makeEngine(0.6, 0, 0);
  const shelf = eng.addProp(
    makeDesc('wallshelf', 2.3, 2.0, 0.6, { fixture: true, topR: 0.8, topY: 1.96 }), 0, 0);
  const ballOnTop = eng.addProp(makeDesc('ball', 0.4, 0.4, 0.4, { round: true }), 0.3, 0,
    { y: 1.96, supportId: shelf.id });
  check(eng.remaining() === 1, 'shake: fixture does not count toward the goal');
  const evs = run(eng, 8);
  check(has(evs, 'shakeRattle'), 'shake: parking the hole underneath rattles the shelf');
  check(has(evs, 'slideOff'), 'shake: the ball creeps off the edge and drops');
  check(shelf.state !== S.GONE, 'shake: the bolted shelf itself never falls');
  if (ballOnTop.state !== S.GONE) chase(eng, ballOnTop, 5);
  check(ballOnTop.state === S.GONE, 'shake: dropped ball can then be eaten');
}

// ---------------------------------------------------------------- ピニャータ
{
  const eng = makeEngine(0.75, 0, 0);
  const chest = eng.addProp(
    makeDesc('toychest', 1.15, 0.95, 0.68, { pinata: true, topR: 0.5, topY: 0.94 }), 0.05, 0);
  const evs = chase(eng, chest, 6);
  check(chest.state === S.GONE, 'pinata: chest swallowed');
  check(has(evs, 'pinata'), 'pinata: burst event fired');
  const minis = eng.burstSpawn(
    [makeDesc('candy', 0.36, 0.18, 0.18), makeDesc('ball', 0.24, 0.24, 0.24, { round: true })], 0, 0);
  check(minis.length === 2 && minis.every((m) => m.state === S.TOSSED), 'pinata: contents burst out ballistically');
  for (const m of minis) chase(eng, m, 5);
  check(minis.every((m) => m.state === S.GONE), 'pinata: contents can be eaten afterwards');
}

// ---------------------------------------------------------------- ヒヨコ (flee & catch)
{
  const eng = makeEngine(0.5, 0, 0);
  const hen = eng.addProp(
    makeDesc('hen', 0.5, 0.7, 0.5, { round: true, walker: { speed: 0.85, flee: 2.3 } }), 1.6, 0);
  // hole sits still nearby: the hen must run AWAY
  const d0 = Math.hypot(hen.x, hen.z);
  const evs = run(eng, 1.5);
  const d1 = Math.hypot(hen.x - eng.hole.x, hen.z - eng.hole.z);
  check(has(evs, 'walkerCry'), 'walker: hen panics near the hole');
  check(d1 > d0, `walker: hen flees (dist ${d0.toFixed(2)} → ${d1.toFixed(2)})`);
  // now actually chase her down — the hole is faster
  const evs2 = chase(eng, hen, 8);
  check(hen.state === S.GONE, 'walker: cornered hen falls in');
  check(has(evs2, 'catchWalker'), 'walker: catching her is celebrated');
}

// ---------------------------------------------------------------- 風船・水 (v1 carry-over)
{
  const eng = makeEngine(1.5, 0, 0);
  const gift = eng.addProp(makeDesc('gift', 0.42, 0.42, 0.42, { balloon: true }), 0.05, 0);
  let evs = run(eng, 4);
  check(has(evs, 'balloonFly'), 'balloon: knot slips under a huge patient hole');
  run(eng, 4);
  check(gift.state === S.GONE, 'balloon: dropped gift gets swallowed');
}
{
  const eng = makeEngine(0.9, 0, 0);
  const tub = eng.addProp(makeDesc('bathtub', 1.7, 0.75, 1.15, { round: true, waterSource: true }), 0.05, 0);
  let evs = chase(eng, tub, 6);
  check(tub.state === S.GONE && has(evs, 'waterFill'), 'water: bathtub fills the hole');
  const duck = eng.addProp(makeDesc('duck', 0.6, 0.66, 0.52, { round: true, buoyant: true }), eng.hole.x + 0.05, eng.hole.z);
  evs = run(eng, 12);
  check(has(evs, 'splashFloat') && has(evs, 'glug'), 'water: duck floats, then glugs under');
  check(duck.state === S.GONE, 'water: duck finally swallowed');
}

console.log(ok ? 'PHYSICS PASS' : 'PHYSICS FAIL');
process.exit(ok ? 0 : 1);
