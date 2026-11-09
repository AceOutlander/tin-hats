/**
 * Every campaign mission's data and scripted events (Stalingrad, 1001 to 1010). The ten British placeholder missions
 * had their own design files (missions-a: 4 to 6, missions-b: 7 to 10); those went with the missions (owner,
 * docs/QUEUE.md), and the checks in them that are rules of the engine rather than of one British mission's design run
 * here on every campaign mission: structures inside the map with unique ids, events and garrisons that name real
 * trenches, triggers with sane values, plans with trainable units the side has, hints and announcements the HUD can
 * show, a timer and an enemy that suit the mode, a three-paragraph briefing and a one-line objective, and, in a real
 * battle, hints, waves and announcements that all come from the mission data.
 *
 * The British design rules the Stalingrad missions were not written to (waves never into a trench, garrisons within
 * the trench slots, start forces only of trainable kinds, hints 12 s apart, 200-character briefing paragraphs, and
 * the others in DECISIONS 307) are not carried over: Stalingrad follows FOUNDATIONS.md section 9 instead. Whether the
 * bot wins and the idle commander loses is tests/balance/missions.test.ts; each mission's own design is
 * tests/unit/stalingrad-m1001-1005.test.ts and tests/unit/stalingrad-unlocks.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MISSIONS } from '../../src/data/missions';
import { PREP } from '../../src/data/prep';
import type { MissionDef, MissionEventDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { createBattle, type SimEventType } from '../../src/sim';
import { checkInvariants } from '../unit/sim-helpers';
import { HEAVY } from './helpers';

function waves(m: MissionDef, side: 0 | 1): Extract<MissionEventDef, { type: 'wave' }>[] {
  return m.events.filter((e): e is Extract<MissionEventDef, { type: 'wave' }> => e.type === 'wave' && e.side === side);
}

function hints(m: MissionDef): Extract<MissionEventDef, { type: 'hint' }>[] {
  return m.events.filter((e): e is Extract<MissionEventDef, { type: 'hint' }> => e.type === 'hint');
}

describe.each(MISSIONS.map((m) => [m.id, m] as const))('mission %i data', (_id, m) => {
  it('keeps every structure inside the map, with unique ids and room for at least four in a trench', () => {
    const margin = 300;
    const inside = (x: number, width: number): boolean => x - width / 2 >= margin && x + width / 2 <= m.length - margin;
    for (const t of m.trenches) expect(inside(t.x, t.width), `trench ${t.id}`).toBe(true);
    for (const p of m.pillboxes) expect(inside(p.x, CONFIG.pillboxWidth), `pillbox ${p.id}`).toBe(true);
    for (const w of m.wire) expect(inside(w.x, w.width), `wire ${w.id}`).toBe(true);
    for (const list of [m.trenches, m.pillboxes, m.wire]) expect(new Set(list.map((s) => s.id)).size, 'unique ids').toBe(list.length);
    for (const t of m.trenches) expect(t.slots, `trench ${t.id}`).toBeGreaterThanOrEqual(4);
  });

  it('names only trenches that exist, puts every placed group on the map, and gives its triggers sane values', () => {
    for (const side of [0, 1] as const) {
      for (const f of m.start[side].forces) {
        if (f.x !== undefined) expect(f.x > 0 && f.x < m.length, `${f.kind} of side ${side} on the map`).toBe(true);
        if (f.trenchId !== undefined) expect(m.trenches.some((t) => t.id === f.trenchId), `${side} garrison trench ${f.trenchId}`).toBe(true);
      }
    }
    for (const e of m.events) {
      if (e.type === 'wave') {
        for (const f of e.forces) {
          if (f.x !== undefined) expect(f.x > 0 && f.x < m.length).toBe(true);
          if (f.trenchId !== undefined) expect(m.trenches.some((t) => t.id === f.trenchId), `wave trench ${f.trenchId}`).toBe(true);
        }
      }
      if ('trenchId' in e.when) expect(m.trenches.some((t) => t.id === (e.when as { trenchId: number }).trenchId), 'the trigger names a trench').toBe(true);
      if ('trenchCapturedBy' in e.when) {
        const t = m.trenches.find((tr) => tr.id === (e.when as { trenchId: number }).trenchId);
        expect(t?.owner, 'only the other side\'s trenches can be captured').toBe(1 - e.when.trenchCapturedBy);
      }
      if ('hqHpBelow' in e.when) expect(e.when.hqHpBelow > 0 && e.when.hqHpBelow < 1).toBe(true);
      if ('every' in e.when) expect(e.when.every).toBeGreaterThan(0);
      if ('at' in e.when) expect(e.when.at).toBeGreaterThanOrEqual(0);
    }
  });

  it('lets each side train only trainable kinds (never the King Tiger), and plans with kinds it may train', () => {
    for (const side of [0, 1] as const) {
      const allowed = new Set(m.units[side]);
      const plan = side === 0 ? m.bot : m.ai;
      for (const step of plan.build) {
        expect(allowed.has(step.kind), `side ${side} plan step ${step.kind}`).toBe(true);
        expect(step.count).toBeGreaterThan(0);
        expect(step.after).toBeGreaterThanOrEqual(0);
      }
      for (const kind of m.units[side]) expect(UNITS[kind].trainable, kind).toBe(true);
      expect(m.units[side]).not.toContain('heavyTank');
    }
    expect(m.bot.build.length).toBeGreaterThan(0);
  });

  it('has hints the HUD can show, the first at once, one when the HQ is in trouble, and announces taken ground', () => {
    const list = hints(m);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const h of list) expect(h.text.length, h.text).toBeGreaterThan(20);
    // The first hint arrives at once and the player reads something within 20 seconds of the battle clock.
    const times = list.flatMap((h) => ('at' in h.when ? [h.when.at] : [])).sort((a, b) => a - b);
    expect(times[0]).toBeLessThanOrEqual(5);
    expect(times.some((s) => s <= 20)).toBe(true);
    for (const w of waves(m, 1)) if (w.announce !== undefined) expect(w.announce.length, w.announce).toBeGreaterThan(10);
    expect(m.events.some((e) => e.type === 'hint' && 'hqHpBelow' in e.when && e.when.side === 0), 'a hint when the HQ is in trouble').toBe(true);
    // Taking an enemy trench in an assault is acknowledged.
    if (m.mode === 'assault' && m.trenches.some((t) => t.owner === 1)) {
      expect(m.events.some((e) => e.type === 'announce' && 'trenchCapturedBy' in e.when && e.when.trenchCapturedBy === 0), 'taking ground is announced').toBe(true);
    }
  });

  it('has the right timer and enemy for its mode', () => {
    const prep = m.prep ? (m.prep.seconds ?? PREP.defaultSeconds) : 0;
    if (m.mode === 'survival') {
      expect(m.timer?.onExpire).toBe('win');
      expect(m.start[1].hasHq).toBe(false);
      expect(waves(m, 1).length).toBeGreaterThan(0);
      // The waves can reach the line before the clock runs out.
      for (const w of waves(m, 1)) {
        const at = 'at' in w.when ? w.when.at : 'from' in w.when ? w.when.from : 0;
        expect(at, 'waves start before the end').toBeLessThan((m.timer?.seconds ?? 0) + prep);
      }
    } else {
      expect(m.start[1].hasHq).toBe(true);
      expect(m.start[1].incomeMul).toBeGreaterThan(0);
      expect(m.ai.sappers).toBeGreaterThan(0);
      expect(m.ai.build.length).toBeGreaterThan(0);
      expect(m.ai.firstAttackAfter).toBeGreaterThan(0);
      if (m.timer) expect(m.timer.seconds).toBeGreaterThan(m.expectedMinutes[0] * 60);
    }
    expect(m.start[0].hasHq).toBe(true);
  });

  it('has a three-paragraph briefing and a one-line objective', () => {
    expect(m.briefing).toHaveLength(3);
    for (const p of m.briefing) {
      expect(p.length).toBeGreaterThan(100);
      expect(p.length).toBeLessThan(750);
    }
    expect(m.objective.length).toBeGreaterThan(20);
    expect(m.objective.length).toBeLessThan(90);
    expect(m.objective).not.toContain('\n');
    expect(m.title.length).toBeGreaterThan(3);
    expect(m.location.length).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// Scripted events in a real battle
// ---------------------------------------------------------------------------

interface Logged {
  type: SimEventType;
  time: number;
  text: string | null;
}

const LOGGED: readonly SimEventType[] = ['hint', 'announce', 'wave'];
/** Battle seconds before a run stops. */
const CAP_SECONDS = 45 * 60;

function play(m: MissionDef): Logged[] {
  const b = createBattle({ mission: m, difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['bot', 'ai'] });
  const log: Logged[] = [];
  const maxTicks = CAP_SECONDS * CONFIG.tickRate;
  while (!b.state.over && b.state.tick < maxTicks) {
    b.step();
    checkInvariants(b);
    const { items, count } = b.events;
    for (let i = 0; i < count; i++) {
      const e = items[i];
      if (LOGGED.includes(e.type)) log.push({ type: e.type, time: b.state.time, text: e.text });
    }
  }
  return log;
}

describe.each(MISSIONS.map((m) => [m.id, m] as const))('mission %i played by the bot on Normal', (_id, m) => {
  it('the scripted hints reach the player, and every wave and announcement comes from the mission data', HEAVY, () => {
    const log = play(m);
    const shown = log.filter((e) => e.type === 'hint');
    const scripted = hints(m).map((h) => h.text);
    expect(shown.length).toBeGreaterThanOrEqual(3);
    for (const h of shown) expect(scripted, `hint "${h.text}"`).toContain(h.text);
    // The opening hint comes early: within 30 battle seconds of the start (or of the end of any prep phase).
    expect(shown[0].time).toBeLessThanOrEqual(30 + (m.prep ? (m.prep.seconds ?? PREP.defaultSeconds) : 0));
    for (const e of log.filter((l) => l.type === 'announce' || l.type === 'wave')) {
      if (e.text !== null) expect(m.events.some((s) => ('announce' in s && s.announce === e.text) || ('text' in s && s.text === e.text)), `"${e.text}"`).toBe(true);
    }
  });
});
