/** Every particle preset the renderer plays: the effects track's FX_PRESETS plus the renderer's own (src/data/renderFx.ts). */
import { FX_PRESETS, type FxPresetDef } from '../../data/fx';
import { RENDER_FX_PRESETS } from '../../data/renderFx';

const TABLE = { ...FX_PRESETS, ...RENDER_FX_PRESETS };

export type PresetId = keyof typeof TABLE;

export const PRESET_DEFS: Readonly<Record<PresetId, FxPresetDef>> = TABLE;

export function isPresetId(id: string): id is PresetId {
  return Object.prototype.hasOwnProperty.call(TABLE, id);
}
