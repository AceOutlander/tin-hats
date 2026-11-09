/**
 * Era small arms and items (FOUNDATIONS.md 5.1; src/data/eras.ts picks them by the mission's date, setFigureWeapon wears
 * them): the Red Army's PPD-40 of 1941, the German PzB 39 anti-tank rifle of 1939 to 1942 (in place of the Panzerschreck,
 * which reached the East in November 1943), and the Tank Hunters' bottle of 1941 (a Molotov cocktail, carried in the
 * hand like the anti-tank round). Weapon space as in ./parts: grip at the origin, +x to the muzzle, +y down.
 */
import { FIGURE, WEAPON_GEOM } from '../../data/figure';
import { SOVIET_KIT_COLORS as K } from '../../data/looksGear';
import type { SpriteSpec } from '../types';
import { TAU } from './math';
import { dot, fillPath, line, makeSpec, poly, rrect, solid } from './parts';

type Ctx = CanvasRenderingContext2D;

const C = FIGURE.colors;
const STEEL = C.steel;
const STEEL_L = C.steelLight;
const BLACK = '#141518';

/**
 * PPD-40: the PPSh's forerunner. A full wooden stock running forward under the receiver to the jacket, a round barrel
 * jacket with long slots and a plain nose, the drum magazine under the receiver.
 */
function paintPpd(ctx: Ctx): void {
  solid(ctx, K.wood, () =>
    poly(ctx, [-9.8, -0.9, -1.2, -0.8, 0.0, -0.5, 9.2, -0.5, 9.2, 0.8, 2.6, 1.1, 1.4, 1.3, -0.6, 1.6, -2.2, 1.9, -10.0, 3.4]),
  );
  line(ctx, K.woodLight, 0.4, [-9.0, -0.5, 8.6, -0.3]);
  line(ctx, STEEL_L, 0.5, [-9.8, -0.8, -10.0, 3.2]);
  // Receiver, the trigger guard and the tangent rear sight.
  solid(ctx, STEEL, () => rrect(ctx, -1.2, -1.8, 7.0, 1.6, 0.6));
  line(ctx, STEEL_L, 0.35, [0.2, 1.3, 0.4, 2.3, 1.6, 2.3, 1.8, 1.2]);
  solid(ctx, STEEL, () => rrect(ctx, 3.4, -2.5, 1.8, 0.8, 0.2));
  // The round jacket with its long slots, a plain nose and the front sight.
  solid(ctx, STEEL, () => rrect(ctx, 8.6, -1.5, 8.0, 1.6, 0.6));
  for (let x = 9.8; x < 15.4; x += 1.9) fillPath(ctx, BLACK, () => rrect(ctx, x, -1.05, 1.2, 0.6, 0.25));
  solid(ctx, STEEL, () => rrect(ctx, 15.2, -2.2, 0.8, 0.8, 0.2));
  // The drum, as on the PPSh.
  const dx = 4.0;
  const dy = 3.9;
  solid(ctx, STEEL, () => ctx.arc(dx, dy, 3.0, 0, TAU));
  solid(ctx, STEEL, () => rrect(ctx, dx - 1.4, 0.2, 2.8, 1.4, 0.3));
  ctx.beginPath();
  ctx.arc(dx, dy, 2.1, 0, TAU);
  ctx.strokeStyle = STEEL_L;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  dot(ctx, STEEL_L, dx, dy, 0.7);
}

/**
 * PzB 39: the German single-shot anti-tank rifle. A steel stock folded under the receiver with its shoulder pad, the
 * pistol grip and the drop block, the long thin barrel with its muzzle brake, the bipod folded under the barrel and
 * the cartridge holders on the side of the receiver.
 */
function paintPzb39(ctx: Ctx): void {
  const g = WEAPON_GEOM.pzb39;
  const y = g.muzzleY;
  // Shoulder pad and the stock tube.
  solid(ctx, BLACK, () => rrect(ctx, -12.6, y - 2.2, 1.8, 4.8, 0.8));
  solid(ctx, STEEL, () => rrect(ctx, -11.2, y - 0.7, 8.6, 1.4, 0.6));
  // Pistol grip, the drop-block lever and the receiver with its two cartridge holders.
  solid(ctx, C.wood, () => poly(ctx, [-1.4, y + 1.0, 0.6, y + 1.0, 0.2, 3.2, -1.6, 2.9]));
  solid(ctx, STEEL, () => rrect(ctx, -3.0, y - 1.4, 8.4, 2.6, 0.6));
  line(ctx, STEEL_L, 0.45, [-2.4, y + 1.2, -0.4, y + 2.4]);
  solid(ctx, C.woodLight, () => rrect(ctx, 0.4, y - 3.0, 2.0, 1.6, 0.3));
  solid(ctx, C.woodLight, () => rrect(ctx, 2.8, y - 3.0, 2.0, 1.6, 0.3));
  // The long barrel, its carrying handle and the front sight.
  solid(ctx, STEEL, () => poly(ctx, [5.4, y - 0.75, 28.4, y - 0.45, 28.4, y + 0.45, 5.4, y + 0.75]));
  line(ctx, STEEL_L, 0.32, [6.0, y - 0.35, 27.8, y - 0.15]);
  line(ctx, STEEL, 0.5, [9.4, y - 0.5, 9.9, y - 2.0, 12.4, y - 2.0, 12.9, y - 0.5]);
  solid(ctx, STEEL, () => rrect(ctx, 25.2, y - 1.8, 0.7, 1.2, 0.2));
  // The bipod folded under the barrel, and the muzzle brake.
  line(ctx, STEEL, 0.55, [13.8, y + 0.4, 21.2, y + 0.9]);
  dot(ctx, STEEL, 13.8, y + 0.4, 0.7);
  solid(ctx, STEEL, () => rrect(ctx, 28.2, y - 1.1, 2.6, 2.2, 0.4));
  fillPath(ctx, BLACK, () => ctx.rect(29.0, y - 0.8, 0.8, 1.6));
}

/** A bottle of petrol with a rag tied at the neck: the 1941 Tank Hunters' "rocket" item, held while making ready. */
function paintMolotov(ctx: Ctx): void {
  solid(ctx, '#4f5a3c', () => rrect(ctx, -3.4, -1.2, 4.6, 2.4, 0.9));
  solid(ctx, '#4f5a3c', () => poly(ctx, [1.0, -0.8, 2.6, -0.45, 2.6, 0.45, 1.0, 0.8]));
  // The petrol inside catching the light, and the rag at the neck.
  line(ctx, 'rgba(214, 180, 96, 0.7)', 0.45, [-2.8, -0.4, 0.6, -0.4]);
  solid(ctx, '#d8d0b6', () => poly(ctx, [2.4, -0.7, 3.6, -1.2, 4.2, -0.2, 3.6, 0.9, 2.4, 0.7]));
}

/** The era weapon and item sprites (keys fig/weapon/<model>, fig/item/...). */
export function eraWeaponSpecs(): SpriteSpec[] {
  return [
    makeSpec('fig/weapon/ppd', -10.4, -2.9, 17.0, 7.4, paintPpd),
    makeSpec('fig/weapon/pzb39', -13.0, -5.8, 31.2, 3.6, paintPzb39),
    makeSpec(MOLOTOV_KEY, -3.8, -1.6, 4.6, 1.6, paintMolotov),
  ];
}

/** The Tank Hunters' bottle (setFigureRocketItem). */
export const MOLOTOV_KEY = 'fig/item/molotov';
