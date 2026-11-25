/**
 * Supply crates over a SaveData: the draw, the guarantees and their counters, "no duplicates until a set is complete",
 * buying with medals, the crates held, the free crates progress earns and the once-only grants a platform may make.
 * Pure functions (no clock, no Math.random): a draw depends only on the save, so the same save opens the same crate
 * the same way every time. The ones that change a save change it in place; the caller writes it.
 *
 * The rules, in the order a crate is opened (openCrate):
 *  1. The rarity is rolled from the crate's table (CRATES, src/data/crates.ts).
 *  2. A guarantee that is due raises the roll to its rarity; a roll that is already better is kept, and the guarantee
 *     stays due for the next crate. Counters are per crate type and count crates since the last item of exactly that
 *     rarity.
 *  3. While the rolled rarity still has an item the player does not own, one of those is given. When every item of that
 *     rarity is owned (or it has none yet), the roll is a duplicate and turns into medals (CRATES.duplicateMedals).
 */
import { COSMETICS, RARITY_ORDER, type CosmeticItem, type Rarity } from '../data/cosmetics';
import { CRATES, ODDS_PARTS, crateDef, type CrateDef, type CrateId } from '../data/crates';
import { META } from '../data/meta';
import { isCleared } from './campaign';
import { cosmeticsOf, crateItems, ensureCosmetics, giveItem, itemsOfRarity, ownsItem } from './cosmetics';
import { addMedals, isGrantId, type GrantOutcome } from './medals';
import type { SaveData } from './save';

/** What opening one crate gave. */
export interface CrateResult {
  crate: CrateId;
  rarity: Rarity;
  /** The id of the item given, or null when the roll was a duplicate. */
  item: string | null;
  /** Medals given in place of a duplicate (0 with an item). */
  medals: number;
  /** True when a guarantee raised the roll. */
  guaranteed: boolean;
}

function rank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/** A whole-number hash of two numbers (the draws' seed and a crate's place in its run). */
function mix(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Numbers in 0..1 that follow from a seed alone (mulberry32). */
export function crateRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The rarity a table gives for a number in 0..1 (no guarantee applied). */
export function tableRarity(def: CrateDef, u: number): Rarity {
  let at = Math.min(ODDS_PARTS - 1, Math.max(0, Math.floor(u * ODDS_PARTS)));
  for (const o of def.odds) {
    if (at < o.parts) return o.rarity;
    at -= o.parts;
  }
  return def.odds[def.odds.length - 1].rarity;
}

/** A crate type's guarantee counters as the save holds them: crates since the last item of exactly each rarity. */
export type SinceCounters = Partial<Record<Rarity, number>>;

/**
 * One crate's rarity: the table's roll for `u`, raised by any guarantee that is due. Moves the counters on (in
 * place): back to zero for the rarity given, one more for every other, held at "due" once there.
 */
export function rollRarity(def: CrateDef, since: SinceCounters, u: number): { rarity: Rarity; guaranteed: boolean } {
  const natural = tableRarity(def, u);
  let rarity = natural;
  for (const g of def.guarantees) {
    if ((since[g.rarity] ?? 0) >= g.every - 1 && rank(g.rarity) > rank(rarity)) rarity = g.rarity;
  }
  for (const g of def.guarantees) {
    if (g.rarity === rarity) delete since[g.rarity];
    else since[g.rarity] = Math.min(g.every - 1, (since[g.rarity] ?? 0) + 1);
  }
  return { rarity, guaranteed: rarity !== natural };
}

/** Crates of this type still to open before a guarantee is certain to have paid (1 = the next crate). */
export function guaranteeWithin(save: SaveData, def: CrateDef, rarity: Rarity): number {
  const g = def.guarantees.find((x) => x.rarity === rarity);
  if (!g) return 0;
  return Math.max(1, g.every - (cosmeticsOf(save).since[def.id]?.[rarity] ?? 0));
}

/** Finished items of a rarity the save does not own yet (the ones a roll of that rarity may give). */
export function unownedOf(save: SaveData, rarity: Rarity, items: readonly CosmeticItem[] = COSMETICS.items): CosmeticItem[] {
  return itemsOfRarity(rarity, crateItems(items)).filter((item) => !ownsItem(save, item.id));
}

/**
 * True when at least one rarity of the crate's table has a finished item. A crate that could only ever pay medals back
 * is not shown in the Shop, not sold and not granted. Its table stays the exact one: a rarity with no finished item
 * yet pays medals, as a duplicate does.
 */
export function crateStocked(def: CrateDef, items: readonly CosmeticItem[] = COSMETICS.items): boolean {
  const ready = crateItems(items);
  return def.odds.some((o) => itemsOfRarity(o.rarity, ready).length > 0);
}

/** True when the save owns every item of every rarity this crate can hold: it would only give medals back. */
export function crateComplete(save: SaveData, def: CrateDef, items: readonly CosmeticItem[] = COSMETICS.items): boolean {
  return def.odds.every((o) => unownedOf(save, o.rarity, items).length === 0);
}

/**
 * Open one crate of a type: decide what it holds and give it, all in the save, before anything is shown. `seed` is
 * used only if the save has drawn nothing yet (it becomes the seed of all its draws). The crate itself (a held one, or
 * medals) is the caller's to take: openHeld and buyCrate do.
 */
export function openCrate(save: SaveData, def: CrateDef, seed: number, items: readonly CosmeticItem[] = COSMETICS.items): CrateResult {
  const rec = ensureCosmetics(save);
  if (rec.seed === 0) rec.seed = Math.max(1, Math.floor(seed) & 0x7fffffff);
  const n = rec.opened[def.id] ?? 0;
  const rng = crateRng(mix(rec.seed, CRATES.defs.indexOf(def) * 0x1000003 + n));
  const since = rec.since[def.id] ?? {};
  const { rarity, guaranteed } = rollRarity(def, since, rng());
  if (Object.keys(since).length > 0) rec.since[def.id] = since;
  else delete rec.since[def.id];
  rec.opened[def.id] = n + 1;
  const pick = rng();
  const fresh = unownedOf(save, rarity, items);
  if (fresh.length > 0) {
    const item = fresh[Math.min(fresh.length - 1, Math.floor(pick * fresh.length))];
    rec.owned.push(item.id);
    return { crate: def.id, rarity, item: item.id, medals: 0, guaranteed };
  }
  const before = save.medals;
  addMedals(save, CRATES.duplicateMedals[rarity]);
  return { crate: def.id, rarity, item: null, medals: save.medals - before, guaranteed };
}

/** Unopened crates of a type the save holds. */
export function cratesHeld(save: SaveData, id: CrateId): number {
  return cosmeticsOf(save).crates[id] ?? 0;
}

/** Put crates of a type in the save's hands (up to CRATES.maxHeld). Returns how many it now holds. */
export function addCrates(save: SaveData, id: CrateId, n: number): number {
  const def = crateDef(id);
  if (!def || !def.available || !Number.isFinite(n)) return cratesHeld(save, id);
  const next = Math.max(0, Math.min(CRATES.maxHeld, cratesHeld(save, id) + Math.trunc(n)));
  if (next === cratesHeld(save, id)) return next;
  const rec = ensureCosmetics(save);
  if (next > 0) rec.crates[id] = next;
  else delete rec.crates[id];
  return next;
}

/** Open one of the crates held. Null (nothing changed) when none of that type is held. */
export function openHeld(save: SaveData, id: CrateId, seed: number): CrateResult | null {
  const def = crateDef(id);
  if (!def || !def.available || cratesHeld(save, id) <= 0) return null;
  addCrates(save, id, -1);
  return openCrate(save, def, seed);
}

/** True when the save may buy this crate: it is on sale and the medals are there. */
export function canBuyCrate(save: SaveData, id: string, items: readonly CosmeticItem[] = COSMETICS.items): boolean {
  const def = crateDef(id);
  return def !== undefined && def.available && crateStocked(def, items) && save.medals >= def.price;
}

/** Buy a crate with medals and open it at once. Null (nothing changed) when it cannot be bought. */
export function buyCrate(save: SaveData, id: string, seed: number, items: readonly CosmeticItem[] = COSMETICS.items): CrateResult | null {
  const def = crateDef(id);
  if (!def || !canBuyCrate(save, id, items)) return null;
  save.medals -= def.price;
  return openCrate(save, def, seed, items);
}

// --- free crates ---------------------------------------------------------------------------------------------------------

/**
 * Free crates a save's progress has earned so far (CRATES.free): one for every `firstWins` missions won at least once,
 * and `perCampaign` for each campaign with every mission won. `campaigns` = each campaign's mission ids.
 */
export function freeCratesEarned(save: SaveData, campaigns: readonly (readonly number[])[]): number {
  let wins = 0;
  let completed = 0;
  for (const ids of campaigns) {
    let all = ids.length > 0;
    for (const id of ids) {
      if (isCleared(save, id)) wins++;
      else all = false;
    }
    if (all) completed++;
  }
  return Math.floor(wins / CRATES.free.firstWins) + completed * CRATES.free.perCampaign;
}

/** Hand out the free crates earned and not yet given. Returns how many were given now (0: nothing changed). */
export function syncFreeCrates(save: SaveData, campaigns: readonly (readonly number[])[]): number {
  const earned = freeCratesEarned(save, campaigns);
  const given = cosmeticsOf(save).freeGiven;
  if (earned <= given) return 0;
  const rec = ensureCosmetics(save);
  addCrates(save, CRATES.free.crate, earned - given);
  rec.freeGiven = earned;
  return earned - given;
}

// --- once-only grants (a platform's) -------------------------------------------------------------------------------------

function takeGrant(save: SaveData, grantId: string): void {
  save.grants = [...(save.grants ?? []), grantId].slice(-META.maxGrantIds);
}

/**
 * Give one crate once: the grant is named by `grantId` and a grant the save already holds changes nothing. Not given
 * when the id is unusable, the crate is unknown or not available, or no more of it can be held.
 */
export function grantCrateOnce(save: SaveData, crate: string, grantId: string): GrantOutcome {
  const def = crateDef(crate);
  if (!isGrantId(grantId) || !def || !def.available || !crateStocked(def)) return 'failed';
  if ((save.grants ?? []).includes(grantId)) return 'already';
  if (cratesHeld(save, def.id) >= CRATES.maxHeld) return 'failed';
  addCrates(save, def.id, 1);
  takeGrant(save, grantId);
  return 'granted';
}

/**
 * Give one item once, the same way. An item the save already owns is not a failure: the grant is taken and nothing
 * else changes. Not given when the id is unusable, or this build does not know the item or has not finished it (a
 * placeholder or an item still being built is never handed to a player).
 */
export function grantItemOnce(save: SaveData, item: string, grantId: string): GrantOutcome {
  if (!isGrantId(grantId) || !COSMETICS.items.some((i) => i.id === item && i.finished === true && i.placeholder !== true)) return 'failed';
  if ((save.grants ?? []).includes(grantId)) return 'already';
  if (!ownsItem(save, item) && !giveItem(save, item)) return 'failed';
  takeGrant(save, grantId);
  return 'granted';
}

// --- the odds, checked ---------------------------------------------------------------------------------------------------

/** What a long run of one crate type gave (the admin panel's odds test). */
export interface OddsRun {
  crate: CrateId;
  runs: number;
  /** Per rarity of the crate's table, lowest first: how many crates held it, how many of those a guarantee raised, and the table's own chance. */
  rows: { rarity: Rarity; count: number; guaranteed: number; parts: number }[];
}

/** Open `runs` crates of a type one after another, guarantees and all, and count the rarities. Owns nothing, changes nothing. */
export function simulateOdds(def: CrateDef, runs: number, seed: number): OddsRun {
  const rng = crateRng(seed);
  const since: SinceCounters = {};
  const rows = def.odds.map((o) => ({ rarity: o.rarity, count: 0, guaranteed: 0, parts: o.parts }));
  const n = Math.max(0, Math.floor(runs));
  for (let i = 0; i < n; i++) {
    const r = rollRarity(def, since, rng());
    const row = rows.find((x) => x.rarity === r.rarity);
    if (!row) continue;
    row.count++;
    if (r.guaranteed) row.guaranteed++;
  }
  return { crate: def.id, runs: n, rows };
}

/**
 * How often a crate type gives each rarity in the long run, guarantees included (items per crate, summing to 1):
 * worked out exactly from the table, by following the guarantee counters as a chain of states until it settles. The
 * fairness check of docs/QUEUE.md is price / this.
 */
export function longRunRates(def: CrateDef): Partial<Record<Rarity, number>> {
  const gs = def.guarantees;
  const sizes = gs.map((g) => g.every);
  const states = sizes.reduce((a, b) => a * b, 1);
  const decode = (index: number): number[] => {
    const out: number[] = [];
    let rest = index;
    for (const size of sizes) {
      out.push(rest % size);
      rest = Math.floor(rest / size);
    }
    return out;
  };
  const encode = (counters: readonly number[]): number => {
    let index = 0;
    for (let i = counters.length - 1; i >= 0; i--) index = index * sizes[i] + counters[i];
    return index;
  };
  // Every state's moves, worked out once: per roll of the table, the rarity given and the state that follows.
  const moves: { p: number; rarity: Rarity; next: number }[][] = [];
  for (let s = 0; s < states; s++) {
    const counters = decode(s);
    const list: { p: number; rarity: Rarity; next: number }[] = [];
    for (const o of def.odds) {
      let rarity = o.rarity;
      gs.forEach((g, i) => {
        if (counters[i] >= g.every - 1 && rank(g.rarity) > rank(rarity)) rarity = g.rarity;
      });
      const next = gs.map((g, i) => (g.rarity === rarity ? 0 : Math.min(g.every - 1, counters[i] + 1)));
      list.push({ p: o.parts / ODDS_PARTS, rarity, next: encode(next) });
    }
    moves.push(list);
  }
  let dist = new Float64Array(states);
  dist[0] = 1;
  const rates: Partial<Record<Rarity, number>> = {};
  // The chain forgets its start within a few hundred crates; the rates are averaged over a long stretch after that.
  const warm = 2000;
  const measured = 4000;
  for (let step = 0; step < warm + measured; step++) {
    const after = new Float64Array(states);
    for (let s = 0; s < states; s++) {
      const mass = dist[s];
      if (mass === 0) continue;
      for (const m of moves[s]) {
        after[m.next] += mass * m.p;
        if (step >= warm) rates[m.rarity] = (rates[m.rarity] ?? 0) + (mass * m.p) / measured;
      }
    }
    dist = after;
  }
  return rates;
}

/** Medals a crate type costs per item of a rarity in the long run (Infinity when it never holds one). */
export function medalsPerItem(def: CrateDef, rarity: Rarity): number {
  const rate = longRunRates(def)[rarity] ?? 0;
  return rate > 0 ? def.price / rate : Infinity;
}

/** Medals a crate type gives back on average once every set it can hold is complete (every roll a duplicate). */
export function duplicateReturn(def: CrateDef): number {
  const rates = longRunRates(def);
  let medals = 0;
  for (const o of def.odds) medals += (rates[o.rarity] ?? 0) * CRATES.duplicateMedals[o.rarity];
  return medals;
}
