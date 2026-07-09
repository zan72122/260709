// ちいさなトゥイーンエンジン。ステージ退出時に clearTweens() で全部消せる
// (setTimeout と違い、画面遷移後に古いアニメが走る事故を防ぐ)。

const tweens = [];

export const Ease = {
  linear: (k) => k,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
  outElastic: (k) =>
    k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -9 * k) * Math.sin((k * 9 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

// fn(k) に 0→1 のイージング済み進捗が渡る
export function tween(dur, fn, { delay = 0, ease = Ease.outCubic, onDone = null } = {}) {
  tweens.push({ dur, fn, delay, ease, onDone, t: 0, started: false });
}

// 指定秒後に一度だけ実行(clearTweens で消えるsetTimeout代わり)
export function after(delay, fn) {
  tween(0.0001, () => {}, { delay, onDone: fn });
}

export function clearTweens() {
  tweens.length = 0;
}

export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.delay > 0) {
      tw.delay -= dt;
      if (tw.delay > 0) continue;
    }
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(k));
    if (k >= 1) {
      tweens.splice(i, 1);
      if (tw.onDone) tw.onDone();
    }
  }
}
