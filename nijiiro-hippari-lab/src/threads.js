// 糸:張る・ゆれる・ぬれる・にじむ・交点
import * as THREE from 'three';
import { PIN_Z } from './pins.js';
import { segIntersect, clamp, lerp, mixHex } from './utils.js';

export const THICKNESS = [0.04, 0.06, 0.09]; // ほそい・ふつう・ふとい
const TUBE_SEG = 22;
const MAX_THREADS = 110;

let threadSerial = 0;

export class Thread {
  constructor(pinA, pinB, colorHex, thickIdx) {
    this.id = threadSerial++;
    this.pinA = pinA;
    this.pinB = pinB;
    this.colorHex = colorHex;
    this.thickIdx = thickIdx;
    this.radius = THICKNESS[thickIdx];
    this.zOff = 0.02 + (this.id % 14) * 0.006; // 重なりのチラつき防止
    this.tension = 0.75 + Math.random() * 0.2; // 張りぐあい
    this.wet = 0;        // 0..1 ぬれ
    this.tint = null;    // 色水でそまった色
    this.tintAmt = 0;
    this.vibAmp = 0;
    this.vibPhase = 0;
    this.dying = 0;      // はさみで消える演出
    this.geometry = null;

    const a = pinA.anchor(this.zOff), b = pinB.anchor(this.zOff);
    this.a = a; this.b = b;
    this.len = a.distanceTo(b);
    this.vibFreq = 14 - clamp(this.len / 10, 0, 1) * 7;
    // 糸とちょっと直交する向き(板の面内)
    this.perp = new THREE.Vector3(-(b.y - a.y), b.x - a.x, 0).normalize();

    this.material = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.5, metalness: 0.05,
      emissive: colorHex, emissiveIntensity: 0.16,
      transparent: true, opacity: 1,
    });
    this.mesh = new THREE.Mesh(this._buildGeo(0), this.material);
    this.mesh.castShadow = false;
    this.curve = null;
    this._updateCurve(0);
  }

  _sag() {
    // 張りがゆるい・ぬれて重いほど下にたわむ
    return this.len * (0.028 * (1.7 - this.tension) + this.wet * 0.006 + this.thickIdx * 0.004);
  }

  _updateCurve(now) {
    const mid = this.a.clone().add(this.b).multiplyScalar(0.5);
    mid.y -= this._sag();
    mid.z += 0.03;
    if (this.vibAmp > 0.002) {
      mid.addScaledVector(this.perp, Math.sin(now * this.vibFreq * Math.PI * 2 + this.vibPhase) * this.vibAmp);
    }
    this.curve = new THREE.QuadraticBezierCurve3(this.a, mid, this.b);
  }

  _buildGeo(now) {
    this._updateCurve(now);
    const geo = new THREE.TubeGeometry(this.curve, TUBE_SEG, this.radius, 6, false);
    if (this.geometry) this.geometry.dispose();
    this.geometry = geo;
    return geo;
  }

  pluck(strength = 1) {
    this.vibAmp = 0.16 * strength * (0.6 + 0.4 * Math.random());
    this.vibPhase = Math.random() * Math.PI * 2;
  }

  // 0..1 → 板ローカル座標
  pointAt(s) { return this.curve.getPoint(clamp(s, 0, 1)); }
  tangentAt(s) { return this.curve.getTangent(clamp(s, 0, 1)); }

  addWet(amount) { this.wet = clamp(this.wet + amount, 0, 1); }

  addTint(colorHex, amount) {
    this.tint = this.tint === null ? colorHex : mixHex(this.tint, colorHex, 0.5);
    this.tintAmt = clamp(this.tintAmt + amount, 0, 0.85);
  }

  tick(dt, now) {
    let needsRebuild = false;
    if (this.vibAmp > 0.002) {
      this.vibAmp *= Math.pow(0.14, dt); // 減衰
      needsRebuild = true;
      if (this.vibAmp <= 0.002) this.vibAmp = 0;
    }
    if (this.dying > 0) {
      this.dying += dt * 4;
      this.material.opacity = Math.max(0, 1 - this.dying);
      this.mesh.scale.y = Math.max(0.01, 1 - this.dying * 0.3);
    }
    // かわく(ゆっくり)
    if (this.wet > 0) this.wet = Math.max(0, this.wet - dt * 0.02);
    // 見た目へ反映
    const m = this.material;
    m.roughness = lerp(0.5, 0.07, this.wet);
    m.envMapIntensity = 1 + this.wet * 2.2;
    if (this.tintAmt > 0.001) {
      const c = mixHex(this.colorHex, this.tint, this.tintAmt);
      m.color.setHex(c);
      m.emissive.setHex(c);
    }
    if (needsRebuild) this.mesh.geometry = this._buildGeo(now);
    return this.dying < 1.2; // false で削除どき
  }

  dispose() {
    this.geometry && this.geometry.dispose();
    this.material.dispose();
  }
}

export class ThreadManager {
  constructor(parent) {
    this.parent = parent;
    this.threads = [];
    this.group = new THREE.Group();
    parent.add(this.group);
    this._dirty = true;
    this.intersections = []; // {x,y,a,b,ta,tb}
    this.onChange = null;
  }

  get count() { return this.threads.filter(t => t.dying === 0).length; }

  hasPair(pinA, pinB) {
    return this.threads.some(t => t.dying === 0 &&
      ((t.pinA === pinA && t.pinB === pinB) || (t.pinA === pinB && t.pinB === pinA)));
  }

  add(pinA, pinB, colorHex, thickIdx) {
    if (pinA === pinB) return null;
    if (this.count >= MAX_THREADS) return null;
    const existing = this.threads.find(t => t.dying === 0 &&
      ((t.pinA === pinA && t.pinB === pinB) || (t.pinA === pinB && t.pinB === pinA)));
    if (existing) { existing.pluck(1); return existing; }
    const th = new Thread(pinA, pinB, colorHex, thickIdx);
    th.pluck(1);
    this.threads.push(th);
    this.group.add(th.mesh);
    this._dirty = true;
    this.onChange && this.onChange();
    return th;
  }

  remove(thread) {
    if (!thread || thread.dying > 0) return;
    thread.dying = 0.0001;
    this._dirty = true;
    this.onChange && this.onChange();
  }

  removeLast() {
    for (let i = this.threads.length - 1; i >= 0; i--) {
      if (this.threads[i].dying === 0) { this.remove(this.threads[i]); return this.threads[i]; }
    }
    return null;
  }

  clear() {
    for (const t of this.threads) this.remove(t);
  }

  // 板ローカル2D点にいちばん近い糸
  nearestThread(pt2, maxDist = 0.55) {
    let best = null, bd = maxDist, bs = 0;
    for (const t of this.threads) {
      if (t.dying > 0) continue;
      const ax = t.a.x, ay = t.a.y, bx = t.b.x, by = t.b.y;
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy;
      let s = L2 > 0 ? ((pt2.x - ax) * dx + (pt2.y - ay) * dy) / L2 : 0;
      s = clamp(s, 0, 1);
      // たわみのぶんも考える
      const p = t.pointAt(s);
      const d = Math.hypot(p.x - pt2.x, p.y - pt2.y);
      if (d < bd) { bd = d; best = t; bs = s; }
    }
    return best ? { thread: best, s: bs, dist: bd } : null;
  }

  // 交点をまとめて計算(糸が変わったときだけ)
  getIntersections() {
    if (this._dirty) {
      this.intersections = [];
      const alive = this.threads.filter(t => t.dying === 0);
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const A = alive[i], B = alive[j];
          const hit = segIntersect(A.a.x, A.a.y, A.b.x, A.b.y, B.a.x, B.a.y, B.b.x, B.b.y);
          if (hit) this.intersections.push({ x: hit.x, y: hit.y, a: A, b: B, ta: hit.t, tb: hit.u });
        }
      }
      this._dirty = false;
    }
    return this.intersections;
  }

  // ある糸の上の交点(s順)
  crossingsOf(thread) {
    const list = [];
    for (const it of this.getIntersections()) {
      if (it.a === thread) list.push({ s: it.ta, other: it.b, x: it.x, y: it.y });
      else if (it.b === thread) list.push({ s: it.tb, other: it.a, x: it.x, y: it.y });
    }
    list.sort((p, q) => p.s - q.s);
    return list;
  }

  tick(dt, now) {
    for (let i = this.threads.length - 1; i >= 0; i--) {
      const t = this.threads[i];
      if (!t.tick(dt, now)) {
        this.group.remove(t.mesh);
        t.dispose();
        this.threads.splice(i, 1);
      }
    }
  }
}
