// ===== turn-based battle (Miitopia-style quirks & bonds) =====
import * as THREE from 'three';
import { addLights, makeSky, makeBattleStage, makeParticles, particlesTick, skyTick } from './scenes.js';
import { createMii, miiTick, setMiiState } from './mii.js';
import { createMonster, monsterTick } from './monsters.js';
import { G, aliveParty, memberSkills, gainExp, addKizuna, kizLevel, addFood } from './state.js';
import { PERSONALITIES, FOODS, JOBS, pick, randi, rand } from './data.js';
import { $, toast, popText, popBubble, popupsTick, updatePartyBar, pulseCard, showBanner } from './ui.js';
import { SFX, playSong } from './audio.js';

const spd = () => G.battleSpeed;
const wait = s => new Promise(r => setTimeout(r, s*1000/spd()));

let anims = [];
function animate(dur, fn){
  return new Promise(res => anims.push({ t:0, dur, fn, res }));
}
function animsTick(dt){
  for (let i=anims.length-1; i>=0; i--){
    const a = anims[i];
    a.t += dt;
    const k = Math.min(1, a.t/a.dur);
    a.fn(k);
    if (k >= 1){ anims.splice(i,1); a.res(); }
  }
}
const easeOut = k => 1-(1-k)*(1-k);
const easeIn  = k => k*k;

// ---------- 3D FX ----------
function burst(scene, pos, color=0xffd76e, n=14, size=0.24, speed=5){
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n*3);
  const vel = [];
  for (let i=0;i<n;i++){
    p[i*3]=pos.x; p[i*3+1]=pos.y; p[i*3+2]=pos.z;
    const a = Math.random()*Math.PI*2, e = Math.random()*Math.PI - Math.PI/2;
    vel.push(new THREE.Vector3(Math.cos(a)*Math.cos(e), Math.sin(e)+0.7, Math.sin(a)*Math.cos(e)).multiplyScalar(speed*(0.4+Math.random()*0.6)));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent:true, opacity:1 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  animate(0.6, k => {
    const attr = pts.geometry.attributes.position;
    for (let i=0;i<n;i++){
      attr.setXYZ(i,
        pos.x + vel[i].x*k*0.6,
        pos.y + vel[i].y*k*0.6 - 4*k*k*0.6,
        pos.z + vel[i].z*k*0.6);
    }
    attr.needsUpdate = true;
    mat.opacity = 1-k;
  }).then(()=>{ scene.remove(pts); geo.dispose(); mat.dispose(); });
}

function makeHpBar(){
  const c = document.createElement('canvas'); c.width=128; c.height=20;
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
  spr.scale.set(2.2, 0.36, 1);
  spr.renderOrder = 50;
  spr.userData.draw = ratio => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,128,20);
    ctx.fillStyle = 'rgba(30,30,50,.6)';
    ctx.beginPath(); ctx.roundRect(0,0,128,20,10); ctx.fill();
    ctx.fillStyle = ratio>0.5 ? '#6ee06e' : ratio>0.25 ? '#ffd06e' : '#ff7a6e';
    if (ratio>0) { ctx.beginPath(); ctx.roundRect(3,3,122*Math.max(0.02,ratio),14,7); ctx.fill(); }
    tex.needsUpdate = true;
  };
  spr.userData.draw(1);
  return spr;
}

// ---------- battle ----------
let activeBattle = null;
export const getActiveBattle = () => activeBattle;

export function runBattle(opts, ctx){
  return new Promise(resolve => {
    const b = new Battle(opts, ctx, r => { activeBattle = null; resolve(r); });
    activeBattle = b;
    b.start();
  });
}

class Battle {
  constructor(opts, ctx, resolve){
    this.opts = opts; this.ctx = ctx; this.resolve = resolve;
    this.over = false;
    this.usedItemThisTurn = false;
    this.extraFood = 0;
    this.shake = 0;
  }

  start(){
    const { biome, defs } = this.opts;
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color().setHex(
      { grass:0xcfeeff, desert:0xffe0b0, snow:0xdae8f8, dark:0x3a2a58 }[biome]), 40, 150);
    addLights(scene, biome);
    this.sky = makeSky(biome); scene.add(this.sky);
    scene.add(makeBattleStage(biome));
    this.particles = makeParticles(biome); scene.add(this.particles);

    const camera = this.camera = new THREE.PerspectiveCamera(44, innerWidth/innerHeight, 0.1, 400);

    // party units (right side, facing -X)
    this.pUnits = G.party.map((m, i) => {
      const mesh = createMii(m.cfg);
      mesh.scale.setScalar(0.72);
      const z = [-3.2, -1.1, 1.1, 3.2][i] ?? 0;
      mesh.position.set(4.2 + Math.abs(z)*0.18, 0, z);
      mesh.rotation.y = -Math.PI/2 + 0.42; // slightly toward camera

      if (m.hp <= 0){ setMiiState(mesh, 'down'); }
      scene.add(mesh);
      return { side:'p', m, mesh, home:mesh.position.clone(), status:{}, buffs:{ atk:0, def:0, turns:0 } };
    });

    // enemy units (left side, facing +X)
    const lvl = this.opts.lvl ?? 1;
    const towerMul = this.opts.towerMul ?? 1;
    this.eUnits = defs.map((def, i) => {
      const mesh = createMonster(def);
      const z = defs.length===1 ? 0 : [-3.2, 0.2, 3.4][i] ?? (i*3-3);
      mesh.position.set(-4.2 - (i%2)*0.8, 0, z);
      mesh.rotation.y = Math.PI/2 - 0.42; // slightly toward camera
      mesh.userData.baseY = 0;
      scene.add(mesh);
      const mul = towerMul;
      const u = { side:'e', def, mesh,
        name: def.name,
        hp: Math.round(def.hp*mul), maxHp: Math.round(def.hp*mul),
        stats: { atk:Math.round(def.atk*mul), def:Math.round(def.def*mul), spd:def.spd, mag:Math.round(def.atk*mul*0.8) },
        status:{}, buffs:{ atk:0, def:0, turns:0 },
        home: mesh.position.clone() };
      const bar = makeHpBar();
      bar.position.set(0, (def.boss?3.4:2.9), 0);
      mesh.add(bar);
      u.bar = bar;
      return u;
    });

    // ticking
    this.handle = {
      scene, camera,
      tick: dt => {
        const d = dt*spd();
        animsTick(d);
        for (const u of this.pUnits) miiTick(u.mesh, d);
        for (const u of this.eUnits) if (u.hp>0) monsterTick(u.mesh, d);
        skyTick(this.sky, d);
        particlesTick(this.particles, d, 0);
        popupsTick(d);
        const portrait = camera.aspect < 1;
        const wantFov = portrait ? 58 : 44;
        if (camera.fov !== wantFov){ camera.fov = wantFov; camera.updateProjectionMatrix(); }
        const cy = portrait ? 9.5 : 6.2, cz = portrait ? 26 : 15;
        if (this.shake > 0){
          this.shake = Math.max(0, this.shake - d*3);
          camera.position.set(rand(-1,1)*this.shake*0.3, cy + rand(-1,1)*this.shake*0.2, cz);
        } else {
          camera.position.set(0, cy, cz);
        }
        camera.lookAt(0, 2, 0);
      },
      onTap: hit => this.onCanvasTap(hit),
    };
    this.ctx.setActive(this.handle);

    playSong(this.opts.boss ? 'boss' : 'battle');
    showBanner(this.opts.boss ? '⚔️ ボスバトル！！' : '⚔️ バトル！', defs.map(d=>d.name).join('・'));
    $('#itemrow').classList.remove('hidden');
    $('#battletools').classList.remove('hidden');
    this.ctx.updateHud();

    this.loop();
  }

  // ========== main turn loop ==========
  async loop(){
    await wait(1.0);
    let round = 0;
    while (!this.over){
      round++;
      const units = [...this.pUnits.filter(u=>u.m.hp>0), ...this.eUnits.filter(u=>u.hp>0)];
      units.sort((a,b)=> this.spdOf(b)*rand(0.8,1.25) - this.spdOf(a)*rand(0.8,1.25));
      for (const u of units){
        if (this.over) break;
        if (u.side==='p' ? u.m.hp<=0 : u.hp<=0) continue;
        await this.takeTurn(u);
        if (this.checkEnd()) break;
        await wait(0.25);
      }
      if (round > 60) break; // safety
    }
  }

  spdOf(u){ return u.side==='p' ? u.m.stats.spd : u.stats.spd; }
  atkOf(u){ return (u.side==='p' ? u.m.stats.atk : u.stats.atk) * (1 + (u.buffs.atk||0)); }
  magOf(u){ return (u.side==='p' ? u.m.stats.mag : u.stats.mag) * (1 + (u.buffs.atk||0)); }
  defOf(u){ return (u.side==='p' ? u.m.stats.def : u.stats.def) * (1 + (u.buffs.def||0)); }
  hpOf(u){ return u.side==='p' ? u.m.hp : u.hp; }
  nameOf(u){ return u.side==='p' ? u.m.cfg.name : u.name; }
  posOf(u){ return u.mesh.position; }
  aliveE(){ return this.eUnits.filter(u=>u.hp>0); }
  aliveP(){ return this.pUnits.filter(u=>u.m.hp>0); }

  checkEnd(){
    if (this.over) return true;
    if (this.aliveE().length === 0){ this.over = true; this.victory(); return true; }
    if (this.aliveP().length === 0){ this.over = true; this.defeat(); return true; }
    return false;
  }

  async takeTurn(u){
    // status: skip turns
    if (u.status.charm > 0){
      u.status.charm--;
      popBubble(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3.4,0)), '💕');
      await wait(0.6);
      return;
    }
    if (u.status.laugh > 0){
      u.status.laugh--;
      SFX.laugh();
      popBubble(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3.4,0)), '🤣');
      await wait(0.6);
      return;
    }
    if (u.buffs.turns > 0){
      u.buffs.turns--;
      if (u.buffs.turns === 0){ u.buffs.atk = 0; u.buffs.def = 0; }
    }

    if (u.side === 'e') return this.enemyTurn(u);

    // personality: nonki nap
    const pers = u.m.cfg.personality;
    if (pers === 'nonki' && Math.random() < 0.11){
      setMiiState(u.mesh, 'sleep');
      popBubble(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3.2,0)), '💤');
      const heal = Math.ceil(u.m.stats.hp*0.15);
      u.m.hp = Math.min(u.m.stats.hp, u.m.hp + heal);
      popText(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,2.4,0)), '+'+heal, { color:'#8ee08a' });
      toast(`😪 ${u.m.cfg.name}は すやすや… HPかいふく！`);
      this.ctx.updateHud();
      await wait(0.9);
      setMiiState(u.mesh, 'idle');
      return;
    }
    // ochame prank
    if (pers === 'ochame' && Math.random() < 0.13 && this.aliveE().length){
      const t = pick(this.aliveE());
      SFX.laugh();
      toast(`🤪 ${u.m.cfg.name}の いたずら！ ${t.name}は わらいだした！`);
      t.status.laugh = 1;
      popBubble(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,3.4,0)), '🤣');
      await wait(0.9);
      return;
    }

    const isHero = u === this.pUnits[0];
    if (isHero && !G.auto){
      await this.playerCommand(u);
    } else {
      await this.aiAct(u);
    }
  }

  // ========== player command UI ==========
  playerCommand(u){
    return new Promise(res => {
      this.cmdResolve = async action => {
        this.hideCmd();
        await this.doAction(u, action);
        res();
      };
      this.cmdUnit = u;
      const cmd = $('#cmd');
      cmd.innerHTML = '';
      const atk = document.createElement('button');
      atk.className = 'cbtn atk';
      atk.innerHTML = 'たたかう<small>ぶきでこうげき</small>';
      atk.addEventListener('pointerdown', async e => {
        e.stopPropagation(); SFX.tap();
        const target = await this.pickTarget();
        if (target) this.cmdResolve({ kind:'attack', target });
      });
      cmd.appendChild(atk);

      const skills = memberSkills(u.m);
      const skl = document.createElement('button');
      skl.className = 'cbtn skl' + (skills.length ? '' : ' disabled');
      skl.innerHTML = 'スキル<small>MPをつかう</small>';
      skl.addEventListener('pointerdown', e => {
        e.stopPropagation(); SFX.tap();
        this.showSkillMenu(u, skills);
      });
      cmd.appendChild(skl);

      const chr = document.createElement('button');
      chr.className = 'cbtn chr';
      chr.innerHTML = 'おうえん<small>MPすこしかいふく</small>';
      chr.addEventListener('pointerdown', e => {
        e.stopPropagation(); SFX.tap();
        this.cmdResolve({ kind:'cheer' });
      });
      cmd.appendChild(chr);

      cmd.classList.remove('hidden');
    });
  }

  hideCmd(){
    $('#cmd').classList.add('hidden');
    $('#skillmenu').classList.add('hidden');
    this.targeting = null;
  }

  showSkillMenu(u, skills){
    const menu = $('#skillmenu');
    menu.innerHTML = '';
    for (const sk of skills){
      const b = document.createElement('button');
      b.className = 'skbtn' + (u.m.mp < sk.mp ? ' off' : '');
      b.innerHTML = `<span>${sk.name}<br><small style="font-weight:normal;color:#8a9ab0">${sk.desc}</small></span><span class="mp">MP${sk.mp}</span>`;
      b.addEventListener('pointerdown', async e => {
        e.stopPropagation(); SFX.tap();
        menu.classList.add('hidden');
        let target = null;
        if (sk.type==='atk' || sk.type==='steal'){
          target = await this.pickTarget();
          if (!target) { menu.classList.remove('hidden'); return; }
        }
        this.cmdResolve({ kind:'skill', skill:sk, target });
      });
      menu.appendChild(b);
    }
    const cancel = document.createElement('button');
    cancel.className = 'skbtn cancel';
    cancel.textContent = 'とじる';
    cancel.addEventListener('pointerdown', e => {
      e.stopPropagation(); SFX.cancel();
      menu.classList.add('hidden');
    });
    menu.appendChild(cancel);
    menu.classList.remove('hidden');
  }

  pickTarget(){
    const es = this.aliveE();
    if (es.length <= 1) return Promise.resolve(es[0] ?? null);
    toast('🎯 てきをタップ！');
    return new Promise(res => {
      this.targeting = { res };
      // pulsing markers
      for (const e of es){
        const marker = popText(this.scene, this.posOf(e).clone().add(new THREE.Vector3(0,4,0)), '🔻', { size:1.2, up:0, life:8 });
        (this.targeting.markers ??= []).push(marker);
      }
    });
  }

  onCanvasTap(ray){
    if (!this.targeting) return;
    const es = this.aliveE();
    // nearest enemy to ray
    let best = null, bestD = 3.2;
    for (const e of es){
      const p = this.posOf(e).clone().add(new THREE.Vector3(0,1.5,0));
      const d = ray.distanceToPoint(p);
      if (d < bestD){ bestD = d; best = e; }
    }
    if (best){
      SFX.tap();
      const t = this.targeting;
      this.targeting = null;
      for (const mk of t.markers ?? []) mk.material.opacity = 0;
      t.res(best);
    }
  }

  // ========== item use (during battle, any time hero commands shown) ==========
  useItem(kind){
    if (this.over) return;
    if (kind==='banana'){
      if (G.inv.banana <= 0) { toast('🍌 バナナがない…'); return; }
      // weakest (or downed) member
      const cand = [...this.pUnits].sort((a,b)=> (a.m.hp/a.m.stats.hp) - (b.m.hp/b.m.stats.hp))[0];
      if (!cand) return;
      G.inv.banana--;
      const wasDown = cand.m.hp <= 0;
      const heal = Math.ceil(cand.m.stats.hp*0.5);
      cand.m.hp = Math.min(cand.m.stats.hp, Math.max(0, cand.m.hp) + heal);
      if (wasDown){ setMiiState(cand.mesh, 'idle'); toast(`🍌 ${cand.m.cfg.name}が ふっかつ！`); }
      SFX.heal();
      burst(this.scene, this.posOf(cand).clone().add(new THREE.Vector3(0,2,0)), 0xffe36e, 12, 0.2, 3);
      popText(this.scene, this.posOf(cand).clone().add(new THREE.Vector3(0,2.6,0)), '+'+heal, { color:'#8ee08a' });
    } else {
      if (G.inv.candy <= 0) { toast('🍬 キャンディがない…'); return; }
      const cand = [...this.aliveP()].sort((a,b)=> (a.m.mp/a.m.stats.mp) - (b.m.mp/b.m.stats.mp))[0];
      if (!cand) return;
      G.inv.candy--;
      const heal = Math.ceil(cand.m.stats.mp*0.4);
      cand.m.mp = Math.min(cand.m.stats.mp, cand.m.mp + heal);
      SFX.heal();
      popText(this.scene, this.posOf(cand).clone().add(new THREE.Vector3(0,2.6,0)), '+'+heal+'MP', { color:'#8ac6ff' });
    }
    this.ctx.updateHud();
  }

  // ========== actions ==========
  async doAction(u, action){
    switch(action.kind){
      case 'attack': await this.physAttack(u, action.target, 1.0); break;
      case 'cheer': {
        const mp = Math.ceil(u.m.stats.mp*0.25);
        u.m.mp = Math.min(u.m.stats.mp, u.m.mp + mp);
        SFX.charm();
        popText(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,2.8,0)), '+'+mp+'MP', { color:'#8ac6ff' });
        popBubble(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3.6,0)), '📣');
        this.ctx.updateHud();
        await wait(0.6);
        break;
      }
      case 'skill': await this.useSkill(u, action.skill, action.target); break;
    }
    // kizuna follow-up
    if ((action.kind==='attack') && !this.over && this.aliveE().length){
      await this.maybeFollowup(u);
    }
    // ganbariya extra attack
    if (u.side==='p' && u.m.cfg.personality==='ganbariya' && action.kind==='attack'
        && !this.over && this.aliveE().length && Math.random() < 0.15){
      toast(`🔥 ${u.m.cfg.name}は もえてきた！ もういっかい！`);
      await wait(0.3);
      await this.physAttack(u, pick(this.aliveE()), 0.7);
    }
  }

  async maybeFollowup(u){
    const partners = this.aliveP().filter(p => p!==u);
    for (const p of partners){
      const lv = kizLevel(u.m, p.m);
      if (lv >= 1 && Math.random() < 0.08*lv){
        toast(`💕 ${p.m.cfg.name}も つづいて こうげき！`);
        popBubble(this.scene, this.posOf(p).clone().add(new THREE.Vector3(0,3.4,0)), '💕');
        await wait(0.25);
        if (this.aliveE().length) await this.physAttack(p, pick(this.aliveE()), 0.6);
        break;
      }
    }
  }

  async physAttack(u, target, mult, opts={}){
    if (!target || this.hpOf(target)<=0){ target = u.side==='p' ? this.aliveE()[0] : this.aliveP()[0]; }
    if (!target) return;
    const mesh = u.mesh;
    const from = u.home.clone();
    const dir = u.side==='p' ? -1 : 1;
    const to = this.posOf(target).clone().add(new THREE.Vector3(-dir*2.2, 0, 0));
    if (u.side==='p') setMiiState(mesh, 'attack');

    await animate(0.28, k => {
      mesh.position.lerpVectors(from, to, easeOut(k));
      mesh.position.y = Math.sin(k*Math.PI)*0.8;
    });
    // swing
    if (u.side==='p'){
      const arm = mesh.userData.parts.rArm;
      await animate(0.16, k => { arm.rotation.x = -2.2*Math.sin(k*Math.PI); });
    } else {
      await animate(0.14, k => { mesh.rotation.z = dir*0.4*Math.sin(k*Math.PI); });
    }
    this.dealDamage(u, target, mult, { magic:false, ...opts });
    await wait(0.3);
    await animate(0.24, k => {
      mesh.position.lerpVectors(to, from, easeIn(k));
    });
    mesh.position.copy(u.home);
    if (u.side==='p') setMiiState(mesh, 'idle');
  }

  dealDamage(atkU, defU, mult, { magic=false, fx=null, noMiss=false } = {}){
    if (this.hpOf(defU) <= 0) return 0;
    // cool dodge
    if (defU.side==='p' && defU.m.cfg.personality==='cool' && !noMiss && Math.random()<0.14){
      SFX.charm();
      popText(this.scene, this.posOf(defU).clone().add(new THREE.Vector3(0,2.8,0)), 'ヒラリ！', { color:'#bfe0ff', size:.9 });
      toast(`😎 ${defU.m.cfg.name}は クールに かわした！`);
      return 0;
    }
    const base = magic ? this.magOf(atkU)*mult - this.defOf(defU)*0.25
                       : this.atkOf(atkU)*mult - this.defOf(defU)*0.45;
    let critRate = 0.08 + (atkU.side==='p' && atkU.m.cfg.personality==='cool' ? 0.08 : 0);
    const crit = Math.random() < critRate;
    let dmg = Math.max(1, Math.round(base * rand(0.85,1.15) * (crit?1.7:1)));

    if (defU.side==='p'){
      defU.m.hp = Math.max(0, defU.m.hp - dmg);
      pulseCard(defU.m.id);
      if (defU.m.hp <= 0){
        SFX.down();
        setMiiState(defU.mesh, 'down');
        toast(`😵 ${defU.m.cfg.name}は たおれてしまった！`);
      }
    } else {
      defU.hp = Math.max(0, defU.hp - dmg);
      defU.bar.userData.draw(defU.hp/defU.maxHp);
      if (defU.hp <= 0) this.killEnemy(defU);
    }
    // fx
    (crit ? SFX.crit : SFX.hit)();
    this.shake = crit ? 1.6 : 0.8;
    burst(this.scene, this.posOf(defU).clone().add(new THREE.Vector3(0,1.6,0)),
      magic ? 0x9a6aff : (crit ? 0xff5a3c : 0xffd76e), crit?22:14);
    popText(this.scene, this.posOf(defU).clone().add(new THREE.Vector3(rand(-.5,.5),2.6,0)),
      String(dmg) + (crit?'!!':''), { color: crit ? '#ffde4d' : '#fff', size: crit?1.5:1.1 });
    if (defU.side==='p' && this.hpOf(defU)>0){
      defU.mesh.userData.anim.hurtT = 0.3;
    }
    this.ctx.updateHud();
    return dmg;
  }

  killEnemy(e){
    SFX.down();
    const mesh = e.mesh;
    // stolen face flies home!
    if (mesh.userData.faceMesh){
      const face = mesh.userData.faceMesh;
      const wp = new THREE.Vector3();
      face.getWorldPosition(wp);
      this.scene.attach(face);
      const start = wp.clone();
      animate(1.2, k => {
        face.position.set(start.x, start.y + k*10, start.z);
        face.material.opacity = 1-k*0.7;
        face.scale.setScalar(1+k*0.6);
      }).then(()=> this.scene.remove(face));
      toast('😀 ぬすまれた かおが とんでいった！', 'love');
      this.facesFreed = (this.facesFreed||0) + 1;
    }
    animate(0.5, k => {
      mesh.scale.setScalar(Math.max(0.01, (e.def.boss?1.8:1)*(1-k)));
      mesh.rotation.y += 0.3;
    }).then(()=> { this.scene.remove(mesh); });
    burst(this.scene, this.posOf(e).clone().add(new THREE.Vector3(0,1.5,0)), 0xffffff, 20, 0.3, 6);
  }

  async useSkill(u, sk, target){
    if (u.m.mp < sk.mp) return;
    u.m.mp -= sk.mp;
    this.ctx.updateHud();
    popBubble(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3.6,0)), '✨');
    toast(`${JOBS[u.m.cfg.job].emoji} ${u.m.cfg.name}の「${sk.name}」！`);
    await wait(0.3);

    switch(sk.type){
      case 'atk': {
        if (sk.magic){
          await this.castProjectile(u, target, sk);
          this.dealDamage(u, target, sk.pow, { magic:true });
        } else {
          const hits = sk.hits ?? 1;
          for (let i=0;i<hits;i++){
            if (this.hpOf(target)<=0) break;
            await this.physAttack(u, target, sk.pow);
          }
          if (sk.foodChance && Math.random() < sk.foodChance) this.extraFood++;
        }
        break;
      }
      case 'atkAll': {
        SFX[sk.fx==='thunder'?'thunder':sk.fx==='fire'?'fire':'magic']?.();
        this.shake = 1.4;
        for (const e of this.aliveE()){
          burst(this.scene, this.posOf(e).clone().add(new THREE.Vector3(0,1.8,0)),
            sk.fx==='thunder' ? 0xfff2a0 : sk.fx==='wind' ? 0xa0ffd0 : 0xff9a5a, 16);
          this.dealDamage(u, e, sk.pow, { magic: !!sk.magic });
          await wait(0.14);
        }
        break;
      }
      case 'heal': {
        const t = [...this.aliveP()].sort((a,b)=> a.m.hp/a.m.stats.hp - b.m.hp/b.m.stats.hp)[0];
        this.healUnit(u, t, sk.pow);
        if (sk.buff){ t.buffs.atk += sk.bpow ?? .3; t.buffs.turns = Math.max(t.buffs.turns,3); }
        await wait(0.5);
        break;
      }
      case 'healAll': {
        SFX.heal();
        for (const t of this.aliveP()) this.healUnit(u, t, sk.pow, true);
        if (sk.foodChance) this.extraFood++;
        await wait(0.6);
        break;
      }
      case 'revive': {
        const t = this.pUnits.find(p => p.m.hp<=0);
        if (t){
          t.m.hp = Math.ceil(t.m.stats.hp*sk.pow);
          setMiiState(t.mesh, 'idle');
          SFX.levelup();
          burst(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,2,0)), 0xfff2a0, 20, 0.3, 4);
          toast(`✨ ${t.m.cfg.name}が ふっかつした！`);
        } else {
          this.healUnit(u, pick(this.aliveP()), 1.5);
        }
        await wait(0.6);
        break;
      }
      case 'buff': {
        SFX.charm();
        for (const t of this.aliveP()){
          t.buffs[sk.buff] += sk.pow;
          t.buffs.turns = Math.max(t.buffs.turns, 3);
          popText(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,2.8,0)),
            (sk.buff==='atk'?'⚔️':'🛡')+'UP', { color:'#ffd76e', size:.9 });
        }
        await wait(0.6);
        break;
      }
      case 'charm': {
        SFX.charm();
        const t = target ?? pick(this.aliveE());
        if (t && Math.random() < 0.75){
          t.status.charm = randi(1,2);
          popBubble(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,3.4,0)), '💕', { size:1.6 });
          toast(`💕 ${t.name}は メロメロになった！`);
        } else if (t){
          toast(`…${t.name}には きかなかった！`);
        }
        await wait(0.6);
        break;
      }
      case 'steal': {
        await this.physAttack(u, target, sk.pow);
        const g = randi(4, 10);
        G.gold += g;
        SFX.coin();
        popText(this.scene, this.posOf(u).clone().add(new THREE.Vector3(0,3,0)), `+${g}G`, { color:'#ffd76e' });
        if (Math.random()<0.5) this.extraFood++;
        break;
      }
      case 'hybrid': {
        SFX.magic();
        this.shake = 1.2;
        for (const e of this.aliveE()){
          burst(this.scene, this.posOf(e).clone().add(new THREE.Vector3(0,1.8,0)), 0xffb8f0, 16);
          this.dealDamage(u, e, sk.pow, { magic:true });
          await wait(0.12);
        }
        for (const t of this.aliveP()) this.healUnit(u, t, sk.heal, true);
        await wait(0.4);
        break;
      }
    }
    this.ctx.updateHud();
  }

  healUnit(u, t, pow, quiet=false){
    if (!t || t.m.hp<=0) return;
    const amt = Math.ceil(this.magOf(u)*pow + rand(0,4));
    t.m.hp = Math.min(t.m.stats.hp, t.m.hp + amt);
    if (!quiet) SFX.heal();
    burst(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,2,0)), 0x8ee08a, 10, 0.2, 2.5);
    popText(this.scene, this.posOf(t).clone().add(new THREE.Vector3(0,2.8,0)), '+'+amt, { color:'#8ee08a' });
    this.ctx.updateHud();
  }

  async castProjectile(u, target, sk){
    const color = sk.fx==='fire' ? 0xff7a3c : sk.fx==='meteor' ? 0xff5a8a : 0x9a6aff;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(sk.fx==='meteor'?0.55:0.3, 12, 10),
      new THREE.MeshBasicMaterial({ color }));
    const from = this.posOf(u).clone().add(new THREE.Vector3(0,2.2,0));
    const to = this.posOf(target).clone().add(new THREE.Vector3(0,1.6,0));
    orb.position.copy(from);
    this.scene.add(orb);
    SFX[sk.fx==='fire'?'fire':'magic']?.();
    await animate(0.45, k => {
      orb.position.lerpVectors(from, to, k);
      orb.position.y += Math.sin(k*Math.PI)*(sk.fx==='meteor'?5:2);
    });
    this.scene.remove(orb);
    burst(this.scene, to, color, sk.fx==='meteor'?26:16, 0.3, 6);
    this.shake = sk.fx==='meteor' ? 2 : 1;
  }

  // ========== AI ==========
  async aiAct(u){
    const m = u.m;
    const skills = memberSkills(m).filter(s => m.mp >= s.mp);
    const hurt = [...this.aliveP()].sort((a,b)=> a.m.hp/a.m.stats.hp - b.m.hp/b.m.stats.hp)[0];
    const downed = this.pUnits.find(p=>p.m.hp<=0);

    // healer logic
    const revive = skills.find(s=>s.type==='revive');
    if (revive && downed){ await this.useSkill(u, revive, null); return; }
    const healAll = skills.find(s=>s.type==='healAll');
    if (healAll && this.aliveP().filter(p=>p.m.hp/p.m.stats.hp<0.55).length >= 2){
      await this.useSkill(u, healAll, null); return;
    }
    const heal = skills.find(s=>s.type==='heal');
    if (heal && hurt && hurt.m.hp/hurt.m.stats.hp < 0.45){
      await this.useSkill(u, heal, null); return;
    }
    // offensive / support
    if (skills.length && Math.random() < 0.55){
      const sk = pick(skills.filter(s=>!['heal','healAll','revive'].includes(s.type)));
      if (sk){
        const target = (sk.type==='atk'||sk.type==='steal') ? pick(this.aliveE()) : null;
        await this.doAction(u, { kind:'skill', skill:sk, target });
        return;
      }
    }
    await this.doAction(u, { kind:'attack', target: pick(this.aliveE()) });
  }

  async enemyTurn(e){
    await wait(0.2);
    const isBoss = !!e.def.boss;
    if (isBoss && Math.random() < 0.3){
      // AoE rampage
      toast(`👹 ${e.name}の おおあばれ！！`);
      this.shake = 2;
      SFX.thunder();
      await animate(0.3, k => { e.mesh.position.y = Math.sin(k*Math.PI)*1.6; });
      for (const p of this.aliveP()){
        this.dealDamage(e, p, 0.65);
        await wait(0.12);
      }
      return;
    }
    const target = pick(this.aliveP());
    if (!target) return;
    await this.physAttack(e, target, 1.0);
  }

  // ========== outcomes ==========
  async victory(){
    this.hideCmd();
    $('#itemrow').classList.add('hidden');
    $('#battletools').classList.add('hidden');
    playSong(null); SFX.fanfare();
    for (const u of this.aliveP()){ setMiiState(u.mesh, 'win'); u.mesh.userData.baseY = 0; }
    await wait(1.4);

    // rewards
    const defs = this.opts.defs;
    const towerMul = this.opts.towerMul ?? 1;
    const exp = Math.round(defs.reduce((s,d)=>s+d.exp,0) * towerMul);
    const gold = Math.round(defs.reduce((s,d)=>s+d.gold,0) * towerMul);
    G.gold += gold;

    // food drops
    const foods = [];
    let drops = (Math.random()<0.6 ? 1 : 0) + this.extraFood;
    for (let i=0;i<drops;i++){
      const roll = Math.random();
      const rar = roll<0.55 ? 1 : roll<0.9 ? 2 : 3;
      const cands = Object.keys(FOODS).filter(k=>FOODS[k].rar===rar);
      const key = pick(cands);
      addFood(key);
      foods.push(key);
    }

    // kizuna for fighting together
    const alive = aliveParty();
    const kizMsgs = [];
    for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++){
      const lv = addKizuna(alive[i], alive[j], this.opts.boss ? 8 : 4);
      if (lv) kizMsgs.push(`💕 ${alive[i].cfg.name}と${alive[j].cfg.name}の きずなが Lv${lv}に！`);
    }

    // exp + level ups
    const lvMsgs = [];
    for (const m of alive){
      const ups = gainExp(m, exp);
      for (const up of ups){
        SFX.levelup();
        lvMsgs.push(`<span class="lvup">⬆️ ${m.cfg.name}は レベル${up.lv}に あがった！</span>`);
      }
    }
    this.ctx.updateHud();

    // result overlay
    const rows = $('#resultRows');
    $('#resultTitle').textContent = this.opts.boss ? '🏆 ボスに しょうり！！' : '✨ しょうり！ ✨';
    rows.innerHTML = [
      `もらった経験値: <b>${exp} EXP</b>`,
      `ゴールド: <b>+${gold} G</b>`,
      ...(this.facesFreed ? [`😀 とりもどした かお: <b>${this.facesFreed}こ</b>`] : []),
      ...foods.map(k => `たべものゲット: <b>${FOODS[k].emoji} ${FOODS[k].name}</b>`),
      ...kizMsgs,
      ...lvMsgs,
    ].map(s=>`<div>${s}</div>`).join('');

    await new Promise(res => {
      const btn = $('#btnResultOk');
      const h = e => { e.stopPropagation(); SFX.confirm(); btn.removeEventListener('pointerdown', h);
        $('#result').classList.add('hidden'); res(); };
      btn.addEventListener('pointerdown', h);
      $('#result').classList.remove('hidden');
    });
    this.resolve('win');
  }

  async defeat(){
    this.hideCmd();
    $('#itemrow').classList.add('hidden');
    $('#battletools').classList.add('hidden');
    playSong(null); SFX.down();
    await wait(1.2);
    const lost = Math.floor(G.gold/2);
    G.gold -= lost;
    for (const m of G.party){ m.hp = Math.max(1, Math.ceil(m.stats.hp*0.3)); m.mp = Math.ceil(m.stats.mp*0.3); }
    const rows = $('#resultRows');
    $('#resultTitle').textContent = '😵 ぜんめつ…';
    rows.innerHTML = `<div>みんな たおれてしまった…</div>
      <div>おとしたゴールド: <b>-${lost} G</b></div>
      <div>ようせいが たすけてくれて やどやのちかくまで もどった。</div>`;
    await new Promise(res => {
      const btn = $('#btnResultOk');
      const h = e => { e.stopPropagation(); btn.removeEventListener('pointerdown', h);
        $('#result').classList.add('hidden'); res(); };
      btn.addEventListener('pointerdown', h);
      $('#result').classList.remove('hidden');
    });
    this.ctx.updateHud();
    this.resolve('lose');
  }
}

// item buttons (bound once from main)
export function bindBattleItemButtons(){
  $('#btnBanana').addEventListener('pointerdown', e => {
    e.stopPropagation();
    getActiveBattle()?.useItem('banana');
  });
  $('#btnCandy').addEventListener('pointerdown', e => {
    e.stopPropagation();
    getActiveBattle()?.useItem('candy');
  });
}
