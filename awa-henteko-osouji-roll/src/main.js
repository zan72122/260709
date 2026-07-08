// あわあわ へんてこ おそうじロール — main game loop & glue.

import * as THREE from '../vendor/three.module.min.js';
import { createSphericonGeometry, SphericonRoller } from './sphericon.js';
import { FloorSim } from './simulation.js';
import { createFloor, baseTextures } from './floor.js';
import { BubbleSystem } from './bubbles.js';
import { ParticleSystem } from './particles.js';
import { GardenLife } from './flowers.js';
import { PropWorld } from './props.js';
import { World } from './world.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { STAGES, FLOOR_SIZE } from './stages.js';

const GRID_N = 104;
const ROLLER_R = 0.55;
const VMAX = 4.2;

// ------------------------------------------------------------ renderer
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 150);

const world = new World(scene, FLOOR_SIZE);
const particles = new ParticleSystem(scene);
const audio = new AudioEngine();

// ------------------------------------------------------------ sphericon
function stripeTexture(colA, colB) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = colA;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = colB;
  const n = 8;
  for (let i = 0; i < n; i++) g.fillRect(i * 256 / n, 0, 256 / n / 2, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const roller = new SphericonRoller(ROLLER_R);
const rollerGeo = createSphericonGeometry(ROLLER_R, 64, 6);
const matA = new THREE.MeshPhysicalMaterial({
  map: stripeTexture('#ff8fb3', '#fff3f6'), clearcoat: 0.8, clearcoatRoughness: 0.25,
  roughness: 0.42, metalness: 0.0,
});
const matB = new THREE.MeshPhysicalMaterial({
  map: stripeTexture('#63d6c4', '#f0fffa'), clearcoat: 0.8, clearcoatRoughness: 0.25,
  roughness: 0.42, metalness: 0.0,
});
const rollerMesh = new THREE.Mesh(rollerGeo, [matA, matB]);
rollerMesh.castShadow = true;
scene.add(rollerMesh);
// soft contact blob
const blobTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(40,60,80,0.34)');
  gr.addColorStop(1, 'rgba(40,60,80,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 1.6),
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.012;
blob.renderOrder = 5;
scene.add(blob);

// gameplay extensions carried by the roller
roller.footprint = 0.62;
roller.conePar = 0;
roller.carry = [{ r: 1, g: 1, b: 1, a: 0 }, { r: 1, g: 1, b: 1, a: 0 }];
roller.wetCharge = 0;

let squash = 0;
roller.onHandoff = (idx, speed) => {
  roller.conePar = idx % 2;
  if (speed > 0.35 && state.mode === 'game') {
    audio.koton(idx, speed);
    squash = Math.min(0.5, 0.14 + speed * 0.05);
  }
};

// ------------------------------------------------------------ state
const state = {
  mode: 'title',            // title | select | game | done
  stageIndex: 0,
  stage: null,
  sim: null,
  floorMesh: null,
  bubbles: null,
  garden: null,
  props: null,
  stageGroup: null,
  goalDone: false,
  playedOnce: false,
  splashTimer: 0,
  sparkleTimer: 0,
  quackTimer: 0,
};

const stars = JSON.parse(localStorage.getItem('awa-henteko-stars') || '{}');

const ui = new UI(STAGES, {
  unlockAudio: () => audio.unlock(),
  startStage: (i) => loadStage(i),
  resetStage: () => loadStage(state.stageIndex),
  nextStage: () => loadStage((state.stageIndex + 1) % STAGES.length),
  goHome: () => { state.mode = 'select'; ui.showSelect(); },
  toggleSound: () => { audio.setEnabled(!audio.enabled); return audio.enabled; },
  getStars: (id) => stars[id],
});

function disposeStage() {
  if (!state.stageGroup) return;
  state.stageGroup.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
  scene.remove(state.stageGroup);
  state.stageGroup = null;
}

function loadStage(i) {
  disposeStage();
  state.stageIndex = i;
  const stage = STAGES[i];
  state.stage = stage;
  state.goalDone = false;
  state.mode = 'game';

  const group = new THREE.Group();
  state.stageGroup = group;
  scene.add(group);

  const sim = new FloorSim(GRID_N, FLOOR_SIZE, stage.sim);
  stage.setup(sim);
  sim.finalizeSetup();
  state.sim = sim;

  state.floorMesh = createFloor(FLOOR_SIZE, sim, {
    baseTex: baseTextures[stage.baseTex](),
    baseTiling: stage.baseTiling,
    dirtColor: stage.dirtColor,
    sparkleColor: stage.sparkleColor,
    paintGloss: stage.paintGloss || 0,
  });
  group.add(state.floorMesh);

  state.bubbles = new BubbleSystem(group, sim);
  for (const col of sim.collectors) state.bubbles.addBigBubble(col);
  state.bubbles.onBigPop = (b) => {
    audio.bigPop();
    particles.burst(b.col.x, b.size, b.col.z, {
      count: 46, colors: [0xffffff, 0xbfe8ff, 0xffd9ec, 0xfff6b8],
      speed: 2.6, up: 2.2, ttl: 1.3, size: 0.22, gravity: 2.2, twinkle: 0.5, spread: b.size,
    });
  };

  state.garden = stage.sim.grow ? new GardenLife(group, sim) : null;

  state.props = new PropWorld(group, FLOOR_SIZE / 2);
  for (const p of stage.props) state.props.add(p.type, p.x, p.z);
  state.props.onBump = (type, sp) => {
    if (type === 'duck') {
      if (state.quackTimer <= 0) { audio.quack(); state.quackTimer = 0.5; }
    } else if (sp > 0.8) audio.pop(1.4, 0.1);
  };

  world.applyPalette(stage.palette);

  roller.reset(0, 2.2, Math.random() * 6.28);
  roller.carry.forEach((c) => { c.r = c.g = c.b = 1; c.a = 0; });
  roller.wetCharge = 0;
  desire.active = false;

  ui.showGame(stage, !state.playedOnce);
  state.playedOnce = true;
}

// ------------------------------------------------------------ input
const desire = { dir: new THREE.Vector3(1, 0, 0), speed: 0, active: false, ttl: 0 };
const pointer = { down: false, id: -1, x: 0, y: 0, t: 0, sx: 0, sy: 0, lastWorld: null, moved: 0 };

function floorHit(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const nx = ((clientX - r.left) / r.width) * 2 - 1;
  const ny = -((clientY - r.top) / r.height) * 2 + 1;
  const origin = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const dir = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(origin).normalize();
  if (Math.abs(dir.y) < 1e-4) return null;
  const t = -origin.y / dir.y;
  if (t < 0) return null;
  return origin.clone().addScaledVector(dir, t);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state.mode !== 'game') return;
  pointer.down = true;
  pointer.id = e.pointerId;
  pointer.sx = pointer.x = e.clientX;
  pointer.sy = pointer.y = e.clientY;
  pointer.t = performance.now();
  pointer.moved = 0;
  pointer.lastWorld = floorHit(e.clientX, e.clientY);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.down || e.pointerId !== pointer.id || state.mode !== 'game') return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.moved += Math.hypot(dx, dy);
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  const w = floorHit(e.clientX, e.clientY);
  if (w && pointer.lastWorld) {
    const wx = w.x - pointer.lastWorld.x, wz = w.z - pointer.lastWorld.z;
    const d = Math.hypot(wx, wz);
    if (d > 0.02) {
      desire.dir.set(wx / d, 0, wz / d);
      desire.speed = Math.min(VMAX, desire.speed + d * 2.4);
      desire.active = true;
      desire.ttl = 0.55;
      ui.hideHint();
    }
  }
  pointer.lastWorld = w;
});

function endPointer(e) {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  pointer.down = false;
  const dt = performance.now() - pointer.t;
  if (state.mode === 'game' && dt < 260 && pointer.moved < 12) {
    // tap: hop if near the roller, otherwise nudge toward the tap
    const w = floorHit(e.clientX, e.clientY);
    if (w) {
      const d = Math.hypot(w.x - roller.center.x, w.z - roller.center.z);
      if (d < 1.3) {
        roller.hop(2.4);
        audio.giggleHop();
        particles.burst(roller.center.x, 0.2, roller.center.z, {
          count: 10, colors: [0xffffff, 0xbfe8ff], speed: 1.4, up: 1.4, ttl: 0.7, size: 0.13,
        });
      } else {
        const dir = new THREE.Vector3(w.x - roller.center.x, 0, w.z - roller.center.z).normalize();
        desire.dir.copy(dir);
        desire.speed = Math.max(desire.speed, Math.min(VMAX * 0.75, d * 1.1));
        desire.active = true;
        desire.ttl = 0.8;
      }
    }
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// ------------------------------------------------------------ camera
const camTarget = new THREE.Vector3(0, 0, 0);
function updateCamera(dt) {
  const aspect = camera.aspect;
  // portrait: come closer and follow the roller; landscape: frame the floor
  const portrait = aspect < 1;
  const fit = Math.max(1, 1.18 / Math.max(0.62, Math.min(aspect, 1.18)));
  const dist = (portrait ? 9.3 : 10.2) * fit;
  const height = (portrait ? 9.0 : 9.0) * fit;
  const follow = portrait ? 0.34 : 0.26;
  if (state.mode === 'game') {
    camTarget.lerp(new THREE.Vector3(roller.center.x * follow, 0, roller.center.z * follow), Math.min(1, dt * 2.2));
  } else {
    camTarget.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt));
  }
  camera.position.set(camTarget.x, height, camTarget.z + dist);
  camera.lookAt(camTarget.x, portrait ? 0.9 : -0.4, camTarget.z);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ------------------------------------------------------------ goal
function goalProgress() {
  const g = state.stage.goal, sim = state.sim;
  if (g.type === 'clean') return Math.max(0, Math.min(1, (1 - sim.dirtRatio) / g.target));
  if (g.type === 'paint') return Math.min(1, sim.paintCoverage / g.target);
  if (g.type === 'flowers') return Math.min(1, sim.flowerCount / g.target);
  return 0;
}

function checkGoal() {
  if (state.goalDone) return;
  const p = goalProgress();
  ui.setProgress(p);
  if (p >= 1) {
    state.goalDone = true;
    stars[state.stage.id] = true;
    try { localStorage.setItem('awa-henteko-stars', JSON.stringify(stars)); } catch (_) {}
    audio.fanfare();
    particles.confettiRain(roller.center.x, roller.center.z, 6);
    setTimeout(() => particles.confettiRain(0, 0, 8), 700);
    setTimeout(() => { if (state.goalDone) ui.showCelebrate(); }, 1400);
  }
}

// ------------------------------------------------------------ loop
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;

  world.update(dt, time);
  particles.update(dt, time);

  if (state.mode === 'game' && state.sim) {
    const sim = state.sim;
    state.splashTimer -= dt;
    state.quackTimer -= dt;
    state.sparkleTimer -= dt;

    // --- steering / speed
    if (desire.active) {
      desire.ttl -= dt;
      if (desire.ttl <= 0) desire.active = false;
      const tan = roller.tangent(new THREE.Vector3());
      // signed yaw that carries the travel dir onto the desired dir
      const ang = Math.atan2(
        tan.z * desire.dir.x - tan.x * desire.dir.z,
        tan.x * desire.dir.x + tan.z * desire.dir.z
      );
      if (Math.abs(ang) > Math.PI * 0.72 && Math.abs(roller.v) > 0.3) {
        roller.v *= -1; // rolling backwards is easier than a U-turn
      } else {
        roller.steer(Math.max(-4.2 * dt, Math.min(4.2 * dt, ang)));
      }
      roller.v += (Math.sign(roller.v || 1) * desire.speed - roller.v) * Math.min(1, dt * 5);
    }
    desire.speed = Math.max(0, desire.speed - dt * 2.2);

    // --- surface friction
    const [ccx, ccz] = sim.cellOf(roller.center.x, roller.center.z);
    const ci = sim.idx(ccx, ccz);
    const wetHere = Math.max(sim.wet[ci], sim.srcWet[ci]);
    const foamHere = Math.min(1, sim.foam[ci] * 1.5);
    const fric = 0.55 * (1 - wetHere * 0.75) * (1 + foamHere * 0.35);
    roller.v *= Math.max(0, 1 - fric * dt);
    if (Math.abs(roller.v) < 0.02) roller.v = 0;

    roller.step(dt);

    // --- keep inside the rim
    const bound = FLOOR_SIZE / 2 - 0.75;
    const c = roller.center;
    let bounced = false;
    const tan = roller.tangent(new THREE.Vector3());
    const reflect = (rx, rz) => { // steer so travel dir becomes (rx, rz)
      const ang = Math.atan2(tan.z * rx - tan.x * rz, tan.x * rx + tan.z * rz);
      roller.steer(ang);
      roller.tangent(tan);
      bounced = true;
    };
    if (Math.abs(c.x) > bound) {
      roller.apex.x += Math.sign(c.x) * bound - c.x;
      roller._updateCenter();
      if (tan.x * Math.sign(c.x) > 0) reflect(-tan.x, tan.z);
    }
    if (Math.abs(c.z) > bound) {
      roller.apex.z += Math.sign(c.z) * bound - c.z;
      roller._updateCenter();
      if (tan.z * Math.sign(c.z) > 0) reflect(tan.x, -tan.z);
    }
    if (bounced) { roller.v *= 0.82; if (Math.abs(roller.v) > 0.8) audio.pop(2.2, 0.08); }

    // --- paint the world
    const speed = Math.abs(roller.v);
    const feel = sim.applyRoller(c.x, c.z, tan.x, tan.z, speed, dt, roller);
    audio.rolling(speed, { foam: feel.onFoam, wet: wetHere });
    if ((feel.cleaned > 0.001 || speed > 2.6) && state.sparkleTimer <= 0) {
      state.sparkleTimer = 0.12;
      particles.burst(c.x - tan.x * 0.5, 0.1, c.z - tan.z * 0.5, {
        count: 2, colors: [0xfff6c8, 0xffffff], speed: 0.5, up: 0.8, ttl: 0.6, size: 0.12, twinkle: 0.5,
      });
    }
    if ((roller.wetCharge > 0.9 || roller.carry[roller.conePar].a > 0.9) && state.splashTimer <= 0) {
      state.splashTimer = 1.2;
      audio.splash();
    }

    // --- consume sim events
    for (const ev of sim.events) {
      if (ev.type === 'clean') {
        audio.chime();
        particles.burst(ev.x, 0.08, ev.z, { count: 5, colors: [0xfff6c8, 0xffffff, 0xffe9f2], speed: 0.7, up: 1.2, ttl: 0.8, size: 0.16, twinkle: 0.6 });
      } else if (ev.type === 'foamPop') {
        audio.pop(0.6 + Math.random() * 0.5, 0.08);
        particles.burst(ev.x, 0.15, ev.z, { count: 3, colors: [0xffffff, 0xdff2ff], speed: 0.9, up: 1.0, ttl: 0.5, size: 0.1 });
      } else if (ev.type === 'bloom') {
        audio.bloom();
        if (state.garden) state.garden.addFlower(ev.x, ev.z);
        particles.burst(ev.x, 0.3, ev.z, { count: 7, colors: [0xff8fb3, 0xffd166, 0xc9a8ff, 0xffffff], speed: 0.8, up: 1.4, ttl: 0.9, size: 0.14 });
      }
    }
    sim.events.length = 0;

    sim.update(dt, time);
    state.bubbles.update(dt, time);
    if (state.garden) state.garden.update(dt, time);
    state.props.update(dt, time, { x: c.x, z: c.z, r: ROLLER_R + 0.1, vx: roller.velocity.x, vz: roller.velocity.z });
    state.floorMesh.material.uniforms.time.value = time;

    // --- roller visuals
    rollerMesh.position.copy(roller.center);
    rollerMesh.quaternion.copy(roller.quat);
    squash = Math.max(0, squash - dt * 3);
    const sq = 1 - squash * 0.35;
    rollerMesh.scale.set(2 - sq, sq, 2 - sq);
    // show soaked ink / water on the two cone families
    const c0 = roller.carry[0], c1 = roller.carry[1];
    matA.color.setRGB(1 - (1 - c0.r) * c0.a, 1 - (1 - c0.g) * c0.a, 1 - (1 - c0.b) * c0.a);
    matB.color.setRGB(1 - (1 - c1.r) * c1.a, 1 - (1 - c1.g) * c1.a, 1 - (1 - c1.b) * c1.a);
    blob.position.set(c.x, 0.012, c.z);
    blob.material.opacity = Math.max(0.25, 1 - roller.yOffset * 1.4);
    world.dir.target.position.set(c.x, 0, c.z);
    world.dir.position.set(c.x + 6, 11, c.z + 4);

    checkGoal();
  } else {
    // menu: sphericon pirouettes in the middle
    roller.v = 1.35;
    roller.step(dt);
    const b = FLOOR_SIZE / 2 - 1.5;
    if (Math.abs(roller.center.x) > b || Math.abs(roller.center.z) > b) roller.steer(2.4 * dt);
    rollerMesh.position.copy(roller.center);
    rollerMesh.quaternion.copy(roller.quat);
    rollerMesh.scale.set(1, 1, 1);
    blob.position.set(roller.center.x, 0.012, roller.center.z);
    if (state.sim) {
      state.sim.update(dt, time);
      state.bubbles.update(dt, time);
      if (state.garden) state.garden.update(dt, time);
      state.floorMesh.material.uniforms.time.value = time;
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);

  // --- adaptive quality
  fpsAcc += dt; fpsN++; fpsTimer += dt;
  if (fpsTimer > 2.5) {
    const fps = fpsN / fpsAcc;
    if (fps < 42 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
    fpsAcc = 0; fpsN = 0; fpsTimer = 0;
  }
}

// boot: title screen over a live terrace backdrop
loadStage(0);
state.mode = 'title';
state.playedOnce = false;
ui.showTitle();
requestAnimationFrame(frame);
