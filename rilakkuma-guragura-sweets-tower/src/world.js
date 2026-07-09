// せかい — sky, lights, picnic table, clouds, balloons, and the五つの
// sky phases the tower climbs through (morning → sunset → night → cloud sea → space).

import * as THREE from '../vendor/three.module.min.js';

const PHASES = [
  { name: 'あさ', top: 0x6fc1ff, bottom: 0xeaf8ff, hemiSky: 0xbfe3ff, hemiGnd: 0xffe9c9, sun: 0xfff2d8, dir: 1.25, stars: 0, cloudSea: 0 },
  { name: 'ゆうやけ', top: 0xff8f5e, bottom: 0xffe6a8, hemiSky: 0xffc9a0, hemiGnd: 0xffdfb8, sun: 0xffd9a8, dir: 1.05, stars: 0.1, cloudSea: 0 },
  { name: 'よる', top: 0x1b2a5e, bottom: 0x4b5aa8, hemiSky: 0x5566bb, hemiGnd: 0x334477, sun: 0xbdc8ff, dir: 0.7, stars: 1, cloudSea: 0 },
  { name: 'くものうえ', top: 0x7fb3ff, bottom: 0xeef5ff, hemiSky: 0xcfe4ff, hemiGnd: 0xffffff, sun: 0xfff6e0, dir: 1.3, stars: 0, cloudSea: 1 },
  { name: 'うちゅう', top: 0x070c26, bottom: 0x2a3574, hemiSky: 0x3a4a99, hemiGnd: 0x222a55, sun: 0xccd6ff, dir: 0.8, stars: 1, cloudSea: 0.3 },
];

// height (in stacked pieces) where each phase begins
export const PHASE_AT = [0, 10, 20, 30, 40];

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff6f8'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffd2df';
  const n = 8, s = 256 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if ((i + j) % 2 === 0) g.fillRect(i * s, j * s, s, s);
  g.strokeStyle = 'rgba(255,160,185,0.5)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c98d4f'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(140,85,35,0.5)';
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 2 + Math.random() * 3;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffCloud(scale = 1, flat = false) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = (0.5 + Math.random() * 0.6) * scale;
    const p = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
    p.position.set((i - n / 2) * 0.7 * scale, (Math.random() - 0.5) * 0.25 * scale, (Math.random() - 0.5) * 0.5 * scale);
    if (flat) p.scale.y = 0.45;
    g.add(p);
  }
  return g;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.phase = 0;          // continuous phase index
    this.t = 0;

    // ---- sky dome (gradient shader)
    this.skyUniforms = {
      cTop: { value: new THREE.Color(PHASES[0].top) },
      cBottom: { value: new THREE.Color(PHASES[0].bottom) },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(240, 24, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
          varying vec3 vPos;
          void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 cTop; uniform vec3 cBottom; varying vec3 vPos;
          void main() {
            float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(mix(cBottom, cTop, pow(h, 0.9)), 1.0);
          }`,
      })
    );
    scene.add(sky);
    this.sky = sky;

    scene.fog = new THREE.Fog(PHASES[0].bottom, 60, 200);

    // ---- lights
    this.hemi = new THREE.HemisphereLight(PHASES[0].hemiSky, PHASES[0].hemiGnd, 0.9);
    scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(PHASES[0].sun, PHASES[0].dir);
    this.dir.position.set(7, 14, 6);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.near = 1;
    this.dir.shadow.camera.far = 60;
    const S = 9;
    this.dir.shadow.camera.left = -S; this.dir.shadow.camera.right = S;
    this.dir.shadow.camera.top = S; this.dir.shadow.camera.bottom = -S;
    this.dir.shadow.bias = -0.0005;
    scene.add(this.dir);
    scene.add(this.dir.target);
    this.amb = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(this.amb);

    // ---- picnic table
    const table = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9.3, 0.7, 40),
      new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.9 })
    );
    top.position.y = -0.35;
    top.receiveShadow = true;
    table.add(top);
    const legMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(9.3, 8.6, 1.6, 40, 1, true), legMat);
    skirt.position.y = -1.4;
    table.add(skirt);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 8, 16), legMat);
    pillar.position.y = -5;
    table.add(pillar);
    scene.add(table);

    // ---- plate the tower stands on
    const platePts = [
      new THREE.Vector2(0, 0.07), new THREE.Vector2(1.8, 0.09),
      new THREE.Vector2(2.2, 0.14), new THREE.Vector2(2.5, 0.26), new THREE.Vector2(2.62, 0.34),
    ];
    const plate = new THREE.Mesh(
      new THREE.LatheGeometry(platePts, 36),
      new THREE.MeshStandardMaterial({ color: 0xfefcf6, roughness: 0.25, side: THREE.DoubleSide })
    );
    plate.position.y = 0.02;
    plate.receiveShadow = true;
    plate.castShadow = true;
    scene.add(plate);
    // plate rim accent
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.58, 0.045, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0xffb3c8, roughness: 0.4 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.37;
    scene.add(rim);
    this.plateTopY = 0.11;

    // ---- grass ground far below + trees
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(160, 40),
      new THREE.MeshStandardMaterial({ color: 0x7cc46a, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -9.2;
    grass.receiveShadow = true;
    scene.add(grass);
    this.grass = grass;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const d = 26 + Math.random() * 30;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 1 }));
      trunk.position.y = 1.7;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4 + Math.random() * 1.2, 12, 10),
        new THREE.MeshStandardMaterial({ color: i % 3 ? 0x64b552 : 0x8cc96f, roughness: 1 }));
      crown.position.y = 4.6;
      crown.scale.y = 1.1;
      tree.add(crown);
      tree.position.set(Math.cos(a) * d, -9.2, Math.sin(a) * d);
      scene.add(tree);
    }

    // ---- flag garland on the table (party!)
    const garland = new THREE.Group();
    const poleM = new THREE.MeshStandardMaterial({ color: 0xd9832e, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), poleM);
      pole.position.set(s * 7.4, 1.6, -4.2);
      pole.castShadow = true;
      garland.add(pole);
    }
    const flagCols = [0xff6d9d, 0xffc94d, 0x6fd08c, 0x6fa8ff, 0xc98cff];
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const x = -7.4 + t * 14.8;
      const y = 3.1 - Math.sin(t * Math.PI) * 0.85;
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], roughness: 0.8, side: THREE.DoubleSide })
      );
      flag.rotation.x = Math.PI;
      flag.rotation.y = Math.PI / 4;
      flag.position.set(x, y - 0.25, -4.2);
      garland.add(flag);
    }
    scene.add(garland);

    // ---- drifting clouds
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = puffCloud(1.6 + Math.random() * 2.2);
      const a = Math.random() * Math.PI * 2;
      c.userData = { a, d: 30 + Math.random() * 45, y: 8 + Math.random() * 26, sp: 0.01 + Math.random() * 0.02 };
      scene.add(c);
      this.clouds.push(c);
    }
    // cloud sea (phase 3)
    this.cloudSea = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const c = puffCloud(4 + Math.random() * 3, true);
      const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 30;
      c.position.set(Math.cos(a) * d, -2 + Math.random() * 2, Math.sin(a) * d);
      this.cloudSea.add(c);
    }
    this.cloudSea.visible = false;
    scene.add(this.cloudSea);

    // ---- stars
    const starGeo = new THREE.BufferGeometry();
    const N = 400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(200);
      v.y = Math.abs(v.y) * 0.9 + 12;
      pos.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0,
      depthWrite: false,
    }));
    this.scene.add(this.stars);

    // ---- sun / moon disc
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(6, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff3b8, fog: false })
    );
    this.sunDisc.position.set(-90, 70, -140);
    scene.add(this.sunDisc);

    // ---- balloons
    this.balloons = [];
    const balloonCols = [0xff6d9d, 0xffc94d, 0x6fd08c, 0x6fa8ff, 0xc98cff, 0xff8f5e];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 12),
        new THREE.MeshStandardMaterial({ color: balloonCols[i % balloonCols.length], roughness: 0.3 }));
      ball.scale.y = 1.15;
      b.add(ball);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      str.position.y = -1.9;
      b.add(str);
      b.userData = {
        a: Math.random() * Math.PI * 2, d: 14 + Math.random() * 22,
        y: Math.random() * 40 - 5, sp: 0.4 + Math.random() * 0.5,
      };
      scene.add(b);
      this.balloons.push(b);
    }

    // colour scratch objects
    this._ca = new THREE.Color(); this._cb = new THREE.Color();
  }

  /** phase from stacked-piece count, smooth */
  static phaseForCount(count) {
    let p = 0;
    for (let i = 0; i < PHASE_AT.length; i++) if (count >= PHASE_AT[i]) p = i;
    // blend over the 3 pieces before the next threshold
    const next = PHASE_AT[p + 1];
    if (next !== undefined) {
      const span = 3;
      if (count > next - span) p += (count - (next - span)) / span;
    }
    return Math.min(p, PHASES.length - 1);
  }

  phaseName(count) {
    return PHASES[Math.min(Math.round(World.phaseForCount(count)), PHASES.length - 1)].name;
  }

  lerpTo(target, dt) {
    this.phase += (target - this.phase) * Math.min(1, dt * 1.2);
  }

  update(dt, towerTopY) {
    this.t += dt;
    const p = this.phase;
    const i0 = Math.min(Math.floor(p), PHASES.length - 1);
    const i1 = Math.min(i0 + 1, PHASES.length - 1);
    const f = Math.min(1, p - i0);
    const A = PHASES[i0], B = PHASES[i1];
    const mix = (a, b) => this._ca.setHex(a).lerp(this._cb.setHex(b), f);

    this.skyUniforms.cTop.value.copy(mix(A.top, B.top));
    this.skyUniforms.cBottom.value.copy(mix(A.bottom, B.bottom));
    this.scene.fog.color.copy(mix(A.bottom, B.bottom));
    this.hemi.color.copy(mix(A.hemiSky, B.hemiSky));
    this.hemi.groundColor.copy(mix(A.hemiGnd, B.hemiGnd));
    this.dir.color.copy(mix(A.sun, B.sun));
    this.dir.intensity = A.dir + (B.dir - A.dir) * f;
    const starA = A.stars + (B.stars - A.stars) * f;
    this.stars.material.opacity = starA;
    this.stars.rotation.y = this.t * 0.004;
    const seaA = A.cloudSea + (B.cloudSea - A.cloudSea) * f;
    this.cloudSea.visible = seaA > 0.02;
    this.cloudSea.position.y = towerTopY - 1.5;
    this.cloudSea.rotation.y = this.t * 0.01;
    this.cloudSea.traverse(o => {
      if (o.isMesh) o.material.opacity = 0.9 * seaA;
    });

    // sun follows the mood: high in morning, low & warm at sunset, moon at night
    const sunY = 70 - Math.min(p, 2) * 22;
    this.sunDisc.position.set(-90, sunY, -140);
    this.sunDisc.material.color.copy(mix(A.sun, B.sun));

    // shadow light follows the tower top so tall towers stay lit & shadowed
    const ty = Math.min(towerTopY, 40);
    this.dir.position.set(7, 14 + ty * 0.8, 6);
    this.dir.target.position.set(0, ty * 0.5, 0);

    // clouds drift in circles
    for (const c of this.clouds) {
      const u = c.userData;
      u.a += u.sp * dt;
      c.position.set(Math.cos(u.a) * u.d, u.y, Math.sin(u.a) * u.d);
    }
    // balloons rise gently, loop
    for (const b of this.balloons) {
      const u = b.userData;
      u.y += u.sp * dt;
      if (u.y > towerTopY + 30) u.y = -6;
      u.a += dt * 0.05;
      b.position.set(Math.cos(u.a) * u.d, u.y, Math.sin(u.a) * u.d);
      b.rotation.z = Math.sin(this.t * 0.8 + u.d) * 0.08;
    }
  }
}
