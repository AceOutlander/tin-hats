/**
 * With no extra unit installed (the website), the slot changes nothing: the kind is in no table, no nation names it,
 * and a battle told it may field one is the same battle, tick for tick (docs/PLATFORM.md, "The extra unit").
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { extraUnitData, hasExtraUnit, installExtraUnit } from '../../src/data/extraUnit';
import { FACTIONS, FACTION_IDS } from '../../src/data/factions';
import { SANDBOX } from '../../src/data/missions/sandbox';
import { ONE_SHOT_NAMES } from '../../src/data/sounds';
import { UNITS, UNIT_KINDS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { platform } from '../../src/platform';
import { createBattle, summarize } from '../../src/sim';
import { MADE_UP_EXTRA } from './extra-unit-made-up';

function fingerprint(extraUnit: boolean | undefined): string {
  const battle = createBattle({ mission: SANDBOX, difficulty: 'normal', seed: 4, upgrades: {}, commanders: ['bot', 'ai'], extraUnit });
  const end = 120 * CONFIG.tickRate;
  while (battle.state.tick < end && !battle.state.over) battle.step();
  const s = battle.state;
  const xs: number[] = [];
  for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive) xs.push(s.units[i].x, s.units[i].hp);
  return JSON.stringify([summarize(battle), xs, Object.keys(s.sides[0].available), Object.keys(s.sides[0].queue)]);
}

describe('no extra unit installed', () => {
  it('the website platform has none, and the slot is empty', () => {
    expect(platform.extraUnit).toBeNull();
    expect(extraUnitData()).toBeNull();
    expect(hasExtraUnit()).toBe(false);
  });

  it('the kind is in no table and no nation names it', () => {
    expect(UNIT_KINDS as string[]).not.toContain('extra');
    expect(UNIT_KINDS).toHaveLength(16);
    expect(Object.keys(UNITS)).not.toContain('extra');
    for (const id of FACTION_IDS) {
      expect(Object.keys(FACTIONS[id].unitNames)).not.toContain('extra');
      expect(Object.keys(FACTIONS[id].unitBlurbs)).not.toContain('extra');
      expect(Object.keys(FACTIONS[id].buttonNames)).not.toContain('extra');
    }
    expect(ONE_SHOT_NAMES.some((n) => Object.keys(MADE_UP_EXTRA.sounds).includes(n))).toBe(false);
    expect(Object.values(WEAPONS).some((w) => w.delivery === 'melee')).toBe(false);
    expect(Object.values(UNITS).some((u) => u.charge !== undefined || u.perBattle !== undefined)).toBe(false);
  });

  it('a battle allowed an extra unit is the same battle, tick for tick', () => {
    const plain = fingerprint(undefined);
    expect(fingerprint(true)).toBe(plain);
    expect(JSON.parse(plain)[2]).not.toContain('extra');
  });

  it('refuses a unit installed after the data was read', () => {
    expect(() => installExtraUnit(MADE_UP_EXTRA)).toThrow(/before the game data is read/);
    expect(extraUnitData()).toBeNull();
  });
});
