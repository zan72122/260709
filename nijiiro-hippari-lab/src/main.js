// にじいろ ひっぱりもようラボ — メインループと入力
import * as THREE from 'three';
import { createWorld } from './scene3d.js';
import { PinBoard, PIN_Z } from './pins.js';
import { ThreadManager, THICKNESS } from './threads.js';
import { StainLayer } from './stains.js';
import { SparkleSystem } from './sparkles.js';
import { DropSystem } from './drops.js';
import { AutoWeaver } from './autoweave.js';
import { GoalSystem } from './goals.js';
import { createUI, THREAD_COLORS } from './ui.js';
import { captureCard, saveCard } from './gallery.js';
import { audio } from './audio.js';
import { rand, pick, clamp, hsl } from './utils.js';

const canvas = document.getElementById('game');
const world = createWorld(canvas);
const { renderer, scene, camera, boardGroup, sun, hemi, playLight, lightGlow } = world;

// ---- パーツを組みたてる ----
const stains = new StainLayer(boardGroup);
const sparkles = new SparkleSystem(boardGroup);
const pinBoard = new PinBoard(boardGroup);
const threadMgr = new ThreadManager(boardGroup);
const dropSystem = new DropSystem(boardGroup, threadMgr, stains, sparkles, audio);

// 入力用の見えない板
const pickPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(44, 44),
  new THREE.MeshBasicMaterial({ visible: false })
);
pickPlane.position.z = PIN_Z * 0.6;
boardGroup.add(pickPlane);

// ---- じょうたい ----
let started = false;
let now = 0;
let lastInput = 0;
const pointerNdc = new THREE.Vector2(0, 0);
let dragPin = null;      // ドラッグちゅうのピン
let armedPin = null;     // タップでえらんだピン(つぎのタップでつなぐ)
let hoverPin = null;
let lightActive = false;
let lightHold = 0;
let lightNotified = false;
const lightPt = new THREE.Vector2();
let sprayCooldown = 0;
let captureRequested = false;
let glintTimer = 0;
let ambientTimer = 0;
let weavingShown = false;
let firstThreadDone = false;

// ---- UI ----
const goals = new GoalSystem({
  onShow: (g, p) => ui.setGoal(g, p),
  onComplete: (g, praiseText) => {
    ui.praise(praiseText);
    audio.fanfare();
    sparkles.confetti(70);
  },
});

const autoWeaver = new AutoWeaver({
  threadMgr, pinBoard, audio, sparkles,
  onPraise: (t) => ui.praise(t),
  onEvent: (e) => goals.notify(e),
});

const ui = createUI({
  onStart() {
    started = true;
    audio.unlock();
    goals.start();
    pinBoard.build('maru', now);
    lastInput = now;
    setTimeout(() => ui.hint('きんいろの ピンを タッチして、ひっぱってみてね 🧵'), 1200);
  },
  onToolChange(tool) {
    audio.tap();
    cancelDrag();
    armedPin && setArmed(null);
  },
  onColorChange() { audio.tap(); },
  onThicknessChange() { audio.tap(); },
  onShapeChange(shape) {
    audio.tap();
    autoWeaver.stop();
    threadMgr.clear();
    dropSystem.clear();
    cancelDrag();
    setArmed(null);
    pinBoard.build(shape, now);
    audio.wash();
    lastInput = now;
  },
  onAutoWeave() {
    audio.tap();
    autoWeaver.start(ui.state.color);
    lastInput = now;
  },
  onWash() {
    audio.wash();
    autoWeaver.stop();
    threadMgr.clear();
    dropSystem.clear();
    stains.clear();
    // あわあわ
    for (let i = 0; i < 16; i++) {
      sparkles.twinkle(
        new THREE.Vector3(rand(-5, 5), rand(-5, 5), rand(0.5, 1.5)),
        0xdff4ff, rand(0.3, 0.7), rand(0.5, 1)
      );
    }
    ui.praise('ぴかぴかに なったよ！');
    lastInput = now;
  },
  onCapture() {
    captureRequested = true;
    lastInput = now;
  },
  onSoundToggle(on) { audio.setEnabled(on); if (on) audio.tap(); },
  onGalleryOpen() { audio.tap(); },
});

// しずく・霧・にじみのイベントを おたのしみ(ゴール)へ
dropSystem.onEvent = (e) => goals.notify(e);

// ---- ここから入力 ----
const raycaster = new THREE.Raycaster();

function boardPointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(pickPlane, false);
  if (!hits.length) return null;
  const local = boardGroup.worldToLocal(hits[0].point.clone());
  return new THREE.Vector2(local.x, local.y);
}

// ---- プレビューの糸(ひっぱりちゅう) ----
const previewMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, transparent: true, opacity: 0.75,
  roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.15,
});
let previewMesh = null;
function updatePreview(fromPin, toPt) {
  removePreview();
  const a = fromPin.anchor(0.05);
  const b = new THREE.Vector3(toPt.x, toPt.y, PIN_Z + 0.05);
  const len = a.distanceTo(b);
  if (len < 0.05) return;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y -= len * 0.045;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.TubeGeometry(curve, 16, THICKNESS[ui.state.thickness], 6, false);
  previewMat.color.setHex(ui.state.color);
  previewMat.emissive.setHex(ui.state.color);
  previewMesh = new THREE.Mesh(geo, previewMat);
  boardGroup.add(previewMesh);
}
function removePreview() {
  if (previewMesh) {
    previewMesh.geometry.dispose();
    boardGroup.remove(previewMesh);
    previewMesh = null;
  }
}

function setArmed(pin) {
  if (armedPin) armedPin.targetHighlight = 0;
  armedPin = pin;
  if (pin) pin.targetHighlight = 1;
}

function cancelDrag() {
  if (dragPin) dragPin.targetHighlight = 0;
  dragPin = null;
  removePreview();
  if (hoverPin) { hoverPin.targetHighlight = 0; hoverPin = null; }
}

function connectPins(a, b) {
  const th = threadMgr.add(a, b, ui.state.color, ui.state.thickness);
  if (!th) {
    ui.hint('いとが いっぱいだよ！ 🫧で あらってみてね');
    audio.boing();
    return;
  }
  audio.pluck(th.len / 10);
  a.pulse = 1; b.pulse = 1;
  sparkles.burst(a.anchor(0.2), ui.state.color, 6, 1.6, 0.2, 0.5);
  sparkles.burst(b.anchor(0.2), ui.state.color, 6, 1.6, 0.2, 0.5);
  goals.notify('thread');
  ui.hideHint();
  if (!firstThreadDone) {
    firstThreadDone = true;
    setTimeout(() => ui.praise('いっぽんで せかいが かわった！'), 350);
    audio.sparkle();
  }
}

let downPt = null;
let moved = 0;

function onPointerDown(e) {
  if (!started) return;
  lastInput = now;
  const pt = boardPointFromEvent(e);
  if (!pt) return;
  downPt = pt.clone();
  moved = 0;
  const tool = ui.state.tool;

  if (tool === 'ito') {
    const pin = pinBoard.nearest(pt, 1.3);
    if (armedPin && pin && pin !== armedPin) {
      connectPins(armedPin, pin);
      setArmed(null);
      return;
    }
    if (pin) {
      dragPin = pin;
      pin.targetHighlight = 1;
      pin.pulse = 1;
      audio.pop();
      setArmed(null);
      updatePreview(pin, pt);
    } else if (armedPin) {
      setArmed(null);
      audio.boing();
    } else {
      // 糸をはじいて あそべる(ハープみたいに)
      const hit = threadMgr.nearestThread(pt, 0.5);
      if (hit) {
        hit.thread.pluck(1.2);
        audio.pluck(hit.thread.len / 10);
        sparkles.burst(hit.thread.pointAt(hit.s), hit.thread.colorHex, 4, 1.2, 0.15, 0.4);
      }
    }
  } else if (tool === 'kiri') {
    dropSystem.sprayAt(pt);
    sprayCooldown = 0.18;
  } else if (tool === 'mizu') {
    const hit = threadMgr.nearestThread(pt, 0.85);
    if (hit) {
      dropSystem.dropColorAt(hit, ui.state.color);
    } else {
      // 板にぽたっ
      stains.blob(pt.x, pt.y, ui.state.color, rand(0.3, 0.5), 0.2);
      audio.plip();
      sparkles.burst(new THREE.Vector3(pt.x, pt.y, 0.2), ui.state.color, 3, 0.8, 0.12, 0.4);
    }
  } else if (tool === 'hikari') {
    lightActive = true;
    lightHold = 0;
    lightNotified = false;
    lightPt.copy(pt);
  } else if (tool === 'hasami') {
    const hit = threadMgr.nearestThread(pt, 0.65);
    if (hit) {
      audio.snip();
      const p = hit.thread.pointAt(hit.s);
      sparkles.burst(p, hit.thread.colorHex, 10, 2, 0.2, 0.6);
      dropSystem.onThreadRemoved(hit.thread);
      threadMgr.remove(hit.thread);
      // まわりの糸がぷるんとゆれる
      for (const t of threadMgr.threads) {
        if (t.dying === 0 && Math.random() < 0.3) t.pluck(0.4);
      }
    }
  }
}

function onPointerMove(e) {
  if (!started) return;
  const pt = boardPointFromEvent(e);
  if (!pt) return;
  if (downPt) moved = Math.max(moved, downPt.distanceTo(pt));
  const tool = ui.state.tool;

  if (tool === 'ito' && dragPin) {
    lastInput = now;
    updatePreview(dragPin, pt);
    const near = pinBoard.nearest(pt, 1.0);
    if (near !== hoverPin) {
      if (hoverPin && hoverPin !== dragPin && hoverPin !== armedPin) hoverPin.targetHighlight = 0;
      hoverPin = near;
      if (hoverPin && hoverPin !== dragPin) {
        hoverPin.targetHighlight = 1;
        audio.pop();
      }
    }
  } else if (tool === 'kiri' && downPt) {
    if (sprayCooldown <= 0) {
      dropSystem.sprayAt(pt);
      sprayCooldown = 0.16;
    }
  } else if (tool === 'hikari' && lightActive) {
    lightPt.copy(pt);
  }
}

function onPointerUp(e) {
  if (!started) return;
  const pt = boardPointFromEvent(e) || downPt;
  const tool = ui.state.tool;

  if (tool === 'ito' && dragPin) {
    const target = pt ? pinBoard.nearest(pt, 1.15) : null;
    if (target && target !== dragPin) {
      connectPins(dragPin, target);
      cancelDrag();
    } else if (moved < 0.35) {
      // タップ → このピンをえらんだ状態にして、つぎのタップでつなぐ
      const p = dragPin;
      cancelDrag();
      setArmed(p);
      ui.hint('つぎの ピンを タッチしてね ✨');
    } else {
      audio.boing();
      cancelDrag();
    }
  }
  lightActive = false;
  downPt = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
// iOSでバックグラウンドから戻ったときに音をふっかつさせる
document.addEventListener('pointerdown', () => { if (started) audio.unlock(); });
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
// iOSのスクロール・ズームをふうじる
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('resize', world.resize);
window.addEventListener('orientationchange', () => setTimeout(world.resize, 250));

// ---- ヒント ----
const HINTS = [
  'ピンから ピンへ ひっぱってみよう 🧵',
  '✨おまかせ を おすと もようが そだつよ',
  '💨きりふき で いとが きらきらに なるよ',
  '💧いろみず を いとに たらしてみて',
  '🔦ひかり を あてると きらきら ひかるよ',
  'いとを たくさん はると、まるい もようが みえてくるよ',
  '✂️はさみ で いとを きると もようが かわるよ',
];

// ---- メインループ ----
const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  now += dt;

  world.tickWorld(dt, pointerNdc);

  if (started) {
    pinBoard.tick(dt, now);
    threadMgr.tick(dt, now);
    autoWeaver.tick(dt, now);
    dropSystem.tick(dt, now);
    goals.tick(dt);
    if (sprayCooldown > 0) sprayCooldown -= dt;

    // おまかせ表示
    if (autoWeaver.busy !== weavingShown) {
      weavingShown = autoWeaver.busy;
      ui.setWeaving(weavingShown);
    }

    // ---- ひかりあそび ----
    if (lightActive) {
      lightHold += dt;
      if (lightHold > 0.5 && !lightNotified) {
        lightNotified = true;
        goals.notify('light');
      }
      const world3 = boardGroup.localToWorld(new THREE.Vector3(lightPt.x, lightPt.y, 2.4));
      playLight.position.copy(world3);
      playLight.intensity += (46 - playLight.intensity) * Math.min(1, dt * 8);
      lightGlow.position.copy(boardGroup.localToWorld(new THREE.Vector3(lightPt.x, lightPt.y, 1.5)));
      lightGlow.material.opacity += (0.75 - lightGlow.material.opacity) * Math.min(1, dt * 8);
      lightGlow.scale.setScalar(4.4 + Math.sin(now * 3.2) * 0.5);
      sun.intensity += (1.0 - sun.intensity) * Math.min(1, dt * 4);
      hemi.intensity += (0.45 - hemi.intensity) * Math.min(1, dt * 4);
      // しずくと糸が にじいろに きらめく
      glintTimer -= dt;
      if (glintTimer <= 0) {
        glintTimer = 0.07;
        const targets = dropSystem.glintTargets();
        for (let k = 0; k < 2; k++) {
          if (targets.length && Math.random() < 0.85) {
            const p = pick(targets);
            if (Math.hypot(p.x - lightPt.x, p.y - lightPt.y) < 3.6) {
              sparkles.twinkle(p, hsl(rand(0, 360), 0.75, 0.75), rand(0.3, 0.65), 0.5);
            }
          }
        }
        // 糸のうえにも ちいさな にじ
        const hitT = threadMgr.nearestThread(lightPt, 2.6);
        if (hitT && Math.random() < 0.7) {
          const s = clamp(hitT.s + rand(-0.25, 0.25), 0.05, 0.95);
          sparkles.twinkle(hitT.thread.pointAt(s), hsl(rand(0, 360), 0.8, 0.78), rand(0.2, 0.5), 0.45);
        }
        if (Math.random() < 0.12) audio.sparkle();
      }
    } else {
      lightGlow.material.opacity += (0 - lightGlow.material.opacity) * Math.min(1, dt * 6);
      playLight.intensity += (0 - playLight.intensity) * Math.min(1, dt * 5);
      sun.intensity += (2.2 - sun.intensity) * Math.min(1, dt * 2.5);
      hemi.intensity += (0.85 - hemi.intensity) * Math.min(1, dt * 2.5);
    }

    // ぬれた つぶが ときどき ちいさく きらり
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      ambientTimer = 0.35;
      const targets = dropSystem.glintTargets();
      if (targets.length && Math.random() < 0.6) {
        sparkles.twinkle(pick(targets), 0xffffff, rand(0.15, 0.35), 0.4);
      }
    }

    // ひまなときの おさそい
    if (now - lastInput > 17 && !autoWeaver.busy) {
      lastInput = now;
      ui.hint(pick(HINTS));
    }
  }

  stains.tick();
  sparkles.tick(dt, now);
  renderer.render(scene, camera);

  // ---- カードにのこす(レンダー直後に読む) ----
  if (captureRequested) {
    captureRequested = false;
    try {
      const dataUrl = captureCard(canvas);
      saveCard(dataUrl);
      audio.shutter();
      ui.flash();
      setTimeout(() => {
        ui.showCard(dataUrl);
        goals.notify('save');
      }, 250);
    } catch (err) {
      console.warn('capture failed', err);
    }
  }
}
loop();

// 開発用の小さなフック(テストからようすを見る)
window.__dbg = () => ({
  threads: threadMgr.count,
  weaving: autoWeaver.busy,
  queue: autoWeaver.queue.length,
  pins: pinBoard.pins.length,
  drops: dropSystem.drops.length,
  beads: dropSystem.beads.length,
  drop0: dropSystem.drops[0] ? {
    free: !!dropSystem.drops[0].free,
    s: dropSystem.drops[0].s,
    vel: dropSystem.drops[0].free ? undefined : dropSystem.drops[0].vel,
    water: dropSystem.drops[0].water,
    pause: dropSystem.drops[0].pause,
  } : null,
});
