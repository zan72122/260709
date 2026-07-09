// キラキラ☆ようせいマジック にじいろガーデン — main loop & glue.
// States: title → select (pick your fairy in 3D) → play (bloom flowers,
// earn the magic key, open the door, meet a friend) ×4 stages → finale
// fireworks party. Every touch does something sparkly; there is no way
// to lose.

import * as THREE from '../vendor/three.module.min.js';
import { STAGES, FAIRIES, DRESS_CYCLE, PRAISE } from './stages.js';
import { Progression } from './progression.js';
import { World } from './world.js';
import { createFairy, FairyController, setDressColor, glowTexture } from './fairy.js';
import { FlowerField } from './flora.js';
import { SparkleField, Fireflies } from './particles.js';
import { createKey, createDoor, updateKey, updateDoor } from './keydoor.js';
import { FriendManager, Butterfly } from './friends.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

// ------------------------------------------------------------ setup

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);

const ui = new UI();
const audio = new AudioEngine();
const world = new World(scene);
const sparkles = new SparkleField(scene, 2200);
const fireflies = new Fireflies(scene);
const flora = new FlowerField(scene);
const friendMgr = new FriendManager(scene);
const progression = new Progression(STAGES);

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();

const RAINBOW = [0xff6d9d, 0xffa94f, 0xffe14f, 0x7fdd6f, 0x5fb8ff, 0xb48ff5];

let state = 'title';
let fairy = null;           // chosen fairy mesh
let fairyCtl = null;
let fairyPal = FAIRIES[0];
let selectFairies = [];     // { mesh, pal, seed }
let titleButterflies = [];
let key = null, keyHeld = false;
let door = null;
let doorOpening = false;
let pendingAction = null;   // { type, ... } executed when fairy reaches target
let dressIdx = 0;
let lastInputT = 0;
let budTimer = 0;
let shootTimer = 8;
let shootingStars = [];
let partyTimer = 0;
let spiralOn = false, spiralA = 0, spiralY = 0, spiralSndT = 0;

// blob shadow under the fairy
function makeShadow() {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(30,40,60,0.35)');
  grad.addColorStop(1, 'rgba(30,40,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}
const fairyShadow = makeShadow();
fairyShadow.visible = false;
scene.add(fairyShadow);

// gem pool: little octahedra that arc from a bloom to the fairy
const gemPool = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshStandardMaterial({
    color: 0xffe14f, emissive: 0xffcc44, emissiveIntensity: 0.9, roughness: 0.25,
  }));
  m.visible = false;
  scene.add(m);
  gemPool.push({ mesh: m, t: -10, from: new THREE.Vector3(), ctrl: new THREE.Vector3() });
}
function launchGem(from, delay = 0) {
  const g = gemPool.find((x) => x.t <= -5);
  if (!g) return;
  g.t = -delay;
  g.from.copy(from);
  g.ctrl.set(from.x + (Math.random() - 0.5) * 2, from.y + 2.4 + Math.random(), from.z + (Math.random() - 0.5) * 2);
}
function updateGems(dt) {
  const target = fairy ? fairy.position : new THREE.Vector3(0, 2, 0);
  for (const g of gemPool) {
    if (g.t <= -5) continue;
    if (g.t < 0) { g.t += dt; g.mesh.visible = false; if (g.t >= 0) g.t = 0.0001; else continue; }
    g.t += dt * 1.5;
    if (g.t >= 1) {
      g.t = -10;
      g.mesh.visible = false;
      progression.addGems(1).forEach((ev) => { if (ev === 'fireworks') bonusFireworks(); });
      ui.setGems(progression.gems);
      audio.gem();
      sparkles.burst(target, 0xffe14f, 6, 1.2, 0.5, 0.4, 0.4, 1);
      continue;
    }
    const t = g.t;
    g.mesh.visible = true;
    // quadratic bezier from → ctrl → fairy
    const a = g.from, b = g.ctrl, c = target;
    g.mesh.position.set(
      (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
      (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
      (1 - t) * (1 - t) * a.z + 2 * (1 - t) * t * b.z + t * t * c.z
    );
    g.mesh.rotation.y += dt * 8;
    g.mesh.rotation.x += dt * 5;
  }
}

// ------------------------------------------------------------ camera

const camPos = new THREE.Vector3(0, 4.5, 10);
const camLook = new THREE.Vector3(0, 1, 0);
function isPortrait() { return window.innerHeight > window.innerWidth; }

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = isPortrait() ? 66 : 52;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

function updateCamera(dt, t) {
  let want, look;
  if (state === 'select') {
    want = new THREE.Vector3(0, 2.5, isPortrait() ? 12.5 : 8.6);
    look = new THREE.Vector3(0, 1.5, 0);
  } else if (state === 'title') {
    const a = t * 0.08;
    want = new THREE.Vector3(Math.sin(a) * 13, 5.5, Math.cos(a) * 13);
    look = new THREE.Vector3(0, 1.5, 0);
  } else {
    const p = fairy ? fairy.position : new THREE.Vector3();
    const drift = Math.sin(t * 0.07) * 0.22;
    const dist = isPortrait() ? 11.2 : 8.8;
    const height = isPortrait() ? 5.6 : 4.3;
    want = new THREE.Vector3(p.x * 0.55 + Math.sin(drift) * dist, p.y * 0.4 + height, p.z * 0.55 + Math.cos(drift) * dist);
    look = new THREE.Vector3(p.x, p.y * 0.7 + 0.6, p.z);
  }
  const k = Math.min(1, dt * 2.2);
  camPos.lerp(want, k);
  camLook.lerp(look, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ------------------------------------------------------------ stage setup

function buildDoor() {
  if (door) scene.remove(door);
  door = createDoor(progression.stage.petals[0]);
  door.position.set(0, 0, -9.8);
  scene.add(door);
  doorOpening = false;
}

function removeKey() {
  if (key) { scene.remove(key); key = null; }
  keyHeld = false;
}

function setupStage(first = false) {
  const st = progression.stage;
  world.setStage(st);
  flora.clear();
  removeKey();
  buildDoor();
  fireflies.setCount(st.fireflies, st.theme === 'night' ? 0xcfe0ff : 0xfff3a8);
  audio.setMusicRoot(st.musicRoot);
  budTimer = 0;
  for (let i = 0; i < 3; i++) spawnBud();
  ui.setMeter(0, st.budsNeeded, false);
  if (!first) ui.showBanner(st.name, st.emoji);
}

function spawnBud() {
  if (flora.buds.length >= progression.stage.budsMax) return;
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -6.5 && Math.abs(x) < 4) continue; // keep clear of the door
    let clash = false;
    for (const b of flora.buds) if (b.group.position.distanceToSquared(new THREE.Vector3(x, 0, z)) < 2.6) { clash = true; break; }
    for (const f of flora.flowers) if (f.group.position.distanceToSquared(new THREE.Vector3(x, 0, z)) < 1.4) { clash = true; break; }
    if (clash) continue;
    flora.spawnBud(x, z);
    return;
  }
}

// ------------------------------------------------------------ state changes

function enterTitle() {
  state = 'title';
  progression.reset();
  friendMgr.clear();
  removeKey();
  if (fairy) { scene.remove(fairy); fairy = null; fairyCtl = null; }
  for (const f of selectFairies) scene.remove(f.mesh);
  selectFairies = [];
  fairyShadow.visible = false;
  for (const g of gemPool) { g.t = -10; g.mesh.visible = false; }
  setupStage(true);
  ui.setGems(0);
  ui.hide(ui.hud);
  ui.hide(ui.finale);
  ui.show(ui.title);
  ui.hide(ui.selectHint);
  // ambient butterflies on the title screen
  for (const b of titleButterflies) scene.remove(b.group);
  titleButterflies = [];
  for (let i = 0; i < 4; i++) {
    const b = new Butterfly(RAINBOW[i % RAINBOW.length]);
    b.pos.set(Math.cos(i * 1.6) * 4, 2 + i * 0.4, Math.sin(i * 1.6) * 4);
    scene.add(b.group);
    titleButterflies.push(b);
  }
}

function enterSelect() {
  state = 'select';
  ui.hide(ui.title);
  ui.show(ui.selectHint);
  for (const b of titleButterflies) scene.remove(b.group);
  titleButterflies = [];
  selectFairies = FAIRIES.map((pal, i) => {
    const mesh = createFairy(pal);
    mesh.userData.baseY = 1.4;
    return { mesh, pal, seed: i * 2.3 };
  });
  layoutSelectFairies();
  for (const f of selectFairies) {
    f.mesh.position.set(f.mesh.userData.baseX, f.mesh.userData.baseY, f.mesh.userData.baseZ);
    scene.add(f.mesh);
  }
  audio.gliss();
}

/** Responsive roster layout: vertical zig-zag in portrait, arc in landscape. */
function layoutSelectFairies() {
  for (let i = 0; i < selectFairies.length; i++) {
    const u = selectFairies[i].mesh.userData;
    if (isPortrait()) {
      u.baseX = (i % 2 === 0 ? -1 : 1) * 1.0;
      u.baseY = 4.6 - i * 0.95;
      u.baseZ = 4.6;
    } else {
      const a = (i - 2) * 0.36;
      u.baseX = Math.sin(a) * 4.6;
      u.baseY = 1.6;
      u.baseZ = 4.5 - Math.cos(a) * 4.0;
    }
  }
}

function chooseFairy(rec) {
  fairyPal = rec.pal;
  fairy = rec.mesh;
  for (const f of selectFairies) {
    if (f !== rec) {
      sparkles.burst(f.mesh.position, f.pal.wing, 24, 2.2, 0.9, 0.5, 0.5, 1);
      scene.remove(f.mesh);
    }
  }
  selectFairies = [];
  fairyCtl = new FairyController(fairy);
  fairyCtl.setTarget(new THREE.Vector3(0, 2, 2));
  fairyCtl.twirl();
  fairyShadow.visible = true;
  audio.twirl();
  sparkles.burst(fairy.position, [rec.pal.wing, 0xffffff, rec.pal.accent], 40, 3, 1.2, 0.6, 0.6, 1);
  ui.hide(ui.selectHint);
  ui.showBanner(`${rec.pal.name}に きめた！`, rec.pal.emoji);
  setTimeout(() => {
    state = 'play';
    ui.show(ui.hud);
    ui.showBanner(progression.stage.name, progression.stage.emoji);
  }, 1100);
}

function bonusFireworks() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const p = new THREE.Vector3((Math.random() - 0.5) * 12, 6 + Math.random() * 3, (Math.random() - 0.5) * 12);
      sparkles.firework(p, RAINBOW);
      audio.firework();
    }, i * 350);
  }
  const [txt, emo] = PRAISE[(Math.random() * PRAISE.length) | 0];
  ui.showPraise(txt, emo);
}

function doBloom(bud) {
  const st = progression.stage;
  const color = st.petals[(Math.random() * st.petals.length) | 0];
  const f = flora.bloom(bud, color, clockT);
  if (!f) return;
  audio.bloom();
  sparkles.burst(f.group.position.clone().add(new THREE.Vector3(0, 1, 0)), [color, 0xffffff, 0xffe14f], 26, 2.6, 1.0, 0.55, 0.8, 1);
  for (let i = 0; i < 3; i++) launchGem(f.group.position.clone().add(new THREE.Vector3(0, 1, 0)), i * 0.12);
  const evs = progression.addBloom();
  ui.setMeter(Math.min(progression.blooms, progression.stage.budsNeeded), progression.stage.budsNeeded, progression.keySpawned);
  if (Math.random() < 0.35 && !evs.length) {
    const [txt, emo] = PRAISE[(Math.random() * PRAISE.length) | 0];
    ui.showPraise(txt, emo);
  }
  for (const ev of evs) if (ev === 'key') spawnKey();
}

function spawnKey() {
  key = createKey();
  const a = Math.random() * Math.PI * 2;
  key.position.set(Math.cos(a) * 5, 2.4, Math.abs(Math.sin(a)) * 5 + 1);
  key.scale.setScalar(0.01);
  scene.add(key);
  audio.keyJingle();
  ui.showBanner('まほうの カギが でたよ！', '🗝️');
  sparkles.burst(key.position, 0xffe14f, 40, 3, 1.4, 0.6, 0.6, 1);
  ui.emojiRain(['🗝️', '✨', '⭐'], 12);
}

function grabKey() {
  if (!key || keyHeld) return;
  keyHeld = true;
  progression.grabKey();
  audio.fanfare();
  sparkles.burst(key.position, [0xffe14f, 0xffffff], 36, 3, 1.2, 0.6, 0.6, 1);
  ui.showBanner('とびらを あけよう！', '🚪');
  ui.setMeter(progression.stage.budsNeeded, progression.stage.budsNeeded, true);
}

function openDoor() {
  if (!progression.openDoor()) return;
  doorOpening = true;
  pendingAction = null;
  audio.fanfare();
  // key flies into the keyhole then vanishes
  if (key) {
    const kp = door.position.clone().add(new THREE.Vector3(0, 1.5, 0.4));
    key.position.copy(kp);
    sparkles.burst(kp, 0xffe14f, 30, 2.5, 1, 0.55, 0.5, 1);
    setTimeout(() => removeKey(), 600);
  }
  sparkles.rain(door.position, RAINBOW, 60, 3.5);
  ui.emojiRain(['🌈', '✨', '💖', '⭐', '🌸'], 30);

  const friendKind = progression.stage.friend;
  const friendName = progression.stage.friendName;
  setTimeout(() => {
    // friend pops out of the portal
    const f = friendMgr.add(friendKind, door.position.clone().add(new THREE.Vector3(0, 1, 1)));
    sparkles.burst(f.pos, [0xffffff, 0xffe14f, 0xff9ddb], 40, 3, 1.3, 0.6, 0.6, 1);
    audio.twirl();
    ui.showBanner(`${friendName}が なかまに なったよ！`, '💖');
  }, 1300);

  setTimeout(() => {
    const next = progression.nextStage();
    ui.wipeTransition(
      () => {
        if (next === 'finale') {
          setupFinale();
        } else {
          setupStage();
          if (fairyCtl) fairyCtl.setTarget(new THREE.Vector3(0, 2, 3));
        }
      },
      () => {
        if (next === 'finale') {
          ui.show(ui.finale);
          ui.emojiRain(['🎉', '🌈', '⭐', '💖', '🎀', '✨'], 40);
        }
      }
    );
  }, 3100);
}

function setupFinale() {
  state = 'finale';
  progression.stageIdx = STAGES.length - 1;
  world.setStage(STAGES[3]);
  flora.clear();
  removeKey();
  if (door) { scene.remove(door); door = null; }
  fireflies.setCount(70, 0xfff3a8);
  audio.setMusicRoot(0);
  partyTimer = 0;
  if (fairyCtl) {
    fairyCtl.autopilot = (t) => new THREE.Vector3(Math.sin(t * 0.5) * 5, 2.4 + Math.sin(t * 1.1) * 0.8, Math.cos(t * 0.35) * 5);
  }
}

function startPartyMode() {
  ui.hide(ui.finale);
  ui.showBanner('はなび パーティー！', '🎆');
  if (fairyCtl) fairyCtl.autopilot = null;
}

// ------------------------------------------------------------ input

let pDown = false, pMoved = false, pStart = { x: 0, y: 0, t: 0 }, longPressTimer = null;

function toNDC(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function raycastPoint(e, y = 1.4) {
  toNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  if (raycaster.ray.intersectPlane(plane, hit)) return hit;
  raycaster.ray.at(10, hit);
  return hit;
}

function ownerOf(obj, list, getter) {
  return getter(obj);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pDown = true; pMoved = false;
  pStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  lastInputT = clockT;
  clearTimeout(longPressTimer);
  if (state === 'play' || state === 'finale') {
    longPressTimer = setTimeout(() => {
      if (pDown && !pMoved) { spiralOn = true; spiralY = 0; audio.gliss(); }
    }, 550);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pDown) return;
  const dx = e.clientX - pStart.x, dy = e.clientY - pStart.y;
  if (dx * dx + dy * dy > 24 * 24) { pMoved = true; clearTimeout(longPressTimer); }
  if (pMoved && (state === 'play' || state === 'finale') && !spiralOn) {
    // stardust wand: draw with your finger
    const p = raycastPoint(e, 1.2 + Math.random() * 1.6);
    const hue = (clockT * 0.35) % 1;
    const c = new THREE.Color().setHSL(hue, 0.85, 0.72);
    sparkles.trail(p, c.getHex(), 0.5);
    if (Math.random() < 0.2) sparkles.trail(p, 0xffffff, 0.35);
  }
  lastInputT = clockT;
});

window.addEventListener('pointerup', (e) => {
  clearTimeout(longPressTimer);
  const wasSpiral = spiralOn;
  spiralOn = false;
  if (!pDown) return;
  pDown = false;
  const quick = performance.now() - pStart.t < 500;
  if (pMoved || wasSpiral || !quick) return;
  handleTap(e);
});

function handleTap(e) {
  lastInputT = clockT;
  if (state === 'select') {
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(selectFairies.map((f) => f.mesh), true);
    if (hits.length) {
      let o = hits[0].object;
      while (o) {
        const rec = selectFairies.find((f) => f.mesh === o);
        if (rec) { chooseFairy(rec); return; }
        o = o.parent;
      }
    }
    // sparkle feedback even on a miss
    sparkles.burst(raycastPoint(e, 1.4), 0xffffff, 10, 1.5, 0.6, 0.4, 0.4, 1);
    audio.chime();
    return;
  }
  if (state !== 'play' && state !== 'finale') return;

  toNDC(e);
  raycaster.setFromCamera(ndc, camera);

  if (state === 'finale') {
    // party mode: every tap is a firework
    const p = raycastPoint(e, 4 + Math.random() * 4);
    sparkles.firework(p, RAINBOW);
    audio.firework();
    if (fairyCtl && !fairyCtl.autopilot) {
      const g = raycastPoint(e, 1.8);
      clampTarget(g);
      fairyCtl.setTarget(g);
    }
    return;
  }

  // --- play state: what did we hit?
  const targets = [];
  if (key && !keyHeld) targets.push(key);
  if (door) targets.push(door);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    // ignore particles/sprites/sky
    if (h.object.isPoints || h.object.isSprite) continue;

    if (key && !keyHeld && isDescendantOf(h.object, key)) {
      flyThen(key.position.clone(), { type: 'key' });
      audio.chime();
      return;
    }
    if (door && isDescendantOf(h.object, door)) {
      if (keyHeld && !doorOpening) {
        const front = door.position.clone().add(new THREE.Vector3(0, 1.6, 2.6));
        flyThen(front, { type: 'door' });
        audio.chime();
      } else if (!doorOpening) {
        // locked: wiggle glow + hint
        sparkles.burst(door.position.clone().add(new THREE.Vector3(0, 1.6, 0.6)), 0xffffff, 12, 1.5, 0.7, 0.45, 0.4, 1);
        ui.showPraise('おはなを さかせてね', '🌸');
        audio.chime();
      }
      return;
    }
    const bud = flora.budOf(h.object);
    if (bud) {
      const p = bud.group.position.clone().add(new THREE.Vector3(0, 1.2, 0.6));
      flyThen(p, { type: 'bloom', bud });
      audio.chime();
      return;
    }
    const flower = flora.flowerOf(h.object);
    if (flower) {
      flora.poke(flower, clockT);
      audio.note(flower.note);
      sparkles.burst(flower.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xffffff, 10, 1.6, 0.7, 0.45, 0.5, 1);
      return;
    }
    const fr = friendMgr.friendOf(h.object);
    if (fr) {
      fr.poke(clockT);
      audio.boing();
      sparkles.burst(fr.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), [0xff9ddb, 0xffffff], 14, 1.8, 0.8, 0.5, 0.6, 1);
      ui.emojiRain(['💖'], 3);
      return;
    }
  }

  // empty space: fly there with a sparkle
  const p = raycastPoint(e, 0);
  p.y = 1.2 + Math.random() * 1.4;
  clampTarget(p);
  fairyCtl.setTarget(p);
  pendingAction = null;
  sparkles.burst(p, [fairyPal.wing, 0xffffff], 12, 1.6, 0.7, 0.45, 0.5, 1);
  audio.chime();
}

function isDescendantOf(obj, root) {
  let o = obj;
  while (o) { if (o === root) return true; o = o.parent; }
  return false;
}

function clampTarget(p) {
  const r = Math.hypot(p.x, p.z);
  if (r > 13) { p.x *= 13 / r; p.z *= 13 / r; }
  p.y = THREE.MathUtils.clamp(p.y, 0.8, 5.5);
}

function flyThen(target, action) {
  clampTarget(target);
  fairyCtl.setTarget(target);
  pendingAction = action;
}

// ------------------------------------------------------------ buttons

document.getElementById('btn-start').addEventListener('click', () => { audio.unlock(); enterSelect(); });
document.getElementById('btn-party').addEventListener('click', () => { audio.unlock(); startPartyMode(); });
document.getElementById('btn-again').addEventListener('click', () => { enterTitle(); });
document.getElementById('btn-home').addEventListener('click', () => { enterTitle(); });
const btnSound = document.getElementById('btn-sound');
btnSound.addEventListener('click', () => {
  audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnSound.textContent = audio.enabled ? '🔊' : '🔇';
});
document.getElementById('btn-dress').addEventListener('click', () => {
  if (!fairy) return;
  dressIdx = (dressIdx + 1) % DRESS_CYCLE.length;
  setDressColor(fairy, DRESS_CYCLE[dressIdx]);
  fairyCtl.twirl();
  audio.twirl();
  sparkles.burst(fairy.position, [DRESS_CYCLE[dressIdx], 0xffffff], 30, 2.6, 1.1, 0.55, 0.6, 1);
});

// ------------------------------------------------------------ shooting stars

function maybeShootingStar(dt) {
  const st = progression.stage;
  if (state !== 'play' || (st.theme !== 'night' && st.theme !== 'dusk')) return;
  shootTimer -= dt;
  if (shootTimer <= 0) {
    shootTimer = 10 + Math.random() * 10;
    const dir = Math.random() < 0.5 ? 1 : -1;
    shootingStars.push({
      pos: new THREE.Vector3(-dir * 24, 14 + Math.random() * 6, -14 + Math.random() * 8),
      vel: new THREE.Vector3(dir * 14, -3.5, 1.5),
      life: 2.6,
    });
    audio.gliss();
  }
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    s.life -= dt;
    s.pos.addScaledVector(s.vel, dt);
    sparkles.trail(s.pos, 0xfff6c0, 0.9);
    sparkles.trail(s.pos, 0xffffff, 0.5);
    if (s.life <= 0) shootingStars.splice(i, 1);
  }
}

// ------------------------------------------------------------ main loop

const clock = new THREE.Clock();
let clockT = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  clockT += dt;
  const t = clockT;

  world.update(dt, t);
  sparkles.update(dt, t);
  fireflies.update(t);
  flora.update(dt, t);
  updateGems(dt);
  if (door) updateDoor(door, dt, t, doorOpening ? 1 : 0, keyHeld);
  if (key && !keyHeld) updateKey(key, dt, t);

  // title butterflies + ambient sparkles
  for (let i = 0; i < titleButterflies.length; i++) {
    const b = titleButterflies[i];
    const a = t * 0.5 + i * 1.7;
    b.update(dt, t, new THREE.Vector3(Math.cos(a) * 4.5, 2.2 + Math.sin(t + i) * 0.8, Math.sin(a) * 4.5));
  }
  if (state === 'title' && Math.random() < dt * 2) {
    sparkles.burst(new THREE.Vector3((Math.random() - 0.5) * 14, 1 + Math.random() * 4, (Math.random() - 0.5) * 14),
      RAINBOW[(Math.random() * RAINBOW.length) | 0], 6, 1.2, 0.8, 0.4, 0.3, 1);
  }

  // select screen: fairies bob & wave (layout tracks orientation changes)
  if (selectFairies.length) layoutSelectFairies();
  for (const f of selectFairies) {
    const u = f.mesh.userData;
    f.mesh.position.set(u.baseX, u.baseY + Math.sin(t * 1.8 + f.seed) * 0.15, u.baseZ);
    u.inner.position.y = Math.sin(t * 2.1 + f.seed) * 0.05;
    for (const w of u.wings) w.pivot.rotation.y = w.sx * (0.35 + Math.sin(t * 9 + f.seed) * 0.35);
    u.wandGlow.material.opacity = 0.55 + 0.35 * Math.sin(t * 5 + f.seed);
    u.aura.material.opacity = 0.28 + 0.14 * Math.sin(t * 3.1 + f.seed);
    if (Math.random() < dt * 0.7) sparkles.trail(f.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)), f.pal.wing, 0.4);
  }

  // player fairy
  if (fairyCtl) {
    const dist = fairyCtl.update(dt, t, (p) => {
      sparkles.trail(p.clone().add(new THREE.Vector3(0, 0.4, 0)), fairyPal.wing, 0.42);
      if (Math.random() < 0.3) sparkles.trail(p, 0xffffff, 0.3);
    });
    fairyShadow.position.set(fairy.position.x, 0.03, fairy.position.z);
    const sh = Math.max(0.4, 1.2 - fairy.position.y * 0.12);
    fairyShadow.scale.setScalar(sh);

    // flying close to any bud blooms it — forgiving for small fingers
    if (state === 'play') {
      for (let i = flora.buds.length - 1; i >= 0; i--) {
        const b = flora.buds[i];
        const dx = b.group.position.x - fairy.position.x;
        const dz = b.group.position.z - fairy.position.z;
        if (dx * dx + dz * dz < 1.3 * 1.3 && fairy.position.y < 3.2) {
          if (pendingAction && pendingAction.bud === b) pendingAction = null;
          doBloom(b);
        }
      }
    }

    // flying close to the key grabs it; close to the door (with key) opens it
    if (state === 'play') {
      if (key && !keyHeld && fairy.position.distanceTo(key.position) < 1.35) grabKey();
      if (keyHeld && !doorOpening && door) {
        const dx = fairy.position.x - door.position.x;
        const dz = fairy.position.z - door.position.z;
        if (dx * dx + dz * dz < 2.9 * 2.9) openDoor();
      }
    }

    // arriving at a pending action
    if (pendingAction && dist < 1.05) {
      const act = pendingAction;
      pendingAction = null;
      if (act.type === 'bloom') doBloom(act.bud);
      else if (act.type === 'key') grabKey();
      else if (act.type === 'door') openDoor();
    }

    // held key rides along
    if (key && keyHeld) {
      key.position.lerp(fairy.position.clone().add(new THREE.Vector3(0.55, 0.4, 0)), Math.min(1, dt * 8));
      key.rotation.y = t * 2;
      key.userData.halo.material.opacity = 0.6 + 0.3 * Math.sin(t * 5);
      if (Math.random() < dt * 6) sparkles.trail(key.position, 0xffe14f, 0.4);
    }

    // rainbow spiral (long press)
    if (spiralOn) {
      spiralA += dt * 9;
      spiralY += dt * 1.4;
      if (spiralY > 2.2) spiralY = 0;
      for (let i = 0; i < 3; i++) {
        const a = spiralA + i * 2.1;
        const hue = (a * 0.12) % 1;
        const c = new THREE.Color().setHSL(hue, 0.85, 0.7);
        sparkles.spawn(
          fairy.position.x + Math.cos(a) * 1.15, fairy.position.y - 0.6 + spiralY, fairy.position.z + Math.sin(a) * 1.15,
          Math.cos(a) * 0.4, 0.8, Math.sin(a) * 0.4,
          c.getHex(), 1.0, 0.55, 0, 0.95, 1
        );
      }
      spiralSndT -= dt;
      if (spiralSndT <= 0) { spiralSndT = 0.65; audio.gliss(); }
    }

    // idle for a while → happy twirl
    if ((state === 'play') && t - lastInputT > 12) {
      lastInputT = t;
      fairyCtl.twirl();
      audio.twirl();
      sparkles.burst(fairy.position, [fairyPal.wing, 0xffffff], 20, 2, 1, 0.5, 0.5, 1);
    }
  }

  // friends parade
  if (fairy) friendMgr.update(dt, t, fairy.position, fairyCtl ? fairyCtl.heading : 0);
  else friendMgr.update(dt, t, new THREE.Vector3(0, 1.5, 0), 0);

  // keep buds coming
  if (state === 'play' && !doorOpening) {
    budTimer -= dt;
    if (budTimer <= 0) { budTimer = 2.2; spawnBud(); }
  }

  maybeShootingStar(dt);

  // finale party: automatic fireworks
  if (state === 'finale' && ui.finale.classList.contains('hidden')) {
    partyTimer -= dt;
    if (partyTimer <= 0) {
      partyTimer = 2.4 + Math.random() * 1.4;
      const p = new THREE.Vector3((Math.random() - 0.5) * 16, 6 + Math.random() * 4, (Math.random() - 0.5) * 16);
      sparkles.firework(p, RAINBOW);
      audio.firework();
    }
  }

  updateCamera(dt, t);
  renderer.render(scene, camera);
}

enterTitle();
tick();

// tiny debug/test handle (used by the headless browser test; harmless in play)
window.__kirakira = {
  get state() { return state; },
  progression,
  flora,
  flyTo(x, y, z) { if (fairyCtl) fairyCtl.setTarget(new THREE.Vector3(x, y, z)); },
  get fairyPos() { return fairy ? fairy.position.toArray() : null; },
  get keyState() { return { spawned: !!key, held: keyHeld, doorOpening }; },
  get friendCount() { return friendMgr.friends.length; },
  /** Project a world position to CSS pixel coords (for tests). */
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight];
  },
  get keyPos() { return key ? key.position.toArray() : null; },
  get doorPos() { return door ? door.position.toArray() : null; },
};
