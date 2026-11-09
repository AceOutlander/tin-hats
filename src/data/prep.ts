/**
 * The prep phase of defensive missions (queue job 6; src/sim/prep.ts applies these rules).
 *
 * A mission with `prep` starts with a countdown before the enemy attacks: the enemy holds, the mission clock and its
 * scripted events wait, and the player's sappers build fortifications in the player's half of the field. "Ready" ends
 * it early. Every build costs money and takes a sapper's work: one sapper per build site, so more sappers build more
 * at once. A site still unfinished when the attack starts goes on being built, but gives no protection until done.
 */

import type { BuildableId } from './schema';

export type { BuildableId };

export interface BuildableDef {
  id: BuildableId;
  /** Button and tip text. */
  name: string;
  /** Sapper-seconds of work: one sapper standing at the site finishes it in this long. */
  seconds: number;
  /** Money, paid when the site is placed and given back in full if it is cancelled. */
  cost: number;
  /** Footprint on the ground in wu (the ghost, the site and the finished structure). */
  width: number;
  /** The structure it becomes. */
  makes: 'wire' | 'trench' | 'pillbox';
  /** Trench slots, for a foxhole or trench. */
  slots?: number;
  /** Multiplier on the base pillbox health, for a pillbox. */
  hpMul?: number;
}

export interface PrepTunables {
  /** Countdown when a mission does not give its own. */
  defaultSeconds: number;
  buildables: Record<BuildableId, BuildableDef>;
  /** In the build menu's order. */
  order: readonly BuildableId[];
  /** A sapper works when he stands within this of the site's centre. */
  workReach: number;
  /** Free ground kept between a new site and any structure or other site (edge to edge). */
  gap: number;
  /** The zone ends this far behind the player's front-most structure or unit, and never past half the field. */
  frontGap: number;
  /** Most sites a side may have at once (built or not, a sanity cap). */
  maxSites: number;
}

export const PREP: PrepTunables = {
  defaultSeconds: 60,
  buildables: {
    wire: { id: 'wire', name: 'Barbed Wire', seconds: 10, cost: 40, width: 90, makes: 'wire' },
    foxhole: { id: 'foxhole', name: 'Foxhole', seconds: 20, cost: 60, width: 60, makes: 'trench', slots: 3 },
    trench: { id: 'trench', name: 'Trench', seconds: 30, cost: 100, width: 140, makes: 'trench', slots: 7 },
    pillbox: { id: 'pillbox', name: 'Pillbox', seconds: 60, cost: 250, width: 70, makes: 'pillbox', hpMul: 0.8 },
  },
  order: ['wire', 'foxhole', 'trench', 'pillbox'],
  workReach: 24,
  gap: 20,
  frontGap: 60,
  maxSites: 16,
};
