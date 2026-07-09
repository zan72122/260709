// End-to-end headless smoke: load the REAL room layout (props.js) with a
// tiny DOM shim, then let a bot play the whole sandbox — chase swallowable
// toys, launch at balloons, wait out wedges — and prove the round completes.

// --- minimal DOM shim so canvas-texture builders run under node
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
const { HoleEngine, S, mulberry32 } = await import('../src/physics.js');
const { buildRound } = await import('../src/props.js');

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

// --- import sanity for the DOM-free modules
for (const m of ['../src/hole.js', '../src/room.js', '../src/effects.js']) {
  try { await import(m); console.log('ok   import ' + m); }
  catch (e) { console.log('FAIL import ' + m + ' → ' + e.message); ok = false; }
}

// --- build the real round-0 layout
const scene = new THREE.Group();
const eng = new HoleEngine({ roomW: 20.8, roomD: 13.8, holeR: 0.42, holeX: 0, holeZ: 2.5, seed: 1000 });
const entries = buildRound(scene, eng, 0, mulberry32(500));
const total = eng.remaining();
check(total >= 40, `layout: a busy room (${total} props)`);
check(entries.length === total, 'layout: every prop has a mesh');

// descriptor sanity: everything must eventually fit the max hole
for (const e of entries) {
  const d = e.prop.desc;
  check(d.slimR <= 4.4 || d.footR <= 4.4, `fit: ${d.name} can eventually be swallowed`);
  if (d.slimR > d.footR) { check(false, `fit: ${d.name} slimR>footR`); }
}

// --- the bot player
const seen = new Set();
function canEatNow(p, r) {
  if (p.state === S.GONE || p.state === S.BALLOON) return false;
  if (p.supportId) return false;                     // wait for its support
  if (p.desc.footR <= r * 0.94) return true;         // ston / slide
  if (p.desc.slimR <= r * 0.94 && p.desc.aspect >= 1.5) return true; // tip-in
  if (p.desc.slimR <= r * 1.0) return true;          // squeeze-through range
  return false;
}

const dt = 1 / 60;
let steps = 0;
const MAX_STEPS = 60 * 600;   // 10 sim-minutes hard cap
let launches = 0;

while (eng.remaining() > 0 && steps < MAX_STEPS) {
  const r = eng.hole.r;
  // choose a target
  let target = null, bestD = Infinity;
  let balloon = null;
  for (const e of entries) {
    const p = e.prop;
    if (p.state === S.BALLOON) { balloon = balloon || p; continue; }
    if (!canEatNow(p, r)) continue;
    const d = Math.hypot(p.x - eng.hole.x, p.z - eng.hole.z);
    if (d < bestD) { bestD = d; target = p; }
  }
  if (target) {
    eng.setHoleTarget(target.x, target.z);
  } else if (balloon) {
    eng.setHoleTarget(balloon.x, balloon.z);
    const d = Math.hypot(balloon.x - eng.hole.x, balloon.z - eng.hole.z);
    if (d < 0.35 && eng.belly.length > 0 && !eng.projectile) {
      if (eng.launch()) launches++;
    }
  } else {
    // nothing fits yet: park under the smallest slim prop and wait (wedge)
    let smallest = null;
    for (const e of entries) {
      const p = e.prop;
      if (p.state === S.GONE || p.state === S.BALLOON || p.supportId) continue;
      if (!smallest || p.desc.slimR < smallest.desc.slimR) smallest = p;
    }
    if (smallest) eng.setHoleTarget(smallest.x, smallest.z);
  }
  eng.update(dt);
  for (const ev of eng.events) seen.add(ev.type);
  eng.events.length = 0;
  steps++;
}

const mins = (steps / 60 / 60).toFixed(1);
console.log(`    bot cleared ${total - eng.remaining()}/${total} props in ${(steps / 60).toFixed(0)}s sim (${mins} min), hole r=${eng.hole.r.toFixed(2)}, launches=${launches}`);
check(eng.remaining() === 0, 'clear: the whole room can be swallowed');
check(eng.hole.r > 1.5, `clear: hole grew big (r=${eng.hole.r.toFixed(2)})`);
check(steps < MAX_STEPS, 'clear: finished before the timeout');

// the run must have exercised the signature behaviours
for (const t of ['fallStart', 'slideStart', 'tipStart', 'swallow', 'waterFill', 'splashFloat', 'glug', 'detach']) {
  check(seen.has(t), `feel: ${t} happened during a normal clear`);
}
console.log('    event types seen:', [...seen].sort().join(', '));

console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
