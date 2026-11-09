/**
 * The prep phase of defensive missions (queue job 6; data in src/data/prep.ts).
 *
 * While it runs the enemy holds (its commander does not think and its units stand), the mission clock and its scripted
 * events wait (missionTime), and side 0 may place build sites in its zone. Sappers walk to the sites, one per site, and
 * work there; a finished site becomes a trench, a pillbox or a wire belt owned by its side. Sites still unfinished when
 * the prep phase ends go on being built. Nothing here runs for a mission without `prep`.
 */
import { CONFIG } from '../data/config';
import { PREP } from '../data/prep';
import type { BuildableId, MissionDef, Side } from '../data/schema';
import { KIND_SAPPER } from './tables';
import { addTrench } from './trenches';
import type { BattleState, BuildSiteState, PrepState } from './types';
import { createMount, resetMount } from './units';
import type { World } from './world';

/** The prep state a mission starts with, or null. `hq0X` is side 0's HQ centre (null without one). */
export function createPrep(mission: MissionDef, hq0X: number | null): PrepState | null {
  const def = mission.prep;
  if (!def) return null;
  const seconds = def.seconds ?? PREP.defaultSeconds;
  let from = hq0X !== null ? hq0X + CONFIG.hqWidth / 2 + PREP.gap : CONFIG.mapMargin;
  // The player's half, and behind the first enemy position by a gap.
  let to = mission.length / 2;
  const enemy = (x: number): void => {
    if (x - PREP.frontGap < to) to = x - PREP.frontGap;
  };
  for (const t of mission.trenches) if (t.owner === 1) enemy(t.x - t.width / 2);
  for (const p of mission.pillboxes) if (p.side === 1) enemy(p.x - CONFIG.pillboxWidth / 2);
  for (const w of mission.wire) if (w.owner === 1) enemy(w.x - w.width / 2);
  for (const f of mission.start[1].forces) if (f.x !== undefined) enemy(f.x);
  if (def.zone) {
    from = def.zone.from;
    to = def.zone.to;
  }
  return {
    active: seconds > 0,
    secondsLeft: seconds,
    total: seconds,
    endedAt: seconds > 0 ? -1 : 0,
    buildables: [...(def.buildables ?? PREP.order)],
    zoneFrom: from,
    zoneTo: Math.max(from, to),
  };
}

/** True while the prep phase runs. */
export function inPrep(s: BattleState): boolean {
  return s.prep !== null && s.prep.active;
}

/**
 * Seconds on the mission clock: battle time less the prep phase. While the prep phase runs it stays at 0, so the
 * mission timer and the scripted events wait for the attack.
 */
export function missionTime(s: BattleState): number {
  const p = s.prep;
  if (p === null) return s.time;
  if (p.active) return 0;
  return s.time - p.endedAt;
}

/** Edge-to-edge clear of every structure and site, with PREP.gap to spare. */
function clearOf(s: BattleState, x: number, half: number): boolean {
  const gap = PREP.gap;
  const near = (cx: number, h: number): boolean => Math.abs(cx - x) < h + half + gap;
  for (const t of s.trenches) if (near(t.x, t.width / 2)) return false;
  for (const p of s.pillboxes) if (p.alive && near(p.x, CONFIG.pillboxWidth / 2)) return false;
  for (const w of s.wires) if (w.alive && near(w.x, w.width / 2)) return false;
  for (const site of s.sites) if (near(site.x, site.width / 2)) return false;
  for (const side of s.sides) if (side.hq && near(side.hq.x, CONFIG.hqWidth / 2)) return false;
  for (const d of s.dumps) if (d && near(d.x, CONFIG.dumpSpread / 2)) return false;
  return true;
}

/** Why a build at x would be dropped, or null if it would be placed. The HUD shows the ghost red when not null. */
export function buildProblem(s: BattleState, si: number, kind: BuildableId, x: number): 'notPrep' | 'notOffered' | 'zone' | 'blocked' | 'money' | 'full' | null {
  const p = s.prep;
  if (s.over || p === null || !p.active || si !== 0) return 'notPrep';
  if (!p.buildables.includes(kind)) return 'notOffered';
  const def = PREP.buildables[kind];
  const half = def.width / 2;
  if (!Number.isFinite(x) || x - half < p.zoneFrom || x + half > p.zoneTo) return 'zone';
  if (!clearOf(s, x, half)) return 'blocked';
  if (s.sides[si].supplies < def.cost) return 'money';
  let mine = 0;
  for (const site of s.sites) if (site.side === si) mine++;
  if (mine >= PREP.maxSites) return 'full';
  return null;
}

export function applyBuild(w: World, si: number, kind: BuildableId, x: number): void {
  const s = w.state;
  if (!(kind in PREP.buildables) || buildProblem(s, si, kind, x) !== null) return;
  const def = PREP.buildables[kind];
  const side = s.sides[si];
  side.supplies -= def.cost;
  side.stats.suppliesSpent += def.cost;
  const site: BuildSiteState = { id: w.nextSiteId++, kind, side: si as Side, x, width: def.width, progress: 0, worker: -1, workerId: -1, cost: def.cost };
  s.sites.push(site);
  const e = w.events.emit('buildStarted');
  e.side = si;
  e.targetIndex = site.id;
  e.x = x;
  e.text = kind;
}

/** Take back an unfinished site of this side; its money comes back and its sapper goes back to hauling. */
export function applyCancelBuild(w: World, si: number, id: number): void {
  const s = w.state;
  const at = s.sites.findIndex((site) => site.id === id && site.side === si);
  if (at < 0) return;
  const site = s.sites[at];
  s.sides[si].supplies += site.cost;
  s.sides[si].stats.suppliesSpent -= site.cost;
  freeWorker(w, site);
  s.sites.splice(at, 1);
}

export function applyReady(w: World, si: number): void {
  if (si !== 0 || !inPrep(w.state)) return;
  endPrep(w);
}

function endPrep(w: World): void {
  const s = w.state;
  const p = s.prep;
  if (p === null || !p.active) return;
  p.active = false;
  p.secondsLeft = 0;
  p.endedAt = s.time;
  w.events.emit('prepEnded').value = s.time;
}

function freeWorker(w: World, site: BuildSiteState): void {
  if (site.worker < 0) return;
  const u = w.state.units[site.worker];
  if (u.alive && u.id === site.workerId && u.site === site.id) u.site = -1;
  site.worker = -1;
  site.workerId = -1;
}

/** Count the prep phase down; it ends when it runs out (or the side is ready, see applyReady). */
export function updatePrep(w: World): void {
  const s = w.state;
  const p = s.prep;
  if (p === null || !p.active) return;
  p.secondsLeft = Math.max(0, p.total - s.time);
  if (p.secondsLeft <= 0) endPrep(w);
}

/** Give each site without a sapper the nearest free one of its side, then let the working sappers build. */
export function updateBuilds(w: World): void {
  const s = w.state;
  const sites = s.sites;
  if (sites.length === 0) return;
  const units = s.units;
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    if (site.worker >= 0) {
      const u = units[site.worker];
      if (!u.alive || u.id !== site.workerId || u.site !== site.id || u.inside) {
        if (u.alive && u.id === site.workerId && u.site === site.id) u.site = -1;
        site.worker = -1;
        site.workerId = -1;
      }
    }
    if (site.worker < 0) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < s.unitCount; j++) {
        const u = units[j];
        if (!u.alive || u.side !== site.side || u.kindIndex !== KIND_SAPPER || u.inside || u.site >= 0) continue;
        const d = Math.abs(u.x - site.x);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) {
        const u = units[best];
        u.site = site.id;
        site.worker = best;
        site.workerId = u.id;
      }
    }
  }
  const def = PREP.buildables;
  for (let i = sites.length - 1; i >= 0; i--) {
    const site = sites[i];
    if (site.worker < 0) continue;
    const u = units[site.worker];
    if (Math.abs(u.x - site.x) > PREP.workReach) continue;
    site.progress = Math.min(1, site.progress + w.dt / def[site.kind].seconds);
    if (site.progress < 1) continue;
    finish(w, site);
    freeWorker(w, site);
    sites.splice(i, 1);
  }
}

/** The finished site becomes its structure, owned by its side. */
function finish(w: World, site: BuildSiteState): void {
  const s = w.state;
  const def = PREP.buildables[site.kind];
  let index: number;
  if (def.makes === 'trench') {
    index = addTrench(w, { id: 1000 + site.id, x: site.x, width: def.width, slots: def.slots ?? 3, owner: site.side });
  } else if (def.makes === 'pillbox') {
    const gun = createMount();
    resetMount(gun, CONFIG.pillboxGunWeapon, site.x);
    const maxHp = CONFIG.pillboxHp * (def.hpMul ?? 1);
    index = s.pillboxes.length;
    s.pillboxes.push({ id: 1000 + site.id, x: site.x, side: site.side, hp: maxHp, maxHp, alive: true, gun });
  } else {
    index = s.wires.length;
    s.wires.push({ id: 1000 + site.id, x: site.x, width: def.width, owner: site.side, hp: CONFIG.wireHp, alive: true });
  }
  const e = w.events.emit('buildDone');
  e.side = site.side;
  e.targetIndex = index;
  e.x = site.x;
  e.text = site.kind;
  e.target = def.makes;
}
