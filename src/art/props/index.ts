/**
 * Prop art: supply dump, crates, parachute, and ground decals.
 * Keys are namespaced "prop/...".
 */
import type { SpriteSpec } from '../types';
import { decalSpecs } from './decals';
import { supplySpecs } from './supplies';

export { DECAL_KEYS, RUBBLE_KEYS, decalSpecs } from './decals';
export { SUPPLY_KEYS, supplySpecs } from './supplies';

/** Every prop sprite. */
export function propSpecs(): SpriteSpec[] {
  return [...supplySpecs(), ...decalSpecs()];
}
