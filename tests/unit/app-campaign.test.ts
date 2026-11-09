/**
 * The campaign as the player meets it: the ten real missions and the real Quartermaster table, run through the app
 * controller with a fake view, audio and UI. Covers the flow (unlocking, upgrades, remembered choices) and the
 * in-battle wiring of the mission features (timers, banners, notices, hints, darkness, result reasons).
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { describeEnd } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { mapX, mapY } from '../../src/data/campaignMap';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef, MissionEventDef } from '../../src/data/schema';
import { MEDALS } from '../../src/data/medals';
import { UPGRADES } from '../../src/data/upgrades';
import { createMemoryStorage, loadSave, recordClear } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

/** Medals per Quartermaster level. */
const PRICE = UPGRADES[0].costPerLevel;

function makeApp(storage = createMemoryStorage()) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const app = new App({ view, audio, storage, random: () => 0.25 });
  app.attachUi(ui);
  return { app, view, audio, ui, storage };
}

function mission(id: number): MissionDef {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`mission ${id} is not registered`);
  return m;
}

/** Run rendered frames until the battle clock passes `seconds`. */
function runTo(app: App, view: ReturnType<typeof createFakeView>, seconds: number): void {
  for (let i = 0; i < 20000 && (app.session?.battle.state.time ?? seconds) < seconds && !app.session?.ended; i++) view.frame?.(100);
}

describe('the campaign over the real missions', () => {
  it('lists the ten missions in order, only the first open', () => {
    const { app } = makeApp();
    const cards = app.campaign().missions;
    expect(cards.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cards.map((c) => c.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    expect(cards.every((c) => c.briefing.length > 0 && c.objective.length > 0 && c.title.length > 0)).toBe(true);
  });

  it('places every mission on the map, apart from each other, in the order of the route', () => {
    const { app } = makeApp();
    const spots = app.campaign().missions.map((c) => ({ x: mapX(c.mapPos.lon), y: mapY(c.mapPos.lat) }));
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y), `missions ${i + 1} and ${j + 1}`).toBeGreaterThan(0.004);
      }
    }
  });

  it('introduces the new units and supports the campaign promises', () => {
    const { app } = makeApp();
    const cards = app.campaign().missions;
    expect(cards.map((c) => c.newUnit?.kind ?? null)).toEqual(['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', null, null]);
    expect(cards.map((c) => c.newSupport?.kind ?? null)).toEqual([null, null, null, 'artillery', null, 'smoke', null, null, null, 'airStrike']);
    for (const c of cards) {
      if (c.newUnit) {
        expect(c.newUnit.name.length).toBeGreaterThan(0);
        expect(c.newUnit.blurb.length).toBeGreaterThan(0);
      }
      if (c.newSupport) expect(c.newSupport.blurb.length).toBeGreaterThan(0);
    }
    expect(cards[6].newUnit?.name).toBe('PIAT Team');
    expect(cards[7].newUnit?.name).toContain('Churchill');
  });

  it('puts the missions in the theatres of the specification', () => {
    const { app } = makeApp();
    expect(app.campaign().missions.map((c) => c.theatre)).toEqual([
      'france',
      'france',
      'desert',
      'desert',
      'sicily',
      'italy',
      'normandy',
      'france',
      'holland',
      'germany',
    ]);
  });

  it('opens each mission only when the one before it is cleared, on any difficulty', () => {
    const { app } = makeApp();
    recordClear(app.save, 1, 'insane');
    expect(app.campaign().missions.map((c) => c.unlocked).slice(0, 3)).toEqual([true, true, false]);
    // Clearing mission 3 without mission 2 does not open mission 4 (the save checker would drop that anyway).
    recordClear(app.save, 3, 'normal');
    expect(app.campaign().missions[3].unlocked).toBe(true);
    expect(app.campaign().missions[2].unlocked).toBe(false);
    expect(app.campaign().missions[0].cleared).toEqual({ normal: false, hard: false, insane: true });
  });

  it('opens every mission for the tests without recording a clear or a point', () => {
    const { app, ui, storage } = makeApp();
    app.unlockAll();
    expect(app.campaign().missions.every((c) => c.unlocked)).toBe(true);
    expect(app.campaign().pointsEarned).toBe(0);
    expect(app.save.cleared).toEqual({});
    expect(loadSave(storage).status).toBe('fresh');
    expect(ui.current()).toBe('title');
  });
});

describe('upgrades in the campaign', () => {
  it('offers the real Quartermaster table', () => {
    const { app } = makeApp();
    const view = app.campaign();
    expect(view.upgrades.map((u) => u.id)).toEqual(UPGRADES.map((u) => u.id));
    expect(view.upgrades.every((u) => u.maxLevel === 3 && u.levelText.length === 3 && u.levelText.every((t) => t !== APP.effectNone))).toBe(true);
    expect(view.pointsAvailable).toBe(0);
  });

  // Since medals, a clear pays nothing by itself: wins pay medals (meta-medals.test.ts), and the Quartermaster spends them.
  it('pays nothing for a clear alone: the Quartermaster spends medals', () => {
    const { app } = makeApp();
    recordClear(app.save, 1, 'normal');
    expect(app.campaign().pointsAvailable).toBe(0);
    app.save.medals = 35;
    expect(app.campaign().pointsAvailable).toBe(35);
    expect(app.campaign().medals).toBe(35);
  });

  it('buys one level at a time, refunds one level at a time or all at once, and never overspends', () => {
    const { app, storage } = makeApp();
    app.buyUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({});
    app.save.medals = 4 * PRICE;
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqIncome');
    expect(app.save.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(PRICE);
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({ hqHealth: 3, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(0);
    app.refundUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(PRICE);
    expect(loadSave(storage, { upgradeDefs: UPGRADES }).data.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    app.refundAll();
    expect(app.save.upgrades).toEqual({});
    expect(app.campaign().pointsAvailable).toBe(4 * PRICE);
  });

  it('builds the battle with the upgrade levels of the save', () => {
    const { app } = makeApp();
    app.save.medals = 2 * PRICE;
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    app.startMission(1, 'normal');
    const upgraded = app.session;
    expect(upgraded?.battle.config.upgrades).toEqual({ hqHealth: 2 });
    const hq = upgraded?.battle.state.sides[0].hq;

    app.refundAll();
    app.startMission(1, 'normal');
    const plain = app.session?.battle.state.sides[0].hq;
    expect(app.session?.battle.config.upgrades).toEqual({});
    // Sandbagged HQ level 2 is +24% health.
    expect(hq && plain ? hq.maxHp / plain.maxHp : 0).toBeCloseTo(1.24, 5);
  });

  it('keeps upgrades off the enemy and out of the next battle once refunded', () => {
    const { app } = makeApp();
    app.save.medals = PRICE;
    app.buyUpgrade('hqHealth');
    app.startMission(1, 'normal');
    const sides = app.session?.battle.state.sides;
    expect(sides && sides[0].hq && sides[1].hq ? sides[0].hq.maxHp / sides[1].hq.maxHp : 0).toBeGreaterThan(1.1);
  });

  it('sets levels for the tests: unknown upgrades dropped, levels capped, no medals needed', () => {
    const { app, storage } = makeApp();
    app.setUpgrades({ rifleHealth: 9, tankDamage: 2, nonsense: 1, hqIncome: 0 });
    expect(app.save.upgrades).toEqual({ rifleHealth: 3, tankDamage: 2 });
    expect(app.campaign().upgrades.find((u) => u.id === 'rifleHealth')?.level).toBe(3);
    // Since medals, levels are paid for when bought, so the next load keeps them (capped) as they are.
    expect(loadSave(storage, { upgradeDefs: UPGRADES }).data.upgrades).toEqual({ rifleHealth: 3, tankDamage: 2 });
    expect(app.save.medals).toBe(0);
  });
});

describe('choices that are remembered', () => {
  it('remembers the difficulty a mission was started on, and survives a reload', () => {
    const { app, storage } = makeApp();
    app.startMission(1, 'insane');
    expect(app.campaign().settings.difficulty).toBe('insane');
    const reloaded = new App({ view: createFakeView(), audio: createFakeAudio(), storage });
    expect(reloaded.campaign().settings.difficulty).toBe('insane');
  });

  it('remembers the mission last started and offers it to the map', () => {
    const { app, storage } = makeApp();
    expect(app.campaign().lastMission).toBe(0);
    app.unlockAll();
    app.startMission(3, 'normal');
    expect(app.campaign().lastMission).toBe(3);
    const reloaded = new App({ view: createFakeView(), audio: createFakeAudio(), storage });
    expect(reloaded.campaign().lastMission).toBe(3);
  });

  it('does not remember the proving ground, which is not in the campaign', () => {
    const { app } = makeApp();
    app.startMission(1, 'normal');
    app.beginUnlisted({ ...mission(1), id: 99, key: 'ground' }, 'normal');
    expect(app.campaign().lastMission).toBe(1);
  });

  it('boots to a fresh game on a damaged or impossible save', () => {
    for (const text of ['{{{', 'null', '[]', '{"version":99}', '{"version":2,"cleared":{"5":["normal"]},"upgrades":{"hqHealth":3}}']) {
      const { app } = makeApp(createMemoryStorage({ 'tinhats.save': text }));
      const view = app.campaign();
      expect(view.missions.map((m) => m.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
      // The version 2 save claims a clear of mission 5 alone: progress stops at the gap, so no point was earned
      // and its upgrade is cut (the old rule, for saves from before medals).
      expect(view.pointsEarned).toBe(0);
      expect(view.medals).toBe(0);
      expect(view.upgrades.every((u) => u.level === 0)).toBe(true);
    }
  });
});

/** Mission 2 (survival, no enemy HQ) with the scripted events replaced by ones the test controls. */
function scripted(events: MissionEventDef[], hints = true) {
  const m: MissionDef = structuredClone(mission(2));
  m.events = events;
  m.start[0].forces = [];
  m.start[1].forces = [];
  const view = createFakeView();
  const storage = createMemoryStorage();
  const app = new App({ view, audio: createFakeAudio(), storage, missions: [m], upgradeDefs: UPGRADES, random: () => 0.25 });
  app.attachUi(createFakeUi());
  app.setSetting('hints', hints);
  app.startMission(m.id, 'normal');
  return { app, view };
}

describe('mission events in the battle', () => {
  const events: MissionEventDef[] = [
    { type: 'hint', when: { at: 1 }, text: 'Hold the trench.' },
    { type: 'airdrop', when: { at: 5 }, side: 0, supplies: 80 },
    { type: 'wave', when: { at: 9 }, side: 1, forces: [{ kind: 'rifle', count: 2 }] },
    { type: 'wave', when: { at: 14 }, side: 1, forces: [{ kind: 'rifle', count: 2 }], announce: 'Panzers on the road.' },
    { type: 'airdrop', when: { at: 20 }, side: 1, supplies: 50 },
  ];

  it('shows a hint, and not when hints are switched off', () => {
    const on = scripted(events, true);
    runTo(on.app, on.view, 2);
    expect(on.app.session?.hud.state.hint).toBe('Hold the trench.');
    const off = scripted(events, false);
    runTo(off.app, off.view, 2);
    expect(off.app.session?.hud.state.hint).toBeNull();
  });

  it('announces an airdrop with the supplies that came, the plain wave and the announced wave', () => {
    const { app, view } = scripted(events);
    const hud = () => app.session?.hud.state;
    runTo(app, view, 5.5);
    expect(hud()?.banner).toBe('Airdrop: +80 supplies');
    runTo(app, view, 9.5);
    expect(hud()?.banner).toBe(APP.notices.wave);
    runTo(app, view, 14.5);
    expect(hud()?.banner).toBe('Panzers on the road.');
    // The enemy's own airdrop is not news to the player.
    const seq = hud()?.bannerSeq ?? 0;
    runTo(app, view, 21);
    expect(hud()?.banner).toBeNull();
    expect(hud()?.bannerSeq).toBe(seq);
  });

  it('never covers an announcement with a plain notice', () => {
    const { app, view } = scripted([
      { type: 'announce', when: { at: 1 }, text: 'Stand to!' },
      { type: 'airdrop', when: { at: 2 }, side: 0, supplies: 40 },
    ]);
    runTo(app, view, 3);
    expect(app.session?.hud.state.banner).toBe('Stand to!');
  });
});

describe('what the HUD shows of a mission', () => {
  it('shows the clock of a survival mission and no enemy HQ, and a clock that turns urgent in the last 30 seconds', () => {
    const { app, view } = makeApp();
    app.startMission(2, 'normal');
    view.frame?.(100);
    const hud = app.session?.hud.state;
    expect(hud?.enemyHqHp).toBeNull();
    expect(hud?.timer?.label).toBe(mission(2).timer?.label);
    expect(hud?.timer?.secondsLeft).toBeGreaterThan((mission(2).timer?.seconds ?? 0) - 5);
    expect(hud?.timer?.urgent).toBe(false);
    const battle = app.session?.battle;
    if (battle?.state.timer) battle.state.timer.secondsLeft = APP.timerUrgentSeconds;
    app.session?.fill(false, false);
    expect(app.session?.hud.state.timer?.urgent).toBe(true);
  });

  it('shows the enemy HQ and no clock in an ordinary assault', () => {
    const { app, view } = makeApp();
    app.startMission(1, 'normal');
    view.frame?.(100);
    expect(app.session?.hud.state.enemyHqHp).toBeGreaterThan(0);
    expect(app.session?.hud.state.timer).toBeNull();
  });

  it('offers every bought type in every mission (no sapper button at Arnhem, which has no money)', () => {
    const { app } = makeApp();
    // Everything bought: no mission rules a bought type out (owner, 2026-11-08), mission 1 and Arnhem included.
    app.save.armoury = MEDALS.armoury.map((a) => a.id);
    app.startMission(1, 'normal');
    const first = app.session?.hud.state.train.map((b) => b.kind) ?? [];
    expect(first).toEqual(expect.arrayContaining(['sapper', 'rifle', 'lmg', 'tank', 'flame', 'apc']));
    app.startMission(9, 'normal');
    const kinds = app.session?.hud.state.train.map((b) => b.kind) ?? [];
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).not.toContain('sapper');
    expect(kinds).toContain('tank');
    for (const k of mission(9).units[0]) expect(kinds).toContain(k);
  });

  // Since medals, the buttons come from the Armoury (cut to what each mission allows), not from reaching a mission.
  it('offers the types the Armoury owns, and lends the ones a mission needs', () => {
    const { app } = makeApp();
    const trained = (id: number) => {
      app.startMission(id, 'normal');
      return app.session?.hud.state.train.map((b) => b.kind) ?? [];
    };
    const ownLmg = mission(2)
      .start[0].forces.filter((f) => f.kind === 'lmg')
      .reduce((n, f) => n + f.count, 0);
    const loan = MEDALS.missions[2].loans.find((l) => l.kind === 'lmg')?.count ?? 0;
    expect(loan).toBeGreaterThan(0);
    expect(trained(2)).toEqual(['sapper', 'rifle']);
    // Not bought: Bren gunners on loan stand at the HQ from the start, beside the ones the mission places itself.
    expect(app.session?.battle.state.sides[0].alive.lmg).toBe(ownLmg + loan);
    app.save.medals = 1000;
    app.buyArmoury('lmg');
    app.buyArmoury('tank');
    expect(trained(2)).toContain('lmg');
    expect(app.session?.battle.state.sides[0].alive.lmg).toBe(ownLmg);
    // Bought types field in every mission, the tutorial mission included.
    expect(trained(3)).toEqual(['sapper', 'rifle', 'lmg', 'tank']);
    expect(trained(1)).toEqual(['sapper', 'rifle', 'lmg', 'tank']);
  });

  it('lists the supports the mission gives the player', () => {
    const { app } = makeApp();
    app.startMission(4, 'normal');
    expect(app.session?.hud.state.supports.map((b) => b.kind)).toContain('artillery');
    app.startMission(10, 'normal');
    expect(app.session?.hud.state.supports.map((b) => b.kind)).toContain('airStrike');
  });
});

/** A copy of a mission with its clock set to `seconds`. */
function shortClock(id: number, seconds: number): MissionDef {
  const m: MissionDef = structuredClone(mission(id));
  if (!m.timer) throw new Error(`mission ${id} has no clock`);
  m.timer.seconds = seconds;
  m.events = [];
  m.start[0].forces = [];
  m.start[1].forces = [];
  return m;
}

function playOut(m: MissionDef) {
  const view = createFakeView();
  const ui = createFakeUi();
  const app = new App({ view, audio: createFakeAudio(), storage: createMemoryStorage(), missions: [m], upgradeDefs: UPGRADES, random: () => 0.25 });
  app.attachUi(ui);
  app.startMission(m.id, 'normal');
  app.loop.timeScale = APP.soundMaxTimeScale;
  for (let i = 0; i < 5000 && ui.current() !== 'result'; i++) view.frame?.(100);
  return { app, view, ui };
}

describe('the end of a timed mission', () => {
  it('darkens a deadline mission toward night as the clock runs down, and not a survival mission', () => {
    const deadline = playOut(shortClock(5, 20));
    const dark = deadline.view.darkness;
    expect(dark[0]).toBe(0);
    for (let i = 1; i < dark.length; i++) expect(dark[i]).toBeGreaterThan(dark[i - 1]);
    expect(dark[dark.length - 1]).toBeGreaterThan(0.9);

    const survival = playOut(shortClock(2, 20));
    expect(survival.view.darkness).toEqual([0]);
  });

  it('says why: time ran out on a deadline (a loss), and the line held in a survival (a win)', () => {
    const lost = playOut(shortClock(5, 20));
    const loss = lost.ui.results[0];
    expect(loss.won).toBe(false);
    expect(lost.app.session?.battle.state.endReason).toBe('timerExpired');
    expect(loss.reason).toBe(`${mission(5).timer?.label} came before the enemy HQ was destroyed`);
    expect(lost.app.campaign().missions[0].cleared.normal).toBe(false);

    const won = playOut(shortClock(2, 20));
    const win = won.ui.results[0];
    expect(win.won).toBe(true);
    expect(won.app.session?.battle.state.endReason).toBe('timerSurvived');
    expect(win.reason).toBe(APP.reasons.timerSurvived.win);
    // A survival win scores on casualties and HQ health: no time part.
    expect(win.pointsAwarded).toBeGreaterThan(0);
    expect(win.medals?.time).toBeNull();
    expect(win.medals?.hq).not.toBeNull();
    expect(won.app.save.medals).toBe(win.pointsAwarded);
    expect(won.app.campaign().missions[0].cleared.normal).toBe(true);
  });

  it('has words for every way a battle can end', () => {
    for (const reason of ['hqDestroyed', 'timerSurvived', 'timerExpired', 'draw', 'none'] as const) {
      for (const won of [true, false]) {
        const text = describeEnd(reason, won, 'Nightfall');
        expect(text.length, `${reason} ${won ? 'won' : 'lost'}`).toBeGreaterThan(8);
        expect(text).not.toContain('{');
      }
    }
    expect(describeEnd('hqDestroyed', true, null)).toBe(APP.reasons.hqDestroyed.win);
    expect(describeEnd('hqDestroyed', false, null)).toBe(APP.reasons.hqDestroyed.lose);
    expect(describeEnd('timerExpired', false, 'Nightfall')).toBe('Nightfall came before the enemy HQ was destroyed');
    expect(describeEnd('timerExpired', false, null)).toBe('Time came before the enemy HQ was destroyed');
    expect(describeEnd('none', false, null)).toBe(APP.reasons.draw.lose);
  });
});
