// guide.js — 3Dの手のガイド(前作踏襲)。ターゲットは平面座標で受け取り、ラップして配置。
import * as THREE from '../vendor/three.module.min.js';
import { getMaterials } from './materials.js';
import { roundedBox } from './tower.js';
import { wrapPos, wrapQuat } from './wrap.js';

export class GuideHand {
  constructor(scene) {
    const mats = getMaterials();
    this.root = new THREE.Group();

    const hand = new THREE.Group();
    const palm = new THREE.Mesh(roundedBox(0.5, 0.56, 0.2, 0.09), mats.handGlove);
    hand.add(palm);
    const index = new THREE.Mesh(roundedBox(0.16, 0.5, 0.17, 0.07), mats.handGlove);
    index.position.set(-0.13, -0.5, 0);
    hand.add(index);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(roundedBox(0.14, 0.2, 0.18, 0.06), mats.handGlove);
      f.position.set(0.04 + i * 0.145, -0.36, 0.02);
      hand.add(f);
    }
    const thumb = new THREE.Mesh(roundedBox(0.15, 0.3, 0.16, 0.06), mats.handGlove);
    thumb.position.set(0.3, -0.1, 0.04);
    thumb.rotation.z = -0.5;
    hand.add(thumb);
    const cuff = new THREE.Mesh(roundedBox(0.54, 0.2, 0.24, 0.06), mats.strawberry);
    cuff.position.set(0, 0.36, 0);
    hand.add(cuff);
    hand.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    hand.rotation.z = -0.35;
    hand.scale.setScalar(1.18);
    this.hand = hand;
    this.root.add(hand);

    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.root.add(this.ripple);

    this.root.visible = false;
    scene.add(this.root);

    this.enabled = true;
    this.target = null;
    this.t = 0;
    this._shownKey = '';
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.root.visible = false;
  }

  // target: {type:'tap'|'hold'|'release', pos:{x,y}(平面), text}
  show(target) {
    this.target = target;
    if (!this.enabled || !target) {
      this.root.visible = false;
      return;
    }
    const key = `${target.pos.x.toFixed(1)},${target.pos.y.toFixed(1)}`;
    if (!this.root.visible || key !== this._shownKey) {
      this._shownKey = key;
      wrapPos(target.pos.x, target.pos.y, 0.55, this.root.position);
      wrapQuat(target.pos.x, 0, this.root.quaternion);
      this.t = 0;
    }
    this.root.visible = true;
  }

  update(dt) {
    if (!this.root.visible || !this.target) return;
    this.t += dt;
    const type = this.target.type;
    const cyc = this.t % 1.8;
    let press = 0, rippleK = 0;

    if (type === 'tap') {
      if (cyc < 0.25) press = cyc / 0.25;
      else if (cyc < 0.45) { press = 1 - (cyc - 0.25) / 0.2; rippleK = (cyc - 0.25) / 0.55; }
      else if (cyc < 0.7) press = (cyc - 0.45) / 0.25;
      else if (cyc < 0.9) { press = 1 - (cyc - 0.7) / 0.2; rippleK = (cyc - 0.7) / 0.55; }
    } else if (type === 'hold') {
      if (cyc < 0.3) press = cyc / 0.3;
      else if (cyc < 1.4) { press = 1; rippleK = ((cyc - 0.3) % 0.55) / 0.55; }
      else press = Math.max(0, 1 - (cyc - 1.4) / 0.35);
    } else {
      press = Math.max(0, 0.6 - cyc * 0.8);
      this.hand.position.y = 0.5 + Math.sin(Math.min(1, cyc) * Math.PI) * 0.45;
    }

    if (type !== 'release') {
      this.hand.position.y = 0.62 - press * 0.42 + Math.sin(this.t * 2.2) * 0.03;
    }
    this.hand.position.x = 0.12;
    this.hand.position.z = 0.55;
    if (rippleK > 0) {
      this.ripple.scale.setScalar(0.5 + rippleK * 1.6);
      this.ripple.material.opacity = 0.75 * (1 - rippleK);
    } else {
      this.ripple.material.opacity = 0;
    }
    this.ripple.position.set(0, 0.05, 0.4);
  }
}
