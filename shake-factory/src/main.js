// ---------------------------------------------------------------------------
// main.js — まっすぐシャカシャカ ふりわけ工場
// Crank the round handle → the Tusi couple turns circles into a straight
// shuttle → marbles & syrup rain into cups → colours stack, spill, sparkle.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createWorld } from './world.js';
import { createMachine, MACHINE } from './machine.js';
import { Handle } from './handle.js';
import { createCups, CUP } from './cups.js';
import { Pond } from './pond.js';
import { Marbles } from './marbles.js';
import { Drops, Sparkles, Confetti } from './fx.js';
import { AudioBox } from './audio.js';
import { UI } from './ui.js';
import { Goals } from './goals.js';
import { Input } from './input.js';
import { FLAVOURS } from './colors.js';

const container = document.getElementById('app');
const { renderer, scene, camera } = createWorld(container);
renderer.autoClear = false;

const machine = createMachine(scene);
const handle = new Handle(renderer);
const cups = createCups(scene);
const pond = new Pond(scene);
const marbles = new Marbles(scene, machine.tubeCurve);
const drops = new Drops(scene);
const sparkles = new Sparkles(scene);
const confetti = new Confetti(scene);
const audio = new AudioBox();
const ui = new UI();
const input = new Input(renderer.domElement, camera, handle, cups);

// ---------------------------------------------------------------------------
// game state
// ---------------------------------------------------------------------------
const stats = { marblesMelted: 0 };
let flavour = FLAVOURS[0];
let feedAcc = 0, dropAcc = 0, tickAcc = 0;
let prevAngle = 0;
let hintDone = false;
let spillNoise = 0;

// shake-shake detector
let lastOmegaSign = 0;
let reversals = [];
let shakaCooldown = 0;

const goals = new Goals((mission) => {
  audio.jingle();
  confetti.celebrate(0, 6.5);
  ui.toast('できた〜！ ⭐');
});

// ---------------------------------------------------------------------------
// wiring: what happens when things land
// ---------------------------------------------------------------------------
marbles.onExitNozzle = () => audio.release();
marbles.onBounce = (v) => audio.clack(v);

marbles.onMeltInCup = (cup, flav, x, y, star) => {
  const becameFull = cup.addVolume(flav.liquid, CUP.VOL_MARBLE * (star ? 2.5 : 1));
  stats.marblesMelted++;
  audio.plink(Math.min(cup.level, 1));
  if (star) {
    audio.pon();
    sparkles.burst(x, y + 0.15, 'rainbow', 14, 2.0);
    ui.toast('キラキラ ビーだま！', 1200);
  } else {
    sparkles.burst(x, y + 0.1, flav.marble, 5, 0.9);
  }
  if (becameFull) cupBecameFull(cup);
};

marbles.onMeltFloor = (x, flav) => {
  pond.addSpill(flav.liquid, 0.02, x);
  audio.splash(false);
  sparkles.burst(x, 0.15, flav.marble, 4, 1.1);
};

function cupBecameFull(cup) {
  audio.pon();
  ui.toast('まんたん！');
  sparkles.burst(cup.x, CUP.RIM_Y + 0.2, 'rainbow', 12, 1.8);
}

// syrup droplets landing
drops.onLand = (d, hitFloor = false) => {
  if (hitFloor) {
    pond.addSpill(d.colorHex ?? 0xff6b8f, 0.004, d.x);
    if (Math.random() < 0.2) audio.plip();
    return true;
  }
  for (const cup of cups.list) {
    const frac = THREE.MathUtils.clamp((d.y - CUP.Y0) / CUP.H, 0, 1);
    const surfaceY = CUP.Y0 + Math.min(cup.level, 1) * CUP.H;
    if (Math.abs(d.x - cup.x) < cup.radiusAt(frac) - 0.03 &&
        d.y < CUP.RIM_Y - 0.02 && d.y <= surfaceY + 0.12) {
      const becameFull = cup.addVolume(d.colorHex, CUP.VOL_DROP);
      if (Math.random() < 0.3) audio.plip();
      if (becameFull) cupBecameFull(cup);
      return true;
    }
  }
  return false;
};

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
ui.onFlavour = (f) => {
  flavour = f;
  audio.plink(0.4);
  sparkles.burst(machine.state.spoutX, MACHINE.SPOUT_EXIT_Y, f.marble, 6, 1.2);
};
ui.onSound = () => {
  audio.setMuted(!audio.muted);
  ui.setSoundIcon(audio.muted);
};
ui.onReset = () => {
  cups.reset();
  pond.reset();
  marbles.reset();
  sparkles.burst(0, 2, 'rainbow', 16, 2.2);
  audio.shaka();
  ui.toast('ピカピカ！');
};

input.onFirstTouch = () => audio.unlock();

// splash → start
const splash = document.getElementById('splash');
splash.addEventListener('pointerdown', () => {
  audio.unlock();
  ui.hideSplash();
  ui.showHint(handle.rect);
  ui.showMission(goals.current, goals.stars);
}, { once: true });

// ---------------------------------------------------------------------------
// layout / resize
// ---------------------------------------------------------------------------
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const portrait = h > w;
  camera.fov = portrait ? 54 : 44;
  camera.aspect = w / h;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // portrait leaves the bottom ~30% of the screen for the crank handle,
  // so aim lower (cy) and keep the whole factory in the upper part
  const halfW = portrait ? 3.8 : 3.75;
  const halfH = portrait ? 7.0 : 5.6;
  const cy = portrait ? 3.1 : 4.4;
  const dist = Math.max(halfH / tan, halfW / (tan * camera.aspect)) * 1.02;
  camera.position.set(0, cy, Math.min(dist, 19));
  camera.lookAt(0, cy + 0.1, 0);
  camera.updateProjectionMatrix();
  handle.layout(w, h);
  ui.layout(w, h, handle.rect);
  window.__handleRect = handle.rect;
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));
layout();

// ---------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // --- crank the machine ---
  handle.update(dt);
  const theta = handle.angle;
  const omega = handle.omega;
  const dAngle = theta - prevAngle;
  prevAngle = theta;
  machine.update(theta, omega, dt, t);

  const spout = {
    x: machine.state.spoutX,
    vx: machine.state.spoutVX,
    exitY: MACHINE.SPOUT_EXIT_Y,
  };

  // --- cranking feeds the factory ---
  const da = Math.abs(dAngle);
  feedAcc += da; dropAcc += da; tickAcc += da;
  if (feedAcc > 0.55) {
    feedAcc = 0;
    marbles.feed(flavour);
  }
  if (dropAcc > 0.13) {
    dropAcc = 0;
    drops.spawn(spout.x, spout.exitY + 0.05, flavour.liquid, spout.vx * 0.8, -0.5);
  }
  if (tickAcc > 0.26) {
    tickAcc = 0;
    audio.tick(Math.min(1, 0.4 + Math.abs(omega) * 0.1));
  }

  // --- hint goes away once the child has cranked a bit ---
  if (!hintDone && handle.totalTurns > 1.2) {
    hintDone = true;
    ui.hideHint();
  }

  // --- shake-shake bonus ---
  shakaCooldown = Math.max(0, shakaCooldown - dt);
  const sign = omega > 2 ? 1 : omega < -2 ? -1 : 0;
  if (sign !== 0 && lastOmegaSign !== 0 && sign !== lastOmegaSign) {
    reversals.push(t);
  }
  if (sign !== 0) lastOmegaSign = sign;
  reversals = reversals.filter(ts => t - ts < 2.0);
  if (reversals.length >= 3 && shakaCooldown <= 0) {
    reversals.length = 0;
    shakaCooldown = 3;
    machine.shake();
    audio.shaka();
    ui.toast('シャカシャカ！！');
    sparkles.burst(spout.x, spout.exitY, 'rainbow', 16, 2.4);
    // bonus burst of random-colour marbles
    for (let i = 0; i < 3; i++) marbles.feed(FLAVOURS[Math.floor(Math.random() * FLAVOURS.length)]);
  }

  // --- simulate ---
  marbles.update(dt, Math.abs(omega), spout, cups.list);
  const { spillL, spillR } = cups.update(dt, t);

  // cup overflow → dribbles down the outside + pond fills
  for (const [cup, spill] of [[cups.left, spillL], [cups.right, spillR]]) {
    if (spill > 0) {
      const hex = cup.topColor.getHex();
      if (Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? -1 : 1;
        drops.spawn(cup.x + side * (CUP.R_TOP + 0.09), CUP.RIM_Y + 0.03, hex, side * 0.25, -0.2, 1.2);
      }
      pond.addSpill(hex, spill * 0.25, cup.x);
    }
  }
  spillNoise = Math.max(spillL + spillR > 0 ? 1 : 0, spillNoise - dt * 2);

  pond.update(dt, t);
  drops.update(dt);
  sparkles.update(dt);
  confetti.update(dt);
  scene.userData.updateScenery?.(t);
  audio.update(dt, Math.abs(machine.state.spoutVX), spillNoise);

  // --- goals ---
  const gstats = {
    marblesMelted: stats.marblesMelted,
    left: { level: cups.left.level, stripes: cups.left.stripeCount() },
    right: { level: cups.right.level, stripes: cups.right.stripeCount() },
    pondColors: pond.colorCount(),
    pondVolume: pond.volume,
  };
  const res = goals.update(dt, gstats);
  ui.setProgress(res.progress);
  if (res.changed) ui.showMission(goals.current, goals.stars);

  // --- render: main scene, then the handle viewport on top ---
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setViewport(0, 0, w, h);
  renderer.setScissorTest(false);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);
  handle.render();
}

frame();

// exposed for automated tests / tinkering in devtools
window.__game = { handle, machine, cups, pond, marbles, goals, ui, camera };
window.__project = (x, y, z) => {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
};
