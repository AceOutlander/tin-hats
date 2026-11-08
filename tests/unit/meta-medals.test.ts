/**
 * Medals and the Armoury (src/meta/medals.ts): the score of a win, the replay decay per mission and difficulty,
 * Armoury purchases, what the player fields in a mission (ownership cut to what the mission allows, plus loans),
 * and the step from save version 5 (upgrade points, unlocks by progress) to medals.
 */
import { describe, expect, it } from 'vitest';
import { MEDALS } from '../../src/data/medals';
import { META } from '../../src/data/meta';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
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
  ownsItem,
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

describe('the score of a win', () => {
  const def = missionMedals(4);

  it('pays about 10 for a rough clear and about 100 for a perfect one', () => {
    const perfect = scoreWin('assault', def, { seconds: def.targetSeconds, lost: def.targetLost, hqFrac: 1 }, 'normal', 0);
    const rough = scoreWin('assault', def, { seconds: def.roughSeconds * 2, lost: def.roughLost * 2, hqFrac: 0.1 }, 'normal', 0);
    expect(perfect.score).toBe(1);
    expect(perfect.medals).toBe(MEDALS.perfect);
    expect(rough.score).toBe(0);
    expect(rough.medals).toBe(MEDALS.rough);
    expect(MEDALS.rough).toBe(10);
    expect(MEDALS.perfect).toBe(100);
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
    const s = missionMedals(2);
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
});

describe('replays pay 50% less each time, per mission and difficulty', () => {
  it('halves the medals on each win of the same mission on the same difficulty, rounded down', () => {
    const save = defaultSave();
    const m = mission(3);
    const def = missionMedals(3);
    const stats = { seconds: def.targetSeconds + 17, lost: def.targetLost + 3, hqFrac: 1 };
    const base = scoreWin('assault', def, stats, 'normal', 0).base;
    const paid = [0, 1, 2, 3].map(() => recordWin(save, m, 'normal', stats).medals);
    expect(paid).toEqual([base, Math.floor(base / 2), Math.floor(base / 4), Math.floor(base / 8)]);
    expect(save.medals).toBe(paid.reduce((a, b) => a + b, 0));
    expect(winsOn(save, 3, 'normal')).toBe(4);
  });

  it('pays in full for the first win on a harder difficulty, and keeps each mission on its own count', () => {
    const save = defaultSave();
    const stats = { seconds: 100, lost: 0, hqFrac: 1 };
    recordWin(save, mission(3), 'normal', stats);
    recordWin(save, mission(3), 'normal', stats);
    expect(recordWin(save, mission(3), 'hard', stats).replayFactor).toBe(1);
    expect(recordWin(save, mission(4), 'normal', stats).replayFactor).toBe(1);
    expect(recordWin(save, mission(3), 'hard', stats).replayFactor).toBe(0.5);
    expect(save.wins).toEqual({ '3': { normal: 2, hard: 2 }, '4': { normal: 1 } });
  });

  it('gives the percentage the briefing shows', () => {
    expect([0, 1, 2, 3, 4].map(replayPercent)).toEqual([100, 50, 25, 12, 6]);
  });
});

describe('the Armoury', () => {
  it('has riflemen and sappers free, and sells every other role, the new units and the plane call-ins', () => {
    expect(MEDALS.free.sort()).toEqual(['rifle', 'sapper']);
    const sold = MEDALS.armoury.map((a) => a.id);
    for (const k of ['lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'commander', 'aa', 'bomber', 'fighter', 'recon']) {
      expect(sold).toContain(k);
    }
    expect(new Set(sold).size).toBe(sold.length);
    for (const a of MEDALS.armoury) expect(a.price).toBeGreaterThan(0);
  });

  it('never sells an enemy-only unit or a free one', () => {
    for (const a of MEDALS.armoury) {
      if (a.type !== 'unit') continue;
      expect(UNITS[a.id as keyof typeof UNITS].enemyOnly, a.id).not.toBe(true);
      expect(MEDALS.free as string[]).not.toContain(a.id);
    }
    expect(MEDALS.armoury.map((a) => a.id as string)).not.toContain('heavyTank');
    expect(MEDALS.armoury.map((a) => a.id as string)).not.toContain('lightTank');
  });

  it('buys with medals, once, and only what is for sale', () => {
    const save = defaultSave();
    const lmg = MEDALS.armoury.find((a) => a.id === 'lmg');
    if (!lmg) throw new Error('no lmg');
    expect(ownsItem(save, 'rifle')).toBe(true);
    expect(ownsItem(save, 'lmg')).toBe(false);
    expect(canBuyItem(save, 'lmg')).toBe(false);
    expect(buyItem(save, 'lmg')).toBe(false);
    save.medals = lmg.price;
    expect(buyItem(save, 'lmg')).toBe(true);
    expect(save.medals).toBe(0);
    expect(ownsItem(save, 'lmg')).toBe(true);
    save.medals = 9999;
    expect(buyItem(save, 'lmg')).toBe(false);
    expect(buyItem(save, 'rifle')).toBe(false);
    expect(buyItem(save, 'heavyTank')).toBe(false);
    expect(buyItem(save, 'nonsense')).toBe(false);
    expect(save.medals).toBe(9999);
    expect(save.armoury).toEqual(['lmg']);
  });

  it('gives and takes medals, never below zero', () => {
    const save = defaultSave();
    expect(addMedals(save, 25)).toBe(25);
    expect(addMedals(save, -10)).toBe(15);
    expect(addMedals(save, -100)).toBe(0);
    expect(addMedals(save, Number.NaN)).toBe(0);
  });
});

describe('what the player fields in a mission', () => {
  it('starts with the free types the mission lists, and lends what it needs', () => {
    const save = defaultSave();
    const r = missionRoster(save, mission(7));
    expect(r.units).toEqual(['sapper', 'rifle']);
    expect(r.loans).toEqual([{ kind: 'at', count: 3 }]);
    // No sappers where the mission has none.
    expect(missionRoster(save, mission(9)).units).toEqual(['rifle']);
  });

  it('fields every owned type the mission allows, for every nation, and stops lending what was bought', () => {
    const save = defaultSave();
    save.armoury = ['lmg', 'at', 'tank'];
    const r = missionRoster(save, mission(7));
    expect(r.units).toEqual(['sapper', 'rifle', 'lmg', 'at', 'tank']);
    expect(r.loans).toEqual([]);
    // Mission 1 (the tutorial) keeps to its own list; Arnhem has no vehicles.
    expect(missionRoster(save, mission(1)).units).toEqual(['sapper', 'rifle']);
    expect(missionRoster(save, mission(9)).units).toEqual(['rifle', 'lmg', 'at']);
  });

  it('leaves out bought types the sim cannot field yet, and lends only fieldable ones', () => {
    const save = defaultSave();
    save.armoury = MEDALS.armoury.map((a) => a.id);
    const r = missionRoster(save, mission(8));
    for (const k of r.units) expect(UNITS[k].trainable, k).toBe(true);
  });

  it('adds owned plane call-ins to the mission own ones', () => {
    const save = defaultSave();
    expect(missionRoster(save, mission(6)).supports).toEqual(['artillery', 'smoke']);
    save.armoury = ['recon', 'bomber'];
    expect(missionRoster(save, mission(6)).supports).toEqual(['artillery', 'smoke', 'recon', 'bomber']);
  });

  it('applies the roster to a copy of the mission: buttons, call-ins and the loans at the start', () => {
    const m = mission(8);
    const roster = missionRoster(defaultSave(), m);
    const played = applyRoster(m, roster);
    expect(played.units[0]).toEqual(roster.units);
    expect(played.units[1]).toEqual(m.units[1]);
    expect(played.supports[0]).toEqual(m.supports[0]);
    expect(played.start[0].forces.slice(m.start[0].forces.length)).toEqual([
      { kind: 'at', count: 3 },
      { kind: 'tank', count: 2 },
    ]);
    // The data itself is left alone.
    expect(m.start[0].forces).toEqual(mission(8).start[0].forces);
    expect(mission(8).units[0]).toContain('tank');
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
    expect(data.medals).toBe(5 * META.legacyPointMedals);
    expect(META.legacyPointMedals).toBe(UPGRADES[0].costPerLevel);
    expect(data.upgrades).toEqual({ hqIncome: 2, rifleHealth: 1 });
    expect(data.cleared).toEqual(v5.cleared);
    expect(data.lastMission).toBe(4);
  });

  it('owns every unit type the player could field in a cleared mission', () => {
    const data = sanitizeSave(v5, rules);
    expect(data?.armoury.sort()).toEqual(['assault', 'lmg', 'mortar']);
    // So the next mission plays as it did before medals, apart from its own new unit, which is lent.
    if (!data) return;
    const r = missionRoster(data, mission(5));
    for (const k of mission(4).units[0]) expect(r.units).toContain(k);
    expect(r.loans.map((l) => l.kind)).toEqual(['sniper']);
  });

  it('counts each cleared mission and difficulty as one win, so a replay pays 50%', () => {
    const data = sanitizeSave(v5, rules);
    expect(data?.wins).toEqual({ '1': { normal: 1, hard: 1 }, '2': { normal: 1 }, '3': { insane: 1 }, '4': { normal: 1 } });
    if (!data) return;
    expect(recordWin(data, mission(1), 'normal', { seconds: 1, lost: 0, hqFrac: 1 }).replayFactor).toBe(0.5);
    expect(recordWin(data, mission(1), 'insane', { seconds: 1, lost: 0, hqFrac: 1 }).replayFactor).toBe(1);
  });

  it('migrates a version 1 save the same way, step by step', () => {
    const v1 = { version: 1, cleared: { '1': ['normal'], '2': ['normal'], '3': ['hard'] }, upgrades: { tankDamage: 1 }, settings: { muted: true, difficulty: 'hard', hints: false } };
    const loaded = loadSave(createMemoryStorage({ [META.saveKey]: JSON.stringify(v1) }), rules);
    expect(loaded.status).toBe('ok');
    expect(loaded.data.medals).toBe(5 * META.legacyPointMedals);
    expect(loaded.data.armoury.sort()).toEqual(['assault', 'lmg']);
    expect(loaded.data.wins).toEqual({ '1': { normal: 1 }, '2': { normal: 1 }, '3': { hard: 1 } });
    expect(loaded.data.upgrades).toEqual({ tankDamage: 1 });
    expect(loaded.data.settings.muted).toBe(true);
  });

  it('gives a fresh player nothing to convert', () => {
    const data = sanitizeSave({ version: 5, cleared: {}, upgrades: {}, lastMission: 0, settings: {} }, rules);
    expect(data?.medals).toBe(0);
    expect(data?.armoury).toEqual([]);
    expect(data?.wins).toEqual({});
  });

  it('round-trips a version 6 save unchanged', () => {
    const save = defaultSave();
    save.medals = 123;
    save.armoury = ['lmg', 'bomber'];
    save.wins = { '2': { hard: 3 } };
    save.cleared = { '1': ['normal'], '2': ['hard'] };
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)), rules)).toEqual(save);
  });

  it('drops unknown Armoury items, enemy-only units and bad win counts from a stored save', () => {
    const data = sanitizeSave(
      { version: 6, medals: -4, armoury: ['lmg', 'heavyTank', 'lmg', 7, 'rifle'], wins: { '1': { normal: 1.5, hard: 2, easy: 3 }, x: {}, '99': { normal: 1 } } },
      rules,
    );
    expect(data?.medals).toBe(0);
    expect(data?.armoury).toEqual(['lmg']);
    expect(data?.wins).toEqual({ '1': { hard: 2 } });
  });
});
