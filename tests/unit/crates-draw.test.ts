/**
 * Opening a crate (src/meta/crates.ts): the roll, the guarantees and their counters, "no duplicates until a set is
 * complete; after that, a duplicate turns into medals", buying, the crates held, the free crates and the once-only
 * grants. Every draw follows from the save alone.
 */
import { describe, expect, it } from 'vitest';
import { RARITY_ORDER, type CosmeticItem, type Rarity } from '../../src/data/cosmetics';
import { CRATES, crateDef, type CrateDef, type CrateId } from '../../src/data/crates';
import { META } from '../../src/data/meta';
import {
  addCrates,
  buyCrate,
  canBuyCrate,
  cosmeticsOf,
  crateComplete,
  crateRng,
  cratesHeld,
  defaultSave,
  freeCratesEarned,
  grantCrateOnce,
  grantItemOnce,
  guaranteeWithin,
  itemsOfRarity,
  openCrate,
  openHeld,
  rollRarity,
  sanitizeSave,
  syncFreeCrates,
  tableRarity,
  type CrateResult,
  type SaveData,
  type SinceCounters,
} from '../../src/meta';

const def = (id: CrateId): CrateDef => crateDef(id) as CrateDef;
const STANDARD = def('standard');
const PREMIUM = def('premium');
const rank = (r: Rarity): number => RARITY_ORDER.indexOf(r);
/** Made-up items: `n` of a rarity. */
const made = (rarity: Rarity, n: number): CosmeticItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t-${rarity}-${i}`, name: `T ${i}`, rarity, blurb: '', target: { side: 'own', nations: 'all', units: ['rifle'] }, look: {} }));

describe('the roll', () => {
  it('reads the table from the lowest rarity up', () => {
    expect(tableRarity(STANDARD, 0)).toBe('common');
    expect(tableRarity(STANDARD, 0.4589)).toBe('common');
    expect(tableRarity(STANDARD, 0.459)).toBe('uncommon');
    expect(tableRarity(STANDARD, 0.7589)).toBe('uncommon');
    expect(tableRarity(STANDARD, 0.759)).toBe('rare');
    expect(tableRarity(STANDARD, 0.939)).toBe('epic');
    expect(tableRarity(STANDARD, 0.989)).toBe('legendary');
    expect(tableRarity(STANDARD, 0.999)).toBe('mythic');
    expect(tableRarity(STANDARD, 0.99999999)).toBe('mythic');
    // Out of range never leaves the table.
    expect(tableRarity(STANDARD, -1)).toBe('common');
    expect(tableRarity(STANDARD, 2)).toBe('mythic');
    expect(tableRarity(def('titan'), 0.5999)).toBe('legendary');
    expect(tableRarity(def('titan'), 0.6)).toBe('mythic');
  });

  it('a guarantee pays on the crate it is due, and the counters show it coming', () => {
    const since: SinceCounters = {};
    const got: Rarity[] = [];
    for (let i = 0; i < 9; i++) got.push(rollRarity(STANDARD, since, 0).rarity);
    // Four Commons, the Rare, four Commons.
    expect(got).toEqual(['common', 'common', 'common', 'common', 'rare', 'common', 'common', 'common', 'common']);
    expect(since).toEqual({ rare: 4, legendary: 9 });
    const r = rollRarity(STANDARD, since, 0);
    expect(r).toEqual({ rarity: 'rare', guaranteed: true });
    expect(since).toEqual({ legendary: 10 });
  });

  it('a natural item of the rarity sets its counter back; a guarantee does not count as raised then', () => {
    const since: SinceCounters = { rare: 3 };
    expect(rollRarity(STANDARD, since, 0.8)).toEqual({ rarity: 'rare', guaranteed: false });
    expect(since.rare).toBeUndefined();
  });

  it('a better roll is kept when a guarantee is due, and the guarantee stays due', () => {
    const since: SinceCounters = { rare: 4 };
    expect(rollRarity(STANDARD, since, 0.95)).toEqual({ rarity: 'epic', guaranteed: false });
    expect(since.rare).toBe(4);
    expect(rollRarity(STANDARD, since, 0)).toEqual({ rarity: 'rare', guaranteed: true });
  });

  it('two guarantees due at once: the better one pays, the other with the next crate', () => {
    const since: SinceCounters = { rare: 4, legendary: 29 };
    expect(rollRarity(STANDARD, since, 0)).toEqual({ rarity: 'legendary', guaranteed: true });
    expect(since).toEqual({ rare: 4 });
    expect(rollRarity(STANDARD, since, 0).rarity).toBe('rare');
  });

  it('in any run, every 5 Standard Crates hold a Rare or better and every 30 a Legendary or better', () => {
    for (const [crate, windows] of [
      [STANDARD, [['rare', 5], ['legendary', 30]]],
      [PREMIUM, [['epic', 5], ['legendary', 15]]],
    ] as const) {
      const rng = crateRng(2026);
      const since: SinceCounters = {};
      const ranks: number[] = [];
      for (let i = 0; i < 20_000; i++) ranks.push(rank(rollRarity(crate, since, rng()).rarity));
      for (const [rarity, every] of windows) {
        let worst = 0;
        let gap = 0;
        for (const r of ranks) {
          gap = r >= rank(rarity) ? 0 : gap + 1;
          worst = Math.max(worst, gap);
        }
        // At most every - 1 crates in a row below the rarity.
        expect(worst, `${crate.id} ${rarity}`).toBeLessThanOrEqual(every - 1);
        expect(worst, `${crate.id} ${rarity}`).toBe(every - 1);
      }
    }
  });
});

describe('opening a crate', () => {
  it('is the same from the same save, and decided in the save before anything is shown', () => {
    const run = (seed: number): CrateResult[] => {
      const save = defaultSave();
      const out: CrateResult[] = [];
      for (let i = 0; i < 40; i++) out.push(openCrate(save, i % 2 ? PREMIUM : STANDARD, seed));
      return out;
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
    // A copy of a save, written and read back, opens its next crate exactly as the original does.
    const save = defaultSave();
    for (let i = 0; i < 7; i++) openCrate(save, STANDARD, 77);
    const copy = sanitizeSave(JSON.parse(JSON.stringify(save))) as SaveData;
    expect(copy.cosmetics).toEqual(save.cosmetics);
    // The seed given later is not used: the save's own draws go on.
    expect(openCrate(copy, STANDARD, 123456)).toEqual(openCrate(save, STANDARD, 77));
    const result = openCrate(save, STANDARD, 77);
    if (result.item !== null) expect(cosmeticsOf(save).owned).toContain(result.item);
    expect(cosmeticsOf(save).opened.standard).toBe(9);
  });

  it('across many saves, each one\'s first crates follow the table (no seed is luckier than another)', () => {
    const N = 120_000;
    for (const nth of [1, 2]) {
      const counts: Partial<Record<Rarity, number>> = {};
      for (let i = 0; i < N; i++) {
        const save = defaultSave();
        // Seeds spread over the whole range, the same every run.
        const seed = (Math.imul(i + 1, 2654435761) >>> 0) % 0x7fffffff;
        let r = openCrate(save, STANDARD, seed, []);
        for (let k = 1; k < nth; k++) r = openCrate(save, STANDARD, seed, []);
        counts[r.rarity] = (counts[r.rarity] ?? 0) + 1;
      }
      for (const o of STANDARD.odds) {
        const expected = (o.parts / 10_000) * N;
        expect(Math.abs((counts[o.rarity] ?? 0) - expected), `crate ${nth}, ${o.rarity}`).toBeLessThan(6 * Math.sqrt(expected) + 1);
      }
    }
  });

  it('gives no duplicate until the set of that rarity is complete, then medals', () => {
    const items = [...made('common', 3), ...made('uncommon', 2)];
    const save = defaultSave();
    const titan = def('titan');
    // A crate that only ever rolls Common, so the set is plain to follow.
    const only: CrateDef = { ...titan, id: 'standard', odds: [{ rarity: 'common', parts: 10000 }], guarantees: [] };
    const got: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = openCrate(save, only, 9, items);
      expect(r.rarity).toBe('common');
      expect(r.medals).toBe(0);
      got.push(r.item);
    }
    expect([...got].sort()).toEqual(['t-common-0', 't-common-1', 't-common-2']);
    expect(crateComplete(save, only, items)).toBe(true);
    const before = save.medals;
    const dup = openCrate(save, only, 9, items);
    expect(dup).toMatchObject({ rarity: 'common', item: null, medals: CRATES.duplicateMedals.common });
    expect(save.medals).toBe(before + CRATES.duplicateMedals.common);
    expect(cosmeticsOf(save).owned).toHaveLength(3);
  });

  it('a rarity with no item yet turns into medals too', () => {
    const save = defaultSave();
    const only: CrateDef = { ...def('titan'), odds: [{ rarity: 'mythic', parts: 10000 }] };
    expect(openCrate(save, only, 3, [])).toMatchObject({ rarity: 'mythic', item: null, medals: CRATES.duplicateMedals.mythic });
    expect(save.medals).toBe(CRATES.duplicateMedals.mythic);
  });

  it('with the placeholder items: a long run owns every crate item once, and only then pays duplicates of a rarity', () => {
    const save = defaultSave();
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = openCrate(save, i % 3 === 0 ? def('elite') : PREMIUM, 31);
      if (r.item !== null) {
        expect(seen.has(r.item), r.item).toBe(false);
        seen.add(r.item);
        expect(r.medals).toBe(0);
      } else {
        expect(itemsOfRarity(r.rarity).every((item) => seen.has(item.id)), r.rarity).toBe(true);
        expect(r.medals).toBe(CRATES.duplicateMedals[r.rarity]);
      }
    }
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const) {
      for (const item of itemsOfRarity(rarity)) expect(seen.has(item.id), item.id).toBe(true);
    }
    // Nothing of the Special rarity ever came out of a crate.
    for (const item of itemsOfRarity('special')) expect(seen.has(item.id)).toBe(false);
    expect(crateComplete(save, PREMIUM)).toBe(true);
  });

  it('the counter shown before buying is how many crates the guarantee is away', () => {
    const save = defaultSave();
    expect(guaranteeWithin(save, STANDARD, 'rare')).toBe(5);
    expect(guaranteeWithin(save, STANDARD, 'legendary')).toBe(30);
    expect(guaranteeWithin(save, STANDARD, 'epic')).toBe(0);
    save.cosmetics = { ...cosmeticsOf(save), since: { standard: { rare: 4, legendary: 12 } } };
    expect(guaranteeWithin(save, STANDARD, 'rare')).toBe(1);
    expect(guaranteeWithin(save, STANDARD, 'legendary')).toBe(18);
  });
});

describe('buying and holding', () => {
  it('takes the price in medals and opens at once; refuses when short, and the God Crate always', () => {
    const save = defaultSave();
    save.medals = 349;
    expect(canBuyCrate(save, 'standard')).toBe(false);
    expect(buyCrate(save, 'standard', 1)).toBeNull();
    expect(save).toEqual({ ...defaultSave(), medals: 349 });
    save.medals = 1400;
    const r = buyCrate(save, 'standard', 1) as CrateResult;
    expect(r.crate).toBe('standard');
    expect(save.medals).toBe(1400 - 350 + r.medals);
    expect(cosmeticsOf(save).opened.standard).toBe(1);
    save.medals = 250_000;
    expect(canBuyCrate(save, 'god')).toBe(false);
    expect(buyCrate(save, 'god', 1)).toBeNull();
    expect(buyCrate(save, 'nope', 1)).toBeNull();
    expect(save.medals).toBe(250_000);
  });

  it('a held crate is opened without medals and is then gone', () => {
    const save = defaultSave();
    expect(openHeld(save, 'standard', 4)).toBeNull();
    expect(addCrates(save, 'standard', 2)).toBe(2);
    expect(addCrates(save, 'god', 1)).toBe(0);
    const r = openHeld(save, 'standard', 4);
    expect(r).not.toBeNull();
    expect(save.medals).toBe(r?.medals ?? 0);
    expect(cratesHeld(save, 'standard')).toBe(1);
    openHeld(save, 'standard', 4);
    expect(cratesHeld(save, 'standard')).toBe(0);
    expect(cosmeticsOf(save).crates).toEqual({});
    expect(openHeld(save, 'standard', 4)).toBeNull();
    expect(addCrates(save, 'premium', 5000)).toBe(CRATES.maxHeld);
  });
});

describe('free crates', () => {
  const campaign = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010];
  const cleared = (n: number): SaveData => {
    const save = defaultSave();
    for (const id of campaign.slice(0, n)) save.cleared[String(id)] = ['normal'];
    return save;
  };

  it('one for every three missions won for the first time, and one for the campaign', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10].map((n) => freeCratesEarned(cleared(n), [campaign]))).toEqual([0, 0, 0, 1, 1, 2, 3, 4]);
    // A harder difficulty of a mission already won is not a first win.
    const save = cleared(3);
    save.cleared['1001'] = ['normal', 'hard', 'insane'];
    expect(freeCratesEarned(save, [campaign])).toBe(1);
    // About one for every three missions.
    expect(freeCratesEarned(cleared(10), [campaign]) / 10).toBeGreaterThan(0.3);
    expect(freeCratesEarned(cleared(10), [campaign]) / 10).toBeLessThan(0.5);
  });

  it('are handed out once each, as Standard Crates', () => {
    const save = cleared(7);
    expect(syncFreeCrates(save, [campaign])).toBe(2);
    expect(cratesHeld(save, 'standard')).toBe(2);
    expect(syncFreeCrates(save, [campaign])).toBe(0);
    save.cleared['1008'] = ['hard'];
    save.cleared['1009'] = ['hard'];
    expect(syncFreeCrates(save, [campaign])).toBe(1);
    expect(cratesHeld(save, 'standard')).toBe(3);
    // Opening them does not bring them back.
    openHeld(save, 'standard', 2);
    expect(syncFreeCrates(save, [campaign])).toBe(0);
    expect(cosmeticsOf(save).freeGiven).toBe(3);
    // A save with no progress is left without a record.
    const fresh = defaultSave();
    expect(syncFreeCrates(fresh, [campaign])).toBe(0);
    expect('cosmetics' in fresh).toBe(false);
  });
});

describe('once-only grants of a crate or an item', () => {
  it('give it the first time and nothing the second', () => {
    const save = defaultSave();
    expect(grantCrateOnce(save, 'premium', 'c.1')).toBe('granted');
    expect(grantCrateOnce(save, 'premium', 'c.1')).toBe('already');
    expect(cratesHeld(save, 'premium')).toBe(1);
    expect(grantItemOnce(save, 'placeholder-special-1', 'i.1')).toBe('granted');
    expect(grantItemOnce(save, 'placeholder-special-1', 'i.1')).toBe('already');
    expect(cosmeticsOf(save).owned).toEqual(['placeholder-special-1']);
    // Owned already: the grant is taken, nothing else changes.
    expect(grantItemOnce(save, 'placeholder-special-1', 'i.2')).toBe('granted');
    expect(cosmeticsOf(save).owned).toEqual(['placeholder-special-1']);
    expect(save.grants).toEqual(['c.1', 'i.1', 'i.2']);
    expect(save.medals).toBe(0);
  });

  it('refuse what cannot be given and change nothing', () => {
    const save = defaultSave();
    expect(grantCrateOnce(save, 'god', 'g')).toBe('failed');
    expect(grantCrateOnce(save, 'nope', 'g')).toBe('failed');
    expect(grantCrateOnce(save, 'standard', 'bad id')).toBe('failed');
    expect(grantItemOnce(save, 'no-such-item', 'g')).toBe('failed');
    expect(grantItemOnce(save, 'placeholder-common-1', 'x'.repeat(META.maxGrantIdLength + 1))).toBe('failed');
    expect(save).toEqual(defaultSave());
    addCrates(save, 'standard', CRATES.maxHeld);
    expect(grantCrateOnce(save, 'standard', 'full')).toBe('failed');
    expect(save.grants).toBeUndefined();
  });
});
