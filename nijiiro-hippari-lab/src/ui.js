// 大きなボタンとひらがなだけの、よんさい向けUI
import { LAYOUTS } from './pins.js';
import { loadCards, deleteCard } from './gallery.js';

export const THREAD_COLORS = [
  0xff5f7e, 0xff9d3c, 0xffd93c, 0x5ad46e, 0x4fc3f7, 0x7d6bff, 0xf56bff, 0xffffff,
];

export const TOOLS = [
  { id: 'ito', icon: '🧵', label: 'いと' },
  { id: 'omakase', icon: '✨', label: 'おまかせ' },
  { id: 'kiri', icon: '💨', label: 'きりふき' },
  { id: 'mizu', icon: '💧', label: 'いろみず' },
  { id: 'hikari', icon: '🔦', label: 'ひかり' },
  { id: 'hasami', icon: '✂️', label: 'はさみ' },
];

const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');

export function createUI(cb) {
  const root = document.getElementById('ui');
  root.innerHTML = `
    <div id="titleScreen">
      <div class="titleClouds">☁️ ☁️ ☁️</div>
      <h1 class="titleText">にじいろ<br>ひっぱりもようラボ</h1>
      <div class="titleSub">🧵 いとを ひっぱると もようが そだつよ 💧</div>
      <button id="startBtn">はじめる ▶</button>
      <div class="titleNote">おとが でるよ 🔊</div>
    </div>

    <div id="hud" class="hidden">
      <div id="topBar">
        <div id="shapeRow">
          ${Object.entries(LAYOUTS).map(([k, v], i) =>
            `<button class="shapeBtn ${i === 0 ? 'active' : ''}" data-shape="${k}" aria-label="${v.label}">
               <span class="shapeIcon">${v.icon}</span><span class="shapeLabel">${v.label}</span>
             </button>`).join('')}
        </div>
        <div id="goalPill">
          <span id="goalIcon">🧵</span>
          <span id="goalText"></span>
          <span id="goalStars"></span>
        </div>
        <div id="sysRow">
          <button class="sysBtn" id="cameraBtn" aria-label="カードにのこす">📷</button>
          <button class="sysBtn" id="galleryBtn" aria-label="まどかざり">🖼️<span id="galleryBadge" class="hidden"></span></button>
          <button class="sysBtn" id="soundBtn" aria-label="おと">🔊</button>
          <button class="sysBtn" id="washBtn" aria-label="あらう">🫧</button>
        </div>
      </div>

      <div id="bottomBar">
        <div id="paletteRow">
          <div id="colorChips">
            ${THREAD_COLORS.map((c, i) =>
              `<button class="chip ${i === 0 ? 'active' : ''}" data-color="${c}" style="background:${hexCss(c)}"></button>`).join('')}
          </div>
          <button id="thickBtn" aria-label="いとのふとさ"><span id="thickDot">●</span> ふとさ</button>
        </div>
        <div id="toolRow">
          ${TOOLS.map((t, i) =>
            `<button class="toolBtn ${i === 0 ? 'active' : ''}" data-tool="${t.id}">
               <span class="toolIcon">${t.icon}</span><span class="toolLabel">${t.label}</span>
             </button>`).join('')}
        </div>
      </div>

      <div id="praise" class="hidden"></div>
      <div id="hint" class="hidden"></div>
      <div id="weaveNote" class="hidden">✨ もようを そだててるよ… <span class="small">(もういちど おすと とまるよ)</span></div>
      <div id="flash"></div>
    </div>

    <div id="cardModal" class="modal hidden">
      <div class="modalInner">
        <div class="polaroid"><img id="cardImg" alt="できた もよう"><div class="polaroidCaption">できたよ！ 🌈</div></div>
        <button class="bigClose" id="cardClose">とじる</button>
      </div>
    </div>

    <div id="galleryModal" class="modal hidden">
      <div class="modalInner wide">
        <h2 class="modalTitle">🖼️ まどかざり</h2>
        <div id="galleryGrid"></div>
        <button class="bigClose" id="galleryClose">とじる</button>
      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  const state = {
    tool: 'ito',
    color: THREAD_COLORS[0],
    thickness: 0,
    soundOn: true,
  };

  // ---- タイトル ----
  $('#startBtn').addEventListener('click', () => {
    $('#titleScreen').classList.add('fadeout');
    setTimeout(() => $('#titleScreen').remove(), 650);
    $('#hud').classList.remove('hidden');
    cb.onStart();
  });

  // ---- どうぐ ----
  root.querySelectorAll('.toolBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'omakase') {
        cb.onAutoWeave();
        return;
      }
      state.tool = tool;
      root.querySelectorAll('.toolBtn').forEach(b => b.classList.toggle('active', b === btn));
      updatePaletteVisibility();
      cb.onToolChange(tool);
    });
  });

  function updatePaletteVisibility() {
    const showColors = state.tool === 'ito' || state.tool === 'mizu';
    $('#paletteRow').style.visibility = showColors ? 'visible' : 'hidden';
    $('#thickBtn').style.display = state.tool === 'ito' ? '' : 'none';
  }

  // ---- いろ ----
  root.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.color = parseInt(chip.dataset.color, 10);
      root.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      cb.onColorChange(state.color);
    });
  });

  // ---- ふとさ ----
  const thickChars = ['●', '⬤', '⚫'];
  const thickSizes = ['0.8em', '1.05em', '1.3em'];
  $('#thickBtn').addEventListener('click', () => {
    state.thickness = (state.thickness + 1) % 3;
    const d = $('#thickDot');
    d.textContent = '●';
    d.style.fontSize = thickSizes[state.thickness];
    cb.onThicknessChange(state.thickness);
  });

  // ---- かたち ----
  root.querySelectorAll('.shapeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.shapeBtn').forEach(b => b.classList.toggle('active', b === btn));
      cb.onShapeChange(btn.dataset.shape);
    });
  });

  // ---- システムボタン ----
  $('#cameraBtn').addEventListener('click', () => cb.onCapture());
  $('#washBtn').addEventListener('click', () => cb.onWash());
  $('#soundBtn').addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    $('#soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
    cb.onSoundToggle(state.soundOn);
  });
  $('#galleryBtn').addEventListener('click', () => api.showGallery());
  $('#cardClose').addEventListener('click', () => $('#cardModal').classList.add('hidden'));
  $('#galleryClose').addEventListener('click', () => $('#galleryModal').classList.add('hidden'));

  // ---- 公開API ----
  let praiseTimer = 0;
  let hintTimer = 0;
  const api = {
    state,

    setGoal(goal, progress) {
      $('#goalIcon').textContent = goal.icon;
      $('#goalText').textContent = goal.text;
      let stars = '';
      for (let i = 0; i < goal.target; i++) stars += i < progress ? '⭐' : '☆';
      if (goal.target > 6) stars = `${progress} / ${goal.target} ⭐`;
      $('#goalStars').textContent = stars;
      const pill = $('#goalPill');
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
    },

    praise(text) {
      const el = $('#praise');
      el.textContent = text;
      el.classList.remove('hidden', 'pop');
      void el.offsetWidth;
      el.classList.add('pop');
      clearTimeout(praiseTimer);
      praiseTimer = setTimeout(() => el.classList.add('hidden'), 2600);
    },

    hint(text) {
      const el = $('#hint');
      el.textContent = text;
      el.classList.remove('hidden');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => el.classList.add('hidden'), 5000);
    },

    hideHint() { $('#hint').classList.add('hidden'); },

    setWeaving(on) {
      $('#weaveNote').classList.toggle('hidden', !on);
      root.querySelector('[data-tool="omakase"]').classList.toggle('weaving', on);
    },

    flash() {
      const f = $('#flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
    },

    showCard(dataUrl) {
      $('#cardImg').src = dataUrl;
      $('#cardModal').classList.remove('hidden');
      api.updateGalleryBadge();
    },

    updateGalleryBadge() {
      const n = loadCards().length;
      const b = $('#galleryBadge');
      b.textContent = n;
      b.classList.toggle('hidden', n === 0);
    },

    showGallery() {
      const grid = $('#galleryGrid');
      const cards = loadCards();
      grid.innerHTML = cards.length === 0
        ? '<div class="galleryEmpty">まだ カードが ないよ。<br>📷 で のこしてみてね！</div>'
        : cards.map((c, i) =>
            `<div class="gCard"><img src="${c.img}" alt="もよう ${i + 1}">
             <button class="gDel" data-i="${i}" aria-label="けす">✕</button></div>`).join('');
      grid.querySelectorAll('.gDel').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCard(parseInt(btn.dataset.i, 10));
          api.showGallery();
          api.updateGalleryBadge();
        });
      });
      $('#galleryModal').classList.remove('hidden');
      cb.onGalleryOpen && cb.onGalleryOpen();
    },
  };

  updatePaletteVisibility();
  api.updateGalleryBadge();
  return api;
}
