// ===== the inn: rest, feed, gacha, bonds =====
import { G, addFoodBonus, addKizuna, kizLevel, kizPoints, healAll } from './state.js';
import { FOODS, TOYS, KIZUNA_LEVELS, PERSONALITIES, JOBS, pick } from './data.js';
import { $, toast } from './ui.js';
import { drawFaceIcon } from './mii.js';
import { SFX, playSong } from './audio.js';

let selectedId = null;
let onCloseCb = null;

const STAT_LABEL = { hp:'HP', mp:'MP', atk:'こうげき', mag:'まほう', def:'ぼうぎょ', spd:'すばやさ', all:'ぜんぶ' };

function render(){
  const body = $('#innBody');
  body.innerHTML = '';

  // --- member picker ---
  const memCard = document.createElement('div');
  memCard.className = 'innCard';
  memCard.innerHTML = `<h3>🍽 たべものを あげる</h3>
    <div class="desc">なかまをえらんで たべものをタップ！ ステータスが あがるよ</div>
    <div class="memRow"></div><div class="foodRow" style="margin-top:1.4vmin"></div>`;
  const memRow = memCard.querySelector('.memRow');
  if (!selectedId || !G.party.find(m=>m.id===selectedId)) selectedId = G.party[0]?.id;
  for (const m of G.party){
    const b = document.createElement('button');
    b.className = 'memPick' + (m.id===selectedId ? ' sel' : '');
    const mini = document.createElement('div'); mini.className = 'mini';
    const cv = document.createElement('canvas'); drawFaceIcon(cv, m.cfg); mini.appendChild(cv);
    b.appendChild(mini);
    const label = document.createElement('span');
    label.textContent = `${m.cfg.name} Lv${m.lv}`;
    b.appendChild(label);
    b.addEventListener('pointerdown', e => {
      e.stopPropagation(); SFX.tap();
      selectedId = m.id; render();
    });
    memRow.appendChild(b);
  }
  const foodRow = memCard.querySelector('.foodRow');
  const keys = Object.keys(G.inv.foods).filter(k => G.inv.foods[k] > 0);
  if (!keys.length){
    foodRow.innerHTML = `<div class="desc">たべものが ない… ぼうけんで あつめよう！</div>`;
  }
  for (const k of keys){
    const f = FOODS[k];
    const b = document.createElement('button');
    b.className = 'foodItem';
    b.innerHTML = `${f.emoji} ${f.name} <span class="fcnt">×${G.inv.foods[k]}</span>`;
    b.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const m = G.party.find(x=>x.id===selectedId);
      if (!m) return;
      G.inv.foods[k]--;
      addFoodBonus(m, f.stat, f.amt);
      m.hp = Math.min(m.stats.hp, m.hp + 5);
      SFX.eat();
      toast(`${f.emoji} ${m.cfg.name}の ${STAT_LABEL[f.stat]}が +${f.amt} あがった！`, 'gold');
      // eating together = bond!
      const other = pick(G.party.filter(x=>x!==m));
      if (other && Math.random()<0.5){
        const lv = addKizuna(m, other, 4);
        if (lv) toast(`💕 ${m.cfg.name}と${other.cfg.name}の きずなが Lv${lv}に！`, 'love');
      }
      render();
    });
    foodRow.appendChild(b);
  }
  body.appendChild(memCard);

  // --- gacha ---
  const gachaCard = document.createElement('div');
  gachaCard.className = 'innCard';
  gachaCard.innerHTML = `<h3>🎰 おもちゃガチャ（10G）</h3>
    <div class="desc">でてきたおもちゃで ふたりのきずなが ふかまる！</div>`;
  const gbtn = document.createElement('button');
  gbtn.className = 'pbtn'; gbtn.id = 'gachaBtn';
  gbtn.textContent = `まわす！（もってるお金: ${G.gold}G）`;
  gbtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (G.gold < 10){ SFX.cancel(); toast('💰 お金がたりない…'); return; }
    G.gold -= 10;
    SFX.gacha();
    const toy = pick(TOYS);
    const a = pick(G.party);
    let b2 = pick(G.party);
    while (G.party.length>1 && b2===a) b2 = pick(G.party);
    const lv = addKizuna(a, b2, toy.kizuna);
    setTimeout(()=>{
      toast(`${toy.emoji} 「${toy.name}」が でた！`, 'gold');
      toast(`${a.cfg.name}と${b2.cfg.name}が いっしょにあそんだ！ きずな+${toy.kizuna}`, 'love');
      if (lv) toast(`💕 きずなが Lv${lv}に あがった！`, 'love');
      render();
    }, 400);
  });
  gachaCard.appendChild(gbtn);
  body.appendChild(gachaCard);

  // --- bonds overview ---
  const kizCard = document.createElement('div');
  kizCard.className = 'innCard';
  kizCard.innerHTML = `<h3>💕 みんなの きずな</h3>
    <div class="desc">きずなレベルが たかいほど バトルで れんけいこうげきが でやすい！</div>`;
  const list = document.createElement('div');
  for (let i=0;i<G.party.length;i++) for (let j=i+1;j<G.party.length;j++){
    const a = G.party[i], b = G.party[j];
    const lv = kizLevel(a,b), pts = kizPoints(a,b);
    const next = KIZUNA_LEVELS[Math.min(lv+1, KIZUNA_LEVELS.length-1)];
    const rowDiv = document.createElement('div');
    rowDiv.style.cssText = 'font-size:3vmin;color:#6a7a90;padding:.6vmin 0;';
    rowDiv.innerHTML = `${a.cfg.name} × ${b.cfg.name} … <b style="color:#e86a9a">${'💗'.repeat(lv) || '♡'}</b> Lv${lv}（${pts}/${next}）`;
    list.appendChild(rowDiv);
  }
  kizCard.appendChild(list);
  body.appendChild(kizCard);

  // --- gossip ---
  const talkCard = document.createElement('div');
  talkCard.className = 'innCard';
  const m1 = pick(G.party);
  const gossip = pick([
    `${m1.cfg.name}「${pick(['あしたも がんばるぞー！','おなか すいたなあ…','だいまおうなんて こわくない…たぶん','ふかふかベッド さいこう〜','みんなと たびできて うれしい！'])}」`,
    `${m1.cfg.name}は ${PERSONALITIES[m1.cfg.personality].name}らしく ${pick(['うでたてふせを している','ひるねを している','かがみのまえで ポーズをきめている','おかしを かくしている'])}…`,
  ]);
  talkCard.innerHTML = `<h3>🛏 やどやの ようす</h3><div class="desc" style="font-size:3vmin;color:#6a7a90">${gossip}</div>`;
  body.appendChild(talkCard);
}

export function openInn(onClose){
  onCloseCb = onClose;
  healAll(1);
  playSong('inn');
  SFX.heal();
  toast('🛏 ゆっくりやすんで ぜんかいふく！');
  render();
  $('#inn').classList.remove('hidden');
}

export function initInnButtons(){
  $('#btnInnBack').addEventListener('pointerdown', e => {
    e.stopPropagation(); SFX.confirm();
    $('#inn').classList.add('hidden');
    onCloseCb?.();
  });
}
