/**
 * Rivers, bridges and ferries (FOUNDATIONS.md 4.4; tunables WATER in src/data/obstacles.ts).
 *
 * A river is a `water` sector: infantry wade at its speed (the ford), vehicles stop at the bank (the ground tables'
 * `block` cells, which walk() will not let a vehicle drive onto). A standing bridge rewrites its span as road
 * (writeBridge in src/sim/world.ts): everyone crosses at road speed and vehicles cross. Its owner follows the capture
 * point on it; its charges are cut once the other side holds that point, so the `demolish` event (FOUNDATIONS.md 3.3)
 * blows it only while its own side still has it. A fallen bridge drops the vehicles on it into the river. The `bridge`
 * event puts one across (a pontoon).
 *
 * A ferry serves a capture point (CapturePointDef.ferry, batchEvery): units of its side deploying there or at a point
 * beyond it, and waves sent to it, wait off the field (UnitState.ferry) and cross together, a boat landing every
 * `every` seconds while the side holds the landing. A round of the other side landing on the boat sinks a share of its
 * load (chosen on the battle RNG) and counts as a load lost. Nothing here runs for a battle with no bridges or ferries.
 */
import { CONFIG } from '../data/config';
import { WATER } from '../data/obstacles';
import type { MissionDef } from '../data/schema';
import { DAMAGE_TYPES } from './tables';
import { TARGET_UNIT, type BattleState, type BridgeState, type CapturePointState, type FerryState, type UnitState } from './types';
import { killUnit } from './units';
import { DMG_TOP, GROUND_INV_CELL, writeBridge, type GroundField, type World } from './world';
import { GROUND_CELL } from '../data/ground';

const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');
/** UnitState.ferry of a man on the boat (not just waiting for it): the ferry's index plus this. */
const ABOARD = 1024;

// ---------------------------------------------------------------------------
// Rivers
// ---------------------------------------------------------------------------

/**
 * The furthest a vehicle moving from x toward nx may go without driving into water no standing bridge spans: it stops
 * at the bank (the edge of the first blocked cell). A vehicle already in such a cell may drive out.
 */
export function riverClamp(g: GroundField, x: number, nx: number): number {
  const count = g.count;
  let c0 = (x * GROUND_INV_CELL) | 0;
  if (c0 < 0) c0 = 0;
  else if (c0 >= count) c0 = count - 1;
  let c1 = (nx * GROUND_INV_CELL) | 0;
  if (c1 < 0) c1 = 0;
  else if (c1 >= count) c1 = count - 1;
  if (c1 === c0 || g.block[c0] === 1 || g.block[c1] === 0) return nx;
  return c1 > c0 ? c1 * GROUND_CELL - 1e-3 : (c1 + 1) * GROUND_CELL;
}

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

/** The mission's bridges as battle state (after the capture points, which a bridge may follow). */
export function createBridges(mission: MissionDef, points: readonly CapturePointState[]): BridgeState[] {
  return (mission.bridges ?? []).map((b) => {
    const maxHp = WATER.bridgeHp * (b.hpMul ?? 1);
    const point = b.point !== undefined ? points.findIndex((p) => p.id === b.point) : -1;
    const standing = b.standing !== false;
    return {
      id: b.id,
      x0: Math.min(b.x0, b.x1),
      x1: Math.max(b.x0, b.x1),
      hp: standing ? maxHp : 0,
      maxHp,
      owner: point >= 0 ? points[point].owner : b.owner,
      standing,
      wired: b.demolition?.wired === true,
      demolitionSide: b.demolition ? b.demolition.side : -1,
      look: b.look ?? 'bridge',
      point,
      downAt: -1,
    };
  });
}

/** At battle creation: the standing bridges' spans become road in the ground tables. */
export function layBridges(w: World): void {
  const g = w.ground;
  if (g === null) return;
  for (const b of w.state.bridges) if (b.standing) writeBridge(g, b.x0, b.x1, true);
}

/** Index in state.bridges of bridge `id`, or -1. */
export function bridgeIndex(w: World, id: number): number {
  const bridges = w.state.bridges;
  for (let i = 0; i < bridges.length; i++) if (bridges[i].id === id) return i;
  return -1;
}

/** Each tick, after the capture points: a bridge's owner follows its point; the other side holding it cuts the wires. */
export function updateBridges(w: World): void {
  const s = w.state;
  const bridges = s.bridges;
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    if (b.point >= 0) b.owner = s.points[b.point].owner;
    if (b.wired && b.demolitionSide >= 0 && b.owner === 1 - b.demolitionSide) b.wired = false;
  }
}

/** Bridge i falls: its span is water again and the vehicles on it go into the river. */
function fall(w: World, i: number, by: number): void {
  const s = w.state;
  const b = s.bridges[i];
  if (!b.standing) return;
  b.standing = false;
  b.hp = 0;
  b.wired = false;
  b.downAt = s.time;
  if (w.ground !== null) writeBridge(w.ground, b.x0, b.x1, false);
  const units = s.units;
  for (let k = 0; k < s.unitCount; k++) {
    const u = units[k];
    if (!u.alive || u.inside || u.def.class !== 'vehicle' || u.x < b.x0 || u.x > b.x1) continue;
    w.damage.push(TARGET_UNIT, k, u.id, WATER.bridgeFallDamage, by, EXPLOSIVE, u.facing, DMG_TOP);
  }
  const e = w.events.emit('bridgeBlown');
  e.targetIndex = i;
  e.side = b.demolitionSide;
  e.x = (b.x0 + b.x1) / 2;
  e.cause = 'explosive';
  // The charges go off along the span.
  for (let j = 0; j < 3; j++) {
    const x = w.events.emit('explosion');
    x.side = by;
    x.x = b.x0 + ((j + 0.5) * (b.x1 - b.x0)) / 3;
    x.value = 140;
    x.weapon = 'demolition';
    x.cause = 'explosive';
  }
}

/** The `demolish` event: blow bridge `id` if it stands and is still wired. */
export function demolishBridge(w: World, id: number): void {
  const i = bridgeIndex(w, id);
  if (i < 0) return;
  const b = w.state.bridges[i];
  if (!b.standing || !b.wired) return;
  fall(w, i, b.demolitionSide >= 0 ? b.demolitionSide : -1);
}

/** The `bridge` event: put bridge `id` across (a pontoon the engineers have built). */
export function raiseBridge(w: World, id: number): void {
  const i = bridgeIndex(w, id);
  if (i < 0) return;
  const b = w.state.bridges[i];
  if (b.standing) return;
  b.standing = true;
  b.hp = b.maxHp;
  b.downAt = -1;
  if (w.ground !== null) writeBridge(w.ground, b.x0, b.x1, true);
  const e = w.events.emit('bridgeBuilt');
  e.targetIndex = i;
  e.x = (b.x0 + b.x1) / 2;
}

/** Explosive splash of `damage` at x with radius r, fired by `side`: the bridge decks under it take a share. */
export function splashBridges(w: World, side: number, x: number, r: number, damage: number): void {
  const bridges = w.state.bridges;
  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    if (!b.standing) continue;
    const d = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    b.hp -= damage * falloff * WATER.bridgeBlastMul;
    if (b.hp <= 0) fall(w, i, side);
  }
}

// ---------------------------------------------------------------------------
// Ferries
// ---------------------------------------------------------------------------

/** The ferries of a mission's capture points (a point with `ferry` and `batchEvery`). */
export function createFerries(mission: MissionDef, points: readonly CapturePointState[]): FerryState[] {
  const out: FerryState[] = [];
  const defs = mission.capturePoints ?? [];
  for (let k = 0; k < defs.length; k++) {
    const p = defs[k];
    if (!p.ferry || !(p.batchEvery !== undefined && p.batchEvery > 0)) continue;
    const st = points[k];
    const side = p.spawnFor ?? (st.owner === 1 ? 1 : 0);
    const dir = side === 0 ? 1 : -1;
    const cross = p.ferry.crossSeconds ?? WATER.ferryCross;
    out.push({
      point: k,
      side,
      from: p.ferry.from,
      to: p.x - (dir * p.width) / 2,
      cross,
      every: p.batchEvery,
      hitShare: p.ferry.hitShare ?? WATER.ferryHitShare,
      nextArrive: Math.max(p.batchEvery, cross),
      sailing: false,
      boatX: p.ferry.from,
      load: 0,
      hit: false,
      landed: 0,
      loadsLost: 0,
      menLost: 0,
    });
  }
  return out;
}

/** The ferry that carries side si's units deploying at point k (its landing, or a point beyond it), or -1. */
export function ferryFor(w: World, si: number, k: number): number {
  const s = w.state;
  const ferries = s.ferries;
  if (ferries.length === 0 || k < 0) return -1;
  const dir = si === 0 ? 1 : -1;
  for (let i = 0; i < ferries.length; i++) {
    const f = ferries[i];
    if (f.side !== si) continue;
    if ((s.points[k].x - s.points[f.point].x) * dir >= 0) return i;
  }
  return -1;
}

/** Unit u (just spawned) waits off the field for ferry fi. */
export function boardFerry(w: World, u: UnitState, fi: number): void {
  const f = w.state.ferries[fi];
  u.inside = true;
  u.action = 'inside';
  u.ferry = fi;
  u.x = f.from;
  u.prevX = f.from;
  u.goalX = f.from;
  u.velX = 0;
}

/** The men of ferry fi on the boat now (not those waiting on the bank). */
function aboard(u: UnitState, fi: number): boolean {
  return u.alive && u.ferry === fi + ABOARD;
}

/** Everyone aboard ferry fi walks off at x (going back from it, one spacing apart), onto the field. */
function land(w: World, fi: number, to: number): number {
  const s = w.state;
  const f = s.ferries[fi];
  const dir = f.side === 0 ? 1 : -1;
  const units = s.units;
  // Never past the other side's front (the two lines never pass through each other), as for any wave.
  const gap = CONFIG.spacing * 2;
  const front = w.front[1 - f.side];
  const x = (to - (front - dir * gap)) * dir > 0 ? front - dir * gap : to;
  let n = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!aboard(u, fi)) continue;
    let px = x - dir * n * CONFIG.spacing * 0.5;
    if (px < CONFIG.mapMargin) px = CONFIG.mapMargin;
    else if (px > s.length - CONFIG.mapMargin) px = s.length - CONFIG.mapMargin;
    u.inside = false;
    u.action = 'idle';
    u.ferry = -1;
    u.x = px;
    u.prevX = px;
    u.goalX = px;
    u.aimX = px;
    u.facing = dir;
    n++;
  }
  return n;
}

/** Each tick: boats put out with whoever waits, cross, and land at the landing (or turn back if it has been lost). */
export function updateFerries(w: World): void {
  const s = w.state;
  const ferries = s.ferries;
  if (ferries.length === 0) return;
  const units = s.units;
  for (let fi = 0; fi < ferries.length; fi++) {
    const f = ferries[fi];
    const held = s.points[f.point].owner === f.side;
    if (!f.sailing) {
      if (s.time < f.nextArrive - f.cross - 1e-9) continue;
      // Time to put out: everyone waiting goes aboard. No boat sails empty; with the landing lost, those waiting
      // walk out on the home bank instead.
      let load = 0;
      for (let i = 0; i < s.unitCount; i++) {
        const u = units[i];
        if (!u.alive || u.ferry !== fi) continue;
        u.ferry = fi + ABOARD;
        load++;
      }
      if (load > 0 && !held) land(w, fi, f.from);
      if (load === 0 || !held) {
        f.nextArrive += f.every;
        continue;
      }
      f.sailing = true;
      f.load = load;
      f.hit = false;
      f.boatX = f.from;
    }
    const t = Math.min(1, Math.max(0, (s.time - (f.nextArrive - f.cross)) / f.cross));
    f.boatX = f.from + (f.to - f.from) * t;
    if (s.time < f.nextArrive - 1e-9) continue;
    // Landed: on the far bank while the side holds it, else back where they came from.
    const n = land(w, fi, held ? f.to : f.from);
    f.sailing = false;
    f.load = 0;
    f.nextArrive += f.every;
    if (n > 0 && held) f.landed++;
    const e = w.events.emit('ferryLanded');
    e.targetIndex = fi;
    e.side = f.side;
    e.x = held ? f.to : f.from;
    e.value = n;
  }
}

/** A round of `side` lands at x: a boat of the other side on the water within reach is hit, once a crossing. */
export function hitFerries(w: World, side: number, x: number): void {
  const s = w.state;
  const ferries = s.ferries;
  for (let fi = 0; fi < ferries.length; fi++) {
    const f = ferries[fi];
    if (!f.sailing || f.hit || f.side === side || f.load <= 0) continue;
    if (Math.abs(f.boatX - x) > WATER.ferryHitRadius) continue;
    f.hit = true;
    f.loadsLost++;
    let lost = Math.max(1, Math.round(f.load * f.hitShare));
    if (lost > f.load) lost = f.load;
    const dir = f.side === 0 ? 1 : -1;
    for (let j = 0; j < lost; j++) {
      // The j-th man to go: one of those still aboard, picked on the battle RNG.
      let pick = Math.floor(w.rng.next() * f.load);
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!aboard(u, fi)) continue;
        if (pick-- > 0) continue;
        u.x = f.boatX;
        killUnit(w, u, EXPLOSIVE, dir, side);
        break;
      }
      f.load--;
    }
    f.menLost += lost;
    const e = w.events.emit('ferryHit');
    e.targetIndex = fi;
    e.side = f.side;
    e.x = f.boatX;
    e.value = lost;
  }
}

/** Boat loads of the ferry at capture point `id` hit on the way over (LossDef ferryLoads). */
export function ferryLoadsLost(s: BattleState, id: string): number {
  let n = 0;
  for (const f of s.ferries) if (s.points[f.point].id === id) n += f.loadsLost;
  return n;
}
