// main.js — コロコロからくり: 起動・ループ・ガイド判定・お祝い演出の統合
import * as THREE from '../vendor/three.module.min.js';
import { PhysicsWorld } from './physics.js';
import { getMaterials, makeBackdropTexture } from './materials.js';
import { buildMachine } from './machine.js';
import { Ball } from './ball.js';
import {
  Hopper, Seesaw, WaterWheel, Elevator, SwitchRail, DropTube, Catapult, Goal,
} from './gimmicks.js';
import { Particles } from './particles.js';
import { GuideHand } from './guide.js';
import { CameraRig } from './camera.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { HOPPER, SEESAW, ELEVATOR, GOAL, KILL_Y, OUT_X, BALL_SPAWN } from './layout.js';

class Game {
  constructor() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = makeBackdropTexture();

    this.time = 0;
    this.audio = new AudioEngine();
    this.mats = getMaterials();
    this.world = new PhysicsWorld({ gravity: -14.5, substep: 1 / 240 });

    this._lights();
    this._floor();

    // 装置(静的)
    const { group, gears, bell, clapper } = buildMachine(this.world, this.mats);
    this.scene.add(group);
    this.machineGroup = group;
    this.gears = gears;
    this.bell = bell;
    this.clapper = clapper;

    // 玉
    this.ball = new Ball();
    this.scene.add(this.ball.mesh);

    // パーティクル・ガイド
    this.particles = new Particles(this.scene);
    this.hand = new GuideHand(this.scene);

    // ギミック
    this.hopper = new Hopper(this);
    this.seesaw = new Seesaw(this);
    this.wheel = new WaterWheel(this);
    this.elevator = new Elevator(this);
    this.switch = new SwitchRail(this);
    this.dropTube = new DropTube(this);
    this.catapult = new Catapult(this);
    this.goal = new Goal(this);
    this.gimmicks = [this.hopper, this.seesaw, this.wheel, this.elevator, this.switch, this.dropTube, this.catapult];
    this.interactives = [this.hopper, this.seesaw, this.wheel, this.elevator, this.switch, this.catapult];

    // カメラ・入力・UI
    this.rig = new CameraRig();
    this.input = new Input(canvas, this.rig.camera, this.interactives, {
      onMiss: () => this._pokeMachine(),
    });
    this.ui = new UI({
      onStart: () => this.start(),
      onGuideToggle: (on) => { this.hand.setEnabled(on); if (!on) this.ui.hideBubble(); this.audio.uiTap(); },
      onMuteToggle: (m) => this.audio.setMuted(m),
      onReset: () => { this.audio.uiTap(); this._respawn(); },
    });

    this.started = false;
    this.celebrating = false;
    this._celebrateT = 0;
    this._stuckT = 0;
    this._bellSwing = 0;
    this._poke = 0;
    this._projV = new THREE.Vector3();

    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  start() {
    this.audio.init();
    this.input.enabled = true;
    this.started = true;
    this.audio.fanfare();
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0xc79a6b, 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d8, 1.85);
    key.position.set(5, 21, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7.5;
    key.shadow.camera.right = 7.5;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -2;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(-8, 6, 7);
    this.scene.add(fill);
  }

  _floor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 40),
      new THREE.MeshStandardMaterial({ color: 0xecc49b, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.52;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
  }

  // 何もない所をタップ → 装置がプルンと揺れて音が鳴る(発見の楽しさ)
  _pokeMachine() {
    if (!this.started) return;
    this._poke = 1;
    this.audio.woodClack(420, 0.18);
  }

  // ==== ゴール到達(カタパルトの弧の終端から呼ばれる) ====
  onGoalReached(ball) {
    this.goal.startSpiral(ball, () => {
      ball.setMode('hidden');
      this.celebrating = true;
      this._celebrateT = 0;
      this._bellSwing = 1;
      this.audio.bell();
      setTimeout(() => this.audio.fanfare(), 350);
      this.particles.confettiBurst(new THREE.Vector3(GOAL.funnel.x, GOAL.funnel.y + 1.2, 0.4), 120);
      this.ui.celebrate(true);
    });
    this.audio.impact(GOAL.funnel.y + 1, 4);
  }

  _respawn() {
    this.particles.poof(this.ball.p.clone());
    this.ball.respawn();
    this.particles.poof(new THREE.Vector3(BALL_SPAWN.x, BALL_SPAWN.y, 0.3));
    this.audio.pop();
    this._stuckT = 0;
  }

  // ==== ガイド: いま操作すべきパーツを判定 ====
  _guideTarget() {
    const b = this.ball;
    if (this.celebrating || !this.started) return null;
    const cat = this.catapult;
    if (cat.charging) {
      return cat.charge >= 0.22
        ? { type: 'release', pos: cat.guidePos, text: 'ゆびを ぱっと はなして!' }
        : { type: 'hold', pos: cat.guidePos, text: 'そのまま ぎゅ〜っ!' };
    }
    if (cat.captured) return { type: 'hold', pos: cat.guidePos, text: 'ここを ながおし!' };
    if (this.wheel.captured) return { type: 'tap', pos: this.wheel.guidePos, text: 'タップで くるん!' };
    if (b.mode === 'physics') {
      const speed = b.v.length();
      // ホッパー内で待機
      if (Math.abs(b.p.x - (BALL_SPAWN.x)) < 0.9 && Math.abs(b.p.y - HOPPER.pos[1]) < 1.1 && speed < 0.6 && this.hopper.timer < 0) {
        return { type: 'tap', pos: this.hopper.guidePos, text: 'ここを タップ!' };
      }
      // シーソーで待機(左に傾いている)
      const [sx, sy] = SEESAW.pivot;
      if (this.seesaw.tiltLeft && Math.abs(b.p.x - sx) < 2.0 && b.p.y > sy - 0.6 && b.p.y < sy + 1.1 && speed < 0.8) {
        return { type: 'tap', pos: this.seesaw.guidePos, text: 'シーソーを タップ!' };
      }
      // エレベーター
      if (this.elevator.ballOnPlatform() && this.elevator.y < ELEVATOR.top - 0.05) {
        return { type: 'hold', pos: this.elevator.guidePos, text: 'ながおしで うえへ!' };
      }
      // スイッチ(ループ側のままなら教える)
      if (this.switch.state === 'L' && b.p.x < -0.4 && b.p.y > 6.6 && b.p.y < 10.7) {
        return { type: 'tap', pos: this.switch.guidePos, text: 'スイッチを タップ!' };
      }
    }
    return null;
  }

  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.started) {
      // ギミック更新
      for (const g of this.gimmicks) g.update(dt);
      // 捕捉チェック
      if (this.ball.mode === 'physics') {
        this.wheel.tryCapture(this.ball) || this.catapult.tryCapture(this.ball);
      }
      // 物理
      this.world.step(this.ball, dt, (speed, point) => {
        this.audio.impact(point.y, speed);
        if (speed > 2.6) this.particles.burst(point, 4, 1.2);
      });
      this.ball.update(dt);
      this.audio.setRolling(this.ball.v.length(), !!this.ball.groundedFlag && this.ball.mode === 'physics');

      // 落ちた/詰まった玉の救済
      const b = this.ball;
      if (b.mode === 'physics') {
        if (b.p.y < KILL_Y || Math.abs(b.p.x) > OUT_X) this._respawn();
        else if (b.p.y < 1.45 && b.v.length() < 0.5) {
          this._stuckT += dt;
          if (this._stuckT > 1.6) this._respawn();
        } else this._stuckT = 0;
      }

      // お祝い → 新しい玉
      if (this.celebrating) {
        this._celebrateT += dt;
        if (this._celebrateT > 1.2 && this._celebrateT < 1.35) {
          this.particles.confettiBurst(new THREE.Vector3(GOAL.funnel.x - 1, GOAL.funnel.y + 2, 0.3), 40);
        }
        if (this._celebrateT >= GOAL.respawnDelay) {
          this.celebrating = false;
          this.ui.celebrate(false);
          this._respawn();
        }
      }

      // ガイド
      const target = this._guideTarget();
      this.hand.show(target);
      this.hand.update(dt);
      if (target && this.hand.enabled) {
        this._projV.copy(target.pos);
        this._projV.y += 1.15;
        this._projV.project(this.rig.camera);
        const sw = window.innerWidth, sh = window.innerHeight;
        const sx = (this._projV.x * 0.5 + 0.5) * sw;
        const sy = (-this._projV.y * 0.5 + 0.5) * sh;
        const flip = sx > sw - 190;
        this.ui.showBubble(sx, sy, target.text, flip);
      } else {
        this.ui.hideBubble();
      }
    }

    // 飾りアニメ
    for (const g of this.gears) g.rotation.z += g.userData.speed * dt;
    if (this._bellSwing > 0) {
      this._bellSwing = Math.max(0, this._bellSwing - dt * 0.4);
      const s = Math.sin(this.time * 16) * this._bellSwing * 0.3;
      this.bell.rotation.z = s;
      this.clapper.position.x = GOAL.bell.x + Math.sin(this.time * 16 + 1.2) * this._bellSwing * 0.12;
    }
    // プルン(何もない所タップ)
    if (this._poke > 0) {
      this._poke = Math.max(0, this._poke - dt * 3);
      const s = 1 + Math.sin(this._poke * Math.PI * 3) * 0.006 * this._poke;
      this.machineGroup.scale.set(s, 1 / s, s);
    } else {
      this.machineGroup.scale.set(1, 1, 1);
    }

    this.particles.update(dt);
    this.rig.update(dt, this.ball.p);
    this.renderer.render(this.scene, this.rig.camera);
  }
}

window.__game = new Game(); // デバッグ/自動テスト用フック
