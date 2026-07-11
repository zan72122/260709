// All-procedural WebAudio (no samples). A soft toy-piano BGM plus a large
// set of hole foley: whooshes and gulps pitched by object size, wedge
// squeaks, wheel rattles, water, balloon pops, launch whistles, fanfares.
// Unlocks on first touch (iOS requirement).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._bgmStep = 0;
    this._bgmTimer = null;
    this._lastAt = {};
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
    comp.threshold.value = -16;
    this.master.connect(comp).connect(c.destination);
    this._startBgm();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _ok(tag, gap = 0) {
    if (!this.ctx || !this.enabled) return false;
    if (gap > 0) {
      const t = this._now();
      if (t - (this._lastAt[tag] || -9) < gap) return false;
      this._lastAt[tag] = t;
    }
    return true;
  }

  _tone(freq, t0, dur, type = 'sine', vol = 0.2, bendTo = null, dest = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(24, freq), t0);
    if (bendTo) o.frequency.exponentialRampToValueAtTime(Math.max(24, bendTo), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  _noise(t0, dur, { type = 'bandpass', freq = 800, q = 1, vol = 0.15, bendTo = null } = {}) {
    const c = this.ctx;
    const len = Math.max(1, c.sampleRate * dur) | 0;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (bendTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, bendTo), t0 + dur);
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
  }

  // ------------------------------------------------ hole foley
  // size: prop footprint radius (≈0.1 tiny crayon … 1.6 bed)
  _pitchOf(size) { return 620 / (0.55 + size * 1.5); }

  tap() {
    if (!this._ok('tap', 0.05)) return;
    this._tone(660, this._now(), 0.06, 'sine', 0.05, 880);
  }

  whoosh(size = 0.3) {
    if (!this._ok('whoosh', 0.05)) return;
    const t = this._now();
    this._noise(t, 0.28 + size * 0.15, { freq: 1400, bendTo: 220, q: 0.7, vol: 0.10 + size * 0.06 });
  }

  gulp(size = 0.3) {
    if (!this._ok()) return;
    const t = this._now();
    const f = this._pitchOf(size);
    // descending "doop" + lip smack: the bigger the toy, the deeper the gulp
    this._tone(f * 1.6, t, 0.16 + size * 0.1, 'triangle', 0.22, f * 0.5);
    this._tone(f * 0.8, t + 0.03, 0.22 + size * 0.12, 'sine', 0.26, f * 0.3);
    this._noise(t + 0.02, 0.08, { freq: 900, q: 2, vol: 0.08 });
    if (size > 0.7) {
      this._tone(60, t + 0.05, 0.5, 'sine', 0.3, 34);
      this._noise(t + 0.05, 0.4, { freq: 200, bendTo: 60, vol: 0.2 });
    }
  }

  grow() {
    if (!this._ok('grow', 0.12)) return;
    const t = this._now();
    this._tone(160, t, 0.28, 'sine', 0.16, 320);
    this._tone(320, t + 0.16, 0.2, 'sine', 0.1, 480);
  }

  teeter() {
    if (!this._ok('teeter', 0.25)) return;
    const t = this._now();
    this._tone(300 + Math.random() * 60, t, 0.12, 'triangle', 0.05, 240);
  }

  // ゴロン: heavy wooden roll as something tips over the rim
  tumble(size = 0.3) {
    if (!this._ok('tumble', 0.12)) return;
    const t = this._now();
    const f = 220 / (0.5 + size);
    this._tone(f, t, 0.22, 'triangle', 0.14, f * 0.6);
    this._tone(f * 0.55, t + 0.08, 0.28, 'sine', 0.12, f * 0.4);
    this._noise(t, 0.12, { freq: 500, q: 1, vol: 0.05 });
  }

  // コツン: bouncing off the shaft wall on the way down, echoey
  wallBump(size = 0.3, speed = 1) {
    if (!this._ok('bump', 0.07)) return;
    const t = this._now();
    const f = 320 / (0.5 + size);
    const vol = Math.min(0.2, 0.06 + speed * 0.03);
    this._tone(f * 1.9, t, 0.06, 'sine', vol, f * 1.2);
    this._tone(f, t, 0.16, 'triangle', vol * 0.9, f * 0.7);
    // faint echo: it's deep down there
    this._tone(f, t + 0.09, 0.18, 'sine', vol * 0.35, f * 0.6);
  }

  pinataPop() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.15, { type: 'highpass', freq: 500, vol: 0.25 });
    this._tone(180, t, 0.2, 'square', 0.1, 90);
    // party-horn rip
    for (let i = 0; i < 3; i++) {
      this._tone(520 + i * 40, t + 0.06 + i * 0.1, 0.16, 'sawtooth', 0.06, 700 + i * 60);
    }
    for (let i = 0; i < 8; i++) {
      const st = PENTA[(Math.random() * PENTA.length) | 0];
      this._tone(1040 * Math.pow(2, st / 12), t + 0.15 + i * 0.05, 0.3, 'sine', 0.07);
    }
  }

  catchJingle() {
    if (!this._ok()) return;
    const t = this._now();
    const seq = [0, 4, 7, 12];
    seq.forEach((st, i) => {
      const f = 784 * Math.pow(2, st / 12);
      this._tone(f, t + i * 0.07, 0.24, 'triangle', 0.14);
      this._tone(f * 2, t + i * 0.07, 0.14, 'sine', 0.04);
    });
  }

  piyo(low = false) {
    if (!this._ok('piyo', 0.12)) return;
    const t = this._now();
    const base = low ? 620 : 1150;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.16);
    if (low) this._tone(base * 0.8, t + 0.14, 0.1, 'sine', 0.06, base * 0.9);
  }

  peck() {
    if (!this._ok('peck', 0.2)) return;
    const t = this._now();
    this._tone(1900, t, 0.03, 'square', 0.025, 1400);
  }

  pant() {
    if (!this._ok('pant', 0.4)) return;
    const t = this._now();
    for (let i = 0; i < 3; i++) {
      this._noise(t + i * 0.16, 0.08, { freq: 1200, q: 0.8, vol: 0.05 });
    }
  }

  bark() {
    if (!this._ok('bark', 0.25)) return;
    const t = this._now();
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(340, t + i * 0.14);
      o.frequency.exponentialRampToValueAtTime(190, t + i * 0.14 + 0.09);
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.1);
      o.connect(f).connect(g).connect(this.master);
      o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.12);
    }
  }

  meow(annoyed = false) {
    if (!this._ok('meow', 0.3)) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = annoyed ? 520 : 420;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t + 0.34);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.4);
  }

  burp() {
    if (!this._ok()) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.45);
    this._noise(t, 0.3, { freq: 300, bendTo: 120, vol: 0.1 });
  }

  whee() {
    if (!this._ok('whee', 0.2)) return;
    const t = this._now();
    this._tone(500, t, 0.5, 'sine', 0.13, 1250);
    this._tone(750, t + 0.05, 0.4, 'sine', 0.05, 1700);
  }

  doorBang() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.12, { freq: 600, q: 0.7, vol: 0.24 });
    this._tone(140, t, 0.25, 'square', 0.12, 70);
    this._tone(90, t + 0.05, 0.3, 'sine', 0.18, 45);
  }

  tick() {
    if (!this._ok('tick', 0.12)) return;
    const t = this._now();
    this._tone(1500 + Math.random() * 300, t, 0.04, 'sine', 0.06, 1100);
  }

  seesaw() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(180, t, 0.12, 'triangle', 0.16, 420);   // creak-up
    this._noise(t + 0.1, 0.08, { freq: 900, q: 2, vol: 0.1 });
    this._tone(520, t + 0.12, 0.2, 'sine', 0.12, 880); // spring fling
  }

  boing(size = 0.3) {
    if (!this._ok('boing', 0.1)) return;
    const t = this._now();
    const f = 320 / (0.6 + size);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.26);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.45);
  }

  squeak() {
    if (!this._ok('squeak', 0.3)) return;
    const t = this._now();
    this._tone(900 + Math.random() * 300, t, 0.14, 'sawtooth', 0.035, 1400);
    this._tone(1200, t + 0.16, 0.12, 'sawtooth', 0.03, 800);
  }

  squeezePop(size = 0.3) {
    if (!this._ok()) return;
    const t = this._now();
    const f = this._pitchOf(size);
    this._tone(f * 0.7, t, 0.1, 'sine', 0.2, f * 2.4);      // squeeze up
    this._noise(t + 0.08, 0.06, { freq: 1600, q: 3, vol: 0.14 }); // cork!
    this._tone(f * 2.2, t + 0.1, 0.2, 'sine', 0.16, f * 0.6);
  }

  popOut(size = 0.3) {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.05, { freq: 1400, q: 2.5, vol: 0.15 });
    this.boing(size);
  }

  rattle() {
    if (!this._ok('rattle', 0.18)) return;
    const t = this._now();
    for (let i = 0; i < 3; i++) {
      this._noise(t + i * 0.05, 0.03, { freq: 2100 - i * 300, q: 4, vol: 0.075 });
      this._tone(190 + i * 25, t + i * 0.05, 0.04, 'square', 0.03);
    }
  }

  creak() {
    if (!this._ok('creak', 0.7)) return;
    const t = this._now();
    this._tone(120, t, 0.35, 'sawtooth', 0.03, 90);
    this._tone(180, t + 0.08, 0.3, 'triangle', 0.04, 140);
  }

  thud(strength = 0.5, size = 0.3) {
    if (!this._ok('thud', 0.06)) return;
    const t = this._now();
    const f = 160 / (0.5 + size);
    this._tone(f, t, 0.16 + size * 0.1, 'sine', 0.1 + strength * 0.16, f * 0.5);
    this._noise(t, 0.07, { freq: 500, q: 0.8, vol: 0.05 + strength * 0.08 });
  }

  splash(big = false) {
    if (!this._ok('splash', 0.15)) return;
    const t = this._now();
    this._noise(t, big ? 0.45 : 0.28, { freq: 1000, bendTo: 400, q: 0.6, vol: big ? 0.22 : 0.14 });
    this._tone(340, t, 0.18, 'sine', 0.08, 130);
  }

  glug() {
    if (!this._ok('glug', 0.2)) return;
    const t = this._now();
    for (let i = 0; i < 3; i++) {
      this._tone(300 - i * 60, t + i * 0.09, 0.1, 'sine', 0.12, (300 - i * 60) * 0.55);
    }
  }

  waterFill() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.8, { freq: 500, bendTo: 1500, q: 0.7, vol: 0.16 });
    for (let i = 0; i < 6; i++) {
      this._tone(280 + i * 90, t + i * 0.1, 0.14, 'sine', 0.09, (280 + i * 90) * 1.3);
    }
  }

  drain() {
    if (!this._ok()) return;
    const t = this._now();
    for (let i = 0; i < 5; i++) {
      this._tone(500 - i * 70, t + i * 0.11, 0.12, 'sine', 0.08, (500 - i * 70) * 0.6);
    }
    this._noise(t, 0.6, { freq: 900, bendTo: 250, q: 1, vol: 0.1 });
  }

  balloonPop() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.09, { type: 'highpass', freq: 700, vol: 0.3 });
    this._tone(220, t, 0.12, 'square', 0.08, 90);
    // rubber flutter
    for (let i = 0; i < 4; i++) {
      this._tone(600 + Math.random() * 500, t + 0.05 + i * 0.04, 0.05, 'sawtooth', 0.03);
    }
  }

  launch() {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(300, t, 0.45, 'sine', 0.14, 1300);
    this._noise(t, 0.3, { freq: 800, bendTo: 2400, q: 1.2, vol: 0.08 });
  }

  landBoom(strength = 1) {
    if (!this._ok()) return;
    const t = this._now();
    this._tone(90, t, 0.4, 'sine', 0.3 * strength, 40);
    this._noise(t, 0.25, { freq: 400, bendTo: 100, vol: 0.18 * strength });
    this._tone(700, t + 0.02, 0.1, 'square', 0.04);
  }

  geyser() {
    if (!this._ok()) return;
    const t = this._now();
    this._noise(t, 0.7, { freq: 700, bendTo: 2000, q: 0.8, vol: 0.2 });
    for (let i = 0; i < 5; i++) this._tone(400 + i * 130, t + i * 0.07, 0.2, 'sine', 0.07, (400 + i * 130) * 1.4);
  }

  detach() {
    if (!this._ok('detach', 0.1)) return;
    const t = this._now();
    const st = PENTA[(Math.random() * PENTA.length) | 0];
    this._tone(880 * Math.pow(2, st / 12), t, 0.2, 'sine', 0.07);
  }

  sparkle() {
    if (!this._ok('sparkle', 0.08)) return;
    const t = this._now();
    const st = PENTA[(Math.random() * PENTA.length) | 0];
    this._tone(1320 * Math.pow(2, st / 12), t, 0.4, 'sine', 0.06);
  }

  fanfare() {
    if (!this._ok()) return;
    const t = this._now();
    const seq = [0, 4, 7, 12, 7, 12, 16, 19];
    seq.forEach((st, i) => {
      const f = 523 * Math.pow(2, st / 12);
      this._tone(f, t + i * 0.14, 0.42, 'triangle', 0.15);
      this._tone(f * 2, t + i * 0.14, 0.26, 'sine', 0.05);
      this._tone(f * 0.5, t + i * 0.14, 0.4, 'sine', 0.08);
    });
    for (let i = 0; i < 14; i++) {
      this._tone(1100 + Math.random() * 1800, t + 0.9 + i * 0.06, 0.35, 'sine', 0.05);
    }
  }

  // ------------------------------------------------ BGM: lazy toy piano
  _startBgm() {
    const c = this.ctx;
    const bgm = c.createGain();
    bgm.gain.value = 0.42;
    bgm.connect(this.master);
    this._bgmGain = bgm;
    // I–vi–IV–V toybox loop, pentatonic sprinkles on top
    const bass = [0, 0, -3, -3, -7, -7, -5, -5];
    const melody = [12, 16, 14, 19, 12, 9, 14, 16, 12, 7, 9, 14, 16, 12, 9, 7];
    const step = () => {
      if (!this.ctx || !this.enabled) return;
      const t = this._now();
      const i = this._bgmStep;
      if (i % 2 === 0) {
        const b = 262 * Math.pow(2, (bass[(i / 2) % bass.length] - 12) / 12);
        this._tone(b, t, 0.9, 'sine', 0.055, null, bgm);
      }
      if (i % 2 === 0 || Math.random() < 0.6) {
        const m = 262 * Math.pow(2, melody[i % melody.length] / 12);
        this._tone(m, t, 0.7, 'triangle', 0.04, null, bgm);
        this._tone(m * 2.01, t, 0.35, 'sine', 0.012, null, bgm);
      }
      // soft brush tick
      if (i % 4 === 2) this._noise(t, 0.04, { type: 'highpass', freq: 5000, vol: 0.012 });
      this._bgmStep++;
    };
    this._bgmTimer = setInterval(step, 270);
  }
}
