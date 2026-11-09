/**
 * Which looks a side shows in battle, from its Quartermaster upgrade levels (src/data/upgradeLooks.ts). Headless: the
 * renderer and the Quartermaster preview both read it.
 */
import type { FactionId, SupportKind, UnitKind, UpgradeDef, UpgradeLevels } from '../data/schema';
import {
  LOOK_TRACKS,
  LOOK_UPGRADE,
  NATION_LOOKS,
  type GearLevels,
  type GearSource,
  type LookStage,
  type LookTrack,
  type SideLooks,
  upgradeVisual,
} from '../data/upgradeLooks';
import { UPGRADES } from '../data/upgrades';

/** A saved level as a look stage: whole, 0 to 3, anything odd counts as 0. */
export function toStage(level: number | undefined): LookStage {
  if (level === undefined || !Number.isFinite(level)) return 0;
  const n = Math.max(0, Math.min(3, Math.floor(level)));
  return n as LookStage;
}

/** Whether an upgrade feeds a unit's health gear or its damage gear (healing counts as damage). */
export function gearSource(def: UpgradeDef): GearSource | null {
  const v = upgradeVisual(def);
  return v !== null && v.type === 'gear' ? v.source : null;
}

/**
 * Looks of a side with these upgrade levels. With `upgrades` null the side has no Quartermaster (the enemy): it shows
 * its nation's established positions and no gear.
 */
export function sideLooks(faction: FactionId, upgrades: UpgradeLevels | null, defs: readonly UpgradeDef[] = UPGRADES): SideLooks {
  const nation = NATION_LOOKS[faction];
  const stage = {} as Record<LookTrack, LookStage>;
  for (const t of LOOK_TRACKS) stage[t] = upgrades ? toStage(upgrades[LOOK_UPGRADE[t]]) : nation.enemy[t];
  const gear: Partial<Record<UnitKind, GearLevels>> = {};
  const support: Partial<Record<SupportKind, LookStage>> = {};
  if (upgrades) {
    for (const def of defs) {
      const v = upgradeVisual(def);
      if (v === null) continue;
      if (v.type === 'plane') support[v.support] = toStage(upgrades[def.id]);
      if (v.type !== 'gear') continue;
      const g = gear[v.unit] ?? (gear[v.unit] = { health: 0, damage: 0 });
      g[v.source] = toStage(upgrades[def.id]);
    }
  }
  return { faction, stage, gear, support };
}

/** The style a side draws for one track. */
export function lookStyle<T extends LookTrack>(looks: SideLooks, track: T): (typeof NATION_LOOKS)[FactionId][T][number] {
  return NATION_LOOKS[looks.faction][track][looks.stage[track]];
}

/** A unit kind's gear levels on a side (level 0 when it has none). */
export function gearOf(looks: SideLooks | null, kind: UnitKind): GearLevels {
  return looks?.gear[kind] ?? NO_GEAR;
}

const NO_GEAR: GearLevels = Object.freeze({ health: 0, damage: 0 });

/** A call-in's plane gear level on a side (0 when it has none). */
export function planeGearOf(looks: SideLooks | null, kind: SupportKind): LookStage {
  return looks?.support[kind] ?? 0;
}
