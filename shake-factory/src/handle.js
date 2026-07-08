// ---------------------------------------------------------------------------
// handle.js — the big crank handle. Rendered in its own little viewport
// (bottom-centre in portrait, bottom-right in landscape) so it is always
// thumb-sized and never hides the machine.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PALETTE } from './colors.js';

export class Handle {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    this.camera.position.set(0, 0.6, 8.7);
    this.camera.lookAt(0, 0, 0);

    this.angle = 0;          // accumulated rotation (radians, unwrapped)
    this.omega = 0;          // angular velocity
    this.dragging = false;
    this._dragLast = 0;
    this._omegaSmooth = 0;
    this.totalTurns = 0;

    // viewport rect in CSS pixels {x, y, size} (y from top)
    this.rect = { x: 0, y: 0, size: 200 };

    this._build();

    const amb = new THREE.AmbientLight(0xfff0f0, 1.1);
    this.scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xaee4ff, 1.0);
    rim.position.set(-4, -2, 4);
    this.scene.add(rim);
  }

  _build() {
    const grp = new THREE.Group();
    this.wheel = grp;

    const rimMat = new THREE.MeshStandardMaterial({ color: PALETTE.pink2, roughness: 0.35, metalness: 0.05 });
    const hubMat = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.4 });
    const knobMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.3, metalness: 0.2 });
    const spokeMat = new THREE.MeshStandardMaterial({ color: PALETTE.mint2, roughness: 0.4 });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.34, 20, 48), rimMat);
    grp.add(rim);

    // grip bumps around the rim
    const bumpGeo = new THREE.SphereGeometry(0.17, 12, 10);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = new THREE.Mesh(bumpGeo, hubMat);
      b.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.3);
      grp.add(b);
    }

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.7, 6, 12), spokeMat);
      spoke.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
      spoke.rotation.z = a + Math.PI / 2;
      grp.add(spoke);
    }

    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), hubMat);
    hub.scale.z = 0.7;
    grp.add(hub);
    const hubDot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xff5a7e, roughness: 0.25 }));
    hubDot.position.z = 0.42;
    grp.add(hubDot);

    // crank knob — the thing you'd really grab
    const knobArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 6, 10), knobMat);
    knobArm.position.set(1.9, 0, 0.45);
    knobArm.rotation.x = Math.PI / 2;
    grp.add(knobArm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), knobMat);
    knob.position.set(1.9, 0, 0.8);
    grp.add(knob);

    grp.rotation.x = 0.32; // tilt toward the player
    this.scene.add(grp);

    // soft shadow puck behind the wheel
    const puck = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false })
    );
    puck.position.z = -0.9;
    this.scene.add(puck);
  }

  // ---- layout ---------------------------------------------------------------
  layout(w, h) {
    const portrait = h > w;
    const size = portrait
      ? Math.min(w * 0.5, h * 0.28, 320)
      : Math.min(w * 0.30, h * 0.46, 330);
    const margin = 4;
    const x = w - size - margin - 6;
    const y = h - size - margin;
    this.rect = { x, y, size };
  }

  contains(px, py) {
    const r = this.rect;
    const cx = r.x + r.size / 2, cy = r.y + r.size / 2;
    const d = Math.hypot(px - cx, py - cy);
    return d < r.size * 0.62;
  }

  _pointerAngle(px, py) {
    const r = this.rect;
    const cx = r.x + r.size / 2, cy = r.y + r.size / 2;
    return Math.atan2(-(py - cy), px - cx);
  }

  startDrag(px, py) {
    this.dragging = true;
    this._dragLast = this._pointerAngle(px, py);
    this._omegaSmooth = 0;
  }

  moveDrag(px, py, dt) {
    if (!this.dragging) return;
    const a = this._pointerAngle(px, py);
    let d = a - this._dragLast;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this._dragLast = a;
    this.angle += d;
    if (dt > 0) {
      const inst = d / dt;
      this._omegaSmooth = this._omegaSmooth * 0.7 + inst * 0.3;
    }
  }

  endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    // fling! keep spinning like a flywheel
    this.omega = THREE.MathUtils.clamp(this._omegaSmooth, -16, 16);
  }

  update(dt) {
    if (this.dragging) {
      this.omega = this._omegaSmooth;
      this._omegaSmooth *= Math.pow(0.02, dt); // decays if finger stops moving
    } else {
      this.omega *= Math.pow(0.25, dt);        // flywheel friction
      if (Math.abs(this.omega) < 0.02) this.omega = 0;
      this.angle += this.omega * dt;
    }
    this.totalTurns = Math.abs(this.angle) / (Math.PI * 2);
    this.wheel.rotation.z = this.angle;
  }

  render() {
    const r = this.rect;
    const dpr = this.renderer.getPixelRatio();
    const canvasH = this.renderer.domElement.height / dpr;
    this.renderer.clearDepth();
    this.renderer.setViewport(r.x, canvasH - r.y - r.size, r.size, r.size);
    this.renderer.setScissor(r.x, canvasH - r.y - r.size, r.size, r.size);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
  }
}
