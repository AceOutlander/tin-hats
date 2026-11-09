/**
 * Medals balance (owner's spec, 'Medals and the Armoury', and the change of 2026-11-09: units unlocked by missions
 * again, medals buy upgrades and plane call-ins). The reasonable-player bot clears the campaign (Stalingrad) in order on Normal
 * without replays, starting from a fresh save.
 *
 * Before each mission the player has the types every reached mission unlocks (unitsUnlocked); the progression in
 * data (MEDALS.missions[id].expects) must be covered without a loan. The bot plays the mission exactly as the player
 * gets it and its win pays medals by the score rules. With what a first run earns, the player buys upgrades, the
 * cheapest level first: a sensible set must be affordable.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MEDALS } from '../../src/data/medals';
import { MISSIONS } from '../../src/data/missions';
import type { UnitKind } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import { applyRoster, buyUpgrade, defaultSave, isUnlocked, levelCost, missionRoster, recordClear, recordWin, unitsUnlocked, upgradeLevel } from '../../src/meta';
import { createBattle } from '../../src/sim';
import { HEAVY } from './helpers';

const SEED = 1;
const CAP_MINUTES = 30;

interface Step {
  mission: number;
  unlocked: UnitKind[];
  missing: UnitKind[];
  loaned: UnitKind[];
  won: boolean;
  earned: number;
}

const ids = MISSIONS.map((m) => m.id);

function campaign(): { steps: Step[]; medals: number } {
  const save = defaultSave();
  const steps: Step[] = [];
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
    const won = s.over && s.winner === 0;
    let earned = 0;
    if (won) {
      recordClear(save, m.id, 'normal');
      const hq = s.sides[0].hq;
      earned = recordWin(save, m, 'normal', { seconds: s.time, lost: s.sides[0].stats.lost, hqFrac: hq ? hq.hp / hq.maxHp : 0 }).medals;
    }
    steps.push({ mission: m.id, unlocked, missing, loaned, won, earned });
    if (!won) break;
  }
  return { steps, medals: save.medals };
}

/** Spend `medals` on upgrades the way a careful player would, always the cheapest level on offer. Levels bought. */
function spendOnUpgrades(medals: number): number {
  const save = defaultSave();
  save.medals = medals;
  let bought = 0;
  for (;;) {
    const price = (id: string, def = UPGRADES.find((d) => d.id === id)): number => (def ? levelCost(def, upgradeLevel(save, id) + 1) : Infinity);
    const offers = UPGRADES.filter((d) => upgradeLevel(save, d.id) < d.levels.length).sort((a, b) => price(a.id) - price(b.id));
    const next = offers.find((d) => buyUpgrade(save, UPGRADES, d.id));
    if (!next) return bought;
    bought += 1;
  }
}

describe('medals across the campaign on Normal, without replays', () => {
  let steps: Step[] = [];
  let total = 0;

  it('the reasonable-player bot wins every mission with the types it has unlocked', HEAVY, () => {
    const run = campaign();
    steps = run.steps;
    total = run.medals;
    const report = steps
      .map((s) => `m${s.mission}: units [${s.unlocked.join(' ')}], loans [${s.loaned.join(' ')}], ${s.won ? `won +${s.earned}` : 'LOST'}`)
      .join('\n');
    console.log(`${report}\nfirst run total: ${total} medals`);
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

  it('earns between a rough and a perfect clear for every first win', () => {
    for (const s of steps) {
      expect(s.earned, `mission ${s.mission}`).toBeGreaterThanOrEqual(MEDALS.rough);
      expect(s.earned, `mission ${s.mission}`).toBeLessThanOrEqual(MEDALS.perfect);
    }
  });

  // Re-priced 2026-11-09: a first run on Normal buys a sensible set of upgrades (at least ten levels), but well under
  // a third of all the levels there are, so later runs and the harder difficulties still have something to buy.
  it('buys a sensible set of upgrades with a first run, but far from all of them', () => {
    const levels = spendOnUpgrades(total);
    const all = UPGRADES.reduce((n, d) => n + d.levels.length, 0);
    console.log(`first run buys ${levels} of ${all} upgrade levels`);
    expect(levels).toBeGreaterThanOrEqual(10);
    expect(levels).toBeLessThan(all / 3);
  });
});
