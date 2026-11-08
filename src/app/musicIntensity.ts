/**
 * Which battle-music layer the battle asks for (src/data/musicBattle.ts MUSIC_BATTLE.intensity), from the battle state,
 * once a second of battle time. Pure: no Phaser, no audio, no allocation per call.
 *
 * - combat: at least `combat.enter` armed soldiers on each side in the fight, where "in the fight" means within
 *   `combat.band` of the other side's front line while the two fronts are that close; it ends when either side falls
 *   below `combat.exit` (hysteresis).
 * - tense: the player's HQ took damage in the last `damageSeconds`, or an enemy is within `enterDistance` of it (and
 *   it stays tense until they are beyond `exitDistance`), or a survival or deadline clock has under `timerSeconds` left.
 * - prep: the prep phase of a defensive mission (setPrep; nothing calls it yet).
 * - build: otherwise.
 *
 * Tense outranks combat, combat outranks prep. A new layer must be wanted for `confirm[layer]` seconds; a layer once
 * reached is kept for at least `hold[layer]` seconds before it calms down, and `escalateHold` before it rises, so the
 * music never flips back and forth every few seconds.
 */
import { MUSIC_BATTLE, type IntensityRules, type MusicLayer } from '../data/musicBattle';
import type { BattleState } from '../sim';

/** The part of the battle state the rules read. */
export type IntensityState = Pick<BattleState, 'time' | 'units' | 'unitCount' | 'sides' | 'timer' | 'over'>;

/** One layer change, kept for the debug hooks and the tests: when, from what to what, and the battle at that check. */
export interface LayerChange {
  time: number;
  from: MusicLayer;
  to: MusicLayer;
  /** Armed soldiers of each side in the fight. */
  fighting: [number, number];
  /** The tense conditions: HQ hit lately, an enemy near it, a clock nearly out. */
  hit: boolean;
  near: boolean;
  clock: boolean;
}

/** Layer changes kept (the most recent). */
const CHANGES_KEPT = 64;

/** How urgent each layer is: a change up waits only escalateHold. */
const RANK: Record<MusicLayer, number> = { build: 0, prep: 0, combat: 1, tense: 2 };

export class MusicIntensity {
  /** The layer asked for now. */
  layer: MusicLayer = 'build';
  /** Armed soldiers of each side in the fight at the last check (debug hooks). */
  readonly fighting: [number, number] = [0, 0];
  /** The latest layer changes, oldest first (allocated only when the layer changes). */
  readonly changes: LayerChange[] = [];
  private changedAt = 0;
  private pending: MusicLayer | null = null;
  private pendingSince = 0;
  private combatOn = false;
  private nearOn = false;
  private hqHp = -1;
  private hitAt = -Infinity;
  private hit = false;
  private clock = false;
  private prep = false;
  private forced: MusicLayer | null = null;
  private nextCheck = 0;

  constructor(private readonly rules: IntensityRules = MUSIC_BATTLE.intensity) {}

  /** The prep phase of a defensive mission started or ended. */
  setPrep(on: boolean): void {
    this.prep = on;
  }

  /** Debug: force a layer (null hands control back to the battle). Takes effect at once, without hold times. */
  force(layer: MusicLayer | null): void {
    this.forced = layer;
    if (layer !== null) {
      this.layer = layer;
      this.pending = null;
    }
    this.nextCheck = 0;
  }

  /** Call every frame; it checks the battle every `checkEvery` seconds of battle time and returns the layer asked for. */
  update(state: IntensityState): MusicLayer {
    if (state.time < this.nextCheck || state.over) return this.layer;
    this.nextCheck = state.time + this.rules.checkEvery;
    if (this.forced !== null) {
      this.layer = this.forced;
      return this.layer;
    }
    const wish = this.wish(state);
    const t = state.time;
    if (wish === this.layer) {
      this.pending = null;
      return this.layer;
    }
    if (this.pending !== wish) {
      this.pending = wish;
      this.pendingSince = t;
    }
    // Rising to a more urgent layer only waits a short hold; calming down waits the layer's full hold.
    const hold = RANK[wish] > RANK[this.layer] ? this.rules.escalateHold : this.rules.hold[this.layer];
    if (t - this.changedAt >= hold && t - this.pendingSince >= this.rules.confirm[wish]) {
      this.changes.push({ time: t, from: this.layer, to: wish, fighting: [this.fighting[0], this.fighting[1]], hit: this.hit, near: this.nearOn, clock: this.clock });
      if (this.changes.length > CHANGES_KEPT) this.changes.shift();
      this.layer = wish;
      this.changedAt = t;
      this.pending = null;
    }
    return this.layer;
  }

  /** The layer the battle calls for right now, before confirm and hold times (combat and threat keep their hysteresis). */
  wish(state: IntensityState): MusicLayer {
    // Both are measured at every check, so the fight's count and its hysteresis stay current while the HQ is threatened.
    const combat = this.combat(state);
    if (this.tense(state)) return 'tense';
    if (combat) return 'combat';
    return this.prep ? 'prep' : 'build';
  }

  private combat(state: IntensityState): boolean {
    const C = this.rules.combat;
    const units = state.units;
    let front0 = -Infinity;
    let front1 = Infinity;
    for (let i = 0; i < state.unitCount; i++) {
      const u = units[i];
      if (!u.alive || u.inside || u.mount.weapon === null) continue;
      if (u.side === 0) {
        if (u.x > front0) front0 = u.x;
      } else if (u.x < front1) front1 = u.x;
    }
    let n0 = 0;
    let n1 = 0;
    if (front1 - front0 <= C.band) {
      for (let i = 0; i < state.unitCount; i++) {
        const u = units[i];
        if (!u.alive || u.inside || u.mount.weapon === null) continue;
        if (u.side === 0) {
          if (u.x >= front1 - C.band) n0++;
        } else if (u.x <= front0 + C.band) n1++;
      }
    }
    this.fighting[0] = n0;
    this.fighting[1] = n1;
    const need = this.combatOn ? C.exit : C.enter;
    this.combatOn = n0 >= need && n1 >= need;
    return this.combatOn;
  }

  private tense(state: IntensityState): boolean {
    const T = this.rules.tense;
    const t = state.time;
    const timer = state.timer;
    const clock = timer !== null && timer.secondsLeft <= T.timerSeconds;
    this.clock = clock;
    const hq = state.sides[0].hq;
    if (!hq || !hq.alive) {
      this.nearOn = false;
      this.hit = false;
      return clock;
    }
    if (this.hqHp >= 0 && hq.hp < this.hqHp) this.hitAt = t;
    this.hqHp = hq.hp;
    const reach = this.nearOn ? T.exitDistance : T.enterDistance;
    let near = false;
    const units = state.units;
    for (let i = 0; i < state.unitCount && !near; i++) {
      const u = units[i];
      if (u.alive && !u.inside && u.side === 1 && Math.abs(u.x - hq.x) <= reach) near = true;
    }
    this.nearOn = near;
    this.hit = t - this.hitAt <= T.damageSeconds;
    return clock || near || this.hit;
  }
}
