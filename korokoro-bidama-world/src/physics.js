// Marble physics: spheres vs. a static world made of capsule chains (rails),
// analytic primitives (boxes, cylinders, cones, bowls, discs) and kinematic
// spinners. Marble-marble contacts use a uniform spatial hash. Everything is
// DOM-free so the whole simulation runs headless under node for tests.
import * as THREE from '../vendor/three.module.min.js';

export const MARBLE_R = 0.22;
export const GRAVITY = 16;
const MAX_SPEED = 13;
const CELL = 0.9;

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _rel = new THREE.Vector3();

function cellKey(x, y, z) {
  return ((x + 512) | 0) + ((y + 512) | 0) * 1024 + ((z + 512) | 0) * 1048576;
}

// closest point on segment ab to p, writes into out, returns out
function closestOnSegment(ax, ay, az, bx, by, bz, p, out) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const len2 = abx * abx + aby * aby + abz * abz;
  let s = 0;
  if (len2 > 1e-12) {
    s = ((p.x - ax) * abx + (p.y - ay) * aby + (p.z - az) * abz) / len2;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
  }
  out.set(ax + abx * s, ay + aby * s, az + abz * s);
  return out;
}

let nextMarbleId = 1;

export class Marble {
  constructor() {
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.color = 0;
    this.alive = false;
    this.id = 0;
    this.restT = 0;       // seconds spent nearly still
    this.inGoal = false;
    this.goalCounted = false;
    this.boostCd = 0;
    this.age = 0;
    this.onRail = false;  // touched something this step (for visual roll)
    this.contactN = new THREE.Vector3(0, 1, 0);
  }
  spawnAt(x, y, z, vx, vy, vz, color) {
    this.p.set(x, y, z);
    this.v.set(vx, vy, vz);
    this.color = color;
    this.alive = true;
    this.id = nextMarbleId++;
    this.restT = 0;
    this.age = 0;
    this.inGoal = false;
    this.goalCounted = false;
    this.boostCd = 0;
  }
}

export class Sim {
  constructor(maxMarbles = 140) {
    this.maxMarbles = maxMarbles;
    this.marbles = [];
    for (let i = 0; i < maxMarbles; i++) this.marbles.push(new Marble());
    this.events = [];
    this.time = 0;
    this.killY = -12;
    this.reset();
  }

  reset() {
    this.capsules = [];      // {ax..bz, r}
    this.capsuleHash = new Map();
    this.boxes = [];         // {c:Vec3, h:Vec3, q:Quaternion|null, e, kind, id, boundR}
    this.cylinders = [];     // {x,z,yMin,yMax,r,inside,e,kind,id}
    this.cones = [];         // {x,z,yBot,rBot,yTop,rTop,e}
    this.bowls = [];         // {c:Vec3, R, e}
    this.discs = [];         // {x,y,z,r,hole}
    this.zones = [];         // {c:Vec3, r, kind, dir:Vec3, strength, id}
    this.spinners = [];      // {c:Vec3, arms, len, hh, ht, speed, angle, e}
    this.events.length = 0;
    this.time = 0;
    for (const m of this.marbles) m.alive = false;
    this._mm = new Map();    // marble-marble hash, reused
  }

  // ---- world building ------------------------------------------------
  addCapsuleChain(pts, r) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      this.capsules.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, r });
    }
  }

  addBox(opts) {
    const b = {
      c: opts.c.clone(), h: opts.h.clone(),
      q: opts.q ? opts.q.clone() : null,
      e: opts.e ?? 0.25, kind: opts.kind || null, id: opts.id ?? -1,
      mu: opts.mu ?? 1.0,
    };
    b.boundR = b.h.length() + MARBLE_R + 0.05;
    if (b.q) b.qInv = b.q.clone().invert();
    this.boxes.push(b);
    return b;
  }

  addCylinder(opts) {
    this.cylinders.push({
      x: opts.x, z: opts.z, yMin: opts.yMin, yMax: opts.yMax, r: opts.r,
      inside: !!opts.inside, e: opts.e ?? 0.3, kind: opts.kind || null, id: opts.id ?? -1,
    });
  }

  addCone(opts) { // inner funnel wall, open hole of radius rBot at yBot
    this.cones.push({ x: opts.x, z: opts.z, yBot: opts.yBot, rBot: opts.rBot, yTop: opts.yTop, rTop: opts.rTop, e: opts.e ?? 0.12 });
  }

  addBowl(opts) {
    this.bowls.push({ c: new THREE.Vector3(opts.x, opts.y, opts.z), R: opts.r, e: opts.e ?? 0.25 });
  }

  addDisc(opts) {
    this.discs.push({ x: opts.x, y: opts.y, z: opts.z, r: opts.r, hole: opts.hole ?? 0 });
  }

  addZone(opts) {
    this.zones.push({
      c: new THREE.Vector3(opts.x, opts.y, opts.z), r: opts.r, kind: opts.kind,
      dir: opts.dir ? opts.dir.clone().normalize() : new THREE.Vector3(0, 1, 0),
      strength: opts.strength ?? 10, id: opts.id ?? -1,
    });
  }

  addSpinner(opts) {
    const s = {
      c: new THREE.Vector3(opts.x, opts.y, opts.z),
      arms: opts.arms ?? 4, len: opts.len ?? 1.4,
      hh: opts.hh ?? 0.28, ht: opts.ht ?? 0.09,
      speed: opts.speed ?? 1.2, angle: 0, e: opts.e ?? 0.6,
      kick: 0, // extra speed from taps, decays
    };
    this.spinners.push(s);
    return s;
  }

  finalize() {
    // build static hash for capsule segments, expanded so a single-cell
    // lookup at the marble position finds every candidate
    this.capsuleHash.clear();
    const pad = MARBLE_R + 0.2;
    for (let i = 0; i < this.capsules.length; i++) {
      const s = this.capsules[i];
      const r = s.r + pad;
      const minX = Math.floor((Math.min(s.ax, s.bx) - r) / CELL);
      const maxX = Math.floor((Math.max(s.ax, s.bx) + r) / CELL);
      const minY = Math.floor((Math.min(s.ay, s.by) - r) / CELL);
      const maxY = Math.floor((Math.max(s.ay, s.by) + r) / CELL);
      const minZ = Math.floor((Math.min(s.az, s.bz) - r) / CELL);
      const maxZ = Math.floor((Math.max(s.az, s.bz) + r) / CELL);
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++)
          for (let z = minZ; z <= maxZ; z++) {
            const k = cellKey(x, y, z);
            let arr = this.capsuleHash.get(k);
            if (!arr) this.capsuleHash.set(k, arr = []);
            arr.push(i);
          }
    }
  }

  // ---- marbles ---------------------------------------------------------
  spawn(x, y, z, vx, vy, vz, color) {
    let m = this.marbles.find(mm => !mm.alive);
    if (!m) {
      // recycle the oldest marble (prefer one resting in the goal)
      let best = null;
      for (const mm of this.marbles) {
        if (!best || (mm.inGoal && !best.inGoal) || (mm.inGoal === best.inGoal && mm.age > best.age)) best = mm;
      }
      m = best;
      this.events.push({ type: 'recycled', x: m.p.x, y: m.p.y, z: m.p.z });
    }
    m.spawnAt(x, y, z, vx, vy, vz, color);
    return m;
  }

  aliveCount() { let n = 0; for (const m of this.marbles) if (m.alive) n++; return n; }

  // ---- solid contact response -----------------------------------------
  // mu is a tangential damping rate per second (rolling friction), scaled
  // by the substep so friction is timestep-independent.
  _contact(m, nx, ny, nz, pen, e, mu, svx, svy, svz) {
    m.p.x += nx * pen; m.p.y += ny * pen; m.p.z += nz * pen;
    const rvx = m.v.x - svx, rvy = m.v.y - svy, rvz = m.v.z - svz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    m.contactN.set(nx, ny, nz);
    m.onRail = true;
    if (vn < 0) {
      const j = -(1 + e) * vn;
      m.v.x += nx * j; m.v.y += ny * j; m.v.z += nz * j;
      // tangential (rolling) friction on the relative velocity
      const f = Math.min(0.6, mu * this._dt);
      const rtx = rvx - nx * vn, rty = rvy - ny * vn, rtz = rvz - nz * vn;
      m.v.x -= rtx * f; m.v.y -= rty * f; m.v.z -= rtz * f;
      return -vn; // impact speed
    }
    return 0;
  }

  // public step: internally subdivides so fast marbles never travel more
  // than a fraction of a rail segment per micro-step (keeps tight loops
  // and high speeds stable)
  step(dt) {
    const n = dt > 1 / 200 ? 2 : 1;
    for (let i = 0; i < n; i++) this._step(dt / n);
  }

  _step(dt) {
    this.time += dt;
    this._dt = dt;
    const marbles = this.marbles;

    // update spinners
    for (const s of this.spinners) {
      s.kick = Math.max(0, s.kick - dt * 1.4);
      s.angle += (s.speed + s.kick) * dt;
    }

    // integrate + world collisions
    for (const m of marbles) {
      if (!m.alive) continue;
      m.age += dt;
      m.boostCd = Math.max(0, m.boostCd - dt);
      m.v.y -= GRAVITY * dt;
      // light air drag
      const dr = 1 - 0.03 * dt;
      m.v.multiplyScalar(dr);
      const sp = m.v.length();
      if (sp > MAX_SPEED) m.v.multiplyScalar(MAX_SPEED / sp);
      m.p.addScaledVector(m.v, dt);
      m.onRail = false;

      this._collideWorld(m, dt);

      // rest / kill bookkeeping
      if (m.v.lengthSq() < 0.09) m.restT += dt; else m.restT = 0;
      if (m.p.y < this.killY) this.events.push({ type: 'fell', marble: m });
    }

    // marble-marble
    this._collideMarbles();

    // zones
    for (const m of marbles) {
      if (!m.alive) continue;
      m.inGoal = false;
      for (const z of this.zones) {
        const d2 = m.p.distanceToSquared(z.c);
        if (d2 > z.r * z.r) continue;
        if (z.kind === 'boost') {
          m.v.addScaledVector(z.dir, z.strength * dt);
          if (m.boostCd <= 0) {
            m.boostCd = 0.8;
            this.events.push({ type: 'boost', x: m.p.x, y: m.p.y, z: m.p.z, id: z.id });
          }
        } else if (z.kind === 'goal') {
          m.inGoal = true;
          if (!m.goalCounted && m.v.lengthSq() < 16) {
            m.goalCounted = true;
            this.events.push({ type: 'goal', marble: m, x: m.p.x, y: m.p.y, z: m.p.z });
          }
        } else if (z.kind === 'kill') {
          this.events.push({ type: 'fell', marble: m });
        }
      }
    }
  }

  _collideWorld(m, dt) {
    const p = m.p;

    // rails (capsule chains) via static hash — single cell lookup
    const k = cellKey(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
    const arr = this.capsuleHash.get(k);
    if (arr) {
      for (let i = 0; i < arr.length; i++) {
        const s = this.capsules[arr[i]];
        closestOnSegment(s.ax, s.ay, s.az, s.bx, s.by, s.bz, p, _q);
        const dx = p.x - _q.x, dy = p.y - _q.y, dz = p.z - _q.z;
        const rr = s.r + MARBLE_R;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-10) {
          const d = Math.sqrt(d2);
          this._contact(m, dx / d, dy / d, dz / d, rr - d, 0.03, 0.12, 0, 0, 0);
        }
      }
    }

    // boxes
    for (const b of this.boxes) {
      if (p.distanceToSquared(b.c) > b.boundR * b.boundR) continue;
      _p.subVectors(p, b.c);
      if (b.q) _p.applyQuaternion(b.qInv);
      const cx = Math.max(-b.h.x, Math.min(b.h.x, _p.x));
      const cy = Math.max(-b.h.y, Math.min(b.h.y, _p.y));
      const cz = Math.max(-b.h.z, Math.min(b.h.z, _p.z));
      let dx = _p.x - cx, dy = _p.y - cy, dz = _p.z - cz;
      let d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= MARBLE_R * MARBLE_R) continue;
      let pen, nx, ny, nz;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        pen = MARBLE_R - d; nx = dx / d; ny = dy / d; nz = dz / d;
      } else {
        // centre inside the box: push out along the axis of least depth
        const px = b.h.x - Math.abs(_p.x), py = b.h.y - Math.abs(_p.y), pz = b.h.z - Math.abs(_p.z);
        if (px < py && px < pz) { nx = Math.sign(_p.x) || 1; ny = 0; nz = 0; pen = px + MARBLE_R; }
        else if (py < pz) { nx = 0; ny = Math.sign(_p.y) || 1; nz = 0; pen = py + MARBLE_R; }
        else { nx = 0; ny = 0; nz = Math.sign(_p.z) || 1; pen = pz + MARBLE_R; }
      }
      _n.set(nx, ny, nz);
      if (b.q) _n.applyQuaternion(b.q);
      const impact = this._contact(m, _n.x, _n.y, _n.z, pen, b.e, b.mu, 0, 0, 0);
      if (b.kind === 'chime' && impact > 1.4) {
        this.events.push({ type: 'chime', id: b.id, x: p.x, y: p.y, z: p.z, power: impact });
      }
    }

    // cylinders
    for (const c of this.cylinders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const rho2 = dx * dx + dz * dz;
      if (c.inside) {
        if (p.y < c.yMin - MARBLE_R || p.y > c.yMax + MARBLE_R) continue;
        const lim = c.r - MARBLE_R;
        if (rho2 > lim * lim) {
          const rho = Math.sqrt(rho2) || 1e-6;
          this._contact(m, -dx / rho, 0, -dz / rho, rho - lim, c.e, 0.6, 0, 0, 0);
        }
      } else {
        if (p.y < c.yMin - MARBLE_R || p.y > c.yMax + MARBLE_R) continue;
        const lim = c.r + MARBLE_R;
        if (rho2 < lim * lim && rho2 > 1e-10) {
          const rho = Math.sqrt(rho2);
          const impact = this._contact(m, dx / rho, 0, dz / rho, lim - rho, c.e, 0.3, 0, 0, 0);
          if (c.kind === 'bumper' && impact > 0.6) {
            // bumpers actively fling marbles outward
            m.v.x += (dx / rho) * 5.5;
            m.v.z += (dz / rho) * 5.5;
            m.v.y += 1.6;
            this.events.push({ type: 'bumper', id: c.id, x: p.x, y: p.y, z: p.z });
          }
        }
      }
    }

    // funnels (inner cone walls, open hole at the bottom). The wall only
    // exists for y in [yBot, yTop]; outside that band the nearest feature is
    // the rim circle, otherwise marbles under the hole get phantom-walled.
    for (const c of this.cones) {
      if (p.y < c.yBot - MARBLE_R || p.y > c.yTop + MARBLE_R * 2) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const rho = Math.sqrt(dx * dx + dz * dz);
      if (rho < 1e-6) continue;
      const rx = dx / rho, rz = dz / rho;
      if (p.y >= c.yBot && p.y <= c.yTop) {
        const kSlope = (c.rTop - c.rBot) / (c.yTop - c.yBot);
        const inv = 1 / Math.sqrt(1 + kSlope * kSlope);
        // signed distance to wall line in the (rho, y) plane; negative inside
        const sd = (rho - c.rBot - kSlope * (p.y - c.yBot)) * inv;
        if (sd > -MARBLE_R) {
          // inward-up normal
          const nx = -rx * inv, ny = kSlope * inv, nz = -rz * inv;
          this._contact(m, nx, ny, nz, sd + MARBLE_R, c.e, 1.3, 0, 0, 0);
          // anti-clog agitation: marbles that have come to rest on the wall
          // near the outlet (arches) get a nudge inward so the arch collapses
          if (m.restT > 0.35 && rho < c.rBot + 1.2) {
            m.v.x += (-rz * 1.6 - rx * 1.4) * dt * 4;
            m.v.z += (rx * 1.6 - rz * 1.4) * dt * 4;
            m.v.y -= 0.8 * dt;
          }
        }
      } else {
        // rim circle contact (bottom hole rim or top rim)
        const rr = p.y < c.yBot ? c.rBot : c.rTop;
        const ry = p.y < c.yBot ? c.yBot : c.yTop;
        const qx = c.x + rx * rr, qz = c.z + rz * rr;
        let nx = p.x - qx, ny = p.y - ry, nz = p.z - qz;
        const nd = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nd < MARBLE_R && nd > 1e-6) {
          this._contact(m, nx / nd, ny / nd, nz / nd, MARBLE_R - nd, c.e, 0.6, 0, 0, 0);
        }
      }
    }

    // bowls (inner lower hemisphere)
    for (const b of this.bowls) {
      if (p.y > b.c.y + 0.25 * b.R) continue;
      const d = p.distanceTo(b.c);
      const lim = b.R - MARBLE_R;
      if (d > lim && d < b.R + MARBLE_R * 2) {
        _n.subVectors(b.c, p).divideScalar(d || 1e-6);
        this._contact(m, _n.x, _n.y, _n.z, d - lim, b.e, 3.0, 0, 0, 0);
      }
    }

    // discs (horizontal floors with optional centre hole)
    for (const d of this.discs) {
      const dx = p.x - d.x, dz = p.z - d.z;
      const rho2 = dx * dx + dz * dz;
      if (rho2 > (d.r + MARBLE_R) * (d.r + MARBLE_R)) continue;
      const dy = p.y - d.y;
      if (Math.abs(dy) > MARBLE_R) continue;
      const rho = Math.sqrt(rho2);
      if (d.hole > 0 && rho < d.hole) {
        if (rho > d.hole - MARBLE_R && dy > -MARBLE_R * 0.5) {
          // graze the hole rim: collide with the rim circle
          const rimx = d.x + (dx / (rho || 1e-6)) * d.hole;
          const rimz = d.z + (dz / (rho || 1e-6)) * d.hole;
          let nx = p.x - rimx, ny = p.y - d.y, nz = p.z - rimz;
          const nd = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (nd < MARBLE_R && nd > 1e-6) {
            this._contact(m, nx / nd, ny / nd, nz / nd, MARBLE_R - nd, 0.1, 0.5, 0, 0, 0);
          }
        }
        continue; // over the hole: fall through
      }
      const s = dy >= 0 ? 1 : -1;
      this._contact(m, 0, s, 0, MARBLE_R - Math.abs(dy), 0.12, 1.2, 0, 0, 0);
    }

    // spinners (kinematic rotating paddles)
    for (const s of this.spinners) {
      const relx = p.x - s.c.x, rely = p.y - s.c.y, relz = p.z - s.c.z;
      const reach = s.len + MARBLE_R + 0.1;
      if (relx * relx + relz * relz > reach * reach || Math.abs(rely) > s.hh + MARBLE_R + 0.1) continue;
      const w = s.speed + s.kick;
      for (let a = 0; a < s.arms; a++) {
        const ang = s.angle + (a * Math.PI * 2) / s.arms;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        // into arm-local frame: arm along +X from centre
        const lx = ca * relx + sa * relz;
        const lz = -sa * relx + ca * relz;
        const cx = Math.max(0, Math.min(s.len, lx));
        const cy = Math.max(-s.hh, Math.min(s.hh, rely));
        const cz = Math.max(-s.ht, Math.min(s.ht, lz));
        const dx = lx - cx, dy = rely - cy, dz = lz - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= MARBLE_R * MARBLE_R || d2 < 1e-10) continue;
        const d = Math.sqrt(d2);
        // normal back to world
        const nlx = dx / d, nlz = dz / d;
        const nx = ca * nlx - sa * nlz;
        const nz = sa * nlx + ca * nlz;
        const ny = dy / d;
        // paddle surface velocity at contact point (omega x r)
        const cwx = ca * cx - sa * cz;
        const cwz = sa * cx + ca * cz;
        const svx = -w * cwz, svz = w * cwx;
        const impact = this._contact(m, nx, ny, nz, MARBLE_R - d, s.e, 1.0, svx, 0, svz);
        if (impact > 2.2) this.events.push({ type: 'spin-hit', x: p.x, y: p.y, z: p.z, power: impact });
      }
    }
  }

  _collideMarbles() {
    const grid = this._mm;
    grid.clear();
    const cs = MARBLE_R * 2.1;
    const ms = this.marbles;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (!m.alive) continue;
      const k = cellKey(Math.floor(m.p.x / cs), Math.floor(m.p.y / cs), Math.floor(m.p.z / cs));
      let arr = grid.get(k);
      if (!arr) grid.set(k, arr = []);
      arr.push(i);
    }
    const R2 = MARBLE_R * 2;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      if (!a.alive) continue;
      const gx = Math.floor(a.p.x / cs), gy = Math.floor(a.p.y / cs), gz = Math.floor(a.p.z / cs);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const arr = grid.get(cellKey(gx + ox, gy + oy, gz + oz));
        if (!arr) continue;
        for (const j of arr) {
          if (j <= i) continue;
          const b = ms[j];
          const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= R2 * R2 || d2 < 1e-10) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const pen = (R2 - d) * 0.5;
          a.p.x -= nx * pen; a.p.y -= ny * pen; a.p.z -= nz * pen;
          b.p.x += nx * pen; b.p.y += ny * pen; b.p.z += nz * pen;
          const rvx = b.v.x - a.v.x, rvy = b.v.y - a.v.y, rvz = b.v.z - a.v.z;
          const vn = rvx * nx + rvy * ny + rvz * nz;
          if (vn < 0) {
            const j2 = -(1 + 0.4) * vn * 0.5;
            a.v.x -= nx * j2; a.v.y -= ny * j2; a.v.z -= nz * j2;
            b.v.x += nx * j2; b.v.y += ny * j2; b.v.z += nz * j2;
            if (-vn > 1.6) this.events.push({ type: 'clack', x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2, z: (a.p.z + b.p.z) / 2, power: -vn });
          }
        }
      }
    }
  }
}
