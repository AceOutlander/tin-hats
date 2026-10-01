/**
 * Structure art: HQ bunkers, flags, trench kit, pillbox, barbed wire.
 * Keys are namespaced "st/...".
 */
import type { SpriteSpec } from '../types';
import { flagSpecs } from './flags';
import { hqSpecs } from './hq';
import { pillboxSpecs } from './pillbox';
import { trenchKitSpecs } from './trench';
import { wireSpecs } from './wire';

export { FLAG_KEYS, flagSpecs, flagStripTint, flagWave, type FlagId, type FlagWave } from './flags';
export { hqKey, hqSpecs } from './hq';
export { pillboxKey, pillboxSpecs } from './pillbox';
export { createTileSpan, tileSpan, type TileSpan } from './span';
export { TRENCH_KEYS, trenchKey, trenchKitSpecs, trenchSpec, type TrenchLayer } from './trench';
export { WIRE_KEYS, wireSpecs } from './wire';

/** Every fixed structure sprite. (trenchSpec(layer, width) builds extra one-piece trench sprites on demand.) */
export function structureSpecs(): SpriteSpec[] {
  return [...hqSpecs(), ...flagSpecs(), ...trenchKitSpecs(), ...pillboxSpecs(), ...wireSpecs()];
}
