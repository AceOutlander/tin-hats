import { describe, expect, it } from 'vitest';
import { META } from '../../src/data/meta';
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

describe('clearing and points', () => {
  it('awards the points once, on the first clear on any difficulty', () => {
    const save = defaultSave();
    expect(recordClear(save, 1, 'normal')).toEqual({ firstClear: true, pointsAwarded: META.firstClearPoints });
    expect(recordClear(save, 1, 'hard')).toEqual({ firstClear: false, pointsAwarded: 0 });
    expect(recordClear(save, 1, 'normal')).toEqual({ firstClear: false, pointsAwarded: 0 });
    expect(pointsEarned(save)).toBe(META.firstClearPoints);
    expect(META.firstClearPoints).toBe(2);
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

  it('earns points for each mission cleared', () => {
    const save = defaultSave();
    recordClear(save, 1, 'normal');
    recordClear(save, 2, 'hard');
    expect(pointsEarned(save)).toBe(4);
  });
});

describe('upgrades', () => {
  function richSave() {
    const save = defaultSave();
    recordClear(save, 1, 'normal');
    recordClear(save, 2, 'normal');
    recordClear(save, 3, 'normal');
    return save; // 6 points
  }

  it('cannot buy without points', () => {
    const save = defaultSave();
    expect(canBuy(save, DEFS, 'hqIncome')).toBe(false);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(false);
    expect(save.upgrades).toEqual({});
  });

  it('spends points per level and stops at the top level', () => {
    const save = richSave();
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(true);
    expect(upgradeLevel(save, 'rifleHealth')).toBe(2);
    expect(pointsSpent(save, DEFS)).toBe(4);
    expect(pointsAvailable(save, DEFS)).toBe(2);
    expect(buyUpgrade(save, DEFS, 'rifleHealth')).toBe(false);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(true);
    expect(buyUpgrade(save, DEFS, 'hqIncome')).toBe(false);
    expect(pointsAvailable(save, DEFS)).toBe(0);
  });

  it('refunds the top level for free, one at a time or all at once', () => {
    const save = richSave();
    buyUpgrade(save, DEFS, 'hqIncome');
    buyUpgrade(save, DEFS, 'hqIncome');
    buyUpgrade(save, DEFS, 'rifleHealth');
    expect(pointsAvailable(save, DEFS)).toBe(2);
    expect(refundUpgrade(save, 'hqIncome')).toBe(true);
    expect(upgradeLevel(save, 'hqIncome')).toBe(1);
    expect(pointsAvailable(save, DEFS)).toBe(3);
    expect(refundUpgrade(save, 'nothing')).toBe(false);
    refundAll(save);
    expect(save.upgrades).toEqual({});
    expect(pointsAvailable(save, DEFS)).toBe(pointsEarned(save));
  });

  it('ignores levels of upgrades that no longer exist when counting spent points', () => {
    const save = richSave();
    save.upgrades = { retired: 3, hqIncome: 1 };
    expect(pointsSpent(save, DEFS)).toBe(1);
  });

  it('never reports negative points, even for a tampered save', () => {
    const save = defaultSave();
    save.upgrades = { hqIncome: 3, rifleHealth: 2 };
    expect(pointsAvailable(save, DEFS)).toBe(0);
  });
});
