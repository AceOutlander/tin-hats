/**
 * Headless matchup harness: equal-cost duels between armies, used by tools/balance-table.ts
 * (docs/BALANCE.md) and the balance tests.
 *
 * Two grounds:
 *   open    both armies start formed up on an empty field (MATCHUP.openX) and both advance;
 *   trench  side 0 (the attacker) advances on side 1 (the defender), which holds a trench at
 *           MATCHUP.trenchX with one slot per trench-capable defender (the others stand behind it).
 * A duel ends when one side has no armed unit left (that side loses) or after MATCHUP.maxSeconds
 * (undecided). Its outcome is the winner and the fraction of each side's starting value left
 * (summed supply cost x health fraction of the survivors).
 */
import { MATCHUP } from '../data/balance';
import { CONFIG } from '../data/config';
import { M01 } from '../data/missions/m01';
import type { ArmyEntry, ForceDef, MissionDef, SideStart, UnitKind } from '../data/schema';
import { UNITS, UNIT_KINDS } from '../data/units';
import { createBattle } from './battle';
import type { Battle } from './types';

export type MatchupGround = 'open' | 'trench';

/** One duel. */
export interface DuelResult {
  /** 0 or 1, or -1 if both sides still had armed units when time ran out. */
  winner: number;
  /** Fraction of each side's starting value left (0..1). */
  left: [number, number];
  seconds: number;
}

/** A pairing over several seeds: `a` is side 0 (the attacker on the trench ground), `b` side 1. */
export interface MatchupResult {
  a: UnitKind;
  b: UnitKind;
  ground: MatchupGround;
  /** Units per side and what they cost. */
  counts: [number, number];
  cost: [number, number];
  /** Duels won by a, by b, and undecided. */
  winsA: number;
  winsB: number;
  draws: number;
  /** Mean fraction of starting value left over all duels. */
  leftA: number;
  leftB: number;
  /** +1 if a won more duels than b, -1 if b did, 0 for a tie. */
  verdict: number;
  /** Mean value left of the side that won (0 for a tie): how clear the win was. */
  margin: number;
}

/** Summed supply cost of an army. */
export function armyCost(army: readonly ArmyEntry[]): number {
  let total = 0;
  for (const entry of army) total += UNITS[entry.kind].cost * entry.count;
  return total;
}

/** Summed population of an army. */
export function armyPop(army: readonly ArmyEntry[]): number {
  let total = 0;
  for (const entry of army) total += UNITS[entry.kind].pop * entry.count;
  return total;
}

/**
 * Unit counts for an equal-cost duel of kind a against kind b: each side's cost lies in
 * MATCHUP.budgetMin..budgetMax and the two differ as little as possible (exactly equal when the
 * costs allow it), within the population cap.
 */
export function equalCounts(a: UnitKind, b: UnitKind): [number, number] {
  const ca = UNITS[a].cost;
  const cb = UNITS[b].cost;
  let best: [number, number] = [Math.max(1, Math.round(MATCHUP.budgetMin / ca)), Math.max(1, Math.round(MATCHUP.budgetMin / cb))];
  let bestErr = Infinity;
  for (let na = 1; na * ca <= MATCHUP.budgetMax; na++) {
    if (na * ca < MATCHUP.budgetMin || na * UNITS[a].pop > CONFIG.popCap) continue;
    const nb = Math.max(1, Math.round((na * ca) / cb));
    if (nb * UNITS[b].pop > CONFIG.popCap) continue;
    const err = Math.abs(na * ca - nb * cb) / (na * ca);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      best = [na, nb];
    }
  }
  return best;
}

/** The army of `kind` costing `budget` (rounded to the nearest whole unit, within the population cap). */
export function monoArmy(kind: UnitKind, budget: number): ArmyEntry[] {
  let count = Math.max(1, Math.round(budget / UNITS[kind].cost));
  while (count > 1 && count * UNITS[kind].pop > CONFIG.popCap) count--;
  return [{ kind, count }];
}

/**
 * Place an army formed up behind x like the hold formation: each kind at its formation depth,
 * filling the depth rows, one formation column (config.spacing) per config.rows units, odd rows
 * half a column back.
 */
function formUp(army: readonly ArmyEntry[], x: number, dir: number, trenchId: number | undefined): ForceDef[] {
  const forces: ForceDef[] = [];
  for (const entry of army) {
    const def = UNITS[entry.kind];
    if (trenchId !== undefined && def.usesTrench) {
      forces.push({ kind: entry.kind, count: entry.count, trenchId });
      continue;
    }
    for (let i = 0; i < entry.count; i++) {
      const stagger = i % 2 === 1 ? CONFIG.spacing / 2 : 0;
      const depth = def.formationDepth + Math.floor(i / CONFIG.rows) * CONFIG.spacing + stagger;
      forces.push({ kind: entry.kind, count: 1, x: x - dir * depth });
    }
  }
  return forces;
}

function side(faction: SideStart['faction'], forces: ForceDef[]): SideStart {
  return { faction, hasHq: true, supplies: 0, hqHpMul: 10, incomeMul: 0, sappers: 0, forces };
}

/** The mission for a duel of army a (side 0) against army b (side 1) on a ground. */
export function matchupMission(a: readonly ArmyEntry[], b: readonly ArmyEntry[], ground: MatchupGround): MissionDef {
  const every = UNIT_KINDS.filter((kind) => UNITS[kind].trainable);
  let trenchSlots = 0;
  for (const entry of b) if (UNITS[entry.kind].usesTrench) trenchSlots += entry.count;
  const trench = ground === 'trench' && trenchSlots > 0;
  const startA = ground === 'open' ? MATCHUP.openX[0] : MATCHUP.attackX;
  const startB = ground === 'open' ? MATCHUP.openX[1] : MATCHUP.trenchX + MATCHUP.trenchWidth / 2 + CONFIG.trenchFormGap;
  return {
    ...M01,
    id: 990,
    key: 'matchup',
    title: 'Matchup',
    length: MATCHUP.length,
    newUnit: null,
    units: [every, every],
    supports: [[], []],
    start: [side('british', formUp(a, startA, 1, undefined)), side('german', formUp(b, startB, -1, trench ? 1 : undefined))],
    trenches: trench ? [{ id: 1, x: MATCHUP.trenchX, width: MATCHUP.trenchWidth, slots: trenchSlots, owner: 1 }] : [],
    pillboxes: [],
    wire: [],
    timer: null,
    events: [],
  };
}

/** Armed units on the field per side, and the value (cost x health fraction) of everything alive. */
function survey(battle: Battle, armed: Int32Array, value: Float64Array): void {
  armed[0] = 0;
  armed[1] = 0;
  value[0] = 0;
  value[1] = 0;
  const s = battle.state;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (u.def.armed) armed[u.side]++;
    value[u.side] += (u.def.cost * u.hp) / u.maxHp;
  }
}

/** Fight one duel. Both sides are commanded by the harness: side 0 advances; side 1 advances in the open and holds its trench. */
export function runDuel(a: readonly ArmyEntry[], b: readonly ArmyEntry[], ground: MatchupGround, seed: number): DuelResult {
  const battle = createBattle({
    mission: matchupMission(a, b, ground),
    difficulty: 'normal',
    seed,
    upgrades: {},
    commanders: ['human', 'human'],
  });
  battle.command(0, { type: 'order', order: 'advance' });
  battle.command(1, { type: 'order', order: ground === 'open' ? 'advance' : 'hold' });
  const armed = new Int32Array(2);
  const value = new Float64Array(2);
  const start = [armyCost(a), armyCost(b)];
  const maxTicks = Math.ceil(MATCHUP.maxSeconds * CONFIG.tickRate);
  let winner = -1;
  while (battle.state.tick < maxTicks && !battle.state.over) {
    battle.step();
    survey(battle, armed, value);
    if (armed[0] === 0 || armed[1] === 0) {
      winner = armed[0] > 0 ? 0 : armed[1] > 0 ? 1 : -1;
      break;
    }
  }
  survey(battle, armed, value);
  return { winner, left: [value[0] / start[0], value[1] / start[1]], seconds: battle.state.time };
}

/** Kind a (side 0) against kind b (side 1) at equal cost on a ground, over seeds 1..seeds. */
export function runMatchup(a: UnitKind, b: UnitKind, ground: MatchupGround, seeds: number = MATCHUP.seeds): MatchupResult {
  const counts = equalCounts(a, b);
  const armyA: ArmyEntry[] = [{ kind: a, count: counts[0] }];
  const armyB: ArmyEntry[] = [{ kind: b, count: counts[1] }];
  const r = compare(armyA, armyB, ground, seeds);
  return { ...r, a, b, ground, counts, cost: [armyCost(armyA), armyCost(armyB)] };
}

/** Outcome counts of army a (side 0) against army b (side 1) over seeds 1..seeds. */
export function compare(
  a: readonly ArmyEntry[],
  b: readonly ArmyEntry[],
  ground: MatchupGround,
  seeds: number,
): Pick<MatchupResult, 'winsA' | 'winsB' | 'draws' | 'leftA' | 'leftB' | 'verdict' | 'margin'> {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let leftA = 0;
  let leftB = 0;
  let marginA = 0;
  let marginB = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = runDuel(a, b, ground, seed);
    leftA += r.left[0];
    leftB += r.left[1];
    if (r.winner === 0) {
      winsA++;
      marginA += r.left[0];
    } else if (r.winner === 1) {
      winsB++;
      marginB += r.left[1];
    } else draws++;
  }
  const verdict = winsA > winsB ? 1 : winsB > winsA ? -1 : 0;
  const margin = verdict > 0 ? marginA / winsA : verdict < 0 ? marginB / winsB : 0;
  return { winsA, winsB, draws, leftA: leftA / seeds, leftB: leftB / seeds, verdict, margin };
}
