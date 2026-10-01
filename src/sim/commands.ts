/**
 * Command validation and application. Commands from the player, the AI and
 * the test bot all pass through the same queue and the same checks.
 */
import { CONFIG } from '../data/config';
import type { Order, UnitKind } from '../data/schema';
import { UNITS } from '../data/units';
import { KIND_COUNT, KIND_INDEX } from './tables';
import { CMD_CONTROL, CMD_CONTROL_INPUT, CMD_ORDER, CMD_SUPPORT, CMD_TRAIN, type World } from './world';

/** True if the side could queue this kind right now. The AI uses it to avoid issuing commands that would be dropped. */
export function canTrain(w: World, si: number, kind: UnitKind): boolean {
  const side = w.state.sides[si];
  const hq = side.hq;
  if (!side.hasHq || !hq || !hq.alive) return false;
  if (side.available[kind] !== true) return false;
  const def = UNITS[kind];
  return side.queue[kind] < CONFIG.maxQueue && side.supplies >= def.cost && side.pop + def.pop <= side.popCap;
}

function applyTrain(w: World, si: number, kind: UnitKind): void {
  if (!canTrain(w, si, kind)) return;
  const side = w.state.sides[si];
  const def = UNITS[kind];
  // Cost and population are paid now, so the cap can never be exceeded later.
  side.supplies -= def.cost;
  side.stats.suppliesSpent += def.cost;
  side.pop += def.pop;
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

function applyOrder(w: World, si: number, order: Order): void {
  if (order !== 'hold' && order !== 'advance' && order !== 'fallBack') return;
  const side = w.state.sides[si];
  if (side.order === order) return;
  side.order = order;
  const e = w.events.emit('orderChanged');
  e.side = si;
  e.order = order;
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
      case CMD_SUPPORT:
        // Phase 2: support call-ins (availability, cooldown, target x). NOT YET IMPLEMENTED: ignored.
        break;
      case CMD_CONTROL:
      case CMD_CONTROL_INPUT:
        // Phase 2: direct control. NOT YET IMPLEMENTED: ignored.
        break;
      default:
        break;
    }
  }
  q.count = 0;
}
