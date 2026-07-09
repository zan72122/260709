// なかまたち — procedural relax-bear friends who cheer the player on.
// Built from spheres/capsules only; each returns a Character with a tiny
// keyframe-free animation state machine (idle / cheer / gasp / clap).

import * as THREE from '../vendor/three.module.min.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: 0 });
}

function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const EYE = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.3 });

// ---------------------------------------------------------------- bear

function buildBear({ fur, muzzleCol, earInner, button = null, blushCol = 0xffa8b8 }) {
  const g = new THREE.Group();
  const furM = std(fur);
  const parts = {};

  // body (round tummy)
  parts.body = mesh(g, new THREE.SphereGeometry(0.52, 22, 18), furM, 0, 0.5, 0);
  parts.body.scale.set(1, 1.08, 0.92);
  // tummy patch
  const tummy = mesh(parts.body, new THREE.SphereGeometry(0.4, 18, 14), std(muzzleCol), 0, -0.06, 0.2);
  tummy.scale.set(0.82, 0.85, 0.62);
  tummy.castShadow = false;
  if (button) {
    mesh(parts.body, new THREE.SphereGeometry(0.07, 10, 8), std(button, { rough: 0.3 }), 0, 0.1, 0.53);
  }

  // head
  const head = new THREE.Group();
  head.position.set(0, 1.18, 0.02);
  g.add(head);
  parts.head = head;
  const skull = mesh(head, new THREE.SphereGeometry(0.46, 24, 20), furM, 0, 0, 0);
  skull.scale.set(1.06, 0.92, 0.94);
  // muzzle
  const muzzle = mesh(head, new THREE.SphereGeometry(0.2, 16, 12), std(muzzleCol), 0, -0.1, 0.38);
  muzzle.scale.set(1.15, 0.75, 0.7);
  muzzle.castShadow = false;
  mesh(head, new THREE.SphereGeometry(0.055, 10, 8), EYE, 0, -0.04, 0.545); // nose
  // eyes
  parts.eyeL = mesh(head, new THREE.SphereGeometry(0.045, 10, 8), EYE, -0.17, 0.06, 0.41);
  parts.eyeR = mesh(head, new THREE.SphereGeometry(0.045, 10, 8), EYE, 0.17, 0.06, 0.41);
  // blush
  const blush = std(blushCol, { rough: 0.6 });
  for (const s of [-1, 1]) {
    const b = mesh(head, new THREE.SphereGeometry(0.055, 8, 6), blush, s * 0.28, -0.06, 0.36);
    b.scale.z = 0.4; b.castShadow = false;
  }
  // ears
  for (const s of [-1, 1]) {
    const ear = mesh(head, new THREE.SphereGeometry(0.145, 14, 10), furM, s * 0.3, 0.38, 0);
    const inner = mesh(ear, new THREE.SphereGeometry(0.08, 10, 8), std(earInner), 0, 0.02, 0.09);
    inner.castShadow = false;
    parts[s < 0 ? 'earL' : 'earR'] = ear;
  }
  // arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.46, 0.78, 0.05);
    const a = mesh(arm, new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), furM, s * 0.09, -0.16, 0);
    a.rotation.z = s * 0.6;
    g.add(arm);
    parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  // legs
  for (const s of [-1, 1]) {
    const leg = mesh(g, new THREE.CapsuleGeometry(0.15, 0.18, 6, 12), furM, s * 0.26, 0.16, 0.12);
    leg.rotation.x = -1.25;
    parts[s < 0 ? 'legL' : 'legR'] = leg;
  }
  return { group: g, parts, height: 1.66 };
}

// ---------------------------------------------------------------- bird

function buildBird() {
  const g = new THREE.Group();
  const yellow = std(0xffd93d);
  const parts = {};
  parts.body = mesh(g, new THREE.SphereGeometry(0.34, 22, 18), yellow, 0, 0.36, 0);
  parts.body.scale.set(0.95, 1.1, 0.9);
  parts.head = parts.body; // one-ball bird
  // beak
  const beak = mesh(parts.body, new THREE.ConeGeometry(0.09, 0.16, 10), std(0xf4a428, { rough: 0.5 }), 0, 0.05, 0.36);
  beak.rotation.x = Math.PI / 2;
  // eyes
  mesh(parts.body, new THREE.SphereGeometry(0.038, 8, 6), EYE, -0.13, 0.16, 0.28);
  mesh(parts.body, new THREE.SphereGeometry(0.038, 8, 6), EYE, 0.13, 0.16, 0.28);
  // tuft
  mesh(parts.body, new THREE.ConeGeometry(0.05, 0.14, 8), std(0xffc61a), 0, 0.36, 0);
  // wings
  for (const s of [-1, 1]) {
    const w = mesh(parts.body, new THREE.SphereGeometry(0.14, 12, 8), yellow, s * 0.3, 0, 0);
    w.scale.set(0.5, 0.9, 0.75);
    parts[s < 0 ? 'wingL' : 'wingR'] = w;
  }
  // feet
  for (const s of [-1, 1])
    mesh(g, new THREE.SphereGeometry(0.06, 8, 6), std(0xf4a428), s * 0.12, 0.04, 0.06);
  return { group: g, parts, height: 0.75 };
}

// ---------------------------------------------------------------- Character

export function createCharacter(kind) {
  let built;
  if (kind === 'bear') {
    built = buildBear({ fur: 0xbd8d57, muzzleCol: 0xf8e8cb, earInner: 0xf8e8cb });
  } else if (kind === 'whitebear') {
    built = buildBear({ fur: 0xfaf0dd, muzzleCol: 0xffffff, earInner: 0xffb9c8, button: 0xe03e4e });
  } else {
    built = buildBird();
  }
  return new CharacterImpl(kind, built);
}

class CharacterImpl {
  constructor(kind, built) {
    this.kind = kind;
    this.group = built.group;
    this.parts = built.parts;
    this.height = built.height;
    this.mood = 'idle';
    this.moodT = 0;
    this.t = Math.random() * 10;
    this.baseY = 0;
    this.homePos = new THREE.Vector3();
    this.flying = null; // bird rescue flight
  }

  setMood(mood, duration = 1.6) {
    this.mood = mood;
    this.moodT = duration;
  }

  update(dt) {
    this.t += dt;
    if (this.moodT > 0) {
      this.moodT -= dt;
      if (this.moodT <= 0) this.mood = 'idle';
    }
    const p = this.parts, g = this.group, t = this.t;

    if (this.kind === 'bird') {
      // hop & flap
      const cheer = this.mood === 'cheer';
      const hop = Math.abs(Math.sin(t * (cheer ? 9 : 2.2)));
      g.position.y = this.baseY + hop * (cheer ? 0.3 : 0.05);
      const flap = cheer ? Math.sin(t * 22) * 0.9 : Math.sin(t * 3) * 0.12;
      if (p.wingL) { p.wingL.rotation.z = 0.4 + flap; p.wingR.rotation.z = -0.4 - flap; }
      g.rotation.z = this.mood === 'gasp' ? Math.sin(t * 18) * 0.12 : 0;
      return;
    }

    // bears
    const bob = Math.sin(t * 1.7) * 0.02;
    let jump = 0, armUp = 0, sway = 0, headTilt = Math.sin(t * 0.9) * 0.06;
    if (this.mood === 'cheer') {
      jump = Math.abs(Math.sin(t * 8)) * 0.28;
      armUp = 2.2;
      headTilt = Math.sin(t * 8) * 0.12;
    } else if (this.mood === 'gasp') {
      sway = Math.sin(t * 16) * 0.1;
      armUp = 2.6;
      headTilt = 0.22;
    } else if (this.mood === 'clap') {
      armUp = 1.4 + Math.sin(t * 14) * 0.5;
    }
    g.position.y = this.baseY + bob + jump;
    g.rotation.z = sway;
    if (p.armL) {
      const idleSwing = Math.sin(t * 1.7) * 0.1;
      p.armL.rotation.z = -(0.15 + idleSwing) - armUp * 0.55;
      p.armR.rotation.z = (0.15 + idleSwing) + armUp * 0.55;
    }
    if (p.head) {
      p.head.rotation.z = headTilt;
      p.head.rotation.x = this.mood === 'gasp' ? -0.15 : Math.sin(t * 1.1) * 0.04;
    }
  }
}
