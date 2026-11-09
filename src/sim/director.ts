/**
 * The mission director (FOUNDATIONS.md 3): a mission is a list of phases, one current at a time. A phase has required
 * objectives (all done: the phase is complete and the director moves to `next`; the last one wins the mission), loss
 * conditions, side objectives that pay a medal bonus, an optional clock, an optional prep phase at its start, and
 * events of its own. The director also carries out the events and triggers the phases brought (banners, scripted
 * barrages and air raids, income cuts, AI postures, call-ins offered and withdrawn, a disguise, reveals, structures
 * changing hands, a scripted end).
 *
 * A mission written without `phases` becomes one phase (normalPhases) with no objective but the enemy HQ, so it plays
 * exactly as before: the HQ rule and the mission timer in checkEnd (src/sim/mission.ts) still decide it. Everything
 * here is plain data in `state.director` and the battle RNG, so it is deterministic and can be saved.
 */
import { CONFIG } from '../data/config';
import { SUPPORTS, SUPPORT_KINDS } from '../data/supports';
import type {
  LossDef,
  MissionDef,
  MissionEventDef,
  MissionPrepDef,
  MissionTrigger,
  ObjectiveDef,
  PhaseDef,
  PointRef,
  Side,
  SideObjectiveDef,
  StructureRef,
  UnitKind,
} from '../data/schema';
import { buildingIndex, infantryInside, refTrenchId } from './buildings';
import { releaseAll } from './control';
// A cycle by design: mission.ts carries out every event (waves need its spawnForce) and hands the director's types here.
import { fireEvent } from './mission';
import { inPrep, missionTime, startPhasePrep } from './prep';
import { LAUNCH, launch } from './projectiles';
import { PLANE_NONE, SUPPORT_COUNT, callSupport } from './supports';
import { KIND_DEFS, weaponIndex } from './tables';
import type { BattleState, DirectorState, EndReason, ObjectiveState, SideObjectiveState, TimerState, UnitState } from './types';
import type { World } from './world';

// ---------------------------------------------------------------------------
// Mission data
// ---------------------------------------------------------------------------

/**
 * The mission's phases: its own, or one made from the old fields (no objective but the enemy HQ, if it has one; the
 * HQ rule and MissionDef.timer decide the battle as they always did).
 */
export function normalPhases(m: MissionDef): PhaseDef[] {
  if (m.phases && m.phases.length > 0) return m.phases;
  const objectives: ObjectiveDef[] = m.start[1].hasHq ? [{ id: 'hq', type: 'destroyHq', side: 1 }] : [];
  return [{ id: 'battle', title: '', objectives, next: null }];
}

/**
 * Every event the director watches: the mission's own (same indices) and then each phase's onEnter events, whose `at`
 * and `every` count from that phase's start (other triggers are kept as they are).
 */
export function directorEvents(m: MissionDef, phases: readonly PhaseDef[]): MissionEventDef[] {
  const out: MissionEventDef[] = [...m.events];
  for (const p of phases) {
    for (const ev of p.onEnter ?? []) {
      const when = ev.when;
      let phased: MissionTrigger = when;
      if ('at' in when) phased = { phase: p.id, delay: when.at };
      else if ('every' in when) phased = { phaseEvery: when.every, phase: p.id, from: when.from, until: when.until };
      out.push({ ...ev, when: phased } as MissionEventDef);
    }
  }
  return out;
}

/** The prep phase the battle starts with: the mission's, or its first phase's. */
export function firstPrep(m: MissionDef): MissionPrepDef | undefined {
  return m.prep ?? m.phases?.[0]?.prep;
}

// ---------------------------------------------------------------------------
// Reading the field
// ---------------------------------------------------------------------------

/** Who holds a point (a trench, or a building by its slot record): 0, 1 or -1 (nobody, or a point that does not exist). */
export function pointOwner(s: BattleState, ref: PointRef): number {
  const trenches = s.trenches;
  const id = refTrenchId(ref);
  for (let i = 0; i < trenches.length; i++) if (trenches[i].id === id) return trenches[i].owner;
  return -1;
}

/** Battle time a point was last taken, or -1. */
function pointTakenAt(s: BattleState, ref: PointRef): number {
  const trenches = s.trenches;
  const id = refTrenchId(ref);
  for (let i = 0; i < trenches.length; i++) if (trenches[i].id === id) return trenches[i].capturedAt;
  return -1;
}

/**
 * True once a structure is gone as far as side `by` is concerned: a pillbox, wire belt or HQ destroyed; a trench held
 * by `by` (taken from the other side).
 */
export function structureGone(s: BattleState, ref: StructureRef, by: Side): boolean {
  if ('trench' in ref || 'building' in ref) return pointOwner(s, ref) === by;
  if ('pillbox' in ref) {
    for (const p of s.pillboxes) if (p.id === ref.pillbox) return !p.alive;
    return false;
  }
  if ('wire' in ref) {
    for (const wire of s.wires) if (wire.id === ref.wire) return !wire.alive;
    return false;
  }
  const hq = s.sides[ref.hq].hq;
  return hq !== null && !hq.alive;
}

/**
 * A structure's 0..1 health for side 0's scoring (MedalTargets.structureWeight): a pillbox's or HQ's health, a wire
 * belt standing (1) or not (0), a trench held by side 0 (1) or not (0).
 */
export function structureHealth(s: BattleState, ref: StructureRef): number {
  if ('trench' in ref) return pointOwner(s, ref) === 0 ? 1 : 0;
  if ('building' in ref) {
    // A building side 0 holds: its walls' health (rubble scores nothing).
    const i = buildingIndex(s.buildings, ref.building);
    if (i < 0 || pointOwner(s, ref) !== 0) return 0;
    const b = s.buildings[i];
    return b.breakable ? (b.maxHp > 0 ? Math.max(0, b.hp) / b.maxHp : 0) : b.rubble ? 0 : 1;
  }
  if ('pillbox' in ref) {
    for (const p of s.pillboxes) if (p.id === ref.pillbox) return p.alive && p.maxHp > 0 ? Math.max(0, p.hp) / p.maxHp : 0;
    return 0;
  }
  if ('wire' in ref) {
    for (const wire of s.wires) if (wire.id === ref.wire) return wire.alive ? 1 : 0;
    return 0;
  }
  const hq = s.sides[ref.hq].hq;
  return hq && hq.alive && hq.maxHp > 0 ? Math.max(0, hq.hp) / hq.maxHp : 0;
}

/** Units of `side` that died in the mission, of `kinds` (all kinds if none given). */
export function deaths(s: BattleState, side: Side, kinds: readonly UnitKind[] | undefined): number {
  const stats = s.sides[side].stats;
  if (kinds === undefined) return stats.lost;
  let n = 0;
  for (let i = 0; i < kinds.length; i++) n += stats.lostByKind[kinds[i]];
  return n;
}

function ofKinds(u: UnitState, kinds: readonly UnitKind[] | undefined): boolean {
  return kinds === undefined || kinds.includes(u.kind);
}

/** Living units of `side` on the field at or past x, going the way that side attacks (of `kinds`). */
function unitsPast(s: BattleState, side: Side, x: number, kinds: readonly UnitKind[] | undefined): number {
  let n = 0;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || u.side !== side) continue;
    if (side === 0 ? u.x < x : u.x > x) continue;
    if (ofKinds(u, kinds)) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Objectives and losses
// ---------------------------------------------------------------------------

const VEHICLE_KINDS: readonly UnitKind[] = KIND_DEFS.filter((d) => d.class === 'vehicle').map((d) => d.kind);

function defaultText(o: ObjectiveDef): string {
  switch (o.type) {
    case 'destroyHq':
      return 'Destroy the enemy HQ';
    case 'capture':
      return 'Take the position';
    case 'hold':
      return 'Hold the position';
    case 'survive':
      return 'Hold out';
    case 'kill':
      return o.kinds !== undefined && o.kinds.every((k) => VEHICLE_KINDS.includes(k)) ? 'Tanks destroyed' : 'Enemy destroyed';
    case 'destroy':
      return 'Targets destroyed';
    case 'reach':
      return 'Units through';
    case 'surrender':
      return 'Break their HQ';
  }
}

function newObjective(o: ObjectiveDef): ObjectiveState {
  let target = 1;
  let unit: ObjectiveState['unit'] = 'flag';
  switch (o.type) {
    case 'hold':
    case 'survive':
      target = o.seconds;
      unit = 'seconds';
      break;
    case 'kill':
    case 'reach':
      target = o.count;
      unit = 'count';
      break;
    case 'destroy':
      target = o.structures.length;
      unit = 'count';
      break;
    default:
      break;
  }
  return { id: o.id, type: o.type, text: o.text ?? defaultText(o), value: 0, target, unit, done: false, since: -1 };
}

/** Bring an objective's progress up to date (phase time `pt`); true once it is done. */
function evalObjective(s: BattleState, o: ObjectiveDef, st: ObjectiveState, pt: number): boolean {
  switch (o.type) {
    case 'destroyHq': {
      const hq = s.sides[o.side].hq;
      st.value = hq !== null && !hq.alive ? 1 : 0;
      break;
    }
    case 'capture':
      st.value = pointOwner(s, o.point) === 0 ? 1 : 0;
      break;
    case 'hold':
      if (pointOwner(s, o.point) === 0) {
        if (st.since < 0) st.since = pt;
        st.value = pt - st.since;
      } else {
        st.since = -1;
        st.value = 0;
      }
      break;
    case 'survive':
      st.value = pt;
      break;
    case 'kill':
      st.value = deaths(s, o.side, o.kinds);
      break;
    case 'destroy': {
      let n = 0;
      for (const ref of o.structures) if (structureGone(s, ref, 0)) n++;
      st.value = n;
      break;
    }
    case 'reach':
      st.value = unitsPast(s, 0, o.x, o.kinds);
      break;
    case 'surrender': {
      const hq = s.sides[o.side].hq;
      st.value = hq !== null && (!hq.alive || hq.hp < hq.maxHp * o.hqBelow) ? 1 : 0;
      break;
    }
  }
  if (st.value > st.target) st.value = st.target;
  return st.value >= st.target;
}

/** What a loss condition keeps from its start: side 0's losses for `lost`, 1 if side 0 then held the point. */
function lossBase(s: BattleState, loss: LossDef): number {
  if (loss.type === 'lost') return deaths(s, 0, loss.kinds);
  if (loss.type === 'pointLost') return pointOwner(s, loss.point) === 0 ? 1 : 0;
  return 0;
}

/**
 * True when a loss condition has happened. A point side 0 did not hold when the condition began is lost only once side
 * 0 has taken it and side 1 then takes it back (`base` is updated to say side 0 has held it).
 */
function lossHappened(s: BattleState, loss: LossDef, base: number[], k: number): boolean {
  switch (loss.type) {
    case 'pointLost': {
      const owner = pointOwner(s, loss.point);
      if (owner === 0) base[k] = 1;
      return base[k] === 1 && owner === 1;
    }
    case 'enemyReached':
      return unitsPast(s, 1, loss.x, loss.kinds) >= loss.count;
    case 'structureLost':
      for (const ref of loss.structures) if (structureGone(s, ref, 1)) return true;
      return false;
    case 'lost':
      return deaths(s, 0, loss.kinds) - base[k] >= loss.count;
    case 'contested':
      return pointOwner(s, loss.point) === 0 && infantryInside(s, loss.point, 1) > 0;
  }
}

function lossText(loss: LossDef): string {
  switch (loss.type) {
    case 'pointLost':
      return 'The position was lost.';
    case 'enemyReached':
      return 'The enemy broke through.';
    case 'structureLost':
      return 'The position was lost.';
    case 'lost':
      return 'Too many men were lost.';
    case 'contested':
      return 'The enemy got inside.';
  }
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** The director's state at battle creation (phase 0 is entered by startDirector, once the forces are placed). */
export function createDirector(phaseCount: number, incomeBase: [number, number]): DirectorState {
  return {
    phase: 0,
    phaseId: '',
    title: '',
    count: phaseCount,
    startedAt: 0,
    phaseStarts: {},
    objectives: [],
    side: [],
    doneAt: {},
    lossBase: [],
    timer: null,
    posture: ['free', 'free'],
    postureUntil: [-1, -1],
    incomeBase,
    barrages: [],
    disguiseSide: -1,
    disguiseX0: 0,
    disguiseX1: 0,
    disguiseFrom: 0,
    disguiseUntil: 0,
    endText: null,
  };
}

/** Enter the first phase (its prep, if any, was made with the battle). */
export function startDirector(w: World): void {
  enterPhase(w, 0, false);
}

function phaseIndex(w: World, id: string): number {
  for (let i = 0; i < w.phases.length; i++) if (w.phases[i].id === id) return i;
  return -1;
}

function newSideObjective(w: World, def: SideObjectiveDef): SideObjectiveState {
  const s = w.state;
  const fail = def.failIf;
  return {
    id: def.id,
    text: def.text,
    bonus: def.bonus,
    status: 'open',
    untilPhase: def.until !== undefined ? phaseIndex(w, def.until) : -1,
    base: fail ? lossBase(s, fail) : 0,
    progress: def.objective ? newObjective(def.objective) : null,
    met: false,
  };
}

/**
 * Make phase `index` the current one: its objectives, loss conditions and clock start now, its side objectives begin,
 * its prep phase (if any, after the first) starts, and its phaseEvery counters reset. `announce` emits phaseStarted.
 */
export function enterPhase(w: World, index: number, announce: boolean): void {
  const s = w.state;
  const d = s.director;
  const p = w.phases[index];
  d.phase = index;
  d.phaseId = p.id;
  d.title = p.title;
  d.startedAt = missionTime(s);
  d.phaseStarts[p.id] = d.startedAt;
  d.objectives = p.objectives.map(newObjective);
  d.lossBase = (p.lose ?? []).map((loss) => lossBase(s, loss));
  for (const def of p.sideObjectives ?? []) d.side.push(newSideObjective(w, def));
  d.timer = p.timer
    ? { secondsLeft: p.timer.seconds, total: p.timer.seconds, progress: 0, onExpire: p.timer.onExpire === 'lose' ? 'lose' : 'win', label: p.timer.label }
    : null;
  const events = w.missionEvents;
  for (let i = 0; i < events.length; i++) {
    const when = events[i].when;
    if ('phaseEvery' in when && when.phase === p.id) w.eventNext[i] = when.from ?? 0;
  }
  if (index > 0 && p.prep) startPhasePrep(w, p.prep);
  if (announce) {
    const e = w.events.emit('phaseStarted');
    e.value = index;
    e.text = p.title !== '' ? `Phase ${index + 1}: ${p.title}` : `Phase ${index + 1}`;
  }
}

/** Why a won phase ended the battle: a surrender, a clock held out, or the objectives. */
function winReason(p: PhaseDef, timerDone: boolean): EndReason {
  if (p.objectives.some((o) => o.type === 'surrender')) return 'surrender';
  if (timerDone || p.objectives.some((o) => o.type === 'survive')) return 'timerSurvived';
  return 'objectives';
}

function completePhase(w: World, timerDone: boolean): void {
  const p = w.phases[w.state.director.phase];
  const next = p.next === null ? -1 : phaseIndex(w, p.next);
  if (next < 0) endBattle(w, 0, winReason(p, timerDone));
  else enterPhase(w, next, true);
}

function emitDone(w: World, text: string, side: boolean): void {
  const e = w.events.emit('objectiveDone');
  e.text = text;
  e.value = side ? 1 : 0;
}

/** Fire, now, the not-yet-fired events waiting for this objective with no delay (a surrender's closing words). */
function fireObjectiveEvents(w: World, id: string): void {
  const events = w.missionEvents;
  for (let i = 0; i < events.length; i++) {
    const when = events[i].when;
    if ('objective' in when && when.objective === id && (when.delay ?? 0) <= 0 && w.eventFired[i] === 0) {
      w.eventFired[i] = 1;
      fireEvent(w, events[i]);
    }
  }
}

/** Watch the side objectives: an objective met, a failIf that happened, a deadline passed. */
function updateSideObjectives(w: World, time: number): void {
  const s = w.state;
  const d = s.director;
  const list = d.side;
  for (let i = 0; i < list.length; i++) {
    const so = list[i];
    if (so.status === 'failed') continue;
    const def = sideDef(w, so.id);
    if (!def) continue;
    const fail = def.failIf;
    if (fail && (so.untilPhase < 0 || d.phase < so.untilPhase)) {
      SIDE_BASE[0] = so.base;
      const happened = lossHappened(s, fail, SIDE_BASE, 0);
      so.base = SIDE_BASE[0];
      if (happened) {
        so.status = 'failed';
        continue;
      }
    }
    if (def.objective && so.progress && !so.met) {
      if (evalObjective(s, def.objective, so.progress, time - (d.phaseStarts[sidePhase(w, so.id)] ?? 0))) {
        if (time > deadline(w, def)) {
          so.status = 'failed';
          continue;
        }
        so.met = true;
        so.progress.done = true;
        d.doneAt[def.objective.id] = time;
        d.doneAt[so.id] = time;
        fireObjectiveEvents(w, def.objective.id);
        fireObjectiveEvents(w, so.id);
        // Earned for good unless something can still fail it.
        if (!def.atEnd && (!fail || (so.untilPhase >= 0 && d.phase >= so.untilPhase))) {
          so.status = 'done';
          emitDone(w, so.text, true);
        }
      } else if (time > deadline(w, def)) {
        so.status = 'failed';
      }
    }
  }
}

/** Scratch for lossHappened on a side objective's single base. */
const SIDE_BASE: number[] = [0];

function sideDef(w: World, id: string): SideObjectiveDef | undefined {
  for (const p of w.phases) for (const so of p.sideObjectives ?? []) if (so.id === id) return so;
  return undefined;
}

/** Mission time a side objective must be met by: `within`, or `withinPhase` after its phase began; Infinity for none. */
function deadline(w: World, def: SideObjectiveDef): number {
  if (def.within !== undefined) return def.within;
  if (def.withinPhase !== undefined) {
    const start = w.state.director.phaseStarts[sidePhase(w, def.id)];
    return start === undefined ? Infinity : start + def.withinPhase;
  }
  return Infinity;
}

function sidePhase(w: World, id: string): string {
  for (const p of w.phases) for (const so of p.sideObjectives ?? []) if (so.id === id) return p.id;
  return '';
}

/** The battle is over: each side objective still open is decided (earned only by a win). */
function closeSideObjectives(w: World, won: boolean, time: number): void {
  for (const so of w.state.director.side) {
    if (so.status !== 'open') continue;
    const def = sideDef(w, so.id);
    if (!won || !def) {
      so.status = 'failed';
      continue;
    }
    let ok = def.objective ? so.met : true;
    // Still true at the end (a point still held), if asked.
    if (ok && def.atEnd && def.objective && so.progress) ok = evalObjective(w.state, def.objective, so.progress, time);
    if (!def.objective && time > deadline(w, def)) ok = false;
    so.status = ok ? 'done' : 'failed';
  }
}

/**
 * After the tick's damage (from checkEnd, once the HQ rule and the mission timer have spoken): the phase's loss
 * conditions, its clock, its objectives and the side objectives. Completing the phase enters the next or wins.
 * Nothing is judged while a prep phase runs (the phase has not begun).
 */
export function checkDirector(w: World): void {
  const s = w.state;
  if (s.over || inPrep(s)) return;
  const d = s.director;
  const time = missionTime(s);
  const pt = time - d.startedAt;
  const p = w.phases[d.phase];

  updateSideObjectives(w, time);

  const lose = p.lose;
  if (lose) {
    for (let k = 0; k < lose.length; k++) {
      if (lossHappened(s, lose[k], d.lossBase, k)) {
        d.endText = lossText(lose[k]);
        endBattle(w, 1, 'objectiveFailed');
        return;
      }
    }
  }

  let timerDone = false;
  const timer = d.timer;
  if (timer) {
    const left = timer.total - pt;
    timer.secondsLeft = left > 0 ? left : 0;
    timer.progress = timer.total > 0 ? 1 - timer.secondsLeft / timer.total : 1;
    if (timer.secondsLeft <= 0) {
      if (timer.onExpire === 'lose') {
        endBattle(w, 1, 'timerExpired');
        return;
      }
      timerDone = true;
    }
  }

  const objectives = p.objectives;
  let all = objectives.length > 0;
  for (let i = 0; i < objectives.length; i++) {
    const st = d.objectives[i];
    if (!st.done && evalObjective(s, objectives[i], st, pt)) {
      st.done = true;
      d.doneAt[st.id] = time;
      emitDone(w, st.text, false);
      fireObjectiveEvents(w, st.id);
      if (s.over) return;
    }
    if (!st.done) all = false;
  }
  if (all || timerDone) completePhase(w, timerDone);
}

/** The battle is over: winner (-1 for a draw) and why. Releases direct control, settles the side objectives, emits battleEnded. */
export function endBattle(w: World, winner: number, reason: EndReason): void {
  const s = w.state;
  if (s.over) return;
  s.over = true;
  s.winner = winner;
  s.endReason = reason;
  closeSideObjectives(w, winner === 0, missionTime(s));
  releaseAll(w);
  const e = w.events.emit('battleEnded');
  e.side = winner;
  e.value = s.time;
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/** Event indices whose trigger first came true at a time kept in eventNext (structureDestroyed): -1 until then. */
export function resetTriggerClocks(w: World): void {
  const events = w.missionEvents;
  for (let i = 0; i < events.length; i++) {
    const when = events[i].when;
    if ('every' in when) w.eventNext[i] = when.from;
    else if ('structureDestroyed' in when) w.eventNext[i] = -1;
  }
}

/** True if a unit of the side other than `side` is within `dist` of x or past it (coming from its own end). */
function enemyNear(s: BattleState, x: number, dist: number, side: Side): boolean {
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || u.side === side) continue;
    if (u.side === 1 ? u.x <= x + dist : u.x >= x - dist) return true;
  }
  return false;
}

/** Whether a one-shot trigger of event `i` has come due (the triggers of the old four are in updateMission). */
function due(w: World, i: number, when: MissionTrigger, time: number): boolean {
  const s = w.state;
  const d = s.director;
  if ('phaseEvery' in when) return false;
  if ('phase' in when) return d.phaseId === when.phase && time - d.startedAt >= (when.delay ?? 0);
  if ('objective' in when) {
    const at = d.doneAt[when.objective];
    return at !== undefined && time >= at + (when.delay ?? 0);
  }
  if ('pointCapturedBy' in when) {
    const taken = pointTakenAt(s, when.point);
    return pointOwner(s, when.point) === when.pointCapturedBy && taken >= 0 && s.time >= taken + (when.delay ?? 0);
  }
  if ('kills' in when) return deaths(s, when.side, when.kinds) >= when.kills;
  if ('structureDestroyed' in when) {
    if (w.eventNext[i] < 0) {
      if (!structureDestroyedNow(w, when.structureDestroyed)) return false;
      w.eventNext[i] = time;
    }
    return time >= w.eventNext[i] + (when.delay ?? 0);
  }
  if ('enemyNear' in when) return enemyNear(s, when.enemyNear.x, when.enemyNear.dist, when.enemyNear.side);
  return false;
}

/** A structure destroyed, or a trench taken from the side that held it at the start. */
function structureDestroyedNow(w: World, ref: StructureRef): boolean {
  if ('building' in ref) {
    // A building taken from the side that held it at the start, or fallen.
    const def = w.mission.buildings?.find((b) => b.id === ref.building);
    const i = buildingIndex(w.state.buildings, ref.building);
    const owner = pointOwner(w.state, ref);
    return def !== undefined && i >= 0 && ((owner >= 0 && owner !== def.owner) || w.state.buildings[i].rubble);
  }
  if (!('trench' in ref)) return structureGone(w.state, ref, 0);
  const start = w.mission.trenches.find((t) => t.id === ref.trench);
  const owner = pointOwner(w.state, ref);
  return start !== undefined && owner >= 0 && owner !== start.owner;
}

/**
 * The director's triggers (phase, phaseEvery, objective, pointCapturedBy, kills, structureDestroyed, enemyNear), for
 * updateMission's event loop: fires event `i` if due. Returns false for a trigger it does not handle.
 */
export function directorTrigger(w: World, i: number, time: number): boolean {
  const ev = w.missionEvents[i];
  const when = ev.when;
  if ('phaseEvery' in when) {
    const d = w.state.director;
    if (d.phaseId !== when.phase) return true;
    const pt = time - d.startedAt;
    if (pt >= w.eventNext[i] && (when.until === undefined || pt <= when.until)) {
      w.eventNext[i] += when.phaseEvery;
      fireEvent(w, ev);
    }
    return true;
  }
  if (!('phase' in when || 'objective' in when || 'pointCapturedBy' in when || 'kills' in when || 'structureDestroyed' in when || 'enemyNear' in when)) {
    return false;
  }
  if (w.eventFired[i] === 0 && due(w, i, when, time)) {
    w.eventFired[i] = 1;
    fireEvent(w, ev);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const BANNER_SOUND = { horn: 0, alarm: 1, boss: 2 } as const;

function banner(w: World, text: string, sound: number): void {
  const e = w.events.emit('banner');
  e.text = text;
  e.value = sound;
}

/** Carry out one scripted event of the director's types now (fireEvent in mission.ts hands these over). */
export function fireDirectorEvent(w: World, ev: MissionEventDef): void {
  const s = w.state;
  const d = s.director;
  switch (ev.type) {
    case 'banner':
      banner(w, ev.text, BANNER_SOUND[ev.sound ?? 'horn']);
      break;
    case 'barrage': {
      const wi = weaponIndex(ev.weapon);
      if (wi < 0 || ev.rounds <= 0) break;
      if (ev.warning !== undefined) banner(w, ev.warning, BANNER_SOUND.alarm);
      const delay = ev.delay ?? (ev.warning !== undefined ? 3 : 0);
      d.barrages.push({
        side: ev.side,
        x: ev.x,
        spread: ev.spread,
        rounds: ev.rounds,
        fired: 0,
        start: s.time + delay,
        interval: ev.rounds > 1 ? ev.duration / (ev.rounds - 1) : 0,
        weapon: wi,
        top: ev.weapon === 'heavyBomb' || ev.weapon === 'aerialBomb' ? 1 : 0,
      });
      break;
    }
    case 'airRaid': {
      const k = SUPPORT_KINDS.indexOf(ev.support);
      const slot = ev.side * SUPPORT_COUNT + k;
      // The side's own strike of that kind is still in progress: the raid does not cut it short.
      if (k < 0 || w.planeState[slot] !== PLANE_NONE || w.strikeTime[slot] >= 0) break;
      const side = s.sides[ev.side];
      const cooldown = side.supportCooldown[ev.support];
      callSupport(w, ev.side, ev.support, ev.x);
      side.supportCooldown[ev.support] = cooldown;
      break;
    }
    case 'income':
      w.mods[ev.side].income = d.incomeBase[ev.side] * ev.mul;
      break;
    case 'posture':
      d.posture[ev.side] = ev.posture;
      d.postureUntil[ev.side] = ev.posture === 'counterattack' && ev.seconds !== undefined ? missionTime(s) + ev.seconds : -1;
      break;
    case 'support':
      s.sides[ev.side].supportAvailable[ev.kind] = ev.enabled;
      break;
    case 'disguise':
      d.disguiseSide = ev.side;
      d.disguiseX0 = Math.min(ev.x0, ev.x1);
      d.disguiseX1 = Math.max(ev.x0, ev.x1);
      d.disguiseFrom = s.time;
      d.disguiseUntil = s.time + ev.seconds;
      break;
    case 'reveal': {
      const e = w.events.emit('reconReveal');
      e.side = ev.side;
      e.support = 'recon';
      e.x = s.length / 2;
      e.value = s.length;
      e.x2 = ev.seconds;
      break;
    }
    case 'setOwner':
      setOwner(w, ev.ref, ev.owner);
      break;
    case 'endMission': {
      d.endText = ev.text;
      const e = w.events.emit('announce');
      e.text = ev.text;
      endBattle(w, ev.winner, 'scripted');
      break;
    }
    default:
      break;
  }
}

/** A trench or pillbox changes hands (setOwner, PhaseDef.assume). */
export function setOwner(w: World, ref: { trench: number } | { pillbox: number } | { building: number }, owner: Side | -1): void {
  const s = w.state;
  if ('trench' in ref || 'building' in ref) {
    const id = refTrenchId(ref);
    for (const t of s.trenches) {
      if (t.id !== id || t.owner === owner) continue;
      const prev = t.owner;
      t.owner = owner;
      if (owner >= 0) {
        t.capturedAt = s.time;
        const e = w.events.emit('trenchCaptured');
        e.side = owner;
        e.targetIndex = t.id;
        e.x = t.x;
        e.value = prev;
      }
    }
  } else if (owner >= 0) {
    for (const p of s.pillboxes) if (p.id === ref.pillbox) p.side = owner as Side;
  }
}

// ---------------------------------------------------------------------------
// Every tick
// ---------------------------------------------------------------------------

/** Launch round `n` of a scripted barrage: at random within its spread, from off the firer's own end of the arc. */
function fireBarrageRound(w: World, i: number): void {
  const s = w.state;
  const b = s.director.barrages[i];
  const dir = b.side === 0 ? 1 : -1;
  let land = b.x + (w.rng.next() * 2 - 1) * b.spread;
  if (land < 0) land = 0;
  else if (land > s.length) land = s.length;
  let from = land - dir * SUPPORTS.artillery.launchOffset;
  if (from < 0) from = 0;
  else if (from > s.length) from = s.length;
  LAUNCH[0] = from;
  LAUNCH[1] = land;
  LAUNCH[2] = 1;
  LAUNCH[3] = 0;
  LAUNCH[4] = SUPPORTS.artillery.hqDamageMul;
  LAUNCH[5] = 1;
  LAUNCH[6] = b.top;
  launch(w, b.side, b.weapon, b.fired % CONFIG.rows, -1, null, 'none');
}

/**
 * Before the scripted events each tick: barrages in progress drop their rounds, a counter-attack posture past its time
 * goes back to free, an expired disguise ends.
 */
export function updateDirector(w: World): void {
  const s = w.state;
  const d = s.director;
  const barrages = d.barrages;
  for (let i = barrages.length - 1; i >= 0; i--) {
    const b = barrages[i];
    while (b.fired < b.rounds && s.time >= b.start + b.fired * b.interval - 1e-9) {
      fireBarrageRound(w, i);
      b.fired++;
    }
    if (b.fired >= b.rounds) barrages.splice(i, 1);
  }
  if (d.postureUntil[0] >= 0 || d.postureUntil[1] >= 0) {
    const time = missionTime(s);
    for (let si = 0; si < 2; si++) {
      if (d.postureUntil[si] >= 0 && time >= d.postureUntil[si]) {
        d.posture[si] = 'free';
        d.postureUntil[si] = -1;
      }
    }
  }
  if (d.disguiseSide >= 0 && s.time >= d.disguiseUntil) d.disguiseSide = -1;
}

/**
 * The disguise (1009's Kalach bridge): a unit of the disguised side inside the window is not chosen as a target until
 * it fires (either weapon) or the time is up. Called by targeting only while a disguise is in force.
 */
export function disguised(s: BattleState, u: UnitState): boolean {
  const d = s.director;
  if (u.side !== d.disguiseSide || u.x < d.disguiseX0 || u.x > d.disguiseX1) return false;
  const since = s.time - d.disguiseFrom;
  return u.mount.sinceShot >= since && u.mount2.sinceShot >= since;
}

/** The current phase's own clock, or null (the HUD falls back to the mission timer). */
export function phaseTimer(s: BattleState): TimerState | null {
  return s.director.timer;
}

// ---------------------------------------------------------------------------
// Scoring (src/meta/medals.ts scoreWin)
// ---------------------------------------------------------------------------

/** What the medal score reads from a finished battle beyond time, losses and HQ health. */
export interface DirectorScore {
  /** Seconds on the mission clock (prep phases left out). */
  missionSeconds: number;
  /** Mission time each phase began, by id. */
  phaseStarts: Record<string, number>;
  /** Every side objective begun, earned or not. */
  sideObjectives: { id: string; text: string; bonus: number; done: boolean }[];
  /** Units of the enemy (side 1) that died, per kind. */
  enemyLost: Record<UnitKind, number>;
}

export function directorScore(s: BattleState): DirectorScore {
  const d = s.director;
  return {
    missionSeconds: missionTime(s),
    phaseStarts: { ...d.phaseStarts },
    sideObjectives: d.side.map((so) => ({ id: so.id, text: so.text, bonus: so.bonus, done: so.status === 'done' })),
    enemyLost: { ...s.sides[1].stats.lostByKind },
  };
}
