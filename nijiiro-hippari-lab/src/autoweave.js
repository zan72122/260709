// おまかせ:1本ずつ糸がふえて、直線から曲線が「そだつ」
import * as THREE from 'three';
import { hsl, segIntersect } from './utils.js';

// かけ算マッピング(カージオイド・ネフロイドなど)とステップ模様
const PROGRAMS = [
  { kind: 'mul', k: 2, name: 'はなびら' },
  { kind: 'step', frac: 0.42, name: 'おほしさま' },
  { kind: 'mul', k: 3, name: 'ちょうちょ' },
  { kind: 'step', frac: 0.3, name: 'かざぐるま' },
  { kind: 'mul', k: 4, name: 'クローバー' },
];

export class AutoWeaver {
  constructor({ threadMgr, pinBoard, audio, sparkles, onPraise, onEvent }) {
    this.threadMgr = threadMgr;
    this.pinBoard = pinBoard;
    this.audio = audio;
    this.sparkles = sparkles;
    this.onPraise = onPraise;
    this.onEvent = onEvent;
    this.busy = false;
    this.progIdx = 0;
    this.queue = [];
    this.timer = 0;
    this.placed = [];
    this.hueBase = Math.random() * 360;
    this.celebration = null; // {pts, idx, timer}
  }

  start(colorHex) {
    if (this.busy) { this.stop(); return; }
    const pins = this.pinBoard.pins;
    const N = pins.length;
    if (N < 6) return;
    const prog = PROGRAMS[this.progIdx % PROGRAMS.length];
    this.progIdx++;
    this.hueBase = Math.random() * 360;
    this.queue = [];
    this.placed = [];
    if (prog.kind === 'mul') {
      for (let i = 1; i < N; i++) {
        const j = (i * prog.k) % N;
        if (j !== i) this.queue.push([i, j]);
      }
    } else {
      const step = Math.max(2, Math.round(N * prog.frac));
      for (let i = 0; i < N; i++) {
        this.queue.push([i, (i + step) % N]);
      }
    }
    this.busy = true;
    this.timer = 0.1;
  }

  stop() {
    this.busy = false;
    this.queue = [];
  }

  tick(dt, now) {
    // ---- お祝い:包絡線(きょくせん)がきらきら浮かぶ ----
    if (this.celebration) {
      const c = this.celebration;
      c.timer -= dt;
      while (c.timer <= 0 && c.idx < c.pts.length) {
        const p = c.pts[c.idx++];
        this.sparkles.twinkle(new THREE.Vector3(p.x, p.y, 0.7), 0xfff6c8, 0.5, 0.9);
        if (c.idx % 4 === 0) this.audio.sparkle();
        c.timer += 0.04;
      }
      if (c.idx >= c.pts.length) this.celebration = null;
      return;
    }

    if (!this.busy) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.42;

    const pins = this.pinBoard.pins;
    let pair = null;
    while (this.queue.length) {
      const cand = this.queue.shift();
      const a = pins[cand[0]], b = pins[cand[1]];
      if (a && b && !this.threadMgr.hasPair(a, b)) { pair = cand; break; }
    }
    if (!pair) { this._finish(); return; }

    const [i, j] = pair;
    const hue = this.hueBase + (this.placed.length / Math.max(1, this.placed.length + this.queue.length)) * 200;
    const color = hsl(hue, 0.82, 0.56);
    const th = this.threadMgr.add(pins[i], pins[j], color, 0);
    if (th) {
      this.placed.push(th);
      pins[i].pulse = 1; pins[j].pulse = 1;
      this.audio.pluck(th.len / 10);
      this.sparkles.burst(pins[j].anchor(0.2), color, 5, 1.4, 0.18, 0.5);
      this.onEvent && this.onEvent('thread');
    }
    if (this.queue.length === 0) this._finish();
  }

  _finish() {
    this.busy = false;
    if (this.placed.length < 6) return;
    // となりあう糸の交点をつないで包絡線をなぞる
    const pts = [];
    for (let i = 0; i + 1 < this.placed.length; i++) {
      const A = this.placed[i], B = this.placed[i + 1];
      const hit = segIntersect(A.a.x, A.a.y, A.b.x, A.b.y, B.a.x, B.a.y, B.b.x, B.b.y);
      if (hit) pts.push(hit);
    }
    if (pts.length > 4) {
      this.celebration = { pts, idx: 0, timer: 0.35 };
    }
    this.audio.fanfare();
    this.sparkles.confetti(50);
    this.onPraise && this.onPraise('まっすぐな いとだけで まるい もようが そだったね！');
    this.onEvent && this.onEvent('autoweave');
  }
}
