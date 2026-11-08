import { describe, expect, it } from 'vitest';
import type { UpgradeDef } from '../../src/data/schema';
import {
  buyUpgrade,
  canBuy,
  defaultSave,
  isCleared,
  isUnlocked,
  nextMissionId,
  pointsAvailable,
  pointsEarned,
  pointsSpent,
  recordClear,
  refundAll,
  refundUpgrade,
  upgradeLevel,
} from '../../src/meta';

const IDS = [1, 2, 3];

const DEFS: UpgradeDef[] = [
  {
    id: 'hqIncome',
    name: 'Supply lines',
    description: 'More supplies.',
    unit: null,
    levels: [[{ stat: 'hqIncome', mul: 1.1 }], [{ stat: 'hqIncome', mul: 1.2 }], [{ stat: 'hqIncome', mul: 1.3 }]],
    costPerLevel: 1,
  },
  {
    id: 'rifleHealth',
    name: 'Tougher riflemen',
    description: 'More health.',
    unit: 'rifle',
    levels: [[{ stat: 'unitHealth', unit: 'rifle', mul: 1.1 }], [{ stat: 'unitHealth', unit: 'rifle', mul: 1.2 }]],
    costPerLevel: 2,
  },
];

describe('mission unlocks', () => {
  it('opens only the first mission on a fresh save', () => {
    const save = defaultSave();
    expect(IDS.map((id) => isUnlocked(save, IDS, id))).toEqual([true, false, false]);
  });

  it('opens the next mission after a clear on any difficulty', () => {
    const save = defaultSave();
    recordClear(save, 1, 'insane');
    expect(IDS.map((id) => isUnlocked(save, IDS, id))).toEqual([true, true, false]);
    recordClear(save, 2, 'normal');
    expect(IDS.map((id) => isUnlocked(save, IDS, id))).toEqual([true, true, true]);
  });

  it('does not open a mission by clearing one further back', () => {
    const save = defaultSave();
    recordClear(save, 2, 'normal');
    expect(isUnlocked(save, IDS, 3)).toBe(true);
    expect(isUnlocked(save, IDS, 2)).toBe(false);
  });

  it('treats a mission that does not exist as locked', () => {
    expect(isUnlocked(defaultSave(), IDS, 99)).toBe(false);
  });

  it('only counts missions that exist, so a later mission added to the list follows its predecessor', () => {
    const save = defaultSave();
    recordClear(save, 1, 'normal');
    expect(isUnlocked(save, [1], 2)).toBe(false);
    expect(isUnlocked(save, [1, 2], 2)).toBe(true);
  });

  it('finds the next mission in campaign order', () => {
    expect(nextMissionId(IDS, 1)).toBe(2);
    expect(nextMissionId(IDS, 3)).toBeNull();
    expect(nextMissionId(IDS, 42)).toBeNull();
  });
});

// Since medals, a clear only marks the mission cleared; the medals of a win are paid by recordWin (meta-medals.test.ts).
describe('clearing', () => {
  it('says whether it was the first clear on any difficulty, and pays nothing itself', () => {
    const save = defaultSave();
    expect(recordClear(save, 1, 'normal')).toEqual({ firstClear: true });
    expect(recordClear(save, 1, 'hard')).toEqual({ firstClear: false });
    expect(recordClear(save, 1, 'normal')).toEqual({ firstClear: false });
    expect(save.medals).toBe(0);
    expect(pointsEarned(save, DEFS)).toBe(0);
  });

  it('remembers each difficulty separately and without duplicates', () => {
    const save = defaultSave();
    recordClear(save, 1, 'normal');
    recordClear(save, 1, 'normal');
    recordClear(save, 1, 'insane');
    expect(isCleared(save, 1, 'normal')).toBe(true);
    expect(isCleared(save, 1, 'hard')).toBe(false);
    expect(isCleared(save, 1, 'insane')).toBe(true);
    expect(isCleared(save, 1)).toBe(true);
    expect(isCleared(save, 2)).toBe(false);
    expect(save.cleared['1']).toEqual(['normal', 'insane']);
  });

});

describe('upgrades', () => {
  function richSave() {
    const save = defaultSave();
    save.medals = 6;
    return save;
  }

  it('cannot buy without medals', () => {
    const save = defaultSave();
    expect(canBuy(save, DEFS, 'hqIncome')).toBe(false);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(false);
    expect(save.upgrades).toEqual({});
  });

  it('spends medals per level and stops at the top level', () => {
    const save = richSave();
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(true);
    expect(upgradeLevel(save, 'rifleHealth')).toBe(2);
    expect(pointsSpent(save, DEFS)).toBe(4);
    expect(pointsAvailable(save)).toBe(2);
    expect(save.medals).toBe(2);
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(false);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(false);
    expect(pointsAvailable(save)).toBe(0);
  });

  it('refunds the top level for its full price, one at a time or all at once', () => {
    const save = richSave();
    buyUpgrade(save, DEFS, 'hqIncome');
    buyUpgrade(save, DEFS, 'hqIncome');
    buyUpgrade(save, DEFS, 'rifleHealth');
    expect(pointsAvailable(save)).toBe(2);
    expect(refundUpgrade(save, 'hqIncome', DEFS)).toBe(true);
    expect(upgradeLevel(save, 'hqIncome')).toBe(1);
    expect(pointsAvailable(save)).toBe(3);
    expect(refundUpgrade(save, 'nothing', DEFS)).toBe(false);
    refundAll(save, DEFS);
    expect(save.upgrades).toEqual({});
    expect(pointsAvailable(save)).toBe(6);
  });

  it('ignores levels of upgrades that no longer exist when counting spent points', () => {
    const save = richSave();
    save.upgrades = { retired: 3, hqIncome: 1 };
    expect(pointsSpent(save, DEFS)).toBe(1);
  });

  it('never reports negative medals, even for a tampered save', () => {
    const save = defaultSave();
    save.medals = -5;
    save.upgrades = { hqIncome: 3, rifleHealth: 2 };
    expect(pointsAvailable(save)).toBe(0);
  });
});
