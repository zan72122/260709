// がめん — HUD, popups, speech bubbles, title / finish screens.
// All text is hiragana/katakana so a 4-year-old's grown-up can read it aloud.

import { ALL_SWEET_IDS, sweetInfo } from './sweets.js';

const $ = (id) => document.getElementById(id);

const JUDGE_TEXT = {
  perfect: ['ぴったり！', 'すごーい！', 'てんさい！'],
  good: ['いいね！', 'のった〜！', 'やったね！'],
  edge: ['わわっ！', 'あぶな〜い！', 'ぐらぐら〜！'],
  miss: ['あらら〜', 'どんまい！', 'つぎつぎ！'],
  rescue: ['とりさん ナイス！', 'たすかった〜！'],
};

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.els = {
      title: $('title-screen'),
      finish: $('finish-screen'),
      hud: $('hud'),
      height: $('height-num'),
      best: $('best-line'),
      hearts: $('hearts'),
      next: $('next-box'),
      combo: $('combo-pop'),
      banner: $('banner'),
      steady: $('steady-overlay'),
      steadyFill: $('steady-fill'),
      pops: $('pops'),
      bubbles: $('bubbles'),
      muteBtns: [...document.querySelectorAll('.mute-btn')],
      titleBest: $('title-best'),
      finStats: $('fin-stats'),
      finStars: $('fin-stars'),
      finZukan: $('fin-zukan'),
      finTitle: $('fin-title'),
    };
    $('start-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); handlers.onStart(); });
    $('retry-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); handlers.onRetry(); });
    $('home-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); handlers.onHome(); });
    for (const b of this.els.muteBtns)
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); handlers.onMute(); });
    this._bannerTimer = null;
  }

  setMuted(m) {
    for (const b of this.els.muteBtns) b.textContent = m ? '🔇' : '🔊';
  }

  // ------------------------------------------------------------ screens

  showTitle(bestCm) {
    this.els.title.classList.remove('hidden');
    this.els.finish.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.els.titleBest.textContent = bestCm > 0 ? `さいこうきろく：${bestCm} cm` : 'めざせ すいーつタワー！';
  }

  showHud() {
    this.els.title.classList.add('hidden');
    this.els.finish.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
  }

  showFinish({ heightCm, count, perfects, stars, unlocked, newUnlocks, isNewBest }) {
    this.els.hud.classList.add('hidden');
    this.els.finish.classList.remove('hidden');
    this.els.finTitle.textContent = isNewBest ? '🎉 しんきろく！ 🎉' : 'よくがんばりました！';
    this.els.finStats.innerHTML =
      `<div class="fin-row"><span>たかさ</span><b>${heightCm} cm</b></div>` +
      `<div class="fin-row"><span>つんだ かず</span><b>${count} こ</b></div>` +
      `<div class="fin-row"><span>ぴったり</span><b>${perfects} かい</b></div>`;
    this.els.finStars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'fin-star' + (i < stars ? ' lit' : '');
      s.style.animationDelay = `${0.3 + i * 0.35}s`;
      s.textContent = '⭐';
      this.els.finStars.appendChild(s);
    }
    // sweets picture book
    this.els.finZukan.innerHTML = '';
    for (const id of ALL_SWEET_IDS) {
      const info = sweetInfo(id);
      const cell = document.createElement('div');
      const got = unlocked.has(id);
      cell.className = 'zukan-cell' + (got ? '' : ' locked') + (newUnlocks.has(id) ? ' new' : '');
      cell.innerHTML = got
        ? `<span class="z-emoji">${info.emoji}</span><span class="z-name">${info.name}</span>`
        : `<span class="z-emoji">❓</span><span class="z-name">？？？</span>`;
      this.els.finZukan.appendChild(cell);
    }
  }

  // ------------------------------------------------------------ HUD bits

  setHeight(cm) { this.els.height.textContent = cm; }

  setBest(cm) {
    this.els.best.textContent = cm > 0 ? `さいこう ${cm} cm` : '';
  }

  setHearts(n) {
    this.els.hearts.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'heart' + (i < n ? '' : ' lost');
      s.textContent = '🍓';
      this.els.hearts.appendChild(s);
    }
  }

  setNext(emoji, name) {
    this.els.next.innerHTML = `<span class="next-label">つぎは</span><span class="next-emoji">${emoji}</span><span class="next-name">${name}</span>`;
  }

  combo(n) {
    if (n < 2) return;
    const el = this.els.combo;
    el.textContent = `れんぞく ぴったり ×${n}！`;
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
  }

  judgePop(x, y, type, textOverride) {
    const el = document.createElement('div');
    el.className = `pop pop-${type}`;
    const opts = JUDGE_TEXT[type] || JUDGE_TEXT.good;
    el.textContent = textOverride || opts[Math.floor(Math.random() * opts.length)];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.els.pops.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  banner(text, sub = '') {
    const el = this.els.banner;
    el.innerHTML = `<div class="banner-main">${text}</div>` + (sub ? `<div class="banner-sub">${sub}</div>` : '');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  bubble(text, x, y, life = 1800) {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.els.bubbles.appendChild(el);
    setTimeout(() => el.classList.add('out'), life - 300);
    setTimeout(() => el.remove(), life);
  }

  steady(show, frac = 0) {
    this.els.steady.classList.toggle('hidden', !show);
    if (show) this.els.steadyFill.style.width = `${Math.round(frac * 100)}%`;
  }
}
