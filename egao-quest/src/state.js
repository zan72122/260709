// ===== game state, party, kizuna, save/load =====
import { statsFor, skillsFor, levelExp, KIZUNA_LEVELS, randomMiiConfig } from './data.js';

export const SAVE_KEY = 'egao-quest-save-v1';

export const G = {
  party: [],          // members
  gold: 30,
  inv: { banana: 3, candy: 2, foods: {} },
  kizuna: {},         // "a|b" -> points
  cleared: {},        // routeId -> true
  towerFloor: 1,
  towerBest: 0,
  endingSeen: false,
  battleSpeed: 1,
  auto: false,
};

let nextId = 1;
export function makeMember(cfg){
  const m = {
    id: 'm' + (nextId++),
    cfg,
    lv: 1, exp: 0,
    bonus: { hp:0, mp:0, atk:0, mag:0, def:0, spd:0 },
    buffs: {},
    hp: 1, mp: 1,
    stats: null,
  };
  recompute(m);
  m.hp = m.stats.hp; m.mp = m.stats.mp;
  return m;
}

export function recompute(m){
  const base = statsFor(m.cfg.job, m.lv);
  m.stats = {};
  for (const k in base) m.stats[k] = base[k] + (m.bonus[k]||0) + (k==='hp'||k==='mp' ? (m.bonus.all||0)*2 : (m.bonus.all||0));
  if (m.hp !== undefined) m.hp = Math.min(m.hp, m.stats.hp);
  if (m.mp !== undefined) m.mp = Math.min(m.mp, m.stats.mp);
}

export function addFoodBonus(m, stat, amt){
  if (stat === 'all'){ m.bonus.all = (m.bonus.all||0) + amt; }
  else m.bonus[stat] += amt;
  recompute(m);
}

export function gainExp(m, exp){
  m.exp += exp;
  const ups = [];
  while (m.exp >= levelExp(m.lv)){
    m.exp -= levelExp(m.lv);
    m.lv++;
    const before = { ...m.stats };
    recompute(m);
    m.hp = m.stats.hp; m.mp = m.stats.mp; // full heal on level up
    ups.push({ lv: m.lv, gain: Object.fromEntries(Object.keys(m.stats).map(k=>[k, m.stats[k]-before[k]])) });
  }
  return ups;
}

export function memberSkills(m){ return skillsFor(m.cfg.job, m.lv); }

// ---- kizuna ----
export function kizKey(a, b){ return [a.id, b.id].sort().join('|'); }
export function kizPoints(a, b){ return G.kizuna[kizKey(a,b)] || 0; }
export function kizLevel(a, b){
  const p = kizPoints(a, b);
  let lv = 0;
  for (let i=0;i<KIZUNA_LEVELS.length;i++) if (p >= KIZUNA_LEVELS[i]) lv = i;
  return lv;
}
// returns new level if leveled up, else 0
export function addKizuna(a, b, pts){
  const key = kizKey(a, b);
  const before = kizLevel(a, b);
  G.kizuna[key] = (G.kizuna[key]||0) + pts;
  const after = kizLevel(a, b);
  return after > before ? after : 0;
}

export function addFood(key, n=1){
  G.inv.foods[key] = (G.inv.foods[key]||0) + n;
}

export function aliveParty(){ return G.party.filter(m => m.hp > 0); }

export function healAll(ratio=1){
  for (const m of G.party){
    m.hp = Math.min(m.stats.hp, Math.max(m.hp, 0) + Math.ceil(m.stats.hp*ratio));
    if (m.hp <= 0) m.hp = 1;
    m.mp = Math.min(m.stats.mp, m.mp + Math.ceil(m.stats.mp*ratio));
  }
}

// ---- save / load ----
export function save(){
  try {
    const data = {
      party: G.party.map(m => ({ cfg:m.cfg, lv:m.lv, exp:m.exp, bonus:m.bonus, hp:m.hp, mp:m.mp })),
      gold: G.gold, inv: G.inv, kizuna: G.kizuna, cleared: G.cleared,
      towerFloor: G.towerFloor, towerBest: G.towerBest, endingSeen: G.endingSeen,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch(e){ return false; }
}

export function hasSave(){
  try { return !!localStorage.getItem(SAVE_KEY); } catch(e){ return false; }
}

export function load(){
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data || !data.party?.length) return false;
    G.party = data.party.map(d => {
      const m = makeMember(d.cfg);
      m.lv = d.lv; m.exp = d.exp; m.bonus = { ...m.bonus, ...d.bonus };
      recompute(m);
      m.hp = Math.min(d.hp, m.stats.hp); m.mp = Math.min(d.mp, m.stats.mp);
      return m;
    });
    G.gold = data.gold ?? 30;
    G.inv = { banana:3, candy:2, foods:{}, ...data.inv };
    G.kizuna = data.kizuna ?? {};
    G.cleared = data.cleared ?? {};
    G.towerFloor = data.towerFloor ?? 1;
    G.towerBest = data.towerBest ?? 0;
    G.endingSeen = data.endingSeen ?? false;
    return true;
  } catch(e){ return false; }
}

export function newParty(configs){
  nextId = 1;
  G.party = configs.map(makeMember);
  G.gold = 30;
  G.inv = { banana:3, candy:2, foods:{ onigiri:2 } };
  G.kizuna = {}; G.cleared = {};
  G.towerFloor = 1; G.towerBest = 0; G.endingSeen = false;
}

export function defaultConfigs(){
  const cfgs = [];
  const jobs = ['warrior','mage','priest','thief'];
  for (let i=0;i<4;i++){
    const c = randomMiiConfig();
    c.job = jobs[i];
    cfgs.push(c);
  }
  return cfgs;
}
