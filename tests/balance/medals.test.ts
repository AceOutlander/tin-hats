/**
 * Medals balance (owner's spec, 'Medals and the Armoury'): the reasonable-player bot clears the campaign in order on
 * Normal without replays, starting from a fresh save, and earns enough medals to afford a sensible army progression.
 *
 * The progression is data (MEDALS.missions[id].expects): the types each mission's design expects the player to own
 * when it starts. Before each mission the player buys, in Armoury order, every expected type it can afford; whatever
 * it still lacks must be covered by that mission's loans. The bot then plays the mission exactly as the player would
 * get it (the Armoury roster with the loans) and its win pays medals by the score rules.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MEDALS } from '../../src/data/medals';
import { MISSIONS } from '../../src/data/missions';
import type { UnitKind } from '../../src/data/schema';
import {
  applyRoster,
  buyItem,
  defaultSave,
  missionRoster,
  ownsItem,
  recordClear,
  recordWin,
} from '../../src/meta';
import { createBattle } from '../../src/sim';
import { HEAVY } from './helpers';

const SEED = 1;
const CAP_MINUTES = 30;

interface Step {
  mission: number;
  medalsBefore: number;
  bought: string[];
  missing: UnitKind[];
  loaned: UnitKind[];
  won: boolean;
  earned: number;
}

function campaign(): Step[] {
  const save = defaultSave();
  const steps: Step[] = [];
  for (const m of MISSIONS) {
    const medalsBefore = save.medals;
    const bought: string[] = [];
    const def = MEDALS.missions[m.id];
    for (const item of MEDALS.armoury) {
      if (
        def.expects.includes(item.id as UnitKind) &&
        !ownsItem(save, item.id) &&
        buyItem(save, item.id)
      )
        bought.push(item.id);
    }
    const roster = missionRoster(save, m);
    const loaned = roster.loans.map((l) => l.kind);
    const missing = def.expects.filter(
      (k) => !ownsItem(save, k) && !loaned.includes(k),
    );
    const battle = createBattle({
      mission: applyRoster(m, roster),
      difficulty: 'normal',
      seed: SEED,
      upgrades: {},
      commanders: ['bot', 'ai'],
    });
    const s = battle.state;
    const maxTicks = CAP_MINUTES * 60 * CONFIG.tickRate;
    while (!s.over && s.tick < maxTicks) battle.step();
    const won = s.over && s.winner === 0;
    let earned = 0;
    if (won) {
      recordClear(save, m.id, 'normal');
      const hq = s.sides[0].hq;
      earned = recordWin(save, m, 'normal', {
        seconds: s.time,
        lost: s.sides[0].stats.lost,
        hqFrac: hq ? hq.hp / hq.maxHp : 0,
      }).medals;
    }
    steps.push({
      mission: m.id,
      medalsBefore,
      bought,
      missing,
      loaned,
      won,
      earned,
    });
    if (!won) break;
  }
  return steps;
}

describe('medals across the campaign on Normal, without replays', () => {
  let steps: Step[] = [];

  it(
    'the reasonable-player bot wins every mission with the army it can afford',
    HEAVY,
    () => {
      steps = campaign();
      const report = steps
        .map(
          (s) =>
            `m${s.mission}: had ${s.medalsBefore}, bought [${s.bought.join(' ')}], loans [${s.loaned.join(' ')}], ${s.won ? `won +${s.earned}` : 'LOST'}`,
        )
        .join('\n');
      expect(steps.length, report).toBe(MISSIONS.length);
      expect(
        steps.every((s) => s.won),
        report,
      ).toBe(true);
    },
  );

  it('owns, or has on loan, every type each mission design expects', () => {
    expect(steps.length).toBe(MISSIONS.length);
    for (const s of steps)
      expect(s.missing, `mission ${s.mission}`).toEqual([]);
  });

  it('earns between a rough and a perfect clear for every first win', () => {
    for (const s of steps) {
      expect(s.earned, `mission ${s.mission}`).toBeGreaterThanOrEqual(
        MEDALS.rough,
      );
      expect(s.earned, `mission ${s.mission}`).toBeLessThanOrEqual(
        MEDALS.perfect,
      );
    }
  });

  // The owner raised troop prices to 3x the original and cut a win to 3..30 medals (2026-11-08), so a first run through
  // the campaign buys little; missions lend what their design expects (MEDALS.autoLoanCount). A progression is still
  // required: the player can buy at least one type with medals from a first run.
  it('buys at least one new type during a first run through the campaign', () => {
    const bought = steps.flatMap((s) => s.bought);
    expect(new Set(bought).size, bought.join(' ')).toBeGreaterThanOrEqual(1);
  });
});
