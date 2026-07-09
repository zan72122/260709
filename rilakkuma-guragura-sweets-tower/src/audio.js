// おとエンジン — everything is synthesised with WebAudio; no audio assets.
// A gentle waltz BGM loop + a pile of toy-box sound effects.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// note names for readability
const N = { C3: 48, F3: 53, G3: 55, A2: 45, F2: 41, G2: 43, C4: 60, E4: 64, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, C6: 84 };

// 8-bar waltz: [bassRoot, [chord tones], [melody quarters x3 (null = rest)]]
const SONG = [
  [N.C3, [N.E4, N.G4], [N.C5, N.E5, N.G5]],
  [N.A2, [N.C4, N.E4], [N.A5, N.G5, N.E5]],
  [N.F2, [N.A4, N.C5], [N.F5, N.A5, N.G5]],
  [N.G2, [N.B4, N.D5], [N.D5, N.E5, N.D5]],
  [N.C3, [N.E4, N.G4], [N.C5, N.G4, N.E5]],
  [N.F2, [N.A4, N.C5], [N.F5, N.C5, N.A5]],
  [N.G2, [N.B4, N.D5], [N.G5, N.F5, N.D5]],
  [N.C3, [N.E4, N.G4], [N.C5, null, N.G5]],
];
const BEAT = 0.42; // seconds per beat (waltz quarter)

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.muted = localStorage.getItem('rk-tower-mute') === '1';
    this._bgmTimer = null;
    this._songPos = 0;
    this._nextBarTime = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.75;
    this.bgmGain.connect(this.master);
    // soft noise buffer for percussion / whoosh
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('rk-tower-mute', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  // ------------------------------------------------------------ helpers

  tone({ f = 440, f1 = null, t = 0, d = 0.2, type = 'sine', g = 0.12, dest = null, bendT = null }) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + t;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + (bendT ?? d));
    gn.gain.setValueAtTime(0.0001, at);
    gn.gain.exponentialRampToValueAtTime(g, at + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(gn).connect(dest || this.master);
    o.start(at);
    o.stop(at + d + 0.05);
  }

  noise({ t = 0, d = 0.15, g = 0.1, hp = 2000 }) {
    if (!this.ctx) return;
    const at = this.ctx.currentTime + t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = hp;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(g, at);
    gn.gain.exponentialRampToValueAtTime(0.0001, at + d);
    src.connect(flt).connect(gn).connect(this.master);
    src.start(at);
    src.stop(at + d + 0.05);
  }

  // ------------------------------------------------------------ sfx

  click() { this.tone({ f: 660, f1: 880, d: 0.08, type: 'square', g: 0.05 }); }

  launch() {
    this.tone({ f: 240, f1: 900, d: 0.28, type: 'sine', g: 0.14 });
    this.noise({ d: 0.18, g: 0.05, hp: 3200 });
  }

  landGood() {
    this.tone({ f: 300, f1: 180, d: 0.14, type: 'sine', g: 0.16 });
    this.tone({ f: 520, d: 0.1, t: 0.02, type: 'triangle', g: 0.07 });
  }

  landPerfect(combo = 1) {
    const base = 72 + Math.min(combo - 1, 6) * 2; // rises with combo
    [0, 4, 7, 12].forEach((iv, i) =>
      this.tone({ f: midi(base + iv), t: i * 0.06, d: 0.22, type: 'triangle', g: 0.12 }));
    this.noise({ d: 0.3, g: 0.03, hp: 6000 });
  }

  landEdge() {
    this.tone({ f: 220, f1: 140, d: 0.3, type: 'sawtooth', g: 0.06 });
    this.tone({ f: 330, f1: 300, t: 0.1, d: 0.25, type: 'sine', g: 0.08 });
  }

  wobbleAlarm() {
    this.tone({ f: 392, f1: 370, d: 0.16, type: 'square', g: 0.05 });
    this.tone({ f: 392, f1: 370, t: 0.2, d: 0.16, type: 'square', g: 0.05 });
  }

  fallWhistle() {
    this.tone({ f: 1200, f1: 220, d: 0.55, type: 'sine', g: 0.1 });
  }

  thud() {
    this.tone({ f: 120, f1: 60, d: 0.22, type: 'sine', g: 0.2 });
    this.noise({ d: 0.12, g: 0.08, hp: 400 });
  }

  birdTweet() {
    this.tone({ f: 1600, f1: 2200, d: 0.09, type: 'sine', g: 0.09 });
    this.tone({ f: 1900, f1: 1400, t: 0.11, d: 0.1, type: 'sine', g: 0.09 });
  }

  steadyTap() {
    this.tone({ f: 500 + Math.random() * 200, f1: 900, d: 0.07, type: 'triangle', g: 0.1 });
  }

  calmChime() {
    [72, 76, 79].forEach((n, i) => this.tone({ f: midi(n), t: i * 0.09, d: 0.4, type: 'sine', g: 0.09 }));
  }

  honey() {
    [60, 64, 67, 72].forEach((n, i) => this.tone({ f: midi(n), t: i * 0.05, d: 0.3, type: 'sine', g: 0.08 }));
  }

  fanfare() {
    const seq = [[72, 0], [72, 0.12], [72, 0.24], [76, 0.36], [79, 0.6], [84, 0.84]];
    for (const [n, t] of seq) {
      this.tone({ f: midi(n), t, d: 0.28, type: 'square', g: 0.06 });
      this.tone({ f: midi(n - 12), t, d: 0.28, type: 'triangle', g: 0.08 });
    }
    this.noise({ t: 0.84, d: 0.5, g: 0.04, hp: 5000 });
  }

  finishJingle() {
    const seq = [[79, 0], [76, 0.15], [72, 0.3], [76, 0.45], [79, 0.6], [84, 0.75]];
    for (const [n, t] of seq) this.tone({ f: midi(n), t, d: 0.4, type: 'triangle', g: 0.1 });
    [48, 52, 55, 60].forEach(n => this.tone({ f: midi(n), t: 0.95, d: 1.2, type: 'sine', g: 0.07 }));
  }

  // ------------------------------------------------------------ BGM

  startBGM() {
    if (!this.ctx || this._bgmTimer) return;
    this._songPos = 0;
    this._nextBarTime = this.ctx.currentTime + 0.1;
    this._bgmTimer = setInterval(() => this._scheduleBGM(), 120);
  }

  stopBGM() {
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
  }

  _scheduleBGM() {
    if (!this.ctx) return;
    const ahead = this.ctx.currentTime + 0.5;
    while (this._nextBarTime < ahead) {
      const bar = SONG[this._songPos % SONG.length];
      const t0 = this._nextBarTime - this.ctx.currentTime;
      const [bass, chord, mel] = bar;
      // bass on 1
      this.tone({ f: midi(bass), t: t0, d: BEAT * 0.9, type: 'sine', g: 0.09, dest: this.bgmGain });
      // chords on 2 & 3
      for (const beat of [1, 2])
        for (const cn of chord)
          this.tone({ f: midi(cn), t: t0 + beat * BEAT, d: BEAT * 0.55, type: 'sine', g: 0.028, dest: this.bgmGain });
      // melody quarters
      mel.forEach((mn, i) => {
        if (mn !== null)
          this.tone({ f: midi(mn), t: t0 + i * BEAT, d: BEAT * 0.92, type: 'triangle', g: 0.05, dest: this.bgmGain });
      });
      this._nextBarTime += BEAT * 3;
      this._songPos++;
    }
  }
}
