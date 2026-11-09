/**
 * Training buttons are narrow: every trainable kind's label must fit without being cut off ("FLAMETHR" in a playtest,
 * owner 2026-11-08), while the full name stays available for the details and the screen reader.
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../../src/data/factions';
import type { FactionId } from '../../src/data/schema';
import { UNIT_KINDS, UNITS } from '../../src/data/units';
import { shortName } from '../../src/ui/hud/format';

/** The widest label (in capitals) that fits a training button at phone size. */
const FITS = 9;
const NAME_CHARS = 10;

describe('training button labels', () => {
  for (const f of Object.keys(FACTIONS) as FactionId[]) {
    it(`fit the button for every trainable ${f} kind`, () => {
      const faction = FACTIONS[f];
      for (const kind of UNIT_KINDS) {
        if (!UNITS[kind].trainable) continue;
        const label = shortName(faction.buttonNames[kind] ?? faction.unitNames[kind], NAME_CHARS);
        expect(label.length, `${f} ${kind}: "${label}"`).toBeLessThanOrEqual(FITS);
      }
    });
  }

  it('use the short labels the owner asked for, keeping the full names', () => {
    const b = FACTIONS.british;
    expect(b.buttonNames.flame).toBe('Flamer');
    expect(b.buttonNames.commander).toBe('Lt.');
    expect(b.unitNames.flame).toBe('Flamethrower');
    expect(b.unitNames.commander).toBe('Lieutenant');
  });
});
