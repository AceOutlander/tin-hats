/**
 * The Red Army's own figure art (NATIONS.md section 3, history-checked look notes): small arms, the F-1 grenade, the
 * pilotka and ushanka caps and the SSh-40 over the ushanka, and the kit (duffel bag, belt with two-cell pouches, bread
 * bag and spade, the rolled greatcoat over the shoulder). Same frames and style as ./parts: weapons in weapon space
 * (grip at the origin, +x to the muzzle, +y down), headgear in head space (drawn for a head of radius 5.4), the pack
 * and coat roll upright from the chest joint, the pouches upright from the hip.
 */
import { FIGURE, WEAPON_GEOM } from '../../data/figure';
import { FIGURE_GEAR_ART, SOVIET_KIT_COLORS as K, type FigureHeadgear } from '../../data/looksGear';
import type { SpriteSpec } from '../types';
import { TAU } from './math';
import { dot, fillPath, line, makeSpec, mix, paintBipod, poly, rrect, solid, ssh40Path } from './parts';

type Ctx = CanvasRenderingContext2D;

const C = FIGURE.colors;
const RIM = FIGURE.rimWidth;
const STEEL = C.steel;
const STEEL_L = C.steelLight;
const BLACK = '#141518';
const WOOD = K.wood;
const WOOD_L = K.woodLight;
/** Headgear paths are drawn for a head of radius 5.4 and scaled to the real head (as in ./parts). */
const HK = FIGURE.headRadius / 5.4;

// ---------------------------------------------------------------------------
// Small arms
// ---------------------------------------------------------------------------

/**
 * Mosin-Nagant 1891/30: a long, straight-wristed birch stock with its fore-end nearly to the muzzle, a hooded front
 * sight and two barrel bands; the straight bolt handle. Riflemen carry the spike bayonet fixed. The sniper's rifle has
 * the short PU scope on a side mount and the bolt handle turned down.
 */
function paintMosin(ctx: Ctx, scoped: boolean): void {
  const m = WEAPON_GEOM.mosin.muzzleX;
  // Stock: butt, straight wrist, magazine belly and a long fore-end.
  solid(ctx, WOOD, () =>
    poly(ctx, [
      -12.4, -1.1, -2.2, -0.7, 0.6, -0.9, 21.4, -0.9, 22.0, -0.4, 21.4, 0.7, 5.6, 0.8, 4.8, 1.8, 1.6, 1.9, 0.4, 1.3, -1.6, 1.4,
      -12.6, 3.2,
    ]),
  );
  line(ctx, WOOD_L, 0.4, [-11.6, -0.6, -2.6, -0.3]);
  // The upper handguard over the barrel.
  solid(ctx, WOOD, () => rrect(ctx, 7.4, -1.7, 12.2, 1.0, 0.4));
  // Butt plate and the sling slot through the butt.
  line(ctx, STEEL_L, 0.5, [-12.4, -0.9, -12.6, 3.0]);
  fillPath(ctx, BLACK, () => rrect(ctx, -8.6, 0.6, 2.0, 0.7, 0.3));
  // Barrel, receiver and the magazine floorplate running into the trigger guard.
  solid(ctx, STEEL, () => ctx.rect(1.0, -1.15, m - 1.0, 0.9));
  solid(ctx, STEEL, () => rrect(ctx, -1.0, -1.85, 7.8, 1.5, 0.5));
  line(ctx, STEEL_L, 0.35, [-0.4, 1.3, 0.0, 2.3, 1.2, 2.3, 1.6, 1.8]);
  // Barrel bands.
  line(ctx, STEEL_L, 0.55, [10.6, -1.7, 10.6, 0.8]);
  line(ctx, STEEL_L, 0.55, [19.8, -1.7, 19.8, 0.7]);
  // Hooded front sight.
  solid(ctx, STEEL, () => rrect(ctx, m - 1.6, -2.3, 1.1, 1.3, 0.3));
  if (scoped) {
    // Bolt handle turned down so it clears the scope.
    line(ctx, STEEL_L, 0.45, [2.0, -1.2, 2.6, 0.2, 2.9, 1.0]);
    dot(ctx, STEEL_L, 2.9, 1.1, 0.6);
    // PU scope on its side mount: a short tube with a wider objective bell.
    solid(ctx, STEEL, () => rrect(ctx, 0.6, -2.6, 4.2, 1.0, 0.3));
    solid(ctx, BLACK, () => rrect(ctx, -0.8, -3.9, 7.4, 1.4, 0.6));
    solid(ctx, BLACK, () => rrect(ctx, 5.6, -4.2, 1.7, 2.0, 0.5));
    solid(ctx, BLACK, () => rrect(ctx, -1.6, -4.0, 1.2, 1.6, 0.4));
    line(ctx, STEEL_L, 0.4, [2.4, -3.9, 2.4, -3.3]);
    dot(ctx, 'rgba(170, 200, 220, 0.75)', 7.1, -3.2, 0.42);
  } else {
    // The straight bolt handle standing out from the receiver, and the leaf rear sight.
    line(ctx, STEEL_L, 0.5, [2.0, -1.3, 2.2, -0.1]);
    dot(ctx, STEEL_L, 2.2, 0.1, 0.62);
    solid(ctx, STEEL, () => rrect(ctx, 7.8, -2.4, 2.2, 0.8, 0.2));
    // Spike bayonet: the socket round the muzzle and the long cruciform blade.
    solid(ctx, STEEL, () => rrect(ctx, m - 2.6, -1.55, 2.4, 1.6, 0.4));
    line(ctx, STEEL, 0.5, [m - 1.2, 0.0, m - 0.6, 0.5, m + 0.2, 0.5]);
    solid(ctx, STEEL_L, () => poly(ctx, [m - 0.4, 0.05, m + 9.2, 0.5, m - 0.4, 0.95]), 'rgba(232, 226, 206, 0.45)', 0.3);
  }
}

/**
 * DP-27: wooden butt with the wrist dropping into a grip, a long receiver, the flat pan magazine lying on top, the
 * ribbed and holed barrel jacket, and the conical flash hider. The bipod is its own sprite.
 */
function paintDp27(ctx: Ctx): void {
  solid(ctx, WOOD, () => poly(ctx, [-12.2, -1.0, -2.4, -0.9, -1.4, -0.4, -0.6, 1.2, 0.4, 3.8, -1.4, 4.1, -2.8, 1.8, -12.4, 3.1]));
  line(ctx, WOOD_L, 0.4, [-11.4, -0.5, -3.0, -0.4]);
  line(ctx, STEEL_L, 0.5, [-12.2, -0.8, -12.4, 2.9]);
  // Receiver and trigger guard.
  solid(ctx, STEEL, () => rrect(ctx, -2.2, -1.8, 13.0, 2.8, 0.6));
  line(ctx, STEEL_L, 0.35, [0.6, 1.0, 1.0, 2.2, 2.4, 2.2, 2.8, 1.0]);
  line(ctx, STEEL_L, 0.35, [-1.4, -0.6, 9.8, -0.6]);
  // The pan: a wide, flat drum seen edge-on, its raised centre and the ribs of its cover.
  solid(ctx, STEEL, () => rrect(ctx, 0.4, -3.9, 10.6, 2.2, 0.8));
  solid(ctx, STEEL, () => ctx.ellipse(5.7, -3.9, 2.6, 0.9, 0, Math.PI, TAU));
  for (const x of [2.0, 3.6, 7.8, 9.4]) line(ctx, STEEL_L, 0.3, [x, -3.5, x, -2.2]);
  line(ctx, STEEL_L, 0.35, [1.0, -3.0, 10.4, -3.0]);
  // Barrel jacket with its cooling holes, the bare barrel and the cone flash hider.
  solid(ctx, STEEL, () => rrect(ctx, 10.4, -1.7, 11.6, 2.1, 0.6));
  for (let x = 11.8; x < 21; x += 1.9) dot(ctx, STEEL_L, x, -0.65, 0.55);
  solid(ctx, STEEL, () => ctx.rect(21.8, -1.1, 3.4, 0.9));
  solid(ctx, STEEL, () => poly(ctx, [25.0, -1.0, 27.0, -1.7, 27.0, 0.5, 25.0, -0.2]));
  // Front sight with its protecting ears.
  line(ctx, STEEL, 0.5, [24.6, -1.1, 24.6, -2.4]);
  line(ctx, STEEL, 0.35, [24.0, -1.1, 24.0, -2.0]);
}

/**
 * PPSh-41: a full wooden stock, the receiver, the perforated barrel jacket whose nose is cut on a slant as a muzzle
 * brake, and the 71-round drum under the receiver in front of the trigger.
 */
function paintPpsh(ctx: Ctx): void {
  solid(ctx, WOOD, () =>
    poly(ctx, [-9.6, -0.9, -1.0, -0.8, 0.0, -0.4, 6.4, -0.4, 6.4, 0.9, 2.4, 1.2, 1.4, 1.3, -0.6, 1.6, -2.2, 1.9, -9.8, 3.4]),
  );
  line(ctx, WOOD_L, 0.4, [-8.8, -0.5, -1.6, -0.4]);
  line(ctx, STEEL_L, 0.5, [-9.6, -0.8, -9.8, 3.2]);
  // Receiver, trigger guard and the rear sight.
  solid(ctx, STEEL, () => rrect(ctx, -1.2, -1.8, 7.8, 1.7, 0.6));
  line(ctx, STEEL_L, 0.35, [0.2, 1.3, 0.4, 2.3, 1.6, 2.3, 1.8, 1.2]);
  solid(ctx, STEEL, () => rrect(ctx, 3.6, -2.4, 1.4, 0.8, 0.2));
  // Barrel jacket with its rows of slots and the slanted nose.
  solid(ctx, STEEL, () => poly(ctx, [6.2, -1.6, 15.8, -1.6, 14.6, 0.3, 6.2, 0.3]));
  for (let x = 7.4; x < 13.6; x += 1.5) fillPath(ctx, STEEL_L, () => ctx.ellipse(x, -0.65, 0.5, 0.36, 0, 0, TAU));
  solid(ctx, STEEL, () => rrect(ctx, 14.0, -2.2, 0.8, 0.8, 0.2));
  // The drum magazine.
  const dx = 4.2;
  const dy = 3.9;
  solid(ctx, STEEL, () => ctx.arc(dx, dy, 3.1, 0, TAU));
  solid(ctx, STEEL, () => rrect(ctx, dx - 1.4, 0.2, 2.8, 1.4, 0.3));
  ctx.beginPath();
  ctx.arc(dx, dy, 2.2, 0, TAU);
  ctx.strokeStyle = STEEL_L;
  ctx.lineWidth = 0.35;
  ctx.stroke();
  dot(ctx, STEEL_L, dx, dy, 0.75);
}

/** The 82 mm BM-37 tube: a thick barrel with its breech cap and muzzle ring, and the sight on the bipod collar. */
function paintMortar82Tube(ctx: Ctx): void {
  const m = WEAPON_GEOM.mortar82.muzzleX;
  solid(ctx, STEEL, () => ctx.arc(0.3, 0, 1.9, 0, TAU));
  solid(ctx, STEEL, () => ctx.rect(0.2, -1.6, m - 0.2, 3.2));
  solid(ctx, STEEL, () => rrect(ctx, m - 1.5, -2.0, 1.6, 4.0, 0.4));
  line(ctx, STEEL_L, 0.45, [1.6, -0.95, m - 2.0, -0.95]);
  solid(ctx, STEEL, () => rrect(ctx, 12.4, -3.4, 3.0, 1.9, 0.4));
  solid(ctx, BLACK, () => rrect(ctx, 12.8, -5.4, 2.0, 2.1, 0.3));
  dot(ctx, 'rgba(170, 200, 220, 0.7)', 14.4, -4.4, 0.35);
}

/** Its bipod: the collar with the two recoil buffers, and the legs with the traverse screw between them. */
function paintMortar82Bipod(ctx: Ctx): void {
  const L = WEAPON_GEOM.mortar82.bipodLen;
  solid(ctx, STEEL, () => rrect(ctx, -1.8, -1.8, 3.6, 3.6, 0.8));
  line(ctx, STEEL, 1.0, [-0.6, -1.6, 3.4, -2.6]);
  line(ctx, STEEL_L, 0.5, [-0.6, -1.6, 3.4, -2.6]);
  line(ctx, STEEL_L, 0.7, [0, 0, L - 0.4, -1.6]);
  line(ctx, STEEL, 0.85, [0, 0, L, 0.7]);
  line(ctx, STEEL, 0.6, [L * 0.42, -0.6, L * 0.42 + 0.5, 2.2]);
  line(ctx, STEEL_L, 0.4, [L * 0.42 - 0.4, 0.8, L * 0.42 + 0.9, 0.8]);
  dot(ctx, STEEL, L, 0.7, 0.9);
}

/** The round baseplate seen edge-on: a shallow cone with stiffening ribs and the ball socket in the middle. */
function paintMortar82Plate(ctx: Ctx): void {
  solid(ctx, STEEL, () => poly(ctx, [-8.0, 0.9, -7.6, -0.2, -2.8, -1.4, 2.8, -1.4, 7.6, -0.2, 8.0, 0.9, 7.2, 1.7, -7.2, 1.7]));
  for (const x of [-5.2, -2.2, 2.2, 5.2]) line(ctx, STEEL_L, 0.35, [x, -0.9, x * 1.1, 1.2]);
  solid(ctx, STEEL, () => rrect(ctx, -1.7, -2.3, 3.4, 1.4, 0.6));
}

/**
 * PTRD-41: the shoulder pad and tubular stock with its wooden cheek rest, the receiver and bolt, a very long barrel
 * with the carrying handle, the folded bipod, and the box muzzle brake. The bore runs at muzzleY above the grip.
 */
function paintPtrd(ctx: Ctx): void {
  const g = WEAPON_GEOM.ptrd;
  const y = g.muzzleY;
  // Shoulder pad and stock tube.
  solid(ctx, BLACK, () => rrect(ctx, -14.0, y - 2.6, 2.0, 5.4, 0.9));
  solid(ctx, STEEL, () => rrect(ctx, -12.4, y - 0.9, 9.8, 1.8, 0.7));
  solid(ctx, WOOD, () => rrect(ctx, -10.0, y - 2.3, 5.4, 1.5, 0.6));
  // Pistol grip and the front hand grip under the receiver.
  solid(ctx, WOOD, () => poly(ctx, [-1.2, y + 1.0, 0.8, y + 1.0, 0.4, 3.4, -1.4, 3.1]));
  solid(ctx, WOOD, () => rrect(ctx, 3.6, y + 0.9, 2.2, 2.9, 0.6));
  line(ctx, STEEL_L, 0.35, [0.6, y + 1.6, 1.8, 1.4, 0.6, 1.6]);
  // Receiver and the bolt handle.
  solid(ctx, STEEL, () => rrect(ctx, -3.2, y - 1.5, 9.2, 2.8, 0.6));
  line(ctx, STEEL_L, 0.5, [1.6, y - 0.6, 2.4, y + 1.4]);
  dot(ctx, STEEL_L, 2.5, y + 1.7, 0.6);
  // Barrel: thick at the breech, thinner forward.
  solid(ctx, STEEL, () => poly(ctx, [5.8, y - 0.85, 31.4, y - 0.5, 31.4, y + 0.5, 5.8, y + 0.85]));
  line(ctx, STEEL_L, 0.35, [6.4, y - 0.4, 30.8, y - 0.2]);
  // Carrying handle over the balance point and the front sight.
  line(ctx, STEEL, 0.55, [10.2, y - 0.6, 10.8, y - 2.4, 13.6, y - 2.4, 14.2, y - 0.6]);
  solid(ctx, STEEL, () => rrect(ctx, 27.4, y - 2.0, 0.8, 1.4, 0.2));
  // Bipod folded forward along the barrel.
  line(ctx, STEEL, 0.6, [15.4, y + 0.4, 23.6, y + 0.9]);
  line(ctx, STEEL_L, 0.45, [15.4, y + 0.6, 23.2, y + 1.3]);
  dot(ctx, STEEL, 15.4, y + 0.4, 0.8);
  // Muzzle brake: a box with two side vents.
  solid(ctx, STEEL, () => rrect(ctx, 31.2, y - 1.3, 2.9, 2.6, 0.4));
  fillPath(ctx, BLACK, () => {
    ctx.rect(31.7, y - 1.0, 0.7, 2.0);
    ctx.rect(32.9, y - 1.0, 0.7, 2.0);
  });
}

/** F-1 "limonka": a ribbed egg with the UZRG fuse, its lever along the body and the pull ring. */
export function paintF1(ctx: Ctx): void {
  const g = '#3d4632';
  const d = mix(g, '#000000', 0.45);
  solid(ctx, g, () => ctx.ellipse(0.1, 0, 1.75, 1.45, 0, 0, TAU));
  line(ctx, d, 0.25, [-1.0, -1.25, -1.0, 1.25]);
  line(ctx, d, 0.25, [0.1, -1.45, 0.1, 1.45]);
  line(ctx, d, 0.25, [1.1, -1.25, 1.1, 1.25]);
  line(ctx, d, 0.25, [-1.6, -0.55, 1.75, -0.55]);
  line(ctx, d, 0.25, [-1.6, 0.55, 1.75, 0.55]);
  solid(ctx, STEEL, () => rrect(ctx, 1.6, -0.55, 1.2, 1.1, 0.3));
  line(ctx, STEEL_L, 0.35, [2.6, -0.7, -0.6, -1.55]);
  ctx.beginPath();
  ctx.arc(3.2, 0.5, 0.5, 0, TAU);
  ctx.strokeStyle = STEEL_L;
  ctx.lineWidth = 0.25;
  ctx.stroke();
}

/** A 14.5 mm round for the PTRD, carried in the far hand while loading (the anti-tank "rocket" item). */
function paintPtrdRound(ctx: Ctx): void {
  solid(ctx, '#9a7b3a', () => rrect(ctx, -3.6, -0.75, 4.4, 1.5, 0.3));
  solid(ctx, '#9a7b3a', () => poly(ctx, [0.6, -0.6, 1.6, -0.45, 1.6, 0.45, 0.6, 0.6]));
  solid(ctx, '#3a3a36', () => poly(ctx, [1.5, -0.45, 3.4, -0.2, 3.8, 0, 3.4, 0.2, 1.5, 0.45]));
  line(ctx, '#c9a95a', 0.3, [-3.2, -0.3, 0.2, -0.3]);
}

/** Every Soviet weapon and hand-item sprite (keys fig/weapon/<model>, fig/item/...). */
export function sovietWeaponSpecs(): SpriteSpec[] {
  const dp = WEAPON_GEOM.dp27.bipodLen;
  const mb = WEAPON_GEOM.mortar82.bipodLen;
  return [
    makeSpec('fig/weapon/mosin', -13.0, -3.0, 36.6, 3.6, (c) => paintMosin(c, false)),
    makeSpec('fig/weapon/mosinScoped', -13.0, -4.8, 27.2, 3.6, (c) => paintMosin(c, true)),
    makeSpec('fig/weapon/dp27', -12.8, -5.4, 27.6, 4.6, paintDp27),
    makeSpec('fig/weapon/dp27Bipod', -1.2, -1.6, dp + 1.0, 1.4, (c) => paintBipod(c, dp)),
    makeSpec('fig/weapon/ppsh', -10.2, -2.8, 16.4, 7.4, paintPpsh),
    makeSpec('fig/weapon/mortar82', -2.0, -5.8, 22.6, 2.4, paintMortar82Tube),
    makeSpec('fig/weapon/mortar82Bipod', -2.2, -3.2, mb + 1.4, 3.0, paintMortar82Bipod),
    makeSpec('fig/weapon/mortar82Plate', -8.4, -2.8, 8.4, 2.1, paintMortar82Plate),
    makeSpec('fig/weapon/ptrd', -14.4, -6.6, 34.6, 4.0, paintPtrd),
    makeSpec('fig/item/f1', -2.2, -2.0, 4.0, 1.9, paintF1),
    makeSpec('fig/item/ptrdRound', -4.0, -1.2, 4.2, 1.2, paintPtrdRound),
  ];
}

// ---------------------------------------------------------------------------
// Headgear (head space, for a head of radius 5.4; +x = facing, -y = up)
// ---------------------------------------------------------------------------

/** Pilotka: the boat-shaped side cap sitting on the crown, tipped a little forward, its turned-up curtain all round. */
function pilotkaPath(ctx: Ctx): void {
  ctx.moveTo(5.6, -3.3);
  ctx.quadraticCurveTo(5.9, -5.5, 4.8, -6.9);
  ctx.quadraticCurveTo(0.2, -6.3, -4.9, -7.7);
  ctx.quadraticCurveTo(-6.2, -6.4, -6.0, -4.0);
  ctx.quadraticCurveTo(-0.2, -4.7, 5.6, -3.3);
  ctx.closePath();
}

/** Ushanka: a round padded crown, the fur front turned up, ear flaps and the neck flap down. */
function ushankaPath(ctx: Ctx): void {
  ctx.moveTo(6.6, -3.0);
  ctx.quadraticCurveTo(7.2, -6.8, 5.0, -8.4);
  ctx.bezierCurveTo(2.0, -10.4, -4.6, -10.2, -6.4, -6.6);
  ctx.quadraticCurveTo(-7.4, -3.4, -7.0, 0.8);
  ctx.quadraticCurveTo(-5.6, 1.8, -3.4, 1.2);
  ctx.lineTo(-3.0, 3.8);
  ctx.quadraticCurveTo(-0.8, 4.8, 1.2, 3.6);
  ctx.lineTo(1.0, -2.4);
  ctx.quadraticCurveTo(3.6, -2.9, 6.6, -3.0);
  ctx.closePath();
}

/** The fur showing under a helmet: the ear flap down over the ear and the neck flap at the back. */
function helmetUshankaPath(ctx: Ctx): void {
  ssh40Path(ctx);
  ctx.moveTo(-6.4, -1.6);
  ctx.quadraticCurveTo(-7.4, 0.8, -6.8, 2.2);
  ctx.quadraticCurveTo(-5.4, 2.8, -3.6, 2.0);
  ctx.lineTo(-3.2, 4.0);
  ctx.quadraticCurveTo(-1.0, 5.0, 1.0, 3.8);
  ctx.lineTo(0.8, -1.4);
  ctx.closePath();
}

/** A small red enamel star cap badge. */
function capStar(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = K.star;
  ctx.fill();
  ctx.lineWidth = 0.18;
  ctx.strokeStyle = '#e2b53a';
  ctx.stroke();
}

/** Head-space bounds per headgear: x0, x1, y0, y1. */
const HEADGEAR_BOX: Record<FigureHeadgear, readonly [number, number, number, number]> = {
  // The cap sits high on the head; the box reaches down to the head joint so the anchor lies inside the sprite.
  pilotka: [-6.8, 6.4, -8.4, 0.4],
  ushanka: [-7.8, 7.6, -10.4, 5.2],
  helmetUshanka: [-8.6, 7.8, -10.4, 5.4],
};

function headgearOutline(ctx: Ctx, id: FigureHeadgear): void {
  if (id === 'pilotka') pilotkaPath(ctx);
  else if (id === 'ushanka') ushankaPath(ctx);
  else helmetUshankaPath(ctx);
}

function paintPilotka(ctx: Ctx, tint: string, dark: string): void {
  solid(ctx, tint, () => pilotkaPath(ctx), mix(dark, '#000000', 0.4), 0.35);
  // The curtain's top edge and the light along the crown.
  line(ctx, dark, 0.5, [5.3, -4.9, 0.4, -5.3, -5.6, -5.6]);
  line(ctx, mix(tint, '#ffffff', 0.2), 0.45, [4.2, -6.6, 0.2, -6.0, -4.4, -7.2]);
  capStar(ctx, 3.8, -4.6, 0.95);
}

function paintUshanka(ctx: Ctx, tint: string, dark: string): void {
  solid(ctx, K.fur, () => ushankaPath(ctx), K.furDark, 0.4);
  // Cloth crown above the fur band.
  fillPath(ctx, mix(tint, K.coat, 0.4), () => {
    ctx.moveTo(4.6, -7.4);
    ctx.bezierCurveTo(1.6, -10.0, -4.2, -9.8, -5.8, -6.6);
    ctx.quadraticCurveTo(-0.6, -7.6, 4.6, -7.4);
    ctx.closePath();
  });
  line(ctx, dark, 0.35, [-5.4, -6.7, 4.4, -7.3]);
  // Fur texture: short light strokes.
  for (const [x, y] of [
    [5.6, -6.2], [6.2, -4.6], [4.2, -5.2], [-6.2, -4.6], [-6.4, -2.2], [-5.6, 0.0], [-1.6, 1.6], [-0.6, 3.4], [-2.4, 3.0], [0.2, 0.0],
  ]) {
    line(ctx, K.furLight, 0.4, [x - 0.5, y + 0.4, x + 0.4, y - 0.3]);
  }
  // Flap tie and the cap star on the turned-up front.
  line(ctx, K.furDark, 0.3, [-0.4, 3.9, -1.0, 4.9]);
  capStar(ctx, 5.0, -5.4, 1.1);
}

function paintHelmetUshanka(ctx: Ctx, helmet: SpriteSpec): void {
  // Fur flaps first, the helmet over them.
  solid(ctx, K.fur, () => {
    ctx.moveTo(-6.4, -1.6);
    ctx.quadraticCurveTo(-7.4, 0.8, -6.8, 2.2);
    ctx.quadraticCurveTo(-5.4, 2.8, -3.6, 2.0);
    ctx.lineTo(-3.2, 4.0);
    ctx.quadraticCurveTo(-1.0, 5.0, 1.0, 3.8);
    ctx.lineTo(0.8, -1.4);
    ctx.closePath();
  }, K.furDark, 0.4);
  for (const [x, y] of [[-6.2, 0.8], [-4.6, 1.6], [-1.4, 2.6], [-0.2, 0.6], [-2.4, 3.6]]) line(ctx, K.furLight, 0.4, [x - 0.5, y + 0.4, x + 0.4, y - 0.3]);
  ctx.save();
  ctx.scale(1 / HK, 1 / HK);
  ctx.translate(-helmet.ax * helmet.w, -helmet.ay * helmet.h);
  helmet.draw(ctx);
  ctx.restore();
}

export function headgearKey(id: FigureHeadgear): string {
  return `fig/soviet/headgear/${id}`;
}

export function headgearRimKey(id: FigureHeadgear): string {
  return `fig/rim/headgear/${id}`;
}

/**
 * One headgear sprite in the nation's colours (rim = false) or its light rim (rim = true). `helmet` is the nation's
 * plain helmet sprite, drawn over the fur for helmetUshanka.
 */
export function headgearSpec(key: string, id: FigureHeadgear, tint: string, dark: string, rim: boolean, helmet: SpriteSpec): SpriteSpec {
  const b = HEADGEAR_BOX[id];
  const g = rim ? RIM : 0;
  return makeSpec(key, b[0] * HK - g, b[2] * HK - g, b[1] * HK + g, b[3] * HK + g, (ctx) => {
    ctx.scale(HK, HK);
    if (rim) {
      ctx.beginPath();
      headgearOutline(ctx, id);
      ctx.fillStyle = C.rim;
      ctx.fill();
      ctx.lineWidth = (RIM * 2) / HK;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.rim;
      ctx.stroke();
      return;
    }
    if (id === 'pilotka') paintPilotka(ctx, tint, dark);
    else if (id === 'ushanka') paintUshanka(ctx, tint, dark);
    else paintHelmetUshanka(ctx, helmet);
  });
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

/** The veshchmeshok: a drawstring duffel bag hanging on the back, its neck tied off, the strap over the shoulder. */
export function sovietPackSpec(key: string, tint: string, dark: string): SpriteSpec {
  return makeSpec(key, -10.4, -10.0, 0.6, 2.4, (ctx) => {
    const bag = mix(tint, '#b9ab7c', 0.25);
    solid(ctx, bag, () => {
      ctx.moveTo(-7.4, -7.0);
      ctx.quadraticCurveTo(-9.8, -4.4, -9.6, -0.6);
      ctx.quadraticCurveTo(-9.0, 1.8, -5.8, 1.6);
      ctx.quadraticCurveTo(-3.0, 1.2, -2.8, -1.6);
      ctx.quadraticCurveTo(-3.0, -5.0, -5.0, -7.0);
      ctx.closePath();
    }, 'rgba(20, 21, 15, 0.6)', 0.4);
    // Folds, the gathered neck and its knot.
    line(ctx, dark, 0.45, [-8.6, -2.4, -4.6, -3.2]);
    line(ctx, dark, 0.4, [-7.6, -0.2, -4.0, -0.6]);
    solid(ctx, dark, () => ctx.ellipse(-6.2, -7.4, 1.6, 0.9, 0, 0, TAU));
    solid(ctx, bag, () => ctx.ellipse(-6.4, -8.8, 1.4, 1.0, -0.3, 0, TAU));
    // Strap from the neck over the shoulder, and from the bottom corner up under the arm.
    line(ctx, dark, 0.75, [-5.4, -7.4, -2.0, -7.6, 0.0, -5.0]);
    line(ctx, dark, 0.6, [-3.4, 0.6, -1.2, -2.4]);
  });
}

/** The belt: two-cell ammunition pouch in front, the spade in its cover and the bread bag behind the hip. */
export function sovietPouchesSpec(key: string, tint: string, dark: string): SpriteSpec {
  return makeSpec(key, -8.6, -7.4, 6.0, 3.8, (ctx) => {
    // Spade (MPL-50) in its cover, hanging behind the hip, the handle up by the back.
    solid(ctx, mix(tint, dark, 0.35), () => rrect(ctx, -6.4, -3.6, 3.2, 6.2, 1.2));
    line(ctx, dark, 0.4, [-6.0, -1.6, -3.6, -1.6]);
    line(ctx, K.wood, 0.9, [-4.8, -3.6, -5.2, -6.8]);
    // Bread bag on the back of the belt.
    solid(ctx, tint, () => rrect(ctx, -8.4, -4.0, 4.2, 5.0, 1.4));
    solid(ctx, dark, () => rrect(ctx, -8.6, -4.2, 4.6, 1.9, 0.9));
    // Leather belt with its buckle.
    solid(ctx, K.leather, () => rrect(ctx, -4.2, -4.2, 8.4, 1.6, 0.6));
    fillPath(ctx, K.leatherLight, () => ctx.rect(3.0, -4.0, 1.0, 1.2));
    // Two-cell ammunition pouch at the front.
    solid(ctx, mix(tint, K.leather, 0.3), () => rrect(ctx, 1.0, -6.4, 4.6, 4.6, 0.8));
    line(ctx, dark, 0.45, [1.2, -5.0, 5.4, -5.0]);
    line(ctx, dark, 0.4, [3.3, -5.0, 3.3, -2.0]);
  });
}

/**
 * The skatka: the greatcoat rolled into a thick sausage, worn over the far shoulder and across the chest to the near
 * hip, the ends tied together. Drawn in the bandolier frame (upright from the chest joint).
 */
export function coatRollSpec(key: string): SpriteSpec {
  const B = FIGURE_GEAR_ART.bandolier;
  const w = 3.4;
  // The strap may run either way across the chest (x1 left or right of x0): the hook over the shoulder follows it.
  const s = B.x1 >= B.x0 ? 1 : -1;
  const pts = [B.x0 - 1.8 * s, B.y0 + 2.6, B.x0 + 0.2 * s, B.y0 - 1.2, B.x0 + 2.6 * s, B.y0 + 0.4, B.x1, B.y1];
  const xs = [pts[0], pts[2], pts[4], pts[6]];
  const ys = [pts[1], pts[3], pts[5], pts[7]];
  const pad = 3.6;
  return makeSpec(key, Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad, (ctx) => {
    const curve = (): void => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      ctx.lineTo(pts[6], pts[7]);
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    curve();
    ctx.strokeStyle = 'rgba(20, 21, 15, 0.85)';
    ctx.lineWidth = w + 0.7;
    ctx.stroke();
    curve();
    ctx.strokeStyle = K.coat;
    ctx.lineWidth = w;
    ctx.stroke();
    // Light along the upper side of the roll, then the ties.
    ctx.save();
    ctx.translate(-0.5, -0.6);
    curve();
    ctx.strokeStyle = K.coatLight;
    ctx.lineWidth = w * 0.3;
    ctx.stroke();
    ctx.restore();
    for (const t of [0.35, 0.75]) {
      const x = pts[4] + (pts[6] - pts[4]) * t;
      const y = pts[5] + (pts[7] - pts[5]) * t;
      line(ctx, K.coatDark, 0.6, [x - 1.6, y + 0.7, x + 1.6, y - 0.9]);
    }
    // The tied ends at the hip.
    line(ctx, K.coatDark, 0.8, [pts[6] - 0.6, pts[7] + 0.4, pts[6] + 0.9, pts[7] + 1.9]);
  });
}
