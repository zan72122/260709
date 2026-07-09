// おもちゃのへや あなだらけ! — main loop & glue.
// Donut-County-style hole sandbox for small kids on iPhone/iPad.

import * as THREE from '../vendor/three.module.min.js';
import { HoleEngine, S, mulberry32 } from './physics.js';
import { buildRound } from './props.js';
import { HoleView } from './hole.js';
import { Room, ROOM_W, ROOM_D } from './room.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

// ------------------------------------------------------------ renderer
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);

const holeView = new HoleView(scene);
const room = new Room(scene, holeView);
const effects = new Effects(scene);
const audio = new AudioEngine();

// ------------------------------------------------------------ state
const state = {
  mode: 'title',          // title | game | celebrate
  round: 0,
  crowns: Number(localStorage.getItem('anadarake-crowns') || 0),
  engine: null,
  entries: [],            // [{prop, group, built}]
  total: 1,
  shake: 0,
  idleT: 0,
  everTapped: false,
  confettiT: 0,
  fallWhooshT: 0,
};

function buildLevel() {
  // clear previous props
  for (const e of state.entries) scene.remove(e.group);
  state.entries = [];

  room.build(state.round);

  const eng = new HoleEngine({
    roomW: ROOM_W - 1.2, roomD: ROOM_D - 1.2,
    holeR: 0.42, holeX: 0, holeZ: 2.5,
    seed: 1000 + state.round * 77,
  });
  const rand = mulberry32(500 + state.round * 31);
  state.entries = buildRound(scene, eng, state.round, rand);
  state.engine = eng;
  state.total = eng.remaining();
  eng.setHoleTarget(0, 2.5);
  ui.setMeter(0);
  ui.setCrowns(state.crowns);
}

// ------------------------------------------------------------ UI
const ui = new UI(document.getElementById('ui'), {
  onPlay() {
    audio.unlock();
    state.mode = 'game';
    ui.showGame();
    ui.showHint(true);
    state.idleT = 0;
  },
  onLaunch() {
    audio.unlock();
    if (state.engine && state.mode === 'game') state.engine.launch();
  },
  onReset() {
    audio.unlock();
    buildLevel();
    state.mode = 'game';
    ui.showGame();
  },
  onSoundToggle(on) { audio.unlock(); audio.setEnabled(on); },
  onNext() {
    state.round++;
    buildLevel();
    state.mode = 'game';
    ui.showGame();
  },
});

// ------------------------------------------------------------ input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let pointerDown = false;

function pointToFloor(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(floorPlane, hitPoint)) {
    state.engine.setHoleTarget(hitPoint.x, hitPoint.z);
    return true;
  }
  return false;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state.mode !== 'game') return;
  pointerDown = true;
  if (pointToFloor(e.clientX, e.clientY)) audio.tap();
  state.idleT = 0;
  state.everTapped = true;
  ui.showHint(false);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown || state.mode !== 'game') return;
  pointToFloor(e.clientX, e.clientY);
  state.idleT = 0;
});
window.addEventListener('pointerup', () => { pointerDown = false; });
window.addEventListener('pointercancel', () => { pointerDown = false; });

// ------------------------------------------------------------ camera
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  const portrait = aspect < 0.9;
  camera.fov = portrait ? 58 : 48;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  // landscape: frame the whole room. portrait: frame a vertical slice and
  // let the camera follow the hole horizontally instead.
  const visW = portrait ? 7.2 : ROOM_W / 2 + 1.2;
  const visD = ROOM_D / 2 + (portrait ? 1.6 : 1.9);
  const distW = visW / Math.tan(hfov / 2);
  const distD = visD / Math.tan(vfov / 2);
  camera.userData.dist = Math.max(distW, distD, 11);
  camera.userData.lookZ = portrait ? -0.9 : 0.6;
  // how far the camera may pan so the whole room stays reachable
  const seenHalfW = Math.tan(hfov / 2) * camera.userData.dist;
  camera.userData.panX = Math.max(0, ROOM_W / 2 + 1.0 - seenHalfW);
  camera.updateProjectionMatrix();
}

const camTarget = new THREE.Vector3(0, 0, 0.6);
const camLook = new THREE.Vector3();
function updateCamera(dt) {
  const h = state.engine ? state.engine.hole : { x: 0, z: 0 };
  const panX = camera.userData.panX || 0;
  const strength = panX > 0.5 ? 1.0 : 0.14;   // portrait: really follow
  camLook.set(
    THREE.MathUtils.clamp(h.x * strength, -panX - 0.6, panX + 0.6),
    0,
    (camera.userData.lookZ ?? 0.6) + h.z * 0.12
  );
  camTarget.lerp(camLook, Math.min(1, 3 * dt));
  const el = THREE.MathUtils.degToRad(52);
  const d = camera.userData.dist || 18;
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  camera.position.set(
    camTarget.x + sx,
    Math.sin(el) * d + sy,
    camTarget.z + Math.cos(el) * d
  );
  camera.lookAt(camTarget.x, 0.4, camTarget.z);
  state.shake *= Math.exp(-6 * dt);
}
window.addEventListener('resize', fitCamera);
fitCamera();

// ------------------------------------------------------------ events → juice
function handleEvents(eng) {
  for (const ev of eng.events) {
    const p = ev.p;
    const sz = p ? p.footR : 0.3;
    switch (ev.type) {
      case 'fallStart':
        audio.whoosh(sz);
        effects.ring(eng.hole.x, eng.hole.z, eng.hole.r * 0.7, eng.hole.r * 1.25, 0.35);
        if (ev.style === 'clean' && sz > 0.7) state.shake = Math.max(state.shake, 0.12);
        break;
      case 'slideStart': audio.whoosh(sz * 0.7); if (ev.dramatic) state.shake = Math.max(state.shake, 0.15); break;
      case 'tipStart': audio.squeak(); break;
      case 'teeter': audio.teeter(); break;
      case 'settle': audio.boing(sz); break;
      case 'stuckStart':
        audio.thud(0.6, sz); audio.squeak();
        effects.dust(p.x, p.z, 0.8);
        state.shake = Math.max(state.shake, 0.08);
        break;
      case 'stuckWobble': audio.squeak(); break;
      case 'squeezeThrough':
        audio.squeezePop(sz);
        effects.swallowSparkle(eng.hole.x, eng.hole.z, sz, '#c9f2ff');
        break;
      case 'popOut':
        audio.popOut(sz);
        effects.dust(p.x, p.z, 1);
        break;
      case 'bridge': audio.creak(); break;
      case 'bridgeSag': audio.creak(); break;
      case 'wheelCatch': audio.rattle(); audio.thud(0.35, sz * 0.5); break;
      case 'wheelRattle': audio.rattle(); break;
      case 'wheelFree': audio.boing(sz * 0.6); break;
      case 'swallow': {
        audio.gulp(ev.sizeClass);
        audio.grow();
        effects.swallowSparkle(eng.hole.x, eng.hole.z, ev.sizeClass);
        effects.ring(eng.hole.x, eng.hole.z, eng.hole.r * 0.6, eng.hole.r * 1.5, 0.4, '#ffe9b8');
        if (ev.sizeClass > 0.8) state.shake = Math.max(state.shake, 0.3);
        break;
      }
      case 'splash': audio.splash(); effects.splash(eng.hole.x, eng.hole.z); break;
      case 'splashFloat': audio.splash(); effects.splash(eng.hole.x, eng.hole.z); break;
      case 'glug': audio.glug(); break;
      case 'waterFill': audio.waterFill(); effects.splash(eng.hole.x, eng.hole.z, true); break;
      case 'waterDrain': audio.drain(); break;
      case 'launch': audio.launch(); break;
      case 'geyser': audio.geyser(); effects.splash(eng.hole.x, eng.hole.z, true); break;
      case 'land':
        audio.landBoom(Math.min(1, 0.4 + sz));
        effects.dust(p.x, p.z, 1.4);
        effects.ring(p.x, p.z, 0.4, 2.6 + sz * 1.5, 0.5);
        state.shake = Math.max(state.shake, 0.22);
        break;
      case 'shock': break;
      case 'knockOff': audio.detach(); break;
      case 'detach': audio.detach(); break;
      case 'thud':
        audio.thud(ev.strength || 0.4, sz);
        if ((ev.strength || 0) > 0.25) effects.dust(p.x, p.z, 0.6 + sz);
        break;
      case 'balloonPop': {
        audio.balloonPop();
        const e = state.entries.find((en) => en.prop === p);
        if (e && e.group.userData.balloon) {
          const b = e.group.userData.balloon;
          const world = new THREE.Vector3();
          b.children[1].getWorldPosition(world);
          effects.popFlash(world.x, world.y, world.z, '#ff8fa3');
          e.group.remove(b);
          e.group.userData.balloon = null;
        }
        break;
      }
      case 'balloonFly': {
        // knot slips: balloon floats up and away, gift drops
        audio.boing(0.4);
        audio.sparkle();
        const e = state.entries.find((en) => en.prop === p);
        if (e && e.group.userData.balloon) {
          const b = e.group.userData.balloon;
          const world = new THREE.Vector3();
          e.group.updateMatrixWorld(true);
          b.getWorldPosition(world);
          e.group.remove(b);
          e.group.userData.balloon = null;
          b.position.copy(world);
          scene.add(b);
          flyingBalloons.push({ mesh: b, t: 0 });
        }
        break;
      }
    }
  }
  eng.events.length = 0;
}

// escaped balloons drifting up to the ceiling
const flyingBalloons = [];
function updateBalloons(dt) {
  for (let i = flyingBalloons.length - 1; i >= 0; i--) {
    const b = flyingBalloons[i];
    b.t += dt;
    b.mesh.position.y += (1.6 + b.t) * dt;
    b.mesh.position.x += Math.sin(b.t * 2.4) * 0.4 * dt;
    b.mesh.rotation.z = Math.sin(b.t * 3) * 0.15;
    if (b.t > 4) {
      scene.remove(b.mesh);
      flyingBalloons.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------ mesh sync
const qYaw = new THREE.Quaternion();
const qTX = new THREE.Quaternion();
const qTZ = new THREE.Quaternion();
const qSpin = new THREE.Quaternion();
const axX = new THREE.Vector3(1, 0, 0);
const axY = new THREE.Vector3(0, 1, 0);
const axZ = new THREE.Vector3(0, 0, 1);
const spinAx = new THREE.Vector3();

function syncMeshes(dt) {
  for (const e of state.entries) {
    const p = e.prop, g = e.group;
    if (p.state === S.GONE) {
      if (g.visible) g.visible = false;
      continue;
    }
    g.position.set(p.x, p.y - p.sink, p.z);

    qYaw.setFromAxisAngle(axY, p.yaw);
    qTX.setFromAxisAngle(axX, p.tiltX);
    qTZ.setFromAxisAngle(axZ, p.tiltZ);
    g.quaternion.copy(qTX).multiply(qTZ).multiply(qYaw);
    if (p.spinAngle !== 0) {
      spinAx.set(p.spinAxis[0], p.spinAxis[1], p.spinAxis[2]).normalize();
      qSpin.setFromAxisAngle(spinAx, p.spinAngle);
      g.quaternion.premultiply(qSpin);
    }

    // jelly wobble + squash/stretch
    const wob = Math.sin(p.wobblePhase) * p.wobble * 0.06;
    const squash = Math.max(-0.45, Math.min(0.45, p.squash));
    const sy = (1 - squash) * (1 + wob);
    const sxz = (1 + squash * 0.6) * (1 - wob * 0.5);
    g.scale.set(sxz, sy, sxz);
  }
}

// ------------------------------------------------------------ main loop
const clock = new THREE.Clock();
let lastW = 0, lastH = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 1 / 24);

  // hole visuals always track the engine, even behind the title screen
  if (state.engine) holeView.update(dt, state.engine.hole);

  if (state.mode === 'game' || state.mode === 'celebrate') {
    const eng = state.engine;
    eng.update(dt);
    handleEvents(eng);
    syncMeshes(dt);

    if (state.mode === 'game') {
      const remaining = eng.remaining();
      ui.setMeter(1 - remaining / state.total);
      ui.setLaunchVisible(eng.belly.length > 0 && !eng.projectile);

      // idle helper for little hands
      state.idleT += dt;
      if (state.idleT > 12 && !pointerDown) { ui.showHint(true); }

      if (remaining === 0) {
        state.mode = 'celebrate';
        state.crowns++;
        localStorage.setItem('anadarake-crowns', String(state.crowns));
        audio.fanfare();
        state.confettiT = 0;
        ui.setLaunchVisible(false);
        setTimeout(() => ui.showCelebrate(state.crowns), 1400);
      }
    } else {
      // celebration confetti rains over the room
      state.confettiT -= dt;
      if (state.confettiT <= 0) {
        state.confettiT = 0.55;
        effects.confettiBurst((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, 40);
        audio.sparkle();
      }
    }
  }

  effects.update(dt);
  updateBalloons(dt);
  updateCamera(dt);
  if (lastW !== window.innerWidth || lastH !== window.innerHeight) {
    lastW = window.innerWidth; lastH = window.innerHeight;
    renderer.setSize(lastW, lastH, false);
    fitCamera();
  }
  renderer.render(scene, camera);
}

buildLevel();
ui.showTitle();
tick();

// debug / test hook (harmless in production)
window.__game = { state, ui, audio };
