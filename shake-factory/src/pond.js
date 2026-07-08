// ---------------------------------------------------------------------------
// pond.js — spilled syrup collects into a wobbly jelly pond on the floor.
// Mix three or more colours and it turns into a rainbow. Bubbles rise out.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export class Pond {
  constructor(scene) {
    this.scene = scene;
    this.volume = 0;               // accumulated spill
    this.colors = new Map();       // colorHex -> amount
    this.mixColor = new THREE.Color(0xffffff);
    this.rainbow = false;
    this.splashPulse = 0;
    this.spillRate = 0;            // smoothed, for audio

    // blobby disc: circle geometry whose rim vertices get wobbled
    const SEGS = 48;
    this.geo = new THREE.CircleGeometry(1, SEGS);
    this.baseVerts = this.geo.attributes.position.array.slice();
    const colorArr = new Float32Array(this.geo.attributes.position.count * 3).fill(1);
    this.geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    this.mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.15, metalness: 0,
      transparent: true, opacity: 0.96,
      emissive: 0x000000, emissiveIntensity: 0.1,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.05;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    scene.add(this.mesh);

    // jelly dome in the middle once the pond is big
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.5,
        clearcoat: 1, clearcoatRoughness: 0.1,
      })
    );
    this.dome.position.y = 0.02;
    this.dome.visible = false;
    scene.add(this.dome);

    // rising bubbles (small spheres, recycled)
    this.bubbles = [];
    const bGeo = new THREE.SphereGeometry(0.06, 10, 8);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(bGeo, new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.55,
        clearcoat: 1,
      }));
      m.visible = false;
      m.userData = { life: 0, max: 1, vx: 0 };
      scene.add(m);
      this.bubbles.push(m);
    }
    this._bubbleTimer = 0;
  }

  get radius() { return Math.min(4.8, 0.55 + Math.sqrt(this.volume) * 2.3); }

  addSpill(colorHex, amount, atX = 0) {
    this.volume += amount;
    this.colors.set(colorHex, (this.colors.get(colorHex) || 0) + amount);
    this.splashPulse = Math.min(1.6, this.splashPulse + amount * 18 + 0.25);
    this.spillRate = Math.min(1, this.spillRate + amount * 10);
    this._recolor();
    this._splashAt = atX;
  }

  colorCount() { return this.colors.size; }

  _recolor() {
    // weighted mix
    let r = 0, g = 0, b = 0, tot = 0;
    const c = new THREE.Color();
    for (const [hex, amt] of this.colors) {
      c.set(hex);
      r += c.r * amt; g += c.g * amt; b += c.b * amt; tot += amt;
    }
    if (tot > 0) this.mixColor.setRGB(r / tot, g / tot, b / tot);
    // deepen the colour a lot — the pastel lighting otherwise washes it white
    const hsl = {};
    this.mixColor.getHSL(hsl);
    this.mixColor.setHSL(hsl.h, Math.min(1, hsl.s * 1.6 + 0.15), Math.min(0.5, hsl.l * 0.75));
    this.rainbow = this.colors.size >= 3;
    this.mat.emissive.copy(this.mixColor);

    const colAttr = this.geo.attributes.color;
    const pos = this.baseVerts;
    const tmp = new THREE.Color();
    for (let i = 0; i < colAttr.count; i++) {
      if (this.rainbow) {
        const a = Math.atan2(pos[i * 3 + 1], pos[i * 3]);
        const d = Math.hypot(pos[i * 3], pos[i * 3 + 1]);
        tmp.setHSL(((a / (Math.PI * 2)) + d * 0.35 + 1) % 1, 0.9, 0.5);
      } else {
        tmp.copy(this.mixColor);
      }
      colAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colAttr.needsUpdate = true;
  }

  update(dt, t) {
    this.splashPulse = Math.max(0, this.splashPulse - dt * 2.2);
    this.spillRate = Math.max(0, this.spillRate - dt * 1.5);
    const R = this.radius;
    const visible = this.volume > 0.01;
    this.mesh.visible = visible;
    if (visible) {
      // jelly wobble: rim vertices breathe, whole disc pulses on splash
      const posA = this.geo.attributes.position;
      const base = this.baseVerts;
      for (let i = 0; i < posA.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const d = Math.hypot(bx, by);
        if (d > 0.5) {
          const a = Math.atan2(by, bx);
          const w = 1 + Math.sin(a * 6 + t * 2.1) * 0.06 + Math.sin(a * 11 - t * 1.4) * 0.035;
          posA.setXY(i, bx * w, by * w);
        }
      }
      posA.needsUpdate = true;
      const pulse = 1 + this.splashPulse * 0.05 * Math.sin(t * 18);
      this.mesh.scale.setScalar(R * pulse);

      const domeVis = this.volume > 0.35;
      this.dome.visible = domeVis;
      if (domeVis) {
        const dr = Math.min(1.6, (this.volume - 0.35) * 0.9 + 0.3);
        this.dome.scale.set(dr, dr * (0.42 + Math.sin(t * 2.4) * 0.03 + this.splashPulse * 0.06), dr);
        this.dome.material.color.copy(this.rainbow
          ? new THREE.Color().setHSL((t * 0.05) % 1, 0.7, 0.72)
          : this.mixColor);
      }
    }

    // bubbles
    this._bubbleTimer -= dt;
    const bubbleRate = visible ? (0.5 + this.spillRate * 6 + this.splashPulse * 4) : 0;
    if (this._bubbleTimer <= 0 && bubbleRate > 0) {
      this._bubbleTimer = 1 / bubbleRate;
      const b = this.bubbles.find(bb => !bb.visible);
      if (b) {
        b.visible = true;
        b.userData.life = 0;
        b.userData.max = 0.9 + Math.random() * 1.2;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * R * 0.8;
        b.position.set(Math.cos(a) * rr + (this._splashAt || 0) * 0.3, 0.05, Math.sin(a) * rr * 0.6);
        b.userData.vx = (Math.random() - 0.5) * 0.15;
        const s = 0.5 + Math.random() * 1.3;
        b.scale.setScalar(s);
        if (this.rainbow) b.material.color.setHSL(Math.random(), 0.6, 0.75);
        else b.material.color.copy(this.mixColor).lerp(new THREE.Color(0xffffff), 0.5);
      }
    }
    for (const b of this.bubbles) {
      if (!b.visible) continue;
      b.userData.life += dt;
      const u = b.userData.life / b.userData.max;
      if (u >= 1) { b.visible = false; continue; }
      b.position.y += dt * (0.5 + u * 0.6);
      b.position.x += b.userData.vx * dt + Math.sin(t * 4 + b.id) * 0.003;
      b.material.opacity = 0.55 * (1 - u * u);
    }
  }

  reset() {
    this.volume = 0;
    this.colors.clear();
    this.splashPulse = 0;
    this.mesh.visible = false;
    this.dome.visible = false;
    for (const b of this.bubbles) b.visible = false;
  }
}
