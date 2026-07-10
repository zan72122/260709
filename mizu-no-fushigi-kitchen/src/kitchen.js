// みずのふしぎキッチン — キッチンの舞台 (壁・窓・カウンター・コンロ・小物)。
// テクスチャは全て canvas で生成する (外部アセットなし)。

import * as THREE from '../vendor/three.module.min.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------ 壁タイル
function tileTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#dff0ee'; g.fillRect(0, 0, w, h);
    const tw = 128, th = 64;
    for (let y = 0; y < h / th; y++) {
      for (let x = -1; x < w / tw + 1; x++) {
        const ox = (y % 2) * tw / 2;
        const px = x * tw + ox, py = y * th;
        const hue = 172 + Math.sin(x * 3.1 + y * 1.7) * 6;
        const lit = 88 + Math.sin(x * 7 + y * 5) * 3;
        g.fillStyle = `hsl(${hue},42%,${lit}%)`;
        g.fillRect(px + 3, py + 3, tw - 6, th - 6);
        const gr = g.createLinearGradient(px, py, px, py + th);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0)');
        gr.addColorStop(1, 'rgba(90,140,135,0.18)');
        g.fillStyle = gr;
        g.fillRect(px + 3, py + 3, tw - 6, th - 6);
      }
    }
  });
}

// ------------------------------------------------------------ 木目
function woodTexture(base = '#c68d54', dark = '#9d6a38') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const y = Math.sin(i * 12.9898) * 0.5 + 0.5;
      const yy = y * h;
      g.strokeStyle = dark;
      g.globalAlpha = 0.10 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 0.12;
      g.lineWidth = 1.5 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 3;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const wy = yy + Math.sin(x * 0.02 + i) * 5;
        x === 0 ? g.moveTo(x, wy) : g.lineTo(x, wy);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

// ------------------------------------------------------------ 窓の外の空
function skyTexture() {
  return canvasTex(256, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7ec8f7');
    gr.addColorStop(0.62, '#bfe6fb');
    gr.addColorStop(1, '#eafaf0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // おひさま
    const sun = g.createRadialGradient(w * 0.72, h * 0.24, 4, w * 0.72, h * 0.24, 46);
    sun.addColorStop(0, '#fff8d0');
    sun.addColorStop(0.35, '#ffe98a');
    sun.addColorStop(1, 'rgba(255,233,138,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    // くも
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const puff = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    puff(60, 90, 17); puff(82, 84, 22); puff(106, 92, 16); puff(84, 100, 18);
    puff(180, 170, 13); puff(198, 164, 17); puff(216, 172, 12);
    // とおくの丘
    g.fillStyle = '#a5dc9a';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 34 - Math.sin(x * 0.03) * 14);
    g.lineTo(w, h); g.fill();
  });
}

// ------------------------------------------------------------ チェック床
function floorTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const s = 64;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      g.fillStyle = (x + y) % 2 ? '#f3e3c9' : '#e2c9a2';
      g.fillRect(x * s, y * s, s, s);
    }
  });
}

export class Kitchen {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this._buildRoom();
    this._buildCounter();
    this._buildStove();
    this._buildShelf();
    this._buildProps();
    this._buildFlame();
  }

  // ---------------------------------------------------------- 部屋
  _buildRoom() {
    const g = this.group;
    // 壁 (タイル)
    const tiles = tileTexture();
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(3.4, 2.4);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 12),
      new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.55, metalness: 0.02 }));
    wall.position.set(0, 2.6, -2.75);
    wall.receiveShadow = true;
    g.add(wall);

    // コンロ奥の「よごれよけパネル」— ゆげや水が映える深い青緑の背景
    const guardT = canvasTex(256, 192, (gg, w, h) => {
      const gr = gg.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2e6f80');
      gr.addColorStop(0.6, '#25596c');
      gr.addColorStop(1, '#1d4a5c');
      gg.fillStyle = gr;
      gg.beginPath();
      const r = 26;
      gg.moveTo(r, 0); gg.lineTo(w - r, 0); gg.arcTo(w, 0, w, r, r);
      gg.lineTo(w, h); gg.lineTo(0, h); gg.lineTo(0, r); gg.arcTo(0, 0, r, 0, r);
      gg.fill();
      // ちいさな星もよう
      gg.fillStyle = 'rgba(255,255,255,0.10)';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % w, y = 24 + (i * 53) % (h - 34);
        gg.beginPath(); gg.arc(x, y, 2.6, 0, 7); gg.fill();
      }
    });
    const guard = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.6),
      new THREE.MeshStandardMaterial({ map: guardT, transparent: true, roughness: 0.5 }));
    guard.position.set(0, 2.15, -2.68);
    g.add(guard);

    // 床
    const floorT = floorTexture();
    floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
    floorT.repeat.set(6, 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 14),
      new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.55, 2.5);
    g.add(floor);

    // 窓
    const win = new THREE.Group();
    win.position.set(3.35, 3.05, -2.72);
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.9),
      new THREE.MeshBasicMaterial({ map: skyTexture() }));
    win.add(sky);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const mkBar = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), frameMat);
      m.position.set(x, y, 0.04); win.add(m);
    };
    mkBar(2.72, 0.14, 0, 1.47); mkBar(2.72, 0.14, 0, -1.47);
    mkBar(0.14, 3.1, -1.3, 0); mkBar(0.14, 3.1, 1.3, 0);
    mkBar(2.6, 0.07, 0, 0); mkBar(0.07, 2.9, 0, 0);
    // 窓辺の植木
    const potM = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.10, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xd97757, roughness: 0.8 }));
    potM.position.set(-0.75, -1.32, 0.16); win.add(potM);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5fae57, roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), leafMat);
      const a = i / 5 * Math.PI * 2;
      leaf.position.set(-0.75 + Math.cos(a) * 0.07, -1.13 + (i % 2) * 0.08, 0.16 + Math.sin(a) * 0.05);
      leaf.scale.y = 1.5;
      win.add(leaf);
    }
    g.add(win);

    // カーテン (サイン波で波打つ板)
    const curtainT = canvasTex(128, 256, (cg, w, h) => {
      cg.fillStyle = '#ffd98e'; cg.fillRect(0, 0, w, h);
      cg.fillStyle = 'rgba(255,255,255,0.5)';
      for (let x = 0; x < w; x += 24) cg.fillRect(x, 0, 10, h);
      cg.fillStyle = 'rgba(240,150,60,0.25)';
      for (let y = 40; y < h; y += 56) cg.fillRect(0, y, w, 7);
    });
    const curtainGeo = new THREE.PlaneGeometry(0.85, 3.3, 16, 1);
    const cp = curtainGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      cp.setZ(i, Math.sin(cp.getX(i) * 9.5) * 0.09);
    }
    curtainGeo.computeVertexNormals();
    const curtainMat = new THREE.MeshStandardMaterial({ map: curtainT, roughness: 0.85, side: THREE.DoubleSide });
    const c1 = new THREE.Mesh(curtainGeo, curtainMat);
    c1.position.set(1.9, 3.1, -2.55);
    g.add(c1);
    const c2 = c1.clone();
    c2.position.x = 4.8;
    c2.scale.x = -1;
    g.add(c2);

    // 窓からの光のシャフト (窓→カウンターへ斜めに降りる、ごく淡い帯)
    const shaftT = canvasTex(64, 128, (sg, w, h) => {
      const gr = sg.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,244,196,0.16)');
      gr.addColorStop(0.55, 'rgba(255,244,196,0.08)');
      gr.addColorStop(1, 'rgba(255,244,196,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, w, h);
    });
    const from = new THREE.Vector3(3.3, 3.4, -2.6);
    const to = new THREE.Vector3(1.3, 0.0, 0.5);
    const dir = to.clone().sub(from);
    const len = dir.length();
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, len),
      new THREE.MeshBasicMaterial({
        map: shaftT, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
    shaft.position.copy(from).add(dir.multiplyScalar(0.5));
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    g.add(shaft);
  }

  // ---------------------------------------------------------- カウンター
  _buildCounter() {
    const g = this.group;
    const wood = woodTexture();
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(3, 1.4);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.22, 5.2),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5 }));
    top.position.set(0, -0.11, 0.1);
    top.receiveShadow = true;
    g.add(top);

    // 前板 (引き出し)
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(22, 2.5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xfaf3e3, roughness: 0.7 }));
    front.position.set(0, -1.48, 2.6);
    g.add(front);
    const knobMat = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.4, metalness: 0.3 });
    const drawerMat = new THREE.MeshStandardMaterial({ color: 0xf2e6cd, roughness: 0.65 });
    for (let i = -2; i <= 2; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 0.06), drawerMat);
      d.position.set(i * 3.9, -0.95, 2.76); g.add(d);
      const d2 = d.clone(); d2.position.y = -2.05; g.add(d2);
      for (const y of [-0.95, -2.05]) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), knobMat);
        k.position.set(i * 3.9, y, 2.83); g.add(k);
      }
    }
  }

  // ---------------------------------------------------------- コンロ
  _buildStove() {
    const g = this.group;
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.35, metalness: 0.55 });
    // コンロの台
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.76, 0.16, 40), dark);
    base.position.y = 0.08;
    base.receiveShadow = true;
    g.add(base);
    // ごとく (五徳)
    const grate = new THREE.Group();
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5, metalness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.06, 0.09), grateMat);
      const a = i / 6 * Math.PI * 2;
      arm.position.set(Math.cos(a) * 0.72, 0.2, Math.sin(a) * 0.72);
      arm.rotation.y = -a;
      grate.add(arm);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.05, 10, 44), grateMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    grate.add(ring);
    g.add(grate);
    // バーナー
    const burner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 }));
    burner.position.y = 0.18;
    g.add(burner);
    // つまみ (かざり)
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xd94f45, roughness: 0.35 }));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0, -0.55, 2.78);
    g.add(knob);
  }

  // ---------------------------------------------------------- たな
  _buildShelf() {
    const g = this.group;
    const wood = woodTexture('#b07b45', '#8a5d2e');
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.12, 0.72),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }));
    plank.position.set(-3.4, 2.6, -2.3);
    g.add(plank);

    // ガラスびん (いちご・はちみつ・ラムネ色)
    const jarColors = [0xff8ea0, 0xffc45e, 0x7fd8e8];
    jarColors.forEach((col, i) => {
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.23, 0.5, 18),
        new THREE.MeshPhysicalMaterial({
          color: col, roughness: 0.15, transparent: true, opacity: 0.82,
          clearcoat: 1, clearcoatRoughness: 0.2,
        }));
      jar.position.set(-4.3 + i * 0.95, 2.93, -2.3);
      g.add(jar);
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.215, 0.215, 0.09, 18),
        new THREE.MeshStandardMaterial({ color: 0xb8895a, roughness: 0.5 }));
      lid.position.set(jar.position.x, 3.22, -2.3);
      g.add(lid);
    });

    // つりさげ フック + おたま
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8f9aa8, metalness: 0.7, roughness: 0.3 });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8), railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-3.4, 1.9, -2.45);
    g.add(rail);
    const toolMat = new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.75, roughness: 0.28 });
    const mkTool = (x, headR, headScaleY) => {
      const grp = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), toolMat);
      handle.position.y = -0.35; grp.add(handle);
      const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), toolMat);
      head.rotation.x = Math.PI;
      head.scale.y = headScaleY;
      head.position.y = -0.74; grp.add(head);
      grp.position.set(x, 1.87, -2.42);
      grp.rotation.z = 0.05 * Math.sign(x + 3.4 || 1);
      this.group.add(grp);
      return grp;
    };
    this.ladle = mkTool(-2.5, 0.14, 0.9);
    mkTool(-4.3, 0.11, 0.35);
  }

  // ---------------------------------------------------------- 小物
  _buildProps() {
    const g = this.group;
    // くだものボウル
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 22, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x6fb7d9, roughness: 0.3, side: THREE.DoubleSide }));
    bowl.scale.y = 0.62;
    bowl.position.set(3.6, 0.35, 0.8);
    g.add(bowl);
    const fruits = [
      [0xff6b52, 0.2, -0.15, 0], [0xffcf4d, 0.2, 0.13, 0.08],
      [0x8ecf4f, 0.19, 0, -0.14], [0xff9a3d, 0.18, 0.02, 0.16],
    ];
    for (const [col, r, ox, oz] of fruits) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }));
      f.position.set(3.6 + ox * 1.8, 0.32, 0.8 + oz * 1.8);
      f.castShadow = true;
      g.add(f);
    }
    // しお・こしょう
    const shakerMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 0.8 });
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 14), shakerMat);
      s.position.set(-2.7 + i * 0.4, 0.17, 1.3);
      g.add(s);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8),
        new THREE.MeshStandardMaterial({ color: i ? 0x555b66 : 0xd94f45, roughness: 0.4 }));
      cap.position.set(s.position.x, 0.36, 1.3);
      g.add(cap);
    }
    // まないた + ミトン (壁かけ)
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.3, 0.07),
      new THREE.MeshStandardMaterial({ map: woodTexture('#d8a86b', '#b3854a'), roughness: 0.7 }));
    board.position.set(5.6, 2.4, -2.6);
    g.add(board);
  }

  // ---------------------------------------------------------- ほのお
  _buildFlame() {
    const mkFlameTex = (inner, outer) => canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.62, 2, w / 2, h * 0.62, 30);
      gr.addColorStop(0, inner);
      gr.addColorStop(0.55, outer);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(w / 2, h * 0.58, 20, 30, 0, 0, 7);
      g.fill();
    });
    this.flameGroup = new THREE.Group();
    this.flameGroup.position.y = 0.22;
    this.flames = [];
    const texA = mkFlameTex('rgba(255,255,210,0.95)', 'rgba(255,150,40,0.75)');
    const texB = mkFlameTex('rgba(180,220,255,0.9)', 'rgba(80,140,255,0.55)');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: i % 3 === 2 ? texB : texA, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.9,
      }));
      // なべの縁より少し内側 — 横からでも炎の頭が見える
      s.position.set(Math.cos(a) * 0.88, 0.05, Math.sin(a) * 0.88);
      s.userData.phase = Math.random() * 7;
      s.scale.setScalar(0.001);
      this.flames.push(s);
      this.flameGroup.add(s);
    }
    // なべ下のオレンジのてり
    this.flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texA, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.flameGlow.position.set(0, 0.02, 0.6);
    this.flameGroup.add(this.flameGlow);
    this.flameLight = new THREE.PointLight(0xff9840, 0, 4.5, 1.8);
    this.flameLight.position.set(0, 0.45, 0.9);
    this.flameGroup.add(this.flameLight);
    this.group.add(this.flameGroup);
    this.flamePower = 0;
  }

  /** power 0..1 でほのおの大きさ */
  setFlame(power) { this.flamePower = power; }

  update(dt, t) {
    const p = this.flamePower;
    for (const s of this.flames) {
      const flick = 0.82 + Math.sin(t * 13 + s.userData.phase) * 0.18;
      const sc = Math.max(0.001, p * (0.5 + 0.34 * flick));
      s.scale.set(sc * 0.8, sc * (1.3 + 0.3 * Math.sin(t * 17 + s.userData.phase)), sc);
      s.position.y = 0.03 + p * 0.16 * flick;
      s.material.opacity = Math.min(0.95, p * 1.4) * flick;
    }
    const glowSc = Math.max(0.001, p * (2.4 + Math.sin(t * 9) * 0.2));
    this.flameGlow.scale.set(glowSc, glowSc * 0.5, glowSc);
    this.flameGlow.material.opacity = p * 0.4;
    this.flameLight.intensity = p * (2.6 + Math.sin(t * 11) * 0.6);
    if (this.ladle) this.ladle.rotation.z = 0.05 + Math.sin(t * 0.9) * 0.04;
  }
}
