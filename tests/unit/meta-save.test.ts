import { describe, expect, it } from 'vitest';
import { DIFFICULTY_LIST } from '../../src/data/difficulty';
import { MEDALS } from '../../src/data/medals';
import { META } from '../../src/data/meta';
import type { UpgradeDef } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import {
  cleanSetting,
  clearSave,
  createMemoryStorage,
  defaultSave,
  defaultSettings,
  loadSave,
  maxLevel,
  migrateSave,
  pointsEarned,
  pointsSpent,
  recordClear,
  sanitizeSave,
  writeSave,
  type SaveData,
  type StorageLike,
} from '../../src/meta';

function failingStorage(): StorageLike {
  return {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('full');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
}

describe('save data', () => {
  it('starts fresh when nothing is stored', () => {
    const result = loadSave(createMemoryStorage());
    expect(result.status).toBe('fresh');
    expect(result.data).toEqual(defaultSave());
  });

  it('round-trips progress, upgrades and settings', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    recordClear(save, 1, 'normal');
    recordClear(save, 1, 'hard');
    recordClear(save, 2, 'normal');
    save.upgrades = { sapperDrill: 2, riflemanHealth: 3 };
    save.settings = { muted: true, difficulty: 'hard', hints: false, musicVolume: 35, ambienceVolume: 0, sfxVolume: 72, reduceFlash: true, showBlood: false };
    expect(writeSave(storage, save)).toBe(true);

    const loaded = loadSave(storage);
    expect(loaded.status).toBe('ok');
    expect(loaded.data).toEqual(save);
  });

  it('falls back to defaults on text that is not JSON', () => {
    const storage = createMemoryStorage({ [META.saveKey]: '{"version": 1, "cleared": {' });
    const result = loadSave(storage);
    expect(result.status).toBe('corrupt');
    expect(result.data).toEqual(defaultSave());
  });

  it.each([
    ['null', 'null'],
    ['an array', '[1,2,3]'],
    ['a number', '42'],
    ['no version', '{"cleared":{"1":["normal"]}}'],
    ['a version from the future', JSON.stringify({ version: META.saveVersion + 1, cleared: { '1': ['normal'] } })],
    ['a fractional version', '{"version": 1.5}'],
  ])('falls back to defaults on %s', (_name, text) => {
    const result = loadSave(createMemoryStorage({ [META.saveKey]: text }));
    expect(result.status).toBe('corrupt');
    expect(result.data).toEqual(defaultSave());
  });

  it('keeps the good parts of a partly damaged save', () => {
    // Written as text so that "__proto__" really is an own key after parsing.
    const damaged =
      '{"version":1,' +
      '"cleared":{"1":["normal","normal","nightmare"],"2":"yes","abc":["hard"],"0":["normal"],"3":[]},' +
      '"upgrades":{"good":2,"tooHigh":99,"zero":0,"negative":-1,"fractional":1.5,"text":"two","__proto__":3,"bad key!":1},' +
      '"settings":{"muted":"yes","difficulty":"insane","hints":false}}';
    const data = sanitizeSave(JSON.parse(damaged));
    expect(data).not.toBeNull();
    expect(data?.cleared).toEqual({ '1': ['normal'] });
    expect(data?.upgrades).toEqual({ good: 2, tooHigh: META.maxUpgradeLevel });
    // A version 1 save has no volumes: they come in at their defaults.
    expect(data?.settings).toEqual({ ...defaultSettings(), muted: META.defaultMuted, difficulty: 'insane', hints: false });
    expect(Object.getPrototypeOf(data?.upgrades)).toBe(Object.prototype);
  });

  it('never throws when the storage does', () => {
    const storage = failingStorage();
    expect(loadSave(storage).data).toEqual(defaultSave());
    expect(writeSave(storage, defaultSave())).toBe(false);
    expect(() => clearSave(storage)).not.toThrow();
  });

  it('works without any storage', () => {
    expect(loadSave(null).status).toBe('fresh');
    expect(writeSave(null, defaultSave())).toBe(false);
    expect(() => clearSave(null)).not.toThrow();
  });

  it('clearSave removes the stored save', () => {
    const storage = createMemoryStorage();
    writeSave(storage, defaultSave());
    clearSave(storage);
    expect(loadSave(storage).status).toBe('fresh');
  });
});

describe('migration', () => {
  /** A save as version 1 wrote it (no lastMission). */
  const v1 = {
    version: 1,
    cleared: { '1': ['normal', 'hard'], '2': ['normal'] },
    upgrades: { rifleHealth: 2 },
    settings: { muted: true, difficulty: 'hard', hints: false },
  };

  it('brings a version 1 save up to the current version and keeps everything in it', () => {
    const migrated = migrateSave(v1);
    expect(migrated?.version).toBe(META.saveVersion);
    expect(migrated?.lastMission).toBe(0);
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v1) }));
    expect(loaded.status).toBe('ok');
    // Medals (version 6): 2 cleared missions earned 4 points, 2 were spent, so 2 points become medals; the Bren gun
    // of mission 2 counts as bought, and each cleared mission and difficulty as one win.
    expect(loaded.data).toEqual({
      version: META.saveVersion,
      cleared: v1.cleared,
      upgrades: v1.upgrades,
      medals: 2 * META.legacyPointMedals,
      armoury: ['lmg'],
      wins: { '1': { normal: 1, hard: 1 }, '2': { normal: 1 } },
      lastMission: 0,
      settings: { ...defaultSettings(), ...v1.settings },
    });
  });

  it('does not change the document it was given', () => {
    const copy = structuredClone(v1);
    migrateSave(copy);
    expect(copy).toEqual(v1);
  });

  it('leaves a current save as it is', () => {
    const save = defaultSave();
    recordClear(save, 1, 'insane');
    save.lastMission = 1;
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it.each([
    ['version 0', { version: 0 }],
    ['a negative version', { version: -3 }],
    ['a version as text', { version: '1' }],
    ['a fractional version', { version: 1.5 }],
    ['no version', {}],
    ['a version from the future', { version: META.saveVersion + 1 }],
    ['an array', [{ version: 1 }]],
  ])('does not understand %s', (_name, doc) => {
    expect(migrateSave(doc)).toBeNull();
    expect(sanitizeSave(doc)).toBeNull();
  });
});

describe('version 3: the volume sliders and reduce flashing', () => {
  /** A save as version 2 wrote it (no volumes, no reduce flashing). */
  const v2 = {
    version: 2,
    cleared: { '1': ['normal'] },
    upgrades: { rifleHealth: 1 },
    lastMission: 1,
    settings: { muted: true, difficulty: 'hard', hints: false },
  };

  it('is behind the current version, 6 (medals and the Armoury joined the save in version 6)', () => {
    expect(META.saveVersion).toBe(6);
    expect(defaultSave().version).toBe(6);
  });

  it('starts a fresh save on the default volumes from the data, with flashing as normal', () => {
    expect(defaultSave().settings).toEqual({
      muted: META.defaultMuted,
      difficulty: META.defaultDifficulty,
      hints: META.defaultHints,
      musicVolume: META.defaultMusicVolume,
      ambienceVolume: META.defaultAmbienceVolume,
      sfxVolume: META.defaultSfxVolume,
      reduceFlash: false,
      showBlood: true,
    });
    for (const v of [META.defaultMusicVolume, META.defaultAmbienceVolume, META.defaultSfxVolume]) {
      expect(Number.isInteger(v) && v >= 0 && v <= 100).toBe(true);
    }
  });

  it('migrates a version 2 save step by step and keeps what the player had set', () => {
    const migrated = migrateSave(v2);
    expect(migrated?.version).toBe(META.saveVersion);
    expect(migrated?.settings).toEqual({ ...v2.settings, musicVolume: META.defaultMusicVolume, ambienceVolume: META.defaultAmbienceVolume, sfxVolume: META.defaultSfxVolume, reduceFlash: false, showBlood: true });
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v2) }));
    expect(loaded.status).toBe('ok');
    expect(loaded.data.version).toBe(META.saveVersion);
    expect(loaded.data.lastMission).toBe(1);
    expect(loaded.data.settings).toEqual({ ...defaultSettings(), muted: true, difficulty: 'hard', hints: false });
    // A version 1 save goes through both steps.
    const v1 = { version: 1, cleared: {}, upgrades: {}, settings: { muted: false, difficulty: 'insane', hints: true } };
    expect(sanitizeSave(v1)?.settings).toEqual({ ...defaultSettings(), difficulty: 'insane' });
  });

  it('migrates a version 2 save whose settings are missing or damaged without failing', () => {
    expect(sanitizeSave({ ...v2, settings: undefined })?.settings).toEqual(defaultSettings());
    expect(sanitizeSave({ ...v2, settings: 'loud' })?.settings).toEqual(defaultSettings());
    expect(sanitizeSave({ ...v2, settings: [1, 2] })?.settings).toEqual(defaultSettings());
  });

  it('round-trips the three volumes and reduce flashing', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    save.settings = { ...save.settings, musicVolume: 0, ambienceVolume: 47, sfxVolume: 100, reduceFlash: true };
    writeSave(storage, save);
    expect(loadSave(storage).data.settings).toEqual(save.settings);
  });

  it.each([
    ['above 100', 250, 100],
    ['below 0', -12, 0],
    ['a fraction', 33.6, 34],
    ['a tiny fraction', 0.2, 0],
    ['text', '80', 'default'],
    ['NaN', Number.NaN, 'default'],
    ['infinity', Number.POSITIVE_INFINITY, 'default'],
    ['null', null, 'default'],
    ['a boolean', true, 'default'],
  ])('clamps a stored volume that is %s', (_name, stored, expected) => {
    const doc = { version: 3, cleared: {}, upgrades: {}, settings: { musicVolume: stored, ambienceVolume: stored, sfxVolume: stored } };
    const s = sanitizeSave(doc)?.settings;
    expect(s).toBeDefined();
    expect(s?.musicVolume).toBe(expected === 'default' ? META.defaultMusicVolume : expected);
    expect(s?.ambienceVolume).toBe(expected === 'default' ? META.defaultAmbienceVolume : expected);
    expect(s?.sfxVolume).toBe(expected === 'default' ? META.defaultSfxVolume : expected);
  });

  it('accepts only true or false for reduce flashing', () => {
    const doc = (v: unknown) => ({ version: 3, settings: { reduceFlash: v } });
    expect(sanitizeSave(doc(true))?.settings.reduceFlash).toBe(true);
    expect(sanitizeSave(doc(false))?.settings.reduceFlash).toBe(false);
    for (const bad of ['yes', 1, null, {}, []]) expect(sanitizeSave(doc(bad))?.settings.reduceFlash).toBe(META.defaultReduceFlash);
  });

  it('cleans one setting the way the app applies a change', () => {
    expect(cleanSetting('musicVolume', 140)).toBe(100);
    expect(cleanSetting('ambienceVolume', -1)).toBe(0);
    expect(cleanSetting('sfxVolume', 49.5)).toBe(50);
    expect(cleanSetting('sfxVolume', Number.NaN)).toBe(META.defaultSfxVolume);
    expect(cleanSetting('reduceFlash', 'on')).toBe(META.defaultReduceFlash);
    expect(cleanSetting('muted', true)).toBe(true);
    expect(cleanSetting('difficulty', 'nightmare')).toBe(META.defaultDifficulty);
    expect(cleanSetting('difficulty', 'hard')).toBe('hard');
  });
});

describe('version 4: the menu mix moved the default volumes', () => {
  const v3 = (volumes: { musicVolume: number; ambienceVolume: number; sfxVolume: number }) => ({
    version: 3,
    cleared: { '1': ['normal'] },
    upgrades: {},
    lastMission: 1,
    settings: { muted: false, difficulty: 'normal', hints: true, reduceFlash: true, ...volumes },
  });
  const old = META.v3DefaultVolumes;

  it('changed the defaults, and keeps them in data', () => {
    expect([META.defaultMusicVolume, META.defaultAmbienceVolume, META.defaultSfxVolume]).not.toEqual([old.music, old.ambience, old.sfx]);
    // Headroom: no default sits at the top of its slider.
    for (const v of [META.defaultMusicVolume, META.defaultAmbienceVolume, META.defaultSfxVolume]) expect(v).toBeLessThan(100);
  });

  it('moves sliders a player never touched (still at the old defaults) to the new defaults', () => {
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v3({ musicVolume: old.music, ambienceVolume: old.ambience, sfxVolume: old.sfx })) }));
    expect(loaded.status).toBe('ok');
    expect(loaded.data.version).toBe(META.saveVersion);
    expect(loaded.data.settings).toEqual({ ...defaultSettings(), reduceFlash: true });
    // Everything else in the save is untouched.
    expect(loaded.data.cleared).toEqual({ '1': ['normal'] });
    expect(loaded.data.lastMission).toBe(1);
  });

  it('keeps every slider the player moved, each on its own', () => {
    const s = sanitizeSave(v3({ musicVolume: 35, ambienceVolume: old.ambience, sfxVolume: 61 }))?.settings;
    expect(s?.musicVolume).toBe(35);
    expect(s?.ambienceVolume).toBe(META.defaultAmbienceVolume);
    expect(s?.sfxVolume).toBe(61);
    // Damaged volumes in a version 3 save are still cleaned afterwards.
    const bad = sanitizeSave(v3({ musicVolume: 400, ambienceVolume: -3, sfxVolume: Number.NaN }))?.settings;
    expect([bad?.musicVolume, bad?.ambienceVolume, bad?.sfxVolume]).toEqual([100, 0, META.defaultSfxVolume]);
  });

  it('leaves a version 4 save alone, a slider at full included', () => {
    const doc = { ...v3({ musicVolume: 100, ambienceVolume: 100, sfxVolume: 100 }), version: 4 };
    const s = sanitizeSave(doc)?.settings;
    expect([s?.musicVolume, s?.ambienceVolume, s?.sfxVolume]).toEqual([100, 100, 100]);
  });

  it('does not change the document it migrates', () => {
    const doc = v3({ musicVolume: old.music, ambienceVolume: 20, sfxVolume: old.sfx });
    const copy = structuredClone(doc);
    migrateSave(doc);
    expect(doc).toEqual(copy);
  });
});

describe('version 5: "Show blood"', () => {
  const v4 = (settings: Record<string, unknown>) => ({
    version: 4,
    cleared: { '1': ['normal'], '2': ['hard'] },
    upgrades: { rifleHealth: 1 },
    lastMission: 2,
    settings: { muted: true, difficulty: 'hard', hints: false, musicVolume: 35, ambienceVolume: 60, sfxVolume: 90, reduceFlash: true, ...settings },
  });

  it('is on in a fresh save', () => {
    expect(META.defaultShowBlood).toBe(true);
    expect(defaultSettings().showBlood).toBe(true);
    expect(defaultSave().settings.showBlood).toBe(true);
  });

  it('turns blood on for a version 4 save and keeps everything else as it was', () => {
    const migrated = migrateSave(v4({}));
    expect(migrated?.version).toBe(META.saveVersion);
    expect(migrated?.settings).toEqual({ ...v4({}).settings, showBlood: true });
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v4({})) }));
    expect(loaded.status).toBe('ok');
    expect(loaded.data.version).toBe(META.saveVersion);
    expect(loaded.data.settings).toEqual({ muted: true, difficulty: 'hard', hints: false, musicVolume: 35, ambienceVolume: 60, sfxVolume: 90, reduceFlash: true, showBlood: true });
    expect(loaded.data.cleared).toEqual({ '1': ['normal'], '2': ['hard'] });
    expect(loaded.data.upgrades).toEqual({ rifleHealth: 1 });
    expect(loaded.data.lastMission).toBe(2);
  });

  it('turns blood on for every older save, whatever an older copy of the game wrote there', () => {
    // A version 4 save has no "showBlood"; anything found there is from before the setting existed.
    expect(sanitizeSave(v4({ showBlood: false }))?.settings.showBlood).toBe(true);
    for (const version of [1, 2, 3]) {
      expect(sanitizeSave({ version, cleared: {}, upgrades: {}, settings: { muted: false, difficulty: 'normal', hints: true } })?.settings.showBlood).toBe(true);
    }
  });

  it('migrates a version 4 save without settings without failing', () => {
    expect(sanitizeSave({ ...v4({}), settings: undefined })?.settings).toEqual(defaultSettings());
    expect(sanitizeSave({ ...v4({}), settings: 'gory' })?.settings).toEqual(defaultSettings());
  });

  it('round-trips blood turned off', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    save.settings.showBlood = false;
    expect(writeSave(storage, save)).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded.status).toBe('ok');
    expect(loaded.data.settings.showBlood).toBe(false);
  });

  it('accepts only true or false, anything else is the default (on)', () => {
    const doc = (v: unknown) => ({ version: 5, settings: { showBlood: v } });
    expect(sanitizeSave(doc(true))?.settings.showBlood).toBe(true);
    expect(sanitizeSave(doc(false))?.settings.showBlood).toBe(false);
    for (const bad of ['off', 0, 1, null, {}, [], undefined]) expect(sanitizeSave(doc(bad))?.settings.showBlood).toBe(true);
    expect(cleanSetting('showBlood', false)).toBe(false);
    expect(cleanSetting('showBlood', 'no')).toBe(true);
  });

  it('does not change the document it migrates', () => {
    const doc = v4({});
    const copy = structuredClone(doc);
    migrateSave(doc);
    expect(doc).toEqual(copy);
  });
});

describe('a save checked against the game', () => {
  const rules = { missionIds: [1, 2, 3, 4, 5], upgradeDefs: UPGRADES };
  const doc = (extra: Record<string, unknown>) => ({ version: META.saveVersion, ...extra });

  it('drops progress on missions that do not exist', () => {
    const data = sanitizeSave(doc({ cleared: { '1': ['normal'], '2': ['hard'], '77': ['normal'] } }), rules);
    expect(Object.keys(data?.cleared ?? {})).toEqual(['1', '2']);
  });

  it('stops progress at the first mission that was not cleared', () => {
    const data = sanitizeSave(doc({ cleared: { '1': ['normal'], '3': ['normal'], '4': ['hard'] } }), rules);
    expect(data?.cleared).toEqual({ '1': ['normal'] });
  });

  it('drops unknown upgrades and caps every level at the upgrade maximum', () => {
    const data = sanitizeSave(
      doc({
        cleared: { '1': ['normal'], '2': ['normal'], '3': ['normal'] },
        upgrades: { rifleHealth: 7, hqIncome: 2, notAnUpgrade: 1 },
      }),
      rules,
    );
    expect(data?.upgrades).toEqual({ hqIncome: 2, rifleHealth: 3 });
  });

  // Since medals (version 6) upgrades are paid for when bought, so only a save from before medals is checked against
  // the points it earned; a version 6 save keeps its levels (capped) as they are.
  it('never keeps more points spent than earned in a save from before medals', () => {
    // Two missions cleared = 4 points, but 9 levels are claimed.
    const save = sanitizeSave(
      { ...doc({ cleared: { '1': ['normal'], '2': ['normal'] }, upgrades: { sapperDrill: 3, hqIncome: 3, hqHealth: 3 } }), version: 5 },
      rules,
    );
    expect(save).not.toBeNull();
    if (!save) return;
    expect(save.upgrades).toEqual({ sapperDrill: 3, hqIncome: 1 });
    expect(save.medals).toBe(0);
  });

  it('keeps no old upgrade when nothing was earned', () => {
    const data = sanitizeSave({ ...doc({ upgrades: { sapperDrill: 1, rifleHealth: 3 } }), version: 5 }, rules);
    expect(data?.upgrades).toEqual({});
    expect(data?.medals).toBe(0);
  });

  it('keeps the levels of a version 6 save, which were paid for in medals', () => {
    const data = sanitizeSave(doc({ upgrades: { sapperDrill: 1, rifleHealth: 3 }, medals: 15 }), rules);
    expect(data?.upgrades).toEqual({ sapperDrill: 1, rifleHealth: 3 });
    expect(data?.medals).toBe(15);
  });

  it('keeps the last mission only if the campaign has it', () => {
    expect(sanitizeSave(doc({ lastMission: 3 }), rules)?.lastMission).toBe(3);
    expect(sanitizeSave(doc({ lastMission: 6 }), rules)?.lastMission).toBe(0);
    expect(sanitizeSave(doc({ lastMission: 2.5 }), rules)?.lastMission).toBe(0);
    expect(sanitizeSave(doc({ lastMission: '3' }), rules)?.lastMission).toBe(0);
  });
});

/** A small seeded generator, so a failing garbage input can be reproduced. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = ['version', 'cleared', 'upgrades', 'settings', 'lastMission', 'muted', 'hints', 'difficulty', '1', '2', '3', '0', '-1', '99999', 'rifleHealth', 'hqIncome', 'sapperDrill', '__proto__', 'constructor', 'toString', ''];

function junk(rand: () => number, depth: number): unknown {
  const pick = Math.floor(rand() * (depth > 3 ? 7 : 10));
  switch (pick) {
    case 0:
      return null;
    case 1:
      return rand() < 0.5;
    case 2:
      return Math.floor(rand() * 10) - 3;
    case 3:
      return (rand() - 0.5) * 1e9;
    case 4:
      return ['normal', 'hard', 'insane', 'easy', '', 'x'.repeat(Math.floor(rand() * 90))][Math.floor(rand() * 6)];
    case 5:
      return [0, 1, 2, 1.5, 1e300, -1e300][Math.floor(rand() * 6)];
    case 6:
      return undefined;
    case 7:
    case 8: {
      const out: unknown[] = [];
      const n = Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) out.push(junk(rand, depth + 1));
      return out;
    }
    default: {
      // Parsed from text so that keys such as "__proto__" are real own keys, like in a stored save.
      const parts: string[] = [];
      const n = Math.floor(rand() * 6);
      for (let i = 0; i < n; i++) {
        const value = JSON.stringify(junk(rand, depth + 1)) ?? 'null';
        parts.push(`${JSON.stringify(KEYS[Math.floor(rand() * KEYS.length)])}:${value}`);
      }
      return JSON.parse(`{${parts.join(',')}}`) as unknown;
    }
  }
}

/** A save shaped like a real one, with random values in the right places. */
function nearlyRight(rand: () => number): unknown {
  return {
    version: rand() < 0.8 ? META.saveVersion : junk(rand, 2),
    cleared:
      rand() < 0.8
        ? { '1': rand() < 0.7 ? ['normal', 'hard'] : junk(rand, 2), '2': ['normal'], '3': junk(rand, 2), [String(Math.floor(rand() * 20))]: ['hard'] }
        : junk(rand, 1),
    upgrades: rand() < 0.8 ? { rifleHealth: junk(rand, 2), hqIncome: Math.floor(rand() * 9) - 2, sapperDrill: 3, ghost: 1 } : junk(rand, 1),
    lastMission: junk(rand, 2),
    medals: rand() < 0.6 ? Math.floor(rand() * 500) : junk(rand, 2),
    armoury: rand() < 0.6 ? ['lmg', 'tank', 'lmg', 'heavyTank', 'bomber', 'rifle'] : junk(rand, 2),
    wins: rand() < 0.6 ? { '1': { normal: 2, hard: junk(rand, 2) }, '3': junk(rand, 2), '77': { insane: 1 } } : junk(rand, 1),
    settings:
      rand() < 0.8
        ? {
            muted: junk(rand, 2),
            difficulty: junk(rand, 2),
            hints: junk(rand, 2),
            musicVolume: junk(rand, 2),
            ambienceVolume: junk(rand, 2),
            sfxVolume: junk(rand, 2),
            reduceFlash: junk(rand, 2),
          }
        : junk(rand, 1),
  };
}

/** Everything that must hold for any save the game hands on, whatever was in storage. */
function expectUsable(data: SaveData, rules: { missionIds: readonly number[]; upgradeDefs: readonly UpgradeDef[] }): void {
  expect(data.version).toBe(META.saveVersion);
  const ids = rules.missionIds.map(String);
  const cleared = Object.keys(data.cleared);
  expect(cleared).toEqual(ids.slice(0, cleared.length));
  for (const list of Object.values(data.cleared)) {
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list).size).toBe(list.length);
    for (const d of list) expect(DIFFICULTY_LIST).toContain(d);
  }
  for (const [id, level] of Object.entries(data.upgrades)) {
    const def = rules.upgradeDefs.find((d) => d.id === id);
    expect(def, `upgrade ${id} exists`).toBeDefined();
    expect(Number.isInteger(level)).toBe(true);
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(def ? maxLevel(def) : 0);
  }
  expect(pointsSpent(data, rules.upgradeDefs)).toBeLessThanOrEqual(pointsEarned(data));
  expect(data.lastMission === 0 || rules.missionIds.includes(data.lastMission)).toBe(true);
  expect(typeof data.settings.muted).toBe('boolean');
  expect(typeof data.settings.hints).toBe('boolean');
  expect(DIFFICULTY_LIST).toContain(data.settings.difficulty);
  for (const v of [data.settings.musicVolume, data.settings.ambienceVolume, data.settings.sfxVolume]) {
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  }
  expect(typeof data.settings.reduceFlash).toBe('boolean');
  expect(typeof data.settings.showBlood).toBe('boolean');
  expect(Object.keys(data.settings).sort()).toEqual(['ambienceVolume', 'difficulty', 'hints', 'musicVolume', 'muted', 'reduceFlash', 'sfxVolume', 'showBlood']);
  expect(Object.getPrototypeOf(data.upgrades)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(data.cleared)).toBe(Object.prototype);
  expect(Number.isInteger(data.medals)).toBe(true);
  expect(data.medals).toBeGreaterThanOrEqual(0);
  expect(new Set(data.armoury).size).toBe(data.armoury.length);
  for (const id of data.armoury) expect(MEDALS.armoury.map((a) => a.id as string)).toContain(id);
  for (const [id, per] of Object.entries(data.wins)) {
    expect(rules.missionIds.map(String)).toContain(id);
    for (const [d, n] of Object.entries(per)) {
      expect(DIFFICULTY_LIST as readonly string[]).toContain(d);
      expect(Number.isInteger(n) && (n as number) >= 1).toBe(true);
    }
  }
  expect(Object.getPrototypeOf(data.wins)).toBe(Object.prototype);
  expect(Object.keys(data).sort()).toEqual(['armoury', 'cleared', 'lastMission', 'medals', 'settings', 'upgrades', 'version', 'wins']);
}

describe('random garbage in storage', () => {
  const rules = { missionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], upgradeDefs: UPGRADES };

  it('never throws and always gives a usable save, whatever JSON it finds', () => {
    const rand = rng(20240601);
    let ok = 0;
    let withProgress = 0;
    for (let i = 0; i < 3000; i++) {
      const value = i % 2 === 0 ? junk(rand, 0) : nearlyRight(rand);
      const text = JSON.stringify(value) ?? 'undefined';
      const result = loadSave(createMemoryStorage({ [META.saveKey]: text }), rules);
      expect(['ok', 'corrupt']).toContain(result.status);
      if (result.status === 'ok') ok++;
      if (Object.keys(result.data.cleared).length > 0 || Object.keys(result.data.upgrades).length > 0) withProgress++;
      expectUsable(result.data, rules);
      // What was loaded can be written and read back unchanged.
      const again = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(result.data) }), rules);
      expect(again.status).toBe('ok');
      expect(again.data).toEqual(result.data);
    }
    // The generator really does reach both the damaged and the nearly good saves.
    expect(ok).toBeGreaterThan(500);
    expect(ok).toBeLessThan(2900);
    expect(withProgress).toBeGreaterThan(200);
  });

  it('never throws on text that is not JSON, or JSON cut off or damaged', () => {
    const rand = rng(77);
    const good = defaultSave();
    recordClear(good, 1, 'normal');
    recordClear(good, 2, 'hard');
    good.upgrades = { rifleHealth: 2 };
    good.lastMission = 2;
    const goodText = JSON.stringify(good);
    for (let i = 0; i < 2000; i++) {
      let text: string;
      const kind = i % 4;
      if (kind === 0) {
        text = goodText.slice(0, Math.floor(rand() * goodText.length));
      } else if (kind === 1) {
        const at = Math.floor(rand() * goodText.length);
        text = goodText.slice(0, at) + String.fromCharCode(Math.floor(rand() * 0xffff)) + goodText.slice(at + 1);
      } else if (kind === 2) {
        text = Array.from({ length: Math.floor(rand() * 60) }, () => String.fromCharCode(Math.floor(rand() * 0xffff))).join('');
      } else {
        text = ['', ' ', 'null', 'true', '"x"', '[]', '{}', 'NaN', '{"version":}', '\u0000', '{"version":1e999}'][Math.floor(rand() * 11)];
      }
      const result = loadSave(createMemoryStorage({ [META.saveKey]: text }), rules);
      expectUsable(result.data, rules);
    }
  });

  it('a save from before medals that was hand-edited to be rich keeps only what the points pay for', () => {
    const cheat = { version: 5, cleared: { '1': ['normal'] }, upgrades: Object.fromEntries(UPGRADES.map((d) => [d.id, 3])) };
    const result = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(cheat) }), rules);
    expect(result.status).toBe('ok');
    // One mission cleared = 2 points = 2 levels.
    expect(Object.values(result.data.upgrades).reduce((a, b) => a + b, 0)).toBe(2);
    expect(pointsSpent(result.data, UPGRADES)).toBe(2 * UPGRADES[0].costPerLevel);
    expect(result.data.medals).toBe(0);
    expectUsable(result.data, rules);
  });
});
