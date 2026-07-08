// Floor mesh + shader: blends the stage's base texture with the live
// simulation fields (dirt, wet, glow, foam froth, paint) and adds
// soft lighting, wet gloss and clean-sparkle glints.

import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform sampler2D baseTex;
uniform sampler2D fieldA;   // r=dirt g=wet b=glow a=foam
uniform sampler2D fieldB;   // rgb=paint a=amount
uniform float time;
uniform vec3 lightDir;
uniform vec3 dirtColor;
uniform float baseTiling;
uniform float paintGloss;   // syrup look
uniform vec3 sparkleColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

void main() {
  vec4 A = texture2D(fieldA, vUv);
  vec4 B = texture2D(fieldB, vUv);
  float dirt = A.r, wet = A.g, glow = A.b, foam = A.a;

  vec3 col = texture2D(baseTex, vUv * baseTiling).rgb;

  // paint / syrup
  float pAmt = B.a * (0.6 + 0.4 * vnoise(vUv * 90.0));
  col = mix(col, B.rgb, clamp(pAmt * 1.15, 0.0, 0.92));

  // dirt: soft muddy patches (low-frequency mottle, never fully black)
  float mottle = 0.7 + 0.3 * vnoise(vUv * 22.0);
  float d = clamp(dirt * mottle * 1.3, 0.0, 0.82);
  d = smoothstep(0.08, 0.75, d) * 0.82;
  col = mix(col, dirtColor * (0.9 + 0.25 * vnoise(vUv * 44.0)), d);

  // wet: watery blue sheen; deep wet reads as a real puddle
  col *= mix(vec3(1.0), vec3(0.72, 0.88, 1.08), wet);
  float puddle = smoothstep(0.5, 0.95, wet);
  float ripple = 0.5 + 0.5 * vnoise(vUv * 34.0 + vec2(time * 0.22, -time * 0.17));
  col = mix(col, vec3(0.40, 0.64, 0.92) * (0.85 + 0.3 * ripple), puddle * 0.62);

  // froth layer (低い泡 — 3D bubbles add the fluff on top)
  float frothN = vnoise(vUv * 140.0 + time * 0.35) * 0.5 + vnoise(vUv * 55.0 - time * 0.2) * 0.5;
  float froth = smoothstep(0.06, 0.5, foam * (0.75 + 0.5 * frothN));
  vec3 frothCol = mix(vec3(0.93, 0.96, 1.0), vec3(1.0), frothN);
  col = mix(col, frothCol, froth * 0.9);

  // lighting
  vec3 Nrm = vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(lightDir);
  float dif = 0.62 + 0.38 * max(dot(Nrm, L), 0.0);
  vec3 H = normalize(L + V);
  float shininess = mix(24.0, 140.0, clamp(wet + glow * 0.7 + B.a * paintGloss, 0.0, 1.0));
  float specAmt = 0.06 + wet * 0.5 + glow * 0.35 + B.a * paintGloss * 0.55;
  float spec = pow(max(dot(Nrm, H), 0.0), shininess) * specAmt;
  col = col * dif + vec3(spec);

  // clean sparkle: tiny travelling glints where glow is high
  float g1 = vnoise(vUv * 210.0 + vec2(time * 0.9, -time * 0.7));
  float glint = smoothstep(0.955, 1.0, g1) * glow;
  float shimmer = glow * 0.16 * (0.5 + 0.5 * sin(time * 2.4 + vUv.x * 40.0 + vUv.y * 31.0));
  col += sparkleColor * (glint * 1.6 + shimmer);

  // soft edge shading toward the rim
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = smoothstep(0.0, 0.045, min(e.x, e.y));
  col *= 0.86 + 0.14 * edge;

  gl_FragColor = vec4(col, 1.0);
}`;

export function createFloor(size, sim, opts) {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      baseTex: { value: opts.baseTex },
      fieldA: { value: sim.texA },
      fieldB: { value: sim.texB },
      time: { value: 0 },
      lightDir: { value: new THREE.Vector3(0.5, 1.0, 0.35) },
      dirtColor: { value: new THREE.Color(opts.dirtColor || 0x6b4a2f) },
      baseTiling: { value: opts.baseTiling || 1 },
      paintGloss: { value: opts.paintGloss || 0 },
      sparkleColor: { value: new THREE.Color(opts.sparkleColor || 0xfff6c8) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}

// ------------------------------------------------ procedural base textures

function canvasTexture(draw, res = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = res;
  const g = c.getContext('2d');
  draw(g, res);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const baseTextures = {
  terrace: () => canvasTexture((g, R) => {
    g.fillStyle = '#cfe7ee';
    g.fillRect(0, 0, R, R);
    const n = 4, s = R / n;
    const tints = ['#dff2f7', '#cde9f2', '#d8f0e8', '#e2ecfa'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = tints[(x * 3 + y * 5) % tints.length];
      g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      const gr = g.createRadialGradient(x * s + s * 0.35, y * s + s * 0.3, 4, x * s + s / 2, y * s + s / 2, s * 0.8);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(190,215,230,0.25)');
      g.fillStyle = gr;
      g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    }
    g.strokeStyle = 'rgba(150,180,200,0.65)';
    g.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, R); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(R, i * s); g.stroke();
    }
  }),

  atelier: () => canvasTexture((g, R) => {
    g.fillStyle = '#f6f1e7';
    g.fillRect(0, 0, R, R);
    const rows = 6;
    for (let y = 0; y < rows; y++) {
      const h = R / rows;
      g.fillStyle = y % 2 ? '#f3ecdf' : '#f8f3e9';
      g.fillRect(0, y * h, R, h);
      g.strokeStyle = 'rgba(190,170,140,0.5)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, y * h); g.lineTo(R, y * h); g.stroke();
      // wood grain
      g.strokeStyle = 'rgba(205,188,158,0.35)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        const yy = y * h + (k + 0.5) * h / 5 + Math.random() * 4;
        g.moveTo(0, yy);
        for (let x = 0; x <= R; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + y + k) * 3);
        g.stroke();
      }
      const seam = ((y * 7919) % 97) / 97 * R;
      g.strokeStyle = 'rgba(190,170,140,0.5)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(seam, y * h); g.lineTo(seam, (y + 1) * h); g.stroke();
    }
  }),

  garden: () => canvasTexture((g, R) => {
    g.fillStyle = '#8a6644';
    g.fillRect(0, 0, R, R);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * R, y = Math.random() * R, r = 1 + Math.random() * 3.2;
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(112,84,56,0.6)' : v < 0.8 ? 'rgba(150,116,80,0.55)' : 'rgba(74,55,36,0.5)';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // little pebbles
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * R, y = Math.random() * R, r = 2 + Math.random() * 3;
      g.fillStyle = 'rgba(190,180,168,0.7)';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }),

  pancake: () => canvasTexture((g, R) => {
    // wooden table
    g.fillStyle = '#c89058';
    g.fillRect(0, 0, R, R);
    g.strokeStyle = 'rgba(140,90,40,0.35)';
    for (let y = 0; y < R; y += 10) {
      g.lineWidth = 1 + Math.random();
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= R; x += 40) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 2.5);
      g.stroke();
    }
    // giant pancake
    const cx = R / 2, cy = R / 2, r = R * 0.46;
    let gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#f3c877');
    gr.addColorStop(0.75, '#eab961');
    gr.addColorStop(0.92, '#d99a45');
    gr.addColorStop(1, '#c9853a');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    // browned speckles + pores
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.97;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      g.fillStyle = Math.random() < 0.6 ? 'rgba(200,140,60,0.25)' : 'rgba(120,70,25,0.18)';
      g.beginPath(); g.arc(x, y, 1 + Math.random() * 3.5, 0, 7); g.fill();
    }
    gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 10, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,240,200,0.4)');
    gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }),
};
