/**
 * The hidden admin panel without its DOM: the lock (the passcode is compared as a salted hash; a wrong code changes
 * nothing; the secret entry needs seven quick taps) and every action of the controller, on the app with fake view,
 * audio and UI. The real code is never written here: the tests compare against the hash of a test-only code, computed
 * by the same function the game uses.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../src/app/admin';
import { AdminLock, codeHash, sha256Hex } from '../../src/app/adminLock';
import { App } from '../../src/app/app';
import { ADMIN } from '../../src/data/admin';
import { APP } from '../../src/data/app';
import { MISSIONS } from '../../src/data/missions';
import { UPGRADES } from '../../src/data/upgrades';
import { createMemoryStorage, loadSave, sanitizeSave, type SaveData } from '../../src/meta';
import type { UnitState } from '../../src/sim';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

const TEST_CODE = 'test-only code';
const TEST_HASH = codeHash(TEST_CODE);
const RULES = { missionIds: MISSIONS.map((m) => m.id), upgradeDefs: UPGRADES };

function makeAdmin(storage = createMemoryStorage()) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const app = new App({ view, audio, storage, random: () => 0.25 });
  app.attachUi(ui);
  const admin = new AdminController({ app, view, ui: () => ui, lock: new AdminLock(TEST_HASH) });
  return { app, view, ui, admin, storage };
}

/** The save survives a trip through the checks a load applies, unchanged: the panel never writes an invalid save. */
function expectValid(save: SaveData): void {
  expect(sanitizeSave(JSON.parse(JSON.stringify(save)), RULES)).toEqual(save);
}

function living(app: App, side?: 0 | 1): UnitState[] {
  const s = app.session?.battle.state;
  const out: UnitState[] = [];
  if (!s) return out;
  for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive && (side === undefined || s.units[i].side === side)) out.push(s.units[i]);
  return out;
}

describe('the admin lock', () => {
  it('hashes with SHA-256, as node does', () => {
    for (const text of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(200), 'Tin Hats £ ✓']) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
    expect(codeHash(TEST_CODE)).toBe(createHash('sha256').update(ADMIN.passcode.salt + TEST_CODE).digest('hex'));
  });

  it('keeps only a salted hash of the real code in the data', () => {
    expect(ADMIN.passcode.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ADMIN.passcode.salt.length).toBeGreaterThan(0);
    expect(new AdminLock().submit(TEST_CODE)).toBe(false);
  });

  it('opens on the right code (trimmed, any case) and on nothing else', () => {
    const lock = new AdminLock(TEST_HASH);
    expect(lock.unlocked).toBe(false);
    for (const wrong of ['', ' ', 'test-only', 'test-only code!', 'x'.repeat(ADMIN.maxCodeLength + 1), TEST_HASH]) {
      expect(lock.submit(wrong)).toBe(false);
      expect(lock.unlocked).toBe(false);
    }
    expect(lock.submit('  Test-Only CODE ')).toBe(true);
    expect(lock.unlocked).toBe(true);
    lock.lock();
    expect(lock.unlocked).toBe(false);
  });

  it('needs seven quick taps on the helmet; slow taps start over', () => {
    let t = 0;
    const lock = new AdminLock(TEST_HASH, () => t);
    const run = (gap: number, n: number): boolean[] => {
      const out: boolean[] = [];
      for (let i = 0; i < n; i++) {
        t += gap;
        out.push(lock.tap());
      }
      return out;
    };
    expect(run(100, ADMIN.taps)).toEqual([...Array<boolean>(ADMIN.taps - 1).fill(false), true]);
    // Six quick taps, a pause, then one more: not enough.
    expect(run(100, ADMIN.taps - 1).some(Boolean)).toBe(false);
    t += ADMIN.tapGapMs + 1;
    expect(lock.tap()).toBe(false);
    // Taps that are each too slow never complete a run.
    expect(run(ADMIN.tapGapMs + 1, ADMIN.taps * 3).some(Boolean)).toBe(false);
    // Tapping does not unlock anything by itself.
    expect(lock.unlocked).toBe(false);
  });
});

describe('the admin controller', () => {
  it('is locked until the code is given, and a wrong code leaves it locked', () => {
    const { admin } = makeAdmin();
    expect(admin.isUnlocked()).toBe(false);
    expect(admin.submitCode('wrong')).toBe(false);
    expect(admin.isUnlocked()).toBe(false);
    expect(admin.submitCode(TEST_CODE)).toBe(true);
    expect(admin.isUnlocked()).toBe(true);
    admin.lock();
    expect(admin.isUnlocked()).toBe(false);
  });

  it('grants medals and sets Quartermaster levels within their limits, keeping the save valid', () => {
    const { app, admin, storage } = makeAdmin();
    admin.run({ type: 'medals', amount: 100 });
    admin.run({ type: 'medals', amount: 1000 });
    expect(app.save.medals).toBe(1100);
    const def = UPGRADES[0];
    admin.run({ type: 'upgrade', id: def.id, level: 99 });
    expect(app.save.upgrades[def.id]).toBe(def.levels.length);
    admin.run({ type: 'upgrade', id: def.id, level: 1 });
    expect(app.save.upgrades[def.id]).toBe(1);
    admin.run({ type: 'upgrade', id: def.id, level: -3 });
    expect(app.save.upgrades[def.id]).toBeUndefined();
    admin.run({ type: 'upgrade', id: 'noSuchUpgrade', level: 2 });
    expect(app.save.upgrades.noSuchUpgrade).toBeUndefined();
    admin.run({ type: 'upgrade', id: UPGRADES[1].id, level: 2 });
    expectValid(app.save);
    expect(loadSave(storage, RULES)).toEqual({ data: app.save, status: 'ok' });
    expect(admin.info().upgrades.find((u) => u.id === UPGRADES[1].id)?.level).toBe(2);
  });

  it('unlocks every mission for this session only', () => {
    const { app, admin, storage } = makeAdmin();
    const before = structuredClone(app.save);
    admin.run({ type: 'unlockMissions' });
    expect(app.campaign().missions.every((m) => m.unlocked)).toBe(true);
    expect(admin.info().unlockedAll).toBe(true);
    expect(app.save).toEqual(before);
    const again = new App({ view: createFakeView(), audio: createFakeAudio(), storage });
    expect(again.campaign().missions.filter((m) => m.unlocked)).toHaveLength(1);
  });

  it('jumps to any mission on any difficulty, and a win there that the real progress has not opened is not saved', () => {
    const { app, admin } = makeAdmin();
    admin.run({ type: 'unlockMissions' });
    const late = MISSIONS.slice(2).find((m) => m.start[1].hasHq);
    if (!late) throw new Error('no later assault mission');
    admin.run({ type: 'jump', missionId: late.id, difficulty: 'hard' });
    expect(app.session?.mission.id).toBe(late.id);
    expect(app.session?.difficulty).toBe('hard');
    // A real win (the enemy HQ falls), on a mission only the admin unlock opened.
    const hq = app.session?.battle.state.sides[1].hq;
    if (hq) {
      hq.hp = 0;
      hq.alive = false;
    }
    app.session?.step();
    expect(app.session?.battle.state).toMatchObject({ winner: 0, endReason: 'hqDestroyed' });
    expect(app.save.cleared).toEqual({});
    expect(app.save.medals).toBe(0);
    expectValid(app.save);
  });

  it('spawns a King Tiger squad for the enemy at a tapped spot, and any kind for the player', () => {
    const { app, view, admin } = makeAdmin();
    app.beginMission(1002, 'normal', 5, true);
    admin.run({ type: 'place', spec: { what: 'kingTigerSquad', side: 'enemy', count: 1 } });
    expect(admin.info().placing).toEqual({ what: 'kingTigerSquad', side: 'enemy', count: 1 });
    view.onTapGround?.(2600);
    const enemy = living(app, 1);
    const tiger = enemy.find((u) => u.kind === 'heavyTank');
    expect(tiger?.x).toBe(2600);
    expect(enemy.filter((u) => u.veteran && u.kind === 'rifle')).toHaveLength(3);
    // The King Tiger warning comes up as it did in the old mission 10.
    expect(app.session?.hud.state.banner).toBe(APP.notices.boss);
    // Placing goes on until it is stopped.
    view.onTapGround?.(2800);
    expect(living(app, 1).filter((u) => u.kind === 'heavyTank')).toHaveLength(2);
    // Dubno starts the player with light tanks of their own (BT-7s): ten more come where the tap was.
    const ownLight = living(app, 0).filter((u) => u.kind === 'lightTank').length;
    admin.run({ type: 'place', spec: { what: 'lightTank', side: 'mine', count: 10 } });
    view.onTapGround?.(1400);
    expect(living(app, 0).filter((u) => u.kind === 'lightTank')).toHaveLength(ownLight + 10);
    admin.run({ type: 'place', spec: null });
    expect(app.adminTaps).toBeNull();
    const before = living(app).length;
    view.onTapGround?.(1500);
    expect(living(app)).toHaveLength(before);
  });

  it('picks a unit with a tap and kills, heals, guards or turns it', () => {
    const { app, view, admin } = makeAdmin();
    app.beginMission(1002, 'normal', 5, true);
    app.session?.admin({ type: 'spawn', side: 1, kind: 'rifle', x: 3000, count: 1 });
    const target = living(app, 1).find((u) => u.x === 3000) as UnitState;
    admin.run({ type: 'pick', on: true });
    view.onTapGround?.(3020);
    expect(admin.info().selected?.id).toBe(target.id);
    expect(admin.info().picking).toBe(false);
    target.hp = 3;
    admin.run({ type: 'units', action: 'heal', target: 'selected' });
    expect(target.hp).toBe(target.maxHp);
    admin.run({ type: 'units', action: 'invincible', target: 'selected' });
    expect(target.invincible).toBe(true);
    admin.run({ type: 'takeOver', target: 'selected' });
    expect(living(app, 1).some((u) => u.x === 3000)).toBe(false);
    expect(living(app, 0).some((u) => u.x === 3000 && u.kind === 'rifle')).toBe(true);
    // A tap on one of the player's own units picks it.
    const mine = living(app, 0)[0];
    admin.run({ type: 'pick', on: true });
    view.onTapUnit?.(mine.id);
    expect(admin.info().selected?.id).toBe(mine.id);
    admin.run({ type: 'units', action: 'kill', target: 'selected' });
    expect(mine.alive).toBe(false);
    expect(admin.info().selected).toBeNull();
  });

  it('acts on whole sides and HQs, and fills an army', () => {
    const { app, admin } = makeAdmin();
    app.beginMission(1002, 'normal', 5, true);
    admin.run({ type: 'fill', side: 'enemy', kind: 'rifle' });
    const enemy = app.session?.battle.state.sides[1];
    expect(enemy?.pop).toBe(enemy?.popCap);
    admin.run({ type: 'units', action: 'invincible', target: 'all' });
    expect(admin.info().battle?.sideInvincible).toEqual([true, true]);
    admin.run({ type: 'units', action: 'mortal', target: 'mine' });
    expect(admin.info().battle?.sideInvincible).toEqual([false, true]);
    admin.run({ type: 'hqInvincible', side: 'mine', on: true });
    expect(admin.info().battle?.hqInvincible).toEqual([true, false]);
    admin.run({ type: 'takeOver', target: 'enemy' });
    expect(living(app, 1)).toHaveLength(0);
    admin.run({ type: 'units', action: 'kill', target: 'all' });
    expect(living(app)).toHaveLength(0);
  });

  it('sets, freezes and fills supplies, trains instantly and fires scripted events', () => {
    const { app, admin } = makeAdmin();
    app.beginMission(1002, 'normal', 5, true);
    admin.run({ type: 'setSupplies', amount: 0 });
    admin.run({ type: 'addSupplies', amount: 500 });
    expect(admin.info().battle?.supplies).toBe(500);
    admin.run({ type: 'freezeSupplies', on: true });
    expect(admin.info().battle).toMatchObject({ frozen: true, infinite: false });
    for (let i = 0; i < 60; i++) app.session?.step();
    expect(app.session?.battle.state.sides[0].supplies).toBe(500);
    admin.run({ type: 'infiniteSupplies', on: true });
    expect(admin.info().battle).toMatchObject({ frozen: false, infinite: true, supplies: ADMIN.infiniteSupplies });
    admin.run({ type: 'infiniteSupplies', on: false });
    expect(app.session?.battle.state.sides[0].cheats.holdSupplies).toBe(-1);
    admin.run({ type: 'instantTrain', on: true });
    expect(admin.info().battle?.instantTrain).toBe(true);
    const events = admin.info().battle?.events ?? [];
    expect(events.length).toBe(app.session?.mission.events.length);
    if (events.length > 0) admin.run({ type: 'fireEvent', index: events[0].index });
  });

  it('wins or loses on the spot without recording anything', () => {
    for (const win of [true, false]) {
      const { app, view, ui, admin } = makeAdmin();
      app.beginMission(1002, 'normal', 5, true);
      const before = structuredClone(app.save);
      admin.run({ type: 'speed', scale: 0 });
      admin.run({ type: 'end', win });
      expect(app.session?.battle.state).toMatchObject({ over: true, winner: win ? 0 : 1, endReason: 'admin' });
      expect(app.loop.timeScale).toBe(1);
      for (let i = 0; i < 100 && ui.results.length === 0; i++) view.frame?.(100);
      expect(ui.results[0].won).toBe(win);
      expect(ui.results[0].reason).toBe(win ? APP.reasons.admin.win : APP.reasons.admin.lose);
      expect(app.save).toEqual(before);
    }
  });

  it('restarts on another difficulty, and sets the speed, weather, time of day and enemy health', () => {
    const { app, view, admin } = makeAdmin();
    app.beginMission(1001, 'normal', 5, true);
    admin.run({ type: 'restart', difficulty: 'insane' });
    expect(app.session?.difficulty).toBe('insane');
    expect(app.session?.mission.id).toBe(1001);
    for (const scale of ADMIN.timeScales) {
      admin.run({ type: 'speed', scale });
      expect(admin.info().timeScale).toBe(scale);
    }
    admin.run({ type: 'weather', mode: 'rain' });
    expect(app.weatherMode).toBe('rain');
    admin.run({ type: 'timeOfDay', darkness: 1 });
    admin.run({ type: 'speed', scale: 1 });
    view.frame?.(40);
    expect(view.darkness[view.darkness.length - 1]).toBe(1);
    admin.run({ type: 'timeOfDay', darkness: null });
    view.frame?.(40);
    expect(view.darkness[view.darkness.length - 1]).toBe(0);
    admin.run({ type: 'revealHp', on: true });
    expect(view.hpReveal.enemyShown()).toBe(true);
    expect(admin.info().hpRevealed).toBe(true);
    admin.run({ type: 'showFps', on: true });
    expect(app.save.settings.showFps).toBe(true);
    expectValid(app.save);
  });

  it('exports the save and imports only a valid one', () => {
    const { app, admin } = makeAdmin();
    admin.run({ type: 'medals', amount: 100 });
    const text = admin.exportSave();
    admin.run({ type: 'medals', amount: 1000 });
    expect(admin.importSave(text)).toBe(true);
    expect(app.save.medals).toBe(100);
    expectValid(app.save);
    for (const bad of ['', 'not json', '[]', '{"version":999}', 'null']) {
      expect(admin.importSave(bad)).toBe(false);
      expect(app.save.medals).toBe(100);
    }
    // A save with impossible values comes in cleaned.
    expect(admin.importSave(JSON.stringify({ ...JSON.parse(text), medals: -50, upgrades: { ghost: 3 } }))).toBe(true);
    expect(app.save.medals).toBe(0);
    expect(app.save.upgrades).toEqual({});
    expectValid(app.save);
    admin.run({ type: 'resetSave' });
    expect(app.save.medals).toBe(0);
    expectValid(app.save);
  });

  it('fills the debug drawing and readout in a battle only', () => {
    const { app, admin } = makeAdmin();
    const frame = {
      boxes: new Float32Array(1000),
      boxSide: new Uint8Array(250),
      boxCount: 0,
      ranges: new Float32Array(1000),
      rangeCount: 0,
      // Room for 1010's trenches, buildings and cover props (each a slot record) and its wave marks.
      marks: new Float32Array(300),
      markCount: 0,
      groundY: 0,
    };
    expect(admin.debugFrame(frame)).toBe(false);
    expect(admin.readout()).toBe('No battle');
    app.beginMission(1010, 'normal', 5, true);
    admin.run({ type: 'overlay', layer: 'points', on: true });
    expect(admin.debugFrame(frame)).toBe(true);
    // Two HQ doors, every trench, and the landing spots of scripted waves.
    expect(frame.markCount).toBeGreaterThanOrEqual(2 + (app.session?.battle.state.trenches.length ?? 0));
    expect(frame.boxCount).toBe(0);
    admin.run({ type: 'overlay', layer: 'hitboxes', on: true });
    admin.debugFrame(frame);
    expect(frame.boxCount).toBeGreaterThan(0);
    expect(admin.readout()).toMatch(/AI \(ai\)/);
  });
});
