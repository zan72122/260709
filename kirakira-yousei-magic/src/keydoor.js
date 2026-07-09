// The Fairilu-style signature: a golden magic key appears when enough
// flowers bloom, and unlocks an ornate heart-keyhole door with a swirling
// rainbow portal behind it.

import * as THREE from '../vendor/three.module.min.js';
import { glowTexture, heartShape, starGeometry } from './fairy.js';

export function createKey() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffd45e, metalness: 0.6, roughness: 0.25,
    emissive: 0xffaa33, emissiveIntensity: 0.45,
  });
  // heart bow
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.34), { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), gold);
  heart.position.set(0, 0.42, -0.04);
  g.add(heart);
  // shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 10), gold);
  shaft.position.y = -0.12;
  g.add(shaft);
  // teeth
  for (const [y, w] of [[-0.4, 0.2], [-0.28, 0.14]]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), gold);
    tooth.position.set(w / 2 + 0.04, y, 0);
    g.add(tooth);
  }
  // gem in the heart
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshStandardMaterial({
    color: 0xff6d9d, emissive: 0xff4f8a, emissiveIntensity: 0.9, roughness: 0.2,
  }));
  gem.position.set(0, 0.36, 0.05);
  g.add(gem);
  // halo
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xffe9a0, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.setScalar(2.2);
  g.add(halo);
  g.userData.halo = halo;
  g.userData.gem = gem;
  return g;
}

const PORTAL_FRAG = `
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float swirl = a / 6.2831 + uTime * 0.15 - r * 0.7;
  vec3 col = hue(swirl) * 0.85 + 0.25;
  float sparkle = smoothstep(0.96, 1.0, sin(a * 24.0 + uTime * 4.0) * sin(r * 40.0 - uTime * 6.0));
  col += sparkle * 0.6;
  float edge = smoothstep(1.0, 0.75, r);
  gl_FragColor = vec4(col, edge * uOpen);
}`;

const PORTAL_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export function createDoor(accentHex = 0xff8fb8) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d8, roughness: 0.5, emissive: 0xffd8b0, emissiveIntensity: 0.1,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: accentHex, roughness: 0.4, emissive: accentHex, emissiveIntensity: 0.3,
  });

  // platform
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.15, 0.24, 24), frameMat);
  plat.position.y = 0.12;
  g.add(plat);

  // pillars + arch
  for (const sx of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.5, 12), frameMat);
    pil.position.set(sx * 1.05, 1.45, 0);
    g.add(pil);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), accent);
    ball.position.set(sx * 1.05, 2.8, 0);
    g.add(ball);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.16, 10, 24, Math.PI), frameMat);
  arch.position.y = 2.7;
  g.add(arch);
  const topStar = new THREE.Mesh(starGeometry(0.3, 0.13, 0.08), new THREE.MeshStandardMaterial({
    color: 0xffe14f, emissive: 0xffd45e, emissiveIntensity: 1.1, roughness: 0.3,
  }));
  topStar.position.y = 3.95;
  topStar.geometry.center();
  g.add(topStar);

  // swirling portal (revealed as the door opens)
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: PORTAL_VERT,
    fragmentShader: PORTAL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), portalMat);
  portal.position.set(0, 1.5, -0.05);
  portal.scale.set(1, 1.5, 1);
  g.add(portal);

  // door slab (hinged on the left pillar)
  const hinge = new THREE.Group();
  hinge.position.set(-0.9, 0, 0.06);
  g.add(hinge);
  const slab = new THREE.Group();
  slab.position.x = 0.9;
  hinge.add(slab);
  const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.12), accent);
  slabMesh.position.y = 1.45;
  slab.add(slabMesh);
  // half-cylinder crown; theta picked so the round side faces up after the X rotation
  const slabTop = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20, 1, false, Math.PI / 2, Math.PI), accent);
  slabTop.rotation.set(Math.PI / 2, 0, 0);
  slabTop.position.y = 2.7;
  slab.add(slabTop);
  // heart keyhole
  const hole = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.3), { depth: 0.06, bevelEnabled: false }), new THREE.MeshStandardMaterial({
    color: 0xfff6d8, emissive: 0xffe9a0, emissiveIntensity: 0.8, roughness: 0.4,
  }));
  hole.position.set(0, 1.5, 0.08);
  slab.add(hole);
  // deco dots
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), frameMat);
    const a = (i / 6) * Math.PI * 2;
    d.position.set(Math.cos(a) * 0.55, 1.5 + Math.sin(a) * 0.75, 0.08);
    slab.add(d);
  }

  // welcoming glow
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: accentHex, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.position.y = 1.6;
  glow.scale.set(4.5, 5.5, 1);
  g.add(glow);

  g.userData = { hinge, portalMat, glow, topStar, open: 0, opening: false };
  return g;
}

/** Animate the door each frame. `openAmount` 0..1 drives hinge + portal. */
export function updateDoor(door, dt, t, openAmount, excited) {
  const u = door.userData;
  u.open += (openAmount - u.open) * Math.min(1, dt * 2.2);
  u.hinge.rotation.y = -u.open * 1.9;
  u.portalMat.uniforms.uTime.value = t;
  u.portalMat.uniforms.uOpen.value = u.open;
  u.topStar.rotation.y = t * 0.8;
  const base = excited ? 0.5 : 0.12;
  u.glow.material.opacity = base + Math.sin(t * 3) * 0.12 + u.open * 0.3;
}

/** Animate the key: float, spin, sparkle halo. */
export function updateKey(key, dt, t) {
  key.rotation.y = t * 1.4;
  key.position.y += Math.sin(t * 2.4) * 0.003;
  key.userData.halo.material.opacity = 0.6 + 0.3 * Math.sin(t * 5);
  key.userData.gem.rotation.y = t * 3;
}
