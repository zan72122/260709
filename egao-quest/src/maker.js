// ===== character maker screen =====
import * as THREE from 'three';
import { createMii, setMiiState, miiTick } from './mii.js';
import { addLights } from './scenes.js';
import { SKIN_COLORS, HAIR_COLORS, HAIR_STYLES, EYE_STYLES, BROW_STYLES, MOUTH_STYLES,
         JOBS, PERSONALITIES, NAME_POOL, randomMiiConfig, pick } from './data.js';
import { $, toast } from './ui.js';
import { SFX } from './audio.js';

let renderer, scene, camera, currentMii = null, spinY = 0, dragging = false, lastX = 0;
let configs = [], curIdx = 0, onDoneCb = null, running = false;

function initPreview(){
  if (renderer) return;
  const holder = $('#makerPreview');
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.4, 7.2);
  camera.lookAt(0, 1.9, 0);
  addLights(scene, 'grass');
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.3, 28),
    new THREE.MeshToonMaterial({ color:0xbfe8a8 }));
  disc.position.y = -0.15;
  scene.add(disc);

  holder.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; });
  addEventListener('pointermove', e => {
    if (dragging){ spinY += (e.clientX - lastX) * 0.012; lastX = e.clientX; }
  });
  addEventListener('pointerup', ()=> dragging = false);
}

function resizePreview(){
  const holder = $('#makerPreview');
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}

function rebuildMii(){
  if (currentMii){ scene.remove(currentMii); }
  currentMii = createMii(configs[curIdx]);
  currentMii.scale.setScalar(1.05);
  setMiiState(currentMii, 'idle');
  scene.add(currentMii);
}

let rafId = 0, lastT = 0;
function loop(t){
  if (!running) return;
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT)/1000 || 0.016);
  lastT = t;
  if (!dragging) spinY += dt*0.5;
  if (currentMii){ currentMii.rotation.y = spinY; miiTick(currentMii, dt); }
  resizePreview();
  renderer.render(scene, camera);
}

// ---------- panel ----------
function row(label, extraHtml=''){
  const div = document.createElement('div');
  div.className = 'mrow';
  div.innerHTML = `<div class="mlabel"><span>${label}</span>${extraHtml}</div><div class="mopts"></div>`;
  $('#makerPanel').appendChild(div);
  return div.querySelector('.mopts');
}

function optButtons(holder, items, get, set, render){
  holder.innerHTML = '';
  items.forEach((item, i) => {
    const b = document.createElement('button');
    b.className = 'mopt' + (render.cls ? ' '+render.cls : '');
    if (render.color){ b.classList.add('color'); b.style.background = render.color(item); b.textContent = ''; }
    else b.textContent = render.text(item);
    if (get() === i) b.classList.add('sel');
    b.addEventListener('pointerdown', e => {
      e.stopPropagation();
      SFX.tap();
      set(i);
      [...holder.children].forEach((c,j)=> c.classList.toggle('sel', j===i));
      rebuildMii();
    });
    holder.appendChild(b);
  });
}

function buildPanel(){
  const panel = $('#makerPanel');
  panel.innerHTML = '';
  const cfg = configs[curIdx];

  // name
  const nameOpts = row('なまえ');
  nameOpts.innerHTML = `<div id="nameRow" style="width:100%">
    <input id="nameInput" maxlength="8" value="${cfg.name}">
    <button class="mopt small" id="nameDice">🎲</button></div>`;
  const input = nameOpts.querySelector('#nameInput');
  input.addEventListener('input', ()=> { cfg.name = input.value || 'ななし'; });
  input.addEventListener('pointerdown', e => e.stopPropagation());
  nameOpts.querySelector('#nameDice').addEventListener('pointerdown', e => {
    e.stopPropagation(); SFX.tap();
    cfg.name = pick(NAME_POOL); input.value = cfg.name;
  });

  optButtons(row('はだのいろ'), SKIN_COLORS, ()=>cfg.skin, i=>cfg.skin=i, { color:c=>c });
  optButtons(row('かみがた'), HAIR_STYLES, ()=>cfg.hairStyle, i=>cfg.hairStyle=i, { text:h=>h.emoji });
  optButtons(row('かみのいろ'), HAIR_COLORS, ()=>cfg.hairColor, i=>cfg.hairColor=i, { color:c=>c });
  optButtons(row('め'), EYE_STYLES, ()=>cfg.eyes, i=>cfg.eyes=i, { text:t=>t, cls:'small' });
  optButtons(row('まゆげ'), BROW_STYLES, ()=>cfg.brows, i=>cfg.brows=i, { text:t=>t, cls:'small' });
  optButtons(row('くち'), MOUTH_STYLES, ()=>cfg.mouth, i=>cfg.mouth=i, { text:t=>t, cls:'small' });

  const jobKeys = Object.keys(JOBS);
  optButtons(row('しょくぎょう'), jobKeys,
    ()=> jobKeys.indexOf(cfg.job), i=>cfg.job=jobKeys[i],
    { text:k=>`${JOBS[k].emoji}${JOBS[k].name}`, cls:'small' });

  const pKeys = Object.keys(PERSONALITIES);
  optButtons(row('せいかく'), pKeys,
    ()=> pKeys.indexOf(cfg.personality), i=>cfg.personality=pKeys[i],
    { text:k=>`${PERSONALITIES[k].emoji}${PERSONALITIES[k].name}`, cls:'small' });

  // personality description
  const desc = document.createElement('div');
  desc.className = 'mrow';
  desc.innerHTML = `<div class="mlabel"><span>${PERSONALITIES[cfg.personality].emoji} ${PERSONALITIES[cfg.personality].desc}</span></div>`;
  panel.appendChild(desc);
}

function buildTabs(){
  const who = $('#makerWho');
  who.innerHTML = '';
  const labels = ['👑ゆうしゃ','なかま1','なかま2','なかま3'];
  configs.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'whoTab' + (i===curIdx ? ' sel' : '');
    b.textContent = labels[i];
    b.addEventListener('pointerdown', e => {
      e.stopPropagation(); SFX.tap();
      curIdx = i;
      [...who.children].forEach((t,j)=> t.classList.toggle('sel', j===i));
      buildPanel(); rebuildMii();
    });
    who.appendChild(b);
  });
}

export function openMaker(initialConfigs, onDone){
  configs = initialConfigs;
  curIdx = 0;
  onDoneCb = onDone;
  initPreview();
  buildTabs();
  buildPanel();
  rebuildMii();
  $('#maker').classList.remove('hidden');
  running = true;
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function closeMaker(){
  running = false;
  cancelAnimationFrame(rafId);
  $('#maker').classList.add('hidden');
}

export function initMakerButtons(){
  $('#btnRandom').addEventListener('pointerdown', e => {
    e.stopPropagation(); SFX.gacha();
    const job = configs[curIdx].job;
    configs[curIdx] = { ...randomMiiConfig(), job };
    buildPanel(); rebuildMii();
    toast('🎲 おまかせへんしん！');
  });
  $('#btnMakerDone').addEventListener('pointerdown', e => {
    e.stopPropagation(); SFX.confirm();
    const names = new Set();
    for (const c of configs){
      c.name = (c.name || 'ななし').trim() || 'ななし';
      while (names.has(c.name)) c.name += '２';
      names.add(c.name);
    }
    closeMaker();
    onDoneCb?.(configs);
  });
}
