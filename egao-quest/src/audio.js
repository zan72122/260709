// ===== procedural chiptune BGM + SFX (WebAudio) =====
let ctx = null, master = null, bgmGain = null, sfxGain = null;
let current = null, timer = null;
let muted = false;

export function ensureAudio(){
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.5; bgmGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
  // a song may have been requested before audio was unlocked — start it now
  if (current){ const want = current; current = null; playSong(want); }
}

export function setMuted(m){ muted = m; if (master) master.gain.value = m ? 0 : 0.6; }

const N = (st)=> 440 * Math.pow(2, (st - 9) / 12); // st: semitones from C4

// ---- song data: patterns are arrays of semitone|null per 8th note ----
const SONGS = {
  title: { bpm: 96, wave:'triangle', bassWave:'square',
    mel: [12,null,16,null,19,null,16,null, 17,null,16,14,12,null,null,null,
          9,null,12,null,16,null,12,null, 14,null,12,11,9,null,null,null],
    bass:[0,null,null,null,-3,null,null,null, -5,null,null,null,-7,null,null,null,
          -3,null,null,null,0,null,null,null, -5,null,null,null,-7,-5,-3,null],
    perc:[1,0,0,0,1,0,0,0, 1,0,0,0,1,0,1,0, 1,0,0,0,1,0,0,0, 1,0,0,0,1,0,1,1] },
  grass: { bpm: 108, wave:'square', bassWave:'triangle', gain:.55,
    mel: [12,null,12,14,16,null,14,null, 12,null,9,null,7,null,null,null,
          9,11,12,null,14,null,16,14, 12,null,11,null,9,null,null,null],
    bass:[0,null,7,null,0,null,7,null, -3,null,4,null,-3,null,4,null,
          -5,null,2,null,-5,null,2,null, 0,null,7,null,0,null,null,null],
    perc:[1,0,2,0,1,0,2,0, 1,0,2,0,1,0,2,0, 1,0,2,0,1,0,2,0, 1,0,2,0,1,2,2,0] },
  desert: { bpm: 100, wave:'square', bassWave:'triangle', gain:.5,
    mel: [12,null,13,null,16,null,13,12, null,null,8,null,12,null,null,null,
          13,null,16,null,20,null,19,16, 13,null,12,null,null,null,null,null],
    bass:[0,null,null,0,-4,null,null,-4, -5,null,null,-5,0,null,null,null,
          -4,null,null,-4,-5,null,null,-5, 0,null,0,null,0,null,null,null],
    perc:[1,0,0,2,1,0,0,2, 1,0,0,2,1,0,2,0, 1,0,0,2,1,0,0,2, 1,0,2,0,1,0,2,2] },
  snow: { bpm: 84, wave:'triangle', bassWave:'sine', gain:.6,
    mel: [16,null,null,14,12,null,null,null, 14,null,null,12,11,null,null,null,
          12,null,null,11,9,null,null,7, 11,null,12,null,null,null,null,null],
    bass:[0,null,null,null,-8,null,null,null, -5,null,null,null,-7,null,null,null,
          -3,null,null,null,-8,null,null,null, -7,null,null,null,0,null,null,null],
    perc:[0,0,3,0,0,0,3,0, 0,0,3,0,0,0,3,0, 0,0,3,0,0,0,3,0, 0,0,3,0,0,0,3,3] },
  dark: { bpm: 92, wave:'sawtooth', bassWave:'square', gain:.4,
    mel: [0,null,3,null,6,null,3,null, 7,null,6,null,3,null,0,null,
          -2,null,1,null,4,null,1,null, 0,null,null,null,null,null,null,null],
    bass:[-12,null,null,-12,null,null,-12,null, -14,null,null,-14,null,null,-14,null,
          -16,null,null,-16,null,null,-16,null, -12,-12,null,-12,null,null,null,null],
    perc:[1,0,0,1,0,0,1,0, 1,0,0,1,0,0,1,0, 1,0,0,1,0,0,1,0, 1,0,1,0,1,0,1,1] },
  battle: { bpm: 140, wave:'square', bassWave:'square', gain:.45,
    mel: [12,12,null,12,15,null,12,null, 17,null,15,null,12,null,10,null,
          12,12,null,12,15,null,19,null, 17,15,12,15,17,null,null,null],
    bass:[0,null,0,0,null,0,0,null, -2,null,-2,-2,null,-2,-2,null,
          -4,null,-4,-4,null,-4,-4,null, -2,null,-2,null,-2,-2,-2,null],
    perc:[1,0,2,0,1,0,2,0, 1,0,2,0,1,0,2,2, 1,0,2,0,1,0,2,0, 1,2,1,2,1,0,2,2] },
  boss: { bpm: 152, wave:'sawtooth', bassWave:'square', gain:.42,
    mel: [0,null,0,3,null,3,6,null, 8,null,7,6,7,null,3,null,
          0,null,0,3,null,3,6,null, 10,null,8,7,8,null,null,null],
    bass:[-12,-12,null,-12,-12,null,-12,-12, -9,-9,null,-9,-9,null,-9,-9,
          -8,-8,null,-8,-8,null,-8,-8, -5,-5,null,-5,-5,null,-5,-5],
    perc:[1,2,1,2,1,2,1,2, 1,2,1,2,1,2,1,2, 1,2,1,2,1,2,1,2, 1,2,1,2,1,2,2,2] },
  inn: { bpm: 76, wave:'triangle', bassWave:'sine', gain:.55,
    mel: [12,null,null,16,null,null,14,null, 12,null,11,null,9,null,null,null,
          7,null,null,11,null,null,12,null, 14,null,12,null,null,null,null,null],
    bass:[0,null,null,null,4,null,null,null, -3,null,null,null,-5,null,null,null,
          -7,null,null,null,-5,null,null,null, 0,null,null,null,null,null,null,null],
    perc:[0,0,0,0,0,0,0,0] },
};

function schedulePercussion(kind, t){
  if (kind === 0) return;
  const g = ctx.createGain(); g.connect(bgmGain);
  if (kind === 3){ // shimmer (snow)
    const o = ctx.createOscillator(); o.type='sine'; o.frequency.value = 2200 + Math.random()*600;
    o.connect(g); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.3);
    o.start(t); o.stop(t+0.3); return;
  }
  const len = kind===1 ? 0.1 : 0.06;
  const buf = ctx.createBuffer(1, ctx.sampleRate*len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = kind===1 ? 'lowpass' : 'highpass';
  f.frequency.value = kind===1 ? 300 : 5000;
  src.connect(f); f.connect(g);
  g.gain.setValueAtTime(kind===1 ? 0.5 : 0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t+len);
  src.start(t);
}

function scheduleNote(freq, t, dur, wave, vol){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = freq;
  o.connect(g); g.connect(bgmGain);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t+0.01);
  g.gain.setValueAtTime(vol, t+dur*0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}

export function playSong(name){
  if (!ctx || current === name) { current = name; return; }
  stopSong();
  const song = SONGS[name];
  if (!song) return;
  current = name;
  const eighth = 60 / song.bpm / 2;
  const vol = song.gain ?? 0.5;
  let step = 0;
  let nextT = ctx.currentTime + 0.05;
  const mLen = song.mel.length, bLen = song.bass.length, pLen = song.perc.length;
  timer = setInterval(()=>{
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.35){
      const m = song.mel[step % mLen];
      if (m !== null) scheduleNote(N(m+12), nextT, eighth*1.7, song.wave, vol*0.22);
      const b = song.bass[step % bLen];
      if (b !== null) scheduleNote(N(b), nextT, eighth*1.8, song.bassWave, vol*0.3);
      schedulePercussion(song.perc[step % pLen], nextT);
      nextT += eighth;
      step++;
    }
  }, 120);
}

export function stopSong(){
  if (timer){ clearInterval(timer); timer = null; }
  current = null;
}

// ---- SFX ----
function blip(freq, dur, wave='square', vol=0.25, slide=0){
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq+slide), t+dur);
  o.connect(g); g.connect(sfxGain);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}
function noiseHit(dur=0.15, vol=0.4, freq=800){
  if (!ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t);
}

export const SFX = {
  tap()     { blip(660, .07, 'square', .15); },
  confirm() { blip(660, .08, 'square', .2); setTimeout(()=>blip(990,.1,'square',.2), 70); },
  cancel()  { blip(440, .1, 'square', .18, -200); },
  hit()     { noiseHit(.12, .5, 700); blip(180, .12, 'square', .3, -80); },
  crit()    { noiseHit(.18, .6, 500); blip(140, .2, 'sawtooth', .4, -60); },
  magic()   { blip(880, .3, 'sine', .25, 600); setTimeout(()=>blip(1320,.25,'sine',.2,400), 90); },
  fire()    { noiseHit(.3, .45, 400); blip(220, .3, 'sawtooth', .2, -120); },
  thunder() { noiseHit(.35, .6, 2500); blip(90, .4, 'sawtooth', .35, -40); },
  heal()    { [523,659,784,1047].forEach((f,i)=> setTimeout(()=>blip(f,.18,'sine',.2), i*80)); },
  coin()    { blip(990, .06, 'square', .22); setTimeout(()=>blip(1319,.15,'square',.22), 60); },
  levelup() { [523,659,784,1047,1319].forEach((f,i)=> setTimeout(()=>blip(f,.16,'square',.2), i*90)); },
  charm()   { [880,1100,932].forEach((f,i)=> setTimeout(()=>blip(f,.14,'sine',.2), i*90)); },
  hurt()    { blip(300, .15, 'square', .3, -150); },
  down()    { [400,330,262,196].forEach((f,i)=> setTimeout(()=>blip(f,.15,'triangle',.25), i*100)); },
  gacha()   { [660,880,660,880,1320].forEach((f,i)=> setTimeout(()=>blip(f,.1,'square',.18), i*70)); },
  eat()     { blip(300,.08,'square',.2); setTimeout(()=>blip(400,.08,'square',.2), 90); setTimeout(()=>blip(520,.12,'square',.2), 180); },
  step()    { noiseHit(.04, .08, 1200); },
  kizuna()  { [784,988,1175].forEach((f,i)=> setTimeout(()=>blip(f,.16,'sine',.18), i*80)); },
  fanfare() { [523,523,523,659,784,1047].forEach((f,i)=> setTimeout(()=>blip(f, i===5?.5:.13, 'square', .22), i*110)); },
  laugh()   { [600,500,600,500].forEach((f,i)=> setTimeout(()=>blip(f,.07,'square',.15), i*80)); },
};
