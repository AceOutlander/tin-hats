/**
 * Unit portraits for the DOM user interface: one painter for every unit kind.
 *
 * The figure module paints the stick-figure kinds; tanks are not figures, so
 * they are painted here from the vehicle sprites. The UI asks for
 * (canvas, kind, side); the app maps a side to a faction and calls this:
 *
 *   const paintUnitIcon: PaintUnitIcon = (canvas, kind, side) => {
 *     paintUnitPortrait(canvas, kind, factionOfSide[side]);
 *   };
 */
import { FIGURE } from '../data/figure';
import { GEAR_NONE } from '../data/looksGear';
import type { FactionId, UnitKind } from '../data/schema';
import type { GearLevels } from '../data/upgradeLooks';
import { paintUnitIcon as paintFigureIcon } from './figure';
import type { SpriteSpec } from './types';
import { TANK_KEYS, createTankPose, isGearLook, layoutTank, tankGearKeys, tankGearSpecs, tankSpecs, vehicleLookOf, type PartXf } from './vehicles';
import type { VehicleLook } from '../data/artLayout';

interface Placed {
  spec: SpriteSpec;
  x: number;
  y: number;
  rot: number;
}

let specByKey: Map<string, SpriteSpec> | null = null;

function tankSpec(key: string, look: VehicleLook, gear: GearLevels): SpriteSpec {
  if (!specByKey) {
    specByKey = new Map();
    for (const s of tankSpecs()) specByKey.set(s.key, s);
  }
  if (!specByKey.has(key) && isGearLook(look)) for (const s of tankGearSpecs(look, gear)) specByKey.set(s.key, s);
  const s = specByKey.get(key);
  if (!s) throw new Error(`Tin Hats art: no tank sprite "${key}"`);
  return s;
}

/** The parts of a parked vehicle, back to front, in tank space (+x forward, ground at y = 0); an APC shows its squad aboard. */
function placeTank(look: VehicleLook, gear: GearLevels): Placed[] {
  const keys = TANK_KEYS[look];
  const g = isGearLook(look) ? tankGearKeys(look, gear) : { hull: keys.hull, turret: keys.turret, barrel: keys.barrel, gunExtra: 0 };
  const pose = layoutTank({ look, distance: 0, turretAim: 0, recoil: 0, hullRock: 0, gunExtra: g.gunExtra }, createTankPose());
  const out: Placed[] = [];
  const add = (key: string, xf: PartXf): void => {
    out.push({ spec: tankSpec(key, look, gear), x: xf.x, y: xf.y, rot: xf.rot });
  };
  add(keys.track[pose.trackFrame], pose.track);
  for (let i = 0; i < pose.wheelCount; i++) add(keys.wheels[i], pose.wheels[i]);
  add(g.hull, pose.hull);
  add(g.barrel, pose.barrel);
  add(g.turret, pose.turret);
  if (keys.passengers !== null) add(keys.passengers, pose.passengers);
  return out;
}

/** Axis-aligned bounds of the rotated sprite rectangles: [x0, y0, x1, y1]. */
function boundsOf(parts: readonly Placed[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    for (let k = 0; k < 4; k++) {
      const lx = (k & 1 ? p.spec.w : 0) - p.spec.ax * p.spec.w;
      const ly = (k & 2 ? p.spec.h : 0) - p.spec.ay * p.spec.h;
      const x = p.x + lx * c - ly * s;
      const y = p.y + lx * s + ly * c;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

function paintTank(canvas: HTMLCanvasElement, look: VehicleLook, gear: GearLevels): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const parts = placeTank(look, gear);
  const [x0, y0, x1, y1] = boundsOf(parts);
  const W = canvas.width;
  const H = canvas.height;
  const m = FIGURE.icon.margin;
  const scale = Math.min((W * (1 - 2 * m)) / (x1 - x0), (H * (1 - 2 * m)) / (y1 - y0));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  for (const p of parts) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.translate(-p.spec.ax * p.spec.w, -p.spec.ay * p.spec.h);
    p.spec.draw(ctx);
    ctx.restore();
  }
  ctx.restore();
  return true;
}

/**
 * Paint a portrait of any unit kind into a canvas, using the canvas's pixel size.
 * Stick figures come from the figure module, tanks from the vehicle sprites. `gear` draws the unit with its
 * upgrade gear (default none, the normal look). Returns false only if the canvas has no 2D context.
 */
export function paintUnitPortrait(canvas: HTMLCanvasElement, kind: UnitKind, faction: FactionId, gear: GearLevels = GEAR_NONE, look?: VehicleLook): boolean {
  if (kind === 'tank' || kind === 'heavyTank' || kind === 'apc' || kind === 'lightTank') return paintTank(canvas, look ?? vehicleLookOf(kind, faction), gear);
  return paintFigureIcon(canvas, kind, faction, gear);
}
