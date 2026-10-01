/**
 * Shared helpers of the sim-*.test.ts files (not a test file itself): build small
 * hand-made missions, step battles, and read events and units without holding on
 * to pooled objects.
 */
import { CONFIG } from '../../src/data/config';
import { M01 } from '../../src/data/missions/m01';
import type { Difficulty, MissionDef, SideStart, UnitKind, UpgradeDef, UpgradeLevels } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
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
    units.push([u.id, u.kind, u.side, u.x, u.prevX, u.hp, u.action, u.actionTime, u.carrying, u.inside, u.aimX, u.weaponCharge, u.trenchId]);
  }
  const structures = [
    s.trenches.map((t) => [t.owner, t.occupants, t.capturedAt]),
    s.pillboxes.map((p) => [p.hp, p.alive, p.gun.cooldown]),
    s.wires.map((w) => [w.hp, w.alive]),
    s.projectiles.filter((p) => p.alive).map((p) => [p.id, p.x, p.toX, p.age]),
  ];
  const sides = s.sides.map((side) => [
    side.supplies,
    side.pop,
    side.order,
    side.queue,
    side.progress,
    side.stats,
    side.hq ? [side.hq.hp, side.hq.garrison, side.hq.gun.cooldown] : null,
  ]);
  return JSON.stringify([s.tick, s.over, s.winner, s.endReason, sides, units, structures]);
}

const KINDS = Object.keys(UNITS) as UnitKind[];

/**
 * Everything a battle must satisfy on every single tick (units, sides, structures, trenches,
 * projectiles and smoke). Throws with the tick number on the first breach.
 */
export function checkInvariants(b: Battle): void {
  const s = b.state;
  const where = `tick ${s.tick}`;
  assertFinite(b);

  const alive = [0, 0];
  const byKind = [{} as Record<string, number>, {} as Record<string, number>];
  const inside = [0, 0];
  const popOfLiving = [0, 0];
  let rightmost0 = -Infinity;
  let leftmost1 = Infinity;
  for (let i = 0; i < s.units.length; i++) {
    const u = s.units[i];
    if (i >= s.unitCount) {
      if (u.alive) throw new Error(`${where}: unit ${u.id} alive above unitCount`);
      continue;
    }
    if (!u.alive) continue;
    alive[u.side]++;
    byKind[u.side][u.kind] = (byKind[u.side][u.kind] ?? 0) + 1;
    popOfLiving[u.side] += u.def.pop;
    if (u.hp <= 0 || u.hp > u.maxHp + 1e-9) throw new Error(`${where}: unit ${u.id} ${u.kind} hp ${u.hp}/${u.maxHp}`);
    if (u.x < 0 || u.x > s.length) throw new Error(`${where}: unit ${u.id} ${u.kind} off the map at ${u.x}`);
    if (u.prevX < 0 || u.prevX > s.length) throw new Error(`${where}: unit ${u.id} prevX off the map`);
    if (u.row < 0 || u.row >= CONFIG.rows) throw new Error(`${where}: unit ${u.id} row ${u.row}`);
    if (u.facing !== 1 && u.facing !== -1) throw new Error(`${where}: unit ${u.id} facing ${u.facing}`);
    if (u.weaponCharge < 0 || u.weaponCharge > 1) throw new Error(`${where}: unit ${u.id} charge ${u.weaponCharge}`);
    if (u.carrying < 0) throw new Error(`${where}: unit ${u.id} carrying ${u.carrying}`);
    if (u.inside !== (u.action === 'inside')) throw new Error(`${where}: unit ${u.id} inside/action mismatch`);
    if (u.trenchId >= 0 && (u.inside || !u.def.usesTrench)) throw new Error(`${where}: unit ${u.id} ${u.kind} in trench ${u.trenchId}`);
    if (u.inside) {
      inside[u.side]++;
    } else if (u.side === 0) {
      rightmost0 = Math.max(rightmost0, u.x);
    } else {
      leftmost1 = Math.min(leftmost1, u.x);
    }
  }
  // The two lines never pass through each other.
  if (rightmost0 >= leftmost1) throw new Error(`${where}: the lines crossed (${rightmost0} vs ${leftmost1})`);

  for (let si = 0; si < 2; si++) {
    const side = s.sides[si];
    if (side.supplies < -1e-9) throw new Error(`${where}: side ${si} supplies ${side.supplies}`);
    // Training respects the cap; scripted units may exceed it: a side with no HQ is all scripted, and a
    // side whose mission scripts waves for it (counter-attacks, reinforcements) can be pushed over.
    const scripted = !side.hasHq || b.config.mission.events.some((e) => e.type === 'wave' && e.side === si);
    if (!scripted && side.pop > side.popCap) throw new Error(`${where}: side ${si} population ${side.pop} over the cap`);
    let queued = 0;
    for (const kind of KINDS) {
      queued += side.queue[kind] * UNITS[kind].pop;
      if ((byKind[si][kind] ?? 0) !== side.alive[kind]) throw new Error(`${where}: side ${si} alive.${kind} is wrong`);
      if (side.queue[kind] < 0 || side.queue[kind] > CONFIG.maxQueue) throw new Error(`${where}: queue.${kind}`);
      if (side.progress[kind] < 0 || side.progress[kind] > 1 + 1e-9) throw new Error(`${where}: progress.${kind}`);
    }
    if (Math.abs(side.pop - (popOfLiving[si] + queued)) > 1e-9) {
      throw new Error(`${where}: side ${si} pop ${side.pop} != living ${popOfLiving[si]} + queued ${queued}`);
    }
    if (side.hq) {
      if (side.hq.hp < 0 || side.hq.hp > side.hq.maxHp) throw new Error(`${where}: HQ ${si} hp ${side.hq.hp}`);
      if (side.hq.garrison !== inside[si]) throw new Error(`${where}: HQ ${si} garrison ${side.hq.garrison} vs ${inside[si]}`);
    }
  }

  for (const t of s.trenches) {
    let occupants = 0;
    for (let i = 0; i < s.unitCount; i++) {
      const u = s.units[i];
      if (!u.alive || u.trenchId !== t.id) continue;
      occupants++;
      if (u.side !== t.owner) throw new Error(`${where}: side ${u.side} unit ${u.id} sits in trench ${t.id} owned by ${t.owner}`);
      if (Math.abs(u.x - t.x) > t.width / 2 + 1e-9) throw new Error(`${where}: unit ${u.id} in trench ${t.id} stands outside it`);
    }
    if (occupants !== t.occupants) throw new Error(`${where}: trench ${t.id} occupants ${t.occupants} vs ${occupants}`);
    if (occupants > t.slots) throw new Error(`${where}: trench ${t.id} over-full`);
    if (t.owner !== -1 && t.owner !== 0 && t.owner !== 1) throw new Error(`${where}: trench ${t.id} owner ${t.owner}`);
  }
  for (const p of s.pillboxes) {
    if (!Number.isFinite(p.hp) || p.hp < 0 || p.hp > p.maxHp) throw new Error(`${where}: pillbox ${p.id} hp ${p.hp}`);
    if (p.alive !== p.hp > 0) throw new Error(`${where}: pillbox ${p.id} alive ${p.alive} at hp ${p.hp}`);
  }
  for (const wire of s.wires) {
    if (!Number.isFinite(wire.hp) || wire.hp > CONFIG.wireHp) throw new Error(`${where}: wire ${wire.id} hp ${wire.hp}`);
    if (wire.alive && wire.hp <= 0) throw new Error(`${where}: wire ${wire.id} alive at hp ${wire.hp}`);
  }
  for (const p of s.projectiles) {
    if (!p.alive) continue;
    if (!Number.isFinite(p.x) || p.x < 0 || p.x > s.length || p.toX < 0 || p.toX > s.length) {
      throw new Error(`${where}: projectile ${p.id} at ${p.x} -> ${p.toX}`);
    }
    if (!(p.flightTime > 0) || p.age < 0 || p.age > p.flightTime) throw new Error(`${where}: projectile ${p.id} age ${p.age}/${p.flightTime}`);
  }
  const smokes = s.smokes.filter((smoke) => smoke.alive).length;
  if (smokes !== (b as unknown as { smokeCount: number }).smokeCount) throw new Error(`${where}: smokeCount out of step`);
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
