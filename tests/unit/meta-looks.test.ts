import { describe, expect, it } from 'vitest';
import type { FactionId } from '../../src/data/schema';
import { LOOK_TRACKS, LOOK_UPGRADE, NATION_LOOKS } from '../../src/data/upgradeLooks';
import { UPGRADES } from '../../src/data/upgrades';
import { gearOf, gearSource, lookStyle, sideLooks, toStage } from '../../src/meta/looks';

const FACTIONS: FactionId[] = ['british', 'german'];

describe('upgrade looks', () => {
  it('name an existing upgrade for every look track', () => {
    for (const t of LOOK_TRACKS) expect(UPGRADES.some((u) => u.id === LOOK_UPGRADE[t])).toBe(true);
  });

  it('give every nation four stages per track and an enemy stage in range', () => {
    for (const f of FACTIONS) {
      const n = NATION_LOOKS[f];
      for (const t of LOOK_TRACKS) {
        expect(n[t]).toHaveLength(4);
        expect(n.enemy[t]).toBeGreaterThanOrEqual(0);
        expect(n.enemy[t]).toBeLessThanOrEqual(3);
      }
    }
  });

  it('follow each upgrade level, 0 with nothing bought', () => {
    const none = sideLooks('british', {});
    for (const t of LOOK_TRACKS) expect(none.stage[t]).toBe(0);
    expect(lookStyle(none, 'hq')).toBe('tent');
    for (let level = 0; level <= 3; level++) {
      const looks = sideLooks('british', { hqHealth: level, hqGun: level, hqIncome: level, sapperDrill: level });
      for (const t of LOOK_TRACKS) expect(looks.stage[t]).toBe(level);
      expect(lookStyle(looks, 'hq')).toBe(NATION_LOOKS.british.hq[level]);
    }
    expect(lookStyle(sideLooks('british', { hqHealth: 3 }), 'hq')).toBe('bunkerBritish');
  });

  it('show the enemy its established positions and no gear', () => {
    for (const f of FACTIONS) {
      const looks = sideLooks(f, null);
      for (const t of LOOK_TRACKS) expect(looks.stage[t]).toBe(NATION_LOOKS[f].enemy[t]);
      expect(looks.gear).toEqual({});
      expect(gearOf(looks, 'rifle')).toEqual({ health: 0, damage: 0 });
    }
  });

  it('read unit gear from the health and damage upgrades, healing counting as damage', () => {
    const looks = sideLooks('british', { rifleHealth: 2, rifleDamage: 1, medicHealing: 3, tankHealth: 1 });
    expect(gearOf(looks, 'rifle')).toEqual({ health: 2, damage: 1 });
    expect(gearOf(looks, 'medic')).toEqual({ health: 0, damage: 3 });
    expect(gearOf(looks, 'tank')).toEqual({ health: 1, damage: 0 });
    expect(gearOf(looks, 'lmg')).toEqual({ health: 0, damage: 0 });
    for (const def of UPGRADES) {
      if (def.unit === null || def.unit === 'sapper') expect(gearSource(def)).toBeNull();
      else expect(gearSource(def)).not.toBeNull();
    }
  });

  it('treat odd saved levels as a stage from 0 to 3', () => {
    expect(toStage(undefined)).toBe(0);
    expect(toStage(Number.NaN)).toBe(0);
    expect(toStage(-2)).toBe(0);
    expect(toStage(2.7)).toBe(2);
    expect(toStage(9)).toBe(3);
  });
});
