/**
 * The campaign as the player meets it: the ten real missions (Stalingrad, the game's campaign since the British
 * placeholders were removed) and the real Quartermaster table, run through the app controller with a fake view, audio
 * and UI. Covers the flow (unlocking, upgrades, remembered choices) and the in-battle wiring of the mission features
 * (timers, banners, notices, hints, darkness, result reasons).
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { describeEnd } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { CAMPAIGN_MAP_VIEW, projection } from '../../src/data/campaignMap';
import { STALINGRAD_MAP } from '../../src/data/campaignMapStalingrad';
import { MEDALS } from '../../src/data/medals';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef, MissionEventDef } from '../../src/data/schema';
import { UPGRADE_LEVEL_POINTS, UPGRADES } from '../../src/data/upgrades';
import { createMemoryStorage, loadSave, recordClear } from '../../src/meta';
import { layoutPins } from '../../src/ui/screens/mapLayout';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';
import { FIELD } from './fixtures';

/** Upgrade points for Quartermaster levels 1, 2 and 3. */
const [L1, L2, L3] = UPGRADE_LEVEL_POINTS;

/** The first mission (Brest, a survival with a prep phase) and the first assault with an enemy HQ and no prep (Dubno). */
const FIRST = MISSIONS[0].id;
const ASSAULT = 1002;

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
    expect(cards.map((c) => c.id)).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
    expect(cards.map((c) => c.unlocked)).toEqual([true, false, false, false, false, false, false, false, false, false]);
    expect(cards.every((c) => c.briefing.length > 0 && c.objective.length > 0 && c.title.length > 0)).toBe(true);
  });

  it('places every mission on the map, apart from each other once laid out, in the order of the route', () => {
    const { app } = makeApp();
    const proj = projection(STALINGRAD_MAP.bounds);
    const cards = app.campaign().missions;
    for (const c of cards) {
      expect(proj.x(c.mapPos.lon)).toBeGreaterThanOrEqual(0);
      expect(proj.x(c.mapPos.lon)).toBeLessThanOrEqual(1);
      expect(proj.y(c.mapPos.lat)).toBeGreaterThanOrEqual(0);
      expect(proj.y(c.mapPos.lat)).toBeLessThanOrEqual(1);
    }
    // The four city markers sit a few streets apart: the layout pushes them a full touch apart, with leaders back.
    const lay = layoutPins(cards.map((c) => c.mapPos.lon), cards.map((c) => c.mapPos.lat), 600, 390, proj);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        expect(Math.hypot(lay.xs[i] - lay.xs[j], lay.ys[i] - lay.ys[j]), `missions ${cards[i].id} and ${cards[j].id}`).toBeGreaterThan(
          CAMPAIGN_MAP_VIEW.pinSeparationPx - 1,
        );
      }
    }
  });

  it('introduces the new units and supports the campaign promises', () => {
    const { app } = makeApp();
    const cards = app.campaign().missions;
    expect(cards.map((c) => c.newUnit?.kind ?? null)).toEqual(['lmg', 'tank', 'assault', 'medic', 'flame', 'sniper', 'commander', null, 'apc', null]);
    expect(cards.map((c) => (c.moreNewUnits ?? []).map((u) => u.kind))).toEqual([['at'], ['mortar'], [], ['conscript'], [], ['aa'], [], [], [], []]);
    expect(cards.map((c) => c.newSupport?.kind ?? null)).toEqual([null, null, 'katyusha', 'airStrike', null, null, null, null, 'recon', 'bomber']);
    for (const c of cards) {
      if (c.newUnit) {
        expect(c.newUnit.name.length).toBeGreaterThan(0);
        expect(c.newUnit.blurb.length).toBeGreaterThan(0);
      }
      if (c.newSupport) expect(c.newSupport.blurb.length).toBeGreaterThan(0);
    }
    // The Red Army's names for them.
    expect(cards[0].newUnit?.name).toBe('DP Gunner');
    expect(cards[1].newUnit?.name).toBe('T-34');
  });

  it('puts the missions on the backdrops the mission data asks for', () => {
    const { app } = makeApp();
    expect(app.campaign().missions.map((c) => c.theatre)).toEqual(MISSIONS.map((m) => m.theatre));
    for (const c of app.campaign().missions) expect(c.theatre.length, `mission ${c.id}`).toBeGreaterThan(0);
  });

  it('opens each mission only when the one before it is cleared, on any difficulty', () => {
    const { app } = makeApp();
    recordClear(app.save, 1001, 'insane');
    expect(app.campaign().missions.map((c) => c.unlocked).slice(0, 3)).toEqual([true, true, false]);
    // Clearing mission 3 without mission 2 does not open mission 4 (the save checker would drop that anyway).
    recordClear(app.save, 1003, 'normal');
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

  // A clear pays nothing by itself: wins pay medals and upgrade points (meta-medals.test.ts); the Quartermaster spends points.
  it('pays nothing for a clear alone: the Quartermaster spends upgrade points, not medals', () => {
    const { app } = makeApp();
    recordClear(app.save, FIRST, 'normal');
    expect(app.campaign().pointsAvailable).toBe(0);
    app.save.points = 35;
    expect(app.campaign().pointsAvailable).toBe(35);
    expect(app.campaign().medals).toBe(0);
  });

  it('buys one level at a time, refunds one level at a time or all at once, and never overspends', () => {
    const { app, storage } = makeApp();
    app.buyUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({});
    // Levels 1, 2 and 3 of hqHealth and level 1 of hqIncome.
    app.save.points = L1 + L2 + L3 + L1;
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqIncome');
    expect(app.save.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(L3);
    expect(app.campaign().upgrades.find((u) => u.id === 'hqHealth')?.cost, 'the card shows the next level price').toBe(L3);
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({ hqHealth: 3, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(0);
    app.refundUpgrade('hqHealth');
    expect(app.save.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    expect(app.campaign().pointsAvailable).toBe(L3);
    expect(loadSave(storage, { upgradeDefs: UPGRADES }).data.upgrades).toEqual({ hqHealth: 2, hqIncome: 1 });
    app.refundAll();
    expect(app.save.upgrades).toEqual({});
    expect(app.campaign().pointsAvailable).toBe(L1 + L2 + L3 + L1);
  });

  it('builds the battle with the upgrade levels of the save', () => {
    const { app } = makeApp();
    app.save.points = L1 + L2;
    app.buyUpgrade('hqHealth');
    app.buyUpgrade('hqHealth');
    app.startMission(ASSAULT, 'normal');
    const upgraded = app.session;
    expect(upgraded?.battle.config.upgrades).toEqual({ hqHealth: 2 });
    const hq = upgraded?.battle.state.sides[0].hq;

    app.refundAll();
    app.startMission(ASSAULT, 'normal');
    const plain = app.session?.battle.state.sides[0].hq;
    expect(app.session?.battle.config.upgrades).toEqual({});
    // Sandbagged HQ level 2 is +24% health.
    expect(hq && plain ? hq.maxHp / plain.maxHp : 0).toBeCloseTo(1.24, 5);
  });

  it('keeps upgrades off the enemy and out of the next battle once refunded', () => {
    const { app } = makeApp();
    app.startMission(ASSAULT, 'normal');
    const before = app.session?.battle.state.sides.map((s) => s.hq?.maxHp ?? 0) ?? [];
    app.save.points = L1;
    app.buyUpgrade('hqHealth');
    app.startMission(ASSAULT, 'normal');
    const upgraded = app.session?.battle.state.sides.map((s) => s.hq?.maxHp ?? 0) ?? [];
    expect(upgraded[0] / before[0]).toBeGreaterThan(1.1);
    expect(upgraded[1]).toBe(before[1]);
    expect(before[1]).toBeGreaterThan(0);
    app.refundAll();
    app.startMission(ASSAULT, 'normal');
    expect(app.session?.battle.state.sides[0].hq?.maxHp).toBe(before[0]);
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
    app.startMission(FIRST, 'insane');
    expect(app.campaign().settings.difficulty).toBe('insane');
    const reloaded = new App({ view: createFakeView(), audio: createFakeAudio(), storage });
    expect(reloaded.campaign().settings.difficulty).toBe('insane');
  });

  it('remembers the mission last started and offers it to the map', () => {
    const { app, storage } = makeApp();
    expect(app.campaign().lastMission).toBe(0);
    app.unlockAll();
    app.startMission(1003, 'normal');
    expect(app.campaign().lastMission).toBe(1003);
    const reloaded = new App({ view: createFakeView(), audio: createFakeAudio(), storage });
    expect(reloaded.campaign().lastMission).toBe(1003);
  });

  it('does not remember the proving ground, which is not in the campaign', () => {
    const { app } = makeApp();
    app.startMission(FIRST, 'normal');
    app.beginUnlisted({ ...mission(FIRST), id: 99, key: 'ground' }, 'normal');
    expect(app.campaign().lastMission).toBe(FIRST);
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

/** The first mission (Brest: survival, no enemy HQ) with the scripted events replaced by ones the test controls, and no prep phase. */
function scripted(events: MissionEventDef[], hints = true) {
  const m: MissionDef = structuredClone(mission(FIRST));
  delete m.prep;
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
    expect(hud()?.banner).toBe('Airdrop: +80 money');
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
    app.startMission(FIRST, 'normal');
    view.frame?.(100);
    const hud = app.session?.hud.state;
    expect(hud?.enemyHqHp).toBeNull();
    expect(hud?.timer?.label).toBe(mission(FIRST).timer?.label);
    expect(hud?.timer?.secondsLeft).toBeGreaterThan((mission(FIRST).timer?.seconds ?? 0) - 5);
    expect(hud?.timer?.urgent).toBe(false);
    const battle = app.session?.battle;
    if (battle?.state.timer) battle.state.timer.secondsLeft = APP.timerUrgentSeconds;
    app.session?.fill(false, false);
    expect(app.session?.hud.state.timer?.urgent).toBe(true);
  });

  it('shows the enemy HQ and no clock in an ordinary assault', () => {
    const { app, view } = makeApp();
    app.startMission(ASSAULT, 'normal');
    view.frame?.(100);
    expect(app.session?.hud.state.enemyHqHp).toBeGreaterThan(0);
    expect(app.session?.hud.state.timer).toBeNull();
  });

  it('offers every unlocked type in every mission (and no sapper button in a mission with no money)', () => {
    // A mission that lives on airdrops, as the old Arnhem did: no sappers in its list and no income.
    const noMoney: MissionDef = structuredClone(mission(ASSAULT));
    noMoney.id = 1099;
    noMoney.key = 'noMoney';
    noMoney.units[0] = noMoney.units[0].filter((k) => k !== 'sapper');
    noMoney.start[0] = { ...noMoney.start[0], sappers: 0, incomeMul: 0 };
    const app = new App({ view: createFakeView(), audio: createFakeAudio(), storage: createMemoryStorage(), missions: [...MISSIONS, noMoney], random: () => 0.25 });
    app.attachUi(createFakeUi());
    // The whole campaign cleared, so everything unlocked: no mission rules an unlocked type out (owner, 2026-11-08),
    // the first mission and the one without money included.
    for (const m of [...MISSIONS, noMoney]) recordClear(app.save, m.id, 'normal');
    app.startMission(FIRST, 'normal');
    const first = app.session?.hud.state.train.map((b) => b.kind) ?? [];
    expect(first).toEqual(expect.arrayContaining(['sapper', 'rifle', 'lmg', 'tank', 'flame', 'apc']));
    for (const m of MISSIONS) {
      app.startMission(m.id, 'normal');
      const own = app.session?.hud.state.train.map((b) => b.kind) ?? [];
      for (const k of m.units[0]) expect(own, `mission ${m.id}`).toContain(k);
    }
    app.startMission(noMoney.id, 'normal');
    const kinds = app.session?.hud.state.train.map((b) => b.kind) ?? [];
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).not.toContain('sapper');
    expect(kinds).toContain('tank');
    for (const k of noMoney.units[0]) expect(kinds).toContain(k);
  });

  // Units are unlocked by missions again (owner, 2026-11-09): a mission fields its own types, and every type of every
  // mission reached so far; nothing is lent and nothing is bought.
  it('offers the types the missions reached unlock, with nothing on loan', () => {
    const { app } = makeApp();
    const trained = (id: number) => {
      app.startMission(id, 'normal');
      return app.session?.hud.state.train.map((b) => b.kind) ?? [];
    };
    const ownLmg = mission(ASSAULT)
      .start[0].forces.filter((f) => f.kind === 'lmg')
      .reduce((n, f) => n + f.count, 0);
    expect(trained(FIRST)).toEqual(['sapper', 'rifle', 'lmg', 'at']);
    expect(trained(ASSAULT)).toEqual(['sapper', 'rifle', 'lmg', 'mortar', 'at', 'tank']);
    expect(app.session?.battle.state.sides[0].alive.lmg).toBe(ownLmg);
    // Units cannot be bought.
    app.save.medals = 1000;
    app.buyArmoury('tank');
    expect(app.save.medals).toBe(1000);
    expect(trained(FIRST)).toEqual(['sapper', 'rifle', 'lmg', 'at']);
    // Missions 1 to 3 cleared: mission 4 is reached, so its types field everywhere, the first mission included.
    for (const id of [1001, 1002, 1003]) recordClear(app.save, id, 'normal');
    expect(trained(FIRST)).toEqual(['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank']);
  });

  it('lists the supports the mission gives the player', () => {
    const { app } = makeApp();
    app.startMission(ASSAULT, 'normal');
    expect(app.session?.hud.state.supports.map((b) => b.kind)).toContain('artillery');
    app.startMission(1003, 'normal');
    // The Katyusha comes up behind the halt in phase 2, the Il-2s fly from phase 3 at Klin (support events,
    // FOUNDATIONS.md 3.3): their buttons come with them.
    expect(app.session?.hud.state.supports.map((b) => b.kind)).not.toContain('katyusha');
    app.session?.battle.admin({ type: 'jumpPhase', phase: 'again' });
    app.session?.battle.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.supports.map((b) => b.kind)).toContain('katyusha');
    app.startMission(1004, 'normal');
    app.session?.battle.admin({ type: 'jumpPhase', phase: 'highway' });
    app.session?.battle.step();
    app.session?.fill(false, false);
    expect(app.session?.hud.state.supports.map((b) => b.kind)).toContain('airStrike');
  });

  it('spends one charge per call, lent ones first, shows the count on the button and stops at none', () => {
    const { app, storage } = makeApp();
    const before = app.save.charges.artillery ?? 0;
    expect(before).toBeGreaterThan(0);
    app.startMission(ASSAULT, 'normal');
    const session = app.session;
    if (!session) throw new Error('no battle');
    const side = session.battle.state.sides[0];
    expect(side.supportCharges.artillery).toBe(before);
    // No in-battle money cost.
    const supplies = side.supplies;
    session.battle.command(0, { type: 'support', kind: 'artillery', x: 3000 });
    session.step();
    expect(side.supportCharges.artillery).toBe(before - 1);
    expect(side.supplies).toBeGreaterThanOrEqual(supplies);
    expect(app.save.charges.artillery).toBe(before - 1);
    expect(loadSave(storage).data.charges.artillery).toBe(before - 1);
    session.fill(false, false);
    expect(session.hud.state.supports.find((b) => b.kind === 'artillery')?.charges).toBe(before - 1);
    // None left: the sim refuses the call.
    side.supportCharges.artillery = 0;
    side.supportCooldown.artillery = 0;
    session.battle.command(0, { type: 'support', kind: 'artillery', x: 3000 });
    session.step();
    expect(side.supportCooldown.artillery).toBe(0);
    // 1003 lends Katyushas: they are spent before the save's own, which stay.
    app.save.charges.katyusha = 1;
    app.startMission(1003, 'normal');
    const lent = app.session;
    if (!lent) throw new Error('no battle');
    const s3 = lent.battle.state.sides[0];
    expect(s3.supportCharges.katyusha).toBe(1 + (MEDALS.chargeLoans[1003]?.[0]?.count ?? 0));
    lent.battle.admin({ type: 'jumpPhase', phase: 'again' });
    lent.step();
    s3.supportCooldown.katyusha = 0;
    lent.battle.command(0, { type: 'support', kind: 'katyusha', x: 3000 });
    lent.step();
    expect(s3.supportCharges.katyusha).toBe(MEDALS.chargeLoans[1003]?.[0]?.count);
    expect(app.save.charges.katyusha).toBe(1);
  });
});

/** A copy of a mission with its clock set to `seconds` (and no prep phase before it). */
function shortClock(id: number, seconds: number): MissionDef {
  const m: MissionDef = structuredClone(mission(id));
  if (!m.timer) throw new Error(`mission ${id} has no clock`);
  m.timer.seconds = seconds;
  delete m.prep;
  m.events = [];
  m.start[0].forces = [];
  m.start[1].forces = [];
  return m;
}

/**
 * A deadline mission: the test field (./fixtures.ts) with a clock that loses when it runs out. No Stalingrad mission
 * has a deadline, but the engine and the HUD still play one (the old Primosole had one).
 */
function shortDeadline(seconds: number): MissionDef {
  const m: MissionDef = structuredClone(FIELD);
  m.timer = { seconds, onExpire: 'lose', label: 'Nightfall' };
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
    const deadline = playOut(shortDeadline(20));
    const dark = deadline.view.darkness;
    expect(dark[0]).toBe(0);
    for (let i = 1; i < dark.length; i++) expect(dark[i]).toBeGreaterThan(dark[i - 1]);
    expect(dark[dark.length - 1]).toBeGreaterThan(0.9);

    const survival = playOut(shortClock(FIRST, 20));
    expect(survival.view.darkness).toEqual([0]);
  });

  it('says why: time ran out on a deadline (a loss), and the line held in a survival (a win)', () => {
    const lost = playOut(shortDeadline(20));
    const loss = lost.ui.results[0];
    expect(loss.won).toBe(false);
    expect(lost.app.session?.battle.state.endReason).toBe('timerExpired');
    expect(loss.reason).toBe('Nightfall came before the enemy HQ was destroyed');
    expect(lost.app.campaign().missions[0].cleared.normal).toBe(false);

    const won = playOut(shortClock(FIRST, 20));
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
