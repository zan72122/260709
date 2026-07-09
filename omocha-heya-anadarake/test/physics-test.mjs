// Unit tests for the hand-shaped hole behaviours. Each scenario pins the
// hole somewhere, drops in a prop, steps the engine, and asserts the state
// transitions + events that give the game its feel.

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

// steer the hole to follow a prop (like a player chasing a toy)
function chase(eng, prop, seconds) {
  const evs = [];
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    if (prop.state !== 'gone') eng.setHoleTarget(prop.x, prop.z);
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
  const half = circleOverlapArea(1, 1, 0.5);
  check(half > 0 && half < Math.PI, 'overlap: partial overlap is partial');
}

// ---------------------------------------------------------------- ストン
{
  const eng = makeEngine(0.6);
  const ball = eng.addProp(makeDesc('ball', 0.4, 0.4, 0.4, { round: true }), 0.05, 0);
  const evs = run(eng, 2);
  check(has(evs, 'fallStart', (e) => e.style === 'clean'), 'ston: small ball over big hole drops cleanly');
  check(ball.state === S.GONE, 'ston: ball swallowed');
  check(has(evs, 'swallow'), 'ston: swallow event fired');
  check(eng.hole.rTarget > 0.6, 'ston: hole grew after swallowing');
}

// ---------------------------------------------------------------- ころころ
{
  const eng = makeEngine(0.5);
  // round ball resting just at the rim: should roll/slide in from the edge
  const ball = eng.addProp(makeDesc('ball', 0.5, 0.5, 0.5, { round: true }), 0.42, 0);
  const evs = run(eng, 3);
  check(has(evs, 'slideStart'), 'roll: rim ball commits to sliding in');
  check(ball.state === S.GONE, 'roll: rim ball eventually swallowed');
}

// ---------------------------------------------------------------- ぐらぐら
{
  const eng = makeEngine(0.5, 0, 0);
  // box too big to fall, only a corner over the hole → teeter, then recover
  const box = eng.addProp(makeDesc('box', 1.4, 0.6, 1.4), 1.1, 0);
  let evs = run(eng, 1.5);
  check(has(evs, 'teeter'), 'teeter: big box leans over the edge');
  check(box.state === S.TEETER || box.state === S.REST, 'teeter: box does not fall');
  const leanBefore = Math.abs(box.tiltZ) + Math.abs(box.tiltX);
  check(leanBefore > 0.02, 'teeter: box is visibly leaning');
  eng.setHoleTarget(6, 0);        // hole leaves
  evs = run(eng, 3);
  check(box.state === S.REST, 'teeter: box springs back to rest when hole leaves');
}

// ---------------------------------------------------------------- するっ (tip-in)
{
  const eng = makeEngine(0.3);
  // crayon: long & thin — footprint circle never fits, but it can tip in
  const crayon = eng.addProp(makeDesc('crayon', 0.9, 0.18, 0.18), 0.05, 0);
  const evs = run(eng, 3);
  check(has(evs, 'tipStart'), 'tip: crayon tips upright over the hole');
  check(crayon.state === S.GONE, 'tip: crayon slips through lengthwise');
}

// ---------------------------------------------------------------- ぎゅっ (squeeze)
{
  const eng = makeEngine(0.34);
  // ball barely bigger than the hole → wedge, wobble, then squeeze through
  const ball = eng.addProp(makeDesc('ball', 0.68, 0.68, 0.68, { round: true }), 0.03, 0);
  const evs = run(eng, 4);
  check(has(evs, 'stuckStart'), 'squeeze: near-size ball wedges in the mouth');
  check(has(evs, 'stuckWobble'), 'squeeze: wedged ball wobbles');
  check(has(evs, 'squeezeThrough'), 'squeeze: then pops through');
  check(ball.state === S.GONE, 'squeeze: ball swallowed after squeezing');
}

// ---------------------------------------------------------------- ぽんっ (pop out)
{
  const eng = makeEngine(0.3);
  // clearly too big to squeeze (ratio ~1.15) → wedges, then pops back out
  const ball = eng.addProp(makeDesc('ball', 0.69, 0.69, 0.69, { round: true }), 0.02, 0);
  const evs = run(eng, 5);
  check(has(evs, 'stuckStart'), 'popout: too-big ball wedges first');
  check(has(evs, 'popOut'), 'popout: then pops back out');
  check(ball.state !== S.GONE, 'popout: ball not swallowed');
  check(ball.y >= 0 && ball.state === S.REST, 'popout: ball back resting on the floor');
}

// ---------------------------------------------------------------- ガタガタ (wheel catch)
{
  const eng = makeEngine(0.4, 0, 0);
  const trikeDesc = makeDesc('tricycle', 1.3, 0.95, 0.68, {
    wheels: [{ x: 0.45, z: 0, r: 0.3 }, { x: -0.4, z: 0.3, r: 0.18 }, { x: -0.4, z: -0.3, r: 0.18 }],
  });
  // front wheel parked right over the hole; body (slimR≈0.58) can't fit r=0.4
  const trike = eng.addProp(trikeDesc, -0.45, 0);
  let evs = run(eng, 1.5);
  check(trikeDesc.slimR > 0.4, 'wheel: sanity — trike body cannot fit this hole');
  check(has(evs, 'wheelCatch'), 'wheel: front wheel dips into the hole');
  check(has(evs, 'wheelRattle'), 'wheel: rattles while caught');
  check(trike.state === S.WHEEL, 'wheel: trike is caught by the wheel');
  check(trike.sink > 0.02, 'wheel: trike visibly dips');
  eng.setHoleTarget(6, 0);
  evs = run(eng, 3);
  check(has(evs, 'wheelFree'), 'wheel: freed when hole moves away');
  check(trike.state === S.REST, 'wheel: trike returns to rest');
  // now grow the hole so the whole trike fits → dramatic slide-in
  eng.hole.rTarget = 0.75; eng.hole.r = 0.75;
  eng.setHoleTarget(trike.x, trike.z);
  evs = run(eng, 6);
  check(trike.state === S.GONE, 'wheel: bigger hole swallows the whole trike');
}

// ---------------------------------------------------------------- 橋渡し (bridge)
{
  const eng = makeEngine(0.5);
  const bed = eng.addProp(makeDesc('bed', 2.3, 1.0, 1.3), 0, 0);
  const evs = run(eng, 2);
  check(has(evs, 'bridge'), 'bridge: bed spans a small hole');
  check(bed.state === S.BRIDGE, 'bridge: bed stays in bridge state');
  check(bed.state !== S.GONE, 'bridge: bed does not fall');
}

// ---------------------------------------------------------------- 積み木くずし (stack detach)
{
  const eng = makeEngine(0.4, 0, 0);
  const base = eng.addProp(makeDesc('block', 0.34, 0.34, 0.34), 0.02, 0);
  const top = eng.addProp(makeDesc('block', 0.34, 0.34, 0.34), 0.02, 0, { y: 0.34, supportId: base.id });
  const evs = run(eng, 4);
  check(base.state === S.GONE, 'stack: base block swallowed');
  check(has(evs, 'detach'), 'stack: top block knocked loose');
  check(top.supportId === null, 'stack: top block became dynamic');
  chase(eng, top, 6);
  check(top.state === S.GONE, 'stack: chasing the scattered block swallows it too');
}

// ---------------------------------------------------------------- 発射 (launch + knock off)
{
  const eng = makeEngine(0.5, 0, 0);
  const ball = eng.addProp(makeDesc('ball', 0.4, 0.4, 0.4, { round: true }), 0.02, 0);
  const table = eng.addProp(makeDesc('table', 1.74, 1.06, 1.74, { round: true }), 1.6, 0);
  const cup = eng.addProp(makeDesc('cup', 0.2, 0.13, 0.18, { round: true }), 1.6, 0.2, { y: 1.05, supportId: table.id });
  run(eng, 2);
  check(eng.belly.length === 1, 'launch: swallowed ball waits in the belly');
  check(eng.launch(), 'launch: launch fires');
  const evs = run(eng, 4);
  check(has(evs, 'land'), 'launch: projectile lands back down');
  check(has(evs, 'shock'), 'launch: landing sends a shockwave');
  check(cup.supportId === null && cup.state !== S.REST || cup.y < 1.0 || cup.state === S.GONE || has(evs, 'knockOff'),
    'launch: cup knocked off the table by the shock');
  check(ball.state === S.REST || ball.state === S.TOSSED || ball.state === S.GONE,
    'launch: projectile returns to the world');
}

// ---------------------------------------------------------------- 風船 (balloon)
{
  const eng = makeEngine(1.5, 0, 0);
  const gift = eng.addProp(makeDesc('gift', 0.42, 0.42, 0.42, { balloon: true }), 0.05, 0);
  let evs = run(eng, 0.5);
  check(gift.state === S.BALLOON, 'balloon: gift hovers, immune to the hole');
  // rescue rule: big hole parked underneath → balloon slips away, gift falls
  evs = run(eng, 3);
  check(has(evs, 'balloonFly'), 'balloon: knot slips under a huge patient hole');
  const evs2 = run(eng, 4);
  check(gift.state === S.GONE, 'balloon: dropped gift gets swallowed');
}

// ---------------------------------------------------------------- おふろの水 (water)
{
  const eng = makeEngine(0.9, 0, 0);
  const tub = eng.addProp(makeDesc('bathtub', 1.7, 0.75, 1.15, { round: true, waterSource: true }), 0.05, 0);
  let evs = run(eng, 6);
  check(tub.state === S.GONE, 'water: bathtub swallowed');
  check(has(evs, 'waterFill') && eng.hole.water > 0, 'water: hole fills with bath water');
  const duck = eng.addProp(makeDesc('duck', 0.6, 0.66, 0.52, { round: true, buoyant: true }), eng.hole.x + 0.05, eng.hole.z);
  evs = run(eng, 3);
  check(has(evs, 'splashFloat'), 'water: duck splashes in and floats');
  evs = run(eng, 8);
  check(has(evs, 'glug'), 'water: duck glugs under after bobbing');
  check(duck.state === S.GONE, 'water: duck finally swallowed');
}

console.log(ok ? 'PHYSICS PASS' : 'PHYSICS FAIL');
process.exit(ok ? 0 : 1);
