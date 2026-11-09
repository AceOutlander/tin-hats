/**
 * Minefields (FOUNDATIONS.md 4.6; tunables MINES in src/data/obstacles.ts).
 *
 * A unit of the side that does not own a field rolls, for every MINES.step wu it moves inside it (each grid line at a
 * multiple of the step it crosses), density x MINES.chance[mines][class] on the battle RNG. A blast hurts that unit
 * (MINES.damage, straight onto its health: belly armour and boots do not help), lowers the density and shows the field
 * to the victim's side. Explosive splash over a field breaks mines too (density down by the share of the field the
 * splash covers) and shows it to the side that fired. Sappers never set mines off (they probe as they go; the Clear job
 * in src/sim/clear.ts is theirs). The RNG is drawn only for units moving inside a field, so a battle without minefields
 * plays exactly as before.
 */
import { MINES } from '../data/obstacles';
import type { MinefieldDef, MissionDef } from '../data/schema';
import { DAMAGE_TYPES, KIND_SAPPER } from './tables';
import { TARGET_UNIT, type MinefieldState, type UnitState } from './types';
import { DMG_TOP, type World } from './world';

const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');

export function minefieldState(def: MinefieldDef): MinefieldState {
  const known: [boolean, boolean] = [def.owner === 0 || def.marked, def.owner === 1 || def.marked];
  return {
    id: def.id,
    x: def.x,
    width: def.width,
    owner: def.owner,
    mines: def.mines,
    density: Math.max(0, Math.min(1, def.density)),
    marked: def.marked,
    known,
    alive: def.density > MINES.minDensity && def.width > MINES.minWidth,
    blasts: 0,
  };
}

/** The mission's minefields as battle state. */
export function createMinefields(mission: MissionDef): MinefieldState[] {
  return (mission.minefields ?? []).map(minefieldState);
}

/** A new field (a finished prep build); returns its index in state.minefields. */
export function addMinefield(w: World, def: MinefieldDef): number {
  w.state.minefields.push(minefieldState(def));
  return w.state.minefields.length - 1;
}

/** Thin a field out by `amount` of density; at MINES.minDensity it is gone. */
export function thinField(f: MinefieldState, amount: number): void {
  f.density -= amount;
  if (f.density < MINES.minDensity) {
    f.density = 0;
    f.alive = false;
  }
}

/** A mine goes off under unit u in field fi. */
function blast(w: World, fi: number, u: UnitState): void {
  const f = w.state.minefields[fi];
  const vehicle = u.def.class === 'vehicle';
  const dmg = MINES.damage[f.mines];
  const amount = vehicle ? dmg.vehicle : dmg.infantry;
  if (amount > 0) w.damage.push(TARGET_UNIT, u.index, u.id, amount, f.owner, EXPLOSIVE, u.facing, DMG_TOP);
  f.blasts++;
  f.known[u.side] = true;
  thinField(f, MINES.blastDensity);
  const e = w.events.emit('mineBlast');
  e.targetIndex = fi;
  e.side = u.side;
  e.unit = u.index;
  e.unitId = u.id;
  e.kind = u.kind;
  e.x = u.x;
  e.row = u.row;
  const x = w.events.emit('explosion');
  x.side = f.owner;
  x.x = u.x;
  x.row = u.row;
  x.value = f.mines === 'ap' ? MINES.blastRadius.ap : MINES.blastRadius.at;
  x.weapon = 'mine';
  x.cause = 'explosive';
}

/** After movement: every unit that moved inside a field of the other side rolls for each step it crossed. */
export function updateMines(w: World): void {
  const s = w.state;
  const fields = s.minefields;
  if (fields.length === 0) return;
  const units = s.units;
  const step = MINES.step;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || u.kindIndex === KIND_SAPPER) continue;
    const x = u.x;
    const px = u.prevX;
    if (x === px) continue;
    const from = px < x ? px : x;
    const to = px < x ? x : px;
    const vehicle = u.def.class === 'vehicle';
    for (let k = 0; k < fields.length; k++) {
      const f = fields[k];
      if (!f.alive || f.owner === u.side) continue;
      const half = f.width / 2;
      const a = from > f.x - half ? from : f.x - half;
      const b = to < f.x + half ? to : f.x + half;
      if (b <= a) continue;
      const rolls = Math.floor(b / step) - Math.floor(a / step);
      if (rolls <= 0) continue;
      const c = MINES.chance[f.mines];
      const chance = vehicle ? c.vehicle : c.infantry;
      if (chance <= 0) continue;
      let hit = false;
      for (let r = 0; r < rolls && !hit; r++) {
        if (w.rng.next() < f.density * chance) hit = true;
      }
      if (hit) {
        blast(w, k, u);
        break;
      }
    }
  }
}

/**
 * Explosive splash of `damage` (weapon damage x the firer's multiplier) at x with radius r, fired by `side`: the mines
 * under it go off. The field thins by MINES.splashDensity per 100 damage times the share of it the splash covers, and
 * the side that fired sees it.
 */
export function splashMines(w: World, side: number, x: number, r: number, damage: number): void {
  const fields = w.state.minefields;
  for (let k = 0; k < fields.length; k++) {
    const f = fields[k];
    if (!f.alive) continue;
    const half = f.width / 2;
    const a = Math.max(x - r, f.x - half);
    const b = Math.min(x + r, f.x + half);
    if (b <= a) continue;
    const share = f.width > 0 ? (b - a) / f.width : 1;
    thinField(f, (MINES.splashDensity * damage * share) / 100);
    if (side === 0 || side === 1) f.known[side] = true;
  }
}

/** A recon plane of side `si` over x +- spread sees the fields there. */
export function spotMinefields(w: World, si: number, x: number, spread: number): void {
  const fields = w.state.minefields;
  for (let k = 0; k < fields.length; k++) {
    const f = fields[k];
    if (f.alive && Math.abs(f.x - x) <= spread + f.width / 2) f.known[si] = true;
  }
}

/**
 * Clear `wu` of field fi from the end facing side `si` (its near edge); returns the x the sapper should stand at next
 * (just outside the new edge). The field is gone once narrower than MINES.minWidth.
 */
export function clearField(w: World, fi: number, si: number, wu: number): number {
  const f = w.state.minefields[fi];
  const dir = si === 0 ? 1 : -1;
  const cut = Math.min(wu, f.width);
  f.width -= cut;
  f.x += (dir * cut) / 2;
  if (f.width < MINES.minWidth) {
    f.width = 0;
    f.alive = false;
  }
  return nearEdge(f, si);
}

/** Where a sapper of side si stands to clear field f: just outside its near edge. */
export function nearEdge(f: MinefieldState, si: number): number {
  const dir = si === 0 ? 1 : -1;
  return f.x - dir * (f.width / 2 + 4);
}
