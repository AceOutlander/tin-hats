/**
 * Minor, non-graphic blood (the "Show blood" setting, on by default). A soldier killed by gunfire gets one small,
 * flat, dark-red pool on the ground under his body: it starts once he has fallen, spreads out over about a second and
 * fades out with the body (the unit views pass the body's own alpha, so it keeps the corpse timing exactly). No
 * splatter, and nothing for explosive or anti-tank deaths, vehicles or buildings.
 *
 * The pools are a fixed set of images made up front (RENDER.blood.maxPools): a death past the cap takes over the
 * oldest pool, so a big battle never has more, and nothing is allocated while it plays. Each pool belongs to one unit
 * id; a view whose pool was taken over (or cleared when the setting went off) simply finds it no longer owns it.
 */
import { RENDER } from '../data/render';
import type { DamageType, UnitKind } from '../data/schema';
import { mixSeed } from '../fx';

const B = RENDER.blood;

/** The part of a Phaser Image a pool uses (plain objects stand in for it in the unit tests). */
export interface PoolImage {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
}

/** Put a pool's image into the blood layer of depth row `row`. */
export type PoolMover = (img: PoolImage, row: number) => void;

/**
 * Whether a death leaves a pool: infantry killed by gunfire only. Explosive and anti-tank deaths, tanks, and a sapper
 * driving his supply truck (`inVehicle`) never bleed.
 */
export function bleeds(kind: UnitKind, cause: DamageType | null, inVehicle: boolean): boolean {
  return cause === 'bullet' && !inVehicle && kind !== 'tank' && kind !== 'heavyTank';
}

/**
 * Size of a pool `t` seconds after the death, as a fraction of its full size: 0 during the fall (RENDER.blood.delay),
 * then from startScale easing out to 1 over spreadTime.
 */
export function poolSpread(t: number): number {
  const u = t - B.delay;
  if (u < 0) return 0;
  const k = Math.min(1, u / B.spreadTime);
  const e = 1 - (1 - k) * (1 - k);
  return B.startScale + (1 - B.startScale) * e;
}

export class BloodPools {
  /** Unit id each pool belongs to, -1 = free. */
  private readonly owner: Int32Array;
  /** Claim order (to find the oldest), and each pool's size factor. */
  private readonly order: Float64Array;
  private readonly size: Float32Array;
  private serial = 0;
  private live = 0;
  private on = true;
  /** Deaths that would bleed, whether or not blood is shown (for the debug hooks and tests). */
  bleedingDeaths = 0;

  /**
   * @param images one image per pool (the cap is images.length), each already in a blood layer and hidden
   * @param move puts an image into a row's blood layer
   * @param unitScale image scale that draws the sprite at its own size in wu (1 / the atlas frame's scale)
   */
  constructor(
    private readonly images: readonly PoolImage[],
    private readonly move: PoolMover,
    private readonly unitScale: number,
  ) {
    const n = images.length;
    this.owner = new Int32Array(n).fill(-1);
    this.order = new Float64Array(n);
    this.size = new Float32Array(n);
  }

  get cap(): number {
    return this.images.length;
  }

  get enabled(): boolean {
    return this.on;
  }

  /** Pools in use now. */
  count(): number {
    return this.live;
  }

  /** Pools drawn this frame (in use, on screen and started). */
  drawn(): number {
    let n = 0;
    for (let i = 0; i < this.owner.length; i++) if (this.owner[i] >= 0 && this.images[i].visible) n++;
    return n;
  }

  /** "Show blood": off removes every pool at once, and no new one starts until it is on again. */
  setEnabled(on: boolean): void {
    this.on = on;
    if (!on) this.clear();
  }

  /**
   * A soldier died: count it if he bleeds and, when blood is shown, give him a pool on depth row `row`. Returns the
   * pool's index, or -1 for none. Past the cap the oldest pool is taken over.
   */
  onDeath(unitId: number, row: number, kind: UnitKind, cause: DamageType | null, inVehicle: boolean): number {
    if (!bleeds(kind, cause, inVehicle)) return -1;
    this.bleedingDeaths++;
    if (!this.on || this.images.length === 0) return -1;
    let pick = -1;
    let oldest = Infinity;
    for (let i = 0; i < this.owner.length; i++) {
      if (this.owner[i] < 0) {
        pick = i;
        break;
      }
      if (this.order[i] < oldest) {
        oldest = this.order[i];
        pick = i;
      }
    }
    if (this.owner[pick] < 0) this.live++;
    this.owner[pick] = unitId;
    this.order[pick] = this.serial++;
    this.size[pick] = 1 + B.sizeSpread * ((mixSeed(B.sizeSalt, unitId) / 4294967296) * 2 - 1);
    const img = this.images[pick];
    img.visible = false;
    this.move(img, row);
    return pick;
  }

  /** Where the pool started last lies now (world x, y, its opacity and size in wu), or null when none is in use (debug hooks). */
  newest(): { x: number; y: number; alpha: number; width: number } | null {
    let pick = -1;
    for (let i = 0; i < this.owner.length; i++) if (this.owner[i] >= 0 && (pick < 0 || this.order[i] > this.order[pick])) pick = i;
    if (pick < 0) return null;
    const img = this.images[pick];
    return { x: img.x, y: img.y, alpha: img.visible ? img.alpha : 0, width: (img.scaleX / this.unitScale) * B.spriteW };
  }

  /** True while pool i still belongs to this unit (not taken over, not cleared). */
  owns(i: number, unitId: number): boolean {
    return i >= 0 && i < this.owner.length && this.owner[i] === unitId;
  }

  /**
   * Lay pool i of this unit: `t` seconds after the death, centred at (x, y) on the ground, at row scale s, faded with
   * the body (`bodyAlpha` 0..1).
   */
  place(i: number, unitId: number, t: number, x: number, y: number, s: number, bodyAlpha: number): void {
    if (!this.owns(i, unitId)) return;
    const img = this.images[i];
    img.x = x;
    img.y = y + B.dropY * s;
    const k = poolSpread(t);
    const a = B.alpha * bodyAlpha;
    if (k <= 0 || a <= 0) {
      img.visible = false;
      return;
    }
    const scale = k * this.size[i] * s * this.unitScale;
    img.scaleX = scale;
    img.scaleY = scale;
    img.alpha = a;
    img.visible = true;
  }

  /** Hide pool i for this frame (its body is off screen); it keeps its place. */
  hide(i: number, unitId: number): void {
    if (this.owns(i, unitId)) this.images[i].visible = false;
  }

  /** The body is gone: pool i is free again. */
  end(i: number, unitId: number): void {
    if (!this.owns(i, unitId)) return;
    this.owner[i] = -1;
    this.images[i].visible = false;
    this.live--;
  }

  /** Free every pool (a new battle, or blood turned off). */
  clear(): void {
    for (let i = 0; i < this.owner.length; i++) {
      this.owner[i] = -1;
      this.images[i].visible = false;
    }
    this.live = 0;
  }

  /** A new battle: no pools, and the death count starts again. */
  reset(): void {
    this.clear();
    this.bleedingDeaths = 0;
    this.serial = 0;
  }
}
