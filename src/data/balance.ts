import type { MatchupDef } from './schema';

/**
 * The headless matchup harness (src/sim/matchup.ts, tools/balance-table.ts, tests/balance):
 * equal-cost duels between every pair of combat unit kinds, in the open and against a trench.
 */
export const MATCHUP: MatchupDef = {
  kinds: ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'at', 'tank'],
  budgetMin: 1000,
  budgetMax: 1400,
  seeds: 4,
  maxSeconds: 240,
  length: 5000,
  openX: [1900, 3100],
  trenchX: 3000,
  trenchWidth: 130,
  attackX: 1900,
  mixedArmy: [
    { kind: 'rifle', count: 6 },
    { kind: 'lmg', count: 2 },
    { kind: 'assault', count: 2 },
    { kind: 'mortar', count: 1 },
    { kind: 'sniper', count: 1 },
    { kind: 'medic', count: 1 },
    { kind: 'at', count: 4 },
    { kind: 'tank', count: 1 },
  ],
};
