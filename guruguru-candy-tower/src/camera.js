// camera.js — 塔を周回する自動追尾カメラ。スワイプで自分でも回せて、離すと追尾に戻る。
import * as THREE from '../vendor/three.module.min.js';
import { TOWER } from './layout.js';
import { phiOf, shortestArc } from './wrap.js';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
    this.phi = 0;            // 追尾方位
    this.userOffset = 0;     // スワイプによるオフセット(rad)
    this.dragging = false;
    this.dist = 30;
    this.lookY = TOWER.lookY;
    this.time = 0;
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    const halfH = TOWER.height / 2 + 1.6;
    const halfW = 7.6; // 皿+レールの張り出し
    const vfov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const dH = halfH / Math.tan(vfov);
    const dW = halfW / (Math.tan(vfov) * aspect);
    this.dist = Math.max(dH, dW) * 1.05 + 1.5;
    this.camera.updateProjectionMatrix();
  }

  addUserSpin(deltaRad) {
    this.userOffset += deltaRad;
    this.userOffset = THREE.MathUtils.clamp(this.userOffset, -Math.PI * 2, Math.PI * 2);
  }

  update(dt, targetFlatX, targetY) {
    this.time += dt;
    const targetPhi = phiOf(targetFlatX);
    this.phi += shortestArc(this.phi, targetPhi) * Math.min(1, dt * 1.8);
    if (!this.dragging) {
      this.userOffset *= Math.max(0, 1 - dt * 2.2); // ばねで戻る
    }
    const sway = Math.sin(this.time * 0.3) * 0.02;
    const a = this.phi + this.userOffset + sway;

    // 注視高さは玉へ緩やかに寄せる
    const wantY = TOWER.lookY + (targetY - TOWER.lookY) * 0.22;
    this.lookY += (wantY - this.lookY) * Math.min(1, dt * 1.5);

    this.camera.position.set(
      Math.sin(a) * this.dist,
      this.lookY + 2.6 + Math.cos(this.time * 0.26) * 0.1,
      Math.cos(a) * this.dist,
    );
    this.camera.lookAt(0, this.lookY, 0);
  }
}
