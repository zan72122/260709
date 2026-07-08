// ---------------------------------------------------------------------------
// ui.js — HTML overlay: mission card, colour palette, buttons, toasts, hint.
// ---------------------------------------------------------------------------
import { FLAVOURS } from './colors.js';

export class UI {
  constructor() {
    this.el = {
      splash: document.getElementById('splash'),
      mission: document.getElementById('mission'),
      missionIcon: document.getElementById('missionIcon'),
      missionText: document.getElementById('missionText'),
      missionBar: document.getElementById('missionBar'),
      missionStars: document.getElementById('missionStars'),
      palette: document.getElementById('palette'),
      btnSound: document.getElementById('btnSound'),
      btnReset: document.getElementById('btnReset'),
      hint: document.getElementById('handleHint'),
      toast: document.getElementById('toast'),
    };
    this.onFlavour = null;
    this.onSound = null;
    this.onReset = null;
    this.activeFlavour = FLAVOURS[0];
    this._toastTimer = null;
    this._buildPalette();

    this.el.btnSound.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.onSound) this.onSound();
    });
    this.el.btnReset.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.onReset) this.onReset();
    });
  }

  _buildPalette() {
    for (const f of FLAVOURS) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = `radial-gradient(circle at 35% 30%, ${lighten(f.css)}, ${f.css} 65%)`;
      b.style.color = f.css;
      b.setAttribute('aria-label', f.name);
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.setFlavour(f);
        if (this.onFlavour) this.onFlavour(f);
      });
      b.dataset.key = f.key;
      this.el.palette.appendChild(b);
    }
    this.setFlavour(FLAVOURS[0]);
  }

  setFlavour(f) {
    this.activeFlavour = f;
    for (const b of this.el.palette.children) {
      b.classList.toggle('active', b.dataset.key === f.key);
    }
  }

  setSoundIcon(muted) {
    this.el.btnSound.textContent = muted ? '🔇' : '🔊';
  }

  hideSplash() { this.el.splash.classList.add('hidden'); }

  // --- mission card ---
  showMission(mission, stars) {
    this.el.missionText.textContent = mission.text;
    const g = this.el.missionIcon.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 88, 88);
    mission.icon(g);
    this.el.missionStars.textContent = stars > 0 ? '⭐'.repeat(Math.min(stars, 8)) + (stars > 8 ? `×${stars}` : '') : '';
    this.el.mission.classList.add('pop');
    setTimeout(() => this.el.mission.classList.remove('pop'), 450);
  }

  setProgress(p) {
    this.el.missionBar.style.width = `${Math.round(p * 100)}%`;
  }

  updateStars(stars) {
    this.el.missionStars.textContent = stars > 0 ? '⭐'.repeat(Math.min(stars, 8)) + (stars > 8 ? `×${stars}` : '') : '';
  }

  toast(text, ms = 1600) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // --- crank hint over the handle viewport ---
  showHint(rect) {
    const h = this.el.hint;
    h.classList.remove('hidden');
    h.style.left = `${rect.x + rect.size / 2 - 60}px`;
    h.style.top = `${rect.y + rect.size / 2 - 90}px`;
    h.style.width = '120px';
  }

  hideHint() { this.el.hint.classList.add('hidden'); }

  // --- responsive: palette placement ---
  layout(w, h, handleRect) {
    const portrait = h > w;
    const pal = this.el.palette;
    if (portrait) {
      pal.style.flexDirection = 'column';
      pal.style.left = 'calc(env(safe-area-inset-left) + 10px)';
      pal.style.right = 'auto';
      pal.style.bottom = `calc(env(safe-area-inset-bottom) + 14px)`;
      pal.style.top = 'auto';
      pal.style.transform = 'none';
    } else {
      pal.style.flexDirection = 'row';
      pal.style.left = 'calc(env(safe-area-inset-left) + 14px)';
      pal.style.right = 'auto';
      pal.style.bottom = 'calc(env(safe-area-inset-bottom) + 12px)';
      pal.style.top = 'auto';
      pal.style.transform = 'none';
    }
    if (!this.el.hint.classList.contains('hidden')) this.showHint(handleRect);
  }
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + 70);
  const g = Math.min(255, ((n >> 8) & 255) + 70);
  const b = Math.min(255, (n & 255) + 70);
  return `rgb(${r},${g},${b})`;
}
