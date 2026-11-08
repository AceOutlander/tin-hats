/**
 * Layouts for the Quartermaster supply looks (src/data/upgradeLooks.ts): the supply dump at each income stage, the
 * sapper's bigger load, the handcart and the small supply truck. Pure data; the painters live in
 * src/art/props/supplyLooks.ts. Units are wu, origins as described per entry, +x = facing (toward the enemy).
 */
import type { ArtBox, ArtPoint } from './artLayout';
import type { DumpStyle } from './upgradeLooks';

/** Supply dump per style. Origin = ground centre of the dump's footprint (where sappers load). */
export const DUMP_STYLE_LAYOUT: Record<DumpStyle, { box: ArtBox }> = {
  crates: { box: { w: 84, h: 40, ox: 42, oy: 32 } },
  stacked: { box: { w: 150, h: 66, ox: 75, oy: 58 } },
  drums: { box: { w: 180, h: 70, ox: 90, oy: 62 } },
  // The supply truck is parked on the rear (-x) side, backed up to the dump.
  truck: { box: { w: 296, h: 70, ox: 196, oy: 62 } },
};

/** Where the parked truck's ground centre sits in the 'truck' dump, from the dump origin (it faces -x, tail to the dump). */
export const DUMP_TRUCK_X = -136;

/**
 * Handcart. Origin = the ground point straight below the handle grip; the grip is at (0, SAPPER_CART_HANDLE.y) and the
 * body extends forward (+x). One big spoked wheel under the middle of the body.
 */
export const CART_LAYOUT: { box: ArtBox; wheel: ArtPoint; wheelRadius: number } = {
  box: { w: 54, h: 54, ox: 4, oy: 50 },
  wheel: { x: 28, y: -10 },
  wheelRadius: 10,
};

/** Small supply truck seen from the side. Origin = ground centre, facing +x. */
export const SUPPLY_TRUCK_LAYOUT: { box: ArtBox; length: number } = {
  box: { w: 112, h: 60, ox: 56, oy: 56 },
  length: 100,
};

/**
 * The sapper's stage-1 load (a crate with a jerrycan and a sack lashed on top). Origin = centre, like the figure's
 * crate part, so it swaps in for it.
 */
export const BIG_LOAD_BOX: ArtBox = { w: 28, h: 19, ox: 14, oy: 9.5 };
