// Instanced candy-glass marble rendering with rolling rotation, pop-in
// scaling and a saturated inner core inside a glossy tinted shell.
import * as THREE from '../vendor/three.module.min.js';
import { MARBLE_R } from './physics.js';
import { MARBLE_COLORS } from './courses.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _col = new THREE.Color();
const _s = new THREE.Vector3();

export class MarbleRenderer {
  constructor(scene, max) {
    this.max = max;

    const shellGeo = new THREE.SphereGeometry(MARBLE_R, 22, 16);
    const shellMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.12, metalness: 0.0,
      clearcoat: 1, clearcoatRoughness: 0.08,
      envMapIntensity: 1.2,
    });
    this.shell = new THREE.InstancedMesh(shellGeo, shellMat, max);
    this.shell.castShadow = true;
    this.shell.frustumCulled = false;
    this.shell.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // pale ribbon band around the marble so the rolling is visible
    const coreGeo = new THREE.TorusGeometry(MARBLE_R * 0.98, MARBLE_R * 0.22, 10, 24);
    const coreMat = new THREE.MeshStandardMaterial({ roughness: 0.3, envMapIntensity: 0.8 });
    this.core = new THREE.InstancedMesh(coreGeo, coreMat, max);
    this.core.frustumCulled = false;
    this.core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    scene.add(this.shell, this.core);

    this.quats = [];
    this.scales = new Float32Array(max); // pop-in animation
    for (let i = 0; i < max; i++) {
      this.quats.push(new THREE.Quaternion());
      this.scales[i] = 0;
    }
    this.lastIds = new Array(max).fill(0);
  }

  sync(marbles, dt) {
    const shell = this.shell, core = this.core;
    for (let i = 0; i < marbles.length && i < this.max; i++) {
      const m = marbles[i];
      if (!m.alive) {
        this.scales[i] = 0;
        _m4.makeScale(0, 0, 0);
        shell.setMatrixAt(i, _m4);
        core.setMatrixAt(i, _m4);
        continue;
      }
      if (this.lastIds[i] !== m.id) {
        this.lastIds[i] = m.id;
        this.scales[i] = 0.01;
        this.quats[i].identity();
        _col.setHex(MARBLE_COLORS[m.color % MARBLE_COLORS.length]);
        // shell = pastel tint, core = saturated candy
        shell.setColorAt(i, _col.clone().lerp(new THREE.Color(0xffffff), 0.1));
        core.setColorAt(i, _col.clone().lerp(new THREE.Color(0xffffff), 0.72));
        shell.instanceColor.needsUpdate = true;
        core.instanceColor.needsUpdate = true;
      }
      this.scales[i] = Math.min(1, this.scales[i] + dt * 6);
      const pop = this.scales[i] < 1
        ? 1.2 - 0.2 * (this.scales[i]) - (1 - this.scales[i]) * 0.6
        : 1;
      const sc = pop * 1.18; // visual size boost over the physics radius

      // rolling: rotate around axis perpendicular to velocity and contact normal
      const sp = m.v.length();
      if (sp > 0.05) {
        _axis.crossVectors(m.contactN, m.v);
        const l = _axis.length();
        if (l > 1e-5) {
          _axis.divideScalar(l);
          _q.setFromAxisAngle(_axis, (sp * dt) / MARBLE_R);
          this.quats[i].premultiply(_q);
        }
      }
      _s.setScalar(sc);
      _m4.compose(m.p, this.quats[i], _s);
      shell.setMatrixAt(i, _m4);
      core.setMatrixAt(i, _m4);
    }
    shell.instanceMatrix.needsUpdate = true;
    core.instanceMatrix.needsUpdate = true;
    shell.count = Math.min(marbles.length, this.max);
    core.count = shell.count;
  }

  dispose(scene) {
    scene.remove(this.shell, this.core);
    this.shell.geometry.dispose(); this.shell.material.dispose();
    this.core.geometry.dispose(); this.core.material.dispose();
  }
}
