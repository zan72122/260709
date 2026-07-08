// The four playgrounds. Everything is data: sim channels to enable, how the
// floor looks, what gets scattered around, and the (gentle) goal.

export const FLOOR_SIZE = 13;

export const STAGES = [
  {
    id: 'terrace',
    name: 'あわあわ テラス',
    emoji: '🫧',
    desc: 'あわを おしのけて ゆかを ぴかぴかに！',
    baseTex: 'terrace',
    baseTiling: 3,
    dirtColor: 0x7d5b3a,
    sparkleColor: 0xfff6c8,
    palette: { skyTop: 0x8fd0ff, skyMid: 0xeaf6ff, skyBot: 0xbde8d8, rim: 0xf5c9d8, around: 0xa8d8a0 },
    sim: { foam: true, dirt: true, scrubRate: 3.2, paint: false, wetTrail: false, grow: false, collectors: true, wetHalfLife: 6 },
    goal: { type: 'clean', text: 'ゆかを ぴかぴかに してね！', target: 0.9 },
    props: [{ type: 'duck', x: 2.5, z: -2.5 }],
    setup(sim) {
      // dirt patches
      const spots = [[-3.5, -3], [3, -3.5], [-2.5, 2.8], [3.4, 2.6], [0, 0.5], [-4.2, 0.2], [4.1, -0.4], [1.2, 4], [-1.4, -4.2], [2.2, 1.2]];
      for (const [x, z] of spots) sim.splat(sim.dirt, x, z, 1.5 + Math.random(), 0.95, 0.35);
      // foam blobs everywhere
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 5.2;
        sim.splat(sim.foam, Math.cos(a) * r, Math.sin(a) * r, 0.8 + Math.random() * 1.1, 0.75, 0.4);
      }
      const c = FLOOR_SIZE / 2 - 1.1;
      sim.addCollector(-c, -c); sim.addCollector(c, -c); sim.addCollector(-c, c); sim.addCollector(c, c);
    },
  },
  {
    id: 'atelier',
    name: 'いろみず アトリエ',
    emoji: '🎨',
    desc: 'いろみずに つけて ころがすと マーブルもよう！',
    baseTex: 'atelier',
    baseTiling: 2,
    dirtColor: 0x7d5b3a,
    sparkleColor: 0xffe9f2,
    paintGloss: 0.4,
    palette: { skyTop: 0xffc9de, skyMid: 0xfff1e6, skyBot: 0xffe3c9, rim: 0xbfe3ff, around: 0xf0d9b8 },
    sim: { foam: false, dirt: false, scrubRate: 0, paint: true, wetTrail: false, grow: false, collectors: false },
    goal: { type: 'paint', text: 'ゆかいっぱいに もようを かいてね！', target: 0.34 },
    props: [],
    setup(sim) {
      sim.addPaintPuddle(-4.2, -4.2, 1.35, 0xff5f8a);
      sim.addPaintPuddle(4.2, -4.2, 1.35, 0x4da3ff);
      sim.addPaintPuddle(-4.2, 4.2, 1.35, 0xffd23e);
      sim.addPaintPuddle(4.2, 4.2, 1.35, 0x59d98c);
    },
  },
  {
    id: 'garden',
    name: 'おはなの かだん',
    emoji: '🌼',
    desc: 'みずの みちを つくると おはなが さくよ！',
    baseTex: 'garden',
    baseTiling: 2.5,
    dirtColor: 0x5c4630,
    sparkleColor: 0xd8ffd0,
    palette: { skyTop: 0x9adcff, skyMid: 0xf2fbe9, skyBot: 0xcdeec2, rim: 0xd9b58a, around: 0x94cc8a },
    sim: { foam: false, dirt: false, scrubRate: 0, paint: false, wetTrail: true, grow: true, collectors: false, wetHalfLife: 14 },
    goal: { type: 'flowers', text: 'おはなを ３０こ さかせてね！', target: 30 },
    props: [{ type: 'duck', x: -3, z: 3.2 }],
    setup(sim) {
      sim.addWaterPuddle(0, -4.3, 1.6);
      sim.addWaterPuddle(-4.4, 1.5, 1.1);
      sim.fillSoil(1.0);
    },
  },
  {
    id: 'pancake',
    name: 'パンケーキ こうぼう',
    emoji: '🥞',
    desc: 'シロップで おいしい もようを かこう！',
    baseTex: 'pancake',
    baseTiling: 1,
    dirtColor: 0x7d5b3a,
    sparkleColor: 0xfff0b8,
    paintGloss: 0.85,
    palette: { skyTop: 0xffd9a8, skyMid: 0xfff3df, skyBot: 0xffe0bb, rim: 0xe8b06c, around: 0xdba86e },
    sim: { foam: false, dirt: false, scrubRate: 0, paint: true, wetTrail: false, grow: false, collectors: false },
    goal: { type: 'paint', text: 'シロップの もようを いっぱい かいてね！', target: 0.26 },
    props: [
      { type: 'strawberry', x: 3.6, z: 0.5 }, { type: 'strawberry', x: -3.2, z: -1.8 },
      { type: 'strawberry', x: 1.5, z: 3.8 }, { type: 'blueberry', x: -1.8, z: 3.4 },
      { type: 'blueberry', x: 2.8, z: -3.2 }, { type: 'blueberry', x: -3.8, z: 1.4 },
    ],
    setup(sim) {
      sim.addPaintPuddle(-4.4, -4.4, 1.3, 0xa85c18); // maple syrup
      sim.addPaintPuddle(4.4, -4.4, 1.3, 0xd94f6b);  // berry sauce
      sim.addPaintPuddle(4.4, 4.4, 1.3, 0xfff3e0);   // cream
    },
  },
];
