// A〜E の立体文字メッシュ。フォント不要で THREE.Shape から押し出して作る。
import * as THREE from 'three';

const EXTRUDE = {
  depth: 0.5,
  bevelEnabled: true,
  bevelThickness: 0.1,
  bevelSize: 0.09,
  bevelSegments: 3,
  curveSegments: 24,
};

function poly(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

function polyPath(points) {
  const p = new THREE.Path();
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) p.lineTo(points[i][0], points[i][1]);
  p.closePath();
  return p;
}

function shapeA() {
  const s = poly([
    [-1.0, -1.0], [-0.35, 1.0], [0.35, 1.0], [1.0, -1.0],
    [0.5, -1.0], [0.32, -0.5], [-0.32, -0.5], [-0.5, -1.0],
  ]);
  s.holes.push(polyPath([[-0.17, -0.12], [0.17, -0.12], [0.0, 0.45]]));
  return s;
}

function shapeB() {
  const s = new THREE.Shape();
  s.moveTo(-0.75, -1.0);
  s.lineTo(-0.75, 1.0);
  s.lineTo(0.1, 1.0);
  s.absarc(0.1, 0.52, 0.48, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(0.18, 0.04);
  s.absarc(0.18, -0.48, 0.52, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(-0.75, -1.0);
  s.closePath();
  const h1 = new THREE.Path();
  h1.absarc(-0.05, 0.52, 0.2, 0, Math.PI * 2, false);
  const h2 = new THREE.Path();
  h2.absarc(-0.02, -0.48, 0.23, 0, Math.PI * 2, false);
  s.holes.push(h1, h2);
  return s;
}

function shapeC() {
  const a0 = 0.62;               // 口の開き角(ラジアン)
  const s = new THREE.Shape();
  s.absarc(0, 0, 1.0, a0, Math.PI * 2 - a0, false);
  s.absarc(0, 0, 0.52, Math.PI * 2 - a0, a0, true);
  s.closePath();
  return s;
}

function shapeD() {
  const s = new THREE.Shape();
  s.moveTo(-0.75, -1.0);
  s.lineTo(-0.75, 1.0);
  s.lineTo(-0.05, 1.0);
  s.absellipse(-0.05, 0, 0.95, 1.0, Math.PI / 2, -Math.PI / 2, true, 0);
  s.lineTo(-0.75, -1.0);
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(-0.28, -0.5);
  h.lineTo(-0.28, 0.5);
  h.absellipse(-0.28, 0, 0.5, 0.5, Math.PI / 2, -Math.PI / 2, true, 0);
  h.closePath();
  s.holes.push(h);
  return s;
}

function shapeE() {
  return poly([
    [-0.75, -1.0], [-0.75, 1.0], [0.85, 1.0], [0.85, 0.56],
    [-0.15, 0.56], [-0.15, 0.22], [0.68, 0.22], [0.68, -0.22],
    [-0.15, -0.22], [-0.15, -0.56], [0.85, -0.56], [0.85, -1.0],
  ]);
}

const SHAPES = { A: shapeA, B: shapeB, C: shapeC, D: shapeD, E: shapeE };

export function buildLetterMesh(char, color) {
  const shape = SHAPES[char]();
  const geo = new THREE.ExtrudeGeometry(shape, EXTRUDE);
  geo.center();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
