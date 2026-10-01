import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { BattleSession } from '../../src/app/session';
import { TipMemory, Tutorial, stepsFor } from '../../src/app/tutorial';
import { M01 } from '../../src/data/missions/m01';
import { MISSIONS } from '../../src/data/missions';
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

/** Mission 1 with the Germans' machine guns dug in a stone's throw from our HQ and no scripted events. */
function besieged(): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.events = [];
  m.start[1].forces = [{ kind: 'lmg', count: 4, x: 360, behaviour: 'guard' }];
  return m;
}

/** Mission 1 with plenty of supplies, so every order the test gives can be paid for, and a quiet enemy. */
function rich(): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.events = [];
  m.start[0].supplies = 3000;
  m.ai.firstAttackAfter = 9999;
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
  it('teaches supplies, training, the three orders, panning and taking control in mission 1', () => {
    const steps = stepsFor(M01);
    expect(steps.map((s) => s.id)).toEqual(['supplies', 'trainSapper', 'trainRifle', 'hold', 'look', 'advance', 'control', 'fallBack']);
    const targets = steps.map((s) => s.target);
    for (const t of ['supplies', 'train-sapper', 'train-rifle', 'order-hold', 'minimap', 'order-advance', 'order-fallBack']) expect(targets).toContain(t);
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
    // Every unit button the first mission points at is one the player has in mission 1.
    for (const s of steps) if (s.target.startsWith('train-')) expect(M01.units[0]).toContain(s.target.slice(6));
  });

  it('gives a mission that introduces a unit and a support one tip each, the support after the unit', () => {
    const steps = stepsFor(mission(4));
    expect(steps.map((s) => s.id)).toEqual(['new-unit-mortar', 'new-support-artillery']);
    expect(steps[0].target).toBe('train-mortar');
    expect(steps[1].target).toBe('support-artillery');
    expect(steps[1].after).toEqual(['new-unit-mortar']);
  });

  it('gives no first-mission steps and no tip for what a mission does not offer', () => {
    expect(stepsFor(mission(2)).every((s) => s.id.startsWith('new-'))).toBe(true);
    const odd: MissionDef = structuredClone(mission(4));
    odd.units = [['sapper', 'rifle'], ['sapper', 'rifle']];
    odd.supports = [[], []];
    expect(stepsFor(odd)).toEqual([]);
  });

  it('has a tip for every unit and support a mission introduces', () => {
    for (const m of MISSIONS) {
      if (m.id === TUTORIAL.firstMission) continue;
      if (m.newUnit !== null && UNITS[m.newUnit].trainable) expect(TUTORIAL.newUnit.tips[m.newUnit], `mission ${m.id} unit`).toBeDefined();
      expect(stepsFor(m).length, `mission ${m.id}`).toBe((m.newUnit !== null ? 1 : 0) + (m.newSupport !== null ? 1 : 0));
    }
  });
});

describe('the guided tutorial in mission 1', () => {
  it('starts with supplies and sappers, pointing at the supplies readout', () => {
    const r = rig(M01);
    r.run(0.5);
    expect(r.tip()).toBeNull();
    r.run(1);
    expect(r.tip()?.target).toBe('supplies');
    expect(r.tip()?.text).toMatch(/Supplies/);
    expect(r.tutorial.activeId).toBe('supplies');
  });

  it('moves on when the player does the thing, and never blocks play', () => {
    const r = rig(M01);
    r.run(2);
    expect(r.tip()?.target).toBe('supplies');
    // Training a sapper ends the supplies tip and skips the "train a sapper" step, which is already done.
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('train-rifle');
    // The battle went on all the while.
    expect(r.session.battle.state.time).toBeGreaterThan(4);
    expect(r.session.battle.state.sides[0].queue.sapper).toBe(1);
    // Two riflemen end the rifle tip; the Hold tip follows.
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.run(0.5);
    expect(r.tip()?.target).toBe('train-rifle');
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('order-hold');
    r.session.dispatch({ type: 'order', order: 'hold' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
  });

  it('gives up on a tip the player ignores after its time, and goes on to the next', () => {
    const r = rig(M01);
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      r.run(1);
      const target = r.tip()?.target;
      if (target && seen[seen.length - 1] !== target) seen.push(target);
    }
    expect(seen.slice(0, 4)).toEqual(['supplies', 'train-sapper', 'train-rifle', 'order-hold']);
  });

  it('points at the map strip after thirty seconds, and a look around ends the tip', () => {
    const r = rig(rich());
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'order', order: 'hold' });
    r.run(20);
    expect(r.tip()).toBeNull();
    expect(runUntil(r, 'minimap', 30)).toBe(true);
    expect(r.session.battle.state.time).toBeGreaterThanOrEqual(30);
    r.session.dispatch({ type: 'minimap', frac: 0.4 });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('look')).toBe(true);
  });

  it('counts a finger dragging the battlefield as looking around', () => {
    const r = rig(rich());
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'order', order: 'hold' });
    expect(runUntil(r, 'minimap', 60)).toBe(true);
    r.view.camera.dragging = true;
    r.run(0.5);
    r.view.camera.dragging = false;
    expect(r.tip()).toBeNull();
    expect(r.memory.has('look')).toBe(true);
  });

  it('points at Advance once six men are armed, and at taking control after that', () => {
    const r = rig(rich());
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    for (let i = 0; i < 4; i++) r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'order', order: 'hold' });
    r.session.dispatch({ type: 'minimap', frac: 0.2 });
    expect(runUntil(r, 'order-advance', 120)).toBe(true);
    expect(r.session.battle.state.sides[0].alive.rifle).toBeGreaterThanOrEqual(6);
    r.session.dispatch({ type: 'order', order: 'advance' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(runUntil(r, 'field', 60)).toBe(true);
    expect(r.tip()?.text).toMatch(/take control/);
  });

  it('drops in the Fall Back tip when the HQ is under threat, even before the lesson has got that far', () => {
    const r = rig(besieged());
    r.run(24);
    expect(r.tip()?.target).toBe('order-fallBack');
    expect(r.tutorial.activeId).toBe('fallBack');
    // Doing it ends the tip.
    r.session.dispatch({ type: 'order', order: 'fallBack' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
  });

  it('shows nothing and uses nothing up while hints are switched off', () => {
    const r = rig(M01);
    r.hintsOn.value = false;
    r.run(60);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('supplies')).toBe(false);
    r.hintsOn.value = true;
    r.run(1);
    expect(r.tip()?.target).toBe('supplies');
  });

  it('remembers every tip that ended and never shows one again, in this battle or the next', () => {
    const storage = createMemoryStorage();
    const first = rig(M01, new TipMemory(storage));
    r_finishAll(first);
    // A new battle with the same memory: nothing to say, however long it runs.
    const second = rig(M01, new TipMemory(storage));
    second.run(240);
    expect(second.tip()).toBeNull();
    // Replaying the tutorial brings them back.
    const again = new TipMemory(storage);
    again.clear();
    const third = rig(M01, new TipMemory(storage));
    third.run(2);
    expect(third.tip()?.target).toBe('supplies');
  });

  it('resumes where an earlier battle left off', () => {
    const storage = createMemoryStorage();
    const first = rig(M01, new TipMemory(storage));
    first.session.dispatch({ type: 'train', kind: 'sapper' });
    first.run(6);
    expect(first.memory.has('supplies')).toBe(true);
    expect(first.memory.has('trainSapper')).toBe(true);
    const second = rig(M01, new TipMemory(storage));
    second.run(2);
    expect(second.tip()?.target).toBe('train-rifle');
  });

  it('lets the player close a tip, which counts as seen', () => {
    const r = rig(M01);
    r.run(2);
    expect(r.tip()?.target).toBe('supplies');
    expect(r.session.dispatch({ type: 'dismissTip' })).toBe(true);
    r.session.fill(false, false);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('supplies')).toBe(true);
  });

  it('replaces the scripted hints of mission 1, and leaves those of other missions alone', () => {
    const r = rig(M01);
    r.run(20);
    expect(r.session.hud.state.hint).toBeNull();
    const m2 = rig(mission(2));
    m2.run(3);
    expect(m2.session.hud.state.hint).not.toBeNull();
  });

  it('gives a tip a fresh counter each time one starts', () => {
    const r = rig(M01);
    r.run(2);
    const first = r.session.hud.state.tip?.seq ?? 0;
    r.session.dispatch({ type: 'dismissTip' });
    r.run(TUTORIAL.gapSeconds + 1);
    const second = r.session.hud.state.tip?.seq ?? 0;
    expect(second).toBeGreaterThan(first);
  });
});

/** Play mission 1's lesson through by doing everything it asks, until no tip is left. */
function r_finishAll(r: Rig): void {
  const asked: Record<string, () => void> = {
    supplies: () => undefined,
    'train-sapper': () => r.session.dispatch({ type: 'train', kind: 'sapper' }),
    'train-rifle': () => {
      r.session.dispatch({ type: 'train', kind: 'rifle' });
      r.session.dispatch({ type: 'train', kind: 'rifle' });
    },
    'order-hold': () => r.session.dispatch({ type: 'order', order: 'hold' }),
    minimap: () => r.session.dispatch({ type: 'minimap', frac: 0.3 }),
    'order-advance': () => r.session.dispatch({ type: 'order', order: 'advance' }),
    field: () => undefined,
    'order-fallBack': () => r.session.dispatch({ type: 'order', order: 'fallBack' }),
  };
  for (let i = 0; i < 400; i++) {
    r.run(1);
    const target = r.tip()?.target;
    if (target) asked[target]();
    if (target === undefined && r.memory.has('control') && r.memory.has('advance') && r.memory.has('look')) break;
  }
  expect(r.memory.has('supplies')).toBe(true);
  expect(r.memory.has('trainRifle')).toBe(true);
}

describe('new units and supports in later missions', () => {
  it('points at the new unit button the first time, with the faction name, and is done when one is trained', () => {
    const r = rig(mission(4));
    r.run(2);
    expect(r.tip()?.target).toBe('train-mortar');
    expect(r.tip()?.text).toContain('Mortar Team');
    r.session.dispatch({ type: 'train', kind: 'mortar' });
    r.run(0.5);
    expect(r.tip()).toBeNull();
    expect(r.memory.has('new-unit-mortar')).toBe(true);
    // Then the new support.
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tip()?.target).toBe('support-artillery');
  });

  it('never repeats a new-unit tip once it has been seen', () => {
    const memory = new TipMemory(createMemoryStorage());
    const a = rig(mission(4), memory);
    a.run(TUTORIAL.newUnit.seconds + 3);
    expect(memory.has('new-unit-mortar')).toBe(true);
    const b = rig(mission(4), memory);
    b.run(2);
    expect(b.tip()?.target).not.toBe('train-mortar');
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

  it('runs in campaign missions and not on the proving ground or under a bot', () => {
    const { app } = makeApp();
    app.startMission(1, 'normal');
    expect(app.session?.hud.state.tip).toBeNull();
    for (let i = 0; i < 120; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip?.target).toBe('supplies');

    const ground: MissionDef = { ...structuredClone(M01), id: 99, key: 'ground' };
    app.beginUnlisted(ground, 'normal');
    for (let i = 0; i < 120; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();

    app.autopilot = true;
    app.startMission(1, 'normal');
    for (let i = 0; i < 120; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();
  });

  it('keeps the tips it has shown in storage, apart from the save, and clears them with a reset or a replay', () => {
    const { app, storage } = makeApp();
    app.startMission(1, 'normal');
    for (let i = 0; i < 120; i++) app.session?.step();
    app.session?.fill(false, false);
    app.dispatch({ type: 'dismissTip' });
    expect(app.tips.has('supplies')).toBe(true);
    expect(storage.getItem(TUTORIAL.storageKey)).toContain('supplies');
    expect(JSON.parse(storage.getItem('tinhats.save') ?? '{}')).not.toHaveProperty('tips');
    app.replayHints();
    expect(app.tips.has('supplies')).toBe(false);
    expect(storage.getItem(TUTORIAL.storageKey)).toBeNull();
    app.tips.add('hold');
    app.resetSave();
    expect(app.tips.has('hold')).toBe(false);
  });

  it('respects the hints setting', () => {
    const { app } = makeApp();
    app.setSetting('hints', false);
    app.startMission(1, 'normal');
    for (let i = 0; i < 300; i++) app.session?.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.tip).toBeNull();
    expect(app.tips.has('supplies')).toBe(false);
  });
});
