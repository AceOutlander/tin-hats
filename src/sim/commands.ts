/**
 * Command validation and application. Commands from the player, the AI and
 * the test bot all pass through the same queue and the same checks.
 */
import { CONFIG } from '../data/config';
import type { Order, SupportKind, UnitKind } from '../data/schema';
import { SUPPORTS, SUPPORT_COST } from '../data/supports';
import { UNITS } from '../data/units';
import { releaseControl, setControlInput, takeControl } from './control';
import { speak } from './specials';
import { callSupport, canCallSupport } from './supports';
import { KIND_COUNT, KIND_INDEX, KIND_LIST, orderCost, orderPop } from './tables';
import { applyBuild, applyCancelBuild, applyReady } from './prep';
import { resolveDeploy } from './points';
import { DEPLOY_AUTO, DEPLOY_HQ } from './types';
import {
  CMD_BUILD,
  CMD_CANCEL_BUILD,
  CMD_READY,
  CMD_CONTROL,
  CMD_CONTROL_INPUT,
  CMD_DEPLOY,
  CMD_FOLLOW,
  CMD_FOLLOW_ALL,
  CMD_KIND_ORDER,
  CMD_ORDER,
  CMD_SUPPORT,
  CMD_TRAIN,
  type World,
} from './world';

/**
 * True if the side could queue this kind right now. The AI uses it to avoid issuing commands that would be dropped.
 * Room under the population cap is kept for scripted reinforcements still waiting in the reserve.
 */
export function canTrain(w: World, si: number, kind: UnitKind): boolean {
  const side = w.state.sides[si];
  const hq = side.hq;
  if (!side.hasHq || !hq || !hq.alive) return false;
  if (side.available[kind] !== true) return false;
  const def = UNITS[kind];
  // One commander per side: none while one is alive or queued.
  if (def.uniquePerSide === true && side.alive[kind] + side.queue[kind] > 0) return false;
  // A squad kind (conscripts) pays for and needs room for the whole squad.
  const room = side.pop + side.reservePop + orderPop(kind) <= side.popCap;
  return side.queue[kind] < CONFIG.maxQueue && side.supplies >= orderCost(kind) && room;
}

function applyTrain(w: World, si: number, kind: UnitKind): void {
  if (!canTrain(w, si, kind)) return;
  const side = w.state.sides[si];
  const def = UNITS[kind];
  const cost = orderCost(kind);
  // Cost and population are paid now, so the cap can never be exceeded later.
  side.supplies -= cost;
  side.stats.suppliesSpent += cost;
  side.pop += orderPop(kind);
  if (side.queue[kind] === 0) {
    w.trainLeft[si * KIND_COUNT + KIND_INDEX[kind]] = def.trainTime;
    side.progress[kind] = 0;
  }
  side.queue[kind]++;
  const e = w.events.emit('trainStarted');
  e.side = si;
  e.kind = kind;
  e.value = side.queue[kind];
}

function isOrder(order: Order): boolean {
  return order === 'hold' || order === 'advance' || order === 'fallBack';
}

function emitOrder(w: World, si: number, order: Order, kind: UnitKind | null): void {
  const e = w.events.emit('orderChanged');
  e.side = si;
  e.order = order;
  e.kind = kind;
  if (kind === null) speak(w, si, order);
}

/** The army-wide order. Kinds with their own order keep it. */
function applyOrder(w: World, si: number, order: Order): void {
  if (!isOrder(order)) return;
  const side = w.state.sides[si];
  if (side.order === order) return;
  side.order = order;
  emitOrder(w, si, order, null);
}

/** One kind's own order, in force until followArmy. */
function applyKindOrder(w: World, si: number, kind: UnitKind, order: Order): void {
  if (!isOrder(order) || !(kind in UNITS)) return;
  const own = w.state.sides[si].kindOrders;
  if (own[kind] === order) return;
  own[kind] = order;
  emitOrder(w, si, order, kind);
}

function applyFollow(w: World, si: number, kind: UnitKind): void {
  if (!(kind in UNITS)) return;
  const side = w.state.sides[si];
  if (side.kindOrders[kind] === null) return;
  side.kindOrders[kind] = null;
  emitOrder(w, si, side.order, kind);
}

function applyFollowAll(w: World, si: number): void {
  for (let k = 0; k < KIND_COUNT; k++) applyFollow(w, si, KIND_LIST[k]);
}

function applySupport(w: World, si: number, kind: SupportKind, x: number): void {
  if (!(kind in SUPPORTS) || !Number.isFinite(x)) return;
  if (!canCallSupport(w, si, kind)) return;
  const cost = SUPPORT_COST[kind];
  if (cost > 0) {
    const side = w.state.sides[si];
    side.supplies -= cost;
    side.stats.suppliesSpent += cost;
  }
  callSupport(w, si, kind, x);
}

/**
 * The "Deploy at" choice (FOUNDATIONS.md 4.5): DEPLOY_AUTO, DEPLOY_HQ or a capture point's index. A point that is not
 * a spawn point is refused; one that is not available now is kept, and used whenever it is (auto meanwhile).
 */
function applyDeploy(w: World, si: number, at: number): void {
  const side = w.state.sides[si];
  const points = w.state.points;
  if (at === DEPLOY_AUTO || at === DEPLOY_HQ) side.deploy = at;
  else if (at >= 0 && at < points.length && points[at].spawn && (points[at].spawnFor < 0 || points[at].spawnFor === si)) side.deploy = at;
  else return;
  side.deployPoint = resolveDeploy(w, si);
}

/** Apply everything queued since the last tick, in the order it was issued. */
export function applyCommands(w: World): void {
  const q = w.commands;
  for (let i = 0; i < q.count; i++) {
    const c = q.items[i];
    switch (c.type) {
      case CMD_TRAIN:
        applyTrain(w, c.side, c.kind);
        break;
      case CMD_ORDER:
        applyOrder(w, c.side, c.order);
        break;
      case CMD_KIND_ORDER:
        applyKindOrder(w, c.side, c.kind, c.order);
        break;
      case CMD_FOLLOW:
        applyFollow(w, c.side, c.kind);
        break;
      case CMD_FOLLOW_ALL:
        applyFollowAll(w, c.side);
        break;
      case CMD_SUPPORT:
        applySupport(w, c.side, c.support, c.x);
        break;
      case CMD_CONTROL:
        if (c.unit < 0) releaseControl(w, c.side);
        else takeControl(w, c.side, c.unit);
        break;
      case CMD_BUILD:
        applyBuild(w, c.side, c.build, c.x);
        break;
      case CMD_CANCEL_BUILD:
        applyCancelBuild(w, c.side, c.unit);
        break;
      case CMD_READY:
        applyReady(w, c.side);
        break;
      case CMD_CONTROL_INPUT:
        setControlInput(w, c.side, c.moveX, c.fire, c.ability);
        break;
      case CMD_DEPLOY:
        applyDeploy(w, c.side, c.unit);
        break;
      default:
        break;
    }
  }
  q.count = 0;
}
