// DOM overlay glue: screens, HUD meters, banners, praise pops, emoji rain.
// Everything is icon/emoji based — the target player is 4 and can't read
// much, so text is decoration and shapes carry the meaning.

export class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.title = this.$('title-screen');
    this.selectHint = this.$('select-hint');
    this.hud = this.$('hud');
    this.meter = this.$('meter');
    this.gemCount = this.$('gem-count');
    this.gemBadge = this.$('gem-badge');
    this.banner = this.$('banner');
    this.praise = this.$('praise');
    this.wipe = this.$('wipe');
    this.finale = this.$('finale-screen');
    this.rain = this.$('emoji-rain');
    this._bannerTimer = null;
    this._praiseTimer = null;
  }

  show(el) { el.classList.remove('hidden'); }
  hide(el) { el.classList.add('hidden'); }

  /** Star meter: needed slots, filled by blooms; key slot at the end. */
  setMeter(filled, total, keyReady) {
    let html = '';
    for (let i = 0; i < total; i++) {
      html += `<span class="slot ${i < filled ? 'on' : ''}">🌸</span>`;
    }
    html += `<span class="slot key ${keyReady ? 'on' : ''}">🗝️</span>`;
    this.meter.innerHTML = html;
  }

  setGems(n) {
    this.gemCount.textContent = n;
    this.gemBadge.classList.remove('pop');
    void this.gemBadge.offsetWidth; // restart animation
    this.gemBadge.classList.add('pop');
  }

  /** Big center banner (stage names, celebrations). */
  showBanner(text, emoji = '', ms = 2400) {
    clearTimeout(this._bannerTimer);
    this.banner.innerHTML = `<div class="banner-emoji">${emoji}</div><div class="banner-text">${text}</div>`;
    this.banner.classList.remove('hidden', 'anim');
    void this.banner.offsetWidth;
    this.banner.classList.add('anim');
    this._bannerTimer = setTimeout(() => this.banner.classList.add('hidden'), ms);
  }

  /** Small praise pop near the top ("すごーい！ ✨"). */
  showPraise(text, emoji) {
    clearTimeout(this._praiseTimer);
    this.praise.textContent = `${emoji} ${text} ${emoji}`;
    this.praise.classList.remove('hidden', 'anim');
    void this.praise.offsetWidth;
    this.praise.classList.add('anim');
    this._praiseTimer = setTimeout(() => this.praise.classList.add('hidden'), 1500);
  }

  /** Full-screen sparkle wipe for stage transitions. Calls mid() at peak. */
  wipeTransition(mid, done) {
    this.wipe.classList.remove('hidden');
    this.wipe.classList.remove('out');
    this.wipe.classList.add('in');
    setTimeout(() => {
      mid && mid();
      this.wipe.classList.remove('in');
      this.wipe.classList.add('out');
      setTimeout(() => {
        this.wipe.classList.add('hidden');
        this.wipe.classList.remove('out');
        done && done();
      }, 700);
    }, 750);
  }

  /** DOM emoji rain for celebrations. */
  emojiRain(emojis, n = 26) {
    for (let i = 0; i < n; i++) {
      const span = document.createElement('span');
      span.className = 'drop';
      span.textContent = emojis[(Math.random() * emojis.length) | 0];
      span.style.left = Math.random() * 100 + 'vw';
      span.style.animationDelay = Math.random() * 1.2 + 's';
      span.style.animationDuration = 2.2 + Math.random() * 1.8 + 's';
      span.style.fontSize = 22 + Math.random() * 26 + 'px';
      this.rain.appendChild(span);
      setTimeout(() => span.remove(), 4600);
    }
  }
}
