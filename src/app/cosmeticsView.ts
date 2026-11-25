/**
 * The view models of the Shop's crate section, the Appearance tab and an opened crate, built from the save and the
 * data. Pure functions: no DOM, so they run in unit tests. The app adds them to the campaign view only while cosmetics
 * are switched on (COSMETICS.enabled, or a test's or the admin panel's switch for its session).
 */
import { COSMETICS, RARITIES, type CosmeticItem, type Rarity } from '../data/cosmetics';
import { CRATES, crateDef, oddsPercent, type CrateDef } from '../data/crates';
import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/schema';
import {
  canBuyCrate,
  cosmeticItem,
  cosmeticsOf,
  crateComplete,
  crateStocked,
  cratesHeld,
  guaranteeWithin,
  isWorn,
  itemNations,
  type CrateResult,
  type SaveData,
} from '../meta';
import type { AppearanceView, CosmeticCardView, CrateCardView, CrateOpenedView, CratesView, RarityView } from '../ui/contracts';

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export function rarityView(rarity: Rarity): RarityView {
  const def = RARITIES[rarity];
  return { id: rarity, name: def.name, colour: def.colour, marks: def.marks };
}

/** One crate's card. `buying` false: crates are not sold here (a platform's switch); held ones can still be opened. */
function crateCard(save: SaveData, def: CrateDef, buying: boolean): CrateCardView {
  const T = CRATES.text;
  const guarantees =
    def.guarantees.length === 0
      ? [T.noGuarantee]
      : def.guarantees.map((g) => {
          const name = RARITIES[g.rarity].name;
          return `${fill(T.guarantee, { rarity: name, every: g.every })}. ${fill(T.guaranteeNext, { rarity: name, n: guaranteeWithin(save, def, g.rarity) })}.`;
        });
  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    price: def.price,
    tint: def.tint,
    odds: def.odds.map((o) => ({ ...rarityView(o.rarity), percent: oddsPercent(o.parts) })),
    guarantees,
    held: cratesHeld(save, def.id),
    state: !def.available ? 'soon' : !buying ? 'none' : canBuyCrate(save, def.id) ? 'buy' : 'short',
    completeNote: def.available && crateComplete(save, def) ? T.complete : null,
  };
}

/**
 * The crate section. Where crates are sold: every crate in Shop order (the God Crate as "Coming soon"). Where they are
 * not: the crate free ones come as, and any other type the player holds, to open; nothing that names a price. Either
 * way a crate none of whose rarities has a finished item yet is left out (crateStocked) unless the player holds one;
 * the God Crate stays as "Coming soon".
 */
export function buildCratesView(save: SaveData, buying: boolean, items: readonly CosmeticItem[] = COSMETICS.items): CratesView {
  const T = CRATES.text;
  const stocked = (def: CrateDef): boolean => !def.available || crateStocked(def, items) || cratesHeld(save, def.id) > 0;
  const shown = CRATES.defs.filter(
    (def) => stocked(def) && (buying || (def.available && (def.id === CRATES.free.crate || cratesHeld(save, def.id) > 0))),
  );
  return {
    heading: T.heading,
    intro: T.intro,
    cards: shown.map((def) => crateCard(save, def, buying)),
    text: {
      buy: T.buy,
      open: T.open,
      held: T.held,
      comingSoon: T.comingSoon,
      oddsHeading: T.oddsHeading,
      confirmTitle: T.confirmTitle,
      confirmBody: T.confirmBody,
      confirmYes: T.confirmYes,
      confirmNo: T.confirmNo,
      skip: T.skip,
      done: T.done,
      newItem: T.newItem,
    },
  };
}

/**
 * What an item dresses, in words: its units by the names of `nation` (the player's, for an item of the player's own
 * side) or of the nation it is for, then the nations.
 */
export function appliesTo(item: CosmeticItem, nation: FactionId): string {
  const T = COSMETICS.text;
  const t = item.target;
  const nations = itemNations(item);
  const naming = nations.includes(nation) && t.side === 'own' ? nation : nations[0];
  const names = FACTIONS[naming].unitNames;
  const what = t.units === 'hq' ? T.hq : typeof t.units === 'string' ? T.groups[t.units] : t.units.map((k) => names[k]).join(', ');
  const whose = t.nations === 'all' ? T.allNations : t.nations.map((n) => FACTIONS[n].name).join(', ');
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} · ${whose}`;
}

function cosmeticCard(save: SaveData, item: CosmeticItem, nation: FactionId): CosmeticCardView {
  return {
    id: item.id,
    name: item.name,
    blurb: item.blurb,
    rarity: rarityView(item.rarity),
    appliesTo: appliesTo(item, nation),
    group: item.target.units === 'hq' ? 'hq' : item.target.side,
    worn: isWorn(save, item.id),
    placeholder: item.placeholder === true,
  };
}

/** The Appearance tab: every owned item this build knows, in data order (so a set reads together). */
export function buildAppearanceView(save: SaveData, nation: FactionId): AppearanceView {
  const owned = cosmeticsOf(save).owned;
  const T = COSMETICS.text;
  return {
    items: COSMETICS.items.filter((item) => owned.includes(item.id)).map((item) => cosmeticCard(save, item, nation)),
    text: { tab: T.tab, shopTab: T.shopTab, heading: T.heading, empty: T.empty, wear: T.wear, takeOff: T.takeOff, worn: T.worn, own: T.own, enemy: T.enemy, hq: T.hq, placeholder: T.placeholder },
  };
}

/** An opened crate as the opening shows it. */
export function crateOpenedView(result: CrateResult, nation: FactionId, reduced: boolean): CrateOpenedView {
  const def = crateDef(result.crate) as CrateDef;
  const item = result.item !== null ? cosmeticItem(result.item) : undefined;
  const rarity = rarityView(result.rarity);
  return {
    crate: { id: def.id, name: def.name, tint: def.tint },
    rarity,
    item: item ? { id: item.id, name: item.name, blurb: item.blurb, appliesTo: appliesTo(item, nation) } : null,
    medals: result.medals,
    duplicateLine: fill(CRATES.text.duplicate, { rarity: rarity.name, medals: result.medals }),
    reduced,
  };
}

/** The result screen's line for free crates a win earned. */
export function cratesEarnedLine(n: number): string {
  return n === 1 ? CRATES.text.freeEarned : fill(CRATES.text.freeEarnedMany, { n });
}
