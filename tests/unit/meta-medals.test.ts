/**
 * Medals and the Armoury (src/meta/medals.ts): the score of a win, the replay decay per mission and difficulty,
 * Armoury purchases (plane call-ins), unit types unlocked by missions, what the player fields in a mission, the NEW
 * cards and hints, and the steps from save version 5 (upgrade points) to medals, from version 7 (units bought) to 8
 * and from version 9 to 10 (the British placeholder missions removed: what they earned stays). The missions are the
 * Stalingrad campaign's.
 */
import { describe, expect, it } from 'vitest';
import { MEDALS } from '../../src/data/medals';
import { META } from '../../src/data/meta';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef, SupportKind, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { UPGRADES } from '../../src/data/upgrades';
import {
  addMedals,
  applyRoster,
  buyItem,
  canBuyItem,
  createMemoryStorage,
  defaultSave,
  loadSave,
  missionMedals,
  missionRoster,
  isUnlocked,
  newsFor,
  playerUnitKinds,
  unitsUnlocked,
  unlockingMission,
  withNews,
  ownsItem,
  recordClear,
  recordWin,
  replayPercent,
  sanitizeSave,
  scoreWin,
  winsOn,
} from '../../src/meta';

const mission = (id: number): MissionDef => {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`no mission ${id}`);
  return m;
};
const rules = { missionIds: MISSIONS.map((m) => m.id), upgradeDefs: UPGRADES };

/** A copy of an assault with no sappers and no income (as the old Arnhem lived on airdrops). */
function noMoney(): MissionDef {
  const m: MissionDef = structuredClone(mission(1002));
  m.units[0] = m.units[0].filter((k) => k !== 'sapper');
  m.start[0] = { ...m.start[0], sappers: 0, incomeMul: 0 };
  return m;
}

describe('the score of a win', () => {
  // Dubno (assault) and Brest (survival).
  const def = missionMedals(1002);

  it('pays 3 for a rough clear and 30 for a perfect one (owner, 2026-11-08)', () => {
    const perfect = scoreWin('assault', def, { seconds: def.targetSeconds, lost: def.targetLost, hqFrac: 1 }, 'normal', 0);
    const rough = scoreWin('assault', def, { seconds: def.roughSeconds * 2, lost: def.roughLost * 2, hqFrac: 0.1 }, 'normal', 0);
    expect(perfect.score).toBe(1);
    expect(perfect.medals).toBe(MEDALS.perfect);
    expect(rough.score).toBe(0);
    expect(rough.medals).toBe(MEDALS.rough);
    expect(MEDALS.rough).toBe(3);
    expect(MEDALS.perfect).toBe(30);
  });

  it('scores an assault on time and casualties, each against the mission target, and never on HQ health', () => {
    const mid = (a: number, b: number) => (a + b) / 2;
    const half = scoreWin('assault', def, { seconds: mid(def.targetSeconds, def.roughSeconds), lost: def.targetLost, hqFrac: 0 }, 'normal', 0);
    expect(half.time?.score).toBeCloseTo(0.5, 5);
    expect(half.casualties.score).toBe(1);
    expect(half.hq).toBeNull();
    expect(half.score).toBeCloseTo(MEDALS.weights.assault.time * 0.5 + MEDALS.weights.assault.casualties, 5);
    const slower = scoreWin('assault', def, { seconds: def.roughSeconds, lost: def.targetLost, hqFrac: 1 }, 'normal', 0);
    expect(slower.medals).toBeLessThan(half.medals);
    const bloodier = scoreWin('assault', def, { seconds: def.targetSeconds, lost: def.roughLost, hqFrac: 1 }, 'normal', 0);
    expect(bloodier.casualties.score).toBe(0);
  });

  it('scores a survival mission on casualties and HQ health, not time (its length is fixed)', () => {
    const s = missionMedals(1001);
    const intact = scoreWin('survival', s, { seconds: 240, lost: s.targetLost, hqFrac: 1 }, 'normal', 0);
    expect(intact.time).toBeNull();
    expect(intact.medals).toBe(MEDALS.perfect);
    const battered = scoreWin('survival', s, { seconds: 240, lost: s.targetLost, hqFrac: MEDALS.hqRough }, 'normal', 0);
    expect(battered.hq?.score).toBe(0);
    expect(battered.medals).toBeLessThan(intact.medals);
    // The clock does not matter.
    expect(scoreWin('survival', s, { seconds: 10_000, lost: s.targetLost, hqFrac: 1 }, 'normal', 0).medals).toBe(intact.medals);
  });

  it('pays more on harder difficulties, by the multipliers in data', () => {
    const stats = { seconds: def.targetSeconds, lost: def.targetLost, hqFrac: 1 };
    const normal = scoreWin('assault', def, stats, 'normal', 0).medals;
    expect(scoreWin('assault', def, stats, 'hard', 0).medals).toBe(Math.floor(normal * MEDALS.difficultyMul.hard));
    expect(scoreWin('assault', def, stats, 'insane', 0).medals).toBe(Math.floor(normal * MEDALS.difficultyMul.insane));
    expect(MEDALS.difficultyMul.normal).toBeLessThan(MEDALS.difficultyMul.hard);
    expect(MEDALS.difficultyMul.hard).toBeLessThan(MEDALS.difficultyMul.insane);
  });

  it('has targets for every campaign mission, a rough mark beyond the target', () => {
    for (const m of MISSIONS) {
      const d = MEDALS.missions[m.id];
      expect(d, `mission ${m.id}`).toBeDefined();
      expect(d.roughLost).toBeGreaterThan(d.targetLost);
      if (m.mode === 'assault') expect(d.roughSeconds).toBeGreaterThan(d.targetSeconds);
    }
  });

  it('keeps no medal targets for the removed British missions 1 to 10', () => {
    for (let id = 1; id <= 10; id++) expect(MEDALS.missions[id], `mission ${id}`).toBeUndefined();
    expect(
      Object.keys(MEDALS.missions)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(MISSIONS.map((m) => m.id));
  });
});

describe('replays pay 50% less each time, per mission and difficulty', () => {
  it('halves the medals on each win of the same mission on the same difficulty, rounded down', () => {
    const save = defaultSave();
    const m = mission(1003);
    const def = missionMedals(1003);
    const stats = { seconds: def.targetSeconds + 17, lost: def.targetLost + 3, hqFrac: 1 };
    const base = scoreWin('assault', def, stats, 'normal', 0).base;
    const paid = [0, 1, 2, 3].map(() => recordWin(save, m, 'normal', stats).medals);
    expect(paid).toEqual([base, Math.floor(base / 2), Math.floor(base / 4), Math.floor(base / 8)]);
    expect(save.medals).toBe(paid.reduce((a, b) => a + b, 0));
    expect(winsOn(save, 1003, 'normal')).toBe(4);
  });

  it('pays in full for the first win on a harder difficulty, and keeps each mission on its own count', () => {
    const save = defaultSave();
    const stats = { seconds: 100, lost: 0, hqFrac: 1 };
    recordWin(save, mission(1003), 'normal', stats);
    recordWin(save, mission(1003), 'normal', stats);
    expect(recordWin(save, mission(1003), 'hard', stats).replayFactor).toBe(1);
    expect(recordWin(save, mission(1004), 'normal', stats).replayFactor).toBe(1);
    expect(recordWin(save, mission(1003), 'hard', stats).replayFactor).toBe(0.5);
    expect(save.wins).toEqual({ '1003': { normal: 2, hard: 2 }, '1004': { normal: 1 } });
  });

  it('gives the percentage the briefing shows', () => {
    expect([0, 1, 2, 3, 4].map(replayPercent)).toEqual([100, 50, 25, 12, 6]);
  });
});

describe('the Armoury', () => {
  it('has riflemen and sappers free and sells only the plane call-ins (owner, 2026-11-09)', () => {
    expect(MEDALS.free.sort()).toEqual(['rifle', 'sapper']);
    const sold = MEDALS.armoury.map((a) => a.id as string).sort();
    expect(sold).toEqual(['bomber', 'fighter', 'recon']);
    for (const a of MEDALS.armoury) expect(a.price).toBeGreaterThan(0);
    for (const u of MEDALS.units) expect(sold).not.toContain(u.kind);
  });

  it('lists every player unit type once and no enemy-only one', () => {
    const kinds = MEDALS.units.map((u) => u.kind as string);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'commander', 'aa']) expect(kinds).toContain(k);
    expect(kinds).not.toContain('heavyTank');
    expect(kinds).not.toContain('lightTank');
    for (const u of MEDALS.units) expect(UNITS[u.kind].enemyOnly, u.kind).not.toBe(true);
  });

  it('buys plane call-ins with medals, once, and never a unit type', () => {
    const save = defaultSave();
    const recon = MEDALS.armoury.find((a) => a.id === 'recon');
    if (!recon) throw new Error('no recon');
    expect(ownsItem(save, 'rifle')).toBe(true);
    expect(canBuyItem(save, 'recon')).toBe(false);
    save.medals = recon.price;
    expect(buyItem(save, 'recon')).toBe(true);
    expect(save.medals).toBe(0);
    expect(ownsItem(save, 'recon')).toBe(true);
    save.medals = 9999;
    expect(buyItem(save, 'recon')).toBe(false);
    expect(buyItem(save, 'lmg')).toBe(false);
    expect(buyItem(save, 'rifle')).toBe(false);
    expect(buyItem(save, 'nonsense')).toBe(false);
    expect(save.medals).toBe(9999);
    expect(save.armoury).toEqual(['recon']);
  });

  it('gives and takes medals, never below zero', () => {
    const save = defaultSave();
    expect(addMedals(save, 25)).toBe(25);
    expect(addMedals(save, -10)).toBe(15);
    expect(addMedals(save, -100)).toBe(0);
    expect(addMedals(save, Number.NaN)).toBe(0);
  });
});

describe('unit types unlocked by missions (owner, 2026-11-09)', () => {
  const ids = MISSIONS.map((m) => m.id);
  const reachedOf = (save: ReturnType<typeof defaultSave>) => (id: number) => isUnlocked(save, ids, id);
  const ALL: UnitKind[] = ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'commander', 'aa', 'conscript'];

  it('starts every player with sappers and riflemen, and the types of the first mission (always reached)', () => {
    const save = defaultSave();
    expect(unitsUnlocked(save, MISSIONS, reachedOf(save))).toEqual(['sapper', 'rifle', 'lmg', 'at']);
    expect(unitsUnlocked(save, MISSIONS, () => false)).toEqual(['sapper', 'rifle']);
  });

  it('unlocks each mission type when the mission is reached, for good', () => {
    const save = defaultSave();
    recordClear(save, 1001, 'normal');
    expect(unitsUnlocked(save, MISSIONS, reachedOf(save))).toEqual(['sapper', 'rifle', 'lmg', 'mortar', 'at', 'tank']);
    for (const m of MISSIONS) recordClear(save, m.id, 'normal');
    expect(unitsUnlocked(save, MISSIONS, reachedOf(save)).sort()).toEqual([...ALL].sort());
    // The Red Army's signature kind comes after the Armoury's list.
    expect(unitsUnlocked(save, MISSIONS, reachedOf(save)).at(-1)).toBe('conscript');
  });

  it('unlocks the newer units in the missions the data names', () => {
    const at = (kind: UnitKind) => unlockingMission(kind, MISSIONS)?.id;
    expect([at('lmg'), at('assault'), at('mortar'), at('sniper'), at('medic'), at('at'), at('tank')]).toEqual([1001, 1003, 1002, 1006, 1004, 1001, 1002]);
    expect([at('commander'), at('flame'), at('apc'), at('aa'), at('conscript')]).toEqual([1007, 1005, 1009, 1006, 1004]);
  });

  it('keeps types bought in the Armoury before the change, and those the British missions unlocked, unlocked', () => {
    const save = defaultSave();
    save.armoury = ['tank', 'commander'];
    expect(unitsUnlocked(save, MISSIONS, reachedOf(save))).toEqual(['sapper', 'rifle', 'lmg', 'at', 'tank', 'commander']);
  });

  it('shows NEW cards only for what the mission really unlocks for this player', () => {
    const save = defaultSave();
    const news = (id: number) => newsFor(save, MISSIONS, reachedOf(save), mission(id));
    expect(news(1001).units).toEqual(['lmg', 'at']);
    for (const m of MISSIONS.slice(0, 5)) recordClear(save, m.id, 'normal');
    expect(news(1006)).toEqual({ units: ['sniper', 'aa'], support: null });
    // A replay of a mission whose types and call-ins later missions also bring brings nothing new.
    expect(news(1002).units).toEqual([]);
    expect(news(1003)).toEqual({ units: [], support: null });
    // A type kept unlocked in the save (bought before the change, or from the British missions) is not new either.
    save.armoury = ['sniper'];
    expect(news(1006).units).toEqual(['aa']);
  });

  it('shows the NEW support card of a mission the first time, and not once a later mission has brought it', () => {
    const save = defaultSave();
    const news = (id: number) => newsFor(save, MISSIONS, reachedOf(save), mission(id));
    for (const m of MISSIONS.slice(0, 2)) recordClear(save, m.id, 'normal');
    expect(news(1003)).toEqual({ units: ['assault'], support: 'katyusha' });
    recordClear(save, 1003, 'normal');
    expect(news(1004).support).toBe('airStrike');
    expect(news(1003).support).toBeNull();
  });

  it('drops the "New:" hints about things the player already had', () => {
    const m = mission(1003);
    const hints = (x: MissionDef) => x.events.filter((e) => e.type === 'hint' && e.about !== undefined).length;
    expect(hints(withNews(m, { units: ['assault'], support: 'katyusha' }))).toBe(2);
    expect(hints(withNews(m, { units: ['assault'], support: null }))).toBe(1);
    expect(hints(withNews(m, { units: [], support: null }))).toBe(0);
    expect(withNews(m, { units: [], support: null }).newUnit).toBeNull();
  });
});

describe('what the player fields in a mission', () => {
  it('fields the mission own types and the free types it lists, with no loans needed', () => {
    const save = defaultSave();
    const m = mission(1006);
    const r = missionRoster(save, m);
    expect(r.units).toEqual(m.units[0]);
    expect(r.units).toEqual(expect.arrayContaining(['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'flame', 'aa', 'conscript']));
    expect(r.loans).toEqual([]);
    // No sappers where the mission has none.
    expect(missionRoster(save, noMoney()).units).not.toContain('sapper');
  });

  it('fields every unlocked type in every mission, replays included', () => {
    const save = defaultSave();
    const all = playerUnitKinds();
    save.armoury = MEDALS.armoury.map((a) => a.id);
    const planes = MEDALS.armoury.map((a) => a.id as SupportKind);
    for (const m of [...MISSIONS, noMoney()]) {
      const r = missionRoster(save, m, all);
      for (const k of all) if (k !== 'sapper' || m.units[0].includes('sapper')) expect(r.units, `mission ${m.id}: ${k}`).toContain(k);
      for (const k of planes) expect(r.supports, `mission ${m.id}: ${k}`).toContain(k);
      expect(applyRoster(m, r).units[0]).toEqual(r.units);
    }
    // The first mission fields everything unlocked too; a mission with no money still has no sappers.
    expect(missionRoster(save, mission(1001), all).units).toContain('tank');
    expect(missionRoster(save, noMoney(), all).units).not.toContain('sapper');
  });

  it('lends a mission own loans only when the type is not unlocked', () => {
    // No Stalingrad mission lends anything (each unlocks its own types), so a test mission carries the loans.
    const id = 9990;
    MEDALS.missions[id] = { ...MEDALS.fallback, loans: [{ kind: 'at', count: 3 }, { kind: 'tank', count: 2 }] };
    try {
      const m: MissionDef = { ...mission(1009), id };
      const bare: MissionDef = { ...m, newUnit: null, unlocks: [], units: [['sapper', 'rifle'], m.units[1]] };
      const r = missionRoster(defaultSave(), bare);
      expect(r.loans.map((l) => l.kind)).toEqual(['at', 'tank']);
      expect(missionRoster(defaultSave(), m).loans).toEqual([]);
    } finally {
      delete MEDALS.missions[id];
    }
  });

  it('only ever fields types the sim can train', () => {
    const r = missionRoster(defaultSave(), mission(1009), playerUnitKinds());
    for (const k of r.units) expect(UNITS[k].trainable, k).toBe(true);
  });

  it('adds owned plane call-ins to the mission own ones', () => {
    const save = defaultSave();
    expect(missionRoster(save, mission(1006)).supports).toEqual(['artillery', 'smoke', 'katyusha']);
    save.armoury = ['recon', 'bomber'];
    expect(missionRoster(save, mission(1006)).supports).toEqual(['artillery', 'smoke', 'katyusha', 'recon', 'bomber']);
  });

  it('applies the roster to a copy of the mission and leaves the data alone', () => {
    const m = mission(1009);
    const roster = missionRoster(defaultSave(), m);
    const played = applyRoster(m, roster);
    expect(played.units[0]).toEqual(roster.units);
    expect(played.units[1]).toEqual(m.units[1]);
    expect(played.supports[0]).toEqual(m.supports[0]);
    expect(m.start[0].forces).toEqual(mission(1009).start[0].forces);
    expect(mission(1009).units[0]).toContain('tank');
  });
});

describe('saves from before medals (version 5 and older)', () => {
  const v5 = {
    version: 5,
    cleared: { '1': ['normal', 'hard'], '2': ['normal'], '3': ['insane'], '4': ['normal'] },
    upgrades: { hqIncome: 2, rifleHealth: 1 },
    lastMission: 4,
    settings: { muted: false, difficulty: 'normal', hints: true, musicVolume: 50, ambienceVolume: 50, sfxVolume: 50, reduceFlash: false, showBlood: true },
  };

  it('turns the unspent upgrade points into medals at the data rate and keeps the upgrades bought', () => {
    const data = sanitizeSave(v5, rules);
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data.version).toBe(META.saveVersion);
    // 4 missions cleared = 8 points, 3 spent: 5 left.
    // Plus what the re-pricing of version 8 gives back: level 2 and level 1 each cost 10 less now.
    expect(data.medals).toBe(5 * META.legacyPointMedals + 20);
    expect(META.legacyPointMedals).toBe(20);
    expect(data.upgrades).toEqual({ hqIncome: 2, rifleHealth: 1 });
    // Its British clears are archived (version 10), and the map no longer opens on a British mission.
    expect(data.cleared).toEqual({});
    expect(data.legacy?.cleared).toEqual(v5.cleared);
    expect(data.lastMission).toBe(0);
  });

  it('keeps every type the British missions it reached had unlocked (missions 1 to 5)', () => {
    const data = sanitizeSave(v5, rules);
    expect(data?.armoury).toEqual(['lmg', 'assault', 'mortar', 'sniper', 'commander']);
  });

  it('counts each cleared mission and difficulty as one win, archived with the British clears', () => {
    const data = sanitizeSave(v5, rules);
    expect(data?.wins).toEqual({});
    expect(data?.legacy?.wins).toEqual({ '1': { normal: 1, hard: 1 }, '2': { normal: 1 }, '3': { insane: 1 }, '4': { normal: 1 } });
    if (!data) return;
    // The Stalingrad missions were never won: a first win pays in full.
    expect(recordWin(data, mission(1001), 'normal', { seconds: 1, lost: 0, hqFrac: 1 }).replayFactor).toBe(1);
  });

  it('migrates a version 1 save the same way, step by step', () => {
    const v1 = { version: 1, cleared: { '1': ['normal'], '2': ['normal'], '3': ['hard'] }, upgrades: { tankDamage: 1 }, settings: { muted: true, difficulty: 'hard', hints: false } };
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v1) }), rules);
    expect(loaded.status).toBe('ok');
    expect(loaded.data.medals).toBe(5 * META.legacyPointMedals + 10);
    // Missions 1 to 4 reached: the Bren, the assault troops and the mortar stay unlocked.
    expect(loaded.data.armoury).toEqual(['lmg', 'assault', 'mortar']);
    expect(loaded.data.wins).toEqual({});
    expect(loaded.data.legacy?.wins).toEqual({ '1': { normal: 1 }, '2': { normal: 1 }, '3': { hard: 1 } });
    expect(loaded.data.upgrades).toEqual({ tankDamage: 1 });
    expect(loaded.data.settings.muted).toBe(true);
  });

  it('gives a fresh player nothing to convert', () => {
    const data = sanitizeSave({ version: 5, cleared: {}, upgrades: {}, lastMission: 0, settings: {} }, rules);
    expect(data?.medals).toBe(0);
    expect(data?.armoury).toEqual([]);
    expect(data?.wins).toEqual({});
    expect(data?.legacy).toBeUndefined();
  });

  it('round-trips a current save unchanged, its legacy block included', () => {
    const save = defaultSave();
    save.medals = 123;
    save.armoury = ['lmg', 'bomber'];
    save.wins = { '1002': { hard: 3 } };
    save.cleared = { '1001': ['normal'], '1002': ['hard'] };
    save.legacy = { cleared: { '1': ['normal'] }, wins: { '1': { normal: 2 } } };
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)), rules)).toEqual(save);
  });

  it('drops unknown Armoury items, enemy-only units and bad win counts from a stored save', () => {
    const data = sanitizeSave(
      { version: 6, medals: -4, armoury: ['lmg', 'heavyTank', 'lmg', 7, 'rifle'], wins: { '1': { normal: 1.5, hard: 2, easy: 3 }, x: {}, '99': { normal: 1 } } },
      rules,
    );
    // The Bren bought at version 6 comes back as medals at version 8 (once, however often it is listed).
    expect(data?.medals).toBe(MEDALS.unitRefunds.lmg);
    expect(data?.armoury).toEqual(['lmg']);
    // The British mission 1's good count is archived; there is no mission 99.
    expect(data?.wins).toEqual({});
    expect(data?.legacy).toEqual({ cleared: {}, wins: { '1': { hard: 2 } } });
  });
});

describe('saves from when units were bought (version 7 to 8)', () => {
  it('refunds every unit type bought at its price and keeps it unlocked; planes stay bought', () => {
    const v7 = { version: 7, medals: 12, armoury: ['lmg', 'tank', 'bomber'], cleared: { '1': ['normal'] }, upgrades: {}, wins: {}, settings: {} };
    const data = sanitizeSave(v7, rules);
    expect(data?.medals).toBe(12 + 90 + 390);
    expect(data?.armoury).toEqual(['lmg', 'tank', 'bomber']);
    if (!data) return;
    const ids = MISSIONS.map((m) => m.id);
    expect(unitsUnlocked(data, MISSIONS, (id) => isUnlocked(data, ids, id))).toEqual(['sapper', 'rifle', 'lmg', 'at', 'tank']);
  });

  it('gives back what upgrade levels cost before the re-pricing, minus what they cost now', () => {
    const v7 = { version: 7, medals: 0, armoury: [], cleared: {}, upgrades: { hqIncome: 1, hqHealth: 2, hqGun: 3 }, wins: {}, settings: {} };
    const data = sanitizeSave(v7, rules);
    // Was 20 a level; now 10, 20, 30: level 1 +10, level 2 +10, level 3 +0.
    expect(data?.medals).toBe(20);
    expect(data?.upgrades).toEqual({ hqIncome: 1, hqHealth: 2, hqGun: 3 });
  });

  it('migrates a version 5 player the same way: what the British missions reached unlocked fields in every mission', () => {
    const v5 = { version: 5, cleared: { '1': ['normal'], '2': ['normal'], '3': ['normal'], '4': ['normal'] }, upgrades: {}, lastMission: 4, settings: {} };
    const data = sanitizeSave(v5, rules);
    if (!data) throw new Error('no save');
    const ids = MISSIONS.map((m) => m.id);
    const unlocked = unitsUnlocked(data, MISSIONS, (id) => isUnlocked(data, ids, id));
    const r = missionRoster(data, mission(1001), unlocked);
    for (const k of mission(1001).units[0]) expect(r.units).toContain(k);
    for (const k of ['assault', 'mortar', 'sniper', 'commander'] as const) expect(r.units, k).toContain(k);
    expect(r.loans).toEqual([]);
  });
});
