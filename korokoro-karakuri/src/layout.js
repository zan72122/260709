// layout.js — コロコロからくり: 装置全体の寸法・配置の純データ定義
// (DOM/THREE 非依存。test/layout.test.mjs が接続整合性を検証する)

export const BALL_RADIUS = 0.32;

// 装置全体のバウンディング(カメラフレーミング用) — 枠・脚・床の影も含める
export const MACHINE_BOUNDS = {
  minX: -5.65, maxX: 5.65,
  minY: -0.9, maxY: 14.85,
  centerX: 0.0, centerY: 7.1,
};

// 玉の出発点(ホッパー内)
export const BALL_SPAWN = { x: -4.0, y: 13.15, z: 0 };

// ---- レール(チャンネル) a → b へ転がる ----
// w: 溝の奥行き(z)、lip: 縁の高さ
export const RAILS = {
  R1: { a: [-3.45, 12.55], b: [-0.55, 11.85], w: 0.95, lip: 0.26 }, // ホッパー → シーソー
  R3: { a: [2.5, 8.55],   b: [-3.35, 7.15],  w: 0.95, lip: 0.26 }, // 水車 → エレベーター
  R4: { a: [-3.55, 10.05], b: [-1.05, 9.42], w: 0.95, lip: 0.26 }, // エレベーター → スイッチ
  R6: { a: [1.35, 4.62],  b: [-1.75, 3.92],  w: 0.95, lip: 0.26 }, // 落下チューブ → カタパルト
  // シーソー後のペグ落下を受ける短い棚 → 右壁の縦チュートへ
  R2: { a: [2.3, 9.95],   b: [3.65, 9.62],   w: 0.95, lip: 0.26 },
  // (スイッチの左右分岐はレールなし: フリッパーから自由落下で
  //  左=R3 に落ちてループ / 右=ワイヤースライドへ飛び込む)
};

// ---- シーソー ----
// R1 より一段低く据える: 右に傾いてせり上がった左端ストッパーが
// R1 の床下に隠れ、新しい玉の通り道を塞がない
export const SEESAW = {
  pivot: [0.9, 11.3],
  halfLen: 1.75,          // 板の半分の長さ
  tilt: 0.21,             // 傾き(rad) ±
  restTilt: 0.21,         // 初期: 左が下がる(+) → 玉は左端で待機
  tipWall: 0.15,          // 左端ストッパーの板上への出っぱり
};

// ---- ペグ(シーソー右の落下路) ----
export const PEGS = [
  [2.8, 10.85],
  [2.42, 10.3],
];
export const PEG_RADIUS = 0.13;
// 落下路の左ガード壁
export const PEG_GUARD = { x: 2.02, y0: 9.9, y1: 11.05 };

// ---- 右壁の縦チュート(R2 → 水車の受け口) ----
export const SIDE_CHUTE = {
  x: 4.75,              // 外壁基準の中心(壁は x+0.33)
  top: 9.5, bottom: 6.95,
  deflector: { x: 4.15, y: 6.72, w: 1.5, angle: 0.62 }, // 右が高い斜面 → 玉を左の水車へ流す
};

// ---- 水車(ウォーターホイール) ----
export const WHEEL = {
  center: [3.45, 7.72],
  radius: 1.02,
  pockets: 4,
  stepAngle: Math.PI / 2,   // 1タップで90°
  spinTime: 0.5,            // 回転アニメ時間
  // 玉を受け取るゾーン(下〜右下。斜面を滑ってきた玉をポケットが掬い取る)
  intake: { x: 3.45, y: 6.62, r: 1.28 },
  // 最上部到達時に左へ放す
  release: { x: 2.62, y: 8.72, vx: -1.7, vy: 0.3 },
  liftsNeeded: 2,           // 下 → 右 → 上 で放出
};

// ---- エレベーター ----
export const ELEVATOR = {
  x: -4.05,
  bottom: 6.88,     // プラットフォーム上面の待機高さ
  top: 10.12,
  speedUp: 1.7,
  speedDown: 0.85,
  platform: { hw: 0.46, hh: 0.09, hd: 0.5 },  // 半幅/半高/半奥
  // 頂上到達後、R4 へ送り出すスクリプト移動
  handoff: { x: -3.5, y: 10.42, vx: 1.4, vy: 0 },
};

// ---- スイッチ(分岐フリッパー) ----
// R3 の真上を横切るため振り角は浅め(下を玉が通れるクリアランスを確保)
export const SWITCH = {
  pivot: [-0.2, 9.12],
  halfLen: 0.62,
  angle: 0.24,             // フリッパーの振り角(rad)
  // 初期は LEFT(ループ側)
};

// ---- 落下チューブ=ワイヤースライド(前面レイヤーを通るスクリプト経路) ----
export const DROP_TUBE = {
  entry: { x: 0.5, y: 8.9, r: 0.55 },    // 捕捉ゾーン(右向きに動く玉のみ=フリッパー右分岐から)
  path: [
    [0.5, 8.9, 0.0],
    [1.1, 8.2, 0.5],
    [1.6, 7.2, 0.82],
    [1.62, 6.15, 0.82],
    [1.45, 5.2, 0.4],
    [1.3, 4.72, 0.0],
  ],
  duration: 1.9,
  exitVel: { vx: -1.5, vy: -0.4 },
  rings: 5,                 // 描画するリング数(通過音の数)
};

// ---- カタパルト ----
export const CATAPULT = {
  pivot: [-1.95, 3.42],                  // アームの軸(アームは左へ伸びる)
  armLen: 0.72,
  cup: { x: -2.62, y: 3.92, r: 0.55 },   // 捕捉ゾーン(アーム先端のカップ)
  minCharge: 0.22,
  chargeTime: 1.15,
  // 発射弧: カップ → リング → ゴール漏斗(スクリプト)
  arc: {
    from: [-2.55, 4.15, 0],
    ring: [0.35, 6.55, 0],
    to: [2.66, 5.42, 0],
    duration: 1.5,
  },
  // 弱すぎる発射: ポヨンと戻る
  weakArc: { peak: [-2.2, 5.0, 0], duration: 0.9 },
};

// ---- 木のリング(発射弧が通る) ----
export const HOOP = { x: 0.35, y: 6.55, r: 0.62 };

// ---- ゴール(漏斗+鐘) ----
export const GOAL = {
  funnel: { x: 2.66, y: 4.72, rTop: 0.95, rBottom: 0.24, height: 0.85 },
  bell: { x: 2.66, y: 6.6 },
  spiralTime: 1.7,
  respawnDelay: 4.4,
};

// ---- ホッパー(スタート) ----
export const HOPPER = {
  pos: [-3.95, 12.82],
  tipAngle: -0.42,
  tipTime: 0.55,
  holdTime: 1.0,
  handle: { x: -4.52, y: 12.2 },
};

// 玉がここより下 or 場外に出たらリスポーン
export const KILL_Y = -1.5;
export const OUT_X = 6.5;

// ---- 接続整合性チェック用: 玉の旅の順序 ----
export const JOURNEY = [
  'hopper', 'R1', 'seesaw', 'pegs', 'R2', 'sideChute',
  'wheel', 'R3', 'elevator', 'R4', 'switch',
  'dropTube', 'R6', 'catapult', 'goal',
];
