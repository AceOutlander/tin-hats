/**
 * The one unit a platform may add to the game (docs/PLATFORM.md, "The extra unit").
 *
 * The game's unit, weapon and sound tables are built once, when their modules are first read, so an extra unit has to
 * be here before that: a platform calls installExtraUnit while its own module loads (the page's entry reads the
 * platform first, src/main.ts). The first module to ask (extraUnitData) closes the slot: a unit installed after that
 * would be half in the game, so it is refused loudly instead.
 *
 * With nothing installed the kind 'extra' is in no list and no table, and the game is exactly as it is without this
 * file. Pure data: no DOM, no randomness. How the unit is drawn is the platform's other half (src/platform/types.ts,
 * ExtraUnitSlot).
 */
import type { UnitDef, WeaponDef } from './schema';
import type { SoundDef } from './sounds';

export interface ExtraUnitData {
  /** The unit itself. Its kind is 'extra'; every weapon it names is in `weapons` or is one of the game's own. */
  readonly unit: UnitDef & { readonly kind: 'extra' };
  /** Weapons the unit brings, added to the game's (ids must be new). */
  readonly weapons: readonly WeaponDef[];
  /** One-shot sounds the unit brings, added to the game's by name (names must be new). */
  readonly sounds: Readonly<Record<string, SoundDef>>;
  /** Its name, the shorter name on its training button (absent = the name) and the line that describes it. */
  readonly name: string;
  readonly buttonName?: string;
  readonly blurb: string;
  /**
   * What it shouts in a speech bubble when it starts a charge (UnitDef.charge), in turn, and the sound that goes
   * with the shout (one of `sounds` or of the game's own). Empty = it charges in silence.
   */
  readonly shouts: readonly string[];
  readonly shoutSound: string | null;
}

let installed: ExtraUnitData | null = null;
let closed = false;

/** Add the extra unit. Only before any of the game's data has been read, and only once. */
export function installExtraUnit(data: ExtraUnitData): void {
  if (closed) throw new Error('Tin Hats: the extra unit must be installed before the game data is read');
  if (installed !== null) throw new Error('Tin Hats: an extra unit is already installed');
  installed = data;
}

/** The extra unit, or null. Asking closes the slot (see the header). */
export function extraUnitData(): ExtraUnitData | null {
  closed = true;
  return installed;
}

/** True when an extra unit is installed (closes the slot). */
export function hasExtraUnit(): boolean {
  return extraUnitData() !== null;
}
