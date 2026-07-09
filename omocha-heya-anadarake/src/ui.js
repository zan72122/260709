// Icon-only DOM UI: a pre-reader must be able to run everything.
// Buttons are emoji, progress is a filling bar, rounds are crowns.

export class UI {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.soundOn = true;
    this._build();
  }

  _el(tag, cls, html, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    (parent || this.root).appendChild(e);
    return e;
  }

  _build() {
    // ---- title
    this.title = this._el('div', 'screen title-screen');
    this._el('div', 'game-hole', '🕳️', this.title);
    this._el('div', 'game-title', 'おもちゃのへや<br>あなだらけ!', this.title);
    this._el('div', 'game-sub', 'ゆびで タッチして あなを うごかそう', this.title);
    const play = this._el('button', 'big-btn play-btn', '▶ あそぶ', this.title);
    play.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.h.onPlay(); });

    // ---- HUD
    this.hud = this._el('div', 'hud hidden');
    const top = this._el('div', 'hud-top', '', this.hud);
    this.soundBtn = this._el('button', 'icon-btn', '🔊', top);
    this.soundBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.soundOn = !this.soundOn;
      this.soundBtn.textContent = this.soundOn ? '🔊' : '🔇';
      this.h.onSoundToggle(this.soundOn);
    });
    this.crowns = this._el('div', 'crown-row', '', top);
    const right = this._el('div', 'hud-right', '', top);
    this.resetBtn = this._el('button', 'icon-btn', '↻', right);
    this.resetBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.confirm.classList.remove('hidden'); });

    const meterWrap = this._el('div', 'meter-wrap', '', this.hud);
    this._el('span', 'meter-icon', '🕳️', meterWrap);
    const meter = this._el('div', 'meter', '', meterWrap);
    this.meterFill = this._el('div', 'meter-fill', '', meter);
    this._el('span', 'meter-icon', '🧸', meterWrap);

    this.launchBtn = this._el('button', 'launch-btn hidden', '🚀', this.hud);
    this.launchBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.h.onLaunch(); });

    this.finger = this._el('div', 'hint-finger hidden', '👆', this.hud);

    // ---- reset confirm (broom = start over?)
    this.confirm = this._el('div', 'screen confirm-screen hidden');
    const card = this._el('div', 'confirm-card', '', this.confirm);
    this._el('div', 'confirm-emoji', '🧹➡️🕳️', card);
    const row = this._el('div', 'confirm-row', '', card);
    const yes = this._el('button', 'confirm-btn confirm-yes', '⭕', row);
    const no = this._el('button', 'confirm-btn confirm-no', '✖️', row);
    yes.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.confirm.classList.add('hidden'); this.h.onReset(); });
    no.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.confirm.classList.add('hidden'); });

    // ---- celebration
    this.celebrate = this._el('div', 'screen celebrate hidden');
    this._el('div', 'celebrate-burst', '🎉', this.celebrate);
    this.celebrateCrowns = this._el('div', 'celebrate-crowns', '', this.celebrate);
    const next = this._el('button', 'big-btn play-btn', '▶', this.celebrate);
    next.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.h.onNext(); });
  }

  showTitle() {
    this.title.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.celebrate.classList.add('hidden');
  }

  showGame() {
    this.title.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.celebrate.classList.add('hidden');
  }

  setMeter(f) {
    this.meterFill.style.width = `${Math.round(f * 100)}%`;
  }

  setCrowns(n) {
    this.crowns.textContent = n > 0 ? '👑'.repeat(Math.min(n, 8)) : '';
  }

  setLaunchVisible(v) {
    this.launchBtn.classList.toggle('hidden', !v);
  }

  showHint(v) {
    this.finger.classList.toggle('hidden', !v);
  }

  showCelebrate(crowns) {
    this.celebrateCrowns.textContent = '👑'.repeat(Math.min(Math.max(crowns, 1), 8));
    this.celebrate.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }
}
