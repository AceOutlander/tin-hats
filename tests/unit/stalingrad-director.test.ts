/**
 * The Stalingrad missions on the mission director (FOUNDATIONS.md 3, docs/campaigns/STALINGRAD_BUILD.md): every
 * mission is written as phases whose references hold together (phases, objectives, points, structures, triggers), the
 * scripted barrages name barrage weapons, and a battle on them is deterministic. Whether the bot wins each is
 * tests/balance/missions.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { MissionDef, MissionTrigger, ObjectiveDef, PointRef, StructureRef } from '../../src/data/schema';
import { WEAPONS } from '../../src/data/weapons';
import { createBattle } from '../../src/sim';
import { snapshot } from './sim-helpers';

const MINE = STALINGRAD_MISSIONS.map((m) => [m.id, m] as const);

function structureExists(m: MissionDef, ref: StructureRef): boolean {
  if ('trench' in ref) return m.trenches.some((t) => t.id === ref.trench);
  if ('pillbox' in ref) return m.pillboxes.some((p) => p.id === ref.pillbox);
  if ('wire' in ref) return m.wire.some((w) => w.id === ref.wire);
  if ('building' in ref) return (m.buildings ?? []).some((b) => b.id === ref.building);
  return ref.hq === 0 || m.start[1].hasHq;
}

function pointExists(m: MissionDef, ref: PointRef): boolean {
  if ('point' in ref) return (m.capturePoints ?? []).some((p) => p.id === ref.point);
  if ('building' in ref) return (m.buildings ?? []).some((b) => b.id === ref.building) || (m.props ?? []).some((p) => p.id === ref.building);
  return m.trenches.some((t) => t.id === ref.trench);
}

function objectiveRefs(m: MissionDef, o: ObjectiveDef): string[] {
  const bad: string[] = [];
  if ((o.type === 'capture' || o.type === 'hold') && !pointExists(m, o.point)) bad.push(`${o.id}: no point`);
  if (o.type === 'destroy') for (const s of o.structures) if (!structureExists(m, s)) bad.push(`${o.id}: no structure`);
  if ((o.type === 'destroyHq' || o.type === 'surrender') && o.side === 1 && !m.start[1].hasHq) bad.push(`${o.id}: no HQ`);
  return bad;
}

describe.each(MINE)('mission %i on the mission director', (_id, m) => {
  const phases = m.phases ?? [];
  const ids = new Set(phases.map((p) => p.id));

  it('is written as phases, chained from the first to a last one that wins', () => {
    expect(phases.length).toBeGreaterThanOrEqual(2);
    expect(ids.size).toBe(phases.length);
    for (const p of phases) {
      expect(p.title.length, p.id).toBeGreaterThan(2);
      expect(p.title.length, p.id).toBeLessThanOrEqual(40);
      if (p.next !== null) expect(ids.has(p.next), `${p.id} -> ${p.next}`).toBe(true);
    }
    // Walking the chain from the first phase reaches every phase once and ends.
    const seen: string[] = [];
    let at: string | null = phases[0].id;
    while (at !== null && !seen.includes(at)) {
      seen.push(at);
      at = phases.find((p) => p.id === at)?.next ?? null;
    }
    expect(at).toBeNull();
    expect(seen.length).toBe(phases.length);
  });

  it('names only points, structures, phases and objectives that exist, with unique ids', () => {
    const bad: string[] = [];
    const objectiveIds: string[] = [];
    for (const p of phases) {
      for (const o of p.objectives) {
        objectiveIds.push(o.id);
        bad.push(...objectiveRefs(m, o));
      }
      for (const so of p.sideObjectives ?? []) {
        objectiveIds.push(so.id);
        expect(so.text.length, so.id).toBeLessThanOrEqual(40);
        expect(so.bonus).toBeGreaterThan(0);
        expect(so.bonus).toBeLessThanOrEqual(0.25);
        if (so.objective) {
          objectiveIds.push(so.objective.id);
          bad.push(...objectiveRefs(m, so.objective));
        }
        if (so.until !== undefined && !ids.has(so.until)) bad.push(`${so.id}: until ${so.until}`);
        const f = so.failIf;
        if ((f?.type === 'pointLost' || f?.type === 'contested') && !pointExists(m, f.point)) bad.push(`${so.id}: failIf point`);
      }
      for (const l of p.lose ?? []) {
        if ((l.type === 'pointLost' || l.type === 'contested') && !pointExists(m, l.point)) bad.push(`${p.id}: lose point`);
        if (l.type === 'enemyReached') expect(l.x > 0 && l.x < m.length).toBe(true);
      }
    }
    expect(new Set(objectiveIds).size, 'objective ids are unique').toBe(objectiveIds.length);
    const eventIds = m.events.flatMap((e) => (e.id !== undefined ? [e.id] : []));
    expect(new Set(eventIds).size, 'event ids are unique').toBe(eventIds.length);
    const trig = (when: MissionTrigger, label: string): void => {
      if ('phaseEvery' in when || 'phase' in when) {
        if (!ids.has(when.phase)) bad.push(`${label}: phase ${when.phase}`);
      } else if ('objective' in when) {
        if (!objectiveIds.includes(when.objective)) bad.push(`${label}: objective ${when.objective}`);
      } else if ('pointCapturedBy' in when) {
        if (!pointExists(m, when.point)) bad.push(`${label}: point`);
      } else if ('structureDestroyed' in when) {
        if (!structureExists(m, when.structureDestroyed)) bad.push(`${label}: structure`);
      }
    };
    for (const e of m.events) {
      trig(e.when, `${e.type} ${e.id ?? ''}`);
      if (e.type === 'barrage') {
        expect(WEAPONS[e.weapon], e.weapon).toBeDefined();
        expect(e.rounds).toBeGreaterThan(0);
        expect(e.x > 0 && e.x < m.length).toBe(true);
      }
      if (e.type === 'airRaid' || e.type === 'support') {
        const kind = e.type === 'airRaid' ? e.support : e.kind;
        // A raid may be the other side's free one; a call-in offered later must be one the mission lists.
        if (e.type === 'support') expect(m.supports[e.side], kind).toContain(kind);
      }
      if (e.type === 'wave') for (const f of e.forces) if (f.at) expect(pointExists(m, f.at), 'wave spawn point').toBe(true);
    }
    for (const side of [0, 1] as const) for (const kind of m.start[side].supportsOff ?? []) expect(m.supports[side]).toContain(kind);
    expect(bad).toEqual([]);
  });

  it('plays the same battle twice from the same seed', () => {
    const run = (): string => {
      const b = createBattle({ mission: m, difficulty: 'normal', seed: 4, upgrades: {}, commanders: ['bot', 'ai'] });
      for (let i = 0; i < 30 * 240 && !b.state.over; i++) b.step();
      return `${snapshot(b)} ${JSON.stringify(b.state.director)}`;
    };
    expect(run()).toBe(run());
  });
});
