// ===== walking routes: auto-walk + random events =====
import * as THREE from 'three';
import { addLights, makeSky, makeGround, makeProps, makeParticles, particlesTick, skyTick } from './scenes.js';
import { createMii, miiTick, setMiiState, toonMat } from './mii.js';
import { G, aliveParty, addKizuna, addFood, kizKey } from './state.js';
import { FOODS, MONSTERS, pick, randi, rand } from './data.js';
import { $, toast, say, hideDialog, showBanner, popText, popBubble, popupsTick } from './ui.js';
import { SFX, playSong } from './audio.js';

const WALK_SPEED = 3.4;
const EVENT_GAP = 26;

function buildEventList(route, area){
  const events = [];
  for (let i=0;i<route.battles;i++) events.push({ kind:'battle' });
  const extras = ['chest','spring','food','traveler','butterfly'];
  const nExtra = randi(2,3);
  for (let i=0;i<nExtra;i++) events.push({ kind: pick(extras) });
  // shuffle
  for (let i=events.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [events[i],events[j]] = [events[j],events[i]];
  }
  if (route.boss) events.push({ kind:'boss' });
  events.forEach((e,i)=> e.z = -(i+1)*EVENT_GAP);
  return events;
}

export async function runRoute(route, area, ctx){
  const biome = area.biome;
  const events = buildEventList(route, area);
  const endZ = events[events.length-1].z - EVENT_GAP;

  // --- build scene ---
  const scene = new THREE.Scene();
  const b = area.biome;
  scene.fog = new THREE.Fog(new THREE.Color().setHex(
    { grass:0xcfeeff, desert:0xffe0b0, snow:0xdae8f8, dark:0x3a2a58 }[b]), 30, 120);
  addLights(scene, biome);
  const sky = makeSky(biome); scene.add(sky);
  scene.add(makeGround(biome, -endZ + 80));
  scene.add(makeProps(biome, -endZ + 60));
  const particles = makeParticles(biome); scene.add(particles);

  const camera = new THREE.PerspectiveCamera(46, innerWidth/innerHeight, 0.1, 400);

  // party miis in formation
  const miis = [];
  const formation = [ [0,0], [-1.5,1.6], [1.5,1.8], [0,3.2] ];
  G.party.forEach((m, i) => {
    const mii = createMii(m.cfg);
    mii.scale.setScalar(0.62);
    const [fx, fz] = formation[i] ?? [0, 3+i];
    mii.position.set(fx, 0, fz);
    mii.rotation.y = Math.PI; // walk toward -Z... mii faces +Z; rotate to face -Z
    setMiiState(mii, m.hp>0 ? 'walk' : 'idle');
    if (m.hp<=0) mii.visible = false;
    scene.add(mii);
    miis.push({ mii, m, fx, fz });
  });

  let walking = true;
  let progress = 0; // distance walked (positive)
  let stepT = 0;
  let done = false;

  const handle = {
    scene, camera,
    tick(dt){
      if (walking){
        progress += WALK_SPEED*dt;
        stepT += dt;
        if (stepT > 0.34){ stepT = 0; SFX.step(); }
      }
      for (const { mii, m, fx, fz } of miis){
        mii.visible = m.hp > 0;
        mii.position.z = -progress + fz;
        mii.position.x = fx + Math.sin(progress*0.5 + fz)*0.25;
        miiTick(mii, dt);
      }
      const heroZ = -progress;
      const wantFov = camera.aspect < 1 ? 62 : 46;
      if (camera.fov !== wantFov){ camera.fov = wantFov; camera.updateProjectionMatrix(); }
      camera.position.set(Math.sin(progress*0.06)*1.2, 5.4, heroZ + 12.5);
      camera.lookAt(0, 1.6, heroZ - 8);
      sky.position.z = heroZ;
      skyTick(sky, dt);
      particles.position.z = 0;
      particlesTick(particles, dt, heroZ);
      popupsTick(dt);
    },
    onTap(hit){
      // tap = hero hop (and sometimes a coin!)
      if (!walking) return;
      const hero = miis[0];
      if (!hero || hero.m.hp<=0) return;
      SFX.tap();
      const mii = hero.mii;
      popBubble(scene, mii.position.clone().add(new THREE.Vector3(0,2.6,0)), pick(['🎵','😄','✨','🦋']));
      if (Math.random() < 0.12){
        G.gold += 1;
        ctx.updateHud();
        SFX.coin();
        popText(scene, mii.position.clone().add(new THREE.Vector3(0.8,2.2,0)), '+1G', { color:'#ffd76e', size:.9 });
      }
    },
  };
  ctx.setActive(handle);
  playSong(b === 'dark' ? 'dark' : b === 'desert' ? 'desert' : b === 'snow' ? 'snow' : 'grass');
  showBanner(route.name, area.name);
  $('#partybar').style.display = '';

  const waitProgress = target => new Promise(res => {
    const id = setInterval(()=>{
      if (progress >= target || done){ clearInterval(id); res(); }
    }, 60);
  });

  // --- run events in order ---
  for (const ev of events){
    await waitProgress(-ev.z);
    walking = false;
    for (const { mii } of miis) setMiiState(mii, 'idle');
    const alive = await handleEvent(ev, { scene, miis, ctx, route, area, progress: ()=>progress });
    if (!alive){ done = true; return 'lose'; }
    if (ev.kind === 'battle' || ev.kind === 'boss'){
      // battle swapped the active scene — take the stage back
      ctx.setActive(handle);
      $('#itemrow').classList.add('hidden');
      $('#battletools').classList.add('hidden');
      playSong(b === 'dark' ? 'dark' : b === 'desert' ? 'desert' : b === 'snow' ? 'snow' : 'grass');
    }
    walking = true;
    for (const { mii, m } of miis) if (m.hp>0) setMiiState(mii, 'walk');
    ctx.updateHud();
  }
  await waitProgress(-endZ);
  done = true;
  return 'clear';
}

async function handleEvent(ev, env){
  const { scene, miis, ctx, route, area } = env;
  const heroPos = () => miis[0].mii.position.clone();

  switch(ev.kind){
    case 'battle': {
      const n = randi(1, Math.min(3, route.pool.length+1));
      const defs = [];
      for (let i=0;i<Math.max(1,n);i++) defs.push(MONSTERS[pick(route.pool)]);
      const result = await ctx.runBattle({ defs, biome:area.biome, lvl:route.lvl, towerMul:route.towerMul });
      return result === 'win';
    }
    case 'boss': {
      const bossDef = MONSTERS[route.boss];
      await say('', `👹 ${bossDef.name} が たちふさがった！`);
      hideDialog();
      const minions = route.pool.slice(0,1).map(k=>MONSTERS[k]);
      const result = await ctx.runBattle({ defs:[bossDef, ...(bossDef.name==='だいまおう'?minions:[])],
        biome:area.biome, lvl:route.lvl, boss:true, towerMul:route.towerMul });
      return result === 'win';
    }
    case 'chest': {
      const chest = makeChest();
      chest.position.copy(heroPos()).add(new THREE.Vector3(0, 0, -3.5));
      scene.add(chest);
      SFX.confirm();
      await say('', '✨ たからばこを みつけた！');
      chest.userData.lid.rotation.x = -1.2;
      const roll = Math.random();
      if (roll < 0.4){
        const g = randi(8, 20) + route.lvl*2;
        G.gold += g;
        SFX.coin();
        popText(scene, chest.position.clone().add(new THREE.Vector3(0,2.2,0)), `+${g}G`, { color:'#ffd76e', size:1.2 });
        await say('', `💰 ${g}ゴールドが はいっていた！`);
      } else if (roll < 0.7){
        G.inv.banana++;
        SFX.eat();
        await say('', '🍌 HPバナナを てにいれた！');
      } else if (roll < 0.85){
        G.inv.candy++;
        SFX.eat();
        await say('', '🍬 MPキャンディを てにいれた！');
      } else {
        const key = pick(Object.keys(FOODS));
        addFood(key);
        SFX.eat();
        await say('', `${FOODS[key].emoji} 「${FOODS[key].name}」を てにいれた！`);
      }
      hideDialog();
      scene.remove(chest);
      return true;
    }
    case 'spring': {
      const spring = makeSpring();
      spring.position.copy(heroPos()).add(new THREE.Vector3(0, 0, -3.5));
      scene.add(spring);
      SFX.heal();
      await say('', '💧 いやしのいずみだ！ みんな げんきになった！');
      hideDialog();
      for (const m of G.party){
        if (m.hp > 0){
          m.hp = Math.min(m.stats.hp, m.hp + Math.ceil(m.stats.hp*0.5));
          m.mp = Math.min(m.stats.mp, m.mp + Math.ceil(m.stats.mp*0.5));
        }
      }
      for (const { mii, m } of miis) if (m.hp>0)
        popText(scene, mii.position.clone().add(new THREE.Vector3(0,2.8,0)), '✨', { size:1 });
      ctx.updateHud();
      scene.remove(spring);
      return true;
    }
    case 'food': {
      const key = pick(Object.keys(FOODS).filter(k=>FOODS[k].rar<3));
      addFood(key);
      SFX.eat();
      popText(scene, heroPos().add(new THREE.Vector3(0,3,0)), FOODS[key].emoji, { size:1.6 });
      await say(G.party[0].cfg.name, `${FOODS[key].emoji} おちてる…「${FOODS[key].name}」ゲット！`);
      hideDialog();
      return true;
    }
    case 'traveler': {
      return await jankenEvent(env);
    }
    case 'butterfly': {
      const alive = aliveParty();
      if (alive.length >= 2){
        const a = pick(alive); let bm = pick(alive);
        while (bm === a) bm = pick(alive);
        SFX.kizuna();
        popText(scene, heroPos().add(new THREE.Vector3(0,3.2,0)), '🦋', { size:1.5 });
        await say('', `🦋 きれいなチョウチョ！ ${a.cfg.name}と${bm.cfg.name}は いっしょに おいかけた！`);
        const lv = addKizuna(a, bm, 12);
        popText(scene, heroPos().add(new THREE.Vector3(1,2.6,0)), '💕', { size:1.2 });
        if (lv) toast(`💕 ${a.cfg.name}と${bm.cfg.name}の きずなが Lv${lv}に！`, 'love');
      } else {
        await say('', '🦋 チョウチョが とんでいった…');
      }
      hideDialog();
      return true;
    }
  }
  return true;
}

// --- janken (rock paper scissors) with a traveler ---
async function jankenEvent(env){
  const { scene, miis, ctx } = env;
  const traveler = createMii({
    name:'たびびと', skin:randi(0,4), hairStyle:randi(0,5), hairColor:randi(0,7),
    eyes:randi(0,5), brows:randi(0,3), mouth:0, job:'cook', personality:'nonki',
  }, { noWeapon:true });
  traveler.scale.setScalar(0.62);
  traveler.position.copy(miis[0].mii.position).add(new THREE.Vector3(0, 0, -4));
  scene.add(traveler);

  await say('たびびと', 'やあ！ ジャンケンで しょうぶしない？ かったら 15G あげる！まけたら 5G ちょうだいね。');

  const choice = await new Promise(res => {
    const menu = $('#skillmenu');
    menu.innerHTML = '';
    for (const [emoji, name, val] of [['✊','グー',0],['✌️','チョキ',1],['✋','パー',2]]){
      const b = document.createElement('button');
      b.className = 'skbtn';
      b.innerHTML = `<span>${emoji} ${name}</span>`;
      b.addEventListener('pointerdown', e => {
        e.stopPropagation(); SFX.tap();
        menu.classList.add('hidden');
        res(val);
      });
      menu.appendChild(b);
    }
    menu.classList.remove('hidden');
  });

  const cpu = randi(0,2);
  const emo = ['✊','✌️','✋'];
  popText(scene, traveler.position.clone().add(new THREE.Vector3(0,3,0)), emo[cpu], { size:1.6, life:1.6 });
  popText(scene, miis[0].mii.position.clone().add(new THREE.Vector3(0,3,0)), emo[choice], { size:1.6, life:1.6 });
  await new Promise(r=>setTimeout(r, 900));

  if (choice === cpu){
    SFX.laugh();
    await say('たびびと', 'あいこか〜！ また こんど！');
  } else if (cpu === (choice+1)%3){ // ✊beats✌️, ✌️beats✋, ✋beats✊
    G.gold += 15;
    SFX.coin();
    await say('たびびと', `まけた〜！ はい 15G！ きみ つよいね！`);
  } else {
    G.gold = Math.max(0, G.gold - 5);
    SFX.cancel();
    await say('たびびと', 'よゆうの しょうり！ 5G いただき〜！');
  }
  hideDialog();
  ctx.updateHud();
  scene.remove(traveler);
  return true;
}

// --- small props ---
function makeChest(){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), toonMat(0x9a5a2a));
  base.position.y = 0.4; g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.5);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.0), toonMat(0xb06a32));
  lidMesh.position.set(0, 0.25, 0.5); lid.add(lidMesh);
  g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.15), toonMat(0xffd76e));
  lock.position.set(0, 0.75, 0.52); g.add(lock);
  g.userData.lid = lid;
  return g;
}

function makeSpring(){
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 20),
    new THREE.MeshToonMaterial({ color:0x6ecbff, transparent:true, opacity:.85 }));
  water.position.y = 0.15; g.add(water);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.25, 8, 20), toonMat(0xb8c8d8));
  rim.rotation.x = Math.PI/2; rim.position.y = 0.3; g.add(rim);
  return g;
}
