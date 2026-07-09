// WebAudio: all sounds are synthesised (no assets). Gentle toy-like timbres
// for small ears — music-box background, pentatonic chimes, soft pops.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 D5 E5 G5 A5 C6

export class KidAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.musicGain = null;
    this._clackAt = 0;
    this._chimeAt = 0;
    this._musicTimer = 0;
    this._musicStep = 0;
    this.musicOn = true;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  _env(gain, t0, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  _bell(freq, t0, peak = 0.3, dur = 0.9, dest = null) {
    const ctx = this.ctx;
    const out = dest || this.master;
    for (const [mult, amp, dd] of [[1, 1, dur], [2.76, 0.35, dur * 0.5], [5.4, 0.12, dur * 0.25]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      this._env(g, t0, 0.005, peak * amp, dd);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dd + 0.1);
    }
  }

  chime(i, power = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._chimeAt < 0.035) return;
    this._chimeAt = now;
    const f = PENTA[Math.max(0, Math.min(PENTA.length - 1, i))];
    this._bell(f, now, Math.min(0.34, 0.16 + power * 0.05), 1.0);
  }

  clack(power = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this._clackAt < 0.05) return;
    this._clackAt = now;
    const ctx = this.ctx;
    const len = 0.05;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900 + Math.random() * 900;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = Math.min(0.16, 0.05 + power * 0.02);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  pop() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, now);
    o.frequency.exponentialRampToValueAtTime(140, now + 0.09);
    const g = ctx.createGain();
    this._env(g, now, 0.004, 0.22, 0.1);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.14);
  }

  bumper() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(190, now + 0.16);
    const g = ctx.createGain();
    this._env(g, now, 0.005, 0.3, 0.18);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.22);
  }

  boost() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const len = 0.35;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.exponentialRampToValueAtTime(2600, now + len);
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.value = 0.28;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  goal(count) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const base = PENTA[count % 3 + 2];
    this._bell(base, now, 0.3, 0.7);
    this._bell(base * 1.5, now + 0.07, 0.2, 0.6);
  }

  warp() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, now);
    o.frequency.exponentialRampToValueAtTime(1500, now + 0.3);
    const g = ctx.createGain();
    this._env(g, now, 0.01, 0.14, 0.32);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.4);
  }

  fanfare() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 2, 4, 5, 5].forEach((n, i) => {
      this._bell(PENTA[n % PENTA.length] * (i === 4 ? 2 : 1), now + i * 0.12, 0.3, 0.8);
    });
  }

  spinnerWhir() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, now);
    o.frequency.exponentialRampToValueAtTime(520, now + 0.25);
    const g = ctx.createGain();
    this._env(g, now, 0.02, 0.14, 0.3);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.36);
  }

  // gentle music-box loop, one note at a time
  tickMusic(dt) {
    if (!this.ctx || this.muted || !this.musicOn) return;
    this._musicTimer -= dt;
    if (this._musicTimer > 0) return;
    this._musicTimer = 0.62;
    const pattern = [0, 2, 4, 2, 3, 5, 4, 2, 0, 2, 4, 5, 3, 2, 1, 2];
    const n = pattern[this._musicStep % pattern.length];
    this._musicStep++;
    const oct = this._musicStep % 32 >= 16 ? 1 : 0.5;
    this._bell(PENTA[n] * oct, this.ctx.currentTime, 0.12, 1.4, this.musicGain);
  }
}
