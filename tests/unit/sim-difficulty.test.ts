/**
 * Difficulty changes the AI's income, aggression, think interval, wave strength and army size, and
 * never a unit or weapon stat; and the AI reacts to what the player fields on every difficulty.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import { DIFFICULTIES, DIFFICULTY_LIST } from '../../src/data/difficulty';
import { MISSIONS } from '../../src/data/missions';
import type { MissionAiPlan, MissionDef, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import type { Battle, CommanderKind } from '../../src/sim';
import type { World } from '../../src/sim/world';
import { makeBattle, run, testMission, type MissionOverrides } from './sim-helpers';

/** Everything a difficulty may set. */
const AI_ONLY_KEYS = ['id', 'name', 'aiIncomeMul', 'aiAggression', 'aiWaveMul', 'aiPopCapMul', 'aiThinkInterval'];

/**
 * The unit and weapon tables a battle actually fights with, as a string: per side the per-kind
 * health, damage and healing multipliers, the sapper, HQ and HQ-gun multipliers and the HQ and
 * pillbox health; and for every unit on the field its definition, health and weapon multipliers.
 */
function effectiveTables(b: Battle): string {
  const w = b as unknown as World;
  const s = b.state;
  const sides = w.mods.map((m, si) => ({
    unitHealth: Array.from(m.unitHealth),
    unitDamage: Array.from(m.unitDamage),
    unitHeal: Array.from(m.unitHeal),
    sapper: [m.sapperSpeed, m.sapperCarry],
    hq: [m.hqHealth, m.hqGunDamage, m.hqGunRate, s.sides[si].hq?.maxHp ?? null],
  }));
  const pillboxes = s.pillboxes.map((p) => p.maxHp);
  const units: unknown[] = [];
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    // Veterans (the King Tiger's escort, placed by mission data) carry config.veteran on every difficulty alike: the
    // flag is compared, and the health without the veteran bonus must be the kind's plain health.
    const maxHp = u.veteran ? u.maxHp / CONFIG.veteran.hpMul : u.maxHp;
    units.push([u.side, u.kind, u.def === UNITS[u.kind], maxHp, u.mount.damageMul, u.mount2.damageMul, u.veteran]);
  }
  units.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
  return JSON.stringify({ sides, pillboxes, units });
}

describe('difficulty definitions', () => {
  it('carry only AI settings: income, aggression, wave strength, army size and think interval', () => {
    for (const d of DIFFICULTY_LIST) {
      for (const key of Object.keys(DIFFICULTIES[d])) expect(AI_ONLY_KEYS, `${d}.${key}`).toContain(key);
    }
  });

  it('grow harder in order: more income, aggression, wave strength and army size, quicker thinking', () => {
    for (let i = 1; i < DIFFICULTY_LIST.length; i++) {
      const [easy, hard] = [DIFFICULTIES[DIFFICULTY_LIST[i - 1]], DIFFICULTIES[DIFFICULTY_LIST[i]]];
      expect(hard.aiIncomeMul).toBeGreaterThan(easy.aiIncomeMul);
      expect(hard.aiAggression).toBeGreaterThan(easy.aiAggression);
      expect(hard.aiWaveMul).toBeGreaterThanOrEqual(easy.aiWaveMul);
      expect(hard.aiPopCapMul).toBeGreaterThanOrEqual(easy.aiPopCapMul);
      expect(hard.aiThinkInterval).toBeLessThan(easy.aiThinkInterval);
    }
  });
});

describe('difficulty never alters unit or weapon stats', () => {
  const setups: [CommanderKind, CommanderKind][] = [
    ['bot', 'ai'],
    ['human', 'ai'],
  ];

  it("leaves every battle's effective unit tables the same on Normal, Hard and Insane", () => {
    for (const mission of MISSIONS) {
      for (const commanders of setups) {
        const tables = DIFFICULTY_LIST.map((difficulty) => {
          const b = makeBattle({ mission, difficulty, commanders });
          // The start, and again once both sides have trained and scripted waves have come in.
          const atStart = effectiveTables(b);
          run(b, 90);
          return [atStart, effectiveTables(b)];
        });
        for (let i = 1; i < tables.length; i++) {
          expect(tables[i][0], `mission ${mission.id} ${commanders.join('/')} at the start on ${DIFFICULTY_LIST[i]}`).toBe(tables[0][0]);
        }
        // After 90 s the armies differ (that is the point of the AI's extra income), but every unit
        // still fights with the plain stats of its kind.
        for (const [d, [, later]] of tables.map((t, i) => [DIFFICULTY_LIST[i], t] as const)) {
          const parsed = JSON.parse(later) as { units: [number, UnitKind, boolean, number, number, number, boolean][] };
          for (const [side, kind, sameDef, maxHp, damage, damage2] of parsed.units) {
            const where = `mission ${mission.id} ${d} side ${side} ${kind}`;
            expect(sameDef, where).toBe(true);
            expect(maxHp, where).toBe(UNITS[kind].hp);
            expect(damage, where).toBe(1);
            expect(damage2, where).toBe(1);
          }
        }
      }
    }
  });

  it('battles on every difficulty leave the shared unit, weapon, damage and rule tables untouched', () => {
    const before = JSON.stringify([UNITS, WEAPONS, DAMAGE, CONFIG]);
    for (const difficulty of DIFFICULTY_LIST) {
      const b = makeBattle({ mission: MISSIONS[7], difficulty, commanders: ['bot', 'ai'] });
      run(b, 240);
    }
    expect(JSON.stringify([UNITS, WEAPONS, DAMAGE, CONFIG])).toBe(before);
  });

  it("scales only the AI side's income, waves and army size, and never the player's", () => {
    const mission = MISSIONS[0];
    for (const difficulty of DIFFICULTY_LIST) {
      const def = DIFFICULTIES[difficulty];
      const w = makeBattle({ mission, difficulty, commanders: ['bot', 'ai'] }) as unknown as World;
      expect(w.mods[0].income).toBe(mission.start[0].incomeMul);
      expect([w.mods[0].airdrop, w.mods[0].wave, w.mods[0].popCap]).toEqual([1, 1, 1]);
      expect(w.mods[1].income).toBeCloseTo(mission.start[1].incomeMul * def.aiIncomeMul, 9);
      expect([w.mods[1].airdrop, w.mods[1].wave, w.mods[1].popCap]).toEqual([def.aiIncomeMul, def.aiWaveMul, def.aiPopCapMul]);
    }
  });
});

describe('the AI reacts to what the player fields, on every difficulty', () => {
  const offered: [UnitKind[], UnitKind[]] = [
    ['sapper', 'rifle', 'tank'],
    ['sapper', 'rifle', 'at', 'mortar', 'assault', 'lmg'],
  ];
  /** A plan that never asks for anti-tank men or mortars on its own. */
  const plan: MissionAiPlan = { sappers: 1, build: [{ kind: 'rifle', count: 3, after: 0 }], firstAttackAfter: 100_000 };

  /** What the AI (side 1) has trained or queued after a minute and a half facing an idle player. */
  function fielded(over: MissionOverrides, difficulty: (typeof DIFFICULTY_LIST)[number]): Record<'at' | 'mortar', number> {
    const mission: MissionDef = testMission({ ai: plan, units: offered, pillboxes: [], wire: [], trenches: [], b: { supplies: 4000, sappers: 1 }, ...over });
    const b = makeBattle({ mission, difficulty, commanders: ['idle', 'ai'] });
    run(b, 90);
    const s = b.state.sides[1];
    return { at: s.alive.at + s.queue.at, mortar: s.alive.mortar + s.queue.mortar };
  }

  for (const difficulty of DIFFICULTY_LIST) {
    it(`on ${difficulty}: no anti-tank men or mortars against riflemen in the open`, () => {
      expect(fielded({ a: { forces: [{ kind: 'rifle', count: 4, x: 1200 }] } }, difficulty)).toEqual({ at: 0, mortar: 0 });
    });

    it(`on ${difficulty}: anti-tank teams once it sees the player's tanks`, () => {
      const seen = fielded({ a: { forces: [{ kind: 'tank', count: 2, x: 1200, behaviour: 'guard' }] } }, difficulty);
      expect(seen.at).toBeGreaterThanOrEqual(2);
      expect(seen.mortar).toBe(0);
    });

    it(`on ${difficulty}: mortars once the player's infantry is dug in`, () => {
      const seen = fielded(
        {
          trenches: [{ id: 1, x: 1500, width: 160, slots: 6, owner: 0 }],
          a: { forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] },
        },
        difficulty,
      );
      expect(seen.mortar).toBeGreaterThanOrEqual(1);
      expect(seen.at).toBe(0);
    });
  }
});
