// ---------------------------------------------------------------------------
// marbles.js — pooled glass marbles with a small, tuned 2.5D physics engine
// (spheres vs capsule-segments + sphere-sphere). Marbles feed through the
// wobbly tube, pop out of the nozzle, bounce, land in cups and melt into
// syrup, or hit the floor and melt into the pond.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { FLAVOURS } from './colors.js';
import { CUP } from './cups.js';

const RADIUS = 0.16;
const GRAV = -13.5;
const MAX_ACTIVE = 60;

export class Marbles {
  constructor(scene, tube) {
    this.scene = scene;
    this.tube = tube;             // WobblyTube (for feed animation)
    this.pool = [];
    this.geo = new THREE.SphereGeometry(RADIUS, 18, 14);
    this.mats = {};
    for (const f of FLAVOURS) {
      this.mats[f.key] = new THREE.MeshPhysicalMaterial({
        color: f.marble, roughness: 0.1, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.06,
        envMapIntensity: 0.55,
      });
    }
    // rare lucky star-marble: golden & glowing, worth extra syrup
    this.mats.star = new THREE.MeshPhysicalMaterial({
      color: 0xffd54f, roughness: 0.12, metalness: 0.3,
      clearcoat: 1, clearcoatRoughness: 0.05,
      emissive: 0xffb300, emissiveIntensity: 0.35,
    });
    for (let i = 0; i < MAX_ACTIVE; i++) {
      const mesh = new THREE.Mesh(this.geo, this.mats.ichigo);
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh, alive: false, state: 'free',
        x: 0, y: 0, vx: 0, vy: 0, spin: 0,
        u: 0, flavour: FLAVOURS[0],
        restTime: 0, floorTime: 0, meltT: 0, meltCup: null,
        zJit: 0,
      });
    }

    // callbacks wired by main.js
    this.onMeltInCup = null;   // (cup, flavour)
    this.onMeltFloor = null;   // (x, flavour)
    this.onBounce = null;      // (impactSpeed)
    this.onExitNozzle = null;  // (x, y)

    this._colliders = [];
    this._acc = 0;
  }

  activeCount() { return this.pool.reduce((n, m) => n + (m.alive ? 1 : 0), 0); }

  // start a marble travelling down the feed tube
  feed(flavour) {
    const m = this.pool.find(p => !p.alive);
    if (!m) return false;
    m.alive = true;
    m.state = 'tube';
    m.u = 0;
    m.flavour = flavour;
    m.star = Math.random() < 0.09;
    m.mesh.material = m.star ? this.mats.star : this.mats[flavour.key];
    m.mesh.visible = true;
    m.mesh.scale.setScalar(0.9);
    m.restTime = 0; m.floorTime = 0;
    m.zJit = (Math.random() - 0.5) * 0.08;
    return true;
  }

  // main physics update. spout: {x, vx, exitY}; cups: [Cup, Cup]
  update(dt, crankSpeed, spout, cups) {
    // refresh collider list (cups move!)
    const cols = this._colliders;
    cols.length = 0;
    for (const c of cups) c.colliders(cols);
    // floor
    cols.push({ x1: -30, y1: 0.16, x2: 30, y2: 0.16, r: 0.02, rest: 0.35, floor: true });

    const V = new THREE.Vector3();
    // tube-fed marbles ride the curve
    for (const m of this.pool) {
      if (!m.alive || m.state !== 'tube') continue;
      m.u += dt * (0.55 + Math.min(3.2, crankSpeed) * 0.5);
      if (m.u >= 1) {
        m.state = 'free';
        m.x = spout.x + (Math.random() - 0.5) * 0.04;
        m.y = spout.exitY;
        m.vx = spout.vx * 0.9 + (Math.random() - 0.5) * 0.3;
        m.vy = -0.6;
        m.mesh.scale.setScalar(1);
        if (this.onExitNozzle) this.onExitNozzle(m.x, m.y);
      } else {
        this.tube.pointAt(Math.min(1, m.u), V);
        m.mesh.position.copy(V);
        const squeeze = 0.82 + Math.sin(m.u * Math.PI) * 0.1;
        m.mesh.scale.setScalar(squeeze);
      }
    }

    // fixed-step integration for free marbles
    this._acc += dt;
    const h = 1 / 120;
    let steps = 0;
    while (this._acc >= h && steps < 6) {
      this._step(h, cols, cups);
      this._acc -= h;
      steps++;
    }
    if (steps === 6) this._acc = 0;

    // melting + housekeeping
    for (const m of this.pool) {
      if (!m.alive) continue;
      if (m.state === 'melt') {
        m.meltT += dt * 3.2;
        const s = Math.max(0, 1 - m.meltT);
        m.mesh.scale.setScalar(s);
        m.mesh.position.y -= dt * 0.35;
        if (m.meltT >= 1) this._kill(m);
        continue;
      }
      if (m.state !== 'free') continue;

      m.mesh.position.set(m.x, m.y, m.zJit);
      m.spin += m.vx * dt * 6;
      m.mesh.rotation.z = -m.spin;
      m.mesh.rotation.x = m.spin * 0.3;

      // out of bounds
      if (m.x < -8 || m.x > 8 || m.y < -2) { this._kill(m); continue; }

      // inside a cup?
      let inCup = null;
      for (const c of cups) {
        const frac = THREE.MathUtils.clamp((m.y - CUP.Y0) / CUP.H, 0, 1);
        if (m.y > CUP.Y0 - 0.05 && m.y < CUP.RIM_Y + 0.05 &&
            Math.abs(m.x - c.x) < c.radiusAt(frac) - RADIUS * 0.4) inCup = c;
      }
      const speed = Math.hypot(m.vx, m.vy);
      if (inCup) {
        // resting on liquid or bottom → melt quicker as the cup fills
        const surfaceY = CUP.Y0 + Math.min(inCup.level, 1) * CUP.H;
        if (m.y < surfaceY + RADIUS && m.vy <= 0.4) {
          m.restTime += dt * 2.6;   // sink into syrup fast
        } else if (speed < 0.5) {
          m.restTime += dt;
        }
        if (m.restTime > 0.55) {
          m.state = 'melt'; m.meltT = 0; m.meltCup = inCup;
          if (this.onMeltInCup) this.onMeltInCup(inCup, m.flavour, m.x, m.y, m.star);
        }
      } else if (m.y < 0.42 && Math.abs(m.vy) < 1.2) {
        m.floorTime += dt;
        if (m.floorTime > 0.55) {
          m.state = 'melt'; m.meltT = 0;
          if (this.onMeltFloor) this.onMeltFloor(m.x, m.flavour);
        }
      }
    }
  }

  _step(h, cols, cups) {
    const P = this.pool;
    for (const m of P) {
      if (!m.alive || m.state !== 'free') continue;
      m.vy += GRAV * h;
      // syrup drag once below a cup's liquid surface
      m.x += m.vx * h;
      m.y += m.vy * h;

      // vs static/kinematic capsules
      for (const c of cols) {
        this._collideSegment(m, c);
      }
    }
    // marble ↔ marble
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      if (!a.alive || a.state !== 'free') continue;
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j];
        if (!b.alive || b.state !== 'free') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = RADIUS * 2;
        if (d2 > min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = (min - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const rel = rvx * nx + rvy * ny;
        if (rel < 0) {
          const imp = -rel * 0.68;
          a.vx -= nx * imp; a.vy -= ny * imp;
          b.vx += nx * imp; b.vy += ny * imp;
          if (rel < -1.6 && this.onBounce) this.onBounce(-rel * 0.5);
        }
      }
    }
  }

  _collideSegment(m, c) {
    // closest point on segment
    const ex = c.x2 - c.x1, ey = c.y2 - c.y1;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((m.x - c.x1) * ex + (m.y - c.y1) * ey) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = c.x1 + ex * t, py = c.y1 + ey * t;
    let dx = m.x - px, dy = m.y - py;
    let d = Math.hypot(dx, dy);
    const min = RADIUS + c.r;
    if (d >= min) return;
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
    const nx = dx / d, ny = dy / d;
    m.x = px + nx * min;
    m.y = py + ny * min;
    const vn = m.vx * nx + m.vy * ny;
    if (vn < 0) {
      const rest = c.rest ?? 0.3;
      m.vx -= (1 + rest) * vn * nx;
      m.vy -= (1 + rest) * vn * ny;
      // tangential friction
      m.vx *= 0.985;
      if (vn < -2.2 && this.onBounce) this.onBounce(-vn * 0.4);
    }
  }

  _kill(m) {
    m.alive = false;
    m.mesh.visible = false;
    m.state = 'free';
  }

  reset() {
    for (const m of this.pool) this._kill(m);
  }
}
