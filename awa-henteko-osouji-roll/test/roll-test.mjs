// Numeric verification of sphericon rolling: while rolling, the lowest point
// of the surface must stay at floor level (no penetration, no floating) and
// the centre must stay at constant height r/√2.
import * as THREE from '../vendor/three.module.min.js';
import { createSphericonGeometry, SphericonRoller, PHASE_MAX } from '../src/sphericon.js';

const r = 0.5;
const geo = createSphericonGeometry(r, 96, 4);
const pos = geo.attributes.position;
const roller = new SphericonRoller(r);
roller.reset(0, 0, 0.3);
roller.v = 1.2;

const m = new THREE.Matrix4();
const v = new THREE.Vector3();
let worstMin = Infinity, worstMax = -Infinity, worstH = 0;
let handoffs = 0;
roller.onHandoff = () => handoffs++;
const path = [];

const dt = 1 / 240;
for (let i = 0; i < 240 * 8; i++) {
  roller.step(dt);
  m.makeRotationFromQuaternion(roller.quat).setPosition(roller.center);
  let minY = Infinity;
  for (let j = 0; j < pos.count; j++) {
    v.fromBufferAttribute(pos, j).applyMatrix4(m);
    if (v.y < minY) minY = v.y;
  }
  worstMin = Math.min(worstMin, minY);
  worstMax = Math.max(worstMax, minY);
  worstH = Math.max(worstH, Math.abs(roller.center.y - r / Math.SQRT2));
  if (i % 24 === 0) path.push([roller.center.x.toFixed(3), roller.center.z.toFixed(3)]);
}

// tolerance: mesh ring is a 96-gon (sits ~r·(1−cos(π/96)) ≈ 2.7e-4 inside the
// true surface) plus integration error.
const tol = 0.01 * r;
console.log('min contact height over run:', worstMin.toFixed(5));
console.log('max contact height over run:', worstMax.toFixed(5));
console.log('centre height error:', worstH.toExponential(2));
const expectHandoffs = 1.2 * 8 / (r / Math.SQRT2) / PHASE_MAX;
console.log('handoffs (expect ~', expectHandoffs.toFixed(1), '):', handoffs);
console.log('path sample:', path.slice(0, 12).map(p => p.join(',')).join('  '));

let ok = true;
if (worstMin < -tol) { console.error('FAIL: surface penetrates the floor'); ok = false; }
if (worstMax > 0.03 * r) { console.error('FAIL: surface floats above the floor'); ok = false; }
if (worstH > 1e-9) { console.error('FAIL: centre height not constant'); ok = false; }
if (Math.abs(handoffs - expectHandoffs) > 1.5) { console.error('FAIL: wrong handoff cadence'); ok = false; }

// serpentine check: heading must oscillate (path not straight, not a circle)
const roller2 = new SphericonRoller(r);
roller2.reset(0, 0, 0);
roller2.v = 1.0;
const headings = [];
const t2 = new THREE.Vector3();
let hPrev = null, hAcc = 0;
for (let i = 0; i < 240 * 4; i++) {
  roller2.step(dt);
  roller2.tangent(t2);
  let h = Math.atan2(t2.z, t2.x);
  if (hPrev !== null) {
    let d = h - hPrev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    hAcc += d;
  }
  hPrev = h;
  headings.push(hAcc); // unwrapped, relative to start
}
const spread = Math.max(...headings) - Math.min(...headings);
console.log('heading oscillation spread (rad):', spread.toFixed(3), '(expect ≈', PHASE_MAX.toFixed(3), ')');
if (spread < 1.5 || spread > 3.0) { console.error('FAIL: path is not serpentine'); ok = false; }

console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
