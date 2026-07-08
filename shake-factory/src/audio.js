// ---------------------------------------------------------------------------
// audio.js — all sounds are synthesized with WebAudio (no asset files).
// ---------------------------------------------------------------------------

export class AudioBox {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noiseBuf = null;
    this._spillGain = null;
    this._shakaGain = null;
    this._lastTick = 0;
  }

  // must be called from a user gesture (iOS)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // shared white-noise buffer
    const len = this.ctx.sampleRate * 1.2;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._makeSpillLoop();
    this._makeShakaLoop();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _osc(type, freq, t0, dur, peak, freqEnd = null, dest = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    this._env(g, t0, peak, 0.006, dur);
    o.connect(g).connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noise(t0, dur, peak, filterFreq, q = 1, type = 'bandpass') {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, peak, 0.004, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // -- handle tick (soft ratchet click) --------------------------------------
  tick(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this._lastTick < 0.03) return;
    this._lastTick = t;
    this._noise(t, 0.03, 0.05 * strength, 2400 + Math.random() * 800, 2);
    this._osc('sine', 1500 + Math.random() * 300, t, 0.035, 0.03 * strength, 900);
  }

  // -- marble drops out of the nozzle ----------------------------------------
  release() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('triangle', 520, t, 0.08, 0.05, 300);
  }

  // -- marble lands in a cup: musical pentatonic plink by fill level ---------
  plink(level = 0) {
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];
    const idx = Math.min(scale.length - 1, Math.floor(level * scale.length));
    const f = scale[idx] * (1 + (Math.random() - 0.5) * 0.01);
    const t = this.ctx.currentTime;
    this._osc('sine', f, t, 0.35, 0.16);
    this._osc('sine', f * 2, t, 0.18, 0.05);
    this._osc('triangle', f * 3.01, t, 0.08, 0.02);
  }

  // -- marble bounces on something -------------------------------------------
  clack(vel = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = Math.min(0.06, 0.015 * vel);
    this._noise(t, 0.025, p, 3200 + Math.random() * 1500, 1.5);
    this._osc('sine', 700 + Math.random() * 500, t, 0.04, p * 0.8, 400);
  }

  // -- syrup droplet ----------------------------------------------------------
  plip() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 1400 + Math.random() * 600, t, 0.07, 0.035, 500);
  }

  // -- splash into pond --------------------------------------------------------
  splash(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, big ? 0.35 : 0.16, big ? 0.14 : 0.07, 900 + Math.random() * 500, 0.8, 'lowpass');
    this._osc('sine', 300, t, 0.12, 0.05, 120);
    if (big) this._noise(t + 0.08, 0.2, 0.06, 1800, 1.2);
  }

  // -- cup full "pon!" ----------------------------------------------------------
  pon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 350, t, 0.22, 0.22, 700);
    this._osc('sine', 1050, t + 0.02, 0.15, 0.08, 1400);
  }

  // -- goal complete jingle -------------------------------------------------
  jingle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._osc('sine', f, t + i * 0.11, 0.4, 0.14);
      this._osc('triangle', f * 2, t + i * 0.11, 0.2, 0.04);
    });
    this._noise(t + 0.45, 0.5, 0.05, 6000, 1);
  }

  // -- shake-shake burst -------------------------------------------------------
  shaka() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      this._noise(t + i * 0.05, 0.045, 0.08, 2000 + i * 700, 2.5);
    }
    this._osc('sine', 800, t + 0.25, 0.25, 0.1, 1600);
  }

  // -- continuous loops: spill gurgle + rod whoosh ---------------------------
  _makeSpillLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 1.4;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 6.5;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 350;
    lfo.connect(lfoGain).connect(f.frequency);
    this._spillGain = this.ctx.createGain();
    this._spillGain.gain.value = 0;
    src.connect(f).connect(this._spillGain).connect(this.master);
    src.start(); lfo.start();
  }

  _makeShakaLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    src.playbackRate.value = 0.85;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9;
    this._shakaGain = this.ctx.createGain();
    this._shakaGain.gain.value = 0;
    src.connect(f).connect(this._shakaGain).connect(this.master);
    src.start();
  }

  // called each frame
  update(dt, rodSpeed, spillAmount) {
    if (!this.ctx) return;
    const target = Math.min(0.09, rodSpeed * 0.012);
    const g = this._shakaGain.gain;
    g.value += (target - g.value) * Math.min(1, dt * 10);
    const sTarget = Math.min(0.1, spillAmount * 0.1);
    const sg = this._spillGain.gain;
    sg.value += (sTarget - sg.value) * Math.min(1, dt * 6);
  }
}
