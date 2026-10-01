/**
 * Missions 7 to 10 (Sword Beach, Hill 112, Arnhem Bridge, the Siegfried Line): the data is coherent
 * with the campaign specification (layout, unlock order, mode and timer, briefing, events, plans)
 * and each mission runs to an end, played by the reasonable-player bot and by the idle commander,
 * without breaking the sim's invariants. Exact win rates are tuned with tools/sim-cli.ts
 * (--mission N --p0 bot --p1 ai --seeds 40); here the bot must win at least one of three seeds and
 * the idle commander must lose every seed.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MISSIONS, getMission } from '../../src/data/missions';
import type { MissionDef, MissionEventDef, SupportKind, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { createBattle, summarize, type BattleResult, type CommanderKind } from '../../src/sim';
import { checkInvariants } from '../unit/sim-helpers';

interface Spec {
  key: string;
  theatre: MissionDef['theatre'];
  timeOfDay: MissionDef['timeOfDay'];
  mode: MissionDef['mode'];
  newUnit: UnitKind | null;
  newSupport: SupportKind | null;
  /** Allowed map length. */
  length: [number, number];
  /** The mission's expectedMinutes must lie inside this range. */
  minutes: [number, number];
  /** Where the pin must lie on the campaign map. */
  lon: [number, number];
  lat: [number, number];
}

const SPEC: Record<number, Spec> = {
  7: { key: 'sword', theatre: 'normandy', timeOfDay: 'dawn', mode: 'assault', newUnit: 'at', newSupport: null, length: [9500, 11500], minutes: [8, 11], lon: [-0.6, 0], lat: [49, 49.6] },
  8: { key: 'hill112', theatre: 'france', timeOfDay: 'day', mode: 'assault', newUnit: 'tank', newSupport: null, length: [10000, 12500], minutes: [8, 11], lon: [-0.8, -0.2], lat: [49, 49.3] },
  9: { key: 'arnhem', theatre: 'holland', timeOfDay: 'day', mode: 'survival', newUnit: null, newSupport: null, length: [6500, 9000], minutes: [6, 6.5], lon: [5.8, 6], lat: [51.9, 52.1] },
  10: { key: 'reichswald', theatre: 'germany', timeOfDay: 'overcast', mode: 'assault', newUnit: null, newSupport: 'airStrike', length: [13000, 14000], minutes: [12, 15], lon: [5.9, 6.3], lat: [51.6, 51.9] },
};

const IDS = [7, 8, 9, 10] as const;
const M = (id: number): MissionDef => getMission(id) as MissionDef;
const set = <T>(items: readonly T[]): Set<T> => new Set(items);
const missing = <T>(items: Iterable<T>, from: Set<T>): T[] => [...items].filter((item) => !from.has(item));

/** Every unit a mission places or spawns for one side, with where the group comes from. */
function groups(m: MissionDef, side: 0 | 1): { kind: UnitKind; where: string }[] {
  const out: { kind: UnitKind; where: string }[] = [];
  for (const f of m.start[side].forces) out.push({ kind: f.kind, where: `start force` });
  m.events.forEach((e, i) => {
    if (e.type === 'wave' && e.side === side) for (const f of e.forces) out.push({ kind: f.kind, where: `wave event ${i}` });
  });
  return out;
}

function waves(m: MissionDef, side: 0 | 1): Extract<MissionEventDef, { type: 'wave' }>[] {
  return m.events.filter((e): e is Extract<MissionEventDef, { type: 'wave' }> => e.type === 'wave' && e.side === side);
}

function hints(m: MissionDef): string[] {
  return m.events.flatMap((e) => (e.type === 'hint' ? [e.text] : []));
}

describe('missions 7 to 10: the data follows the campaign specification', () => {
  for (const id of IDS) {
    const spec = SPEC[id];
    describe(`mission ${id} ${spec.key}`, () => {
      const m = M(id);

      it('has its identity, theatre, mode, time of day, new unit and support', () => {
        expect(m.id).toBe(id);
        expect(m.key).toBe(spec.key);
        expect([m.theatre, m.timeOfDay, m.mode, m.newUnit, m.newSupport]).toEqual([spec.theatre, spec.timeOfDay, spec.mode, spec.newUnit, spec.newSupport]);
        expect(m.length).toBeGreaterThanOrEqual(spec.length[0]);
        expect(m.length).toBeLessThanOrEqual(spec.length[1]);
        expect(m.expectedMinutes[0]).toBeGreaterThanOrEqual(spec.minutes[0]);
        expect(m.expectedMinutes[1]).toBeLessThanOrEqual(spec.minutes[1] + 0.5);
        expect(m.mapPos.lon).toBeGreaterThanOrEqual(spec.lon[0]);
        expect(m.mapPos.lon).toBeLessThanOrEqual(spec.lon[1]);
        expect(m.mapPos.lat).toBeGreaterThanOrEqual(spec.lat[0]);
        expect(m.mapPos.lat).toBeLessThanOrEqual(spec.lat[1]);
        expect(m.title.length).toBeGreaterThan(3);
        expect(m.location.length).toBeGreaterThan(3);
        expect(m.date).toMatch(/19(44|45)/);
      });

      it('has a three-paragraph briefing and a one-line objective', () => {
        expect(m.briefing).toHaveLength(3);
        for (const paragraph of m.briefing) {
          expect(paragraph.length).toBeGreaterThan(250);
          expect(paragraph.length).toBeLessThan(700);
          expect(paragraph).not.toMatch(/\n/);
        }
        expect(m.objective.length).toBeGreaterThan(20);
        expect(m.objective.length).toBeLessThan(100);
      });

      it('keeps every structure inside the map, in order, and wire in front of a line', () => {
        const margin = 300;
        const inside = (x: number, width: number): boolean => x - width / 2 >= margin && x + width / 2 <= m.length - margin;
        for (const t of m.trenches) expect(inside(t.x, t.width), `trench ${t.id}`).toBe(true);
        for (const p of m.pillboxes) expect(inside(p.x, CONFIG.pillboxWidth), `pillbox ${p.id}`).toBe(true);
        for (const w of m.wire) expect(inside(w.x, w.width), `wire ${w.id}`).toBe(true);
        for (const list of [m.trenches, m.pillboxes, m.wire]) {
          expect(set(list.map((s) => s.id)).size, 'unique ids').toBe(list.length);
          const xs = list.map((s) => s.x);
          expect(xs, 'listed from the player side to the enemy side').toEqual([...xs].sort((a, b) => a - b));
        }
        for (const t of m.trenches) {
          expect(t.slots).toBeGreaterThanOrEqual(4);
          expect(t.slots * CONFIG.trenchSlotSpacing, `trench ${t.id} fits its slots`).toBeLessThanOrEqual(t.width + CONFIG.trenchSlotSpacing);
        }
        if (m.mode === 'assault') {
          const enemyTrenches = m.trenches.filter((t) => t.owner === 1);
          const ownTrenches = m.trenches.filter((t) => t.owner === 0);
          expect(ownTrenches.length).toBeGreaterThanOrEqual(1);
          const frontOwn = Math.max(...ownTrenches.map((t) => t.x));
          for (const t of enemyTrenches) expect(t.x, `enemy trench ${t.id} lies beyond the player's`).toBeGreaterThan(frontOwn + 1000);
          for (const p of m.pillboxes) expect(p.side, 'pillboxes are German').toBe(1);
          for (const w of m.wire) {
            expect(w.owner).toBe(1);
            const line = [...enemyTrenches.map((t) => t.x), ...m.pillboxes.map((p) => p.x)].filter((x) => x > w.x && x - w.x <= 800);
            expect(line.length, `wire ${w.id} has a German position within 800 wu behind it`).toBeGreaterThan(0);
          }
          const hqX = m.length - CONFIG.hqInset;
          for (const s of [...enemyTrenches, ...m.pillboxes]) expect(s.x, 'nothing stands on the German HQ').toBeLessThan(hqX - 1000);
        } else {
          for (const w of m.wire) {
            expect(w.owner, 'the player wires the approach').toBe(0);
            const trench = m.trenches.find((t) => t.owner === 0);
            expect(w.x - (trench?.x ?? 0)).toBeGreaterThan(0);
            expect(w.x - (trench?.x ?? 0)).toBeLessThan(800);
          }
          expect(m.pillboxes).toHaveLength(0);
        }
      });

      it('garrisons fit their trenches, and every referenced trench and position exists', () => {
        for (const side of [0, 1] as const) {
          const seated = new Map<number, number>();
          for (const f of m.start[side].forces) {
            if (f.trenchId !== undefined) {
              const t = m.trenches.find((tr) => tr.id === f.trenchId);
              expect(t, `${side} garrison trench ${f.trenchId}`).toBeDefined();
              expect(t?.owner, `trench ${f.trenchId} starts with its garrison's owner`).toBe(side);
              if (UNITS[f.kind].usesTrench) seated.set(f.trenchId, (seated.get(f.trenchId) ?? 0) + f.count);
            }
          }
          for (const [trenchId, count] of seated) {
            const t = m.trenches.find((tr) => tr.id === trenchId);
            expect(count, `trench ${trenchId} garrison`).toBeLessThanOrEqual(t?.slots ?? 0);
          }
        }
        for (const e of m.events) {
          if (e.type === 'wave') {
            for (const f of e.forces) {
              expect(f.trenchId, 'waves are placed by x, never into a trench').toBeUndefined();
              if (f.x !== undefined) expect(f.x > 0 && f.x < m.length).toBe(true);
            }
          }
          if ('trenchCapturedBy' in e.when) {
            const t = m.trenches.find((tr) => tr.id === (e.when as { trenchId: number }).trenchId);
            expect(t, 'capture trigger names a trench').toBeDefined();
            expect(t?.owner, 'only enemy trenches can be captured by the player').toBe(1 - e.when.trenchCapturedBy);
          }
          if ('hqHpBelow' in e.when) expect(e.when.hqHpBelow > 0 && e.when.hqHpBelow < 1).toBe(true);
          if ('every' in e.when) expect(e.when.every).toBeGreaterThan(0);
          if ('at' in e.when) expect(e.when.at).toBeGreaterThanOrEqual(0);
        }
      });

      it('uses only units its side may train (the King Tiger aside), and plans with trainable units', () => {
        for (const side of [0, 1] as const) {
          const allowed = set(m.units[side]);
          for (const g of groups(m, side)) {
            if (g.kind === 'heavyTank') continue;
            expect(allowed.has(g.kind), `side ${side} ${g.kind} in ${g.where}`).toBe(true);
          }
          const plan = side === 0 ? m.bot : m.ai;
          for (const step of plan.build) {
            expect(allowed.has(step.kind), `side ${side} plan step ${step.kind}`).toBe(true);
            expect(step.count).toBeGreaterThan(0);
            expect(step.after).toBeGreaterThanOrEqual(0);
          }
          for (const kind of m.units[side]) expect(UNITS[kind].trainable, kind).toBe(true);
        }
        for (const side of [0, 1] as const) {
          for (const kind of m.units[side]) expect(kind).not.toBe('heavyTank');
        }
      });

      it('follows the campaign unlock order of units and supports', () => {
        const mine = set(m.units[0]);
        if (id === 9) {
          expect(mine.has('sapper')).toBe(false);
          expect(mine.has('tank')).toBe(false);
          const prev = set(M(8).units[0]);
          expect(missing(mine, prev), 'nothing new in mission 9').toEqual([]);
          expect(missing(prev, mine).sort()).toEqual(['sapper', 'tank']);
          expect(set(m.supports[0])).toEqual(set(M(8).supports[0]));
        } else {
          const prev = set(M(id === 10 ? 8 : id - 1).units[0]);
          expect(missing(prev, mine), 'earlier units are kept').toEqual([]);
          expect(missing(mine, prev), 'only the new unit is added').toEqual(spec.newUnit ? [spec.newUnit] : []);
          const prevSupports = set(M(id === 10 ? 8 : id - 1).supports[0]);
          expect(missing(m.supports[0], prevSupports)).toEqual(spec.newSupport ? [spec.newSupport] : []);
          expect(missing(prevSupports, set(m.supports[0]))).toEqual([]);
        }
        if (spec.newUnit) expect(mine.has(spec.newUnit)).toBe(true);
        if (spec.newSupport) expect(m.supports[0]).toContain(spec.newSupport);
        // The Germans have met the campaign's earlier units by now and share the basic roster.
        for (const kind of ['rifle', 'lmg', 'assault', 'mortar', 'at'] as UnitKind[]) expect(m.units[1]).toContain(kind);
      });

      it('has hints that teach what is new and a hint when the HQ is in trouble', () => {
        const text = hints(m).join(' ');
        expect(hints(m).length).toBeGreaterThanOrEqual(3);
        for (const h of hints(m)) {
          expect(h.length).toBeGreaterThan(20);
          expect(h.length).toBeLessThanOrEqual(150);
        }
        for (const e of m.events) {
          if (e.type === 'announce') expect(e.text.length).toBeLessThanOrEqual(80);
          if (e.type === 'wave' && e.announce) expect(e.announce.length).toBeLessThanOrEqual(80);
        }
        const teaches: Record<number, string> = { 7: 'PIAT', 8: 'Churchill', 9: 'airdrop', 10: 'Typhoon' };
        expect(text).toContain(teaches[id]);
        expect(m.briefing.join(' ')).toContain(id === 9 ? 'RAF' : teaches[id]);
        expect(m.events.some((e) => e.type === 'hint' && 'hqHpBelow' in e.when && e.when.side === 0)).toBe(true);
      });

      it('has the right timer for its mode', () => {
        if (m.mode === 'survival') {
          expect(m.timer).toEqual({ seconds: 360, onExpire: 'win', label: expect.any(String) });
          expect(m.start[1].hasHq).toBe(false);
          expect(m.ai.build).toHaveLength(0);
          expect(m.ai.sappers).toBe(0);
          expect(waves(m, 1).length).toBeGreaterThan(0);
          // The last Panzers must be able to reach the trench before the clock runs out.
          for (const w of waves(m, 1)) {
            const at = 'at' in w.when ? w.when.at : 'from' in w.when ? w.when.from : 0;
            expect(at, 'waves start before the end').toBeLessThan(m.timer?.seconds ?? 0);
          }
        } else {
          expect(m.timer).toBeNull();
          expect(m.start[1].hasHq).toBe(true);
          expect(m.start[1].incomeMul).toBeGreaterThan(0);
          expect(m.ai.sappers).toBeGreaterThan(0);
          expect(m.ai.build.length).toBeGreaterThan(0);
          expect(m.ai.firstAttackAfter).toBeGreaterThan(0);
        }
        expect(m.start[0].hasHq).toBe(true);
        expect(m.bot.build.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('missions 7 to 10: what makes each one itself', () => {
  it('mission 7: a weak beachhead under a row of pillboxes, and panzers once the sea wall falls', () => {
    const m = M(7);
    expect(m.start[0].hqHpMul).toBeLessThan(1);
    expect(m.start[0].incomeMul).toBeLessThan(1);
    expect(m.start[0].incomeMul).toBeLessThan(M(8).start[0].incomeMul);
    const beach = m.pillboxes.filter((p) => p.x < 3500);
    expect(beach.length).toBeGreaterThanOrEqual(4);
    expect(m.pillboxes.length).toBeGreaterThanOrEqual(beach.length + 1);
    const panzers = waves(m, 1).filter((w) => w.forces.some((f) => f.kind === 'tank'));
    expect(panzers.length).toBeGreaterThan(0);
    for (const w of panzers) {
      const late = 'trenchCapturedBy' in w.when || ('at' in w.when && w.when.at >= 300);
      expect(late, 'the counter-attack comes late').toBe(true);
      expect(w.forces.every((f) => f.behaviour === 'assault')).toBe(true);
    }
    expect(m.bot.build.some((s) => s.kind === 'at' && s.count >= 4)).toBe(true);
    expect(M(6).units[0]).not.toContain('at');
  });

  it('mission 8: open ground, no pillboxes, and armour on both sides', () => {
    const m = M(8);
    expect(m.pillboxes).toHaveLength(0);
    expect(m.units[0]).toContain('tank');
    expect(m.units[1]).toContain('tank');
    expect(M(7).units[0]).not.toContain('tank');
    expect(m.start[1].forces.some((f) => f.kind === 'tank')).toBe(true);
    expect(m.start[0].forces.some((f) => f.kind === 'tank')).toBe(true);
    expect(waves(m, 1).some((w) => w.forces.some((f) => f.kind === 'tank'))).toBe(true);
    expect(m.ai.build.some((s) => s.kind === 'tank')).toBe(true);
    expect(m.bot.build.some((s) => s.kind === 'tank')).toBe(true);
    expect(m.start[0].supplies).toBeGreaterThanOrEqual(UNITS.tank.cost);
  });

  it('mission 9: airdrops only, no sappers, no tanks for the player, armour against it, six minutes', () => {
    const m = M(9);
    expect(m.start[0].incomeMul).toBe(0);
    expect(m.start[0].sappers).toBe(0);
    expect(m.bot.sappers).toBe(0);
    const drops = m.events.filter((e) => e.type === 'airdrop');
    expect(drops.length).toBeGreaterThan(0);
    for (const d of drops) {
      expect(d.type === 'airdrop' && d.side).toBe(0);
      expect(d.type === 'airdrop' && d.supplies).toBeGreaterThan(0);
      expect('every' in d.when, 'periodic').toBe(true);
    }
    const tanks = waves(m, 1).reduce((n, w) => n + w.forces.filter((f) => f.kind === 'tank').reduce((s, f) => s + f.count, 0), 0);
    expect(tanks).toBeGreaterThanOrEqual(4);
    expect(m.units[1]).toContain('tank');
    expect(m.start[0].forces.filter((f) => f.kind === 'at').length).toBeGreaterThan(0);
    const b = createBattle({ mission: m, difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['human', 'ai'] });
    expect(b.state.sides[0].available.sapper).toBe(false);
    expect(b.state.sides[0].available.tank).toBe(false);
    expect(b.state.sides[1].hq).toBeNull();
  });

  it('mission 10: four German belts, many pillboxes, supports for both sides and a King Tiger on guard', () => {
    const m = M(10);
    expect(m.trenches.filter((t) => t.owner === 1)).toHaveLength(4);
    expect(m.pillboxes.length).toBeGreaterThanOrEqual(8);
    expect(m.wire.length).toBeGreaterThanOrEqual(4);
    expect(m.length).toBe(Math.max(...MISSIONS.map((x) => x.length)));
    expect(m.supports[0]).toContain('airStrike');
    expect(M(9).supports[0]).not.toContain('airStrike');
    expect(m.supports[1]).toEqual(expect.arrayContaining(['artillery', 'smoke']));
    expect(m.units[1].length).toBe(m.units[0].length);
    const tiger = m.start[1].forces.find((f) => f.kind === 'heavyTank');
    expect(tiger?.behaviour).toBe('guard');
    expect(tiger?.count).toBe(1);
    expect(tiger?.x).toBeGreaterThan(Math.max(...m.trenches.map((t) => t.x)));
    expect(tiger?.x).toBeLessThan(m.length - CONFIG.hqInset - 400);
    for (const id of [7, 8, 9]) expect(M(id).start[1].forces.some((f) => f.kind === 'heavyTank')).toBe(false);
    const captures = m.events.filter((e) => e.type === 'announce' && 'trenchCapturedBy' in e.when).length;
    expect(captures).toBeGreaterThanOrEqual(4);
  });
});

describe('missions 7 to 10 end without breaking invariants (bot and idle, Normal)', () => {
  /** Battle seconds before a run counts as never ending. */
  const CAP_SECONDS = 45 * 60;
  const BOT_SEEDS = [1, 2, 3];
  const IDLE_SEEDS = [1, 2];

  function play(mission: MissionDef, p0: CommanderKind, seed: number): BattleResult {
    const b = createBattle({ mission, difficulty: 'normal', seed, upgrades: {}, commanders: [p0, 'ai'] });
    const maxTicks = CAP_SECONDS * CONFIG.tickRate;
    while (!b.state.over && b.state.tick < maxTicks) {
      b.step();
      checkInvariants(b);
    }
    return summarize(b);
  }

  for (const id of IDS) {
    it(`mission ${id}: the bot wins at least one of ${BOT_SEEDS.length} seeds in about the intended time`, () => {
      const m = M(id);
      const results = BOT_SEEDS.map((seed) => play(m, 'bot', seed));
      for (const r of results) {
        expect(r.timedOut, `mission ${id} bot`).toBe(false);
        expect(r.endReason).not.toBe('none');
      }
      const wins = results.filter((r) => r.winner === 0);
      expect(wins.length, `mission ${id} bot wins ${results.map((r) => `${r.winner === 0 ? 'W' : 'L'}@${(r.seconds / 60).toFixed(1)}`).join(' ')}`).toBeGreaterThanOrEqual(1);
      for (const r of wins) {
        expect(r.seconds / 60).toBeGreaterThanOrEqual(m.expectedMinutes[0] * 0.5);
        expect(r.seconds / 60).toBeLessThanOrEqual(m.expectedMinutes[1] * 2.2);
        if (m.mode === 'survival') expect(r.endReason).toBe('timerSurvived');
        else expect(r.endReason).toBe('hqDestroyed');
      }
    });

    it(`mission ${id}: the idle commander loses every seed`, () => {
      const m = M(id);
      for (const seed of IDLE_SEEDS) {
        const r = play(m, 'idle', seed);
        expect(r.timedOut, `mission ${id} idle`).toBe(false);
        expect(r.winner, `mission ${id} idle seed ${seed}`).toBe(1);
        expect(r.endReason).toBe('hqDestroyed');
        if (m.mode === 'survival') expect(r.seconds).toBeLessThan((m.timer?.seconds ?? 0) - 30);
      }
    });
  }
});
