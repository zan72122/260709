// audio.js — WebAudio 全生成サウンド。衝突がペンタトニック音階に量子化され、遊ぶだけで音楽になる。
// 外部音源ファイルなし。

// ペンタトニック(C メジャー): 高さ y → 音高(上の段ほど高い音)
const PENTA = [0, 2, 4, 7, 9]; // C D E G A
export function yToNote(y, minY = 0, maxY = 14) {
  const t = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
  const idx = Math.round(t * 14); // 3オクターブ分
  const oct = Math.floor(idx / 5);
  const semitone = PENTA[idx % 5] + 12 * oct;
  return 261.63 * Math.pow(2, semitone / 12); // C4 基準
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._lastNoteAt = 0;
    this._rollGain = null;
    this._rollFilter = null;
  }

  // ユーザー操作(タップ)で初期化 — iOS Safari 対応
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this._setupRoll();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---- 基本音色: マリンバ(木琴) ----
  marimba(freq, vel = 1, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now + when;
    const g = this.ctx.createGain();
    g.connect(this.master);
    const v = Math.min(0.55, 0.1 + vel * 0.4);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    const o1 = this.ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    o1.connect(g);
    o1.start(t); o1.stop(t + 0.95);
    // 上部倍音(木の硬さ)
    const g2 = this.ctx.createGain();
    g2.connect(this.master);
    g2.gain.setValueAtTime(v * 0.28, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 3.97;
    o2.connect(g2);
    o2.start(t); o2.stop(t + 0.16);
    // アタックのコツン
    this._knock(0.12 * vel, 1800 + freq, t);
  }

  _knock(vol, f, t) {
    const buf = this._noiseBuf();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.08);
  }

  _noiseBuf() {
    if (this._nb) return this._nb;
    const len = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = buf;
    return buf;
  }

  // ---- 衝突 → 音楽(高さで音高、強さで音量。連打は間引く) ----
  impact(y, speed) {
    if (!this.ctx || this.muted) return;
    const t = this.now;
    if (t - this._lastNoteAt < 0.07) return;
    this._lastNoteAt = t;
    const vel = Math.min(1, speed / 6);
    this.marimba(yToNote(y), vel);
  }

  // ---- 転がりノイズ(速度に応じてゴロゴロ) ----
  _setupRoll() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this._rollGain = g; this._rollFilter = lp;
  }

  setRolling(speed, grounded) {
    if (!this._rollGain) return;
    const target = grounded ? Math.min(0.09, speed * 0.016) : 0;
    const t = this.now;
    this._rollGain.gain.setTargetAtTime(target, t, 0.08);
    this._rollFilter.frequency.setTargetAtTime(180 + speed * 90, t, 0.1);
  }

  // ---- ギミック音 ----
  woodClack(pitch = 900, vol = 0.3) { // 水車のカタン、スイッチ
    if (!this.ctx || this.muted) return;
    this._knock(vol, pitch, this.now);
    this.marimba(yToNote(8 + Math.random() * 2), 0.3);
  }

  tubeRing(i, n) { // 落下チューブのリング通過音(下降メロディ)
    if (!this.ctx || this.muted) return;
    const freq = yToNote(9 - (i / Math.max(1, n - 1)) * 5);
    this.marimba(freq, 0.55);
  }

  elevatorCreak(active) { // エレベーターのモーター音
    if (!this.ctx || this.muted) return;
    if (active && !this._elv) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 70;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 9;
      const lg = this.ctx.createGain(); lg.gain.value = 14;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.05, this.now, 0.1);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this._elv = { o, lfo, g };
    } else if (!active && this._elv) {
      const { o, lfo, g } = this._elv;
      g.gain.setTargetAtTime(0, this.now, 0.06);
      o.stop(this.now + 0.4); lfo.stop(this.now + 0.4);
      this._elv = null;
    }
  }

  chargeTone(charge) { // カタパルトのチャージ(上昇音)
    if (!this.ctx || this.muted) return;
    if (!this._chg) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const g = this.ctx.createGain();
      g.gain.value = 0.06;
      o.connect(g); g.connect(this.master);
      o.start();
      this._chg = { o, g };
    }
    this._chg.o.frequency.setTargetAtTime(180 + charge * 460, this.now, 0.03);
  }

  chargeEnd(launch) {
    if (this._chg) {
      this._chg.g.gain.setTargetAtTime(0, this.now, 0.04);
      this._chg.o.stop(this.now + 0.3);
      this._chg = null;
    }
    if (launch && this.ctx && !this.muted) {
      // 発射のヒュッ
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(500, this.now);
      bp.frequency.exponentialRampToValueAtTime(2600, this.now + 0.35);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, this.now);
      g.gain.exponentialRampToValueAtTime(0.001, this.now + 0.4);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(); src.stop(this.now + 0.45);
    }
  }

  boing() { // 弱発射のポヨン
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.28);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  bell() { // ゴールの鐘(FM ベル)
    if (!this.ctx || this.muted) return;
    for (let k = 0; k < 2; k++) {
      const t = this.now + k * 0.45;
      const car = this.ctx.createOscillator();
      car.frequency.value = 1046.5; // C6
      const mod = this.ctx.createOscillator();
      mod.frequency.value = 1046.5 * 3.53;
      const mg = this.ctx.createGain();
      mg.gain.setValueAtTime(900, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
      mod.connect(mg); mg.connect(car.frequency);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      car.connect(g); g.connect(this.master);
      car.start(t); car.stop(t + 1.7);
      mod.start(t); mod.stop(t + 1.7);
    }
  }

  fanfare() { // クリアのアルペジオ
    if (!this.ctx || this.muted) return;
    const seq = [0, 4, 7, 12, 16, 12, 19];
    seq.forEach((s, i) => {
      this.marimba(523.25 * Math.pow(2, s / 12), 0.85, 0.09 * i);
    });
    // キラキラ
    for (let i = 0; i < 8; i++) {
      this.marimba(1568 * Math.pow(2, PENTA[i % 5] / 12), 0.3, 0.65 + i * 0.07);
    }
  }

  pop() { // 玉の再登場ポン
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(950, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  uiTap() {
    if (!this.ctx || this.muted) return;
    this.marimba(783.99, 0.35);
  }
}
