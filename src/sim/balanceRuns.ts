/**
 * Whole battles run headless in series, for tools/balance-table.ts (docs/BALANCE.md) and the
 * balance tests: a commander on side 0 against the AI over seeds 1..n of a mission, summed up as a
 * win rate and a median winning time; and the AI against itself on the mirrored proving ground.
 */
import { CAMPAIGN_RUNS } from '../data/balance';
import { CONFIG } from '../data/config';
import { SANDBOX_MIRROR } from '../data/missions/sandbox';
import type { Difficulty, MissionDef } from '../data/schema';
import { createBattle } from './battle';
import type { Battle, CommanderKind, EndReason } from './types';

/** One battle of a series. */
export interface MissionRun {
  seed: number;
  /** 0 or 1, or -1 if undecided (or a draw). */
  winner: number;
  seconds: number;
  /** Still running at the cap. */
  undecided: boolean;
  endReason: EndReason;
}

/** A mission played by one commander on side 0 against the AI over seeds 1..n. */
export interface MissionSeries {
  mission: number;
  difficulty: Difficulty;
  commander: CommanderKind;
  runs: MissionRun[];
  wins: number;
  losses: number;
  undecided: number;
  /** wins / runs. */
  winRate: number;
  /** Median length of side 0's wins in minutes (NaN with no win). */
  medianWinMinutes: number;
}

/** AI against AI on the mirrored proving ground. */
export interface MirrorResult {
  seeds: number;
  wins: [number, number];
  undecided: number;
  /** Side 0's share of the decided battles. */
  share: number;
  /** Mean battle length in minutes. */
  meanMinutes: number;
}

/** The median of some numbers (NaN for none). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Play one battle of `commander` (side 0) against the AI to its end or the cap. `each`, if given,
 * is called after every step (the tests check invariants with it).
 */
export function playMission(
  mission: MissionDef,
  difficulty: Difficulty,
  commander: CommanderKind,
  seed: number,
  each?: (battle: Battle) => void,
  capMinutes: number = CAMPAIGN_RUNS.capMinutes,
): MissionRun {
  const battle = createBattle({ mission, difficulty, seed, upgrades: {}, commanders: [commander, 'ai'] });
  const maxTicks = Math.ceil(capMinutes * 60 * CONFIG.tickRate);
  const s = battle.state;
  while (!s.over && s.tick < maxTicks) {
    battle.step();
    if (each) each(battle);
  }
  return { seed, winner: s.over ? s.winner : -1, seconds: s.time, undecided: !s.over, endReason: s.endReason };
}

/**
 * Play a mission over seeds 1..seeds. `watch`, if given, makes a fresh per-step check for each
 * battle (called with the seed before it starts).
 */
export function runSeries(
  mission: MissionDef,
  difficulty: Difficulty,
  commander: CommanderKind,
  seeds: number = CAMPAIGN_RUNS.seeds,
  watch?: (seed: number) => (battle: Battle) => void,
): MissionSeries {
  const runs: MissionRun[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    runs.push(playMission(mission, difficulty, commander, seed, watch ? watch(seed) : undefined));
  }
  const winTimes = runs.filter((r) => r.winner === 0).map((r) => r.seconds / 60);
  const undecided = runs.filter((r) => r.undecided).length;
  return {
    mission: mission.id,
    difficulty,
    commander,
    runs,
    wins: winTimes.length,
    losses: runs.filter((r) => r.winner === 1).length,
    undecided,
    winRate: winTimes.length / runs.length,
    medianWinMinutes: median(winTimes),
  };
}

/**
 * The AI against itself on the mirrored proving ground over seeds 1..seeds; a battle still running
 * after the ground's longest expected length is undecided.
 */
export function runMirror(seeds: number = CAMPAIGN_RUNS.mirrorSeeds): MirrorResult {
  const wins: [number, number] = [0, 0];
  let undecided = 0;
  let seconds = 0;
  const maxTicks = Math.ceil(SANDBOX_MIRROR.expectedMinutes[1] * 60 * CONFIG.tickRate);
  for (let seed = 1; seed <= seeds; seed++) {
    const battle = createBattle({ mission: SANDBOX_MIRROR, difficulty: 'normal', seed, upgrades: {}, commanders: ['ai', 'ai'] });
    const s = battle.state;
    while (!s.over && s.tick < maxTicks) battle.step();
    seconds += s.time;
    if (s.over && (s.winner === 0 || s.winner === 1)) wins[s.winner]++;
    else undecided++;
  }
  const decided = wins[0] + wins[1];
  return { seeds, wins, undecided, share: decided > 0 ? wins[0] / decided : NaN, meanMinutes: seconds / seeds / 60 };
}
