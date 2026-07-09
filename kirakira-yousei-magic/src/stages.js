// キラキラ☆ようせいマジック にじいろガーデン — stage definitions.
// Pure data (no DOM, no THREE) so it can be unit-tested in Node.

export const STAGES = [
  {
    id: 'garden',
    name: 'おはなの ガーデン',
    emoji: '🌷',
    theme: 'day',
    budsNeeded: 4,
    budsMax: 7,
    sky: { top: 0x4fa9ff, mid: 0xa8dcff, bot: 0xfff2d8, sun: 0xfff3b0, stars: 0.0 },
    fog: 0xcfeaff,
    hemi: { sky: 0xbfe3ff, ground: 0xffe9c9, intensity: 1.05 },
    sun: { color: 0xfff2d9, intensity: 1.25, pos: [6, 12, 4] },
    ground: { inner: '#b6ec9a', outer: '#7cc978', speck: ['#ffd9ec', '#fff6b8', '#d3f7ff'] },
    petals: [0xff8fb8, 0xffd45e, 0xff9d76, 0xb48ff5, 0xff6d9d, 0x7fc8ff],
    friend: 'butterfly',
    friendName: 'ちょうちょの ペアリル',
    musicRoot: 0,
    fireflies: 0,
  },
  {
    id: 'forest',
    name: 'ひかる キノコの もり',
    emoji: '🍄',
    theme: 'dusk',
    budsNeeded: 5,
    budsMax: 8,
    sky: { top: 0x3b2f7e, mid: 0xa66bc9, bot: 0xffb98a, sun: 0xffc9a0, stars: 0.35 },
    fog: 0xc99ad0,
    hemi: { sky: 0xc9a8ff, ground: 0x7a5f8a, intensity: 0.9 },
    sun: { color: 0xffc9a0, intensity: 0.85, pos: [-7, 8, 6] },
    ground: { inner: '#8fd6a0', outer: '#4e9c6c', speck: ['#ffe9a8', '#ffc9ec', '#baf3e0'] },
    petals: [0xff9ddb, 0xffd45e, 0xa27bff, 0x7fe0c8, 0xff8fb8, 0xffb37f],
    friend: 'bunny',
    friendName: 'ふわふわ うさリル',
    musicRoot: 3,
    fireflies: 60,
  },
  {
    id: 'sky',
    name: 'おほしさまの そら',
    emoji: '⭐',
    theme: 'night',
    budsNeeded: 6,
    budsMax: 9,
    sky: { top: 0x101a4e, mid: 0x3a3f96, bot: 0x8a6fd0, sun: 0xcfe0ff, stars: 1.0 },
    fog: 0x5a55b0,
    hemi: { sky: 0x8fa0ff, ground: 0x4a4380, intensity: 0.85 },
    sun: { color: 0xd7e4ff, intensity: 0.7, pos: [5, 11, -4] },
    ground: { inner: '#cdb9ff', outer: '#8f7ae0', speck: ['#fff6b8', '#ffffff', '#ffc9ec'] },
    petals: [0xfff08a, 0x9dc8ff, 0xff9ddb, 0xc0a8ff, 0x8ff0e0, 0xffc9a0],
    friend: 'star',
    friendName: 'ほしのこ キララ',
    musicRoot: 7,
    fireflies: 90,
  },
  {
    id: 'rainbow',
    name: 'にじいろの おしろ',
    emoji: '🌈',
    theme: 'rainbow',
    budsNeeded: 7,
    budsMax: 10,
    sky: { top: 0x6db9ff, mid: 0xbfe0ff, bot: 0xffe0f0, sun: 0xfff3b0, stars: 0.1 },
    fog: 0xf0dcff,
    hemi: { sky: 0xd7e8ff, ground: 0xffd9ec, intensity: 1.1 },
    sun: { color: 0xfff2d9, intensity: 1.2, pos: [0, 13, 7] },
    ground: { inner: '#ffe3f2', outer: '#c0e8a8', speck: ['#ffd45e', '#b8f0ff', '#ffb8d9'] },
    petals: [0xff6d9d, 0xffa94f, 0xffe14f, 0x7fdd6f, 0x5fb8ff, 0xb48ff5],
    friend: 'bird',
    friendName: 'にじいろ ことリル',
    musicRoot: 5,
    fireflies: 30,
  },
];

// Fairy roster — original flower fairies. Colors feed the character builder.
export const FAIRIES = [
  { id: 'momo', name: 'モモ', flower: 'さくらの ようせい', emoji: '🌸', hair: 0xffa8c8, dress: 0xff7fae, wing: 0xffc4dd, accent: 0xfff08a, skin: 0xffe7d6 },
  { id: 'sumire', name: 'スミレ', flower: 'すみれの ようせい', emoji: '🪻', hair: 0xc0a0f5, dress: 0x9d76ea, wing: 0xdcc8ff, accent: 0xff9ddb, skin: 0xffe7d6 },
  { id: 'himari', name: 'ヒマリ', flower: 'ひまわりの ようせい', emoji: '🌻', hair: 0xffd98a, dress: 0xffbb33, wing: 0xffe9a8, accent: 0xff8a5f, skin: 0xffe0c2 },
  { id: 'sorane', name: 'ソラネ', flower: 'つりがねそうの ようせい', emoji: '💧', hair: 0xa0d8ff, dress: 0x5fa8f0, wing: 0xc4e6ff, accent: 0xfff08a, skin: 0xffe7d6 },
  { id: 'kotoha', name: 'コトハ', flower: 'クローバーの ようせい', emoji: '🍀', hair: 0xa8ecc0, dress: 0x5fca8a, wing: 0xd0f7dd, accent: 0xffd45e, skin: 0xffe7d6 },
];

// Dress-change palette cycle (🎀 button).
export const DRESS_CYCLE = [0xff7fae, 0xffbb33, 0x7fdd6f, 0x5fa8f0, 0x9d76ea, 0xff6d5f, 0x4fd0c8];

export const PRAISE = [
  ['すごーい！', '✨'], ['きれい！', '🌸'], ['やったね！', '🎀'], ['ピッカピカ！', '⭐'],
  ['まほう じょうず！', '🪄'], ['かわいい！', '💖'], ['キラキラ〜！', '🌟'],
];
