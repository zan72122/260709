// Buds that bloom into note-playing flowers, plus instanced grass tufts.
// Blooming is the core magic verb: elastic pop, petals from the stage
// palette, and each bloomed flower becomes an instrument key.

import * as THREE from '../vendor/three.module.min.js';
import { glowTexture } from './fairy.js';

const elastic = (x) => x === 0 ? 0 : x === 1 ? 1 :
  Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1;

export function makeGrass(count = 420, radius = 22) {
  const geo = new THREE.ConeGeometry(0.07, 0.26, 5);
  geo.translate(0, 0.13, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.sqrt(Math.random()) * radius;
    e.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    q.setFromEuler(e);
    const s = 0.6 + Math.random() * 1.3;
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(s, s * (0.7 + Math.random() * 0.9), s));
    mesh.setMatrixAt(i, m);
    c.setHSL(0.28 + Math.random() * 0.1, 0.55, 0.42 + Math.random() * 0.2);
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildFlower(petalColor) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x4fae5c });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 7), stemMat);
  stem.position.y = 0.45;
  g.add(stem);
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stemMat);
    leaf.scale.set(1.6, 0.35, 0.7);
    leaf.position.set(sx * 0.16, 0.3 + (sx > 0 ? 0.1 : 0), 0);
    leaf.rotation.z = sx * -0.5;
    g.add(leaf);
  }
  const headG = new THREE.Group();
  headG.position.y = 0.94;
  const petMat = new THREE.MeshStandardMaterial({
    color: petalColor, roughness: 0.55, emissive: petalColor, emissiveIntensity: 0.18,
  });
  const nPet = 6;
  for (let i = 0; i < nPet; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), petMat);
    const a = (i / nPet) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
    p.scale.set(1.25, 0.42, 0.8);
    p.rotation.y = -a;
    headG.add(p);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({
    color: 0xffe680, emissive: 0xffd45e, emissiveIntensity: 0.6, roughness: 0.4,
  }));
  center.scale.y = 0.75;
  headG.add(center);
  g.add(headG);
  g.userData.headG = headG;
  return g;
}

function buildBud() {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x4fae5c });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 6), stemMat);
  stem.position.y = 0.21;
  g.add(stem);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({
    color: 0x8fdc7a, roughness: 0.5, emissive: 0x5fca6a, emissiveIntensity: 0.25,
  }));
  bud.scale.y = 1.3;
  bud.position.y = 0.5;
  g.add(bud);
  // rosy tip peeking out so buds pop against the grass
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({
    color: 0xffa0c8, roughness: 0.45, emissive: 0xff7fae, emissiveIntensity: 0.6,
  }));
  tip.scale.y = 1.4;
  tip.position.y = 0.66;
  g.add(tip);
  // sparkle hint so kids can find it
  const hint = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xffe0f0, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  hint.position.y = 1.1;
  hint.scale.setScalar(1.0);
  g.add(hint);
  g.userData.bud = bud;
  g.userData.hint = hint;
  return g;
}

export class FlowerField {
  constructor(scene) {
    this.scene = scene;
    this.buds = [];      // { group, seed }
    this.flowers = [];   // { group, headG, born, note, seed, poke }
    this.maxFlowers = 60;
  }

  clear() {
    for (const b of this.buds) this.scene.remove(b.group);
    for (const f of this.flowers) this.scene.remove(f.group);
    this.buds.length = 0;
    this.flowers.length = 0;
  }

  spawnBud(x, z) {
    const group = buildBud();
    group.position.set(x, 0, z);
    group.scale.setScalar(0.01);
    this.scene.add(group);
    const b = { group, seed: Math.random() * 100, birth: -1 };
    this.buds.push(b);
    return b;
  }

  /** Find the bud whose group contains `obj` (raycast hit). */
  budOf(obj) {
    for (const b of this.buds) {
      let o = obj;
      while (o) { if (o === b.group) return b; o = o.parent; }
    }
    return null;
  }

  flowerOf(obj) {
    for (const f of this.flowers) {
      let o = obj;
      while (o) { if (o === f.group) return f; o = o.parent; }
    }
    return null;
  }

  /** Bloom a bud into a flower. Returns the new flower record. */
  bloom(bud, petalColor, now) {
    const i = this.buds.indexOf(bud);
    if (i < 0) return null;
    this.buds.splice(i, 1);
    this.scene.remove(bud.group);
    const group = buildFlower(petalColor);
    group.position.copy(bud.group.position);
    this.scene.add(group);
    const f = {
      group, headG: group.userData.headG, born: now,
      note: (Math.random() * 8) | 0, seed: Math.random() * 100, poked: -10,
    };
    this.flowers.push(f);
    if (this.flowers.length > this.maxFlowers) {
      const old = this.flowers.shift();
      this.scene.remove(old.group);
    }
    return f;
  }

  poke(flower, now) { flower.poked = now; }

  update(dt, t) {
    for (const b of this.buds) {
      if (b.birth < 0) b.birth = t;
      const grow = Math.min(1, (t - b.birth) / 0.6);
      const pulse = 1 + Math.sin(t * 3 + b.seed) * 0.08;
      b.group.scale.setScalar(elastic(grow) * pulse * 0.9 + 0.01);
      b.group.userData.hint.material.opacity = 0.5 + 0.4 * Math.sin(t * 4 + b.seed);
      b.group.userData.hint.position.y = 1.1 + Math.sin(t * 2 + b.seed) * 0.1;
    }
    for (const f of this.flowers) {
      const age = t - f.born;
      const pop = elastic(Math.min(1, age / 0.9));
      let squash = 1;
      const pk = t - f.poked;
      if (pk < 0.5) squash = 1 + Math.sin(pk * 18) * 0.35 * (1 - pk * 2);
      f.group.scale.set(pop * (2 - squash) * 0.5 + pop * 0.5, pop * squash, pop);
      f.headG.rotation.y = t * 0.4 + f.seed;
      f.group.rotation.z = Math.sin(t * 1.3 + f.seed) * 0.05; // sway in wind
    }
  }
}
