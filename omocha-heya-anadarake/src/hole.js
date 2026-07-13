// The hole itself: a floor material that discards a moving disc (with a
// crayon-dark rim and soft ambient darkening), a gradient interior shaft,
// a fat rim lip that "gulps" when the hole grows, and a water surface.

import * as THREE from '../vendor/three.module.min.js';

export class HoleView {
  constructor(scene) {
    this.scene = scene;
    // x, z, rendered radius (rShow), water level 0..1
    this.uHole = { value: new THREE.Vector4(0, 0, 0.5, 0) };

    // interior shaft: unit cylinder scaled to (r, depth, r)
    this.depth = 8;
    const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true);
    const shaftMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uDim: { value: 1 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uDim;
        void main() {
          // soft brown mouth fading to black, faint spiral stripes
          vec3 mouth = vec3(0.32, 0.19, 0.11);
          vec3 deep = vec3(0.02, 0.012, 0.02);
          float k = pow(1.0 - vUv.y, 1.4);
          vec3 col = mix(deep, mouth, 1.0 - k);
          float stripe = sin((vUv.x * 14.0 + vUv.y * 5.0) * 3.14159 + uTime * 0.4) * 0.5 + 0.5;
          col *= 0.92 + stripe * 0.08 * (1.0 - k);
          gl_FragColor = vec4(col * uDim, 1.0);
        }`,
    });
    this.shaft = new THREE.Mesh(shaftGeo, shaftMat);
    this.shaft.renderOrder = 1;
    scene.add(this.shaft);

    // bottom cap: pure dark
    this.cap = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: '#050308' })
    );
    this.cap.rotation.x = -Math.PI / 2;
    scene.add(this.cap);

    // rim lip: flattened torus that hugs the edge
    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.045, 10, 48),
      new THREE.MeshLambertMaterial({ color: '#3d2417' })
    );
    this.rim.rotation.x = -Math.PI / 2;
    this.rim.renderOrder = 2;
    scene.add(this.rim);

    // water surface inside the hole
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uAlpha;
        void main() {
          float d = distance(vUv, vec2(0.5));
          float rip = sin(d * 26.0 - uTime * 3.2) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.30, 0.72, 0.92), vec3(0.62, 0.90, 1.0), rip * 0.5 + d * 0.4);
          float edgeFoam = smoothstep(0.42, 0.5, d);
          col = mix(col, vec3(1.0), edgeFoam * 0.85);
          gl_FragColor = vec4(col, uAlpha * 0.94);
        }`,
    });
    this.water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.renderOrder = 3;
    this.water.visible = false;
    scene.add(this.water);

    this.time = 0;
  }

  // よるのくに: a bright day-brown shaft would read as a LID in a dark
  // room, so the mouth dims down with the lights
  setNight(on) {
    this.shaft.material.uniforms.uDim.value = on ? 0.22 : 1;
    this.rim.material.color.set(on ? '#17101c' : '#3d2417');
  }

  // hook the moving-disc discard + rim shading into any Lambert material
  patchFloorMaterial(material) {
    const uHole = this.uHole;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uHole = uHole;
      shader.vertexShader = 'varying vec3 vHoleWorld;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vHoleWorld = (modelMatrix * vec4(position, 1.0)).xyz;'
      );
      shader.fragmentShader = 'varying vec3 vHoleWorld;\nuniform vec4 uHole;\n' + shader.fragmentShader
        .replace(
          '#include <clipping_planes_fragment>',
          `float dHole = distance(vHoleWorld.xz, uHole.xy);
           if (dHole < uHole.z) discard;
           #include <clipping_planes_fragment>`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           {
             float rimD = dHole - uHole.z;
             float soft = 1.0 - smoothstep(0.0, 0.9, rimD);
             diffuseColor.rgb *= (1.0 - soft * 0.32);
             float ring = 1.0 - smoothstep(0.035, 0.085, abs(rimD - 0.02));
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.24, 0.14, 0.08), ring * 0.9);
           }`
        );
    };
    material.needsUpdate = true;
  }

  update(dt, hole) {
    this.time += dt;
    if (this.hidden) {
      // さかさま: the hole has peeled off the floor and is mid-air as a
      // falling sheet (main animates it) — the floor shows no hole at all
      this.uHole.value.set(hole.x, hole.z, 0.001, 0);
      this.shaft.visible = this.cap.visible = this.rim.visible = this.water.visible = false;
      return;
    }
    if (!this.shaft.visible) {
      this.shaft.visible = this.cap.visible = this.rim.visible = true;
    }
    const r = Math.max(0.06, hole.rShow);
    this.uHole.value.set(hole.x, hole.z, r, hole.water);

    this.shaft.position.set(hole.x, -this.depth / 2 + 0.01, hole.z);
    this.shaft.scale.set(r, this.depth, r);
    this.shaft.material.uniforms.uTime.value = this.time;

    this.cap.position.set(hole.x, -this.depth + 0.02, hole.z);
    this.cap.scale.set(r, r, 1);

    this.rim.position.set(hole.x, 0.02, hole.z);
    this.rim.scale.set(r, r, 1);

    const targetAlpha = hole.water > 0 ? 1 : 0;
    const a = this.waterMat.uniforms.uAlpha;
    a.value += (targetAlpha - a.value) * Math.min(1, 3 * dt);
    this.water.visible = a.value > 0.02;
    if (this.water.visible) {
      this.water.position.set(hole.x, -0.6, hole.z);
      this.water.scale.set(r * 0.98, r * 0.98, 1);
      this.waterMat.uniforms.uTime.value = this.time;
    }
  }
}
