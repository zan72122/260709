// ===== DOM UI helpers + 3D text popups =====
import * as THREE from 'three';
import { drawFaceIcon } from './mii.js';
import { JOBS } from './data.js';

export const $ = sel => document.querySelector(sel);

export function toast(msg, cls=''){
  const el = document.createElement('div');
  el.className = 'toastmsg ' + cls;
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(()=> el.remove(), 2500);
}

let bannerTimer = null;
export function showBanner(title, sub=''){
  const b = $('#banner');
  b.querySelector('.in').innerHTML = (sub?`<small>${sub}</small>`:'') + title;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=> b.classList.remove('show'), 2200);
}

// ---- dialog (tap to continue) ----
let dialogResolve = null;
export function say(who, txt){
  return new Promise(res => {
    const d = $('#dialog');
    d.querySelector('.who').textContent = who ?? '';
    d.querySelector('.who').style.display = who ? '' : 'none';
    d.querySelector('.txt').textContent = txt;
    d.classList.add('show');
    dialogResolve = res;
  });
}
export async function sayLines(lines){
  for (const [who, txt] of lines) await say(who, txt);
  hideDialog();
}
export function hideDialog(){
  $('#dialog').classList.remove('show');
  dialogResolve = null;
}
export function initDialog(){
  $('#dialog').addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (dialogResolve){ const r = dialogResolve; dialogResolve = null; $('#dialog').classList.remove('show'); r(); }
  });
}

// ---- party bar ----
const faceCanvases = new Map();
export function renderPartyBar(party){
  const bar = $('#partybar');
  bar.innerHTML = '';
  faceCanvases.clear();
  for (const m of party){
    const card = document.createElement('div');
    card.className = 'pcard';
    card.dataset.id = m.id;
    const face = document.createElement('div'); face.className = 'pface';
    const cv = document.createElement('canvas');
    drawFaceIcon(cv, m.cfg);
    face.appendChild(cv);
    faceCanvases.set(m.id, cv);
    const info = document.createElement('div'); info.className = 'pinfo';
    info.innerHTML = `<div class="pname"><span>${m.cfg.name}</span><span class="lv">Lv<span class="lvnum">${m.lv}</span></span></div>
      <div class="bar hp"><i></i></div><div class="bar mp"><i></i></div>`;
    card.appendChild(face); card.appendChild(info);
    bar.appendChild(card);
  }
  updatePartyBar(party);
}

export function updatePartyBar(party){
  for (const m of party){
    const card = $('#partybar').querySelector(`[data-id="${m.id}"]`);
    if (!card) continue;
    const hpBar = card.querySelector('.bar.hp');
    const ratio = Math.max(0, m.hp / m.stats.hp);
    hpBar.querySelector('i').style.width = (ratio*100)+'%';
    hpBar.classList.toggle('low', ratio <= 0.5 && ratio > 0.25);
    hpBar.classList.toggle('crit', ratio <= 0.25);
    card.querySelector('.bar.mp i').style.width = Math.max(0, m.mp/m.stats.mp*100)+'%';
    card.querySelector('.lvnum').textContent = m.lv;
    card.classList.toggle('down', m.hp <= 0);
  }
}
export function pulseCard(id){
  const card = $('#partybar').querySelector(`[data-id="${id}"]`);
  if (!card) return;
  card.classList.remove('hurt'); void card.offsetWidth; card.classList.add('hurt');
}
export function refreshFaceIcon(m){
  const cv = faceCanvases.get(m.id);
  if (cv) drawFaceIcon(cv, m.cfg);
}

export function setGold(n){ $('#goldnum').textContent = n; }
export function setItemCounts(inv){
  $('#cntBanana').textContent = inv.banana;
  $('#cntCandy').textContent = inv.candy;
}

// ---- 3D floating text popups ----
const popups = [];
export function popText(scene, pos, text, { color='#fff', size=1, up=2.2, life=1.0, stroke='#333' } = {}){
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 64;
  ctx.font = `bold ${fs}px 'Hiragino Maru Gothic ProN', sans-serif`;
  const w = Math.max(64, ctx.measureText(text).width + 24);
  c.width = w; c.height = fs + 28;
  ctx.font = `bold ${fs}px 'Hiragino Maru Gothic ProN', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
  ctx.strokeText(text, w/2, (fs+28)/2);
  ctx.fillStyle = color;
  ctx.fillText(text, w/2, (fs+28)/2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false });
  const spr = new THREE.Sprite(mat);
  const aspect = c.width / c.height;
  spr.scale.set(size*aspect, size, 1);
  spr.position.copy(pos);
  spr.renderOrder = 100;
  scene.add(spr);
  popups.push({ spr, scene, t:0, life, up });
  return spr;
}

export function popupsTick(dt){
  for (let i=popups.length-1; i>=0; i--){
    const p = popups[i];
    p.t += dt;
    p.spr.position.y += p.up*dt * Math.max(0.15, 1 - p.t/p.life);
    p.spr.material.opacity = Math.max(0, 1 - (p.t/p.life)*(p.t/p.life));
    if (p.t >= p.life){
      p.scene.remove(p.spr);
      p.spr.material.map.dispose(); p.spr.material.dispose();
      popups.splice(i, 1);
    }
  }
}

// speech bubble above a 3D character (projected DOM would be complex; use sprite)
export function popBubble(scene, pos, emoji, opts={}){
  return popText(scene, pos, emoji, { size:opts.size ?? 1.4, up:.6, life:opts.life ?? 1.3, stroke:'rgba(0,0,0,0)' });
}

export function jobLabel(job){ const j = JOBS[job]; return `${j.emoji}${j.name}`; }
