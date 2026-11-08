/**
 * Mission scripting: starting forces, scripted events (hints, announcements,
 * airdrops, waves), the mission timer, and the win and lose rules.
 */
import { CONFIG } from '../data/config';
import type { ForceDef, MissionEventDef, Side } from '../data/schema';
import { releaseAll } from './control';
import { KIND_DEFS, KIND_INDEX, KIND_SAPPER } from './tables';
import { claimSlot, enterSlot } from './trenches';
import type { EndReason } from './types';
import { makeVeteran, spawnUnit } from './units';
import type { World } from './world';

/**
 * Spawn one group of units. Where they appear:
 * - `x` given: there, one spacing apart going back;
 * - `trenchId` given: seated in that trench's free slots (taking it for the side), the rest just behind it;
 * - otherwise at the HQ door, or at the map edge for a side with no HQ.
 * At mission start, army units with no position stand ready in the hold formation instead.
 * Units of a side with no HQ (survival attackers) default to 'assault': they always advance.
 * A wave never takes a side with an HQ over its population cap: whoever does not fit (and everyone
 * behind units already waiting) goes into the reserve and walks out of the HQ door later.
 * Returns the number of units spawned now.
 */
function spawnForce(w: World, si: Side, force: ForceDef, atStart: boolean): number {
  const s = w.state;
  const side = s.sides[si];
  const dir = si === 0 ? 1 : -1;
  const kindIndex = KIND_INDEX[force.kind];
  const def = KIND_DEFS[kindIndex];
  const behaviour = force.behaviour ?? (side.hq ? 'army' : 'assault');
  const count = atStart ? force.count : Math.max(1, Math.round(force.count * w.mods[si].wave));
  const capped = !atStart && side.hq !== null;
  const edge = si === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;

  let baseX = side.hq ? side.hq.doorX : edge;
  let step = (dir * CONFIG.spacing) / 2;
  let inFormation = atStart && behaviour === 'army' && side.hq !== null;
  let trench = -1;
  if (force.x !== undefined) {
    baseX = force.x;
    step = -dir * CONFIG.spacing;
    inFormation = false;
  } else if (force.trenchId !== undefined) {
    // Seated in the trench's slots; whoever does not fit (or cannot use a trench) stands just behind it.
    for (let i = 0; i < s.trenches.length; i++) {
      if (s.trenches[i].id === force.trenchId) trench = i;
    }
    if (trench >= 0) baseX = s.trenches[trench].x - dir * (w.trenchHalf[trench] + CONFIG.trenchFormGap);
    step = -dir * CONFIG.spacing;
    inFormation = false;
  }

  // A garrison placed at the start simply holds its trench; taking one later is a capture.
  if (trench >= 0 && atStart) s.trenches[trench].owner = si;

  let spawned = 0;
  let behind = 0;
  for (let j = 0; j < count; j++) {
    if (capped && side.pop + side.reservePop + def.pop > side.popCap) {
      const post = force.x ?? (trench >= 0 ? s.trenches[trench].x : NaN);
      w.reserve.push({ side: si, kindIndex, behaviour, postX: post, postTrench: trench, left: count - j, veteran: force.veteran === true });
      side.reservePop += (count - j) * def.pop;
      break;
    }
    const seat = trench >= 0 && def.usesTrench;
    const startX = trench < 0 ? baseX + j * step : seat ? s.trenches[trench].x : baseX + behind * step;
    const u = spawnUnit(w, si, kindIndex, startX, behaviour, false, false);
    if (!u) break;
    spawned++;
    if (force.veteran === true) makeVeteran(w, u);
    if (behaviour === 'garrison') u.postTrench = trench;
    let x: number;
    if (seat && claimSlot(w, u, trench)) {
      x = w.slotX[u.slot];
      enterSlot(w, u);
    } else if (trench >= 0) {
      x = baseX + behind++ * step;
    } else if (inFormation) {
      x = w.formBase[si] - dir * u.slotDepth;
      if (side.hq && (x - side.hq.doorX) * dir < 0) x = side.hq.doorX;
    } else {
      continue;
    }
    const margin = CONFIG.mapMargin;
    if (x < margin) x = margin;
    else if (x > s.length - margin) x = s.length - margin;
    u.x = x;
    u.prevX = x;
    u.goalX = x;
    u.aimX = x;
  }
  return spawned;
}

/**
 * Place each side's starting sappers and forces. Called once, with the hold lines already known.
 * A side whose mission unit list has no sapper (mission 9) starts with none, whatever `sappers` says.
 */
export function placeStartingForces(w: World): void {
  const s = w.state;
  for (let si = 0; si < 2; si++) {
    const start = w.mission.start[si];
    const side = s.sides[si];
    const dir = si === 0 ? 1 : -1;
    if (side.hq && start.sappers > 0 && w.mission.units[si].includes('sapper')) {
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
      // Sized by the mission itself: only the difficulty scales it, not the side's incomeMul.
      const amount = ev.supplies * w.mods[ev.side].airdrop;
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

/**
 * Reserve units come in, oldest group first, while there is room under the cap. A group scripted at
 * a position (a forward landing, a trench) arrives there while that ground lies behind the side's
 * hold line, as it would have without the wait; otherwise, and for groups with no position, it walks
 * out of the HQ door. A group that does not fit blocks the ones behind it, so reinforcements keep
 * their scripted order.
 */
function releaseReserve(w: World): void {
  const reserve = w.reserve;
  const s = w.state;
  let i = 0;
  while (i < reserve.length) {
    const g = reserve[i];
    const side = s.sides[g.side];
    const hq = side.hq;
    const def = KIND_DEFS[g.kindIndex];
    if (!hq || !hq.alive) {
      side.reservePop -= g.left * def.pop;
      reserve.splice(i, 1);
      continue;
    }
    // Room = the cap less what is in use and what the groups ahead of this one (of its side) still need.
    let ahead = 0;
    for (let k = 0; k < i; k++) {
      if (reserve[k].side === g.side) ahead += reserve[k].left * KIND_DEFS[reserve[k].kindIndex].pop;
    }
    const dir = g.side === 0 ? 1 : -1;
    const posted = !Number.isNaN(g.postX) && (g.postX - side.holdLineX) * dir <= 0;
    while (g.left > 0 && side.pop + ahead + def.pop <= side.popCap) {
      let x = hq.doorX;
      if (posted) {
        x = g.postX - dir * CONFIG.spacing * (g.left - 1);
        if (x < CONFIG.mapMargin) x = CONFIG.mapMargin;
        else if (x > s.length - CONFIG.mapMargin) x = s.length - CONFIG.mapMargin;
      }
      const u = spawnUnit(w, g.side, g.kindIndex, x, g.behaviour, false, false);
      if (!u) break;
      if (g.veteran) makeVeteran(w, u);
      g.left--;
      side.reservePop -= def.pop;
      if (!Number.isNaN(g.postX)) u.postX = g.postX;
      if (g.behaviour === 'garrison') u.postTrench = g.postTrench;
    }
    if (g.left === 0) reserve.splice(i, 1);
    else i++;
  }
}

/** Advance the mission timer, let waiting reinforcements out, and fire any scripted events that are due. */
export function updateMission(w: World): void {
  const s = w.state;
  const time = s.time;
  if (w.reserve.length > 0) releaseReserve(w);
  if (s.timer) {
    const left = s.timer.total - time;
    s.timer.secondsLeft = left > 0 ? left : 0;
    s.timer.progress = s.timer.total > 0 ? 1 - s.timer.secondsLeft / s.timer.total : 1;
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
  releaseAll(w);
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
