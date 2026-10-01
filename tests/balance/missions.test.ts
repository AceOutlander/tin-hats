/**
 * Acceptance test (c) of the balance brief: on Normal with no upgrades, every mission is won by the
 * reasonable-player bot and lost by the idle commander, in about the intended time, with the sim's
 * invariants intact on every tick of every battle (nothing NaN, no negative supplies, population
 * within the cap, every unit on the map, the lines never crossing, no unit frozen in 'move').
 *
 * Each mission is played over seeds 1..CAMPAIGN_RUNS.seeds by the bot and by the idle commander
 * against the AI (src/sim/balanceRuns.ts); a battle still running after CAMPAIGN_RUNS.capMinutes
 * is undecided.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
import { runSeries, type CommanderKind, type MissionSeries } from '../../src/sim';
import { HEAVY, strictWatch } from './helpers';

const SEEDS = CAMPAIGN_RUNS.seeds;
/** Share of seeds the bot must win. */
const MIN_WIN_RATE = 0.85;

const cache = new Map<string, MissionSeries>();
function series(m: MissionDef, commander: CommanderKind): MissionSeries {
  const key = `${m.id}:${commander}`;
  let r = cache.get(key);
  if (!r) {
    r = runSeries(m, 'normal', commander, SEEDS, () => strictWatch());
    cache.set(key, r);
  }
  return r;
}

function describeRuns(r: MissionSeries): string {
  return r.runs.map((run) => `${run.undecided ? 'U' : run.winner === 0 ? 'W' : 'L'}@${(run.seconds / 60).toFixed(1)}`).join(' ');
}

it(`plays every mission over at least twelve seeds (${SEEDS})`, () => {
  expect(SEEDS).toBeGreaterThanOrEqual(12);
});

describe.each(MISSIONS.map((m) => [m.id, m] as const))('mission %i on Normal with no upgrades', (_id, m) => {
  it(`the bot wins at least ${MIN_WIN_RATE * 100} percent of the seeds and no battle is left undecided`, HEAVY, () => {
    const r = series(m, 'bot');
    expect(r.undecided, describeRuns(r)).toBe(0);
    expect(r.winRate, describeRuns(r)).toBeGreaterThanOrEqual(MIN_WIN_RATE);
  });

  it(`the bot's median winning time lies inside the expected ${m.expectedMinutes[0]} to ${m.expectedMinutes[1]} minutes`, HEAVY, () => {
    const r = series(m, 'bot');
    expect(r.medianWinMinutes, describeRuns(r)).toBeGreaterThanOrEqual(m.expectedMinutes[0]);
    expect(r.medianWinMinutes, describeRuns(r)).toBeLessThanOrEqual(m.expectedMinutes[1]);
  });

  it('the idle commander loses every seed', HEAVY, () => {
    const r = series(m, 'idle');
    expect(r.losses, describeRuns(r)).toBe(SEEDS);
    // A survival mission is lost well before the clock would have saved it.
    if (m.timer) for (const run of r.runs) expect(run.seconds).toBeLessThan(m.timer.seconds);
  });
});

describe('the intended lengths', () => {
  const assault = MISSIONS.filter((m) => m.mode === 'assault');

  it('run from about 3 to 4 minutes for mission 1 to about 12 to 15 for mission 10', () => {
    const first = MISSIONS[0];
    const last = MISSIONS[MISSIONS.length - 1];
    expect(first.id).toBe(1);
    expect(last.id).toBe(10);
    expect(first.expectedMinutes[0]).toBeGreaterThanOrEqual(2.5);
    expect(first.expectedMinutes[1]).toBeLessThanOrEqual(4.5);
    expect(last.expectedMinutes[0]).toBeGreaterThanOrEqual(11.5);
    expect(last.expectedMinutes[1]).toBeGreaterThanOrEqual(14.5);
    expect(last.expectedMinutes[1]).toBeLessThanOrEqual(15.5);
    for (const m of MISSIONS) expect(m.expectedMinutes[1], `mission ${m.id}`).toBeLessThanOrEqual(last.expectedMinutes[1]);
  });

  it('rise through the campaign: no assault mission is expected to be shorter than the one before it', () => {
    for (let i = 1; i < assault.length; i++) {
      const [a, b] = [assault[i - 1], assault[i]];
      expect(b.expectedMinutes[0], `mission ${b.id} after mission ${a.id}`).toBeGreaterThanOrEqual(a.expectedMinutes[0]);
      expect(b.expectedMinutes[1], `mission ${b.id} after mission ${a.id}`).toBeGreaterThanOrEqual(a.expectedMinutes[1]);
    }
  });

  it('match the clock of every survival mission', () => {
    for (const m of MISSIONS.filter((x) => x.mode === 'survival')) {
      const seconds = m.timer?.seconds ?? 0;
      expect(m.expectedMinutes[0] * 60, `mission ${m.id}`).toBeLessThanOrEqual(seconds);
      expect(m.expectedMinutes[1] * 60, `mission ${m.id}`).toBeGreaterThanOrEqual(seconds);
    }
  });
});
