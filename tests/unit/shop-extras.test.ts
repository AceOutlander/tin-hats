/**
 * The Shop's extras (owner, 2026-11-17): the Battle for Poland is not on show until that campaign exists. One flag in
 * the data says whether it does (APP.polandExists, off); the words and the price stay, and switching the flag on
 * brings the locked entry and its "Extras" heading back.
 */
import { describe, expect, it } from 'vitest';
import { buildArmoury } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { MEDALS } from '../../src/data/medals';
import { defaultSave } from '../../src/meta';
import { armourySections } from '../../src/ui/screens/armoury';

const names = (items: ReturnType<typeof buildArmoury>): string[] => armourySections(items).map((s) => s.name);

describe("the Shop's extras", () => {
  it('the campaign does not exist yet, and the Shop shows nothing of it: no entry, no empty heading', () => {
    expect(APP.polandExists).toBe(false);
    const items = buildArmoury(defaultSave());
    expect(items.filter((i) => i.type === 'extra')).toEqual([]);
    expect(items.some((i) => i.id === 'poland')).toBe(false);
    expect(JSON.stringify(items)).not.toContain('Poland');
    expect(names(items)).toEqual(['Call-in charges', 'Core roles', 'New units']);
    // Everything else is as it was: every call-in charge, then the units.
    expect(items.filter((i) => i.type === 'support').map((i) => i.id)).toEqual(MEDALS.charges.map((c) => c.kind));
    expect(items.filter((i) => i.type === 'unit').length).toBeGreaterThan(0);
  });

  it('the words and the price are kept for the day it does', () => {
    expect(APP.polandName).toBe('Battle for Poland');
    expect(APP.polandBlurb.length).toBeGreaterThan(20);
    expect(APP.polandNote.length).toBeGreaterThan(0);
    expect(MEDALS.polandPrice).toBeGreaterThan(0);
  });

  it('switched on, the locked entry is back between the call-in charges and the units, under "Extras"', () => {
    const off = buildArmoury(defaultSave(), 'british', [], [], false);
    const on = buildArmoury(defaultSave(), 'british', [], [], true);
    const extras = on.filter((i) => i.type === 'extra');
    expect(extras).toEqual([
      {
        id: 'poland',
        type: 'extra',
        kind: 'rifle',
        name: APP.polandName,
        blurb: APP.polandBlurb,
        price: MEDALS.polandPrice,
        isNew: false,
        free: false,
        owned: false,
        canBuy: false,
        lockedNote: APP.polandNote,
      },
    ]);
    const at = on.indexOf(extras[0]);
    expect(on[at - 1].type).toBe('support');
    expect(on[at + 1].type).toBe('unit');
    // Nothing else differs.
    expect(on.filter((i) => i.type !== 'extra')).toEqual(off);
    expect(names(on)).toEqual(['Call-in charges', 'Extras', 'Core roles', 'New units']);
    expect(armourySections(on)[1].items).toEqual(extras);
  });
});
