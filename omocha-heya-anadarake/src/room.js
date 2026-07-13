// The toy room: procedural wood floor with a rug baked into the texture
// (so the hole eats the rug too), pastel walls with a window and wall art,
// warm lighting. Rebuilt per round with a new palette.

import * as THREE from '../vendor/three.module.min.js';
import { PALETTES } from './props.js';

export const ROOM_W = 22;
export const ROOM_D = 15;
const WALL_H = 5.2;

function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function floorTexture(pal) {
  return tex(1024, 700, (ctx, w, h) => {
    // wood planks
    ctx.fillStyle = pal.floorA;
    ctx.fillRect(0, 0, w, h);
    const plankH = h / 10;
    for (let row = 0; row < 10; row++) {
      const off = (row % 2) * w * 0.25;
      ctx.fillStyle = row % 2 ? pal.floorB : pal.floorA;
      ctx.fillRect(0, row * plankH, w, plankH - 2);
      ctx.strokeStyle = 'rgba(90,50,20,0.25)';
      ctx.lineWidth = 3;
      for (let sx = -1; sx < 4; sx++) {
        const x = ((sx * w * 0.33 + off) % (w + w * 0.33));
        ctx.strokeRect(x, row * plankH, w * 0.33, plankH - 2);
      }
      // subtle grain
      ctx.strokeStyle = 'rgba(120,70,30,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, row * plankH + plankH * 0.5);
      ctx.lineTo(w, row * plankH + plankH * (0.3 + (row % 3) * 0.2));
      ctx.stroke();
    }
    // big round rug in the centre
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.26, ry = h * 0.34;
    ctx.fillStyle = pal.rugRim;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = pal.rug;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, 7); ctx.fill();
    ctx.fillStyle = pal.rugRim;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.62, ry * 0.62, 0, 0, 7); ctx.fill();
    ctx.fillStyle = pal.rug;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, 7); ctx.fill();
    // scalloped stitches on the rug
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 14]);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.78, ry * 0.78, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  });
}

function wallTexture(pal, opts = {}) {
  return tex(1024, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal.wall);
    grad.addColorStop(1, pal.wallLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // polka dots / stars
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 26; i++) {
      const x = (i * 137.5) % w;
      const y = (i * 83.7) % (h * 0.75);
      if (opts.stars) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(i);
        ctx.font = '28px sans-serif'; ctx.fillText('✦', 0, 0);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(x, y, 9 + (i % 3) * 4, 0, 7); ctx.fill();
      }
    }
    // baseboard
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = 'rgba(160,110,60,0.25)';
    ctx.fillRect(0, h - 28, w, 4);
  });
}

function windowTexture(pal) {
  return tex(300, 340, (ctx, w, h) => {
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = pal.sky;
    ctx.fillRect(16, 16, w - 32, h - 32);
    // sun / moon + cloud
    if (pal.name === 'yozora' || pal.name === 'yoru') {
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.3, 34, 0, 7); ctx.fill();
      ctx.fillStyle = pal.sky;
      ctx.beginPath(); ctx.arc(w * 0.76, h * 0.26, 30, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc((i * 61) % (w - 40) + 24, (i * 47) % (h - 60) + 30, 3, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath(); ctx.arc(w * 0.68, h * 0.3, 36, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (const [cx, cy, r] of [[w * 0.3, h * 0.55, 26], [w * 0.42, h * 0.5, 32], [w * 0.54, h * 0.56, 24]]) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      }
    }
    // frame cross
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(w / 2 - 7, 16, 14, h - 32);
    ctx.fillRect(16, h / 2 - 7, w - 32, 14);
  });
}

function artTexture(emoji, bg) {
  return tex(160, 160, (ctx, w, h) => {
    ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg; ctx.fillRect(12, 12, w - 24, h - 24);
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, w / 2, h / 2 + 6);
  });
}

// らくがきスポット: after a コロン these crayon doodles pop into REAL toys.
// u is the horizontal texture position on the back wall.
export const DOODLE_SPOTS = [
  { u: 0.22, kind: 'star' },
  { u: 0.5, kind: 'car' },
  { u: 0.78, kind: 'flower' },
];

function drawDoodle(ctx, kind, cx, cy, s) {
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'star') {
    ctx.strokeStyle = 'rgba(255,214,80,0.9)';
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? s : s * 0.45;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();
  } else if (kind === 'car') {
    ctx.strokeStyle = 'rgba(255,120,120,0.9)';
    ctx.strokeRect(cx - s, cy - s * 0.15, s * 2, s * 0.6);          // body
    ctx.strokeRect(cx - s * 0.45, cy - s * 0.6, s * 0.9, s * 0.45); // cabin
    ctx.beginPath(); ctx.arc(cx - s * 0.55, cy + s * 0.62, s * 0.26, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + s * 0.55, cy + s * 0.62, s * 0.26, 0, 7); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,170,220,0.95)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6, s * 0.35, 0, 7);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,230,120,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, 7); ctx.stroke();
  }
}

// cardboard-box look for コロンのへや
function cardboardTex(w, h, pal, opts = {}) {
  return tex(w, h, (ctx) => {
    ctx.fillStyle = '#cfa46b';
    ctx.fillRect(0, 0, w, h);
    // corrugation
    ctx.strokeStyle = 'rgba(120,80,35,0.16)';
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // packing tape stripe
    ctx.fillStyle = 'rgba(230,220,185,0.85)';
    if (opts.tapeAcross) ctx.fillRect(0, h * 0.42, w, h * 0.16);
    else ctx.fillRect(w * 0.44, 0, w * 0.12, h);
    // crayon doodles
    ctx.strokeStyle = 'rgba(255,120,80,0.55)';
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w * 0.16, h * 0.3, 22, 0, 5.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,150,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(w * 0.74, h * 0.72); ctx.lineTo(w * 0.79, h * 0.6);
    ctx.lineTo(w * 0.84, h * 0.72); ctx.lineTo(w * 0.89, h * 0.6); ctx.stroke();
    // the magic doodles (they disappear once they've become real toys)
    if (opts.doodles) {
      for (const d of DOODLE_SPOTS) drawDoodle(ctx, d.kind, w * d.u, h * 0.42, h * 0.16);
    }
    if (opts.label) {
      // toy-box label sticker
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(w * 0.36, h * 0.66, w * 0.28, h * 0.2);
      ctx.fillStyle = '#ff8b3d';
      ctx.font = `800 ${h * 0.11}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧸 TOYS', w * 0.5, h * 0.76);
    }
  });
}

// よるのくに: the hidden night room on the other side of the box
const NIGHT_PAL = {
  name: 'yoru',
  wall: '#232a55', wallLow: '#151a38', floorA: '#3b3563', floorB: '#332d57',
  rug: '#ffd166', rugRim: '#8478c8', sky: '#0d1230',
  accents: ['#74c0fc', '#f783ac', '#ffe066', '#63e6be', '#b197fc', '#ffa8a8'],
  bear: '#8d6e63', duck: '#fff59d', bed: '#b197fc', tub: '#eef2ff', hen: '#f4f0ff',
};

export class Room {
  constructor(scene, holeView, container = null) {
    this.scene = scene;
    this.container = container || scene;   // the rotatable box group
    this.holeView = holeView;
    this.group = null;

    // lighting lives outside the rebuildable group
    this.hemi = new THREE.HemisphereLight('#fff5e0', '#c08a50', 0.95);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff2d8', 1.35);
    this.sun.position.set(7, 14, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -12;
    sc.near = 2; sc.far = 40;
    this.sun.shadow.bias = -0.0005;
    scene.add(this.sun);
    scene.add(this.sun.target);
  }

  build(paletteIndex, opts = {}) {
    const night = !!opts.night;
    const pal = night ? NIGHT_PAL : PALETTES[paletteIndex % PALETTES.length];
    if (this.group) {
      this.container.remove(this.group);
      this.group.traverse((o) => { if (o.material && o.material.map) o.material.map.dispose(); });
    }
    const g = new THREE.Group();
    this.group = g;
    const boxy = !!opts.boxy;
    const starry = pal.name === 'yozora' || night;

    this.scene.background = new THREE.Color(pal.wallLow);
    this.scene.fog = new THREE.Fog(pal.wallLow, 30, 60);
    this.hemi.color.set(night ? '#8fa0e8' : pal.name === 'yozora' ? '#dfe6ff' : '#fff5e0');
    this.hemi.intensity = night ? 0.62 : pal.name === 'yozora' ? 0.8 : 0.95;
    this.sun.color.set(night ? '#aab7ff' : pal.name === 'yozora' ? '#cdd7ff' : pal.name === 'yuuyake' ? '#ffd9a8' : '#fff2d8');
    this.sun.intensity = night ? 0.7 : 1.35;

    // floor — the hole discard shader is patched into this material
    const floorMat = new THREE.MeshLambertMaterial({
      map: boxy ? cardboardTex(1024, 700, pal, { label: true, tapeAcross: true }) : floorTexture(pal),
    });
    this.holeView.patchFloorMaterial(floorMat);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // apron under the walls so glancing angles never show the void
    // (also carries the hole discard, or it would plug the hole from below)
    const apronMat = new THREE.MeshLambertMaterial({ color: pal.wallLow });
    this.holeView.patchFloorMaterial(apronMat);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 14, ROOM_D + 14), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.03;
    g.add(apron);

    // walls: back + left + right (front stays open for the camera)
    const wallMatBack = new THREE.MeshLambertMaterial({
      map: boxy
        ? cardboardTex(1024, 256, pal, { doodles: opts.doodles !== false })
        : wallTexture(pal, { stars: starry }),
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 0.4, WALL_H), wallMatBack);
    back.position.set(0, WALL_H / 2, -ROOM_D / 2 - 0.05);
    back.receiveShadow = true;
    g.add(back);

    const sideTex = boxy ? cardboardTex(1024, 256, pal) : wallTexture(pal, { stars: starry });
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D + 0.4, WALL_H), new THREE.MeshLambertMaterial({ map: sideTex }));
      side.position.set(s * (ROOM_W / 2 + 0.05), WALL_H / 2, 0);
      side.rotation.y = -s * Math.PI / 2;
      side.receiveShadow = true;
      g.add(side);
    }

    // 4th wall (front): single-sided facing inward, so it vanishes whenever
    // the camera is on the default side and becomes the backdrop when the
    // player orbits around — free dollhouse cutaway.
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W + 0.4, WALL_H),
      new THREE.MeshLambertMaterial({
        map: boxy ? cardboardTex(1024, 256, pal) : wallTexture(pal, { stars: starry }),
      })
    );
    front.position.set(0, WALL_H / 2, ROOM_D / 2 + 0.05);
    front.rotation.y = Math.PI;
    front.receiveShadow = true;
    g.add(front);
    // a picture on the front wall so the far side isn't bare when orbited to
    if (!boxy) {
      const frontArt = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ map: artTexture(pal.name === 'yozora' ? '🌟' : '🧸', pal.accents[3]) })
      );
      frontArt.position.set(-2.5, 3.0, ROOM_D / 2 + 0.03);
      frontArt.rotation.y = Math.PI;
      frontArt.rotation.z = 0.03;
      g.add(frontArt);
    }

    // window on the back wall (a cardboard box has none)
    if (!boxy) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 3.4),
        new THREE.MeshBasicMaterial({ map: windowTexture(pal) })
      );
      win.position.set(-4.5, 2.9, -ROOM_D / 2 + 0.02);
      g.add(win);
    }

    // wall art
    const arts = boxy ? [] : starry ? ['🌙', '⭐'] : ['🚂', '🦆'];
    arts.forEach((e, i) => {
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ map: artTexture(e, pal.accents[i]) })
      );
      art.position.set(1.8 + i * 2.2, 3.1 - i * 0.3, -ROOM_D / 2 + 0.02);
      art.rotation.z = (i ? -1 : 1) * 0.04;
      g.add(art);
    });

    // door on the right wall (not on a cardboard box)
    if (!boxy) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 3.6),
        new THREE.MeshLambertMaterial({ color: '#f7f0e3' })
      );
      door.position.set(ROOM_W / 2 - 0.02, 1.8, 2.5);
      door.rotation.y = -Math.PI / 2;
      g.add(door);
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        new THREE.MeshLambertMaterial({ color: '#e0b34c' })
      );
      knob.position.set(ROOM_W / 2 - 0.1, 1.8, 1.9);
      g.add(knob);
    }

    // よるのくに: fairy lights + a big glowing moon so the night side feels
    // like a secret place, not just a dark room
    if (night) {
      const bulbCols = ['#ffd166', '#ff8fa3', '#8ce99a', '#6cc5ff'];
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          new THREE.MeshLambertMaterial({
            color: bulbCols[i % 4], emissive: bulbCols[i % 4], emissiveIntensity: 0.9,
          })
        );
        bulb.position.set(
          -ROOM_W / 2 + 1 + t * (ROOM_W - 2),
          4.35 - Math.abs(Math.sin(t * Math.PI * 3)) * 0.4,
          -ROOM_D / 2 + 0.15
        );
        g.add(bulb);
      }
      const moon = new THREE.Mesh(
        new THREE.CircleGeometry(0.95, 24),
        new THREE.MeshBasicMaterial({ color: '#fff3b0' })
      );
      moon.position.set(6.8, 4.0, -ROOM_D / 2 + 0.04);
      g.add(moon);
      const crescent = new THREE.Mesh(
        new THREE.CircleGeometry(0.82, 24),
        new THREE.MeshBasicMaterial({ color: pal.wall })
      );
      crescent.position.set(7.15, 4.18, -ROOM_D / 2 + 0.05);
      g.add(crescent);
    }

    this.container.add(g);
    return pal;
  }
}
