// タワー — the stack itself: placement, guragura sway rendering,
// toppling, and tumbling/grounded sweets.

import * as THREE from '../vendor/three.module.min.js';
import { relaxOffsets, countToppling } from './tower-core.js';

const TABLE_R = 9;
const TABLE_Y = 0;      // table top surface
const GRASS_Y = -9.2;

export class Tower {
  constructor(scene, baseY, plateR = 1.9) {
    this.scene = scene;
    this.baseY = baseY;
    this.plateR = plateR;
    this.pieces = [];      // {group,h,r,x,z,id,squash,checkpoint,phase}
    this.falling = [];     // tumbling pieces
    this.ground = [];      // resting on the table as décor
    this.honeyT = 0;       // honey glue timer (sway damping)
    this.t = 0;
    this.onGrounded = null;  // callback(pos) → thud sfx etc.
  }

  get count() { return this.pieces.length; }

  topY() {
    let y = this.baseY;
    for (const p of this.pieces) y += p.h;
    return y;
  }

  /** the surface a new sweet lands on */
  topSupport() {
    if (!this.pieces.length) {
      return { y: this.baseY, r: this.plateR, x: 0, z: 0, isPlate: true };
    }
    let x = 0, z = 0;
    for (const p of this.pieces) { x += p.x; z += p.z; }
    const top = this.pieces[this.pieces.length - 1];
    return { y: this.topY(), r: top.r, x, z, isPlate: false };
  }

  add(sweet, relX, relZ, { checkpoint = false } = {}) {
    const piece = {
      group: sweet.group, h: sweet.h, r: sweet.r, id: sweet.id,
      x: relX, z: relZ, squash: 1.0, squashV: 0, checkpoint,
      jphase: Math.random() * Math.PI * 2,
    };
    this.pieces.push(piece);
    this.scene.add(sweet.group);
    piece.squash = 0.55; // lands with a squish
    return piece;
  }

  applyHoney(seconds = 14) { this.honeyT = seconds; }

  /**
   * Remove the top `k` pieces and turn them into tumbling bodies flying
   * away from the tower axis.
   */
  topple(k) {
    const out = [];
    for (let i = 0; i < k && this.pieces.length; i++) {
      const p = this.pieces.pop();
      const ang = Math.random() * Math.PI * 2;
      const pos = p.group.position.clone();
      this.spawnFalling(p.group, pos, new THREE.Vector3(
        Math.cos(ang) * (1.6 + Math.random()), 1.8 + Math.random() * 1.2, Math.sin(ang) * (1.6 + Math.random())
      ), p);
      out.push(p);
    }
    return out;
  }

  /** any sweet (missed toss or toppled piece) starts tumbling */
  spawnFalling(group, pos, vel, meta = { h: 0.4, r: 0.6, id: '?' }) {
    group.position.copy(pos);
    if (!group.parent) this.scene.add(group);
    this.falling.push({
      group, vel: vel.clone(),
      av: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 7),
      h: meta.h, r: meta.r, bounced: 0,
    });
  }

  checkTopple() { return countToppling(this.pieces); }

  update(dt, wobble) {
    this.t += dt;
    if (this.honeyT > 0) this.honeyT -= dt;

    // offsets slowly relax toward the axis (very forgiving physics)
    relaxOffsets(this.pieces, dt);

    // ---- sway rendering
    const honeyDamp = this.honeyT > 0 ? 0.25 : 1;
    const energy = wobble.energy * honeyDamp;
    const lean = wobble.lean();
    const n = this.pieces.length;
    const idleAmp = Math.min(0.05 + n * 0.004, 0.16) * honeyDamp;

    let cy = this.baseY, cx = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pieces[i];
      cx += p.x; cz += p.z;
      const hFrac = n > 1 ? i / (n - 1) : 0;
      const bend = Math.pow(hFrac, 1.5);
      const amp = idleAmp * Math.sin(this.t * 1.3 + p.jphase) * bend
        + energy * 0.55 * bend;
      const sx = lean.x * amp + Math.sin(this.t * 1.1 + p.jphase) * idleAmp * 0.35 * bend;
      const sz = lean.z * amp + Math.cos(this.t * 0.9 + p.jphase) * idleAmp * 0.35 * bend;

      p.group.position.set(cx + sx, cy, cz + sz);
      p.group.rotation.z = -sx * 0.35;
      p.group.rotation.x = sz * 0.35;

      // squash & stretch spring back to 1
      const k = 26, c = 6.5;
      const acc = (1 - p.squash) * k - p.squashV * c;
      p.squashV += acc * dt;
      p.squash += p.squashV * dt;
      const s = Math.max(0.3, p.squash);
      p.group.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);

      cy += p.h;
    }

    // ---- tumbling pieces
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.vel.y -= 12 * dt;
      f.group.position.addScaledVector(f.vel, dt);
      f.group.rotation.x += f.av.x * dt;
      f.group.rotation.y += f.av.y * dt;
      f.group.rotation.z += f.av.z * dt;

      const horiz = Math.hypot(f.group.position.x, f.group.position.z);
      const floorY = horiz < TABLE_R ? TABLE_Y : GRASS_Y;
      if (f.group.position.y <= floorY + 0.05) {
        f.group.position.y = floorY + 0.05;
        if (f.bounced < 1 && Math.abs(f.vel.y) > 2) {
          f.vel.y = Math.abs(f.vel.y) * 0.35;
          f.vel.x *= 0.6; f.vel.z *= 0.6;
          f.av.multiplyScalar(0.5);
          f.bounced++;
          if (this.onGrounded) this.onGrounded(f.group.position, false);
        } else {
          // settle upright-ish as table décor
          f.group.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
          f.group.position.y = floorY;
          this.falling.splice(i, 1);
          this.ground.push(f.group);
          if (this.onGrounded) this.onGrounded(f.group.position, true);
          // keep the table tidy: fade out the oldest
          while (this.ground.length > 14) {
            const old = this.ground.shift();
            this.scene.remove(old);
          }
        }
      }
    }
  }

  /** wipe everything (new game) */
  reset() {
    for (const p of this.pieces) this.scene.remove(p.group);
    for (const f of this.falling) this.scene.remove(f.group);
    for (const g of this.ground) this.scene.remove(g);
    this.pieces.length = 0;
    this.falling.length = 0;
    this.ground.length = 0;
    this.honeyT = 0;
  }
}
