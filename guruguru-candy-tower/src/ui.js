// ui.js — タイトル・ボタン・ふきだし・ケーキ進捗・やったーバナー(DOM)
export class UI {
  constructor({ onStart, onGuideToggle, onMuteToggle, onReset }) {
    this.titleEl = document.getElementById('title-screen');
    this.startBtn = document.getElementById('btn-start');
    this.guideBtn = document.getElementById('btn-guide');
    this.muteBtn = document.getElementById('btn-mute');
    this.resetBtn = document.getElementById('btn-reset');
    this.bubble = document.getElementById('bubble');
    this.banner = document.getElementById('banner');
    this.hud = document.getElementById('hud');
    this.cakeSlots = [...document.querySelectorAll('#cake-progress .slot')];

    this.guideOn = true;
    this.muted = false;

    this.startBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.titleEl.classList.add('fade-out');
      setTimeout(() => this.titleEl.classList.add('hidden'), 650);
      this.hud.classList.remove('hidden');
      onStart();
    });
    this.guideBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.guideOn = !this.guideOn;
      this.guideBtn.classList.toggle('off', !this.guideOn);
      this.guideBtn.querySelector('.label').textContent = this.guideOn ? 'ガイド ON' : 'ガイド OFF';
      onGuideToggle(this.guideOn);
    });
    this.muteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.muted = !this.muted;
      this.muteBtn.classList.toggle('off', this.muted);
      this.muteBtn.querySelector('.icon').textContent = this.muted ? '🔇' : '🔊';
      onMuteToggle(this.muted);
    });
    this.resetBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      onReset();
    });
  }

  showBubble(x, y, text, flip) {
    this.bubble.classList.remove('hidden');
    if (this.bubble.textContent !== text) this.bubble.textContent = text;
    this.bubble.classList.toggle('flip', !!flip);
    this.bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  hideBubble() { this.bubble.classList.add('hidden'); }

  setCakeProgress(n) {
    this.cakeSlots.forEach((s, i) => s.classList.toggle('done', i < n));
  }

  celebrate(show, text) {
    this.banner.classList.toggle('hidden', !show);
    if (show) {
      if (text) this.banner.textContent = text;
      this.banner.classList.remove('pop');
      void this.banner.offsetWidth;
      this.banner.classList.add('pop');
    }
  }
}
