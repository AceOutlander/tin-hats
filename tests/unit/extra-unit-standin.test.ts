/**
 * The test stand-in for a platform's extra unit (src/platform/extraUnit.ts): a page may carry a made-up unit, and the
 * game takes it only with the debug switch. On the website's platform nothing else can ever make the unit appear.
 */
import { describe, expect, it } from 'vitest';
import { extraUnitData } from '../../src/data/extraUnit';
import { extraUnitSlot, ownsExtraUnit, standInExtraUnit, type ExtraUnitStandIn } from '../../src/platform/extraUnit';
import { MADE_UP_EXTRA } from './extra-unit-made-up';

const made: ExtraUnitStandIn = {
  data: MADE_UP_EXTRA,
  slot: {
    entitlement: 'made-up',
    art: {
      pictures: [],
      idle: { frames: ['extra/made-up/idle/0'], rate: 1 },
      move: { frames: ['extra/made-up/idle/0'], rate: 1 },
      charge: { frames: ['extra/made-up/idle/0'], rate: 1 },
      strike: { frames: ['extra/made-up/idle/0'], rate: 1 },
      death: { frames: ['extra/made-up/idle/0'], rate: 1 },
      height: 60,
      length: 30,
      reach: { x: 20, y: -40 },
      portrait: () => undefined,
    },
  },
};

describe('the stand-in extra unit', () => {
  it('is not taken without the debug switch, whatever the page carries', () => {
    for (const search of ['', '?debug=0', '?debug', '?unreleased=1', '?debug=11']) {
      standInExtraUnit(search, { __TH_EXTRA_UNIT: made });
      expect(extraUnitSlot()).toBeNull();
      expect(ownsExtraUnit()).toBe(false);
    }
  });

  it('is not taken from a page that carries none', () => {
    standInExtraUnit('?debug=1', {});
    expect(extraUnitSlot()).toBeNull();
    expect(ownsExtraUnit()).toBe(false);
  });

  it('is taken with the debug switch: installed, drawn by its own slot, and owned', () => {
    standInExtraUnit('?debug=1', { __TH_EXTRA_UNIT: made });
    expect(extraUnitSlot()).toBe(made.slot);
    expect(ownsExtraUnit()).toBe(true);
    expect(extraUnitData()).toBe(MADE_UP_EXTRA);
  });
});
