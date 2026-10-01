/**
 * Mission scripting: starting forces, scripted events (hints, announcements,
 * airdrops, waves), the mission timer, and the win and lose rules.
 */
import { CONFIG } from '../data/config';
import type { ForceDef, MissionEventDef, Side } from '../data/schema';
import { KIND_INDEX, KIND_SAPPER } from './tables';
import type { EndReason } from './types';
import { spawnUnit } from './units';
import type { World } from './world';

/**
 * Spawn one group of units. Where they appear:
 * - `x` given: there, one spacing apart going back;
 * - `trenchId` given: at that trench (Phase 2 will seat them in its slots);
 * - otherwise at the HQ door, or at the map edge for a side with no HQ.
 * At mission start, army units with no position stand ready in the hold formation instead.
 * Returns the number of units spawned.
 */
function spawnForce(w: World, si: Side, force: ForceDef, atStart: boolean): number {
  const s = w.state;
  const side = s.sides[si];
  const dir = si === 0 ? 1 : -1;
  const kindIndex = KIND_INDEX[force.kind];
  const behaviour = force.behaviour ?? 'army';
  const count = atStart ? force.count : Math.max(1, Math.round(force.count * w.mods[si].wave));
  const edge = si === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;

  let baseX = side.hq ? side.hq.doorX : edge;
  let step = (dir * CONFIG.spacing) / 2;
  let inFormation = atStart && behaviour === 'army' && side.hq !== null;
  if (force.x !== undefined) {
    baseX = force.x;
    step = -dir * CONFIG.spacing;
    inFormation = false;
  } else if (force.trenchId !== undefined) {
    // Phase 2: seat the units in the trench's slots. NOT YET IMPLEMENTED: they stand at the trench.
    for (let i = 0; i < s.trenches.length; i++) {
      if (s.trenches[i].id === force.trenchId) baseX = s.trenches[i].x;
    }
    step = -dir * CONFIG.spacing;
    inFormation = false;
  }

  let spawned = 0;
  for (let j = 0; j < count; j++) {
    const u = spawnUnit(w, si, kindIndex, baseX + j * step, behaviour, false, false);
    if (!u) break;
    spawned++;
    if (inFormation) {
      let x = side.holdLineX - dir * u.slotDepth;
      if (side.hq && (x - side.hq.doorX) * dir < 0) x = side.hq.doorX;
      u.x = x;
      u.prevX = x;
      u.goalX = x;
      u.aimX = x;
    }
  }
  return spawned;
}

/** Place each side's starting sappers and forces. Called once, with the hold lines already known. */
export function placeStartingForces(w: World): void {
  const s = w.state;
  for (let si = 0; si < 2; si++) {
    const start = w.mission.start[si];
    const side = s.sides[si];
    const dir = si === 0 ? 1 : -1;
    if (side.hq && start.sappers > 0) {
      // Spread along the road to the dump so their deliveries do not all arrive together.
      for (let j = 0; j < start.sappers; j++) {
        const x = side.hq.doorX + (dir * CONFIG.dumpDistance * (j + 1)) / (start.sappers + 1);
        spawnUnit(w, si as Side, KIND_SAPPER, x, 'army', false, false);
      }
    }
    for (const force of start.forces) spawnForce(w, si as Side, force, true);
  }
}

function fireEvent(w: World, ev: MissionEventDef): void {
  const s = w.state;
  switch (ev.type) {
    case 'hint': {
      const e = w.events.emit('hint');
      e.text = ev.text;
      break;
    }
    case 'announce': {
      const e = w.events.emit('announce');
      e.text = ev.text;
      break;
    }
    case 'airdrop': {
      const side = s.sides[ev.side];
      const amount = ev.supplies * w.mods[ev.side].income;
      side.supplies += amount;
      side.stats.suppliesGathered += amount;
      const e = w.events.emit('airdrop');
      e.side = ev.side;
      e.value = amount;
      e.x = side.hq ? side.hq.doorX : ev.side === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;
      break;
    }
    case 'wave': {
      let count = 0;
      for (const force of ev.forces) count += spawnForce(w, ev.side, force, false);
      const e = w.events.emit('wave');
      e.side = ev.side;
      e.value = count;
      e.text = ev.announce ?? null;
      break;
    }
  }
}

/** Advance the mission timer and fire any scripted events that are due. */
export function updateMission(w: World): void {
  const s = w.state;
  const time = s.time;
  if (s.timer) {
    const left = s.timer.total - time;
    s.timer.secondsLeft = left > 0 ? left : 0;
  }

  const events = w.mission.events;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const when = ev.when;
    if ('at' in when) {
      if (w.eventFired[i] === 0 && time >= when.at) {
        w.eventFired[i] = 1;
        fireEvent(w, ev);
      }
    } else if ('every' in when) {
      if (time >= w.eventNext[i] && (when.until === undefined || time <= when.until)) {
        w.eventNext[i] += when.every;
        fireEvent(w, ev);
      }
    } else if ('trenchCapturedBy' in when) {
      // Trenches cannot change hands until Phase 2, so this never fires yet; the trigger itself is complete.
      if (w.eventFired[i] !== 0) continue;
      for (let t = 0; t < s.trenches.length; t++) {
        const trench = s.trenches[t];
        if (trench.id !== when.trenchId || trench.owner !== when.trenchCapturedBy || trench.capturedAt < 0) continue;
        if (time >= trench.capturedAt + (when.delay ?? 0)) {
          w.eventFired[i] = 1;
          fireEvent(w, ev);
        }
        break;
      }
    } else {
      const hq = s.sides[when.side].hq;
      if (w.eventFired[i] === 0 && hq && hq.hp < hq.maxHp * when.hqHpBelow) {
        w.eventFired[i] = 1;
        fireEvent(w, ev);
      }
    }
  }
}

function endBattle(w: World, winner: number, reason: EndReason): void {
  const s = w.state;
  s.over = true;
  s.winner = winner;
  s.endReason = reason;
  const e = w.events.emit('battleEnded');
  e.side = winner;
  e.value = s.time;
}

/** Win and lose rules, checked after the tick's damage has landed. */
export function checkEnd(w: World): void {
  const s = w.state;
  if (s.over) return;
  const hq0 = s.sides[0].hq;
  const hq1 = s.sides[1].hq;
  const lost0 = hq0 !== null && !hq0.alive;
  const lost1 = hq1 !== null && !hq1.alive;
  if (lost0 && lost1) endBattle(w, -1, 'draw');
  else if (lost0) endBattle(w, 1, 'hqDestroyed');
  else if (lost1) endBattle(w, 0, 'hqDestroyed');
  else if (s.timer && s.timer.secondsLeft <= 0) {
    if (s.timer.onExpire === 'win') endBattle(w, 0, 'timerSurvived');
    else endBattle(w, 1, 'timerExpired');
  }
}
