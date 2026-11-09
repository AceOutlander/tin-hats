/**
 * Stalingrad missions 1001 to 1005 on Normal with no upgrades, played with today's engine (the phases, buildings,
 * capture points, prep phases and snow of FOUNDATIONS wait for their jobs; docs/campaigns/STALINGRAD_BUILD.md): the
 * reasonable-player bot wins at least 85 percent of the seeds in the mission's expected time, no battle is left
 * undecided, the idle commander loses every seed, and every tick of every battle keeps the sim's invariants (as
 * tests/balance/missions.test.ts does for the British campaign).
 */
import { describe, expect, it } from 'vitest';
import { PREP } from '../../src/data/prep';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { getStalingradMission } from '../../src/data/missions/stalingrad';
import type { MissionDef } from '../../src/data/schema';
import { runSeries, type CommanderKind, type MissionSeries } from '../../src/sim';
import { HEAVY, strictWatch } from './helpers';

const SEEDS = CAMPAIGN_RUNS.seeds;
const MIN_WIN_RATE = 0.85;
const IDS = [1001, 1002, 1003, 1004, 1005];

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

const MINE = IDS.map((id) => {
  const m = getStalingradMission(id);
  if (!m) throw new Error(`mission ${id} missing`);
  return [id, m] as const;
});

describe.each(MINE)('Stalingrad mission %i on Normal with no upgrades', (_id, m) => {
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
    // Battle seconds: a prep phase runs before the mission clock starts.
    const prep = m.prep ? (m.prep.seconds ?? PREP.defaultSeconds) : 0;
    if (m.timer) for (const run of r.runs) expect(run.seconds).toBeLessThan(m.timer.seconds + prep);
  });
});
