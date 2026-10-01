import { describe, expect, it } from 'vitest';
import { DIFFICULTY_LIST } from '../../src/data/difficulty';
import { META } from '../../src/data/meta';
import type { UpgradeDef } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import {
  clearSave,
  createMemoryStorage,
  defaultSave,
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
    save.settings = { muted: true, difficulty: 'hard', hints: false };
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
    expect(data?.settings).toEqual({ muted: META.defaultMuted, difficulty: 'insane', hints: false });
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
    expect(loaded.data).toEqual({
      version: META.saveVersion,
      cleared: v1.cleared,
      upgrades: v1.upgrades,
      lastMission: 0,
      settings: v1.settings,
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

  it('never keeps more points spent than earned', () => {
    // Two missions cleared = 4 points, but 9 levels are claimed.
    const save = sanitizeSave(
      doc({
        cleared: { '1': ['normal'], '2': ['normal'] },
        upgrades: { sapperDrill: 3, hqIncome: 3, hqHealth: 3 },
      }),
      rules,
    );
    expect(save).not.toBeNull();
    if (!save) return;
    expect(pointsSpent(save, UPGRADES)).toBe(pointsEarned(save));
    expect(save.upgrades).toEqual({ sapperDrill: 3, hqIncome: 1 });
  });

  it('keeps nothing when nothing was earned', () => {
    const data = sanitizeSave(doc({ upgrades: { sapperDrill: 1, rifleHealth: 3 } }), rules);
    expect(data?.upgrades).toEqual({});
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
    settings: rand() < 0.8 ? { muted: junk(rand, 2), difficulty: junk(rand, 2), hints: junk(rand, 2) } : junk(rand, 1),
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
  expect(Object.getPrototypeOf(data.upgrades)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(data.cleared)).toBe(Object.prototype);
  expect(Object.keys(data).sort()).toEqual(['cleared', 'lastMission', 'settings', 'upgrades', 'version']);
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

  it('a save that was hand-edited to be rich keeps only what the points pay for', () => {
    const cheat = { version: META.saveVersion, cleared: { '1': ['normal'] }, upgrades: Object.fromEntries(UPGRADES.map((d) => [d.id, 3])) };
    const result = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(cheat) }), rules);
    expect(result.status).toBe('ok');
    expect(pointsSpent(result.data, UPGRADES)).toBe(2);
    expectUsable(result.data, rules);
  });
});
