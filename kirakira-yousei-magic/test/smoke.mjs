// Node smoke test: import every DOM-free module (verifies syntax + imports)
// and exercise the pure progression state machine end-to-end through all
// four stages to the finale.

import * as THREE from '../vendor/three.module.min.js';
import { STAGES, FAIRIES, DRESS_CYCLE, PRAISE } from '../src/stages.js';
import { Progression } from '../src/progression.js';

let ok = true;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

// --- data sanity
check(STAGES.length === 4, `4 stages defined (${STAGES.length})`);
for (const s of STAGES) {
  check(typeof s.name === 'string' && s.name.length > 0, `stage ${s.id}: has a name`);
  check(s.budsNeeded >= 3 && s.budsNeeded <= s.budsMax, `stage ${s.id}: bud counts sane (${s.budsNeeded}/${s.budsMax})`);
  check(Array.isArray(s.petals) && s.petals.length >= 4, `stage ${s.id}: petal palette present`);
  check(['butterfly', 'bunny', 'star', 'bird'].includes(s.friend), `stage ${s.id}: friend kind known (${s.friend})`);
  for (const key of ['top', 'mid', 'bot', 'sun']) {
    check(Number.isInteger(s.sky[key]), `stage ${s.id}: sky.${key} is a color`);
  }
  check(typeof s.ground.inner === 'string' && s.ground.inner.startsWith('#'), `stage ${s.id}: ground colors are css strings`);
}
check(FAIRIES.length === 5, `5 fairies to choose from (${FAIRIES.length})`);
for (const f of FAIRIES) {
  check(typeof f.name === 'string' && Number.isInteger(f.dress) && Number.isInteger(f.wing) && Number.isInteger(f.hair),
    `fairy ${f.id}: palette complete`);
}
check(DRESS_CYCLE.length >= 5, 'dress cycle has variety');
check(PRAISE.every((p) => p.length === 2), 'praise entries are [text, emoji] pairs');

// --- three.js vendored module loads and works headlessly
const v = new THREE.Vector3(1, 2, 3);
check(v.length() > 3.7 && v.length() < 3.8, 'three.js module usable in node');

// --- progression: play the whole game
const prog = new Progression(STAGES);
let fireworks = 0;
for (let stage = 0; stage < 4; stage++) {
  const st = prog.stage;
  check(prog.stageIdx === stage, `stage ${stage}: index correct`);
  check(!prog.keySpawned && !prog.keyHeld && !prog.doorOpen, `stage ${stage}: starts locked`);
  check(!prog.openDoor(), `stage ${stage}: door refuses to open without key`);
  check(!prog.grabKey(), `stage ${stage}: key cannot be grabbed before it appears`);
  let keyEvents = 0;
  for (let b = 0; b < st.budsNeeded + 2; b++) {
    const evs = prog.addBloom();
    keyEvents += evs.filter((e) => e === 'key').length;
    for (const e of prog.addGems(3)) if (e === 'fireworks') fireworks++;
  }
  check(keyEvents === 1, `stage ${stage}: key appears exactly once`);
  check(prog.grabKey(), `stage ${stage}: key grabbed`);
  check(!prog.grabKey(), `stage ${stage}: key cannot be grabbed twice`);
  check(prog.openDoor(), `stage ${stage}: door opens with key`);
  check(!prog.openDoor(), `stage ${stage}: door does not re-open`);
  const next = prog.nextStage();
  check(next === (stage < 3 ? 'stage' : 'finale'), `stage ${stage}: advances to ${next}`);
}
check(prog.finale === true, 'finale reached');
check(prog.friends.length === 4, `all 4 friends collected (${prog.friends.join(', ')})`);
check(new Set(prog.friends).size === 4, 'friends are all different');
check(fireworks >= 4, `gem bonus fireworks fired along the way (${fireworks})`);
check(prog.gems === 4 * 3 * (4 + 5 + 6 + 7 + 2 * 4) / 4 || prog.gems > 60, `gems accumulate across stages (${prog.gems})`);

// --- reset works
prog.reset();
check(prog.stageIdx === 0 && prog.gems === 0 && prog.friends.length === 0, 'reset returns to a clean state');

console.log(ok ? '\nALL OK' : '\nFAILURES');
process.exit(ok ? 0 : 1);
