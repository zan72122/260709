// DOM overlay: title screen, stage picker, HUD with progress bubble-meter,
// celebration. All text in hiragana for small players.

export class UI {
  constructor(stages, callbacks) {
    this.cb = callbacks;
    this.stages = stages;
    this.root = document.getElementById('ui');
    this._build();
    this.progress = 0;
  }

  _el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent || this.root).appendChild(e);
    return e;
  }

  _build() {
    // ---- title
    this.title = this._el('div', 'screen title-screen');
    this._el('div', 'game-title', this.title, 'あわあわ<br>へんてこ<br>おそうじロール');
    this._el('div', 'game-sub', this.title, 'ころころ ふしぎな かたち');
    const play = this._el('button', 'big-btn play-btn', this.title, 'あそぶ！');
    play.addEventListener('pointerdown', () => { this.cb.unlockAudio(); this.showSelect(); });

    // ---- stage select
    this.select = this._el('div', 'screen select-screen hidden');
    this._el('div', 'select-title', this.select, 'どこで あそぶ？');
    const grid = this._el('div', 'stage-grid', this.select);
    this.stages.forEach((st, i) => {
      const card = this._el('button', 'stage-card', grid,
        `<div class="stage-emoji">${st.emoji}</div><div class="stage-name">${st.name}</div><div class="stage-desc">${st.desc}</div><div class="stage-stars" id="stars-${st.id}"></div>`);
      card.addEventListener('pointerdown', () => { this.cb.unlockAudio(); this.cb.startStage(i); });
    });

    // ---- HUD
    this.hud = this._el('div', 'hud hidden');
    const top = this._el('div', 'hud-top', this.hud);
    this.homeBtn = this._el('button', 'icon-btn', top, '🏠');
    this.goalText = this._el('div', 'goal-pill', top, '');
    const right = this._el('div', 'hud-right', top);
    this.soundBtn = this._el('button', 'icon-btn', right, '🔊');
    this.resetBtn = this._el('button', 'icon-btn', right, '↺');
    const meterWrap = this._el('div', 'meter-wrap', this.hud);
    this.meterFill = this._el('div', 'meter-fill', this._el('div', 'meter', meterWrap));
    this.meterIcon = this._el('div', 'meter-icon', meterWrap, '🫧');
    this.homeBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.cb.goHome(); });
    this.resetBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.cb.resetStage(); });
    this.soundBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const on = this.cb.toggleSound();
      this.soundBtn.textContent = on ? '🔊' : '🔇';
    });

    // swipe hint
    this.hint = this._el('div', 'hint hidden', this.hud, '👆 スワイプで ころがそう！');

    // ---- celebration
    this.celebrate = this._el('div', 'screen celebrate hidden');
    this._el('div', 'celebrate-burst', this.celebrate, '🎉');
    this._el('div', 'celebrate-title', this.celebrate, 'できたー！！');
    this.celebrateStars = this._el('div', 'celebrate-stars', this.celebrate, '⭐⭐⭐');
    const row = this._el('div', 'celebrate-row', this.celebrate);
    const again = this._el('button', 'big-btn', row, 'もういちど');
    const next = this._el('button', 'big-btn', row, 'つぎへ →');
    again.addEventListener('pointerdown', () => this.cb.resetStage());
    next.addEventListener('pointerdown', () => this.cb.nextStage());
  }

  showTitle() {
    this.title.classList.remove('hidden');
    this.select.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.celebrate.classList.add('hidden');
  }

  showSelect() {
    this.title.classList.add('hidden');
    this.select.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.celebrate.classList.add('hidden');
    // refresh stars
    for (const st of this.stages) {
      const el = document.getElementById(`stars-${st.id}`);
      if (el) el.textContent = this.cb.getStars(st.id) ? '⭐' : '';
    }
  }

  showGame(stage, firstTime) {
    this.title.classList.add('hidden');
    this.select.classList.add('hidden');
    this.celebrate.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.goalText.textContent = stage.goal.text;
    this.meterIcon.textContent = stage.emoji;
    this.setProgress(0);
    if (firstTime) {
      this.hint.classList.remove('hidden');
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => this.hint.classList.add('hidden'), 5000);
    }
  }

  hideHint() { this.hint.classList.add('hidden'); }

  setProgress(p) {
    p = Math.max(0, Math.min(1, p));
    if (Math.abs(p - this.progress) < 0.003) return;
    this.progress = p;
    this.meterFill.style.width = `${(p * 100).toFixed(1)}%`;
  }

  showCelebrate() {
    this.celebrate.classList.remove('hidden');
  }
}
