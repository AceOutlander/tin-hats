/**
 * The campaign data: ten missions in order, each self-consistent and following the owner's
 * campaign specification (theatres, modes, unlocks, special rules).
 */
import { describe, expect, it } from 'vitest';
import { MISSIONS, getMission } from '../../src/data/missions';
import type { MissionDef, UnitKind } from '../../src/data/schema';
import { SUPPORTS } from '../../src/data/supports';
import { UNITS } from '../../src/data/units';
import { createBattle } from '../../src/sim';

const M = (id: number): MissionDef => getMission(id) as MissionDef;

describe('the campaign', () => {
  it('has ten missions with ids 1..10 in order, unique keys and growing maps of about 6000 to 14000 wu', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(MISSIONS.map((m) => m.key)).size).toBe(10);
    expect(M(1).length).toBe(6000);
    expect(M(10).length).toBe(14000);
    for (const m of MISSIONS) {
      expect(m.length, m.key).toBeGreaterThanOrEqual(6000);
      expect(m.length, m.key).toBeLessThanOrEqual(14000);
    }
  });

  it('follows the specification: theatres, modes, timers and what each mission introduces', () => {
    const spec: [number, string, string, UnitKind | null, string | null][] = [
      [1, 'france', 'assault', 'rifle', null],
      [2, 'france', 'survival', 'lmg', null],
      [3, 'desert', 'assault', 'assault', null],
      [4, 'desert', 'assault', 'mortar', 'artillery'],
      [5, 'sicily', 'assault', 'sniper', null],
      [6, 'italy', 'assault', 'medic', 'smoke'],
      [7, 'normandy', 'assault', 'at', null],
      [8, 'france', 'assault', 'tank', null],
      [9, 'holland', 'survival', null, null],
      [10, 'germany', 'assault', null, 'airStrike'],
    ];
    for (const [id, theatre, mode, unit, support] of spec) {
      const m = M(id);
      expect([m.theatre, m.mode, m.newUnit, m.newSupport], m.key).toEqual([theatre, mode, unit, support]);
      if (unit) expect(m.units[0], m.key).toContain(unit);
      if (support) expect(m.supports[0], m.key).toContain(support);
    }
    expect([M(2).timeOfDay, M(7).timeOfDay, M(10).timeOfDay, M(5).timeOfDay]).toEqual(['overcast', 'dawn', 'overcast', 'dusk']);
    expect(M(4).timeOfDay).not.toBe(M(3).timeOfDay);
    expect(M(2).timer).toEqual({ seconds: 240, onExpire: 'win', label: expect.any(String) });
    expect(M(9).timer).toMatchObject({ seconds: 360, onExpire: 'win' });
    expect(M(5).timer?.onExpire).toBe('lose');
    for (const id of [1, 3, 4, 6, 7, 8, 10]) expect(M(id).timer, `mission ${id}`).toBeNull();
  });

  it('gives survival missions an enemy with no HQ, and mission 9 no sappers, no tanks and only airdropped supplies', () => {
    for (const m of MISSIONS) {
      expect(m.start[1].hasHq, m.key).toBe(m.mode !== 'survival');
      if (m.mode === 'survival') expect(m.events.some((e) => e.type === 'wave' && e.side === 1), m.key).toBe(true);
    }
    const m9 = M(9);
    expect(m9.units[0]).not.toContain('sapper');
    expect(m9.units[0]).not.toContain('tank');
    expect(m9.start[0].incomeMul).toBe(0);
    expect(m9.events.some((e) => e.type === 'airdrop' && e.side === 0 && 'every' in e.when)).toBe(true);
    const b = createBattle({ mission: m9, difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['human', 'ai'] });
    expect(b.state.sides[0].available.sapper).toBe(false);
    expect(b.state.sides[0].available.tank).toBe(false);
  });

  it('puts a King Tiger on guard in front of the German HQ in mission 10', () => {
    const tiger = M(10).start[1].forces.find((f) => f.kind === 'heavyTank');
    expect(tiger?.behaviour).toBe('guard');
    expect(tiger?.x).toBeGreaterThan(M(10).length - 2000);
  });

  it('accumulates player units from mission to mission (except mission 9) and never lets anyone train a King Tiger', () => {
    for (let id = 2; id <= 10; id++) {
      const before = M(id === 10 ? 8 : id - 1).units[0];
      for (const kind of before) {
        if (id === 9 && (kind === 'sapper' || kind === 'tank')) continue;
        expect(M(id).units[0], `mission ${id} keeps ${kind}`).toContain(kind);
      }
    }
    for (const m of MISSIONS) {
      for (const side of [0, 1] as const) expect(m.units[side], m.key).not.toContain('heavyTank');
    }
  });

  it('is self-consistent: every trench, unit and support referenced exists, and every field is filled', () => {
    for (const m of MISSIONS) {
      const trenchIds = new Set(m.trenches.map((t) => t.id));
      expect(trenchIds.size, m.key).toBe(m.trenches.length);
      expect(m.briefing.length, m.key).toBeGreaterThanOrEqual(m.id <= 3 ? 3 : 1);
      for (const p of m.briefing) expect(p.length, m.key).toBeGreaterThan(20);
      expect(m.objective.length, m.key).toBeGreaterThan(10);
      expect(m.title.length * m.location.length * m.date.length, m.key).toBeGreaterThan(0);
      expect(Math.abs(m.mapPos.lon), m.key).toBeLessThanOrEqual(40);
      expect(m.mapPos.lat, m.key).toBeGreaterThan(29);
      expect(m.mapPos.lat, m.key).toBeLessThan(56);
      expect(m.expectedMinutes[0], m.key).toBeLessThanOrEqual(m.expectedMinutes[1]);
      for (const side of [0, 1] as const) {
        for (const kind of m.units[side]) expect(UNITS[kind], m.key).toBeDefined();
        for (const kind of m.supports[side]) expect(SUPPORTS[kind], m.key).toBeDefined();
        for (const f of m.start[side].forces) {
          if (f.trenchId !== undefined) expect(trenchIds.has(f.trenchId), `${m.key} force trench ${f.trenchId}`).toBe(true);
          if (f.x !== undefined) expect(f.x > 0 && f.x < m.length, m.key).toBe(true);
        }
      }
      for (const t of m.trenches) expect(t.x > 0 && t.x < m.length, m.key).toBe(true);
      for (const p of m.pillboxes) expect(p.x > 0 && p.x < m.length, m.key).toBe(true);
      for (const w of m.wire) expect(w.x > 0 && w.x < m.length, m.key).toBe(true);
      for (const e of m.events) {
        if ('trenchId' in e.when) expect(trenchIds.has(e.when.trenchId), `${m.key} event trench`).toBe(true);
        if (e.type === 'hint' || e.type === 'announce') expect(e.text.length, m.key).toBeGreaterThan(5);
      }
      for (const plan of [m.ai, m.bot]) {
        for (const step of plan.build) expect(m.units[plan === m.ai ? 1 : 0], `${m.key} plan ${step.kind}`).toContain(step.kind);
      }
    }
  });

  it('teaches the new unit of missions 2 and 3 in its hints and briefing', () => {
    for (const [id, name] of [
      [2, 'Bren'],
      [3, 'Assault Trooper'],
    ] as const) {
      const m = M(id);
      const hints = m.events.filter((e) => e.type === 'hint').map((e) => (e.type === 'hint' ? e.text : ''));
      expect(hints.some((h) => h.includes(name)), m.key).toBe(true);
      expect(m.briefing.join(' ').includes(name), m.key).toBe(true);
    }
  });
});
