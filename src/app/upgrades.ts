import type { UpgradeDef } from '../data/schema';

/**
 * The Quartermaster upgrade table, once src/data/upgrades.ts exists (Phase 3) and exports `UPGRADES`.
 * The glob resolves to nothing while the file is missing, so Phase 1 builds without it.
 */
const modules = import.meta.glob<{ UPGRADES?: readonly UpgradeDef[] }>('../data/upgrades.ts', { eager: true });

export function loadUpgradeDefs(): readonly UpgradeDef[] {
  for (const mod of Object.values(modules)) {
    if (mod.UPGRADES) return mod.UPGRADES;
  }
  return [];
}
