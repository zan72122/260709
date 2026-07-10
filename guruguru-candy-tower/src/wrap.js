// wrap.js — 円筒ラップ: 物理は平面(x=塔の周方向の弧長, y=高さ, z=半径方向の外向きオフセット)で解き、
// 描画だけを半径 R0 の塔に巻き付ける。前作の実証済み平面物理をそのまま使うための座標系。
import * as THREE from '../vendor/three.module.min.js';

export const R0 = 4.2;                       // 基準半径(レールが乗る円筒)
export const CIRC = 2 * Math.PI * R0;        // 1周の弧長 ≈ 26.39

export function phiOf(x) { return x / R0; }  // 弧長 → 方位角(rad)

// 平面座標 (x, y, z) → ワールド座標
export function wrapPos(x, y, z = 0, out = new THREE.Vector3()) {
  const phi = x / R0;
  const r = R0 + z;
  out.set(Math.sin(phi) * r, y, Math.cos(phi) * r);
  return out;
}

// 平面上の向き(接線フレーム+ローカルZ回転)→ ワールドクォータニオン
// ローカル +X = 進行(接線)方向, +Y = 上, +Z = 半径方向外向き
const _qy = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
export function wrapQuat(x, angleZ = 0, out = new THREE.Quaternion()) {
  _qy.setFromAxisAngle(_Y, x / R0);
  if (angleZ === 0) return out.copy(_qy);
  _qz.setFromAxisAngle(_Z, angleZ);
  return out.copy(_qy).multiply(_qz);
}

// 平面座標のグループ配置ヘルパー: anchor(平面) に置き、接線フレームへ向ける
export function placeAt(obj, x, y, z = 0, angleZ = 0) {
  wrapPos(x, y, z, obj.position);
  wrapQuat(x, angleZ, obj.quaternion);
  return obj;
}

// 曲線点列(平面)をワールドへ
export function wrapPoints(points) {
  return points.map((p) => wrapPos(p[0], p[1], p[2] || 0));
}

// 方位角の最短差(カメラ追尾用)
export function shortestArc(from, to) {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
