/**
 * Stalingrad missions 1001 to 1005 (docs/campaigns/STALINGRAD.md): Brest Fortress, Dubno, the Volokolamsk Highway,
 * Klin and Crossing the Volga. Each is self-consistent mission data that follows the authoring rules (FOUNDATIONS
 * section 9) where today's schema can express them, fields only era-correct kinds for its date, and plays three
 * minutes headless with the reasonable-player bot against the AI without breaking any sim invariant. Whether the bot
 * wins is tests/balance/stalingrad-m1001-1005.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { campaignOf } from '../../src/data/campaigns';
import { CONFIG } from '../../src/data/config';
import { FACTIONS, nationCallsIn, nationFields } from '../../src/data/factions';
import { MISSIONS } from '../../src/data/missions';
import { getStalingradMission, STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { MissionDef, Side } from '../../src/data/schema';
import { SUPPORTS } from '../../src/data/supports';
import { UNITS } from '../../src/data/units';
import { createBattle } from '../../src/sim';
import { checkInvariants } from './sim-helpers';
import { eraNation, MISSION_DATE_ISO, outOfEra, rosterKinds, SUPPORT_ERA, UNIT_ERA } from './stalingrad-era';

const IDS = [1001, 1002, 1003, 1004, 1005] as const;
const M = (id: number): MissionDef => {
  const m = getStalingradMission(id);
  if (!m) throw new Error(`mission ${id} missing`);
  return m;
};
const MINE = IDS.map((id) => [id, M(id)] as const);

/** The design's key, mode, map length and date of each mission (STALINGRAD.md; the modes are the brief's summary table's). */
const SPEC: Record<number, { key: string; length: number; date: string; mode: MissionDef['mode'] }> = {
  1001: { key: 'brest', length: 7000, date: '22 June 1941', mode: 'survival' },
  1002: { key: 'dubno', length: 22000, date: '27 June 1941', mode: 'delay' },
  1003: { key: 'volokolamsk', length: 16000, date: '16 November 1941', mode: 'hold' },
  1004: { key: 'klin', length: 26000, date: '12 December 1941', mode: 'assault' },
  1005: { key: 'volga', length: 12000, date: '15 September 1942', mode: 'special' },
};

function startPop(m: MissionDef, side: Side): number {
  let pop = 0;
  for (const f of m.start[side].forces) pop += UNITS[f.kind].pop * f.count;
  return pop;
}

describe('Stalingrad missions 1001 to 1005', () => {
  it('are listed in order in STALINGRAD_MISSIONS, belong to the campaign, and are among the game\'s campaign missions', () => {
    expect(STALINGRAD_MISSIONS.slice(0, IDS.length).map((m) => m.id)).toEqual([...IDS]);
    for (const id of IDS) {
      expect(campaignOf(id)).toBe('stalingrad');
      expect(MISSIONS.some((m) => m.id === id), `mission ${id} is in MISSIONS`).toBe(true);
    }
    expect(new Set(STALINGRAD_MISSIONS.map((m) => m.key)).size).toBe(STALINGRAD_MISSIONS.length);
  });

  it.each(MINE)('mission %i follows the design: key, date, mode, map length, sides and campaign map region', (id, m) => {
    const spec = SPEC[id];
    expect([m.key, m.date, m.mode, m.length]).toEqual([spec.key, spec.date, spec.mode, spec.length]);
    expect(m.start[0].faction).toBe('soviet');
    expect(m.start[1].faction).toBe('german');
    // The campaign map region (STALINGRAD.md): lon 22 to 47 E, lat 46 to 57.5 N.
    expect(m.mapPos.lon).toBeGreaterThanOrEqual(22);
    expect(m.mapPos.lon).toBeLessThanOrEqual(47);
    expect(m.mapPos.lat).toBeGreaterThanOrEqual(46);
    expect(m.mapPos.lat).toBeLessThanOrEqual(57.5);
    expect(m.start[1].hasHq).toBe(m.mode !== 'survival');
    if (m.mode === 'survival') {
      expect(m.timer?.onExpire).toBe('win');
      expect(m.events.some((e) => e.type === 'wave' && e.side === 1)).toBe(true);
      expect(m.expectedMinutes[0] * 60).toBeLessThanOrEqual(m.timer?.seconds ?? 0);
      expect(m.expectedMinutes[1] * 60).toBeGreaterThanOrEqual(m.timer?.seconds ?? 0);
    } else {
      expect(m.timer).toBeNull();
    }
  });

  it.each(MINE)('mission %i has a three-paragraph briefing, an objective, and its own hints', (_id, m) => {
    expect(m.briefing).toHaveLength(3);
    for (const p of m.briefing) {
      const words = p.split(/\s+/).length;
      expect(words, p).toBeGreaterThanOrEqual(25);
      expect(words, p).toBeLessThanOrEqual(90);
    }
    expect(m.objective.length).toBeGreaterThan(10);
    const hints = m.events.filter((e) => e.type === 'hint');
    expect(hints.length).toBeGreaterThanOrEqual(3);
    // A scripted event at least every 120 s of the expected length (FOUNDATIONS 9.5), counting repeating waves once.
    expect(m.events.length).toBeGreaterThanOrEqual(Math.floor((m.expectedMinutes[0] * 60) / 120));
  });

  it.each(MINE)('mission %i is self-consistent: every trench, unit and position it references exists', (_id, m) => {
    const trenchIds = new Set(m.trenches.map((t) => t.id));
    expect(trenchIds.size).toBe(m.trenches.length);
    for (const t of m.trenches) expect(t.x > 0 && t.x < m.length).toBe(true);
    for (const w of m.wire) expect(w.x > 0 && w.x < m.length).toBe(true);
    for (const p of m.pillboxes) expect(p.x > 0 && p.x < m.length).toBe(true);
    const forces = [...m.start[0].forces, ...m.start[1].forces];
    for (const e of m.events) {
      if ('trenchId' in e.when) expect(trenchIds.has(e.when.trenchId), `event trench ${e.when.trenchId}`).toBe(true);
      if (e.type === 'wave') forces.push(...e.forces);
      if (e.type === 'hint' || e.type === 'announce') expect(e.text.length).toBeGreaterThan(5);
    }
    for (const f of forces) {
      expect(UNITS[f.kind]).toBeDefined();
      expect(f.count).toBeGreaterThan(0);
      if (f.trenchId !== undefined) expect(trenchIds.has(f.trenchId), `force trench ${f.trenchId}`).toBe(true);
      if (f.x !== undefined) expect(f.x > CONFIG.mapMargin && f.x < m.length - CONFIG.mapMargin).toBe(true);
    }
    for (const side of [0, 1] as const) {
      for (const kind of m.supports[side]) expect(SUPPORTS[kind]).toBeDefined();
      for (const step of (side === 0 ? m.bot : m.ai).build) expect(m.units[side], `plan ${step.kind}`).toContain(step.kind);
      // Nobody trains a heavy tank or an enemy-only kind.
      for (const kind of m.units[side]) expect(UNITS[kind].trainable, kind).toBe(true);
    }
    if (m.newUnit) expect(m.units[0]).toContain(m.newUnit);
    if (m.newSupport) expect(m.supports[0]).toContain(m.newSupport);
  });

  it.each(MINE)('mission %i keeps the authoring rules on income and the enemy start (FOUNDATIONS 9.2, 9.3)', (_id, m) => {
    expect(m.start[1].incomeMul).toBeLessThanOrEqual(m.start[0].incomeMul);
    expect(startPop(m, 1)).toBeLessThanOrEqual(70);
    expect(startPop(m, 0)).toBeGreaterThanOrEqual(10);
    expect(startPop(m, 0) + m.start[0].sappers).toBeLessThanOrEqual(CONFIG.popCap);
  });
});

describe('era-correct rosters (until the equipment test of FOUNDATIONS 5.2)', () => {
  it('has a date for every mission', () => {
    for (const id of IDS) expect(MISSION_DATE_ISO[id], `mission ${id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The dates rise through the campaign.
    for (let i = 1; i < IDS.length; i++) expect(MISSION_DATE_ISO[IDS[i]] > MISSION_DATE_ISO[IDS[i - 1]]).toBe(true);
  });

  it.each(MINE)('mission %i fields only kinds and call-ins in service on its date, of its own nation', (id, m) => {
    const date = MISSION_DATE_ISO[id];
    const wrong: string[] = [];
    for (const side of [0, 1] as const) {
      const nation = eraNation(m.start[side].faction);
      for (const kind of rosterKinds(m, side)) {
        if (!nationFields(nation, kind)) wrong.push(`side ${side} ${kind}: another nation's signature unit`);
        const why = outOfEra(UNIT_ERA[nation][kind], date);
        if (why) wrong.push(`side ${side} ${kind}: ${why}`);
      }
      for (const kind of m.supports[side]) {
        if (!nationCallsIn(nation, kind)) wrong.push(`side ${side} ${kind}: another nation's signature call-in`);
        const why = outOfEra(SUPPORT_ERA[nation][kind], date);
        if (why) wrong.push(`side ${side} ${kind}: ${why}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never puts a Tiger, King Tiger or 1941 Panzer III Ausf. E on a 1942 field', () => {
    for (const [, m] of MINE) expect(rosterKinds(m, 1).has('heavyTank'), m.key).toBe(false);
    expect(rosterKinds(M(1005), 1).has('lightTank')).toBe(false);
  });

  it('offers the Katyusha from mission 1003 on, as the design says (first used 14 July 1941)', () => {
    expect(M(1001).supports[0]).not.toContain('katyusha');
    expect(M(1002).supports[0]).not.toContain('katyusha');
    for (const id of [1003, 1004, 1005]) expect(M(id).supports[0], `mission ${id}`).toContain('katyusha');
    expect(FACTIONS.soviet.signature.supports).toContain('katyusha');
  });

  it('rejects an out-of-era kind (the table is not vacuous)', () => {
    expect(outOfEra(UNIT_ERA.german.lightTank, '1942-09-15')).not.toBeNull();
    expect(outOfEra(UNIT_ERA.german.heavyTank, '1943-01-10')).not.toBeNull();
    expect(outOfEra(UNIT_ERA.soviet.apc, '1941-06-27')).not.toBeNull();
    expect(outOfEra(SUPPORT_ERA.soviet.katyusha, '1941-06-27')).not.toBeNull();
    expect(outOfEra(UNIT_ERA.german.conscript, '1942-09-15')).not.toBeNull();
    expect(outOfEra(UNIT_ERA.soviet.rifle, '1941-06-22')).toBeNull();
  });
});

describe('three minutes of each mission, headless, bot against AI', () => {
  it.each(MINE)('mission %i runs 180 s without breaking an invariant, and both sides act', (_id, m) => {
    for (const seed of [1, 2]) {
      const b = createBattle({ mission: m, difficulty: 'normal', seed, upgrades: {}, commanders: ['bot', 'ai'] });
      const ticks = 180 * CONFIG.tickRate;
      let shots = 0;
      let scripted = 0;
      for (let t = 0; t < ticks && !b.state.over; t++) {
        b.step();
        checkInvariants(b);
        for (let i = 0; i < b.events.count; i++) {
          const e = b.events.items[i];
          if (e.type === 'shot') shots++;
          else if (e.type === 'wave' || e.type === 'announce' || e.type === 'hint') scripted++;
        }
      }
      expect(b.state.time).toBeGreaterThan(m.mode === 'survival' ? 179 : 60);
      expect(shots).toBeGreaterThan(0);
      expect(scripted).toBeGreaterThan(2);
      expect(b.state.sides[0].stats.suppliesGathered).toBeGreaterThan(0);
    }
  });
});
