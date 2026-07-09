// ねらって！とばして！リラックマ ぐらぐらスイーツタワー — main loop & glue.

import * as THREE from '../vendor/three.module.min.js';
import { World } from './world.js';
import { Tower } from './tower.js';
import { WobbleSpring, judgeLanding, scoreStars, isMilestone, HEIGHT_CM_PER_UNIT } from './tower-core.js';
import { SWEETS, SPECIALS, pickSweet, buildSweet } from './sweets.js';
import { createCharacter } from './characters.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

// ------------------------------------------------------------ renderer

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);

const world = new World(scene);
const tower = new Tower(scene, world.plateTopY);
const wobble = new WobbleSpring();
const particles = new Particles(scene);
const audio = new AudioEngine();

// ------------------------------------------------------------ characters

const bear = createCharacter('bear');
bear.group.position.set(-3.6, 0, 4.0);
bear.group.rotation.y = 0.5;
scene.add(bear.group);

const whitebear = createCharacter('whitebear');
whitebear.group.position.set(3.6, 0, 4.2);
whitebear.group.rotation.y = -0.5;
scene.add(whitebear.group);

const bird = createCharacter('bird');
bird.group.position.set(2.1, 0, 5.6);
bird.group.rotation.y = -0.3;
scene.add(bird.group);
const birdHome = bird.group.position.clone();

const chars = [bear, whitebear, bird];
const BUBBLE_LINES = [
  'がんばれ〜！', 'おいしそう…', 'たか〜い！', 'すごい すごい！',
  'いいちょうし！', 'はちみつ たべたい…', 'ふわぁ〜', 'わくわく！',
];

// ------------------------------------------------------------ catapult

const catapult = new THREE.Group();
{
  const wood = new THREE.MeshStandardMaterial({ color: 0xb5793d, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.9), wood);
  base.position.y = 0.15;
  base.castShadow = base.receiveShadow = true;
  catapult.add(base);
}
const spoonArm = new THREE.Group();
{
  const wood2 = new THREE.MeshStandardMaterial({ color: 0xd39a5b, roughness: 0.7 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 1.7), wood2);
  handle.position.z = -0.6;
  handle.castShadow = true;
  spoonArm.add(handle);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), wood2);
  bowl.scale.y = 0.5;
  bowl.rotation.x = Math.PI; // open side up
  bowl.position.set(0, 0.12, 0.35);
  bowl.material = new THREE.MeshStandardMaterial({ color: 0xd39a5b, roughness: 0.7, side: THREE.DoubleSide });
  bowl.castShadow = true;
  spoonArm.add(bowl);
}
spoonArm.position.set(0, 0.38, 0.1);
spoonArm.rotation.x = 0.12;
catapult.add(spoonArm);
catapult.position.set(0, 0, 4.3);
catapult.rotation.y = Math.PI; // spoon bowl toward the tower
scene.add(catapult);
const SPOON_POS = new THREE.Vector3(0, 0.66, 3.95); // where the waiting sweet sits

// ------------------------------------------------------------ aim ring

const aimRing = new THREE.Group();
const ringTorus = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.055, 10, 32),
  new THREE.MeshBasicMaterial({ color: 0x59d97a, transparent: true, opacity: 0.95, depthWrite: false })
);
ringTorus.rotation.x = -Math.PI / 2;
aimRing.add(ringTorus);
const ringDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.14, 16),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
);
ringDot.rotation.x = -Math.PI / 2;
ringDot.position.y = 0.01;
aimRing.add(ringDot);
const ringBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.02, 0.7, 6, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })
);
ringBeam.position.y = 0.35;
aimRing.add(ringBeam);
scene.add(aimRing);

// ------------------------------------------------------------ game state

const S = {
  state: 'title',          // title | aiming | flying | rescue | steady | toppling | finishing | finish
  count: 0,
  perfects: 0,
  combo: 0,
  hearts: 3,
  lastId: null,
  nextEntry: null,
  current: null,           // built sweet in flight / on spoon
  flight: null,            // {from, to, t, dur, spin}
  aimT: Math.random() * 10,
  camAngle: 0.32,
  camFlourish: 0,
  steadyT: 0,
  rescueReady: false,
  rescue: null,
  toppleGrace: 0,
  bubbleT: 3,
  stateT: 0,
  rng: Math.random,
};

let best = Number(localStorage.getItem('rk-tower-best') || 0);
const unlocked = new Set(JSON.parse(localStorage.getItem('rk-tower-zukan') || '[]'));
const newUnlocks = new Set();

const ui = new UI({
  onStart: () => { unlockAudio(); startGame(); },
  onRetry: () => { unlockAudio(); startGame(); },
  onHome: () => { S.state = 'title'; ui.showTitle(best); },
  onMute: () => { audio.setMuted(!audio.muted); ui.setMuted(audio.muted); },
});
ui.setMuted(audio.muted);
ui.showTitle(best);

function unlockAudio() {
  if (audio.ensure()) audio.startBGM();
  audio.click();
}

function saveProgress() {
  localStorage.setItem('rk-tower-best', String(best));
  localStorage.setItem('rk-tower-zukan', JSON.stringify([...unlocked]));
}

// ------------------------------------------------------------ helpers

function heightCm() {
  return Math.round((tower.topY() - tower.baseY) * HEIGHT_CM_PER_UNIT);
}

function project(pos) {
  const v = pos.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function say(char, text) {
  const p = project(char.group.position.clone().add(new THREE.Vector3(0, char.height + 0.4, 0)));
  ui.bubble(text, p.x, p.y);
}

function vibrate(ms) { try { navigator.vibrate?.(ms); } catch { /* iOS: no-op */ } }

/** which sweet comes next (specials on a fun schedule) */
function nextSweetEntry() {
  const n = S.count + 1;
  if (n % 10 === 0) return SPECIALS.giant;
  if (n % 12 === 0) return SPECIALS.rainbow;
  if (n % 8 === 0) return SPECIALS.honeypot;
  return pickSweet(S.rng, S.lastId);
}

function prepareNext() {
  S.nextEntry = nextSweetEntry();
  S.current = buildSweet(S.nextEntry, S.rng);
  S.current.group.position.copy(SPOON_POS);
  scene.add(S.current.group);
  ui.setNext(S.nextEntry.emoji, S.nextEntry.name);
  S.lastId = S.nextEntry.id;
}

// ------------------------------------------------------------ game flow

function startGame() {
  tower.reset();
  wobble.calm(99);
  if (S.current) { scene.remove(S.current.group); S.current = null; }
  Object.assign(S, {
    state: 'aiming', count: 0, perfects: 0, combo: 0, hearts: 3,
    lastId: null, flight: null, steadyT: 0, rescueReady: false, rescue: null,
    camFlourish: 0, stateT: 0,
  });
  newUnlocks.clear();
  world.phase = 0;
  prepareNext();
  ui.showHud();
  ui.setHearts(3);
  ui.setHeight(0);
  ui.setBest(best);
  bear.setMood('cheer', 1.2);
  whitebear.setMood('cheer', 1.2);
  say(bear, 'いっぱい つもう！');
}

function aimTarget() {
  // lissajous sweep over the landing zone; slowly speeds up with height
  const sup = tower.topSupport();
  const speed = Math.min(0.85 + S.count * 0.04, 1.9);
  const range = sup.r * (sup.isPlate ? 0.55 : 0.78) + 0.25;
  const x = sup.x + Math.sin(S.aimT * 1.35 * speed) * range;
  const z = sup.z + Math.sin(S.aimT * 1.02 * speed + 1.3) * range * 0.6;
  return { x, y: sup.y, z, sup };
}

function launch() {
  const { x, y, z, sup } = aimTarget();
  audio.launch();
  vibrate(15);
  // spoon snap animation
  spoonArm.userData.snapT = 0.28;
  S.flight = {
    from: SPOON_POS.clone(),
    to: new THREE.Vector3(x, y, z),
    t: 0,
    dur: 0.72 + Math.min(0.5, (y - world.plateTopY) * 0.02),
    sup,
    trailT: 0,
  };
  S.state = 'flying';
}

function resolveLanding() {
  const f = S.flight;
  const sup = tower.topSupport(); // re-read (tower may sway but centres are stable)
  const dx = f.to.x - sup.x;
  const dz = f.to.z - sup.z;
  const isRainbow = S.current.id === 'rainbow';
  let judge = judgeLanding(dx, dz, sup.r, S.current.r);
  if (isRainbow && judge.result !== 'miss') judge = { result: 'perfect', x: 0, z: 0 };

  const pop = project(f.to);
  if (judge.result === 'miss') {
    if (S.rescueReady) { startRescue(f); return; }
    missPiece(f, pop);
    return;
  }

  // it landed!
  const isGiant = S.current.id === 'giant';
  tower.add(S.current, judge.x, judge.z, { checkpoint: isGiant });
  S.count++;
  S.current = null;
  const d = Math.hypot(dx, dz);

  if (judge.result === 'perfect') {
    S.combo++;
    S.perfects++;
    wobble.pump(0.04, dx, dz);
    audio.landPerfect(S.combo);
    particles.confetti(f.to, 22 + Math.min(S.combo * 6, 30));
    particles.sparkle(f.to, 14, 0xfff4a8);
    ui.judgePop(pop.x, pop.y, 'perfect');
    ui.combo(S.combo);
    bear.setMood('cheer', 1.4);
    whitebear.setMood('cheer', 1.4);
    if (S.combo >= 3) particles.firework(f.to.clone().add(new THREE.Vector3(0, 2, 0)));
  } else if (judge.result === 'good') {
    S.combo = 0;
    wobble.pump(0.16 + d * 0.14, dx, dz);
    audio.landGood();
    particles.sparkle(f.to, 8, 0xffffff, 1.4);
    ui.judgePop(pop.x, pop.y, 'good');
    whitebear.setMood('clap', 1.2);
  } else { // edge
    S.combo = 0;
    wobble.pump(0.5 + d * 0.18, dx, dz);
    audio.landEdge();
    audio.wobbleAlarm();
    ui.judgePop(pop.x, pop.y, 'edge');
    bear.setMood('gasp', 1.6);
    whitebear.setMood('gasp', 1.6);
    vibrate(60);
  }

  // specials
  const placedId = tower.pieces[tower.pieces.length - 1].id;
  if (placedId === 'honeypot') {
    tower.applyHoney(14);
    wobble.calm(0.5);
    audio.honey();
    particles.sparkle(f.to, 24, 0xffd24d, 2.6);
    ui.banner('🍯 はちみつパワー！', 'タワーが しばらく ぐらぐらしないよ');
  } else if (placedId === 'rainbow') {
    particles.firework(f.to.clone().add(new THREE.Vector3(0, 1.5, 0)));
    ui.banner('🌈 にじいろキャンディ！', 'かならず ぴったり！');
  } else if (placedId === 'giant') {
    ui.banner('🥞 おおきな ホットケーキ！', 'ここから したは もう くずれない！');
    particles.confetti(f.to, 30);
  }

  if (!unlocked.has(placedId)) { unlocked.add(placedId); newUnlocks.add(placedId); }

  ui.setHeight(heightCm());
  vibrate(judge.result === 'perfect' ? 40 : 25);

  // milestone party
  if (isMilestone(S.count)) {
    audio.fanfare();
    S.camFlourish = 2.0;
    S.rescueReady = true;
    const top = new THREE.Vector3(0, tower.topY() + 1.5, 0);
    particles.firework(top);
    setTimeout(() => particles.firework(top.clone().add(new THREE.Vector3(1.5, 1, 0))), 350);
    ui.banner(`⭐ ${S.count}こ つめた！ ⭐`, `そらは いま「${world.phaseName(S.count)}」 とりさんが みはってくれるよ`);
    chars.forEach(c => c.setMood('cheer', 2.2));
  }

  // did that landing break something?
  S.toppleGrace = 0.9; // check shortly after, once the squash settles
  S.state = 'aiming';
  S.stateT = 0;
  prepareNext();
}

function missPiece(f, pop) {
  audio.fallWhistle();
  const dir = new THREE.Vector3(f.to.x - f.sup.x, 0, f.to.z - f.sup.z).normalize();
  tower.spawnFalling(S.current.group, f.to, dir.multiplyScalar(2.2).add(new THREE.Vector3(0, -1, 0)), S.current);
  S.current = null;
  S.combo = 0;
  ui.judgePop(pop.x, pop.y, 'miss');
  bear.setMood('gasp', 1.4);
  loseHeart();
  if (S.state !== 'finishing') {
    S.state = 'aiming';
    S.stateT = 0;
    prepareNext();
  }
}

function loseHeart() {
  S.hearts--;
  ui.setHearts(S.hearts);
  vibrate(80);
  if (S.hearts <= 0) finishGame();
}

function finishGame() {
  S.state = 'finishing';
  S.stateT = 0;
  audio.finishJingle();
  chars.forEach(c => c.setMood('cheer', 3));
  const top = new THREE.Vector3(0, tower.topY(), 0);
  particles.confetti(top, 60, 4, 5);
  setTimeout(() => particles.firework(top.clone().add(new THREE.Vector3(-1.5, 2, 0))), 400);
  setTimeout(() => particles.firework(top.clone().add(new THREE.Vector3(1.5, 2.6, 0))), 800);
  const cm = heightCm();
  const isNewBest = cm > best;
  if (isNewBest) best = cm;
  saveProgress();
  setTimeout(() => {
    S.state = 'finish';
    ui.showFinish({
      heightCm: cm, count: S.count, perfects: S.perfects,
      stars: scoreStars(S.count, S.perfects),
      unlocked, newUnlocks, isNewBest,
    });
  }, 2600);
}

// ------------------------------------------------------------ rescue (bird!)

function startRescue(f) {
  S.rescueReady = false;
  S.state = 'rescue';
  audio.birdTweet();
  S.rescue = {
    phase: 0, t: 0,
    sweetPos: f.to.clone(),
    sup: tower.topSupport(),
  };
  const pop = project(f.to);
  ui.judgePop(pop.x, pop.y, 'rescue');
}

function updateRescue(dt) {
  const r = S.rescue;
  r.t += dt;
  const sup = tower.topSupport();
  const target = new THREE.Vector3(sup.x, sup.y + S.current.h + 0.5, sup.z);
  if (r.phase === 0) {
    // bird darts to the falling sweet
    const k = Math.min(1, r.t / 0.45);
    bird.group.position.lerpVectors(birdHome, r.sweetPos.clone().add(new THREE.Vector3(0, 0.5, 0)), easeOut(k));
    S.current.group.position.copy(r.sweetPos);
    if (k >= 1) { r.phase = 1; r.t = 0; audio.birdTweet(); }
  } else if (r.phase === 1) {
    // carries it to the tower centre
    const k = Math.min(1, r.t / 0.7);
    const from = r.sweetPos;
    S.current.group.position.lerpVectors(from, target, easeInOut(k));
    bird.group.position.copy(S.current.group.position).add(new THREE.Vector3(0, 0.55, 0));
    if (k >= 1) { r.phase = 2; r.t = 0; }
  } else {
    // gently set down, then fly home
    tower.add(S.current, 0, 0);
    S.count++;
    S.current = null;
    audio.landGood();
    particles.sparkle(target, 16, 0xfff4a8);
    ui.setHeight(heightCm());
    say(bird, 'ぴよっ！');
    S.rescue = null;
    S.state = 'aiming';
    S.stateT = 0;
    prepareNext();
  }
}

const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

// ------------------------------------------------------------ steady! minigame

function enterSteady() {
  S.state = 'steady';
  S.steadyT = 4.0;
  audio.wobbleAlarm();
  ui.steady(true, 1);
  chars.forEach(c => c.setMood('gasp', 4));
  vibrate(100);
}

function steadyTap() {
  wobble.calm(0.22);
  audio.steadyTap();
  particles.sparkle(new THREE.Vector3(0, tower.topY() * 0.6, 0), 5, 0x9fe8ff, 3);
  vibrate(10);
  if (wobble.energy < 0.3) {
    ui.steady(false);
    audio.calmChime();
    ui.banner('ほっ… たすかった！');
    chars.forEach(c => c.setMood('cheer', 1.5));
    S.state = 'aiming';
    S.stateT = 0;
  }
}

function steadyFail() {
  ui.steady(false);
  const k = Math.max(1, Math.min(2, tower.checkTopple() || 1));
  tower.topple(k);
  audio.fallWhistle();
  wobble.calm(99);
  ui.setHeight(heightCm());
  loseHeart();
  if (S.state !== 'finishing') { S.state = 'aiming'; S.stateT = 0; }
}

// ------------------------------------------------------------ input

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (S.state === 'steady') { steadyTap(); return; }
  if (S.state !== 'aiming') return;

  // tapping a friend makes them giggle instead of launching
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const c of chars) {
    if (raycaster.intersectObject(c.group, true).length) {
      c.setMood('cheer', 1.2);
      audio.birdTweet();
      particles.hearts(c.group.position.clone().add(new THREE.Vector3(0, c.height, 0)));
      say(c, ['えへへ', 'きゃっ！', 'ぴよ〜'][Math.floor(Math.random() * 3)]);
      return;
    }
  }
  launch();
});

// ------------------------------------------------------------ resize

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ------------------------------------------------------------ camera

const camTarget = new THREE.Vector3(0, 2, 0);
const camPos = new THREE.Vector3(8, 5, 11);

function updateCamera(dt) {
  const topY = tower.topY();
  S.camAngle += dt * 0.045; // slow cinematic orbit
  const portrait = camera.aspect < 1;
  let dist = 8.2 + topY * 0.42;
  if (portrait) dist *= 1.38;
  let lookY = topY * 0.62 + 1.1;
  let camY = topY * 0.85 + 3.4;

  if (S.state === 'finishing' || S.state === 'finish') {
    dist = 10 + topY * 0.75;
    lookY = topY * 0.5;
    camY = topY * 0.6 + 4;
    S.camAngle += dt * 0.25; // celebratory spin
  } else if (S.camFlourish > 0) {
    const f = Math.sin(Math.min(1, (2 - S.camFlourish) / 0.5) * Math.PI * 0.5);
    dist *= 1 + f * 0.7;
    lookY = topY * (0.62 - f * 0.2);
  }

  // keep the catapult side in view while aiming (bias angle toward front)
  const bias = Math.sin(S.camAngle) * 0.35;
  const a = bias; // gentle sway around the front instead of full orbit
  const px = Math.sin(a) * dist;
  const pz = Math.cos(a) * dist;
  camPos.lerp(new THREE.Vector3(px, camY, pz), Math.min(1, dt * 2.5));
  camTarget.lerp(new THREE.Vector3(0, lookY, 0), Math.min(1, dt * 2.5));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ------------------------------------------------------------ main loop

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const inPlay = !['title'].includes(S.state);
  S.stateT += dt;

  // world & ambience
  world.lerpTo(World.phaseForCount(S.count), dt);
  world.update(dt, tower.topY());
  wobble.step(dt);
  tower.update(dt, wobble);
  particles.update(dt);
  for (const c of chars) c.update(dt);

  // spoon snap-back animation
  if (spoonArm.userData.snapT > 0) {
    spoonArm.userData.snapT -= dt;
    const k = Math.max(0, spoonArm.userData.snapT / 0.28);
    spoonArm.rotation.x = 0.12 - Math.sin(k * Math.PI) * 0.9;
  }

  if (S.state === 'aiming') {
    S.aimT += dt;
    const { x, y, z, sup } = aimTarget();
    aimRing.visible = true;
    aimRing.position.set(x, y + 0.06, z);
    const d = Math.hypot(x - sup.x, z - sup.z) / Math.max(0.001, sup.r);
    ringTorus.material.color.setHSL(THREE.MathUtils.lerp(0.36, 0.06, Math.min(1, d)), 0.85, 0.55);
    const pulse = 1 + Math.sin(S.aimT * 6) * 0.06;
    const rr = Math.max(0.5, S.current ? S.current.r : 0.6);
    aimRing.scale.setScalar(rr / 0.55 * pulse);

    // waiting sweet bobs on the spoon
    if (S.current) {
      S.current.group.position.set(SPOON_POS.x, SPOON_POS.y + Math.sin(S.aimT * 2.4) * 0.06, SPOON_POS.z);
      S.current.group.rotation.y += dt * 0.8;
    }

    // delayed topple check after each landing
    if (S.toppleGrace > 0) {
      S.toppleGrace -= dt;
      if (S.toppleGrace <= 0) {
        if (wobble.energy > 0.92) enterSteady();
        else {
          const k = tower.checkTopple();
          if (k > 0) {
            tower.topple(k);
            audio.fallWhistle();
            ui.setHeight(heightCm());
            bear.setMood('gasp', 1.5);
            loseHeart();
          }
        }
      }
    }
  } else {
    aimRing.visible = false;
  }

  if (S.state === 'flying' && S.flight) {
    const f = S.flight;
    f.t += dt / f.dur;
    const k = Math.min(1, f.t);
    const p = new THREE.Vector3().lerpVectors(f.from, f.to, k);
    const arcH = 2.2 + (f.to.y - f.from.y) * 0.35 + f.to.distanceTo(f.from) * 0.12;
    p.y += Math.sin(k * Math.PI) * arcH + (1 - k) * 0.0;
    S.current.group.position.copy(p);
    S.current.group.rotation.y += dt * 5;
    S.current.group.rotation.x = Math.sin(k * Math.PI) * 0.5;
    f.trailT -= dt;
    if (f.trailT <= 0) {
      particles.sparkle(p, 2, 0xfff0b8, 0.6);
      f.trailT = 0.04;
    }
    if (k >= 1) {
      S.current.group.rotation.set(0, S.current.group.rotation.y % (Math.PI * 2), 0);
      resolveLanding();
      S.flight = null;
    }
  }

  if (S.state === 'rescue' && S.rescue) updateRescue(dt);

  if (S.state === 'steady') {
    S.steadyT -= dt;
    ui.steady(true, Math.min(1, wobble.energy));
    // shake the camera a touch for drama
    camera.position.x += Math.sin(S.stateT * 30) * 0.03;
    if (S.steadyT <= 0) steadyFail();
  }

  // occasional cheering bubbles
  if (inPlay && S.state === 'aiming') {
    S.bubbleT -= dt;
    if (S.bubbleT <= 0) {
      S.bubbleT = 5 + Math.random() * 5;
      const c = chars[Math.floor(Math.random() * chars.length)];
      say(c, BUBBLE_LINES[Math.floor(Math.random() * BUBBLE_LINES.length)]);
      if (Math.random() < 0.3) c.setMood('clap', 1.2);
    }
  }

  // bird drifts home when idle
  if (S.state !== 'rescue' && bird.group.position.distanceTo(birdHome) > 0.01) {
    bird.group.position.lerp(birdHome, Math.min(1, dt * 2));
  }

  if (S.camFlourish > 0) S.camFlourish -= dt;
  updateCamera(dt);
  renderer.render(scene, camera);
}

tick();

// tiny debug handle for automated smoke tests (harmless in production)
window.__game = { S, tower, wobble, world, finishGame, enterSteady };
