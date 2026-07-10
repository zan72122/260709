// gimmicks.js — 14のからくり(操作9+自動5)。物理は平面座標、見た目は円筒ラップ。
import * as THREE from '../vendor/three.module.min.js';
import { BoxCollider, CylinderZCollider } from './physics.js';
import { roundedBox, bMesh } from './tower.js';
import { getMaterials, lollipopTex } from './materials.js';
import { wrapPos, wrapQuat, placeAt, wrapPoints } from './wrap.js';
import {
  CRANE, SEESAW, WHEEL, WHIP_LIFT, FLIPPER, DROP_TUBE, TURNTABLE,
  HAMMER, LOOP, DOMINO, CANNON, MUSIC_DRUM, CHOCO_FALL, BALL_HOME,
} from './layout.js';

const _v = new THREE.Vector3();

function hitProxy(gimmick, radius, fx, fy, fz = 0.3) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  wrapPos(fx, fy, fz, m.position);
  m.userData.gimmick = gimmick;
  return m;
}

// 回転キネマティック部品セット(平面コライダー+ラップ描画グループ)
class KinematicAssembly {
  constructor(world, pivotX, pivotY) {
    this.pivot = new THREE.Vector3(pivotX, pivotY, 0);
    this.group = new THREE.Group();
    wrapPos(pivotX, pivotY, 0, this.group.position);
    this.parts = [];
    this.angle = 0;
    this.world = world;
  }

  addPart({ mesh, lx = 0, ly = 0, lz = 0, lAng = 0, half = null, friction = 0.015, restitution = 0.15, name = 'kin' }) {
    if (mesh) {
      mesh.position.set(lx, ly, lz);
      mesh.rotation.z = lAng;
      this.group.add(mesh);
    }
    let col = null;
    if (half) {
      col = this.world.add(new BoxCollider({
        center: new THREE.Vector3(this.pivot.x + lx, this.pivot.y + ly, lz),
        half, friction, restitution, name,
      }));
      col.pivot = this.pivot;
    }
    this.parts.push({ lx, ly, lz, lAng, col });
    return col;
  }

  setAngle(a, angVel = 0) {
    this.angle = a;
    wrapQuat(this.pivot.x, a, this.group.quaternion);
    const c = Math.cos(a), s = Math.sin(a);
    for (const p of this.parts) {
      if (!p.col) continue;
      const wx = this.pivot.x + p.lx * c - p.ly * s;
      const wy = this.pivot.y + p.lx * s + p.ly * c;
      p.col.setTransform(_v.set(wx, wy, p.lz), a + p.lAng);
      p.col.angVelZ = angVel;
    }
  }
}

// ================= 1. キャンディクレーン(ガチャグローブ) =================
export class Crane {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    const G = CRANE.globe;

    // ガラスドーム+台座
    const dome = new THREE.Mesh(new THREE.SphereGeometry(G.r, 24, 18), mats.glass);
    placeAt(dome, G.x, G.y, 0, 0);
    scene.add(dome);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mats.strawberry);
    placeAt(cap, G.x, G.y + G.r + 0.05, 0, 0);
    scene.add(cap);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.7, 16), mats.mintStripe);
    placeAt(stand, G.x, G.y - G.r - 0.15, 0, 0);
    scene.add(stand);

    // 傾く床(捕捉していない=物理の玉のみに作用)
    this.asm = new KinematicAssembly(world, G.x + 0.75, G.y - 0.52);
    const floor = bMesh(mats.icing, 1.6, 0.16, 1.0);
    this.asm.addPart({ mesh: floor, lx: -0.75, half: new THREE.Vector3(0.8, 0.08, 0.5), name: 'crane-floor' });
    const lipR = bMesh(mats.strawberry, 0.1, 0.16, 1.0);
    this.asm.addPart({ mesh: lipR, lx: 0.06, ly: 0.12, half: new THREE.Vector3(0.05, 0.08, 0.5), name: 'crane-lip' });
    const wallL = bMesh(mats.icing, 0.14, 0.6, 1.0);
    this.asm.addPart({ mesh: wallL, lx: -1.5, ly: 0.34, half: new THREE.Vector3(0.07, 0.3, 0.5), name: 'crane-wall' });
    for (const s of [1, -1]) {
      this.asm.addPart({ lx: -0.75, ly: 0.3, lz: s * 0.45, half: new THREE.Vector3(0.8, 0.3, 0.05), name: 'crane-z' });
    }
    scene.add(this.asm.group);

    // 赤いつまみ
    this.knob = new THREE.Group();
    const stem = bMesh(mats.gold, 0.09, 0.5, 0.09, 0.03);
    stem.position.y = 0.25;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), mats.strawberry);
    ball.position.y = 0.56;
    ball.castShadow = true;
    this.knob.add(stem, ball);
    placeAt(this.knob, CRANE.knob.x, CRANE.knob.y, 0.4, 0);
    scene.add(this.knob);

    this.proxy = hitProxy(this, 1.35, CRANE.knob.x + 0.4, CRANE.knob.y + 0.5);
    scene.add(this.proxy);

    this.timer = -1;
    this.name = 'crane';
    this.guideType = 'tap';
  }

  get guidePos() { return { x: CRANE.knob.x, y: CRANE.knob.y + 0.9 }; }
  get busy() { return this.timer >= 0; }

  onTap() {
    if (this.timer >= 0) return;
    const ball = this.game.balls.find((b) => b.mode === 'queued');
    if (!ball) { this.game.audio.clack(500, 0.2); return; }
    this.timer = 0;
    ball.launchFromHome();
    this.game.audio.clack(700, 0.35);
  }

  update(dt) {
    if (this.timer >= 0) {
      this.timer += dt;
      const t = this.timer, tip = CRANE.tipTime, hold = CRANE.holdTime;
      let a;
      if (t < tip) a = CRANE.tipAngle * (t / tip);
      else if (t < tip + hold) a = CRANE.tipAngle;
      else if (t < tip + hold + 0.4) a = CRANE.tipAngle * (1 - (t - tip - hold) / 0.4);
      else { a = 0; this.timer = -1; }
      const prev = this.asm.angle;
      this.asm.setAngle(a, dt > 0 ? (a - prev) / dt : 0);
      this.knob.rotation.z = -0.5 * Math.max(0, 1 - t * 2.2);
    }
  }
}

// ================= 3. チョコシーソー =================
export class Seesaw {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    const [px, py] = SEESAW.pivot;
    this.asm = new KinematicAssembly(world, px, py);
    const plank = bMesh(mats.chocolate, SEESAW.halfLen * 2, 0.16, 1.0, 0.05);
    this.asm.addPart({ mesh: plank, half: new THREE.Vector3(SEESAW.halfLen, 0.08, 0.5), name: 'seesaw' });
    const tipL = bMesh(mats.strawberry, 0.12, 0.16, 1.0);
    this.asm.addPart({ mesh: tipL, lx: -SEESAW.halfLen + 0.06, ly: 0.15, half: new THREE.Vector3(0.06, 0.08, 0.5), name: 'seesaw-tip' });
    for (const s of [1, -1]) {
      const lip = bMesh(mats.icing, SEESAW.halfLen * 2, 0.3, 0.09, 0.03);
      this.asm.addPart({ mesh: lip, ly: 0.16, lz: s * 0.455, half: new THREE.Vector3(SEESAW.halfLen, 0.15, 0.045), name: 'seesaw-lip' });
    }
    // チョコの垂れ飾り
    for (let i = 0; i < 5; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mats.chocolate);
      drip.scale.y = 1.8;
      drip.position.set(-1.4 + i * 0.7, -0.14, 0.4);
      this.asm.group.add(drip);
    }
    scene.add(this.asm.group);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 12), mats.gold);
    placeAt(pin, px, py, 0, 0);
    pin.rotateX(Math.PI / 2);
    scene.add(pin);

    this.proxy = hitProxy(this, 1.7, px, py);
    scene.add(this.proxy);

    this.target = SEESAW.restTilt;
    this.name = 'seesaw';
    this.guideType = 'tap';
    this.asm.setAngle(this.target, 0);
  }

  get guidePos() { return { x: SEESAW.pivot[0] + 0.4, y: SEESAW.pivot[1] + 0.7 }; }
  get tiltLeft() { return this.target > 0; }

  onTap() {
    this.target = -this.target;
    this.game.audio.clack(560, 0.3);
  }

  update(dt) {
    const a = this.asm.angle;
    const next = a + (this.target - a) * Math.min(1, dt * 7.5);
    this.asm.setAngle(next, dt > 0 ? (next - a) / dt : 0);
  }
}

// ================= 5. ロリポップ大風車 =================
export class LollipopWheel {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    const [cx, cy] = WHEEL.center;
    this.center = new THREE.Vector3(cx, cy, 0);
    this.group = new THREE.Group();
    wrapPos(cx, cy, 0, this.group.position);

    // 渦巻き飴のディスク
    const discMat = new THREE.MeshStandardMaterial({ map: lollipopTex('#ff6f9c', '#fff4ec'), roughness: 0.3 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL.radius + 0.05, WHEEL.radius + 0.05, 0.12, 32), discMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = -0.32;
    disc.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.07, 10, 36), mats.mint);
    ring.position.z = 0.3;
    ring.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 14), mats.gold);
    hub.rotation.x = Math.PI / 2;
    this.group.add(disc, ring, hub);
    this.pocketBase = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (const a of this.pocketBase) {
      const cup = new THREE.Group();
      const back = bMesh(mats.lemon, 0.62, 0.14, 0.7, 0.03);
      back.position.set(0, -0.28, 0);
      const s1 = bMesh(mats.lemon, 0.14, 0.42, 0.7, 0.03);
      s1.position.set(-0.3, -0.08, 0);
      const s2 = bMesh(mats.lemon, 0.14, 0.3, 0.7, 0.03);
      s2.position.set(0.3, -0.13, 0);
      cup.add(back, s1, s2);
      cup.position.set(Math.cos(a) * (WHEEL.radius - 0.3), Math.sin(a) * (WHEEL.radius - 0.3), 0);
      cup.rotation.z = a + Math.PI / 2;
      this.group.add(cup);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.strawberry);
      knob.position.set(Math.cos(a + Math.PI / 4) * (WHEEL.radius + 0.02), Math.sin(a + Math.PI / 4) * (WHEEL.radius + 0.02), 0.3);
      this.group.add(knob);
    }
    scene.add(this.group);
    // 飴の棒(下へ)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), mats.icing);
    placeAt(stick, cx, cy - 1.8, -0.32, 0);
    stick.castShadow = true;
    scene.add(stick);

    this.cyl = world.add(new CylinderZCollider({
      center: this.center, radius: WHEEL.physRadius, halfDepth: 0.4, restitution: 0.4, name: 'wheel',
    }));

    this.proxy = hitProxy(this, 1.7, cx, cy);
    scene.add(this.proxy);

    this.theta = 0;
    this.spin = null;
    this.carried = null;   // 捕捉中の玉
    this.carriedBase = 0;
    this.name = 'wheel';
    this.guideType = 'tap';
  }

  get guidePos() { return { x: this.center.x - 0.2, y: this.center.y + 1.35 }; }
  get captured() { return !!this.carried; }

  pocketFlatPos(base) {
    const a = base + this.theta;
    return _v.set(
      this.center.x + Math.cos(a) * (WHEEL.radius - 0.34),
      this.center.y + Math.sin(a) * (WHEEL.radius - 0.34) + 0.12,
      0,
    ).clone();
  }

  tryCapture(ball) {
    if (this.carried || this.spin) return false;
    if (ball.p.y > this.center.y + 0.65 || ball.p.x > this.center.x - 0.1) return false;
    const dx = ball.p.x - WHEEL.intake.x, dy = ball.p.y - WHEEL.intake.y;
    if (dx * dx + dy * dy > WHEEL.intake.r * WHEEL.intake.r) return false;
    this.carried = ball;
    this.carriedBase = -Math.PI / 2 - this.theta;
    ball.captureTo(() => this.pocketFlatPos(this.carriedBase));
    this.game.audio.clack(500, 0.35);
    return true;
  }

  onTap() {
    if (this.spin) return;
    this.spin = { from: this.theta, to: this.theta + WHEEL.stepAngle, t: 0 };
    this.game.audio.clack(880, 0.28);
  }

  update(dt) {
    if (this.spin) {
      this.spin.t = Math.min(1, this.spin.t + dt / WHEEL.spinTime);
      const e = 1 - Math.pow(1 - this.spin.t, 3);
      const prev = this.theta;
      this.theta = this.spin.from + (this.spin.to - this.spin.from) * e;
      this.cyl.angVelZ = dt > 0 ? (this.theta - prev) / dt : 0;
      if (this.spin.t >= 1) {
        this.spin = null;
        this.cyl.angVelZ = 0;
        this.game.audio.clack(1100, 0.4);
        this._maybeRelease();
      }
    }
    wrapQuat(this.center.x, this.theta, this.group.quaternion);
  }

  _maybeRelease() {
    if (!this.carried) return;
    const worldA = this.carriedBase + this.theta;
    const norm = Math.atan2(Math.sin(worldA), Math.cos(worldA));
    if (Math.abs(norm - Math.PI / 2) < 0.1) {
      const ball = this.carried;
      this.carried = null;
      const top = this.pocketFlatPos(this.carriedBase);
      ball.startRide(
        [[top.x, top.y, 0], [top.x + 0.45, top.y + 0.2, 0], [WHEEL.release.x, WHEEL.release.y, 0]],
        0.45,
        (b) => b.release(WHEEL.release.vx, WHEEL.release.vy),
      );
      this.game.audio.nextNote(0.8, 0);
    }
  }
}

// ================= 7. ホイップリフト =================
export class WhipLift {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    this.x = WHIP_LIFT.x;
    this.y = WHIP_LIFT.bottom;
    const P = WHIP_LIFT.platform;

    // クリームの台(可動)
    this.platGroup = new THREE.Group();
    const dollop = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), mats.cream);
    dollop.scale.set(1, 0.45, 1);
    dollop.position.y = -0.02;
    dollop.castShadow = true;
    this.platGroup.add(dollop);
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mats.strawberry);
    cherry.position.set(0.35, 0.16, 0.3);
    this.platGroup.add(cherry);
    scene.add(this.platGroup);
    // クリームの柱(高さに応じて伸びる)
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1, 14), mats.cream);
    scene.add(this.column);
    // 絞り袋(上から)
    const bag = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 14), mats.pinkStripe);
    placeAt(bag, this.x, WHIP_LIFT.top + 1.7, 0, 0);
    bag.rotateZ(Math.PI);
    bag.castShadow = true;
    scene.add(bag);

    this.cols = [];
    const mk = (lx, ly, half) => {
      const c = world.add(new BoxCollider({
        center: new THREE.Vector3(this.x + lx, this.y + ly, 0), half, friction: 0.02, restitution: 0.1, name: 'lift',
      }));
      c._lx = lx; c._ly = ly; c._lz = 0;
      this.cols.push(c);
      return c;
    };
    mk(0, -P.hh, new THREE.Vector3(P.hw, P.hh, P.hd));
    mk(-P.hw + 0.05, 0.17, new THREE.Vector3(0.05, 0.18, P.hd));
    mk(P.hw - 0.05, 0.15, new THREE.Vector3(0.05, 0.16, P.hd));
    for (const s of [1, -1]) {
      const c = mk(0, 0.12, new THREE.Vector3(P.hw, 0.13, 0.045));
      c._lz = s * (P.hd - 0.045);
      c.center.z = c._lz;
    }

    this.proxy = hitProxy(this, 1.6, this.x, WHIP_LIFT.bottom + 0.7);
    scene.add(this.proxy);

    this.pressed = false;
    this.name = 'lift';
    this.guideType = 'hold';
    this._sync(0);
  }

  get guidePos() { return { x: this.x + 0.85, y: this.y + 1.1 }; }

  onPressStart() { this.pressed = true; }
  onPressEnd() { this.pressed = false; }

  ballOnPlatform() {
    return this.game.balls.some((b) => b.mode === 'physics'
      && Math.abs(b.p.x - this.x) < WHIP_LIFT.platform.hw + 0.25
      && b.p.y > this.y + 0.1 && b.p.y < this.y + 0.9);
  }

  update(dt) {
    const prevY = this.y;
    if (this.pressed) this.y = Math.min(WHIP_LIFT.top, this.y + WHIP_LIFT.speedUp * dt);
    else this.y = Math.max(WHIP_LIFT.bottom, this.y - WHIP_LIFT.speedDown * dt);
    const vy = dt > 0 ? (this.y - prevY) / dt : 0;
    this.game.audio.squish(this.pressed && Math.abs(vy) > 0.05);
    this._sync(vy);

    if (this.y >= WHIP_LIFT.top - 0.02) {
      const ball = this.game.balls.find((b) => b.mode === 'physics'
        && Math.abs(b.p.x - this.x) < WHIP_LIFT.platform.hw + 0.25
        && b.p.y > this.y + 0.1 && b.p.y < this.y + 0.9);
      if (ball) {
        const h = WHIP_LIFT.handoff;
        ball.startRide(
          [[ball.p.x, ball.p.y, 0], [(ball.p.x + h.x) / 2, h.y + 0.05, 0], [h.x, h.y, 0]],
          0.5,
          (bb) => bb.release(h.vx, h.vy),
        );
        this.game.audio.nextNote(0.8, 0);
      }
    }
  }

  _sync(vy) {
    wrapPos(this.x, this.y, 0, this.platGroup.position);
    wrapQuat(this.x, 0, this.platGroup.quaternion);
    for (const c of this.cols) {
      c.center.x = this.x + c._lx;
      c.center.y = this.y + c._ly;
      c.linVel.set(0, vy, 0);
    }
    // 柱: 底からプラットフォームまで
    const h = Math.max(0.25, this.y - (WHIP_LIFT.bottom - 0.4));
    this.column.scale.y = h;
    wrapPos(this.x, (this.y + WHIP_LIFT.bottom - 0.4) / 2, 0, this.column.position);
    wrapQuat(this.x, 0, this.column.quaternion);
    wrapPos(this.x, this.y + 0.55, 0.3, this.proxy.position);
  }
}

// ================= 8. クッキーフリッパー(分岐) =================
export class Flipper {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    const [px, py] = FLIPPER.pivot;
    const hl = FLIPPER.halfLen;
    this.asm = new KinematicAssembly(world, px, py);
    const plank = bMesh(mats.biscuitDark, hl * 2, 0.14, 0.95, 0.04);
    this.asm.addPart({ mesh: plank, half: new THREE.Vector3(hl, 0.07, 0.475), name: 'flipper' });
    for (const s of [1, -1]) {
      const lip = bMesh(mats.biscuitDark, hl * 2, 0.22, 0.08, 0.03);
      this.asm.addPart({ mesh: lip, ly: 0.12, lz: s * 0.435, half: new THREE.Vector3(hl, 0.11, 0.04), name: 'flipper-lip' });
    }
    // チョコチップ
    for (const [dx, dz] of [[-0.35, 0.2], [0.1, -0.15], [0.4, 0.25]]) {
      const chip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.chocolate);
      chip.position.set(dx, 0.1, dz);
      this.asm.group.add(chip);
    }
    // 矢印
    this.arrow = new THREE.Group();
    const shaft = bMesh(mats.icing, 0.5, 0.09, 0.09, 0.03);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), mats.icing);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.32;
    this.arrow.add(shaft, head);
    this.arrow.position.set(0, 0.34, 0);
    this.asm.group.add(this.arrow);
    scene.add(this.asm.group);

    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 12), mats.gold);
    placeAt(pin, px, py, 0, 0);
    pin.rotateX(Math.PI / 2);
    scene.add(pin);

    this.proxy = hitProxy(this, 1.4, px, py + 0.2);
    scene.add(this.proxy);

    this.state = 'L';
    this.carried = null;
    this._holdT = 0;
    this.name = 'flipper';
    this.guideType = 'tap';
    this.asm.setAngle(FLIPPER.angle, 0);
  }

  get guidePos() { return { x: FLIPPER.pivot[0] + 0.3, y: FLIPPER.pivot[1] + 0.95 }; }
  get target() { return this.state === 'L' ? FLIPPER.angle : -FLIPPER.angle; }
  get captured() { return !!this.carried; }

  // クッキーの上に乗った玉の座る位置(板と一緒に傾く)
  seatPos() {
    const a = this.asm.angle;
    return _v.set(
      FLIPPER.pivot[0] - 0.39 * Math.sin(a),
      FLIPPER.pivot[1] + 0.39 * Math.cos(a),
      0,
    ).clone();
  }

  // クッキーに乗った玉を捕捉し、一拍おいて現在の向きへ転がり出す
  tryCapture(ball) {
    if (this.carried || ball.mode !== 'physics') return false;
    if (ball.p.x < FLIPPER.pivot[0] - 0.85) return false;
    const dx = ball.p.x - FLIPPER.pivot[0], dy = ball.p.y - (FLIPPER.pivot[1] + 0.3);
    if (dx * dx + dy * dy > 0.42) return false;
    this.carried = ball;
    this._holdT = 0.85;
    ball.captureTo(() => this.seatPos());
    this.game.audio.clack(680, 0.3);
    return true;
  }

  onTap() {
    this.state = this.state === 'L' ? 'R' : 'L';
    this.game.audio.clack(760, 0.35);
    if (this.carried) this._holdT = Math.max(this._holdT, 0.5); // 切替後も一拍待つ
  }

  update(dt) {
    const a = this.asm.angle;
    const next = a + (this.target - a) * Math.min(1, dt * 9);
    this.asm.setAngle(next, dt > 0 ? (next - a) / dt : 0);

    if (this.carried) {
      this._holdT -= dt;
      if (this._holdT <= 0 && Math.abs(next - this.target) < 0.04) {
        const ball = this.carried;
        this.carried = null;
        const seat = this.seatPos();
        if (this.state === 'L') {
          // 左へ: RET に落ちてリフトへ戻るループ
          ball.startRide(
            [[seat.x, seat.y, 0], [55.35, 7.62, 0], [54.9, 7.32, 0]],
            0.5,
            (b) => b.release(-1.0, -0.4),
          );
        } else {
          // 右へ: キャンディチューブの入口へ
          ball.startRide(
            [[seat.x, seat.y, 0], [56.75, 7.82, 0], [DROP_TUBE.entry.x, DROP_TUBE.entry.y + 0.05, 0]],
            0.5,
            (b) => b.release(1.2, -0.2),
          );
        }
        this.game.audio.nextNote(0.7, 0);
      }
    }
  }
}

// ================= 9. キャンディチューブ(ワイヤースライド) =================
export class CandyTube {
  constructor(game) {
    this.game = game;
    const { mats, scene } = game;
    this.curve = new THREE.CatmullRomCurve3(
      DROP_TUBE.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.4,
    );
    // ワイヤー2本(平面でオフセット → ラップして世界曲線に)
    const up = new THREE.Vector3(0, 1, 0);
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const p = this.curve.getPointAt(t);
        const tan = this.curve.getTangentAt(t);
        const s = new THREE.Vector3().crossVectors(tan, up).normalize();
        if (s.lengthSq() < 0.1) s.set(0, 0, 1);
        const flat = p.clone().addScaledVector(s, side * 0.2).addScaledVector(up, -0.24);
        pts.push(wrapPos(flat.x, flat.y, flat.z));
      }
      const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 44, 0.045, 6), mats.gold);
      wire.castShadow = true;
      scene.add(wire);
    }
    // リング
    const ringMats = [mats.strawberry, mats.berryBlue, mats.lemon, mats.mint, mats.grape];
    for (let i = 0; i < DROP_TUBE.rings; i++) {
      const t = (i + 0.5) / DROP_TUBE.rings;
      const p = this.curve.getPointAt(t);
      const p2 = this.curve.getPointAt(Math.min(1, t + 0.02));
      const w1 = wrapPos(p.x, p.y, p.z);
      const w2 = wrapPos(p2.x, p2.y, p2.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 10, 24), ringMats[i % ringMats.length]);
      ring.position.copy(w1);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), w2.sub(w1).normalize());
      ring.castShadow = true;
      scene.add(ring);
    }
    this.name = 'tube';
    this._cool = 0;
  }

  update(dt) {
    if (this._cool > 0) this._cool -= dt;
    if (this._cool > 0) return;
    for (const b of this.game.balls) {
      if (b.mode !== 'physics' || b.v.x < 0.2) continue;
      const dx = b.p.x - DROP_TUBE.entry.x, dy = b.p.y - DROP_TUBE.entry.y;
      if (dx * dx + dy * dy > DROP_TUBE.entry.r * DROP_TUBE.entry.r) continue;
      this._cool = 1.2;
      const n = DROP_TUBE.rings;
      const pts = [[b.p.x, b.p.y, b.p.z], ...DROP_TUBE.path.slice(1)];
      b.startRide(pts, DROP_TUBE.duration, (bb) => bb.release(DROP_TUBE.exitVel.vx, DROP_TUBE.exitVel.vy));
      for (let i = 0; i < n; i++) {
        setTimeout(() => this.game.audio.nextNote(0.7, 0), ((i + 0.5) / n) * DROP_TUBE.duration * 1000);
      }
      this.game.audio.whoosh(0.4);
      break;
    }
  }
}

// ================= 10. ターンテーブル =================
export class Turntable {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;
    const [cx, cy] = TURNTABLE.center;
    this.center = { x: cx, y: cy };

    this.group = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(TURNTABLE.radius, TURNTABLE.radius + 0.08, 0.16, 28), mats.grape);
    disc.castShadow = true;
    disc.receiveShadow = true;
    this.group.add(disc);
    // 溝(玉の通り道)
    for (const s of [1, -1]) {
      const ridge = bMesh(mats.icing, TURNTABLE.radius * 2 - 0.2, 0.22, 0.12, 0.04);
      ridge.position.set(0, 0.17, s * 0.42);
      this.group.add(ridge);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mats.lemon);
    knob.position.y = 0.24;
    this.group.add(knob);
    placeAt(this.group, cx, cy - 0.25, 0, 0);
    scene.add(this.group);
    // 軸台
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.7, 12), mats.gold);
    placeAt(base, cx, cy - 0.75, 0, 0);
    scene.add(base);
    // 受け床(取りこぼし防止・不可視)
    world.add(new BoxCollider({
      center: new THREE.Vector3(cx, cy - 0.35, 0), half: new THREE.Vector3(1.3, 0.1, 0.6),
      friction: 0.03, restitution: 0.1, name: 'turntable-floor',
    }));

    this.proxy = hitProxy(this, 1.5, cx, cy + 0.3);
    scene.add(this.proxy);

    this.carried = null;
    this.spinT = -1;   // 0..1 で 180°
    this.angle = 0;
    this.name = 'turntable';
    this.guideType = 'tap';
  }

  get guidePos() { return { x: this.center.x, y: this.center.y + 1.05 }; }
  get captured() { return !!this.carried; }

  tryCapture(ball) {
    if (this.carried || this.spinT >= 0 || ball.mode !== 'physics') return false;
    const dx = ball.p.x - TURNTABLE.entry.x, dy = ball.p.y - TURNTABLE.entry.y;
    if (dx * dx + dy * dy > TURNTABLE.entry.r * TURNTABLE.entry.r) return false;
    this.carried = ball;
    ball.captureTo(() => _v.set(TURNTABLE.seat.x, TURNTABLE.seat.y, 0).clone());
    this.game.audio.clack(620, 0.3);
    return true;
  }

  onTap() {
    if (this.spinT >= 0) return;
    this.spinT = 0;
    this.game.audio.clack(900, 0.3);
  }

  update(dt) {
    if (this.spinT >= 0) {
      this.spinT = Math.min(1, this.spinT + dt / TURNTABLE.spinTime);
      const e = 1 - Math.pow(1 - this.spinT, 3);
      this.angle = e * Math.PI;
      // ラチェット音
      if (this.spinT >= 1) {
        this.angle = 0; // 溝は対称なので見た目は連続
        this.spinT = -1;
        this.game.audio.clack(1100, 0.35);
        if (this.carried) {
          const ball = this.carried;
          this.carried = null;
          const R = TURNTABLE.release;
          ball.startRide(
            [[TURNTABLE.seat.x, TURNTABLE.seat.y, 0], [(TURNTABLE.seat.x + R.x) / 2, R.y + 0.12, 0], [R.x, R.y, 0]],
            0.4,
            (b) => b.release(R.vx, R.vy),
          );
          this.game.audio.nextNote(0.8, 0);
        }
      }
    }
    // 溝の向き+待機中はゆっくり誘うように微振動
    const idle = this.carried && this.spinT < 0 ? Math.sin(this.game.time * 6) * 0.03 : 0;
    wrapQuat(this.center.x, 0, this.group.quaternion);
    this.group.rotateY(this.angle + idle);
  }
}

// ================= 11. キャンディケーン・ハンマー =================
export class CaneHammer {
  constructor(game) {
    this.game = game;
    const { mats, scene } = game;
    const [px, py] = HAMMER.pivot;
    this.pivot = { x: px, y: py };

    this.arm = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.35, 10), mats.caneStripe);
    shaft.position.y = -0.55;
    shaft.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), mats.gummy);
    head.position.y = -1.3;
    head.castShadow = true;
    this.arm.add(shaft, head);
    placeAt(this.arm, px, py, 0, 0);
    scene.add(this.arm);
    // 支柱
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 10), mats.icing);
    placeAt(post, px + 0.55, py - 0.85, -0.4, 0);
    post.castShadow = true;
    scene.add(post);

    this.proxy = hitProxy(this, 1.5, HAMMER.dip.x, HAMMER.dip.y + 0.8);
    scene.add(this.proxy);

    this.angle = 0.95;   // 構え(右上に持ち上げ)
    this.swing = -1;
    this.name = 'hammer';
    this.guideType = 'tap';
  }

  get guidePos() { return { x: HAMMER.dip.x, y: HAMMER.dip.y + 1.5 }; }

  ballInDip() {
    return this.game.balls.find((b) => {
      if (b.mode !== 'physics' || b.v.length() > 1.2) return false;
      const dx = b.p.x - HAMMER.dip.x, dy = b.p.y - HAMMER.dip.y;
      return dx * dx + dy * dy < HAMMER.dip.r * HAMMER.dip.r;
    }) || null;
  }

  onTap() {
    if (this.swing >= 0) return;
    this.swing = 0;
  }

  update(dt) {
    if (this.swing >= 0) {
      this.swing += dt;
      if (this.swing < 0.14) {
        this.angle = 0.95 - (this.swing / 0.14) * 1.35; // 振り下ろし → -0.4
        if (this.swing + dt >= 0.14) {
          // ヒット判定の瞬間
          const ball = this.ballInDip();
          this.game.audio.whack();
          if (ball) {
            const A = HAMMER.arc;
            ball.startRide([[ball.p.x, ball.p.y, 0], A.peak, A.to], A.duration, (b) => b.release(0.6, -0.3));
            this.game.particles.burst(wrapPos(ball.p.x, ball.p.y, 0.2), 8, 2.0);
          }
        }
      } else if (this.swing < 1.0) {
        this.angle += ((0.95 - this.angle)) * Math.min(1, dt * 5);
      } else {
        this.swing = -1;
        this.angle = 0.95;
      }
    } else {
      // 待機のゆらゆら
      this.angle = 0.95 + Math.sin(this.game.time * 2.2) * 0.05;
    }
    wrapQuat(this.pivot.x, this.angle, this.arm.quaternion);
  }
}

// ================= 12. ループザループ(自動) =================
export class LoopTheLoop {
  constructor(game) {
    this.game = game;
    this.name = 'loop';
    this._cool = 0;
    // 通過点を生成(下→前→上→後→下)
    const [cx, cy] = LOOP.center;
    this.pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
      this.pts.push([cx + Math.cos(a) * LOOP.r, cy + Math.sin(a) * LOOP.r, 0]);
    }
  }

  update(dt) {
    if (this._cool > 0) { this._cool -= dt; return; }
    for (const b of this.game.balls) {
      if (b.mode !== 'physics' || b.v.x < LOOP.entry.minVx) continue;
      const dx = b.p.x - LOOP.entry.x, dy = b.p.y - LOOP.entry.y;
      if (dx * dx + dy * dy > LOOP.entry.r * LOOP.entry.r) continue;
      this._cool = 1.0;
      const pts = [[b.p.x, b.p.y, 0], ...this.pts.slice(1, 12), [LOOP.exit.x, LOOP.exit.y, 0]];
      b.startRide(pts, LOOP.duration, (bb) => bb.release(LOOP.exit.vx, LOOP.exit.vy), { spin: 16 });
      this.game.audio.whoosh(0.5);
      this.game.particles.burst(wrapPos(b.p.x, b.p.y, 0.3), 10, 2.2);
      break;
    }
  }
}

// ================= 13. ドミノクッキー+ゲート =================
export class DominoGate {
  constructor(game) {
    this.game = game;
    const { world, mats, scene } = game;

    // ボタン(ゼリービーンズ)
    this.button = new THREE.Group();
    const bStand = bMesh(mats.icing, 0.4, 0.16, 0.4, 0.04);
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mats.gummyGreen);
    bean.scale.set(1.3, 0.75, 1);
    bean.position.y = 0.18;
    bean.castShadow = true;
    this.button.add(bStand, bean);
    this.bean = bean;
    placeAt(this.button, DOMINO.button.x, DOMINO.button.y, 0.6, 0);
    scene.add(this.button);

    // クッキードミノの列
    this.dominos = [];
    const R = DOMINO.row;
    for (let i = 0; i < R.n; i++) {
      const x = R.x0 + (i / (R.n - 1)) * (R.x1 - R.x0);
      const d = new THREE.Group();
      const slab = bMesh(mats.biscuitDark, 0.16, 0.72, 0.5, 0.04);
      slab.position.y = 0.36;
      const choc = bMesh(mats.chocolate, 0.06, 0.5, 0.34, 0.02);
      choc.position.set(0.06, 0.36, 0);
      d.add(slab, choc);
      placeAt(d, x, R.y, R.z, 0);
      scene.add(d);
      this.dominos.push(d);
    }

    // ゲート(キャンディバー)
    this.gateCol = world.add(new BoxCollider({
      center: new THREE.Vector3(DOMINO.gate.x, DOMINO.gate.y + 0.35, 0),
      half: new THREE.Vector3(0.08, 0.5, 0.5), restitution: 0.1, name: 'gate',
    }));
    this.gateMesh = bMesh(mats.caneStripe, 0.16, 1.0, 0.9, 0.05);
    scene.add(this.gateMesh);
    this._gateAngle = 0;
    this._syncGate();

    this.proxy = hitProxy(this, 1.4, DOMINO.button.x, DOMINO.button.y + 0.4, 0.6);
    scene.add(this.proxy);

    this.state = 'armed';  // armed | falling | open | resetting
    this.timer = 0;
    this.fallen = 0;
    this.name = 'domino';
    this.guideType = 'tap';
  }

  get guidePos() { return { x: DOMINO.button.x, y: DOMINO.button.y + 1.0 }; }
  get gateClosed() { return this.state !== 'open'; }

  ballWaitingAtGate() {
    return this.game.balls.some((b) => b.mode === 'physics'
      && b.p.x > DOMINO.gate.x - 1.6 && b.p.x < DOMINO.gate.x && Math.abs(b.p.y - (DOMINO.gate.y - 0.15)) < 0.7);
  }

  onTap() {
    if (this.state !== 'armed') return;
    this.state = 'falling';
    this.timer = 0;
    this.fallen = 0;
    this.bean.scale.y = 0.45; // ぺこっ
    this.game.audio.clack(650, 0.3);
  }

  update(dt) {
    this.bean.scale.y += (0.75 - this.bean.scale.y) * Math.min(1, dt * 8);
    if (this.state === 'falling') {
      this.timer += dt;
      const should = Math.min(this.dominos.length, Math.floor(this.timer / DOMINO.stepTime) + 1);
      while (this.fallen < should) {
        this.fallen++;
        this.game.audio.nextNote(0.75, 0);
      }
      // 倒れアニメ
      this.dominos.forEach((d, i) => {
        const k = Math.max(0, Math.min(1, (this.timer - i * DOMINO.stepTime) / 0.18));
        d.rotation.z = -k * 1.25;
      });
      if (this.fallen >= this.dominos.length && this.timer > this.dominos.length * DOMINO.stepTime + 0.2) {
        this.state = 'open';
        this.timer = 0;
        this.gateCol.enabled = false;
        this.game.audio.clack(1000, 0.4);
      }
    } else if (this.state === 'open') {
      this.timer += dt;
      this._gateAngle += (1.35 - this._gateAngle) * Math.min(1, dt * 8);
      const passed = this.game.balls.some((b) => b.mode === 'physics' && b.p.x > DOMINO.gate.x + 0.5 && b.p.x < DOMINO.gate.x + 3);
      if (this.timer > DOMINO.gate.openTime || (passed && this.timer > 1.2)) {
        this.state = 'resetting';
        this.timer = 0;
      }
    } else if (this.state === 'resetting') {
      this.timer += dt;
      this._gateAngle += (0 - this._gateAngle) * Math.min(1, dt * 6);
      this.dominos.forEach((d) => {
        d.rotation.z += (0 - d.rotation.z) * Math.min(1, dt * 5);
      });
      if (this.timer > 1.0) {
        this.state = 'armed';
        this.gateCol.enabled = true;
        this.game.audio.boing();
      }
    }
    this._syncGate();
  }

  _syncGate() {
    wrapPos(DOMINO.gate.x, DOMINO.gate.y + 0.35, 0, this.gateMesh.position);
    wrapQuat(DOMINO.gate.x, this._gateAngle, this.gateMesh.quaternion);
  }
}

// ================= 14. マカロン大砲 =================
export class MacaronCannon {
  constructor(game) {
    this.game = game;
    const { mats, scene } = game;
    const [px, py] = CANNON.base;
    this.pivot = { x: px, y: py };

    this.barrel = new THREE.Group();
    const shellA = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.5, 20), mats.pinkStripe);
    shellA.position.y = 0.5;
    const filling = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 20), mats.cream);
    filling.position.y = 0.18;
    const shellB = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.32, 20), mats.pinkStripe);
    shellB.position.y = -0.08;
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 10, 20), mats.strawberry);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.y = 0.78;
    this.barrel.add(shellA, filling, shellB, mouth);
    this.barrel.traverse((c) => { if (c.isMesh) { c.castShadow = true; } });
    placeAt(this.barrelRoot = new THREE.Group(), px, py, 0, 0);
    this.barrelRoot.add(this.barrel);
    this.barrel.rotation.z = -0.5; // 砲身は右上向き
    scene.add(this.barrelRoot);

    this.proxy = hitProxy(this, 1.6, CANNON.cup.x - 0.3, CANNON.cup.y + 0.6);
    scene.add(this.proxy);

    this.carried = null;
    this.charge = 0;
    this.charging = false;
    this._recoil = 0;
    this.name = 'cannon';
    this.guideType = 'hold';
  }

  get guidePos() { return { x: CANNON.cup.x - 0.6, y: CANNON.cup.y + 1.2 }; }
  get captured() { return !!this.carried; }

  cupFlatPos() {
    return _v.set(CANNON.cup.x + 0.15 - this.charge * 0.3, CANNON.cup.y + 0.35, 0).clone();
  }

  tryCapture(ball) {
    if (this.carried || ball.mode !== 'physics') return false;
    const dx = ball.p.x - CANNON.cup.x, dy = ball.p.y - CANNON.cup.y;
    if (dx * dx + dy * dy > CANNON.cup.r * CANNON.cup.r) return false;
    this.carried = ball;
    ball.captureTo(() => this.cupFlatPos());
    this.game.audio.clack(450, 0.3);
    return true;
  }

  onPressStart() {
    if (!this.carried) return;
    this.charging = true;
    this.charge = 0;
  }

  onPressEnd() {
    if (!this.charging) return;
    this.charging = false;
    const c = this.charge;
    this.charge = 0;
    this.game.audio.chargeEnd(c >= CANNON.minCharge);
    if (!this.carried) return;
    const ball = this.carried;
    if (c < CANNON.minCharge) {
      this.game.audio.boing();
      this.carried = null;
      const cp = this.cupFlatPos();
      ball.startRide([[cp.x, cp.y, 0], CANNON.weakArc.peak, [cp.x, cp.y + 0.1, 0]], CANNON.weakArc.duration, (b) => b.release(0, -0.5));
      return;
    }
    // 発射! 塔を1周まわって頂上ケーキへ
    this.carried = null;
    this._recoil = 1;
    const cp = this.cupFlatPos();
    ball.startRide([[cp.x, cp.y, 0], ...CANNON.path.slice(1)], CANNON.duration, (b) => {
      this.game.onGoalReached(b);
    }, { spin: 14 });
    this.game.particles.trailFollow(ball, CANNON.duration);
  }

  update(dt) {
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / CANNON.chargeTime);
      this.game.audio.chargeTone(this.charge);
      this.barrel.rotation.z = -0.5 - this.charge * 0.25 + Math.sin(this.game.time * 40) * 0.008 * this.charge;
      this.barrel.position.y = -this.charge * 0.18;
    } else if (this._recoil > 0) {
      this._recoil = Math.max(0, this._recoil - dt * 2.2);
      this.barrel.position.y = -Math.sin(this._recoil * Math.PI) * 0.3;
      this.barrel.rotation.z = -0.5;
    } else {
      this.barrel.rotation.z = -0.5 + Math.sin(this.game.time * 1.8) * 0.02;
      this.barrel.position.y = 0;
    }
  }
}

// ================= 4. オルゴールシリンダー(自動) =================
export class MusicDrum {
  constructor(game) {
    this.game = game;
    const { mats, scene } = game;
    const [cx, cy] = MUSIC_DRUM.center;
    this.drum = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(MUSIC_DRUM.r, MUSIC_DRUM.r, 3.4, 18), mats.gold);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    this.drum.add(body);
    // ピン
    for (let i = 0; i < 26; i++) {
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mats.icing);
      const a = (i * 2.4) % (Math.PI * 2);
      pin.position.set(-1.5 + (i / 26) * 3.0, Math.sin(a) * (MUSIC_DRUM.r + 0.03), Math.cos(a) * (MUSIC_DRUM.r + 0.03));
      this.drum.add(pin);
    }
    placeAt(this.drum, cx, cy, 0, 0);
    scene.add(this.drum);
    // くし歯(コーム)
    const comb = bMesh(mats.gold, 3.0, 0.08, 0.5, 0.02);
    placeAt(comb, cx, cy - MUSIC_DRUM.r - 0.18, 0.35, 0.06);
    scene.add(comb);

    this.name = 'musicDrum';
    this._acc = 0;
    this.rolling = false;
  }

  update(dt) {
    this.rolling = this.game.balls.some((b) => b.mode === 'physics' && b.groundedFlag
      && b.p.x > MUSIC_DRUM.x0 && b.p.x < MUSIC_DRUM.x1 && Math.abs(b.v.x) > 0.4);
    if (this.rolling) {
      this.drum.rotateX(dt * 2.4);
      this._acc += dt;
      if (this._acc >= MUSIC_DRUM.noteEvery) {
        this._acc = 0;
        this.game.audio.nextNote(0.65, 0);
      }
    }
  }
}

// ================= 6. チョコの滝(自動) =================
export class ChocoFall {
  constructor(game) {
    this.game = game;
    const { mats, scene } = game;
    // 滝のカーテン(薄い箱)+受け皿
    this.curtain = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.7, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x5a341f, roughness: 0.15, transparent: true, opacity: 0.85 }),
    );
    placeAt(this.curtain, CHOCO_FALL.x, CHOCO_FALL.y + 0.9, 0, 0);
    scene.add(this.curtain);
    const spout = bMesh(mats.chocolate, 0.9, 0.35, 1.0, 0.08);
    placeAt(spout, CHOCO_FALL.x, CHOCO_FALL.y + 1.85, 0, 0);
    scene.add(spout);
    // 滴(上下アニメ)
    this.drips = [];
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mats.chocolate);
      d.scale.y = 1.8;
      scene.add(d);
      this.drips.push({ mesh: d, ph: i / 4 });
    }
    this.name = 'chocoFall';
  }

  update(dt) {
    for (const d of this.drips) {
      d.ph = (d.ph + dt * 0.6) % 1;
      wrapPos(CHOCO_FALL.x + Math.sin(d.ph * 9) * 0.12, CHOCO_FALL.y + 1.6 - d.ph * 1.5, 0.28, d.mesh.position);
    }
    for (const b of this.game.balls) {
      if (b.mode !== 'physics' || b.chocoT > 0) continue;
      if (Math.abs(b.p.x - CHOCO_FALL.x) < CHOCO_FALL.halfW && Math.abs(b.p.y - CHOCO_FALL.y) < 0.8) {
        b.setChoco(CHOCO_FALL.tintTime);
        this.game.audio.nextNote(0.6);
        this.game.particles.burst(wrapPos(b.p.x, b.p.y, 0.3), 6, 1.2, 0x6b4226);
      }
    }
  }
}
