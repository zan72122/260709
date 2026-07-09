// The three marble courses. Each course registers colliders on the sim and
// builds its meshes into a group. Headless-safe: no textures, only colors.
import * as THREE from '../vendor/three.module.min.js';
import { buildRail, helixPoints, wavePoints, loopPoints } from './track.js';
import {
  addFunnel, addTube, addChimeStairs, addBumper, addBoostRing,
  addSpinner, addGoalPool, addPlazaDisc, addSpawnerDeco,
} from './pieces.js';

export const MARBLE_COLORS = [
  0xff5f7e, 0xff9d4d, 0xffd94d, 0x7fe062, 0x4dd2c2,
  0x53a6ff, 0x8f7bff, 0xff7ce4, 0xff4d4d, 0x62f0a0,
];

function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---- decorations ---------------------------------------------------------
function addTree(parent, x, z, s, trunkC, leafCs) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * s, 0.14 * s, 0.7 * s, 8),
    new THREE.MeshStandardMaterial({ color: trunkC, roughness: 0.8 }));
  trunk.position.y = 0.35 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const puffs = [[0, 1.0, 0, 0.5], [0.3, 0.82, 0.1, 0.34], [-0.28, 0.85, -0.08, 0.36], [0.02, 0.8, 0.3, 0.3]];
  puffs.forEach(([px, py, pz, pr], i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(pr * s, 14, 10),
      new THREE.MeshStandardMaterial({ color: leafCs[i % leafCs.length], roughness: 0.6 }));
    m.position.set(px * s, py * s, pz * s);
    m.castShadow = true;
    g.add(m);
  });
  g.position.set(x, 0, z);
  parent.add(g);
}

function addLollipop(parent, x, z, s, color) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 1.1 * s, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.4 }));
  stick.position.y = 0.55 * s;
  g.add(stick);
  const candy = new THREE.Mesh(
    new THREE.TorusGeometry(0.3 * s, 0.14 * s, 12, 24),
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 }));
  candy.position.y = 1.25 * s;
  candy.castShadow = true;
  g.add(candy);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.14 * s, 12, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1 }));
  dot.position.y = 1.25 * s;
  g.add(dot);
  g.position.set(x, 0, z);
  g.rotation.y = x * 1.7;
  parent.add(g);
}

function addFlowers(parent, rand, cx, cz, r, n, colors) {
  const geo = new THREE.SphereGeometry(0.09, 8, 6);
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5cb86a, roughness: 0.7 });
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x, 0.11, z);
    parent.add(stem);
    const head = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: colors[i % colors.length], roughness: 0.5,
      emissive: colors[i % colors.length], emissiveIntensity: 0.08,
    }));
    head.position.set(x, 0.26, z);
    parent.add(head);
  }
}

function addTower(parent, x, z, h, bodyC, roofC) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.15, h, 20),
    new THREE.MeshStandardMaterial({ color: bodyC, roughness: 0.5 }));
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 1.5, 20),
    new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.4 }));
  roof.position.y = h + 0.72;
  roof.castShadow = true;
  g.add(roof);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffe27a, emissiveIntensity: 0.4 }));
  ball.position.y = h + 1.55;
  g.add(ball);
  // little round windows
  const winMat = new THREE.MeshStandardMaterial({ color: 0xfff3c9, emissive: 0xffedb0, emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) {
    const wy = 1.6 + i * (h - 2.6) / 3;
    const wa = i * 1.9;
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), winMat);
    w.position.set(Math.cos(wa) * 1.02, wy, Math.sin(wa) * 1.02);
    g.add(w);
  }
  g.position.set(x, 0, z);
  parent.add(g);
}

function railMats(palette) {
  return {
    rail: new THREE.MeshPhysicalMaterial({ color: palette.rail, roughness: 0.32, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    sleeper: new THREE.MeshStandardMaterial({ color: palette.sleeper, roughness: 0.45 }),
    support: new THREE.MeshStandardMaterial({ color: palette.support, roughness: 0.5 }),
  };
}

// ==========================================================================
export const COURSES = [
  {
    id: 'sora',
    name: 'そらの らせんとう',
    emoji: '🏰',
    islandR: 13,
    palette: {
      skyTop: 0x58aeff, skyMid: 0xa5d9ff, skyBot: 0xf0faff,
      sun: 0xfff2c0, hemiSky: 0xcfe9ff, hemiGround: 0xb8e6b0,
      grass: 0x93e08d, grassEdge: 0x5fc878, earth: 0xc7935f, earthDark: 0x94693f,
      cloud: 0xffffff, fog: 0xcfe9ff,
      rail: 0xff8fb0, sleeper: 0xfff4e0, support: 0xffffff,
      accent: 0x53a6ff,
    },
    camera: { target: v3(1.2, 3.2, 0.2), dist: 13.0 },
    build(sim, group) {
      const mats = railMats(this.palette);
      const info = { chimes: [], bumpers: [], boosts: [], spinners: [], funnels: [] };
      sim.addDisc({ x: 0, y: 0, z: 0, r: this.islandR });

      addTower(group, -3, -3, 9.6, 0xfff2f6, 0xff8fb0);

      // spiral rail down the tower, then out to the funnel
      const pts = helixPoints({ cx: -3, cz: -3, r: 2.3, y0: 9.2, y1: 4.4, turns: 3, segsPerTurn: 12 });
      pts.push(
        v3(-0.7, 4.35, -1.6), v3(-0.4, 4.22, -0.2), v3(0.1, 4.05, 1.2),
        v3(0.45, 3.85, 2.0), v3(0.55, 3.78, 2.45),
      );
      const rail = buildRail(sim, group, pts, { mats, guardFrom: 0, guardTo: 46 });

      const fun = addFunnel(sim, group, { x: 2.2, z: 2.6, yTop: 3.6, rTop: 1.9, yBot: 2.15, rBot: 0.7, color: 0xa8e6ff });
      info.funnels.push({ pos: v3(2.2, 2.9, 2.6), rTop: 1.9 });

      info.chimes.push(addChimeStairs(sim, group, { x: 2.2, y: 1.5, z: 2.6, dirX: 1, n: 5, idBase: 0 }));

      // slide floor from the chimes into the goal pool
      const slope = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), Math.atan2(0.16, 1.35));
      sim.addBox({ c: v3(5.75, 0.72, 2.6), h: v3(0.9, 0.06, 0.6), q: slope, e: 0.1, mu: 0.6 });
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.5 }));
      rampMesh.position.set(5.75, 0.72, 2.6);
      rampMesh.quaternion.copy(slope);
      rampMesh.receiveShadow = true;
      group.add(rampMesh);
      for (const side of [-1, 1]) {
        const c = v3(5.75, 0.95, 2.6 + side * 0.62);
        sim.addBox({ c, h: v3(0.75, 0.3, 0.05), e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.1),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c);
        group.add(wall);
      }

      const pool = addGoalPool(sim, group, { x: 7.75, z: 2.6, r: 0.95, color: 0x8ad9ff });

      // decorations
      const rand = seeded(11);
      const leafSets = [[0x6fce7c, 0x8fe08d, 0x5cbf6d], [0xffb2c8, 0xff8fb0, 0xffd4e0]];
      const spots = [[-8.5, 2.5], [-9.5, -2.5], [-6, -8], [0.5, -8.5], [6.5, -6.5], [9.5, -1.5], [-4.5, 7.5], [-8, 5.5], [3, 8.5], [8, 6.5]];
      spots.forEach(([x, z], i) => addTree(group, x, z, 0.9 + rand() * 0.7, 0xa9744f, leafSets[i % 2]));
      addFlowers(group, rand, 0, 0, 11, 46, [0xff8fb0, 0xffd94d, 0x8f7bff, 0xff9d4d, 0xffffff]);

      const spawn = { pos: v3(-0.7, 9.5, -3), dir: v3(0, 0, 1) };
      addSpawnerDeco(group, { pos: spawn.pos });
      return { spawn, goal: pool, info };
    },
  },

  // ========================================================================
  {
    id: 'niji',
    name: 'にじの おやま',
    emoji: '🌈',
    islandR: 13.5,
    palette: {
      skyTop: 0x6a5bd8, skyMid: 0xff9e7c, skyBot: 0xffe3b0,
      sun: 0xffd9a0, hemiSky: 0xffd9c0, hemiGround: 0xc9b4ec,
      grass: 0xc0aaec, grassEdge: 0x9a7fd4, earth: 0x8a6a9f, earthDark: 0x64497a,
      cloud: 0xffe9dc, fog: 0xf3c9b0,
      rail: 0xffc85e, sleeper: 0xfff8ec, support: 0xfff3e0,
      accent: 0xff7ce4,
    },
    camera: { target: v3(-0.5, 3.4, -1.5), dist: 14.5 },
    build(sim, group) {
      const mats = railMats(this.palette);
      const info = { chimes: [], bumpers: [], boosts: [], spinners: [], funnels: [] };

      sim.addDisc({ x: 0, y: 0, z: 0, r: this.islandR });

      // one continuous spine: big drop -> loop -> slalom -> plaza entry
      const dir = v3(0.94, 0, 0.34).normalize();
      const loopEntry = v3(-4.4, 4.95, 1.2);
      const pts = [
        v3(-8.5, 10.4, -7.0), v3(-8.4, 9.8, -5.2), v3(-8.0, 8.4, -3.2),
        v3(-7.4, 6.8, -1.6), v3(-6.6, 5.6, -0.4), v3(-5.6, 5.05, 0.6),
      ];
      pts.push(...loopPoints({ entry: loopEntry, dir, r: 1.2, tilt: 0.85 }));
      // wide banked S-sweep across the island down into the plaza
      pts.push(
        v3(-3.4, 4.85, 3.0), v3(-1.9, 4.55, 3.9), v3(0.1, 4.25, 4.4),
        v3(2.1, 3.95, 4.1), v3(3.7, 3.6, 3.1), v3(4.8, 3.25, 1.9),
        v3(5.4, 2.95, 0.9), v3(5.6, 2.8, 0.2),
      );
      const rail = buildRail(sim, group, pts, { mats, guardFrom: 0, guardTo: 999, supportEvery: 2.8 });

      // bumper plaza (elevated)
      const plazaY = 1.75;
      addPlazaDisc(sim, group, {
        x: 5.5, y: plazaY, z: 0.2, r: 2.6, wall: 0.85,
        wallGapAt: -Math.PI / 2, wallGapWidth: 1.3,
        color: 0xfff0e0, wallColor: 0xfff8ec,
      });
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2.0, plazaY, 24),
        new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.55 }));
      pedestal.position.set(5.5, plazaY / 2, 0.2);
      pedestal.castShadow = true; pedestal.receiveShadow = true;
      group.add(pedestal);
      info.bumpers.push(addBumper(sim, group, { x: 4.5, z: -0.5, y: plazaY, id: 0, color: 0xff5f8f }));
      info.bumpers.push(addBumper(sim, group, { x: 6.6, z: 0.3, y: plazaY, id: 1, color: 0x53a6ff }));
      info.bumpers.push(addBumper(sim, group, { x: 5.3, z: 1.4, y: plazaY, id: 2, color: 0x7fe062 }));
      sim.addZone({ x: 5.5, y: plazaY + 0.25, z: 0.2, r: 2.6, kind: 'boost', dir: v3(0, 0, -1), strength: 1.4 });
      sim.addZone({ x: 4.1, y: plazaY + 0.25, z: -0.6, r: 1.5, kind: 'boost', dir: v3(0.6, 0, -0.8), strength: 1.6 });
      sim.addZone({ x: 6.9, y: plazaY + 0.25, z: -0.6, r: 1.5, kind: 'boost', dir: v3(-0.6, 0, -0.8), strength: 1.6 });

      // guide walls forming a V into the exit ramp
      for (const side of [-1, 1]) {
        const q = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), side * 0.5);
        const c = v3(5.5 + side * 0.78, plazaY + 0.3, -2.05);
        sim.addBox({ c, h: v3(0.06, 0.32, 0.5), q, e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, 1.0),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c); wall.quaternion.copy(q);
        group.add(wall);
      }

      // walled ramp out of the plaza down to the launch rail
      const rq = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -Math.atan2(0.35, 1.55));
      sim.addBox({ c: v3(5.5, 1.52, -3.15), h: v3(0.5, 0.06, 0.85), q: rq, e: 0.1, mu: 0.01 });
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.7),
        new THREE.MeshStandardMaterial({ color: 0xfff8ec, roughness: 0.5 }));
      rampMesh.position.set(5.5, 1.52, -3.15); rampMesh.quaternion.copy(rq);
      rampMesh.receiveShadow = true;
      group.add(rampMesh);
      for (const side of [-1, 1]) {
        const c = v3(5.5 + side * 0.53, 1.78, -3.15);
        sim.addBox({ c, h: v3(0.05, 0.26, 0.85), q: rq, e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 1.7),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c); wall.quaternion.copy(rq);
        group.add(wall);
      }

      // launch rail with boost ring, ending in a jump!
      const chute = buildRail(sim, group, [
        v3(5.5, 1.34, -3.95), v3(5.5, 1.3, -4.6), v3(5.5, 1.28, -5.3), v3(5.5, 1.3, -5.9),
      ], { mats, guardFrom: 0, guardTo: 99 });
      info.boosts.push(addBoostRing(sim, group, { x: 5.5, y: 1.45, z: -4.9, dir: v3(0, 0.08, -1), id: 0, strength: 30, color: 0x64f0c8 }));
      info.boosts.push(addBoostRing(sim, group, { x: -5.35, y: 5.15, z: 0.85, dir: v3(0.94, 0, 0.34), id: 1, strength: 26, color: 0xff7ce4 }));

      // landing slide, then the goal pool
      const lq = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -Math.atan2(0.28, 2.8));
      sim.addBox({ c: v3(5.5, 0.96, -7.8), h: v3(1.3, 0.07, 1.45), q: lq, e: 0.12, mu: 0.012 });
      const slide = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 2.9),
        new THREE.MeshStandardMaterial({ color: 0xffe9f2, roughness: 0.5 }));
      slide.position.set(5.5, 0.96, -7.8); slide.quaternion.copy(lq);
      slide.receiveShadow = true;
      group.add(slide);
      for (const side of [-1, 1]) {
        const c = v3(5.5 + side * 1.35, 1.24, -7.8);
        sim.addBox({ c, h: v3(0.05, 0.3, 1.45), q: lq, e: 0.25 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 2.9),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c); wall.quaternion.copy(lq);
        group.add(wall);
      }

      const pool = addGoalPool(sim, group, { x: 5.5, z: -10.3, r: 1.3, color: 0xffc2a0 });

      // decorations: sunset trees + stars on sticks
      const rand = seeded(22);
      const leafSets = [[0xd88fe0, 0xba7fd4, 0xecb2f0], [0xffb27c, 0xff9e7c, 0xffd0a8]];
      const spots = [[-2, -7.5], [3, -6], [-6.5, -8], [9.5, 3.5], [8.5, 6], [1, 8.5], [-3, 9], [-9, 4], [-10.5, -0.5], [5, 8.8]];
      spots.forEach(([x, z], i) => addTree(group, x, z, 0.85 + rand() * 0.7, 0x7a5a8f, leafSets[i % 2]));
      addFlowers(group, rand, 0, 0, 11.5, 40, [0xffd94d, 0xff9e7c, 0xff7ce4, 0xfff3c9]);

      const spawn = { pos: v3(-8.5, 10.7, -7.0), dir: v3(0.05, 0, 1) };
      addSpawnerDeco(group, { pos: spawn.pos, color: 0xffe9dc });
      return { spawn, goal: pool, info };
    },
  },

  // ========================================================================
  {
    id: 'okashi',
    name: 'おかしの くに',
    emoji: '🍭',
    islandR: 13,
    palette: {
      skyTop: 0xff9fd0, skyMid: 0xffc9e5, skyBot: 0xfff3f8,
      sun: 0xfff0b0, hemiSky: 0xffe2f0, hemiGround: 0xc0f0dd,
      grass: 0xa8ecd8, grassEdge: 0x74d8b8, earth: 0xc78a5a, earthDark: 0x9a6740,
      cloud: 0xfff0f6, fog: 0xffd9ec,
      rail: 0xff7fa8, sleeper: 0xfff2dc, support: 0xffffff,
      accent: 0xff9d4d,
    },
    camera: { target: v3(-1.0, 3.2, 0.5), dist: 13.0 },
    build(sim, group) {
      const mats = railMats(this.palette);
      const info = { chimes: [], bumpers: [], boosts: [], spinners: [], funnels: [] };

      sim.addDisc({ x: 0, y: 0, z: 0, r: this.islandR });

      // big sweeping S-curve down to the spinner plaza
      const pts = [
        v3(-7.0, 8.8, 7.0), v3(-5.0, 8.25, 6.2), v3(-2.6, 7.7, 5.6),
        v3(-0.4, 7.1, 5.9), v3(1.7, 6.5, 6.7), v3(3.5, 5.9, 6.1),
        v3(4.6, 5.3, 4.6), v3(4.3, 4.85, 2.9), v3(2.9, 4.6, 1.6),
        v3(0.9, 4.62, 1.2), v3(-1.1, 4.55, 1.2),
      ];
      buildRail(sim, group, pts, { mats, guardFrom: 0, guardTo: 999 });

      // spinner plaza
      const plazaY = 3.6;
      addPlazaDisc(sim, group, {
        x: -2.6, y: plazaY, z: 1.2, r: 2.4, wall: 0.8,
        wallGapAt: -Math.PI / 2, wallGapWidth: 1.5,
        color: 0xfff0f6, wallColor: 0xfff8fb,
      });
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.9, plazaY, 24),
        new THREE.MeshStandardMaterial({ color: 0xffe2ee, roughness: 0.55 }));
      pedestal.position.set(-2.6, plazaY / 2, 1.2);
      pedestal.castShadow = true; pedestal.receiveShadow = true;
      group.add(pedestal);
      info.spinners.push(addSpinner(sim, group, { x: -2.6, y: plazaY + 0.32, z: 1.2, arms: 3, len: 1.5, speed: 0.85, color: 0xffc94d }));
      // invisible gentle drift so plaza marbles eventually find the exit gap
      sim.addZone({ x: -2.6, y: plazaY + 0.25, z: 1.2, r: 2.4, kind: 'boost', dir: v3(0, 0, -1), strength: 1.6 });
      sim.addZone({ x: -3.9, y: plazaY + 0.25, z: 0.5, r: 1.4, kind: 'boost', dir: v3(0.6, 0, -0.8), strength: 1.6 });
      sim.addZone({ x: -1.3, y: plazaY + 0.25, z: 0.5, r: 1.4, kind: 'boost', dir: v3(-0.6, 0, -0.8), strength: 1.6 });

      // V walls + ramp out of the plaza
      for (const side of [-1, 1]) {
        const q = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), side * 0.5);
        const c = v3(-2.6 + side * 0.78, plazaY + 0.3, -0.85);
        sim.addBox({ c, h: v3(0.06, 0.32, 0.5), q, e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, 1.0),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c); wall.quaternion.copy(q);
        group.add(wall);
      }
      const rq = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -Math.atan2(0.38, 1.7));
      sim.addBox({ c: v3(-2.6, 3.36, -2.05), h: v3(0.5, 0.06, 0.9), q: rq, e: 0.1, mu: 0.01 });
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xfff2dc, roughness: 0.5 }));
      rampMesh.position.set(-2.6, 3.36, -2.05); rampMesh.quaternion.copy(rq);
      group.add(rampMesh);
      for (const side of [-1, 1]) {
        const c = v3(-2.6 + side * 0.53, 3.62, -2.05);
        sim.addBox({ c, h: v3(0.05, 0.26, 0.9), q: rq, e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 1.8),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c); wall.quaternion.copy(rq);
        group.add(wall);
      }

      // short chute rail flying into the candy funnel
      buildRail(sim, group, [
        v3(-2.6, 3.14, -2.95), v3(-2.6, 3.05, -3.6), v3(-2.6, 3.02, -4.3), v3(-2.6, 3.05, -4.8),
      ], { mats, guardFrom: 0, guardTo: 99 });

      const fun = addFunnel(sim, group, { x: -2.6, z: -5.6, yTop: 2.85, rTop: 1.5, yBot: 1.6, rBot: 0.7, color: 0xffd4e6, accent: 0xfff8fb });
      info.funnels.push({ pos: v3(-2.6, 2.5, -5.6), rTop: 1.5 });

      info.chimes.push(addChimeStairs(sim, group, {
        x: -2.6, y: 0.95, z: -5.6, dirX: -1, n: 3, idBase: 0, stepDY: 0.15,
        colors: [0xff6b8a, 0xffb056, 0x6db9ff],
      }));

      // final slide into the goal pool
      const sq = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), -Math.atan2(0.24, 1.9));
      sim.addBox({ c: v3(-4.95, 0.68, -5.6), h: v3(0.95, 0.06, 0.6), q: sq, e: 0.1, mu: 0.25 });
      const slide = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xfff2dc, roughness: 0.5 }));
      slide.position.set(-4.95, 0.68, -5.6); slide.quaternion.copy(sq);
      slide.receiveShadow = true;
      group.add(slide);
      for (const side of [-1, 1]) {
        const c = v3(-4.95, 0.9, -5.6 + side * 0.62);
        sim.addBox({ c, h: v3(0.8, 0.28, 0.05), e: 0.2 });
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.56, 0.1),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
        wall.position.copy(c);
        group.add(wall);
      }

      const pool = addGoalPool(sim, group, { x: -6.9, z: -5.6, r: 0.85, color: 0xffb2d4 });

      // candy decorations
      const rand = seeded(33);
      const pops = [[3, -3, 0xff5f7e], [5.5, -5.5, 0x53a6ff], [7.5, -1, 0x7fe062], [-6.5, 3, 0xff9d4d], [-9, -1.5, 0x8f7bff], [0.5, -8.5, 0xffd94d], [-5.5, 8.8, 0xff7ce4], [8.5, 3.5, 0xff5f7e], [4.5, 8, 0x4dd2c2]];
      pops.forEach(([x, z, c]) => addLollipop(group, x, z, 0.9 + rand() * 0.6, c));
      const leafSets = [[0xffc9e0, 0xffaed2, 0xffe2ee]];
      [[9.5, -4], [-9.5, 5], [1.5, 9], [-1.5, -9.5]].forEach(([x, z]) => addTree(group, x, z, 0.9 + rand() * 0.5, 0xc78a5a, leafSets[0]));
      addFlowers(group, rand, 0, 0, 11, 42, [0xffffff, 0xffd94d, 0xff8fb0, 0x9be8ff]);

      const spawn = { pos: v3(-7.0, 9.5, 7.0), dir: v3(1, 0, -0.28).normalize() };
      addSpawnerDeco(group, { pos: spawn.pos, color: 0xfff0f6 });
      return { spawn, goal: pool, info };
    },
  },
];
