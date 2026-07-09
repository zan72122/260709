// All-procedural WebAudio for the fairy garden: music-box BGM, pentatonic
// chimes (always harmonious no matter what a 4-year-old taps), bloom
// arpeggios, key jingles, door fanfares, firework pops, harp glissandi.
// Unlocks on first touch (iOS requirement). No samples, no network.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const BASE = 523.25; // C5

function noteHz(root, step) {
  return BASE * Math.pow(2, (root + PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length]) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._root = 0;
    this._chimeIdx = 0;
    this._windGain = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.85 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(c.destination);
    this._startWind();
    this._startBgm();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this._now(), 0.05);
  }

  setMusicRoot(root) { this._root = root; }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _ok() { return !!this.ctx && this.enabled; }

  // soft airy pad so silence never feels dead
  _startWind() {
    const c = this.ctx;
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = last * 5; }
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    this._windGain = c.createGain();
    this._windGain.gain.value = 0.05;
    src.connect(f).connect(this._windGain).connect(this.master);
    src.start();
  }

  // one struck music-box tine
  _tine(freq, t, vol = 0.16, dur = 1.4, pan = 0) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.001;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(g);
    o2.connect(g2).connect(g);
    if (p) { p.pan.value = pan; g.connect(p).connect(this.master); }
    else g.connect(this.master);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  _startBgm() {
    const patt = [0, 2, 4, 2, 5, 4, 2, 1]; // gentle lullaby arpeggio in penta steps
    const stepDur = 0.42;
    const tick = () => {
      if (!this.ctx) return;
      if (this.enabled) {
        const t = this._now() + 0.03;
        const s = patt[this._bgmStep % patt.length] + (this._bgmStep % 16 >= 8 ? 2 : 0);
        this._tine(noteHz(this._root, s), t, 0.055, 1.8, Math.sin(this._bgmStep * 0.7) * 0.4);
        if (this._bgmStep % 4 === 0) this._tine(noteHz(this._root, s) / 2, t, 0.04, 2.2, 0);
      }
      this._bgmStep += 1;
      this._bgmTimer = setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  // ---------- one-shot SFX ----------

  /** Rising pentatonic chime for taps — sequential taps make a melody. */
  chime() {
    if (!this._ok()) return;
    this._chimeIdx = (this._chimeIdx + 1) % 8;
    this._tine(noteHz(this._root, this._chimeIdx), this._now(), 0.14, 1.0, (Math.random() - 0.5) * 0.8);
  }

  /** A specific pentatonic note (flower instrument). */
  note(i) {
    if (!this._ok()) return;
    this._tine(noteHz(this._root, i), this._now(), 0.18, 1.3, (Math.random() - 0.5) * 0.6);
  }

  /** Flower bloom: quick sparkling ascending arpeggio. */
  bloom() {
    if (!this._ok()) return;
    const t = this._now();
    [0, 2, 4, 7].forEach((s, i) => this._tine(noteHz(this._root, s), t + i * 0.06, 0.13, 1.0, (i - 1.5) * 0.25));
  }

  /** Sparkle gem collected: tiny high ping. */
  gem() {
    if (!this._ok()) return;
    this._tine(noteHz(this._root, 9 + (Math.random() * 3 | 0)), this._now(), 0.09, 0.5, (Math.random() - 0.5) * 0.8);
  }

  /** Magic key appears: bright jingle. */
  keyJingle() {
    if (!this._ok()) return;
    const t = this._now();
    [7, 9, 7, 12].forEach((s, i) => this._tine(noteHz(this._root, s), t + i * 0.09, 0.15, 1.2, 0));
  }

  /** Door opening fanfare: big warm arpeggio + shimmer. */
  fanfare() {
    if (!this._ok()) return;
    const t = this._now();
    [0, 4, 7, 12, 16, 12, 16, 19].forEach((s, i) =>
      this._tine(BASE * Math.pow(2, (this._root + s) / 12), t + i * 0.11, 0.16, 1.6, Math.sin(i) * 0.5));
    this.gliss(0.5);
  }

  /** Harp glissando (rainbow spiral / celebrations). */
  gliss(delay = 0) {
    if (!this._ok()) return;
    const t = this._now() + delay;
    for (let i = 0; i < 8; i++) this._tine(noteHz(this._root, i), t + i * 0.045, 0.09, 0.9, (i / 7 - 0.5));
  }

  /** Firework: soft pop + falling shimmer. */
  firework() {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = this._now();
    // pop (filtered noise burst)
    const len = c.sampleRate * 0.2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain();
    g.gain.value = 0.22;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    // shimmer tail
    for (let i = 0; i < 5; i++) {
      this._tine(noteHz(this._root, 9 - i), t + 0.1 + i * 0.08, 0.06, 0.7, (Math.random() - 0.5));
    }
  }

  /** Friend poked: cute boing. */
  boing() {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = this._now();
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.24);
    const g = c.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.35);
  }

  /** Fairy twirl / selection: sparkling flourish. */
  twirl() {
    if (!this._ok()) return;
    const t = this._now();
    [4, 7, 9, 12, 16].forEach((s, i) => this._tine(noteHz(this._root, s), t + i * 0.05, 0.12, 0.9, Math.sin(i * 2) * 0.6));
  }
}
