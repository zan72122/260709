// End-to-end headless smoke, v2: load the REAL room layout with a tiny DOM
// shim, then let a bot play like a child would under the gravity rules —
// chase toys, aim at the ENDS of long things, park under furniture to shake
// toys off, run down the chick family, pop the piñata — and prove the
// sandbox completes.

const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctxStub };
    return {};
  },
  addEventListener() {},
};
globalThis.window = globalThis.window || { addEventListener() {} };

const THREE = await import('../vendor/three.module.min.js');
const { HoleEngine, S, mulberry32, makeDesc } = await import('../src/physics.js');
const { buildRound } = await import('../src/props.js');

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

for (const m of ['../src/hole.js', '../src/room.js', '../src/effects.js']) {
  try { await import(m); console.log('ok   import ' + m); }
  catch (e) { console.log('FAIL import ' + m + ' → ' + e.message); ok = false; }
}

// --- bot player, v2 rules
function endpointOf(p) {
  // THREE rotation.y convention, matching physics._endpoints
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const along = p.desc.sx >= p.desc.sz;
  const hl = p.desc.halfLen * 0.8;
  const ax = along ? c : s, az = along ? -s : c;
  return { x: p.x + ax * hl, z: p.z + az * hl };
}

function targetFor(p, r) {
  // where should the hole go to eat p right now? null = can't yet
  if (p.state === S.GONE || p.state === S.BALLOON) return null;
  if (p.desc.fixture) return null;
  if (p.supportId) return null;
  if (p.desc.walker) return { x: p.x, z: p.z };            // chase!
  if (p.desc.footR <= r * 0.94) return { x: p.x, z: p.z }; // ston / topple
  const elong = p.desc.aspect >= 1.5;
  if (elong && p.desc.slimR <= r * 0.94) return endpointOf(p); // aim at the END
  if (!elong && p.desc.slimR <= r * 1.0) return { x: p.x, z: p.z }; // squeeze
  return null;
}

const seen = new Set();

function playStage(stage, seed) {
  const scene = new THREE.Group();
  const eng = new HoleEngine({ roomW: 20.8, roomD: 13.8, holeR: 0.42, holeX: 0, holeZ: 2.5, seed });
  buildRound(scene, eng, 0, mulberry32(500 + stage * 7), stage);
  const total = eng.remaining();
  const dt = 1 / 60;
  let steps = 0;
  const MAX_STEPS = 60 * 900;
  let launches = 0;

  while (eng.remaining() > 0 && steps < MAX_STEPS) {
    const r = eng.hole.r;
    let goto_ = null, bestD = Infinity;
    let balloon = null, shakeSupport = null;

    for (const p of eng.props) {
      if (p.state === S.BALLOON) { balloon = balloon || p; continue; }
      if (p.supportId && p.state !== S.GONE) {
        const sup = eng.byId.get(p.supportId);
        const shakeable = sup && (sup.desc.topR ||
          (sup.desc.device && (sup.desc.device.type === 'cupboard' || sup.desc.device.type === 'slide')));
        if (shakeable && (sup.desc.fixture || sup.desc.footInR > r || !targetFor(sup, r))) {
          shakeSupport = shakeSupport || sup;   // must be shaken loose first
        }
        continue;
      }
      const t = targetFor(p, r);
      if (!t) continue;
      const d = Math.hypot(t.x - eng.hole.x, t.z - eng.hole.z);
      // walkers are annoying to chase early: prefer static toys, then walkers
      const bias = p.desc.walker ? d + 3 : d;
      if (bias < bestD) { bestD = bias; goto_ = t; }
    }

    if (goto_) {
      eng.setHoleTarget(goto_.x, goto_.z);
    } else if (shakeSupport) {
      eng.setHoleTarget(shakeSupport.x, shakeSupport.z);   // park & rattle
    } else if (balloon) {
      eng.setHoleTarget(balloon.x, balloon.z);
      const d = Math.hypot(balloon.x - eng.hole.x, balloon.z - eng.hole.z);
      if (d < 0.35 && eng.belly.length > 0 && !eng.projectile) {
        if (eng.launch()) launches++;
      }
    } else {
      let smallest = null;
      for (const p of eng.props) {
        if (p.state === S.GONE || p.state === S.BALLOON || p.supportId || p.desc.fixture) continue;
        if (!smallest || p.desc.slimR < smallest.desc.slimR) smallest = p;
      }
      if (smallest) eng.setHoleTarget(smallest.x, smallest.z);
    }

    eng.update(dt);
    for (const ev of eng.events) {
      seen.add(ev.type);
      if (ev.type === 'pinata') {
        const minis = [];
        for (let i = 0; i < 9; i++) {
          minis.push(i % 3 === 0
            ? makeDesc('candy', 0.36, 0.18, 0.18, { name: 'candy' })
            : i % 3 === 1
              ? makeDesc('ball', 0.24, 0.24, 0.24, { round: true, name: 'mini ball' })
              : makeDesc('block', 0.2, 0.2, 0.2, { name: 'mini block' }));
        }
        eng.burstSpawn(minis, ev.x, ev.z);
      }
    }
    eng.events.length = 0;
    steps++;
  }

  const cleared = eng.props.filter((p) => p.state === S.GONE).length;
  console.log(`    stage ${stage}: cleared ${cleared} props (${total} initial) in ${(steps / 60).toFixed(0)}s sim, hole r=${eng.hole.r.toFixed(2)}, launches=${launches}`);
  check(total >= 40, `stage ${stage}: a busy room (${total} props)`);
  check(eng.remaining() === 0, `stage ${stage}: fully clearable`);
  check(steps < MAX_STEPS, `stage ${stage}: finished before the timeout`);
  check(eng.props.filter((p) => p.desc.fixture).every((p) => p.state !== S.GONE),
    `stage ${stage}: fixtures stayed bolted down`);
  return eng;
}

const eng0 = playStage(0, 1000);
check(eng0.props.some((p) => p.desc.walker && p.desc.walker.kind === 'dog'), 'stage 0: has the puppy');
const eng1 = playStage(1, 1013);
check(eng1.props.some((p) => p.desc.walker && p.desc.walker.kind === 'cat'), 'stage 1: has the cat');
check(eng1.props.some((p) => p.desc.device && p.desc.device.type === 'slide'), 'stage 1: has the slide');

// (catapult is covered deterministically in physics-test.mjs — in a free
// play-through the bot may shake the ball off the seesaw before flipping it)
for (const t of ['fallStart', 'topple', 'tipStart', 'wallBump', 'swallow', 'waterFill',
  'glug', 'detach', 'shakeRattle', 'slideOff', 'pinata', 'catchWalker', 'walkerCry',
  'seesawFlip', 'cupboardOpen', 'tramp', 'slideExit', 'burp', 'catJump', 'dogNudge']) {
  check(seen.has(t), `feel: ${t} happened during normal clears`);
}
console.log('    event types seen:', [...seen].sort().join(', '));

console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
