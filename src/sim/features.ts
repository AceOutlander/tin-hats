import type { SimFeatures } from './types';

/**
 * What the simulation currently simulates. Phase 1: economy, training, the
 * three orders, hitscan combat, the HQ gun, the AI, scripted mission events
 * and the timer. Everything false here is present as state and data but inert.
 */
export const SIM_FEATURES: Readonly<SimFeatures> = {
  trenches: false,
  pillboxes: false,
  wire: false,
  projectiles: false,
  directControl: false,
  supports: false,
  events: true,
};
