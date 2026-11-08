/**
 * Which units show their health to the player (view only; the sim and the AI never read it).
 *
 * By default (RENDER.hpReveal) the player's own units show their health pips and the enemy's do not. Two ways reveal
 * a side's health: the whole side at once (setSideShown / setEnemyShown, for the admin panel and the ?debug=1 hook),
 * or an area of the field for a while (reveal / revealEnemy, for the Recon plane). Areas age on battle time, so a
 * paused or fast-forwarded battle keeps them for exactly their battle seconds. Structures are not units and never go
 * through this: HQs and pillboxes always show their damage.
 *
 * No Phaser here, and nothing allocates after construction: shows() runs for every damaged unit every frame.
 */
import { RENDER } from '../data/render';
import type { Side } from '../data/schema';

const R = RENDER.hpReveal;

interface RevealArea {
  side: Side;
  x: number;
  /** Half width along the front (wu); Infinity = the whole field. */
  radius: number;
  /** Battle time it ends; Infinity = until cleared. */
  until: number;
  live: boolean;
}

export class HpReveal {
  private playerSide: Side = 0;
  private readonly sideShown: [boolean, boolean] = [R.revealOwnHp, R.revealEnemyHp];
  private readonly areas: RevealArea[] = [];
  private time = 0;

  constructor(maxAreas: number = R.maxAreas) {
    for (let i = 0; i < Math.max(1, maxAreas); i++) this.areas.push({ side: 0, x: 0, radius: 0, until: 0, live: false });
  }

  /** A new battle: the side the player commands, the data defaults for both sides, no reveal areas, the clock at 0. */
  reset(playerSide: Side): void {
    this.playerSide = playerSide;
    this.sideShown[playerSide] = R.revealOwnHp;
    this.sideShown[playerSide === 0 ? 1 : 0] = R.revealEnemyHp;
    this.clearReveals();
    this.time = 0;
  }

  /** The side the player commands (its units are "own", the other side's are "enemy"). */
  get player(): Side {
    return this.playerSide;
  }

  get enemy(): Side {
    return this.playerSide === 0 ? 1 : 0;
  }

  /** Show (true) or hide (false) the health of every unit of `side`, everywhere, until changed or the next battle. */
  setSideShown(side: Side, on: boolean): void {
    this.sideShown[side] = on;
  }

  /** The admin panel / ?debug=1 switch: the enemy's unit health everywhere, on or off. */
  setEnemyShown(on: boolean): void {
    this.sideShown[this.enemy] = on;
  }

  /** True while the enemy's whole side is revealed (areas not counted). */
  enemyShown(): boolean {
    return this.sideShown[this.enemy];
  }

  /**
   * Reveal the health of `side`'s units within `radius` wu of world x for `seconds` of battle time (Infinity for
   * either = the whole field / until cleared). A zero, negative or NaN radius or duration reveals nothing. Past the
   * area cap the area ending soonest is replaced.
   */
  reveal(side: Side, x: number, radius: number, seconds: number): void {
    if (!(radius > 0) || !(seconds > 0) || Number.isNaN(x)) return;
    let slot = this.areas[0];
    for (const a of this.areas) {
      if (!a.live) {
        slot = a;
        break;
      }
      if (a.until < slot.until) slot = a;
    }
    slot.side = side;
    slot.x = x;
    slot.radius = radius;
    slot.until = this.time + seconds;
    slot.live = true;
  }

  /** reveal() for the enemy's units (what the Recon plane calls). */
  revealEnemy(x: number, radius: number, seconds: number): void {
    this.reveal(this.enemy, x, radius, seconds);
  }

  /** End every reveal area now (the whole-side switches stay as they are). */
  clearReveals(): void {
    for (const a of this.areas) a.live = false;
  }

  /** Reveal areas still running. */
  activeReveals(): number {
    let n = 0;
    for (const a of this.areas) if (a.live) n++;
    return n;
  }

  /** Once per frame with the battle's time (seconds): areas whose time is up end. */
  update(battleTime: number): void {
    this.time = battleTime;
    for (const a of this.areas) if (a.live && a.until <= battleTime) a.live = false;
  }

  /** Whether a unit of `side` standing at world x shows its health to the player now. */
  shows(side: Side, x: number): boolean {
    if (this.sideShown[side]) return true;
    for (const a of this.areas) {
      if (a.live && a.side === side && a.until > this.time && Math.abs(x - a.x) <= a.radius) return true;
    }
    return false;
  }
}
