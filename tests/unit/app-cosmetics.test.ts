/**
 * Cosmetics and crates through the app: hidden and inert while switched off, the crate section and the Appearance tab
 * while on, a crate decided and saved before it is shown, free crates from wins, the platform's switch for buying and
 * its once-only grants, and the proof that a battle plays tick for tick the same with and without skins worn.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { buildAppearanceView, buildCratesView } from '../../src/app/cosmeticsView';
import { CONFIG } from '../../src/data/config';
import { COSMETICS } from '../../src/data/cosmetics';
import { CRATES } from '../../src/data/crates';
import { SANDBOX } from '../../src/data/missions/sandbox';
import { cosmeticsOf, createMemoryStorage, cratesHeld, defaultSave, giveItem, loadSave, wearItem, writeSave, type SaveData, type StorageLike } from '../../src/meta';
import { summarize } from '../../src/sim';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

function makeApp(opts: { cosmetics?: boolean; storage?: StorageLike | null; buying?: () => boolean; missions?: ReturnType<typeof quickMission>[]; random?: () => number } = {}) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const storage = opts.storage === undefined ? createMemoryStorage() : opts.storage;
  const missions = opts.missions ?? [quickMission(1, true), quickMission(2, true), quickMission(3, true), quickMission(4, true)];
  const app = new App({ view, audio, storage, missions, upgradeDefs: [], random: opts.random ?? (() => 0.25), cosmetics: opts.cosmetics, crateBuying: opts.buying });
  app.attachUi(ui);
  return { app, view, audio, ui, storage };
}

function frames(view: ReturnType<typeof createFakeView>, count: number, dtMs = 100): void {
  for (let i = 0; i < count; i++) view.frame?.(dtMs);
}

/** Win mission `id` on the quick field. */
function win(t: ReturnType<typeof makeApp>, id: number): void {
  t.app.startMission(id, 'normal');
  t.app.dispatch({ type: 'order', order: 'advance' });
  for (let i = 0; i < 3000 && !t.app.lastResult; i++) frames(t.view, 1, 250);
  expect(t.app.lastResult?.won).toBe(true);
}

describe('cosmetics switched off (the live game)', () => {
  it('is how the app starts: no crate section, no Appearance tab, nothing worn handed to a battle', () => {
    const t = makeApp();
    expect(COSMETICS.enabled).toBe(false);
    expect(t.app.cosmeticsEnabled).toBe(false);
    const view = t.app.campaign();
    expect('crates' in view).toBe(false);
    expect('appearance' in view).toBe(false);
    // Even a save that owns and wears things (it has been somewhere they are on) shows and draws nothing here.
    giveItem(t.app.save, 'placeholder-common-1');
    wearItem(t.app.save, 'placeholder-common-1');
    expect('appearance' in t.app.campaign()).toBe(false);
    t.app.startMission(1, 'normal');
    expect(t.view.attachOptions && 'skins' in t.view.attachOptions).toBe(false);
  });

  it('buys, opens and wears nothing, and a win earns no crate and says nothing of one', () => {
    const t = makeApp();
    t.app.giveMedals(5000);
    const before = JSON.stringify(t.app.save);
    expect(t.app.buyCrate('standard')).toBeNull();
    expect(t.app.openCrate('standard')).toBeNull();
    t.app.wearCosmetic('placeholder-common-1', true);
    expect(JSON.stringify(t.app.save)).toBe(before);
    win(t, 1);
    t.app.onScreen('campaign');
    win(t, 2);
    t.app.onScreen('campaign');
    win(t, 3);
    expect(t.app.lastResult && 'cratesEarned' in t.app.lastResult).toBe(false);
    expect('cosmetics' in t.app.save).toBe(false);
    expect('cosmetics' in loadSave(t.storage).data).toBe(false);
  });

  it('a save with cosmetics keeps them through a load and a write, untouched', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    giveItem(save, 'placeholder-rare-1');
    wearItem(save, 'placeholder-rare-1');
    save.cosmetics = { ...cosmeticsOf(save), crates: { standard: 2 }, seed: 9 };
    writeSave(storage, save);
    const t = makeApp({ storage });
    t.app.giveMedals(10);
    expect(loadSave(storage).data.cosmetics).toEqual(save.cosmetics);
  });
});

describe('cosmetics switched on', () => {
  it('the Shop gets its crate section: every crate, its exact chances, its guarantees and their counters', () => {
    const t = makeApp({ cosmetics: true });
    const crates = t.app.campaign().crates;
    expect(crates?.heading).toBe('Supply crates');
    expect(crates?.cards.map((c) => [c.id, c.price, c.state])).toEqual([
      ['standard', 350, 'short'],
      ['premium', 1000, 'short'],
      ['elite', 3000, 'short'],
      ['titan', 5000, 'short'],
      ['god', 199999, 'soon'],
    ]);
    const standard = crates?.cards[0];
    expect(standard?.odds.map((o) => `${o.name} ${o.percent}`)).toEqual(['Common 45.9%', 'Uncommon 30%', 'Rare 18%', 'Epic 5%', 'Legendary 1%', 'Mythic 0.1%']);
    expect(standard?.guarantees).toEqual([
      'Rare or better at least every 5 crates. Rare or better within the next 5.',
      'Legendary or better at least every 30 crates. Legendary or better within the next 30.',
    ]);
    expect(crates?.cards[2].guarantees).toEqual([CRATES.text.noGuarantee]);
    expect(crates?.cards[4].odds.map((o) => `${o.name} ${o.percent}`)).toEqual(['Common 0.01%', '??? 99.99%']);
    // Every rarity is named in words and carries its marks: never the colour alone.
    for (const card of crates?.cards ?? []) for (const o of card.odds) expect(o.name.length > 0 && Number.isInteger(o.marks)).toBe(true);
    t.app.giveMedals(1000);
    expect(t.app.campaign().crates?.cards.map((c) => c.state)).toEqual(['buy', 'buy', 'short', 'short', 'soon']);
  });

  it('buying takes the medals, decides and saves what the crate held, and only then hands it over to be shown', () => {
    const t = makeApp({ cosmetics: true });
    t.app.giveMedals(1000);
    const shown = t.app.buyCrate('standard');
    expect(shown).not.toBeNull();
    expect(shown?.crate.name).toBe('Standard Crate');
    // What is in the store is already what was given: closing the game now loses nothing.
    const stored = loadSave(t.storage).data;
    expect(stored.medals).toBe(1000 - 350 + (shown?.medals ?? 0));
    expect(stored.cosmetics?.opened.standard).toBe(1);
    if (shown?.item) {
      expect(stored.cosmetics?.owned).toEqual([shown.item.id]);
      expect(shown.item.name).toMatch(/^Placeholder /);
      expect(shown.medals).toBe(0);
    }
    expect(shown?.rarity.name).toBe(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'].find((n) => n === shown?.rarity.name));
    // The counters shown before the next one moved on.
    const next = t.app.campaign().crates?.cards[0].guarantees ?? [];
    expect(next[1]).toMatch(/within the next 29\.$/);
    expect(t.app.buyCrate('god')).toBeNull();
    expect(t.app.buyCrate('elite')).toBeNull();
    expect(loadSave(t.storage).data.medals).toBe(stored.medals);
  });

  it('the opening follows "Reduce flashing", and a duplicate says what it paid', () => {
    const t = makeApp({ cosmetics: true });
    t.app.giveItems();
    t.app.giveMedals(700);
    expect(t.app.buyCrate('standard')?.reduced).toBe(false);
    t.app.setSetting('reduceFlash', true);
    const dup = t.app.buyCrate('standard');
    expect(dup?.reduced).toBe(true);
    expect(dup?.item).toBeNull();
    expect(dup?.medals).toBe(CRATES.duplicateMedals[dup?.rarity.id as keyof typeof CRATES.duplicateMedals]);
    expect(dup?.duplicateLine).toBe(`You already own every ${dup?.rarity.name} item: ${dup?.medals} medals instead.`);
    expect(t.app.campaign().crates?.cards[0].completeNote).toBe(CRATES.text.complete);
  });

  it('the Appearance tab lists what is owned, and wearing is saved', () => {
    const t = makeApp({ cosmetics: true });
    expect(t.app.campaign().appearance?.items).toEqual([]);
    t.app.giveItems('placeholder-common-1');
    t.app.giveItems('placeholder-uncommon-2');
    t.app.giveItems('placeholder-epic-1');
    const items = t.app.campaign().appearance?.items ?? [];
    expect(items.map((i) => [i.id, i.group, i.rarity.name, i.worn, i.placeholder])).toEqual([
      ['placeholder-common-1', 'own', 'Common', false, true],
      ['placeholder-uncommon-2', 'enemy', 'Uncommon', false, true],
      ['placeholder-epic-1', 'hq', 'Epic', false, true],
    ]);
    expect(items[0].appliesTo).toMatch(/ · every nation$/);
    expect(items[1].appliesTo).toMatch(/^All infantry · /);
    t.app.wearCosmetic('placeholder-common-1', true);
    t.app.wearCosmetic('placeholder-rare-1', true);
    expect(t.app.campaign().appearance?.items.map((i) => i.worn)).toEqual([true, false, false]);
    expect(Object.values(loadSave(t.storage).data.cosmetics?.worn ?? {})).toContain('placeholder-common-1');
    expect(Object.values(loadSave(t.storage).data.cosmetics?.worn ?? {})).not.toContain('placeholder-rare-1');
    t.app.wearCosmetic('placeholder-common-1', false);
    expect(loadSave(t.storage).data.cosmetics?.worn).toEqual({});
  });

  it('a battle\'s view is told what each side wears; the battle itself is told nothing', () => {
    const t = makeApp({ cosmetics: true });
    t.app.giveItems();
    t.app.wearCosmetic('placeholder-common-1', true);
    t.app.wearCosmetic('placeholder-uncommon-2', true);
    t.app.startMission(1, 'normal');
    const skins = t.view.attachOptions?.skins;
    expect(skins?.sides[0].get('rifle')?.id).toBe('placeholder-common-1');
    expect(skins?.sides[1].get('rifle')?.id).toBe('placeholder-uncommon-2');
    const config = t.app.session?.battle.config as unknown as Record<string, unknown>;
    expect(JSON.stringify(Object.keys(config))).not.toMatch(/skin|cosmetic|worn/i);
    // Nothing worn: the view is handed nothing at all.
    const bare = makeApp({ cosmetics: true });
    bare.app.startMission(1, 'normal');
    expect(bare.view.attachOptions && 'skins' in bare.view.attachOptions).toBe(false);
  });

  it('every third first win earns a Standard Crate, said on the result screen, and finishing the campaign one more', () => {
    const t = makeApp({ cosmetics: true });
    win(t, 1);
    expect(t.app.lastResult && 'cratesEarned' in t.app.lastResult).toBe(false);
    t.app.onScreen('campaign');
    win(t, 2);
    t.app.onScreen('campaign');
    win(t, 3);
    expect(t.app.lastResult?.cratesEarned).toBe('Supply crate earned');
    expect(cratesHeld(loadSave(t.storage).data, 'standard')).toBe(1);
    t.app.onScreen('campaign');
    // A replay is not a first win.
    win(t, 3);
    expect(t.app.lastResult && 'cratesEarned' in t.app.lastResult).toBe(false);
    t.app.onScreen('campaign');
    // The fourth mission completes this four-mission campaign: one for the campaign.
    win(t, 4);
    expect(t.app.lastResult?.cratesEarned).toBe('Supply crate earned');
    expect(cratesHeld(t.app.save, 'standard')).toBe(2);
    // A held crate is opened without medals.
    const medals = t.app.save.medals;
    const opened = t.app.openCrate('standard');
    expect(opened).not.toBeNull();
    expect(t.app.save.medals).toBe(medals + (opened?.medals ?? 0));
    expect(cratesHeld(loadSave(t.storage).data, 'standard')).toBe(1);
  });

  it('switched on later, the crates already earned are handed out once', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    for (const id of [1, 2, 3]) save.cleared[String(id)] = ['normal'];
    writeSave(storage, save);
    const off = makeApp({ storage });
    expect('cosmetics' in off.app.save).toBe(false);
    off.app.setCosmeticsEnabled(true);
    expect(cratesHeld(off.app.save, 'standard')).toBe(1);
    off.app.setCosmeticsEnabled(false);
    off.app.setCosmeticsEnabled(true);
    expect(cratesHeld(off.app.save, 'standard')).toBe(1);
    // And an app that starts with them on does the same at once.
    const on = makeApp({ storage, cosmetics: true });
    expect(cratesHeld(on.app.save, 'standard')).toBe(1);
  });
});

describe('where crates are not sold (a platform\'s switch)', () => {
  it('no crate can be bought and no price is shown; the free ones stay and can be opened', () => {
    let buying = false;
    const t = makeApp({ cosmetics: true, buying: () => buying });
    t.app.giveMedals(9000);
    const crates = t.app.campaign().crates;
    expect(crates?.cards.map((c) => [c.id, c.state])).toEqual([['standard', 'none']]);
    expect(t.app.buyCrate('standard')).toBeNull();
    expect(t.app.save.medals).toBe(9000);
    t.app.giveCrates('standard', 1);
    t.app.giveCrates('elite', 1);
    expect(t.app.campaign().crates?.cards.map((c) => [c.id, c.held, c.state])).toEqual([
      ['standard', 1, 'none'],
      ['elite', 1, 'none'],
    ]);
    expect(t.app.openCrate('standard')).not.toBeNull();
    // Asked each time: sold again as soon as the platform says so.
    buying = true;
    expect(t.app.campaign().crates?.cards).toHaveLength(5);
    expect(t.app.buyCrate('standard')).not.toBeNull();
  });
});

describe('a platform\'s once-only grant of a crate or an item', () => {
  it('is written with its id before it returns, survives a restart, and is not given twice', () => {
    const storage = createMemoryStorage();
    const t = makeApp({ storage });
    // Whether or not cosmetics show here: what a platform gives is kept.
    expect(t.app.grantCrate('premium', 'g-1')).toBe('granted');
    expect(t.app.grantItem('placeholder-special-1', 'g-2')).toBe('granted');
    const stored = loadSave(storage).data;
    expect(stored.cosmetics?.crates).toEqual({ premium: 1 });
    expect(stored.cosmetics?.owned).toEqual(['placeholder-special-1']);
    expect(stored.grants).toEqual(['g-1', 'g-2']);
    const again = makeApp({ storage });
    expect(again.app.grantCrate('premium', 'g-1')).toBe('already');
    expect(again.app.grantItem('placeholder-special-1', 'g-2')).toBe('already');
    expect(again.app.grantCrate('god', 'g-3')).toBe('failed');
    expect(again.app.grantItem('nothing', 'g-3')).toBe('failed');
    expect(loadSave(storage).data).toEqual(stored);
  });

  it('is not given when the save cannot be written', () => {
    const inner = createMemoryStorage();
    let refuse = false;
    const storage: StorageLike = {
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => {
        if (refuse) throw new Error('full');
        inner.setItem(k, v);
      },
      removeItem: (k) => inner.removeItem(k),
    };
    const t = makeApp({ storage });
    expect(t.app.grantItem('placeholder-common-1', 'first')).toBe('granted');
    refuse = true;
    expect(t.app.grantCrate('standard', 'second')).toBe('failed');
    expect(t.app.grantItem('placeholder-common-2', 'third')).toBe('failed');
    expect(t.app.save.cosmetics).toEqual({ ...cosmeticsOf(defaultSave()), owned: ['placeholder-common-1'] });
    expect(t.app.save.grants).toEqual(['first']);
    expect(makeApp({ storage: null }).app.grantCrate('standard', 'x')).toBe('failed');
  });
});

describe('the view models alone', () => {
  it('are built from a save without touching it', () => {
    const save = defaultSave();
    giveItem(save, 'placeholder-mythic-2');
    const before = JSON.stringify(save);
    buildCratesView(save, true);
    buildCratesView(save, false);
    expect(buildAppearanceView(save, 'soviet').items[0].appliesTo).toBe('Sniper · Red Army');
    expect(JSON.stringify(save)).toBe(before);
  });
});

describe('visual only', () => {
  /** A whole battle on the proving ground, the bot against the AI, seen through the app with this save. */
  function fingerprint(save: SaveData, cosmetics: boolean): { print: string; skins: boolean } {
    const storage = createMemoryStorage();
    writeSave(storage, save);
    const t = makeApp({ storage, cosmetics });
    t.app.autopilot = true;
    t.app.beginUnlisted(SANDBOX, 'normal', 4);
    const battle = t.app.session?.battle;
    if (!battle) throw new Error('no battle');
    const end = 90 * CONFIG.tickRate;
    for (let i = 0; i < 4000 && battle.state.tick < end && !battle.state.over; i++) frames(t.view, 1, 250);
    const s = battle.state;
    const xs: number[] = [];
    for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive) xs.push(s.units[i].x, s.units[i].hp, s.units[i].side);
    return { print: JSON.stringify([s.tick, summarize(battle), xs, s.sides[0].supplies, s.sides[1].supplies]), skins: Boolean(t.view.attachOptions?.skins) };
  }

  it('a battle plays tick for tick the same with every item worn as with none', () => {
    const plain = fingerprint(defaultSave(), true);
    const dressed = defaultSave();
    for (const item of COSMETICS.items) {
      giveItem(dressed, item.id);
      wearItem(dressed, item.id);
    }
    const worn = fingerprint(dressed, true);
    // The dressed battle really was handed its skins, and the plain one none.
    expect(plain.skins).toBe(false);
    expect(worn.skins).toBe(true);
    expect(worn.print).toBe(plain.print);
    // And the same again with the feature switched off altogether.
    expect(fingerprint(dressed, false).print).toBe(plain.print);
    expect(JSON.parse(plain.print)[0]).toBeGreaterThan(1000);
  });
});
