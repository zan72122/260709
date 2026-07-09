// gimmicks.js — 可動ギミック: ホッパー/シーソー/水車/エレベーター/スイッチ/落下チューブ/カタパルト/ゴール
import * as THREE from '../vendor/three.module.min.js';
import { BoxCollider, CylinderZCollider } from './physics.js';
import { roundedBox } from './machine.js';
import {
  HOPPER, SEESAW, WHEEL, ELEVATOR, SWITCH, DROP_TUBE, CATAPULT, GOAL,
} from './layout.js';

const Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();

function bMesh(mat, w, h, d, r = 0.04) {
  const m = new THREE.Mesh(roundedBox(w, h, d, r), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// タップ判定用の大きな不可視プロキシ球(小さな指でも当たる)
function hitProxy(gimmick, radius = 1.15) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  m.userData.gimmick = gimmick;
  return m;
}

// ---- 回転キネマティック部品セット(シーソー・ホッパー・スイッチ・カタパルト) ----
class KinematicAssembly {
  constructor(world, pivotX, pivotY) {
    this.pivot = new THREE.Vector3(pivotX, pivotY, 0);
    this.group = new THREE.Group();
    this.group.position.copy(this.pivot);
    this.parts = [];
    this.angle = 0;
    this.world = world;
  }

  // localPos: pivot からの相対位置
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
    this.group.rotation.z = a;
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

// ================= ホッパー(スタート) =================
export class Hopper {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    const [hx, hy] = HOPPER.pos;
    // 傾く容器: pivot は右下端
    this.asm = new KinematicAssembly(world, hx + 0.6, hy - 0.2);
    const floorM = bMesh(mats.walnut, 1.34, 0.16, 1.0);
    this.asm.addPart({ mesh: floorM, lx: -0.62, ly: 0.0, half: new THREE.Vector3(0.67, 0.08, 0.5), name: 'hopper-floor' });
    const leftW = bMesh(mats.blue, 0.14, 0.85, 1.0);
    this.asm.addPart({ mesh: leftW, lx: -1.26, ly: 0.42, half: new THREE.Vector3(0.07, 0.42, 0.5), name: 'hopper-left' });
    // 右の縁は低く(待機中はこぼれず、傾けたら玉が乗り越えられる高さ)
    const lipR = bMesh(mats.blue, 0.1, 0.16, 1.0);
    this.asm.addPart({ mesh: lipR, lx: 0.02, ly: 0.12, half: new THREE.Vector3(0.05, 0.08, 0.5), name: 'hopper-lip' });
    for (const s of [1, -1]) {
      const zw = bMesh(mats.cream, 1.34, 0.6, 0.1);
      this.asm.addPart({ mesh: zw, lx: -0.62, ly: 0.3, lz: s * 0.45, half: new THREE.Vector3(0.67, 0.3, 0.05), name: 'hopper-z' });
    }
    game.scene.add(this.asm.group);

    // ハンドル(レバー+赤い玉ノブ)
    this.handle = new THREE.Group();
    const stem = bMesh(mats.walnut, 0.1, 0.62, 0.1, 0.03);
    stem.position.y = 0.31;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), mats.red);
    knob.position.y = 0.68;
    knob.castShadow = true;
    this.handle.add(stem, knob);
    this.handle.position.set(HOPPER.handle.x, HOPPER.handle.y, 0.35);
    game.scene.add(this.handle);
    // 台座
    const mount = bMesh(mats.beech, 0.42, 0.16, 0.42);
    mount.position.set(HOPPER.handle.x, HOPPER.handle.y - 0.02, 0.35);
    game.scene.add(mount);

    this.proxy = hitProxy(this, 1.2);
    this.proxy.position.set(HOPPER.handle.x + 0.3, HOPPER.handle.y + 0.5, 0.3);
    game.scene.add(this.proxy);

    this.timer = -1; // <0: 待機
    this.guideType = 'tap';
    this.name = 'hopper';
  }

  get guidePos() { return new THREE.Vector3(HOPPER.handle.x, HOPPER.handle.y + 0.8, 0.4); }

  onTap() {
    if (this.timer >= 0) return;
    this.timer = 0;
    this.game.audio.woodClack(700, 0.35);
  }

  update(dt) {
    // レバーの押し込み+ホッパー傾き
    if (this.timer >= 0) {
      this.timer += dt;
      const t = this.timer;
      const tip = HOPPER.tipTime, hold = HOPPER.holdTime;
      let a;
      if (t < tip) a = HOPPER.tipAngle * (t / tip);
      else if (t < tip + hold) a = HOPPER.tipAngle;
      else if (t < tip + hold + 0.45) a = HOPPER.tipAngle * (1 - (t - tip - hold) / 0.45);
      else { a = 0; this.timer = -1; }
      const prev = this.asm.angle;
      this.asm.setAngle(a, dt > 0 ? (a - prev) / dt : 0);
      // レバーはタップ直後にペコッと傾く
      this.handle.rotation.z = -0.5 * Math.max(0, 1 - t * 2.2);
    } else {
      // 待機中の微かな呼吸
      this.handle.rotation.z = Math.sin(this.game.time * 2) * 0.03;
    }
  }
}

// ================= シーソー =================
export class Seesaw {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    const [px, py] = SEESAW.pivot;
    this.asm = new KinematicAssembly(world, px, py);
    const plank = bMesh(mats.red, SEESAW.halfLen * 2, 0.16, 1.0, 0.05);
    this.asm.addPart({ mesh: plank, half: new THREE.Vector3(SEESAW.halfLen, 0.08, 0.5), name: 'seesaw' });
    const tipL = bMesh(mats.yellow, 0.12, 0.16, 1.0);
    this.asm.addPart({ mesh: tipL, lx: -SEESAW.halfLen + 0.06, ly: 0.15, half: new THREE.Vector3(0.06, 0.08, 0.5), name: 'seesaw-tip' });
    for (const s of [1, -1]) {
      const lip = bMesh(mats.yellow, SEESAW.halfLen * 2, 0.3, 0.09, 0.03);
      this.asm.addPart({ mesh: lip, ly: 0.16, lz: s * 0.455, half: new THREE.Vector3(SEESAW.halfLen, 0.15, 0.045), name: 'seesaw-lip' });
    }
    game.scene.add(this.asm.group);

    // 支柱: 背板から伸びる腕 + 軸ピン
    const armB = bMesh(mats.beechV, 0.22, 0.22, 1.2, 0.04);
    armB.position.set(px, py - 0.2, -0.5);
    game.scene.add(armB);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 12), mats.brass);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(px, py, 0);
    game.scene.add(pin);

    this.proxy = hitProxy(this, 1.7);
    this.proxy.position.set(px, py, 0);
    game.scene.add(this.proxy);

    this.target = SEESAW.restTilt;
    this.angVel = 0;
    this.name = 'seesaw';
    this.guideType = 'tap';
    this.asm.setAngle(this.target, 0);
  }

  get guidePos() { const [px, py] = SEESAW.pivot; return new THREE.Vector3(px + 0.4, py + 0.55, 0.4); }
  get tiltLeft() { return this.target > 0; }

  onTap() {
    this.target = -this.target;
    this.game.audio.woodClack(560, 0.3);
  }

  update(dt) {
    const a = this.asm.angle;
    const next = a + (this.target - a) * Math.min(1, dt * 7.5);
    this.asm.setAngle(next, dt > 0 ? (next - a) / dt : 0);
  }
}

// ================= 水車(ウォーターホイール) =================
export class WaterWheel {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    const [cx, cy] = WHEEL.center;
    this.center = new THREE.Vector3(cx, cy, 0);
    this.group = new THREE.Group();
    this.group.position.copy(this.center);

    // 背面ディスク+前面リング+スポーク+ハブ
    const backDisc = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL.radius + 0.06, WHEEL.radius + 0.06, 0.1, 32), mats.green);
    backDisc.rotation.x = Math.PI / 2;
    backDisc.position.z = -0.34;
    backDisc.castShadow = true;
    const frontRing = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.07, 10, 36), mats.green);
    frontRing.position.z = 0.3;
    frontRing.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.85, 14), mats.brass);
    hub.rotation.x = Math.PI / 2;
    this.group.add(backDisc, frontRing, hub);
    for (let i = 0; i < 4; i++) {
      const spoke = bMesh(mats.beechV, WHEEL.radius * 2 - 0.2, 0.1, 0.08, 0.03);
      spoke.rotation.z = (i / 4) * Math.PI;
      spoke.position.z = 0.3;
      this.group.add(spoke);
    }
    // ポケット(玉を受けるカップ)×4 + 縁の赤ノブ
    this.pocketBase = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (const a of this.pocketBase) {
      const cup = new THREE.Group();
      const back = bMesh(mats.yellow, 0.62, 0.14, 0.7, 0.03);
      back.position.set(0, -0.28, 0);
      const side1 = bMesh(mats.yellow, 0.14, 0.42, 0.7, 0.03);
      side1.position.set(-0.3, -0.08, 0);
      const side2 = bMesh(mats.yellow, 0.14, 0.3, 0.7, 0.03);
      side2.position.set(0.3, -0.13, 0);
      cup.add(back, side1, side2);
      cup.position.set(Math.cos(a) * (WHEEL.radius - 0.3), Math.sin(a) * (WHEEL.radius - 0.3), 0);
      cup.rotation.z = a + Math.PI / 2;
      this.group.add(cup);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.red);
      knob.position.set(Math.cos(a + Math.PI / 4) * (WHEEL.radius + 0.02), Math.sin(a + Math.PI / 4) * (WHEEL.radius + 0.02), 0.3);
      this.group.add(knob);
    }
    game.scene.add(this.group);

    // 軸受け(背板から)
    const mount = bMesh(mats.beechV, 0.24, 0.24, 0.9, 0.04);
    mount.position.set(cx, cy, -0.6);
    game.scene.add(mount);

    // 物理: 外周の円柱(捕捉されない玉の弾き)
    this.cyl = world.add(new CylinderZCollider({
      center: this.center, radius: 0.7, halfDepth: 0.4, restitution: 0.4, name: 'wheel',
    }));

    this.proxy = hitProxy(this, 1.6);
    this.proxy.position.copy(this.center);
    game.scene.add(this.proxy);

    this.theta = 0;         // 現在の回転
    this.spin = null;       // {from, to, t}
    this.captured = false;
    this.carriedBase = 0;   // 玉を運ぶポケットの基準角
    this.name = 'wheel';
    this.guideType = 'tap';
  }

  get guidePos() { return new THREE.Vector3(this.center.x - 0.2, this.center.y + 1.1, 0.45); }

  pocketWorldPos(base) {
    const a = base + this.theta;
    return new THREE.Vector3(
      this.center.x + Math.cos(a) * (WHEEL.radius - 0.34),
      this.center.y + Math.sin(a) * (WHEEL.radius - 0.34) + 0.12,
      0,
    );
  }

  tryCapture(ball) {
    if (this.captured || this.spin) return false;
    // 水車の下〜右下側のみ(上のレールを転がる玉は拾わない)
    if (ball.p.y > this.center.y + 0.15 || ball.p.x < this.center.x - 0.6) return false;
    const dx = ball.p.x - WHEEL.intake.x, dy = ball.p.y - WHEEL.intake.y;
    if (dx * dx + dy * dy > WHEEL.intake.r * WHEEL.intake.r) return false;
    this.captured = true;
    // いちばん下(-90°)にあるポケットに乗せる
    this.carriedBase = -Math.PI / 2 - this.theta;
    ball.captureTo(() => this.pocketWorldPos(this.carriedBase));
    this.game.audio.woodClack(500, 0.35);
    return true;
  }

  onTap() {
    if (this.spin) return;
    this.spin = { from: this.theta, to: this.theta + WHEEL.stepAngle, t: 0 };
    this.game.audio.woodClack(880, 0.28);
  }

  update(dt) {
    if (this.spin) {
      this.spin.t = Math.min(1, this.spin.t + dt / WHEEL.spinTime);
      const k = this.spin.t;
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      const prev = this.theta;
      this.theta = this.spin.from + (this.spin.to - this.spin.from) * e;
      this.cyl.angVelZ = dt > 0 ? (this.theta - prev) / dt : 0;
      if (k >= 1) {
        this.spin = null;
        this.cyl.angVelZ = 0;
        this.game.audio.woodClack(1100, 0.4); // カタン
        this._maybeRelease();
      }
    }
    this.group.rotation.z = this.theta;
  }

  _maybeRelease() {
    if (!this.captured) return;
    const worldA = this.carriedBase + this.theta;
    // 最上部(+90°)に到達したら左のレールへ放す
    const norm = Math.atan2(Math.sin(worldA), Math.cos(worldA));
    if (Math.abs(norm - Math.PI / 2) < 0.1) {
      const ball = this.game.ball;
      this.captured = false;
      const top = this.pocketWorldPos(this.carriedBase);
      ball.startRide(
        [[top.x, top.y, 0], [top.x - 0.4, top.y + 0.22, 0], [WHEEL.release.x, WHEEL.release.y, 0]],
        0.45,
        (b) => b.release(WHEEL.release.vx, WHEEL.release.vy),
      );
      this.game.audio.impact(top.y, 3);
    }
  }
}

// ================= エレベーター =================
export class Elevator {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    this.x = ELEVATOR.x;
    this.y = ELEVATOR.bottom;
    const P = ELEVATOR.platform;

    // プラットフォーム(可動)
    this.platGroup = new THREE.Group();
    const plate = bMesh(mats.blue, P.hw * 2, P.hh * 2, P.hd * 2, 0.04);
    this.platGroup.add(plate);
    const lipL = bMesh(mats.yellow, 0.1, 0.34, P.hd * 2, 0.03);
    lipL.position.set(-P.hw + 0.05, 0.22, 0);
    const lipR = bMesh(mats.yellow, 0.1, 0.22, P.hd * 2, 0.03);
    lipR.position.set(P.hw - 0.05, 0.16, 0);
    this.platGroup.add(lipL, lipR);
    for (const s of [1, -1]) {
      const zl = bMesh(mats.yellow, P.hw * 2, 0.26, 0.09, 0.03);
      zl.position.set(0, 0.18, s * (P.hd - 0.045));
      this.platGroup.add(zl);
    }
    game.scene.add(this.platGroup);

    // コライダー
    this.cols = [];
    const mk = (lx, ly, half) => {
      const c = world.add(new BoxCollider({
        center: new THREE.Vector3(this.x + lx, this.y + ly, 0), half, friction: 0.02, restitution: 0.1, name: 'elevator',
      }));
      c._lx = lx; c._ly = ly;
      this.cols.push(c);
      return c;
    };
    mk(0, -P.hh, new THREE.Vector3(P.hw, P.hh, P.hd));
    mk(-P.hw + 0.05, 0.15, new THREE.Vector3(0.05, 0.17, P.hd));
    mk(P.hw - 0.05, 0.1, new THREE.Vector3(0.05, 0.11, P.hd));
    for (const s of [1, -1]) mk(0, 0.12, new THREE.Vector3(P.hw, 0.13, 0.045)).center.z = s * (P.hd - 0.045);
    // z位置補正
    this.cols[3].center.z = P.hd - 0.045;
    this.cols[4].center.z = -(P.hd - 0.045);

    // シャフト(ガイドレール2本)+滑車+カウンターウェイト
    for (const lx of [-P.hw - 0.12, P.hw + 0.12]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ELEVATOR.top - ELEVATOR.bottom + 1.5, 8), mats.walnut);
      rail.position.set(this.x + lx, (ELEVATOR.top + ELEVATOR.bottom) / 2 + 0.4, -0.3);
      rail.castShadow = true;
      game.scene.add(rail);
    }
    this.pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 20), mats.red);
    this.pulley.rotation.x = Math.PI / 2;
    this.pulley.position.set(this.x, ELEVATOR.top + 1.15, -0.3);
    this.pulley.castShadow = true;
    game.scene.add(this.pulley);
    this.weight = bMesh(mats.walnut, 0.3, 0.5, 0.3, 0.05);
    this.weight.position.set(this.x + 0.75, ELEVATOR.top - 1, -0.55);
    game.scene.add(this.weight);
    // ロープ(細いライン)
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x6b4a2f });
    this.rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), ropeMat);
    game.scene.add(this.rope);

    this.proxy = hitProxy(this, 1.5);
    game.scene.add(this.proxy);

    this.pressed = false;
    this.moving = 0;
    this.name = 'elevator';
    this.guideType = 'hold';
    this._handoffDone = false;
    this._sync();
  }

  get guidePos() { return new THREE.Vector3(this.x + 0.75, this.y + 0.9, 0.45); }

  onPressStart() { this.pressed = true; }
  onPressEnd() { this.pressed = false; }

  ballOnPlatform() {
    const b = this.game.ball;
    return b.mode === 'physics'
      && Math.abs(b.p.x - this.x) < ELEVATOR.platform.hw + 0.2
      && b.p.y > this.y + 0.1 && b.p.y < this.y + 0.85;
  }

  update(dt) {
    const prevY = this.y;
    if (this.pressed) this.y = Math.min(ELEVATOR.top, this.y + ELEVATOR.speedUp * dt);
    else this.y = Math.max(ELEVATOR.bottom, this.y - ELEVATOR.speedDown * dt);
    const vy = dt > 0 ? (this.y - prevY) / dt : 0;
    this.moving = vy;
    this.game.audio.elevatorCreak(Math.abs(vy) > 0.05 && this.pressed);
    this._sync(vy);
    this.pulley.rotation.z -= vy * dt * 6;
    this.weight.position.y = ELEVATOR.top - 1 - (this.y - ELEVATOR.bottom) * 0.8;

    // 頂上でボールを R4 へ送り出す
    if (this.y >= ELEVATOR.top - 0.02 && this.ballOnPlatform()) {
      const b = this.game.ball;
      const h = ELEVATOR.handoff;
      b.startRide(
        [[b.p.x, b.p.y, 0], [(b.p.x + h.x) / 2, h.y + 0.05, 0], [h.x, h.y, 0]],
        0.5,
        (bb) => bb.release(h.vx, h.vy),
      );
      this.game.audio.impact(h.y, 2.5);
    }
  }

  _sync(vy = 0) {
    this.platGroup.position.set(this.x, this.y, 0);
    for (const c of this.cols) {
      c.center.x = this.x + c._lx;
      c.center.y = this.y + c._ly;
      c.linVel.set(0, vy, 0);
    }
    this.proxy.position.set(this.x + 0.2, this.y + 0.4, 0);
    const pts = [
      new THREE.Vector3(this.x, this.y + 0.1, -0.3),
      new THREE.Vector3(this.x, ELEVATOR.top + 1.15, -0.3),
      new THREE.Vector3(this.x + 0.75, ELEVATOR.top + 1.05, -0.42),
      new THREE.Vector3(this.weight.position.x, this.weight.position.y + 0.25, -0.55),
    ];
    this.rope.geometry.setFromPoints(pts);
  }
}

// ================= スイッチ(分岐フリッパー) =================
export class SwitchRail {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    const [px, py] = SWITCH.pivot;
    const hl = SWITCH.halfLen;
    this.asm = new KinematicAssembly(world, px, py);
    const plank = bMesh(mats.coral, hl * 2, 0.14, 0.95, 0.04);
    this.asm.addPart({ mesh: plank, half: new THREE.Vector3(hl, 0.07, 0.475), name: 'switch' });
    for (const s of [1, -1]) {
      const lip = bMesh(mats.coral, hl * 2, 0.22, 0.08, 0.03);
      this.asm.addPart({ mesh: lip, ly: 0.12, lz: s * 0.435, half: new THREE.Vector3(hl, 0.11, 0.04), name: 'switch-lip' });
    }
    // 矢印インジケーター(上に乗る木の矢印)
    this.arrow = new THREE.Group();
    const shaft = bMesh(mats.cream, 0.5, 0.09, 0.09, 0.03);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), mats.cream);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.32;
    this.arrow.add(shaft, head);
    this.arrow.position.set(0, 0.32, 0);
    this.asm.group.add(this.arrow);
    game.scene.add(this.asm.group);

    // 軸
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 12), mats.brass);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(px, py, 0);
    game.scene.add(pin);
    const mount = bMesh(mats.beechV, 0.2, 0.2, 0.8, 0.04);
    mount.position.set(px, py - 0.05, -0.55);
    game.scene.add(mount);

    this.proxy = hitProxy(this, 1.35);
    this.proxy.position.set(px, py + 0.1, 0);
    game.scene.add(this.proxy);

    this.state = 'L'; // L: ループ側 / R: 先へ進む側
    this.name = 'switch';
    this.guideType = 'tap';
    this.asm.setAngle(SWITCH.angle, 0);
  }

  get guidePos() { const [px, py] = SWITCH.pivot; return new THREE.Vector3(px + 0.3, py + 0.7, 0.4); }
  get target() { return this.state === 'L' ? SWITCH.angle : -SWITCH.angle; }

  onTap() {
    this.state = this.state === 'L' ? 'R' : 'L';
    this.game.audio.woodClack(760, 0.35);
  }

  update(dt) {
    const a = this.asm.angle;
    const next = a + (this.target - a) * Math.min(1, dt * 9);
    this.asm.setAngle(next, dt > 0 ? (next - a) / dt : 0);
  }
}

// ================= 落下チューブ=ワイヤースライド(前面レイヤーのリングくぐり) =================
export class DropTube {
  constructor(game) {
    this.game = game;
    const { mats } = game;
    this.curve = new THREE.CatmullRomCurve3(
      DROP_TUBE.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.4,
    );
    // ワイヤーレール2本(玉の通り道の下を並走する真鍮の針金)
    const up = new THREE.Vector3(0, 1, 0);
    const mkWire = (side) => {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const p = this.curve.getPointAt(t);
        const tan = this.curve.getTangentAt(t);
        const s = new THREE.Vector3().crossVectors(tan, up).normalize();
        if (s.lengthSq() < 0.1) s.set(0, 0, 1);
        pts.push(p.clone().addScaledVector(s, side * 0.2).addScaledVector(up, -0.24));
      }
      const c = new THREE.CatmullRomCurve3(pts);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.045, 6), mats.brass);
      wire.castShadow = true;
      game.scene.add(wire);
    };
    mkWire(1);
    mkWire(-1);
    // リング(通過するとカラン♪)
    for (let i = 0; i < DROP_TUBE.rings; i++) {
      const t = (i + 0.5) / DROP_TUBE.rings;
      const pos = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 10, 24),
        i % 2 === 0 ? mats.blue : mats.yellow);
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(Z, tan);
      ring.castShadow = true;
      game.scene.add(ring);
    }
    this.name = 'dropTube';
    this._cool = 0;
  }

  update(dt) {
    if (this._cool > 0) this._cool -= dt;
    const b = this.game.ball;
    if (b.mode !== 'physics' || this._cool > 0) return;
    // 右向きに動く玉のみ入る(R3 を左へ転がる玉は無視)
    if (b.v.x < 0.2) return;
    const dx = b.p.x - DROP_TUBE.entry.x, dy = b.p.y - DROP_TUBE.entry.y;
    if (dx * dx + dy * dy > DROP_TUBE.entry.r * DROP_TUBE.entry.r) return;
    this._cool = 2.5;
    const n = DROP_TUBE.rings;
    let ringIdx = 0;
    const pts = [[b.p.x, b.p.y, b.p.z], ...DROP_TUBE.path.slice(1)];
    b.startRide(pts, DROP_TUBE.duration, (bb) => {
      bb.release(DROP_TUBE.exitVel.vx, DROP_TUBE.exitVel.vy);
    });
    // リング通過音をタイミング予約
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.game.audio.tubeRing(i, n), ((i + 0.5) / n) * DROP_TUBE.duration * 1000);
    }
    void ringIdx;
  }
}

// ================= カタパルト =================
export class Catapult {
  constructor(game) {
    this.game = game;
    const { world, mats } = game;
    const [px, py] = CATAPULT.pivot;
    this.pivot = new THREE.Vector3(px, py, 0);

    // 土台
    const base = bMesh(mats.walnut, 1.8, 0.3, 1.2, 0.05);
    base.position.set(px - 0.35, py - 0.45, 0);
    game.scene.add(base);
    world.add(new BoxCollider({
      center: new THREE.Vector3(px - 0.35, py - 0.45, 0), half: new THREE.Vector3(0.9, 0.15, 0.6),
      friction: 0.02, restitution: 0.2, name: 'catapult-base',
    }));
    // 側板(2枚)
    for (const s of [1, -1]) {
      const cheek = bMesh(mats.red, 0.7, 0.55, 0.12, 0.04);
      cheek.position.set(px, py - 0.1, s * 0.4);
      cheek.rotation.z = 0.2;
      game.scene.add(cheek);
    }
    // アーム(左へ伸びる)+カップ
    this.arm = new THREE.Group();
    const plank = bMesh(mats.yellow, CATAPULT.armLen + 0.3, 0.12, 0.34, 0.04);
    plank.position.x = -(CATAPULT.armLen) / 2;
    this.arm.add(plank);
    const cup = new THREE.Group();
    const cupBase = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.24, 18, 1, true), mats.blue);
    const cupBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 18), mats.blue);
    cupBottom.position.y = -0.1;
    cup.add(cupBase, cupBottom);
    cup.position.set(-CATAPULT.armLen, 0.15, 0);
    this.arm.add(cup);
    this.arm.position.copy(this.pivot);
    this.arm.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    game.scene.add(this.arm);
    // 軸ピン + ゴム(チャージで伸びるコイル)
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 12), mats.brass);
    pin.rotation.x = Math.PI / 2;
    pin.position.copy(this.pivot);
    game.scene.add(pin);
    this.spring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), mats.coral);
    game.scene.add(this.spring);

    this.proxy = hitProxy(this, 1.5);
    this.proxy.position.set(px - 0.5, py + 0.3, 0);
    game.scene.add(this.proxy);

    this.tilt = 0.12;         // アーム角(水平が0、上が+)
    this.charge = 0;
    this.charging = false;
    this.captured = false;
    this._launchAnim = 0;
    this.name = 'catapult';
    this.guideType = 'hold';
  }

  cupPos() {
    // アームは左向き(local x = -armLen)、玉はカップの少し上(local y = +0.4)
    const th = -this.tilt;
    const lx = -CATAPULT.armLen, ly = 0.4;
    return new THREE.Vector3(
      this.pivot.x + lx * Math.cos(th) - ly * Math.sin(th),
      this.pivot.y + lx * Math.sin(th) + ly * Math.cos(th),
      0,
    );
  }

  get guidePos() { return new THREE.Vector3(this.pivot.x - 0.7, this.pivot.y + 1.0, 0.45); }

  tryCapture(ball) {
    if (this.captured || ball.mode !== 'physics') return false;
    const dx = ball.p.x - CATAPULT.cup.x, dy = ball.p.y - CATAPULT.cup.y;
    if (dx * dx + dy * dy > CATAPULT.cup.r * CATAPULT.cup.r) return false;
    this.captured = true;
    ball.captureTo(() => this.cupPos());
    this.game.audio.woodClack(450, 0.3);
    return true;
  }

  onPressStart() {
    if (!this.captured) return;
    this.charging = true;
    this.charge = 0;
  }

  onPressEnd() {
    if (!this.charging) return;
    this.charging = false;
    const c = this.charge;
    this.charge = 0;
    this.game.audio.chargeEnd(c >= CATAPULT.minCharge);
    if (!this.captured) return;
    const ball = this.game.ball;
    if (c < CATAPULT.minCharge) {
      // ポヨン: 小さく跳ねてカップに戻る
      this.game.audio.boing();
      const cp = this.cupPos();
      this.captured = false;
      ball.startRide(
        [[cp.x, cp.y, 0], CATAPULT.weakArc.peak, [cp.x, cp.y + 0.1, 0]],
        CATAPULT.weakArc.duration,
        (b) => { b.release(0, -0.5); },
      );
      return;
    }
    // 発射!
    this.captured = false;
    this._launchAnim = 0.001;
    const cp = this.cupPos();
    const arc = CATAPULT.arc;
    ball.startRide(
      [[cp.x, cp.y, 0], arc.from, arc.ring, arc.to],
      arc.duration,
      (b) => { this.game.onGoalReached(b); },
    );
    this.game.particles.trailBurst(cp);
  }

  update(dt) {
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / CATAPULT.chargeTime);
      this.game.audio.chargeTone(this.charge);
      // アームが引き下がる+ぷるぷる
      const target = 0.12 - 0.62 * this.charge;
      this.tilt += (target - this.tilt) * Math.min(1, dt * 10);
      this.tilt += Math.sin(this.game.time * 40) * 0.006 * this.charge;
    } else if (this._launchAnim > 0) {
      this._launchAnim += dt;
      if (this._launchAnim < 0.14) this.tilt += (0.95 - this.tilt) * Math.min(1, dt * 30);
      else {
        this.tilt += (0.12 - this.tilt) * Math.min(1, dt * 6);
        if (Math.abs(this.tilt - 0.12) < 0.02) this._launchAnim = 0;
      }
    } else {
      this.tilt += (0.12 - this.tilt) * Math.min(1, dt * 6);
    }
    this.arm.rotation.z = -this.tilt;
    // ばね: 土台からアーム先端下面へ伸びるコイル(視覚のみ)
    const cp = this.cupPos();
    const ax = cp.x + 0.12, ay = cp.y - 0.42;           // アーム下面
    const bx = this.pivot.x - 0.55, by = this.pivot.y - 0.55; // 土台
    this.spring.position.set((ax + bx) / 2, (ay + by) / 2, 0);
    const len = Math.max(0.15, Math.hypot(ax - bx, ay - by));
    this.spring.scale.y = len / 0.5;
    _v.set(ax - bx, ay - by, 0);
    this.spring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.normalize());
  }
}

// ================= ゴール(漏斗+鐘) =================
export class Goal {
  constructor(game) {
    this.game = game;
    this.name = 'goal';
  }

  // カタパルトの弧が終わったら main から呼ばれる
  startSpiral(ball, onDone) {
    const fn = GOAL.funnel;
    const pts = [];
    const turns = 2.4;
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      const r = (fn.rTop - 0.15) * (1 - t * 0.92);
      pts.push([
        fn.x + Math.cos(a) * r,
        fn.y + fn.height / 2 + 0.1 - t * (fn.height + 0.15),
        Math.sin(a) * r * 0.85,
      ]);
    }
    ball.startRide(pts, GOAL.spiralTime, onDone, { spin: 14 });
  }
}
