import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { getMission, MISSIONS } from '../../src/data/missions';
import type { MissionDef, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import {
  createBattle,
  runBattle,
  SIM_FEATURES,
  type Battle,
  type CommanderKind,
  type SimEvent,
} from '../../src/sim';
import {
  checkInvariants,
  collect,
  configOf,
  countAlive,
  makeBattle,
  mirrored,
  run,
  snapshot,
  testMission,
  unitsOf,
} from './sim-helpers';

const MISSION_1 = getMission(1) as MissionDef;
const KINDS = Object.keys(UNITS) as UnitKind[];

function runChecked(b: Battle, seconds: number): void {
  run(b, seconds, checkInvariants);
}

describe('invariants during full battles', () => {
  const cases: [string, CommanderKind, CommanderKind, boolean][] = [
    ['bot vs ai', 'bot', 'ai', false],
    ['ai vs ai, mirrored', 'ai', 'ai', true],
    ['idle vs ai', 'idle', 'ai', false],
    ['bot vs bot, mirrored', 'bot', 'bot', true],
  ];
  for (const [name, p0, p1, mirror] of cases) {
    it(`holds for ${name}`, () => {
      for (const seed of [1, 2, 3]) {
        const mission = mirror ? mirrored(MISSION_1) : MISSION_1;
        const b = makeBattle({ mission, seed, commanders: [p0, p1] });
        runChecked(b, 900);
      }
    });
  }

  it('holds on a crowded field with every unit kind and every Phase 2 structure and command', () => {
    const everyone = KINDS.filter((kind) => kind !== 'sapper' && kind !== 'heavyTank');
    const side = {
      supplies: 3000,
      sappers: 3,
      // 28 population in all, so the side starts under the cap of 40.
      forces: everyone.map((kind) => ({ kind, count: kind === 'tank' ? 1 : 2 })),
    };
    const mission = testMission({
      length: 6000,
      units: [KINDS.filter((k) => UNITS[k].trainable), KINDS.filter((k) => UNITS[k].trainable)],
      supports: [['artillery', 'smoke', 'airStrike'], ['artillery', 'smoke', 'airStrike']],
      trenches: [
        { id: 1, x: 1500, width: 120, slots: 6, owner: 0 },
        { id: 2, x: 3000, width: 120, slots: 6, owner: -1 },
        { id: 3, x: 4500, width: 120, slots: 6, owner: 1 },
      ],
      pillboxes: [
        { id: 1, x: 1700, side: 0, hpMul: 1 },
        { id: 2, x: 4300, side: 1, hpMul: 1 },
      ],
      wire: [
        { id: 1, x: 2800, width: 80, owner: 0 },
        { id: 2, x: 3300, width: 80, owner: 1 },
      ],
      a: side,
      b: { ...side, forces: [...side.forces, { kind: 'heavyTank' as const, count: 1, x: 5200, behaviour: 'guard' as const }] },
      events: [
        { type: 'airdrop', when: { at: 60 }, side: 0, supplies: 100 },
        { type: 'announce', when: { at: 30 }, text: 'Hello' },
        { type: 'hint', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'Captured' },
      ],
    });
    const b = makeBattle({ mission, commanders: ['ai', 'ai'], seed: 7 });
    const orders = ['advance', 'hold', 'fallBack', 'hold'] as const;
    let n = 0;
    run(b, 300, () => {
      checkInvariants(b);
      if (b.state.tick % 150 === 0) {
        b.command(0, { type: 'order', order: orders[n++ % orders.length] });
        // Phase 2 commands must be accepted without effect or error until they are implemented.
        b.command(0, { type: 'support', kind: 'artillery', x: 3000 });
        b.command(1, { type: 'support', kind: 'smoke', x: 2000 });
        b.command(0, { type: 'control', unit: unitsOf(b, 0, 'rifle')[0]?.id ?? -1 });
        b.command(0, { type: 'controlInput', moveX: 1, fire: true, ability: true });
        b.command(0, { type: 'control', unit: -1 });
      }
    });
    const s = b.state;
    expect(countAlive(b)).toBeGreaterThan(0);
    if (!SIM_FEATURES.trenches) {
      expect(s.trenches.map((t) => t.owner)).toEqual([0, -1, 1]);
      expect(s.trenches.every((t) => t.occupants === 0)).toBe(true);
      expect(unitsOf(b, 0).concat(unitsOf(b, 1)).every((u) => u.trenchId === -1)).toBe(true);
    }
    if (!SIM_FEATURES.wire) expect(s.wires.every((w) => w.alive && w.hp === CONFIG.wireHp)).toBe(true);
    if (!SIM_FEATURES.projectiles) {
      expect(s.projectiles.every((p) => !p.alive)).toBe(true);
      expect(s.smokes.every((smoke) => !smoke.alive)).toBe(true);
    }
    if (!SIM_FEATURES.supports) {
      expect(s.sides[0].supportCooldown).toEqual({ artillery: 0, smoke: 0, airStrike: 0 });
    }
    if (!SIM_FEATURES.directControl) {
      expect(s.sides[0].controlled).toBe(-1);
      expect(unitsOf(b, 0).every((u) => !u.controlled)).toBe(true);
    }
  });

  it('copes with a full unit pool: scripted units are dropped, trained units wait', () => {
    const mission = testMission({
      b: { hasHq: false },
      a: { supplies: 500 },
      events: [
        { type: 'wave', when: { at: 0 }, side: 1, forces: [{ kind: 'sapper', count: CONFIG.maxUnits + 40, x: 3000 }] },
      ],
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'train', kind: 'rifle' });
    runChecked(b, UNITS.rifle.trainTime + 5);
    expect(countAlive(b)).toBe(CONFIG.maxUnits);
    expect(b.state.sides[0].queue.rifle).toBe(1);
    expect(b.state.sides[0].alive.rifle).toBe(0);
  });

  it('keeps the event buffer to what one step emits', () => {
    const b = makeBattle({ mission: MISSION_1, commanders: ['bot', 'ai'] });
    // The starting forces announce themselves before the first step.
    const first: SimEvent[] = b.events.items.slice(0, b.events.count);
    expect(first.filter((e) => e.type === 'unitSpawned')).toHaveLength(
      MISSION_1.start.reduce((n, s) => n + s.sappers + s.forces.reduce((m, f) => m + f.count, 0), 0),
    );
    let most = 0;
    run(b, 200, () => {
      most = Math.max(most, b.events.count);
    });
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(CONFIG.maxEvents);
  });

  it('clears the event buffer at the start of every step', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 100 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    expect(b.events.count).toBe(1);
    expect(b.events.items[0].type).toBe('trainStarted');
    b.step();
    expect(b.events.count).toBe(0);
  });
});

describe('determinism', () => {
  const play = (seed: number, commanders: [CommanderKind, CommanderKind], seconds: number) => {
    const b = makeBattle({ mission: mirrored(MISSION_1), seed, commanders });
    const log: string[] = [];
    run(b, seconds, () => {
      const { items, count } = b.events;
      for (let i = 0; i < count; i++) {
        const e = items[i];
        log.push(`${e.type}:${e.side}:${e.unitId}:${e.x.toFixed(4)}:${e.value.toFixed(4)}:${e.hit ? 1 : 0}`);
      }
    });
    return { snap: snapshot(b), log: log.join('|') };
  };

  it('gives an identical battle, bit for bit, from the same seed', () => {
    const a = play(11, ['ai', 'ai'], 420);
    const b = play(11, ['ai', 'ai'], 420);
    expect(a.log.length).toBeGreaterThan(1000);
    expect(b.snap).toBe(a.snap);
    expect(b.log).toBe(a.log);
  });

  it('gives different battles from different seeds', () => {
    const snaps = new Set<string>();
    for (let seed = 1; seed <= 5; seed++) snaps.add(play(seed, ['ai', 'ai'], 420).snap);
    expect(snaps.size).toBe(5);
  });

  it('replays the same command stream to the same result', () => {
    const script = (seed: number, advanceAt: number) => {
      const mission = testMission({ a: { supplies: 400, sappers: 2 }, b: { forces: [{ kind: 'rifle', count: 3 }] } });
      const b = makeBattle({ mission, seed });
      run(b, 120, () => {
        const t = b.state.tick;
        if (t % 200 === 1) b.command(0, { type: 'train', kind: 'rifle' });
        if (t === advanceAt) b.command(0, { type: 'order', order: 'advance' });
        if (t === 1800) b.command(0, { type: 'order', order: 'fallBack' });
        if (t === 2600) b.command(1, { type: 'order', order: 'advance' });
      });
      return snapshot(b);
    };
    expect(script(4, 900)).toBe(script(4, 900));
    // A different command, or the same commands a tick later, is a different battle.
    expect(script(4, 900)).not.toBe(script(4, 901));
    expect(script(4, 900)).not.toBe(script(4, 1500));
  });

  it('is not disturbed by reading the state or the events', () => {
    const plain = makeBattle({ mission: MISSION_1, seed: 9, commanders: ['bot', 'ai'] });
    const watched = makeBattle({ mission: MISSION_1, seed: 9, commanders: ['bot', 'ai'] });
    run(plain, 150);
    run(watched, 150, () => {
      JSON.stringify(watched.state.sides);
      JSON.stringify(watched.events.items.slice(0, watched.events.count));
    });
    expect(snapshot(watched)).toBe(snapshot(plain));
  });
});

describe('side symmetry', () => {
  it('lets mirrored AI commanders win about as often from either side', () => {
    const seeds = 48;
    const wins = [0, 0];
    for (let seed = 1; seed <= seeds; seed++) {
      const result = runBattle(configOf({ mission: mirrored(MISSION_1), seed, commanders: ['ai', 'ai'] }), 3600);
      if (result.winner === 0 || result.winner === 1) wins[result.winner]++;
    }
    const decided = wins[0] + wins[1];
    expect(decided).toBeGreaterThanOrEqual(seeds * 0.5);
    const share = wins[0] / decided;
    expect(share).toBeGreaterThanOrEqual(0.35);
    expect(share).toBeLessThanOrEqual(0.65);
  });

  it('gives the two sides identical economies', () => {
    const b = makeBattle({ mission: mirrored(MISSION_1), commanders: ['ai', 'ai'] });
    run(b, 60);
    const [s0, s1] = b.state.sides;
    expect(s1.stats.trained).toBe(s0.stats.trained);
    expect(s1.stats.suppliesSpent).toBe(s0.stats.suppliesSpent);
    expect(s1.pop).toBe(s0.pop);
    expect(Math.abs(s1.supplies - s0.supplies)).toBeLessThan(1e-6);
    // Positions mirror: the same walk from the other end (to within a tick of rounding noise).
    const ascending = (a: number, c: number): number => a - c;
    const mine = unitsOf(b, 0).map((u) => u.x).sort(ascending);
    const theirs = unitsOf(b, 1).map((u) => b.state.length - u.x).sort(ascending);
    expect(theirs).toHaveLength(mine.length);
    for (let i = 0; i < mine.length; i++) expect(Math.abs(theirs[i] - mine[i])).toBeLessThan(1e-6);
  });
});

describe('mission 1 and the commanders', () => {
  it('is won by the reasonable-player bot on Normal in three to five minutes', () => {
    const times: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const r = runBattle(configOf({ mission: MISSION_1, seed, commanders: ['bot', 'ai'] }), 900);
      expect(r.timedOut).toBe(false);
      expect(r.winner).toBe(0);
      expect(r.endReason).toBe('hqDestroyed');
      times.push(r.seconds);
    }
    const mean = times.reduce((a, t) => a + t, 0) / times.length;
    expect(Math.min(...times)).toBeGreaterThanOrEqual(150);
    expect(Math.max(...times)).toBeLessThanOrEqual(330);
    expect(mean).toBeGreaterThanOrEqual(3 * 60 - 20);
    expect(mean).toBeLessThanOrEqual(5 * 60);
    const [lo, hi] = MISSION_1.expectedMinutes;
    expect(mean / 60).toBeGreaterThanOrEqual(lo - 0.34);
    expect(mean / 60).toBeLessThanOrEqual(hi);
  });

  it('is lost by an idle player', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const b = makeBattle({ mission: MISSION_1, seed, commanders: ['idle', 'ai'] });
      run(b, 1200);
      expect(b.state.over).toBe(true);
      expect(b.state.winner).toBe(1);
      expect(b.state.sides[0].stats.trained).toBe(0);
      expect(b.state.sides[0].order).toBe('hold');
    }
  });

  it('never has an idle commander issue anything, and lets a human side do nothing by itself', () => {
    const b = makeBattle({ mission: MISSION_1, commanders: ['idle', 'human'] });
    const changed = collect(b, 120, 'orderChanged', 'trainStarted');
    expect(changed).toHaveLength(0);
    expect(b.state.sides[0].supplies).toBeGreaterThan(MISSION_1.start[0].supplies);
  });

  it('fields exactly the units and forces the briefing promises', () => {
    expect(MISSIONS).toContain(MISSION_1);
    expect(MISSION_1.units[0]).toEqual(['sapper', 'rifle']);
    expect(MISSION_1.units[1]).toEqual(['sapper', 'rifle']);
    expect(MISSION_1.trenches).toHaveLength(0);
    expect(MISSION_1.pillboxes).toHaveLength(0);
    expect(MISSION_1.length).toBe(6000);
    expect(getMission(999)).toBeUndefined();
    const b = makeBattle({ mission: MISSION_1 });
    expect(b.state.sides[0].available).toMatchObject({ sapper: true, rifle: true, lmg: false, tank: false });
  });
});

describe('scripted events', () => {
  it('fires mission 1 hints at their times and the HQ warning once', () => {
    const b = makeBattle({ mission: MISSION_1 });
    const hints = collect(b, 80, 'hint');
    const timed = MISSION_1.events.filter((e) => e.type === 'hint' && 'at' in e.when);
    expect(timed.length).toBeGreaterThanOrEqual(3);
    expect(hints).toHaveLength(timed.length);
    timed.forEach((e, i) => {
      const at = 'at' in e.when ? e.when.at : -1;
      expect(hints[i].time).toBeGreaterThanOrEqual(at);
      expect(hints[i].time).toBeLessThan(at + 0.1);
      expect(hints[i].text).toBe(e.type === 'hint' ? e.text : null);
    });

    const hurt = makeBattle({
      mission: testMission({
        length: 3000,
        a: { hqHpMul: 0.05 },
        b: { forces: [{ kind: 'rifle', count: 3, x: 450 }] },
        events: [{ type: 'hint', when: { hqHpBelow: 0.5, side: 0 }, text: 'HQ hit' }],
      }),
    });
    hurt.command(1, { type: 'order', order: 'advance' });
    const warnings = collect(hurt, 20, 'hint');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].text).toBe('HQ hit');
  });

  it('repeats an event on its interval and drops supplies and waves where they belong', () => {
    const mission = testMission({
      length: 4000,
      b: { hasHq: false },
      events: [
        { type: 'airdrop', when: { every: 10, from: 5, until: 25 }, side: 0, supplies: 40 },
        { type: 'wave', when: { at: 3 }, side: 1, forces: [{ kind: 'rifle', count: 4 }], announce: 'They come' },
        { type: 'announce', when: { at: 1 }, text: 'Stand to' },
      ],
    });
    const b = makeBattle({ mission });
    const events = collect(b, 30, 'airdrop', 'wave', 'announce');
    const drops = events.filter((e) => e.type === 'airdrop');
    expect(drops.map((e) => Math.round(e.time))).toEqual([5, 15, 25]);
    for (const d of drops) {
      expect(d.side).toBe(0);
      expect(d.value).toBe(40);
      expect(d.x).toBeCloseTo(b.state.sides[0].hq?.doorX ?? -1, 6);
    }
    expect(b.state.sides[0].supplies).toBeCloseTo(120 + CONFIG.hqIncomePerSec * 30, 5);
    expect(b.state.sides[0].stats.suppliesGathered).toBeCloseTo(120 + CONFIG.hqIncomePerSec * 30, 5);

    const wave = events.find((e) => e.type === 'wave');
    expect(wave?.side).toBe(1);
    expect(wave?.value).toBe(4);
    expect(wave?.text).toBe('They come');
    expect(events.find((e) => e.type === 'announce')?.text).toBe('Stand to');
    // A side with no HQ spawns its waves at its own map edge.
    for (const u of unitsOf(b, 1, 'rifle')) expect(u.x).toBeGreaterThan(b.state.length - 400);
  });

  it('scales waves for an AI side by the difficulty, and not for anyone else', () => {
    const mission = testMission({
      b: { hasHq: false },
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 4 }] }],
    });
    const size = (difficulty: 'normal' | 'insane', commander: CommanderKind): number => {
      const b = makeBattle({ mission, difficulty, commanders: ['human', commander] });
      return collect(b, 2, 'wave')[0].value;
    };
    expect(size('normal', 'ai')).toBe(4);
    expect(size('insane', 'ai')).toBe(Math.round(4 * DIFFICULTIES.insane.aiAggression));
    expect(size('insane', 'human')).toBe(4);
  });

  it('makes assault waves advance whatever the order', () => {
    const mission = testMission({
      length: 4000,
      b: { hasHq: false },
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 3, behaviour: 'assault' }] }],
    });
    const b = makeBattle({ mission });
    run(b, 12);
    for (const u of unitsOf(b, 1, 'rifle')) {
      expect(u.behaviour).toBe('assault');
      expect(u.x).toBeLessThan(b.state.length - CONFIG.mapMargin - 100);
      expect(u.velX).toBeLessThan(0);
    }
  });
});

describe('performance', () => {
  /** Forty troops a side (80 units) in a fight, commanded by the AI so training, orders and shooting all run. */
  function crowd(seed: number): Battle {
    const side = { forces: [{ kind: 'rifle' as const, count: 36 }, { kind: 'lmg' as const, count: 2 }], sappers: 2, supplies: 600 };
    return createBattle(
      configOf({ mission: testMission({ length: 3000, a: side, b: side }), commanders: ['ai', 'ai'], seed }),
    );
  }

  /** Play whole battles so the JIT has seen every code path (a real session plays many). */
  function warmUp(): void {
    for (const seed of [11, 12, 13]) {
      const b = crowd(seed);
      while (!b.state.over && b.state.tick < 12_000) b.step();
    }
  }

  it('steps 80 units in well under a millisecond', () => {
    warmUp();
    const b = crowd(3);
    expect(countAlive(b)).toBeGreaterThanOrEqual(80);
    run(b, 5);
    let units = 0;
    let steps = 0;
    const t0 = performance.now();
    run(b, 20, () => {
      steps++;
      units += countAlive(b);
    });
    const perStep = (performance.now() - t0) / steps;
    expect(units / steps).toBeGreaterThan(30);
    expect(perStep).toBeLessThan(0.5);
  });

  it('does not allocate in the steady state', () => {
    warmUp(); // JIT, event buffer and command queue reach their working size
    const b = crowd(3);
    const heap = (): number => process.memoryUsage().heapUsed;
    const before = heap();
    const steps = 3000; // marching, first contact and a big fight
    for (let i = 0; i < steps; i++) b.step();
    const grown = heap() - before;
    expect(countAlive(b)).toBeGreaterThan(20);
    // Under 100 bytes a step on average. A single small object per unit per step would be 8 KB a step.
    expect(grown).toBeLessThan(steps * 100);
  });
});
