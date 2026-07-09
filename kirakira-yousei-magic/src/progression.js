// Pure game-progress state machine: blooms → key → door → next stage → finale.
// No DOM / no THREE so it is unit-testable in Node.

export class Progression {
  constructor(stages) {
    this.stages = stages;
    this.reset();
  }

  reset() {
    this.stageIdx = 0;
    this.blooms = 0;
    this.totalBlooms = 0;
    this.gems = 0;
    this.keySpawned = false;
    this.keyHeld = false;
    this.doorOpen = false;
    this.finale = false;
    this.friends = [];
  }

  get stage() { return this.stages[this.stageIdx]; }

  /** Register one bloomed flower. Returns event list ('key' when the magic key appears). */
  addBloom() {
    this.blooms += 1;
    this.totalBlooms += 1;
    const ev = [];
    if (!this.keySpawned && this.blooms >= this.stage.budsNeeded) {
      this.keySpawned = true;
      ev.push('key');
    }
    return ev;
  }

  /** Add sparkle gems. Every 12 gems fires a bonus 'fireworks' event. */
  addGems(n) {
    const before = this.gems;
    this.gems += n;
    const ev = [];
    if (Math.floor(this.gems / 12) > Math.floor(before / 12)) ev.push('fireworks');
    return ev;
  }

  grabKey() {
    if (this.keySpawned && !this.keyHeld) { this.keyHeld = true; return true; }
    return false;
  }

  openDoor() {
    if (this.keyHeld && !this.doorOpen) { this.doorOpen = true; return true; }
    return false;
  }

  /** Advance past an opened door. Returns 'stage' or 'finale'. */
  nextStage() {
    this.friends.push(this.stage.friend);
    if (this.stageIdx < this.stages.length - 1) {
      this.stageIdx += 1;
      this.blooms = 0;
      this.keySpawned = false;
      this.keyHeld = false;
      this.doorOpen = false;
      return 'stage';
    }
    this.finale = true;
    return 'finale';
  }
}
