// ヘッドレス スモークテスト: DOM シムの上で本物のシーン部品
// (キッチン・なべ・こおり・ゆげ・エフェクト) を組み立てて、
// 状態変化の全サイクルを回しながら数百フレーム更新し、
// NaN や例外が出ないこと・見た目の状態遷移が起きることを確認する。

// ---- canvas 2D の最小シム
const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctxStub };
    return {};
  },
  addEventListener() {},
};
globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const THREE = await import('../vendor/three.module.min.js');

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

// ---- 各モジュールが読み込めるか
for (const m of ['thermo', 'watersim', 'kitchen', 'pot', 'ice', 'steam', 'effects', 'audio', 'ui', 'input']) {
  try { await import(`../src/${m}.js`); console.log(`ok   import src/${m}.js`); }
  catch (e) { console.log(`FAIL import src/${m}.js → ${e.message}`); ok = false; }
}

const { Thermo } = await import('../src/thermo.js');
const { WaterSim } = await import('../src/watersim.js');
const { Kitchen } = await import('../src/kitchen.js');
const { Pot } = await import('../src/pot.js');
const { Ice } = await import('../src/ice.js');
const { Steam } = await import('../src/steam.js');
const { Effects } = await import('../src/effects.js');
const { AudioEngine } = await import('../src/audio.js');

// ---- 波シミュレーション単体: かき混ぜても発散しない
{
  const sim = new WaterSim(52, 1);
  for (let i = 0; i < 600; i++) {
    if (i % 7 === 0) sim.disturb((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0.6, 0.15);
    sim.step(1 / 60);
  }
  const bad = [...sim.u].some(v => !Number.isFinite(v) || Math.abs(v) > 0.51);
  check(!bad, '波シム 600 フレームで発散なし');
  sim.calm(0);
  check([...sim.u].every(v => v === 0), 'calm(0) で完全に静まる');
}

// ---- 本物のシーンを組み立て
const scene = new THREE.Scene();
const thermo = new Thermo();
const kitchen = new Kitchen(scene);
const pot = new Pot(scene);
const ice = new Ice(scene, pot);
const steam = new Steam(scene, pot);
const effects = new Effects(scene, pot);
const audio = new AudioEngine(); // unlock しない (Web Audio なし環境)

check(scene.children.length >= 5, 'シーンに部品が追加された');

const iceEvents = [];
ice.onEvent = name => iceEvents.push(name);
const steamEvents = [];
steam.onEvent = name => steamEvents.push(name);

const stepWorld = (seconds, t0) => {
  const dt = 1 / 60;
  let t = t0;
  for (let i = 0; i < seconds * 60; i++) {
    t += dt;
    thermo.update(dt);
    pot.setLevel(thermo.inPot);
    pot.update(dt, t, thermo);
    ice.update(dt, t, thermo);
    steam.update(dt, t, thermo);
    effects.update(dt, t);
    audio.update(dt, thermo);
    kitchen.setFlame(0.5);
    kitchen.update(dt, t);
  }
  return t;
};

// ---- 加熱フェーズ: 泡とゆげとくもが出る
thermo.setTarget(120);
let t = stepWorld(120, 0);
check(thermo.cloud > 0.9, '沸騰しきって くもができた');
check(steam.cloudGroup.visible, 'くもの表示が ON');
check(steamEvents.includes('bubble-pop'), '泡がはじけるイベントが出た');

// ---- 冷却フェーズ: 雨 → 氷キューブ → ブロック
thermo.setTarget(-20);
t = stepWorld(60, t);
check(steamEvents.includes('rain-drop'), '雨つぶが水面に落ちた');
t = stepWorld(150, t);
check(thermo.ice > 0.95, '全凍結した');
check(iceEvents.includes('cube-born'), '氷キューブが生まれた');
check(ice.block.visible, '氷ブロックが表示された');

// ---- 氷をタップして割る
thermo.setTarget(30);
t = stepWorld(8, t); // とちゅうまで溶かしてキューブを出す (溶けきる前に止める)
const cubes = ice.tappables().filter(m => m !== ice.block);
check(cubes.length > 0, '浮かぶ氷キューブがタップ対象にある');
if (cubes.length) {
  ice.tap(cubes[0]);
  ice.tap(cubes[0]);
  check(iceEvents.includes('cube-split'), '2 回タップで割れた');
}

// ---- 完全に溶かして水へ戻す
thermo.setTarget(60);
t = stepWorld(120, t);
check(thermo.ice < 0.01 && thermo.water > 0.95, '溶けて水に戻った');
check(Math.abs(thermo.total - 1) < 1e-6, '全サイクルで保存則が守られた');

// ---- 水面メッシュの頂点が壊れていないか
{
  const pos = pot.surface.geometry.attributes.position;
  let bad = false;
  for (let i = 0; i < pos.count; i++) {
    if (!Number.isFinite(pos.getY(i))) { bad = true; break; }
  }
  check(!bad, '水面メッシュに NaN なし');
}

// ---- 入力モジュールのレイキャストまわり (カメラだけで検証)
{
  const { Input } = await import('../src/input.js');
  const camera = new THREE.PerspectiveCamera(44, 0.6, 0.1, 60);
  camera.position.set(0, 2.9, 7.5);
  camera.lookAt(0, 1.7, 0);
  camera.updateMatrixWorld();
  const fakeCanvas = {
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
  };
  const input = new Input(fakeCanvas, camera, { pot, ice, steam, effects, audio, thermo });
  input.enabled = true;
  input._ndc({ clientX: 200, clientY: 430 }); // 画面中央やや下 = なべのあたり
  const hit = input._waterHit();
  check(!!hit, '画面中央のレイが水面に当たる');
}

console.log(ok ? '\nすべて OK' : '\nテスト失敗あり');
process.exit(ok ? 0 : 1);
