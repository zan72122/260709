// camera.js — 縦/横どちらでも装置全体が美しく収まる自動フレーミング+玉へのゆるやか追従
import * as THREE from '../vendor/three.module.min.js';
import { MACHINE_BOUNDS } from './layout.js';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.baseTarget = new THREE.Vector3(MACHINE_BOUNDS.centerX, MACHINE_BOUNDS.centerY, 0);
    this.target = this.baseTarget.clone();
    this.follow = new THREE.Vector3();
    this.dist = 30;
    this.time = 0;
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    const halfH = (MACHINE_BOUNDS.maxY - MACHINE_BOUNDS.minY) / 2 + 0.35;
    const halfW = (MACHINE_BOUNDS.maxX - MACHINE_BOUNDS.minX) / 2 + 0.35;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const dH = halfH / Math.tan(vfov);
    const dW = halfW / (Math.tan(vfov) * aspect);
    this.dist = Math.max(dH, dW) * 1.04 + 1.2;
    this.camera.updateProjectionMatrix();
  }

  update(dt, ballPos) {
    this.time += dt;
    // 玉の方向へほんの少し寄る(酔わない程度のパララックス)
    const fx = THREE.MathUtils.clamp((ballPos.x - this.baseTarget.x) * 0.14, -0.7, 0.7);
    const fy = THREE.MathUtils.clamp((ballPos.y - this.baseTarget.y) * 0.12, -0.9, 0.9);
    this.follow.x += (fx - this.follow.x) * Math.min(1, dt * 1.6);
    this.follow.y += (fy - this.follow.y) * Math.min(1, dt * 1.6);

    const sway = Math.sin(this.time * 0.32) * 0.18;
    const bob = Math.cos(this.time * 0.27) * 0.1;

    this.target.set(
      this.baseTarget.x + this.follow.x,
      this.baseTarget.y + this.follow.y,
      0,
    );
    this.camera.position.set(
      this.target.x + 0.35 + sway,
      this.target.y + 1.7 + bob,
      this.dist,
    );
    this.camera.lookAt(this.target);
  }
}
