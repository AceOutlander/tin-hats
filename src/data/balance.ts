import type { MatchupDef } from './schema';

/**
 * The headless matchup harness (src/sim/matchup.ts, tools/balance-table.ts, tests/balance):
 * equal-cost duels between every pair of combat unit kinds, in the open and against a trench.
 */
export const MATCHUP: MatchupDef = {
  kinds: ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'at', 'tank'],
  budgetMin: 1000,
  budgetMax: 1400,
  seeds: 8,
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

/** Series of whole battles run headless by src/sim/balanceRuns.ts (tools/balance-table.ts, tests/balance). */
export interface CampaignRunsDef {
  /** Seeds per mission, difficulty and commander (seeds 1..n). */
  seeds: number;
  /** A campaign battle still running after this many minutes is undecided. */
  capMinutes: number;
  /** Battles of the AI against itself on the mirrored proving ground (seeds 1..n). */
  mirrorSeeds: number;
}

export const CAMPAIGN_RUNS: CampaignRunsDef = {
  seeds: 16,
  capMinutes: 40,
  mirrorSeeds: 400,
};
