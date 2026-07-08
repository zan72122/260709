// WebAudio だけで合成する、やわらかい効果音とオルゴール
import { rand, pick, clamp } from './utils.js';

const PENTA = [0, 2, 4, 7, 9]; // ペンタトニック

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.musicOn = true;
    this._musicTimer = null;
    this._noiseBuf = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    // やわらかくするためのローパス
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    this.master.connect(lp).connect(this.ctx.destination);
    // ノイズバッファ(霧吹きなど用)
    const len = this.ctx.sampleRate * 1.5;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startMusicLoop();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _ok() { return this.ctx && this.enabled; }

  // ---- 基本トーン ----
  _tone({ freq = 440, type = 'sine', dur = 0.3, vol = 0.3, attack = 0.005, sweep = 0, delay = 0, filterFreq = 0 }) {
    if (!this._ok()) return;
    const t0 = this._now() + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + sweep), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    let node = o;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq; f.Q.value = 1.4;
      o.connect(f); node = f;
    }
    node.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, vol = 0.2, freq = 4000, q = 1, type = 'bandpass', delay = 0, sweep = 0 }) {
    if (!this._ok()) return;
    const t0 = this._now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = rand(0.85, 1.2);
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // ---- ゲーム効果音 ----
  // 糸をはじく「ぴん」— 糸の長さで音程が変わる
  pluck(len01 = 0.5) {
    const base = 880 - clamp(len01, 0, 1) * 560; // 短い糸ほど高い
    this._tone({ freq: base, type: 'triangle', dur: 0.7, vol: 0.32, filterFreq: base * 3 });
    this._tone({ freq: base * 2.01, type: 'sine', dur: 0.35, vol: 0.1 });
    this._noise({ dur: 0.03, vol: 0.08, freq: 5000, q: 2 });
  }

  // ピンに触れた「こつん」
  pop() {
    this._tone({ freq: rand(520, 640), type: 'sine', dur: 0.12, vol: 0.22, sweep: 160 });
  }

  // 糸が戻る「ぼよん」
  boing() {
    this._tone({ freq: 300, type: 'triangle', dur: 0.3, vol: 0.2, sweep: -160, filterFreq: 900 });
    this._tone({ freq: 210, type: 'triangle', dur: 0.35, vol: 0.14, sweep: 80, delay: 0.06 });
  }

  // はさみ「ちょきん」
  snip() {
    this._noise({ dur: 0.05, vol: 0.22, freq: 6500, q: 3 });
    this._noise({ dur: 0.06, vol: 0.18, freq: 5200, q: 3, delay: 0.07 });
    this._tone({ freq: 1200, dur: 0.08, vol: 0.08, delay: 0.07 });
  }

  // 霧吹き「しゅっしゅ」
  spray() {
    this._noise({ dur: 0.28, vol: 0.16, freq: 7000, q: 0.8, sweep: -2500 });
  }

  // しずくが落ちる「ぴちょん」
  plip(big = false) {
    const f = big ? rand(500, 620) : rand(760, 980);
    this._tone({ freq: f, type: 'sine', dur: 0.18, vol: big ? 0.26 : 0.16, sweep: f * 0.7 });
    this._tone({ freq: f * 0.66, type: 'sine', dur: 0.14, vol: 0.08, delay: 0.05, sweep: f * 0.4 });
  }

  // 交点でしずくが「ぷるっ」
  wobble() {
    this._tone({ freq: 340, type: 'sine', dur: 0.1, vol: 0.14, sweep: 120 });
    this._tone({ freq: 430, type: 'sine', dur: 0.12, vol: 0.12, delay: 0.07, sweep: -90 });
  }

  // 色がにじむ「じわ〜」
  bloom() {
    this._noise({ dur: 0.5, vol: 0.07, freq: 1500, q: 0.6, sweep: -900, type: 'bandpass' });
    this._tone({ freq: 520, type: 'sine', dur: 0.5, vol: 0.06, sweep: 140 });
  }

  // きらきら
  sparkle() {
    for (let i = 0; i < 3; i++) {
      this._tone({ freq: rand(1400, 2600), type: 'sine', dur: 0.2, vol: 0.06, delay: i * 0.05 });
    }
  }

  // ボタン「ぽこ」
  tap() {
    this._tone({ freq: 600, type: 'sine', dur: 0.09, vol: 0.16, sweep: 220 });
  }

  // おいわいチャイム(ペンタトニックのアルペジオ)
  fanfare() {
    const root = pick([523.25, 587.33, 659.25]);
    [0, 4, 7, 12, 16].forEach((semi, i) => {
      const f = root * Math.pow(2, semi / 12);
      this._tone({ freq: f, type: 'sine', dur: 0.7, vol: 0.16, delay: i * 0.11 });
      this._tone({ freq: f * 2, type: 'sine', dur: 0.5, vol: 0.05, delay: i * 0.11 });
    });
  }

  // シャッター「かしゃ」
  shutter() {
    this._noise({ dur: 0.04, vol: 0.25, freq: 3000, q: 1.5 });
    this._tone({ freq: 1000, dur: 0.05, vol: 0.1, delay: 0.03 });
  }

  // ざぶん(リセット)
  wash() {
    this._noise({ dur: 0.7, vol: 0.14, freq: 900, q: 0.5, sweep: 1800, type: 'bandpass' });
  }

  // ---- オルゴール(まばらなペンタトニック) ----
  _startMusicLoop() {
    if (this._musicTimer) return;
    const step = () => {
      this._musicTimer = setTimeout(step, rand(1800, 4200));
      if (!this._ok() || !this.musicOn) return;
      if (document.hidden) return;
      const oct = pick([0, 0, 12]);
      const semi = pick(PENTA) + oct;
      const f = 523.25 * Math.pow(2, semi / 12);
      this._tone({ freq: f, type: 'sine', dur: 2.2, vol: 0.045 });
      this._tone({ freq: f * 3, type: 'sine', dur: 1.2, vol: 0.012 });
    };
    step();
  }
}

export const audio = new AudioEngine();
