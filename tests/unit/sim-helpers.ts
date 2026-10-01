/**
 * Shared helpers of the sim-*.test.ts files (not a test file itself): build small
 * hand-made missions, step battles, and read events and units without holding on
 * to pooled objects.
 */
import { CONFIG } from '../../src/data/config';
import { M01 } from '../../src/data/missions/m01';
import type { Difficulty, MissionDef, SideStart, UnitKind, UpgradeDef, UpgradeLevels } from '../../src/data/schema';
import {
  createBattle,
  type Battle,
  type BattleConfig,
  type CommanderKind,
  type SimEvent,
  type SimEventType,
  type UnitState,
} from '../../src/sim';

/** Seconds per tick. */
export const DT = 1 / CONFIG.tickRate;

export type MissionOverrides = Partial<Omit<MissionDef, 'start'>> & {
  /** Overrides for side 0 and side 1 on top of an empty, symmetric start (no supplies, sappers or forces). */
  a?: Partial<SideStart>;
  b?: Partial<SideStart>;
};

/**
 * A mission for one test: mission 1's rules and data on an empty field. Both sides begin with
 * an HQ, no supplies, no sappers, no forces, full-strength HQs and normal income, and no
 * scripted events, so a test only adds what it needs.
 */
export function testMission(over: MissionOverrides = {}): MissionDef {
  const { a, b, ...rest } = over;
  const blank = (faction: SideStart['faction'], extra?: Partial<SideStart>): SideStart => ({
    faction,
    hasHq: true,
    supplies: 0,
    hqHpMul: 1,
    incomeMul: 1,
    sappers: 0,
    forces: [],
    ...extra,
  });
  return { ...M01, events: [], ...rest, start: [blank('british', a), blank('german', b)] };
}

/** The same mission with side 1 given side 0's start, so a battle between two identical commanders is fair. */
export function mirrored(mission: MissionDef): MissionDef {
  return { ...mission, start: [mission.start[0], { ...mission.start[0], faction: mission.start[1].faction }] };
}

export interface BattleOptions {
  mission?: MissionDef;
  seed?: number;
  difficulty?: Difficulty;
  /** Default: nobody commands either side inside the sim; the test sends the commands. */
  commanders?: [CommanderKind, CommanderKind];
  upgrades?: UpgradeLevels;
  upgradeDefs?: readonly UpgradeDef[];
}

export function configOf(opts: BattleOptions = {}): BattleConfig {
  return {
    mission: opts.mission ?? testMission(),
    difficulty: opts.difficulty ?? 'normal',
    seed: opts.seed ?? 1,
    upgrades: opts.upgrades ?? {},
    commanders: opts.commanders ?? ['human', 'human'],
    upgradeDefs: opts.upgradeDefs,
  };
}

export function makeBattle(opts: BattleOptions = {}): Battle {
  return createBattle(configOf(opts));
}

/** A copy of an event with the battle time it was emitted at. */
export interface Seen extends SimEvent {
  time: number;
}

export function seen(b: Battle, e: SimEvent): Seen {
  return { ...e, time: b.state.time };
}

/** Copies of this step's events of one type. */
export function eventsOf(b: Battle, type: SimEventType): Seen[] {
  const out: Seen[] = [];
  const { items, count } = b.events;
  for (let i = 0; i < count; i++) {
    if (items[i].type === type) out.push(seen(b, items[i]));
  }
  return out;
}

/** Step `seconds` of battle time (rounded to whole ticks), calling `each` after every step. Stops early if the battle ends. */
export function run(b: Battle, seconds: number, each?: (b: Battle) => void): void {
  const ticks = Math.round(seconds * CONFIG.tickRate);
  for (let i = 0; i < ticks && !b.state.over; i++) {
    b.step();
    if (each) each(b);
  }
}

/** Step until `done` is true or `maxSeconds` pass. Returns whether `done` became true. */
export function runUntil(b: Battle, maxSeconds: number, done: (b: Battle) => boolean): boolean {
  const ticks = Math.round(maxSeconds * CONFIG.tickRate);
  for (let i = 0; i < ticks && !b.state.over; i++) {
    b.step();
    if (done(b)) return true;
  }
  return false;
}

/** Run and return copies of every event of the given types (all types if none are given), in order. */
export function collect(b: Battle, seconds: number, ...types: SimEventType[]): Seen[] {
  const out: Seen[] = [];
  run(b, seconds, () => {
    const { items, count } = b.events;
    for (let i = 0; i < count; i++) {
      if (types.length === 0 || types.includes(items[i].type)) out.push(seen(b, items[i]));
    }
  });
  return out;
}

/** Living units of a side (optionally of one kind), in pool order. */
export function unitsOf(b: Battle, side: 0 | 1, kind?: UnitKind): UnitState[] {
  const out: UnitState[] = [];
  const s = b.state;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (u.alive && u.side === side && (kind === undefined || u.kind === kind)) out.push(u);
  }
  return out;
}

export function countAlive(b: Battle): number {
  const s = b.state;
  let n = 0;
  for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive) n++;
  return n;
}

/** Everything that decides the future of a battle, as a string, for comparing two runs. */
export function snapshot(b: Battle): string {
  const s = b.state;
  const units: unknown[] = [];
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    units.push([u.id, u.kind, u.side, u.x, u.prevX, u.hp, u.action, u.actionTime, u.carrying, u.inside, u.aimX, u.weaponCharge]);
  }
  const sides = s.sides.map((side) => [
    side.supplies,
    side.pop,
    side.order,
    side.queue,
    side.progress,
    side.stats,
    side.hq ? [side.hq.hp, side.hq.garrison, side.hq.gun.cooldown] : null,
  ]);
  return JSON.stringify([s.tick, s.over, s.winner, s.endReason, sides, units]);
}

/** Throws a readable error if the state contains a NaN or infinite number where it must not. */
export function assertFinite(b: Battle): void {
  const s = b.state;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (!Number.isFinite(u.x) || !Number.isFinite(u.prevX) || !Number.isFinite(u.hp) || !Number.isFinite(u.velX)) {
      throw new Error(`non-finite unit ${u.id} ${u.kind} at tick ${s.tick}: x=${u.x} hp=${u.hp} velX=${u.velX}`);
    }
    if (!Number.isFinite(u.aimX) || !Number.isFinite(u.weaponCharge) || !Number.isFinite(u.actionTime)) {
      throw new Error(`non-finite view field on unit ${u.id} at tick ${s.tick}`);
    }
  }
  for (const side of s.sides) {
    if (!Number.isFinite(side.supplies) || !Number.isFinite(side.income)) {
      throw new Error(`non-finite supplies at tick ${s.tick}`);
    }
    if (side.hq && !Number.isFinite(side.hq.hp)) throw new Error(`non-finite HQ health at tick ${s.tick}`);
  }
}
