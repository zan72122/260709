// おもちゃのへや あなだらけ! — hole-specific toy physics, v2.
//
// v2 design rule: things FALL, they are not sucked. There is no horizontal
// pull toward the hole. An object drops only when the floor stops holding
// it up, and every entry into the hole is staged around the rim edge:
//
//   ストン   … footprint entirely over the void → clean free fall
//   ゴロン   … centre of mass over the hole, one side still on the rim
//              → pivots on the rim edge and topples in under gravity
//   するっ   … long thing, hole under ONE END → that end dips, the other
//              end lifts, and it slides in lengthwise. hole under the
//              MIDDLE → it honestly bridges the hole and just sags
//   ぎゅっ   … nearly hole-sized → drops into the mouth and wedges,
//              wobbles, then squeezes through or pops back out
//   ガタガタ … vehicle too big, a wheel dips in and rattles
//   コツン   … while falling inside, objects bump and bounce off the
//              shaft walls (no centring, just collisions)
//
// Extra life: fixtures that can only be SHAKEN so their toys creep off the
// edge, tall towers that cascade, a piñata chest, and a wind-up chick
// family that flees from the hole.
//
// Pure JS (no THREE) so node can run the whole sim headless in tests.

export const S = {
  REST: 'rest',
  TEETER: 'teeter',        // leaning over the edge, recoverable
  TOPPLE: 'topple',        // pivoting on the rim, committed
  ENDTIP: 'endTip',        // long object diving in end-first
  STUCK: 'stuck',          // wedged in the mouth
  BRIDGE: 'bridge',        // spans the hole, sags
  WHEEL: 'wheelCaught',    // wheel dipped in
  FALLING: 'falling',      // inside the shaft
  FLOATING: 'floating',    // bobbing on water in the hole
  LAUNCHED: 'launched',    // fired up out of the hole
  TOSSED: 'tossed',        // ballistic above ground
  BALLOON: 'balloon',      // hovering on a balloon
  WANDER: 'wander',        // walking toy (chick family)
  GONE: 'gone',
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function circleOverlapArea(r0, r1, d) {
  if (d >= r0 + r1) return 0;
  const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1);
  if (d <= rMax - rMin) return Math.PI * rMin * rMin;
  const d2 = d * d, a2 = r0 * r0, b2 = r1 * r1;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d2 + a2 - b2) / (2 * d * r0))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d2 + b2 - a2) / (2 * d * r1))));
  return a2 * (alpha - Math.sin(2 * alpha) / 2) + b2 * (beta - Math.sin(2 * beta) / 2);
}

const G = 26;
const HOLE_DEPTH = 7;
const WATER_Y = -0.62;

let nextId = 1;

export class Prop {
  constructor(desc, x, z) {
    this.id = nextId++;
    this.desc = desc;
    this.x = x; this.z = z; this.y = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = desc.yaw || 0;
    this.tiltX = 0; this.tiltZ = 0;
    this.spinAxis = [1, 0, 0];
    this.spin = 0; this.spinAngle = 0;
    this.state = desc.balloon ? S.BALLOON : desc.walker ? S.WANDER : S.REST;
    this.t = 0;
    this.sink = 0;
    this.wobble = 0; this.wobblePhase = 0;
    this.squash = 0;
    this.supportId = null;
    this.slideOx = 0; this.slideOz = 0;   // drift on top of a shaken support
    this.caughtWheel = -1;
    this.floatSinkAt = 0;
    this.bounces = 0;
    this.fear = 0;                        // 0..1, drives scared faces
    this.shakeT = 0;                      // furniture rattle amount
    // topple bookkeeping
    this.pivotX = 0; this.pivotZ = 0;
    this.tipDirX = 0; this.tipDirZ = 0;
    this.theta = 0; this.omega = 0;
    this.arm = 0; this.h0 = 0;
    // walker bookkeeping
    this.heading = 0; this.walkSpeed = 0;
    this.waypointX = 0; this.waypointZ = 0;
    this.peckT = 0; this.hopPhase = 0;
    this._rattleT = 0; this._sagT = 0; this._bumpT = 0;
  }
  get footR() { return this.desc.footR; }
  get slimR() { return this.desc.slimR; }
}

// sx/sy/sz: full extents as placed. options:
//  round, wheels, balloon, buoyant, waterSource      … as v1
//  fixture  … bolted furniture: never falls, never swallowed, can be shaken
//  topR     … usable radius of the top surface (items can be shaken off it)
//  walker   … wind-up toy that wanders and flees ({speed, flee})
//  pinata   … bursts into mini toys when swallowed
export function makeDesc(kind, sx, sy, sz, opt = {}) {
  const round = !!opt.round;
  const footR = round ? sx / 2 : Math.hypot(sx, sz) / 2;
  const dims = [sx, sy, sz].sort((a, b) => a - b);
  const slimR = round
    ? Math.min(footR, Math.hypot(sy, Math.min(sx, sz)) / 2)
    : Math.hypot(dims[0], dims[1]) / 2;
  return {
    kind, sx, sy, sz, round,
    footR,
    slimR: Math.min(slimR, footR),
    footInR: Math.min(sx, sz) / 2,
    halfLen: Math.max(sx, sz) / 2,
    aspect: Math.max(sx, sz) / Math.max(0.01, Math.min(sx, sz)),
    mass: Math.max(0.02, sx * sy * sz),
    wheels: opt.wheels || null,
    balloon: !!opt.balloon,
    buoyant: !!opt.buoyant,
    waterSource: !!opt.waterSource,
    fixture: !!opt.fixture,
    topR: opt.topR || 0,
    topY: opt.topY || sy,
    walker: opt.walker || null,
    pinata: !!opt.pinata,
    yaw: opt.yaw || 0,
    name: opt.name || kind,
  };
}

export class HoleEngine {
  constructor(opt = {}) {
    this.roomW = opt.roomW || 22;
    this.roomD = opt.roomD || 15;
    this.margin = opt.margin || 0.6;
    this.rand = mulberry32(opt.seed || 12345);
    this.props = [];
    this.byId = new Map();
    this.events = [];
    this.hole = {
      x: opt.holeX ?? 0, z: opt.holeZ ?? 0,
      r: opt.holeR ?? 0.5,
      rTarget: opt.holeR ?? 0.5,
      rShow: opt.holeR ?? 0.5,
      rVel: 0,
      vx: 0, vz: 0,
      water: 0,
      pluggedBy: 0,
    };
    this.holeTarget = { x: this.hole.x, z: this.hole.z };
    this.belly = [];
    this.projectile = null;
    this.swallowedCount = 0;
    this.maxHoleR = opt.maxHoleR || 4.6;
    this.waterTimer = 0;
    this.floatQueue = 0;
  }

  addProp(desc, x, z, opt = {}) {
    const p = new Prop(desc, x, z);
    if (opt.y != null) { p.y = opt.y; }
    if (opt.supportId) {
      p.supportId = opt.supportId;
      const sup = this.byId.get(opt.supportId);
      if (sup) { p.slideOx = x - sup.x; p.slideOz = z - sup.z; }
    }
    if (opt.yaw != null) p.yaw = opt.yaw;
    if (desc.walker) {
      p.walkSpeed = desc.walker.speed || 0.9;
      p.waypointX = x; p.waypointZ = z;
      p.heading = this.rand() * Math.PI * 2;
      if (opt.followId) p.followId = opt.followId;
    }
    if (opt.state) { p.state = opt.state; }
    if (opt.vx != null) { p.vx = opt.vx; p.vy = opt.vy || 0; p.vz = opt.vz || 0; }
    this.props.push(p);
    this.byId.set(p.id, p);
    return p;
  }

  emit(type, p, extra) {
    if (this.events.length < 64) this.events.push({ type, p, ...extra });
  }

  setHoleTarget(x, z) {
    const mw = this.roomW / 2 - this.margin, md = this.roomD / 2 - this.margin;
    this.holeTarget.x = Math.max(-mw, Math.min(mw, x));
    this.holeTarget.z = Math.max(-md, Math.min(md, z));
  }

  remaining() {
    let n = 0;
    for (const p of this.props) if (p.state !== S.GONE && !p.desc.fixture) n++;
    return n;
  }

  launch() {
    if (!this.belly.length || this.projectile) return false;
    const p = this.belly.pop();
    p.state = S.LAUNCHED; p.t = 0;
    p.x = this.hole.x; p.z = this.hole.z;
    p.y = 0.1;
    p.vx = (this.rand() - 0.5) * 1.2;
    p.vz = (this.rand() - 0.5) * 1.2;
    p.vy = 15 + this.hole.r * 1.2;
    p.spin = 6 + this.rand() * 6;
    p.spinAxis = this._randAxis();
    this.projectile = p;
    this.emit('launch', p);
    if (this.hole.water > 0) this.emit('geyser', p);
    return true;
  }

  _randAxis() {
    const a = this.rand() * Math.PI * 2;
    return [Math.cos(a), 0.3, Math.sin(a)];
  }

  _grow(p) {
    const h = this.hole;
    const gain = 0.42 * p.footR * p.footR + 0.012;
    h.rTarget = Math.min(this.maxHoleR, Math.sqrt(h.rTarget * h.rTarget + gain));
  }

  _swallow(p) {
    p.state = S.GONE;
    this.swallowedCount++;
    if (this.hole.pluggedBy === p.id) this.hole.pluggedBy = 0;
    this.emit('swallow', p, { sizeClass: p.footR });
    if (p.desc.walker) this.emit('catchWalker', p);
    this._grow(p);
    if (p.desc.waterSource) {
      this.hole.water = 1;
      this.waterTimer = 16;
      this.emit('waterFill', p);
    }
    if (p.desc.pinata) this.emit('pinata', p, { x: this.hole.x, z: this.hole.z });
    if (!p.desc.waterSource && !p.desc.walker && this.belly.length < 3) this.belly.push(p);
  }

  // spawn a burst of mini props (piñata contents). descs: [{desc, ...}]
  burstSpawn(descs, x, z) {
    const out = [];
    for (let i = 0; i < descs.length; i++) {
      const a = (i / descs.length) * Math.PI * 2 + this.rand();
      const p = this.addProp(descs[i], x, z, { state: S.TOSSED });
      p.y = 0.4;
      const sp = 2.2 + this.rand() * 2.2;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp;
      p.vy = 6.5 + this.rand() * 3.5;
      p.spin = 5 + this.rand() * 6; p.spinAxis = this._randAxis();
      p.bounces = 0;
      out.push(p);
    }
    return out;
  }

  _detachDependents(p, vigor = 1) {
    let level = 0;
    for (const q of this.props) {
      if (q.supportId !== p.id || q.state !== S.REST) continue;
      level++;
      this._detachDependents(q, vigor * 0.9);   // towers cascade upward
      q.supportId = null;
      q.state = S.TOSSED; q.t = -(level - 1) * 0.05; q.bounces = 0;
      // fly in the direction the support is tipping, higher blocks farther
      const dirx = p.tipDirX || (this.rand() - 0.5);
      const dirz = p.tipDirZ || (this.rand() - 0.5);
      const dl = Math.hypot(dirx, dirz) || 1;
      const sp = (0.7 + this.rand() * 0.9 + q.y * 0.55) * vigor;
      q.vx = (dirx / dl) * sp + (this.rand() - 0.5) * 0.8;
      q.vz = (dirz / dl) * sp + (this.rand() - 0.5) * 0.8;
      q.vy = 1.2 + this.rand() * 1.4;
      q.spin = 3 + this.rand() * 5;
      q.spinAxis = this._randAxis();
      this.emit('detach', q);
    }
  }

  _leaveRest(p) {
    if (this.hole.pluggedBy === p.id) this.hole.pluggedBy = 0;
    this._detachDependents(p);
  }

  // ------------------------------------------------------------ update
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    const h = this.hole;

    {
      const k = 10, dampK = 6.2;
      const ax = (this.holeTarget.x - h.x) * k - h.vx * dampK;
      const az = (this.holeTarget.z - h.z) * k - h.vz * dampK;
      h.vx += ax * dt; h.vz += az * dt;
      const sp = Math.hypot(h.vx, h.vz), maxSp = 7.5;
      if (sp > maxSp) { h.vx *= maxSp / sp; h.vz *= maxSp / sp; }
      h.x += h.vx * dt; h.z += h.vz * dt;
    }
    {
      const k = 34, damp = 5.4;
      h.rVel += (h.rTarget - h.rShow) * k * dt;
      h.rVel *= Math.exp(-damp * dt);
      h.rShow += h.rVel * dt;
      h.r += (h.rTarget - h.r) * Math.min(1, 7 * dt);
    }
    if (h.water > 0) {
      this.waterTimer -= dt;
      let anyFloating = false;
      for (const p of this.props) if (p.state === S.FLOATING) anyFloating = true;
      if (this.waterTimer <= 0 && !anyFloating) {
        h.water = Math.max(0, h.water - dt * 0.7);
        if (h.water === 0) this.emit('waterDrain');
      }
    }

    for (const p of this.props) this._updateProp(p, dt);
    this._separateResting(dt);
  }

  _updateProp(p, dt) {
    const h = this.hole;
    p.t += dt;
    p.wobblePhase += dt * 13;
    p.wobble *= Math.exp(-2.6 * dt);
    p.squash *= Math.exp(-6 * dt);
    p.shakeT *= Math.exp(-3.5 * dt);

    // fear drives scared faces: near hole (and big enough to matter)
    if (p.state === S.REST || p.state === S.TEETER || p.state === S.WANDER) {
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      const near = Math.max(0, 1 - d / (h.r + 2.2));
      p.fear += (near - p.fear) * Math.min(1, 5 * dt);
    } else if (p.state === S.GONE) {
      p.fear = 0;
    }

    switch (p.state) {
      case S.GONE: return;

      case S.BALLOON: {
        p.y = 1.05 + Math.sin(p.t * 1.4 + p.id) * 0.12;
        p.tiltX = Math.sin(p.t * 0.9 + p.id) * 0.06;
        p.tiltZ = Math.cos(p.t * 1.1 + p.id) * 0.06;
        const bd = Math.hypot(p.x - h.x, p.z - h.z);
        if (bd < h.r * 0.6 && h.r > Math.max(1.2, p.footR * 2.5)) {
          p._underT = (p._underT || 0) + dt;
          if (p._underT > 1.1) {
            p.state = S.TOSSED; p.t = 0; p.bounces = 0;
            p.vx = 0; p.vz = 0; p.vy = 0.6;
            this.emit('balloonFly', p);
          }
        } else {
          p._underT = 0;
        }
        return;
      }

      case S.WANDER: {
        this._updateWalker(p, dt);
        return;
      }

      case S.REST: {
        if (p.supportId) {
          const sup = this.byId.get(p.supportId);
          const holds = sup && (sup.state === S.REST || sup.state === S.TEETER ||
            sup.state === S.BRIDGE || sup.state === S.WHEEL || sup.desc.fixture);
          if (holds) {
            this._rideSupport(p, sup, dt);
            return;
          }
          p.supportId = null;
          p.state = S.TOSSED; p.t = 0; p.bounces = 0;
          p.vx = (this.rand() - 0.5) * 1.5;
          p.vz = (this.rand() - 0.5) * 1.5;
          p.vy = 1.5;
          this.emit('detach', p);
          return;
        }
        if (p.desc.fixture) { this._updateFixture(p, dt); return; }
        this._evaluateFloor(p, dt);
        return;
      }

      case S.TEETER: {
        this._evaluateFloor(p, dt);
        return;
      }

      case S.BRIDGE: {
        const still = this._bridgeStillValid(p);
        if (!still) { p.state = S.REST; p.t = 0; p.sink = 0; break; }
        p.sink = Math.min(0.05, p.sink + dt * 0.1);
        p._sagT -= dt;
        if (p._sagT <= 0) { p._sagT = 1.6 + this.rand(); this.emit('bridgeSag', p); p.wobble = Math.max(p.wobble, 0.25); }
        // parking the hole under it shakes toys off its top
        this._shakeTop(p, dt);
        return;
      }

      case S.TOPPLE: {
        // rigid pivot on the rim edge: gravity torque only
        p.omega += (G / Math.max(0.45, p.arm + p.h0)) * Math.sin(Math.min(1.4, p.theta + 0.35)) * dt;
        p.theta += p.omega * dt;
        const c = Math.cos(p.theta), s = Math.sin(p.theta);
        const a = p.arm * c + p.h0 * s;         // horizontal reach from pivot
        const b = p.h0 * c - p.arm * s;         // height of the "origin" corner
        p.x = p.pivotX + p.tipDirX * a;
        p.z = p.pivotZ + p.tipDirZ * a;
        p.y = Math.min(0, b - p.h0);
        p.tiltX = p.tipDirZ * p.theta;
        p.tiltZ = -p.tipDirX * p.theta;
        if (p.theta > 1.15 || p.y < -p.desc.sy * 0.4) {
          // let go of the rim: keep the swing as real velocity
          p.state = S.FALLING; p.t = 0;
          const tangential = p.omega * Math.hypot(p.arm, p.h0);
          p.vx = p.tipDirX * tangential * 0.55;
          p.vz = p.tipDirZ * tangential * 0.55;
          p.vy = -tangential * 0.75;
          p.spin = p.omega * 0.8;
          p.spinAxis = [p.tipDirZ, 0.12, -p.tipDirX];
          this.emit('fallStart', p, { style: 'topple' });
        }
        return;
      }

      case S.ENDTIP: {
        // long object dives end-first: pivot at the rim, rotate toward vertical
        p.omega += (G / Math.max(0.6, p.arm * 2)) * dt;
        p.theta = Math.min(Math.PI / 2 - 0.1, p.theta + p.omega * dt);
        const k = p.theta / (Math.PI / 2 - 0.1);
        p.tiltX = p.tipDirZ * p.theta;
        p.tiltZ = -p.tipDirX * p.theta;
        // origin slides toward the hole edge as the nose dives
        p.x += p.tipDirX * p.arm * 1.35 * p.omega * dt;
        p.z += p.tipDirZ * p.arm * 1.35 * p.omega * dt;
        p.sink = k * p.desc.sy * 0.3 + k * k * p.desc.halfLen * 0.5;
        if (k >= 1) {
          p.state = S.FALLING; p.t = 0;
          p.vy = -p.omega * p.arm * 1.4;
          p.vx = p.tipDirX * 0.6; p.vz = p.tipDirZ * 0.6;
          p.spin = 0.9; p.spinAxis = [p.tipDirZ, 0.1, -p.tipDirX];
          p.sink = 0;
          p.y = -p.desc.halfLen * 0.6;
          this.emit('fallStart', p, { style: 'endtip' });
        }
        return;
      }

      case S.STUCK: {
        const tight = p.slimR / Math.max(0.05, h.r);
        const targetSink = Math.min(p.desc.sy * 0.55, h.r * 0.8) * Math.min(1, 2.2 - tight);
        p.sink += (targetSink - p.sink) * Math.min(1, 6 * dt);
        // funnel contact: the mouth itself guides it to centre (not suction)
        p.x += (h.x - p.x) * Math.min(1, 8 * dt);
        p.z += (h.z - p.z) * Math.min(1, 8 * dt);
        p.wobble = Math.max(p.wobble, 0.5);
        p._rattleT -= dt;
        if (p._rattleT <= 0) { p._rattleT = 0.5; this.emit('stuckWobble', p); }
        this.hole.pluggedBy = p.id;
        const canSqueeze = p.slimR <= h.r * 1.03;
        if (p.t > (canSqueeze ? 1.5 : 2.6)) {
          this.hole.pluggedBy = 0;
          if (canSqueeze) {
            p.state = S.FALLING; p.t = 0; p.vy = -3.5;
            p.squash = -0.5;
            p.spin = 1 + this.rand() * 2; p.spinAxis = this._randAxis();
            this.emit('squeezeThrough', p);
          } else {
            p.state = S.TOSSED; p.t = 0; p.bounces = 0;
            const a = this.rand() * Math.PI * 2;
            p.x = h.x + Math.cos(a) * h.r * 0.4;
            p.z = h.z + Math.sin(a) * h.r * 0.4;
            p.vx = Math.cos(a) * (2.2 + this.rand());
            p.vz = Math.sin(a) * (2.2 + this.rand());
            p.vy = 6.5 + this.rand() * 2;
            p.sink = 0;
            p.spin = 4 + this.rand() * 4; p.spinAxis = this._randAxis();
            this.emit('popOut', p);
          }
        }
        return;
      }

      case S.WHEEL: {
        const w = p.desc.wheels[p.caughtWheel];
        const cw = this._wheelWorld(p, w);
        const over = Math.hypot(cw.x - h.x, cw.z - h.z) < h.r * 0.95 && h.pluggedBy === 0;
        if (!over || this._fitsCompact(p)) {
          p.caughtWheel = -1;
          if (this._fitsCompact(p) && Math.hypot(p.x - h.x, p.z - h.z) < h.r) {
            this._startTopple(p, { dramatic: true });
          } else {
            p.state = S.REST; p.t = 0; p.wobble = 0.8; p.sink = 0;
            this.emit('wheelFree', p);
          }
          return;
        }
        const dip = Math.min(0.4, w.r * 0.9 + h.r * 0.12);
        const lx = Math.cos(p.yaw) * w.x - Math.sin(p.yaw) * w.z;
        const lz = Math.sin(p.yaw) * w.x + Math.cos(p.yaw) * w.z;
        const len = Math.hypot(lx, lz) || 1e-4;
        const ang = Math.atan2(dip, Math.max(0.2, len * 2));
        p.tiltX += ((lz / len) * ang - p.tiltX) * 6 * dt;
        p.tiltZ += ((-lx / len) * ang - p.tiltZ) * 6 * dt;
        p.sink += (dip * 0.45 - p.sink) * 5 * dt;
        p._rattleT -= dt;
        if (p._rattleT <= 0) { p._rattleT = 0.28 + this.rand() * 0.15; p.wobble = Math.max(p.wobble, 0.5); this.emit('wheelRattle', p); }
        this._shakeTop(p, dt);
        return;
      }

      case S.FALLING: {
        p.vy -= G * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.spinAngle += p.spin * dt;
        // bounce off the shaft wall — no centring, just honest collisions
        if (p.y < 0.2) {
          const dx = p.x - h.x, dz = p.z - h.z;
          const dr = Math.hypot(dx, dz);
          const wallR = Math.max(0.05, h.r - p.slimR * 0.55);
          if (dr > wallR) {
            const nx = dx / (dr || 1e-4), nz = dz / (dr || 1e-4);
            p.x = h.x + nx * wallR;
            p.z = h.z + nz * wallR;
            const vr = p.vx * nx + p.vz * nz;
            if (vr > 0) {
              p.vx -= nx * vr * 1.45;
              p.vz -= nz * vr * 1.45;
              p.spin += vr * 1.5;
              p._bumpT -= dt;
              if (vr > 0.35 && p._bumpT <= 0) {
                p._bumpT = 0.12;
                this.emit('wallBump', p, { x: p.x, z: p.z, depth: -p.y, speed: vr });
              }
            }
          }
        }
        // slight drag so tumbling settles
        p.vx *= Math.exp(-0.35 * dt); p.vz *= Math.exp(-0.35 * dt);
        if (h.water > 0 && p.y < WATER_Y && !p._sank) {
          if (p.desc.buoyant || p.desc.mass < 0.09) {
            p.state = S.FLOATING; p.t = 0;
            p.vy = 0; p.y = WATER_Y;
            this.floatQueue++;
            p.floatSinkAt = 2.5 + this.floatQueue * 1.6;
            this.emit('splashFloat', p);
          } else if (!p._splashed) {
            p._splashed = true;
            this.emit('splash', p);
          }
        }
        if (p.y < -HOLE_DEPTH * Math.max(0.35, Math.min(1, p.desc.sy))) {
          this._swallow(p);
        }
        return;
      }

      case S.FLOATING: {
        p.y = WATER_Y + Math.sin(p.t * 3 + p.id * 2) * 0.05;
        p.tiltX = Math.sin(p.t * 2.2 + p.id) * 0.12;
        p.tiltZ = Math.cos(p.t * 1.8 + p.id) * 0.12;
        p.x += (h.x + Math.sin(p.t + p.id) * h.r * 0.3 - p.x) * 2 * dt;
        p.z += (h.z + Math.cos(p.t * 1.3 + p.id) * h.r * 0.3 - p.z) * 2 * dt;
        if (p.t > p.floatSinkAt) {
          p.state = S.FALLING; p.t = 0; p.vy = -0.8;
          p._sank = true;
          this.floatQueue = Math.max(0, this.floatQueue - 1);
          this.emit('glug', p);
        }
        return;
      }

      case S.LAUNCHED: {
        p.vy -= G * 0.78 * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.spinAngle += p.spin * dt;
        for (const q of this.props) {
          if (q.state !== S.BALLOON) continue;
          const dx = q.x - p.x, dz = q.z - p.z, dy = (q.y + q.desc.sy * 0.5 + 0.75) - p.y;
          if (dx * dx + dz * dz + dy * dy < 1.5) {
            q.state = S.TOSSED; q.t = 0; q.bounces = 0;
            q.vx = dx * 0.8; q.vz = dz * 0.8; q.vy = 1.2;
            q.spin = 3; q.spinAxis = this._randAxis();
            this.emit('balloonPop', q);
          }
        }
        if (p.vy < 0 && p.y <= 0) {
          p.y = 0;
          this.projectile = null;
          this.emit('land', p);
          this._shockwave(p);
          p.state = S.TOSSED; p.t = 0; p.bounces = 1;
          p.vy = 4.5; p.vx *= 0.5; p.vz *= 0.5;
        }
        return;
      }

      case S.TOSSED: {
        if (p.t < 0) return;          // staggered tower cascade
        p.vy -= G * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.spinAngle += p.spin * dt;
        const mw = this.roomW / 2 - 0.4, md = this.roomD / 2 - 0.4;
        if (p.x < -mw || p.x > mw) { p.vx *= -0.5; p.x = Math.max(-mw, Math.min(mw, p.x)); }
        if (p.z < -md || p.z > md) { p.vz *= -0.5; p.z = Math.max(-md, Math.min(md, p.z)); }
        // if it comes down over the hole, it just falls in — gravity!
        if (p.y <= 0.1 && p.vy < 0) {
          const d = Math.hypot(p.x - h.x, p.z - h.z);
          if (d < h.r * 0.9 && h.pluggedBy === 0 && p.slimR <= h.r * 1.02) {
            p.state = S.FALLING; p.t = 0;
            this.emit('fallStart', p, { style: 'clean' });
            return;
          }
        }
        if (p.vy < 0 && p.y <= 0) {
          p.y = 0;
          p.bounces++;
          this.emit('thud', p, { strength: Math.min(1, -p.vy / 8) });
          p.squash = Math.min(0.5, -p.vy * 0.06);
          if (p.bounces >= 3 || -p.vy < 2.2) {
            p.state = p.desc.walker ? S.WANDER : S.REST;
            p.t = 0;
            p.vx = 0; p.vz = 0; p.vy = 0;
            p.sink = 0; p.spinAngle = 0;
            p.tiltX = 0; p.tiltZ = 0;
            p.yaw = p.yaw + (this.rand() - 0.5) * 0.6;
          } else {
            p.vy = -p.vy * 0.42;
            p.vx *= 0.6; p.vz *= 0.6;
          }
        }
        return;
      }
    }
  }

  // items on a shaken support creep toward the edge and drop off
  _rideSupport(p, sup, dt) {
    p.tiltX *= Math.exp(-8 * dt); p.tiltZ *= Math.exp(-8 * dt);
    if (sup.shakeT > 0.05 && sup.desc.topR) {
      const r0 = Math.hypot(p.slideOx, p.slideOz);
      let dirx, dirz;
      if (r0 < 0.05) { const a = this.rand() * Math.PI * 2; dirx = Math.cos(a); dirz = Math.sin(a); }
      else { dirx = p.slideOx / r0; dirz = p.slideOz / r0; }
      const rate = (0.14 + this.hole.r * 0.07) * Math.min(1, sup.shakeT);
      p.slideOx += dirx * rate * dt;
      p.slideOz += dirz * rate * dt;
      p.wobble = Math.max(p.wobble, sup.shakeT * 0.5);
      const r1 = Math.hypot(p.slideOx, p.slideOz);
      if (r1 > sup.desc.topR) {
        // over the lip → real fall to the floor
        p.supportId = null;
        p.state = S.TOSSED; p.t = 0; p.bounces = 0;
        p.vx = dirx * (0.8 + this.rand() * 0.5);
        p.vz = dirz * (0.8 + this.rand() * 0.5);
        p.vy = 0.3;
        p.spin = 2 + this.rand() * 3; p.spinAxis = this._randAxis();
        this.emit('slideOff', p);
        return;
      }
    }
    p.x = sup.x + p.slideOx;
    p.z = sup.z + p.slideOz;
    // p.y keeps the height it was placed at (top of shelf, top of tower…)
  }

  // fixtures: bolted down; hole underneath only makes them rattle
  _updateFixture(p, dt) {
    const h = this.hole;
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    if (d < p.desc.footInR + h.r * 0.6) {
      p.shakeT = Math.min(1.2, p.shakeT + dt * 3);
      p._rattleT -= dt;
      if (p._rattleT <= 0) { p._rattleT = 0.3; this.emit('shakeRattle', p); }
      p.wobble = Math.max(p.wobble, 0.4);
    }
  }

  // shaking that furniture passes to whatever sits on it
  _shakeTop(p, dt) {
    const h = this.hole;
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    if (d < p.desc.footInR + h.r * 0.6 && p.desc.topR) {
      p.shakeT = Math.min(1.2, p.shakeT + dt * 3);
      p._rattleT -= dt;
      if (p._rattleT <= 0) { p._rattleT = 0.34; this.emit('shakeRattle', p); }
    }
  }

  _updateWalker(p, dt) {
    const h = this.hole;
    const w = p.desc.walker;
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    p.hopPhase += dt * (6 + p.walkSpeed * 4);

    // captured: centre of mass over the hole → in it goes (they always fit)
    if (d < h.r * 0.85 && h.pluggedBy === 0) {
      p.state = S.FALLING; p.t = 0;
      p.vx = 0; p.vz = 0; p.vy = -0.4;
      p.spin = 3 + this.rand() * 3; p.spinAxis = this._randAxis();
      this.emit('fallStart', p, { style: 'walker' });
      return;
    }

    const fleeR = 2.1 + h.r * 0.7;
    let speed, hx, hz;
    if (d < fleeR) {
      // flee straight away from the hole, hugging away from walls
      p.fleeing = true;
      p.peckT = 0;
      const ax = (p.x - h.x) / (d || 1e-4), az = (p.z - h.z) / (d || 1e-4);
      let tx = ax, tz = az;
      const mw = this.roomW / 2 - 1, md = this.roomD / 2 - 1;
      if (p.x + tx > mw || p.x + tx < -mw) tx = -tx * 0.3;
      if (p.z + tz > md || p.z + tz < -md) tz = -tz * 0.3;
      const ta = Math.atan2(tz, tx);
      p.heading += this._angleTo(p.heading, ta) * Math.min(1, 9 * dt);
      speed = w.flee || 2.2;
      p._cryT = (p._cryT || 0) - dt;
      if (p._cryT <= 0) { p._cryT = 0.5 + this.rand() * 0.4; this.emit('walkerCry', p); }
    } else {
      p.fleeing = false;
      // stroll: follow the parent, or amble between waypoints with pecks
      if (p.followId) {
        const lead = this.byId.get(p.followId);
        if (lead && (lead.state === S.WANDER || lead.state === S.TOSSED)) {
          const lx = lead.x - Math.cos(lead.heading) * 0.55;
          const lz = lead.z - Math.sin(lead.heading) * 0.55;
          const dd = Math.hypot(lx - p.x, lz - p.z);
          const ta = Math.atan2(lz - p.z, lx - p.x);
          p.heading += this._angleTo(p.heading, ta) * Math.min(1, 6 * dt);
          speed = dd > 1.4 ? p.walkSpeed * 1.6 : dd > 0.3 ? p.walkSpeed : 0;
        } else { speed = 0; }
      } else {
        p.peckT -= dt;
        if (p.peckT <= 0) {
          if (this.rand() < 0.35) {
            p.peckT = 0.8 + this.rand() * 0.8;   // stop and peck
            this.emit('peck', p);
            speed = 0;
          } else {
            p.peckT = 2.5 + this.rand() * 3;
            const mw = this.roomW / 2 - 2, md = this.roomD / 2 - 2;
            p.waypointX = (this.rand() * 2 - 1) * mw;
            p.waypointZ = (this.rand() * 2 - 1) * md;
          }
        }
        const ta = Math.atan2(p.waypointZ - p.z, p.waypointX - p.x);
        p.heading += this._angleTo(p.heading, ta) * Math.min(1, 3 * dt);
        const dd = Math.hypot(p.waypointX - p.x, p.waypointZ - p.z);
        speed = (p.peckT > 0 && dd < 0.3) ? 0 : p.walkSpeed;
        if (p.peckT > 0 && this.rand() < 0) speed = 0;
      }
      if (p.peckT > 0 && !p.followId && speed === 0) { /* pecking pause */ }
    }

    const sp = speed || 0;
    p.x += Math.cos(p.heading) * sp * dt;
    p.z += Math.sin(p.heading) * sp * dt;
    const mw = this.roomW / 2 - 0.8, md = this.roomD / 2 - 0.8;
    p.x = Math.max(-mw, Math.min(mw, p.x));
    p.z = Math.max(-md, Math.min(md, p.z));
    p.yaw = -p.heading + Math.PI / 2;
    // waddle hop
    p.y = sp > 0.05 ? Math.abs(Math.sin(p.hopPhase)) * (p.fleeing ? 0.09 : 0.045) : 0;
    p.tiltZ = sp > 0.05 ? Math.sin(p.hopPhase) * 0.08 : 0;
  }

  _angleTo(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  _wheelWorld(p, w) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    return { x: p.x + c * w.x - s * w.z, z: p.z + s * w.x + c * w.z, r: w.r };
  }

  _fitsCompact(p) { return p.slimR <= this.hole.r * 0.98; }

  _bridgeStillValid(p) {
    const h = this.hole;
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    if (p.desc.aspect >= 1.5) {
      const [e1, e2] = this._endpoints(p);
      const e1in = Math.hypot(e1.x - h.x, e1.z - h.z) < h.r * 0.9;
      const e2in = Math.hypot(e2.x - h.x, e2.z - h.z) < h.r * 0.9;
      return d < h.r + p.desc.footInR && !e1in && !e2in && !(p.footR <= h.r * 0.96);
    }
    return d + h.r * 0.85 < p.desc.footInR && !(p.slimR <= h.r * 1.16);
  }

  _endpoints(p) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const along = p.desc.sx >= p.desc.sz;   // builders lay length on local x
    const hl = p.desc.halfLen * 0.8;
    const ax = along ? c : -s, az = along ? s : c;
    return [
      { x: p.x + ax * hl, z: p.z + az * hl },
      { x: p.x - ax * hl, z: p.z - az * hl },
    ];
  }

  _startTopple(p, opts = {}) {
    const h = this.hole;
    const dx = p.x - h.x, dz = p.z - h.z;
    const d = Math.hypot(dx, dz);
    this._leaveRest(p);
    p.state = S.TOPPLE; p.t = 0;
    // pivot: rim point on the far (supported) side of the object
    const nx = d > 1e-3 ? dx / d : 1, nz = d > 1e-3 ? dz / d : 0;
    p.pivotX = h.x + nx * h.r;
    p.pivotZ = h.z + nz * h.r;
    p.tipDirX = -nx; p.tipDirZ = -nz;      // tipping toward the hole centre
    p.arm = Math.max(0.1, Math.hypot(p.x - p.pivotX, p.z - p.pivotZ));
    p.h0 = Math.max(0.08, p.desc.sy * 0.5);
    p.theta = Math.max(0.02, Math.hypot(p.tiltX, p.tiltZ));
    p.omega = 0.4;
    this.emit('topple', p, { rolling: !!p.desc.round, dramatic: !!opts.dramatic });
  }

  _startEndTip(p, end) {
    const h = this.hole;
    this._leaveRest(p);
    p.state = S.ENDTIP; p.t = 0;
    const dx = end.x - p.x, dz = end.z - p.z;
    const dl = Math.hypot(dx, dz) || 1e-4;
    p.tipDirX = dx / dl; p.tipDirZ = dz / dl;   // dive toward that end
    p.arm = p.desc.halfLen;
    p.theta = 0; p.omega = 0.5;
    p.h0 = p.desc.sy * 0.5;
    this.emit('tipStart', p);
  }

  // core decision table for a prop resting on the floor -------------------
  _evaluateFloor(p, dt) {
    const h = this.hole;
    const plugged = h.pluggedBy !== 0 && h.pluggedBy !== p.id;
    const dx = h.x - p.x, dz = h.z - p.z;
    const d = Math.hypot(dx, dz);
    const relax = Math.exp(-6 * dt);

    if (plugged || h.r < 0.05) { p.tiltX *= relax; p.tiltZ *= relax; this._settleState(p); return; }

    const footArea = Math.PI * p.footR * p.footR;
    const cov = circleOverlapArea(p.footR, h.r, d) / footArea;
    const fitsUpright = p.footR <= h.r * 0.96;
    const nearlyFits = p.slimR <= h.r * 1.18;
    const comOver = d < h.r;
    const elongated = p.desc.aspect >= 1.5;

    // 1. wheels first: body can't fit but a wheel is over the hole → ガタガタ
    if (p.desc.wheels && !this._fitsCompact(p)) {
      for (let i = 0; i < p.desc.wheels.length; i++) {
        const cw = this._wheelWorld(p, p.desc.wheels[i]);
        if (Math.hypot(cw.x - h.x, cw.z - h.z) + cw.r * 0.4 < h.r + 0.05 && h.r > cw.r * 0.7) {
          this._leaveRest(p);
          p.state = S.WHEEL; p.t = 0; p.caughtWheel = i; p._rattleT = 0;
          this.emit('wheelCatch', p);
          return;
        }
      }
    }

    // 2. whole footprint over the void → ストン (clean free fall)
    if (fitsUpright && d + p.footR <= h.r * 1.02) {
      this._leaveRest(p);
      p.state = S.FALLING; p.t = 0;
      p.vx = 0; p.vz = 0; p.vy = -0.5;
      p.spin = 0.6 + this.rand() * 1.2;
      p.spinAxis = this._randAxis();
      p.squash = -0.35;
      this.emit('fallStart', p, { style: 'clean' });
      return;
    }

    // 3. long things live and die by their ends
    if (elongated) {
      const [e1, e2] = this._endpoints(p);
      const d1 = Math.hypot(e1.x - h.x, e1.z - h.z);
      const d2 = Math.hypot(e2.x - h.x, e2.z - h.z);
      const e1in = d1 < h.r * 0.85, e2in = d2 < h.r * 0.85;
      const widthFits = p.slimR <= h.r * 0.96;

      if (e1in !== e2in && widthFits) {
        this._startEndTip(p, e1in ? e1 : e2);        // one end over → するっ
        return;
      }
      if (comOver && !e1in && !e2in) {
        // hole under the middle: an honest bridge — no swallow
        if (p.state !== S.BRIDGE) { p.state = S.BRIDGE; p.t = 0; this.emit('bridge', p); }
        return;
      }
      if (e1in && e2in && widthFits) {
        // hole ate the whole length → tips upright and slides in
        this._startEndTip(p, d1 < d2 ? e1 : e2);
        return;
      }
      if ((e1in || e2in) && !widthFits && nearlyFits && comOver) {
        this._leaveRest(p);
        p.state = S.STUCK; p.t = 0; p._rattleT = 0;
        this.emit('stuckStart', p);
        return;
      }
      // otherwise lean a little toward whichever end hangs over
      const overEnd = d1 < d2 ? e1 : e2;
      const covEnd = Math.max(0, 1 - Math.min(d1, d2) / (h.r + 0.4));
      if (covEnd * 0.14 <= 0.02) {
        p.tiltX *= relax; p.tiltZ *= relax;
        this._settleState(p);
        return;
      }
      this._applyTeeter(p, overEnd.x - p.x, overEnd.z - p.z, covEnd * 0.14, dt);
      return;
    }

    // 4. compact objects: giant ones bridge, near-fits wedge, fits topple
    const holeFullyUnder = d + h.r * 0.85 < p.desc.footInR;
    if (holeFullyUnder && !nearlyFits) {
      if (p.state !== S.BRIDGE) { p.state = S.BRIDGE; p.t = 0; this.emit('bridge', p); }
      return;
    }

    if (comOver) {
      if (this._fitsCompact(p) || fitsUpright) {
        this._startTopple(p);                        // ゴロン: rim-edge pivot
        return;
      }
      if (nearlyFits && cov >= 0.5) {
        this._leaveRest(p);
        p.state = S.STUCK; p.t = 0; p._rattleT = 0;  // ぎゅっ: wedges the mouth
        this.emit('stuckStart', p);
        return;
      }
    }

    // 5. COM still supported → lean over the edge, recoverable
    if (cov > 0.04) {
      const maxLean = (fitsUpright || this._fitsCompact(p)) ? 0.34 : 0.16;
      this._applyTeeter(p, dx, dz, maxLean * Math.min(1, cov * 2.2), dt);
      return;
    }

    p.tiltX *= relax; p.tiltZ *= relax;
    this._settleState(p);
  }

  _applyTeeter(p, dx, dz, lean, dt) {
    const dl = Math.hypot(dx, dz) || 1e-4;
    p.tiltX += ((dz / dl) * lean - p.tiltX) * 5 * dt;
    p.tiltZ += ((-dx / dl) * lean - p.tiltZ) * 5 * dt;
    if (p.state !== S.TEETER && lean > 0.02) {
      p.state = S.TEETER; p.t = 0;
      p.wobble = Math.max(p.wobble, 0.4);
      this.emit('teeter', p);
    }
  }

  _settleState(p) {
    if (p.state === S.TEETER && Math.abs(p.tiltX) < 0.02 && Math.abs(p.tiltZ) < 0.02) {
      p.state = S.REST; p.t = 0;
      p.wobble = Math.max(p.wobble, 0.3);
      this.emit('settle', p);
    }
  }

  _shockwave(src) {
    const R = 2.6 + src.footR * 1.5;
    this.emit('shock', src, { radius: R });
    for (const q of this.props) {
      if (q === src || q.state === S.GONE || q.state === S.BALLOON || q.desc.fixture) continue;
      const d = Math.hypot(q.x - src.x, q.z - src.z);
      if (d > R) continue;
      const f = 1 - d / R;
      if (q.supportId || q.y > 0.2) {
        const sup = q.supportId ? this.byId.get(q.supportId) : null;
        q.supportId = null;
        q.state = S.TOSSED; q.t = 0; q.bounces = 0;
        const a = Math.atan2(q.z - src.z, q.x - src.x) + (this.rand() - 0.5);
        q.vx = Math.cos(a) * (2 + 3 * f); q.vz = Math.sin(a) * (2 + 3 * f);
        q.vy = 3.5 + 3 * f;
        q.spin = 4 + this.rand() * 5; q.spinAxis = this._randAxis();
        this.emit('knockOff', q, { from: sup ? sup.id : 0 });
      } else if (q.state === S.REST || q.state === S.TEETER || q.state === S.WANDER) {
        if (q.desc.mass < 1.6 && !q.desc.walker) {
          q.state = S.TOSSED; q.t = 0; q.bounces = 2;
          const a = Math.atan2(q.z - src.z, q.x - src.x);
          q.vx = Math.cos(a) * 1.4 * f; q.vz = Math.sin(a) * 1.4 * f;
          q.vy = 1.6 + 2.4 * f;
        } else {
          q.wobble = Math.max(q.wobble, 0.7 * f);
        }
      }
    }
  }

  _separateResting(dt) {
    const ps = this.props;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.state !== S.REST && a.state !== S.TEETER && a.state !== S.WANDER) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.state !== S.REST && b.state !== S.TEETER && b.state !== S.WANDER) continue;
        if (a.supportId || b.supportId) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const minD = (a.desc.footInR + b.desc.footInR) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) * 1.6 * dt;
        const nx = dx / d, nz = dz / d;
        const fixedA = a.desc.fixture, fixedB = b.desc.fixture;
        if (fixedA && fixedB) continue;
        const wa = fixedA ? 0 : fixedB ? 1 : b.desc.mass / (a.desc.mass + b.desc.mass);
        a.x -= nx * push * wa; a.z -= nz * push * wa;
        b.x += nx * push * (1 - wa); b.z += nz * push * (1 - wa);
      }
    }
  }
}
