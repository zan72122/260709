// ---------------------------------------------------------------------------
// machine.js — the factory machine: Tusi-couple mechanism (a circle rolling
// inside a circle twice its size), the sliding nozzle it drives, the hopper,
// the wobbly feed tube, decorative gears and the signboard.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { PALETTE, FLAVOURS } from './colors.js';

export const MACHINE = {
  RING_C: new THREE.Vector3(0, 5.75, -0.28), // centre of the big ring
  R: 1.5,                                    // big ring radius = nozzle travel
  RAIL_Y: 4.2,                               // slider rail height
  SPOUT_EXIT_Y: 3.62,                        // where marbles pop out
  HOPPER_POS: new THREE.Vector3(0, 8.05, -0.1),
};

export function createMachine(scene) {
  const grp = new THREE.Group();
  scene.add(grp);

  const mats = {
    body: new THREE.MeshStandardMaterial({ color: 0xffe9c8, roughness: 0.55, metalness: 0.02 }),
    body2: new THREE.MeshStandardMaterial({ color: 0xffd9e6, roughness: 0.6, metalness: 0.02 }),
    mint: new THREE.MeshStandardMaterial({ color: PALETTE.mint, roughness: 0.45, metalness: 0.05 }),
    mint2: new THREE.MeshStandardMaterial({ color: PALETTE.mint2, roughness: 0.45, metalness: 0.05 }),
    pink: new THREE.MeshStandardMaterial({ color: PALETTE.pink, roughness: 0.4, metalness: 0.05 }),
    pink2: new THREE.MeshStandardMaterial({ color: PALETTE.pink2, roughness: 0.35, metalness: 0.08 }),
    wood: new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: PALETTE.steel, roughness: 0.25, metalness: 0.65 }),
    gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.3, metalness: 0.5 }),
    cherry: new THREE.MeshPhysicalMaterial({ color: 0xff4d6e, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xfff0f6, emissive: 0xff9cc0, emissiveIntensity: 0.9, roughness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xeefaff, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.24,
      clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
    }),
  };

  const RC = MACHINE.RING_C, R = MACHINE.R;

  // ======================= back panel & frame ==============================
  const panel = makeRoundedPanel(7.0, 7.3, 0.6, 0.45, mats.body);
  panel.position.set(0, 5.15, -0.75);
  panel.castShadow = panel.receiveShadow = true;
  grp.add(panel);

  // inner recessed circle behind the ring
  const recess = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.42, R + 0.42, 0.22, 48), mats.body2);
  recess.rotation.x = Math.PI / 2;
  recess.position.copy(RC).z = -0.5;
  grp.add(recess);

  // two legs + feet
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.1, 20), mats.mint);
    leg.position.set(sx * 2.6, 0.95, -0.75);
    leg.castShadow = true;
    grp.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), mats.pink);
    foot.position.set(sx * 2.6, 0.18, -0.75);
    foot.scale.y = 0.5;
    foot.castShadow = true;
    grp.add(foot);
  }

  // pastel bands so the panel isn't a plain slab
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.9, 0.12), mats.mint);
  skirt.position.set(0, 2.15, -0.34);
  grp.add(skirt);
  const topBand = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.5, 0.12), mats.pink);
  topBand.position.set(0, 8.25, -0.34);
  grp.add(topBand);
  const bandDots = new THREE.SphereGeometry(0.09, 10, 8);
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(bandDots, i % 2 ? mats.pink2 : mats.gold);
    d.position.set(-2.7 + i * 0.9, 2.15, -0.26);
    grp.add(d);
  }

  // little bolts on panel corners
  const boltGeo = new THREE.SphereGeometry(0.11, 12, 10);
  for (const [bx, by] of [[-3.0, 2.15], [3.0, 2.15], [-3.0, 8.15], [3.0, 8.15]]) {
    const b = new THREE.Mesh(boltGeo, mats.gold);
    b.position.set(bx, by, -0.42);
    grp.add(b);
  }

  // ======================= the Tusi couple =================================
  // big outer ring (with gear teeth, because factories have gears)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.16, 0.14, 18, 72), mats.mint2);
  ring.position.copy(RC);
  ring.castShadow = true;
  grp.add(ring);
  const teeth = new THREE.Group();
  const toothGeo = new THREE.BoxGeometry(0.09, 0.16, 0.16);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, mats.mint2);
    t.position.set(Math.cos(a) * (R + 0.36), Math.sin(a) * (R + 0.36), 0);
    t.rotation.z = a;
    teeth.add(t);
  }
  teeth.position.copy(RC);
  grp.add(teeth);

  // glass window over the mechanism
  const windowGlass = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.14, R + 0.14, 0.06, 48), mats.glass);
  windowGlass.rotation.x = Math.PI / 2;
  windowGlass.position.copy(RC).z = 0.18;
  grp.add(windowGlass);

  // the magic straight slot the pin slides in — dark groove + glowing core,
  // in front of the rolling disc so "circle makes a straight line!" reads clearly
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(R * 2 + 0.34, 0.17, 0.05),
    new THREE.MeshStandardMaterial({ color: PALETTE.navy, roughness: 0.5 })
  );
  slot.position.copy(RC).z = RC.z + 0.16;
  grp.add(slot);
  const track = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.06, 0.045), mats.glow);
  track.position.copy(RC).z = RC.z + 0.19;
  grp.add(track);
  for (const sx of [-1, 1]) { // slot end caps
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.navy, roughness: 0.5 }));
    cap.position.set(sx * (R + 0.17), RC.y, RC.z + 0.16);
    grp.add(cap);
  }

  // the rolling disc (half the ring's size) with a cute face
  const disc = new THREE.Group();
  const discBody = new THREE.Mesh(new THREE.CylinderGeometry(R / 2, R / 2, 0.16, 40),
    new THREE.MeshStandardMaterial({ color: 0xffb3cd, roughness: 0.4 }));
  discBody.rotation.x = Math.PI / 2;
  discBody.castShadow = true;
  disc.add(discBody);
  const discRim = new THREE.Mesh(new THREE.TorusGeometry(R / 2, 0.055, 12, 40), mats.pink2);
  discRim.position.z = 0.02;
  disc.add(discRim);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R / 2 - 0.1, 32),
    new THREE.MeshBasicMaterial({ map: makeFaceTexture(), transparent: true })
  );
  face.position.z = 0.095;
  disc.add(face);
  grp.add(disc);

  // the magic pin (a shiny cherry) that travels in a straight line
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), mats.cherry);
  pin.castShadow = true;
  grp.add(pin);
  const pinStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), mats.steel);
  grp.add(pinStem);

  // ======================= rail + sliding nozzle ===========================
  const rail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, (R + 0.55) * 2, 6, 14), mats.steel);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, MACHINE.RAIL_Y, 0);
  rail.castShadow = true;
  grp.add(rail);
  for (const sx of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.3), mats.mint2);
    bracket.position.set(sx * (R + 0.62), MACHINE.RAIL_Y - 0.05, -0.2);
    grp.add(bracket);
  }

  // connecting rod: pin → carriage
  const rod = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, RC.y - MACHINE.RAIL_Y, 6, 12), mats.steel);
  rod.castShadow = true;
  grp.add(rod);

  // nozzle carriage (what shuttles left–right)
  const spout = new THREE.Group();
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), mats.pink2);
  carriage.castShadow = true;
  spout.add(carriage);
  const carriageTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.24, 16), mats.gold);
  carriageTop.position.y = 0.34;
  spout.add(carriageTop);
  // funnel-shaped nozzle
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.155, 0.5, 20, 1, true), mats.mint);
  nozzle.material = mats.mint.clone();
  nozzle.material.side = THREE.DoubleSide;
  nozzle.position.y = -0.44;
  nozzle.castShadow = true;
  spout.add(nozzle);
  const nozzleLip = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.05, 10, 20), mats.gold);
  nozzleLip.rotation.x = Math.PI / 2;
  nozzleLip.position.y = -0.68;
  spout.add(nozzleLip);
  spout.position.set(0, MACHINE.RAIL_Y, 0.1);
  grp.add(spout);

  // ======================= hopper on top ===================================
  const hopper = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 1.0, 24, 1, true), mats.glass);
  bowl.castShadow = false;
  hopper.add(bowl);
  const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 12, 32), mats.gold);
  bowlRim.rotation.x = Math.PI / 2;
  bowlRim.position.y = 0.5;
  hopper.add(bowlRim);
  const bowlNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 16), mats.mint2);
  bowlNeck.position.y = -0.7;
  hopper.add(bowlNeck);
  // pile of marbles inside the hopper (visual only, jiggles when cranking)
  const pileGeo = new THREE.SphereGeometry(0.17, 14, 10);
  const pile = [];
  for (let i = 0; i < 16; i++) {
    const f = FLAVOURS[i % FLAVOURS.length];
    const m = new THREE.Mesh(pileGeo, new THREE.MeshPhysicalMaterial({
      color: f.marble, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06,
      envMapIntensity: 0.55,
    }));
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 0.55;
    m.position.set(Math.cos(a) * rr, -0.25 + Math.random() * 0.55, Math.sin(a) * rr * 0.7);
    m.userData.base = m.position.clone();
    m.userData.phase = Math.random() * 9;
    pile.push(m);
    hopper.add(m);
  }
  hopper.position.copy(MACHINE.HOPPER_POS);
  grp.add(hopper);

  // ======================= flexible feed tube ==============================
  const tube = new WobblyTube(26, 10, 0.17, new THREE.MeshStandardMaterial({
    color: 0xcdeef7, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.85,
  }));
  grp.add(tube.mesh);

  // ======================= decorative gears + sign =========================
  const gearA = makeGear(0.55, 10, mats.gold);
  gearA.position.set(-2.55, 3.0, -0.3);
  grp.add(gearA);
  const gearB = makeGear(0.38, 8, mats.pink2);
  gearB.position.set(-1.85, 2.62, -0.3);
  grp.add(gearB);
  const gearC = makeGear(0.48, 9, mats.mint2);
  gearC.position.set(2.45, 3.0, -0.3);
  grp.add(gearC);

  const sign = makeSign();
  sign.group.position.set(0, 9.32, -0.55);
  grp.add(sign.group);

  // steam chimney
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 14), mats.pink2);
  chimney.position.set(2.4, 9.0, -0.6);
  chimney.castShadow = true;
  grp.add(chimney);
  const puffs = makePuffs(scene, new THREE.Vector3(2.4, 9.5, -0.6));

  // =========================================================================
  const state = {
    theta: 0,        // mechanism phase (radians)
    omega: 0,        // current angular speed
    spoutX: 0,
    spoutVX: 0,
    wobble: 0,       // shake feedback
  };

  const V = new THREE.Vector3();

  function update(theta, omega, dt, t) {
    state.theta = theta;
    state.omega = omega;

    const phi = theta + Math.PI / 2;
    // rolling disc centre goes around a circle of radius R/2 …
    const cx = Math.cos(phi) * R / 2, cy = Math.sin(phi) * R / 2;
    disc.position.set(RC.x + cx, RC.y + cy, RC.z + 0.02);
    // … while spinning backwards at the same rate (rolling contact)
    disc.rotation.z = -phi + Math.PI / 2;   // offset keeps the face upright at rest
    // → a point on its rim travels on a perfectly straight line!
    const pinX = RC.x + Math.cos(phi) * R;
    pin.position.set(pinX, RC.y, 0.06);          // in front of the rod
    pinStem.position.set(pinX, RC.y, RC.z + 0.1);
    pinStem.rotation.x = Math.PI / 2;

    state.spoutX = pinX;
    state.spoutVX = -Math.sin(phi) * R * omega;

    // rod + nozzle follow the pin
    rod.position.set(pinX, (RC.y + MACHINE.RAIL_Y) / 2, -0.05);
    spout.position.x = pinX;
    // squash & stretch: lean into the motion
    const lean = THREE.MathUtils.clamp(state.spoutVX * 0.045, -0.3, 0.3);
    spout.rotation.z = -lean;

    // gears spin with the crank
    gearA.rotation.z = theta * 1.4;
    gearB.rotation.z = -theta * 1.4 * (10 / 8);
    gearC.rotation.z = -theta * 1.1;

    // hopper marbles jiggle while cranking
    const jig = Math.min(1, Math.abs(omega) * 0.35);
    for (const m of pile) {
      const b = m.userData.base;
      m.position.x = b.x + Math.sin(t * 22 + m.userData.phase) * 0.03 * jig;
      m.position.y = b.y + Math.abs(Math.sin(t * 26 + m.userData.phase * 2)) * 0.05 * jig;
    }

    // wobbly tube from hopper neck to the moving nozzle
    V.set(state.spoutX, MACHINE.RAIL_Y + 0.55, 0.12);
    tube.update(
      MACHINE.HOPPER_POS.x, MACHINE.HOPPER_POS.y - 1.05, MACHINE.HOPPER_POS.z + 0.08,
      V.x, V.y, V.z, t
    );

    // shake feedback: whole machine wiggles briefly
    if (state.wobble > 0.001) {
      state.wobble *= Math.pow(0.0025, dt);
      grp.rotation.z = Math.sin(t * 40) * 0.012 * state.wobble;
      grp.position.x = Math.sin(t * 53) * 0.05 * state.wobble;
    } else {
      grp.rotation.z = 0; grp.position.x = 0;
    }

    sign.update(t);
    puffs.update(dt, t, Math.abs(omega));

    // track pulses gently so the "straight magic line" reads clearly
    mats.glow.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.25 + Math.min(1, Math.abs(omega) * 0.2);
  }

  return {
    group: grp,
    state,
    update,
    tubeCurve: tube,           // marbles animate along this while feeding
    shake() { state.wobble = 1; },
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeRoundedPanel(w, h, depth, r, mat) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, mat);
}

function makeGear(radius, nTeeth, mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.16, 24), mat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const toothGeo = new THREE.BoxGeometry(0.1 * radius / 0.5, 0.16 * radius / 0.5, 0.16);
  for (let i = 0; i < nTeeth; i++) {
    const a = (i / nTeeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, mat);
    t.position.set(Math.cos(a) * radius * 1.08, Math.sin(a) * radius * 1.08, 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.4 }));
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

function makeFaceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // happy closed eyes ( ∪ ∪ )
  g.strokeStyle = '#5d3a4c'; g.lineWidth = 17; g.lineCap = 'round';
  g.beginPath(); g.arc(78, 104, 33, Math.PI * 0.15, Math.PI * 0.85, false); g.stroke();
  g.beginPath(); g.arc(178, 104, 33, Math.PI * 0.15, Math.PI * 0.85, false); g.stroke();
  // smile
  g.beginPath(); g.arc(128, 144, 44, Math.PI * 0.15, Math.PI * 0.85, false); g.stroke();
  // blush
  g.fillStyle = 'rgba(255,110,145,0.7)';
  g.beginPath(); g.ellipse(42, 158, 24, 15, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(214, 158, 24, 15, 0, 0, 7); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSign() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf6';
  g.fillRect(0, 0, 640, 160);
  g.strokeStyle = '#ffc7d9'; g.lineWidth = 12;
  roundRectPath(g, 10, 10, 620, 140, 36); g.stroke();
  g.fillStyle = '#ff6b95';
  g.font = 'bold 62px "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('シャカシャカ こうじょう', 320, 86);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.1, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xffc7d9, roughness: 0.5 })
  );
  board.castShadow = true;
  group.add(board);
  const facePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.15, 1.0),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  facePlate.position.z = 0.075;
  group.add(facePlate);
  // posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd9a878, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 10), postMat);
    p.position.set(sx * 1.7, -0.85, 0);
    group.add(p);
  }
  // blinking bulbs
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.085, 10, 8);
  const bulbCols = [0xff5a7e, 0xffd54f, 0x4fc3f7, 0x66e08a, 0xb388ff];
  for (let i = 0; i < 10; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: bulbCols[i % 5], emissive: bulbCols[i % 5], emissiveIntensity: 0.9, roughness: 0.3,
    });
    const b = new THREE.Mesh(bulbGeo, mat);
    const bx = -1.98 + (i / 9) * 3.96;
    b.position.set(bx, 0.68, 0.05);
    bulbs.push(b);
    group.add(b);
  }
  return {
    group,
    update(t) {
      bulbs.forEach((b, i) => {
        b.material.emissiveIntensity = 0.35 + 0.8 * Math.max(0, Math.sin(t * 3.4 + i * 1.1));
      });
    },
  };
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// soft steam puffs
function makePuffs(scene, origin) {
  const N = 7;
  const geo = new THREE.SphereGeometry(0.28, 12, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    m.userData = { t: Math.random() * 3, life: 2.2 + Math.random() };
    scene.add(m);
    puffs.push(m);
  }
  return {
    update(dt, t, speed) {
      const active = 0.25 + Math.min(1.2, speed * 0.25);
      for (const p of puffs) {
        p.userData.t += dt * active;
        const u = (p.userData.t % p.userData.life) / p.userData.life;
        p.visible = true;
        p.position.set(
          origin.x + Math.sin(t * 0.7 + p.userData.life * 9) * 0.25 * u,
          origin.y + u * 2.0,
          origin.z
        );
        const s = 0.4 + u * 1.1;
        p.scale.setScalar(s);
        p.material.opacity = 0.5 * (1 - u) * (u > 0.03 ? 1 : u / 0.03);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// WobblyTube: a tube whose geometry is rewritten every frame along a curve.
// ---------------------------------------------------------------------------
export class WobblyTube {
  constructor(segs, radial, radius, material) {
    this.segs = segs; this.radial = radial; this.radius = radius;
    const nVerts = (segs + 1) * (radial + 1);
    const pos = new Float32Array(nVerts * 3);
    const norm = new Float32Array(nVerts * 3);
    const idx = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this._pts = [];
    for (let i = 0; i <= segs; i++) this._pts.push(new THREE.Vector3());
    this._curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    ]);
  }

  // sample point for feeding-marble animation (u in 0..1)
  pointAt(u, target) {
    return this._curve.getPoint(u, target);
  }

  update(x0, y0, z0, x1, y1, z1, t) {
    const c = this._curve.points;
    c[0].set(x0, y0, z0);
    c[1].set(x0 * 0.7 + x1 * 0.3, y0 * 0.55 + y1 * 0.45, 0.9 + Math.sin(t * 2.2) * 0.06);
    c[2].set(x0 * 0.25 + x1 * 0.75, y0 * 0.22 + y1 * 0.78, 0.75);
    c[3].set(x1, y1, z1);
    this._curve.updateArcLengths?.();

    const pos = this.geo.attributes.position.array;
    const norm = this.geo.attributes.normal.array;
    const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1);
    let k = 0;
    for (let i = 0; i <= this.segs; i++) {
      const u = i / this.segs;
      this._curve.getPoint(u, P);
      this._curve.getTangent(u, T);
      N.crossVectors(up, T).normalize();
      if (N.lengthSq() < 0.001) N.set(1, 0, 0);
      B.crossVectors(T, N).normalize();
      for (let j = 0; j <= this.radial; j++) {
        const a = (j / this.radial) * Math.PI * 2;
        const nx = N.x * Math.cos(a) + B.x * Math.sin(a);
        const ny = N.y * Math.cos(a) + B.y * Math.sin(a);
        const nz = N.z * Math.cos(a) + B.z * Math.sin(a);
        pos[k] = P.x + nx * this.radius;
        pos[k + 1] = P.y + ny * this.radius;
        pos[k + 2] = P.z + nz * this.radius;
        norm[k] = nx; norm[k + 1] = ny; norm[k + 2] = nz;
        k += 3;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}
