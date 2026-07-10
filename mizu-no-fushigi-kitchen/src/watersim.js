// みずのふしぎキッチン — 水面の波シミュレーション (純ロジック)。
//
// N×N の高さ場を古典的な波動方程式で更新する。おなべは円形なので
// 円の外のセルは高さ 0 に固定 (縁で波がやわらかく反射する)。
// 指でなでる・雨粒・沸騰の泡が disturb() で波を起こす。

export class WaterSim {
  constructor(n = 52, radius = 1.0) {
    this.n = n;
    this.radius = radius;              // ワールド半径 (描画側でスケール)
    this.u = new Float32Array(n * n);  // 高さ
    this.v = new Float32Array(n * n);  // 速度
    this.mask = new Uint8Array(n * n); // 1 = 円の内側
    this.damp = 0.984;
    this.speed = 7.5;                  // 波の伝わる速さ
    this._acc = 0;
    const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x - c) / c, dy = (y - c) / c;
        this.mask[y * n + x] = (dx * dx + dy * dy) <= 0.985 ? 1 : 0;
      }
    }
  }

  /** ワールド座標 (-radius..radius) で波を起こす */
  disturb(wx, wz, amount, r = 0.14) {
    const n = this.n, c = (n - 1) / 2;
    const gx = (wx / this.radius) * c + c;
    const gy = (wz / this.radius) * c + c;
    const gr = Math.max(1, (r / this.radius) * c);
    const x0 = Math.max(0, Math.floor(gx - gr)), x1 = Math.min(n - 1, Math.ceil(gx + gr));
    const y0 = Math.max(0, Math.floor(gy - gr)), y1 = Math.min(n - 1, Math.ceil(gy + gr));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * n + x;
        if (!this.mask[i]) continue;
        const d = Math.hypot(x - gx, y - gy) / gr;
        if (d > 1) continue;
        const w = Math.cos(d * Math.PI * 0.5); // なだらかな山
        this.v[i] += amount * w;
      }
    }
  }

  step(dt) {
    // 固定ステップで安定させる
    this._acc = Math.min(this._acc + dt, 0.12);
    const h = 1 / 60;
    while (this._acc >= h) {
      this._acc -= h;
      this._stepFixed(h);
    }
  }

  _stepFixed(h) {
    const { n, u, v, mask } = this;
    const k = this.speed * this.speed * h * n * 0.06;
    for (let y = 1; y < n - 1; y++) {
      const row = y * n;
      for (let x = 1; x < n - 1; x++) {
        const i = row + x;
        if (!mask[i]) { u[i] = 0; v[i] = 0; continue; }
        const l = mask[i - 1] ? u[i - 1] : 0;
        const r = mask[i + 1] ? u[i + 1] : 0;
        const t = mask[i - n] ? u[i - n] : 0;
        const b = mask[i + n] ? u[i + n] : 0;
        v[i] += ((l + r + t + b) * 0.25 - u[i]) * k;
      }
    }
    const damp = Math.pow(this.damp, h * 60);
    let energy = 0;
    for (let i = 0; i < u.length; i++) {
      if (!mask[i]) continue;
      v[i] *= damp;
      u[i] += v[i] * h * 60;
      // 発散防止のソフトクランプ
      if (u[i] > 0.5) u[i] = 0.5; else if (u[i] < -0.5) u[i] = -0.5;
      energy += u[i] * u[i];
    }
    this.energy = energy / u.length;
  }

  /** グリッド座標→高さ (描画側の頂点更新用) */
  heightAt(ix, iy) {
    return this.u[iy * this.n + ix];
  }

  calm(f = 0.9) {
    for (let i = 0; i < this.u.length; i++) { this.u[i] *= f; this.v[i] *= f; }
  }
}
