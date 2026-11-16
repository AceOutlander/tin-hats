/**
 * What the game lends a platform to move the save (GameHost in src/platform/types.ts): the save as text, a copy from
 * elsewhere read by the game's own rules, a copy put in the save's place, and a notice after every change. A platform
 * that keeps the save somewhere besides the device is built on these four; the website's platform uses none of them.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { META } from '../../src/data/meta';
import { createMemoryStorage, defaultSave, loadSave, type SaveData, type StorageLike } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

function makeApp(storage: StorageLike | null) {
  const ui = createFakeUi();
  let refreshes = 0;
  const refresh = ui.refresh.bind(ui);
  ui.refresh = () => {
    refreshes += 1;
    refresh();
  };
  const app = new App({ view: createFakeView(), audio: createFakeAudio(), storage, random: () => 0.25 });
  app.attachUi(ui);
  return { app, refreshes: () => refreshes };
}

const other = (): SaveData => ({
  ...defaultSave(),
  medals: 777,
  points: 3,
  cleared: { '1001': ['normal'], '1002': ['hard'] },
  wins: { '1001': { normal: 2 }, '1002': { hard: 1 } },
  lastMission: 1002,
  grants: ['x.1'],
  settings: { ...defaultSave().settings, musicVolume: 12, showFps: true },
});

describe('the save as text', () => {
  it('is the save the game would store', () => {
    const storage = createMemoryStorage();
    const { app } = makeApp(storage);
    app.grantMedals(40, 'g.1');
    expect(JSON.parse(app.saveText())).toEqual(JSON.parse(storage.getItem(META.saveKey) as string));
    expect(JSON.parse(app.saveText())).toEqual(app.save);
  });
});

describe('reading a copy of the save', () => {
  it('cleans it by the rules of this game and leaves the game untouched', () => {
    const { app } = makeApp(createMemoryStorage());
    const before = app.saveText();
    const doc = { ...other(), medals: -5, cleared: { '1001': ['normal'], '1003': ['hard'], '4242': ['normal'] } };
    const clean = JSON.parse(app.readSave(JSON.stringify(doc)) as string) as SaveData;
    expect(clean.medals).toBe(0);
    // No progress past the first mission not cleared, and none on a mission that does not exist.
    expect(clean.cleared).toEqual({ '1001': ['normal'] });
    expect(clean.grants).toEqual(['x.1']);
    expect(app.saveText()).toBe(before);
  });

  it('brings an older version up to date', () => {
    const { app } = makeApp(createMemoryStorage());
    const old = { version: 9, cleared: {}, upgrades: {}, medals: 30, armoury: [], wins: {}, lastMission: 0, training: { done: true, skipped: false }, settings: defaultSave().settings };
    const clean = JSON.parse(app.readSave(JSON.stringify(old)) as string) as SaveData;
    expect(clean.version).toBe(META.saveVersion);
    expect(clean.medals).toBe(30);
    expect(clean.training.done).toBe(true);
  });

  it('answers null for anything it cannot read: damaged text, another thing, a newer version', () => {
    const { app } = makeApp(createMemoryStorage());
    for (const text of ['', '{', 'null', '[]', '"save"', '{"version":"11"}', JSON.stringify({ ...defaultSave(), version: META.saveVersion + 1 })]) {
      expect(app.readSave(text), text).toBeNull();
    }
  });
});

describe('putting a copy in place of the save', () => {
  it('writes it, uses it at once, applies its settings and redraws', () => {
    const storage = createMemoryStorage();
    const { app, refreshes } = makeApp(storage);
    const seen = refreshes();
    expect(app.takeSave(JSON.stringify(other()))).toBe('replaced');
    expect(app.save.medals).toBe(777);
    expect(app.save.cleared).toEqual({ '1001': ['normal'], '1002': ['hard'] });
    expect(app.save.settings.musicVolume).toBe(12);
    expect(loadSave(storage, app.saveRules).data).toEqual(app.save);
    expect(refreshes()).toBe(seen + 1);
    // A restart reads the same save.
    expect(makeApp(storage).app.save).toEqual(app.save);
  });

  it('changes nothing for a save it cannot read or cannot write', () => {
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
    const { app } = makeApp(storage);
    app.grantMedals(25, 'mine');
    const before = app.saveText();
    for (const text of ['{', 'null', JSON.stringify({ ...other(), version: META.saveVersion + 1 })]) expect(app.takeSave(text)).toBe('failed');
    refuse = true;
    expect(app.takeSave(JSON.stringify(other()))).toBe('failed');
    expect(app.saveText()).toBe(before);
    expect(makeApp(null).app.takeSave(JSON.stringify(other()))).toBe('failed');
  });

  it('waits while a battle is on', () => {
    const storage = createMemoryStorage();
    const { app } = makeApp(storage);
    const before = app.saveText();
    app.beginMission(1001, 'normal', 5, true);
    expect(app.session).not.toBeNull();
    expect(app.takeSave(JSON.stringify(other()))).toBe('busy');
    expect(JSON.parse(app.saveText()).medals).toBe(JSON.parse(before).medals);
  });
});

describe('the notice after a change of the save', () => {
  it('comes after a grant, a setting, a purchase in the game, a replaced save and a reset, and stops when asked', () => {
    const { app } = makeApp(createMemoryStorage());
    let n = 0;
    const stop = app.onSaveChanged(() => {
      n += 1;
    });
    app.grantMedals(500, 'n.1');
    expect(n).toBe(1);
    app.grantMedals(500, 'n.1'); // already given: nothing changed
    expect(n).toBe(1);
    app.setSetting('showFps', true);
    expect(n).toBe(2);
    app.takeSave(JSON.stringify(other()));
    expect(n).toBe(3);
    app.resetSave();
    expect(n).toBe(4);
    stop();
    app.setSetting('showFps', false);
    expect(n).toBe(4);
  });

  it('never lets a listener that throws stop the game or the other listeners', () => {
    const { app } = makeApp(createMemoryStorage());
    let n = 0;
    app.onSaveChanged(() => {
      throw new Error('a platform bug');
    });
    app.onSaveChanged(() => {
      n += 1;
    });
    expect(app.grantMedals(10, 'safe')).toBe('granted');
    expect(n).toBe(1);
  });
});
