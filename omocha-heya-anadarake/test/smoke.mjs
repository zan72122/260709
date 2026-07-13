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
  const eng = new HoleEngine({
    roomW: 20.8, roomD: 13.8, holeR: 0.42, holeX: 0, holeZ: 2.5, seed,
    tiltFloor: stage === 2,
  });
  buildRound(scene, eng, 0, mulberry32(500 + stage * 7), stage);
  const total = eng.remaining();
  const dt = 1 / 60;
  let steps = 0;
  const MAX_STEPS = 60 * 1200;
  let launches = 0;
  let maxTilt = 0;
  let koronWave = 0;         // stand-in for main.js state.koronWave
  let nightSpawned = false;  // stand-in for the よるのくに entry
  let flips = 0;

  while (eng.remaining() > 0 && steps < MAX_STEPS) {
    const r = eng.hole.r;
    let goto_ = null, bestD = Infinity;
    let balloon = null, shakeSupport = null, device = null;

    for (const p of eng.props) {
      // a kid ALWAYS runs to a big glowing lever / charged button first
      const dv = p.desc.device;
      if (dv) {
        if (dv.type === 'lever' && dv.count > 0 && !dv.busy) device = p;
        if (dv.type === 'flip' && dv.charge >= dv.need && !dv.busy && flips < 2) device = p;
        if (dv.type === 'cellardoor' && !dv.open) device = p;
      }
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

    if (device) {
      eng.setHoleTarget(device.x, device.z);               // pull the lever!
    } else if (goto_) {
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
    maxTilt = Math.max(maxTilt, Math.abs(eng.tilt));
    for (const ev of eng.events) {
      seen.add(ev.type);
      // stand in for main.js: finish the box-turning cinematics instantly
      if (ev.type === 'lever') {
        koronWave++;
        eng.rainAll({ stagger: 0.06, yMin: 3.5, ySpan: 2.5, scatter: 2 });
        ev.p.desc.device.busy = false;
        if (koronWave === 1) {
          // 壁のものが床のものに + らくがきが本物に (main.js mirror)
          eng.dropSpawn(makeDesc('clocktoy', 0.84, 0.84, 0.24, { round: true }), 4.6, -4.0, { delay: 0.4 });
          eng.dropSpawn(makeDesc('picturetoy', 0.9, 0.08, 0.9), -3.0, -4.0, { delay: 0.5 });
          eng.dropSpawn(makeDesc('picturetoy', 0.9, 0.08, 0.9), 6.9, -4.0, { delay: 0.6 });
          eng.burstSpawn([
            makeDesc('star', 0.4, 0.2, 0.4, { round: true }),
            makeDesc('minicar', 0.5, 0.35, 0.3),
            makeDesc('flower', 0.34, 0.6, 0.34, { round: true }),
          ], -2, -5.4);
        } else if (koronWave === 2) {
          // とびらが床に来た
          eng.addProp(makeDesc('cellardoor', 1.5, 0.25, 1.2, {
            fixture: true, device: { type: 'cellardoor', open: false },
          }), 4.2, -1.5);
        }
      }
      if (ev.type === 'flip') {
        flips++;
        eng.rainAll({ stagger: 0.06, yMin: 3.5, ySpan: 2.5, scatter: 2 });
        ev.p.desc.device.busy = false;
        if (!nightSpawned) {
          nightSpawned = true;
          // よるのくに toys (main.js spawnNightToys mirror)
          const night = [
            ['egg', 'chick'], ['egg', 'chick'], ['egg', 'chick'],
            ['acorn', 'tree'], ['acorn', 'tree'],
            ['sock', 'sockpair'], ['painttube', 'rainbowball'],
            ['star', null], ['star', null], ['star', null],
            ['fireflyjar', null], ['dreambunny', null],
          ];
          night.forEach(([kind, magic], i) => {
            eng.dropSpawn(makeDesc(kind, 0.3, 0.3, 0.3, { round: true, magic }),
              -6 + i, (i % 3) * 2 - 2, { delay: 0.2 + i * 0.1 });
          });
        }
      }
      if (ev.type === 'magic') {
        // たまごのまほう: the eaten toy comes back transformed
        const descs = ev.kind === 'chick'
          ? [makeDesc('chick', 0.24, 0.35, 0.24, { round: true, walker: { speed: 1.1, flee: 2.0 } })]
          : ev.kind === 'sockpair'
            ? [makeDesc('sock', 0.2, 0.4, 0.34), makeDesc('sock', 0.2, 0.4, 0.34)]
            : ev.kind === 'tree'
              ? [makeDesc('minitree', 0.56, 0.9, 0.56, { round: true })]
              : [makeDesc('rainbowball', 0.48, 0.48, 0.48, { round: true })];
        eng.burstSpawn(descs, ev.x, ev.z);
      }
      if (ev.type === 'cellarDoor') {
        // treasure pops out of the trapdoor (main.js mirror)
        const treasure = [];
        for (let i = 0; i < 6; i++) {
          treasure.push(i % 2 === 0
            ? makeDesc('candy', 0.36, 0.18, 0.18, { name: 'candy' })
            : makeDesc('ball', 0.24, 0.24, 0.24, { round: true, name: 'mini ball' }));
        }
        eng.burstSpawn(treasure, ev.x, ev.z);
      }
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
  return { eng, maxTilt };
}

const { eng: eng0 } = playStage(0, 1000);
check(eng0.props.some((p) => p.desc.walker && p.desc.walker.kind === 'dog'), 'stage 0: has the puppy');
const { eng: eng1 } = playStage(1, 1013);
check(eng1.props.some((p) => p.desc.walker && p.desc.walker.kind === 'cat'), 'stage 1: has the cat');
check(eng1.props.some((p) => p.desc.device && p.desc.device.type === 'slide'), 'stage 1: has the slide');
const { maxTilt: tilt2 } = playStage(2, 1027);
check(tilt2 > 0.02, `stage 2: the seesaw floor actually tilted (max ${tilt2.toFixed(3)})`);
check(seen.has('tiltSurgeStart') && seen.has('tiltSurgeEnd'),
  `stage 2: the pegged floor gave way into a なだれ (maxTilt ${tilt2.toFixed(2)})`);
check(tilt2 > 0.25, 'stage 2: the avalanche slope went far past the seesaw limit');
const { eng: eng3 } = playStage(3, 1031);
check(eng3.props.some((p) => p.desc.device && p.desc.device.type === 'lever'), 'stage 3: has the コロン lever');
check(eng3.props.some((p) => p.desc.device && p.desc.device.type === 'walldecor'), 'stage 3: wall clock & pictures on the wall');
check(eng3.props.some((p) => p.desc.device && p.desc.device.type === 'cellardoor' && p.desc.device.open),
  'stage 3: the cellar door appeared after the 2nd コロン and was opened');
check(eng3.puddles.length >= 1, `stage 3: paint pots left ${eng3.puddles.length} colour puddles on the floor`);
const { eng: eng4 } = playStage(4, 1049);
check(eng4.props.some((p) => p.desc.device && p.desc.device.type === 'flip'), 'stage 4: has the flip button');
check(eng4.props.some((p) => p.desc.magic === 'chick'), 'stage 4: よるのくに eggs joined the round');

// (catapult is covered deterministically in physics-test.mjs — in a free
// play-through the bot may shake the ball off the seesaw before flipping it)
for (const t of ['fallStart', 'topple', 'tipStart', 'wallBump', 'swallow', 'waterFill',
  'glug', 'detach', 'shakeRattle', 'slideOff', 'pinata', 'catchWalker', 'walkerCry',
  'seesawFlip', 'cupboardOpen', 'tramp', 'slideExit', 'burp', 'catJump', 'dogNudge',
  'lever', 'flip', 'paintSpill', 'puddle', 'dyed', 'magic', 'cellarDoor',
  'tiltSurgeStart', 'tiltSurgeEnd']) {
  check(seen.has(t), `feel: ${t} happened during normal clears`);
}
console.log('    event types seen:', [...seen].sort().join(', '));

console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
