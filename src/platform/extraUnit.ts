/**
 * The extra unit as the game asks about it (docs/PLATFORM.md, "The extra unit"): is one installed, how is it drawn,
 * may the player field it. The answers are the platform's; on the website there is none and every answer is "no".
 *
 * For tests only: with `?debug=1` a page may carry a made-up unit in `window.__TH_EXTRA_UNIT` (set before the game's
 * scripts run), which then stands in for the platform's, owned. src/main.ts asks once, before the game is loaded,
 * because a unit's data has to be in place before the game's tables are built (src/data/extraUnit.ts).
 */
import { hasExtraUnit, installExtraUnit, type ExtraUnitData } from '../data/extraUnit';
import { platform } from './index';
import type { ExtraUnitSlot } from './types';

/** What a test page hands over: both halves of a unit. */
export interface ExtraUnitStandIn {
  readonly data: ExtraUnitData;
  readonly slot: ExtraUnitSlot;
}

let standIn: ExtraUnitSlot | null = null;

/** With `?debug=1` and a unit on `holder.__TH_EXTRA_UNIT`: install it as the extra unit. Call before the game loads. */
export function standInExtraUnit(search: string, holder: object): void {
  const made = (holder as { __TH_EXTRA_UNIT?: ExtraUnitStandIn }).__TH_EXTRA_UNIT;
  if (new URLSearchParams(search).get('debug') !== '1' || !made || platform.extraUnit !== null) return;
  installExtraUnit(made.data);
  standIn = made.slot;
}

/** The slot of the extra unit in play (a test's stand-in, else the platform's), or null. */
export function extraUnitSlot(): ExtraUnitSlot | null {
  return standIn ?? platform.extraUnit;
}

/** True when the player may field the extra unit now: one is installed, drawn, and the platform says it is owned. */
export function ownsExtraUnit(): boolean {
  if (standIn !== null) return true;
  const slot = platform.extraUnit;
  return slot !== null && hasExtraUnit() && platform.entitlements().has(slot.entitlement);
}
