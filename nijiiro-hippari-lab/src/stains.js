// 板の上に「じわっ」とにじむ色のレイヤー(2Dキャンバス → テクスチャ)
import * as THREE from 'three';
import { BOARD_R } from './scene3d.js';
import { hexToCss } from './utils.js';

const SIZE = 1024;
const HALF = BOARD_R + 0.4;

export class StainLayer {
  constructor(parent) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.g = this.canvas.getContext('2d');
    // 板のまるにクリップ(いちどだけ設定して使いまわす)
    this.g.beginPath();
    this.g.arc(SIZE / 2, SIZE / 2, (BOARD_R / HALF) * (SIZE / 2) - 3, 0, Math.PI * 2);
    this.g.clip();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2, HALF * 2),
      new THREE.MeshBasicMaterial({
        map: this.texture, transparent: true, depthWrite: false,
      })
    );
    this.mesh.position.z = 0.045;
    parent.add(this.mesh);
    this._pending = false;
  }

  _px(x) { return ((x + HALF) / (HALF * 2)) * SIZE; }
  _py(y) { return ((HALF - y) / (HALF * 2)) * SIZE; }
  _pr(r) { return (r / (HALF * 2)) * SIZE; }

  // まるいにじみ
  blob(x, y, hex, r, alpha = 0.18) {
    const g = this.g;
    const px = this._px(x), py = this._py(y), pr = Math.max(2, this._pr(r));
    const grad = g.createRadialGradient(px, py, pr * 0.1, px, py, pr);
    grad.addColorStop(0, hexToCss(hex, alpha));
    grad.addColorStop(0.7, hexToCss(hex, alpha * 0.45));
    grad.addColorStop(1, hexToCss(hex, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    this._pending = true;
  }

  // 糸にそったうすい染み
  streak(x0, y0, x1, y1, hex, w, alpha = 0.08) {
    const g = this.g;
    g.strokeStyle = hexToCss(hex, alpha);
    g.lineWidth = Math.max(1.5, this._pr(w));
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(this._px(x0), this._py(y0));
    g.lineTo(this._px(x1), this._py(y1));
    g.stroke();
    this._pending = true;
  }

  // ぜんぶあらいながす
  clear() {
    this.g.clearRect(0, 0, SIZE, SIZE);
    this._pending = true;
  }

  tick() {
    if (this._pending) {
      this.texture.needsUpdate = true;
      this._pending = false;
    }
  }
}
