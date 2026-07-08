// ピン(くぎ)の配置と見た目
import * as THREE from 'three';
import { TAU, easeOutBack, clamp } from './utils.js';
import { makeGlowTexture } from './scene3d.js';

export const PIN_Z = 0.42; // 糸がかかる高さ(板の面から)

// ---- ピンのならべかた(かたち) ----
export const LAYOUTS = {
  maru: { label: 'まる', icon: '⭕' },
  hana: { label: 'おはな', icon: '🌸' },
  ougi: { label: 'おうぎ', icon: '🌈' },
  shikaku: { label: 'しかく', icon: '🟨' },
  hoshi: { label: 'ハート', icon: '💗' },
};

export function layoutPositions(name) {
  const pts = [];
  if (name === 'maru') {
    const N = 24, R = 4.95;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.PI / 2;
      pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R));
    }
  } else if (name === 'hana') {
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.PI / 2;
      const r = 3.7 + 1.25 * Math.cos(5 * a);
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
  } else if (name === 'ougi') {
    // 半円アーク + 底辺(おうぎがた)
    const R = 4.9, arcN = 15, baseN = 9, y0 = -2.1;
    for (let i = 0; i < arcN; i++) {
      const a = Math.PI * (i / (arcN - 1));
      pts.push(new THREE.Vector2(Math.cos(a) * R, y0 + Math.sin(a) * R));
    }
    for (let i = 1; i < baseN - 1; i++) {
      const t = i / (baseN - 1);
      pts.push(new THREE.Vector2(-R + t * 2 * R, y0));
    }
  } else if (name === 'shikaku') {
    const S = 4.15, per = 6; // 1辺6こ(かどは共有) → 24こ
    const corners = [
      [-S, S], [S, S], [S, -S], [-S, -S],
    ];
    for (let e = 0; e < 4; e++) {
      const [x0, y0] = corners[e], [x1, y1] = corners[(e + 1) % 4];
      for (let i = 0; i < per; i++) {
        const t = i / per;
        pts.push(new THREE.Vector2(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t));
      }
    }
  } else if (name === 'hoshi') {
    // ハートがた
    const N = 26;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push(new THREE.Vector2(x * 0.285, y * 0.285 + 0.55));
    }
  }
  return pts;
}

// ---- ピンひとつ ----
let sharedGeo = null;
let glowTex = null;
function getShared() {
  if (!sharedGeo) {
    sharedGeo = {
      peg: new THREE.CylinderGeometry(0.085, 0.11, PIN_Z + 0.16, 10),
      head: new THREE.SphereGeometry(0.21, 14, 12),
    };
    glowTex = makeGlowTexture('rgba(255,235,150,1)', 'rgba(255,235,150,0)');
  }
  return sharedGeo;
}

const headMat = new THREE.MeshStandardMaterial({
  color: 0xf3c14b, metalness: 0.85, roughness: 0.25,
});
const pegMat = new THREE.MeshStandardMaterial({
  color: 0xd9a441, metalness: 0.7, roughness: 0.4,
});

export class Pin {
  constructor(index, pos2) {
    const g = getShared();
    this.index = index;
    this.pos = pos2; // Vector2 (板ローカル)
    this.group = new THREE.Group();
    this.peg = new THREE.Mesh(g.peg, pegMat);
    this.peg.rotation.x = Math.PI / 2;
    this.peg.position.z = (PIN_Z + 0.16) / 2 - 0.08;
    this.head = new THREE.Mesh(g.head, headMat.clone());
    this.head.position.z = PIN_Z + 0.14;
    this.head.castShadow = true;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.glow.scale.setScalar(1.5);
    this.glow.position.z = PIN_Z + 0.2;
    this.group.add(this.peg, this.head, this.glow);
    this.group.position.set(pos2.x, pos2.y, 0);
    this.group.scale.setScalar(0.001);
    this.bornAt = -1;       // ぽこっと生える演出用
    this.highlight = 0;     // 0..1
    this.targetHighlight = 0;
    this.pulse = 0;         // タッチしたときのぷにっ
  }

  // 糸がかかる3D位置(板ローカル)
  anchor(zOffset = 0) {
    return new THREE.Vector3(this.pos.x, this.pos.y, PIN_Z + zOffset);
  }

  tick(dt, now) {
    if (this.bornAt >= 0) {
      const t = clamp((now - this.bornAt) / 0.45, 0, 1);
      this.group.scale.setScalar(Math.max(0.001, easeOutBack(t)));
      if (t >= 1) this.bornAt = -1;
    }
    this.highlight += (this.targetHighlight - this.highlight) * Math.min(1, dt * 10);
    this.glow.material.opacity = this.highlight * 0.9;
    this.glow.scale.setScalar(1.2 + this.highlight * 0.9 + Math.sin(now * 5) * 0.08 * this.highlight);
    this.head.material.emissive.setHex(0xffdd66);
    this.head.material.emissiveIntensity = this.highlight * 0.7;
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 3);
      const s = 1 + Math.sin(this.pulse * Math.PI) * 0.35;
      this.head.scale.setScalar(s);
    }
  }
}

// ---- ピンボード ----
export class PinBoard {
  constructor(parent) {
    this.parent = parent;
    this.pins = [];
    this.layoutName = null;
  }

  build(name, now) {
    // 古いピンを外す
    for (const p of this.pins) this.parent.remove(p.group);
    this.pins = [];
    this.layoutName = name;
    const positions = layoutPositions(name);
    positions.forEach((pos, i) => {
      const pin = new Pin(i, pos);
      pin.bornAt = now + i * 0.03; // ぽこぽこ順番に生える
      this.parent.add(pin.group);
      this.pins.push(pin);
    });
    return this.pins;
  }

  nearest(pt2, maxDist = 1.1) {
    let best = null, bd = maxDist;
    for (const p of this.pins) {
      const d = p.pos.distanceTo(pt2);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  tick(dt, now) {
    for (const p of this.pins) p.tick(dt, now);
  }
}
