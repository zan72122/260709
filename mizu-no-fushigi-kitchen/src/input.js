// みずのふしぎキッチン — タッチ入力。
// 水面をなでる → 波と水しぶき / 氷をタップ → パキッ / ゆげを払う → ふわっ。

import * as THREE from '../vendor/three.module.min.js';
import { POT_R } from './pot.js';

export class Input {
  constructor(canvas, camera, world) {
    this.canvas = canvas;
    this.camera = camera;
    this.w = world; // {pot, ice, steam, effects, audio, thermo}
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.pointers = new Map(); // id -> {x, z, t, sound}
    this.enabled = false;

    canvas.addEventListener('pointerdown', e => this._down(e));
    canvas.addEventListener('pointermove', e => this._move(e));
    canvas.addEventListener('pointerup', e => this.pointers.delete(e.pointerId));
    canvas.addEventListener('pointercancel', e => this.pointers.delete(e.pointerId));
  }

  _ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  /** 水面の高さで水平レイキャスト。円内なら {x, z} を返す */
  _waterHit() {
    this.plane.constant = -this.w.pot.surfaceY;
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    if (Math.hypot(this.hit.x, this.hit.z) > POT_R * 1.06) return null;
    return { x: this.hit.x, z: this.hit.z };
  }

  /** ゆげゾーン (なべの上空) のレイキャスト */
  _steamHit() {
    this.plane.constant = -2.2;
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    if (Math.hypot(this.hit.x, this.hit.z) > 2.0) return null;
    return { x: this.hit.x, y: 2.2, z: this.hit.z };
  }

  _down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.w.audio.unlock();
    this._ndc(e);

    // 1) 氷にあたった?
    const targets = this.w.ice.tappables();
    if (targets.length) {
      const hits = this.ray.intersectObjects(targets, false);
      if (hits.length) {
        this.w.ice.tap(hits[0].object);
        return;
      }
    }
    // 2) 水面
    const wh = this._waterHit();
    if (wh && this.w.thermo.inPot > 0.03 && this.w.thermo.ice < 0.7) {
      this.w.pot.disturb(wh.x, wh.z, 0.55, 0.16);
      this.w.effects.ripple(wh.x, wh.z, this.w.pot.surfaceY);
      this.w.effects.splash(new THREE.Vector3(wh.x, this.w.pot.surfaceY + 0.05, wh.z), 4, 0.8);
      this.w.audio.waterTouch();
      this.pointers.set(e.pointerId, { x: wh.x, z: wh.z, t: performance.now(), sound: 0 });
      return;
    }
    // 3) ゆげ
    const sh = this._steamHit();
    if (sh) {
      this.pointers.set(e.pointerId, { x: sh.x, z: sh.z, t: performance.now(), sound: 0, steam: true });
    }
  }

  _move(e) {
    if (!this.enabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this._ndc(e);
    const now = performance.now();
    const dt = Math.max(0.008, (now - p.t) / 1000);

    if (p.steam) {
      const sh = this._steamHit();
      if (!sh) return;
      const vx = (sh.x - p.x) / dt, vz = (sh.z - p.z) / dt;
      this.w.steam.blow(sh.x, 2.2, sh.z, vx * 0.28, vz * 0.28);
      if (now - p.sound > 400 && Math.hypot(vx, vz) > 1.4) {
        p.sound = now;
        this.w.audio.steamWhoosh();
      }
      p.x = sh.x; p.z = sh.z; p.t = now;
      return;
    }

    const wh = this._waterHit();
    if (!wh) return;
    const dx = wh.x - p.x, dz = wh.z - p.z;
    const speed = Math.hypot(dx, dz) / dt;
    // 指の軌跡にそって波をたてる
    const steps = Math.min(5, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 1; i <= steps; i++) {
      this.w.pot.disturb(p.x + dx * i / steps, p.z + dz * i / steps, 0.16 + Math.min(0.3, speed * 0.05), 0.13);
    }
    if (speed > 2.2 && now - p.sound > 260) {
      p.sound = now;
      this.w.effects.splash(new THREE.Vector3(wh.x, this.w.pot.surfaceY + 0.05, wh.z), 5, Math.min(1.6, speed * 0.3));
      this.w.effects.ripple(wh.x, wh.z, this.w.pot.surfaceY);
      this.w.audio.splash();
    }
    p.x = wh.x; p.z = wh.z; p.t = now;
  }
}
