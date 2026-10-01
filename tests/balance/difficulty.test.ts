/**
 * The difficulty gradient: the reasonable-player bot does no better on Hard than on Normal and no
 * better on Insane than on Hard, and Insane is clearly harder than Normal on most missions. The
 * difficulties change only the AI's income, aggression, think interval, wave strength and army size
 * (tests/unit/sim-difficulty.test.ts proves they never touch unit stats).
 *
 * Every mission is played by the bot against the AI over seeds 1..CAMPAIGN_RUNS.seeds on each
 * difficulty (src/sim/balanceRuns.ts).
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { DIFFICULTY_LIST } from '../../src/data/difficulty';
import { MISSIONS } from '../../src/data/missions';
import type { Difficulty, MissionDef } from '../../src/data/schema';
import { runSeries, type MissionSeries } from '../../src/sim';

const SEEDS = CAMPAIGN_RUNS.seeds;
/** Win rates this close count as the same (two seeds of sixteen). */
const RATE_TOLERANCE = 0.13;
/** Median winning times within this fraction of each other count as the same. */
const TIME_TOLERANCE = 0.1;
/** Insane is clearly harder than Normal with a win rate this much lower... */
const CLEAR_RATE = 0.15;
/** ...or a median winning time this many times as long. */
const CLEAR_TIME = 1.2;
/** Missions on which Insane must be clearly harder than Normal. */
const CLEARLY_HARDER_MIN = 7;

const cache = new Map<string, MissionSeries>();
function series(m: MissionDef, difficulty: Difficulty): MissionSeries {
  const key = `${m.id}:${difficulty}`;
  let r = cache.get(key);
  if (!r) {
    r = runSeries(m, difficulty, 'bot', SEEDS);
    cache.set(key, r);
  }
  return r;
}

function show(r: MissionSeries): string {
  return `${r.difficulty} ${Math.round(r.winRate * 100)}% in ${r.medianWinMinutes.toFixed(1)} min`;
}

/**
 * The bot did better in `a` than in `b`: a clearly higher win rate, or about the same win rate with
 * clearly quicker wins.
 */
function didBetter(a: MissionSeries, b: MissionSeries): boolean {
  if (a.winRate > b.winRate + RATE_TOLERANCE) return true;
  const sameRate = Math.abs(a.winRate - b.winRate) <= RATE_TOLERANCE;
  return sameRate && a.medianWinMinutes < b.medianWinMinutes * (1 - TIME_TOLERANCE);
}

/** `hard` is clearly harder than `easy` for the bot: a clearly lower win rate or clearly longer wins. */
function clearlyHarder(hard: MissionSeries, easy: MissionSeries): boolean {
  if (hard.wins === 0) return easy.wins > 0;
  return hard.winRate <= easy.winRate - CLEAR_RATE || hard.medianWinMinutes >= easy.medianWinMinutes * CLEAR_TIME;
}

it('the difficulties come in order Normal, Hard, Insane', () => {
  expect(DIFFICULTY_LIST).toEqual(['normal', 'hard', 'insane']);
});

describe.each(MISSIONS.map((m) => [m.id, m] as const))('mission %i', (_id, m) => {
  it('the bot does no better on Hard than on Normal, nor on Insane than on Hard', () => {
    const [normal, hard, insane] = DIFFICULTY_LIST.map((d) => series(m, d));
    const summary = [normal, hard, insane].map(show).join(', ');
    expect(didBetter(hard, normal), summary).toBe(false);
    expect(didBetter(insane, hard), summary).toBe(false);
  });
});

it(`Insane is clearly harder than Normal on at least ${CLEARLY_HARDER_MIN} of the ${MISSIONS.length} missions`, () => {
  const lines: string[] = [];
  let harder = 0;
  for (const m of MISSIONS) {
    const normal = series(m, 'normal');
    const insane = series(m, 'insane');
    const clear = clearlyHarder(insane, normal);
    if (clear) harder++;
    lines.push(`mission ${m.id}: ${show(normal)}, ${show(insane)}${clear ? '' : ' (not clearly harder)'}`);
  }
  expect(harder, lines.join('\n')).toBeGreaterThanOrEqual(CLEARLY_HARDER_MIN);
});

it('mission 9 on Hard is hard but possible for the bot', () => {
  const m = MISSIONS.find((x) => x.id === 9) as MissionDef;
  const normal = series(m, 'normal');
  const hard = series(m, 'hard');
  expect(hard.wins, show(hard)).toBeGreaterThan(0);
  expect(hard.winRate, `${show(normal)}, ${show(hard)}`).toBeLessThan(normal.winRate);
});
