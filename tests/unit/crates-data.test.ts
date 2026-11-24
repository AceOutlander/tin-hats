/**
 * The crate tables (src/data/crates.ts) against the owner's (docs/QUEUE.md, "Crate balance fix (owner, 2026-11-22)"),
 * the fairness check that entry asks a unit test to hold, and the rules for what a duplicate pays.
 */
import { describe, expect, it } from 'vitest';
import { RARITIES, RARITY_ORDER, type Rarity } from '../../src/data/cosmetics';
import { CRATES, ODDS_PARTS, crateDef, oddsPercent, type CrateDef, type CrateId } from '../../src/data/crates';
import { crateRng, duplicateReturn, longRunRates, medalsPerItem, simulateOdds } from '../../src/meta';

const def = (id: CrateId): CrateDef => crateDef(id) as CrateDef;
const table = (id: CrateId): Record<string, string> => Object.fromEntries(def(id).odds.map((o) => [o.rarity, oddsPercent(o.parts)]));
const SOLD: readonly CrateId[] = ['standard', 'premium', 'elite', 'titan'];
/** The tiers of the fairness check. */
const TIERS: readonly Rarity[] = ['rare', 'epic', 'legendary', 'mythic'];

describe('the crate tables', () => {
  it('are the owner\'s, to the last figure', () => {
    expect(CRATES.defs.map((c) => [c.id, c.name, c.price])).toEqual([
      ['standard', 'Standard Crate', 350],
      ['premium', 'Premium Crate', 1000],
      ['elite', 'Elite Crate', 3000],
      ['titan', 'Titan Crate', 5000],
      ['god', 'God Crate', 199999],
    ]);
    expect(table('standard')).toEqual({ common: '45.9%', uncommon: '30%', rare: '18%', epic: '5%', legendary: '1%', mythic: '0.1%' });
    expect(table('premium')).toEqual({ common: '30%', uncommon: '25%', rare: '20%', epic: '15%', legendary: '8%', mythic: '2%' });
    expect(table('elite')).toEqual({ epic: '35%', legendary: '45%', mythic: '20%' });
    expect(table('titan')).toEqual({ legendary: '60%', mythic: '40%' });
    expect(table('god')).toEqual({ common: '0.01%', secret: '99.99%' });
  });

  it('each add up to exactly 100%, lowest rarity first, in whole parts', () => {
    for (const c of CRATES.defs) {
      expect(c.odds.reduce((n, o) => n + o.parts, 0), c.id).toBe(ODDS_PARTS);
      for (const o of c.odds) {
        expect(Number.isInteger(o.parts) && o.parts > 0, `${c.id} ${o.rarity}`).toBe(true);
        expect(RARITIES[o.rarity].inCrates, `${c.id} ${o.rarity}`).toBe(true);
      }
      const ranks = c.odds.map((o) => RARITY_ORDER.indexOf(o.rarity));
      expect([...ranks].sort((a, b) => a - b), c.id).toEqual(ranks);
    }
  });

  it('carry the guarantees given and no others', () => {
    expect(def('standard').guarantees).toEqual([
      { rarity: 'rare', every: 5 },
      { rarity: 'legendary', every: 30 },
    ]);
    expect(def('premium').guarantees).toEqual([
      { rarity: 'epic', every: 5 },
      { rarity: 'legendary', every: 15 },
    ]);
    expect(def('elite').guarantees).toEqual([]);
    expect(def('titan').guarantees).toEqual([]);
    // A guarantee is always for a rarity the crate holds.
    for (const c of CRATES.defs) for (const g of c.guarantees) expect(c.odds.some((o) => o.rarity === g.rarity)).toBe(true);
  });

  it('the God Crate is on show only: never bought, opened or granted', () => {
    expect(def('god').available).toBe(false);
    for (const id of SOLD) expect(def(id).available).toBe(true);
  });

  it('free crates are Standard Crates, about one for every three missions', () => {
    expect(CRATES.free).toEqual({ crate: 'standard', firstWins: 3, perCampaign: 1 });
  });

  it('shows a chance exactly', () => {
    expect([4590, 3000, 500, 100, 10, 1, 9999, 10000, 1250, 5].map(oddsPercent)).toEqual(['45.9%', '30%', '5%', '1%', '0.1%', '0.01%', '99.99%', '100%', '12.5%', '0.05%']);
  });

  it('no crate is painted in a colour that could be taken for a rarity', () => {
    const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const c of CRATES.defs) {
      if (c.tint === null) continue;
      expect(c.tint).toMatch(/^#[0-9a-f]{6}$/);
      for (const r of RARITY_ORDER) {
        const [a, b] = [rgb(c.tint), rgb(RARITIES[r].colour)];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${c.id} against ${r}`).toBeGreaterThan(80);
      }
    }
  });
});

describe('the fairness check', () => {
  const cost = (id: CrateId, rarity: Rarity): number => medalsPerItem(def(id), rarity);

  it('without a guarantee, a crate costs its price over the chance', () => {
    expect(cost('elite', 'epic')).toBeCloseTo(3000 / 0.35, 3);
    expect(cost('elite', 'legendary')).toBeCloseTo(3000 / 0.45, 3);
    expect(cost('elite', 'mythic')).toBeCloseTo(15000, 3);
    expect(cost('titan', 'legendary')).toBeCloseTo(5000 / 0.6, 3);
    expect(cost('titan', 'mythic')).toBeCloseTo(12500, 3);
    expect(cost('titan', 'rare')).toBe(Infinity);
    expect(cost('standard', 'mythic')).toBeCloseTo(350000, -1);
  });

  it('with a guarantee, it costs about what the spec worked out', () => {
    const near = (value: number, about: number): void => {
      expect(value).toBeGreaterThan(about * 0.95);
      expect(value).toBeLessThan(about * 1.05);
    };
    near(cost('standard', 'rare'), 1200);
    near(cost('standard', 'legendary'), 9100);
    near(cost('premium', 'epic'), 3700);
    near(cost('premium', 'legendary'), 8900);
  });

  it('each crate is the best buy for its tier', () => {
    const best = (rarity: Rarity): CrateId => [...SOLD].sort((a, b) => cost(a, rarity) - cost(b, rarity))[0];
    expect(best('rare')).toBe('standard');
    expect(best('epic')).toBe('premium');
    expect(best('legendary')).toBe('elite');
    expect(best('mythic')).toBe('titan');
  });

  it('no crate is the worst buy at every tier it holds', () => {
    for (const id of SOLD) {
      const held = TIERS.filter((r) => Number.isFinite(cost(id, r)) && SOLD.filter((o) => Number.isFinite(cost(o, r))).length > 1);
      expect(held.length, id).toBeGreaterThan(0);
      const worstAt = held.filter((r) => SOLD.every((o) => cost(o, r) === Infinity || cost(o, r) <= cost(id, r)));
      expect(worstAt.length, `${id} is the worst at ${worstAt.join(', ')}`).toBeLessThan(held.length);
    }
  });

  it('the long-run rates add up, and a long run of real draws agrees with them', () => {
    for (const id of SOLD) {
      const rates = longRunRates(def(id));
      expect(Object.values(rates).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      const runs = 300_000;
      const run = simulateOdds(def(id), runs, 12345);
      expect(run.rows.reduce((n, r) => n + r.count, 0)).toBe(runs);
      for (const row of run.rows) {
        const expected = (rates[row.rarity] ?? 0) * runs;
        // Within six standard deviations of a count that size.
        expect(Math.abs(row.count - expected), `${id} ${row.rarity}`).toBeLessThan(6 * Math.sqrt(expected) + 1);
      }
    }
  });

  it('the odds test is the same run for the same seed', () => {
    expect(simulateOdds(def('premium'), 5000, 7)).toEqual(simulateOdds(def('premium'), 5000, 7));
    expect(simulateOdds(def('premium'), 5000, 7)).not.toEqual(simulateOdds(def('premium'), 5000, 8));
    const rng = crateRng(99);
    const first = [rng(), rng(), rng()];
    const again = crateRng(99);
    expect([again(), again(), again()]).toEqual(first);
    for (const u of first) expect(u >= 0 && u < 1).toBe(true);
  });
});

describe('what a duplicate pays', () => {
  it('never more than the crate it came from cost', () => {
    for (const id of SOLD) for (const o of def(id).odds) expect(CRATES.duplicateMedals[o.rarity], `${id} ${o.rarity}`).toBeLessThanOrEqual(def(id).price);
    // And a rarer duplicate never pays less than a commoner one.
    const paid = (['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const).map((r) => CRATES.duplicateMedals[r]);
    expect([...paid].sort((a, b) => a - b)).toEqual(paid);
    expect(paid[0]).toBeGreaterThan(0);
  });

  it('with every set complete, a crate gives back clearly less than its price', () => {
    expect(CRATES.duplicateMaxReturn).toBeLessThanOrEqual(0.25);
    for (const id of SOLD) {
      const back = duplicateReturn(def(id));
      expect(back, id).toBeGreaterThan(0);
      expect(back / def(id).price, id).toBeLessThan(CRATES.duplicateMaxReturn);
    }
  });
});
