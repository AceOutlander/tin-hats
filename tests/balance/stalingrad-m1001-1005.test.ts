/**
 * Stalingrad missions 1001 to 1005 on Normal with no upgrades, played with today's engine (the phases, buildings,
 * capture points, prep phases and snow of FOUNDATIONS wait for their jobs; docs/campaigns/STALINGRAD_BUILD.md): the
 * reasonable-player bot wins at least 85 percent of the seeds in the mission's expected time, no battle is left
 * undecided, the idle commander loses every seed, and every tick of every battle keeps the sim's invariants (as
 * tests/balance/missions.test.ts does for the British campaign).
 *
 * The bot plays each mission with the mission's own unit list. Since the unlocks of v0.12.0 (DECISIONS 295) that list
 * is what the player has unlocked by then, playing the campaign in order: the first block checks the player's roster
 * covers everything the bot trains, with no Armoury loan, so these runs are the battles a player gets.
 */
import { describe, expect, it } from 'vitest';
import { PREP } from '../../src/data/prep';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { getStalingradMission, STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { MissionDef } from '../../src/data/schema';
import { defaultSave, isUnlocked, missionRoster, recordClear, unitsUnlocked } from '../../src/meta';
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

describe('the Stalingrad campaign played in order from a fresh save', () => {
  it('gives the player, unlocked by then, every type the bot trains and the mission lists, with nothing on loan', () => {
    const save = defaultSave();
    const ids = STALINGRAD_MISSIONS.map((m) => m.id);
    const report: string[] = [];
    for (const m of STALINGRAD_MISSIONS) {
      const roster = missionRoster(save, m, unitsUnlocked(save, STALINGRAD_MISSIONS, (id) => isUnlocked(save, ids, id)));
      const missing = [...new Set([...m.bot.build.map((b) => b.kind), ...m.units[0]])].filter((k) => !roster.units.includes(k));
      if (missing.length > 0 || roster.loans.length > 0) report.push(`m${m.id}: missing [${missing.join(' ')}], loans [${roster.loans.map((l) => l.kind).join(' ')}]`);
      recordClear(save, m.id, 'normal');
    }
    expect(report).toEqual([]);
  });
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
