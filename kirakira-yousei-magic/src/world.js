// The garden world: a shader sky dome (3-stop gradient + sun glow +
// twinkling stars), soft lighting, a painted ground disc, and per-stage
// decoration rings — trees, glowing mushrooms, floating star islands,
// clouds and a rainbow castle. Stage changes crossfade smoothly.

import * as THREE from '../vendor/three.module.min.js';
import { glowTexture, starGeometry } from './fairy.js';
import { makeGrass } from './flora.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBot;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uStars;
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
void main() {
  float h = clamp(vDir.y, -1.0, 1.0);
  vec3 col = h > 0.25 ? mix(uMid, uTop, smoothstep(0.25, 1.0, h))
                      : mix(uBot, uMid, smoothstep(-0.2, 0.25, h));
  // sun glow
  float s = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
  col += uSunColor * (pow(s, 40.0) * 0.9 + pow(s, 6.0) * 0.25);
  // twinkling stars
  if (uStars > 0.01 && vDir.y > 0.02) {
    vec3 grid = floor(vDir * 60.0);
    float star = step(0.985, hash(grid));
    float tw = 0.5 + 0.5 * sin(uTime * 3.0 + hash(grid + 1.0) * 40.0);
    col += vec3(1.0, 0.98, 0.9) * star * tw * uStars * smoothstep(0.02, 0.3, vDir.y);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function groundTexture(stage) {
  const s = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s / 2);
  grad.addColorStop(0, stage.ground.inner);
  grad.addColorStop(1, stage.ground.outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
    const r = 8 + Math.random() * 34;
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    g.fill();
  }
  // confetti specks (tiny flowers/stars from afar)
  for (let i = 0; i < 420; i++) {
    g.fillStyle = stage.ground.speck[(Math.random() * stage.ground.speck.length) | 0];
    g.globalAlpha = 0.35 + Math.random() * 0.45;
    const r = 1 + Math.random() * 2.6;
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- decor builders ----------

function puffCloud(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const n = 4 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const r = (0.5 + Math.random() * 0.55) * scale;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.set((i - n / 2) * 0.62 * scale, (Math.random() - 0.3) * 0.3 * scale, (Math.random() - 0.5) * 0.5 * scale);
    m.scale.y = 0.75;
    g.add(m);
  }
  return g;
}

function tree(pal) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x9a6b4f }));
  trunk.position.y = 0.8;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: pal });
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.0 - i * 0.18, 12, 10), leafMat);
    leaf.position.set((Math.random() - 0.5) * 0.5, 1.9 + i * 0.55, (Math.random() - 0.5) * 0.5);
    leaf.scale.y = 0.85;
    g.add(leaf);
  }
  return g;
}

function glowMushroom(cap) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 10), new THREE.MeshLambertMaterial({ color: 0xfff2dc }));
  stem.position.y = 0.45;
  g.add(stem);
  const capMat = new THREE.MeshStandardMaterial({ color: cap, roughness: 0.45, emissive: cap, emissiveIntensity: 0.55 });
  const capM = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  capM.position.y = 0.85;
  capM.scale.y = 0.75;
  g.add(capM);
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: 0xfff2c8, emissiveIntensity: 0.7 });
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dotMat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.15 + Math.random() * 0.35;
    d.position.set(Math.cos(a) * r, 0.85 + Math.cos(r) * 0.36, Math.sin(a) * r);
    g.add(d);
  }
  const light = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: cap, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  light.position.y = 1.0;
  light.scale.setScalar(2.4);
  g.add(light);
  return g;
}

function crystal(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({
    color, roughness: 0.15, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.9,
  }));
  m.scale.y = 1.7;
  m.position.y = 0.7;
  g.add(m);
  return g;
}

function floatingIsland() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0x8a7ac0 }));
  rock.rotation.x = Math.PI;
  rock.position.y = -0.8;
  g.add(rock);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xb8a8f0 }));
  top.scale.y = 0.35;
  g.add(top);
  const star = new THREE.Mesh(starGeometry(0.3, 0.13, 0.08), new THREE.MeshStandardMaterial({
    color: 0xffe680, emissive: 0xffd45e, emissiveIntensity: 1.2,
  }));
  star.geometry.center();
  star.position.y = 0.6;
  g.add(star);
  g.userData.star = star;
  return g;
}

function castleTower(h, color, roof) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, h, 12), new THREE.MeshLambertMaterial({ color }));
  body.position.y = h / 2;
  g.add(body);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.5, 12), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.45, emissive: roof, emissiveIntensity: 0.15 }));
  cone.position.y = h + 0.7;
  g.add(cone);
  // glowing window
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 1.0 }));
  win.position.set(0, h * 0.65, 0.81);
  g.add(win);
  return g;
}

function rainbowArch(radius = 12) {
  const g = new THREE.Group();
  const cols = [0xff5f7e, 0xffa94f, 0xffe14f, 0x7fdd6f, 0x5fb8ff, 0x9d76ea, 0xd88ff0];
  cols.forEach((c, i) => {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(radius - i * 0.55, 0.26, 8, 40, Math.PI),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 })
    );
    g.add(t);
  });
  return g;
}

// ---------- world ----------

export class World {
  constructor(scene) {
    this.scene = scene;

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x4fa9ff) },
        uMid: { value: new THREE.Color(0xa8dcff) },
        uBot: { value: new THREE.Color(0xfff2d8) },
        uSunColor: { value: new THREE.Color(0xfff3b0) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4) },
        uStars: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), this.skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    // lights
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0xffe9c9, 1.05);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d9, 1.25);
    this.sun.position.set(6, 12, 4);
    scene.add(this.sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    // fog
    scene.fog = new THREE.Fog(0xcfeaff, 26, 70);

    // ground
    this.groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(46, 48), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // grass (rebuilt per stage for palette; cheap InstancedMesh)
    this.grass = null;

    // decor group swapped per stage
    this.decor = new THREE.Group();
    scene.add(this.decor);
    this.clouds = [];
    this.islands = [];

    // color-lerp targets
    this._targets = null;
    this._stage = null;
  }

  setStage(stage) {
    this._stage = stage;
    // targets for smooth color transitions
    this._targets = {
      top: new THREE.Color(stage.sky.top),
      mid: new THREE.Color(stage.sky.mid),
      bot: new THREE.Color(stage.sky.bot),
      sunC: new THREE.Color(stage.sky.sun),
      stars: stage.sky.stars,
      fog: new THREE.Color(stage.fog),
      hemiSky: new THREE.Color(stage.hemi.sky),
      hemiGround: new THREE.Color(stage.hemi.ground),
      hemiI: stage.hemi.intensity,
      sunL: new THREE.Color(stage.sun.color),
      sunI: stage.sun.intensity,
    };
    this.sun.position.set(...stage.sun.pos);
    this.skyMat.uniforms.uSunDir.value.set(...stage.sun.pos).normalize();

    // ground texture rebuilt instantly (hidden behind the wipe overlay)
    if (this.groundMat.map) this.groundMat.map.dispose();
    this.groundMat.map = groundTexture(stage);
    this.groundMat.needsUpdate = true;

    // grass
    if (this.grass) this.scene.remove(this.grass);
    this.grass = makeGrass(stage.theme === 'night' ? 260 : 420);
    this.scene.add(this.grass);

    // rebuild decor ring
    this.scene.remove(this.decor);
    this.decor = new THREE.Group();
    this.scene.add(this.decor);
    this.clouds.length = 0;
    this.islands.length = 0;
    this._buildDecor(stage);
  }

  _placeRing(builder, count, rMin, rMax, yFn = () => 0) {
    for (let i = 0; i < count; i++) {
      const obj = builder(i);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = rMin + Math.random() * (rMax - rMin);
      obj.position.set(Math.cos(a) * r, yFn(i), Math.sin(a) * r);
      obj.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.5;
      obj.scale.setScalar(s);
      this.decor.add(obj);
    }
  }

  _buildDecor(stage) {
    const petals = stage.petals;
    if (stage.theme === 'day') {
      const leafCols = [0x6fbe6a, 0x8ed07f, 0xff9ec4, 0xa8e08a];
      this._placeRing(() => tree(leafCols[(Math.random() * leafCols.length) | 0]), 10, 15, 21);
      this._placeRing(() => crystal(petals[(Math.random() * petals.length) | 0]), 4, 12, 16);
    } else if (stage.theme === 'dusk') {
      this._placeRing(() => glowMushroom(petals[(Math.random() * petals.length) | 0]), 12, 12, 20);
      this._placeRing(() => tree(0x4e8a6c), 7, 17, 22);
      this._placeRing(() => crystal(0x9d76ea), 3, 12, 15);
    } else if (stage.theme === 'night') {
      this._placeRing(() => crystal(petals[(Math.random() * petals.length) | 0]), 8, 12, 19);
      for (let i = 0; i < 6; i++) {
        const isl = floatingIsland();
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = 16 + Math.random() * 9;
        isl.position.set(Math.cos(a) * r, 5 + Math.random() * 4, Math.sin(a) * r);
        isl.userData.baseY = isl.position.y;
        isl.userData.seed = Math.random() * 10;
        this.decor.add(isl);
        this.islands.push(isl);
      }
    } else { // rainbow finale
      const arch = rainbowArch(13);
      arch.position.set(0, 0, -16);
      this.decor.add(arch);
      // pastel castle behind the arch
      const castle = new THREE.Group();
      castle.add(castleTower(3.4, 0xfff0f6, 0xff8fb8));
      const t2 = castleTower(2.4, 0xf0f6ff, 0x7fc8ff); t2.position.set(-2.2, 0, 0.5); castle.add(t2);
      const t3 = castleTower(2.6, 0xfffbe8, 0xffd45e); t3.position.set(2.2, 0, 0.4); castle.add(t3);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 1.2), new THREE.MeshLambertMaterial({ color: 0xfff4fa }));
      wall.position.y = 0.8;
      castle.add(wall);
      castle.position.set(0, 0, -20);
      castle.scale.setScalar(1.6);
      this.decor.add(castle);
      const leafCols = [0xff9ec4, 0xa8e08a, 0xffd98a];
      this._placeRing(() => tree(leafCols[(Math.random() * leafCols.length) | 0]), 8, 14, 20);
      this._placeRing(() => crystal(petals[(Math.random() * petals.length) | 0]), 6, 11, 16);
    }

    // clouds for every stage
    const nClouds = stage.theme === 'night' ? 4 : 9;
    for (let i = 0; i < nClouds; i++) {
      const c = puffCloud(1.6 + Math.random() * 1.6);
      const a = (i / nClouds) * Math.PI * 2;
      const r = 26 + Math.random() * 16;
      c.position.set(Math.cos(a) * r, 9 + Math.random() * 7, Math.sin(a) * r);
      c.userData.speed = 0.01 + Math.random() * 0.02;
      c.userData.angle = a;
      c.userData.r = r;
      this.decor.add(c);
      this.clouds.push(c);
    }
  }

  update(dt, t) {
    this.skyMat.uniforms.uTime.value = t;
    if (this._targets) {
      const k = Math.min(1, dt * 1.6);
      const u = this.skyMat.uniforms;
      u.uTop.value.lerp(this._targets.top, k);
      u.uMid.value.lerp(this._targets.mid, k);
      u.uBot.value.lerp(this._targets.bot, k);
      u.uSunColor.value.lerp(this._targets.sunC, k);
      u.uStars.value += (this._targets.stars - u.uStars.value) * k;
      this.scene.fog.color.lerp(this._targets.fog, k);
      this.hemi.color.lerp(this._targets.hemiSky, k);
      this.hemi.groundColor.lerp(this._targets.hemiGround, k);
      this.hemi.intensity += (this._targets.hemiI - this.hemi.intensity) * k;
      this.sun.color.lerp(this._targets.sunL, k);
      this.sun.intensity += (this._targets.sunI - this.sun.intensity) * k;
    }
    for (const c of this.clouds) {
      c.userData.angle += c.userData.speed * dt;
      c.position.x = Math.cos(c.userData.angle) * c.userData.r;
      c.position.z = Math.sin(c.userData.angle) * c.userData.r;
    }
    for (const isl of this.islands) {
      isl.position.y = isl.userData.baseY + Math.sin(t * 0.7 + isl.userData.seed) * 0.5;
      isl.userData.star.rotation.y = t;
    }
  }
}
