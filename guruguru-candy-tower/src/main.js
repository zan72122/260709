// main.js — ぐるぐるキャンディタワー: 起動・ループ・ガイド判定・ケーキ育成の統合
import * as THREE from '../vendor/three.module.min.js';
import { PhysicsWorld } from './physics.js';
import { getMaterials, makeBackdropTexture } from './materials.js';
import { buildTower } from './tower.js';
import { Ball } from './balls.js';
import {
  Crane, Seesaw, LollipopWheel, WhipLift, Flipper, CandyTube,
  Turntable, CaneHammer, LoopTheLoop, DominoGate, MacaronCannon,
  MusicDrum, ChocoFall,
} from './gimmicks.js';
import { Particles } from './particles.js';
import { GuideHand } from './guide.js';
import { CameraRig } from './camera.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { wrapPos } from './wrap.js';
import {
  MAX_BALLS, SEESAW, WHIP_LIFT, GOAL, KILL_Y, STUCK_Y, BALL_HOME, CANNON, DOMINO, HAMMER, FLIPPER,
} from './layout.js';

class Game {
  constructor() {
    const canvas = document.getElementById('game');
    const fast = new URLSearchParams(location.search).has('fast'); // 自動テスト用の軽量描画
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !fast, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(fast ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !fast;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.background = makeBackdropTexture();

    this.time = 0;
    this.audio = new AudioEngine();
    this.mats = getMaterials();
    this.world = new PhysicsWorld({ gravity: -14.5, substep: 1 / 240 });

    this._lights();

    // 塔
    const { group, decoGroups, flames } = buildTower(this.world, this.mats);
    this.scene.add(group);
    this.towerGroup = group;
    this.decoGroups = decoGroups;
    this.flames = flames;

    // 玉(最大3個。最初は1個だけ使用可能)
    this.balls = [new Ball(0), new Ball(1), new Ball(2)];
    for (const b of this.balls) this.scene.add(b.mesh);
    this.ballCount = 1;
    this.balls[0].toQueue();
    this.balls[1].setMode('hidden');
    this.balls[2].setMode('hidden');

    this.particles = new Particles(this.scene);
    this.hand = new GuideHand(this.scene);

    // ギミック(操作9+自動5 ※ペグ・レールは塔に内蔵)
    this.crane = new Crane(this);
    this.seesaw = new Seesaw(this);
    this.wheel = new LollipopWheel(this);
    this.lift = new WhipLift(this);
    this.flipper = new Flipper(this);
    this.tube = new CandyTube(this);
    this.turntable = new Turntable(this);
    this.hammer = new CaneHammer(this);
    this.loop = new LoopTheLoop(this);
    this.domino = new DominoGate(this);
    this.cannon = new MacaronCannon(this);
    this.musicDrum = new MusicDrum(this);
    this.chocoFall = new ChocoFall(this);
    this.gimmicks = [
      this.crane, this.seesaw, this.wheel, this.lift, this.flipper, this.tube,
      this.turntable, this.hammer, this.loop, this.domino, this.cannon,
      this.musicDrum, this.chocoFall,
    ];
    this.interactives = [
      this.crane, this.seesaw, this.wheel, this.lift, this.flipper,
      this.turntable, this.hammer, this.domino, this.cannon,
    ];

    this.rig = new CameraRig();
    this.input = new Input(canvas, this.rig, this.interactives, { onPoke: () => this._poke() });
    this.ui = new UI({
      onStart: () => this.start(),
      onGuideToggle: (on) => { this.hand.setEnabled(on); if (!on) this.ui.hideBubble(); this.audio.uiTap(); },
      onMuteToggle: (m) => this.audio.setMuted(m),
      onReset: () => { this.audio.uiTap(); this._recallBalls(); },
    });

    this.started = false;
    this.clears = 0;
    this.celebrating = false;
    this._celebrateT = 0;
    this._stuckT = [0, 0, 0];
    this._pokeT = 0;
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
    const hemi = new THREE.HemisphereLight(0xfff6e8, 0xffc9de, 1.0);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2da, 1.9);
    key.position.set(9, 22, 13);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9.5;
    key.shadow.camera.right = 9.5;
    key.shadow.camera.top = 19;
    key.shadow.camera.bottom = -2.5;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e8ff, 0.35);
    fill.position.set(-10, 8, -6);
    this.scene.add(fill);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
  }

  _poke() {
    if (!this.started) return;
    this._pokeT = 1;
    this.audio.clack(420, 0.15);
  }

  // 全ての玉をグローブへ回収
  _recallBalls() {
    for (let i = 0; i < this.ballCount; i++) {
      const b = this.balls[i];
      if (b.mode === 'hidden') continue;
      this.particles.poof(b.mesh.position.clone());
      b.toQueue();
    }
    // 捕捉状態の掃除
    this.wheel.carried = null;
    this.turntable.carried = null;
    this.cannon.carried = null;
    this.audio.pop();
  }

  // ==== ゴール! ケーキが育つ ====
  onGoalReached(ball) {
    this.audio.splash();
    this.particles.burst(wrapPos(GOAL.splash.x, GOAL.splash.y, GOAL.splash.z), 16, 2.0, 0xfff9f0);
    ball.setMode('hidden');
    this.clears++;
    this.celebrating = true;
    this._celebrateT = 0;

    const stage = Math.min(this.clears, 3);
    this.ui.setCakeProgress(stage);
    if (this.clears <= 3) {
      this.decoGroups[this.clears - 1].visible = true;
    }
    const texts = ['🍓 やったー! 🍓', '🍫 すごーい! 🍫', '🎂 かんせーい!! 🎂'];
    this.ui.celebrate(true, texts[Math.min(this.clears - 1, 2)]);
    this.audio.fanfare();
    this.particles.confettiBurst(new THREE.Vector3(0, 16.4, 0), this.clears >= 3 ? 170 : 110);
    if (this.clears === 3) {
      setTimeout(() => this.particles.confettiBurst(new THREE.Vector3(0, 15, 2), 120), 700);
    }
    // 玉が増える
    const want = Math.min(1 + this.clears, MAX_BALLS);
    while (this.ballCount < want) {
      const nb = this.balls[this.ballCount];
      nb.toQueue();
      this.ballCount++;
      this.audio.pop();
    }
    this._goaledBall = ball;
  }

  // ==== ガイド判定(前方の玉から優先) ====
  _guideTarget() {
    if (!this.started || this.celebrating) return null;
    const cands = [];
    const cn = this.cannon;
    if (cn.charging) {
      cands.push({
        x: 106,
        t: cn.charge >= 0.22
          ? { type: 'release', pos: cn.guidePos, text: 'ゆびを ぱっと はなして!' }
          : { type: 'hold', pos: cn.guidePos, text: 'そのまま ぎゅ〜っ!' },
      });
    } else if (cn.captured) {
      cands.push({ x: 106, t: { type: 'hold', pos: cn.guidePos, text: 'ここを ながおし!' } });
    }
    if (this.domino.state === 'armed' && this.domino.ballWaitingAtGate()) {
      cands.push({ x: 95, t: { type: 'tap', pos: this.domino.guidePos, text: 'ボタンを タップ!' } });
    }
    if (this.hammer.ballInDip() && this.hammer.swing < 0) {
      cands.push({ x: 81, t: { type: 'tap', pos: this.hammer.guidePos, text: 'ハンマーを タップ!' } });
    }
    if (this.turntable.captured) {
      cands.push({ x: 72, t: { type: 'tap', pos: this.turntable.guidePos, text: 'タップで くるん!' } });
    }
    if (this.flipper.state === 'L') {
      const near = this.flipper.captured
        || this.balls.some((b) => b.mode === 'physics' && b.p.x > 49 && b.p.x < 57.5 && b.p.y > 7.4);
      if (near) cands.push({ x: 57, t: { type: 'tap', pos: this.flipper.guidePos, text: 'クッキーを タップ!' } });
    }
    if (this.lift.ballOnPlatform() && this.lift.y < WHIP_LIFT.top - 0.05) {
      cands.push({ x: 48, t: { type: 'hold', pos: this.lift.guidePos, text: 'ながおしで うえへ!' } });
    }
    if (this.wheel.captured) {
      cands.push({ x: 34, t: { type: 'tap', pos: this.wheel.guidePos, text: 'タップで くるん!' } });
    }
    if (this.seesaw.tiltLeft) {
      const [sx, sy] = SEESAW.pivot;
      const waiting = this.balls.some((b) => b.mode === 'physics'
        && Math.abs(b.p.x - sx) < 2.0 && b.p.y > sy - 0.6 && b.p.y < sy + 1.1 && b.v.length() < 0.8);
      if (waiting) cands.push({ x: 16, t: { type: 'tap', pos: this.seesaw.guidePos, text: 'シーソーを タップ!' } });
    }
    if (!cands.length && !this.crane.busy && this.balls.some((b) => b.mode === 'queued')) {
      cands.push({ x: 1, t: { type: 'tap', pos: this.crane.guidePos, text: 'ここを タップ!' } });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.x - a.x);
    return cands[0].t;
  }

  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.started) {
      for (const g of this.gimmicks) g.update(dt);
      // 捕捉
      for (const b of this.balls) {
        if (b.mode !== 'physics') continue;
        this.wheel.tryCapture(b) || this.flipper.tryCapture(b) || this.turntable.tryCapture(b) || this.cannon.tryCapture(b);
      }
      // 物理
      this.world.step(this.balls, dt,
        (speed, point, _n, _c, _ball) => {
          this.audio.impact(point.y, speed);
          if (speed > 2.6) this.particles.burst(wrapPos(point.x, point.y, point.z + 0.15), 4, 1.1);
        },
        (speed, a, b) => {
          this.audio.clack(700, Math.min(0.4, speed * 0.12));
          this.particles.burst(a.mesh.position.clone().lerp(b.mesh.position, 0.5), 3, 1.0);
        });
      for (const b of this.balls) b.update(dt, this.time);

      // 転がり音(最速の接地玉)
      let rollSpeed = 0, rolling = false;
      for (const b of this.balls) {
        if (b.mode === 'physics' && b.groundedFlag) { rolling = true; rollSpeed = Math.max(rollSpeed, b.v.length()); }
      }
      this.audio.setRolling(rollSpeed, rolling);

      // 救済
      this.balls.forEach((b, i) => {
        if (b.mode !== 'physics') { this._stuckT[i] = 0; return; }
        if (b.p.y < KILL_Y || b.p.x < -1.5 || b.p.x > 112) {
          this.particles.poof(b.mesh.position.clone());
          b.toQueue();
          this.audio.pop();
        } else if (b.p.y < STUCK_Y && b.v.length() < 0.4) {
          this._stuckT[i] += dt;
          if (this._stuckT[i] > 1.8) {
            this._stuckT[i] = 0;
            this.particles.poof(b.mesh.position.clone());
            b.toQueue();
            this.audio.pop();
          }
        } else this._stuckT[i] = 0;
      });

      // お祝い後: ゴール玉をグローブへ
      if (this.celebrating) {
        this._celebrateT += dt;
        if (this._celebrateT >= GOAL.respawnDelay) {
          this.celebrating = false;
          this.ui.celebrate(false);
          if (this._goaledBall) {
            this._goaledBall.toQueue();
            this._goaledBall = null;
            this.audio.pop();
          }
        }
      }

      // ガイド
      const target = this._guideTarget();
      this.hand.show(target);
      this.hand.update(dt);
      if (target && this.hand.enabled) {
        wrapPos(target.pos.x, target.pos.y + 1.15, 0.6, this._projV);
        this._projV.project(this.rig.camera);
        const sw = window.innerWidth, sh = window.innerHeight;
        const sx = (this._projV.x * 0.5 + 0.5) * sw;
        const sy = (-this._projV.y * 0.5 + 0.5) * sh;
        this.ui.showBubble(sx, sy, target.text, sx > sw - 190);
      } else {
        this.ui.hideBubble();
      }

      // カメラ: 先頭の玉を追う
      let lead = null;
      for (const b of this.balls) {
        if (b.mode === 'physics' || b.mode === 'captured' || b.mode === 'ride') {
          if (!lead || b.p.x > lead.p.x) lead = b;
        }
      }
      let tx = lead ? lead.p.x : BALL_HOME.x;
      let ty = lead ? lead.p.y : BALL_HOME.y;
      if (this.celebrating) { tx = GOAL.splash.x; ty = 15.4; } // お祝いは頂上ケーキを見上げる
      this.rig.update(dt, tx, ty);
    } else {
      this.rig.update(dt, BALL_HOME.x + this.time * 1.2, 8.5); // タイトル中はゆっくり回る
    }

    // ロウソクの炎ゆらめき
    if (this.decoGroups[2].visible) {
      this.flames.forEach((f, i) => {
        f.scale.y = 1.7 + Math.sin(this.time * 9 + i * 2) * 0.35;
        f.material.opacity = 0.8 + Math.sin(this.time * 13 + i) * 0.2;
      });
    }
    // プルン
    if (this._pokeT > 0) {
      this._pokeT = Math.max(0, this._pokeT - dt * 3);
      const s = 1 + Math.sin(this._pokeT * Math.PI * 3) * 0.006 * this._pokeT;
      this.towerGroup.scale.set(s, 1 / s, s);
    } else {
      this.towerGroup.scale.set(1, 1, 1);
    }

    this.particles.update(dt);
    this.renderer.render(this.scene, this.rig.camera);
  }
}

window.__game = new Game(); // デバッグ/自動テスト用フック
