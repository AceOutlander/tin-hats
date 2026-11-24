/**
 * Cosmetics in data and in the save (src/data/cosmetics.ts, src/meta/cosmetics.ts): the items are well formed and, for
 * now, placeholders only; the switch is off; owning and wearing; and the save's block, checked on the way in.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COSMETICS, RARITIES, RARITY_ORDER, UNIT_GROUPS, type Rarity } from '../../src/data/cosmetics';
import { FACTION_IDS } from '../../src/data/factions';
import { UNIT_KINDS } from '../../src/data/units';
import {
  cosmeticItem,
  cosmeticsOf,
  defaultSave,
  giveItem,
  isWorn,
  itemSlots,
  itemsOfRarity,
  ownsItem,
  resolveWorn,
  sanitizeSave,
  takeOffItem,
  wearItem,
  wornAt,
  type SaveData,
} from '../../src/meta';

const ART = resolve(import.meta.dirname, '..', '..', 'src', 'cosmetics', 'art');
const HEX = /^#[0-9a-f]{6}$/;
const CRATE_TIERS: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

describe('the cosmetics data', () => {
  it('is switched off: nothing of crates or the Appearance tab shows until the owner\'s designs are in', () => {
    expect(COSMETICS.enabled).toBe(false);
  });

  it('names eight rarities, lowest first, each with a word and a mark that is not its colour', () => {
    expect(RARITY_ORDER).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret', 'special']);
    expect(RARITY_ORDER.map((r) => RARITIES[r].name)).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', '???', 'Special']);
    for (const r of RARITY_ORDER) expect(RARITIES[r].colour).toMatch(HEX);
    expect(new Set(RARITY_ORDER.map((r) => RARITIES[r].colour)).size).toBe(8);
    expect(new Set(RARITY_ORDER.map((r) => RARITIES[r].marks)).size).toBe(8);
    // Special never comes from a crate.
    expect(RARITY_ORDER.filter((r) => !RARITIES[r].inCrates)).toEqual(['special']);
  });

  it('every item has an id of its own, and a stand-in is marked as one wherever a player could meet it', () => {
    const ids = COSMETICS.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of COSMETICS.items) {
      expect(item.id).toMatch(COSMETICS.idPattern);
      expect(cosmeticItem(item.id)).toBe(item);
      expect(item.name.trim().length, item.id).toBeGreaterThan(0);
      // Marked in the data, in the id, in the name and in the line under it: or in none of them.
      const standIn = item.placeholder === true;
      expect(item.id.startsWith('placeholder-'), item.id).toBe(standIn);
      expect(/^Placeholder /.test(item.name), item.id).toBe(standIn);
      expect(/placeholder/i.test(item.blurb), item.id).toBe(standIn);
    }
  });

  it('the switch stays off while a stand-in is in the list: players never see a placeholder', () => {
    const standIns = COSMETICS.items.filter((i) => i.placeholder === true);
    expect(COSMETICS.enabled && standIns.length > 0).toBe(false);
  });

  it('the stand-ins are enough to try a set of every crate tier, a Special, and nothing for "???"', () => {
    const standIns = COSMETICS.items.filter((i) => i.placeholder === true);
    // Until the owner's designs replace them (docs/COSMETICS_GUIDE.md): two of each tier a crate holds, one Special.
    expect(standIns.length).toBeGreaterThan(0);
    for (const r of CRATE_TIERS) expect(itemsOfRarity(r, standIns).length, r).toBeGreaterThanOrEqual(2);
    expect(itemsOfRarity('special', standIns).length).toBeGreaterThanOrEqual(1);
    // The "???" item is the owner's to design; none stands in for it.
    expect(itemsOfRarity('secret', standIns)).toEqual([]);
  });

  it('every item names real nations and units, and a look the renderer can draw', () => {
    for (const item of COSMETICS.items) {
      const t = item.target;
      if (t.nations !== 'all') for (const n of t.nations) expect(FACTION_IDS, item.id).toContain(n);
      if (typeof t.units !== 'string') for (const u of t.units) expect(UNIT_KINDS, item.id).toContain(u);
      expect(itemSlots(item).length, item.id).toBeGreaterThan(0);
      const look = item.look;
      for (const rc of look.recolours ?? []) {
        expect(rc.colour, item.id).toMatch(HEX);
        expect(rc.strength > 0 && rc.strength <= 1, item.id).toBe(true);
        if (rc.pattern) {
          expect(rc.pattern.colour, item.id).toMatch(HEX);
          expect(rc.pattern.size > 0 && rc.pattern.cover > 0 && rc.pattern.cover < 1, item.id).toBe(true);
        }
      }
      for (const img of look.images ?? []) {
        expect(img.file, item.id).toMatch(/^[a-z0-9-]+\.(svg|png)$/);
        expect(existsSync(join(ART, img.file)), `${item.id}: ${img.file}`).toBe(true);
        expect(img.w > 0 && img.h > 0, item.id).toBe(true);
      }
      for (const glow of look.glows ?? []) {
        expect(glow.colour, item.id).toMatch(HEX);
        expect(glow.alpha > 0 && glow.alpha <= 1 && glow.size > 0, item.id).toBe(true);
        // A pulse is slow: far under three swells a second.
        expect(glow.pulse, item.id).toBeLessThanOrEqual(1);
      }
      expect((look.images?.length ?? 0) + (look.glows?.length ?? 0), item.id).toBeLessThanOrEqual(COSMETICS.maxOverlays);
    }
  });

  it('every picture in the art folder is used, states its size, and a stand-in picture says it is one', () => {
    const users = new Map<string, boolean[]>();
    for (const item of COSMETICS.items) for (const img of item.look.images ?? []) users.set(img.file, [...(users.get(img.file) ?? []), item.placeholder === true]);
    const files = readdirSync(ART);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file, file).toMatch(/^[a-z0-9-]+\.(svg|png)$/);
      expect(users.has(file), `${file} is used by no item`).toBe(true);
      // A stand-in picture is named and marked as one, and only stand-in items use it.
      const standIn = file.startsWith('placeholder-');
      expect(users.get(file)?.every((p) => p === standIn), file).toBe(true);
      if (!file.endsWith('.svg')) continue;
      const text = readFileSync(join(ART, file), 'utf8');
      expect(/PLACEHOLDER/.test(text), file).toBe(standIn);
      // A picture states its own size, so every browser can draw it; and it brings no script and no linked file.
      expect(text, file).toMatch(/<svg[^>]*\swidth="\d+"[^>]*\sheight="\d+"[^>]*\sviewBox="/);
      expect(text, file).not.toMatch(/<script|<image|href=|<text|<foreignObject/i);
    }
  });

  it('the unit groups name real kinds, and never the platform\'s extra unit', () => {
    for (const kinds of Object.values(UNIT_GROUPS)) {
      for (const k of kinds) expect(UNIT_KINDS).toContain(k);
      expect(kinds as readonly string[]).not.toContain('extra');
    }
  });
});

describe('owning and wearing', () => {
  it('an item is given once, and only one this build knows', () => {
    const save = defaultSave();
    expect(giveItem(save, 'placeholder-common-1')).toBe(true);
    expect(giveItem(save, 'placeholder-common-1')).toBe(false);
    expect(giveItem(save, 'no-such-item')).toBe(false);
    expect(ownsItem(save, 'placeholder-common-1')).toBe(true);
    expect(cosmeticsOf(save).owned).toEqual(['placeholder-common-1']);
  });

  it('only what is owned can be worn; it goes on every unit it dresses', () => {
    const save = defaultSave();
    expect(wearItem(save, 'placeholder-common-1')).toBe(false);
    expect('cosmetics' in save).toBe(false);
    giveItem(save, 'placeholder-common-1');
    expect(isWorn(save, 'placeholder-common-1')).toBe(false);
    expect(wearItem(save, 'placeholder-common-1')).toBe(true);
    expect(isWorn(save, 'placeholder-common-1')).toBe(true);
    // Riflemen and conscripts of every nation, on the player's side only.
    expect(Object.keys(cosmeticsOf(save).worn).sort()).toEqual(
      ['british', 'german', 'soviet'].flatMap((n) => [`own.${n}.conscript`, `own.${n}.rifle`]).sort(),
    );
    expect(wornAt(save, 'own', 'soviet', 'rifle')?.id).toBe('placeholder-common-1');
    expect(wornAt(save, 'enemy', 'soviet', 'rifle')).toBeNull();
    expect(wornAt(save, 'own', 'soviet', 'lmg')).toBeNull();
  });

  it('one item per unit: a second one takes over the units both dress, and taking one off leaves the other', () => {
    const save = defaultSave();
    giveItem(save, 'placeholder-common-1');
    giveItem(save, 'placeholder-common-2');
    wearItem(save, 'placeholder-common-1');
    wearItem(save, 'placeholder-common-2');
    // C2 dresses all infantry, so it took the riflemen from C1.
    expect(wornAt(save, 'own', 'soviet', 'rifle')?.id).toBe('placeholder-common-2');
    expect(isWorn(save, 'placeholder-common-1')).toBe(false);
    wearItem(save, 'placeholder-common-1');
    expect(wornAt(save, 'own', 'soviet', 'rifle')?.id).toBe('placeholder-common-1');
    expect(wornAt(save, 'own', 'soviet', 'medic')?.id).toBe('placeholder-common-2');
    expect(takeOffItem(save, 'placeholder-common-1')).toBe(true);
    expect(takeOffItem(save, 'placeholder-common-1')).toBe(false);
    expect(wornAt(save, 'own', 'soviet', 'rifle')).toBeNull();
    expect(wornAt(save, 'own', 'soviet', 'medic')?.id).toBe('placeholder-common-2');
  });

  it('a battle is told what each side wears: the player\'s own items on side 0, the enemy items on side 1', () => {
    const save = defaultSave();
    expect(resolveWorn(save, ['soviet', 'german'])).toBeNull();
    for (const id of ['placeholder-common-1', 'placeholder-uncommon-2', 'placeholder-epic-1', 'placeholder-mythic-2']) {
      giveItem(save, id);
      wearItem(save, id);
    }
    const worn = resolveWorn(save, ['soviet', 'german']);
    expect(worn?.sides[0].get('rifle')?.id).toBe('placeholder-common-1');
    expect(worn?.sides[0].get('sniper')?.id).toBe('placeholder-mythic-2');
    expect(worn?.sides[0].get('hq')?.id).toBe('placeholder-epic-1');
    expect(worn?.sides[0].has('medic')).toBe(false);
    expect(worn?.sides[1].get('rifle')?.id).toBe('placeholder-uncommon-2');
    expect(worn?.sides[1].has('hq')).toBe(false);
    // A British player's sniper does not wear the Soviet-only item.
    expect(resolveWorn(save, ['british', 'german'])?.sides[0].has('sniper')).toBe(false);
    // An enemy the items are not for: nothing on side 1.
    expect(resolveWorn(save, ['soviet', 'british'])?.sides[1].size).toBe(0);
  });
});

describe('the save\'s cosmetics block', () => {
  const round = (save: SaveData): SaveData => sanitizeSave(JSON.parse(JSON.stringify(save))) as SaveData;

  it('is absent from a fresh save and from one that has none, so such a save is stored as it always was', () => {
    expect('cosmetics' in defaultSave()).toBe(false);
    expect('cosmetics' in round(defaultSave())).toBe(false);
    expect('cosmetics' in round({ ...defaultSave(), cosmetics: { owned: [], worn: {}, crates: {}, opened: {}, since: {}, seed: 55, freeGiven: 0 } })).toBe(false);
    expect(round(defaultSave())).toEqual(defaultSave());
  });

  it('comes back as it was written', () => {
    const save = defaultSave();
    giveItem(save, 'placeholder-rare-1');
    wearItem(save, 'placeholder-rare-1');
    save.cosmetics = { ...cosmeticsOf(save), crates: { standard: 2, elite: 1 }, opened: { standard: 9 }, since: { standard: { rare: 3, legendary: 9 }, premium: { epic: 4 } }, seed: 123, freeGiven: 3 };
    expect(round(save).cosmetics).toEqual(save.cosmetics);
  });

  it('keeps ids another build may know, and drops what cannot be true', () => {
    const doc = {
      ...defaultSave(),
      cosmetics: {
        owned: ['placeholder-rare-1', 'placeholder-rare-1', 'a-future-item', 'Bad Id', 7, ''],
        worn: { 'own.soviet.rifle': 'placeholder-rare-1', 'own.soviet.lmg': 'not-owned', 'nonsense': 'placeholder-rare-1', 'own.soviet.hq': 'a-future-item' },
        crates: { standard: 2.5, premium: -1, elite: 5000, god: 3, nope: 1 },
        opened: { standard: 4, titan: 'x' },
        since: { standard: { rare: 99, legendary: 0, epic: 2 }, elite: { epic: 1 } },
        seed: -4,
        freeGiven: 2,
      },
    };
    const c = sanitizeSave(JSON.parse(JSON.stringify(doc)))?.cosmetics;
    expect(c).toEqual({
      owned: ['placeholder-rare-1', 'a-future-item'],
      worn: { 'own.soviet.rifle': 'placeholder-rare-1', 'own.soviet.hq': 'a-future-item' },
      crates: { elite: 999 },
      opened: { standard: 4 },
      since: { standard: { rare: 4 } },
      seed: 0,
      freeGiven: 2,
    });
    // An item this build does not know is kept but dresses nothing.
    const save = sanitizeSave(JSON.parse(JSON.stringify(doc))) as SaveData;
    expect(wornAt(save, 'own', 'soviet', 'hq')).toBeNull();
    expect(wornAt(save, 'own', 'soviet', 'rifle')?.id).toBe('placeholder-rare-1');
    for (const junk of ['x', 5, null, []]) expect('cosmetics' in (sanitizeSave(JSON.parse(JSON.stringify({ ...defaultSave(), cosmetics: junk }))) ?? {})).toBe(false);
  });
});
