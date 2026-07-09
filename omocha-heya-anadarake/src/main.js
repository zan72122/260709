// おもちゃのへや あなだらけ! — main loop & glue.
// Donut-County-style hole sandbox for small kids on iPhone/iPad.

import * as THREE from '../vendor/three.module.min.js';
import { HoleEngine, S, mulberry32 } from './physics.js';
import { buildRound, spawnPinataContents } from './props.js';
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

// soft round contact shadow, shared texture + per-prop material
const blobTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  gr.addColorStop(0, 'rgba(60,30,10,0.5)');
  gr.addColorStop(0.7, 'rgba(60,30,10,0.28)');
  gr.addColorStop(1, 'rgba(60,30,10,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const blobGeo = new THREE.PlaneGeometry(1, 1);

function attachShadow(e) {
  const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
    map: blobTex, transparent: true, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 4;
  scene.add(m);
  e.shadow = m;
}

function buildLevel() {
  for (const e of state.entries) {
    scene.remove(e.group);
    if (e.shadow) scene.remove(e.shadow);
  }
  state.entries = [];

  room.build(state.round);

  const eng = new HoleEngine({
    roomW: ROOM_W - 1.2, roomD: ROOM_D - 1.2,
    holeR: 0.42, holeX: 0, holeZ: 2.5,
    seed: 1000 + state.round * 77,
  });
  const rand = mulberry32(500 + state.round * 31);
  state.entries = buildRound(scene, eng, state.round, rand);
  for (const e of state.entries) attachShadow(e);
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

// ------------------------------------------------------------ camera v3
// The camera lives with the hole: close while the hole is small (falls fill
// the screen), pulling back as it grows. Two fingers orbit & pinch-zoom.
const cam = {
  az: 0,                                    // horizontal orbit, radians
  el: THREE.MathUtils.degToRad(40),         // 25°..60°
  zoom: 1,                                  // pinch multiplier 0.6..1.6
  dist: 12,                                 // smoothed actual distance
  autoAz: 0,                                // slow orbit on title/celebrate
};
const EL_MIN = THREE.MathUtils.degToRad(25);
const EL_MAX = THREE.MathUtils.degToRad(60);

function fitCamera() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = 48;
  camera.userData.portrait = camera.aspect < 0.9;
  camera.updateProjectionMatrix();
}

const camTarget = new THREE.Vector3(0, 0, 2.5);
function updateCamera(dt) {
  const playing = state.mode === 'game';
  const h = state.engine ? state.engine.hole : { x: 0, z: 0, r: 0.5 };

  let az, el, wantDist, lookY;
  if (playing) {
    camTarget.x += (h.x - camTarget.x) * Math.min(1, 4.5 * dt);
    camTarget.z += (h.z - camTarget.z) * Math.min(1, 4.5 * dt);
    az = cam.az; el = cam.el;
    wantDist = (6.6 + h.r * 3.4) * cam.zoom * (camera.userData.portrait ? 1.35 : 1);
  } else {
    // title / celebration: drift around the whole room
    cam.autoAz += dt * 0.1;
    camTarget.x += (0 - camTarget.x) * Math.min(1, 2 * dt);
    camTarget.z += (0.5 - camTarget.z) * Math.min(1, 2 * dt);
    az = cam.autoAz; el = THREE.MathUtils.degToRad(38);
    wantDist = camera.userData.portrait ? 24 : 19;
  }
  cam.dist += (THREE.MathUtils.clamp(wantDist, 4.5, 26) - cam.dist) * Math.min(1, 3 * dt);

  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  const ce = Math.cos(el), se = Math.sin(el);
  camera.position.set(
    camTarget.x + Math.sin(az) * ce * cam.dist + sx,
    se * cam.dist + sy,
    camTarget.z + Math.cos(az) * ce * cam.dist
  );
  camera.lookAt(camTarget.x, 0.45, camTarget.z);
  state.shake *= Math.exp(-6 * dt);
}
window.addEventListener('resize', fitCamera);
fitCamera();

// ------------------------------------------------------------ input
// one finger: move the hole. two fingers: orbit + pinch (hole move cancels).
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let pointerDown = false;
const touches = new Map();
let gesture = null;

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

function gestureFrom() {
  const [a, b] = [...touches.values()];
  return {
    cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
    span: Math.hypot(a.x - b.x, a.y - b.y),
    az0: cam.az, el0: cam.el, zoom0: cam.zoom,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state.mode !== 'game') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size >= 2) {
    pointerDown = false;             // second finger: switch to camera mode
    gesture = gestureFrom();
    return;
  }
  pointerDown = true;
  if (pointToFloor(e.clientX, e.clientY)) audio.tap();
  state.idleT = 0;
  state.everTapped = true;
  ui.showHint(false);
});
canvas.addEventListener('pointermove', (e) => {
  if (state.mode !== 'game') return;
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && touches.size >= 2) {
    const g = gestureFrom();
    cam.az = gesture.az0 - (g.cx - gesture.cx) * 0.008;
    cam.el = THREE.MathUtils.clamp(gesture.el0 + (g.cy - gesture.cy) * 0.005, EL_MIN, EL_MAX);
    cam.zoom = THREE.MathUtils.clamp(gesture.zoom0 * (gesture.span / Math.max(20, g.span)), 0.6, 1.6);
    state.idleT = 0;
    return;
  }
  if (!pointerDown) return;
  pointToFloor(e.clientX, e.clientY);
  state.idleT = 0;
});
function dropPointer(e) {
  touches.delete(e.pointerId);
  if (touches.size < 2) gesture = null;
  if (touches.size === 0) pointerDown = false;
}
window.addEventListener('pointerup', dropPointer);
window.addEventListener('pointercancel', dropPointer);
// desktop convenience: wheel zooms
window.addEventListener('wheel', (e) => {
  cam.zoom = THREE.MathUtils.clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.6, 1.6);
}, { passive: true });

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
      case 'topple':
        audio.tumble(sz);
        if (ev.dramatic) state.shake = Math.max(state.shake, 0.15);
        break;
      case 'tipStart': audio.squeak(); break;
      case 'wallBump':
        audio.wallBump(sz, ev.speed || 1);
        effects.dust(ev.x, ev.z, 0.35, '#a8763e');
        break;
      case 'shakeRattle':
        audio.rattle();
        if (p) effects.dust(p.x + (Math.random() - 0.5) * p.footR, p.z + (Math.random() - 0.5) * p.footR, 0.3);
        break;
      case 'slideOff': audio.boing(sz); break;
      case 'pinata': {
        audio.pinataPop();
        effects.confettiBurst(ev.x, ev.z, 50);
        effects.swallowSparkle(ev.x, ev.z, 0.8, '#ff8fa3');
        state.shake = Math.max(state.shake, 0.2);
        const minis = spawnPinataContents(scene, eng, state.round, ev.x, ev.z);
        for (const m of minis) attachShadow(m);
        state.entries.push(...minis);
        state.total += minis.length;
        break;
      }
      case 'catchWalker':
        audio.catchJingle();
        effects.confettiBurst(eng.hole.x, eng.hole.z, 24);
        effects.swallowSparkle(eng.hole.x, eng.hole.z, 0.5, '#fff3b0');
        break;
      case 'walkerCry': audio.piyo(p && p.desc.kind === 'hen'); break;
      case 'peck': audio.peck(); break;
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

// ------------------------------------------------------------ edge markers
// point at off-screen toys so the zoomed-in camera never loses the child
const markerVec = new THREE.Vector3();
function emojiFor(p) {
  if (p.desc.walker) return p.desc.kind === 'hen' ? '🐔' : '🐤';
  if (p.desc.balloon) return '🎈';
  if (p.desc.waterSource) return '🛁';
  return '🧸';
}
function updateEdgeMarkers() {
  if (state.mode !== 'game') { ui.updateMarkers([]); return; }
  const eng = state.engine;
  const cands = [];
  for (const e of state.entries) {
    const p = e.prop;
    if (p.state === S.GONE || p.desc.fixture || p.supportId) continue;
    markerVec.set(p.x, 0.4, p.z).project(camera);
    let nx = markerVec.x, ny = markerVec.y;
    const behind = markerVec.z > 1;
    if (behind) { nx = -nx; ny = -ny; }
    if (!behind && Math.abs(nx) < 1.02 && Math.abs(ny) < 1.02) continue;
    const d = Math.hypot(p.x - eng.hole.x, p.z - eng.hole.z);
    cands.push({ p, nx, ny, d });
  }
  cands.sort((a, b) => a.d - b.d);
  const items = [];
  for (const c of cands.slice(0, 3)) {
    // clamp the direction vector to the screen rectangle edge
    const k = 0.84 / Math.max(Math.abs(c.nx), Math.abs(c.ny), 0.01);
    const ex = c.nx * Math.min(k, 1);
    const ey = c.ny * Math.min(k, 1);
    items.push({
      xPct: (ex * 0.5 + 0.5) * 100,
      yPct: (1 - (ey * 0.5 + 0.5)) * 100,
      deg: Math.atan2(-c.ny, c.nx) * 180 / Math.PI,
      emoji: emojiFor(c.p),
    });
  }
  ui.updateMarkers(items);
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
      if (g.visible) {
        g.visible = false;
        if (e.shadow) e.shadow.visible = false;
      }
      continue;
    }
    g.position.set(p.x, p.y - p.sink, p.z);

    // contact blob: shrinks and fades as the toy leaves the ground
    if (e.shadow) {
      const under = p.y < -0.05 || p.state === S.FALLING || p.state === S.FLOATING;
      e.shadow.visible = !under;
      if (!under) {
        const h = Math.max(0, p.y);
        const s = p.footR * 2.5 * (1 - Math.min(0.45, h * 0.10));
        e.shadow.position.set(p.x, 0.015, p.z);
        e.shadow.scale.set(s, s, 1);
        e.shadow.material.opacity = Math.max(0, 1 - h / 3.2) * 0.9;
      }
    }

    // expressive face: eyes shut while tumbling, tiny pupils when scared
    const face = g.userData.face;
    if (face) {
      const tumbling = p.state === S.TOPPLE || p.state === S.ENDTIP ||
        p.state === S.FALLING || p.state === S.STUCK || p.state === S.TOSSED;
      face.set(tumbling ? 'closed' : p.fear > 0.45 ? 'scared' : 'normal');
    }

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
  updateEdgeMarkers();
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
window.__game = { state, ui, audio, cam };
