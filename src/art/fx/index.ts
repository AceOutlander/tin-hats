/**
 * Effect textures: every particle, tracer, projectile, rain, marker and decal
 * sprite. Keys are namespaced "fx/..." and come from src/data/fx.ts.
 */
import type { SpriteSpec } from '../types';
import { bitSprites } from './bits';
import { flashSprites } from './flashes';
import { markSprites } from './marks';
import { shotSprites } from './shots';
import { smokeSprites } from './smoke';

/** Every effect SpriteSpec, for the renderer to rasterise into its atlas. */
export function listFxSprites(): SpriteSpec[] {
  return [...smokeSprites(), ...flashSprites(), ...bitSprites(), ...shotSprites(), ...markSprites()];
}
