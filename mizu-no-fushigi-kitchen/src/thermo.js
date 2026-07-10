// みずのふしぎキッチン — 温度と状態変化のモデル (純ロジック、描画非依存)。
//
// おなべの中の「みず」を、こおり(ice) / みず(water) / ゆげ(cloud) の
// 3 つの量 (合計 1 で保存) として持つ。温度はレバーの目標温度へ
// なめらかに近づくが、本物の物理と同じく 0℃ と 100℃ に
// 「相変化のあいだは温度が止まる」プラトーを持つ。
// ゆげは鍋の上の「くも」にたまり、冷やすと雨になって鍋へ戻る。

export const T_MIN = -20;
export const T_MAX = 120;
export const T_ROOM = 20;

const HEAT_EASE = 0.22;     // 温度が目標へ寄る速さ (1/s)
const FREEZE_RATE = 0.085;  // こおる速さ (fraction/s, 最大)
const MELT_RATE = 0.11;     // とける速さ
const BOIL_RATE = 0.055;    // 沸騰でゆげになる速さ
const RAIN_RATE = 0.16;     // くもが雨になって戻る速さ
const RAIN_TEMP = 55;       // この温度より下でくもが雨になる

export class Thermo {
  constructor() {
    this.temp = T_ROOM;      // いまの温度 (℃)
    this.target = T_ROOM;    // レバーの目標温度 (℃)
    this.ice = 0;            // こおりの量 (0..1)
    this.water = 1;          // みずの量 (0..1)
    this.cloud = 0;          // ゆげ(くも)の量 (0..1)
    this.boiling = false;    // いま沸騰中か
    this.freezing = false;   // いま凍結中か
    this.melting = false;    // いま融解中か
    this.raining = false;    // いま雨が降っているか
    this.listeners = [];
    // イベントの発火済みフラグ (状態をまたいだらリセット)
    this._flags = new Set();
  }

  onEvent(fn) { this.listeners.push(fn); }
  _emit(name) {
    if (this._flags.has(name)) return;
    this._flags.add(name);
    for (const fn of this.listeners) fn(name, this);
  }
  _clearFlag(...names) { for (const n of names) this._flags.delete(n); }

  get total() { return this.ice + this.water + this.cloud; }
  /** 鍋の中身 (こおり+みず) の量。水位の計算に使う。 */
  get inPot() { return this.ice + this.water; }

  setTarget(t) {
    this.target = Math.min(T_MAX, Math.max(T_MIN, t));
  }

  update(dt) {
    dt = Math.min(dt, 0.1);
    const tgt = this.target;
    let t = this.temp;

    // --- 温度移動 (指数イーズ + 最低速度で「じれったさ」を防ぐ)
    const diff = tgt - t;
    let step = diff * (1 - Math.exp(-dt * HEAT_EASE));
    const minStep = 2.2 * dt; // °/s
    if (Math.abs(diff) > 0.5 && Math.abs(step) < minStep) {
      step = Math.sign(diff) * Math.min(minStep, Math.abs(diff));
    }
    let next = t + step;

    // 加熱の強さ 0..1 (プラトー中の相変化速度に効く)
    const heatPow = Math.min(1, Math.max(0, (tgt - t) / 60));
    const coolPow = Math.min(1, Math.max(0, (t - tgt) / 50));

    this.boiling = this.freezing = this.melting = this.raining = false;

    // --- 0℃ プラトー: 凍る / 溶ける
    if (next < 0 && this.water > 0.001) {
      next = 0;
      const d = Math.min(this.water, FREEZE_RATE * (0.35 + coolPow) * dt);
      this.water -= d; this.ice += d;
      this.freezing = d > 0;
      this._emit('freeze-start');
      if (this.water <= 0.001) { this.ice += this.water; this.water = 0; this._emit('frozen'); }
    } else if (next > 0 && this.ice > 0.001) {
      next = 0;
      const d = Math.min(this.ice, MELT_RATE * (0.35 + heatPow) * dt);
      this.ice -= d; this.water += d;
      this.melting = d > 0;
      this._emit('melt-start');
      if (this.ice <= 0.001) { this.water += this.ice; this.ice = 0; this._emit('melted'); }
    }

    // --- 100℃ プラトー: 沸騰
    if (next > 100 && this.water > 0.001) {
      next = 100;
      const d = Math.min(this.water, BOIL_RATE * (0.4 + heatPow) * dt);
      this.water -= d; this.cloud += d;
      this.boiling = d > 0;
      this._emit('boil-start');
      if (this.water <= 0.002) {
        this.cloud += this.water; this.water = 0;
        this._emit('all-steam');
      }
    }

    // --- くも → 雨 (冷やすと戻ってくる)
    if (t < RAIN_TEMP && this.cloud > 0.001 && tgt < RAIN_TEMP) {
      const d = Math.min(this.cloud, RAIN_RATE * dt);
      this.cloud -= d; this.water += d;
      this.raining = d > 0;
      this._emit('rain-start');
      if (this.cloud <= 0.001) { this.water += this.cloud; this.cloud = 0; this._emit('rained'); }
    }

    this.temp = next;

    // --- フラグ復帰 (別の状態に離れたら、またイベントが鳴るように)
    if (this.ice <= 0.001) this._clearFlag('frozen', 'freeze-start');
    if (this.water >= 0.999 || this.ice >= 0.999) this._clearFlag('melted');
    if (this.ice > 0.001 || this.temp < 90) this._clearFlag('boil-start');
    if (this.cloud <= 0.001) this._clearFlag('all-steam', 'rain-start');
    if (this.cloud > 0.15) this._clearFlag('rained');
    if (this.temp > 5) this._clearFlag('freeze-start');
    if (this.ice <= 0.001 && this.temp > 5) this._clearFlag('melt-start');
  }

  /** 表示用: いま一番目立つ状態 */
  phaseName() {
    if (this.boiling) return 'boil';
    if (this.freezing) return 'freeze';
    if (this.melting) return 'melt';
    if (this.raining) return 'rain';
    if (this.inPot <= 0.02 && this.cloud > 0.5) return 'steam';
    if (this.ice > 0.66) return 'ice';
    if (this.ice > 0.02) return 'slush';
    return 'water';
  }
}
