// Procedural flower-fairy characters: bell dress, twin-bun hair with a
// flower pin, big sparkly eyes, four iridescent wings, a star wand and a
// glow halo. Everything is built from primitives — no external assets.

import * as THREE from '../vendor/three.module.min.js';

const _wingTexCache = new Map();

function wingTexture(tintHex) {
  if (_wingTexCache.has(tintHex)) return _wingTexCache.get(tintHex);
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const tint = '#' + tintHex.toString(16).padStart(6, '0');
  // two-lobe wing silhouette
  g.translate(0, s / 2);
  const grad = g.createRadialGradient(10, 0, 4, 30, 0, s);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.5, tint + 'e6');
  grad.addColorStop(1, tint + '55');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(4, 0);
  g.bezierCurveTo(30, -70, 120, -62, 118, -18);
  g.bezierCurveTo(116, -2, 60, 2, 30, 0);
  g.bezierCurveTo(80, 8, 104, 18, 92, 42);
  g.bezierCurveTo(70, 62, 18, 34, 4, 4);
  g.closePath();
  g.fill();
  // vein sparkles
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 14; i++) {
    const x = 14 + Math.random() * 90;
    const y = (Math.random() - 0.55) * 80;
    g.beginPath();
    g.arc(x, y, 1 + Math.random() * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _wingTexCache.set(tintHex, tex);
  return tex;
}

function makeGlowTexture() {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let _glowTex = null;
export function glowTexture() { return _glowTex || (_glowTex = makeGlowTexture()); }

function starGeometry(R = 0.14, r = 0.062, depth = 0.05) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}
export { starGeometry };

function heartShape(sc = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5 * sc);
  s.bezierCurveTo(0.55 * sc, -0.05 * sc, 0.5 * sc, 0.45 * sc, 0, 0.18 * sc);
  s.bezierCurveTo(-0.5 * sc, 0.45 * sc, -0.55 * sc, -0.05 * sc, 0, -0.5 * sc);
  return s;
}
export { heartShape };

/** Build one fairy. Returns a Group; animated parts live in group.userData. */
export function createFairy(pal) {
  const root = new THREE.Group();
  const inner = new THREE.Group(); // bobbing container
  root.add(inner);

  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.55 });
  const dressMat = new THREE.MeshStandardMaterial({
    color: pal.dress, roughness: 0.5, emissive: pal.dress, emissiveIntensity: 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: pal.accent, roughness: 0.3, emissive: pal.accent, emissiveIntensity: 0.5,
  });

  // --- bell dress (lathe)
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const v = i / 10;
    pts.push(new THREE.Vector2(0.06 + Math.pow(v, 1.6) * 0.30, 0.52 - v * 0.52));
  }
  const dress = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), dressMat);
  inner.add(dress);
  // dress hem frill
  const frill = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.045, 8, 22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  frill.rotation.x = Math.PI / 2;
  frill.position.y = 0.005;
  inner.add(frill);

  // torso + ribbon
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), dressMat);
  torso.position.y = 0.55;
  inner.add(torso);
  const ribbon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), accentMat);
  ribbon.scale.set(1.5, 0.8, 0.7);
  ribbon.position.set(0, 0.6, 0.11);
  inner.add(ribbon);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.038, 0.2, 4, 8);
  const armL = new THREE.Mesh(armGeo, skinMat);
  armL.position.set(-0.17, 0.52, 0.03);
  armL.rotation.z = 0.9;
  inner.add(armL);
  const armR = new THREE.Mesh(armGeo, skinMat);
  armR.position.set(0.19, 0.58, 0.06);
  armR.rotation.z = -2.2;
  inner.add(armR);

  // --- head
  const head = new THREE.Group();
  head.position.y = 0.86;
  inner.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), skinMat);
  head.add(face);
  // hair: back sphere + fringe + twin buns
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 14), hairMat);
  hairBack.position.set(0, 0.028, -0.045);
  head.add(hairBack);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
  fringe.position.set(0, 0.035, 0.012);
  head.add(fringe);
  for (const sx of [-1, 1]) {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hairMat);
    bun.position.set(sx * 0.2, 0.13, -0.02);
    head.add(bun);
  }
  // flower hairpin
  const pin = new THREE.Group();
  pin.position.set(0.13, 0.19, 0.09);
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), accentMat);
    const a = (i / 5) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0);
    p.scale.z = 0.5;
    pin.add(p);
  }
  const pinC = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }));
  pinC.scale.z = 0.5;
  pin.add(pinC);
  head.add(pin);
  // eyes (big & sparkly)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x40312e });
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), eyeMat);
    eye.scale.set(0.8, 1.25, 0.55);
    eye.position.set(sx * 0.082, -0.005, 0.185);
    head.add(eye);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), hlMat);
    hl.position.set(sx * 0.07, 0.022, 0.215);
    head.add(hl);
  }
  // blush
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff9db8, transparent: true, opacity: 0.75 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.032, 10), blushMat);
    b.position.set(sx * 0.13, -0.055, 0.172);
    b.lookAt(b.position.clone().multiplyScalar(2).add(new THREE.Vector3(0, 0.8, 0.6)));
    head.add(b);
  }
  // smile
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI * 0.85), eyeMat);
  smile.position.set(0, -0.06, 0.195);
  smile.rotation.z = Math.PI + Math.PI * 0.075;
  head.add(smile);

  // --- wings (4)
  const wings = new THREE.Group();
  wings.position.set(0, 0.6, -0.1);
  inner.add(wings);
  const wtex = wingTexture(pal.wing);
  const wingMat = new THREE.MeshBasicMaterial({
    map: wtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.92,
  });
  const wingPairs = [];
  const mk = (sx, sy, sc, y) => {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * sc, 0.62 * sc), wingMat);
    w.position.x = sx * 0.31 * sc;
    if (sx < 0) w.scale.x = -1;
    pivot.add(w);
    pivot.position.y = y;
    pivot.rotation.x = -0.15;
    wings.add(pivot);
    wingPairs.push({ pivot, sx, sy });
    return pivot;
  };
  mk(1, 1, 1.0, 0.1); mk(-1, 1, 1.0, 0.1);
  mk(1, -1, 0.7, -0.14); mk(-1, -1, 0.7, -0.14);

  // --- star wand in right hand
  const wand = new THREE.Group();
  wand.position.set(0.3, 0.72, 0.1);
  wand.rotation.z = -0.4;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), new THREE.MeshStandardMaterial({ color: 0xffe9c0, roughness: 0.5 }));
  wand.add(stick);
  const star = new THREE.Mesh(starGeometry(0.09, 0.04, 0.03), new THREE.MeshStandardMaterial({
    color: 0xffe14f, emissive: 0xffd45e, emissiveIntensity: 1.4, roughness: 0.3,
  }));
  star.position.y = 0.22;
  wand.add(star);
  const wandGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: pal.accent, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  wandGlow.scale.setScalar(0.5);
  wandGlow.position.y = 0.22;
  wand.add(wandGlow);
  inner.add(wand);

  // aura glow behind fairy
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: pal.wing, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  aura.scale.setScalar(1.7);
  aura.position.y = 0.5;
  inner.add(aura);

  root.userData = {
    pal, inner, head, wings: wingPairs, wand, wandStar: star, wandGlow, aura,
    dressMat, torsoMat: dressMat, hairMat, accentMat, ribbon,
  };
  return root;
}

/** Smooth flight controller: spring toward target, banking, bobbing, wing flap. */
export class FairyController {
  constructor(mesh) {
    this.mesh = mesh;
    this.pos = mesh.position;
    this.target = mesh.position.clone();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.trailTimer = 0;
    this.spin = 0; // extra Y spin (twirl)
    this.autopilot = null; // function(t) -> Vector3 for demo flight
    this._tmp = new THREE.Vector3();
  }

  setTarget(v) { this.target.copy(v); }

  /** Celebration twirl. */
  twirl() { this.spin = Math.PI * 4; }

  update(dt, t, emitTrail) {
    if (this.autopilot) this.target.copy(this.autopilot(t));

    // critically-damped-ish spring
    this._tmp.subVectors(this.target, this.pos);
    const dist = this._tmp.length();
    this.vel.addScaledVector(this._tmp, dt * 6.5);
    this.vel.multiplyScalar(Math.pow(0.12, dt)); // damping
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < 0.55) this.pos.y = 0.55;

    const u = this.mesh.userData;
    const speed = this.vel.length();

    // face travel direction (only when moving)
    if (speed > 0.4) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 6);
    }
    let spinNow = 0;
    if (this.spin > 0) {
      const step = Math.min(this.spin, dt * 14);
      this.spin -= step;
      spinNow = this.spin;
    }
    this.mesh.rotation.y = this.heading + spinNow;

    // bank into turns, pitch with vertical speed
    u.inner.rotation.z = THREE.MathUtils.clamp(-this.vel.x * Math.cos(this.heading) * 0.06 + this.vel.z * Math.sin(this.heading) * 0.06, -0.4, 0.4);
    u.inner.rotation.x = THREE.MathUtils.clamp(-this.vel.y * 0.04 + speed * 0.03, -0.3, 0.35);

    // hover bob
    u.inner.position.y = Math.sin(t * 2.1) * 0.05;

    // wing flap: faster when moving
    const flap = Math.sin(t * (9 + Math.min(14, speed * 3.5))) * (0.55 + Math.min(0.4, speed * 0.1));
    for (const w of u.wings) w.pivot.rotation.y = w.sx * (0.35 + flap * 0.6) * (w.sy > 0 ? 1 : 0.8);

    // wand sparkle pulse
    u.wandStar.rotation.z += dt * 2;
    u.wandGlow.material.opacity = 0.55 + 0.35 * Math.sin(t * 5);
    u.aura.material.opacity = 0.28 + 0.14 * Math.sin(t * 3.1);

    // stardust trail while moving
    this.trailTimer -= dt;
    if (speed > 1.2 && this.trailTimer <= 0 && emitTrail) {
      this.trailTimer = 0.03;
      emitTrail(this.pos);
    }
    return dist;
  }
}

/** Swap the dress / ribbon color (🎀 button). */
export function setDressColor(fairy, hex) {
  const u = fairy.userData;
  u.dressMat.color.set(hex);
  u.dressMat.emissive.set(hex);
}
