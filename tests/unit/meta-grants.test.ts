/**
 * Once-only grants (GameHost.grantMedals, src/platform/types.ts): a platform may give the player medals under an id,
 * and the save takes each id once. The medals and the id are one write, so a grant is never half given: asked again
 * after anything went wrong, it is given exactly once.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { MEDALS } from '../../src/data/medals';
import { META } from '../../src/data/meta';
import { createMemoryStorage, defaultSave, grantMedalsOnce, isGrantId, loadSave, sanitizeSave, type StorageLike } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

function makeApp(storage: StorageLike | null) {
  const ui = createFakeUi();
  const app = new App({ view: createFakeView(), audio: createFakeAudio(), storage, random: () => 0.25 });
  app.attachUi(ui);
  return app;
}

describe('a once-only grant on a save', () => {
  it('gives the medals the first time and nothing the second', () => {
    const save = defaultSave();
    expect(grantMedalsOnce(save, 150, 'a.1')).toBe('granted');
    expect(save.medals).toBe(150);
    expect(save.grants).toEqual(['a.1']);
    expect(grantMedalsOnce(save, 150, 'a.1')).toBe('already');
    expect(save.medals).toBe(150);
    expect(grantMedalsOnce(save, 500, 'a.2')).toBe('granted');
    expect(save.medals).toBe(650);
    expect(save.grants).toEqual(['a.1', 'a.2']);
  });

  it('refuses an unusable id or amount and changes nothing', () => {
    const save = defaultSave();
    for (const id of ['', 'has space', 'x'.repeat(META.maxGrantIdLength + 1), 'quote"', 'é']) {
      expect(isGrantId(id), id).toBe(false);
      expect(grantMedalsOnce(save, 10, id)).toBe('failed');
    }
    for (const n of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(grantMedalsOnce(save, n, 'ok')).toBe('failed');
    expect(save).toEqual(defaultSave());
  });

  it('is never cut short at the medal cap: it is not given at all', () => {
    const save = defaultSave();
    save.medals = MEDALS.maxMedals - 100;
    expect(grantMedalsOnce(save, 150, 'cap')).toBe('failed');
    expect(save.medals).toBe(MEDALS.maxMedals - 100);
    expect(save.grants).toBeUndefined();
    expect(grantMedalsOnce(save, 100, 'cap')).toBe('granted');
    expect(save.medals).toBe(MEDALS.maxMedals);
  });

  it('remembers the newest ids only, up to the limit in data', () => {
    const save = defaultSave();
    for (let i = 0; i < META.maxGrantIds + 5; i++) grantMedalsOnce(save, 1, `g${i}`);
    expect(save.grants).toHaveLength(META.maxGrantIds);
    expect(save.grants?.[0]).toBe('g5');
    expect(grantMedalsOnce(save, 1, `g${META.maxGrantIds + 4}`)).toBe('already');
  });

  it('a save without grants is stored exactly as before, and one with grants keeps the usable ids', () => {
    expect('grants' in defaultSave()).toBe(false);
    expect('grants' in (sanitizeSave(JSON.parse(JSON.stringify(defaultSave()))) ?? {})).toBe(false);
    const doc = { ...defaultSave(), medals: 40, grants: ['a.1', 'a.1', 7, 'bad id', 'b:2'] };
    expect(sanitizeSave(JSON.parse(JSON.stringify(doc)))?.grants).toEqual(['a.1', 'b:2']);
    expect(sanitizeSave(JSON.parse(JSON.stringify({ ...defaultSave(), grants: 'nope' })))?.grants).toBeUndefined();
  });
});

describe('a once-only grant through the app', () => {
  it('is written with its medals before it returns, and survives a restart', () => {
    const storage = createMemoryStorage();
    const app = makeApp(storage);
    expect(app.grantMedals(900, 't-1')).toBe('granted');
    const stored = loadSave(storage).data;
    expect(stored.medals).toBe(900);
    expect(stored.grants).toEqual(['t-1']);
    const again = makeApp(storage);
    expect(again.grantMedals(900, 't-1')).toBe('already');
    expect(again.save.medals).toBe(900);
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
    const app = makeApp(storage);
    expect(app.grantMedals(10, 'first')).toBe('granted');
    refuse = true;
    expect(app.grantMedals(500, 'second')).toBe('failed');
    expect(app.save.medals).toBe(10);
    expect(app.save.grants).toEqual(['first']);
    refuse = false;
    expect(app.grantMedals(500, 'second')).toBe('granted');
    expect(app.save.medals).toBe(510);
    // With nowhere to save at all, nothing is given.
    expect(makeApp(null).grantMedals(10, 'x')).toBe('failed');
  });
});
