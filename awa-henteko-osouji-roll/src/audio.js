// All-procedural WebAudio: no samples. Koton/koron wooden tones as the
// sphericon hands off between cone faces, bubble pops, sparkle chimes,
// splashes, a quack, and a soft music-box loop. Unlocks on first touch (iOS).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._rollGain = null;
    this._rollFilter = null;
    this._bubbleGain = null;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._chimeIdx = 0;
    this._lastChime = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp).connect(c.destination);

    // rolling bed: filtered noise, gain driven by speed
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = last * 6; }
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    this._rollFilter = c.createBiquadFilter();
    this._rollFilter.type = 'bandpass';
    this._rollFilter.frequency.value = 300;
    this._rollFilter.Q.value = 0.8;
    this._rollGain = c.createGain();
    this._rollGain.gain.value = 0;
    src.connect(this._rollFilter).connect(this._rollGain).connect(this.master);
    src.start();

    this._startBgm();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _ok() { return this.ctx && this.enabled; }

  _tone(freq, t0, dur, type = 'sine', vol = 0.2, dest = null, bendTo = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (bendTo) o.frequency.exponentialRampToValueAtTime(bendTo, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // --- the signature "koton…koron…" as faces hand off
  koton(coneIndex, speed) {
    if (!this._ok()) return;
    const t = this._now();
    const even = coneIndex % 2 === 0;
    const base = even ? 340 : 255;                  // two alternating wooden pitches
    const jitter = 1 + (Math.random() - 0.5) * 0.05;
    const vol = Math.min(0.30, 0.08 + speed * 0.05);
    // woody knock: quick pitch-bent sine + noise tick
    this._tone(base * 2.2 * jitter, t, 0.07, 'sine', vol, null, base * 1.4);
    this._tone(base * jitter, t, 0.16, 'triangle', vol * 0.8, null, base * 0.82);
    const c = this.ctx;
    const nb = c.createBuffer(1, 800, c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < 800; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90);
    const ns = c.createBufferSource(); ns.buffer = nb;
    const nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1800;
    const ng = c.createGain(); ng.gain.value = vol * 0.5;
    ns.connect(nf).connect(ng).connect(this.master);
    ns.start(t);
  }

  rolling(speed, surface) {
    if (!this._ok() || !this._rollGain) return;
    // surface: {foam:0..1, wet:0..1}
    const g = Math.min(0.14, speed * 0.045) * (1 + (surface.foam || 0) * 0.8);
    this._rollGain.gain.setTargetAtTime(g, this._now(), 0.08);
    const f = 220 + speed * 160 + (surface.wet || 0) * 260;
    this._rollFilter.frequency.setTargetAtTime(f, this._now(), 0.1);
    // occasional bubble blips when ploughing foam
    if ((surface.foam || 0) > 0.25 && Math.random() < 0.10 * Math.min(1, speed)) {
      this.pop(0.4 + Math.random() * 0.3, 0.06);
    }
  }

  pop(size = 1, vol = 0.18) {
    if (!this._ok()) return;
    const t = this._now();
    const f0 = 900 / (0.5 + size);
    this._tone(f0, t, 0.09 + size * 0.05, 'sine', vol, null, f0 * 0.42);
  }

  bigPop() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(180, t, 0.35, 'sine', 0.4, null, 70);
    this._tone(420, t, 0.12, 'square', 0.10, null, 200);
    // sparkle shower
    for (let i = 0; i < 6; i++) {
      const st = PENTA[(Math.random() * PENTA.length) | 0];
      this._tone(880 * Math.pow(2, st / 12), t + 0.06 + i * 0.07, 0.5, 'sine', 0.10);
    }
  }

  chime() {
    if (!this._ok()) return;
    const t = this._now();
    if (t - this._lastChime < 0.07) return;
    this._lastChime = t;
    const st = PENTA[this._chimeIdx % PENTA.length];
    this._chimeIdx++;
    const f = 1040 * Math.pow(2, st / 12);
    this._tone(f, t, 0.55, 'sine', 0.11);
    this._tone(f * 2.01, t, 0.3, 'sine', 0.03);
  }

  bloom() {
    if (!this._ok()) return;
    const t = this._now();
    const st = PENTA[(Math.random() * 5) | 0];
    const f = 660 * Math.pow(2, st / 12);
    this._tone(f * 0.5, t, 0.18, 'triangle', 0.12, null, f * 0.62);
    this._tone(f, t + 0.05, 0.6, 'sine', 0.12);
  }

  splash() {
    if (!this._ok()) return;
    const c = this.ctx, t = this._now();
    const nb = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nd.length * 0.4));
    const ns = c.createBufferSource(); ns.buffer = nb;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.6;
    const ng = c.createGain(); ng.gain.value = 0.16;
    ns.connect(nf).connect(ng).connect(this.master);
    ns.start(t);
    this._tone(300, t, 0.2, 'sine', 0.08, null, 140);
  }

  quack() {
    if (!this._ok()) return;
    const t = this._now();
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(310, t);
    o.frequency.exponentialRampToValueAtTime(210, t + 0.14);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  giggleHop() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(520, t, 0.1, 'sine', 0.14, null, 780);
    this._tone(660, t + 0.09, 0.12, 'sine', 0.12, null, 990);
  }

  fanfare() {
    if (!this._ok()) return;
    const t = this._now();
    const seq = [0, 4, 7, 12, 7, 12, 16];
    seq.forEach((st, i) => {
      const f = 523 * Math.pow(2, st / 12);
      this._tone(f, t + i * 0.13, 0.4, 'triangle', 0.16);
      this._tone(f * 2, t + i * 0.13, 0.25, 'sine', 0.05);
    });
    for (let i = 0; i < 10; i++) {
      this._tone(1200 + Math.random() * 1600, t + 0.6 + i * 0.06, 0.3, 'sine', 0.05);
    }
  }

  // --- gentle music-box BGM, 8-step pentatonic pattern
  _startBgm() {
    const c = this.ctx;
    const bgmGain = c.createGain();
    bgmGain.gain.value = 0.5;
    bgmGain.connect(this.master);
    this._bgmGain = bgmGain;
    const pattern = [0, 4, 7, 4, 9, 7, 12, 7, 2, 4, 7, 4, 9, 12, 9, 7];
    const step = () => {
      if (!this.ctx) return;
      const t = this._now();
      const st = pattern[this._bgmStep % pattern.length];
      if (this._bgmStep % 2 === 0 || Math.random() < 0.7) {
        const f = 523 * Math.pow(2, (st - 12) / 12);
        this._tone(f * 2, t, 1.1, 'sine', 0.045, bgmGain);
        this._tone(f * 4.02, t, 0.5, 'sine', 0.012, bgmGain);
      }
      if (this._bgmStep % 8 === 0) {
        const f = 523 * Math.pow(2, (st - 24) / 12);
        this._tone(f, t, 1.6, 'sine', 0.05, bgmGain);
      }
      this._bgmStep++;
    };
    this._bgmTimer = setInterval(step, 430);
  }
}
