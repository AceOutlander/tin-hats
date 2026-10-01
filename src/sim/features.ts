import type { SimFeatures } from './types';

/**
 * What the simulation currently simulates. Phase 1: economy, training, the
 * three orders, hitscan combat, the HQ gun, the AI, scripted mission events
 * and the timer. Phase 2 part 1: trenches, pillboxes and their guns, wire,
 * projectiles with splash, smoke clouds and the full roster. Phase 2 part 2:
 * direct control and support call-ins. Everything false here is present as
 * state and data but inert.
 */
export const SIM_FEATURES: Readonly<SimFeatures> = {
  trenches: true,
  pillboxes: true,
  wire: true,
  projectiles: true,
  directControl: true,
  supports: true,
  events: true,
};
