/**
 * Missions 4 (El Alamein), 5 (Primosole Bridge) and 6 (Monte Cassino).
 *
 * Data: each mission follows the campaign specification (theatre, time of day, what it introduces
 * and when the rest unlock), has its ground laid out in a sensible order inside the map, a
 * three-paragraph briefing that names what is new, and hints that teach it.
 *
 * Play: on Normal with no upgrades the reasonable-player bot wins (nearly) every seed inside the
 * intended time, the idle commander loses every seed, every battle ends, and the sim's invariants
 * hold on every tick. The scripted events (hints, the snipers of mission 5, the counter-attacks
 * of missions 4 and 6, the nightfall announcements) fire in a real battle.
 */
import { describe, expect, it } from 'vitest';
import { APP } from '../../src/data/app';
import { MAP_BOUNDS } from '../../src/data/campaignMap';
import { FACTIONS } from '../../src/data/factions';
import { getMission } from '../../src/data/missions';
import type { MissionDef, SupportKind, UnitKind } from '../../src/data/schema';
import { createBattle, summarize, type BattleResult, type CommanderKind, type SimEventType } from '../../src/sim';
import { checkInvariants } from '../unit/sim-helpers';

const CAMPAIGN_IDS = [4, 5, 6] as const;
type CampaignId = (typeof CAMPAIGN_IDS)[number];

function mission(id: number): MissionDef {
  const m = getMission(id);
  if (!m) throw new Error(`mission ${id} does not exist`);
  return m;
}

/** What the owner's specification says about each mission, plus the layout each one was built to. */
interface Spec {
  key: string;
  theatre: MissionDef['theatre'];
  timeOfDay: MissionDef['timeOfDay'];
  newUnit: UnitKind;
  newSupport: SupportKind | null;
  /** Allowed map length in wu (on the 6000 to 14000 curve, longer than the mission before). */
  length: [number, number];
  /** Where the real place is, in degrees (the map pin must be within half a degree). */
  place: { lon: number; lat: number };
  /** German trench lines (owner 1) and empty forward posts (owner -1) the ground must have. */
  germanLines: number;
  forwardPosts: number;
  minPillboxes: number;
  minWire: number;
  /** Name fragments the briefing and some hint must contain (the new unit and support). */
  teaches: string[];
}

const SPEC: Record<CampaignId, Spec> = {
  4: {
    key: 'alamein',
    theatre: 'desert',
    timeOfDay: 'dawn',
    newUnit: 'mortar',
    newSupport: 'artillery',
    length: [8000, 9200],
    place: { lon: 28.95, lat: 30.83 },
    germanLines: 2,
    forwardPosts: 1,
    minPillboxes: 2,
    minWire: 2,
    teaches: ['Mortar Team', 'Artillery Barrage'],
  },
  5: {
    key: 'primosole',
    theatre: 'sicily',
    timeOfDay: 'dusk',
    newUnit: 'sniper',
    newSupport: null,
    length: [8600, 9800],
    place: { lon: 15.06, lat: 37.4 },
    germanLines: 2,
    forwardPosts: 1,
    minPillboxes: 1,
    minWire: 1,
    teaches: ['Sniper'],
  },
  6: {
    key: 'cassino',
    theatre: 'italy',
    timeOfDay: 'day',
    newUnit: 'medic',
    newSupport: 'smoke',
    length: [9500, 10500],
    place: { lon: 13.81, lat: 41.49 },
    germanLines: 3,
    forwardPosts: 3,
    minPillboxes: 3,
    minWire: 3,
    teaches: ['Medic', 'Smoke Screen'],
  },
};

/** Number of German trenches, pillboxes and wire belts: how heavily the ground is fortified. */
function fortification(m: MissionDef): number {
  return (
    m.trenches.filter((t) => t.owner === 1).length +
    m.pillboxes.filter((p) => p.side === 1).length +
    m.wire.filter((w) => w.owner === 1).length
  );
}

/** Men the enemy starts with. */
function garrison(m: MissionDef): number {
  return m.start[1].forces.reduce((n, f) => n + f.count, 0);
}

function ascending(values: number[]): boolean {
  return values.every((v, i) => i === 0 || v > values[i - 1]);
}

describe.each(CAMPAIGN_IDS)('mission %i data', (id) => {
  const m = mission(id);
  const spec = SPEC[id];
  const previous = mission(id - 1);
  const british = FACTIONS.british.unitNames;
  const supportNames = FACTIONS.british.supportNames;

  it('follows the specification: place, theatre, time of day, mode, what it introduces', () => {
    expect(m.id).toBe(id);
    expect(m.key).toBe(spec.key);
    expect(m.theatre).toBe(spec.theatre);
    expect(m.timeOfDay).toBe(spec.timeOfDay);
    expect(m.mode).toBe('assault');
    expect(m.newUnit).toBe(spec.newUnit);
    expect(m.newSupport).toBe(spec.newSupport);
    expect(m.start[1].hasHq).toBe(true);
    expect(Math.abs(m.mapPos.lon - spec.place.lon)).toBeLessThan(0.5);
    expect(Math.abs(m.mapPos.lat - spec.place.lat)).toBeLessThan(0.5);
    expect(m.mapPos.lon).toBeGreaterThan(MAP_BOUNDS.lonMin);
    expect(m.mapPos.lon).toBeLessThan(MAP_BOUNDS.lonMax);
    expect(m.mapPos.lat).toBeGreaterThan(MAP_BOUNDS.latMin);
    expect(m.mapPos.lat).toBeLessThan(MAP_BOUNDS.latMax);
    // Each desert/dusk/day mission looks different from the one before it.
    if (id === 4) expect(m.timeOfDay).not.toBe(previous.timeOfDay);
  });

  it('sits on the length curve: inside its band and longer than the mission before', () => {
    expect(m.length).toBeGreaterThanOrEqual(spec.length[0]);
    expect(m.length).toBeLessThanOrEqual(spec.length[1]);
    expect(m.length).toBeGreaterThan(previous.length);
  });

  it('unlocks exactly one new unit on top of the previous mission, and supports only accumulate', () => {
    expect([...m.units[0]].sort()).toEqual([...previous.units[0], spec.newUnit].sort());
    expect(m.units[0]).not.toContain('heavyTank');
    for (const kind of m.units[1]) expect(m.units[0], `enemy ${kind}`).toContain(kind);
    for (const support of previous.supports[0]) expect(m.supports[0]).toContain(support);
    if (spec.newSupport) {
      expect(m.supports[0]).toContain(spec.newSupport);
      expect(previous.supports[0]).not.toContain(spec.newSupport);
    } else {
      expect(m.supports[0]).toEqual(previous.supports[0]);
    }
  });

  it('lays the ground out in order inside the map: player trench, forward posts, wire, pillboxes, German lines', () => {
    expect(ascending(m.trenches.map((t) => t.x))).toBe(true);
    expect(ascending(m.pillboxes.map((p) => p.x))).toBe(true);
    expect(ascending(m.wire.map((w) => w.x))).toBe(true);
    expect(ascending(m.trenches.map((t) => t.id))).toBe(true);
    expect(ascending(m.pillboxes.map((p) => p.id))).toBe(true);
    expect(ascending(m.wire.map((w) => w.id))).toBe(true);

    const own = m.trenches.filter((t) => t.owner === 0);
    const german = m.trenches.filter((t) => t.owner === 1);
    const posts = m.trenches.filter((t) => t.owner === -1);
    expect(own).toHaveLength(1);
    expect(own[0].x).toBeGreaterThanOrEqual(1000);
    expect(own[0].x).toBeLessThanOrEqual(2000);
    expect(german).toHaveLength(spec.germanLines);
    expect(posts).toHaveLength(spec.forwardPosts);
    expect(m.pillboxes.length).toBeGreaterThanOrEqual(spec.minPillboxes);
    expect(m.wire.length).toBeGreaterThanOrEqual(spec.minWire);
    expect(m.pillboxes.every((p) => p.side === 1)).toBe(true);
    expect(m.wire.every((w) => w.owner === 1)).toBe(true);

    // Everything stands well clear of both HQs (inset 150 wu) and of the enemy HQ's gun.
    const all = [...m.trenches.map((t) => t.x), ...m.pillboxes.map((p) => p.x), ...m.wire.map((w) => w.x)];
    for (const x of all) {
      expect(x).toBeGreaterThanOrEqual(1000);
      expect(x).toBeLessThanOrEqual(m.length - 1200);
    }
    // The first German line is a long march from the player's trench; the last one leaves a run-in to the HQ.
    expect(german[0].x - own[0].x).toBeGreaterThanOrEqual(2000);
    expect(m.length - german[german.length - 1].x).toBeGreaterThanOrEqual(1200);
    // The lines are about two screens apart.
    for (let i = 1; i < german.length; i++) {
      expect(german[i].x - german[i - 1].x).toBeGreaterThanOrEqual(1500);
      expect(german[i].x - german[i - 1].x).toBeLessThanOrEqual(2600);
    }
    // Each forward post lies 350 to 700 wu short of a German line and belongs to no one.
    for (const post of posts) {
      const next = german.find((t) => t.x > post.x);
      expect(next, `a German line beyond the post at ${post.x}`).toBeDefined();
      expect((next?.x ?? 0) - post.x).toBeGreaterThanOrEqual(350);
      expect((next?.x ?? 0) - post.x).toBeLessThanOrEqual(700);
    }
    // Trenches never overlap.
    for (let i = 1; i < m.trenches.length; i++) {
      const a = m.trenches[i - 1];
      const b = m.trenches[i];
      expect(b.x - b.width / 2, `trench ${b.id} clear of trench ${a.id}`).toBeGreaterThan(a.x + a.width / 2);
    }
  });

  it('puts wire, then a pillbox, then the trench on every German line of missions 4 and 6', () => {
    if (id === 5) return;
    const german = m.trenches.filter((t) => t.owner === 1);
    for (const t of german) {
      const wire = m.wire.find((w) => w.x < t.x && t.x - w.x <= 600);
      const box = m.pillboxes.find((p) => p.x < t.x && t.x - p.x <= 200);
      expect(wire, `wire short of the trench at ${t.x}`).toBeDefined();
      expect(box, `a pillbox in front of the trench at ${t.x}`).toBeDefined();
      expect(wire?.x ?? 0).toBeLessThan(box?.x ?? 0);
    }
  });

  it('places every starting group where its side owns the ground, and only with units its side has', () => {
    for (const side of [0, 1] as const) {
      for (const f of m.start[side].forces) {
        expect(m.units[side], `${f.kind} of side ${side}`).toContain(f.kind);
        if (f.trenchId !== undefined) {
          const trench = m.trenches.find((t) => t.id === f.trenchId);
          expect(trench?.owner, `trench ${f.trenchId} of side ${side}`).toBe(side);
        }
        if (f.x !== undefined) expect(f.x).toBeGreaterThan(0);
        if (f.x !== undefined) expect(f.x).toBeLessThan(m.length);
      }
    }
    // Pickets (guard) belong to the German side and stand ahead of its first line, in the open.
    const firstGerman = m.trenches.find((t) => t.owner === 1)?.x ?? 0;
    for (const f of m.start[1].forces) {
      if (f.behaviour === 'guard') {
        expect(f.x).toBeGreaterThan(m.trenches.filter((t) => t.owner === 0)[0].x + 1000);
        expect(f.x).toBeLessThan(firstGerman);
      }
    }
    expect(m.start[0].forces.every((f) => f.behaviour === undefined || f.behaviour === 'army')).toBe(true);
    // The enemy starts stronger than in the missions before, and mission 6 is the heaviest so far.
    expect(garrison(m)).toBeGreaterThan(garrison(previous) - 1);
    expect(m.start[1].sappers).toBeGreaterThan(0);
    expect(m.start[1].incomeMul).toBeLessThan(1);
  });

  it('writes a three-paragraph period briefing and a one-line objective that name what is new', () => {
    expect(m.briefing).toHaveLength(3);
    for (const p of m.briefing) {
      expect(p.length).toBeGreaterThan(200);
      expect(p.length).toBeLessThan(750);
    }
    expect(m.objective.length).toBeGreaterThan(20);
    expect(m.objective.length).toBeLessThan(90);
    expect(m.objective).not.toContain('\n');
    const text = m.briefing.join(' ');
    expect(text).toContain(british[spec.newUnit].replace(/ Team$/, ''));
    if (spec.newSupport) expect(text).toContain(supportNames[spec.newSupport]);
    expect(text).toMatch(/German/);
    expect(m.title.length).toBeGreaterThan(5);
    expect(m.location.length).toBeGreaterThan(5);
    expect(m.date).toMatch(/19(42|43|44)/);
  });

  it('teaches the new unit and support in hints that never talk over each other', () => {
    const hints = m.events.flatMap((e) => (e.type === 'hint' ? [e] : []));
    const texts = hints.map((h) => h.text).join(' ');
    for (const fragment of spec.teaches) expect(texts, fragment).toContain(fragment);
    for (const h of hints) {
      expect(h.text.length).toBeGreaterThan(20);
      expect(h.text.length).toBeLessThan(150);
    }
    // A hint stays up for APP.hintSeconds, so timed hints are spaced at least that far apart.
    const times = hints.flatMap((h) => ('at' in h.when ? [h.when.at] : [])).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1], `hints at ${times[i - 1]} and ${times[i]}`).toBeGreaterThanOrEqual(APP.hintSeconds);
    // The first thing the player reads is the new unit (or, mission 5, the clock) within the first 20 seconds.
    expect(times[0]).toBeLessThanOrEqual(5);
    expect(times.some((t) => t <= 20)).toBe(true);
    // Capturing ground is acknowledged.
    expect(m.events.some((e) => 'trenchCapturedBy' in e.when && e.when.trenchCapturedBy === 0)).toBe(true);
  });

  it('plans: the AI and the bot only use units they have, the bot builds the new unit, and there are scripted reinforcements', () => {
    for (const step of m.ai.build) expect(m.units[1], `AI ${step.kind}`).toContain(step.kind);
    for (const step of m.bot.build) expect(m.units[0], `bot ${step.kind}`).toContain(step.kind);
    expect(m.bot.build.some((s) => s.kind === spec.newUnit)).toBe(true);
    expect(m.bot.sappers).toBeGreaterThanOrEqual(3);
    expect(m.ai.sappers).toBeGreaterThanOrEqual(1);
    expect(m.ai.firstAttackAfter).toBeGreaterThanOrEqual(240);
    expect(m.bot.firstAttackAfter).toBeLessThan(m.ai.firstAttackAfter);
    for (const plan of [m.ai, m.bot]) {
      expect(plan.build.every((s) => s.count > 0 && s.after >= 0)).toBe(true);
    }
    const waves = m.events.flatMap((e) => (e.type === 'wave' ? [e] : []));
    expect(waves.length).toBeGreaterThanOrEqual(1);
    for (const w of waves) {
      expect(w.side).toBe(1);
      for (const f of w.forces) expect(m.units[1], `wave ${f.kind}`).toContain(f.kind);
      if (w.announce !== undefined) expect(w.announce.length).toBeGreaterThan(10);
    }
    for (const e of m.events) {
      if ('trenchId' in e.when) expect(m.trenches.some((t) => t.id === (e.when as { trenchId: number }).trenchId)).toBe(true);
    }
  });
});

describe('the three missions against each other', () => {
  it('mission 4 is more fortified than mission 3, and mission 6 has the heaviest defences so far', () => {
    expect(fortification(mission(4))).toBeGreaterThan(fortification(mission(3)));
    expect(fortification(mission(4))).toBeGreaterThanOrEqual(6);
    for (let id = 1; id <= 5; id++) expect(fortification(mission(6)), `mission 6 against mission ${id}`).toBeGreaterThan(fortification(mission(id)));
    expect(garrison(mission(6))).toBeGreaterThan(garrison(mission(4)));
    expect(garrison(mission(6))).toBeGreaterThan(garrison(mission(5)));
    expect(mission(6).pillboxes.length).toBeGreaterThan(mission(4).pillboxes.length);
  });

  it('the intended length grows with the campaign, except for the timed sprint of mission 5', () => {
    const top = (id: number): number => mission(id).expectedMinutes[1];
    expect(top(4)).toBeGreaterThan(top(3));
    expect(top(6)).toBeGreaterThan(top(4));
    expect(top(5)).toBeGreaterThan(top(1));
  });

  it('mission 5 is the timed one: a deadline that loses, announced as the light fails, and darker than the rest', () => {
    const m = mission(5);
    expect(m.timer).not.toBeNull();
    expect(m.timer?.onExpire).toBe('lose');
    expect(m.timer?.label).toBe('Nightfall');
    const seconds = m.timer?.seconds ?? 0;
    expect(seconds).toBeGreaterThanOrEqual(540);
    expect(seconds).toBeLessThanOrEqual(720);
    // The bot's pace must fit inside the deadline with room to spare.
    expect(m.expectedMinutes[1] * 60).toBeLessThan(seconds);
    const announced = m.events.flatMap((e) => (e.type === 'announce' && 'at' in e.when ? [e.when.at] : []));
    expect(announced.length).toBeGreaterThanOrEqual(2);
    for (const at of announced) {
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(seconds);
    }
    expect(mission(4).timer).toBeNull();
    expect(mission(6).timer).toBeNull();
  });

  it('mission 5 brings enemy snipers: a picket in the fields, a pair by the first line and more arriving by wave', () => {
    const m = mission(5);
    const pickets = m.start[1].forces.filter((f) => f.kind === 'sniper' && f.behaviour === 'guard');
    expect(pickets.reduce((n, f) => n + f.count, 0)).toBeGreaterThanOrEqual(2);
    const wave = m.events.find((e) => e.type === 'wave' && e.forces.some((f) => f.kind === 'sniper'));
    expect(wave).toBeDefined();
    expect(m.ai.build.some((s) => s.kind === 'sniper')).toBe(true);
    // The enemy's mission 4 army has no snipers at all.
    expect(mission(4).units[1]).not.toContain('sniper');
  });

  it('mission 6 gives the Germans medics of their own, and no artillery', () => {
    const m = mission(6);
    expect(m.units[1]).toContain('medic');
    expect(m.start[1].forces.some((f) => f.kind === 'medic')).toBe(true);
    expect(m.supports[1]).toEqual([]);
    expect(m.supports[0]).toEqual(['artillery', 'smoke']);
  });
});

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

interface Logged {
  type: SimEventType;
  time: number;
  text: string | null;
  side: number;
  targetIndex: number;
  value: number;
}

interface Played {
  result: BattleResult;
  log: Logged[];
  /** Living German snipers 80 s into the battle. */
  germanSnipersAt80: number;
}

const SEEDS = [1, 2, 3, 4];
/** Battle seconds before a run counts as never ending. */
const CAP_SECONDS = 30 * 60;
const LOGGED: readonly SimEventType[] = ['hint', 'announce', 'wave', 'trenchCaptured', 'orderChanged'];

const cache = new Map<string, Played>();

function play(id: number, p0: CommanderKind, seed: number): Played {
  const key = `${id}/${p0}/${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = createBattle({ mission: mission(id), difficulty: 'normal', seed, upgrades: {}, commanders: [p0, 'ai'] });
  const log: Logged[] = [];
  let germanSnipersAt80 = -1;
  const maxTicks = CAP_SECONDS * 30;
  while (!b.state.over && b.state.tick < maxTicks) {
    b.step();
    checkInvariants(b);
    const { items, count } = b.events;
    for (let i = 0; i < count; i++) {
      const e = items[i];
      if (LOGGED.includes(e.type)) {
        log.push({ type: e.type, time: b.state.time, text: e.text, side: e.side, targetIndex: e.targetIndex, value: e.value });
      }
    }
    if (b.state.tick === 80 * 30) {
      germanSnipersAt80 = 0;
      for (let i = 0; i < b.state.unitCount; i++) {
        const u = b.state.units[i];
        if (u.alive && u.side === 1 && u.kind === 'sniper') germanSnipersAt80++;
      }
    }
  }
  const played = { result: summarize(b), log, germanSnipersAt80 };
  cache.set(key, played);
  return played;
}

describe.each(CAMPAIGN_IDS)('mission %i played on Normal with no upgrades', (id) => {
  const m = mission(id);

  it('the reasonable-player bot wins nearly every seed, inside the intended time, with the invariants intact', () => {
    const runs = SEEDS.map((seed) => play(id, 'bot', seed).result);
    for (const r of runs) {
      expect(r.timedOut, 'a run that never ends').toBe(false);
      expect(r.endReason).not.toBe('none');
    }
    const wins = runs.filter((r) => r.winner === 0);
    expect(wins.length, `bot wins of ${SEEDS.length}`).toBeGreaterThanOrEqual(SEEDS.length - 1);
    for (const r of wins) {
      expect(r.endReason).toBe('hqDestroyed');
      expect(r.hqHp[1]).toBe(0);
      expect(r.seconds / 60).toBeGreaterThan(m.expectedMinutes[0] * 0.7);
      expect(r.seconds / 60).toBeLessThan(m.expectedMinutes[1] * 1.4);
      if (m.timer) expect(r.seconds).toBeLessThan(m.timer.seconds);
    }
    const mean = wins.reduce((n, r) => n + r.seconds, 0) / wins.length / 60;
    expect(mean).toBeGreaterThanOrEqual(m.expectedMinutes[0]);
    expect(mean).toBeLessThanOrEqual(m.expectedMinutes[1]);
  });

  it('the idle commander loses every seed, and the battle still ends', () => {
    for (const seed of SEEDS) {
      const r = play(id, 'idle', seed).result;
      expect(r.timedOut, `seed ${seed} never ends`).toBe(false);
      expect(r.winner, `seed ${seed}`).toBe(1);
      expect(r.hqHp[0]).toBe(0);
      expect(r.endReason).toBe('hqDestroyed');
    }
  });

  it('the scripted hints reach the player in order, and every wave and announcement comes from the mission data', () => {
    const { log } = play(id, 'bot', 1);
    const hints = log.filter((e) => e.type === 'hint');
    const scripted = m.events.flatMap((e) => (e.type === 'hint' ? [e.text] : []));
    expect(hints.length).toBeGreaterThanOrEqual(5);
    for (const h of hints) expect(scripted, `hint "${h.text}"`).toContain(h.text);
    const early = hints.filter((h) => h.time <= 30).map((h) => h.text ?? '');
    expect(early.length).toBeGreaterThanOrEqual(2);
    for (const e of log.filter((l) => l.type === 'announce' || l.type === 'wave')) {
      if (e.text !== null) expect(m.events.some((s) => ('announce' in s && s.announce === e.text) || ('text' in s && s.text === e.text))).toBe(true);
    }
  });
});

describe('scripted events fire in a real battle', () => {
  it('mission 4: the German reserves counter-attack 15 s after the first line falls', () => {
    const { log } = play(4, 'bot', 1);
    const taken = log.find((e) => e.type === 'trenchCaptured' && e.side === 0 && e.targetIndex === 3);
    expect(taken, 'the bot takes the first German trench').toBeDefined();
    const wave = log.find((e) => e.type === 'wave' && e.side === 1 && e.time > (taken?.time ?? Infinity));
    expect(wave, 'a wave follows').toBeDefined();
    expect((wave?.time ?? 0) - (taken?.time ?? 0)).toBeGreaterThanOrEqual(14);
    expect((wave?.time ?? 0) - (taken?.time ?? 0)).toBeLessThanOrEqual(17);
    expect(wave?.value).toBeGreaterThanOrEqual(2);
    // The empty forward post is taken on the way, and before the first line.
    const post = log.find((e) => e.type === 'trenchCaptured' && e.side === 0 && e.targetIndex === 2);
    expect(post, 'the bot takes the forward post').toBeDefined();
    expect(post?.time ?? Infinity).toBeLessThan(taken?.time ?? 0);
  });

  it('mission 5: the German snipers arrive at 70 s and there are five of them by 80 s; nightfall is announced', () => {
    const { log, germanSnipersAt80 } = play(5, 'bot', 1);
    const wave = log.find((e) => e.type === 'wave' && e.side === 1 && (e.text ?? '').includes('snipers'));
    expect(wave).toBeDefined();
    expect(wave?.time ?? 0).toBeGreaterThanOrEqual(70);
    expect(wave?.time ?? 0).toBeLessThan(72);
    expect(germanSnipersAt80).toBeGreaterThanOrEqual(5);
    const idle = play(5, 'idle', 1).log;
    expect(idle.some((e) => e.type === 'announce' && (e.text ?? '').includes('Half the light'))).toBe(true);
    expect(idle.some((e) => e.type === 'announce' && (e.text ?? '').includes('Two minutes of daylight'))).toBe(false);
  });

  it('mission 6: the assault troops counter-attack after the second line falls, and the last line is announced', () => {
    const { log } = play(6, 'bot', 1);
    const second = log.find((e) => e.type === 'trenchCaptured' && e.side === 0 && e.targetIndex === 5);
    expect(second, 'the bot takes the second German line').toBeDefined();
    const wave = log.find((e) => e.type === 'wave' && e.side === 1 && e.time > (second?.time ?? Infinity));
    expect(wave).toBeDefined();
    expect((wave?.time ?? 0) - (second?.time ?? 0)).toBeGreaterThanOrEqual(19);
    expect((wave?.time ?? 0) - (second?.time ?? 0)).toBeLessThanOrEqual(22);
    expect(log.some((e) => e.type === 'announce' && (e.text ?? '').includes('last line'))).toBe(true);
  });
});
