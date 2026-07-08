// Floor state simulation on an N×N grid.
// Channels: foam, dirt, wet, glow (clean sparkle), paint RGB+amount, grow.
// Rendered through two RGBA8 DataTextures consumed by the floor shader.

import * as THREE from '../vendor/three.module.min.js';

export class FloorSim {
  constructor(N, size, config) {
    this.N = N;
    this.size = size;               // world width/depth of the floor
    this.cell = size / N;
    this.cfg = config;
    const n2 = N * N;
    this.foam = new Float32Array(n2);
    this.dirt = new Float32Array(n2);
    this.wet = new Float32Array(n2);
    this.glow = new Float32Array(n2);
    this.pr = new Float32Array(n2);
    this.pg = new Float32Array(n2);
    this.pb = new Float32Array(n2);
    this.pa = new Float32Array(n2);
    this.grow = new Float32Array(n2);   // 0..1 growing, 2 = bloomed
    this.soilMask = new Uint8Array(n2); // garden: where things can grow
    this.srcPaint = new Float32Array(n2 * 4); // bottomless puddles r,g,b,a
    this.srcWet = new Float32Array(n2);       // bottomless water, soft-edged
    this._foamBuf = new Float32Array(n2);

    this.dataA = new Uint8Array(n2 * 4);
    this.dataB = new Uint8Array(n2 * 4);
    this.texA = new THREE.DataTexture(this.dataA, N, N);
    this.texB = new THREE.DataTexture(this.dataB, N, N);
    for (const t of [this.texA, this.texB]) {
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    }

    this.events = [];        // consumed by main each frame
    this.collectors = [];    // corner foam collectors {x,z,amount,total}
    this.totalDirt0 = 0;
    this.totalFoam0 = 0;
    this.flowerCount = 0;
    this.paintCoverage = 0;
    this.dirtRatio = 0;
    this.foamRatio = 1;
    this._statTimer = 0;
    this._evClean = 0;       // event rate limiters
    this._evPop = 0;
  }

  idx(cx, cz) { return cz * this.N + cx; }
  cellOf(wx, wz) {
    const N = this.N, h = this.size / 2;
    const cx = Math.floor((wx + h) / this.size * N);
    const cz = Math.floor((wz + h) / this.size * N);
    return [Math.max(0, Math.min(N - 1, cx)), Math.max(0, Math.min(N - 1, cz))];
  }
  worldOf(cx, cz) {
    const h = this.size / 2;
    return [(cx + 0.5) / this.N * this.size - h, (cz + 0.5) / this.N * this.size - h];
  }

  // ------------------------------------------------- setup helpers (stages)
  splat(field, wx, wz, radius, amount, noise = 0) {
    const [c0x, c0z] = this.cellOf(wx, wz);
    const rr = Math.ceil(radius / this.cell);
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const cx = c0x + dx, cz = c0z + dz;
      if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) continue;
      const d = Math.hypot(dx, dz) * this.cell / radius;
      if (d > 1) continue;
      const fall = (1 - d * d) * (1 - noise * Math.random());
      const i = this.idx(cx, cz);
      field[i] = Math.min(1.5, field[i] + amount * Math.max(0, fall));
    }
  }

  addPaintPuddle(wx, wz, radius, color) {
    const c = new THREE.Color(color);
    const [c0x, c0z] = this.cellOf(wx, wz);
    const rr = Math.ceil(radius / this.cell);
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const cx = c0x + dx, cz = c0z + dz;
      if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) continue;
      const dd = Math.hypot(dx, dz) * this.cell;
      if (dd > radius) continue;
      const i = this.idx(cx, cz) * 4;
      this.srcPaint[i] = c.r; this.srcPaint[i + 1] = c.g; this.srcPaint[i + 2] = c.b;
      this.srcPaint[i + 3] = Math.min(1, (1 - dd / radius) * 3.2); // soft rim
    }
  }

  addWaterPuddle(wx, wz, radius) {
    const [c0x, c0z] = this.cellOf(wx, wz);
    const rr = Math.ceil(radius / this.cell);
    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const cx = c0x + dx, cz = c0z + dz;
      if (cx < 0 || cz < 0 || cx >= this.N || cz >= this.N) continue;
      const dd = Math.hypot(dx, dz) * this.cell;
      if (dd > radius) continue;
      const i = this.idx(cx, cz);
      this.srcWet[i] = Math.max(this.srcWet[i], Math.min(1, (1 - dd / radius) * 2.8));
    }
  }

  fillSoil(margin) {
    const m = Math.ceil(margin / this.cell);
    for (let cz = m; cz < this.N - m; cz++) for (let cx = m; cx < this.N - m; cx++) {
      this.soilMask[this.idx(cx, cz)] = 1;
    }
  }

  addCollector(wx, wz) { this.collectors.push({ x: wx, z: wz, amount: 0, popped: 0 }); }

  finalizeSetup() {
    let td = 0, tf = 0;
    for (let i = 0; i < this.dirt.length; i++) { td += this.dirt[i]; tf += this.foam[i]; }
    this.totalDirt0 = Math.max(td, 1e-6);
    this.totalFoam0 = Math.max(tf, 1e-6);
    this._writeTextures(0);
  }

  // ---------------------------------------------------------- roller trail
  // Called every frame the roller moves. dirx/dirz = unit travel direction.
  applyRoller(wx, wz, dirx, dirz, speed, dt, roller) {
    const cfg = this.cfg;
    const R = roller.footprint;                 // world radius of influence
    const [c0x, c0z] = this.cellOf(wx, wz);
    const rr = Math.ceil(R / this.cell);
    const pushK = Math.min(1, speed * 0.55);
    const N = this.N;
    // per-cell → per-footprint normalisation so ink/water budgets are
    // spent per second, not per covered cell
    const cellsInFoot = Math.max(8, Math.PI * rr * rr * 0.5);
    const drainNorm = 1 / cellsInFoot;
    let popped = 0, cleaned = 0, absorbedPaint = 0, absorbedWet = 0, onFoam = 0, onWet = 0;

    for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
      const cx = c0x + dx, cz = c0z + dz;
      if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
      const dist = Math.hypot(dx, dz) * this.cell;
      if (dist > R) continue;
      const i = this.idx(cx, cz);
      const w = 1 - (dist / R) * (dist / R);   // footprint falloff

      // --- foam: squeegee forward + outward
      if (cfg.foam && this.foam[i] > 0.004 && speed > 0.15) {
        const move = this.foam[i] * pushK * (0.55 + 0.45 * w);
        // push direction: travel + radial away from the roller centre
        let px = dirx * 0.8, pz = dirz * 0.8;
        if (dist > 1e-4) {
          px += (dx * this.cell / dist) * 0.6;
          pz += (dz * this.cell / dist) * 0.6;
        }
        const pl = Math.hypot(px, pz) || 1;
        const throwCells = 1.6 + speed * 1.1;
        const tx = cx + (px / pl) * throwCells;
        const tz = cz + (pz / pl) * throwCells;
        this.foam[i] -= move;
        this._depositBilinear(this.foam, tx, tz, move * 0.92);
        onFoam += this.foam[i] + move;
        // a little of the squashed foam pops
        if (Math.random() < move * 1.5) popped++;
      } else if (cfg.foam) {
        onFoam += this.foam[i];
      }

      // --- dirt: scrub. foam / wetness make it easier
      if (cfg.dirt && this.dirt[i] > 0) {
        const helper = 0.45 + 0.9 * Math.min(1, this.foam[i] * 2 + this.wet[i]);
        const before = this.dirt[i];
        this.dirt[i] = Math.max(0, before - speed * dt * cfg.scrubRate * helper * w);
        cleaned += before - this.dirt[i];
        if (before > 0.05 && this.dirt[i] <= 0.05) {
          this.glow[i] = 1;
          if (this._evClean <= 0) {
            const [ex, ez] = this.worldOf(cx, cz);
            this.events.push({ type: 'clean', x: ex, z: ez });
            this._evClean = 0.09;
          }
        }
      }

      // --- paint sources: soak the roller
      const si = i * 4;
      if (cfg.paint && this.srcPaint[si + 3] > 0) {
        const slot = roller.conePar;             // two cone families = two inks
        const cc = roller.carry[slot];
        cc.r = cc.r * 0.82 + this.srcPaint[si] * 0.18;
        cc.g = cc.g * 0.82 + this.srcPaint[si + 1] * 0.18;
        cc.b = cc.b * 0.82 + this.srcPaint[si + 2] * 0.18;
        cc.a = Math.min(1, cc.a + dt * 3.2 * w);
        absorbedPaint++;
      }
      // --- water sources: soak
      if (this.srcWet[i]) { roller.wetCharge = Math.min(1, roller.wetCharge + dt * 2.6 * w); absorbedWet++; }

      // --- deposit paint trail (alternating cone family ink → braided stripes)
      if (cfg.paint && speed > 0.12) {
        const cc = roller.carry[roller.conePar];
        if (cc.a > 0.01 && this.srcPaint[si + 3] === 0) {
          const dep = Math.min(cc.a, dt * 2.4) * w;
          const a0 = this.pa[i], a1 = Math.min(1, a0 + dep * 2.2);
          const mixv = a0 > 0.01 ? dep * 2.2 / a1 : 1;
          this.pr[i] += (cc.r - this.pr[i]) * mixv;
          this.pg[i] += (cc.g - this.pg[i]) * mixv;
          this.pb[i] += (cc.b - this.pb[i]) * mixv;
          this.pa[i] = a1;
          cc.a -= dt * 0.7 * drainNorm * w;  // ink lasts ≈3s of painting
        }
      }

      // --- wet trail
      if (cfg.wetTrail && roller.wetCharge > 0.01 && speed > 0.1 && !this.srcWet[i]) {
        const dep = Math.min(roller.wetCharge, dt * 2.0) * w;
        this.wet[i] = Math.min(1, this.wet[i] + dep * 3.0);
        roller.wetCharge -= dt * 0.9 * drainNorm * w;  // water lasts ≈2s of trail
      }
      if (this.srcWet[i] || this.wet[i] > 0.25) onWet += 1;
    }

    if (popped > 0) {
      if (this._evPop <= 0) {
        this.events.push({ type: 'foamPop', x: wx, z: wz, n: Math.min(popped, 3) });
        this._evPop = 0.06;
      }
    }

    // --- corner collectors: nearby foam drains into the big bubble
    if (cfg.collectors) {
      for (const col of this.collectors) {
        const [ccx, ccz] = this.cellOf(col.x, col.z);
        const cr = Math.ceil(1.15 / this.cell);
        let gathered = 0;
        for (let dz = -cr; dz <= cr; dz++) for (let dx = -cr; dx <= cr; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          if (cx < 0 || cz < 0 || cx >= N || cz >= N) continue;
          const i = this.idx(cx, cz);
          if (this.foam[i] > 0.01) {
            const take = this.foam[i] * 0.10;
            this.foam[i] -= take;
            gathered += take;
          }
        }
        if (gathered > 0) col.amount += gathered;
      }
    }

    return { onFoam: onFoam / Math.max(1, rr * rr), onWet: onWet / Math.max(1, rr * rr * 2), cleaned };
  }

  _depositBilinear(field, fx, fz, amount) {
    const N = this.N;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const ax = fx - x0, az = fz - z0;
    const put = (cx, cz, a) => {
      if (cx < 1 || cz < 1 || cx >= N - 1 || cz >= N - 1) return; // walls keep foam in
      const i = this.idx(cx, cz);
      field[i] = Math.min(2.2, field[i] + a);
    };
    put(x0, z0, amount * (1 - ax) * (1 - az));
    put(x0 + 1, z0, amount * ax * (1 - az));
    put(x0, z0 + 1, amount * (1 - ax) * az);
    put(x0 + 1, z0 + 1, amount * ax * az);
  }

  // --------------------------------------------------------------- update
  update(dt, time) {
    const N = this.N, cfg = this.cfg;
    this._evClean -= dt; this._evPop -= dt;

    // foam relaxation: tall piles slump onto lower neighbours (cheap, staggered rows)
    if (cfg.foam) {
      const f = this.foam, b = this._foamBuf;
      b.set(f);
      const row0 = (Math.floor(time * 60) % 2);
      for (let cz = 1 + row0; cz < N - 1; cz += 2) {
        for (let cx = 1; cx < N - 1; cx++) {
          const i = cz * N + cx;
          const v = f[i];
          if (v < 0.05) continue;
          const spill = (v > 1 ? 0.10 : 0.02) * v;
          b[i] -= spill * 4;                       // conserve (minus a little popping loss)
          const dep = spill * 0.96;
          b[i - 1] += dep; b[i + 1] += dep; b[i - N] += dep; b[i + N] += dep;
        }
      }
      this.foam.set(b);
    }

    // slow field decay / growth (full pass is cheap: N² ≤ 10k)
    const wetDecay = Math.pow(0.5, dt / cfg.wetHalfLife || 0);
    for (let i = 0; i < N * N; i++) {
      if (this.glow[i] > 0) this.glow[i] = Math.max(0, this.glow[i] - dt * 0.16);
      if (cfg.wetTrail && this.wet[i] > this.srcWet[i]) this.wet[i] = Math.max(this.srcWet[i], this.wet[i] * wetDecay);
      if (cfg.grow && this.soilMask[i] && !this.srcWet[i] && this.grow[i] < 1 && this.wet[i] > 0.18) {
        this.grow[i] += dt * 0.55 * this.wet[i];
        if (this.grow[i] >= 1) {
          this.grow[i] = 2;
          // only some cells carry a flower seed, and a blossom claims its
          // neighbourhood — keeps the flowerbed pretty, not a solid mat
          const h = Math.sin(i * 127.1) * 43758.5453;
          if (h - Math.floor(h) < 0.30) {
            const cx = i % N, cz = (i / N) | 0;
            for (let bz = -3; bz <= 3; bz++) for (let bx = -3; bx <= 3; bx++) {
              const nx = cx + bx, nz = cz + bz;
              if (nx >= 0 && nz >= 0 && nx < N && nz < N) {
                const ni = nz * N + nx;
                if (this.grow[ni] < 1) this.grow[ni] = 2;
              }
            }
            const [ex, ez] = this.worldOf(cx, cz);
            this.events.push({ type: 'bloom', x: ex, z: ez });
            this.flowerCount++;
          }
        }
      }
    }

    // water puddles stay wet
    if (cfg.wetTrail) for (let i = 0; i < N * N; i++) {
      if (this.srcWet[i] > 0 && this.wet[i] < this.srcWet[i]) this.wet[i] = this.srcWet[i];
    }

    this._statTimer -= dt;
    if (this._statTimer <= 0) {
      this._statTimer = 0.4;
      this._computeStats();
    }
    this._writeTextures(time);
  }

  _computeStats() {
    let d = 0, f = 0, p = 0;
    const n2 = this.N * this.N;
    for (let i = 0; i < n2; i++) {
      d += this.dirt[i];
      f += this.foam[i];
      if (this.pa[i] > 0.25 && this.srcPaint[i * 4 + 3] === 0) p++;
    }
    this.dirtRatio = d / this.totalDirt0;
    this.foamRatio = f / this.totalFoam0;
    this.paintCoverage = p / n2;
  }

  _writeTextures(time) {
    const n2 = this.N * this.N;
    const A = this.dataA, B = this.dataB;
    for (let i = 0; i < n2; i++) {
      const j = i * 4;
      A[j] = Math.min(255, this.dirt[i] * 255);
      A[j + 1] = Math.min(255, this.wet[i] * 255);
      A[j + 2] = Math.min(255, this.glow[i] * 255);
      A[j + 3] = Math.min(255, this.foam[i] * 200);
      const sp = this.srcPaint, s = sp[j + 3];
      if (s > 0) {
        B[j] = sp[j] * 255; B[j + 1] = sp[j + 1] * 255; B[j + 2] = sp[j + 2] * 255; B[j + 3] = s * 255;
      } else {
        B[j] = this.pr[i] * 255; B[j + 1] = this.pg[i] * 255; B[j + 2] = this.pb[i] * 255;
        B[j + 3] = Math.min(255, this.pa[i] * 255);
      }
    }
    this.texA.needsUpdate = true;
    this.texB.needsUpdate = true;
  }
}
