// ===== えがおクエスト main =====
import * as THREE from 'three';
import { G, save, load, hasSave, newParty, defaultConfigs, healAll } from './state.js';
import { AREAS, TOWER, BIOMES, MONSTERS, pick, randi } from './data.js';
import { $, toast, say, sayLines, hideDialog, initDialog, renderPartyBar, updatePartyBar,
         setGold, setItemCounts, showBanner } from './ui.js';
import { ensureAudio, playSong, SFX } from './audio.js';
import { openMaker, initMakerButtons } from './maker.js';
import { openMap, initMapButtons } from './map.js';
import { openInn, initInnButtons } from './inn.js';
import { runRoute } from './walk.js';
import { runBattle, getActiveBattle, bindBattleItemButtons } from './battle.js';

// ---------- renderer & active scene ----------
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#app').appendChild(renderer.domElement);

let active = null; // { scene, camera, tick(dt), onTap(ray) }

const ctx = {
  setActive(handle){ active = handle; onResize(); },
  runBattle: opts => runBattle(opts, ctx),
  updateHud(){
    updatePartyBar(G.party);
    setGold(G.gold);
    setItemCounts(G.inv);
  },
};

function onResize(){
  renderer.setSize(innerWidth, innerHeight);
  if (active?.camera){
    active.camera.aspect = innerWidth/innerHeight;
    active.camera.updateProjectionMatrix();
  }
}
addEventListener('resize', onResize);
addEventListener('orientationchange', ()=> setTimeout(onResize, 250));

let lastT = 0;
function frame(t){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t-lastT)/1000 || 0.016);
  lastT = t;
  if (active){
    active.tick?.(dt);
    renderer.render(active.scene, active.camera);
  }
}
requestAnimationFrame(frame);

// tap → ray into active scene
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  ensureAudio();
  if (!active?.onTap || !active.camera) return;
  ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
  raycaster.setFromCamera(ndc, active.camera);
  active.onTap(raycaster.ray);
});

// ---------- game flow ----------
async function startNewGame(){
  ensureAudio();
  $('#splash').classList.add('hidden');
  playSong('title');
  openMaker(defaultConfigs(), async configs => {
    newParty(configs);
    renderPartyBar(G.party);
    ctx.updateHud();
    await sayLines([
      ['？？？', 'たいへん たいへん！ だいまおうが みんなの「かお」を ぬすんじゃった！'],
      ['ようせい', `ゆうしゃ${G.party[0].cfg.name}！ なかまと いっしょに かおを とりもどして！`],
      ['ようせい', 'モンスターが つけている かおを たおして かえしてあげてね！'],
    ]);
    save();
    goMap();
  });
}

function continueGame(){
  ensureAudio();
  if (!load()){ toast('セーブデータが よみこめなかった…'); return; }
  $('#splash').classList.add('hidden');
  renderPartyBar(G.party);
  ctx.updateHud();
  goMap();
}

function goMap(){
  ctx.setActive(null);
  ctx.updateHud();
  openMap();
}

async function onRoute(route, area){
  hideDialog();
  const result = await runRoute(route, area, ctx);
  $('#itemrow').classList.add('hidden');
  $('#battletools').classList.add('hidden');
  if (result === 'clear'){
    const first = !G.cleared[route.id];
    G.cleared[route.id] = true;
    save();
    if (route.boss === 'darkLord' && !G.endingSeen){
      showEnding();
      return;
    }
    SFX.fanfare();
    showBanner('🎉 ルートクリア！', route.name);
    if (route.boss){
      await say('ようせい', `やったね！ ${MONSTERS[route.boss].name}を たおして たくさんの かおが もどったよ！`);
      hideDialog();
    } else if (first){
      toast('⭐ あたらしいみちが ひらけた！', 'gold');
    }
  }
  goMap();
}

async function onTower(){
  const floor = G.towerFloor;
  const biomes = ['grass','desert','snow','dark'];
  const area = { ...AREAS[(floor-1) % 4], biome: biomes[(floor-1)%4], name: `${TOWER.name} ${floor}かい` };
  const nPool = Math.min(TOWER.pool.length, 3 + Math.floor(floor/2));
  const pool = [];
  for (let i=0;i<3;i++) pool.push(TOWER.pool[randi(0, nPool-1)]);
  const route = {
    id: 'tower'+floor,
    name: `${TOWER.name} ${floor}かい`,
    battles: Math.min(4, 2 + Math.floor(floor/3)),
    lvl: 10 + floor*2,
    pool,
    towerMul: 1 + floor*0.3,
    boss: floor % 5 === 0 ? pick(['bossSlime','bossCactus','bossYeti','darkLord']) : undefined,
  };
  const result = await runRoute(route, area, ctx);
  $('#itemrow').classList.add('hidden');
  $('#battletools').classList.add('hidden');
  if (result === 'clear'){
    G.towerBest = Math.max(G.towerBest, floor);
    G.towerFloor = floor + 1;
    SFX.fanfare();
    showBanner(`🌈 ${floor}かい クリア！`, 'ゆめのとう');
    toast(`🌟 さいこうきろく: ${G.towerBest}かい！`, 'gold');
    save();
  }
  goMap();
}

function showEnding(){
  G.endingSeen = true;
  healAll(1);
  save();
  ctx.setActive(null);
  playSong('title');
  SFX.fanfare();
  const names = G.party.map(m=>m.cfg.name).join('、');
  $('#endingText').textContent =
    `だいまおうは かいしんして、ぬすんだ「かお」を ぜんぶ かえした。` +
    `せかいに えがおが もどり、${names}は でんせつの ゆうしゃに なった！ ` +
    `…そして うわさによると、どこかに「ゆめのとう」が あらわれたらしい……。`;
  $('#ending').classList.remove('hidden');
}

// ---------- UI wiring ----------
initDialog();
initMakerButtons();
initMapButtons({ onRoute, onInn: () => openInn(goMap), onTower });
initInnButtons();
bindBattleItemButtons();

$('#btnNew').addEventListener('pointerdown', e => {
  e.stopPropagation(); SFX.confirm();
  if (hasSave() && !confirm('セーブデータが きえちゃうけど いい？')) return;
  startNewGame();
});
$('#btnContinue').addEventListener('pointerdown', e => {
  e.stopPropagation(); SFX.confirm();
  continueGame();
});
$('#btnEndingOk').addEventListener('pointerdown', e => {
  e.stopPropagation(); SFX.confirm();
  $('#ending').classList.add('hidden');
  goMap();
});
$('#btnAuto').addEventListener('pointerdown', e => {
  e.stopPropagation(); SFX.tap();
  G.auto = !G.auto;
  $('#btnAuto').classList.toggle('on', G.auto);
  toast(G.auto ? '🤖 オートバトル ON' : '🕹 オートバトル OFF');
});
$('#btnSpeed').addEventListener('pointerdown', e => {
  e.stopPropagation(); SFX.tap();
  G.battleSpeed = G.battleSpeed >= 3 ? 1 : G.battleSpeed + 1;
  $('#btnSpeed').textContent = `⏩ x${G.battleSpeed}`;
  $('#btnSpeed').classList.toggle('on', G.battleSpeed > 1);
});

// splash: show continue if save exists
if (hasSave()) $('#btnContinue').classList.remove('hidden');

// unlock audio on first touch anywhere
addEventListener('pointerdown', ensureAudio, { once:true });
