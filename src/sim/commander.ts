/**
 * The AI commander. One implementation drives the campaign enemy ('ai',
 * following mission.ai and scaled by the difficulty) and the reasonable-player
 * test bot ('bot', following mission.bot). It reads the same state the player
 * sees and issues the same commands through the same queue, under the same
 * rules (cost, population, cooldowns, availability).
 *
 * Each think: survey the field, keep the economy and the build plan going (plus
 * reactions to what it sees), pick the order from relative strength with
 * hysteresis, and call in supports.
 */
import { AI, AI_PLANES, AI_RECOVERY } from '../data/ai';
import { CONFIG } from '../data/config';
import { DIFFICULTIES } from '../data/difficulty';
import type { Order, SupportKind, UnitKind } from '../data/schema';
import { canTrain } from './commands';
import { canCallSupport } from './supports';
import { KIND_COUNT, KIND_INDEX, KIND_LIST } from './tables';
import type { CommanderKind, SideState } from './types';
import { CMD_ORDER, CMD_SUPPORT, CMD_TRAIN, type AiState, type World } from './world';

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
    advanceSince: 0,
    contactSince: -1,
    lastSupportTime: -AI.supportGap,
    desired: new Int16Array(KIND_COUNT),
  };
}

/**
 * What one think saw (module scratch, overwritten by every survey; numbers live in fields so
 * nothing is allocated).
 * own      summed cost of its armed army units, on the field or in the HQ;
 * field    the same, on the field only;
 * group    on the field within AI.groupRadius of the rally point (the hold line, or the leading unit
 *          while advancing); units in a trench count AI.dugInWeight times (they are worth more there);
 * strike   the same group at plain cost: what it brings to an attack once it leaves the trench;
 * foe      summed cost of the enemy's armed units on the field (what is visible);
 * foeW     the same with enemy infantry in trenches counted AI.dugInWeight times, AI.pillboxValue
 *          per living enemy pillbox, and AI.hqValue once its leading unit is near the enemy HQ's gun:
 *          what an attack has to beat;
 * foeAhead how far the nearest armed enemy is in front of its hold line (negative once past it);
 * hqThreat true when an armed enemy is within AI.hqThreatDistance of its HQ door, or within
 *          AI.threatDistance of its hold line while that line is near home (AI_RECOVERY.homeLineReach).
 */
const SV = {
  own: 0,
  field: 0,
  group: 0,
  strike: 0,
  foe: 0,
  foeW: 0,
  foeTanks: 0,
  foeDugIn: 0,
  foeOpen: 0,
  foeAhead: 0,
  hqThreat: false,
};

function issueTrain(w: World, si: number, kind: UnitKind): void {
  w.commands.push(si, CMD_TRAIN).kind = kind;
}

function issueOrder(w: World, si: number, order: Order): void {
  w.commands.push(si, CMD_ORDER).order = order;
}

function issueSupport(w: World, si: number, ai: AiState, kind: SupportKind, x: number): void {
  const c = w.commands.push(si, CMD_SUPPORT);
  c.support = kind;
  c.x = x;
  ai.lastSupportTime = w.state.time;
}

function react(w: World, si: number, ai: AiState, kind: UnitKind, extra: number): void {
  if (extra <= 0 || w.state.sides[si].available[kind] !== true) return;
  ai.desired[KIND_INDEX[kind]] += extra > AI.maxReaction ? AI.maxReaction : extra;
}

function survey(w: World, si: number): void {
  const s = w.state;
  const side = s.sides[si];
  const dir = si === 0 ? 1 : -1;
  const rally = side.order === 'advance' ? w.armedFront[si] : side.holdLineX;
  const hq = side.hq;
  SV.own = 0;
  SV.field = 0;
  SV.group = 0;
  SV.strike = 0;
  SV.foe = 0;
  SV.foeW = 0;
  SV.foeTanks = 0;
  SV.foeDugIn = 0;
  SV.foeOpen = 0;
  SV.foeAhead = Infinity;
  SV.hqThreat = false;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.side === si) {
      if (!u.def.armed || u.behaviour !== 'army') continue;
      const cost = u.def.cost;
      SV.own += cost;
      if (u.inside) continue;
      SV.field += cost;
      const away = u.x > rally ? u.x - rally : rally - u.x;
      if (away <= AI.groupRadius) {
        SV.group += u.trenchId >= 0 ? cost * AI.dugInWeight : cost;
        SV.strike += cost;
      }
    } else if (!u.inside) {
      if (u.def.armed) {
        SV.foe += u.def.cost;
        SV.foeW += u.trenchId >= 0 ? u.def.cost * AI.dugInWeight : u.def.cost;
        // Negative once past the hold line, so an enemy behind the line is always "near".
        const ahead = (u.x - side.holdLineX) * dir;
        if (ahead < SV.foeAhead) SV.foeAhead = ahead;
        if (hq && hq.alive) {
          const toHq = u.x > hq.doorX ? u.x - hq.doorX : hq.doorX - u.x;
          if (toHq <= AI.hqThreatDistance) SV.hqThreat = true;
        }
      }
      if (u.def.class === 'vehicle') SV.foeTanks++;
      else if (u.trenchId >= 0) SV.foeDugIn++;
      else if (u.def.armed) SV.foeOpen++;
    }
  }
  for (let i = 0; i < s.pillboxes.length; i++) {
    if (s.pillboxes[i].alive && s.pillboxes[i].side !== si) {
      SV.foeDugIn++;
      SV.foeW += AI.pillboxValue;
    }
  }
  if (SV.foeAhead <= AI.threatDistance && hq) {
    const home = side.holdLineX > hq.doorX ? side.holdLineX - hq.doorX : hq.doorX - side.holdLineX;
    if (home <= AI_RECOVERY.homeLineReach) SV.hqThreat = true;
  }
  const enemyHq = s.sides[1 - si].hq;
  if (enemyHq && enemyHq.alive) {
    const lead = w.armedFront[si];
    const toHq = lead > enemyHq.doorX ? lead - enemyHq.doorX : enemyHq.doorX - lead;
    if (toHq <= AI.hqThreatDistance) SV.foeW += AI.hqValue;
  }
}

/**
 * The size at which the AI counts its army as full: a fixed size (scaled like the cap by difficulty), never above the
 * side's cap, so raising the population cap neither delays its attacks nor makes it spend its whole bank at once.
 */
function fullArmyPop(side: SideState): number {
  return Math.min(side.popCap, (AI.attackArmyPop * side.popCap) / CONFIG.popCap);
}

/** Economy first, then the build plan plus reactions to what it sees. */
function build(w: World, si: number, ai: AiState): void {
  const side = w.state.sides[si];
  const time = w.state.time;
  const foeNear = SV.foeAhead <= AI.threatDistance;

  // Sappers up to the plan, unless the enemy is at the gates and winning.
  if (side.available.sapper && side.alive.sapper + side.queue.sapper < ai.plan.sappers && !(foeNear && SV.own < SV.foe)) {
    if (side.queue.sapper < AI.maxQueueDepth && canTrain(w, si, 'sapper')) issueTrain(w, si, 'sapper');
    return;
  }

  // Build plan: keep `count` of `kind` alive once `after` seconds have passed, plus reactions.
  const desired = ai.desired;
  desired.fill(0);
  const plan = ai.plan.build;
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    if (time < step.after) continue;
    const k = KIND_INDEX[step.kind];
    if (step.count > desired[k]) desired[k] = step.count;
  }
  react(w, si, ai, 'at', Math.ceil(SV.foeTanks * AI.atPerTank));
  if (SV.foeDugIn > 0) {
    react(w, si, ai, 'mortar', AI.mortarsVsDugIn);
    react(w, si, ai, 'assault', AI.assaultVsDugIn);
  }
  if (AI.infantryPerLmg > 0) react(w, si, ai, 'lmg', Math.floor(SV.foeOpen / AI.infantryPerLmg));
  // The enemy flies: answer with anti-aircraft guns.
  if (w.planesSeen[si] > 0) react(w, si, ai, 'aa', Math.ceil(w.planesSeen[si] * AI_PLANES.aaPerPlane));

  // Train the kind furthest below its target.
  let pick = -1;
  let worst = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (desired[k] <= 0) continue;
    const kind = KIND_LIST[k];
    if (side.available[kind] !== true) continue;
    // The King Tiger's veteran escort stays with its tank: it is not part of the army the plan asks for.
    const short = (desired[k] - (side.alive[kind] - w.escorts[si * KIND_COUNT + k]) - side.queue[kind]) / desired[k];
    if (short > worst) {
      worst = short;
      pick = k;
    }
  }
  // Past a full-sized army the AI grows only while a reserve stays banked, so losses can be replaced instead of every
  // supply being spent at once (below that size it trains exactly as it did under the old cap of 40).
  if (side.pop >= fullArmyPop(side) && side.supplies < AI.reserveSupplies) return;
  if (pick < 0 && side.supplies >= AI.surplusSupplies) {
    // Plan satisfied and supplies banked: keep growing in the plan's proportions.
    let lowest = Infinity;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (desired[k] <= 0) continue;
      const kind = KIND_LIST[k];
      if (side.available[kind] !== true) continue;
      const ratio = (side.alive[kind] - w.escorts[si * KIND_COUNT + k] + side.queue[kind]) / desired[k];
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

/**
 * Orders from relative strength, with hysteresis and a minimum time between changes.
 * Hold -> Advance: once allowed (firstAttackAfter) and with a real force gathered at the line, when
 *   that group outweighs what an attack has to beat (foeW x attackRatio), or the population is
 *   capped, or it has waited long enough (impatience), or its whole army is far stronger
 *   (advantageRatio) - it never shelters while ahead - or a losing deadline is close (deadlineRush),
 *   which also keeps it attacking until the attack is broken.
 * Advance -> Hold: once the advance has had AI.minAdvanceTime to arrive, when the group at the
 *   front has fallen well below what it faces (holdRatio, not at the population cap), or at any
 *   time when the attack is broken (regroupFrac). The wide band between attackRatio and holdRatio
 *   is the hysteresis; recalling a trickle lets the army gather and attack together.
 * Hold -> Fall Back: only when the HQ is threatened (the enemy near the HQ, or at a hold line close
 *   to home) and it is badly outnumbered; a line far forward is held, not abandoned.
 * Fall Back -> out: as soon as the HQ is no longer threatened or the garrison is strong enough;
 *   straight to Advance when it is clearly stronger.
 */
function decideOrder(w: World, si: number, ai: AiState): void {
  const side = w.state.sides[si];
  const time = w.state.time;
  if (time - ai.lastOrderTime < AI.minOrderInterval) return;
  const order = side.order;
  const capped = side.pop >= fullArmyPop(side) * AI.popCapAttackFrac;
  // With no enemy HQ to take (survival) there is nothing to attack, and sheltering in the HQ only
  // hands the trench to the waves: hold the line until the clock runs out.
  const survival = w.state.sides[1 - si].hq === null;
  const mayAttack = !survival && time >= ai.plan.firstAttackAfter / ai.aggression;
  const foeW = SV.foeW;
  const broken = AI.minAttackStrength * AI.regroupFrac;
  // Racing a clock that loses the battle (side 0 under a deadline): no more waiting.
  const timer = w.state.timer;
  const rushing = si === 0 && timer !== null && timer.onExpire === 'lose' && timer.secondsLeft <= AI_RECOVERY.deadlineRush;
  let next: Order = order;
  if (survival) {
    next = 'hold';
  } else if (order === 'hold') {
    if (SV.hqThreat && SV.group < SV.foe * AI.retreatRatio) {
      next = 'fallBack';
    } else if (mayAttack && SV.strike >= AI.minAttackStrength) {
      // An attack leaves the trench behind: it is judged on the group's plain value.
      const impatient = time - ai.holdSince >= AI.impatienceAfter / ai.aggression;
      if (
        SV.strike >= (foeW * AI.attackRatio) / ai.aggression ||
        capped ||
        rushing ||
        (impatient && SV.strike >= foeW * AI.impatientRatio) ||
        SV.own >= (foeW * AI.advantageRatio) / ai.aggression
      ) {
        next = 'advance';
      }
    }
  } else if (order === 'advance') {
    // The advance is judged only once it has had AI.minAdvanceTime in contact: an army strung out
    // on a long approach march (fast troops leading) is not yet a failed attack.
    const dir = si === 0 ? 1 : -1;
    if (ai.contactSince < 0 && (w.front[1 - si] - w.armedFront[si]) * dir <= AI.threatDistance) ai.contactSince = time;
    const settled = ai.contactSince >= 0 && time - ai.contactSince >= AI.minAdvanceTime;
    // At the population cap waiting cannot make the army any bigger, so only a broken attack stops.
    if (SV.field < broken || (settled && !rushing && (SV.group < broken || (!capped && SV.group < foeW * AI.holdRatio)))) next = 'hold';
  } else if (mayAttack && SV.own >= AI.minAttackStrength && SV.own >= foeW * AI.commitRatio) {
    next = 'advance';
  } else if (!SV.hqThreat || SV.own >= SV.foe * AI.returnRatio) {
    next = 'hold';
  }
  if (next !== order) {
    issueOrder(w, si, next);
    ai.lastOrderTime = time;
    if (next === 'hold') ai.holdSince = time;
    else if (next === 'advance') {
      ai.advanceSince = time;
      ai.contactSince = -1;
    }
  }
}

/** Scratch for the best target found by bestCluster: [0] x, [1] its value, [2] working sum. */
const BEST = new Float64Array(3);

/**
 * The armed enemy's position with the most enemy value within AI.artilleryRadius around it (summed
 * cost, men in trenches weighted AI.dugInWeight, AI.pillboxValue per pillbox): BEST[0] = x,
 * BEST[1] = value (0 if there is none).
 */
function bestCluster(w: World, si: number): void {
  const s = w.state;
  const r = AI.artilleryRadius;
  const dir = si === 0 ? 1 : -1;
  const lead = w.armedFront[si];
  BEST[0] = 0;
  BEST[1] = 0;
  // Integer sums and bound comparisons only in the inner loops: this runs at think rate, often
  // before the optimiser has compiled it, where every fractional intermediate would be boxed.
  for (let i = 0; i < s.unitCount; i++) {
    const c = s.units[i];
    if (!c.alive || c.side === si || c.inside || !c.def.armed) continue;
    if ((c.x - lead) * dir > AI.supportReach) continue;
    const lo = c.x - r;
    const hi = c.x + r;
    let open = 0;
    let dug = 0;
    let boxes = 0;
    for (let j = 0; j < s.unitCount; j++) {
      const u = s.units[j];
      if (!u.alive || u.side === si || u.inside || u.x < lo || u.x > hi) continue;
      if (u.trenchId >= 0) dug += u.def.cost;
      else open += u.def.cost;
    }
    for (let j = 0; j < s.pillboxes.length; j++) {
      const p = s.pillboxes[j];
      if (p.alive && p.side !== si && p.x >= lo && p.x <= hi) boxes++;
    }
    BEST[2] = open + dug * AI.dugInWeight + boxes * AI.pillboxValue;
    if (BEST[2] > BEST[1]) {
      BEST[1] = BEST[2];
      BEST[0] = c.x;
    }
  }
}

/**
 * Smoke pays when the advance is closing on men in trenches or pillboxes within AI.supportReach of
 * its leading unit. It does not when enemy armour is that close: smoke blinds the anti-tank rockets
 * too and lets the tanks roll up to point-blank range, where their shells hit whole groups at once.
 */
function smokeHelps(w: World, si: number): boolean {
  const s = w.state;
  const dir = si === 0 ? 1 : -1;
  const lead = w.armedFront[si];
  let dug = false;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive || u.side === si || u.inside) continue;
    const ahead = (u.x - lead) * dir;
    if (ahead > AI.supportReach) continue;
    if (u.def.class === 'vehicle') return false;
    if (u.trenchId >= 0) dug = true;
  }
  for (let i = 0; i < s.pillboxes.length; i++) {
    const p = s.pillboxes[i];
    if (p.alive && p.side !== si && (p.x - lead) * dir <= AI.supportReach) dug = true;
  }
  return dug;
}

/**
 * Supports, under the same cooldowns and availability as the player: artillery on the densest
 * enemy cluster or an occupied trench, an air strike on a tank (the one nearest its own HQ) or a
 * big cluster, smoke between its leading unit and the enemy line while it advances on dug-in troops.
 */
function callSupports(w: World, si: number, ai: AiState): void {
  const s = w.state;
  if (s.time - ai.lastSupportTime < AI.supportGap) return;
  const side = s.sides[si];
  const dir = si === 0 ? 1 : -1;
  const artillery = canCallSupport(w, si, 'artillery');
  const air = canCallSupport(w, si, 'airStrike');
  if (artillery || air) {
    bestCluster(w, si);
    if (artillery && BEST[1] >= AI.artilleryMinValue) {
      issueSupport(w, si, ai, 'artillery', BEST[0]);
    } else if (air) {
      // A tank first (the one closest to this side's HQ), else a big cluster.
      let tankX = -1;
      let tankD = Infinity;
      const hq = side.hq;
      const home = hq ? hq.x : si === 0 ? 0 : s.length;
      const lead = w.armedFront[si];
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive || u.side === si || u.inside || u.def.class !== 'vehicle') continue;
        if ((u.x - lead) * dir > AI.supportReach) continue;
        const d = u.x > home ? u.x - home : home - u.x;
        if (d < tankD) {
          tankD = d;
          tankX = u.x;
        }
      }
      if (tankX >= 0) issueSupport(w, si, ai, 'airStrike', tankX);
      else if (BEST[1] >= AI.airStrikeMinValue) issueSupport(w, si, ai, 'airStrike', BEST[0]);
    }
  }
  callPlanes(w, si, ai);
  if (s.time - ai.lastSupportTime < AI.supportGap) return;
  if (side.order === 'advance' && SV.foeDugIn > 0 && canCallSupport(w, si, 'smoke') && smokeHelps(w, si)) {
    const lead = w.armedFront[si];
    const gap = (w.front[1 - si] - lead) * dir;
    if (gap >= AI.smokeMinGap && gap <= AI.smokeMaxGap) issueSupport(w, si, ai, 'smoke', lead + (dir * gap) / 2);
  }
}

function think(w: World, si: number, ai: AiState): void {
  const side = w.state.sides[si];
  const hq = side.hq;
  if (!side.hasHq || !hq || !hq.alive) return;
  survey(w, si);
  build(w, si, ai);
  decideOrder(w, si, ai);
  callSupports(w, si, ai);
}

/** Let each AI or bot commander think when its interval comes round. Both sides read the same state. */
export function runCommanders(w: World): void {
  const tick = w.state.tick;
  for (let si = 0; si < 2; si++) {
    const ai = w.ai[si];
    if (ai && tick % ai.thinkTicks === 0) think(w, si, ai);
  }
}

/**
 * Aircraft, under the same costs, cooldowns and availability as the player: a bomber on a heavy tank
 * within reach or on a big cluster, a fighter on a smaller one, and a recon plane over the enemy front
 * while advancing with money to spare.
 */
function callPlanes(w: World, si: number, ai: AiState): void {
  const s = w.state;
  if (s.time - ai.lastSupportTime < AI.supportGap) return;
  const bomber = canCallSupport(w, si, 'bomber');
  const fighter = canCallSupport(w, si, 'fighter');
  if (bomber || fighter) {
    bestCluster(w, si);
    if (bomber) {
      const dir = si === 0 ? 1 : -1;
      const lead = w.armedFront[si];
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive || u.side === si || u.inside || u.def.armour === undefined) continue;
        if ((u.x - lead) * dir > AI.supportReach) continue;
        issueSupport(w, si, ai, 'bomber', u.x);
        return;
      }
      if (BEST[1] >= AI_PLANES.bomberMinValue) {
        issueSupport(w, si, ai, 'bomber', BEST[0]);
        return;
      }
    }
    if (fighter && BEST[1] >= AI_PLANES.fighterMinValue) {
      issueSupport(w, si, ai, 'fighter', BEST[0]);
      return;
    }
  }
  const side = s.sides[si];
  if (side.order === 'advance' && side.supplies >= AI_PLANES.reconMinSupplies && canCallSupport(w, si, 'recon')) {
    issueSupport(w, si, ai, 'recon', w.front[1 - si]);
  }
}
