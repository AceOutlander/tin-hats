/**
 * Acceptance test (c) of the balance brief, over the game's campaign missions (Stalingrad, 1001 to 1010, since the
 * British placeholders were removed): on Normal with no upgrades, every mission is won by the reasonable-player bot and
 * lost by the idle commander, in about the intended time, with the sim's invariants intact on every tick of every
 * battle (nothing NaN, no negative supplies, population within the cap, every unit on the map, the lines never
 * crossing, no unit frozen in 'move').
 *
 * Each mission is played over seeds 1..CAMPAIGN_RUNS.seeds by the bot and by the idle commander against the AI
 * (src/sim/balanceRuns.ts); a battle still running after CAMPAIGN_RUNS.capMinutes is undecided. The bot plays the
 * mission's own unit list, which is what a player has unlocked by then playing the campaign in order (checked in
 * tests/balance/stalingrad-m1001-1005.test.ts). These per-mission checks ran on the ten British missions before; they
 * replace the 1001 to 1005 copies in that file.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { MISSIONS } from '../../src/data/missions';
import { PREP } from '../../src/data/prep';
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

/** Battle seconds of a mission's prep phase (it runs before the mission clock starts). */
function prepSeconds(m: MissionDef): number {
  return m.prep ? (m.prep.seconds ?? PREP.defaultSeconds) : 0;
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
    // A survival mission is lost well before the clock (which starts after any prep phase) would have saved it.
    if (m.timer) for (const run of r.runs) expect(run.seconds).toBeLessThan(m.timer.seconds + prepSeconds(m));
  });
});

describe('the intended lengths', () => {
  // FOUNDATIONS.md section 9 (4): most missions run 15 to 30 minutes on Normal for the reasonable bot, tutorials and
  // specials 8 to 15. (The British placeholders ran 3 to 15 minutes and grew mission by mission; the Stalingrad
  // campaign is long from the start.)
  it('lie between 8 and 30 minutes for every mission, the window the right way round', () => {
    for (const m of MISSIONS) {
      expect(m.expectedMinutes[0], `mission ${m.id}`).toBeGreaterThanOrEqual(8);
      expect(m.expectedMinutes[1], `mission ${m.id}`).toBeLessThanOrEqual(30);
      expect(m.expectedMinutes[0], `mission ${m.id}`).toBeLessThan(m.expectedMinutes[1]);
    }
  });

  it('reach 15 minutes or more for most missions', () => {
    const long = MISSIONS.filter((m) => m.expectedMinutes[1] >= 15);
    expect(long.length).toBeGreaterThan(MISSIONS.length / 2);
  });

  it('match the clock of every survival mission (with its prep phase)', () => {
    for (const m of MISSIONS.filter((x) => x.mode === 'survival')) {
      const seconds = m.timer?.seconds ?? 0;
      expect(m.expectedMinutes[0] * 60, `mission ${m.id}`).toBeLessThanOrEqual(seconds + prepSeconds(m));
      expect(m.expectedMinutes[1] * 60, `mission ${m.id}`).toBeGreaterThanOrEqual(seconds);
    }
  });
});
