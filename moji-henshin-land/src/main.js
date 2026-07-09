// もじへんしんランド — ABCDEをさわって変身させるMetamorphabet風ゲーム
import * as THREE from 'three';
import { buildLetterMesh } from './letters.js';
import {
  buildApple, buildAnt, buildBird, buildBalloon, buildCat,
  buildCloud, buildDog, buildDuck, buildElephant, buildEgg,
} from './creatures.js';
import { FxSystem } from './fx.js';
import { unlockAudio, sfx } from './audio.js';

const LETTERS = [
  {
    char: 'A', color: 0xff6b6b,
    words: [
      { name: 'Apple', emoji: '🍎', build: buildApple, labelColor: '#ff5d5d' },
      { name: 'Ant', emoji: '🐜', build: buildAnt, labelColor: '#9c4a2f' },
    ],
  },
  {
    char: 'B', color: 0x4dabf7,
    words: [
      { name: 'Bird', emoji: '🐦', build: buildBird, labelColor: '#2f8fd8' },
      { name: 'Balloon', emoji: '🎈', build: buildBalloon, labelColor: '#f06ba8' },
    ],
  },
  {
    char: 'C', color: 0xffa94d,
    words: [
      { name: 'Cat', emoji: '🐱', build: buildCat, labelColor: '#f08c00' },
      { name: 'Cloud', emoji: '☁️', build: buildCloud, labelColor: '#74a9d8' },
    ],
  },
  {
    char: 'D', color: 0x9775fa,
    words: [
      { name: 'Dog', emoji: '🐶', build: buildDog, labelColor: '#a5754a' },
      { name: 'Duck', emoji: '🦆', build: buildDuck, labelColor: '#e0a800' },
    ],
  },
  {
    char: 'E', color: 0x51cf66,
    words: [
      { name: 'Elephant', emoji: '🐘', build: buildElephant, labelColor: '#7b8fc0' },
      { name: 'Egg', emoji: '🥚', build: buildEgg, labelColor: '#d8a24a' },
    ],
  },
];

const POKES_TO_MORPH = 3;
const PULLS_TO_MORPH = 2;
const SPIN_TO_MORPH = 9.0;          // 累計回転量(ラジアン)
const PULL_COUNT_LEN = 1.1;         // これ以上引っぱって離すと1カウント
const STORAGE_KEY = 'moji-henshin-land-progress';

// ---------- 基本セットアップ ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.domElement.style.touchAction = 'none';
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.9, 10);
camera.lookAt(0, -0.1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8ff, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 6, 8);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xfff0d8, 0.5);
fill.position.set(-4, -2, 6);
scene.add(fill);

const fx = new FxSystem(scene);

// ---------- UI要素 ----------
const ui = {
  title: document.getElementById('title'),
  homeBtn: document.getElementById('homeBtn'),
  nextBtn: document.getElementById('nextBtn'),
  wordLabel: document.getElementById('wordLabel'),
  hint: document.getElementById('hint'),
  star: document.getElementById('star'),
  tapToStart: document.getElementById('tapToStart'),
};

// ---------- ばね ----------
class Spring {
  constructor(v = 0) { this.v = v; this.target = v; this.vel = 0; }
  update(dt, stiffness = 160, damping = 12) {
    const a = (this.target - this.v) * stiffness - this.vel * damping;
    this.vel += a * dt;
    this.v += this.vel * dt;
    return this.v;
  }
}

// ---------- 進捗 ----------
let progress = [false, false, false, false, false];
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (Array.isArray(saved) && saved.length === 5) progress = saved.map(Boolean);
} catch (_) { /* 保存が読めなくても遊べる */ }
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) { /* noop */ }
}

// ---------- 星バッジ ----------
function makeStarMesh(scale = 1, color = 0xffd43b) {
  const shape = new THREE.Shape();
  const outer = 0.5, inner = 0.21;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2,
  });
  geo.center();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.3, metalness: 0.2, emissive: 0x664400, emissiveIntensity: 0.35,
  }));
  mesh.scale.setScalar(scale);
  return mesh;
}

// ---------- もじえらび画面 ----------
const selectGroup = new THREE.Group();
scene.add(selectGroup);
const selectLetters = [];

for (let i = 0; i < LETTERS.length; i++) {
  const info = LETTERS[i];
  const holder = new THREE.Group();
  const mesh = buildLetterMesh(info.char, info.color);
  mesh.scale.setScalar(0.62);
  holder.add(mesh);
  const badge = makeStarMesh(0.85);
  badge.position.set(0, 1.15, 0.4);
  badge.visible = progress[i];
  holder.add(badge);
  selectGroup.add(holder);
  selectLetters.push({ holder, mesh, badge, basePos: new THREE.Vector3(), index: i });
}

let selectBounds = { w: 10, h: 7 };
function layoutSelect() {
  const portrait = window.innerHeight > window.innerWidth;
  if (portrait) {
    const pos = [[-1.25, 2.3], [1.25, 2.3], [-1.25, 0], [1.25, 0], [0, -2.3]];
    selectLetters.forEach((l, i) => l.basePos.set(pos[i][0], pos[i][1], 0));
    selectBounds = { w: 5.4, h: 8.6 };
  } else {
    selectLetters.forEach((l, i) => {
      l.basePos.set((i - 2) * 2.05, 0.3 - Math.abs(i - 2) * 0.28, 0);
    });
    selectBounds = { w: 11.2, h: 5.6 };
  }
}

// ---------- ステージ ----------
const stageGroup = new THREE.Group();
stageGroup.visible = false;
scene.add(stageGroup);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.25, 32),
  new THREE.MeshBasicMaterial({ color: 0x6a5acd, transparent: true, opacity: 0.16 })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -2.1;
stageGroup.add(shadow);

const actor = {
  root: new THREE.Group(),      // 位置(引っぱり+ゆらゆら)
  spin: new THREE.Group(),      // 回転
  content: null,                // いまの見た目(文字 or 変身先)
  scl: new Spring(1),           // 出現ポップ用スケール
  sq: new Spring(0),            // ぷにぷに(縦つぶれ量)
  pull: new THREE.Vector2(),    // 引っぱりオフセット
  pullVel: new THREE.Vector2(),
  rotY: 0,
  rotVelY: 0,
};
actor.root.add(actor.spin);
stageGroup.add(actor.root);

function setActorContent(group) {
  if (actor.content) {
    actor.spin.remove(actor.content);
    actor.content.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  actor.content = group;
  actor.spin.add(group);
}

// ---------- ゲーム状態 ----------
const state = {
  mode: 'select',              // 'select' | 'stage'
  letterIndex: 0,
  phase: 0,                    // 0=文字 1=ことば1 2=ことば2 3=できた!
  pokes: 0,
  pulls: 0,
  spinAccum: 0,
  inputLocked: false,
  morphToken: 0,
  lastInteraction: 0,
  clockT: 0,
};

// ---------- ヒント ----------
const HINTS = { poke: '👆', pull: '✋', spin: '🔄' };
let currentHint = null;
function setHint(kind) {
  currentHint = kind;
  ui.hint.classList.remove('show', 'poke', 'pull', 'spin');
  if (kind) ui.hint.textContent = HINTS[kind];
}
function updateHint() {
  if (!currentHint || state.inputLocked) { ui.hint.classList.remove('show'); return; }
  const idle = state.clockT - state.lastInteraction > 2.6;
  ui.hint.classList.toggle('show', idle);
  if (idle) {
    ui.hint.classList.add(currentHint);
  } else {
    ui.hint.classList.remove('poke', 'pull', 'spin');
  }
}

function showWord(word) {
  ui.wordLabel.textContent = `${word.emoji} ${word.name}`;
  ui.wordLabel.style.color = word.labelColor;
  ui.wordLabel.classList.add('show');
}
function hideWord() { ui.wordLabel.classList.remove('show'); }

// ---------- 画面切り替え ----------
function goSelect() {
  state.morphToken++;
  state.mode = 'select';
  selectGroup.visible = true;
  stageGroup.visible = false;
  ui.homeBtn.style.display = 'none';
  ui.nextBtn.style.display = 'none';
  ui.star.classList.remove('show');
  hideWord();
  const allDone = progress.every(Boolean);
  ui.title.textContent = allDone ? 'ぜんぶ できたね! 🌈' : 'ABCで あそぼう!';
  ui.title.style.display = 'block';
  selectLetters.forEach((l, i) => { l.badge.visible = progress[i]; });
  setHint('poke');
  state.lastInteraction = state.clockT;
  updateCamera();
}

function enterStage(index) {
  state.morphToken++;
  state.mode = 'stage';
  state.letterIndex = index;
  state.phase = 0;
  state.pokes = 0;
  state.pulls = 0;
  state.spinAccum = 0;
  state.inputLocked = false;
  selectGroup.visible = false;
  stageGroup.visible = true;
  ui.title.style.display = 'none';
  ui.homeBtn.style.display = 'flex';
  ui.nextBtn.style.display = 'none';
  ui.star.classList.remove('show');
  hideWord();

  const info = LETTERS[index];
  setActorContent(buildLetterMesh(info.char, info.color));
  actor.scl.v = 0; actor.scl.target = 1; actor.scl.vel = 6;
  actor.sq.v = 0; actor.sq.vel = 0;
  actor.pull.set(0, 0); actor.pullVel.set(0, 0);
  actor.rotY = 0; actor.rotVelY = 0;
  sfx.pop();
  fx.burst(new THREE.Vector3(0, 0, 0.5), 20);
  setHint('poke');
  state.lastInteraction = state.clockT;
  updateCamera();
}

// ---------- 変身 ----------
function morphTo(buildContent, { word = null, celebrate = false } = {}) {
  state.inputLocked = true;
  const token = ++state.morphToken;
  hideWord();
  sfx.whoosh();
  actor.scl.target = 0;
  actor.scl.vel = 2.5;
  actor.sq.vel = -6;

  setTimeout(() => {
    if (token !== state.morphToken) return;
    setActorContent(buildContent());
    actor.pull.set(0, 0); actor.pullVel.set(0, 0);
    actor.rotY = 0; actor.rotVelY = 0;
    actor.scl.v = 0; actor.scl.target = 1; actor.scl.vel = 7;
    sfx.pop();
    sfx.sparkle();
    fx.burst(new THREE.Vector3(0, 0, 0.6), 30);
    if (word) showWord(word);
    if (celebrate) {
      sfx.tada();
      fx.confetti(70, selectBounds.w);
      ui.star.classList.add('show');
      setTimeout(() => {
        if (token !== state.morphToken) return;
        ui.nextBtn.style.display = 'flex';
      }, 700);
    }
    setTimeout(() => {
      if (token !== state.morphToken) return;
      state.inputLocked = false;
      state.lastInteraction = state.clockT;
    }, 450);
  }, 420);
}

function advancePhase() {
  const info = LETTERS[state.letterIndex];
  if (state.phase === 0) {
    state.phase = 1;
    morphTo(info.words[0].build, { word: info.words[0] });
    setHint('pull');
  } else if (state.phase === 1) {
    state.phase = 2;
    morphTo(info.words[1].build, { word: info.words[1] });
    setHint('spin');
  } else if (state.phase === 2) {
    state.phase = 3;
    progress[state.letterIndex] = true;
    saveProgress();
    morphTo(() => buildLetterMesh(info.char, info.color), { celebrate: true });
    setHint(null);
  }
}

// ---------- 入力 ----------
const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const worldPt = new THREE.Vector3();

const pointer = {
  down: false,
  id: null,
  start: new THREE.Vector2(),
  last: new THREE.Vector2(),
  world: new THREE.Vector2(),
  worldStart: new THREE.Vector2(),
  moved: false,
  downTime: 0,
  onActor: false,
  lastStretchSfx: 0,
  lastWhirlSfx: 0,
};

function toWorld(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(raycastPlane, worldPt);
  return worldPt;
}

function onPointerDown(e) {
  if (pointer.down) return;             // 1本指のみ
  pointer.down = true;
  pointer.id = e.pointerId;
  pointer.start.set(e.clientX, e.clientY);
  pointer.last.set(e.clientX, e.clientY);
  pointer.moved = false;
  pointer.downTime = performance.now();
  state.lastInteraction = state.clockT;
  const w = toWorld(e.clientX, e.clientY);
  pointer.world.set(w.x, w.y);
  pointer.worldStart.set(w.x, w.y);
  if (state.mode === 'stage') {
    pointer.onActor = pointer.world.distanceTo(new THREE.Vector2(0, 0)) < 2.8;
  }
}

function onPointerMove(e) {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  const dx = e.clientX - pointer.last.x;
  pointer.last.set(e.clientX, e.clientY);
  if (pointer.last.distanceTo(pointer.start) > 14) pointer.moved = true;
  const w = toWorld(e.clientX, e.clientY);
  pointer.world.set(w.x, w.y);
  state.lastInteraction = state.clockT;

  if (state.mode !== 'stage' || state.inputLocked || !pointer.onActor) return;

  if (state.phase === 1) {
    // 引っぱり:びよ〜んと音を鳴らす(連続再生は抑える)
    const len = pointer.world.distanceTo(pointer.worldStart);
    if (len > 0.6 && state.clockT - pointer.lastStretchSfx > 0.3) {
      sfx.stretch();
      pointer.lastStretchSfx = state.clockT;
    }
  } else {
    // 回転:横方向の指の動きでくるくる(phase 2 で変身が進む)
    const spin = dx * 0.02;
    actor.rotVelY += spin;
    if (state.phase === 2) {
      state.spinAccum += Math.abs(spin) * 8;
      if (state.clockT - pointer.lastWhirlSfx > 0.22 && Math.abs(dx) > 6) {
        sfx.whirl();
        pointer.lastWhirlSfx = state.clockT;
      }
      if (state.spinAccum >= SPIN_TO_MORPH) advancePhase();
    }
  }
}

function onPointerUp(e) {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  pointer.down = false;
  state.lastInteraction = state.clockT;
  const quickTap = !pointer.moved && performance.now() - pointer.downTime < 450;

  if (state.mode === 'select') {
    if (!quickTap) return;
    // いちばん近い文字をえらぶ(子どもの指にやさしい大きめ判定)
    let best = null, bestDist = 1.6;
    for (const l of selectLetters) {
      const d = pointer.world.distanceTo(new THREE.Vector2(l.basePos.x, l.basePos.y));
      if (d < bestDist) { best = l; bestDist = d; }
    }
    if (best) {
      sfx.tap();
      enterStage(best.index);
    }
    return;
  }

  // ステージ
  if (state.inputLocked || !pointer.onActor) return;

  if (state.phase === 1 && pointer.moved) {
    // 引っぱって離した
    const len = actor.pull.length();
    if (len > PULL_COUNT_LEN) {
      state.pulls++;
      sfx.boing();
      fx.burst(new THREE.Vector3(actor.pull.x, actor.pull.y, 0.6), 14, 3);
      if (state.pulls >= PULLS_TO_MORPH) advancePhase();
    } else if (len > 0.3) {
      sfx.poyon();
    }
    return;
  }

  if (quickTap) {
    // つつく
    actor.sq.vel = -7;
    sfx.poyon();
    fx.burst(new THREE.Vector3(pointer.world.x, pointer.world.y, 0.6), 10, 2.6, 0.6);
    if (state.phase === 0) {
      state.pokes++;
      if (state.pokes >= POKES_TO_MORPH) advancePhase();
    }
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- UIボタン ----------
ui.homeBtn.addEventListener('click', () => { sfx.tap(); goSelect(); });
ui.nextBtn.addEventListener('click', () => {
  sfx.tap();
  const next = state.letterIndex + 1;
  if (next < LETTERS.length) enterStage(next);
  else goSelect();
});

// さいしょのタップで音を解禁
function startGame() {
  unlockAudio();
  ui.tapToStart.classList.add('hidden');
  sfx.sparkle();
  ui.tapToStart.removeEventListener('pointerdown', startGame);
}
ui.tapToStart.addEventListener('pointerdown', startGame);

// ---------- ただよう光の粒 ----------
const AMBIENT_COUNT = 26;
const ambientGeo = new THREE.BufferGeometry();
const ambientPos = new Float32Array(AMBIENT_COUNT * 3);
for (let i = 0; i < AMBIENT_COUNT; i++) {
  ambientPos[i * 3] = (Math.random() - 0.5) * 12;
  ambientPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
  ambientPos[i * 3 + 2] = -1 - Math.random() * 3;
}
ambientGeo.setAttribute('position', new THREE.BufferAttribute(ambientPos, 3));
const ambientPts = new THREE.Points(ambientGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.1, transparent: true, opacity: 0.55,
  depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(ambientPts);

// ---------- カメラ・リサイズ ----------
function updateCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const need = state.mode === 'select'
    ? { w: selectBounds.w, h: selectBounds.h }
    : { w: 6.6, h: 7.6 };
  const zForH = need.h / 2 / Math.tan(halfFov);
  const zForW = need.w / 2 / Math.tan(halfFov) / camera.aspect;
  camera.position.z = Math.max(zForH, zForW);
  camera.lookAt(0, -0.1, 0);
  camera.updateProjectionMatrix();
}
function onResize() { layoutSelect(); updateCamera(); }
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 60));

// ---------- メインループ ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  state.clockT = t;

  // ただよう粒
  const ap = ambientGeo.getAttribute('position');
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    ap.array[i * 3 + 1] += dt * 0.35;
    ap.array[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.15;
    if (ap.array[i * 3 + 1] > 6) ap.array[i * 3 + 1] = -6;
  }
  ap.needsUpdate = true;

  if (state.mode === 'select') {
    selectLetters.forEach((l, i) => {
      l.holder.position.set(
        l.basePos.x,
        l.basePos.y + Math.sin(t * 1.8 + i * 1.3) * 0.1,
        0
      );
      l.holder.rotation.y = Math.sin(t * 1.1 + i * 0.9) * 0.22;
      l.badge.rotation.y = t * 1.5;
    });
  } else {
    // ぷにぷにばね更新
    actor.scl.update(dt, 130, 9);
    actor.sq.update(dt, 170, 8);

    // 引っぱり
    if (pointer.down && pointer.onActor && state.phase === 1 && !state.inputLocked) {
      const targetX = THREE.MathUtils.clamp(pointer.world.x - pointer.worldStart.x, -2.4, 2.4);
      const targetY = THREE.MathUtils.clamp(pointer.world.y - pointer.worldStart.y, -2.0, 2.0);
      actor.pull.x += (targetX * 0.85 - actor.pull.x) * Math.min(1, dt * 14);
      actor.pull.y += (targetY * 0.85 - actor.pull.y) * Math.min(1, dt * 14);
      actor.pullVel.set(0, 0);
    } else {
      // ばねで戻る(ボヨンボヨン)
      const k = 90, damp = 7;
      actor.pullVel.x += (-actor.pull.x * k - actor.pullVel.x * damp) * dt;
      actor.pullVel.y += (-actor.pull.y * k - actor.pullVel.y * damp) * dt;
      actor.pull.x += actor.pullVel.x * dt;
      actor.pull.y += actor.pullVel.y * dt;
    }

    // 回転
    actor.rotY += actor.rotVelY;
    actor.rotVelY *= Math.exp(-2.2 * dt);
    if (state.phase !== 2 && !pointer.down) {
      actor.rotY += (Math.round(actor.rotY / (Math.PI * 2)) * Math.PI * 2 - actor.rotY) * Math.min(1, dt * 3);
    }

    // 見た目に反映
    const bobY = Math.sin(t * 1.7) * 0.09;
    actor.root.position.set(actor.pull.x, actor.pull.y + bobY, 0);
    const s = Math.max(0.0001, actor.scl.v);
    const sq = actor.sq.v;
    const stretchX = 1 + Math.abs(actor.pull.x) * 0.16;
    const stretchY = 1 + Math.abs(actor.pull.y) * 0.16;
    actor.root.scale.set(
      s * (1 - sq * 0.5) * stretchX,
      s * (1 + sq) * stretchY,
      s * (1 - sq * 0.5)
    );
    actor.spin.rotation.y = actor.rotY;
    actor.spin.rotation.z = -actor.pull.x * 0.08;
    actor.spin.rotation.x = actor.pull.y * 0.06;

    // アイドルアニメ
    if (actor.content && actor.content.userData.tick) actor.content.userData.tick(t);

    // 影
    const shScale = Math.max(0.2, s * (1 - (actor.pull.y + bobY) * 0.12));
    shadow.scale.setScalar(shScale);
    shadow.position.x = actor.pull.x * 0.7;
    shadow.material.opacity = 0.16 * Math.min(1, s);
  }

  fx.update(dt, t);
  updateHint();
  renderer.render(scene, camera);
}

// ---------- 開始 ----------
layoutSelect();
goSelect();
updateCamera();
animate();
