// ===== Mii-style procedural characters =====
import * as THREE from 'three';
import { SKIN_COLORS, HAIR_COLORS, JOBS } from './data.js';

let _gradTex = null;
export function toonGradient(){
  if (_gradTex) return _gradTex;
  const data = new Uint8Array([80,80,80,255, 160,160,160,255, 235,235,235,255, 255,255,255,255]);
  _gradTex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  _gradTex.needsUpdate = true;
  _gradTex.minFilter = _gradTex.magFilter = THREE.NearestFilter;
  return _gradTex;
}
export function toonMat(color, opts={}){
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

// ---------- face drawing (shared by heads, HUD icons, monster faces) ----------
export function drawFaceFeatures(ctx, W, H, cfg, opt={}){
  const cx = W/2;
  const eyeY  = H * (opt.eyeY ?? 0.47);
  const eyeDX = W * (opt.eyeDX ?? 0.085);
  const s     = W/256; // scale unit
  const browC = HAIR_COLORS[cfg.hairColor ?? 0];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // --- eyes ---
  ctx.fillStyle = '#2a2a34'; ctx.strokeStyle = '#2a2a34';
  const er = 9*s * (opt.scale ?? 1);
  for (const side of [-1,1]){
    const x = cx + side*eyeDX;
    ctx.save(); ctx.translate(x, eyeY);
    switch(cfg.eyes){
      case 0: // まる
        ctx.beginPath(); ctx.arc(0,0,er,0,7); ctx.fill();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-er*.3,-er*.3,er*.32,0,7); ctx.fill(); ctx.fillStyle='#2a2a34';
        break;
      case 1: // たれ
        ctx.save(); ctx.rotate(side*0.5);
        ctx.beginPath(); ctx.ellipse(0,0,er*1.05,er*.75,0,0,7); ctx.fill(); ctx.restore();
        break;
      case 2: // つり
        ctx.save(); ctx.rotate(-side*0.5);
        ctx.beginPath(); ctx.ellipse(0,0,er*1.05,er*.75,0,0,7); ctx.fill(); ctx.restore();
        break;
      case 3: { // ほし
        ctx.beginPath();
        for (let i=0;i<10;i++){
          const ang = -Math.PI/2 + i*Math.PI/5;
          const r = (i%2===0)? er*1.35 : er*.6;
          ctx[i? 'lineTo':'moveTo'](Math.cos(ang)*r, Math.sin(ang)*r);
        }
        ctx.closePath(); ctx.fill(); break;
      }
      case 4: // にっこり (^ ^)
        ctx.lineWidth = 5*s;
        ctx.beginPath(); ctx.arc(0, er*.5, er, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
        break;
      default: // ジト
        ctx.fillRect(-er, -er*.35, er*2, er*.7);
        ctx.lineWidth = 3*s;
        ctx.beginPath(); ctx.moveTo(-er, -er*.5); ctx.lineTo(er, -er*.5); ctx.stroke();
    }
    ctx.restore();
  }

  // --- brows ---
  if (cfg.brows !== 3){
    ctx.strokeStyle = browC; ctx.lineWidth = 6*s;
    const by = eyeY - 22*s*(opt.scale ?? 1);
    for (const side of [-1,1]){
      const x = cx + side*eyeDX;
      ctx.save(); ctx.translate(x, by);
      if (cfg.brows===1) ctx.rotate(-side*0.35);      // りりしい
      else if (cfg.brows===2) ctx.rotate(side*0.35);  // こまり
      ctx.beginPath(); ctx.moveTo(-10*s,0); ctx.lineTo(10*s,0); ctx.stroke();
      ctx.restore();
    }
  }

  // --- mouth ---
  const my = H * (opt.mouthY ?? 0.585);
  ctx.save(); ctx.translate(cx, my);
  ctx.strokeStyle = '#b8503c'; ctx.fillStyle = '#c8604a'; ctx.lineWidth = 5*s;
  switch(cfg.mouth){
    case 0: // にこ
      ctx.beginPath(); ctx.arc(0,-4*s, 14*s, 0.25*Math.PI, 0.75*Math.PI); ctx.stroke(); break;
    case 1: // わーい (open)
      ctx.beginPath(); ctx.arc(0,0, 13*s, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ff9a8a'; ctx.beginPath(); ctx.arc(0, 6*s, 6*s, 0, Math.PI); ctx.fill(); break;
    case 2: // ちいさい
      ctx.beginPath(); ctx.arc(0,0, 4.5*s, 0, 7); ctx.fill(); break;
    case 3: // へのじ
      ctx.beginPath(); ctx.arc(0, 12*s, 14*s, 1.25*Math.PI, 1.75*Math.PI); ctx.stroke(); break;
    case 4: // ぺろ
      ctx.beginPath(); ctx.arc(0,-3*s, 13*s, 0.2*Math.PI, 0.8*Math.PI); ctx.stroke();
      ctx.fillStyle='#ff8a9a'; ctx.beginPath(); ctx.ellipse(5*s, 8*s, 6*s, 8*s, 0, 0, 7); ctx.fill(); break;
    default: // おちょぼ
      ctx.beginPath(); ctx.ellipse(0,0, 5*s, 7*s, 0, 0, 7); ctx.stroke();
  }
  ctx.restore();

  // --- blush ---
  ctx.fillStyle = 'rgba(255,130,130,.28)';
  for (const side of [-1,1]){
    ctx.beginPath(); ctx.ellipse(cx + side*W*0.16, H*0.55, 13*s, 8*s, 0, 0, 7); ctx.fill();
  }
}

export function makeFaceTexture(cfg){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,512,512);
  // features live around u=0.5 (front after rotation), equator height
  drawFaceFeatures(ctx, 512, 512, cfg, { eyeY:0.455, mouthY:0.578, eyeDX:0.068, scale:0.92 });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// small round face icon for HUD cards
export function drawFaceIcon(canvas, cfg){
  const W = canvas.width = 128, H = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = SKIN_COLORS[cfg.skin];
  ctx.beginPath(); ctx.arc(W/2, H/2 + 6, 52, 0, 7); ctx.fill();
  // hair arc
  ctx.fillStyle = HAIR_COLORS[cfg.hairColor];
  if (cfg.hairStyle !== 99){
    ctx.beginPath(); ctx.arc(W/2, H/2 + 2, 56, Math.PI*1.02, Math.PI*1.98); ctx.fill();
    if (cfg.hairStyle===3){ // twin
      ctx.beginPath(); ctx.arc(14, 66, 16, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(114, 66, 16, 0, 7); ctx.fill();
    }
    if (cfg.hairStyle===5){ ctx.beginPath(); ctx.arc(W/2, 16, 15, 0, 7); ctx.fill(); }
    if (cfg.hairStyle===2){
      for (let i=-2;i<=2;i++){
        ctx.beginPath(); ctx.moveTo(W/2 + i*18 - 8, 34); ctx.lineTo(W/2 + i*18, 4); ctx.lineTo(W/2 + i*18 + 8, 34); ctx.fill();
      }
    }
  }
  drawFaceFeatures(ctx, W, H, cfg, { eyeY:0.52, mouthY:0.68, eyeDX:0.14, scale:0.9 });
}

// ---------- hair meshes ----------
function buildHair(style, colorHex){
  const g = new THREE.Group();
  const mat = toonMat(colorHex);
  // tilt the cap backwards so it never covers the face (front = +Z)
  const shell = (thetaLen, r=1.06, tilt=-0.32) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16, 0, Math.PI*2, 0, thetaLen), mat);
    m.rotation.x = tilt;
    return m;
  };
  // rear hair piece: covers the back of the head only
  const backPiece = (thetaLen=Math.PI*0.5) =>
    new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 12, Math.PI*0.72, Math.PI*1.56, Math.PI*0.25, thetaLen), mat);
  switch(style){
    case 0: { // short
      g.add(shell(Math.PI*0.4));
      g.add(backPiece()); break;
    }
    case 1: { // bowl
      g.add(shell(Math.PI*0.46, 1.08));
      g.add(backPiece(Math.PI*0.4)); break;
    }
    case 2: { // spiky
      g.add(shell(Math.PI*0.34, 1.06, -0.22));
      for (let i=0;i<6;i++){
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 8), mat);
        const a = i/6*Math.PI*2;
        cone.position.set(Math.cos(a)*0.5, 0.92, Math.sin(a)*0.5);
        cone.rotation.set(Math.sin(a)*0.7, 0, -Math.cos(a)*0.7);
        g.add(cone);
      }
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 8), mat);
      top.position.y = 1.15; g.add(top); break;
    }
    case 3: { // twin tails
      g.add(shell(Math.PI*0.4));
      g.add(backPiece(Math.PI*0.42));
      for (const side of [-1,1]){
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), mat);
        tail.scale.set(1, 1.7, 1);
        tail.position.set(side*1.05, -0.15, -0.15);
        g.add(tail);
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), toonMat(0xff6b95));
        tie.position.set(side*0.98, 0.35, -0.12); g.add(tie);
      }
      break;
    }
    case 4: { // long
      g.add(shell(Math.PI*0.4));
      g.add(backPiece(Math.PI*0.48));
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 1.5, 16, 1, false, Math.PI*0.6, Math.PI*1.8), mat);
      back.position.set(0, -0.55, -0.28); g.add(back);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), mat);
      tip.scale.set(1, 0.5, 1); tip.position.set(0, -1.3, -0.28); g.add(tip);
      break;
    }
    default: { // bun
      g.add(shell(Math.PI*0.4));
      g.add(backPiece(Math.PI*0.4));
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), mat);
      bun.position.y = 1.1; g.add(bun);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), toonMat(0xffd76e));
      tie.rotation.x = Math.PI/2; tie.position.y = 0.88; g.add(tie);
    }
  }
  return g;
}

// ---------- weapons ----------
export function buildWeapon(kind){
  const g = new THREE.Group();
  switch(kind){
    case 'sword': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.26), toonMat(0xdfe8f2));
      blade.position.y = 0.75; g.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 4), toonMat(0xdfe8f2));
      tip.position.y = 1.42; tip.rotation.y = Math.PI/4; g.add(tip);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.12), toonMat(0xe8b23c));
      guard.position.y = 0.2; g.add(guard);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), toonMat(0x8a4a2a));
      g.add(grip); break;
    }
    case 'staff': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 8), toonMat(0x9a6a3a));
      rod.position.y = 0.55; g.add(rod);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10),
        new THREE.MeshToonMaterial({ color:0x9a6aff, gradientMap:toonGradient(), emissive:0x5a2ae0, emissiveIntensity:.6 }));
      orb.position.y = 1.4; g.add(orb); break;
    }
    case 'wand': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.1, 8), toonMat(0xf0e8d8));
      rod.position.y = 0.45; g.add(rod);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2),
        new THREE.MeshToonMaterial({ color:0xffe36e, gradientMap:toonGradient(), emissive:0xe8a800, emissiveIntensity:.7 }));
      star.position.y = 1.1; g.add(star); break;
    }
    case 'dagger': {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 4), toonMat(0xd8e8e0));
      blade.position.y = 0.55; blade.rotation.y = Math.PI/4; g.add(blade);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), toonMat(0x3a6a4a));
      g.add(grip); break;
    }
    case 'mic': {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.6, 10), toonMat(0x4a4a5a));
      grip.position.y = 0.2; g.add(grip);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), toonMat(0xffd0e0));
      head.position.y = 0.62; g.add(head); break;
    }
    default: { // pan
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.12, 18), toonMat(0x5a6a7a));
      pan.position.y = 0.75; g.add(pan);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8), toonMat(0x8a4a2a));
      grip.position.y = 0.3; g.add(grip);
    }
  }
  return g;
}

// ---------- full character ----------
export function createMii(cfg, opts={}){
  const g = new THREE.Group();
  const skin = new THREE.Color(SKIN_COLORS[cfg.skin]);
  const jobColor = JOBS[cfg.job]?.color ?? 0x999999;
  const skinMat = toonMat(skin);

  // body (job costume)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.55, 6, 16), toonMat(jobColor));
  body.position.y = 1.0; body.scale.set(1, 1, 0.85);
  g.add(body);
  // belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.14, 16),
    toonMat(new THREE.Color(jobColor).multiplyScalar(0.55)));
  belt.position.y = 0.85; belt.scale.z = 0.85; g.add(belt);

  // head
  const headG = new THREE.Group(); headG.position.y = 2.28; g.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 22), skinMat);
  head.scale.set(0.95, 1, 0.9);
  headG.add(head);
  // face overlay
  const faceTex = makeFaceTexture(cfg);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.012, 28, 22),
    new THREE.MeshBasicMaterial({ map:faceTex, transparent:true, depthWrite:false }));
  face.scale.copy(head.scale);
  face.rotation.y = -Math.PI/2; // u=0.5 → +Z
  headG.add(face);
  // nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skinMat);
  nose.position.set(0, -0.06, 0.92); headG.add(nose);
  // ears
  for (const side of [-1,1]){
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), skinMat);
    ear.position.set(side*0.93, 0, 0); headG.add(ear);
  }
  // hair
  const hair = buildHair(cfg.hairStyle, HAIR_COLORS[cfg.hairColor]);
  hair.scale.set(0.98, 1.02, 0.94);
  headG.add(hair);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.16, 0.5, 4, 10);
  const lArm = new THREE.Group(), rArm = new THREE.Group();
  lArm.position.set(-0.62, 1.45, 0); rArm.position.set(0.62, 1.45, 0);
  for (const [grp, side] of [[lArm,-1],[rArm,1]]){
    const mesh = new THREE.Mesh(armGeo, toonMat(jobColor));
    mesh.position.y = -0.4; grp.add(mesh);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skinMat);
    hand.position.y = -0.78; grp.add(hand);
    grp.rotation.z = side*0.18;
    g.add(grp);
  }
  // legs
  const legGeo = new THREE.CapsuleGeometry(0.17, 0.3, 4, 10);
  const lLeg = new THREE.Group(), rLeg = new THREE.Group();
  lLeg.position.set(-0.26, 0.62, 0); rLeg.position.set(0.26, 0.62, 0);
  for (const grp of [lLeg, rLeg]){
    const mesh = new THREE.Mesh(legGeo, toonMat(0x4a4a5a));
    mesh.position.y = -0.3; grp.add(mesh);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), toonMat(0x8a4a2a));
    shoe.scale.set(1, 0.6, 1.35); shoe.position.set(0, -0.6, 0.08); grp.add(shoe);
    g.add(grp);
  }

  // weapon in right hand
  let weapon = null;
  if (!opts.noWeapon){
    weapon = buildWeapon(JOBS[cfg.job]?.weapon ?? 'sword');
    weapon.position.set(0, -0.78, 0.1);
    weapon.rotation.x = 0.35;
    weapon.scale.setScalar(0.9);
    rArm.add(weapon);
  }

  // soft blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.18, depthWrite:false }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.02;
  g.add(shadow);

  g.userData.parts = { body, headG, head, hair, lArm, rArm, lLeg, rLeg, weapon, face, shadow };
  g.userData.cfg = cfg;
  g.userData.anim = { t: Math.random()*10, state:'idle', hurtT:0 };
  return g;
}

export function setMiiFace(mii, cfg){
  const face = mii.userData.parts.face;
  face.material.map?.dispose();
  face.material.map = makeFaceTexture(cfg);
  face.material.needsUpdate = true;
}

// procedural animation tick — dt in seconds
export function miiTick(mii, dt){
  const a = mii.userData.anim, p = mii.userData.parts;
  a.t += dt;
  const t = a.t;
  switch(a.state){
    case 'walk': {
      const sw = Math.sin(t*9);
      p.lLeg.rotation.x =  sw*0.7; p.rLeg.rotation.x = -sw*0.7;
      p.lArm.rotation.x = -sw*0.5; p.rArm.rotation.x =  sw*0.5;
      p.body.position.y = 1.0 + Math.abs(Math.cos(t*9))*0.06;
      p.headG.position.y = 2.28 + Math.abs(Math.cos(t*9))*0.08;
      p.headG.rotation.z = Math.sin(t*4.5)*0.04;
      break;
    }
    case 'down': {
      mii.rotation.x = Math.min(mii.rotation.x + dt*4, Math.PI/2 * 0.9);
      break;
    }
    case 'sleep': {
      p.headG.rotation.z = 0.35 + Math.sin(t*2)*0.03;
      p.body.position.y = 1.0; break;
    }
    case 'attack': break; // limbs driven externally by battle tweens
    case 'win': {
      const hop = Math.abs(Math.sin(t*6));
      mii.position.y = mii.userData.baseY !== undefined ? mii.userData.baseY + hop*0.5 : hop*0.5;
      p.lArm.rotation.z = -2.6; p.rArm.rotation.z = 2.6;
      break;
    }
    default: { // idle
      p.body.position.y = 1.0 + Math.sin(t*2.4)*0.03;
      p.headG.position.y = 2.28 + Math.sin(t*2.4 + 0.4)*0.045;
      p.lArm.rotation.x = Math.sin(t*2.4)*0.06;
      p.rArm.rotation.x = Math.sin(t*2.4 + 1)*0.06;
      p.lLeg.rotation.x = p.rLeg.rotation.x = 0;
      p.headG.rotation.z *= 0.9;
      if (mii.rotation.x > 0) mii.rotation.x = Math.max(0, mii.rotation.x - dt*4);
    }
  }
  if (a.hurtT > 0){
    a.hurtT -= dt;
    mii.position.x += Math.sin(a.hurtT*60)*0.02;
  }
}

export function setMiiState(mii, state){
  const a = mii.userData.anim;
  if (a.state === state) return;
  a.state = state;
  const p = mii.userData.parts;
  p.lLeg.rotation.x = p.rLeg.rotation.x = 0;
  p.lArm.rotation.set(0,0,-0.18); p.rArm.rotation.set(0,0,0.18);
  if (state !== 'down') mii.rotation.x = 0;
}
