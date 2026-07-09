// ===== world building: sky, ground, props, particles, lights =====
import * as THREE from 'three';
import { toonMat, toonGradient } from './mii.js';
import { BIOMES } from './data.js';

export function addLights(scene, biome){
  const b = BIOMES[biome];
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, biome==='dark' ? 0.75 : 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(b.sun, biome==='dark' ? 0.9 : 1.5);
  sun.position.set(4, 9, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xaaccff, 0.4);
  rim.position.set(-5, 4, -6);
  scene.add(rim);
}

export function makeSky(biome){
  const b = BIOMES[biome];
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  const top = '#' + b.sky[0].toString(16).padStart(6,'0');
  const bot = '#' + b.sky[1].toString(16).padStart(6,'0');
  grad.addColorStop(0, top); grad.addColorStop(0.55, bot); grad.addColorStop(1, bot);
  ctx.fillStyle = grad; ctx.fillRect(0,0,4,256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16),
    new THREE.MeshBasicMaterial({ map:tex, side:THREE.BackSide, fog:false, depthWrite:false }));
  sky.renderOrder = -10;

  const group = new THREE.Group();
  group.add(sky);

  if (biome === 'dark'){
    // stars
    const n = 220, pos = new Float32Array(n*3);
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, h = Math.random()*0.85 + 0.08, r = 150;
      pos[i*3]   = Math.cos(a)*r*Math.sqrt(1-h*h);
      pos[i*3+1] = h*r;
      pos[i*3+2] = Math.sin(a)*r*Math.sqrt(1-h*h);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xfff8d8, size:1.6, fog:false, sizeAttenuation:false }));
    stars.renderOrder = -9;
    group.add(stars);
    // moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12),
      new THREE.MeshBasicMaterial({ color:0xfff2c8, fog:false }));
    moon.position.set(-60, 90, -100);
    group.add(moon);
  } else {
    // sun disc
    const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color:0xfffbe0, fog:false, transparent:true, opacity:.95 }));
    sun.position.set(50, 85, -110); sun.lookAt(0,0,0);
    group.add(sun);
    // puffy clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.92, fog:false });
    for (let i=0;i<8;i++){
      const cl = new THREE.Group();
      for (let j=0;j<4;j++){
        const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random()*3.5, 10, 8), cloudMat);
        puff.position.set(j*5 - 7 + Math.random()*2, Math.random()*1.6, Math.random()*2);
        puff.scale.y = 0.6; cl.add(puff);
      }
      const a = i/8*Math.PI*2 + Math.random();
      cl.position.set(Math.cos(a)*110, 42 + Math.random()*32, Math.sin(a)*110);
      cl.userData.speed = 0.4 + Math.random()*0.6;
      group.add(cl);
      (group.userData.clouds ??= []).push(cl);
    }
  }
  return group;
}

export function skyTick(sky, dt){
  if (sky.userData.clouds)
    for (const cl of sky.userData.clouds){
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 140) cl.position.x = -140;
    }
}

// undulating ground with a walking path along -Z
export function makeGround(biome, length=400){
  const b = BIOMES[biome];
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(90, length, 24, Math.floor(length/5));
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count*3);
  const c1 = new THREE.Color(b.ground), c2 = new THREE.Color(b.ground2), tmp = new THREE.Color();
  for (let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.abs(x);
    let y = 0;
    if (d > 6) y = (Math.sin(x*0.25 + z*0.12)*0.8 + Math.sin(x*0.11 - z*0.07)*1.4) * Math.min(1, (d-6)/10);
    if (d > 26) y += (d-26)*0.35; // valley walls
    pos.setY(i, y);
    const mix = 0.5 + 0.5*Math.sin(x*0.8 + z*0.5) * 0.6;
    tmp.copy(c1).lerp(c2, Math.max(0, Math.min(1, mix)));
    col[i*3] = tmp.r; col[i*3+1] = tmp.g; col[i*3+2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors:true, gradientMap:toonGradient() }));
  ground.position.z = -length/2 + 20;
  g.add(ground);

  // path ribbon
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.6, length, 1, 40),
    new THREE.MeshToonMaterial({ color:b.path, gradientMap:toonGradient() }));
  path.rotation.x = -Math.PI/2;
  path.position.set(0, 0.04, -length/2 + 20);
  g.add(path);
  return g;
}

// ---------- props ----------
function propTree(){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 8), toonMat(0x8a5a2a));
  trunk.position.y = 0.7; g.add(trunk);
  const leafMat = toonMat(0x4faf50);
  for (let i=0;i<3;i++){
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1 - i*0.22, 12, 10), leafMat);
    puff.position.y = 1.9 + i*0.75; g.add(puff);
  }
  return g;
}
function propFlower(){
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), toonMat(0x4faf50));
  stem.position.y = 0.35; g.add(stem);
  const colors = [0xff7bac, 0xffd76e, 0xffffff, 0xb08aff];
  const petal = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.12, 8, 8), toonMat(colors[Math.floor(Math.random()*4)]));
  petal.position.y = 0.78; petal.rotation.x = Math.PI/2; g.add(petal);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), toonMat(0xffe36e));
  core.position.y = 0.78; g.add(core);
  return g;
}
function propRock(color=0x9aa3ad){
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), toonMat(color));
  rock.scale.set(1, 0.65, 0.9);
  rock.position.y = 0.35;
  rock.rotation.y = Math.random()*Math.PI;
  const g = new THREE.Group(); g.add(rock); return g;
}
function propCactusSmall(){
  const g = new THREE.Group();
  const mat = toonMat(0x58b868);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 4, 10), mat);
  body.position.y = 0.85; g.add(body);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 4, 8), mat);
  arm.position.set(0.55, 1.1, 0); arm.rotation.z = 0.6; g.add(arm);
  return g;
}
function propSkull(){
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), toonMat(0xf2ede0));
  s.position.y = 0.4; s.scale.set(1, 0.9, 0.85); g.add(s);
  const eyeMat = new THREE.MeshBasicMaterial({ color:0x2a2a30 });
  for (const side of [-1,1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    e.position.set(side*0.17, 0.45, 0.38); g.add(e);
  }
  return g;
}
function propPine(){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.0, 8), toonMat(0x6a4a2a));
  trunk.position.y = 0.5; g.add(trunk);
  const mat = toonMat(0x3a8a5a);
  for (let i=0;i<3;i++){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2 - i*0.3, 1.3, 10), mat);
    cone.position.y = 1.4 + i*0.85; g.add(cone);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(1.05 - i*0.28, 0.5, 10), toonMat(0xf4f9ff));
    snow.position.y = 1.85 + i*0.85; g.add(snow);
  }
  return g;
}
function propIce(){
  const g = new THREE.Group();
  const ice = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
    new THREE.MeshToonMaterial({ color:0xa8d8f0, gradientMap:toonGradient(), transparent:true, opacity:.85, emissive:0x4488aa, emissiveIntensity:.2 }));
  ice.position.y = 0.8; ice.scale.set(0.7, 1.4, 0.7);
  ice.rotation.y = Math.random()*Math.PI;
  g.add(ice); return g;
}
function propDeadTree(){
  const g = new THREE.Group();
  const mat = toonMat(0x3a2a3a);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.2, 7), mat);
  trunk.position.y = 1.1; g.add(trunk);
  for (let i=0;i<3;i++){
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 6), mat);
    const a = i*2.1;
    br.position.set(Math.cos(a)*0.35, 1.7 + i*0.3, Math.sin(a)*0.35);
    br.rotation.z = Math.cos(a)*1.0; br.rotation.x = Math.sin(a)*1.0;
    g.add(br);
  }
  return g;
}
function propCrystal(){
  const g = new THREE.Group();
  const colors = [0xb08aff, 0x8ad8f0, 0xff8ad0];
  const col = colors[Math.floor(Math.random()*3)];
  for (let i=0;i<3;i++){
    const cr = new THREE.Mesh(new THREE.ConeGeometry(0.25 - i*0.05, 1.2 - i*0.3, 6),
      new THREE.MeshToonMaterial({ color:col, gradientMap:toonGradient(), emissive:col, emissiveIntensity:.4, transparent:true, opacity:.9 }));
    cr.position.set((i-1)*0.35, (1.2 - i*0.3)/2, (i%2)*0.3 - 0.15);
    cr.rotation.z = (i-1)*0.25;
    g.add(cr);
  }
  return g;
}
function propTorch(){
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), toonMat(0x4a3a5a));
  pole.position.y = 0.9; g.add(pole);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8),
    new THREE.MeshBasicMaterial({ color:0xffb02e }));
  flame.position.y = 2.0; g.add(flame);
  const glow = new THREE.PointLight(0xff9a2e, 6, 9);
  glow.position.y = 2.0; g.add(glow);
  g.userData.flame = flame;
  return g;
}

const PROP_BUILDERS = {
  tree: propTree, flower: propFlower, rock: () => propRock(),
  cactus: propCactusSmall, skull: propSkull,
  pine: propPine, snowrock: () => propRock(0xdae8f4), ice: propIce,
  deadtree: propDeadTree, crystal: propCrystal, torch: propTorch,
};

export function makeProps(biome, length=400){
  const b = BIOMES[biome];
  const g = new THREE.Group();
  const count = Math.floor(length/4.2);
  for (let i=0;i<count;i++){
    const kind = b.props[Math.floor(Math.random()*b.props.length)];
    const prop = PROP_BUILDERS[kind]();
    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = 4.5 + Math.random()*20;
    prop.position.set(side*dist, 0, -Math.random()*length + 20);
    const s = 0.7 + Math.random()*0.9;
    prop.scale.setScalar(s);
    prop.rotation.y = Math.random()*Math.PI*2;
    g.add(prop);
  }
  return g;
}

// ---------- ambient particles ----------
let _dotTex = null;
function dotTexture(){
  if (_dotTex) return _dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32,32,4, 32,32,30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(32,32,30,0,7); ctx.fill();
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}

export function makeParticles(biome){
  const b = BIOMES[biome];
  const n = 120;
  const pos = new Float32Array(n*3);
  const vel = [];
  for (let i=0;i<n;i++){
    pos[i*3]   = (Math.random()-0.5)*50;
    pos[i*3+1] = Math.random()*16;
    pos[i*3+2] = (Math.random()-0.5)*60;
    vel.push({ x:(Math.random()-0.5)*0.6, y:-(0.4+Math.random()*0.8), s:Math.random()*Math.PI*2 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const colors = { petal:0xffb8d0, dust:0xe8c878, snow:0xffffff, star:0xd0b8ff };
  const mat = new THREE.PointsMaterial({
    color: colors[b.particle] ?? 0xffffff, size: b.particle==='snow' ? 0.34 : 0.28,
    map: dotTexture(), transparent:true, opacity:0.9, sizeAttenuation:true,
    depthWrite:false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { vel, biome };
  return pts;
}

export function particlesTick(pts, dt, centerZ=0){
  const pos = pts.geometry.attributes.position;
  const vel = pts.userData.vel;
  for (let i=0;i<vel.length;i++){
    const v = vel[i];
    v.s += dt*2;
    let x = pos.getX(i) + (v.x + Math.sin(v.s)*0.4)*dt;
    let y = pos.getY(i) + (pts.userData.biome==='dark' ? Math.sin(v.s)*0.3*dt*2 : v.y*dt);
    let z = pos.getZ(i);
    if (y < 0) y = 15 + Math.random()*3;
    if (y > 18) y = 0.5;
    if (z - centerZ > 32) z -= 64;
    if (z - centerZ < -32) z += 64;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
}

// battle arena: circular island with props ring
export function makeBattleStage(biome){
  const b = BIOMES[biome];
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 1.4, 36),
    new THREE.MeshToonMaterial({ color:b.ground, gradientMap:toonGradient() }));
  disc.position.y = -0.7;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16.4, 0.5, 10, 40),
    new THREE.MeshToonMaterial({ color:b.path, gradientMap:toonGradient() }));
  ring.rotation.x = Math.PI/2; ring.position.y = 0.0;
  g.add(ring);
  // scattered props on the rim
  for (let i=0;i<10;i++){
    const kind = b.props[Math.floor(Math.random()*b.props.length)];
    const prop = PROP_BUILDERS[kind]();
    const a = i/10*Math.PI*2 + Math.random()*0.4;
    const r = 12 + Math.random()*3.5;
    prop.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
    prop.scale.setScalar(0.6 + Math.random()*0.5);
    g.add(prop);
  }
  return g;
}
