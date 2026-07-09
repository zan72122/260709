// 変身先(りんご・あり・とり…)のメッシュ。プリミティブの組み合わせで作る。
// 各ビルダーは userData.tick(t) にアイドルアニメを持つ THREE.Group を返す。
import * as THREE from 'three';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...opts });
}

function ball(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 22), mat(color));
  m.scale.set(sx, sy, sz);
  return m;
}

function cyl(rTop, rBottom, h, color, radial = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, radial), mat(color));
}

function eyePair(spacing, size, y, z) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const white = ball(size, 0xffffff);
    white.position.set(side * spacing, y, z);
    const pupil = ball(size * 0.5, 0x2b2b3a);
    pupil.position.set(side * spacing, y, z + size * 0.62);
    g.add(white, pupil);
  }
  return g;
}

function smile(width, y, z, color = 0x2b2b3a) {
  const curve = new THREE.EllipseCurve(0, 0, width, width * 0.62, Math.PI + 0.6, Math.PI * 2 - 0.6, false);
  const pts = curve.getPoints(20).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, width * 0.09, 8, false),
    mat(color)
  );
  tube.position.set(0, y, z);
  return tube;
}

// ---------- A ----------
export function buildApple() {
  const g = new THREE.Group();
  const body = ball(1.0, 0xff5d5d, 1.05, 0.95, 1.05);
  g.add(body);
  const stem = cyl(0.06, 0.09, 0.5, 0x8a5a33);
  stem.position.set(0.05, 1.05, 0);
  stem.rotation.z = -0.25;
  g.add(stem);
  const leaf = ball(0.3, 0x69c95e, 1.4, 0.45, 0.8);
  leaf.position.set(0.4, 1.12, 0);
  leaf.rotation.z = -0.5;
  g.add(leaf);
  g.add(eyePair(0.34, 0.12, 0.18, 0.95));
  g.add(smile(0.24, -0.18, 1.0));
  g.userData.tick = (t) => {
    leaf.rotation.z = -0.5 + Math.sin(t * 2.2) * 0.15;
  };
  return g;
}

export function buildAnt() {
  const g = new THREE.Group();
  const brown = 0x9c4a2f;
  const head = ball(0.5, brown);
  head.position.set(-0.95, 0.15, 0);
  const thorax = ball(0.42, brown);
  thorax.position.set(-0.15, 0.05, 0);
  const abdomen = ball(0.62, 0xb45a3a, 1.15, 1, 1);
  abdomen.position.set(0.85, 0.05, 0);
  g.add(head, thorax, abdomen);
  const eyes = eyePair(0.2, 0.11, 0.32, 0.38);
  eyes.position.set(-0.95, 0.15, 0);
  g.add(eyes);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = cyl(0.045, 0.045, 0.8, 0x6e3320, 8);
      leg.position.set(-0.55 + i * 0.45, -0.45, side * 0.3);
      leg.rotation.x = side * 0.5;
      leg.rotation.z = 0.25 - i * 0.25;
      g.add(leg);
      legs.push(leg);
    }
  }
  const antennae = [];
  for (const side of [-1, 1]) {
    const a = cyl(0.03, 0.03, 0.55, 0x6e3320, 8);
    a.position.set(-1.25, 0.62, side * 0.18);
    a.rotation.z = 0.8;
    a.rotation.x = side * 0.35;
    g.add(a);
    antennae.push(a);
  }
  g.userData.tick = (t) => {
    legs.forEach((leg, i) => {
      leg.rotation.z = 0.25 - (i >> 1) * 0.25 + Math.sin(t * 10 + i * 1.6) * 0.22;
    });
    antennae.forEach((a, i) => {
      a.rotation.z = 0.8 + Math.sin(t * 4 + i * 2) * 0.12;
    });
  };
  return g;
}

// ---------- B ----------
export function buildBird() {
  const g = new THREE.Group();
  const body = ball(0.95, 0x59b9ff, 1, 0.95, 0.95);
  g.add(body);
  const belly = ball(0.62, 0xfff3d6, 1, 0.9, 0.7);
  belly.position.set(0, -0.25, 0.42);
  g.add(belly);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 16), mat(0xffa63e));
  beak.position.set(0, 0.05, 1.0);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  g.add(eyePair(0.36, 0.13, 0.35, 0.82));
  const wings = [];
  for (const side of [-1, 1]) {
    const w = ball(0.5, 0x3f9be0, 1.3, 0.55, 0.9);
    w.position.set(side * 0.9, 0.05, 0);
    w.rotation.z = side * -0.4;
    g.add(w);
    wings.push(w);
  }
  const tail = ball(0.35, 0x3f9be0, 1.4, 0.4, 0.7);
  tail.position.set(0, 0.15, -0.95);
  tail.rotation.x = -0.6;
  g.add(tail);
  const crest = ball(0.2, 0xffd43b, 0.7, 1.3, 0.7);
  crest.position.set(0, 0.95, 0.1);
  g.add(crest);
  g.userData.tick = (t) => {
    wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      w.rotation.z = side * (-0.4 - Math.abs(Math.sin(t * 6)) * 0.7);
    });
    g.position.y = Math.sin(t * 3) * 0.08;
  };
  return g;
}

export function buildBalloon() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const body = ball(0.95, 0xff8ac2, 0.92, 1.12, 0.92);
  body.position.y = 0.45;
  inner.add(body);
  const shine = ball(0.18, 0xffe3f1, 1.4, 1.8, 0.5);
  shine.position.set(-0.35, 0.95, 0.72);
  inner.add(shine);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 12), mat(0xf06ba8));
  knot.position.set(0, -0.62 + 0.45, 0);
  inner.add(knot);
  const stringPts = [];
  for (let i = 0; i <= 10; i++) {
    const y = -0.74 + 0.45 - i * 0.16;
    stringPts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.09, y, 0));
  }
  const string = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stringPts), 24, 0.025, 8, false),
    mat(0xffffff)
  );
  inner.add(string);
  const eyes = eyePair(0.3, 0.11, 0.55, 0.82);
  inner.add(eyes);
  inner.add(smile(0.2, 0.18, 0.9));
  g.add(inner);
  g.userData.tick = (t) => {
    inner.rotation.z = Math.sin(t * 1.6) * 0.16;
    inner.position.y = Math.sin(t * 2.1) * 0.12;
  };
  return g;
}

// ---------- C ----------
export function buildCat() {
  const g = new THREE.Group();
  const orange = 0xffb156;
  const body = ball(0.72, orange, 1, 0.9, 1);
  body.position.set(0, -0.75, 0);
  g.add(body);
  const head = ball(0.72, orange);
  head.position.set(0, 0.35, 0);
  g.add(head);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 4), mat(orange));
    ear.position.set(side * 0.45, 1.0, 0);
    ear.rotation.z = side * -0.25;
    g.add(ear);
    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), mat(0xffd9e6));
    innerEar.position.set(side * 0.44, 0.98, 0.06);
    innerEar.rotation.z = side * -0.25;
    g.add(innerEar);
    ears.push(ear);
  }
  const eyes = eyePair(0.3, 0.11, 0.45, 0.6);
  g.add(eyes);
  const nose = ball(0.08, 0xff7ba6, 1.2, 0.9, 0.9);
  nose.position.set(0, 0.25, 0.7);
  g.add(nose);
  g.add(smile(0.16, 0.1, 0.66));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const wsk = cyl(0.015, 0.015, 0.5, 0xffffff, 6);
      wsk.position.set(side * 0.6, 0.26 - i * 0.1, 0.55);
      wsk.rotation.z = Math.PI / 2 + side * (0.12 + i * 0.12);
      g.add(wsk);
    }
  }
  const tailPts = [];
  for (let i = 0; i <= 8; i++) {
    tailPts.push(new THREE.Vector3(0.6 + i * 0.1, -1.25 + i * 0.16 + Math.sin(i * 0.6) * 0.1, 0));
  }
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.11, 10, false),
    mat(orange)
  );
  g.add(tail);
  const paws = [];
  for (const side of [-1, 1]) {
    const paw = ball(0.2, 0xfff3d6);
    paw.position.set(side * 0.35, -1.35, 0.35);
    g.add(paw);
    paws.push(paw);
  }
  g.userData.tick = (t) => {
    tail.rotation.x = Math.sin(t * 2.4) * 0.35;
    ears.forEach((e, i) => {
      e.rotation.z = (i === 0 ? 0.25 : -0.25) + Math.sin(t * 3 + i) * 0.06;
    });
  };
  return g;
}

export function buildCloud() {
  const g = new THREE.Group();
  const puffs = [
    [0, 0, 0, 0.85],
    [-0.85, -0.15, 0.1, 0.6],
    [0.85, -0.15, 0.1, 0.62],
    [-0.4, 0.45, -0.1, 0.55],
    [0.45, 0.42, -0.1, 0.52],
  ];
  for (const [x, y, z, r] of puffs) {
    const p = ball(r, 0xffffff);
    p.position.set(x, y, z);
    g.add(p);
  }
  g.add(eyePair(0.32, 0.11, 0.05, 0.78));
  g.add(smile(0.2, -0.28, 0.82));
  const cheeks = [];
  for (const side of [-1, 1]) {
    const c = ball(0.12, 0xffc2d1, 1.3, 0.9, 0.5);
    c.position.set(side * 0.62, -0.12, 0.72);
    g.add(c);
    cheeks.push(c);
  }
  g.userData.tick = (t) => {
    g.position.y = Math.sin(t * 1.8) * 0.12;
    g.rotation.z = Math.sin(t * 1.2) * 0.05;
  };
  return g;
}

// ---------- D ----------
export function buildDog() {
  const g = new THREE.Group();
  const cream = 0xd9a066;
  const body = ball(0.75, cream, 1.15, 0.85, 0.9);
  body.position.set(0, -0.7, 0);
  g.add(body);
  const head = ball(0.7, cream);
  head.position.set(0, 0.4, 0.1);
  g.add(head);
  const muzzle = ball(0.35, 0xf2d3a7, 1.1, 0.8, 0.9);
  muzzle.position.set(0, 0.2, 0.62);
  g.add(muzzle);
  const nose = ball(0.11, 0x3a2a20);
  nose.position.set(0, 0.34, 0.92);
  g.add(nose);
  g.add(eyePair(0.3, 0.11, 0.58, 0.6));
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = ball(0.24, 0x8a5a33, 0.7, 1.5, 0.5);
    ear.position.set(side * 0.62, 0.75, 0);
    ear.rotation.z = side * 0.5;
    g.add(ear);
    ears.push(ear);
  }
  const tail = cyl(0.07, 0.1, 0.7, 0x8a5a33, 10);
  tail.position.set(0, -0.45, -0.85);
  tail.rotation.x = -0.9;
  g.add(tail);
  const paws = [];
  for (const side of [-1, 1]) {
    const paw = ball(0.22, 0xf2d3a7);
    paw.position.set(side * 0.42, -1.3, 0.42);
    g.add(paw);
    paws.push(paw);
  }
  const tongue = ball(0.1, 0xff8a9e, 0.9, 1.3, 0.5);
  tongue.position.set(0.08, 0.02, 0.85);
  g.add(tongue);
  g.userData.tick = (t) => {
    tail.rotation.z = Math.sin(t * 9) * 0.5;
    ears.forEach((e, i) => {
      const side = i === 0 ? -1 : 1;
      e.rotation.z = side * 0.5 + Math.sin(t * 3 + i * 2) * 0.08;
    });
    tongue.position.y = 0.02 + Math.sin(t * 6) * 0.02;
  };
  return g;
}

export function buildDuck() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const yellow = 0xffd43b;
  const body = ball(0.8, yellow, 1.15, 0.9, 0.95);
  body.position.set(0, -0.55, 0);
  inner.add(body);
  const head = ball(0.55, yellow);
  head.position.set(0, 0.5, 0.25);
  inner.add(head);
  const beakTop = ball(0.22, 0xff9838, 1.3, 0.45, 1.1);
  beakTop.position.set(0, 0.42, 0.78);
  inner.add(beakTop);
  const eyes = eyePair(0.24, 0.1, 0.66, 0.62);
  inner.add(eyes);
  const wings = [];
  for (const side of [-1, 1]) {
    const w = ball(0.4, 0xffc21d, 1.2, 0.6, 0.9);
    w.position.set(side * 0.8, -0.45, 0);
    w.rotation.z = side * -0.3;
    inner.add(w);
    wings.push(w);
  }
  const tail = ball(0.28, 0xffc21d, 1.2, 0.6, 1);
  tail.position.set(0, -0.3, -0.85);
  tail.rotation.x = 0.7;
  inner.add(tail);
  for (const side of [-1, 1]) {
    const foot = ball(0.18, 0xff9838, 1.4, 0.35, 1.6);
    foot.position.set(side * 0.32, -1.28, 0.15);
    inner.add(foot);
  }
  g.add(inner);
  g.userData.tick = (t) => {
    inner.rotation.z = Math.sin(t * 5) * 0.1;          // よちよち
    inner.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
    beakTop.rotation.x = Math.max(0, Math.sin(t * 2.5)) * 0.25;
  };
  return g;
}

// ---------- E ----------
export function buildElephant() {
  const g = new THREE.Group();
  const gray = 0xa8b8d8;
  const body = ball(0.85, gray, 1.2, 0.95, 0.95);
  body.position.set(0, -0.6, -0.1);
  g.add(body);
  const head = ball(0.68, gray);
  head.position.set(0, 0.45, 0.35);
  g.add(head);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = ball(0.5, 0x91a3c9, 0.25, 1.1, 0.9);
    ear.position.set(side * 0.72, 0.5, 0.15);
    g.add(ear);
    const earIn = ball(0.32, 0xffc2d1, 0.2, 1, 0.75);
    earIn.position.set(side * 0.68, 0.5, 0.18);
    g.add(earIn);
    ears.push(ear);
  }
  g.add(eyePair(0.28, 0.1, 0.62, 0.88));
  const trunkGroup = new THREE.Group();
  trunkGroup.position.set(0, 0.4, 0.9);
  const trunkPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.35, 0.2),
    new THREE.Vector3(0, -0.7, 0.25),
    new THREE.Vector3(0.05, -1.0, 0.12),
    new THREE.Vector3(0.15, -1.15, -0.05),
  ];
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 24, 0.17, 12, false),
    mat(gray)
  );
  trunkGroup.add(trunk);
  g.add(trunkGroup);
  for (let i = 0; i < 4; i++) {
    const leg = cyl(0.2, 0.24, 0.55, 0x91a3c9, 12);
    leg.position.set((i % 2 === 0 ? -1 : 1) * 0.45, -1.35, (i < 2 ? 1 : -1) * 0.3);
    g.add(leg);
  }
  g.userData.tick = (t) => {
    ears.forEach((e, i) => {
      const side = i === 0 ? -1 : 1;
      e.rotation.y = side * Math.abs(Math.sin(t * 2)) * 0.3;
    });
    trunkGroup.rotation.x = Math.sin(t * 1.8) * 0.25;
    trunkGroup.rotation.z = Math.sin(t * 1.1) * 0.1;
  };
  return g;
}

export function buildEgg() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const shell = ball(0.85, 0xfff4dc, 0.95, 1.2, 0.95);
  inner.add(shell);
  const dots = [
    [-0.3, 0.5, 0.65], [0.35, 0.2, 0.72], [-0.15, -0.3, 0.78], [0.15, 0.75, 0.5],
  ];
  for (const [x, y, z] of dots) {
    const d = ball(0.07, 0xffd9a0, 1, 0.7, 0.4);
    d.position.set(x, y, z);
    inner.add(d);
  }
  const eyes = eyePair(0.26, 0.1, 0.1, 0.72);
  inner.add(eyes);
  inner.add(smile(0.18, -0.22, 0.8));
  const cheeks = [];
  for (const side of [-1, 1]) {
    const c = ball(0.1, 0xffc2d1, 1.3, 0.9, 0.5);
    c.position.set(side * 0.5, -0.08, 0.64);
    inner.add(c);
    cheeks.push(c);
  }
  g.add(inner);
  g.userData.tick = (t) => {
    inner.rotation.z = Math.sin(t * 3.2) * 0.18;       // ころころゆれる
  };
  return g;
}
