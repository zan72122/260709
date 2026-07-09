// End-to-end headless run of every course: pour marbles from the spawn point
// and verify that most of them reach the goal pool, none explode to NaN and
// none escape the world bounds.
import * as THREE from '../vendor/three.module.min.js';
import { Sim } from '../src/physics.js';
import { COURSES, MARBLE_COLORS } from '../src/courses.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

const DT = 1 / 120;
const TOTAL = 24;          // marbles poured per course
const RUN_S = 80;          // simulated seconds

for (const course of COURSES) {
  const sim = new Sim(160);
  const group = new THREE.Group();
  const built = course.build(sim, group);
  sim.finalize();

  const spawn = built.spawn;
  let spawned = 0, goals = 0, fell = 0, nan = false, escaped = 0;
  const goalIds = new Set();

  let t = 0, nextSpawn = 0.3;
  const steps = Math.round(RUN_S / DT);
  for (let s = 0; s < steps; s++) {
    t += DT;
    if (spawned < TOTAL && t >= nextSpawn) {
      nextSpawn = t + 0.55;
      const j = spawned;
      sim.spawn(
        spawn.pos.x + (Math.sin(j * 3.7) * 0.03), spawn.pos.y, spawn.pos.z + Math.cos(j * 2.3) * 0.03,
        spawn.dir.x * 1.2, 0, spawn.dir.z * 1.2, j % MARBLE_COLORS.length);
      spawned++;
    }
    sim.step(DT);
    for (const ev of sim.events) {
      if (ev.type === 'goal') { goals++; goalIds.add(ev.marble.id); }
      if (ev.type === 'fell') { fell++; ev.marble.alive = false; }
    }
    sim.events.length = 0;
  }

  let resting = 0, moving = 0, stuck = [];
  for (const m of sim.marbles) {
    if (!m.alive) continue;
    if (!Number.isFinite(m.p.x + m.p.y + m.p.z)) nan = true;
    const r = Math.hypot(m.p.x, m.p.z);
    if (r > course.islandR + 6 || m.p.y > 14) escaped++;
    if (m.inGoal) resting++;
    else if (m.restT > 5) stuck.push(`(${m.p.x.toFixed(1)},${m.p.y.toFixed(1)},${m.p.z.toFixed(1)})`);
    else moving++;
  }

  console.log(`--- ${course.id}: spawned=${spawned} goals=${goals} inGoalNow=${resting} fell=${fell} stuck=${stuck.length} moving=${moving}`);
  if (stuck.length) console.log('    stuck at: ' + stuck.slice(0, 12).join(' '));
  check(!nan, `${course.id}: no NaN positions`);
  check(goals >= Math.floor(TOTAL * 0.75), `${course.id}: >=75% of marbles reached the goal (${goals}/${TOTAL})`);
  check(escaped === 0, `${course.id}: no marbles escaped the world (${escaped})`);
  check(fell <= TOTAL * 0.2, `${course.id}: few marbles fell off (${fell})`);
}

if (!ok) { console.error('COURSE TEST FAILED'); process.exit(1); }
console.log('course test passed');
