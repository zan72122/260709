// みずのふしぎキッチン — Web Audio による音 (外部アセットなし)。
// にぎやか方針: ゆかいな BGM ループ + 状態ごとの環境音 + たっぷりの効果音。

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26]; // Cペンタ2オクターブ

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmOn = true;
    this._nextBeat = 0;
    this._beat = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.bgmBus = ctx.createGain();
    this.bgmBus.gain.value = 0.32;
    this.bgmBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // --- ノイズバッファ (共用)
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03; // ブラウン寄り
      d[i] = w * 0.5 + last * 2.2;
    }

    // --- ぐつぐつ (沸騰ループ)
    this.boilGain = this._loopNoise(320, 0.9);
    // --- しゅ〜 (ゆげループ)
    this.hissGain = this._loopNoise(2400, 0.5, 'bandpass');
    // --- ぱちぱち (凍結ループは粒で鳴らすのでゲート値のみ)
    this.freezeLevel = 0;

    this._nextBeat = ctx.currentTime + 0.1;
  }

  _loopNoise(freq, q, type = 'lowpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(this.sfxBus);
    src.start();
    return gain;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  // ============================================================ 基本パーツ
  _tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.004, when = 0, slide = 0, pan = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p); node = p;
    }
    o.connect(g); node.connect(this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noise(dur, freq, { vol = 0.2, type = 'bandpass', q = 1, when = 0, slide = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  /** マリンバ風 (BGM 用) */
  _pluck(freq, when, vol = 0.16) {
    if (!this.ctx || this.muted || !this.bgmOn) return;
    const ctx = this.ctx, t0 = when;
    for (const [mult, v] of [[1, 1], [4, 0.24]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol * v, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      o.connect(g).connect(this.bgmBus);
      o.start(t0); o.stop(t0 + 0.55);
    }
  }

  // ============================================================ 効果音
  uiTap() { this._tone(660, 0.09, { vol: 0.14, type: 'triangle' }); this._tone(880, 0.1, { vol: 0.1, when: 0.04 }); }

  waterTouch() {
    const f = 380 + Math.random() * 300;
    this._tone(f, 0.16, { vol: 0.13, slide: -f * 0.4 });
    this._noise(0.12, 1500, { vol: 0.06, q: 0.8 });
  }

  splash() {
    this._noise(0.3, 900, { vol: 0.16, slide: 700, q: 0.7 });
    this._tone(300, 0.2, { vol: 0.1, slide: -140 });
  }

  bubblePop() {
    const f = 500 + Math.random() * 500;
    this._tone(f, 0.07, { vol: 0.07, slide: f * 0.7, type: 'sine' });
  }

  iceKnock() {
    this._tone(900 + Math.random() * 300, 0.06, { vol: 0.2, type: 'triangle', slide: -300 });
    this._noise(0.05, 3000, { vol: 0.1, q: 2 });
  }

  iceSplit() {
    this._noise(0.16, 2600, { vol: 0.28, q: 1.4, slide: -1200 });
    for (let i = 0; i < 4; i++) {
      this._tone(SCALE[4 + (i % 3)] * 2, 0.1, { vol: 0.1, when: 0.03 + i * 0.045, type: 'triangle' });
    }
  }

  blockKnock() {
    this._tone(180, 0.14, { vol: 0.24, type: 'triangle', slide: -60 });
    this._noise(0.08, 900, { vol: 0.14, q: 1 });
  }

  freezeCrackle() {
    for (let i = 0; i < 3; i++) {
      this._noise(0.04, 3500 + Math.random() * 2000, { vol: 0.06, q: 3, when: i * (0.05 + Math.random() * 0.08) });
    }
  }

  rainPlink() {
    const f = SCALE[3 + Math.floor(Math.random() * 5)] * 2;
    this._tone(f, 0.12, { vol: 0.08, type: 'sine', slide: -f * 0.1, pan: (Math.random() - 0.5) * 0.8 });
  }

  steamWhoosh() {
    this._noise(0.7, 1500, { vol: 0.2, type: 'bandpass', q: 0.6, slide: 2400 });
  }

  /** 状態変化ファンファーレ */
  fanfare(kind) {
    const seq = {
      frozen: [7, 5, 4, 5, 7, 7, 7],
      melted: [0, 2, 4, 5, 4, 5, 7],
      boiling: [4, 4, 5, 7, 7, 5, 7],
      steam: [2, 4, 7, 9, 9, 9, 9],
      rained: [7, 5, 4, 2, 4, 2, 0],
    }[kind] || [0, 4, 7];
    seq.forEach((n, i) => {
      const f = SCALE[n % SCALE.length] * (n >= SCALE.length ? 2 : 1);
      this._tone(f, 0.22, { vol: 0.16, when: i * 0.1, type: 'triangle' });
      this._tone(f * 2, 0.2, { vol: 0.06, when: i * 0.1 });
    });
    // しめのコード
    const when = seq.length * 0.1 + 0.06;
    for (const n of [0, 2, 4, 7]) {
      this._tone(SCALE[n] * 2, 0.7, { vol: 0.08, when, attack: 0.02 });
    }
  }

  startJingle() {
    [0, 2, 4, 7, 4, 7].forEach((n, i) => {
      this._tone(SCALE[n] * 2, 0.18, { vol: 0.14, when: i * 0.09, type: 'triangle' });
    });
  }

  // ============================================================ 毎フレーム
  update(dt, thermo) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;

    // 環境ループの音量
    const boil = thermo.boiling ? 1 : Math.max(0, (thermo.temp - 82) / 18) * 0.5;
    this.boilGain.gain.setTargetAtTime(this.muted ? 0 : boil * 0.24, ctx.currentTime, 0.3);
    const hiss = thermo.boiling ? 0.5 : (thermo.temp > 88 && thermo.water > 0.02 ? 0.2 : 0);
    this.hissGain.gain.setTargetAtTime(this.muted ? 0 : hiss * 0.14, ctx.currentTime, 0.4);

    // 凍結中はランダムにぱちぱち
    if (thermo.freezing && Math.random() < dt * 2.2) this.freezeCrackle();
    // 沸騰中はランダムにぼこっ
    if (thermo.boiling && Math.random() < dt * 5) this.bubblePop();

    // --- BGM スケジューラ (シンプルな 8 拍ループ)
    if (!this.bgmOn || this.muted) return;
    const spb = 60 / 96; // BPM96
    while (this._nextBeat < ctx.currentTime + 0.25) {
      const b = this._beat % 16;
      const bar = Math.floor(this._beat / 16) % 4;
      const t = this._nextBeat;
      // メロディ (2 小節ごとに変化)
      const mel = [
        [0, null, 4, null, 7, null, 4, null, 5, null, 4, null, 2, null, null, null],
        [0, null, 4, null, 7, null, 9, null, 7, null, 5, null, 4, null, 2, null],
        [2, null, 5, null, 7, null, 5, null, 4, null, 2, null, 0, null, null, null],
        [7, null, 5, null, 4, null, 5, null, 2, null, 4, null, 0, null, null, null],
      ][bar][b];
      if (mel != null) this._pluck(SCALE[mel % SCALE.length] * (mel >= SCALE.length ? 4 : 2), t, 0.12);
      // ベース
      if (b % 8 === 0) this._pluck(SCALE[0] / 2, t, 0.16);
      if (b % 8 === 4) this._pluck(SCALE[3] / 2, t, 0.13);
      // ころころ (ハイハット的)
      if (b % 4 === 2 && !this.mutedPerc) {
        this._noiseBgm(t);
      }
      this._beat++;
      this._nextBeat += spb / 4;
    }
  }

  _noiseBgm(t0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 2.4;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    src.connect(f).connect(g).connect(this.bgmBus);
    src.start(t0, Math.random());
    src.stop(t0 + 0.08);
  }
}
