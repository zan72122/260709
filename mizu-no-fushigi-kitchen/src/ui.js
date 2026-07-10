// みずのふしぎキッチン — DOM の HUD (温度レバー・温度計・バナー・紙ふぶき)。

import { T_MIN, T_MAX } from './thermo.js';

const PHASE_LABEL = {
  ice: ['こおり', '🧊'],
  slush: ['こおりみず', '🧊💧'],
  water: ['みず', '💧'],
  freeze: ['こおっていく…', '❄️'],
  melt: ['とけていく…', '💧'],
  boil: ['ぐつぐつ!', '🫧'],
  steam: ['ゆげのくも', '☁️'],
  rain: ['あめがふる!', '🌧️'],
};

export class UI {
  constructor(cb) {
    this.cb = cb;
    this.$ = id => document.getElementById(id);
    this.title = this.$('title-screen');
    this.hud = this.$('hud');
    this.banner = this.$('banner');
    this.phasePill = this.$('phase-pill');
    this.knob = this.$('lever-knob');
    this.track = this.$('lever-track');
    this.fill = this.$('lever-fill');
    this.thermoFill = this.$('thermo-fill');
    this.thermoFace = this.$('thermo-face');
    this.thermoDigit = this.$('thermo-digit');
    this.leverValue = 1 / 3.5; // 20℃ 相当からスタート
    this._dragging = false;
    this._bannerTimer = 0;

    this.$('btn-start').addEventListener('pointerdown', e => {
      e.preventDefault();
      this.title.classList.add('fade-out');
      setTimeout(() => this.title.classList.add('hidden'), 650);
      this.hud.classList.remove('hidden');
      cb.onStart();
    });

    this.$('btn-mute').addEventListener('pointerdown', e => {
      e.preventDefault();
      const b = e.currentTarget;
      const muted = b.dataset.muted !== '1';
      b.dataset.muted = muted ? '1' : '0';
      b.textContent = muted ? '🔇' : '🔊';
      cb.onMute(muted);
    });

    this.$('btn-reset').addEventListener('pointerdown', e => {
      e.preventDefault();
      cb.onReset();
      this.setLever(1 / 3.5);
    });

    // --- レバー操作
    const onMove = e => {
      if (!this._dragging) return;
      e.preventDefault();
      this._setFromEvent(e);
    };
    this.track.addEventListener('pointerdown', e => {
      e.preventDefault();
      this._dragging = true;
      this.track.setPointerCapture(e.pointerId);
      this._setFromEvent(e);
    });
    this.track.addEventListener('pointermove', onMove);
    const end = () => { this._dragging = false; };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);

    // ❄️ / 🔥 ボタン: はしまでスライド
    this.$('btn-cold').addEventListener('pointerdown', e => {
      e.preventDefault(); this.animateLeverTo(0); cb.onUiTap();
    });
    this.$('btn-hot').addEventListener('pointerdown', e => {
      e.preventDefault(); this.animateLeverTo(1); cb.onUiTap();
    });
  }

  _setFromEvent(e) {
    const r = this.track.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    this.setLever(f);
  }

  setLever(f) {
    this.leverValue = f;
    this._animTarget = null;
    this._applyLever();
  }

  animateLeverTo(f) { this._animTarget = f; }

  _applyLever() {
    const f = this.leverValue;
    this.knob.style.left = `${f * 100}%`;
    this.fill.style.width = `${f * 100}%`;
    this.knob.textContent = f < 0.18 ? '❄️' : f > 0.72 ? '🔥' : '💧';
    const t = T_MIN + f * (T_MAX - T_MIN);
    this.cb.onTarget(t);
  }

  /** 実際の温度を温度計へ */
  setTemp(temp) {
    const f = (temp - T_MIN) / (T_MAX - T_MIN);
    this.thermoFill.style.height = `${8 + f * 84}%`;
    const hue = 200 - f * 200; // 青→赤
    this.thermoFill.style.background = `linear-gradient(180deg, hsl(${hue},85%,62%), hsl(${hue},85%,52%))`;
    this.thermoFace.textContent = temp <= 2 ? '🥶' : temp < 45 ? '😊' : temp < 85 ? '😅' : '🥵';
    this.thermoDigit.textContent = `${Math.round(temp)}°`;
  }

  setPhase(name) {
    const [label, icon] = PHASE_LABEL[name] || PHASE_LABEL.water;
    if (this._phaseName === name) return;
    this._phaseName = name;
    this.phasePill.innerHTML = `<span class="pp-icon">${icon}</span>${label}`;
    this.phasePill.classList.remove('pop');
    void this.phasePill.offsetWidth;
    this.phasePill.classList.add('pop');
  }

  /** 大きなおいわいバナー */
  showBanner(text, emoji) {
    this.banner.innerHTML = `<span class="bn-emoji">${emoji}</span><span>${text}</span><span class="bn-emoji">${emoji}</span>`;
    this.banner.classList.remove('hidden', 'show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.banner.classList.remove('show'), 2400);
  }

  confetti(emojis) {
    const host = this.$('confetti');
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.className = 'confetto';
      s.textContent = emojis[i % emojis.length];
      s.style.left = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 0.5}s`;
      s.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      s.style.fontSize = `${16 + Math.random() * 22}px`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 3600);
    }
  }

  update(dt) {
    if (this._animTarget != null) {
      const d = this._animTarget - this.leverValue;
      if (Math.abs(d) < 0.01) {
        this.leverValue = this._animTarget;
        this._animTarget = null;
      } else {
        this.leverValue += d * Math.min(1, dt * 6);
      }
      this.knob.style.left = `${this.leverValue * 100}%`;
      this.fill.style.width = `${this.leverValue * 100}%`;
      this.knob.textContent = this.leverValue < 0.18 ? '❄️' : this.leverValue > 0.72 ? '🔥' : '💧';
      this.cb.onTarget(T_MIN + this.leverValue * (T_MAX - T_MIN));
    }
  }
}
