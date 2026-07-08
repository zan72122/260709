// しずく:霧のつぶ・糸をつたう色水・交点でぷるっ
import * as THREE from 'three';
import { rand, clamp, mixHex } from './utils.js';

const MAX_BEADS = 300;  // 糸についた小さなつぶ
const MAX_DROPS = 48;   // ころがる大きなしずく
const GRAV = 3.8;

export class DropSystem {
  constructor(parent, threadMgr, stains, sparkles, audio) {
    this.threadMgr = threadMgr;
    this.stains = stains;
    this.sparkles = sparkles;
    this.audio = audio;
    this.onEvent = null; // ゴール用イベント通知 (name)

    // 小さなつぶ(InstancedMesh)
    const beadGeo = new THREE.SphereGeometry(1, 8, 6);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xdff3ff, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.85, envMapIntensity: 2.5,
    });
    this.beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, MAX_BEADS);
    this.beadMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beadMesh.count = 0;
    this.beadMesh.frustumCulled = false;
    parent.add(this.beadMesh);
    this.beads = []; // {thread, s, size}

    // ころがるしずく(InstancedMesh + 色つき)
    const dropGeo = new THREE.SphereGeometry(1, 12, 10);
    const dropMat = new THREE.MeshStandardMaterial({
      roughness: 0.04, metalness: 0,
      transparent: true, opacity: 0.9, envMapIntensity: 3,
    });
    this.dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    parent.add(this.dropMesh);
    // ころがる: {thread,s,vel,size,color,water,pause,lastCross}
    // おちる:   {free:true, pos, vel, size, color}
    this.drops = [];

    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  // ---- 霧吹き ----
  sprayAt(pt2, radius = 2.6) {
    this.sparkles.mist(new THREE.Vector3(pt2.x, pt2.y, 1.2), 18);
    this.audio.spray();
    let touched = 0;
    for (const t of this.threadMgr.threads) {
      if (t.dying > 0) continue;
      // 糸の中で霧に近いところへつぶをつける
      for (let k = 0; k < 4; k++) {
        const s = rand(0.05, 0.95);
        const p = t.pointAt(s);
        const d = Math.hypot(p.x - pt2.x, p.y - pt2.y);
        if (d < radius) {
          t.addWet(0.3);
          touched++;
          if (this.beads.length < MAX_BEADS && Math.random() < 0.75) {
            this.beads.push({ thread: t, s, size: rand(0.045, 0.085) });
          }
        }
      }
    }
    if (touched > 0) this.onEvent && this.onEvent('mist');
    // つぶが多い糸 → あつまって大きなしずくに
    this._coalesce();
  }

  _coalesce() {
    const byThread = new Map();
    for (const b of this.beads) {
      if (!byThread.has(b.thread)) byThread.set(b.thread, []);
      byThread.get(b.thread).push(b);
    }
    for (const [t, list] of byThread) {
      if (list.length < 6) continue;
      // まんなかへんのつぶたちが合体
      list.sort((a, b2) => a.s - b2.s);
      for (let i = 0; i + 2 < list.length; i++) {
        if (list[i + 2].s - list[i].s < 0.12) {
          const trio = [list[i], list[i + 1], list[i + 2]];
          const s = trio.reduce((sum, b) => sum + b.s, 0) / 3;
          this.beads = this.beads.filter(b => !trio.includes(b));
          this.spawnDrop(t, s, 0xcfeeff, 0.16, 0.7);
          this.audio.plip();
          break;
        }
      }
    }
  }

  // ---- 色水 ----
  spawnDrop(thread, s, colorHex, size = 0.2, water = 1) {
    if (this.drops.filter(d => !d.free).length >= MAX_DROPS - 6) return null;
    const d = {
      thread, s: clamp(s, 0.02, 0.98), vel: 0, size, color: colorHex,
      water, pause: 0, wobblePhase: rand(0, 6), crossed: new Set(),
    };
    this.drops.push(d);
    return d;
  }

  dropColorAt(hit, colorHex) {
    const d = this.spawnDrop(hit.thread, hit.s, colorHex, 0.2, 1);
    if (d) {
      hit.thread.addTint(colorHex, 0.3);
      hit.thread.addWet(0.4);
      this.audio.plip(true);
      this.onEvent && this.onEvent('colorDrop');
    }
    return d;
  }

  onThreadRemoved(thread) {
    // 糸が消えたら、ついていたしずくは落ちる
    for (let i = this.beads.length - 1; i >= 0; i--) {
      if (this.beads[i].thread === thread) {
        const b = this.beads[i];
        const p = thread.pointAt(b.s);
        this.drops.push({ free: true, pos: p.clone(), vel: new THREE.Vector3(rand(-0.3, 0.3), -0.2, 0.2), size: b.size, color: 0xcfeeff });
        this.beads.splice(i, 1);
      }
    }
    for (const d of this.drops) {
      if (!d.free && d.thread === thread) {
        const p = thread.pointAt(d.s);
        d.free = true;
        d.pos = p.clone();
        d.vel = new THREE.Vector3(rand(-0.4, 0.4), -0.3, 0.25);
      }
    }
  }

  clear() {
    this.beads.length = 0;
    this.drops.length = 0;
  }

  // 光あそび用:きらめかせたい位置のリスト
  glintTargets() {
    const pts = [];
    for (const b of this.beads) {
      if (b.thread.dying > 0) continue;
      pts.push(b.thread.pointAt(b.s));
    }
    for (const d of this.drops) {
      if (d.free) pts.push(d.pos);
      else if (d.thread.dying === 0) pts.push(d.thread.pointAt(d.s));
    }
    return pts;
  }

  tick(dt, now) {
    // ---- ころがるしずくの物理 ----
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.free) {
        // 自由落下
        d.vel.y -= GRAV * 2.2 * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y < -8) {
          this.audio.plip(d.size > 0.14);
          this.drops.splice(i, 1);
        }
        continue;
      }
      const t = d.thread;
      if (t.dying > 0) { this.drops.splice(i, 1); continue; }

      if (d.pause > 0) {
        d.pause -= dt;
      } else {
        // 糸にそった重力(はりが強いほどすべる)
        const tan = t.tangentAt(d.s);
        const accel = (-tan.y * GRAV * (0.5 + t.tension * 0.8)) / Math.max(t.len, 0.001);
        d.vel += accel * dt;
        d.vel *= Math.max(0, 1 - 1.1 * dt); // ねばり
        const prevS = d.s;
        d.s += d.vel * dt;

        // 糸をそめる+うすい染みを残す
        if (Math.abs(d.s - prevS) > 0.0005 && d.water > 0) {
          const p0 = t.pointAt(prevS), p1 = t.pointAt(d.s);
          this.stains.streak(p0.x, p0.y, p1.x, p1.y, d.color, d.size * 1.8, 0.09);
          t.addTint(d.color, dt * 0.25);
          d.water = Math.max(0, d.water - dt * 0.12);
        }

        // ---- 交点チェック ----
        const crossings = this.threadMgr.crossingsOf(t);
        for (const c of crossings) {
          const passed = (prevS < c.s && d.s >= c.s) || (prevS > c.s && d.s <= c.s);
          if (!passed) continue;
          const key = Math.round(c.s * 500);
          if (d.crossed.has(key)) continue;
          d.crossed.add(key);
          // ぷるっと止まって、色がじわっ
          d.s = c.s;
          d.pause = rand(0.25, 0.5);
          d.size = Math.min(0.3, d.size * 1.13);
          this.audio.wobble();
          const p = t.pointAt(c.s);
          // 交点に色がたまる → もようが育つ
          let stainColor = d.color;
          if (c.other.tint !== null) stainColor = mixHex(d.color, c.other.tint, 0.4);
          this.stains.blob(p.x, p.y, stainColor, d.size * 4.2, 0.3);
          this.audio.bloom();
          c.other.addTint(d.color, 0.18);
          c.other.addWet(0.25);
          this.sparkles.burst(p, d.color, 4, 1.1, 0.16, 0.5);
          this.onEvent && this.onEvent('crossBloom');
          // ときどき、交差してる糸へのりかえる
          const otherTan = c.other.tangentAt(c.s);
          if (Math.random() < 0.45 && Math.abs(otherTan.y) > 0.25) {
            // のりかえ先で下り方向へ
            const going = otherTan.y < 0 ? 1 : -1;
            // c.other 上の位置 s を求める
            const oc = this.threadMgr.crossingsOf(c.other).find(cc => cc.other === t);
            if (oc) {
              d.thread = c.other;
              d.s = oc.s;
              d.vel = going * Math.abs(d.vel) * 0.6;
              d.crossed = new Set([Math.round(oc.s * 500)]);
            }
          }
          break;
        }

        // ---- はしっこ(ピン)についた → したたる ----
        if (d.s <= 0.005 || d.s >= 0.995) {
          const endP = t.pointAt(d.s <= 0.005 ? 0 : 1);
          const other = t.pointAt(d.s <= 0.005 ? 0.06 : 0.94);
          // まだ下り坂ならぶらさがってポタッ
          if (endP.y < other.y - 0.01 || d.water < 0.3) {
            d.free = true;
            d.pos = endP.clone();
            d.vel = new THREE.Vector3(rand(-0.2, 0.2), -0.4, 0.3);
          } else {
            // のぼりで止まった → ちょっともどる
            d.s = clamp(d.s, 0.01, 0.99);
            d.vel *= -0.35;
          }
        }
      }
      // みずがなくなったら消える
      if (d.water !== undefined && d.water <= 0 && Math.abs(d.vel) < 0.02) {
        this.drops.splice(i, 1);
      }
    }

    // ---- しずく同士がちかいと合体 ----
    const rolling = this.drops.filter(d => !d.free);
    for (let i = 0; i < rolling.length; i++) {
      for (let j = i + 1; j < rolling.length; j++) {
        const a = rolling[i], b = rolling[j];
        if (a.thread !== b.thread) continue;
        if (Math.abs(a.s - b.s) < 0.035) {
          a.size = Math.min(0.32, Math.hypot(a.size, b.size));
          a.color = mixHex(a.color, b.color, 0.5);
          a.water = Math.min(1.2, (a.water || 0) + (b.water || 0));
          a.vel = (a.vel + b.vel) * 0.5;
          const idx = this.drops.indexOf(b);
          if (idx >= 0) this.drops.splice(idx, 1);
          this.audio.wobble();
        }
      }
    }

    // ---- 見た目を更新 ----
    // つぶ
    let bn = 0;
    for (let i = this.beads.length - 1; i >= 0; i--) {
      const b = this.beads[i];
      if (b.thread.dying > 0) { this.beads.splice(i, 1); continue; }
      // 糸をはじくと、つぶが ぷるんと飛ぶ
      if (b.thread.vibAmp > 0.09 && Math.random() < dt * 4) {
        const p = b.thread.pointAt(b.s);
        this.drops.push({
          free: true, pos: p.clone(),
          vel: new THREE.Vector3(rand(-1, 1), rand(0.5, 1.6), rand(0.3, 1)),
          size: b.size, color: 0xcfeeff,
        });
        this.sparkles.twinkle(p, 0xdff3ff, 0.25, 0.4);
        this.beads.splice(i, 1);
        continue;
      }
      const p = b.thread.pointAt(b.s);
      const wob = 1 + Math.sin(now * 3 + b.s * 40) * 0.08;
      this._m4.makeScale(b.size * wob, b.size * wob, b.size * wob);
      this._m4.setPosition(p.x, p.y - b.size * 0.5, p.z + 0.02);
      this.beadMesh.setMatrixAt(bn++, this._m4);
    }
    this.beadMesh.count = bn;
    this.beadMesh.instanceMatrix.needsUpdate = true;

    // しずく
    let dn = 0;
    for (const d of this.drops) {
      if (dn >= MAX_DROPS) break;
      let p, stretch = 1;
      if (d.free) {
        p = d.pos;
        stretch = 1 + Math.min(0.8, d.vel.length() * 0.08);
        this._m4.makeScale(d.size / Math.sqrt(stretch), d.size * stretch, d.size / Math.sqrt(stretch));
        this._m4.setPosition(p.x, p.y, p.z);
      } else {
        p = d.thread.pointAt(d.s);
        const wob = d.pause > 0 ? 1 + Math.sin(now * 22 + d.wobblePhase) * 0.16 : 1 + Math.sin(now * 6 + d.wobblePhase) * 0.05;
        const sy = d.size * wob;
        const sx = d.size / Math.sqrt(wob);
        this._m4.makeScale(sx, sy, sx);
        this._m4.setPosition(p.x, p.y - d.size * 0.45, p.z + 0.03);
      }
      this.dropMesh.setMatrixAt(dn, this._m4);
      this._c.setHex(d.color);
      this.dropMesh.setColorAt(dn, this._c);
      dn++;
    }
    this.dropMesh.count = dn;
    this.dropMesh.instanceMatrix.needsUpdate = true;
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true;
  }
}
