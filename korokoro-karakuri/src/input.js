// input.js — タッチ/ポインタ入力。大きな不可視プロキシ球へのレイキャストで
// 小さな指でも確実にパーツへ届く。タップ系は押した瞬間に反応(子ども向けの即時性)。
import * as THREE from '../vendor/three.module.min.js';

export class Input {
  constructor(canvas, camera, interactives, { onMiss } = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.interactives = interactives; // ギミック(proxy を持つ)
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.active = new Map(); // pointerId -> gimmick(hold 中)
    this.enabled = false;
    this.onMiss = onMiss;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _pick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const proxies = this.interactives.filter((g) => g.proxy).map((g) => g.proxy);
    const hits = this.raycaster.intersectObjects(proxies, false);
    return hits.length ? hits[0].object.userData.gimmick : null;
  }

  _down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const g = this._pick(e);
    if (!g) { if (this.onMiss) this.onMiss(); return; }
    if (g.guideType === 'hold') {
      g.onPressStart();
      this.active.set(e.pointerId, g);
    } else if (g.onTap) {
      g.onTap();
    }
  }

  _up(e) {
    const g = this.active.get(e.pointerId);
    if (g) {
      g.onPressEnd();
      this.active.delete(e.pointerId);
    }
  }
}
