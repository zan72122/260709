// ===== えがおクエスト game data =====

export const JOBS = {
  warrior: { name:'せんし',   emoji:'⚔️', color:0xe0533f, weapon:'sword',
    base:{ hp:36, mp:8,  atk:9,  mag:2,  def:8, spd:5 },
    grow:{ hp:6,  mp:1,  atk:2.2,mag:.5, def:1.6, spd:.8 } },
  mage:    { name:'まほうつかい', emoji:'🔮', color:0x7b5cd6, weapon:'staff',
    base:{ hp:24, mp:18, atk:3,  mag:10, def:4, spd:6 },
    grow:{ hp:3.4,mp:3,  atk:.6, mag:2.4,def:.9, spd:1 } },
  priest:  { name:'そうりょ', emoji:'✨', color:0x4db6d9, weapon:'wand',
    base:{ hp:27, mp:16, atk:4,  mag:8,  def:5, spd:5 },
    grow:{ hp:4,  mp:2.6,atk:.8, mag:2,  def:1.1, spd:.9 } },
  thief:   { name:'とうぞく', emoji:'🗡', color:0x58b868, weapon:'dagger',
    base:{ hp:29, mp:10, atk:7,  mag:3,  def:5, spd:11 },
    grow:{ hp:4.4,mp:1.4,atk:1.8,mag:.6, def:1, spd:2 } },
  idol:    { name:'アイドル', emoji:'🎤', color:0xff7bac, weapon:'mic',
    base:{ hp:25, mp:14, atk:5,  mag:6,  def:4, spd:8 },
    grow:{ hp:3.8,mp:2.2,atk:1,  mag:1.6,def:.9, spd:1.4 } },
  cook:    { name:'りょうりにん', emoji:'🍳', color:0xe8a13c, weapon:'pan',
    base:{ hp:32, mp:10, atk:8,  mag:5,  def:6, spd:5 },
    grow:{ hp:5,  mp:1.4,atk:1.9,mag:1.1,def:1.3, spd:.8 } },
};

// skill: {id,name,mp,unlock, type:'atk'|'atkAll'|'heal'|'healAll'|'revive'|'buff'|'charm'|'steal'|'hybrid', pow, desc}
export const SKILLS = {
  warrior: [
    { id:'slashAll', name:'なぎはらい', mp:4, unlock:2, type:'atkAll', pow:0.8, fx:'slash', desc:'てきぜんたいを こうげき' },
    { id:'crit',     name:'かいしんぎり', mp:6, unlock:5, type:'atk', pow:2.4, fx:'slash', desc:'いちげき ひっさつ！' },
    { id:'guardian', name:'みんなをまもる', mp:5, unlock:8, type:'buff', buff:'def', pow:.5, fx:'shield', desc:'みかたのぼうぎょUP' },
  ],
  mage: [
    { id:'fire',    name:'ファイア', mp:4, unlock:1, type:'atk', pow:1.8, magic:true, fx:'fire', desc:'ほのおで こうげき' },
    { id:'thunder', name:'サンダー', mp:7, unlock:4, type:'atkAll', pow:1.1, magic:true, fx:'thunder', desc:'かみなりが ぜんたいに' },
    { id:'meteor',  name:'メテオ',   mp:12, unlock:8, type:'atk', pow:3.2, magic:true, fx:'meteor', desc:'ちょうきょだいな いんせき' },
  ],
  priest: [
    { id:'heal',    name:'ヒール',     mp:4, unlock:1, type:'heal', pow:2.4, fx:'heal', desc:'みかたひとりを かいふく' },
    { id:'healAll', name:'みんなヒール', mp:8, unlock:4, type:'healAll', pow:1.6, fx:'heal', desc:'みかたぜんいん かいふく' },
    { id:'revive',  name:'リザレクト', mp:10, unlock:7, type:'revive', pow:.6, fx:'heal', desc:'たおれたなかまを ふっかつ' },
  ],
  thief: [
    { id:'double', name:'2れんげき',   mp:3, unlock:1, type:'atk', pow:.75, hits:2, fx:'slash', desc:'すばやく 2かい こうげき' },
    { id:'steal',  name:'たからさがし', mp:4, unlock:3, type:'steal', pow:.6, fx:'coin', desc:'こうげきして おたからゲット' },
    { id:'wind',   name:'かまいたち',   mp:7, unlock:6, type:'atkAll', pow:1.0, fx:'wind', desc:'かぜのやいばが ぜんたいに' },
  ],
  idol: [
    { id:'song',  name:'ラブソング',     mp:4, unlock:1, type:'charm', pow:1.0, fx:'heart', desc:'てきを メロメロにする' },
    { id:'cheer', name:'みんなにエール', mp:6, unlock:3, type:'buff', buff:'atk', pow:.4, fx:'star', desc:'みかたのこうげきUP' },
    { id:'live',  name:'スターライブ',   mp:11, unlock:7, type:'hybrid', pow:1.2, magic:true, heal:.9, fx:'star', desc:'ライブで てきにダメージ＆みかたかいふく' },
  ],
  cook: [
    { id:'pan',   name:'フライパンらんぶ', mp:4, unlock:1, type:'atk', pow:1.5, foodChance:.5, fx:'slash', desc:'こうげき＆たべものが でやすい' },
    { id:'soup',  name:'あつあつスープ',   mp:5, unlock:3, type:'heal', pow:2.0, buff:'atk', bpow:.3, fx:'heal', desc:'かいふく＆こうげきUP' },
    { id:'makanai', name:'まかないタイム', mp:9, unlock:7, type:'healAll', pow:1.3, foodChance:1, fx:'heal', desc:'ぜんいんかいふく＆たべものゲット' },
  ],
};

export const PERSONALITIES = {
  ganbariya: { name:'がんばりや', emoji:'🔥', desc:'ときどき ついげき！',
    quirks:['followup'] },
  cool:      { name:'クール',     emoji:'😎', desc:'かいしん・かわす のたつじん',
    quirks:['dodge','crit'] },
  nonki:     { name:'のんき',     emoji:'😪', desc:'たまにひるね…でもHPかいふく',
    quirks:['nap'] },
  ochame:    { name:'おちゃめ',   emoji:'🤪', desc:'いたずらで てきをわらわせる',
    quirks:['prank'] },
};

export const SKIN_COLORS = ['#ffe0bd','#ffd1a3','#eab687','#c68e5e','#8d5a3a'];
export const HAIR_COLORS = ['#3a2a20','#7a4a20','#e8b45a','#e05a3c','#4a6ae0','#3fae5c','#c85ad0','#f0f0f0'];
export const HAIR_STYLES = [
  { id:'short', name:'ショート', emoji:'💇' },
  { id:'bowl',  name:'まるがり', emoji:'🍄' },
  { id:'spiky', name:'ツンツン', emoji:'🌵' },
  { id:'twin',  name:'ツイン',   emoji:'🎀' },
  { id:'long',  name:'ロング',   emoji:'👒' },
  { id:'bun',   name:'おだんご', emoji:'🍡' },
];
export const EYE_STYLES   = ['まる','たれ','つり','ほし','にっこり','ジト'];
export const BROW_STYLES  = ['ふつう','りりしい','こまり','なし'];
export const MOUTH_STYLES = ['にこ','わーい','ちいさい','へのじ','ぺろ','おちょぼ'];

export const NAME_POOL = [
  'モコ','ピノ','タルト','ハル','ソラ','ミント','ココ','リン','ポポ','ネギま',
  'チョコ','マロン','ユズ','スミレ','ゴンザ','テツオ','ハナ','キラリ','プリン','ダイズ',
  'モチ','サクラ','レモン','ノリオ','ミルク','クルミ','ペペロン','タマ','フジコ','バニラ',
];

// foods: stat boost when eaten at inn
export const FOODS = {
  onigiri: { name:'おにぎり',       emoji:'🍙', stat:'hp',  amt:3, rar:1 },
  pudding: { name:'プリン',         emoji:'🍮', stat:'mp',  amt:2, rar:1 },
  meat:    { name:'ジューシーにく', emoji:'🍖', stat:'atk', amt:1, rar:2 },
  ice:     { name:'ほしのアイス',   emoji:'🍨', stat:'mag', amt:1, rar:2 },
  cheese:  { name:'まんげつチーズ', emoji:'🧀', stat:'def', amt:1, rar:2 },
  juice:   { name:'サボテンジュース', emoji:'🧃', stat:'spd', amt:1, rar:2 },
  parfait: { name:'にじいろパフェ', emoji:'🍧', stat:'all', amt:1, rar:3 },
};

// gacha toys → kizuna boost + fun message
export const TOYS = [
  { name:'ぬいぐるみ',   emoji:'🧸', kizuna:8 },
  { name:'まんげきょう', emoji:'🔭', kizuna:8 },
  { name:'トランプ',     emoji:'🃏', kizuna:10 },
  { name:'まくらセット', emoji:'🛏', kizuna:10 },
  { name:'キラキラいし', emoji:'💎', kizuna:14 },
  { name:'うちゅうロケット', emoji:'🚀', kizuna:18 },
];

// ===== monsters =====
// shape: slime | mushroom | ghost | golem | cactus | snowman | bat | crystal | devil
export const MONSTERS = {
  slime:    { name:'ぷにスライム', shape:'slime',   color:0x6ecbff, hp:16, atk:5,  def:2, spd:4,  exp:5,  gold:6,  face:true },
  mushroom: { name:'わらいダケ',   shape:'mushroom',color:0xff9a6e, hp:20, atk:6,  def:3, spd:3,  exp:7,  gold:8,  face:true },
  bat:      { name:'こうもりん',   shape:'bat',     color:0x8a7ae8, hp:14, atk:7,  def:1, spd:9,  exp:6,  gold:7,  face:false },
  cactus:   { name:'とげサボさん', shape:'cactus',  color:0x58b868, hp:26, atk:8,  def:5, spd:3,  exp:10, gold:12, face:true },
  scorpion: { name:'すなサソリ',   shape:'bat',     color:0xd8a03c, hp:22, atk:10, def:4, spd:8,  exp:11, gold:13, face:false },
  golem:    { name:'いわゴーレム', shape:'golem',   color:0xa08a72, hp:40, atk:11, def:9, spd:2,  exp:16, gold:18, face:true },
  snowman:  { name:'ゆきだるまん', shape:'snowman', color:0xeef6ff, hp:30, atk:9,  def:6, spd:4,  exp:14, gold:15, face:true },
  ghost:    { name:'ふぶきおばけ', shape:'ghost',   color:0xbfe0ff, hp:24, atk:12, def:3, spd:10, exp:15, gold:16, face:true },
  crystal:  { name:'こおりクリスタル', shape:'crystal', color:0x8ad8f0, hp:36, atk:12, def:11, spd:5, exp:20, gold:22, face:false },
  imp:      { name:'こあくま',     shape:'devil',   color:0xc86ae0, hp:32, atk:14, def:6, spd:9,  exp:22, gold:24, face:true },
  knight:   { name:'やみのきし',   shape:'golem',   color:0x5a5a7a, hp:48, atk:16, def:12, spd:6, exp:28, gold:30, face:true },
  // bosses
  bossSlime: { name:'キングスライム', shape:'slime', color:0x3f8fe8, hp:90,  atk:11, def:5,  spd:4, exp:40,  gold:60,  face:true, boss:true },
  bossCactus:{ name:'サボテンだいおう', shape:'cactus', color:0x2f9e4f, hp:150, atk:16, def:8,  spd:5, exp:70,  gold:100, face:true, boss:true },
  bossYeti:  { name:'ゆきやまキング', shape:'snowman', color:0xd8ecff, hp:220, atk:20, def:11, spd:6, exp:110, gold:150, face:true, boss:true },
  darkLord:  { name:'だいまおう',   shape:'devil',   color:0x6a3ae0, hp:340, atk:26, def:14, spd:9, exp:250, gold:400, face:true, boss:true },
};

// ===== areas & map =====
export const AREAS = [
  { id:'grass',  name:'そよかぜ草原', emoji:'🌼', biome:'grass',
    routes:[
      { id:'g1', name:'はじまりの小道', battles:2, lvl:1, pool:['slime','mushroom'] },
      { id:'g2', name:'おはなばたけ',   battles:2, lvl:2, pool:['slime','mushroom','bat'] },
      { id:'gB', name:'スライムのぬま', battles:2, lvl:3, pool:['slime','bat'], boss:'bossSlime' },
    ] },
  { id:'desert', name:'ひざし砂漠', emoji:'🌵', biome:'desert',
    routes:[
      { id:'d1', name:'さらさらロード', battles:2, lvl:4, pool:['cactus','scorpion'] },
      { id:'d2', name:'オアシスのちかみち', battles:3, lvl:5, pool:['cactus','scorpion','golem'] },
      { id:'dB', name:'ピラミッドまえ',   battles:2, lvl:6, pool:['golem','scorpion'], boss:'bossCactus' },
    ] },
  { id:'snow',   name:'こごえ雪原', emoji:'⛄', biome:'snow',
    routes:[
      { id:'s1', name:'こなゆきの丘',   battles:2, lvl:7, pool:['snowman','ghost'] },
      { id:'s2', name:'オーロラかいどう', battles:3, lvl:8, pool:['snowman','ghost','crystal'] },
      { id:'sB', name:'ゆきやまのちょうじょう', battles:2, lvl:9, pool:['crystal','ghost'], boss:'bossYeti' },
    ] },
  { id:'dark',   name:'まおうの城', emoji:'🏰', biome:'dark',
    routes:[
      { id:'k1', name:'よるのつりばし', battles:3, lvl:10, pool:['imp','knight'] },
      { id:'k2', name:'ガイコツかいだん', battles:3, lvl:11, pool:['imp','knight','ghost'] },
      { id:'kB', name:'だいまおうのまえ', battles:2, lvl:12, pool:['knight','imp'], boss:'darkLord' },
    ] },
];

// endless tower (post game)
export const TOWER = { id:'tower', name:'ゆめのとう', emoji:'🌈',
  pool:['slime','mushroom','bat','cactus','scorpion','golem','snowman','ghost','crystal','imp','knight'] };

export const BIOMES = {
  grass:  { sky:[0x8fd7ff,0xeafaff], fog:0xcfeeff, ground:0x7ec850, ground2:0x8fd860, path:0xe8d8a8,
            props:['tree','flower','rock'], particle:'petal', sun:0xfff2c8 },
  desert: { sky:[0xffca7a,0xfff0c8], fog:0xffe0b0, ground:0xe8c878, ground2:0xf0d488, path:0xd8a858,
            props:['cactus','rock','skull'], particle:'dust', sun:0xffe8b0 },
  snow:   { sky:[0x9ab8e8,0xe8f2ff], fog:0xdae8f8, ground:0xeef4fb, ground2:0xf8fbff, path:0xc8d8e8,
            props:['pine','snowrock','ice'], particle:'snow', sun:0xeaf2ff },
  dark:   { sky:[0x2a2050,0x5a3a78], fog:0x3a2a58, ground:0x4a3a68, ground2:0x554478, path:0x6a5a88,
            props:['deadtree','crystal','torch'], particle:'star', sun:0xb090ff },
};

// walking route events (besides battles)
export const WALK_EVENTS = ['chest','spring','food','traveler','butterfly'];

export const KIZUNA_LEVELS = [0, 20, 50, 90, 140, 200]; // points needed per level

export function levelExp(lv){ return Math.floor(10 + (lv-1)*(lv-1)*6); }

export function statsFor(job, lv){
  const j = JOBS[job]; const s = {};
  for (const k of ['hp','mp','atk','mag','def','spd'])
    s[k] = Math.round(j.base[k] + j.grow[k]*(lv-1));
  return s;
}

export function skillsFor(job, lv){
  return SKILLS[job].filter(s => lv >= s.unlock);
}

export const rand  = (a,b)=> a + Math.random()*(b-a);
export const randi = (a,b)=> Math.floor(rand(a,b+1));
export const pick  = arr => arr[Math.floor(Math.random()*arr.length)];

export function randomMiiConfig(){
  return {
    name: pick(NAME_POOL),
    skin: randi(0, SKIN_COLORS.length-1),
    hairStyle: randi(0, HAIR_STYLES.length-1),
    hairColor: randi(0, HAIR_COLORS.length-1),
    eyes: randi(0, EYE_STYLES.length-1),
    brows: randi(0, BROW_STYLES.length-1),
    mouth: randi(0, MOUTH_STYLES.length-1),
    job: pick(Object.keys(JOBS)),
    personality: pick(Object.keys(PERSONALITIES)),
  };
}
