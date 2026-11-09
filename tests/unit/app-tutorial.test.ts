/**
 * The guided-tip engine (src/app/tutorial.ts): its memory, the steps each mission offers, how a step starts, ends,
 * gives up, is cut in on or closed, and the tips in the app. Mission 1's guided steps moved to Basic Training, the
 * standalone tutorial (tests/unit/basic-training.test.ts walks its whole course); the engine is tested here on its
 * first lessons and on the campaign's new-unit and new-support tips.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { BattleSession } from '../../src/app/session';
import { TipMemory, Tutorial, stepsFor, trainingSteps } from '../../src/app/tutorial';
import { MEDALS } from '../../src/data/medals';
import { FIELD } from './fixtures';
import { MISSIONS } from '../../src/data/missions';
import { BASIC_TRAINING } from '../../src/data/missions/training';
import type { MissionDef } from '../../src/data/schema';
import { TUTORIAL } from '../../src/data/tutorial';
import { UNITS } from '../../src/data/units';
import { createMemoryStorage } from '../../src/meta';
import { createBattle } from '../../src/sim';
import { createFakeAudio, createFakeUi, createFakeView, type FakeView } from './app-helpers';

function mission(id: number): MissionDef {
  const found = MISSIONS.find((m) => m.id === id);
  if (!found) throw new Error(`no mission ${id}`);
  return found;
}

interface Rig {
  session: BattleSession;
  view: FakeView;
  tutorial: Tutorial;
  memory: TipMemory;
  hintsOn: { value: boolean };
  /** Run this many battle seconds, one rendered frame (two ticks) at a time. */
  run(seconds: number): void;
  tip(): { text: string; target: string } | null;
}

function rig(m: MissionDef, memory = new TipMemory(createMemoryStorage())): Rig {
  const battle = createBattle({ mission: m, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
  const tutorial = new Tutorial(m, memory);
  const hintsOn = { value: true };
  const view = createFakeView();
  const session = new BattleSession(battle, 'normal', 3, view, createFakeAudio(), {
    hints: () => hintsOn.value,
    sound: () => true,
    onEnded: () => undefined,
    tutorial,
  });
  session.fill(false, false);
  return {
    session,
    view,
    tutorial,
    memory,
    hintsOn,
    run(seconds) {
      const frames = Math.round(seconds * 15);
      for (let i = 0; i < frames; i++) {
        session.step();
        session.step();
        session.fill(false, false);
      }
    },
    tip() {
      const t = session.hud.state.tip;
      return t === null ? null : { text: t.text, target: t.target };
    },
  };
}

/** Basic Training with the enemy's machine guns dug in a stone's throw from our HQ. */
function besieged(): MissionDef {
  const m: MissionDef = structuredClone(BASIC_TRAINING);
  m.start[1].forces = [{ kind: 'lmg', count: 4, x: 360, behaviour: 'guard' }];
  m.units[1] = ['sapper', 'rifle', 'lmg'];
  return m;
}

/** Basic Training with plenty of supplies, so every order the test gives can be paid for. */
function rich(): MissionDef {
  const m: MissionDef = structuredClone(BASIC_TRAINING);
  m.start[0].supplies = 3000;
  return m;
}

/** Run until a tip pointing at `target` is up (or `limit` seconds have passed). */
function runUntil(r: Rig, target: string, limit: number): boolean {
  for (let t = 0; t < limit; t++) {
    if (r.tip()?.target === target) return true;
    r.run(1);
  }
  return r.tip()?.target === target;
}

/** Do the first lessons of Basic Training at once: a sapper, three riflemen and Hold. */
function firstLessons(r: Rig): void {
  // Ready at once: the prep phase lesson that opens the course counts as done.
  r.session.dispatch({ type: 'ready' });
  r.session.dispatch({ type: 'train', kind: 'sapper' });
  for (let i = 0; i < 3; i++) r.session.dispatch({ type: 'train', kind: 'rifle' });
  r.session.dispatch({ type: 'order', order: 'hold' });
}

describe('TipMemory', () => {
  it('remembers ids across instances and forgets them on clear', () => {
    const storage = createMemoryStorage();
    const a = new TipMemory(storage);
    a.add('supplies');
    a.add('hold');
    const b = new TipMemory(storage);
    expect(b.has('supplies')).toBe(true);
    expect(b.has('hold')).toBe(true);
    expect(b.has('look')).toBe(false);
    b.clear();
    expect(new TipMemory(storage).has('supplies')).toBe(false);
  });

  it('keeps tips separate from the save and ignores damaged or hostile entries', () => {
    for (const text of ['{{{', 'null', '{}', '[1,2,{"a":1}]', '["ok", "bad id!", "<script>"]']) {
      const m = new TipMemory(createMemoryStorage({ [TUTORIAL.storageKey]: text }));
      expect(m.has('bad id!')).toBe(false);
      expect(m.has('<script>')).toBe(false);
    }
    expect(new TipMemory(createMemoryStorage({ [TUTORIAL.storageKey]: '["ok"]' })).has('ok')).toBe(true);
  });

  it('caps how many ids it keeps', () => {
    const storage = createMemoryStorage();
    const m = new TipMemory(storage);
    for (let i = 0; i < TUTORIAL.maxRemembered + 20; i++) m.add(`tip${i}`);
    expect((JSON.parse(storage.getItem(TUTORIAL.storageKey) ?? '[]') as string[]).length).toBe(TUTORIAL.maxRemembered);
  });

  it('works with no storage, and with a storage that throws', () => {
    const none = new TipMemory(null);
    none.add('a');
    expect(none.has('a')).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const m = new TipMemory(broken);
    m.add('a');
    expect(m.has('a')).toBe(true);
    expect(() => m.clear()).not.toThrow();
  });
});

describe('the steps of a mission', () => {
  it('teaches supplies, training, the three orders, panning and taking control in Basic Training, not in mission 1', () => {
    const steps = stepsFor(BASIC_TRAINING);
    expect(steps.map((s) => s.id)).toEqual(trainingSteps().map((s) => s.id));
    const targets = steps.map((s) => s.target);
    for (const t of ['supplies', 'train-sapper', 'train-rifle', 'order-hold', 'minimap', 'order-advance', 'order-fallBack']) expect(targets).toContain(t);
    expect(steps.some((s) => s.text.includes('take control'))).toBe(true);
    // Mission 1 brings riflemen, a free type the course teaches: no guided steps and no new-unit tip there now.
    expect(stepsFor(FIELD)).toEqual([]);
  });

  it('has unique ids, steps that follow real steps, and sane times', () => {
    const steps = TUTORIAL.steps;
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of steps) {
      for (const a of s.after ?? []) expect(ids, `${s.id} follows ${a}`).toContain(a);
      expect(s.seconds).toBeGreaterThan(3);
      expect(s.text.length).toBeGreaterThan(10);
      // Short enough for a phone: two lines of a narrow bubble.
      expect(s.text.length, s.id).toBeLessThanOrEqual(100);
    }
    // Every unit button the course points at is one the player has on the training ground.
    for (const s of steps) if (s.target.startsWith('train-')) expect(BASIC_TRAINING.units[0]).toContain(s.target.slice(6));
  });

  it('gives a mission that introduces a unit and a support one tip each, the support after the unit', () => {
    const steps = stepsFor(mission(1004));
    expect(steps.map((s) => s.id)).toEqual(['new-unit-medic', 'new-support-airStrike']);
    expect(steps[0].target).toBe('train-medic');
    expect(steps[1].target).toBe('support-airStrike');
    expect(steps[1].after).toEqual(['new-unit-medic']);
  });

  it('gives no guided steps in campaign missions and no tip for what a mission does not offer', () => {
    expect(stepsFor(mission(1001)).every((s) => s.id.startsWith('new-'))).toBe(true);
    const odd: MissionDef = structuredClone(mission(1004));
    odd.units = [['sapper', 'rifle'], ['sapper', 'rifle']];
    odd.supports = [[], []];
    expect(stepsFor(odd)).toEqual([]);
  });

  it('has a tip for every unit and support a mission introduces (the free types are Basic Training\'s)', () => {
    for (const m of MISSIONS) {
      const unit = m.newUnit;
      const taught = unit !== null && UNITS[unit].trainable && !MEDALS.free.includes(unit);
      if (taught) expect(TUTORIAL.newUnit.tips[unit], `mission ${m.id} unit`).toBeDefined();
      expect(stepsFor(m).length, `mission ${m.id}`).toBe((taught ? 1 : 0) + (m.newSupport !== null ? 1 : 0));
    }
  });
});

describe('the guided steps in Basic Training', () => {
  it('starts with a welcome, then building in the prep phase, then supplies and sappers', () => {
    const r = rig(BASIC_TRAINING);
    r.run(0.5);
    expect(r.tip()).toBeNull();
    r.run(1);
    expect(r.tutorial.activeId).toBe('welcome');
    expect(r.tip()?.target).toBe('field');
    r.session.dispatch({ type: 'dismissTip' });
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tutorial.activeId).toBe('prepPhase');
    expect(r.tip()?.target).toBe('build-wire');
    // Placing a build ends the lesson.
    r.session.dispatch({ type: 'build', kind: 'wire' });
    r.session.tapGround(1250);
    r.session.dispatch({ type: 'confirmBuild' });
    r.run(1);
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('supplies');
    expect(r.tip()?.text).toMatch(/Money/);
    expect(r.tutorial.activeId).toBe('supplies');
  });

  it('moves on when the player does the thing, and never blocks play', () => {
    const r = rig(BASIC_TRAINING);
    // Ready at once (the opening prep lesson is done), and a sapper trained before its lesson comes up: that lesson is
    // skipped as done.
    r.session.dispatch({ type: 'ready' });
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    expect(runUntil(r, 'train-rifle', 40)).toBe(true);
    expect(r.session.battle.state.sides[0].queue.sapper + r.session.battle.state.sides[0].alive.sapper).toBeGreaterThanOrEqual(3);
    // The battle went on all the while.
    expect(r.session.battle.state.time).toBeGreaterThan(10);
    for (let i = 0; i < 3; i++) r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('order-hold');
    r.session.dispatch({ type: 'order', order: 'hold' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
  });

  it('gives up on a tip the player ignores after its time, and goes on to the next', () => {
    const r = rig(BASIC_TRAINING);
    const seen: string[] = [];
    for (let i = 0; i < 150; i++) {
      r.run(1);
      const target = r.tip()?.target;
      if (target && seen[seen.length - 1] !== target) seen.push(target);
    }
    expect(seen.slice(0, 6)).toEqual(['field', 'build-wire', 'supplies', 'train-sapper', 'train-rifle', 'order-hold']);
  });

  it('points at the map strip after the trench lesson, and a look around ends the tip', () => {
    const r = rig(rich());
    firstLessons(r);
    expect(runUntil(r, 'minimap', 90)).toBe(true);
    r.session.dispatch({ type: 'minimap', frac: 0.4 });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(r.tutorial.activeId).toBeNull();
  });

  it('counts a finger dragging the battlefield as looking around', () => {
    const r = rig(rich());
    firstLessons(r);
    expect(runUntil(r, 'minimap', 90)).toBe(true);
    r.view.camera.dragging = true;
    r.run(0.5);
    r.view.camera.dragging = false;
    expect(r.tip()).toBeNull();
  });

  it('points at Advance once five men are armed, and at holding the trench taken after that', () => {
    const r = rig(rich());
    firstLessons(r);
    r.session.dispatch({ type: 'minimap', frac: 0.2 });
    expect(runUntil(r, 'order-advance', 120)).toBe(true);
    r.session.dispatch({ type: 'order', order: 'advance' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(runUntil(r, 'order-hold', 60)).toBe(true);
    expect(r.tutorial.activeId).toBe('holdForward');
    expect(r.session.battle.state.trenches.filter((t) => t.owner === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('drops in the Fall Back tip when the HQ is under threat, even before the lesson has got that far', () => {
    const r = rig(besieged());
    r.run(24);
    expect(r.tip()?.target).toBe('order-fallBack');
    expect(r.tutorial.activeId).toBe('fallBackNow');
    // Doing it ends the tip.
    r.session.dispatch({ type: 'order', order: 'fallBack' });
    r.run(0.5);
    expect(r.tutorial.activeId).not.toBe('fallBackNow');
  });

  it('lets the player close a tip', () => {
    const r = rig(BASIC_TRAINING);
    r.run(2);
    expect(r.tutorial.activeId).toBe('welcome');
    expect(r.session.dispatch({ type: 'dismissTip' })).toBe(true);
    r.session.fill(false, false);
    expect(r.tip()).toBeNull();
  });

  it('replaces the scripted hints of the training ground, and leaves those of the campaign missions alone', () => {
    const quiet: MissionDef = { ...structuredClone(BASIC_TRAINING), events: [{ type: 'hint', when: { at: 1 }, text: 'A scripted hint.' }] };
    const r = rig(quiet);
    r.run(5);
    expect(r.session.hud.state.hint).toBeNull();
    // Mission 1 lost its guided steps, so its own hints are back.
    const m1 = rig(FIELD);
    m1.run(3);
    expect(m1.session.hud.state.hint).not.toBeNull();
    const m2 = rig(mission(1006));
    m2.run(3.5);
    expect(m2.session.hud.state.hint).not.toBeNull();
  });

  it('gives a tip a fresh counter each time one starts', () => {
    const r = rig(BASIC_TRAINING);
    r.run(2);
    const first = r.session.hud.state.tip?.seq ?? 0;
    r.session.dispatch({ type: 'dismissTip' });
    r.run(TUTORIAL.gapSeconds + 1);
    const second = r.session.hud.state.tip?.seq ?? 0;
    expect(second).toBeGreaterThan(first);
  });
});

describe('new units and supports in later missions', () => {
  it('points at the new unit button the first time, with the faction name, and is done when one is trained', () => {
    const r = rig(mission(1004));
    r.run(2);
    expect(r.tip()?.target).toBe('train-medic');
    expect(r.tip()?.text).toContain('Sanitarka');
    r.session.dispatch({ type: 'train', kind: 'medic' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('new-unit-medic')).toBe(true);
    // Then the new support.
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('support-airStrike');
  });

  it('never repeats a new-unit tip once it has been seen, in this battle or the next, until the tips are replayed', () => {
    const storage = createMemoryStorage();
    const memory = new TipMemory(storage);
    const a = rig(mission(1004), memory);
    a.run(TUTORIAL.newUnit.seconds + 3);
    expect(memory.has('new-unit-medic')).toBe(true);
    const b = rig(mission(1004), new TipMemory(storage));
    b.run(2);
    expect(b.tip()?.target).not.toBe('train-medic');
    new TipMemory(storage).clear();
    const c = rig(mission(1004), new TipMemory(storage));
    c.run(2);
    expect(c.tip()?.target).toBe('train-medic');
  });

  it('lets the player close a tip, which counts as seen', () => {
    const r = rig(mission(1004));
    r.run(2);
    expect(r.tip()?.target).toBe('train-medic');
    expect(r.session.dispatch({ type: 'dismissTip' })).toBe(true);
    r.session.fill(false, false);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('new-unit-medic')).toBe(true);
  });

  it('shows nothing and uses nothing up while hints are switched off', () => {
    const r = rig(mission(1004));
    r.hintsOn.value = false;
    r.run(60);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('new-unit-medic')).toBe(false);
    r.hintsOn.value = true;
    r.run(1);
    expect(r.tip()?.target).toBe('train-medic');
  });
});

describe('the tutorial in the app', () => {
  function makeApp() {
    const view = createFakeView();
    const storage = createMemoryStorage();
    const app = new App({ view, audio: createFakeAudio(), storage, random: () => 0.25 });
    app.attachUi(createFakeUi());
    return { app, view, storage };
  }

  it('runs in Basic Training and campaign missions, and not on the proving ground or under a bot', () => {
    const { app } = makeApp();
    app.startTraining();
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.tutorial?.activeId).toBe('welcome');

    app.beginMission(1004, 'normal');
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip?.target).toBe('train-medic');

    const ground: MissionDef = { ...structuredClone(mission(1004)), id: 99, key: 'ground' };
    app.beginUnlisted(ground, 'normal');
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();

    app.autopilot = true;
    app.startTraining();
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();
  });

  it('keeps the campaign tips it has shown in storage, apart from the save, and clears them with a reset or a replay', () => {
    const { app, storage } = makeApp();
    app.beginMission(1004, 'normal');
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    app.dispatch({ type: 'dismissTip' });
    expect(app.tips.has('new-unit-medic')).toBe(true);
    expect(storage.getItem(TUTORIAL.storageKey)).toContain('new-unit-medic');
    expect(JSON.parse(storage.getItem('tinhats.save') ?? '{}')).not.toHaveProperty('tips');
    app.replayHints();
    expect(app.tips.has('new-unit-medic')).toBe(false);
    expect(storage.getItem(TUTORIAL.storageKey)).toBeNull();
    app.tips.add('hold');
    app.resetSave();
    expect(app.tips.has('hold')).toBe(false);
  });

  it('respects the hints setting in the campaign, and runs Basic Training whatever it says', () => {
    const { app } = makeApp();
    app.setSetting('hints', false);
    app.beginMission(1004, 'normal');
    for (let i = 0; i < 300; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();
    expect(app.tips.has('new-unit-medic')).toBe(false);
    app.startTraining();
    for (let i = 0; i < 60; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip?.target).toBe('field');
  });
});
