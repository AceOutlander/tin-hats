/**
 * Admin panel actions on a battle (AdminAction in types.ts) and the per-tick cheats they leave in force
 * (SideState.cheats). Nothing here runs unless the admin panel asks: in a normal battle every cheat is off and the two
 * tick hooks only read four booleans.
 */
import { CONFIG } from '../data/config';
import type { Side } from '../data/schema';
import { endBattle, fireEvent } from './mission';
import { DAMAGE_TYPES, KIND_COUNT, KIND_DEFS, KIND_INDEX, KIND_LIST, KIND_SAPPER } from './tables';
import type { AdminAction, AiReport, Behaviour, UnitState } from './types';
import { killUnit, makeVeteran, removeUnit, spawnUnit } from './units';
import type { World } from './world';

const BULLET = DAMAGE_TYPES.indexOf('bullet');

/** How units the panel adds behave: an army that obeys the side's orders, or attackers for a side with no HQ. */
function behaviourOf(w: World, side: Side): Behaviour {
  return w.state.sides[side].hq ? 'army' : 'assault';
}

/** Where the panel's reinforcements walk out: the HQ door, or the side's own map edge for a side with no HQ. */
function homeX(w: World, side: Side): number {
  const hq = w.state.sides[side].hq;
  if (hq) return hq.doorX;
  return side === 0 ? CONFIG.mapMargin : w.state.length - CONFIG.mapMargin;
}

/** Living units the action targets: one by id when `unit` is given, else every unit of `side` (-1 = both). */
function forTargets(w: World, side: Side | -1, unit: number | undefined, fn: (u: UnitState) => void): number {
  const s = w.state;
  let n = 0;
  // Highest slot first: killing a unit can shrink unitCount, and the slots below it are untouched.
  for (let i = s.unitCount - 1; i >= 0; i--) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (unit !== undefined ? u.id !== unit : side !== -1 && u.side !== side) continue;
    fn(u);
    n++;
  }
  return n;
}

function spawn(w: World, side: Side, kindIndex: number, x: number, count: number, veteran: boolean): number {
  const dir = side === 0 ? 1 : -1;
  const behaviour = behaviourOf(w, side);
  let n = 0;
  for (let j = 0; j < count; j++) {
    const u = spawnUnit(w, side, kindIndex, x - j * dir * CONFIG.spacing, kindIndex === KIND_SAPPER ? 'army' : behaviour, false, false);
    if (!u) break;
    if (veteran) makeVeteran(w, u);
    n++;
  }
  return n;
}

/** A unit of the other side changes sides where it stands, keeping its share of health and its veteran mark. */
function turn(w: World, u: UnitState, side: Side): boolean {
  const kindIndex = u.kindIndex;
  const x = u.x;
  const share = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  const veteran = u.veteran;
  removeUnit(w, u);
  const nu = spawnUnit(w, side, kindIndex, x, kindIndex === KIND_SAPPER ? 'army' : behaviourOf(w, side), false, false);
  if (!nu) return false;
  if (veteran) makeVeteran(w, nu);
  nu.hp = nu.maxHp * share;
  return true;
}

/** Apply one admin action now. See Battle.admin. */
export function applyAdmin(w: World, action: AdminAction): number {
  const s = w.state;
  if (s.over) return 0;
  switch (action.type) {
    case 'spawn': {
      const k = KIND_INDEX[action.kind];
      if (k === undefined || !Number.isFinite(action.x)) return 0;
      const count = Math.max(0, Math.floor(action.count));
      return spawn(w, action.side, k, action.x, count, action.veteran === true);
    }
    case 'kill':
      return forTargets(w, action.side, action.unit, (u) => killUnit(w, u, BULLET, -u.facing, -1));
    case 'heal':
      return forTargets(w, action.side, action.unit, (u) => {
        u.hp = u.maxHp;
      });
    case 'invincible': {
      if (action.unit !== undefined) {
        return forTargets(w, -1, action.unit, (u) => {
          u.invincible = action.on;
        });
      }
      for (let si = 0; si < 2; si++) if (action.side === -1 || action.side === si) s.sides[si].cheats.invincible = action.on;
      return 1;
    }
    case 'hqInvincible':
      s.sides[action.side].cheats.hqInvincible = action.on;
      return s.sides[action.side].hq ? 1 : 0;
    case 'takeOver': {
      const other = action.side === 0 ? 1 : 0;
      let n = 0;
      for (let i = s.unitCount - 1; i >= 0; i--) {
        const u = s.units[i];
        // Only men and vehicles on the field: a garrison or an APC's passengers stay where they are.
        if (!u.alive || u.side !== other || u.inside) continue;
        if (action.unit !== undefined && u.id !== action.unit) continue;
        if (turn(w, u, action.side)) n++;
      }
      return n;
    }
    case 'end':
      endBattle(w, action.winner, 'admin');
      return 1;
    case 'setSupplies': {
      const side = s.sides[action.side];
      const amount = Number.isFinite(action.amount) ? Math.max(0, action.amount) : 0;
      side.supplies = amount;
      if (side.cheats.holdSupplies >= 0) side.cheats.holdSupplies = amount;
      return 1;
    }
    case 'holdSupplies': {
      const side = s.sides[action.side];
      if (action.amount === null || !Number.isFinite(action.amount)) {
        side.cheats.holdSupplies = -1;
        return 1;
      }
      side.cheats.holdSupplies = Math.max(0, action.amount);
      side.supplies = side.cheats.holdSupplies;
      return 1;
    }
    case 'instantTrain':
      s.sides[action.side].cheats.instantTrain = action.on;
      return 1;
    case 'fillArmy': {
      const k = KIND_INDEX[action.kind];
      if (k === undefined) return 0;
      const side = s.sides[action.side];
      const def = KIND_DEFS[k];
      let n = 0;
      while (side.pop + side.reservePop + def.pop <= side.popCap) {
        if (spawn(w, action.side, k, homeX(w, action.side), 1, false) === 0) break;
        n++;
      }
      return n;
    }
    case 'fireEvent': {
      const ev = w.mission.events[action.index];
      if (!ev) return 0;
      // A one-shot event fired by hand does not fire again; a repeating one keeps its own schedule.
      if (!('every' in ev.when)) w.eventFired[action.index] = 1;
      fireEvent(w, ev);
      return 1;
    }
  }
}

/** Before the economy runs: a side with instant training finishes every unit in its queues this tick. */
export function cheatTraining(w: World): void {
  const sides = w.state.sides;
  for (let si = 0; si < 2; si++) {
    const side = sides[si];
    if (!side.cheats.instantTrain) continue;
    for (let k = 0; k < KIND_COUNT; k++) if (side.queue[KIND_LIST[k]] > 0) w.trainLeft[si * KIND_COUNT + k] = 0;
  }
}

/** End of the tick: held supplies go back to their value (frozen or infinite supplies). */
export function cheatSupplies(w: World): void {
  const sides = w.state.sides;
  for (let si = 0; si < 2; si++) {
    const hold = sides[si].cheats.holdSupplies;
    if (hold >= 0) sides[si].supplies = hold;
  }
}

/** See Battle.inspectAi. */
export function inspectAi(w: World, side: Side): AiReport | null {
  const ai = w.ai[side];
  if (!ai) return null;
  const s = w.state;
  const wants: AiReport['wants'] = {};
  for (let k = 0; k < KIND_COUNT; k++) if (ai.desired[k] > 0) wants[KIND_LIST[k]] = ai.desired[k];
  return {
    commander: s.sides[side].commander,
    order: s.sides[side].order,
    aggression: ai.aggression,
    wants,
    sinceOrder: s.time - ai.lastOrderTime,
    sinceContact: ai.contactSince < 0 ? -1 : s.time - ai.contactSince,
    firstAttackAfter: ai.plan.firstAttackAfter,
  };
}
