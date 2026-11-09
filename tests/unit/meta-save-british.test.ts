/**
 * The step to save version 10: the ten British placeholder missions (ids 1 to 10) are removed (owner, docs/QUEUE.md
 * "The current missions are placeholders"). An old save that won all ten, bought units while they were sold, bought
 * plane call-ins and upgrades, and finished Basic Training loses nothing it earned: medals, upgrade levels, the planes,
 * every unit type the British missions unlocked and the Basic Training record stay; the British clears and wins are
 * archived in the save's `legacy` block; and the game starts, shows the Stalingrad map and plays its first mission
 * with that army without a crash.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { MEDALS } from '../../src/data/medals';
import { META } from '../../src/data/meta';
import { MISSIONS } from '../../src/data/missions';
import type { Difficulty, UnitKind } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import { createMemoryStorage, isUnlocked, loadSave, migrateSave, pointsSpent, playerUnitKinds, sanitizeSave, unitsUnlocked, writeSave } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

const BRITISH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const RULES = { missionIds: MISSIONS.map((m) => m.id), campaigns: [MISSIONS.map((m) => m.id)], upgradeDefs: UPGRADES };

/** Every type the ten British missions unlocked between them (the free sappers and riflemen aside). */
const BRITISH_KINDS: UnitKind[] = ['lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'commander', 'aa'];

const SETTINGS = { muted: true, difficulty: 'hard', hints: false, musicVolume: 41, ambienceVolume: 12, sfxVolume: 77, reduceFlash: true, showBlood: false, showFps: true };
const UPGRADE_LEVELS = { hqHealth: 3, hqIncome: 2, rifleHealth: 1, tankDamage: 2, bomberTurnaround: 1 };

function cleared(): Record<string, Difficulty[]> {
  const out: Record<string, Difficulty[]> = {};
  for (const id of BRITISH) out[String(id)] = id <= 3 ? ['normal', 'hard'] : ['normal'];
  return out;
}

function wins(): Record<string, Partial<Record<Difficulty, number>>> {
  const out: Record<string, Partial<Record<Difficulty, number>>> = {};
  for (const id of BRITISH) out[String(id)] = id <= 3 ? { normal: 2, hard: 1 } : { normal: 1 };
  return out;
}

/** A version 9 save (v0.12.0): all ten British missions won, planes and upgrades bought, Basic Training finished. */
function v9(): Record<string, unknown> {
  return {
    version: 9,
    cleared: cleared(),
    upgrades: { ...UPGRADE_LEVELS },
    medals: 777,
    // Unit types bought while units were sold (kept by the step to version 8) and plane call-ins.
    armoury: ['lmg', 'tank', 'bomber', 'recon'],
    wins: wins(),
    lastMission: 10,
    training: { done: true, skipped: false },
    settings: { ...SETTINGS },
  };
}

/** The same player a version earlier, as v0.11.0 wrote it: units bought in the Armoury, no Basic Training yet. */
function v7(): Record<string, unknown> {
  return {
    version: 7,
    cleared: cleared(),
    upgrades: { hqHealth: 1, hqIncome: 1 },
    medals: 300,
    armoury: ['lmg', 'tank', 'flame', 'bomber'],
    wins: wins(),
    lastMission: 7,
    settings: { ...SETTINGS },
  };
}

function appOn(storage: ReturnType<typeof createMemoryStorage>) {
  const view = createFakeView();
  const ui = createFakeUi();
  const app = new App({ view, audio: createFakeAudio(), storage, random: () => 0.25 });
  app.attachUi(ui);
  return { app, view, ui };
}

describe('save version 10: the British placeholder missions removed', () => {
  it('is the current version', () => {
    expect(META.saveVersion).toBe(11);
    expect(META.legacyCampaign.ids).toEqual(BRITISH);
  });

  it('keeps the medals, upgrades, planes, Basic Training and settings of a player who won all ten', () => {
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v9()) }), RULES);
    expect(loaded.status).toBe('ok');
    const data = loaded.data;
    expect(data.version).toBe(11);
    expect(data.medals).toBe(777);
    expect(data.upgrades).toEqual(UPGRADE_LEVELS);
    expect(pointsSpent(data, UPGRADES)).toBeGreaterThan(0);
    // The planes bought for good became charges in version 11 (worth at least what they cost).
    for (const plane of ['bomber', 'recon'] as const) expect(data.charges[plane] ?? 0, plane).toBeGreaterThanOrEqual(MEDALS.legacyPlaneMinCharges);
    expect(data.training).toEqual({ done: true, skipped: false });
    expect(data.settings).toEqual(SETTINGS);
  });

  it('keeps every unit type the British missions unlocked or the player bought, unlocked', () => {
    const data = sanitizeSave(v9(), RULES);
    if (!data) throw new Error('not loaded');
    for (const kind of BRITISH_KINDS) expect(data.armoury, kind).toContain(kind);
    // Listed once each, and never the free types.
    expect(new Set(data.armoury).size).toBe(data.armoury.length);
    for (const kind of MEDALS.free) expect(data.armoury).not.toContain(kind);
    // So the whole army is unlocked from the first Stalingrad mission on.
    const ids = MISSIONS.map((m) => m.id);
    const unlocked = unitsUnlocked(data, MISSIONS, (id) => isUnlocked(data, ids, id));
    for (const kind of playerUnitKinds()) expect(unlocked, kind).toContain(kind);
  });

  it('archives the British clears and wins in the legacy block, and counts nothing of them in Stalingrad', () => {
    const data = sanitizeSave(v9(), RULES);
    if (!data) throw new Error('not loaded');
    expect(data.legacy).toEqual({ cleared: cleared(), wins: wins() });
    expect(data.cleared).toEqual({});
    expect(data.wins).toEqual({});
    // The map opened on mission 10, which is gone: it opens on Stalingrad's first.
    expect(data.lastMission).toBe(0);
  });

  it('migrates the same player from version 7: units bought then are refunded and stay unlocked, the rest is kept', () => {
    const data = sanitizeSave(v7(), RULES);
    if (!data) throw new Error('not loaded');
    const refunds = (MEDALS.unitRefunds.lmg ?? 0) + (MEDALS.unitRefunds.tank ?? 0) + (MEDALS.unitRefunds.flame ?? 0);
    // Version 8 gave back the units' prices and the upgrade re-pricing (each of the two first levels costs 10 less now).
    expect(data.medals).toBe(300 + refunds + 2 * (META.legacyUpgradeLevelMedals - 10));
    expect(data.upgrades).toEqual({ hqHealth: 1, hqIncome: 1 });
    expect(data.charges.bomber ?? 0).toBeGreaterThanOrEqual(MEDALS.legacyPlaneMinCharges);
    for (const kind of BRITISH_KINDS) expect(data.armoury, kind).toContain(kind);
    expect(data.legacy?.cleared).toEqual(cleared());
    expect(data.training).toEqual({ done: false, skipped: false });
  });

  it.each([
    ['version 1 (v0.1)', { version: 1, cleared: { '1': ['normal', 'hard'], '2': ['normal'], '3': ['normal'] }, upgrades: { rifleHealth: 2 }, settings: { muted: true, difficulty: 'hard', hints: false } }],
    ['version 5 (points)', { version: 5, cleared: { '1': ['normal', 'hard'], '2': ['normal'], '3': ['normal'] }, upgrades: { rifleHealth: 2 }, lastMission: 3, settings: { ...SETTINGS } }],
  ])('brings a %s save with British clears all the way to version 10 without losing them', (_name, doc) => {
    const data = sanitizeSave(doc, RULES);
    if (!data) throw new Error('not loaded');
    expect(data.version).toBe(11);
    // The upgrade bought with the points stays, and the clears and their wins are archived, not dropped.
    expect(data.upgrades.rifleHealth).toBe(2);
    expect(data.legacy?.cleared).toEqual({ '1': ['normal', 'hard'], '2': ['normal'], '3': ['normal'] });
    expect(data.legacy?.wins).toEqual({ '1': { normal: 1, hard: 1 }, '2': { normal: 1 }, '3': { normal: 1 } });
    expect(data.cleared).toEqual({});
    expect(data.lastMission).toBe(0);
    // Missions 1 to 3 cleared and mission 4 reached: their types stay unlocked.
    expect(data.armoury).toEqual(['lmg', 'assault', 'mortar']);
    expect(data.medals).toBeGreaterThanOrEqual(0);
  });

  it('keeps the types of the mission a player had reached but not cleared', () => {
    // Missions 1 to 4 won: mission 5 was open, so its sniper and lieutenant were unlocked; mission 6's medic was not.
    const partial = { ...v9(), cleared: { '1': ['normal'], '2': ['normal'], '3': ['normal'], '4': ['normal'] }, armoury: [] };
    const data = sanitizeSave(partial, RULES);
    expect(data?.armoury).toEqual(['lmg', 'assault', 'mortar', 'sniper', 'commander']);
  });

  it('gives a player with no British progress no legacy block, and changes nothing else', () => {
    const fresh = { ...v9(), cleared: {}, wins: {}, armoury: ['bomber'], lastMission: 0 };
    const data = sanitizeSave(fresh, RULES);
    expect(data?.legacy).toBeUndefined();
    // The first British mission was always open: its types were the free ones.
    expect(data?.armoury).toEqual([]);
    expect(data?.charges.bomber).toBe(MEDALS.legacyPlaneMinCharges);
    expect(data?.medals).toBe(777);
  });

  it('keeps Stalingrad progress a version 9 save made on the dev server', () => {
    const dev = { ...v9(), cleared: { ...cleared(), '1001': ['normal'], '1002': ['hard'] }, wins: { ...wins(), '1001': { normal: 1 } }, lastMission: 1002 };
    const data = sanitizeSave(dev, RULES);
    expect(data?.cleared).toEqual({ '1001': ['normal'], '1002': ['hard'] });
    expect(data?.wins).toEqual({ '1001': { normal: 1 } });
    expect(data?.lastMission).toBe(1002);
    expect(data?.legacy?.cleared).toEqual(cleared());
  });

  it('is stable: the migrated save writes and reads back unchanged, and the old document is left alone', () => {
    const doc = v9();
    const copy = structuredClone(doc);
    const data = sanitizeSave(doc, RULES);
    if (!data) throw new Error('not loaded');
    expect(doc).toEqual(copy);
    expect(migrateSave(doc)?.version).toBe(11);
    const storage = createMemoryStorage();
    writeSave(storage, data);
    expect(loadSave(storage, RULES)).toEqual({ data, status: 'ok' });
  });

  it('starts the game on it: the Stalingrad map, the whole army in the Armoury, and the first mission with that army', () => {
    const storage = createMemoryStorage({ [META.saveKey]: JSON.stringify(v9()) });
    const { app, view } = appOn(storage);
    expect(app.save.medals).toBe(777);
    const view0 = app.campaign();
    expect(view0.campaignId).toBe('stalingrad');
    expect(view0.missions.map((m) => m.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    expect(view0.lastMission).toBe(0);
    expect(view0.medals).toBe(777);
    expect(view0.upgrades.find((u) => u.id === 'hqHealth')?.level).toBe(3);
    // Every unit type is owned in the Shop, and the bought planes are charges.
    for (const item of view0.armoury ?? []) if (item.type === 'unit') expect(item.owned, item.kind).toBe(true);
    for (const plane of ['bomber', 'recon']) expect(view0.armoury?.find((a) => a.id === plane)?.count ?? 0).toBeGreaterThanOrEqual(MEDALS.legacyPlaneMinCharges);
    // Brest brings nothing new to this player: the DP gunner and the tank hunters were unlocked in the British campaign.
    expect(view0.missions[0].newUnit).toBeNull();
    // From the briefing, with the Armoury's army: it fields every unlocked type and the bought planes.
    app.startMission(1001, 'normal');
    const train = app.session?.hud.state.train.map((b) => b.kind) ?? [];
    for (const kind of ['tank', 'flame', 'apc', 'aa', 'sniper'] as const) expect(train, kind).toContain(kind);
    expect(app.session?.battle.config.upgrades).toEqual(UPGRADE_LEVELS);
    for (let i = 0; i < 300 && app.session && !app.session.ended; i++) view.frame?.(100);
    expect(app.session?.battle.state.time).toBeGreaterThan(0);
    // Starting a mission saved it, still with everything it earned.
    const again = loadSave(storage, RULES);
    expect(again.status).toBe('ok');
    expect(again.data.medals).toBe(777);
    expect(again.data.lastMission).toBe(1001);
    expect(again.data.legacy?.cleared).toEqual(cleared());
    // A British mission id starts nothing.
    expect(app.beginMission(1, 'normal')).toBe(false);
  });
});
