// 窓辺のアトリエ 3D シーン(背景・木の板・小物・光)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rand, TAU, hsl, hexToCss } from './utils.js';

export const BOARD_R = 6.55;      // 木の板の半径
export const PIN_AREA_R = 5.1;    // ピンが並ぶ最大半径

// ---- 手描きテクスチャ ----
function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#e8c496');
  grad.addColorStop(0.5, '#dcb27f');
  grad.addColorStop(1, '#e3bc8b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // 木目(ゆらゆらした縦線)
  for (let i = 0; i < 42; i++) {
    const x0 = rand(0, 512);
    const hueShift = rand(-14, 8);
    g.strokeStyle = `rgba(${150 + hueShift * 3},${105 + hueShift * 2},${60},${rand(0.05, 0.16)})`;
    g.lineWidth = rand(1, 4);
    g.beginPath();
    const wob = rand(4, 18), ph = rand(0, TAU);
    for (let y = 0; y <= 512; y += 8) {
      const x = x0 + Math.sin(y * 0.02 + ph) * wob;
      y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  // 節をすこし
  for (let i = 0; i < 4; i++) {
    const x = rand(40, 470), y = rand(40, 470), r = rand(4, 9);
    g.strokeStyle = 'rgba(140,95,55,0.25)';
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.ellipse(x, y, r * k, r * k * 0.6, rand(0, 1), 0, TAU);
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#7ec3f2');
  grad.addColorStop(0.45, '#b7e0f8');
  grad.addColorStop(0.75, '#ffe9c9');
  grad.addColorStop(1, '#ffd9ab');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  // お日さまのぼんやり光
  const sun = g.createRadialGradient(760, 300, 10, 760, 300, 330);
  sun.addColorStop(0, 'rgba(255,250,220,0.95)');
  sun.addColorStop(0.25, 'rgba(255,240,190,0.55)');
  sun.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, 1024, 1024);
  // ふわふわ雲
  g.fillStyle = 'rgba(255,255,255,0.85)';
  const cloud = (cx, cy, s) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const r = s * rand(0.45, 0.7);
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * s * 0.8, cy + Math.sin(a) * s * 0.28, r, r * 0.72, 0, 0, TAU);
      g.fill();
    }
    g.beginPath(); g.ellipse(cx, cy, s, s * 0.6, 0, 0, TAU); g.fill();
  };
  cloud(230, 380, 60); cloud(560, 200, 44); cloud(850, 560, 52); cloud(140, 720, 40);
  // とおくの丘
  g.fillStyle = '#a8d8a0';
  g.beginPath();
  g.moveTo(0, 1024);
  for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 880 + Math.sin(x * 0.006) * 46 + Math.sin(x * 0.017) * 18);
  g.lineTo(1024, 1024);
  g.fill();
  g.fillStyle = '#8fca8f';
  g.beginPath();
  g.moveTo(0, 1024);
  for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 950 + Math.sin(x * 0.008 + 2) * 34);
  g.lineTo(1024, 1024);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// きらきら用の丸グラデスプライト
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, inner.replace(',1)', ',0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCurtain(side) {
  // うすい色つきカーテン(ひだ付き)
  const geo = new THREE.PlaneGeometry(5.5, 26, 24, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin(x * 3.2) * 0.45);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xfff1f7, transparent: true, opacity: 0.85,
    roughness: 0.9, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(side * 12.2, 1.5, -6.2);
  m.rotation.y = -side * 0.25;
  return m;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3f7);

  // 反射用の環境マップ
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 15.5);
  camera.lookAt(0, 0, 0);

  // ---- 光 ----
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xf6e3c8, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(7, 9, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 2; sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.002;
  scene.add(sun);
  // 指のライトあそび用ポイントライト(ふだんは消灯)
  const playLight = new THREE.PointLight(0xfff6dd, 0, 18, 1.6);
  playLight.position.set(0, 0, 4);
  scene.add(playLight);
  // ライトのまわりの ふんわりした光
  const lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255,244,200,1)', 'rgba(255,244,200,0)'),
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  lightGlow.scale.setScalar(5);
  scene.add(lightGlow);

  // ---- 背景:空と窓 ----
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture() })
  );
  sky.position.set(0, 2, -13);
  scene.add(sky);

  // 窓わく
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xfdfdf6, roughness: 0.7 });
  const windowGroup = new THREE.Group();
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), frameMat);
    m.position.set(x, y, 0);
    windowGroup.add(m);
  };
  bar(23, 1.1, 0, 12.2); bar(23, 1.1, 0, -11.8);
  bar(1.1, 25, -11, 0.2); bar(1.1, 25, 11, 0.2);
  bar(0.55, 25, 0, 0.2); bar(23, 0.55, 0, 0.2);
  windowGroup.position.set(0, 2.2, -9.5);
  scene.add(windowGroup);
  scene.add(makeCurtain(-1), makeCurtain(1));

  // 光のすじ(ひかりのシャフト)
  const shaftTex = makeGlowTexture('rgba(255,244,204,1)', 'rgba(255,244,204,0)');
  const shafts = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: shaftTex, transparent: true, opacity: 0.1 + i * 0.03,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.2 - i * 0.6, 30), mat);
    s.position.set(4.5 - i * 2.6, 2, -4 - i);
    s.rotation.z = -0.5;
    scene.add(s);
    shafts.push(s);
  }

  // ---- にじいろの旗ガーランド(虹のせんたくもの) ----
  const garland = new THREE.Group();
  {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(-11 + t * 22, 9.6 - Math.sin(t * Math.PI) * 1.7, -5.5));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.035, 5),
      new THREE.MeshStandardMaterial({ color: 0xf7f1e4, roughness: 0.8 })
    );
    garland.add(rope);
    const flagGeo = new THREE.PlaneGeometry(0.95, 1.15);
    for (let i = 0; i < 9; i++) {
      const t = (i + 1) / 10;
      const p = curve.getPoint(t);
      const mat = new THREE.MeshStandardMaterial({
        color: hsl(i * 40, 0.68, 0.72), roughness: 0.85,
        side: THREE.DoubleSide, transparent: true, opacity: 0.96,
      });
      const f = new THREE.Mesh(flagGeo, mat);
      f.position.set(p.x, p.y - 0.62, p.z);
      f.userData.phase = rand(0, TAU);
      garland.add(f);
    }
  }
  scene.add(garland);

  // ---- 木の板(もようをそだてる舞台) ----
  const boardGroup = new THREE.Group();
  boardGroup.rotation.x = -0.045;
  scene.add(boardGroup);

  const woodTex = makeWoodTexture();
  const board = new THREE.Mesh(
    new THREE.CylinderGeometry(BOARD_R, BOARD_R, 0.5, 72),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.02 })
  );
  board.rotation.x = Math.PI / 2;
  board.position.z = -0.25;
  board.receiveShadow = true;
  boardGroup.add(board);
  // ふち(額縁)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_R, 0.26, 14, 80),
    new THREE.MeshStandardMaterial({ color: 0xc98f5a, roughness: 0.55 })
  );
  rim.castShadow = true;
  boardGroup.add(rim);

  // ---- したの棚とこもの ----
  const shelfGroup = new THREE.Group();
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.7, 5),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 })
  );
  shelf.position.set(0, -8.2, -1.5);
  shelf.receiveShadow = true;
  shelfGroup.add(shelf);
  // 糸まきスプール
  const spoolColors = [0xff8fb3, 0xffd166, 0x7fd8be, 0x8ecffb, 0xc7a6f5];
  for (let i = 0; i < 5; i++) {
    const gS = new THREE.Group();
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: spoolColors[i], roughness: 0.5 })
    );
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe8cfa8, roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 16), capMat);
    top.position.y = 0.62;
    const bot = top.clone(); bot.position.y = -0.62;
    gS.add(c, top, bot);
    gS.position.set(-9.6 + i * 1.45, -7.15, -1.2 + (i % 2) * 0.8);
    gS.rotation.y = rand(0, TAU);
    gS.castShadow = true;
    shelfGroup.add(gS);
  }
  // みずのビン
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.75, 2.1, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xcfeef8, roughness: 0.12, metalness: 0,
      transparent: true, opacity: 0.5, clearcoat: 1,
    })
  );
  jar.position.set(8.6, -6.75, -1.4);
  shelfGroup.add(jar);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.66, 1.2, 18),
    new THREE.MeshStandardMaterial({ color: 0x9adcf0, transparent: true, opacity: 0.75, roughness: 0.2 })
  );
  water.position.set(8.6, -7.1, -1.4);
  shelfGroup.add(water);
  // ちいさな植木
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.42, 0.8, 14),
    new THREE.MeshStandardMaterial({ color: 0xe2926b, roughness: 0.8 })
  );
  plant.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 8),
      new THREE.MeshStandardMaterial({ color: hsl(120 + i * 8, 0.45, 0.5 + i * 0.03), roughness: 0.8 })
    );
    leaf.scale.set(0.7, 1.4, 0.7);
    leaf.position.set(Math.cos(i * 2.2) * 0.3, 0.85 + (i % 3) * 0.3, Math.sin(i * 2.2) * 0.3);
    plant.add(leaf);
  }
  plant.position.set(10.6, -7.4, -2.2);
  shelfGroup.add(plant);
  scene.add(shelfGroup);

  // ---- ほこりの光(ダストモート) ----
  const dustCount = 70;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = rand(-9, 9);
    dustPos[i * 3 + 1] = rand(-7, 9);
    dustPos[i * 3 + 2] = rand(-5, 4);
    dustSeed[i] = rand(0, TAU);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.09, map: makeGlowTexture(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff4cf,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ---- リサイズ:板が必ず収まるように距離を調整 ----
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 板(+ピンぶん)の半径がおさまる距離
    const fitR = BOARD_R + 1.5;
    const vFit = fitR / Math.tan((camera.fov * Math.PI) / 360);
    const hFit = vFit / camera.aspect;
    camera.position.z = Math.max(vFit, hFit) * 1.02;
    camera.updateProjectionMatrix();
  }
  resize();

  // ---- ゆったりアニメーション ----
  let elapsed = 0;
  function tickWorld(dt, pointerNdc) {
    elapsed += dt;
    // 板がゆっくり呼吸するようにゆれる
    boardGroup.rotation.z = Math.sin(elapsed * 0.23) * 0.008;
    boardGroup.position.y = Math.sin(elapsed * 0.4) * 0.05;
    // カメラのパララックス
    const px = pointerNdc ? pointerNdc.x : 0;
    const py = pointerNdc ? pointerNdc.y : 0;
    camera.position.x += (px * 0.55 - camera.position.x) * dt * 1.6;
    camera.position.y += (0.5 + py * 0.4 - camera.position.y) * dt * 1.6;
    camera.lookAt(0, 0, 0);
    // ガーランドの旗がそよぐ
    garland.children.forEach((f, i) => {
      if (f.userData.phase !== undefined) {
        f.rotation.y = Math.sin(elapsed * 1.3 + f.userData.phase) * 0.3;
        f.rotation.z = Math.sin(elapsed * 0.9 + f.userData.phase) * 0.06;
      }
    });
    // ほこりがふわふわ
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      p.array[i * 3] += Math.sin(elapsed * 0.5 + dustSeed[i]) * 0.0026;
      p.array[i * 3 + 1] += 0.0035 + Math.cos(elapsed * 0.4 + dustSeed[i]) * 0.0018;
      if (p.array[i * 3 + 1] > 9.5) p.array[i * 3 + 1] = -7.5;
    }
    p.needsUpdate = true;
    dustMat.opacity = 0.36 + Math.sin(elapsed * 0.8) * 0.1;
    // 光のすじがゆらぐ
    shafts.forEach((s, i) => {
      s.material.opacity = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(elapsed * 0.5 + i * 1.7));
    });
  }

  return {
    renderer, scene, camera, boardGroup, sun, hemi, playLight, lightGlow,
    resize, tickWorld,
  };
}
