// audio.js — オルゴール音楽エンジン。衝突やギミック作動のたびに
// 「きらきらぼし」が1音ずつ進む。全て WebAudio コード生成。

// きらきらぼし(C メジャー、半音表記) — 休符なしの音列
export const MELODY = [
  0, 0, 7, 7, 9, 9, 7,
  5, 5, 4, 4, 2, 2, 0,
  7, 7, 5, 5, 4, 4, 2,
  7, 7, 5, 5, 4, 4, 2,
  0, 0, 7, 7, 9, 9, 7,
  5, 5, 4, 4, 2, 2, 0,
];

export function noteFreq(semi, octave = 0) {
  return 523.25 * Math.pow(2, (semi + octave * 12) / 12); // C5 基準
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.melodyPos = 0;
    this._lastNoteAt = 0;
    this._rollGain = null;
    this._rollFilter = null;
  }

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

  // ---- オルゴールの1音 ----
  tine(freq, vel = 1, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now + when;
    const v = Math.min(0.5, 0.09 + vel * 0.34);
    // 基音+きらめく倍音(オルゴールの櫛歯)
    for (const [ratio, gain, dur] of [[1, 1, 1.6], [3.03, 0.22, 0.5], [5.92, 0.08, 0.22]]) {
      const g = this.ctx.createGain();
      g.connect(this.master);
      g.gain.setValueAtTime(v * gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
    // ピンと弾くアタック
    this._tick(0.05 * vel, 2600, t);
  }

  _tick(vol, f, t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.06);
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

  // ---- メロディを1音進める(衝突・ギミック・ドミノなどすべてから呼ばれる) ----
  nextNote(vel = 0.7, minGap = 0.09) {
    if (!this.ctx || this.muted) return;
    const t = this.now;
    if (t - this._lastNoteAt < minGap) return;
    this._lastNoteAt = t;
    const semi = MELODY[this.melodyPos % MELODY.length];
    this.melodyPos++;
    this.tine(noteFreq(semi), vel);
  }

  impact(_y, speed) {
    this.nextNote(Math.min(1, speed / 6));
  }

  // ---- 転がり(お砂糖のシャラシャラ) ----
  _setupRoll() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this._rollGain = g; this._rollFilter = bp;
  }

  setRolling(speed, grounded) {
    if (!this._rollGain) return;
    const target = grounded ? Math.min(0.05, speed * 0.009) : 0;
    this._rollGain.gain.setTargetAtTime(target, this.now, 0.08);
    this._rollFilter.frequency.setTargetAtTime(1200 + speed * 260, this.now, 0.1);
  }

  // ---- ギミック効果音 ----
  clack(pitch = 900, vol = 0.28) {
    if (!this.ctx || this.muted) return;
    this._tick(vol, pitch, this.now);
    this.nextNote(0.45);
  }

  squish(active) { // ホイップリフト
    if (!this.ctx || this.muted) { if (this._sq) this.squishStop(); return; }
    if (active && !this._sq) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf();
      src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.09, this.now, 0.08);
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
      this._sq = { src, g };
    } else if (!active && this._sq) this.squishStop();
  }

  squishStop() {
    if (!this._sq) return;
    this._sq.g.gain.setTargetAtTime(0, this.now, 0.06);
    this._sq.src.stop(this.now + 0.35);
    this._sq = null;
  }

  whack() { // ハンマー
    if (!this.ctx || this.muted) return;
    const t = this.now;
    this._tick(0.5, 500, t);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.22);
    this.nextNote(0.9, 0);
  }

  whoosh(durUp = 0.35) {
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(2800, t + durUp);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durUp + 0.1);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + durUp + 0.15);
  }

  chargeTone(charge) {
    if (!this.ctx || this.muted) return;
    if (!this._chg) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      const g = this.ctx.createGain();
      g.gain.value = 0.055;
      o.connect(g); g.connect(this.master);
      o.start();
      this._chg = { o, g };
    }
    this._chg.o.frequency.setTargetAtTime(140 + charge * 420, this.now, 0.03);
  }

  chargeEnd(launch) {
    if (this._chg) {
      this._chg.g.gain.setTargetAtTime(0, this.now, 0.04);
      this._chg.o.stop(this.now + 0.3);
      this._chg = null;
    }
    if (launch) {
      this.whoosh(0.5);
      this._tick(0.45, 700, this.now); // ポン!
    }
  }

  boing() {
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.34);
  }

  splash() { // クリーム着地
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(250, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.45);
  }

  // ゴール: きらきらぼしのフルフレーズ+ベル
  fanfare() {
    if (!this.ctx || this.muted) return;
    const phrase = MELODY.slice(0, 14);
    phrase.forEach((s, i) => {
      this.tine(noteFreq(s), 0.85, i * 0.16);
      if (i % 2 === 0) this.tine(noteFreq(s, 1), 0.3, i * 0.16 + 0.02);
    });
    // 締めのベル
    this.tine(noteFreq(0, 1), 1, 14 * 0.16 + 0.1);
    this.tine(noteFreq(7), 0.8, 14 * 0.16 + 0.1);
  }

  pop() {
    if (!this.ctx || this.muted) return;
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(950, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  uiTap() { this.tine(noteFreq(7), 0.35); }
}
