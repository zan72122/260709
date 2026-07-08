// Environment dressing: gradient sky dome, drifting clouds, sun, the pastel
// rim around the play floor, and scene lighting.

import * as THREE from '../vendor/three.module.min.js';

const SKY_VERT = /* glsl */`
varying vec3 vPos;
void main() {
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vPos;
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 botColor;
void main() {
  float h = normalize(vPos).y;
  vec3 col = h > 0.0 ? mix(midColor, topColor, pow(h, 0.7)) : mix(midColor, botColor, pow(-h, 0.5));
  gl_FragColor = vec4(col, 1.0);
}`;

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[70, 80, 38], [110, 62, 46], [160, 70, 42], [200, 84, 30], [130, 92, 44], [90, 95, 30], [175, 95, 32]];
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
  }
  return new THREE.CanvasTexture(c);
}

export class World {
  constructor(scene, floorSize) {
    this.scene = scene;
    this.floorSize = floorSize;

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        topColor: { value: new THREE.Color(0x8fd0ff) },
        midColor: { value: new THREE.Color(0xeaf6ff) },
        botColor: { value: new THREE.Color(0xbde8d8) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), this.skyMat);
    sky.renderOrder = -10;
    scene.add(sky);

    // sun: soft glow sprite
    const sunTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,250,220,1)');
      gr.addColorStop(0.25, 'rgba(255,236,170,0.85)');
      gr.addColorStop(1, 'rgba(255,236,170,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false }));
    sun.position.set(18, 26, -30);
    sun.scale.setScalar(18);
    scene.add(sun);

    // clouds
    this.clouds = [];
    const ctex = cloudTexture();
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: 0.85, depthWrite: false }));
      const a = (i / 7) * Math.PI * 2 + Math.random();
      sp.position.set(Math.cos(a) * (26 + Math.random() * 14), 9 + Math.random() * 12, Math.sin(a) * (26 + Math.random() * 14));
      sp.scale.set(9 + Math.random() * 7, 4 + Math.random() * 3, 1);
      scene.add(sp);
      this.clouds.push({ sp, speed: 0.15 + Math.random() * 0.25 });
    }

    // rim around the floor
    this.rimMat = new THREE.MeshPhongMaterial({ color: 0xf5c9d8, shininess: 30 });
    const h = floorSize / 2, t = 0.55, wallH = 0.5;
    const rimGeo = new THREE.BoxGeometry(floorSize + t * 2, wallH, t);
    this.rim = new THREE.Group();
    const mk = (x, z, rot) => {
      const m = new THREE.Mesh(rimGeo, this.rimMat);
      m.position.set(x, wallH / 2 - 0.06, z);
      m.rotation.y = rot;
      this.rim.add(m);
    };
    mk(0, -h - t / 2, 0);
    mk(0, h + t / 2, 0);
    mk(-h - t / 2, 0, Math.PI / 2);
    mk(h + t / 2, 0, Math.PI / 2);
    // rounded corner posts
    const postGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.72, 12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, this.rimMat);
      p.position.set(sx * (h + t / 2), 0.3, sz * (h + t / 2));
      this.rim.add(p);
    }
    scene.add(this.rim);

    // ground far outside the rim
    this.aroundMat = new THREE.MeshLambertMaterial({ color: 0xa8d8a0 });
    const around = new THREE.Mesh(new THREE.CircleGeometry(58, 40), this.aroundMat);
    around.rotation.x = -Math.PI / 2;
    around.position.y = -0.09;
    scene.add(around);

    // lights
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0xcfe8d8, 0.95);
    scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xfff2dd, 1.35);
    this.dir.position.set(6, 11, 4);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    const s = floorSize * 0.75;
    Object.assign(this.dir.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 2, far: 30 });
    this.dir.shadow.bias = -0.002;
    scene.add(this.dir);
    scene.add(this.dir.target);
  }

  applyPalette(pal) {
    this.skyMat.uniforms.topColor.value.set(pal.skyTop);
    this.skyMat.uniforms.midColor.value.set(pal.skyMid);
    this.skyMat.uniforms.botColor.value.set(pal.skyBot);
    this.rimMat.color.set(pal.rim);
    this.aroundMat.color.set(pal.around);
  }

  update(dt, time) {
    for (const c of this.clouds) {
      c.sp.position.x += c.speed * dt;
      if (c.sp.position.x > 45) c.sp.position.x = -45;
    }
  }
}
