import { describe, expect, it } from 'vitest';
import { META } from '../../src/data/meta';
import {
  clearSave,
  createMemoryStorage,
  defaultSave,
  loadSave,
  recordClear,
  sanitizeSave,
  writeSave,
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
