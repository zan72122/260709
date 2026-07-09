// Friend characters that pop out of each opened door and join the fairy's
// parade: a butterfly, a hopping bunny, a star-child and a rainbow bird.
// All follow the fairy in a happy conga line and react when poked.

import * as THREE from '../vendor/three.module.min.js';
import { glowTexture, starGeometry } from './fairy.js';

class FriendBase {
  constructor() {
    this.group = new THREE.Group();
    this.seed = Math.random() * 100;
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.pokeT = -10;
    this._tmp = new THREE.Vector3();
  }
  poke(t) { this.pokeT = t; }
  follow(dt, target, stiff = 4.5) {
    this._tmp.subVectors(target, this.pos);
    this.vel.addScaledVector(this._tmp, dt * stiff);
    this.vel.multiplyScalar(Math.pow(0.1, dt));
    this.pos.addScaledVector(this.vel, dt);
  }
  faceVel(dt) {
    if (this.vel.lengthSq() > 0.2) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.y += d * Math.min(1, dt * 5);
    }
  }
  pokeScale(t) {
    const pk = t - this.pokeT;
    if (pk < 0.6) {
      const s = 1 + Math.sin(pk * 16) * 0.3 * (1 - pk / 0.6);
      this.group.scale.setScalar(s);
    } else this.group.scale.setScalar(1);
  }
}

export class Butterfly extends FriendBase {
  constructor(color = 0xff9ddb) {
    super();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a6e, roughness: 0.6 }));
    body.rotation.x = Math.PI / 2;
    this.group.add(body);
    const wmat = new THREE.MeshStandardMaterial({
      color, roughness: 0.4, emissive: color, emissiveIntensity: 0.35,
      side: THREE.DoubleSide, transparent: true, opacity: 0.95,
    });
    this.wings = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), wmat);
      w1.position.set(sx * 0.14, 0.02, 0.04);
      w1.rotation.x = -Math.PI / 2;
      const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), wmat);
      w2.position.set(sx * 0.1, 0.02, -0.1);
      w2.rotation.x = -Math.PI / 2;
      pivot.add(w1, w2);
      this.group.add(pivot);
      this.wings.push({ pivot, sx });
    }
  }
  update(dt, t, target) {
    this._tmp.copy(target);
    this._tmp.x += Math.sin(t * 1.3 + this.seed) * 0.7;
    this._tmp.y += 0.6 + Math.sin(t * 2.1 + this.seed) * 0.4;
    this._tmp.z += Math.cos(t * 1.1 + this.seed) * 0.7;
    this.follow(dt, this._tmp, 5);
    this.faceVel(dt);
    for (const w of this.wings) w.pivot.rotation.z = w.sx * Math.sin(t * 16 + this.seed) * 0.85;
    this.pokeScale(t);
  }
}

export class Bunny extends FriendBase {
  constructor() {
    super();
    const fur = new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.85 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xffb8cd, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), fur);
    body.scale.set(1, 0.9, 1.15);
    body.position.y = 0.2;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), fur);
    head.position.set(0, 0.44, 0.1);
    this.group.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), fur);
      ear.position.set(sx * 0.07, 0.68, 0.06);
      ear.rotation.z = sx * -0.18;
      this.group.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.14, 4, 6), pink);
      inner.position.set(sx * 0.07, 0.68, 0.09);
      inner.rotation.z = sx * -0.18;
      this.group.add(inner);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40312e }));
      eye.position.set(sx * 0.07, 0.47, 0.24);
      this.group.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), pink);
    nose.position.set(0, 0.42, 0.26);
    this.group.add(nose);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fur);
    tail.position.set(0, 0.2, -0.26);
    this.group.add(tail);
    this.hopPhase = Math.random() * 10;
  }
  update(dt, t, target) {
    this._tmp.copy(target);
    this._tmp.y = 0;
    this.follow(dt, this._tmp, 3.2);
    this.faceVel(dt);
    // hop when moving
    const speed = Math.min(1, this.vel.length() * 0.4);
    this.hopPhase += dt * (3 + speed * 7);
    this.pos.y = Math.abs(Math.sin(this.hopPhase)) * 0.28 * (0.25 + speed * 0.75);
    this.pokeScale(t);
  }
}

export class StarChild extends FriendBase {
  constructor() {
    super();
    const star = new THREE.Mesh(starGeometry(0.26, 0.12, 0.1), new THREE.MeshStandardMaterial({
      color: 0xffe680, emissive: 0xffd45e, emissiveIntensity: 1.0, roughness: 0.3,
    }));
    star.geometry.center();
    this.group.add(star);
    this.star = star;
    // little face on the star
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x6b4a20 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
      eye.position.set(sx * 0.07, 0.02, 0.06);
      star.add(eye);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI * 0.8), eyeMat);
    smile.position.set(0, -0.03, 0.06);
    smile.rotation.z = Math.PI + Math.PI * 0.1;
    star.add(smile);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xfff3a8, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(1.1);
    this.group.add(halo);
    this.halo = halo;
  }
  update(dt, t, target) {
    this._tmp.copy(target);
    this._tmp.y += 0.9 + Math.sin(t * 1.8 + this.seed) * 0.35;
    this._tmp.x += Math.cos(t * 0.9 + this.seed) * 0.5;
    this.follow(dt, this._tmp, 4);
    this.star.rotation.z = Math.sin(t * 2 + this.seed) * 0.4;
    this.halo.material.opacity = 0.5 + 0.3 * Math.sin(t * 4 + this.seed);
    this.pokeScale(t);
  }
}

export class RainbowBird extends FriendBase {
  constructor() {
    super();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8fd0ff, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), bodyMat);
    body.scale.set(0.9, 0.95, 1.2);
    this.group.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfffdf0, roughness: 0.7 }));
    belly.position.set(0, -0.04, 0.08);
    this.group.add(belly);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xffbb55, roughness: 0.5 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.02, 0.24);
    this.group.add(beak);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40312e }));
      eye.position.set(sx * 0.08, 0.07, 0.17);
      this.group.add(eye);
    }
    // rainbow tail feathers
    const tailCols = [0xff6d9d, 0xffbb33, 0xffe14f, 0x7fdd6f, 0x5fb8ff];
    tailCols.forEach((c, i) => {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 6), new THREE.MeshStandardMaterial({
        color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.3,
      }));
      const a = (i - 2) * 0.3;
      f.position.set(Math.sin(a) * 0.12, 0.02 + Math.cos(a) * 0.02, -0.26);
      f.rotation.x = -1.9;
      f.rotation.z = a;
      this.group.add(f);
    });
    // wings
    this.wings = [];
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x6db9ff, roughness: 0.55, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), wingMat);
      w.scale.set(1.4, 0.7, 1);
      w.position.x = sx * 0.18;
      pivot.add(w);
      pivot.position.set(0, 0.04, 0);
      this.group.add(pivot);
      this.wings.push({ pivot, sx });
    }
  }
  update(dt, t, target) {
    this._tmp.copy(target);
    this._tmp.y += 0.7 + Math.sin(t * 1.5 + this.seed) * 0.3;
    this._tmp.x += Math.sin(t * 0.8 + this.seed) * 0.6;
    this.follow(dt, this._tmp, 4.5);
    this.faceVel(dt);
    for (const w of this.wings) w.pivot.rotation.z = w.sx * (0.3 + Math.sin(t * 13 + this.seed) * 0.7);
    this.pokeScale(t);
  }
}

const FACTORY = {
  butterfly: () => new Butterfly(),
  bunny: () => new Bunny(),
  star: () => new StarChild(),
  bird: () => new RainbowBird(),
};

/** Manages the conga line of unlocked friends behind the fairy. */
export class FriendManager {
  constructor(scene) {
    this.scene = scene;
    this.friends = [];
    this._t = new THREE.Vector3();
  }

  add(kind, pos) {
    const f = FACTORY[kind] ? FACTORY[kind]() : new Butterfly();
    f.kind = kind;
    f.pos.copy(pos);
    this.scene.add(f.group);
    this.friends.push(f);
    // an extra butterfly buddy for the first friend keeps the garden lively
    return f;
  }

  clear() {
    for (const f of this.friends) this.scene.remove(f.group);
    this.friends.length = 0;
  }

  friendOf(obj) {
    for (const f of this.friends) {
      let o = obj;
      while (o) { if (o === f.group) return f; o = o.parent; }
    }
    return null;
  }

  update(dt, t, fairyPos, fairyHeading) {
    for (let i = 0; i < this.friends.length; i++) {
      const f = this.friends[i];
      // trail behind the fairy, fanned out
      const back = fairyHeading + Math.PI + (i % 2 === 0 ? 1 : -1) * (0.35 + i * 0.18);
      const dist = 1.1 + i * 0.75;
      this._t.set(
        fairyPos.x + Math.sin(back) * dist,
        fairyPos.y,
        fairyPos.z + Math.cos(back) * dist
      );
      f.update(dt, t, this._t);
    }
  }
}
