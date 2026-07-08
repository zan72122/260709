// ちいさな「おたのしみ」:ゆるい目標。ぜんぶ肯定、失敗なし
import { pick } from './utils.js';

const GOAL_DEFS = [
  { id: 'thread5', icon: '🧵', text: 'いとを 5ほん はってみよう', event: 'thread', target: 5 },
  { id: 'mist3', icon: '💨', text: 'きりふきで しゅっしゅ してみよう', event: 'mist', target: 3 },
  { id: 'color2', icon: '💧', text: 'いろみずを いとに たらしてみよう', event: 'colorDrop', target: 2 },
  { id: 'cross4', icon: '🎨', text: 'こうさてんで いろを まぜてみよう', event: 'crossBloom', target: 4 },
  { id: 'auto1', icon: '✨', text: '「おまかせ」で もようを そだてよう', event: 'autoweave', target: 1 },
  { id: 'light1', icon: '🔦', text: 'ひかりで きらきら させてみよう', event: 'light', target: 1 },
  { id: 'thread12', icon: '🌸', text: 'いとを 12ほんで おはなを つくろう', event: 'thread', target: 12 },
  { id: 'save1', icon: '📷', text: 'できた もようを カードに のこそう', event: 'save', target: 1 },
  { id: 'drops5', icon: '🫧', text: 'しずくを 5つぶ ころがそう', event: 'colorDrop', target: 5 },
  { id: 'cross10', icon: '🌈', text: 'にじみを 10こ そだてよう', event: 'crossBloom', target: 10 },
];

const PRAISES = [
  'わあ！ すてき！',
  'きれいだね〜！',
  'もようが そだったよ！',
  'はくしゅ〜！ 👏',
  'すごい すごい！',
  'にじいろだね！',
];

export class GoalSystem {
  constructor({ onShow, onComplete }) {
    this.onShow = onShow;         // (goal, progress) 表示更新
    this.onComplete = onComplete; // (goal, praiseText) お祝い
    this.doneIds = new Set();
    this.current = null;
    this.progress = 0;
    this._cooldown = 0;
  }

  // タイトルをとじたあとに呼ぶ(UIができてから)
  start() {
    if (!this.current) this._pickNext();
  }

  _pickNext() {
    const remaining = GOAL_DEFS.filter(g => !this.doneIds.has(g.id));
    if (remaining.length === 0) {
      // ぜんぶ終わったら、またゆるく回す(目標は多めに)
      this.doneIds.clear();
      this.current = pick(GOAL_DEFS);
    } else {
      this.current = remaining[0];
    }
    this.progress = 0;
    this.onShow && this.onShow(this.current, 0);
  }

  notify(eventName) {
    if (!this.current || this._cooldown > 0) {
      return;
    }
    if (this.current.event !== eventName) return;
    this.progress++;
    this.onShow && this.onShow(this.current, this.progress);
    if (this.progress >= this.current.target) {
      this.doneIds.add(this.current.id);
      this.onComplete && this.onComplete(this.current, pick(PRAISES));
      this._cooldown = 4; // お祝いのあいだ、つぎの目標はまつ
    }
  }

  tick(dt) {
    if (this._cooldown > 0) {
      this._cooldown -= dt;
      if (this._cooldown <= 0) this._pickNext();
    }
  }
}
