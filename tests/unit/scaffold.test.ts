import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../../src/data/factions';
import type { UnitKind } from '../../src/data/schema';
import { DEPTH, VIEW } from '../../src/data/view';

const KINDS: UnitKind[] = ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'heavyTank'];

describe('shared data', () => {
  it('names every unit kind for both factions', () => {
    for (const faction of Object.values(FACTIONS)) {
      for (const kind of KINDS) {
        expect(faction.unitNames[kind].length).toBeGreaterThan(0);
        expect(faction.unitBlurbs[kind].length).toBeGreaterThan(0);
      }
    }
  });

  it('gives the two factions different looks', () => {
    expect(FACTIONS.british.look.helmet).not.toBe(FACTIONS.german.look.helmet);
    expect(FACTIONS.british.look.flag).toBe('unionJack');
    expect(FACTIONS.german.look.flag).toBe('balkenkreuz');
  });

  it('has one row offset and scale per depth row, drawn back to front', () => {
    expect(VIEW.rowDy.length).toBe(VIEW.rows);
    expect(VIEW.rowScale.length).toBe(VIEW.rows);
    expect(DEPTH.trenchFront).toBeGreaterThan(DEPTH.unitRow0 + VIEW.rows - 1);
    expect(DEPTH.rain).toBeGreaterThan(DEPTH.foreground);
  });
});
