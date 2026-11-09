/**
 * Basic Training, the standalone tutorial: its training-ground mission, the course of guided steps (run with a real
 * battle by a "student" who does what each tip asks, and by one who ignores every tip), the one-time medal reward, the
 * title-screen offer and the app flow around it.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { BattleSession } from '../../src/app/session';
import { TipMemory, Tutorial, isTraining, stepsFor, trainingSteps } from '../../src/app/tutorial';
import { campaignOf } from '../../src/data/campaigns';
import { FACTIONS, nationCallsIn, nationFields } from '../../src/data/factions';
import { MEDALS } from '../../src/data/medals';
import { UPGRADES } from '../../src/data/upgrades';
import { MISSIONS } from '../../src/data/missions';
import { BASIC_TRAINING, BASIC_TRAINING_ID, trainingMission } from '../../src/data/missions/training';
import type { MissionDef } from '../../src/data/schema';
import { TUTORIAL, type TipTarget } from '../../src/data/tutorial';
import { UNITS } from '../../src/data/units';
import { META } from '../../src/data/meta';
import { completeTraining, createMemoryStorage, defaultSave, loadSave, migrateSave, sanitizeSave, trainingOffered, writeSave } from '../../src/meta';
import { createBattle } from '../../src/sim';
import { createFakeAudio, createFakeUi, createFakeView, type FakeUi } from './app-helpers';

/** The course in its order, as it is taught today (the prep-phase step waits for job 6). */
const COURSE = trainingSteps().map((s) => s.id);

interface Rig {
  session: BattleSession;
  tutorial: Tutorial;
  memory: TipMemory;
  hintsOn: { value: boolean };
  /** Run this many battle seconds, one rendered frame (two ticks) at a time. */
  run(seconds: number): void;
}

function rig(m: MissionDef = BASIC_TRAINING, seed = 3, memory = new TipMemory(createMemoryStorage())): Rig {
  const battle = createBattle({ mission: m, difficulty: 'normal', seed, upgrades: {}, commanders: ['human', 'ai'] });
  const tutorial = new Tutorial(m, memory);
  const hintsOn = { value: true };
  const session = new BattleSession(battle, 'normal', seed, createFakeView(), createFakeAudio(), {
    hints: () => hintsOn.value,
    sound: () => true,
    onEnded: () => undefined,
    tutorial,
  });
  session.fill(false, false);
  return {
    session,
    tutorial,
    memory,
    hintsOn,
    run(seconds) {
      const frames = Math.round(seconds * 15);
      for (let i = 0; i < frames && !session.battle.state.over; i++) {
        session.step();
        session.step();
        session.fill(false, false);
      }
    },
  };
}

/**
 * A new player who takes `react` seconds to read each tip and find the button, then does what it asks. Informational
 * tips are read to the end.
 * Between the lessons he keeps training riflemen when he can afford them, as the course tells him to.
 */
class Student {
  /** The tips in the order they came up. */
  readonly shown: string[] = [];
  private handledAt = new Map<string, number>();
  private lastTrain = 0;

  constructor(
    private readonly r: Rig,
    private readonly react = 4,
  ) {}

  /** One battle second of play. */
  second(): void {
    const { session, tutorial } = this.r;
    const s = session.battle.state;
    const id = tutorial.activeId;
    if (id !== null && this.shown[this.shown.length - 1] !== id) {
      this.shown.push(id);
      this.handledAt.set(id, s.time);
    }
    // A moment to read before doing it.
    if (id !== null && s.time - (this.handledAt.get(id) ?? s.time) >= this.react) this.act(id);
    if (this.shown.includes('trainRifle') && s.time - this.lastTrain >= 3) {
      const me = s.sides[0];
      if (me.alive.rifle + me.queue.rifle < 14 && me.supplies >= UNITS.rifle.cost) {
        session.dispatch({ type: 'train', kind: 'rifle' });
        this.lastTrain = s.time;
      }
    }
    this.r.run(1);
  }

  private act(id: string): void {
    const session = this.r.session;
    const s = session.battle.state;
    const did = (key: string) => {
      if (this.handledAt.get(`${key}:done`) !== undefined) return true;
      this.handledAt.set(`${key}:done`, s.time);
      return false;
    };
    switch (id) {
      case 'trainSapper':
        if (!did(id)) session.dispatch({ type: 'train', kind: 'sapper' });
        break;
      case 'trainRifle':
        if (!did(id)) for (let i = 0; i < 3; i++) session.dispatch({ type: 'train', kind: 'rifle' });
        break;
      case 'hold':
      case 'holdForward':
        if (!did(id)) session.dispatch({ type: 'order', order: 'hold' });
        break;
      case 'look':
        if (!did(id)) session.dispatch({ type: 'minimap', frac: 0.5 });
        break;
      case 'advance':
      case 'finalAttack':
        if (!did(id)) session.dispatch({ type: 'order', order: 'advance' });
        break;
      case 'kindOrder':
        if (!did(id)) session.dispatch({ type: 'order', order: 'hold', kind: 'lmg' });
        break;
      case 'control': {
        if (did(id)) break;
        for (let i = 0; i < s.unitCount; i++) {
          const u = s.units[i];
          if (u.alive && u.side === 0 && !u.inside && u.kind === 'rifle') {
            session.tapUnit(u.id);
            break;
          }
        }
        break;
      }
      case 'drive':
        if (!did(id)) {
          session.dispatch({ type: 'fire', down: true });
          this.r.run(0.5);
          session.dispatch({ type: 'fire', down: false });
          session.dispatch({ type: 'release' });
        }
        break;
      case 'callIn':
        if (!did(id)) {
          session.dispatch({ type: 'support', kind: 'artillery' });
          session.tapGround(s.pillboxes[0].x);
        }
        break;
      case 'fallBack':
      case 'fallBackNow':
        if (!did(id)) session.dispatch({ type: 'order', order: 'fallBack' });
        break;
      default:
        // Something to read: read it to the end.
        break;
    }
  }
}

/** Play the course with a student until the battle ends (or `limit` battle seconds). */
function playCourse(r: Rig, react = 4, limit = 900): Student {
  const student = new Student(r, react);
  while (!r.session.battle.state.over && r.session.battle.state.time < limit) student.second();
  return student;
}

describe('the training ground', () => {
  it('is its own mission, outside every campaign, with a four-digit id', () => {
    expect(BASIC_TRAINING.id).toBe(BASIC_TRAINING_ID);
    expect(String(BASIC_TRAINING_ID)).toMatch(/^[1-9][0-9]{3}$/);
    expect(MISSIONS.some((m) => m.id === BASIC_TRAINING_ID)).toBe(false);
    expect(campaignOf(BASIC_TRAINING_ID)).toBeNull();
    expect(TUTORIAL.trainingMission).toBe(BASIC_TRAINING_ID);
    expect(isTraining(BASIC_TRAINING)).toBe(true);
    for (const m of MISSIONS) expect(isTraining(m), m.key).toBe(false);
  });

  it('has practice targets and a weak mock enemy that never attacks during the course', () => {
    const m = BASIC_TRAINING;
    // An empty trench to take between our own and the enemy's, and an old pillbox to shell.
    expect(m.trenches.map((t) => t.owner)).toEqual([0, -1, 1]);
    expect(m.pillboxes).toHaveLength(1);
    expect(m.pillboxes[0].hpMul).toBeLessThan(1);
    expect(m.supports[0]).toEqual(['artillery']);
    // The mock enemy: a thin HQ, less income than ours, nothing to call in, and no attack before the course is through.
    const [own, enemy] = m.start;
    expect(enemy.hqHpMul).toBeLessThan(own.hqHpMul);
    expect(enemy.incomeMul).toBeLessThan(own.incomeMul);
    expect(m.supports[1]).toEqual([]);
    expect(m.ai.firstAttackAfter).toBeGreaterThanOrEqual(m.expectedMinutes[1] * 60);
    expect(m.expectedMinutes).toEqual([5, 10]);
    expect(m.events).toEqual([]);
  });

  it('is played as the British today, and as any nation by data', () => {
    expect(trainingMission()).toBe(BASIC_TRAINING);
    expect(BASIC_TRAINING.start[0].faction).toBe('british');
    const soviet = trainingMission('soviet');
    expect(soviet.start[0].faction).toBe('soviet');
    expect(soviet.start[1]).toEqual(BASIC_TRAINING.start[1]);
    expect(BASIC_TRAINING.start[0].faction).toBe('british');
    for (const nation of ['british', 'soviet'] as const) {
      expect(FACTIONS[nation]).toBeDefined();
      for (const kind of BASIC_TRAINING.units[0]) expect(nationFields(nation, kind), `${nation} ${kind}`).toBe(true);
      for (const kind of BASIC_TRAINING.supports[0]) expect(nationCallsIn(nation, kind), `${nation} ${kind}`).toBe(true);
      const b = createBattle({ mission: trainingMission(nation), difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['human', 'ai'] });
      expect(b.state.sides[0].available.lmg).toBe(true);
    }
  });
});

describe('the course', () => {
  it('teaches every subject of the spec, in steps short enough for a phone', () => {
    const steps = TUTORIAL.steps;
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const targets = new Set<TipTarget>(steps.map((s) => s.target));
    // Money and sappers; training units; the three army orders; per-unit-type orders; direct control; call-ins.
    for (const t of ['supplies', 'train-sapper', 'train-rifle', 'order-hold', 'order-advance', 'order-fallBack', 'order-scope', 'fire', 'support-artillery'] as const) {
      expect(targets.has(t), t).toBe(true);
    }
    // Trenches and cover, direct control, building in a prep phase, and the medals, Armoury and Quartermaster screens.
    for (const id of ['cover', 'holdForward', 'control', 'drive', 'prepPhase', 'medals', 'armoury', 'quartermaster']) expect(ids, id).toContain(id);
    for (const s of steps) {
      for (const a of s.after ?? []) expect(ids, `${s.id} follows ${a}`).toContain(a);
      expect(s.seconds, s.id).toBeGreaterThan(3);
      const filled = s.text.replace('{reward}', String(MEDALS.trainingReward)).replace('{name}', 'Artillery Barrage');
      // Two lines of a narrow bubble.
      expect(filled.length, s.id).toBeLessThanOrEqual(100);
      expect(filled.length, s.id).toBeGreaterThan(10);
      if (s.target.startsWith('train-')) expect(BASIC_TRAINING.units[0], s.id).toContain(s.target.slice(6));
      if (s.target.startsWith('support-')) expect(BASIC_TRAINING.supports[0], s.id).toContain(s.target.slice(8));
    }
  });

  it('opens with building in a prep phase, now that the engine has one', () => {
    const prep = TUTORIAL.steps.find((s) => s.id === 'prepPhase');
    expect(prep?.needs).toBe('prepPhase');
    expect(prep?.target).toBe('build-wire');
    expect(TUTORIAL.features.prepPhase).toBe(true);
    expect(COURSE.slice(0, 3)).toEqual(['welcome', 'prepPhase', 'supplies']);
    expect(BASIC_TRAINING.prep?.buildables).toContain('wire');
    expect(stepsFor(BASIC_TRAINING).map((s) => s.id)).toEqual(COURSE);
  });

  it('is offered only on the training ground: campaign missions keep their own tips', () => {
    for (const m of MISSIONS) for (const s of stepsFor(m)) expect(s.id, m.key).toMatch(/^new-(unit|support)-/);
    expect(TUTORIAL.replacesScriptedHints).toEqual([BASIC_TRAINING_ID]);
  });

  it.each([
    ['a quick student', 4, 3],
    ['a quick student on another day', 4, 11],
    ['a slow student', 10, 5],
  ])('walks %s who does what each tip asks through every lesson in order, and he passes in 5 to 10 minutes', (_who, react, seed) => {
    const r = rig(BASIC_TRAINING, seed);
    const student = playCourse(r, react);
    const s = r.session.battle.state;
    // Every lesson came up, in the course's order; the HQ was never in danger, so the urgent Fall Back never cut in.
    expect(student.shown).toEqual(COURSE.filter((id) => id !== 'fallBackNow'));
    expect(r.tutorial.finished).toBe(true);
    // He destroyed the mock enemy HQ.
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.time).toBeGreaterThanOrEqual(BASIC_TRAINING.expectedMinutes[0] * 60);
    expect(s.time).toBeLessThanOrEqual(BASIC_TRAINING.expectedMinutes[1] * 60);
    // Each thing he was asked to do was done for real.
    expect(r.session.tally.supportCalled.artillery).toBeGreaterThanOrEqual(1);
    expect(s.sides[0].kindOrders.lmg).toBe('hold');
    expect(s.trenches.filter((t) => t.owner === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('ends a lesson as soon as the player does the thing', () => {
    const r = rig();
    for (let i = 0; i < 60 && r.tutorial.activeId !== 'trainSapper'; i++) r.run(1);
    expect(r.tutorial.activeId).toBe('trainSapper');
    expect(r.session.hud.state.tip?.target).toBe('train-sapper');
    r.session.dispatch({ type: 'train', kind: 'sapper' });
    r.run(0.5);
    expect(r.tutorial.activeId).toBeNull();
    r.run(TUTORIAL.gapSeconds + 0.5);
    expect(r.tutorial.activeId).toBe('trainRifle');
    // Three riflemen, not one.
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.run(0.5);
    expect(r.tutorial.activeId).toBe('trainRifle');
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.session.dispatch({ type: 'train', kind: 'rifle' });
    r.run(0.5);
    expect(r.tutorial.activeId).toBeNull();
  });

  it('counts an order for one unit type as the per-unit lesson and not as an army order', () => {
    const r = rig();
    r.session.dispatch({ type: 'order', order: 'hold', kind: 'lmg' });
    r.session.dispatch({ type: 'order', order: 'advance', kind: 'rifle' });
    // Playing on to the Hold lesson: the per-kind Hold above did not count as the army's.
    for (let i = 0; i < 120 && r.tutorial.activeId !== 'hold'; i++) {
      if (r.tutorial.activeId === 'trainSapper') r.session.dispatch({ type: 'train', kind: 'sapper' });
      if (r.tutorial.activeId === 'trainRifle') for (let k = 0; k < 3; k++) r.session.dispatch({ type: 'train', kind: 'rifle' });
      r.run(1);
    }
    expect(r.tutorial.activeId).toBe('hold');
  });

  it('never blocks a player who ignores every tip: each gives up in its time and the course goes on to the end', () => {
    const r = rig(BASIC_TRAINING, 5);
    const shown: string[] = [];
    for (let t = 0; t < 600 && !r.tutorial.finished; t++) {
      const id = r.tutorial.activeId;
      if (id !== null && shown[shown.length - 1] !== id) shown.push(id);
      r.run(1);
    }
    expect(r.tutorial.finished).toBe(true);
    // Everything came up but the lessons that need the player first: steering a unit he never took, and holding the
    // trench taken by an advance he never ordered (his army is still on Hold, so that lesson counts as done).
    expect(shown).toEqual(COURSE.filter((id) => id !== 'drive' && id !== 'fallBackNow' && id !== 'holdForward'));
    // Idle, he is never beaten by the mock enemy in that time.
    expect(r.session.battle.state.winner).not.toBe(1);
  });

  it('runs whatever the hints setting, every time it is played, and remembers nothing', () => {
    const storage = createMemoryStorage();
    const first = rig(BASIC_TRAINING, 3, new TipMemory(storage));
    first.hintsOn.value = false;
    first.run(2);
    expect(first.tutorial.activeId).toBe('welcome');
    first.session.dispatch({ type: 'dismissTip' });
    first.run(30);
    expect(storage.getItem(TUTORIAL.storageKey)).toBeNull();
    const again = rig(BASIC_TRAINING, 3, new TipMemory(storage));
    again.run(2);
    expect(again.tutorial.activeId).toBe('welcome');
  });

  it('puts the reward and the call-in name into the text', () => {
    const r = rig();
    const texts = new Map<string, string>();
    const student = new Student(r);
    while (!r.session.battle.state.over && r.session.battle.state.time < 900 && !texts.has('medals')) {
      const id = r.tutorial.activeId;
      if (id !== null) texts.set(id, r.session.hud.state.tip?.text ?? '');
      student.second();
    }
    expect(texts.get('medals')).toContain(`${MEDALS.trainingReward} medals`);
    expect(texts.get('callIn')).toContain(FACTIONS.british.supportNames.artillery);
    for (const text of texts.values()) expect(text).not.toMatch(/[{}]/);
  });
});

describe('the reward', () => {
  // Units are unlocked by missions since v0.12.0, so the reward buys upgrades: a few first levels, no more than a
  // couple of perfect wins.
  it('pays once, the first time, and is enough for a few first upgrade levels', () => {
    const first = UPGRADES[0].levelCosts?.[0] ?? UPGRADES[0].costPerLevel;
    expect(MEDALS.trainingReward).toBeGreaterThanOrEqual(3 * first);
    expect(MEDALS.trainingReward).toBeLessThanOrEqual(2 * MEDALS.perfect);
    const save = defaultSave();
    expect(trainingOffered(save)).toBe(true);
    expect(completeTraining(save)).toBe(MEDALS.trainingReward);
    expect(save.medals).toBe(MEDALS.trainingReward);
    expect(save.training.done).toBe(true);
    expect(trainingOffered(save)).toBe(false);
    expect(completeTraining(save)).toBe(0);
    expect(save.medals).toBe(MEDALS.trainingReward);
  });

  it('never takes a save past the medal cap', () => {
    const save = defaultSave();
    save.medals = MEDALS.maxMedals - 5;
    expect(completeTraining(save)).toBe(5);
    expect(save.medals).toBe(MEDALS.maxMedals);
  });
});

describe('Basic Training in the app', () => {
  function makeApp(storage = createMemoryStorage()) {
    const app = new App({ view: createFakeView(), audio: createFakeAudio(), storage, random: () => 0.25 });
    const ui: FakeUi = createFakeUi();
    app.attachUi(ui);
    return { app, ui, storage };
  }

  /** Play the course to the end through the app's own session, as a student. */
  function pass(app: App): void {
    const session = app.session;
    const tutorial = app.tutorial;
    if (session === null || tutorial === null) throw new Error('no training battle');
    const r: Rig = {
      session,
      tutorial,
      memory: app.tips,
      hintsOn: { value: true },
      run(seconds) {
        const frames = Math.round(seconds * 15);
        for (let i = 0; i < frames && !session.battle.state.over; i++) {
          session.step();
          session.step();
          session.fill(false, false);
        }
      },
    };
    playCourse(r);
    expect(session.battle.state.winner).toBe(0);
  }

  it('starts on the training ground, on Normal, with its guided steps, and touches no campaign progress', () => {
    const { app, ui } = makeApp();
    app.setSetting('difficulty', 'insane');
    app.startTraining();
    expect(app.session?.mission.id).toBe(BASIC_TRAINING_ID);
    expect(app.session?.difficulty).toBe('normal');
    expect(app.tutorial?.course).toBe(true);
    expect(ui.screens[ui.screens.length - 1]).toBe('battle');
    expect(app.save.lastMission).toBe(0);
    // Replay from the result screen starts it again (it is not in the campaign list).
    app.startMission(BASIC_TRAINING_ID, 'hard');
    expect(app.session?.mission.id).toBe(BASIC_TRAINING_ID);
    expect(app.session?.difficulty).toBe('normal');
  });

  it('pays its reward on the first pass only, records it in the save, and offers the Armoury next', () => {
    const { app, storage } = makeApp();
    expect(app.campaign().training).toEqual({ done: false, offer: true, reward: MEDALS.trainingReward });
    app.startTraining();
    pass(app);
    expect(app.save.medals).toBe(MEDALS.trainingReward);
    expect(app.save.training.done).toBe(true);
    expect(app.lastResult).toMatchObject({ won: true, training: true, pointsAwarded: MEDALS.trainingReward, nextMissionId: null, missionId: BASIC_TRAINING_ID });
    expect(app.lastMedals).toBeNull();
    // Recorded in the stored save, not as a campaign clear.
    const stored = JSON.parse(storage.getItem('tinhats.save') ?? '{}') as { training: unknown; cleared: unknown; wins: unknown; medals: number };
    expect(stored.training).toEqual({ done: true, skipped: false });
    expect(stored.cleared).toEqual({});
    expect(stored.wins).toEqual({});
    expect(stored.medals).toBe(MEDALS.trainingReward);
    expect(app.campaign().training).toEqual({ done: true, offer: false, reward: MEDALS.trainingReward });
    // A second pass pays nothing.
    app.startTraining();
    pass(app);
    expect(app.save.medals).toBe(MEDALS.trainingReward);
    expect(app.lastResult?.pointsAwarded).toBe(0);
    // A fresh app on the same storage remembers it.
    expect(makeApp(storage).app.save.training.done).toBe(true);
  });

  it('pays nothing for a lost or abandoned course', () => {
    const { app, ui } = makeApp();
    app.startTraining();
    app.dispatch({ type: 'quit' });
    // Quitting goes back to the title screen it was started from.
    expect(ui.screens[ui.screens.length - 1]).toBe('title');
    expect(app.session).toBeNull();
    expect(app.save.medals).toBe(0);
    expect(app.save.training.done).toBe(false);
  });

  it('is offered on the title screen until it is turned down, and a reset offers it again', () => {
    const { app, storage } = makeApp();
    expect(app.campaign().training?.offer).toBe(true);
    app.skipTraining();
    expect(app.campaign().training?.offer).toBe(false);
    expect(makeApp(storage).app.campaign().training?.offer).toBe(false);
    app.resetSave();
    expect(app.campaign().training).toEqual({ done: false, offer: true, reward: MEDALS.trainingReward });
  });
});

describe('the save, version 9', () => {
  /** A save as version 6 wrote it: medals and the Armoury, no Basic Training. */
  const v6 = {
    version: 6,
    cleared: { '1': ['normal'] },
    upgrades: {},
    medals: 55,
    armoury: ['lmg'],
    wins: { '1': { normal: 1 } },
    lastMission: 1,
    settings: { muted: true, difficulty: 'hard', hints: false },
  };

  it('brings a version 6 save up with Basic Training not yet finished, keeping everything else', () => {
    const migrated = migrateSave(v6);
    expect(migrated?.version).toBe(META.saveVersion);
    expect(migrated?.training).toEqual({ done: false, skipped: false });
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v6) }));
    expect(loaded.status).toBe('ok');
    expect(loaded.data.training).toEqual({ done: false, skipped: false });
    // Version 8 gave back the 90 medals the Bren gun cost; it stays unlocked.
    expect(loaded.data.medals).toBe(55 + (MEDALS.unitRefunds.lmg ?? 0));
    expect(loaded.data.armoury).toEqual(['lmg']);
    // Version 10 archived the British clear and win (those missions are gone) and kept everything they earned.
    expect(loaded.data.cleared).toEqual({});
    expect(loaded.data.legacy).toEqual({ cleared: v6.cleared, wins: v6.wins });
    expect(loaded.data.lastMission).toBe(0);
    // An old player can still earn the reward once.
    expect(completeTraining(loaded.data)).toBe(MEDALS.trainingReward);
    expect(loaded.data.medals).toBe(55 + (MEDALS.unitRefunds.lmg ?? 0) + MEDALS.trainingReward);
  });

  it('does not change the document it was given', () => {
    const copy = structuredClone(v6);
    migrateSave(copy);
    expect(copy).toEqual(v6);
  });

  it('keeps a finished course and a turned-down offer across a write and a load', () => {
    const save = defaultSave();
    completeTraining(save);
    save.training.skipped = true;
    const storage = createMemoryStorage();
    writeSave(storage, save);
    const loaded = loadSave(storage);
    expect(loaded.status).toBe('ok');
    expect(loaded.data.training).toEqual({ done: true, skipped: true });
    expect(loaded.data.medals).toBe(MEDALS.trainingReward);
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it.each([
    ['missing', undefined],
    ['not an object', 'yes'],
    ['an array', [true, true]],
    ['flags of the wrong type', { done: 'true', skipped: 1 }],
    ['null', null],
  ])('reads a training record that is %s as not finished and not turned down', (_name, training) => {
    const data = sanitizeSave({ version: META.saveVersion, training });
    expect(data?.training).toEqual({ done: false, skipped: false });
  });
});
