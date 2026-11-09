/**
 * Mission scripting: starting forces, scripted events (hints, announcements,
 * airdrops, waves), the mission timer, and the win and lose rules.
 */
import { CONFIG } from '../data/config';
import type { ForceDef, MissionEventDef, Side } from '../data/schema';
import { checkDirector, directorTrigger, endBattle, enterPhase, fireDirectorEvent, pointOwner, setOwner, updateDirector } from './director';
import { inPrep, missionTime } from './prep';
import { KIND_DEFS, KIND_INDEX, KIND_SAPPER } from './tables';
import { claimSlot, enterSlot } from './trenches';
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
  const behaviour = force.behaviour ?? (force.leash !== undefined ? 'guard' : side.hq ? 'army' : 'assault');
  const count = atStart ? force.count : Math.max(1, Math.round(force.count * w.mods[si].wave));
  const capped = !atStart && side.hq !== null;
  const edge = si === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;

  let baseX = side.hq ? side.hq.doorX : edge;
  let step = (dir * CONFIG.spacing) / 2;
  let inFormation = atStart && behaviour === 'army' && side.hq !== null;
  let trench = -1;
  // A forward spawn point the side holds (ForceDef.at): just behind it, going back.
  if (force.x === undefined && force.trenchId === undefined && force.at !== undefined && pointOwner(s, force.at) === si) {
    for (let i = 0; i < s.trenches.length; i++) {
      if (s.trenches[i].id === force.at.trench) baseX = s.trenches[i].x - dir * (w.trenchHalf[i] + CONFIG.trenchFormGap);
    }
    step = -dir * CONFIG.spacing;
    inFormation = false;
  }
  if (force.x === undefined && force.trenchId === undefined && !atStart) {
    // The same rule for a wave at the HQ door, the map edge or a spawn point (the 1004 counter-attack): if its leading
    // man would stand at or behind the other side's line, the wave forms up just ahead of that line, going back, and
    // is cut off when there is no ground left.
    const gap = CONFIG.spacing * 2;
    const lead = step * dir > 0 ? baseX + (count - 1) * step : baseX;
    if (si === 1 ? lead <= w.front[0] + gap : lead >= w.front[1] - gap) {
      baseX = si === 1 ? Math.max(baseX, w.front[0] + gap) : Math.min(baseX, w.front[1] - gap);
      if (si === 1 && lead <= w.front[0] + gap) baseX = w.front[0] + gap;
      else if (si === 0 && lead >= w.front[1] - gap) baseX = w.front[1] - gap;
      step = -dir * CONFIG.spacing;
      if (baseX < CONFIG.mapMargin || baseX > s.length - CONFIG.mapMargin) return 0;
    }
  }
  if (force.x !== undefined) {
    baseX = force.x;
    // A wave never appears behind the other side's line (the two lines never pass through each other): one placed
    // where the enemy already stands comes in just ahead of it instead.
    if (!atStart) {
      const gap = CONFIG.spacing * 2;
      if (si === 1 && baseX <= w.front[0] + gap) baseX = w.front[0] + gap;
      else if (si === 0 && baseX >= w.front[1] - gap) baseX = w.front[1] - gap;
      // No ground left in front of the enemy: the wave is cut off and never arrives.
      if (baseX < CONFIG.mapMargin || baseX > s.length - CONFIG.mapMargin) return 0;
    }
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
      w.reserve.push({
        side: si,
        kindIndex,
        behaviour,
        postX: post,
        postTrench: trench,
        left: count - j,
        veteran: force.veteran === true,
        look: force.look ?? '',
        faction: force.nation ?? '',
        leash: force.leash ?? -1,
      });
      side.reservePop += (count - j) * def.pop;
      break;
    }
    const seat = trench >= 0 && def.usesTrench;
    const startX = trench < 0 ? baseX + j * step : seat ? s.trenches[trench].x : baseX + behind * step;
    const u = spawnUnit(w, si, kindIndex, startX, behaviour, false, false);
    if (!u) break;
    spawned++;
    if (force.leash !== undefined) u.leash = force.leash;
    if (force.veteran === true) makeVeteran(w, u);
    // Names and looks only (FOUNDATIONS.md 5.1): the force's look inside the era, and its nation if not the side's.
    if (force.look !== undefined) u.look = force.look;
    if (force.nation !== undefined) u.faction = force.nation;
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
 * A side whose mission unit list has no sapper (a mission that lives on airdrops) starts with none, whatever `sappers` says.
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

/** Carry out one scripted event now (also used by the admin panel to fire an event by hand). */
export function fireEvent(w: World, ev: MissionEventDef): void {
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
    default:
      // The director's events: banners, barrages, air raids, income, postures, call-ins, disguise, reveal, owners, the end.
      fireDirectorEvent(w, ev);
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
    // The door is in the enemy's hands (they stand at or past it): the group waits inside rather than walk out behind
    // their line.
    const gap = CONFIG.spacing * 2;
    if (!posted && (g.side === 1 ? hq.doorX <= w.front[0] + gap : hq.doorX >= w.front[1] - gap)) {
      i++;
      continue;
    }
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
      u.look = g.look;
      if (g.faction !== '') u.faction = g.faction;
      if (g.leash >= 0) u.leash = g.leash;
      g.left--;
      side.reservePop -= def.pop;
      if (!Number.isNaN(g.postX)) u.postX = g.postX;
      if (g.behaviour === 'garrison') u.postTrench = g.postTrench;
    }
    if (g.left === 0) reserve.splice(i, 1);
    else i++;
  }
}

/**
 * Advance the mission timer, let waiting reinforcements out, and fire any scripted events that are due. Both count on
 * the mission clock (missionTime): it waits while a prep phase runs, so the attack and the clock start when it ends.
 */
export function updateMission(w: World): void {
  const s = w.state;
  const time = missionTime(s);
  if (w.reserve.length > 0) releaseReserve(w);
  if (s.timer) {
    const left = s.timer.total - time;
    s.timer.secondsLeft = left > 0 ? left : 0;
    s.timer.progress = s.timer.total > 0 ? 1 - s.timer.secondsLeft / s.timer.total : 1;
  }

  // Barrages in flight keep falling, postures and a disguise run out (whatever the prep phase does).
  updateDirector(w);
  // Nothing scripted happens while the prep phase runs.
  if (inPrep(s)) return;
  const events = w.missionEvents;
  for (let i = 0; i < events.length; i++) {
    if (s.over) return;
    const ev = events[i];
    const when = ev.when;
    if (directorTrigger(w, i, time)) continue;
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
        if (s.time >= trench.capturedAt + (when.delay ?? 0)) {
          w.eventFired[i] = 1;
          fireEvent(w, ev);
        }
        break;
      }
    } else if ('hqHpBelow' in when) {
      const hq = s.sides[when.side].hq;
      if (w.eventFired[i] === 0 && hq && hq.hp < hq.maxHp * when.hqHpBelow) {
        w.eventFired[i] = 1;
        fireEvent(w, ev);
      }
    }
  }
}

/** The battle is over (src/sim/director.ts, which also settles the side objectives). */
export { endBattle };

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
  // The mission director: the phase's losses, clock and objectives, and the side objectives.
  if (!s.over) checkDirector(w);
}

/**
 * Admin "jump to phase" (and phase-isolated tests): put the phase's `assume` in place (owners, money, units), end any
 * prep phase still running, and enter that phase now. Returns false for an unknown phase or a finished battle.
 */
export function jumpToPhase(w: World, id: string): boolean {
  const s = w.state;
  if (s.over) return false;
  const index = w.phases.findIndex((p) => p.id === id);
  if (index < 0) return false;
  const assume = w.phases[index].assume;
  if (assume) {
    for (const o of assume.owners ?? []) setOwner(w, o.ref, o.owner);
    if (assume.supplies) {
      s.sides[0].supplies = assume.supplies[0];
      s.sides[1].supplies = assume.supplies[1];
    }
    if (assume.forces) {
      for (let si = 0; si < 2; si++) for (const f of assume.forces[si]) spawnForce(w, si as Side, f, false);
    }
  }
  if (s.prep !== null && s.prep.active) {
    s.prep.active = false;
    s.prep.secondsLeft = 0;
    s.prep.endedAt = s.time;
  }
  enterPhase(w, index, true);
  return true;
}
