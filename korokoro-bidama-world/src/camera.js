// Touch-friendly orbit camera: one finger orbits, two fingers pinch-zoom,
// idle auto-rotate, plus a marble-follow mode. Distinguishes taps from drags
// and reports taps to the game.
import * as THREE from '../vendor/three.module.min.js';

export class CamControl {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 3, 0);
    this.curTarget = this.target.clone();
    this.theta = 0.6;
    this.phi = 1.02;
    this.dist = 15;
    this.curDist = 18;
    this.baseDist = 15;
    this.vTheta = 0;
    this.vPhi = 0;
    this.idle = 0;
    this.followPos = null; // Vector3 while following
    this.onTap = null;

    this._pointers = new Map();
    this._pinchD = 0;
    this._downAt = 0;
    this._downXY = null;
    this._moved = 0;

    dom.addEventListener('pointerdown', e => this._down(e));
    dom.addEventListener('pointermove', e => this._move(e));
    dom.addEventListener('pointerup', e => this._up(e));
    dom.addEventListener('pointercancel', e => this._up(e, true));
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.08), 5, 26);
      this.idle = 0;
    }, { passive: false });
  }

  _down(e) {
    this.dom.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 1) {
      this._downAt = performance.now();
      this._downXY = { x: e.clientX, y: e.clientY };
      this._moved = 0;
    } else if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
    this.idle = 0;
  }

  _move(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this._moved += Math.abs(dx) + Math.abs(dy);
    this.idle = 0;
    if (this._pointers.size === 1) {
      const k = 4.2 / Math.max(this.dom.clientWidth, 380);
      this.vTheta = -dx * k;
      this.vPhi = -dy * k * 0.75;
      this.theta += this.vTheta;
      this.phi = THREE.MathUtils.clamp(this.phi + this.vPhi, 0.28, 1.35);
    } else if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinchD > 0) {
        this.dist = THREE.MathUtils.clamp(this.dist * (this._pinchD / d), 5, 26);
      }
      this._pinchD = d;
    }
  }

  _up(e, cancel = false) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinchD = 0;
    if (!cancel && this._pointers.size === 0 && this._downXY) {
      const dt = performance.now() - this._downAt;
      if (dt < 350 && this._moved < 12 && this.onTap) {
        this.onTap(e.clientX, e.clientY);
      }
    }
    if (this._pointers.size === 0) this._downXY = null;
  }

  setCourseView(target, dist) {
    this.target.copy(target);
    this.dist = dist;
    this.baseDist = dist;
    this.theta = 0.6;
    this.phi = 1.02;
    this.curTarget.copy(target).add(new THREE.Vector3(0, 4, 0));
    this.curDist = dist * 1.6;
    this.followPos = null;
  }

  update(dt, aspect) {
    this.idle += dt;
    // inertia decay
    if (this._pointers.size === 0) {
      this.theta += this.vTheta;
      this.phi = THREE.MathUtils.clamp(this.phi + this.vPhi, 0.28, 1.35);
      this.vTheta *= Math.pow(0.02, dt * 3);
      this.vPhi *= Math.pow(0.02, dt * 3);
      if (this.idle > 6) this.theta += dt * 0.05; // dreamy auto-orbit
    }

    const portrait = aspect < 1;
    let wantTarget = this.target;
    let wantDist = this.dist * (portrait ? 1.3 : 1);
    if (this.followPos) {
      wantTarget = this.followPos;
      wantDist = portrait ? 6.6 : 5.4;
    }
    const k = 1 - Math.pow(0.001, dt);      // smooth chase
    this.curTarget.lerp(wantTarget, k * (this.followPos ? 1.4 : 1));
    this.curDist += (wantDist - this.curDist) * k;

    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.camera.position.set(
      this.curTarget.x + this.curDist * sp * Math.cos(this.theta),
      this.curTarget.y + this.curDist * cp,
      this.curTarget.z + this.curDist * sp * Math.sin(this.theta));
    this.camera.lookAt(this.curTarget);
  }
}
