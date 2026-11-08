import type { ArtBox, ArtPoint } from './artLayout';
import type { HqGunStyle } from './upgradeLooks';

/**
 * HQ machine-gun positions (one per HqGunStyle, the same for every nation; the gun model and helmets follow the
 * nation). Each sprite stands on the ground in front of the HQ with its origin (base centre, on the ground line) at
 * the HQ building's `gunNest` point, drawn facing +x. Intact and ruin share the box.
 */
export interface HqGunLayout {
  box: ArtBox;
  /** The gun's muzzle tip relative to the origin: muzzle flash and tracer origin. */
  muzzle: ArtPoint;
}

export const HQ_GUN_LAYOUT: Record<HqGunStyle, HqGunLayout> = {
  /** One gunner lying behind a single row of bags with the light gun on its bipod. */
  gunner: { box: { w: 84, h: 34, ox: 52, oy: 30 }, muzzle: { x: 29, y: -13 } },
  /** A horseshoe of bags two courses high, the gun on a low mount, one gunner. */
  emplacement: { box: { w: 86, h: 46, ox: 42, oy: 40 }, muzzle: { x: 41, y: -24 } },
  /** A heavier gun on a tripod behind higher bag walls, ammunition boxes, one gunner. */
  tripod: { box: { w: 96, h: 56, ox: 46, oy: 50 }, muzzle: { x: 47, y: -31 } },
  /** A timber-framed, roofed nest with a firing slot and a two-man crew. */
  nest: { box: { w: 118, h: 74, ox: 54, oy: 68 }, muzzle: { x: 60, y: -36 } },
};
