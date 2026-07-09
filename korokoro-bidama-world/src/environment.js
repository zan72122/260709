// Sky, clouds, floating island, lights and the PMREM environment map.
// Browser-only (canvas textures) — not imported by the headless tests.
import * as THREE from '../vendor/three.module.min.js';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSoftCircleTexture(colorInner = 'rgba(255,255,255,1)', colorOuter = 'rgba(255,255,255,0)') {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, colorInner);
    g.addColorStop(1, colorOuter);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export function makeStarTexture() {
  return canvasTexture(64, (ctx, s) => {
    ctx.translate(s / 2, s / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    // 4-point sparkle
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? s / 2 : s / 9;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}

function makeCloudTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const blobs = [
      [0.5, 0.58, 0.30], [0.32, 0.62, 0.22], [0.68, 0.62, 0.22],
      [0.42, 0.46, 0.20], [0.58, 0.46, 0.19], [0.22, 0.68, 0.13], [0.78, 0.68, 0.13],
    ];
    for (const [x, y, r] of blobs) {
      const g = ctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
}

function lathe(points, colors, segments = 48) {
  // points: [[radius, y, colorIndex], ...] -> vertex-colored lathe geometry
  const pts = points.map(p => new THREE.Vector2(p[0], p[1]));
  const geo = new THREE.LatheGeometry(pts, segments);
  const pos = geo.attributes.position;
  const colAttr = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // find the two profile points bracketing this y and lerp their colors
    let ci = points.length - 1;
    for (let j = 0; j < points.length - 1; j++) {
      const y0 = points[j][1], y1 = points[j + 1][1];
      if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) { ci = j; break; }
    }
    const j = Math.min(ci, points.length - 2);
    const y0 = points[j][1], y1 = points[j + 1][1];
    const f = Math.abs(y1 - y0) < 1e-6 ? 0 : THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
    col.set(colors[j]).lerp(new THREE.Color(colors[j + 1]), f);
    colAttr[i * 3] = col.r; colAttr[i * 3 + 1] = col.g; colAttr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
  return geo;
}

export function buildEnvironment(renderer, scene, palette, islandR) {
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];

  // ---- sky dome -----------------------------------------------------
  const skyUniforms = {
    topColor: { value: new THREE.Color(palette.skyTop) },
    midColor: { value: new THREE.Color(palette.skyMid) },
    botColor: { value: new THREE.Color(palette.skyBot) },
    sunColor: { value: new THREE.Color(palette.sun) },
    sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.3).normalize() },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor, midColor, botColor, sunColor;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = mix(botColor, midColor, smoothstep(-0.08, 0.22, h));
        col = mix(col, topColor, smoothstep(0.2, 0.75, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 220.0) * 1.1 + pow(s, 18.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 20), skyMat);
  group.add(sky);
  disposables.push(sky.geometry, skyMat);

  // ---- lights ----------------------------------------------------------
  const hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, 0.85);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4dd, 2.1);
  sun.position.set(14, 20, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.015;
  group.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(palette.skyMid, 0.35);
  fill.position.set(-10, 8, -12);
  group.add(fill);

  scene.fog = new THREE.Fog(palette.fog, 55, 150);

  // ---- environment map (reflections on marbles / rails) ----------------
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(palette.skyMid);
    const grad = new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 12),
      new THREE.MeshBasicMaterial({ color: palette.skyTop, side: THREE.BackSide }));
    grad.position.y = 25;
    envScene.add(grad);
    const groundGlow = new THREE.Mesh(
      new THREE.CircleGeometry(40, 24),
      new THREE.MeshBasicMaterial({ color: palette.grass }));
    groundGlow.rotation.x = -Math.PI / 2;
    groundGlow.position.y = -6;
    envScene.add(groundGlow);
    const key = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    key.position.set(18, 24, 12);
    envScene.add(key);
    const warm = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 10),
      new THREE.MeshBasicMaterial({ color: palette.sun, side: THREE.DoubleSide }));
    warm.position.set(-16, 12, -10);
    warm.lookAt(0, 4, 0);
    envScene.add(warm);
    const env = pmrem.fromScene(envScene, 0.06);
    scene.environment = env.texture;
    disposables.push({ dispose: () => { env.texture.dispose(); pmrem.dispose(); } });
  }

  // ---- floating island --------------------------------------------------
  // profiles run bottom->top so lathe normals face outward/up
  const r = islandR + 1.2;
  const grassGeo = lathe([
    [r, -0.25], [r * 0.94, 0.05], [r * 0.72, 0.2], [r * 0.35, 0.36], [0, 0.42],
  ], [palette.grassEdge, palette.grassEdge, palette.grass, palette.grass, palette.grass]);
  const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, metalness: 0,
  }));
  grass.position.y = -0.4;
  grass.receiveShadow = true;
  group.add(grass);
  disposables.push(grassGeo, grass.material);

  const earthGeo = lathe([
    [0, -6.2], [r * 0.22, -5.2], [r * 0.55, -3.4], [r * 0.86, -1.6], [r, -0.25],
  ], [palette.earthDark, palette.earthDark, palette.earthDark, palette.earth, palette.earth]);
  const earth = new THREE.Mesh(earthGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, flatShading: false,
  }));
  earth.position.y = -0.4;
  group.add(earth);
  disposables.push(earthGeo, earth.material);

  // little floating rocks around the island
  const rockMat = new THREE.MeshStandardMaterial({ color: palette.earth, roughness: 0.9 });
  const rockTop = new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 0.85 });
  const rocks = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.7;
    const d = r + 4.5 + (i % 3) * 2.6;
    const rock = new THREE.Group();
    const s = 0.8 + (i % 3) * 0.55;
    // mini floating island: earthy drop below, grassy cap above
    const body = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), rockMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = -s * 0.55;
    rock.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(s * 1.12, 12, 8), rockTop);
    top.scale.set(1, 0.38, 1);
    rock.add(top);
    rock.position.set(Math.cos(a) * d, 1.5 + Math.sin(i * 2.3) * 2.5, Math.sin(a) * d);
    rock.userData.baseY = rock.position.y;
    rock.userData.phase = i * 1.4;
    group.add(rock);
    rocks.push(rock);
  }

  // ---- clouds ------------------------------------------------------------
  const cloudTex = makeCloudTexture();
  disposables.push(cloudTex);
  const clouds = [];
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex, color: palette.cloud, transparent: true,
    opacity: 0.92, depthWrite: false, fog: false,
  });
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const a = (i / 16) * Math.PI * 2 + i * 0.618;
    const d = 30 + (i % 4) * 14;
    const sc = 9 + (i % 5) * 4;
    sp.position.set(Math.cos(a) * d, 4 + ((i * 7) % 17), Math.sin(a) * d);
    sp.scale.set(sc, sc * 0.55, 1);
    sp.userData = { a, d, speed: 0.008 + (i % 3) * 0.004, y: sp.position.y };
    group.add(sp);
    clouds.push(sp);
  }
  // puffs hugging the island underside
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(cloudMat.clone());
    sp.material.opacity = 0.8;
    const a = (i / 6) * Math.PI * 2 + 0.4;
    sp.position.set(Math.cos(a) * (r * 0.75), -1.6 - (i % 2) * 1.2, Math.sin(a) * (r * 0.75));
    sp.scale.set(8, 4.2, 1);
    sp.userData = { a, d: r * 0.75, speed: 0.012, y: sp.position.y };
    group.add(sp);
    clouds.push(sp);
  }

  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      for (const c of clouds) {
        c.userData.a += c.userData.speed * dt;
        c.position.x = Math.cos(c.userData.a) * c.userData.d;
        c.position.z = Math.sin(c.userData.a) * c.userData.d;
        c.position.y = c.userData.y + Math.sin(t * 0.3 + c.userData.d) * 0.4;
      }
      for (const rock of rocks) {
        rock.position.y = rock.userData.baseY + Math.sin(t * 0.4 + rock.userData.phase) * 0.5;
        rock.rotation.y += dt * 0.05;
      }
    },
    dispose() {
      scene.remove(group);
      scene.environment = null;
      scene.fog = null;
      for (const d of disposables) d.dispose && d.dispose();
      group.traverse(o => {
        if (o.isMesh || o.isSprite) {
          o.geometry && o.geometry.dispose && o.geometry.dispose();
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose && m.dispose());
          }
        }
      });
    },
  };
}
