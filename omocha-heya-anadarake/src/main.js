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

// the whole room lives inside a rotatable "toy box": worldGroup spins
// around the box's mid-height axis, boxGroup holds the actual contents
const BOX_PIVOT_Y = 2.6;
const worldGroup = new THREE.Group();
worldGroup.position.y = BOX_PIVOT_Y;
scene.add(worldGroup);
const boxGroup = new THREE.Group();
boxGroup.position.y = -BOX_PIVOT_Y;
worldGroup.add(boxGroup);

const holeView = new HoleView(boxGroup);
const room = new Room(scene, holeView, boxGroup);
const effects = new Effects(boxGroup);
const audio = new AudioEngine();

// ------------------------------------------------------------ state
const state = {
  mode: 'title',          // title | select | game | dive | celebrate
  stage: 0,               // 0 toy, 1 play, 2 guragura, 3 koron, 4 sakasama
  cine: null,             // running box-turning cinematic
  clears: JSON.parse(localStorage.getItem('anadarake-clears') || '[0,0,0,0,0]'),
  engine: null,
  entries: [],            // [{prop, group, built}]
  total: 1,
  shake: 0,
  idleT: 0,
  everTapped: false,
  confettiT: 0,
  diveT: 0,
};
while (state.clears.length < 5) state.clears.push(0);
state.round = 0; // legacy alias (palette index derived per stage)
Object.defineProperty(state, 'crowns', {
  get() { return (this.clears[0] || 0) + (this.clears[1] || 0); },
});

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
  boxGroup.add(m);
  e.shadow = m;
}

// ---- the world at the bottom of the hole: everything you drop piles up
const pileGroup = new THREE.Group();
pileGroup.position.set(0, -10.6, 0);
scene.add(pileGroup);
{
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 36),
    new THREE.MeshBasicMaterial({ color: '#3a2b3f' })
  );
  ground.rotation.x = -Math.PI / 2;
  pileGroup.add(ground);
  // fairy lights around the nest
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({ color: ['#ffd166', '#ff8fa3', '#8ce99a', '#6cc5ff'][i % 4] })
    );
    bulb.position.set(Math.cos(a) * 3.4, 0.4 + Math.sin(i * 2.3) * 0.2, Math.sin(a) * 3.4);
    pileGroup.add(bulb);
  }
}
let pileItems = [];
let pileCount = 0;
const pileQueue = [];

function clearPile() {
  for (const m of pileItems) pileGroup.remove(m);
  pileItems = [];
  pileCount = 0;
  pileQueue.length = 0;
  effects.floorY = 0;
}

function buildLevel() {
  for (const e of state.entries) {
    boxGroup.remove(e.group);
    pileGroup.remove(e.group);
    if (e.shadow) boxGroup.remove(e.shadow);
  }
  state.entries = [];
  clearPile();
  state.cine = null;
  worldGroup.rotation.z = 0;

  const palette = state.clears[state.stage] % 3;
  state.round = palette;
  room.build(palette, { boxy: state.stage === 3 });

  const eng = new HoleEngine({
    roomW: ROOM_W - 1.2, roomD: ROOM_D - 1.2,
    holeR: 0.42, holeX: 0, holeZ: 2.5,
    seed: 1000 + palette * 77 + state.stage * 13,
    tiltFloor: state.stage === 2,
  });
  const rand = mulberry32(500 + palette * 31 + state.stage * 7);
  state.entries = buildRound(boxGroup, eng, palette, rand, state.stage);
  for (const e of state.entries) attachShadow(e);
  state.engine = eng;
  state.total = eng.remaining();
  eng.setHoleTarget(0, 2.5);
  ui.setMeter(0);
  ui.setCrowns(state.crowns);
  refreshFlipPips();
}

// light the charge pips on any flip button to match its charge
function refreshFlipPips() {
  for (const e of state.entries) {
    const dev = e.prop.desc.device;
    if (!dev || dev.type !== 'flip' || !e.group.userData.pips) continue;
    const accent = e.group.userData.accent || '#ffd166';
    e.group.userData.pips.forEach((pip, i) => {
      if (i < dev.charge) {
        pip.material.color.set(accent);
        pip.material.emissive.set(accent);
        pip.material.emissiveIntensity = 0.6;
      } else {
        pip.material.color.set('#7d7468');
        pip.material.emissive.set('#000000');
      }
    });
  }
}

// ------------------------------------------------------------ UI
const ui = new UI(document.getElementById('ui'), {
  onPlay() {
    audio.unlock();
    state.mode = 'select';
    ui.showSelect(state.clears);
  },
  onStage(i) {
    audio.unlock();
    state.stage = i;
    buildLevel();
    state.mode = 'game';
    ui.showGame();
    ui.showHint(true);
    state.idleT = 0;
  },
  onHome() {
    audio.unlock();
    state.mode = 'select';
    ui.showSelect(state.clears);
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
    state.mode = 'select';
    ui.showSelect(state.clears);
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
const _lookA = new THREE.Vector3();
const _posA = new THREE.Vector3();
const _holeWorld = new THREE.Vector3();
function updateCamera(dt) {
  const h = state.engine ? state.engine.hole : { x: 0, z: 0, r: 0.5 };
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  state.shake *= Math.exp(-6 * dt);

  if (state.mode === 'dive' || state.mode === 'celebrate') {
    // the grand finale: dive into the hole down to the bottom world
    const t = state.diveT;
    const diveEl = THREE.MathUtils.degToRad(60);
    _posA.set(
      h.x + Math.sin(cam.az) * Math.cos(diveEl) * 4.5,
      Math.sin(diveEl) * 4.5,
      h.z + Math.cos(cam.az) * Math.cos(diveEl) * 4.5
    );
    if (state.mode === 'dive' && t < 1.0) {
      // swoop in over the mouth of the hole
      const k = t / 1.0;
      const d = cam.dist + (4.5 - cam.dist) * k;
      const e = cam.el + (diveEl - cam.el) * k;
      camera.position.set(
        h.x + Math.sin(cam.az) * Math.cos(e) * d,
        Math.sin(e) * d,
        h.z + Math.cos(cam.az) * Math.cos(e) * d
      );
      camera.lookAt(h.x, 0.3 - k * 2, h.z);
    } else if (state.mode === 'dive') {
      // plunge through the shaft, below its mouth, out into the cavern
      const k = Math.min(1, (t - 1.0) / 1.5);
      const e2 = k * k * (3 - 2 * k);
      camera.position.set(
        _posA.x + (h.x + 0.3 - _posA.x) * e2,
        _posA.y + (-8.4 - _posA.y) * e2,
        _posA.z + (h.z + 4.8 - _posA.z) * e2
      );
      _lookA.set(h.x, -1.5 - e2 * 8.6, h.z);
      camera.lookAt(_lookA);
    } else {
      // drift around the treasure pile in the bottom world
      cam.autoAz += dt * 0.18;
      const d = 6.8;
      camera.position.set(
        h.x + Math.sin(cam.autoAz) * d + sx,
        -8.35,
        h.z + Math.cos(cam.autoAz) * d
      );
      camera.lookAt(h.x, -10.1, h.z);
    }
    return;
  }

  let az, el, wantDist;
  if (state.mode === 'game' && state.cine) {
    // box-turning cinematic: pull back and watch the whole box
    camTarget.x += (0 - camTarget.x) * Math.min(1, 3 * dt);
    camTarget.z += (0.6 - camTarget.z) * Math.min(1, 3 * dt);
    az = cam.az; el = cam.el;
    wantDist = camera.userData.portrait ? 27 : 22;
  } else if (state.mode === 'game') {
    _holeWorld.set(h.x, 0, h.z);
    boxGroup.localToWorld(_holeWorld);
    camTarget.x += (_holeWorld.x - camTarget.x) * Math.min(1, 4.5 * dt);
    camTarget.z += (_holeWorld.z - camTarget.z) * Math.min(1, 4.5 * dt);
    az = cam.az; el = cam.el;
    wantDist = (6.6 + h.r * 3.4) * cam.zoom * (camera.userData.portrait ? 1.35 : 1);
  } else {
    // title / select: drift around the whole room
    cam.autoAz += dt * 0.1;
    camTarget.x += (0 - camTarget.x) * Math.min(1, 2 * dt);
    camTarget.z += (0.5 - camTarget.z) * Math.min(1, 2 * dt);
    az = cam.autoAz; el = THREE.MathUtils.degToRad(38);
    wantDist = camera.userData.portrait ? 24 : 19;
  }
  cam.dist += (THREE.MathUtils.clamp(wantDist, 4.5, 26) - cam.dist) * Math.min(1, 3 * dt);

  const ce = Math.cos(el), se = Math.sin(el);
  camera.position.set(
    camTarget.x + Math.sin(az) * ce * cam.dist + sx,
    se * cam.dist + sy,
    camTarget.z + Math.cos(az) * ce * cam.dist
  );
  camera.lookAt(camTarget.x, 0.45, camTarget.z);
}
window.addEventListener('resize', fitCamera);
fitCamera();

// ------------------------------------------------------------ input
// one finger: move the hole. two fingers: orbit + pinch (hole move cancels).
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorNormal = new THREE.Vector3();
const floorPoint = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
let pointerDown = false;
const touches = new Map();
let gesture = null;

function pointToFloor(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  // the floor may be tilted with the box: intersect its actual plane
  boxGroup.updateMatrixWorld(true);
  floorNormal.set(0, 1, 0).transformDirection(boxGroup.matrixWorld);
  floorPoint.set(0, 0, 0).applyMatrix4(boxGroup.matrixWorld);
  floorPlane.setFromNormalAndCoplanarPoint(floorNormal, floorPoint);
  if (ray.ray.intersectPlane(floorPlane, hitPoint)) {
    boxGroup.worldToLocal(hitPoint);
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
  if (state.mode !== 'game' || state.cine) return;
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
  if (state.mode !== 'game' || state.cine) return;
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
        const minis = spawnPinataContents(boxGroup, eng, state.round, ev.x, ev.z);
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
      case 'walkerCry':
        if (p && p.desc.walker.kind === 'dog') audio.bark();
        else if (p && p.desc.walker.kind === 'cat') audio.meow();
        else audio.piyo(p && p.desc.kind === 'hen');
        break;
      case 'peck': audio.peck(); break;
      case 'pant':
        audio.pant();
        if (p) effects.dust(p.x, p.z, 0.3, '#ffffff');
        break;
      case 'dogNudge': audio.bark(); break;
      case 'catJump': audio.meow(); audio.boing(0.3); break;
      case 'catEvicted': audio.meow(true); break;
      case 'seesawFlip': {
        audio.seesaw();
        const e = state.entries.find((en) => en.prop === p);
        if (e && e.group.userData.plank) {
          tweens.push({
            t: 0, dur: 0.3, obj: e.group.userData.plank,
            fn(o, k) { o.rotation.z = 0.3 - 0.6 * (k < 0.8 ? k / 0.8 * 1.15 : 1.15 - (k - 0.8)
              / 0.2 * 0.15); },
          });
        }
        state.shake = Math.max(state.shake, 0.12);
        break;
      }
      case 'catapult': audio.launch(); break;
      case 'cupboardOpen': {
        audio.doorBang();
        state.shake = Math.max(state.shake, 0.15);
        const e = state.entries.find((en) => en.prop === p);
        if (e && e.group.userData.doors) {
          for (const door of e.group.userData.doors) {
            tweens.push({
              t: 0, dur: 0.45, obj: door,
              fn(o, k) { o.rotation.y = o.userData.openAngle * (k < 0.7 ? k / 0.7 * 1.2 : 1.2 - (k - 0.7) / 0.3 * 0.2); },
            });
          }
        }
        if (p) effects.dust(p.x, p.z, 1.4);
        break;
      }
      case 'tramp': {
        audio.boing(0.25);
        const src = eng.byId.get(ev.on);
        const e = state.entries.find((en) => en.prop === src);
        if (e && e.group.userData.surface) {
          tweens.push({
            t: 0, dur: 0.25, obj: e.group.userData.surface,
            fn(o, k) { o.scale.y = 1 - Math.sin(k * Math.PI) * 0.6; },
          });
        }
        break;
      }
      case 'slideStartRun': case 'slideCatch': audio.whee(); break;
      case 'slideExit': audio.whoosh(0.3); if (p) effects.dust(p.x, p.z, 0.5); break;
      case 'railCatch': audio.tick(); audio.boing(0.2); break;
      case 'railTick': audio.tick(); break;
      case 'railDrop': audio.whoosh(0.2); break;
      case 'burp': {
        audio.burp();
        eng.hole.rVel += 1.6;   // the rim ripples with the burp
        effects.swallowSparkle(eng.hole.x, eng.hole.z, 0.4, '#c9f2ff');
        break;
      }
      case 'burpSpit': audio.popOut(sz); break;
      case 'tiltCreak': audio.creak(); break;
      case 'lever':
        audio.clank();
        startCine('koron', p);
        break;
      case 'flip':
        audio.ding();
        refreshFlipPips();
        startCine('flip', p);
        break;
      case 'flipCharge': {
        refreshFlipPips();
        if (ev.charge >= ev.need) audio.ding();
        break;
      }
      case 'rainStart': break;
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
        // …and a moment later it lands on the treasure pile down below
        const e = state.entries.find((en) => en.prop === p);
        if (e) pileQueue.push({ e, t: 0.7 });
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
          boxGroup.attach(b);      // keep its world pose inside the box
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
  if (p.desc.walker) {
    if (p.desc.walker.kind === 'dog') return '🐶';
    if (p.desc.walker.kind === 'cat') return '🐱';
    return p.desc.kind === 'hen' ? '🐔' : '🐤';
  }
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
    if (p.state === S.GONE || p.desc.fixture || p.supportId || p._raining) continue;
    markerVec.set(p.x, 0.4, p.z);
    boxGroup.localToWorld(markerVec);
    markerVec.project(camera);
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

// ------------------------------------------------------------ cinematics
// コロン (the box tips on its side) & さかさま (the box flips right over)
function startCine(type, prop) {
  state.cine = { type, t: 0, prop };
  state.engine.frozen = true;
  ui.setLaunchVisible(false);
  ui.showHint(false);
}

const LEVER_SPOTS = [[9.3, 3.0, -Math.PI / 2], [0, -6.6, 0], [-9.3, 2.0, Math.PI / 2]];
function updateCine(dt) {
  const c = state.cine;
  if (!c) return;
  c.t += dt;
  const eng = state.engine;

  if (c.type === 'koron') {
    if (c.t < 0.5) {
      // rumble…
      state.shake = Math.max(state.shake, 0.12);
      worldGroup.rotation.z = Math.sin(c.t * 42) * 0.012;
      if (!c.rumbled) { c.rumbled = true; audio.rumble(); }
    } else if (c.t < 2.0) {
      // the box heaves over…
      const k = (c.t - 0.5) / 1.5;
      worldGroup.rotation.z = -(k * k) * 0.6;
      state.shake = Math.max(state.shake, 0.08);
    } else if (!c.crashed) {
      // …CRASH: cut to the box resting on its (new) bottom
      c.crashed = true;
      worldGroup.rotation.z = 0;
      audio.crash();
      state.shake = 0.55;
      room.build(state.round, { boxy: true });
      // the lever is bolted to a different wall now
      const dev = c.prop.desc.device;
      const spot = LEVER_SPOTS[Math.min(1 - dev.count, LEVER_SPOTS.length - 1)];
      c.prop.x = spot[0]; c.prop.z = spot[1]; c.prop.yaw = spot[2];
      const e = state.entries.find((en) => en.prop === c.prop);
      if (e) { e.group.position.set(c.prop.x, 0, c.prop.z); e.group.rotation.y = c.prop.yaw; }
      // everything tumbles across to the new floor
      eng.rainAll({ stagger: 0.05, yMin: 3.0, ySpan: 2.5, scatter: 3.0, vxBias: 0.8 });
      for (let i = 0; i < 9; i++) {
        effects.dust((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, 1.6);
      }
    } else if (c.t > 2.6) {
      eng.frozen = false;
      c.prop.desc.device.busy = false;
      state.cine = null;
    }
    return;
  }

  // flip (さかさま)
  if (c.t < 0.4) {
    if (!c.popped) { c.popped = true; audio.squeezePop(0.3); }
  } else if (c.t < 2.6) {
    // slowly over…  (toys visibly hang from what is now the top)
    const k = (c.t - 0.4) / 2.2;
    const e2 = k * k * (3 - 2 * k);
    worldGroup.rotation.z = Math.PI * e2;
    if (!c.wh) { c.wh = true; audio.flipWhoosh(); }
  } else if (c.t < 3.8) {
    worldGroup.rotation.z = Math.PI;
    if (!c.held) { c.held = true; audio.boing(0.5); state.shake = 0.2; }
  } else if (c.t < 5.8) {
    // …and back — the toys stay up there, then rain down
    if (!c.rained) {
      c.rained = true;
      eng.rainAll({ stagger: 0.16, yMin: 5.5, ySpan: 3, scatter: 1.5 });
      audio.flipWhoosh();
    }
    const k = (c.t - 3.8) / 2;
    const e2 = k * k * (3 - 2 * k);
    worldGroup.rotation.z = Math.PI * (1 - e2);
  } else {
    worldGroup.rotation.z = 0;
    eng.frozen = false;
    c.prop.desc.device.busy = false;
    refreshFlipPips();
    state.cine = null;
  }
}

// small visual tweens (cupboard doors, seesaw plank, trampoline squash)
const tweens = [];
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.obj, k);
    if (k >= 1) tweens.splice(i, 1);
  }
}

// drop swallowed toys onto the bottom-world pile a beat later
function placeInPile(e) {
  const g = e.group;
  pileGroup.add(g);
  const r = Math.sqrt(Math.random()) * 1.7;
  const a = Math.random() * Math.PI * 2;
  const rr = r * 1.35;   // spread the treasure wide so it reads from the side
  if (e.prop.desc.walker) {
    // caught critters stand happily on top of the treasure
    g.position.set(Math.cos(a) * rr, 0.5 + (2.3 - rr) * 0.3, Math.sin(a) * rr);
    g.rotation.set(0, Math.random() * 6.28, 0);
    if (g.userData.face) g.userData.face.set('normal');
  } else {
    g.position.set(Math.cos(a) * rr,
      Math.max(0.03, (2.3 - rr) * 0.4 * Math.random() + pileCount * 0.012),
      Math.sin(a) * rr);
    g.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
  }
  g.scale.set(1, 1, 1);
  g.visible = true;
  pileCount++;
  pileItems.push(g);
  e.inPile = true;
}

function updatePile(dt) {
  const h = state.engine ? state.engine.hole : { x: 0, z: 0 };
  pileGroup.position.x += (h.x - pileGroup.position.x) * Math.min(1, 1.4 * dt);
  pileGroup.position.z += (h.z - pileGroup.position.z) * Math.min(1, 1.4 * dt);
  for (let i = pileQueue.length - 1; i >= 0; i--) {
    const q = pileQueue[i];
    q.t -= dt;
    if (q.t > 0) continue;
    pileQueue.splice(i, 1);
    if (q.e.prop.state === S.GONE && !q.e.inPile) placeInPile(q.e);
  }
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
      if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
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
    if (e.inPile) {
      if (p.state !== S.GONE) {          // launched or burped back up
        scene.add(g);
        e.inPile = false;
      } else {
        continue;                        // resting on the treasure pile
      }
    }
    if (p.state === S.GONE) {
      if (g.visible) g.visible = false;
      if (e.shadow) e.shadow.visible = false;
      continue;
    }
    if (p._raining) {              // waiting up in the sky for its turn
      if (g.visible) g.visible = false;
      if (e.shadow) e.shadow.visible = false;
      continue;
    }
    if (!g.visible) g.visible = true;
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
    // wagging tails for the dog & cat
    if (g.userData.tail && p.desc.walker) {
      const wag = p.desc.walker.kind === 'dog' ? 0.55 : 0.25;
      g.userData.tail.rotation.x = Math.sin(p.wobblePhase * 0.8 + p.id) * wag;
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

  if (state.mode === 'game' || state.mode === 'dive' || state.mode === 'celebrate') {
    const eng = state.engine;
    updateCine(dt);
    eng.update(dt);
    handleEvents(eng);
    syncMeshes(dt);
    // the seesaw floor leans with the weight still on it
    if (!state.cine) worldGroup.rotation.z = -eng.tilt;

    if (state.mode === 'game') {
      const remaining = eng.remaining();
      ui.setMeter(1 - remaining / state.total);
      ui.setLaunchVisible(eng.belly.length > 0 && !eng.projectile);

      // idle helper for little hands
      state.idleT += dt;
      if (state.idleT > 12 && !pointerDown) { ui.showHint(true); }

      if (remaining === 0) {
        // the grand dive down to the bottom world
        state.mode = 'dive';
        state.diveT = 0;
        state.clears[state.stage] = (state.clears[state.stage] || 0) + 1;
        localStorage.setItem('anadarake-clears', JSON.stringify(state.clears));
        audio.fanfare();
        effects.floorY = -10.55;
        state.confettiT = 0;
        ui.setLaunchVisible(false);
        ui.showHint(false);
      }
    } else if (state.mode === 'dive') {
      state.diveT += dt;
      if (state.diveT > 2.9) {
        state.mode = 'celebrate';
        ui.showCelebrate(state.crowns);
      }
    } else {
      // confetti rains down onto the treasure pile
      state.confettiT -= dt;
      if (state.confettiT <= 0) {
        state.confettiT = 0.6;
        effects.confettiBurst(eng.hole.x, eng.hole.z, 34, -7.6);
        audio.sparkle();
      }
    }
  }

  updateTweens(dt);
  updatePile(dt);

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
