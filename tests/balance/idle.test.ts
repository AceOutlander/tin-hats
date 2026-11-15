/**
 * No battle goes on for ever against a player who has stopped playing (owner, 2026-11-15; DECISIONS 545 and 550). The
 * idle commander, who never plays at all, loses every mission in missions.test.ts; here the player stops part-way:
 * the reasonable-player bot plays each Stalingrad mission into each of its later phases, then (at once, after 200 s
 * and after 500 s of that phase) gives no more commands, as a player who has put the phone down. Whatever state he
 * left, the battle must end within IDLE_END_MINUTES of that moment (he loses, or the army he left wins it for him), with
 * the sim's invariants intact on every tick. Before the idle rule (MissionDef.idle) missions 1004, 1005, 1009 and 1010
 * had states that never ended: an enemy scripted to Hold, or one too weak to come out against the army left behind.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { MissionDef } from '../../src/data/schema';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { createBattle, runSeries } from '../../src/sim';
import { normalPhases } from '../../src/sim/director';
import type { World } from '../../src/sim/world';
import { HEAVY, strictWatch } from './helpers';

const SEEDS = [1, 2];
/** Seconds into the phase at which the player stops. */
const STOP_AFTER = [0, 200, 500];
/** Battle minutes after the player's last command by which the battle must be over. */
const IDLE_END_MINUTES = 30;
/** Battle minutes the bot gets to reach the phase (it wins every mission inside its expected time, 30 at most). */
const REACH_MINUTES = 45;

interface Abandoned {
  /** False when the bot's battle ended before the moment he was to stop (nothing to check). */
  reached: boolean;
  over: boolean;
  winner: number;
  /** Battle minutes from his last command to the end (or to the cap). */
  minutes: number;
  phaseAtStop: string;
}

/** The bot plays `m` into phase `k` and `stopAfter` seconds on, then nobody commands side 0. */
function abandon(m: MissionDef, k: number, seed: number, stopAfter: number): Abandoned {
  const b = createBattle({ mission: m, difficulty: 'normal', seed, upgrades: {}, commanders: ['bot', 'ai'] });
  const s = b.state;
  const watch = strictWatch();
  const reachTicks = REACH_MINUTES * 60 * CONFIG.tickRate;
  let stopAt = -1;
  while (!s.over && s.tick < reachTicks) {
    if (stopAt < 0 && s.director.phase >= k) stopAt = s.tick + stopAfter * CONFIG.tickRate;
    if (stopAt >= 0 && s.tick >= stopAt) break;
    b.step();
    watch(b);
  }
  if (s.over || stopAt < 0 || s.tick < stopAt) return { reached: false, over: s.over, winner: s.winner, minutes: 0, phaseAtStop: '' };
  // The player puts the phone down: side 0's commander is gone (what the sim keeps for an idle or human side).
  (b as unknown as World).ai[0] = null;
  const t0 = s.time;
  const phaseAtStop = s.director.phaseId;
  const endTick = s.tick + IDLE_END_MINUTES * 60 * CONFIG.tickRate;
  while (!s.over && s.tick < endTick) {
    b.step();
    watch(b);
  }
  return { reached: true, over: s.over, winner: s.winner, minutes: (s.time - t0) / 60, phaseAtStop };
}

describe('a player who is playing never meets the idle rule', () => {
  // The balance suite's own battles (the bot, Normal, seeds 1..CAMPAIGN_RUNS.seeds): the counter-attack never begins in
  // any of them, so the rule changes nothing the other balance tests measure.
  it.each(STALINGRAD_MISSIONS.filter((m) => m.idle !== undefined).map((m) => [m.id, m] as const))('mission %i: the bot is never counter-attacked as idle', HEAVY, (_id, m) => {
    const r = runSeries(m, 'normal', 'bot', CAMPAIGN_RUNS.seeds, (seed) => (battle) => {
      const d = battle.state.director;
      if (d.idle || d.idleOverCap > 0) throw new Error(`mission ${m.id} seed ${seed}: the bot was counted idle at ${battle.state.time.toFixed(0)} s`);
    });
    expect(r.undecided).toBe(0);
    expect(r.runs).toHaveLength(CAMPAIGN_RUNS.seeds);
  });
});

describe.each(STALINGRAD_MISSIONS.map((m) => [m.id, m] as const))('mission %i abandoned part-way', (_id, m) => {
  const phases = normalPhases(m);
  for (let k = 1; k < phases.length; k++) {
    it(`in phase ${k + 1} (${phases[k].id}): the battle ends within ${IDLE_END_MINUTES} minutes of the last command`, HEAVY, () => {
      let checked = 0;
      for (const seed of SEEDS) {
        for (const stopAfter of STOP_AFTER) {
          const r = abandon(m, k, seed, stopAfter);
          if (!r.reached) continue;
          checked++;
          const what = `seed ${seed}, stopped ${stopAfter} s into the phase (in ${r.phaseAtStop}): ${r.over ? `ended after ${r.minutes.toFixed(1)} min` : 'still running'}`;
          expect(r.over, what).toBe(true);
          expect(r.winner === 0 || r.winner === 1, what).toBe(true);
        }
      }
      // The bot reaches every phase of every mission on these seeds: at least the stop at the phase's start is checked.
      expect(checked).toBeGreaterThanOrEqual(SEEDS.length);
    });
  }
});
