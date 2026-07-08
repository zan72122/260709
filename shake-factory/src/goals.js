// ---------------------------------------------------------------------------
// goals.js — tiny missions. No win/lose: just little "try this!" cards that
// reward with stars, confetti and a jingle, then move on.
// ---------------------------------------------------------------------------

export class Goals {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.stars = 0;
    this.index = 0;
    this.cooldown = 0;      // pause between missions
    this.baseline = null;
    this.freeTimer = 0;

    this.missions = [
      {
        text: 'ビーだまを 10こ ながして みよう！',
        icon: drawMarbles,
        progress: (s, b) => (s.marblesMelted - b.marblesMelted) / 10,
      },
      {
        text: 'みぎの カップを いっぱいに しよう！',
        icon: (g) => drawCup(g, '#ff8fb3', 1),
        progress: (s) => s.right.level,
      },
      {
        text: '2しょくで しましまカップを つくろう！',
        icon: (g) => drawStripeCup(g),
        progress: (s) => Math.max(s.left.stripes, s.right.stripes) / 4,
      },
      {
        text: 'ひだりの カップも いっぱいに しよう！',
        icon: (g) => drawCup(g, '#55b9ef', -1),
        progress: (s) => s.left.level,
      },
      {
        text: 'わざと こぼして にじいろの いけを つくろう！',
        icon: drawRainbowPond,
        progress: (s) => Math.min(s.pondColors / 3, Math.max(0.05, s.pondVolume / 0.35)),
      },
      {
        text: 'りょうほうの カップを まんたんに！',
        icon: drawTwoCups,
        progress: (s) => (s.left.level >= 1 && s.right.level >= 1)
          ? 1
          : Math.min(0.99, (Math.min(s.left.level, 1) + Math.min(s.right.level, 1)) / 2),
      },
      {
        text: 'じゆうに あそぼう！ シャカシャカ！',
        icon: drawStar,
        progress: (s, b, self) => self.freeTimer / 40,
        free: true,
      },
    ];
  }

  get current() { return this.missions[this.index % this.missions.length]; }

  start(stats) {
    this.baseline = { ...stats };
    this.freeTimer = 0;
  }

  update(dt, stats) {
    if (!this.baseline) this.start(stats);
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.index++;
        this.start(stats);
        return { changed: true, progress: 0 };
      }
      return { changed: false, progress: 1 };
    }
    const m = this.current;
    if (m.free) this.freeTimer += dt;
    let p = m.progress(stats, this.baseline, this);
    p = Math.max(0, Math.min(1, p));
    if (p >= 1) {
      this.stars++;
      this.cooldown = 3.0;
      if (this.onComplete) this.onComplete(m);
    }
    return { changed: false, progress: p };
  }
}

// ------------------------------ icons --------------------------------------
// each receives a 2d context of an 88×88 canvas (already cleared)

function marble(g, x, y, r, col) {
  g.fillStyle = col;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.2, -0.5, 0, 7); g.fill();
}

function drawMarbles(g) {
  marble(g, 26, 34, 14, '#ff5a7e');
  marble(g, 56, 28, 14, '#4fc3f7');
  marble(g, 42, 58, 14, '#ffd54f');
  g.strokeStyle = '#b58aa0'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(68, 52); g.lineTo(68, 72); g.moveTo(60, 64); g.lineTo(68, 74); g.lineTo(76, 64);
  g.stroke();
}

function cupPath(g, x, y, w, h) {
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.lineTo(x - w / 2 + 5, y + h);
  g.lineTo(x + w / 2 - 5, y + h);
  g.lineTo(x + w / 2, y);
  g.closePath();
}

function drawCup(g, col, side) {
  const x = 44 + side * 10;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - 15, 34); g.lineTo(x - 17.5, 22);
  g.lineTo(x + 17.5, 22); g.lineTo(x + 15, 34);
  g.lineTo(x - 15, 34);
  g.moveTo(x - 15, 34); g.lineTo(x - 12, 66) , g.lineTo(x + 12, 66); g.lineTo(x + 15, 34);
  g.fill();
  g.strokeStyle = '#7fb6cc'; g.lineWidth = 5;
  cupPath(g, x, 18, 42, 50); g.stroke();
  // sparkle
  g.fillStyle = '#ffd54f';
  g.font = 'bold 26px sans-serif';
  g.fillText('✦', x - side * 34 - 8, 40);
}

function drawStripeCup(g) {
  const x = 44;
  const cols = ['#ff6b8f', '#ffcf40', '#ff6b8f', '#ffcf40'];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = cols[i];
    g.fillRect(x - 16, 26 + i * 10.5, 32, 10.5);
  }
  g.strokeStyle = '#7fb6cc'; g.lineWidth = 5;
  cupPath(g, x, 18, 44, 52); g.stroke();
}

function drawTwoCups(g) {
  for (const [x, col] of [[26, '#55b9ef'], [62, '#ff6b8f']]) {
    g.fillStyle = col;
    g.fillRect(x - 12, 30, 24, 34);
    g.strokeStyle = '#7fb6cc'; g.lineWidth = 4.5;
    cupPath(g, x, 24, 32, 42); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(x, 31, 12, 4, 0, 0, 7); g.fill();
  }
  g.fillStyle = '#ffd54f'; g.font = 'bold 22px sans-serif';
  g.fillText('✦', 38, 20);
}

function drawRainbowPond(g) {
  const cols = ['#ff5a7e', '#ffd54f', '#66e08a', '#4fc3f7', '#b388ff'];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.ellipse(44, 58, 34 - i * 6, 16 - i * 2.6, 0, 0, 7);
    g.fill();
  }
  // falling drop
  g.fillStyle = '#4fc3f7';
  g.beginPath(); g.arc(44, 22, 8, 0, 7); g.fill();
  g.beginPath(); g.moveTo(44, 6); g.lineTo(50, 20); g.lineTo(38, 20); g.closePath(); g.fill();
}

function drawStar(g) {
  g.fillStyle = '#ffd54f';
  g.strokeStyle = '#f0a828'; g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? 30 : 13;
    const x = 44 + Math.cos(a) * r, y = 42 + Math.sin(a) * r;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(36, 34, 4, 0, 7); g.fill();
}
