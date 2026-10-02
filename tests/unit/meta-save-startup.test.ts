/**
 * Saved data can never stop the game from starting. These tests reproduce the failure seen in the browser (a save
 * upgrade that throws because part of the game is out of date) and every other way stored data can go wrong.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { META } from '../../src/data/meta';
import type { UpgradeDef } from '../../src/data/schema';
import {
  createMemoryStorage,
  defaultSave,
  defaultSettings,
  loadSave,
  withStorageFallback,
  writeSave,
  type StorageLike,
} from '../../src/meta';

const V3_DEFAULTS = { ...META.v3DefaultVolumes };

function stored(doc: unknown): StorageLike {
  return createMemoryStorage({ [META.saveKey]: JSON.stringify(doc) });
}

function v3Save(settings: Record<string, unknown>): Record<string, unknown> {
  return { version: 3, cleared: { '1': ['normal'], '2': ['normal', 'hard'] }, upgrades: {}, lastMission: 2, settings };
}

/** Make the version 3 -> 4 (and 2 -> 3) upgrade steps throw, as they did when the game ran with a stale data file. */
function breakMigration(): void {
  (META as { v3DefaultVolumes: unknown }).v3DefaultVolumes = undefined;
}

afterEach(() => {
  META.v3DefaultVolumes = { ...V3_DEFAULTS };
});

describe('loading a save never throws', () => {
  it('upgrades a healthy version 3 save: untouched sliders move to the new default, chosen ones stay', () => {
    const untouched = loadSave(stored(v3Save({ muted: true, difficulty: 'hard', hints: false, musicVolume: 100, ambienceVolume: 100, sfxVolume: 100, reduceFlash: true })));
    expect(untouched.status).toBe('ok');
    expect(untouched.data.version).toBe(META.saveVersion);
    expect(untouched.data.settings.musicVolume).toBe(META.defaultMusicVolume);
    expect(untouched.data.settings.ambienceVolume).toBe(META.defaultAmbienceVolume);
    expect(untouched.data.settings.sfxVolume).toBe(META.defaultSfxVolume);
    expect(untouched.data.settings.muted).toBe(true);
    expect(untouched.data.settings.difficulty).toBe('hard');
    expect(untouched.data.settings.reduceFlash).toBe(true);

    const chosen = loadSave(stored(v3Save({ muted: false, difficulty: 'normal', hints: true, musicVolume: 35, ambienceVolume: 60, sfxVolume: 90, reduceFlash: false })));
    expect(chosen.status).toBe('ok');
    expect([chosen.data.settings.musicVolume, chosen.data.settings.ambienceVolume, chosen.data.settings.sfxVolume]).toEqual([35, 60, 90]);
  });

  it('writes no copy of a save it could read', () => {
    const storage = stored(v3Save({ musicVolume: 100, ambienceVolume: 100, sfxVolume: 100 }));
    loadSave(storage);
    expect(storage.getItem(META.unreadableKey)).toBeNull();
  });

  it.each([
    ['version 3', v3Save({ muted: true, difficulty: 'hard', hints: false, musicVolume: 100, ambienceVolume: 100, sfxVolume: 100, reduceFlash: false })],
    ['version 2', { version: 2, cleared: { '1': ['normal'], '2': ['normal', 'hard'] }, upgrades: {}, lastMission: 2, settings: { muted: true, difficulty: 'hard', hints: false } }],
  ])('an upgrade step that throws on a %s save costs the settings, not the progress and not the start', (_name, doc) => {
    const storage = stored(doc);
    const original = storage.getItem(META.saveKey);
    breakMigration();
    let result: ReturnType<typeof loadSave> | undefined;
    expect(() => {
      result = loadSave(storage);
    }).not.toThrow();
    expect(result?.status).toBe('repaired');
    expect(result?.data.cleared).toEqual({ '1': ['normal'], '2': ['normal', 'hard'] });
    expect(result?.data.lastMission).toBe(2);
    expect(result?.data.settings).toEqual(defaultSettings());
    expect(result?.data.version).toBe(META.saveVersion);
    // The save as it was is kept aside, so the next write does not destroy it.
    expect(storage.getItem(META.unreadableKey)).toBe(original);
  });

  it('gives a fresh save when even the progress cannot be read', () => {
    const explosive = [
      {
        get id(): string {
          throw new Error('broken upgrade table');
        },
      },
    ] as unknown as UpgradeDef[];
    const storage = stored({ version: META.saveVersion, cleared: { '1': ['normal'] }, upgrades: { anything: 1 }, lastMission: 1, settings: defaultSettings() });
    let result: ReturnType<typeof loadSave> | undefined;
    expect(() => {
      result = loadSave(storage, { upgradeDefs: explosive });
    }).not.toThrow();
    expect(result?.status).toBe('corrupt');
    expect(result?.data).toEqual(defaultSave());
  });

  it('survives a storage that throws on every call, and one that refuses the copy', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSave(throwing).status).toBe('corrupt');
    expect(writeSave(throwing, defaultSave())).toBe(false);

    const readOnly: StorageLike = {
      getItem: (key) => (key === META.saveKey ? '{not json' : null),
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    const result = loadSave(readOnly);
    expect(result.status).toBe('corrupt');
    expect(result.data).toEqual(defaultSave());
  });

  it('keeps aside damaged text and saves from a newer version, but not enormous ones', () => {
    const damaged = createMemoryStorage({ [META.saveKey]: '{not json' });
    expect(loadSave(damaged).status).toBe('corrupt');
    expect(damaged.getItem(META.unreadableKey)).toBe('{not json');

    const future = stored({ version: META.saveVersion + 5, cleared: { '1': ['normal'] }, settings: {} });
    const futureText = future.getItem(META.saveKey);
    expect(loadSave(future).status).toBe('corrupt');
    expect(future.getItem(META.unreadableKey)).toBe(futureText);

    const huge = createMemoryStorage({ [META.saveKey]: 'x'.repeat(META.unreadableMaxChars + 1) });
    expect(loadSave(huge).status).toBe('corrupt');
    expect(huge.getItem(META.unreadableKey)).toBeNull();
  });

  it('gives defaults, without throwing, for settings of every wrong shape in every stored version', () => {
    const shapes: unknown[] = [null, undefined, 7, 'text', [], [1, 2], { musicVolume: 'loud', ambienceVolume: null, sfxVolume: { a: 1 }, muted: 'yes', difficulty: 9, hints: [], reduceFlash: 'x' }, { musicVolume: Number.NaN, sfxVolume: -1e9, ambienceVolume: 1e9 }, { nested: { deep: [null, { x: 1 }] } }];
    for (let version = 1; version <= META.saveVersion; version++) {
      for (const settings of shapes) {
        const storage = stored({ version, cleared: { '1': ['normal'] }, upgrades: {}, lastMission: 1, settings });
        let result: ReturnType<typeof loadSave> | undefined;
        expect(() => {
          result = loadSave(storage);
        }).not.toThrow();
        const s = result?.data.settings ?? defaultSettings();
        for (const v of [s.musicVolume, s.ambienceVolume, s.sfxVolume]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        expect(typeof s.muted).toBe('boolean');
        expect(typeof s.hints).toBe('boolean');
        expect(typeof s.reduceFlash).toBe('boolean');
        expect(['normal', 'hard', 'insane']).toContain(s.difficulty);
        expect(result?.data.cleared).toEqual({ '1': ['normal'] });
      }
    }
  });
});

describe('withStorageFallback', () => {
  it('builds on the real storage when that works', () => {
    const storage = createMemoryStorage({ a: '1' });
    const reports: unknown[] = [];
    const built = withStorageFallback(storage, (s) => s.getItem('a'), (err) => reports.push(err));
    expect(built).toBe('1');
    expect(reports).toHaveLength(0);
  });

  it('builds again on an empty store when the stored data makes the first build throw, and leaves that data alone', () => {
    const storage = createMemoryStorage({ a: 'poison' });
    const reports: unknown[] = [];
    const seen: (string | null)[] = [];
    const built = withStorageFallback(
      storage,
      (s) => {
        const value = s.getItem('a');
        seen.push(value);
        if (value === 'poison') throw new Error('cannot start on this');
        return 'started';
      },
      (err) => reports.push(err),
    );
    expect(built).toBe('started');
    expect(seen).toEqual(['poison', null]);
    expect(reports).toHaveLength(1);
    expect(storage.getItem('a')).toBe('poison');
  });
});
