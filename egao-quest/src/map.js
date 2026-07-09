// ===== adventure map =====
import { AREAS, TOWER, MONSTERS } from './data.js';
import { G, save } from './state.js';
import { $, toast } from './ui.js';
import { SFX, playSong } from './audio.js';

let cbs = null;

// flat ordered list of route ids to compute unlocks
function routeOrder(){
  const list = [];
  for (const area of AREAS) for (const r of area.routes) list.push(r.id);
  return list;
}

export function isUnlocked(routeId){
  const order = routeOrder();
  const idx = order.indexOf(routeId);
  if (idx === 0) return true;
  return !!G.cleared[order[idx-1]];
}

function render(){
  const scroll = $('#mapScroll');
  scroll.innerHTML = '';
  for (const area of AREAS){
    const block = document.createElement('div');
    block.className = 'areaBlock';
    block.innerHTML = `<div class="areaTitle"><span class="aemoji">${area.emoji}</span>${area.name}</div>`;
    const rowEl = document.createElement('div');
    rowEl.className = 'nodeRow';
    for (const r of area.routes){
      const unlocked = isUnlocked(r.id);
      const done = !!G.cleared[r.id];
      const b = document.createElement('button');
      b.className = 'node' + (done?' done':'') + (unlocked?'':' locked') + (r.boss?' boss':'');
      const bossName = r.boss ? MONSTERS[r.boss].name : null;
      b.innerHTML = `<div class="ntitle">${r.name}</div>
        <div class="ndesc">${r.boss ? '👹 ボス: '+bossName : 'おすすめLv '+r.lvl}</div>
        <div class="nstat">${done ? '⭐' : unlocked ? '▶️' : '🔒'}</div>`;
      if (unlocked) b.addEventListener('pointerdown', e => {
        e.stopPropagation(); SFX.confirm();
        closeMap();
        cbs.onRoute(r, area);
      });
      rowEl.appendChild(b);
    }
    block.appendChild(rowEl);
    scroll.appendChild(block);
  }
  // dream tower (post-game)
  if (G.endingSeen){
    const block = document.createElement('div');
    block.className = 'areaBlock';
    block.innerHTML = `<div class="areaTitle"><span class="aemoji">${TOWER.emoji}</span>${TOWER.name}（エンドレス）</div>`;
    const rowEl = document.createElement('div');
    rowEl.className = 'nodeRow';
    const b = document.createElement('button');
    b.className = 'node tower';
    b.innerHTML = `<div class="ntitle">${TOWER.floorLabel ?? ''}${G.towerFloor}かいに ちょうせん！</div>
      <div class="ndesc">さいこうきろく: ${G.towerBest}かい ／ てきがどんどんつよくなる！</div>
      <div class="nstat">🌟</div>`;
    b.addEventListener('pointerdown', e => {
      e.stopPropagation(); SFX.confirm();
      closeMap();
      cbs.onTower();
    });
    rowEl.appendChild(b);
    block.appendChild(rowEl);
    scroll.appendChild(block);
  }
}

export function openMap(callbacks){
  if (callbacks) cbs = callbacks;
  render();
  $('#map').classList.remove('hidden');
  $('#partybar').style.display = '';
  playSong('title');
}

export function closeMap(){
  $('#map').classList.add('hidden');
}

export function initMapButtons(callbacks){
  cbs = callbacks;
  $('#btnInnGo').addEventListener('pointerdown', e => {
    e.stopPropagation(); SFX.confirm();
    closeMap();
    cbs.onInn();
  });
  $('#btnSave').addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (save()){ SFX.coin(); toast('💾 セーブしました！'); }
    else toast('セーブできませんでした…');
  });
}
