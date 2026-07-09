// ぐらぐらスイーツタワー — pure game logic (no THREE dependency, node-testable).

// ---------------------------------------------------------------- landing

// Judgement thresholds are generous on purpose: the player is 4 years old.
export const JUDGE = {
  PERFECT: 0.3,    // fraction of support radius → snap to centre, stars!
  GOOD: 0.62,      // lands where it hit (pulled a little toward centre)
  EDGE: 1.0,       // clings on, big wobble
};

/**
 * Judge where a tossed sweet lands relative to the current top piece.
 * dx/dz     : horizontal offset of the landing point from the top centre
 * rSupport  : effective radius of the piece we land on
 * rNew      : radius of the incoming piece
 * Returns { result, x, z } with x/z the (possibly magnet-adjusted) offset
 * the piece should keep, relative to the support centre.
 */
export function judgeLanding(dx, dz, rSupport, rNew) {
  const d = Math.hypot(dx, dz);
  const reach = rSupport + rNew * 0.45; // overhang tolerance
  if (d <= rSupport * JUDGE.PERFECT) {
    return { result: 'perfect', x: 0, z: 0 };
  }
  if (d <= rSupport * JUDGE.GOOD) {
    // friendly magnet: pull 35% toward the centre
    return { result: 'good', x: dx * 0.65, z: dz * 0.65 };
  }
  if (d <= reach) {
    // hanging on the edge — clamp so it stays visually attached
    const cl = Math.min(d, rSupport * 0.72);
    const s = cl / d;
    return { result: 'edge', x: dx * s, z: dz * s };
  }
  return { result: 'miss', x: dx, z: dz };
}

// ---------------------------------------------------------------- wobble

/**
 * Damped spring that drives the tower's lean angle.
 * `energy` (0..1+) is pumped in by sloppy landings and decays over time;
 * the render layer maps it to sway amplitude.
 */
export class WobbleSpring {
  constructor() {
    this.energy = 0;      // 0 calm … 1 danger
    this.phase = Math.random() * Math.PI * 2;
    this.dirX = 1;
    this.dirZ = 0;
  }
  pump(amount, dirX = 1, dirZ = 0) {
    this.energy = Math.min(1.6, this.energy + amount);
    const len = Math.hypot(dirX, dirZ) || 1;
    this.dirX = dirX / len;
    this.dirZ = dirZ / len;
  }
  calm(amount) {
    this.energy = Math.max(0, this.energy - amount);
  }
  step(dt) {
    // slow exponential decay; a touch faster when very agitated
    const rate = this.energy > 0.8 ? 0.22 : 0.13;
    this.energy = Math.max(0, this.energy - this.energy * rate * dt);
    this.phase += dt * (2.1 + this.energy * 3.4);
    return this.energy;
  }
  /** current lean offsets, unit-ish, to be scaled by the renderer */
  lean() {
    const s = Math.sin(this.phase);
    const c = Math.sin(this.phase * 0.63 + 1.7);
    return {
      x: s * this.dirX + c * 0.35 * this.dirZ,
      z: s * this.dirZ + c * 0.35 * this.dirX,
    };
  }
}

// ---------------------------------------------------------------- drift

/**
 * Sweets "settle" toward the tower axis over time so the stack never
 * walks away sideways forever. Mutates offsets in place, returns the
 * remaining top drift magnitude.
 * pieces: [{x, z, r}], offsets relative to the piece below.
 */
export function relaxOffsets(pieces, dt, rate = 0.055) {
  const k = Math.min(1, rate * dt);
  let cumX = 0, cumZ = 0;
  for (const p of pieces) {
    p.x -= p.x * k;
    p.z -= p.z * k;
    cumX += p.x;
    cumZ += p.z;
  }
  return Math.hypot(cumX, cumZ);
}

/** absolute centre of piece i given relative offsets */
export function absoluteCenters(pieces) {
  const out = [];
  let x = 0, z = 0;
  for (const p of pieces) {
    x += p.x;
    z += p.z;
    out.push({ x, z });
  }
  return out;
}

/**
 * How many pieces (from the top) should tumble off, judged by cumulative
 * overhang. Checkpoint pieces (giant pancakes) are firm and never counted
 * past. Returns 0 when the tower is fine. Kept deliberately forgiving.
 */
export function countToppling(pieces) {
  if (pieces.length < 2) return 0;
  const abs = absoluteCenters(pieces);
  let firstBad = -1;
  for (let i = 1; i < pieces.length; i++) {
    const below = pieces[i - 1];
    const dx = abs[i].x - abs[i - 1].x;
    const dz = abs[i].z - abs[i - 1].z;
    const d = Math.hypot(dx, dz);
    if (d > below.r * 1.05 && !pieces[i].checkpoint) {
      firstBad = i;
      break;
    }
  }
  if (firstBad < 0) return 0;
  return Math.min(3, pieces.length - firstBad);
}

// ---------------------------------------------------------------- score

export const HEIGHT_CM_PER_UNIT = 10; // world unit → fun "cm" number

export function scoreStars(count, perfects) {
  // finish-screen star rating: always at least 1 (never punish)
  if (count >= 25 || perfects >= 10) return 3;
  if (count >= 12 || perfects >= 4) return 2;
  return 1;
}

/** milestone every N pieces */
export const MILESTONE_EVERY = 5;
export function isMilestone(count) {
  return count > 0 && count % MILESTONE_EVERY === 0;
}
