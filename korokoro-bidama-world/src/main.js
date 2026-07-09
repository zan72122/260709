// Game bootstrap: renderer, course lifecycle, fixed-step simulation,
// event -> sound/effect wiring, touch input and HUD.
import * as THREE from '../vendor/three.module.min.js';
import { Sim, MARBLE_R } from './physics.js';
import { COURSES, MARBLE_COLORS } from './courses.js';
import { buildEnvironment } from './environment.js';
import { MarbleRenderer } from './marbles.js';
import { Sparkles, Confetti, Pulses } from './effects.js';
import { KidAudio } from './audio.js';
import { CamControl } from './camera.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
const cam = new CamControl(camera, canvas);
const audio = new KidAudio();
const isSmall = Math.min(screen.width, screen.height) < 500;
const MAX_MARBLES = isSmall ? 110 : 150;

// ---------- game state ----------
const G = {
  course: null,        // course def
  built: null,         // {spawn, goal, info}
  sim: null,
  courseGroup: null,
  env: null,
  marbles: null,       // renderer
  sparkles: null,
  confetti: null,
  pulses: new Pulses(),
  colorCursor: 0,
  stars: 0,
  goals: 0,
  playing: false,
  follow: false,
  followMarble: null,
  pouring: false,
  pourT: 0,
  burstQueue: 0,
  burstT: 0,
  autoT: 0,
  time: 0,
};

function disposeCourse() {
  if (G.courseGroup) {
    scene.remove(G.courseGroup);
    G.courseGroup.traverse(o => {
      if (o.isMesh || o.isSprite || o.isInstancedMesh) {
        o.geometry && o.geometry.dispose && o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose && m.dispose());
      }
    });
    G.courseGroup = null;
  }
  if (G.env) { G.env.dispose(); G.env = null; }
  if (G.marbles) { G.marbles.dispose(scene); G.marbles = null; }
  if (G.sparkles) { G.sparkles.dispose(); G.sparkles = null; }
  if (G.confetti) { G.confetti.dispose(); G.confetti = null; }
}

function loadCourse(id) {
  disposeCourse();
  const course = COURSES.find(c => c.id === id) || COURSES[0];
  G.course = course;
  G.sim = new Sim(MAX_MARBLES);
  G.courseGroup = new THREE.Group();
  scene.add(G.courseGroup);
  G.built = course.build(G.sim, G.courseGroup);
  G.sim.finalize();
  G.env = buildEnvironment(renderer, scene, course.palette, course.islandR);
  G.marbles = new MarbleRenderer(scene, MAX_MARBLES);
  G.sparkles = new Sparkles(scene);
  G.confetti = new Confetti(scene);
  G.goals = 0;
  G.followMarble = null;
  G.autoT = 0;
  document.getElementById('goal-n').textContent = '0';
  cam.setCourseView(course.camera.target, course.camera.dist);
  document.body.style.background = '#' + new THREE.Color(course.palette.skyMid).getHexString();
  // welcome marbles so the world is alive immediately
  for (let i = 0; i < 3; i++) setTimeout(() => G.playing && spawnMarble(), 350 + i * 420);
}

function spawnClear() {
  const sp = G.built.spawn;
  for (const m of G.sim.marbles) {
    if (m.alive && m.p.distanceToSquared(sp.pos) < 0.45) return false;
  }
  return true;
}

function spawnMarble(silent = false) {
  if (!spawnClear()) return null; // wait until the previous marble rolls away
  const sp = G.built.spawn;
  const j = (Math.random() - 0.5) * 0.1;
  const m = G.sim.spawn(
    sp.pos.x + j, sp.pos.y + Math.random() * 0.3, sp.pos.z - j,
    sp.dir.x * (1.6 + Math.random() * 0.5), 0, sp.dir.z * (1.6 + Math.random() * 0.5),
    G.colorCursor++ % MARBLE_COLORS.length);
  if (!silent) {
    audio.pop();
    G.sparkles.emit(sp.pos.x, sp.pos.y + 0.3, sp.pos.z, 0xffffff, 6, 0.8, 0.8, 0.8);
  }
  G.followMarble = m;
  return m;
}

function warpHome(m) {
  G.sparkles.emit(m.p.x, m.p.y + 0.2, m.p.z, 0xffe27a, 14, 1.4, 1.8, 1.1);
  audio.warp();
  const sp = G.built.spawn;
  const color = m.color;
  m.spawnAt(sp.pos.x, sp.pos.y + 0.5 + Math.random() * 0.8, sp.pos.z,
    sp.dir.x * 1.6, 0, sp.dir.z * 1.6, color);
  G.sparkles.emit(sp.pos.x, sp.pos.y, sp.pos.z, 0xffe27a, 8, 0.8, 0.9, 0.9);
}

// ---------- events from the sim ----------
function handleEvents() {
  const info = G.built.info;
  for (const ev of G.sim.events) {
    switch (ev.type) {
      case 'chime': {
        audio.chime(ev.id, ev.power);
        for (const ch of info.chimes) {
          const bar = ch.bars[ev.id - ch.idBase];
          if (bar) G.pulses.add(bar, { scale: 1.25, emissive: 1.6 });
        }
        G.sparkles.emit(ev.x, ev.y + 0.2, ev.z, 0xffffff, 4, 0.7, 1.2, 0.7);
        break;
      }
      case 'bumper': {
        audio.bumper();
        const b = info.bumpers.find(b => b.id === ev.id);
        if (b) G.pulses.add(b.cap, { scale: 1.3, emissive: 1.4 });
        G.sparkles.emit(ev.x, ev.y + 0.3, ev.z, 0xff8fb0, 7, 1.6, 1.4, 0.9);
        break;
      }
      case 'boost': {
        audio.boost();
        const bo = info.boosts.find(b => b.id === ev.id);
        if (bo) { G.pulses.add(bo.ring, { scale: 1.35, emissive: 1.2 }); G.pulses.add(bo.ring2, { scale: 1.5, emissive: 1.2 }); }
        G.sparkles.emit(ev.x, ev.y, ev.z, 0x64f0c8, 10, 1.2, 0.8, 1.0);
        break;
      }
      case 'clack':
        audio.clack(ev.power);
        break;
      case 'spin-hit':
        audio.spinnerWhir();
        G.sparkles.emit(ev.x, ev.y + 0.2, ev.z, 0xffc94d, 5, 1.4, 1.2, 0.8);
        break;
      case 'goal': {
        G.goals++;
        G.stars = Math.floor(G.goals / 10);
        audio.goal(G.goals);
        G.sparkles.emit(ev.x, ev.y + 0.4, ev.z, MARBLE_COLORS[ev.marble.color % MARBLE_COLORS.length], 12, 1.2, 2.0, 1.1);
        const cEl = document.getElementById('counter');
        document.getElementById('goal-n').textContent = String(G.goals);
        document.getElementById('star-n').textContent = String(G.stars);
        cEl.classList.remove('bump'); void cEl.offsetWidth; cEl.classList.add('bump');
        if (G.goals % 10 === 0) {
          audio.fanfare();
          const gp = G.built.goal.pos;
          G.confetti.burst(gp.x, gp.y + 2, gp.z, 80);
          const toast = document.getElementById('toast');
          toast.textContent = ['やったね!', 'すごーい!', 'キラキラ!', 'まほうみたい!'][(G.goals / 10 - 1) % 4] + ' ⭐';
          toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
        }
        break;
      }
      case 'fell':
        if (ev.marble.alive) warpHome(ev.marble);
        break;
    }
  }
  G.sim.events.length = 0;
}

// resting-marble housekeeping: overfilled goal pools and stranded marbles
// sparkle-warp back to the spawner so the flow never dies
function housekeeping(dt) {
  G.autoT += dt;
  if (G.autoT < 0.5) return;
  G.autoT = 0;
  let inGoal = [];
  for (const m of G.sim.marbles) {
    if (!m.alive) continue;
    if (m.inGoal) { inGoal.push(m); continue; }
    if (m.restT > 12) warpHome(m);
  }
  const capacity = 12;
  if (inGoal.length > capacity) {
    inGoal.sort((a, b) => b.age - a.age);
    for (let i = 0; i < inGoal.length - capacity; i++) warpHome(inGoal[i]);
  }
}

// ---------- taps ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
cam.onTap = (x, y) => {
  if (!G.playing) return;
  audio.unlock();
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const info = G.built.info;

  // marbles first — poking them is the best part
  {
    const hit = raycaster.intersectObject(G.marbles.shell, false)[0];
    if (hit && hit.instanceId !== undefined) {
      const m = G.sim.marbles[hit.instanceId];
      if (m && m.alive) {
        m.v.y += 4.5;
        m.v.x += (Math.random() - 0.5) * 1.6;
        m.v.z += (Math.random() - 0.5) * 1.6;
        m.restT = 0;
        audio.pop();
        G.sparkles.emit(m.p.x, m.p.y + 0.2, m.p.z, MARBLE_COLORS[m.color % MARBLE_COLORS.length], 8, 1.2, 1.6, 1);
        return;
      }
    }
  }
  // spinners spin faster when tapped
  for (const sp of info.spinners) {
    if (raycaster.intersectObject(sp.group, true).length) {
      sp.sim.kick = Math.min(6, sp.sim.kick + 2.6);
      audio.spinnerWhir();
      G.sparkles.emit(sp.pos.x, sp.pos.y + 0.4, sp.pos.z, 0xffc94d, 10, 1.6, 1.4, 1);
      return;
    }
  }
  // bumpers pop
  for (const b of info.bumpers) {
    if (raycaster.intersectObject(b.cap, false).length) {
      G.pulses.add(b.cap, { scale: 1.4, emissive: 1.6 });
      audio.bumper();
      G.sparkles.emit(b.pos.x, b.pos.y, b.pos.z, 0xff8fb0, 8, 1.4, 1.4, 1);
      return;
    }
  }
  // chime bars play their note
  for (const ch of info.chimes) {
    for (let i = 0; i < ch.bars.length; i++) {
      if (raycaster.intersectObject(ch.bars[i], false).length) {
        audio.chime(ch.idBase + i, 2);
        G.pulses.add(ch.bars[i], { scale: 1.25, emissive: 1.6 });
        return;
      }
    }
  }
  // anywhere else: a little sparkle so every tap answers back
  const groundHit = raycaster.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (groundHit && groundHit.length() < 40) {
    G.sparkles.emit(groundHit.x, 0.3, groundHit.z, 0xffffff, 5, 0.8, 1.0, 0.8);
  }
};

// ---------- HUD wiring ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), title = $('title');

for (const btn of document.querySelectorAll('.course-card')) {
  btn.addEventListener('click', () => {
    audio.unlock();
    loadCourse(btn.dataset.course);
    G.playing = true;
    title.classList.add('hidden');
    hud.classList.remove('hidden');
  });
}
$('btn-home').addEventListener('click', () => {
  G.playing = false;
  G.pouring = false;
  hud.classList.add('hidden');
  title.classList.remove('hidden');
});
$('btn-sound').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  $('btn-sound').textContent = audio.muted ? '🔇' : '🔊';
});
$('btn-cam').addEventListener('click', () => {
  G.follow = !G.follow;
  $('btn-cam').textContent = G.follow ? '🌍' : '👀';
  if (!G.follow) cam.followPos = null;
});
{
  const pour = $('btn-pour');
  const start = e => {
    e.preventDefault();
    audio.unlock();
    if (!G.playing) return;
    G.pouring = true;
    G.pourT = 0;
    pour.classList.add('holding');
    spawnMarble();
  };
  const stop = () => { G.pouring = false; pour.classList.remove('holding'); };
  pour.addEventListener('pointerdown', start);
  pour.addEventListener('pointerup', stop);
  pour.addEventListener('pointercancel', stop);
  pour.addEventListener('pointerleave', stop);
}
$('btn-burst').addEventListener('click', () => {
  audio.unlock();
  if (!G.playing) return;
  G.burstQueue += 10;
});

// ---------- resize ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.8 : 2));
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 60 : 52; // wider on portrait phones
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ---------- follow-cam target ----------
function updateFollow() {
  if (!G.follow || !G.playing) { cam.followPos = null; return; }
  let m = G.followMarble;
  if (!m || !m.alive || m.inGoal || m.restT > 1.5) {
    // pick the fastest currently-moving marble
    let best = null, bestV = 1.2;
    for (const mm of G.sim.marbles) {
      if (!mm.alive || mm.inGoal) continue;
      const v = mm.v.lengthSq();
      if (v > bestV) { bestV = v; best = mm; }
    }
    m = G.followMarble = best;
  }
  cam.followPos = m ? m.p : null;
}

// ---------- fast-marble sparkle trails ----------
let trailT = 0;
function updateTrails(dt) {
  trailT -= dt;
  if (trailT > 0) return;
  trailT = 0.05;
  let emitted = 0;
  for (const m of G.sim.marbles) {
    if (!m.alive) continue;
    const v2 = m.v.lengthSq();
    if (v2 > 64 && emitted < 4) {
      G.sparkles.emit(m.p.x, m.p.y, m.p.z, MARBLE_COLORS[m.color % MARBLE_COLORS.length], 1, 0.15, 0.15, 0.7);
      emitted++;
    }
  }
}

// ---------- main loop ----------
const FIXED = 1 / 120;
let acc = 0;
let last = performance.now();
let hidden = false;
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  last = performance.now();
});

function frame(now) {
  requestAnimationFrame(frame);
  if (hidden) return;
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;

  if (G.playing && G.sim) {
    // pour / burst spawning
    if (G.pouring) {
      G.pourT -= dt;
      if (G.pourT <= 0) { G.pourT = 0.17; spawnMarble(); }
    }
    if (G.burstQueue > 0) {
      G.burstT -= dt;
      if (G.burstT <= 0) { G.burstT = 0.06; if (spawnMarble()) G.burstQueue--; }
    }

    acc = Math.min(acc + dt, FIXED * 5);
    while (acc >= FIXED) {
      G.sim.step(FIXED);
      acc -= FIXED;
    }
    handleEvents();
    housekeeping(dt);

    // sync visuals
    G.marbles.sync(G.sim.marbles, dt);
    for (const sp of G.built.info.spinners) sp.group.rotation.y = -sp.sim.angle;
    for (const bo of G.built.info.boosts) {
      bo.ring.rotation.z += dt * 2.2;
      bo.ring2.rotation.z -= dt * 3.1;
    }
    G.sparkles.update(dt);
    G.confetti.update(dt);
    G.pulses.update(dt);
    updateTrails(dt);
    updateFollow();
    audio.tickMusic(dt);
  }

  if (G.env) G.env.update(dt);
  cam.update(dt, camera.aspect);
  renderer.render(scene, camera);
}

// boot with a course behind the title screen so it looks gorgeous instantly
loadCourse('sora');
requestAnimationFrame(frame);
