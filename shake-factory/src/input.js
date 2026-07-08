// ---------------------------------------------------------------------------
// input.js — multitouch pointer routing: one finger can crank the handle
// while another drags a cup (great two-hand iPad play).
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export class Input {
  constructor(dom, camera, handle, cups) {
    this.dom = dom;
    this.camera = camera;
    this.handle = handle;
    this.cups = cups;
    this.onFirstTouch = null;

    this._handlePointer = null;               // pointerId cranking
    this._cupDrags = new Map();               // pointerId -> {cup, offset}
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this._pt = new THREE.Vector3();
    this._lastMoveT = new Map();
    this._touched = false;

    dom.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _down(e) {
    if (!this._touched) { this._touched = true; if (this.onFirstTouch) this.onFirstTouch(); }
    const x = e.clientX, y = e.clientY;

    if (this._handlePointer === null && this.handle.contains(x, y)) {
      this._handlePointer = e.pointerId;
      this.handle.startDrag(x, y);
      this._lastMoveT.set(e.pointerId, performance.now());
      this.dom.setPointerCapture?.(e.pointerId);
      return;
    }

    // try grabbing a cup
    this._ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObjects(this.cups.list.map(c => c.hitMesh), false);
    if (hits.length > 0) {
      const cup = hits[0].object.userData.cup;
      this._ray.ray.intersectPlane(this._plane, this._pt);
      this._cupDrags.set(e.pointerId, { cup, offset: cup.targetX - this._pt.x });
      this.dom.setPointerCapture?.(e.pointerId);
    }
  }

  _move(e) {
    const x = e.clientX, y = e.clientY;
    if (e.pointerId === this._handlePointer) {
      const now = performance.now();
      const last = this._lastMoveT.get(e.pointerId) ?? now;
      const dt = Math.max(0.001, (now - last) / 1000);
      this._lastMoveT.set(e.pointerId, now);
      this.handle.moveDrag(x, y, dt);
      return;
    }
    const drag = this._cupDrags.get(e.pointerId);
    if (drag) {
      this._ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      this._ray.setFromCamera(this._ndc, this.camera);
      if (this._ray.ray.intersectPlane(this._plane, this._pt)) {
        drag.cup.targetX = this._pt.x + drag.offset;
        this.cups.clampTargets();
      }
    }
  }

  _up(e) {
    if (e.pointerId === this._handlePointer) {
      this._handlePointer = null;
      this.handle.endDrag();
      this._lastMoveT.delete(e.pointerId);
    }
    this._cupDrags.delete(e.pointerId);
  }
}
