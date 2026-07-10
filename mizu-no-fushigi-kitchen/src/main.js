// みずのふしぎキッチン — メインループとつなぎこみ。
// Tinybop「States of Matter」風、水の状態変化 3D サンドボックス。

import * as THREE from '../vendor/three.module.min.js';
import { Thermo, T_ROOM } from './thermo.js';
import { Kitchen } from './kitchen.js';
import { Pot } from './pot.js';
import { Ice } from './ice.js';
import { Steam } from './steam.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Input } from './input.js';

// ------------------------------------------------------------ renderer
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4ead8);
scene.fog = new THREE.Fog(0xf4ead8, 14, 26);
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 60);

// ------------------------------------------------------------ 環境マップ
// ミニ環境シーン (窓あかりのある部屋) を PMREM に焼いて、ガラス・水・氷の
// 反射をリッチにする。
function buildEnvironment() {
  const env = new THREE.Scene();
  const mk = (color, x, y, z, w, h, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  env.background = new THREE.Color(0x9fb4b8);
  mk(0xcfe6ee, 0, 6, 0, 20, 20, 0, Math.PI / 2);   // 天井 (そら色)
  mk(0xded2c2, 0, -3, 0, 20, 20, 0, -Math.PI / 2); // 床 (明るい照りかえし)
  mk(0xa8ccc6, 0, 2, -8, 20, 10);                  // 奥の壁 (タイル)
  mk(0xe6d8be, 0, 2, 8, 20, 10);                   // 手前
  mk(0xd8c4a4, -8, 2, 0, 16, 10, Math.PI / 2);     // 左
  mk(0xfff3cf, 8, 2, 0, 16, 10, Math.PI / 2);      // 右 (窓のあかり)
  mk(0xffffff, 6.5, 4.5, -2, 4, 5, Math.PI / 2.4); // まぶしい窓
  mk(0xfff8e0, 2, 5.8, 2, 5, 3, 0, Math.PI / 2);   // 天井のあかり
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.06).texture;
  scene.environment = tex;
  pmrem.dispose();
}
buildEnvironment();

// ------------------------------------------------------------ ライト
const sun = new THREE.DirectionalLight(0xfff0d2, 2.0);
sun.position.set(3.6, 6.2, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -3;
sun.shadow.camera.far = 20;
sun.shadow.bias = -0.002;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdff2f8, 0xc7a97e, 0.85));
const fill = new THREE.DirectionalLight(0xbfd8ff, 0.4);
fill.position.set(-4, 3, 4);
scene.add(fill);

// ------------------------------------------------------------ 世界
const thermo = new Thermo();
const kitchen = new Kitchen(scene);
const pot = new Pot(scene);
const ice = new Ice(scene, pot);
const steam = new Steam(scene, pot);
const effects = new Effects(scene, pot);
const audio = new AudioEngine();

// ------------------------------------------------------------ UI
const ui = new UI({
  onStart() {
    audio.unlock();
    audio.startJingle();
    input.enabled = true;
    state.started = true;
    state.intro = 1;
  },
  onTarget(t) { thermo.setTarget(t); },
  onMute(m) { audio.setMuted(m); },
  onReset() {
    thermo.temp = T_ROOM; thermo.target = T_ROOM;
    thermo.ice = 0; thermo.water = 1; thermo.cloud = 0;
    thermo._flags.clear();
    pot.sim.calm(0);
    ui.showBanner('あたらしい みず!', '🚰');
    ui.confetti(['💧', '✨']);
    audio.startJingle();
  },
  onUiTap() { audio.unlock(); audio.uiTap(); },
});

const input = new Input(canvas, camera, { pot, ice, steam, effects, audio, thermo });

// ------------------------------------------------------------ イベント演出
thermo.onEvent(name => {
  const surf = new THREE.Vector3(0, pot.surfaceY + 0.3, 0);
  switch (name) {
    case 'freeze-start':
      ui.showBanner('こおりはじめた!', '❄️');
      audio.freezeCrackle();
      break;
    case 'frozen':
      ui.showBanner('かちかちに こおった!', '🧊');
      ui.confetti(['❄️', '🧊', '✨']);
      audio.fanfare('frozen');
      effects.sparkle(surf, 16, 0xcfefff, 0.2);
      effects.snow(surf, 10);
      break;
    case 'melt-start':
      ui.showBanner('とけていく…', '💧');
      break;
    case 'melted':
      ui.showBanner('ぜんぶ とけた!', '💧');
      ui.confetti(['💧', '✨', '🫧']);
      audio.fanfare('melted');
      effects.sparkle(surf, 12, 0x9fdef2, 0.16);
      break;
    case 'boil-start':
      ui.showBanner('ぐつぐつ ふっとう!', '🫧');
      audio.fanfare('boiling');
      break;
    case 'all-steam':
      ui.showBanner('ぜんぶ ゆげに なった!', '☁️');
      ui.confetti(['☁️', '💨', '✨']);
      audio.fanfare('steam');
      audio.steamWhoosh();
      break;
    case 'rain-start':
      ui.showBanner('くもから あめ!', '🌧️');
      break;
    case 'rained':
      ui.showBanner('みずが もどってきた!', '🌈');
      ui.confetti(['💧', '🌈', '✨']);
      audio.fanfare('rained');
      break;
  }
});

ice.onEvent = (name, pos) => {
  switch (name) {
    case 'cube-born':
      audio.freezeCrackle();
      effects.snow(pos, 3);
      effects.sparkle(pos, 4, 0xe0f6ff, 0.1);
      break;
    case 'cube-knock':
      audio.iceKnock();
      effects.sparkle(pos, 4, 0xcfefff, 0.1);
      pot.disturb(pos.x, pos.z, 0.25, 0.14);
      break;
    case 'cube-split':
      audio.iceSplit();
      effects.sparkle(pos, 12, 0xffffff, 0.16);
      effects.splash(pos, 4, 0.7);
      pot.disturb(pos.x, pos.z, 0.4, 0.18);
      break;
    case 'block-knock':
      audio.blockKnock();
      effects.snow(pos, 5);
      effects.sparkle(pos, 8, 0xcfefff, 0.14);
      break;
  }
};

steam.onEvent = (name, pos) => {
  if (name === 'bubble-pop') {
    if (Math.random() < 0.4) effects.ripple(pos.x, pos.z, pot.surfaceY);
  } else if (name === 'rain-drop') {
    audio.rainPlink();
    effects.ripple(pos.x, pos.z, pot.surfaceY);
    if (Math.random() < 0.4) effects.splash(pos, 2, 0.5);
  }
};

// ------------------------------------------------------------ カメラ
const state = { started: false, intro: 0, fpsAcc: 0, fpsN: 0, lowTimer: 0, quality: true };

function frameCamera() {
  const aspect = camera.aspect;
  // 縦画面ほど引いて、なべ+くもが必ず収まるように。
  // 横画面は下の温度レバーと重ならないよう、少し引いて低めを見る。
  const dist = aspect >= 1
    ? 7.3 + (1.7 - Math.min(1.7, aspect)) * 1.4
    : 6.8 + (1 / aspect - 1) * 3.4;
  const height = aspect >= 1 ? 2.85 : 2.9;
  const lookY = aspect >= 1 ? 1.3 : 1.75;
  camera.userData.base = { dist: Math.min(12, dist), height, lookY };
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frameCamera();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ------------------------------------------------------------ ループ
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  const t = elapsed;

  // --- モデル更新
  if (state.started) thermo.update(dt);
  pot.setLevel(thermo.inPot);
  pot.update(dt, t, thermo);
  ice.update(dt, t, thermo);
  steam.update(dt, t, thermo);
  effects.update(dt, t);
  audio.update(dt, thermo);
  ui.update(dt);

  // --- ほのお / 冷気 (レバーに反応)
  const heatPow = Math.max(0, Math.min(1, (thermo.target - 30) / 90));
  const coldPow = Math.max(0, Math.min(1, (10 - thermo.target) / 30));
  kitchen.setFlame(heatPow);
  kitchen.update(dt, t);
  effects.setCold(coldPow);

  // --- HUD
  ui.setTemp(thermo.temp);
  ui.setPhase(thermo.phaseName());

  // --- カメラ (ゆったり漂う + イントロ)
  const base = camera.userData.base;
  if (base) {
    if (state.intro > 0) state.intro = Math.max(0, state.intro - dt * 0.5);
    const introF = state.intro * state.intro;
    const sway = Math.sin(t * 0.21) * 0.22;
    const bob = Math.sin(t * 0.17) * 0.08;
    camera.position.set(
      sway + introF * 1.6,
      base.height + bob + introF * 0.9,
      base.dist + introF * 2.4);
    camera.lookAt(0, base.lookY, 0);
  }

  renderer.render(scene, camera);

  // --- 低スペック検知 → 品質を落とす (一度だけ)
  if (state.started && state.quality) {
    state.fpsAcc += dt; state.fpsN++;
    if (state.fpsAcc >= 1) {
      const fps = state.fpsN / state.fpsAcc;
      state.fpsAcc = 0; state.fpsN = 0;
      if (fps < 36) {
        if (++state.lowTimer >= 3) {
          state.quality = false;
          pot.setQuality(false);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        }
      } else {
        state.lowTimer = 0;
      }
    }
  }
}
tick();

// デバッグ・検証用のハンドル (ゲームプレイでは未使用)
window.__mizu = { thermo, pot, ice, steam, ui, state };
