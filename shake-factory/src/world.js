// ---------------------------------------------------------------------------
// world.js — renderer, scene, camera, lights, environment, floor & backdrop
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PALETTE } from './colors.js';

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // --- background: soft candy gradient -------------------------------------
  scene.background = makeGradientTexture([
    [0.0, '#ffe9f0'], [0.42, '#fff7e6'], [0.75, '#dbf3ff'], [1.0, '#c9edff'],
  ]);
  scene.fog = new THREE.Fog(0xffeef2, 26, 46);

  // --- environment map (hand-made equirect → PMREM) ------------------------
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = makeEnvironment(pmrem);
  scene.environmentIntensity = 0.85;

  // --- camera ---------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 4.6, 13);
  camera.lookAt(0, 4.0, 0);

  // --- lights ---------------------------------------------------------------
  const key = new THREE.DirectionalLight(0xfff3e0, 2.6);
  key.position.set(5, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 2; key.shadow.camera.far = 32;
  key.shadow.bias = -0.0005;
  key.shadow.radius = 5;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfe8ff, 0.8);
  fill.position.set(-6, 5, 6);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0xfff2fb, 0xffd9c4, 0.55);
  scene.add(hemi);

  const rim = new THREE.DirectionalLight(0xffd6f0, 0.7);
  rim.position.set(0, 6, -8);
  scene.add(rim);

  // --- floor: pastel tiles ---------------------------------------------------
  const floorTex = makeTileTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(9, 9);
  floorTex.anisotropy = 4;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(24, 48),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.65, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- distant candy scenery -------------------------------------------------
  addScenery(scene);

  return { renderer, scene, camera, keyLight: key };
}

// vertical gradient canvas texture
function makeGradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// small hand-painted equirect used only for reflections
function makeEnvironment(pmrem) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#fff7ff');
  grad.addColorStop(0.5, '#ffe9f2');
  grad.addColorStop(0.78, '#e8f6ff');
  grad.addColorStop(1, '#b8dff2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  // bright warm "window" blobs for sparkly highlights
  const blob = (x, y, r, col, a) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = a; g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  };
  blob(60, 26, 34, '#ffffff', 0.98);
  blob(180, 20, 26, '#fff3c4', 0.9);
  blob(120, 50, 20, '#ffd9ea', 0.7);
  blob(230, 46, 18, '#d3f1ff', 0.8);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  return env;
}

function makeTileTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cols = ['#fff3f7', '#f2fbff'];
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      g.fillStyle = cols[(x + y) % 2];
      g.fillRect(x * S / 2, y * S / 2, S / 2, S / 2);
    }
  }
  // soft rounded inset per tile
  g.strokeStyle = 'rgba(255,190,215,0.5)';
  g.lineWidth = 4;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const pad = 7;
    roundRect(g, x * S / 2 + pad, y * S / 2 + pad, S / 2 - pad * 2, S / 2 - pad * 2, 16);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// far background: giant soft marbles / candy hills so the scene has depth
function addScenery(scene) {
  const grp = new THREE.Group();
  const mat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0 });
  const hills = [
    [-14, 0, -16, 7, 0xffd9e6], [13, 0, -18, 9, 0xd9f0ff],
    [-4, 0, -22, 10, 0xfff1cc], [20, 0, -14, 6, 0xe4ffe0],
  ];
  for (const [x, y, z, r, col] of hills) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(col));
    m.position.set(x, y - r * 0.45, z);
    grp.add(m);
  }
  // floating soft bokeh balls that drift slowly
  const drifters = [];
  const geo = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 12; i++) {
    const col = [0xffc7d9, 0xcdeef7, 0xfff0b8, 0xd8f5d0][i % 4];
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: col, roughness: 0.6, transparent: true, opacity: 0.55,
    }));
    const s = 0.25 + Math.random() * 0.6;
    m.scale.setScalar(s);
    m.position.set((Math.random() - 0.5) * 26, 2 + Math.random() * 9, -8 - Math.random() * 12);
    m.userData = { speed: 0.1 + Math.random() * 0.25, phase: Math.random() * 9 };
    drifters.push(m);
    grp.add(m);
  }
  scene.add(grp);

  scene.userData.updateScenery = (t) => {
    for (const d of drifters) {
      d.position.y += Math.sin(t * d.userData.speed + d.userData.phase) * 0.002;
      d.position.x += Math.cos(t * d.userData.speed * 0.7 + d.userData.phase) * 0.0015;
    }
  };
}
