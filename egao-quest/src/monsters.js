// ===== procedural monsters (with stolen faces!) =====
import * as THREE from 'three';
import { toonMat, toonGradient, drawFaceFeatures } from './mii.js';
import { randomMiiConfig, SKIN_COLORS } from './data.js';

// a "stolen face" plate: rounded skin-colored plane with mii features
function makeStolenFace(size=1){
  const cfg = randomMiiConfig();
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = SKIN_COLORS[cfg.skin];
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 8; ctx.stroke();
  drawFaceFeatures(ctx, 256, 256, cfg, { eyeY:0.46, mouthY:0.62, eyeDX:0.13, scale:1.15 });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(size*0.55, 24),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true }));
  m.userData.faceCfg = cfg;
  return m;
}

// simple dot-eyes face for non-face monsters
function makeSimpleEyes(color=0x2a2a34){
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  for (const side of [-1,1]){
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat);
    eye.position.set(side*0.28, 0.1, 0);
    g.add(eye);
  }
  return g;
}

export function createMonster(def, opts={}){
  const g = new THREE.Group();
  const color = def.color;
  const mat = toonMat(color);
  let faceAnchor = { y: 1.0, z: 0.8, size: 1 };

  switch(def.shape){
    case 'slime': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat);
      body.scale.set(1.15, 0.95, 1.05); body.position.y = 0.9; g.add(body);
      const drop = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), mat);
      drop.position.set(0.3, 1.9, 0); drop.rotation.z = -0.3; g.add(drop);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.7 }));
      shine.position.set(-0.4, 1.5, 0.75); g.add(shine);
      faceAnchor = { y: 0.85, z: 1.02, size: 1.1 };
      g.userData.bounce = 1.2;
      break;
    }
    case 'mushroom': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.1, 14), toonMat(0xfff2dc));
      stem.position.y = 0.55; g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14, 0, Math.PI*2, 0, Math.PI*0.55), mat);
      cap.position.y = 1.0; cap.scale.set(1, 0.9, 1); g.add(cap);
      const dotMat = toonMat(0xfff8ec);
      for (let i=0;i<5;i++){
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14 + Math.random()*0.08, 8, 8), dotMat);
        const a = i/5*Math.PI*2 + 0.4;
        dot.position.set(Math.cos(a)*0.72, 1.45 + Math.sin(i*2.1)*0.15, Math.sin(a)*0.72);
        g.add(dot);
      }
      faceAnchor = { y: 0.62, z: 0.72, size: 0.85 };
      g.userData.bounce = 0.5;
      break;
    }
    case 'bat': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat);
      body.position.y = 1.5; g.add(body);
      const wingGeo = new THREE.ConeGeometry(0.5, 1.2, 3);
      for (const side of [-1,1]){
        const wing = new THREE.Mesh(wingGeo, mat);
        wing.position.set(side*1.0, 1.6, -0.1);
        wing.rotation.z = side*Math.PI/2;
        wing.scale.set(1, 1, 0.25);
        g.add(wing);
        g.userData['wing'+(side<0?'L':'R')] = wing;
      }
      for (const side of [-1,1]){
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), mat);
        ear.position.set(side*0.35, 2.2, 0); g.add(ear);
      }
      faceAnchor = { y: 1.45, z: 0.62, size: 0.6 };
      g.userData.fly = 1.5;
      break;
    }
    case 'cactus': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.2, 6, 14), mat);
      body.position.y = 1.3; g.add(body);
      for (const side of [-1,1]){
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), mat);
        arm.position.set(side*0.95, 1.5, 0); arm.rotation.z = side*0.5; g.add(arm);
      }
      const spikeMat = toonMat(0xf8ffe8);
      for (let i=0;i<10;i++){
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), spikeMat);
        const a = Math.random()*Math.PI*2, h = 0.6 + Math.random()*1.4;
        sp.position.set(Math.cos(a)*0.72, h, Math.sin(a)*0.72);
        sp.rotation.set(Math.PI/2*Math.sin(a+Math.PI/2), 0, -Math.cos(a)*Math.PI/2*0.5);
        g.add(sp);
      }
      const flower = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.1, 8, 6), toonMat(0xff7bac));
      flower.position.y = 2.35; flower.rotation.x = Math.PI/2; g.add(flower);
      faceAnchor = { y: 1.45, z: 0.74, size: 0.85 };
      g.userData.bounce = 0.3;
      break;
    }
    case 'golem': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.1), mat);
      body.position.y = 1.3; g.add(body);
      const headM = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.85), mat);
      headM.position.y = 2.35; g.add(headM);
      for (const side of [-1,1]){
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.5), mat);
        arm.position.set(side*1.1, 1.35, 0); g.add(arm);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.6), mat);
        leg.position.set(side*0.45, 0.3, 0); g.add(leg);
      }
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), toonMat(0x6aa84f));
      moss.position.set(0.5, 2.0, 0.3); moss.scale.y = 0.5; g.add(moss);
      faceAnchor = { y: 2.35, z: 0.45, size: 0.62 };
      g.userData.bounce = 0.15;
      break;
    }
    case 'snowman': {
      const bottom = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), mat);
      bottom.position.y = 0.85; g.add(bottom);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), mat);
      top.position.y = 2.1; g.add(top);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), toonMat(0xf5a623));
      nose.position.set(0, 2.1, 0.85); nose.rotation.x = Math.PI/2; g.add(nose);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), toonMat(0x3a4a6a));
      hat.position.y = 2.85; g.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), toonMat(0x3a4a6a));
      brim.position.y = 2.62; g.add(brim);
      for (const side of [-1,1]){
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), toonMat(0x8a5a2a));
        stick.position.set(side*1.15, 1.35, 0); stick.rotation.z = side*1.2; g.add(stick);
      }
      faceAnchor = { y: 2.15, z: 0.66, size: 0.62 };
      g.userData.bounce = 0.3;
      break;
    }
    case 'ghost': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 14),
        new THREE.MeshToonMaterial({ color, gradientMap:toonGradient(), transparent:true, opacity:0.85 }));
      body.position.y = 1.7; body.scale.set(1, 1.15, 1); g.add(body);
      for (let i=0;i<5;i++){
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8),
          new THREE.MeshToonMaterial({ color, gradientMap:toonGradient(), transparent:true, opacity:0.8 }));
        const a = i/5*Math.PI*2;
        tail.position.set(Math.cos(a)*0.5, 0.85, Math.sin(a)*0.5);
        tail.rotation.x = Math.PI; g.add(tail);
      }
      for (const side of [-1,1]){
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
          new THREE.MeshToonMaterial({ color, gradientMap:toonGradient(), transparent:true, opacity:0.85 }));
        hand.position.set(side*0.95, 1.7, 0.15); g.add(hand);
      }
      faceAnchor = { y: 1.75, z: 0.82, size: 0.75 };
      g.userData.fly = 1.2;
      break;
    }
    case 'crystal': {
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.0),
        new THREE.MeshToonMaterial({ color, gradientMap:toonGradient(), emissive:color, emissiveIntensity:0.35, transparent:true, opacity:0.92 }));
      core.position.y = 1.5; core.scale.set(0.8, 1.25, 0.8); g.add(core);
      g.userData.spinCore = core;
      for (let i=0;i<4;i++){
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22),
          new THREE.MeshToonMaterial({ color, gradientMap:toonGradient(), emissive:color, emissiveIntensity:0.5 }));
        const a = i/4*Math.PI*2;
        shard.position.set(Math.cos(a)*1.15, 1.5 + Math.sin(i*1.7)*0.4, Math.sin(a)*1.15);
        g.add(shard);
        (g.userData.shards ??= []).push({ mesh:shard, a, r:1.15 });
      }
      faceAnchor = { y: 1.5, z: 0.85, size: 0.6 };
      g.userData.fly = 0.8;
      break;
    }
    default: { // devil (だいまおう / こあくま)
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 16), mat);
      body.position.y = 1.4; body.scale.set(1, 1.2, 0.95); g.add(body);
      for (const side of [-1,1]){
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 10), toonMat(0xffd76e));
        horn.position.set(side*0.55, 2.55, 0); horn.rotation.z = -side*0.4; g.add(horn);
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 3), toonMat(0x2a1a3a));
        wing.position.set(side*1.2, 1.8, -0.35);
        wing.rotation.z = side*Math.PI/2; wing.scale.set(1, 1, 0.2);
        g.add(wing); g.userData['wing'+(side<0?'L':'R')] = wing;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mat);
        hand.position.set(side*1.05, 1.3, 0.3); g.add(hand);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 8), mat);
      tail.position.set(0, 0.6, -0.8); tail.rotation.x = 2.4; g.add(tail);
      faceAnchor = { y: 1.55, z: 0.92, size: 0.95 };
      g.userData.fly = def.boss ? 0.9 : 1.1;
      break;
    }
  }

  // attach face
  let stolenCfg = null;
  if (def.face){
    const face = makeStolenFace(faceAnchor.size);
    face.position.set(0, faceAnchor.y, faceAnchor.z + 0.02);
    g.add(face);
    g.userData.faceMesh = face;
    stolenCfg = face.userData.faceCfg;
  } else {
    const eyes = makeSimpleEyes();
    eyes.position.set(0, faceAnchor.y, faceAnchor.z);
    eyes.scale.setScalar(faceAnchor.size);
    g.add(eyes);
  }

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.16, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.02;
  g.add(shadow);
  g.userData.shadow = shadow;

  if (def.boss) g.scale.setScalar(def.shape==='devil' ? 1.9 : 1.6);
  g.userData.def = def;
  g.userData.stolenCfg = stolenCfg;
  g.userData.t = Math.random()*10;
  return g;
}

export function monsterTick(m, dt){
  const u = m.userData; u.t += dt;
  const t = u.t;
  if (u.bounce){
    const squash = 1 + Math.sin(t*4)*0.045*u.bounce;
    m.scale.y = (u.def.boss ? (u.def.shape==='devil'?1.9:1.6) : 1) * squash;
  }
  if (u.fly){
    const base = u.fly*0.25;
    m.position.y = u.baseY !== undefined ? u.baseY + base + Math.sin(t*2.6)*0.22 : base + Math.sin(t*2.6)*0.22;
    if (u.shadow){
      u.shadow.position.y = -m.position.y + 0.02;
      const s = 1 - Math.sin(t*2.6)*0.12;
      u.shadow.scale.setScalar(Math.max(0.4, s));
    }
  }
  if (u.wingL){ u.wingL.rotation.y =  Math.sin(t*9)*0.5; u.wingR.rotation.y = -Math.sin(t*9)*0.5; }
  if (u.spinCore) u.spinCore.rotation.y += dt*1.2;
  if (u.shards) for (const s of u.shards){
    s.a += dt*1.4;
    s.mesh.position.x = Math.cos(s.a)*s.r;
    s.mesh.position.z = Math.sin(s.a)*s.r;
  }
}
