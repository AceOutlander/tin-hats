/**
 * Medals, upgrade points and call-in charges across the campaign (owner, 2026-11-09: the economy pegged to Stick War:
 * Legacy, docs/campaigns/economy-benchmark-research.json; DECISIONS 411 to 419). The reasonable-player bot clears the
 * campaign (Stalingrad) in order on Normal without replays, starting from a fresh save, as a player gets each mission:
 * the units every reached mission unlocks (unitsUnlocked; the data's progression, MEDALS.missions[id].expects, must be
 * covered without a loan) and only the call-in charges the save holds and the mission lends, spent one per call. After
 * each win it buys the cheap charges a careful player would (smoke and artillery). The checks are the benchmark's
 * proportions, missions of play per purchase: a first clear pays about one cheap call-in, the big ones cost about a
 * campaign, a Normal run's upgrade points buy about half the Quartermaster, and Poland takes a few campaigns' play.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DIFFICULTY_LIST } from '../../src/data/difficulty';
import { MEDALS } from '../../src/data/medals';
import { MISSIONS } from '../../src/data/missions';
import type { SupportKind, UnitKind } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import { addCharges, applyRoster, buyCharge, buyUpgrade, defaultSave, isUnlocked, levelCost, missionRoster, recordClear, recordWin, unitsUnlocked, upgradeLevel } from '../../src/meta';
import { createBattle } from '../../src/sim';
import { HEAVY } from './helpers';

const SEED = 1;
const CAP_MINUTES = 30;

interface Step {
  mission: number;
  unlocked: UnitKind[];
  missing: UnitKind[];
  loaned: UnitKind[];
  /** Call-ins brought and the charges of each. */
  charges: Partial<Record<SupportKind, number>>;
  /** Charges the bot spent. */
  used: number;
  won: boolean;
  earned: number;
  bonus: number;
  points: number;
}

const ids = MISSIONS.map((m) => m.id);
const price = (kind: SupportKind): number => MEDALS.charges.find((c) => c.kind === kind)?.price ?? 0;
/** Every Quartermaster level there is. */
const ALL_LEVELS = UPGRADES.reduce((n, d) => n + d.levels.length, 0);

function campaign(): { steps: Step[]; medals: number; points: number; earnedTotal: number } {
  const save = defaultSave();
  const steps: Step[] = [];
  let earnedTotal = 0;
  for (const m of MISSIONS) {
    const unlocked = unitsUnlocked(save, MISSIONS, (id) => isUnlocked(save, ids, id));
    const roster = missionRoster(save, m, unlocked);
    const loaned = roster.loans.map((l) => l.kind);
    // Sappers only where the mission has money for them (a mission living on airdrops has none).
    const missing = MEDALS.missions[m.id].expects.filter((k) => !roster.units.includes(k) && (k !== 'sapper' || m.units[0].includes('sapper')));
    const battle = createBattle({ mission: applyRoster(m, roster), difficulty: 'normal', seed: SEED, upgrades: {}, commanders: ['bot', 'ai'] });
    const s = battle.state;
    const maxTicks = CAP_MINUTES * 60 * CONFIG.tickRate;
    while (!s.over && s.tick < maxTicks) battle.step();
    // What the battle spent comes off the save, lent charges first (the app does it call by call).
    let used = 0;
    for (const kind of roster.supports) {
      const spent = (roster.charges[kind] ?? 0) - Math.max(0, s.sides[0].supportCharges[kind]);
      used += spent;
      addCharges(save, kind, -Math.max(0, spent - (roster.chargeLoans[kind] ?? 0)));
    }
    const won = s.over && s.winner === 0;
    let earned = 0;
    let bonus = 0;
    let points = 0;
    if (won) {
      recordClear(save, m.id, 'normal');
      const hq = s.sides[0].hq;
      const win = recordWin(save, m, 'normal', { seconds: s.time, lost: s.sides[0].stats.lost, hqFrac: hq ? hq.hp / hq.maxHp : 0 }, ids);
      earned = win.medals;
      bonus = win.campaignBonus;
      points = win.points;
      earnedTotal += earned + bonus;
      // A careful player keeps a few cheap call-ins in stock: up to three smoke and three artillery.
      for (const kind of ['artillery', 'smoke'] as const) while ((save.charges[kind] ?? 0) < 3 && buyCharge(save, kind));
    }
    steps.push({ mission: m.id, unlocked, missing, loaned, charges: { ...roster.charges }, used, won, earned, bonus, points });
    if (!won) break;
  }
  return { steps, medals: save.medals, points: save.points, earnedTotal };
}

/** Spend `points` on upgrades the way a careful player would, the cheapest level on offer first. Levels bought. */
function spendOnUpgrades(points: number): number {
  const save = defaultSave();
  save.points = points;
  let bought = 0;
  for (;;) {
    const cost = (id: string, def = UPGRADES.find((d) => d.id === id)): number => (def ? levelCost(def, upgradeLevel(save, id) + 1) : Infinity);
    const offers = UPGRADES.filter((d) => upgradeLevel(save, d.id) < d.levels.length).sort((a, b) => cost(a.id) - cost(b.id));
    const next = offers.find((d) => buyUpgrade(save, UPGRADES, d.id));
    if (!next) return bought;
    bought += 1;
  }
}

describe('medals, upgrade points and charges across the campaign on Normal, without replays', () => {
  let steps: Step[] = [];
  let earnedTotal = 0;
  let points = 0;

  it('the reasonable-player bot wins every mission with the types it has unlocked and the charges it holds', HEAVY, () => {
    const run = campaign();
    steps = run.steps;
    earnedTotal = run.earnedTotal;
    points = run.points;
    const report = steps
      .map(
        (s) =>
          `m${s.mission}: units [${s.unlocked.join(' ')}], loans [${s.loaned.join(' ')}], call-ins ${JSON.stringify(s.charges)} (${s.used} used), ` +
          `${s.won ? `won +${s.earned}${s.bonus > 0 ? ` +${s.bonus} campaign bonus` : ''}, +${s.points} points` : 'LOST'}`,
      )
      .join('\n');
    console.log(`${report}\nfirst run: ${earnedTotal} medals earned, ${run.medals} left after charges, ${points} upgrade points`);
    expect(steps.length, report).toBe(MISSIONS.length);
    expect(
      steps.every((s) => s.won),
      report,
    ).toBe(true);
  });

  it('has every type each mission design expects unlocked, with nothing on loan', () => {
    expect(steps.length).toBe(MISSIONS.length);
    for (const s of steps) {
      expect(s.missing, `mission ${s.mission}`).toEqual([]);
      expect(s.loaned, `mission ${s.mission}`).toEqual([]);
    }
  });

  it('earns between a rough and a perfect clear for every first win, and the campaign bonus once at the end', () => {
    for (const s of steps) {
      expect(s.earned, `mission ${s.mission}`).toBeGreaterThanOrEqual(MEDALS.rough);
      expect(s.earned, `mission ${s.mission}`).toBeLessThanOrEqual(MEDALS.perfect);
    }
    expect(steps.map((s) => s.bonus)).toEqual([...Array<number>(MISSIONS.length - 1).fill(0), MEDALS.campaignBonus.normal]);
    // The benchmark: about 62 gems a level over a Normal campaign with its bonus (740 over 12).
    const perMission = earnedTotal / MISSIONS.length;
    expect(perMission).toBeGreaterThanOrEqual(40);
    expect(perMission).toBeLessThanOrEqual(80);
  });

  it('prices the cheap call-ins at a mission or two of medals, the big ones at about a campaign', () => {
    const firsts = steps.map((s) => s.earned).sort((a, b) => a - b);
    const median = firsts[Math.floor(firsts.length / 2)];
    // Benchmark: a cheap spell (20 to 50 gems) is about one first-clear level; smoke after one or two missions.
    expect(price('smoke')).toBeLessThanOrEqual(2 * firsts[0]);
    expect(price('smoke') / median).toBeLessThanOrEqual(2);
    expect(price('artillery') / median).toBeLessThanOrEqual(4);
    // Mid spells (100 to 300) take 5 to 15 first clears.
    for (const kind of ['fighter', 'airStrike', 'katyusha'] as const) {
      expect(price(kind) / median, kind).toBeGreaterThanOrEqual(5);
      expect(price(kind) / median, kind).toBeLessThanOrEqual(25);
    }
    // Big summons (500 to 1,000) cost roughly a whole campaign's earnings: the bomber is worth saving up for.
    expect(price('bomber') / earnedTotal).toBeGreaterThanOrEqual(0.5);
    expect(price('bomber') / earnedTotal).toBeLessThanOrEqual(1.5);
  });

  it('buys about half the Quartermaster with a Normal run upgrade points, and all of it over three difficulties', () => {
    expect(steps.reduce((n, s) => n + s.points, 0)).toBe(MISSIONS.length * MEDALS.points.byDifficulty.normal);
    const levels = spendOnUpgrades(points);
    console.log(`a Normal run's ${points} upgrade points buy ${levels} of ${ALL_LEVELS} levels`);
    // Benchmark: one campaign's 24 points buy about 55% of its ~42 levels (up to 85% with the bonus stages).
    expect(levels / ALL_LEVELS).toBeGreaterThanOrEqual(0.4);
    expect(levels / ALL_LEVELS).toBeLessThanOrEqual(0.7);
    // Normal and Hard leave something to buy; every difficulty cleared buys every level.
    const p = MEDALS.points.byDifficulty;
    expect(MISSIONS.length * p.hard).toBeLessThan(ALL_LEVELS);
    expect(MISSIONS.length * p.insane).toBeGreaterThanOrEqual(ALL_LEVELS);
  });

  it('takes a few campaigns of play to earn the Poland unlock with medals', () => {
    // Medals by mission played: this Normal run, then the same scores on Hard and on Insane (first wins only), with
    // each campaign's bonus at its end.
    const firsts = steps.map((s) => s.earned);
    const bySeries: number[] = [];
    for (const d of DIFFICULTY_LIST) {
      for (let i = 0; i < firsts.length; i++) {
        const base = Math.round(firsts[i]);
        bySeries.push(Math.floor(base * MEDALS.difficultyMul[d] + 1e-9) + (i === firsts.length - 1 ? MEDALS.campaignBonus[d] : 0));
      }
    }
    let sum = 0;
    let missions = 0;
    while (sum < MEDALS.polandPrice && missions < bySeries.length) sum += bySeries[missions++];
    console.log(`Poland (${MEDALS.polandPrice} medals) takes ${missions} missions with no charges bought (${sum} medals by then)`);
    expect(sum).toBeGreaterThanOrEqual(MEDALS.polandPrice);
    // Benchmark: its premium items take 18 to 27 first-clear levels at the blended rate; more than one campaign, less than all.
    expect(missions).toBeGreaterThan(MISSIONS.length);
    expect(missions).toBeLessThanOrEqual(3 * MISSIONS.length);
  });
});
