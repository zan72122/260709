// ---------------------------------------------------------------------------
// cups.js — two glass cups on little carts. Liquid renders through a custom
// shader that stores every poured layer, so alternating colours make real
// stripes. Cups can be dragged left/right; overfilling makes them spill.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PALETTE } from './colors.js';

export const CUP = {
  R_TOP: 0.62,     // inner top radius
  R_BOT: 0.5,      // inner bottom radius
  H: 1.55,         // inner height
  Y0: 0.42,        // inner bottom height (sits on the cart)
  RIM_Y: 0.42 + 1.55,
  VOL_MARBLE: 0.055,  // level gained per melted marble
  VOL_DROP: 0.011,    // level gained per syrup drop
};

const STRIPE_RES = 128;

export class Cup {
  constructor(scene, side) {
    this.side = side;              // -1 left, +1 right
    this.x = side * 1.05;
    this.targetX = this.x;
    this.level = 0;
    this.topColor = new THREE.Color(0xffffff);
    this.bands = [];               // [{colorHex, from, to}] for goal checks
    this.full = false;
    this.overflow = 0;             // pending overflow volume
    this.wobbleT = 0;
    this.recentPour = 0;

    this.group = new THREE.Group();
    scene.add(this.group);
    this._build();
    this._syncX();
  }

  _build() {
    const g = this.group;
    const { R_TOP, R_BOT, H, Y0 } = CUP;

    // ---- cart ----
    const cartMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.6 });
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.15), cartMat);
    cart.position.y = 0.24;
    cart.castShadow = cart.receiveShadow = true;
    g.add(cart);
    const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14);
    const wheelMat = new THREE.MeshStandardMaterial({ color: PALETTE.pink2, roughness: 0.4 });
    this.wheels = [];
    for (const [wx, wz] of [[-0.55, 0.42], [0.55, 0.42], [-0.55, -0.42], [0.55, -0.42]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.13, wz);
      w.castShadow = true;
      this.wheels.push(w);
      g.add(w);
    }
    // little pull-handle so it looks draggable
    const grip = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.05, 8, 18),
      new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.35, metalness: 0.3 })
    );
    grip.position.set(this.side * 0.82, 0.3, 0);
    grip.rotation.y = Math.PI / 2;
    g.add(grip);

    // ---- glass cup ----
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdcf1ff, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.3, clearcoat: 1, clearcoatRoughness: 0.04,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R_TOP + 0.05, R_BOT + 0.05, H + 0.14, 36, 1, true), glassMat);
    wall.position.y = Y0 + (H + 0.14) / 2 - 0.07;
    wall.castShadow = false;
    g.add(wall);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R_BOT + 0.05, R_BOT + 0.05, 0.08, 36), glassMat);
    bottom.position.y = Y0 - 0.04;
    g.add(bottom);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(R_TOP + 0.05, 0.035, 10, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.55 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = Y0 + H + 0.07;
    g.add(rim);

    // ---- liquid (stripe shader) ----
    this.stripeData = new Uint8Array(STRIPE_RES * 4);
    this.stripeTex = new THREE.DataTexture(this.stripeData, 1, STRIPE_RES);
    this.stripeTex.needsUpdate = true;
    this.liquidMat = new THREE.ShaderMaterial({
      uniforms: {
        uLevel: { value: 0 },
        uStripes: { value: this.stripeTex },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying float vFrac;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        uniform float uTime;
        uniform float uLevel;
        void main() {
          vFrac = (position.y + ${(CUP.H / 2).toFixed(4)}) / ${CUP.H.toFixed(4)};
          vec3 p = position;
          // gentle slosh near the surface
          float nearTop = smoothstep(uLevel - 0.15, uLevel, vFrac);
          p.x += sin(uTime * 3.0 + p.y * 4.0) * 0.012 * nearTop;
          vec4 world = modelMatrix * vec4(p, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */`
        varying float vFrac;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        uniform float uLevel;
        uniform sampler2D uStripes;
        void main() {
          if (vFrac > uLevel) discard;
          vec3 col = texture2D(uStripes, vec2(0.5, vFrac)).rgb;
          float fres = pow(1.0 - abs(dot(vNormalW, vViewDir)), 2.0);
          col = mix(col, vec3(1.0), fres * 0.45);
          col *= 0.82 + 0.18 * vFrac;          // slightly darker at the bottom
          gl_FragColor = vec4(col, 0.93);
        }`,
      transparent: true,
    });
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP.R_TOP - 0.015, CUP.R_BOT - 0.015, CUP.H, 32, 24, true),
      this.liquidMat
    );
    liquid.position.y = Y0 + H / 2;
    g.add(liquid);

    // liquid top surface
    this.topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0 });
    this.topMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), this.topMat);
    this.topMesh.rotation.x = -Math.PI / 2;
    this.topMesh.visible = false;
    g.add(this.topMesh);

    // foam ring flashes when something lands
    this.foam = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 0.8 })
    );
    this.foam.rotation.x = Math.PI / 2;
    g.add(this.foam);

    // invisible drag-hit volume
    this.hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 2.6, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitMesh.position.y = 1.3;
    this.hitMesh.userData.cup = this;
    g.add(this.hitMesh);
  }

  _syncX() { this.group.position.x = this.x; }

  radiusAt(frac) { return CUP.R_BOT + (CUP.R_TOP - CUP.R_BOT) * frac; }

  // returns true if the cup just became full
  addVolume(colorHex, amount) {
    if (this.level >= 1.18) return false; // hard cap; keeps overflowing
    const from = Math.max(0, Math.min(1, this.level));
    this.level += amount;
    const to = Math.max(0, Math.min(1, this.level));
    this.recentPour = 1;
    const c = new THREE.Color(colorHex);
    this.topColor.copy(c);

    if (to > from) {
      const i0 = Math.floor(from * STRIPE_RES), i1 = Math.max(i0 + 1, Math.ceil(to * STRIPE_RES));
      for (let i = i0; i < Math.min(i1, STRIPE_RES); i++) {
        this.stripeData[i * 4] = Math.round(c.r * 255);
        this.stripeData[i * 4 + 1] = Math.round(c.g * 255);
        this.stripeData[i * 4 + 2] = Math.round(c.b * 255);
        this.stripeData[i * 4 + 3] = 255;
      }
      this.stripeTex.needsUpdate = true;
      // band bookkeeping (merge same colour)
      const last = this.bands[this.bands.length - 1];
      if (last && last.colorHex === colorHex) last.to = to;
      else this.bands.push({ colorHex, from, to });
    }

    if (!this.full && this.level >= 1) { this.full = true; return true; }
    return false;
  }

  // dt update; returns spilled volume this frame (0 if none)
  update(dt, t) {
    this.x += (this.targetX - this.x) * Math.min(1, dt * 14);
    const moving = Math.abs(this.targetX - this.x) > 0.002;
    if (moving) for (const w of this.wheels) w.rotation.z -= (this.targetX - this.x) * dt * 40;
    this._syncX();

    this.recentPour = Math.max(0, this.recentPour - dt * 1.4);
    this.wobbleT += dt;

    // overflow: everything above the brim slowly glugs out
    let spilled = 0;
    if (this.level > 1.0) {
      const rate = Math.min(this.level - 1.0 + 0.06, 0.35) * dt;
      this.level -= rate;
      spilled = rate;
      if (this.level <= 1.0) this.level = Math.max(1.0, this.level);
    }
    if (this.full && this.level < 0.98) this.full = false;

    // visuals
    const lv = Math.min(this.level, 1.06);
    this.liquidMat.uniforms.uLevel.value = Math.min(lv, 1.0);
    this.liquidMat.uniforms.uTime.value = t;

    const hasLiquid = this.level > 0.015;
    this.topMesh.visible = hasLiquid;
    if (hasLiquid) {
      const frac = Math.min(lv, 1.0);
      const y = CUP.Y0 + frac * CUP.H + (lv > 1.0 ? (lv - 1.0) * 0.4 : 0);
      this.topMesh.position.y = y + 0.005;
      const r = (this.radiusAt(frac) - 0.02) * (1 + Math.sin(this.wobbleT * 5) * 0.012 * (this.recentPour + 0.2));
      this.topMesh.scale.setScalar(r);
      this.topMat.color.copy(this.topColor).lerp(new THREE.Color(0xffffff), 0.25);

      this.foam.position.y = y + 0.02;
      this.foam.scale.setScalar(this.radiusAt(frac) * (1.2 + this.recentPour * 0.4));
      this.foam.material.opacity = this.recentPour * 0.7;
    } else {
      this.foam.material.opacity = 0;
    }
    return spilled;
  }

  // how striped is this cup? (number of colour changes among generous bands)
  stripeCount() {
    let n = 0;
    let prev = null;
    for (const b of this.bands) {
      if ((b.to - b.from) < 0.06) continue;   // ignore slivers
      if (prev !== null && b.colorHex !== prev) n++;
      prev = b.colorHex;
    }
    return n + (prev !== null ? 1 : 0);
  }

  reset() {
    this.level = 0;
    this.full = false;
    this.bands.length = 0;
    this.stripeData.fill(0);
    this.stripeTex.needsUpdate = true;
    this.topMesh.visible = false;
  }

  // physics colliders (world-space capsule segments)
  colliders(out) {
    const { R_TOP, R_BOT, H, Y0 } = CUP;
    const x = this.x;
    out.push(
      { x1: x - R_BOT - 0.06, y1: Y0 - 0.02, x2: x - R_TOP - 0.06, y2: Y0 + H + 0.05, r: 0.055, rest: 0.3, cup: this, part: 'wallL' },
      { x1: x + R_BOT + 0.06, y1: Y0 - 0.02, x2: x + R_TOP + 0.06, y2: Y0 + H + 0.05, r: 0.055, rest: 0.3, cup: this, part: 'wallR' },
      { x1: x - R_BOT + 0.02, y1: Y0, x2: x + R_BOT - 0.02, y2: Y0, r: 0.07, rest: 0.25, cup: this, part: 'bottom' },
      // cart top so stray marbles bounce off it
      { x1: x - 0.75, y1: 0.36, x2: x + 0.75, y2: 0.36, r: 0.05, rest: 0.3, cup: this, part: 'cart' },
    );
  }
}

export function createCups(scene) {
  const left = new Cup(scene, -1);
  const right = new Cup(scene, 1);
  const list = [left, right];

  function clampTargets() {
    left.targetX = THREE.MathUtils.clamp(left.targetX, -2.3, -0.75);
    right.targetX = THREE.MathUtils.clamp(right.targetX, 0.75, 2.3);
  }

  return {
    left, right, list,
    clampTargets,
    update(dt, t) {
      clampTargets();
      let spillL = left.update(dt, t);
      let spillR = right.update(dt, t);
      return { spillL, spillR };
    },
    reset() { left.reset(); right.reset(); },
  };
}
