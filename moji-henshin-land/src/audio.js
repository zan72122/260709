// WebAudio 合成の効果音。音声ファイル・ネット接続は不要。
let ctx = null;
let master = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.2, peak = 0.2, delay = 0, curve = 'exp' }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(f0, 1), t0);
  if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  else osc.frequency.linearRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst({ dur = 0.3, peak = 0.15, f0 = 400, f1 = 2400, q = 1.2, delay = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export const sfx = {
  // ぽよん(つつき)
  poyon() {
    tone({ type: 'sine', f0: 170, f1: 340, dur: 0.16, peak: 0.28 });
    tone({ type: 'sine', f0: 85, f1: 170, dur: 0.16, peak: 0.16 });
  },
  // ちいさなタップ音
  tap() {
    tone({ type: 'triangle', f0: 620, f1: 900, dur: 0.07, peak: 0.2 });
  },
  // びよ〜ん(引っぱり中)
  stretch() {
    tone({ type: 'sine', f0: 200, f1: 460, dur: 0.28, peak: 0.1, curve: 'lin' });
  },
  // ボヨンボヨン(引っぱって離した)
  boing() {
    tone({ type: 'sine', f0: 380, f1: 130, dur: 0.1, peak: 0.26 });
    tone({ type: 'sine', f0: 130, f1: 300, dur: 0.12, peak: 0.2, delay: 0.09 });
    tone({ type: 'sine', f0: 300, f1: 170, dur: 0.14, peak: 0.13, delay: 0.2 });
  },
  // くるくる(回転中)
  whirl() {
    tone({ type: 'triangle', f0: 500, f1: 760, dur: 0.09, peak: 0.08 });
  },
  // しゅわ〜(変身の風)
  whoosh() {
    noiseBurst({ dur: 0.45, peak: 0.2, f0: 300, f1: 3000, q: 1.0 });
  },
  // ぽんっ(変身完了)
  pop() {
    tone({ type: 'triangle', f0: 420, f1: 900, dur: 0.12, peak: 0.32 });
    noiseBurst({ dur: 0.12, peak: 0.1, f0: 1500, f1: 3500, q: 0.8 });
  },
  // キラキラ
  sparkle() {
    const notes = [1320, 1760, 2093, 2637, 3136];
    notes.forEach((f, i) => {
      tone({ type: 'sine', f0: f, f1: f * 1.02, dur: 0.22, peak: 0.09, delay: i * 0.05 });
    });
  },
  // かさかさ(紙)
  rustle() {
    noiseBurst({ dur: 0.12, peak: 0.12, f0: 2500, f1: 4500, q: 0.7 });
    noiseBurst({ dur: 0.1, peak: 0.08, f0: 3000, f1: 5000, q: 0.7, delay: 0.08 });
  },
  // ピンッ(紙が張る)
  snap() {
    tone({ type: 'triangle', f0: 900, f1: 1400, dur: 0.07, peak: 0.22 });
    noiseBurst({ dur: 0.05, peak: 0.08, f0: 3000, f1: 5000, q: 1.5 });
  },
  // ぱたぱた(はばたき)
  flap() {
    noiseBurst({ dur: 0.09, peak: 0.14, f0: 300, f1: 700, q: 0.8 });
  },
  // ぽこっ(パーツ出現)
  poko() {
    tone({ type: 'sine', f0: 300, f1: 620, dur: 0.09, peak: 0.22 });
  },
  // にゅ〜っ(伸びる)
  grow() {
    tone({ type: 'sine', f0: 160, f1: 520, dur: 0.4, peak: 0.16, curve: 'lin' });
  },
  // コロコロ(転がる)
  coro() {
    tone({ type: 'sine', f0: 240, f1: 200, dur: 0.06, peak: 0.14 });
    tone({ type: 'sine', f0: 300, f1: 260, dur: 0.06, peak: 0.12, delay: 0.11 });
  },
  // ガブッ!(かじる)
  chomp() {
    noiseBurst({ dur: 0.1, peak: 0.3, f0: 900, f1: 300, q: 0.9 });
    tone({ type: 'sawtooth', f0: 260, f1: 90, dur: 0.16, peak: 0.24, delay: 0.02 });
  },
  // ドスン!(足ぶみ)
  stomp() {
    tone({ type: 'sine', f0: 95, f1: 45, dur: 0.24, peak: 0.42 });
    noiseBurst({ dur: 0.12, peak: 0.14, f0: 200, f1: 90, q: 0.7 });
  },
  // ガオーッ!(きょうりゅう)
  roar() {
    tone({ type: 'sawtooth', f0: 190, f1: 85, dur: 0.55, peak: 0.2, curve: 'lin' });
    tone({ type: 'sawtooth', f0: 240, f1: 120, dur: 0.5, peak: 0.12, delay: 0.05, curve: 'lin' });
    noiseBurst({ dur: 0.5, peak: 0.08, f0: 500, f1: 200, q: 0.6 });
  },
  // パオーン!(ぞう)
  trumpet() {
    tone({ type: 'square', f0: 360, f1: 620, dur: 0.22, peak: 0.14, curve: 'lin' });
    tone({ type: 'square', f0: 620, f1: 520, dur: 0.3, peak: 0.14, delay: 0.2, curve: 'lin' });
    tone({ type: 'sawtooth', f0: 180, f1: 300, dur: 0.45, peak: 0.09, curve: 'lin' });
  },
  // ぷしゃー(水しぶき)
  spray() {
    noiseBurst({ dur: 0.5, peak: 0.16, f0: 2000, f1: 5000, q: 0.6 });
  },
  // ファンファーレ(できた!)
  tada() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => {
      tone({ type: 'triangle', f0: f, f1: f, dur: 0.24, peak: 0.22, delay: i * 0.11 });
      tone({ type: 'sine', f0: f / 2, f1: f / 2, dur: 0.24, peak: 0.1, delay: i * 0.11 });
    });
    tone({ type: 'triangle', f0: 1047, f1: 1047, dur: 0.5, peak: 0.22, delay: 0.46 });
  },
};
