// input.js — タップ/長押し+空白スワイプで塔を回す。
import * as THREE from '../vendor/three.module.min.js';

export class Input {
  constructor(canvas, rig, interactives, { onPoke } = {}) {
    this.canvas = canvas;
    this.rig = rig;
    this.interactives = interactives;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.holds = new Map();   // pointerId -> gimmick
    this.swipes = new Map();  // pointerId -> {lastX, total}
    this.enabled = false;
    this.onPoke = onPoke;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
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
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const proxies = this.interactives.filter((g) => g.proxy).map((g) => g.proxy);
    const hits = this.raycaster.intersectObjects(proxies, false);
    return hits.length ? hits[0].object.userData.gimmick : null;
  }

  _down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const g = this._pick(e);
    if (g) {
      if (g.guideType === 'hold') {
        g.onPressStart();
        this.holds.set(e.pointerId, g);
      } else if (g.onTap) {
        g.onTap();
      }
      return;
    }
    // 空白: スワイプで塔を回す
    this.swipes.set(e.pointerId, { lastX: e.clientX, total: 0 });
    this.rig.dragging = true;
  }

  _move(e) {
    const s = this.swipes.get(e.pointerId);
    if (!s) return;
    const dx = e.clientX - s.lastX;
    s.lastX = e.clientX;
    s.total += Math.abs(dx);
    this.rig.addUserSpin(-dx * 0.006);
  }

  _up(e) {
    const g = this.holds.get(e.pointerId);
    if (g) {
      g.onPressEnd();
      this.holds.delete(e.pointerId);
    }
    const s = this.swipes.get(e.pointerId);
    if (s) {
      this.swipes.delete(e.pointerId);
      if (this.swipes.size === 0) this.rig.dragging = false;
      if (s.total < 10 && this.onPoke) this.onPoke();
    }
  }
}
