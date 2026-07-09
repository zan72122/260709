// 文字ごとの変身コントローラ。
// どの変身も「文字メッシュが画面に残ったまま」傾き・伸び・パーツ生えで完成する。
//   A: 尖った頂点=機首、ハの字=翼 → かみひこうき
//   B: ふたこぶ=羽、穴=目玉模様、縦棒=胴体 → ちょうちょ
//   C: 欠け=かじりあと → クッキー(欠けが閉じて、また同じ場所をかじられる)
//   D: 横に倒すとアーチ=背中 → きょうりゅう
//   E: 横に倒すと3本の腕=鼻+足 → ぞう
import * as THREE from 'three';
import { buildLetterParts, shapeCWedge, LETTER_EXTRUDE } from './letters.js';
import { tween, after, Ease } from './anim.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...opts });
}

function ball(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat(color));
  m.scale.set(sx, sy, sz);
  return m;
}

function disc(r, color, z = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), mat(color));
  m.position.z = z;
  return m;
}

function eyePair(spacing, size, y = 0, z = 0) {
  const g = new THREE.Group();
  const pupils = [];
  for (const side of [-1, 1]) {
    const white = ball(size, 0xffffff);
    white.position.set(side * spacing, y, z);
    const pupil = ball(size * 0.52, 0x2b2b3a);
    pupil.position.set(side * spacing, y, z + size * 0.6);
    g.add(white, pupil);
    pupils.push(white, pupil);
  }
  g.userData.blink = (t, phase = 0) => {
    const b = Math.sin(t * 1.4 + phase) > 0.985 ? 0.12 : 1;
    for (const p of pupils) p.scale.y = b;
  };
  return g;
}

function popIn(obj, { dur = 0.45, delay = 0, to = 1 } = {}) {
  obj.visible = true;
  const base = obj.userData.baseScale || new THREE.Vector3(to, to, to);
  tween(dur, (k) => obj.scale.set(base.x * k, base.y * k, base.z * k), { delay, ease: Ease.outBack });
}

function hidden(obj, baseScale = null) {
  obj.visible = false;
  obj.scale.setScalar(0.0001);
  if (baseScale) obj.userData.baseScale = baseScale;
  return obj;
}

function lerpMatColor(material, toHex, dur = 0.5) {
  const from = material.color.clone();
  const to = new THREE.Color(toHex);
  tween(dur, (k) => material.color.lerpColors(from, to, k));
}

// ============================================================
// A → ✈️ Airplane
// ============================================================
function createA(color, ctx) {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  group.add(tilt);
  const parts = buildLetterParts('A', color);
  tilt.add(parts.group);

  // 折り目(横棒がそのまま折り線になる)
  const fold = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.08, 0.78),
    new THREE.MeshStandardMaterial({
      color: 0xffe28a, emissive: 0xffc93b, emissiveIntensity: 0.9,
      transparent: true, opacity: 0,
    })
  );
  fold.position.set(0, -0.31, 0.25);
  parts.shapeSpace.add(fold);

  // 三角の穴=まど。中からちいさな顔がのぞく
  const win = new THREE.Group();
  win.add(disc(0.155, 0xfff8e8));
  const winEyes = eyePair(0.06, 0.035, 0.01, 0.02);
  win.add(winEyes);
  win.position.set(0, 0.06, 0.62);
  parts.shapeSpace.add(hidden(win));

  // 翼の先の折り耳
  const flaps = [];
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.06), mat(0xf4f6ff));
    f.position.set(side * 0.73, -0.92, 0.5);
    f.rotation.y = side * 1.0;
    parts.shapeSpace.add(hidden(f));
    flaps.push(f);
  }

  let stage = 0;
  let flying = false;
  let trailAcc = 0;

  return {
    group,
    poke(n) {
      stage = n;
      ctx.sfx.rustle();
      const lean = [-0.38, -0.72, -1.02][n - 1];
      const from = tilt.rotation.x;
      tween(0.5, (k) => { tilt.rotation.x = THREE.MathUtils.lerp(from, lean, k); }, { ease: Ease.outBack });
      lerpMatColor(parts.material, [0xffb8b8, 0xfbe3e6, 0xf4f6ff][n - 1], 0.5);
      if (n === 2) tween(0.5, (k) => { fold.material.opacity = k; });
      if (n === 3) { popIn(win); ctx.sfx.poko(); }
    },
    pull(n) {
      ctx.sfx.snap();
      const sy = [1.22, 1.45][n - 1];
      const sx = [0.82, 0.66][n - 1];
      const g = parts.group;
      const fy = g.scale.y, fx = g.scale.x;
      tween(0.55, (k) => {
        g.scale.y = THREE.MathUtils.lerp(fy, sy, k);
        g.scale.x = THREE.MathUtils.lerp(fx, sx, k);
      }, { ease: Ease.outElastic });
      if (n === 2) { flaps.forEach((f, i) => popIn(f, { delay: i * 0.12 })); ctx.sfx.poko(); }
    },
    finale(onDone) {
      ctx.sfx.whoosh();
      flying = true;
      tween(0.3, (k) => { group.rotation.z = 0.5 * k; });
      tween(2.9, (k) => {
        const ramp = Math.sin(k * Math.PI);
        const a = k * Math.PI * 4;           // 2周ループ
        group.position.x = Math.sin(a) * 2.3 * ramp;
        group.position.y = Math.sin(a * 0.5) * 1.5 * ramp;
        group.rotation.z = Math.cos(a) * 0.7 * ramp;
      }, {
        delay: 0.3, ease: Ease.inOutCubic,
        onDone: () => {
          flying = false;
          tween(0.4, (k) => { group.rotation.z *= (1 - k); });
          ctx.sfx.sparkle();
          onDone();
        },
      });
      after(1.5, () => ctx.sfx.whoosh());
    },
    tick(t, dt) {
      winEyes.userData.blink && win.visible && winEyes.userData.blink(t);
      if (stage >= 3 && !flying) tilt.rotation.z = Math.sin(t * 2.2) * 0.05;   // 紙のふるえ
      if (stage >= 2) fold.material.emissiveIntensity = 0.7 + Math.sin(t * 5) * 0.3;
      if (flying) {
        trailAcc += dt;
        if (trailAcc > 0.07) {
          trailAcc = 0;
          ctx.fx.burst(group.position.clone().setZ(0.3), 3, 0.8, 0.5, [0xffffff, 0xbfe3ff]);
        }
      }
    },
  };
}

// ============================================================
// B → 🦋 Butterfly
// ============================================================
function createB(color, ctx) {
  const group = new THREE.Group();
  const right = buildLetterParts('B', color);
  const left = buildLetterParts('B', color);
  const hx = -0.5 - right.center.x;   // 縦棒(ちょうつがい)のX位置

  function makeWing(parts) {
    const pivot = new THREE.Group();
    pivot.position.x = hx;
    parts.group.position.x = -hx;
    pivot.add(parts.group);
    return pivot;
  }
  const rightPivot = makeWing(right);
  const leftPivot = makeWing(left);
  leftPivot.scale.x = -1;
  leftPivot.rotation.y = Math.PI * 0.97;
  leftPivot.visible = false;
  group.add(rightPivot, leftPivot);

  // 穴=目玉模様、こぶ=模様ドット(左右両方の shapeSpace に追加)
  const spotDefs = [
    { x: -0.05, y: 0.52, r: 0.185, c: 0xffa94d },
    { x: -0.02, y: -0.48, r: 0.215, c: 0xffd43b },
  ];
  const dotDefs = [
    { x: 0.32, y: 0.62, r: 0.09, c: 0xff8ac2 },
    { x: 0.42, y: -0.4, r: 0.1, c: 0x69c95e },
    { x: 0.3, y: -0.78, r: 0.07, c: 0xfff3d6 },
    { x: 0.36, y: 0.28, r: 0.06, c: 0xb197fc },
  ];
  const spots = [], dots = [];
  for (const parts of [right, left]) {
    for (const d of spotDefs) {
      const m = disc(d.r, d.c, 0.62);
      m.position.set(d.x, d.y, 0.62);
      parts.shapeSpace.add(hidden(m));
      spots.push(m);
    }
    for (const d of dotDefs) {
      const m = disc(d.r, d.c, 0.62);
      m.position.set(d.x, d.y, 0.62);
      parts.shapeSpace.add(hidden(m));
      dots.push(m);
    }
  }

  // 胴体・顔・触角(縦棒の上)
  const bodyG = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.7, 8, 16), mat(0x8a6d4f));
  bodyG.add(body);
  const head = ball(0.3, 0x8a6d4f);
  head.position.y = 1.15;
  bodyG.add(head);
  const eyes = eyePair(0.13, 0.075, 1.2, 0.24);
  bodyG.add(eyes);
  const antennae = [];
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      pts.push(new THREE.Vector3(side * (0.1 + s * 0.28 + Math.sin(s * 4) * 0.05), 1.35 + s * 0.5, 0));
    }
    const a = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 6, false),
      mat(0x5a4632)
    );
    const tip = ball(0.06, 0xff8ac2);
    tip.position.copy(pts[8]);
    const ag = new THREE.Group();
    ag.add(a, tip);
    bodyG.add(ag);
    antennae.push(ag);
  }
  bodyG.position.set(hx, 0, 0.35);
  group.add(hidden(bodyG));

  let opened = 0;
  let leftRest = null;   // 開きトゥイーン完了後の停止角(完了までtickは触らない)
  let flying = false;
  let flapAmp = 0;
  let trailAcc = 0;

  return {
    group,
    poke(n) {
      ctx.sfx.poko();
      if (n === 1) spots.forEach((s, i) => popIn(s, { delay: i * 0.08 }));
      if (n === 2) {
        dots.forEach((d, i) => popIn(d, { delay: i * 0.06 }));
        lerpMatColor(right.material, 0x59b9ff, 0.5);
        lerpMatColor(left.material, 0x59b9ff, 0.5);
      }
      if (n === 3) { popIn(bodyG); ctx.sfx.sparkle(); }
    },
    pull(n) {
      ctx.sfx.flap();
      opened = n;
      leftRest = null;
      const to = n === 1 ? 0.55 : 0.06;
      if (n === 1) leftPivot.visible = true;
      const from = leftPivot.rotation.y;
      tween(0.7, (k) => { leftPivot.rotation.y = THREE.MathUtils.lerp(from, to, k); }, {
        ease: Ease.outElastic,
        onDone: () => { leftRest = to; },
      });
      if (n === 2) {
        tween(0.6, (k) => { group.position.x = -hx * k; });   // 開いたぶん中央へ
        after(0.3, () => ctx.sfx.flap());
      }
      flapAmp = n === 1 ? 0.1 : 0.22;
    },
    finale(onDone) {
      flying = true;
      flapAmp = 0.55;
      for (let i = 0; i < 9; i++) after(0.28 * i, () => ctx.sfx.flap());
      tween(3.2, (k) => {
        const ramp = Math.sin(k * Math.PI);
        group.position.x = -hx + Math.sin(k * Math.PI * 2) * 2.2 * ramp;
        group.position.y = Math.sin(k * Math.PI * 4) * 1.1 * ramp + ramp * 0.8;
        group.rotation.z = Math.sin(k * Math.PI * 4 + 1) * 0.18 * ramp;
      }, {
        ease: Ease.inOutCubic,
        onDone: () => {
          flying = false;
          flapAmp = 0.3;
          ctx.sfx.sparkle();
          onDone();
        },
      });
    },
    tick(t, dt) {
      if (bodyG.visible) eyes.userData.blink(t);
      const speed = flying ? 26 : 7;
      const f = Math.abs(Math.sin(t * speed)) * flapAmp;
      rightPivot.rotation.y = -f;
      if (leftRest !== null) leftPivot.rotation.y = leftRest - f;
      antennae.forEach((a, i) => { a.rotation.z = Math.sin(t * 3 + i * 2) * 0.1; });
      if (flying) {
        trailAcc += dt;
        if (trailAcc > 0.09) {
          trailAcc = 0;
          ctx.fx.burst(group.position.clone().setZ(0.3), 2, 0.7, 0.5, [0xffd43b, 0xff8ac2, 0xbfe3ff]);
        }
      }
    },
  };
}

// ============================================================
// C → 🍪 Cookie
// ============================================================
function createC(color, ctx) {
  const group = new THREE.Group();
  const parts = buildLetterParts('C', color);
  group.add(parts.group);

  // 欠け(かじりあと)を埋める生地ピース
  const wedgeGeo = new THREE.ExtrudeGeometry(shapeCWedge(), LETTER_EXTRUDE);
  const wedgeMat = parts.material.clone();
  const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
  wedge.scale.set(0.0001, 0.0001, 1);
  wedge.visible = false;
  parts.shapeSpace.add(wedge);

  // まんなかの生地(閉じたら穴もふさがって、まんまるクッキーに)
  const centerFill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.52, 40),
    wedgeMat
  );
  centerFill.rotation.x = Math.PI / 2;
  centerFill.position.set(0, 0, 0.25);
  parts.shapeSpace.add(hidden(centerFill));

  // チョコチップ
  const chipAngles = [1.0, 1.6, 2.2, 2.8, 3.65, 4.2, 4.75, 5.25];
  const chips = chipAngles.map((a, i) => {
    const r = i % 2 === 0 ? 0.76 : 0.78;
    const c = ball(0.11, 0x5b3a24, 1, 1, 0.55);
    c.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.62);
    parts.shapeSpace.add(hidden(c, new THREE.Vector3(1, 1, 0.55)));
    return c;
  });

  // 目と口(クッキーもにっこり)
  const face = new THREE.Group();
  const eyes = eyePair(0.17, 0.08, 0.08, 0.02);
  face.add(eyes);
  face.position.set(-0.7, 0.1, 0.62);
  parts.shapeSpace.add(hidden(face));

  let rolling = false;
  let gapClosed = 0;

  const gapWorld = () => new THREE.Vector3(0.85 - parts.center.x, 0, 0.4);

  return {
    group,
    poke(n) {
      ctx.sfx.poko();
      lerpMatColor(parts.material, [0xe8a952, 0xd18a3c, 0xb9772f][n - 1], 0.5);
      const per = [[0, 3], [3, 6], [6, 8]][n - 1];
      for (let i = per[0]; i < per[1]; i++) popIn(chips[i], { delay: (i - per[0]) * 0.09 });
      if (n === 3) { popIn(face); ctx.sfx.sparkle(); }
    },
    pull(n) {
      ctx.sfx.grow();
      wedge.visible = true;
      const to = n === 1 ? 0.55 : 1.0;
      const fx = wedge.scale.x;
      tween(0.7, (k) => {
        const s = THREE.MathUtils.lerp(fx, to, k);
        wedge.scale.set(s, s, 1);
      }, { ease: Ease.outElastic });
      if (n === 2) {
        // 欠けが閉じたら、まんなかの穴も生地でふさがる → まんまるクッキー完成
        after(0.35, () => { popIn(centerFill); ctx.sfx.poko(); });
      }
    },
    finale(onDone) {
      rolling = true;
      for (let i = 0; i < 5; i++) after(0.28 * i, () => ctx.sfx.coro());
      tween(1.4, (k) => {
        group.rotation.z = -Math.PI * 4 * k;
        group.position.y = Math.abs(Math.sin(k * Math.PI * 4)) * 0.18;
      }, {
        ease: Ease.inOutCubic,
        onDone: () => { rolling = false; },
      });
      // ガブッ! 欠けとおなじ場所がかじられて、また C にもどる
      after(1.75, () => {
        ctx.sfx.chomp();
        gapClosed = 0.45;
        tween(0.1, (k) => { const s = THREE.MathUtils.lerp(1, 0.45, k); wedge.scale.set(s, s, 1); });
        tween(0.25, (k) => { group.rotation.z = 0.16 * Math.sin(k * Math.PI); });
        ctx.fx.burst(gapWorld(), 16, 3, 0.8, [0xb9772f, 0x8a5a33, 0x5b3a24]);
      });
      after(2.35, () => {
        ctx.sfx.chomp();
        ctx.shake(0.1);
        // おおきなひと口は、まんなかの生地までガブッ → もとのCの形に
        tween(0.12, (k) => {
          const s = THREE.MathUtils.lerp(0.45, 0.0001, k);
          wedge.scale.set(s, s, 1);
          const cs = THREE.MathUtils.lerp(1, 0.0001, k);
          centerFill.scale.setScalar(cs);
        }, { onDone: () => { wedge.visible = false; centerFill.visible = false; } });
        tween(0.3, (k) => { group.rotation.z = -0.2 * Math.sin(k * Math.PI); });
        ctx.fx.burst(gapWorld(), 26, 4, 0.9, [0xb9772f, 0x8a5a33, 0x5b3a24, 0xffd9a0]);
      });
      after(2.9, onDone);
    },
    tick(t) {
      wedgeMat.color.copy(parts.material.color);
      if (face.visible) eyes.userData.blink(t);
      if (!rolling && face.visible) group.rotation.z = Math.sin(t * 1.8) * 0.06;
    },
  };
}

// ============================================================
// D → 🦕 Dinosaur
// ============================================================
function createD(color, ctx) {
  const group = new THREE.Group();
  const orient = new THREE.Group();
  group.add(orient);
  const parts = buildLetterParts('D', color);
  orient.add(parts.group);

  const DINO = 0x5fbf6e;

  // おなかのもよう(Dの穴)
  const belly = disc(0.44, 0xc9f2c0);
  belly.position.set(-0.05, 0, 0.3);
  parts.shapeSpace.add(hidden(belly));

  // ねている姿勢での前方(みぎ)= 文字座標では下辺側
  const letterEyes = eyePair(0.14, 0.1, 0, 0);
  letterEyes.position.set(0.55, -0.55, 0.62);
  parts.shapeSpace.add(hidden(letterEyes));

  // くび+あたま(横倒し後のワールド座標で右上へ)
  const headG = new THREE.Group();
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.9, 14), mat(DINO));
  neck.position.set(0.28, 0.42, 0);
  neck.rotation.z = -0.6;
  headG.add(neck);
  const head = ball(0.32, DINO, 1.15, 1, 1);
  head.position.set(0.62, 0.82, 0);
  headG.add(head);
  const snout = ball(0.17, 0x8fd99a, 1.3, 0.75, 0.9);
  snout.position.set(0.92, 0.76, 0);
  headG.add(snout);
  const headEyes = eyePair(0.13, 0.09, 0.95, 0.26);
  headEyes.position.x = 0.6;
  headG.add(headEyes);
  headG.position.set(0.85, 0.15, 0);
  group.add(hidden(headG));

  // しっぽ(左へ)
  const tailG = new THREE.Group();
  const tailPts = [
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.45, -0.05, 0),
    new THREE.Vector3(-0.85, 0.05, 0), new THREE.Vector3(-1.15, 0.3, 0),
  ];
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.16, 10, false),
    mat(DINO)
  );
  const tailTip = ball(0.1, DINO);
  tailTip.position.copy(tailPts[3]);
  tailG.add(tail, tailTip);
  tailG.position.set(-0.95, -0.35, 0);
  group.add(hidden(tailG));

  // 背板(Dのアーチに沿ってならぶ)
  const plates = [150, 120, 90, 60, 30].map((deg) => {
    const a = THREE.MathUtils.degToRad(deg);
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), mat(0x37a34a));
    p.scale.z = 0.45;
    p.position.set(Math.cos(a) * 1.12, Math.sin(a) * 1.12 - 0.12, 0);
    p.rotation.z = a - Math.PI / 2;
    group.add(hidden(p));
    return p;
  });

  // あし
  const legs = [[-0.55, 0.28], [0.55, 0.28], [-0.55, -0.28], [0.55, -0.28]].map(([x, z]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12), mat(0x4bab5c));
    l.position.set(x, -1.1, z);
    group.add(hidden(l));
    return l;
  });

  let stage = 0;
  let stomping = false;

  return {
    group,
    poke(n) {
      stage = n;
      ctx.sfx.poko();
      const rot = [0.5, 1.05, Math.PI / 2][n - 1];
      const from = orient.rotation.z;
      tween(0.6, (k) => { orient.rotation.z = THREE.MathUtils.lerp(from, rot, k); }, { ease: Ease.outBack });
      lerpMatColor(parts.material, [0xc3a2f2, 0x93cf7e, DINO][n - 1], 0.5);
      if (n === 3) { popIn(belly); popIn(letterEyes, { delay: 0.15 }); ctx.sfx.sparkle(); }
    },
    pull(n, dir) {
      ctx.sfx.grow();
      const growNeck = () => {
        letterEyes.visible = false;         // 目はあたまへおひっこし
        popIn(headG, { dur: 0.7 });
        [0, 1, 2].forEach((i) => { popIn(plates[i], { delay: 0.15 + i * 0.1 }); after(0.15 + i * 0.1, () => ctx.sfx.poko()); });
      };
      const growTail = () => {
        popIn(tailG, { dur: 0.7 });
        [3, 4].forEach((i, j) => { popIn(plates[i], { delay: 0.15 + j * 0.1 }); after(0.15 + j * 0.1, () => ctx.sfx.poko()); });
        legs.forEach((l, i) => popIn(l, { delay: 0.3 + i * 0.07 }));
        tween(0.5, (k) => { group.position.y = 0.18 * k; }, { delay: 0.3 });
      };
      if (n === 1) (dir >= 0 ? growNeck : growTail)();
      else (headG.visible ? growTail : growNeck)();
    },
    finale(onDone) {
      ctx.sfx.roar();
      stomping = true;
      tween(0.5, (k) => { headG.rotation.z = 0.25 * Math.sin(k * Math.PI); });
      [0.7, 1.15, 1.6, 2.05].forEach((tt, i) => {
        after(tt, () => {
          tween(0.18, (k) => { group.position.y = 0.18 + Math.sin(k * Math.PI) * 0.3; }, {
            onDone: () => {
              ctx.sfx.stomp();
              ctx.shake(0.2);
              ctx.fx.burst(new THREE.Vector3(i % 2 === 0 ? -0.6 : 0.6, -1.3, 0.3), 8, 2, 0.6, [0xcbb89a, 0xe0d3b8]);
            },
          });
        });
      });
      after(2.6, () => { ctx.sfx.roar(); onDone(); });
      after(2.61, () => { stomping = false; });
    },
    tick(t) {
      if (letterEyes.visible) letterEyes.userData.blink(t);
      if (headG.visible) {
        headEyes.userData.blink(t, 1);
        if (!stomping) headG.rotation.z = Math.sin(t * 1.6) * 0.06;
      }
      if (tailG.visible) tailG.rotation.z = Math.sin(t * (stomping ? 9 : 2.2)) * (stomping ? 0.3 : 0.12);
    },
  };
}

// ============================================================
// E → 🐘 Elephant
// ============================================================
function createE(color, ctx) {
  const group = new THREE.Group();
  const orient = new THREE.Group();
  group.add(orient);
  const parts = buildLetterParts('E', color);
  orient.add(parts.group);

  const GRAY = 0x9db3d6;

  // 目(文字座標で貼ると、倒れたあと前上にくる)
  const eyes = eyePair(0.13, 0.1, 0, 0);
  eyes.position.set(-0.42, 0.8, 0.62);
  eyes.rotation.z = Math.PI / 2;      // 倒れたときに正立する
  parts.shapeSpace.add(hidden(eyes));

  // みみ(横向きのぞうなので、手前と奥に大きなうちわ型)
  const ears = [];
  for (const side of [-1, 1]) {
    const eg = new THREE.Group();
    const ear = ball(0.52, 0x8fa7cf, 0.95, 1.15, 0.18);
    const inner = ball(0.34, 0xffc2d1, 0.8, 1.0, 0.1);
    inner.position.z = side * 0.12;
    eg.add(ear, inner);
    eg.position.set(0.42, 0.38, side * 0.42);
    eg.rotation.y = side * 0.35;
    group.add(hidden(eg));
    ears.push(eg);
  }

  // はな(いちばん前の腕がそのまま伸びる)
  const TRUNK_ROOT = new THREE.Vector3(0.78, -0.8, 0);
  const trunkG = new THREE.Group();
  trunkG.position.copy(TRUNK_ROOT);
  group.add(trunkG);
  const trunkMat = mat(GRAY);
  let trunkMesh = null;
  const trunkTip = ball(0.2, GRAY);
  trunkTip.visible = false;
  trunkG.add(trunkTip);

  // swing: 0=たれ下がり 1=もちあげ
  function trunkPoints(swing) {
    const down = [
      [0, 0, 0], [0.02, -0.38, 0], [0.1, -0.7, 0], [0.32, -0.88, 0], [0.54, -0.78, 0], [0.62, -0.55, 0],
    ];
    const up = [
      [0, 0, 0], [0.14, -0.28, 0], [0.4, -0.38, 0], [0.68, -0.15, 0], [0.82, 0.25, 0], [0.78, 0.58, 0],
    ];
    return down.map((p, i) => new THREE.Vector3(
      THREE.MathUtils.lerp(p[0], up[i][0], swing),
      THREE.MathUtils.lerp(p[1], up[i][1], swing),
      0
    ));
  }

  let trunkGrow = 0;    // 0..1
  let trunkSwing = 0;
  function rebuildTrunk() {
    if (trunkMesh) {
      trunkG.remove(trunkMesh);
      trunkMesh.geometry.dispose();
    }
    if (trunkGrow <= 0.02) { trunkTip.visible = false; return; }
    const all = new THREE.CatmullRomCurve3(trunkPoints(trunkSwing)).getPoints(40);
    const upto = Math.max(3, Math.floor(40 * trunkGrow));
    const sub = all.slice(0, upto + 1);
    trunkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 24, 0.21, 10, false),
      trunkMat
    );
    trunkG.add(trunkMesh);
    trunkTip.visible = true;
    trunkTip.position.copy(sub[sub.length - 1]);
  }

  // しっぽ
  const tailG = new THREE.Group();
  const tailLine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), mat(0x8fa7cf));
  tailLine.position.y = -0.27;
  const tuft = ball(0.1, 0x6e83a8, 1, 1.3, 1);
  tuft.position.y = -0.58;
  tailG.add(tailLine, tuft);
  tailG.position.set(-1.0, 0.5, 0);
  group.add(hidden(tailG));

  // あしのつめ(のこり2本の腕がそのまま足になる)
  const toes = [];
  for (const legX of [0, -0.78]) {
    for (const side of [-0.13, 0.13]) {
      const toe = ball(0.09, 0xfff4dc, 1, 0.8, 1);
      toe.position.set(legX + side, -0.92, 0.36);
      group.add(hidden(toe));
      toes.push(toe);
    }
  }

  let spraying = false;

  return {
    group,
    poke(n) {
      ctx.sfx.poko();
      const rot = [-0.5, -1.05, -Math.PI / 2][n - 1];
      const from = orient.rotation.z;
      tween(0.6, (k) => { orient.rotation.z = THREE.MathUtils.lerp(from, rot, k); }, { ease: Ease.outBack });
      lerpMatColor(parts.material, [0x7cc7a2, 0x93b7c9, GRAY][n - 1], 0.5);
      if (n === 2) popIn(eyes);
      if (n === 3) {
        ears.forEach((e, i) => popIn(e, { delay: i * 0.15 }));
        ctx.sfx.sparkle();
      }
    },
    pull(n) {
      ctx.sfx.grow();
      const to = n === 1 ? 0.55 : 1.0;
      const from = trunkGrow;
      tween(0.8, (k) => {
        trunkGrow = THREE.MathUtils.lerp(from, to, k);
        rebuildTrunk();
      }, { ease: Ease.outCubic });
      if (n === 2) {
        popIn(tailG, { delay: 0.4 });
        toes.forEach((toe, i) => popIn(toe, { delay: 0.5 + i * 0.06 }));
        after(0.5, () => ctx.sfx.poko());
      }
    },
    finale(onDone) {
      ctx.sfx.trumpet();
      spraying = true;
      const from = trunkSwing;
      tween(0.6, (k) => {
        trunkSwing = THREE.MathUtils.lerp(from, 1, k);
        rebuildTrunk();
      });
      [0.7, 1.0, 1.3].forEach((tt) => {
        after(tt, () => {
          ctx.sfx.spray();
          const tip = trunkG.localToWorld(trunkTip.position.clone());
          ctx.fx.burst(new THREE.Vector3(tip.x, tip.y + 0.2, 0.5), 18, 3.5, 1.0, [0xbfe9ff, 0x8fd3ff, 0xffffff]);
        });
      });
      [1.7, 2.15].forEach((tt) => {
        after(tt, () => {
          tween(0.18, (k) => { group.position.y = Math.sin(k * Math.PI) * 0.25; }, {
            onDone: () => { ctx.sfx.stomp(); ctx.shake(0.15); },
          });
        });
      });
      after(2.6, () => {
        spraying = false;
        const f2 = trunkSwing;
        tween(0.7, (k) => { trunkSwing = THREE.MathUtils.lerp(f2, 0.15, k); rebuildTrunk(); });
        onDone();
      });
    },
    tick(t) {
      if (eyes.visible) eyes.userData.blink(t);
      ears.forEach((e, i) => {
        const side = i === 0 ? -1 : 1;
        if (e.visible) e.rotation.y = side * 0.35 + Math.sin(t * 2.2 + i * 2) * 0.15;
      });
      if (trunkGrow > 0 && !spraying) trunkG.rotation.z = Math.sin(t * 1.7) * 0.09;
      if (tailG.visible) tailG.rotation.z = Math.sin(t * 3.1) * 0.25;
    },
  };
}

// ============================================================
const FACTORIES = { A: createA, B: createB, C: createC, D: createD, E: createE };

export function createTransform(char, color, ctx) {
  return FACTORIES[char](color, ctx);
}
