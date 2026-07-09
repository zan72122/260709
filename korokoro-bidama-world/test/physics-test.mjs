// Unit checks for the marble physics primitives.
import * as THREE from '../vendor/three.module.min.js';
import { Sim, MARBLE_R } from '../src/physics.js';
import { buildRail, sampleSpine } from '../src/track.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };
const DT = 1 / 120;

// --- 1. marble rolls down a straight rail and stays in the channel
{
  const sim = new Sim(4);
  const group = new THREE.Group();
  const pts = [new THREE.Vector3(0, 3, 0), new THREE.Vector3(4, 2.2, 0), new THREE.Vector3(8, 1.4, 0)];
  buildRail(sim, group, pts, { supports: false });
  sim.finalize();
  const m = sim.spawn(0, 3.3, 0, 0.5, 0, 0, 0);
  let maxZdev = 0, maxV = 0;
  for (let s = 0; s < 120 * 4; s++) {
    sim.step(DT);
    sim.events.length = 0;
    if (m.p.x < 7.5) {
      maxZdev = Math.max(maxZdev, Math.abs(m.p.z));
      maxV = Math.max(maxV, m.v.length());
    }
  }
  check(m.p.x > 7.5, `rail: marble reached the end (x=${m.p.x.toFixed(2)})`);
  check(maxZdev < 0.15, `rail: marble stayed centred in the channel (dev=${maxZdev.toFixed(3)})`);
  check(maxV > 2.5, `rail: marble accelerated downhill (vmax=${maxV.toFixed(2)})`);
}

// --- 2. spine banking stays bounded and frames stay orthonormal
{
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = i * 0.5;
    pts.push(new THREE.Vector3(Math.cos(a) * 3, 5 - i * 0.3, Math.sin(a) * 3));
  }
  const spine = sampleSpine(pts);
  let worst = 0;
  for (let i = 0; i < spine.pts.length; i++) {
    worst = Math.max(worst,
      Math.abs(spine.tangents[i].dot(spine.normals[i])),
      Math.abs(spine.tangents[i].length() - 1),
      Math.abs(spine.normals[i].length() - 1));
  }
  check(worst < 1e-6 + 0.02, `spine: frames orthonormal (err=${worst.toExponential(2)})`);
}

// --- 3. funnel drains a marble through the hole (no phantom wall below)
{
  const sim = new Sim(4);
  sim.addCone({ x: 0, z: 0, yBot: 2, rBot: 0.7, yTop: 3.5, rTop: 2, e: 0.1 });
  sim.finalize();
  const m = sim.spawn(1.5, 3.8, 0, 0.8, 0, 1.2, 0); // tangential entry
  let t = 0;
  while (m.p.y > 1.0 && t < 25) { sim.step(DT); sim.events.length = 0; t += DT; }
  check(m.p.y <= 1.0, `funnel: marble drained through hole in ${t.toFixed(1)}s`);
  const rho = Math.hypot(m.p.x, m.p.z);
  check(rho < 0.75, `funnel: marble exited through the hole (rho=${rho.toFixed(2)})`);
}

// --- 4. box: marble rests on top, no penetration
{
  const sim = new Sim(4);
  sim.addBox({ c: new THREE.Vector3(0, 1, 0), h: new THREE.Vector3(1, 0.2, 1), e: 0.2 });
  sim.finalize();
  const m = sim.spawn(0, 2.5, 0, 0, 0, 0, 0);
  for (let s = 0; s < 120 * 3; s++) { sim.step(DT); sim.events.length = 0; }
  const restY = 1.2 + MARBLE_R;
  check(Math.abs(m.p.y - restY) < 0.03, `box: marble rests on top (y=${m.p.y.toFixed(3)} vs ${restY.toFixed(3)})`);
}

// --- 5. marble-marble collision separates overlapping marbles
{
  const sim = new Sim(4);
  sim.addDisc({ x: 0, y: 0, z: 0, r: 10 });
  sim.finalize();
  const a = sim.spawn(-0.1, 0.5, 0, 2, 0, 0, 0);
  const b = sim.spawn(0.1, 0.5, 0, -2, 0, 0, 1);
  for (let s = 0; s < 120 * 2; s++) { sim.step(DT); sim.events.length = 0; }
  const d = a.p.distanceTo(b.p);
  check(d >= MARBLE_R * 2 - 0.01, `marble-marble: separated (d=${d.toFixed(3)})`);
}

// --- 6. goal zone fires once per marble
{
  const sim = new Sim(4);
  sim.addBowl({ x: 0, y: 1, z: 0, r: 1.2, e: 0.2 });
  sim.addZone({ x: 0, y: 0.8, z: 0, r: 1.3, kind: 'goal' });
  sim.finalize();
  sim.spawn(0.3, 1.6, 0, 0, 0, 0, 0);
  let goals = 0;
  for (let s = 0; s < 120 * 5; s++) {
    sim.step(DT);
    for (const ev of sim.events) if (ev.type === 'goal') goals++;
    sim.events.length = 0;
  }
  check(goals === 1, `goal zone: fired exactly once (${goals})`);
}

// --- 7. spinner imparts momentum
{
  const sim = new Sim(4);
  sim.addDisc({ x: 0, y: 0, z: 0, r: 6 });
  sim.addSpinner({ x: 0, y: 0.3, z: 0, arms: 4, len: 1.5, hh: 0.3, ht: 0.1, speed: 2 });
  sim.finalize();
  const m = sim.spawn(1.0, 0.9, 0, 0, 0, 0, 0);
  let maxV = 0;
  for (let s = 0; s < 120 * 3; s++) {
    sim.step(DT); sim.events.length = 0;
    maxV = Math.max(maxV, m.v.length());
  }
  check(maxV > 1.5, `spinner: flung the marble (vmax=${maxV.toFixed(2)})`);
}

if (!ok) { console.error('PHYSICS TEST FAILED'); process.exit(1); }
console.log('physics test passed');
