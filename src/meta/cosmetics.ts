/**
 * Cosmetics over a SaveData: what the player owns, what is worn where, and the record the save keeps of both (with the
 * crates held and their counters, which src/meta/crates.ts works on). Pure functions; the ones that change a save
 * change it in place. Nothing here reaches a battle's rules: the app hands what is worn to the battle's view only.
 */
import { COSMETICS, RARITIES, UNIT_GROUPS, type CosmeticItem, type Rarity } from '../data/cosmetics';
import { CRATES, type CrateId } from '../data/crates';
import { FACTION_IDS } from '../data/factions';
import type { FactionId, UnitKind } from '../data/schema';
import type { SaveData } from './save';

/** The save's block for cosmetics and crates. Absent from a save until there is something to keep. */
export interface CosmeticsRecord {
  /** Ids of the items owned, oldest first. Ids this build does not know are kept (another build may). */
  owned: string[];
  /** Wear slot ("own.soviet.rifle", "enemy.german.tank", "own.soviet.hq") to the id of the item worn there. */
  worn: Record<string, string>;
  /** Unopened crates held, per type. */
  crates: Partial<Record<CrateId, number>>;
  /** Crates opened so far, per type: the place in that type's run of draws. */
  opened: Partial<Record<CrateId, number>>;
  /** The guarantee counters: crates of a type opened since its last item of exactly that rarity. */
  since: Partial<Record<CrateId, Partial<Record<Rarity, number>>>>;
  /** The seed this save's draws come from (0 until the first draw). */
  seed: number;
  /** Free crates already handed out for progress (CRATES.free). */
  freeGiven: number;
}

export function emptyCosmetics(): CosmeticsRecord {
  return { owned: [], worn: {}, crates: {}, opened: {}, since: {}, seed: 0, freeGiven: 0 };
}

/** The save's record as it stands (an empty one, not attached, when the save has none). Read only. */
export function cosmeticsOf(save: SaveData): CosmeticsRecord {
  return save.cosmetics ?? emptyCosmetics();
}

/** The save's record, made and attached if it had none. */
export function ensureCosmetics(save: SaveData): CosmeticsRecord {
  if (!save.cosmetics) save.cosmetics = emptyCosmetics();
  return save.cosmetics;
}

const BY_ID = new Map<string, CosmeticItem>(COSMETICS.items.map((item) => [item.id, item]));

/** The item of this id, or undefined for one this build does not know. */
export function cosmeticItem(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}

/** Every item of a rarity, in data order (the set "no duplicates until a set is complete" speaks of). */
export function itemsOfRarity(rarity: Rarity, items: readonly CosmeticItem[] = COSMETICS.items): CosmeticItem[] {
  return items.filter((item) => item.rarity === rarity);
}

/**
 * The items a crate may hold: finished ones (never a placeholder) of a rarity crates carry. Unfinished items stay in
 * the data for building and testing, and never come out of a crate.
 */
export function crateItems(items: readonly CosmeticItem[] = COSMETICS.items): CosmeticItem[] {
  return items.filter((item) => item.finished === true && item.placeholder !== true && RARITIES[item.rarity].inCrates);
}

export function ownsItem(save: SaveData, id: string): boolean {
  return cosmeticsOf(save).owned.includes(id);
}

/** Give an item this build knows. True when it is newly owned; false (nothing changed) when owned already, unknown or the list is full. */
export function giveItem(save: SaveData, id: string): boolean {
  if (!BY_ID.has(id) || ownsItem(save, id)) return false;
  const rec = ensureCosmetics(save);
  if (rec.owned.length >= COSMETICS.maxOwned) return false;
  rec.owned.push(id);
  return true;
}

// --- wearing -----------------------------------------------------------------------------------------------------------

/** What a wear slot dresses: a unit kind, or the HQ. */
export type WearPart = UnitKind | 'hq';

export function wearSlot(side: 'own' | 'enemy', nation: FactionId, part: WearPart): string {
  return `${side}.${nation}.${part}`;
}

/** The unit kinds (or the HQ) an item dresses. */
export function itemParts(item: CosmeticItem): readonly WearPart[] {
  const units = item.target.units;
  if (units === 'hq') return ['hq'];
  return typeof units === 'string' ? UNIT_GROUPS[units] : units;
}

/** The nations an item is for. */
export function itemNations(item: CosmeticItem): readonly FactionId[] {
  return item.target.nations === 'all' ? FACTION_IDS : item.target.nations;
}

/** Every wear slot an item fills when worn. */
export function itemSlots(item: CosmeticItem): string[] {
  const out: string[] = [];
  for (const nation of itemNations(item)) for (const part of itemParts(item)) out.push(wearSlot(item.target.side, nation, part));
  return out;
}

/** True while the item is worn in at least one of its slots. */
export function isWorn(save: SaveData, id: string): boolean {
  const worn = cosmeticsOf(save).worn;
  for (const slot of Object.keys(worn)) if (worn[slot] === id) return true;
  return false;
}

/**
 * Wear an owned item: it goes on every slot it dresses, in place of whatever was worn there (one item per unit kind,
 * nation and side). False (nothing changed) when it is not owned or not known.
 */
export function wearItem(save: SaveData, id: string): boolean {
  const item = BY_ID.get(id);
  if (!item || !ownsItem(save, id)) return false;
  const rec = ensureCosmetics(save);
  for (const slot of itemSlots(item)) rec.worn[slot] = id;
  return true;
}

/** Take an item off every slot it is worn in. False when it was not worn. */
export function takeOffItem(save: SaveData, id: string): boolean {
  const rec = save.cosmetics;
  if (!rec) return false;
  let any = false;
  for (const slot of Object.keys(rec.worn)) {
    if (rec.worn[slot] !== id) continue;
    delete rec.worn[slot];
    any = true;
  }
  return any;
}

/** The item worn on a slot, when the save owns it and this build knows it; else null. */
export function wornAt(save: SaveData, side: 'own' | 'enemy', nation: FactionId, part: WearPart): CosmeticItem | null {
  const rec = save.cosmetics;
  if (!rec) return null;
  const id = rec.worn[wearSlot(side, nation, part)];
  if (id === undefined || !rec.owned.includes(id)) return null;
  return BY_ID.get(id) ?? null;
}

/**
 * What a battle's view draws: for each side of the battle (0 = the player's, of nation `factions[0]`; 1 = the enemy's),
 * the item worn per unit kind and on the HQ. Null when nothing at all is worn for these two nations.
 */
export interface WornLooks {
  readonly sides: readonly [ReadonlyMap<WearPart, CosmeticItem>, ReadonlyMap<WearPart, CosmeticItem>];
}

export function resolveWorn(save: SaveData, factions: readonly [FactionId, FactionId]): WornLooks | null {
  const rec = save.cosmetics;
  if (!rec) return null;
  const sides: [Map<WearPart, CosmeticItem>, Map<WearPart, CosmeticItem>] = [new Map(), new Map()];
  let any = false;
  for (let side = 0; side < 2; side++) {
    const prefix = `${side === 0 ? 'own' : 'enemy'}.${factions[side]}.`;
    for (const slot of Object.keys(rec.worn)) {
      if (!slot.startsWith(prefix)) continue;
      const id = rec.worn[slot];
      const item = BY_ID.get(id);
      if (!item || !rec.owned.includes(id)) continue;
      sides[side].set(slot.slice(prefix.length) as WearPart, item);
      any = true;
    }
  }
  return any ? { sides } : null;
}

// --- the stored record, checked ------------------------------------------------------------------------------------------

const SLOT = /^(own|enemy)\.[a-z]{1,24}\.[A-Za-z]{1,24}$/;
const MAX_COUNT = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min ? Math.min(max, value) : null;
}

/**
 * The cosmetics block of a stored save, checked: well-formed item ids (each once; unknown ones are kept, so a save that
 * has been to a build with more items loses nothing), worn only what is owned, whole counts within their limits, and
 * the counters of the guarantees this build's crates have. Undefined when nothing is left worth keeping.
 */
export function sanitizeCosmetics(raw: unknown): CosmeticsRecord | undefined {
  if (!isRecord(raw)) return undefined;
  const out = emptyCosmetics();
  if (Array.isArray(raw.owned)) {
    for (const id of raw.owned) {
      if (typeof id !== 'string' || !COSMETICS.idPattern.test(id) || out.owned.includes(id)) continue;
      if (out.owned.length >= COSMETICS.maxOwned) break;
      out.owned.push(id);
    }
  }
  if (isRecord(raw.worn)) {
    for (const slot of Object.keys(raw.worn)) {
      const id = raw.worn[slot];
      if (SLOT.test(slot) && typeof id === 'string' && out.owned.includes(id)) out.worn[slot] = id;
    }
  }
  for (const def of CRATES.defs) {
    const held = isRecord(raw.crates) ? whole(raw.crates[def.id], 1, CRATES.maxHeld) : null;
    if (held !== null && def.available) out.crates[def.id] = held;
    const opened = isRecord(raw.opened) ? whole(raw.opened[def.id], 1, MAX_COUNT) : null;
    if (opened !== null) out.opened[def.id] = opened;
    const since = isRecord(raw.since) ? raw.since[def.id] : undefined;
    if (!isRecord(since)) continue;
    const kept: Partial<Record<Rarity, number>> = {};
    for (const g of def.guarantees) {
      const n = whole(since[g.rarity], 1, g.every - 1);
      if (n !== null) kept[g.rarity] = n;
    }
    if (Object.keys(kept).length > 0) out.since[def.id] = kept;
  }
  out.seed = whole(raw.seed, 1, 0x7fffffff) ?? 0;
  out.freeGiven = whole(raw.freeGiven, 1, MAX_COUNT) ?? 0;
  const empty =
    out.owned.length === 0 && Object.keys(out.crates).length === 0 && Object.keys(out.opened).length === 0 && Object.keys(out.since).length === 0 && out.freeGiven === 0;
  return empty ? undefined : out;
}
