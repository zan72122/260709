// おもちゃのへや あなだらけ! — hole-specific toy physics.
//
// Not a general rigid-body engine: every behaviour is hand-shaped around the
// hole so each interaction reads clearly to a four-year-old:
//   ストン   … hole is clearly bigger  → clean straight drop
//   ころころ … round things roll in from the edge sooner than boxes
//   するっ   … long thin things tip up and slide in lengthwise
//   ぎゅっ   … nearly-same size        → wedges in the mouth, wobbles,
//              then squeezes through with a pop, or pops back out
//   ガタガタ … vehicle too big, but a wheel dips into the hole and rattles
//   ぐらぐら … partly over the edge    → teeters, springs back if hole leaves
//
// Pure JS (no THREE) so node can run the whole sim headless in tests.

export const S = {
  REST: 'rest',            // sitting on the floor (or on another prop)
  TEETER: 'teeter',        // leaning over the hole edge, can recover
  SLIDE_IN: 'slideIn',     // committed: sliding/rolling down into the hole
  TIP_IN: 'tipIn',         // long object rotating upright to slip through
  STUCK: 'stuck',          // wedged in the hole mouth, wobbling
  BRIDGE: 'bridge',        // hole entirely underneath but object far too big
  WHEEL: 'wheelCaught',    // a wheel dipped in, body can't fit
  FALLING: 'falling',      // inside the hole, going down
  FLOATING: 'floating',    // bobbing on water inside the hole
  LAUNCHED: 'launched',    // fired up out of the hole
  TOSSED: 'tossed',        // ballistic above ground (knocked off / popped out)
  BALLOON: 'balloon',      // hovering on a balloon, immune to the hole
  GONE: 'gone',            // swallowed
};

// deterministic RNG so tests can replay exact runs
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// area of intersection of two circles (r0 at distance d from r1)
export function circleOverlapArea(r0, r1, d) {
  if (d >= r0 + r1) return 0;
  const rMin = Math.min(r0, r1), rMax = Math.max(r0, r1);
  if (d <= rMax - rMin) return Math.PI * rMin * rMin;
  const d2 = d * d, a2 = r0 * r0, b2 = r1 * r1;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d2 + a2 - b2) / (2 * d * r0))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d2 + b2 - a2) / (2 * d * r1))));
  return a2 * (alpha - Math.sin(2 * alpha) / 2) + b2 * (beta - Math.sin(2 * beta) / 2);
}

const G = 26;              // cartoon gravity: snappy, weighty falls
const HOLE_DEPTH = 7;      // how far things fall before vanishing
const WATER_Y = -0.62;     // water surface height inside the hole

let nextId = 1;

export class Prop {
  constructor(desc, x, z) {
    this.id = nextId++;
    this.desc = desc;
    this.x = x; this.z = z; this.y = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = desc.yaw || 0;
    this.tiltX = 0; this.tiltZ = 0;       // small world-axis leans (rad)
    this.spinAxis = [1, 0, 0];            // free-fall tumble axis
    this.spin = 0; this.spinAngle = 0;
    this.state = desc.balloon ? S.BALLOON : S.REST;
    this.t = 0;                           // time in current state
    this.sink = 0;                        // extra downward visual offset
    this.wobble = 0; this.wobblePhase = 0;
    this.squash = 0;                      // >0 squash, <0 stretch (render hint)
    this.supportId = null;                // prop we are resting on
    this.restY = 0;                       // floor/support height we rest at
    this.caughtWheel = -1;
    this.floatSinkAt = 0;
    this.bounces = 0;
    this._rattleT = 0;
    this._sagT = 0;
  }
  get footR() { return this.desc.footR; }
  get slimR() { return this.desc.slimR; }
}

// Shape descriptor helper. sx/sy/sz are full extents as placed in the room.
//  round     … circular footprint (balls, drums): rolls into the hole early
//  aspect    … length/width; >1.5 unlocks the lengthwise "tip in" move
//  wheels    … [{x, z, r}] local offsets; enables the wheel-catch behaviour
export function makeDesc(kind, sx, sy, sz, opt = {}) {
  const round = !!opt.round;
  const footR = round ? sx / 2 : Math.hypot(sx, sz) / 2;
  const dims = [sx, sy, sz].sort((a, b) => a - b);
  // best-orientation pass radius: for cylinders the sideways cross-section
  // still spans the diameter, so never report thinner than upright entry
  const slimR = round
    ? Math.min(footR, Math.hypot(sy, Math.min(sx, sz)) / 2)
    : Math.hypot(dims[0], dims[1]) / 2;
  return {
    kind, sx, sy, sz, round,
    footR,
    slimR: Math.min(slimR, footR),
    footInR: Math.min(sx, sz) / 2,
    aspect: Math.max(sx, sz) / Math.max(0.01, Math.min(sx, sz)),
    mass: Math.max(0.02, sx * sy * sz),
    wheels: opt.wheels || null,
    balloon: !!opt.balloon,
    buoyant: !!opt.buoyant,
    waterSource: !!opt.waterSource,
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
      rShow: opt.holeR ?? 0.5,        // rendered radius (elastic wobble)
      rVel: 0,
      vx: 0, vz: 0,
      water: 0,                       // 0..1 water fill
      pluggedBy: 0,                   // prop id wedged in the mouth
    };
    this.holeTarget = { x: this.hole.x, z: this.hole.z };
    this.belly = [];                  // swallowed props available to launch
    this.projectile = null;           // currently launched prop
    this.swallowedCount = 0;
    this.maxHoleR = opt.maxHoleR || 4.6;
    this.waterTimer = 0;
    this.floatQueue = 0;
  }

  addProp(desc, x, z, opt = {}) {
    const p = new Prop(desc, x, z);
    if (opt.y != null) { p.y = opt.y; p.restY = opt.y; }
    if (opt.supportId) p.supportId = opt.supportId;
    if (opt.yaw != null) p.yaw = opt.yaw;
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

  // number of props a player can still remove from the room
  remaining() {
    let n = 0;
    for (const p of this.props) if (p.state !== S.GONE) n++;
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

  _swallow(p, opts = {}) {
    p.state = S.GONE;
    this.swallowedCount++;
    if (this.hole.pluggedBy === p.id) this.hole.pluggedBy = 0;
    if (!opts.silent) this.emit('swallow', p, { sizeClass: p.footR });
    this._grow(p);
    if (p.desc.waterSource) {
      this.hole.water = 1;
      this.waterTimer = 16;
      this.emit('waterFill', p);
    }
    if (!p.desc.waterSource && this.belly.length < 3) this.belly.push(p);
    // anything stacked on it has already detached when it left REST
  }

  _detachDependents(p, vigor = 1) {
    for (const q of this.props) {
      if (q.supportId !== p.id || q.state !== S.REST) continue;
      q.supportId = null;
      q.state = S.TOSSED; q.t = 0; q.bounces = 0;
      const a = this.rand() * Math.PI * 2;
      const sp = (0.9 + this.rand() * 1.4) * vigor;
      q.vx = Math.cos(a) * sp + p.vx * 0.4;
      q.vz = Math.sin(a) * sp + p.vz * 0.4;
      q.vy = 2.6 + this.rand() * 2.2 * vigor;
      q.spin = 3 + this.rand() * 5;
      q.spinAxis = this._randAxis();
      this.emit('detach', q);
    }
  }

  _leaveRest(p) {
    if (this.hole.pluggedBy === p.id) this.hole.pluggedBy = 0;
    this._detachDependents(p);
  }

  // main integration -------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    const h = this.hole;

    // hole glides to its target (critically damped-ish spring, capped speed)
    {
      const k = 10, dampK = 6.2;
      let ax = (this.holeTarget.x - h.x) * k - h.vx * dampK;
      let az = (this.holeTarget.z - h.z) * k - h.vz * dampK;
      h.vx += ax * dt; h.vz += az * dt;
      const sp = Math.hypot(h.vx, h.vz), maxSp = 7.5;
      if (sp > maxSp) { h.vx *= maxSp / sp; h.vz *= maxSp / sp; }
      h.x += h.vx * dt; h.z += h.vz * dt;
    }
    // radius eases with a springy overshoot so the rim "gulps" as it grows
    {
      const k = 34, damp = 5.4;
      h.rVel += (h.rTarget - h.rShow) * k * dt;
      h.rVel *= Math.exp(-damp * dt);
      h.rShow += h.rVel * dt;
      h.r += (h.rTarget - h.r) * Math.min(1, 7 * dt);
    }
    // water drains after its moment passes
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

    switch (p.state) {
      case S.GONE: return;

      case S.BALLOON: {
        // hovering gift: bobs gently, immune to the hole until popped.
        // rescue rule: if the hole grows huge and waits right underneath,
        // the balloon slips its knot and floats away (no launcher needed).
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

      case S.REST: {
        if (p.supportId) {
          const sup = this.byId.get(p.supportId);
          if (sup && (sup.state === S.REST || sup.state === S.TEETER || sup.state === S.BRIDGE)) {
            p.tiltX *= Math.exp(-8 * dt); p.tiltZ *= Math.exp(-8 * dt);
            return;   // safely stacked above the floor: hole can't reach it
          }
          // safety net: support vanished without detaching us → drop free
          p.supportId = null;
          p.state = S.TOSSED; p.t = 0; p.bounces = 0;
          p.vx = (this.rand() - 0.5) * 1.5;
          p.vz = (this.rand() - 0.5) * 1.5;
          p.vy = 1.5;
          this.emit('detach', p);
          return;
        }
        this._evaluateFloor(p, dt);
        return;
      }

      case S.TEETER: {
        this._evaluateFloor(p, dt);
        return;
      }

      case S.BRIDGE: {
        // far too big: spans the hole, sags a little in the middle
        const d = Math.hypot(p.x - h.x, p.z - h.z);
        if (!(d + h.r * 0.85 < p.desc.footInR)) {
          p.state = S.REST; p.t = 0; p.sink = 0;
          break;
        }
        p.sink = Math.min(0.05, p.sink + dt * 0.1);
        p._sagT -= dt;
        if (p._sagT <= 0) { p._sagT = 1.6 + this.rand(); this.emit('bridgeSag', p); p.wobble = Math.max(p.wobble, 0.25); }
        this._maybeUpgradeBridge(p);
        return;
      }

      case S.SLIDE_IN: {
        // committed: pulled to the centre, leaning in, then drops
        const dx = h.x - p.x, dz = h.z - p.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        const pull = 14;
        p.vx += (dx / d) * pull * dt; p.vz += (dz / d) * pull * dt;
        const sp = Math.hypot(p.vx, p.vz), mx = 6;
        if (sp > mx) { p.vx *= mx / sp; p.vz *= mx / sp; }
        p.x += p.vx * dt; p.z += p.vz * dt;
        // lean toward the hole as it slides
        p.tiltX += ((dz / d) * 0.55 - p.tiltX) * 7 * dt;
        p.tiltZ += ((-dx / d) * 0.55 - p.tiltZ) * 7 * dt;
        p.sink = Math.min(p.sink + dt * 1.6, p.desc.sy * 0.35);
        if (d < Math.max(0.12, h.r - p.footR * 0.55)) {
          p.state = S.FALLING; p.t = 0;
          p.vy = -1.5;
          p.spin = 2.5 + this.rand() * 3;
          p.spinAxis = [dz / d, 0.4, -dx / d];
          this.emit('fallStart', p, { style: 'slide' });
        }
        return;
      }

      case S.TIP_IN: {
        // long thing rotates upright over the rim and slips through
        const dur = 0.55;
        const k = Math.min(1, p.t / dur);
        const ease = k * k * (3 - 2 * k);
        const tip = ease * (Math.PI / 2 - 0.12);
        const dx = h.x - p.x, dz = h.z - p.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        p.tiltX = (dz / d) * tip;
        p.tiltZ = (-dx / d) * tip;
        p.x += dx * 3 * dt; p.z += dz * 3 * dt;
        p.sink = ease * p.desc.sy * 0.25;
        if (k >= 1) {
          p.state = S.FALLING; p.t = 0; p.vy = -2;
          p.spin = 1.2; p.spinAxis = [dz / d, 0.15, -dx / d];
          this.emit('fallStart', p, { style: 'tip' });
        }
        return;
      }

      case S.STUCK: {
        // wedged in the mouth: sink partway, wobble, then resolve
        const tight = p.slimR / Math.max(0.05, h.r);   // ~0.95..1.2
        const targetSink = Math.min(p.desc.sy * 0.55, h.r * 0.8) * Math.min(1, 2.2 - tight);
        p.sink += (targetSink - p.sink) * Math.min(1, 6 * dt);
        p.x += (h.x - p.x) * Math.min(1, 8 * dt);
        p.z += (h.z - p.z) * Math.min(1, 8 * dt);
        p.wobble = Math.max(p.wobble, 0.5);
        p._rattleT -= dt;
        if (p._rattleT <= 0) { p._rattleT = 0.5; this.emit('stuckWobble', p); }
        this.hole.pluggedBy = p.id;
        // hole grew enough while wedged → let it through
        const canSqueeze = p.slimR <= h.r * 1.03;
        if (p.t > (canSqueeze ? 1.5 : 2.6)) {
          this.hole.pluggedBy = 0;
          if (canSqueeze) {
            p.state = S.FALLING; p.t = 0; p.vy = -3.5;
            p.squash = -0.5;               // stretched as it pops through
            p.spin = 1 + this.rand() * 2; p.spinAxis = this._randAxis();
            this.emit('squeezeThrough', p);
          } else {
            // spit back out beside the hole
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
        if (!over || this._bodyFits(p)) {
          // wheel freed (hole moved away) or hole is now big enough
          p.caughtWheel = -1;
          if (this._bodyFits(p) && this._centerOver(p)) {
            p.state = S.SLIDE_IN; p.t = 0;
            this.emit('slideStart', p, { dramatic: true });
          } else {
            p.state = S.REST; p.t = 0; p.wobble = 0.8; p.sink = 0;
            this.emit('wheelFree', p);
          }
          return;
        }
        // dip toward the caught wheel and rattle
        const dip = Math.min(0.4, w.r * 0.9 + h.r * 0.12);
        const lx = Math.cos(p.yaw) * w.x - Math.sin(p.yaw) * w.z;
        const lz = Math.sin(p.yaw) * w.x + Math.cos(p.yaw) * w.z;
        const len = Math.hypot(lx, lz) || 1e-4;
        const ang = Math.atan2(dip, Math.max(0.2, len * 2));
        p.tiltX += ((lz / len) * ang - p.tiltX) * 6 * dt;
        p.tiltZ += ((-lx / len) * ang - p.tiltZ) * 6 * dt;
        p.sink += (dip * 0.45 - p.sink) * 5 * dt;
        // dragged very slightly toward the hole
        p.x += (h.x - cw.x) * 0.25 * dt;
        p.z += (h.z - cw.z) * 0.25 * dt;
        p._rattleT -= dt;
        if (p._rattleT <= 0) { p._rattleT = 0.28 + this.rand() * 0.15; p.wobble = Math.max(p.wobble, 0.5); this.emit('wheelRattle', p); }
        return;
      }

      case S.FALLING: {
        p.vy -= G * dt;
        p.y += p.vy * dt;
        // funneled toward the hole axis while falling
        p.x += (h.x - p.x) * Math.min(1, 6 * dt);
        p.z += (h.z - p.z) * Math.min(1, 6 * dt);
        p.spinAngle += p.spin * dt;
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
          p._sank = true;                 // don't bob back up
          this.floatQueue = Math.max(0, this.floatQueue - 1);
          this.emit('glug', p);
        }
        return;
      }

      case S.LAUNCHED: {
        p.vy -= G * 0.78 * dt;   // floatier arc: readable, fun
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.spinAngle += p.spin * dt;
        // pop balloons on the way
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
        p.vy -= G * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.spinAngle += p.spin * dt;
        const mw = this.roomW / 2 - 0.4, md = this.roomD / 2 - 0.4;
        if (p.x < -mw || p.x > mw) { p.vx *= -0.5; p.x = Math.max(-mw, Math.min(mw, p.x)); }
        if (p.z < -md || p.z > md) { p.vz *= -0.5; p.z = Math.max(-md, Math.min(md, p.z)); }
        if (p.vy < 0 && p.y <= 0) {
          p.y = 0;
          p.bounces++;
          this.emit('thud', p, { strength: Math.min(1, -p.vy / 8) });
          p.squash = Math.min(0.5, -p.vy * 0.06);
          if (p.bounces >= 3 || -p.vy < 2.2) {
            p.state = S.REST; p.t = 0;
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

  _wheelWorld(p, w) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    return { x: p.x + c * w.x - s * w.z, z: p.z + s * w.x + c * w.z, r: w.r };
  }

  _bodyFits(p) { return p.slimR <= this.hole.r * 0.98; }
  _centerOver(p) { return Math.hypot(p.x - this.hole.x, p.z - this.hole.z) < this.hole.r; }

  _maybeUpgradeBridge(p) {
    // while bridging, the hole may have grown enough for real trouble
    const h = this.hole;
    if (p.footR <= h.r * 0.96 || p.slimR <= h.r * 1.16) {
      p.state = S.REST; p.t = 0; p.sink = 0;
    }
  }

  // core decision table for a prop resting on the floor -------------------
  _evaluateFloor(p, dt) {
    const h = this.hole;
    const plugged = h.pluggedBy !== 0 && h.pluggedBy !== p.id;
    const d = Math.hypot(p.x - h.x, p.z - h.z);

    // relax back upright by default; teeter re-applies its lean below
    const relax = Math.exp(-6 * dt);

    if (plugged || h.r < 0.05) { p.tiltX *= relax; p.tiltZ *= relax; this._settleState(p); return; }

    const footArea = Math.PI * p.footR * p.footR;
    const cov = circleOverlapArea(p.footR, h.r, d) / footArea;
    const fitsUpright = p.footR <= h.r * 0.96;
    const fitsSlim = p.slimR <= h.r * 0.96;
    const nearlyFits = p.slimR <= h.r * 1.18;
    const holeFullyUnder = d + h.r * 0.9 < p.desc.footInR;

    // 1. giant object: hole disappears underneath → bridge (sags, no fall)
    if (holeFullyUnder && !nearlyFits) {
      if (p.state !== S.BRIDGE) { p.state = S.BRIDGE; p.t = 0; this.emit('bridge', p); }
      return;
    }

    // 2. entire footprint inside a clearly-bigger hole → ストン!
    if (fitsUpright && d + p.footR <= h.r * 1.02) {
      this._leaveRest(p);
      p.state = S.FALLING; p.t = 0;
      p.vy = -0.5;
      p.spin = 0.6 + this.rand() * 1.2;
      p.spinAxis = this._randAxis();
      p.squash = -0.35;               // slight stretch on the clean drop
      this.emit('fallStart', p, { style: 'clean' });
      return;
    }

    // 3. wheels: body can't fit, but a wheel is over the hole → ガタガタ
    if (p.desc.wheels && !fitsSlim) {
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

    if (cov <= 0.04) { p.tiltX *= relax; p.tiltZ *= relax; this._settleState(p); return; }

    // 4. commitment thresholds: round things roll in early, boxes need half
    const commitCov = p.desc.round ? 0.30 : 0.55;
    const centerOver = d < h.r;

    // long thin things (crayons, shelves…): their circumscribed footprint
    // circle is huge, so judge by "hole sits under the middle and is wider
    // than the body" instead of coverage → するっ tip-in
    if (!fitsUpright && fitsSlim && p.desc.aspect >= 1.5 && centerOver
        && d < h.r * 0.75 && cov >= 0.15) {
      this._leaveRest(p);
      p.state = S.TIP_IN; p.t = 0;
      this.emit('tipStart', p);
      return;
    }

    if (cov >= commitCov && centerOver) {
      if (fitsUpright) {
        this._leaveRest(p);
        p.state = S.SLIDE_IN; p.t = 0;
        p.vx = 0; p.vz = 0;
        this.emit('slideStart', p, { rolling: !!p.desc.round });
        return;
      }
      if (nearlyFits && cov >= 0.6) {
        this._leaveRest(p);
        p.state = S.STUCK; p.t = 0; p._rattleT = 0;
        this.emit('stuckStart', p);
        return;
      }
    }

    // 5. otherwise: teeter over the edge — recoverable lean + wobble
    const dx = h.x - p.x, dz = h.z - p.z;
    const dl = Math.hypot(dx, dz) || 1e-4;
    const maxLean = (fitsUpright || fitsSlim) ? 0.34 : 0.16;
    const lean = maxLean * Math.min(1, cov * 2.2);
    p.tiltX += ((dz / dl) * lean - p.tiltX) * 5 * dt;
    p.tiltZ += ((-dx / dl) * lean - p.tiltZ) * 5 * dt;
    // round things creep toward the hole while teetering (starting to roll)
    if (p.desc.round && cov > 0.1) {
      p.x += (dx / dl) * cov * 1.6 * dt;
      p.z += (dz / dl) * cov * 1.6 * dt;
    }
    if (p.state !== S.TEETER) {
      p.state = S.TEETER; p.t = 0;
      p.wobble = Math.max(p.wobble, 0.4);
      this.emit('teeter', p);
    }
  }

  _settleState(p) {
    if (p.state === S.TEETER && Math.abs(p.tiltX) < 0.02 && Math.abs(p.tiltZ) < 0.02) {
      p.state = S.REST; p.t = 0;
      p.wobble = Math.max(p.wobble, 0.3);   // jelly spring-back
      this.emit('settle', p);
    }
  }

  _shockwave(src) {
    const R = 2.6 + src.footR * 1.5;
    this.emit('shock', src, { radius: R });
    for (const q of this.props) {
      if (q === src || q.state === S.GONE || q.state === S.BALLOON) continue;
      const d = Math.hypot(q.x - src.x, q.z - src.z);
      if (d > R) continue;
      const f = 1 - d / R;
      if (q.supportId || q.y > 0.2) {
        // knocked clean off its shelf/table
        const sup = q.supportId ? this.byId.get(q.supportId) : null;
        q.supportId = null;
        q.state = S.TOSSED; q.t = 0; q.bounces = 0;
        const a = Math.atan2(q.z - src.z, q.x - src.x) + (this.rand() - 0.5);
        q.vx = Math.cos(a) * (2 + 3 * f); q.vz = Math.sin(a) * (2 + 3 * f);
        q.vy = 3.5 + 3 * f;
        q.spin = 4 + this.rand() * 5; q.spinAxis = this._randAxis();
        this.emit('knockOff', q, { from: sup ? sup.id : 0 });
      } else if (q.state === S.REST || q.state === S.TEETER) {
        // floor items give a happy little hop
        if (q.desc.mass < 1.6) {
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

  // gentle pairwise separation so resting toys don't interpenetrate
  _separateResting(dt) {
    const ps = this.props;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.state !== S.REST && a.state !== S.TEETER) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.state !== S.REST && b.state !== S.TEETER) continue;
        if (a.supportId || b.supportId) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const minD = (a.desc.footInR + b.desc.footInR) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) * 1.6 * dt;
        const nx = dx / d, nz = dz / d;
        const wa = b.desc.mass / (a.desc.mass + b.desc.mass);
        a.x -= nx * push * wa; a.z -= nz * push * wa;
        b.x += nx * push * (1 - wa); b.z += nz * push * (1 - wa);
      }
    }
  }
}
