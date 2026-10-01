/**
 * The AI commander. One implementation drives the campaign enemy ('ai',
 * following mission.ai and scaled by the difficulty) and the reasonable-player
 * test bot ('bot', following mission.bot). It reads the same state the player
 * sees and issues the same commands through the same queue.
 */
import { AI } from '../data/ai';
import { CONFIG } from '../data/config';
import { DIFFICULTIES } from '../data/difficulty';
import type { Order, UnitKind } from '../data/schema';
import { canTrain } from './commands';
import { KIND_COUNT, KIND_INDEX, KIND_LIST } from './tables';
import type { CommanderKind } from './types';
import { CMD_ORDER, CMD_TRAIN, type AiState, type World } from './world';

/** Build the commander memory for a side, or null for human and idle commanders. */
export function createAi(w: World, kind: CommanderKind): AiState | null {
  if (kind !== 'ai' && kind !== 'bot') return null;
  const difficulty = DIFFICULTIES[w.config.difficulty];
  const interval = kind === 'ai' ? difficulty.aiThinkInterval : AI.botThinkInterval;
  return {
    plan: kind === 'ai' ? w.mission.ai : w.mission.bot,
    thinkTicks: Math.max(1, Math.round(interval * CONFIG.tickRate)),
    aggression: kind === 'ai' ? difficulty.aiAggression : 1,
    lastOrderTime: -AI.minOrderInterval,
    holdSince: 0,
    desired: new Int16Array(KIND_COUNT),
  };
}

function issueTrain(w: World, si: number, kind: UnitKind): void {
  w.commands.push(si, CMD_TRAIN).kind = kind;
}

function issueOrder(w: World, si: number, order: Order): void {
  w.commands.push(si, CMD_ORDER).order = order;
}

function react(w: World, si: number, ai: AiState, kind: UnitKind, extra: number): void {
  if (extra <= 0 || w.state.sides[si].available[kind] !== true) return;
  ai.desired[KIND_INDEX[kind]] += extra > AI.maxReaction ? AI.maxReaction : extra;
}

function think(w: World, si: number, ai: AiState): void {
  const s = w.state;
  const side = s.sides[si];
  const hq = side.hq;
  if (!side.hasHq || !hq || !hq.alive) return;
  const dir = si === 0 ? 1 : -1;
  const time = s.time;

  // Survey: army strength is the summed supply cost of armed units. Only enemies on the field are visible.
  // The group is what has gathered at the hold line, or around the leading unit during an advance.
  let own = 0;
  let group = 0;
  let foe = 0;
  let foeTanks = 0;
  let foeDugIn = 0;
  let foeOpen = 0;
  let foeAhead = Infinity;
  const rally = side.order === 'advance' ? w.armedFront[si] : side.holdLineX;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.side === si) {
      if (u.def.armed && u.behaviour === 'army') {
        own += u.def.cost;
        const away = u.x > rally ? u.x - rally : rally - u.x;
        if (!u.inside && away <= AI.groupRadius) group += u.def.cost;
      }
    } else if (!u.inside) {
      if (u.def.armed) {
        foe += u.def.cost;
        const ahead = (u.x - side.holdLineX) * dir;
        if (ahead < foeAhead) foeAhead = ahead;
      }
      if (u.def.class === 'vehicle') foeTanks++;
      else if (u.trenchId >= 0) foeDugIn++;
      else if (u.def.armed) foeOpen++;
    }
  }
  for (let i = 0; i < s.pillboxes.length; i++) {
    if (s.pillboxes[i].alive && s.pillboxes[i].side !== si) foeDugIn++;
  }
  const foeNear = foeAhead <= AI.threatDistance;

  // Economy first: sappers up to the plan, unless the enemy is at the gates and winning.
  let saving = false;
  if (side.available.sapper && side.alive.sapper + side.queue.sapper < ai.plan.sappers && !(foeNear && own < foe)) {
    saving = true;
    if (side.queue.sapper < AI.maxQueueDepth && canTrain(w, si, 'sapper')) issueTrain(w, si, 'sapper');
  }

  if (!saving) {
    // Build plan: keep `count` of `kind` alive once `after` seconds have passed, plus reactions to what is visible.
    const desired = ai.desired;
    desired.fill(0);
    const build = ai.plan.build;
    for (let i = 0; i < build.length; i++) {
      const step = build[i];
      if (time < step.after) continue;
      const k = KIND_INDEX[step.kind];
      if (step.count > desired[k]) desired[k] = step.count;
    }
    react(w, si, ai, 'at', Math.ceil(foeTanks * AI.atPerTank));
    if (foeDugIn > 0) {
      react(w, si, ai, 'mortar', AI.mortarsVsDugIn);
      react(w, si, ai, 'assault', AI.assaultVsDugIn);
    }
    if (AI.infantryPerLmg > 0) react(w, si, ai, 'lmg', Math.floor(foeOpen / AI.infantryPerLmg));

    // Train the kind furthest below its target.
    let pick = -1;
    let worst = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (desired[k] <= 0) continue;
      const kind = KIND_LIST[k];
      if (side.available[kind] !== true) continue;
      const short = (desired[k] - side.alive[kind] - side.queue[kind]) / desired[k];
      if (short > worst) {
        worst = short;
        pick = k;
      }
    }
    if (pick < 0 && side.supplies >= AI.surplusSupplies) {
      // Plan satisfied and supplies banked: keep growing in the plan's proportions.
      let lowest = Infinity;
      for (let k = 0; k < KIND_COUNT; k++) {
        if (desired[k] <= 0) continue;
        const kind = KIND_LIST[k];
        if (side.available[kind] !== true) continue;
        const ratio = (side.alive[kind] + side.queue[kind]) / desired[k];
        if (ratio < lowest) {
          lowest = ratio;
          pick = k;
        }
      }
    }
    if (pick >= 0) {
      const kind = KIND_LIST[pick];
      if (side.queue[kind] < AI.maxQueueDepth && canTrain(w, si, kind)) issueTrain(w, si, kind);
    }
  }

  // Orders, from relative strength, with hysteresis and a minimum time between changes.
  if (time - ai.lastOrderTime < AI.minOrderInterval) return;
  const order = side.order;
  let next: Order = order;
  if (order === 'hold') {
    if (foeNear && group < foe * AI.retreatRatio) {
      next = 'fallBack';
    } else if (time >= ai.plan.firstAttackAfter / ai.aggression && group >= AI.minAttackStrength) {
      const impatient = time - ai.holdSince >= AI.impatienceAfter / ai.aggression;
      if (
        group >= (foe * AI.attackRatio) / ai.aggression ||
        side.pop >= side.popCap * AI.popCapAttackFrac ||
        (impatient && group >= foe * AI.impatientRatio)
      ) {
        next = 'advance';
      }
    }
  } else if (order === 'advance') {
    if (group < foe * AI.holdRatio || group < AI.minAttackStrength * AI.regroupFrac) next = 'hold';
  } else if (!foeNear || own >= foe * AI.returnRatio) {
    next = 'hold';
  }
  if (next !== order) {
    issueOrder(w, si, next);
    ai.lastOrderTime = time;
    if (next === 'hold') ai.holdSince = time;
  }
  // Phase 2: support call-ins (artillery on clusters and trenches, smoke ahead of an advance,
  // air strikes on tanks). NOT YET IMPLEMENTED.
}

/** Let each AI or bot commander think when its interval comes round. Both sides read the same state. */
export function runCommanders(w: World): void {
  const tick = w.state.tick;
  for (let si = 0; si < 2; si++) {
    const ai = w.ai[si];
    if (ai && tick % ai.thinkTicks === 0) think(w, si, ai);
  }
}
