/**
 * HQ machine-gun positions: the gun post on the ground in front of the HQ, one look per Quartermaster upgrade stage
 * (gunner, emplacement, tripod, nest) and per nation (Bren and Vickers for the British, MG34 on its bipod and on the
 * Lafette tripod for the Germans; crew helmets in the nation's tint). Drawn facing +x with the origin at the base
 * centre on the ground line; the muzzle is HQ_GUN_LAYOUT[style].muzzle. The ruin is the same position wrecked and
 * abandoned.
 *
 * The crew are drawn with the soldier figure's own part sprites (black body, light rim, tinted helmet, pack and
 * pouches), posed here with simple forward kinematics and a two-bone reach for the arms.
 */
import { ART_COLORS as C, type ArtPoint } from '../../data/artLayout';
import { FIGURE, FIGURE_LOADOUT, WEAPON_GEOM, type WeaponModel } from '../../data/figure';
import { HQ_GUN_LAYOUT } from '../../data/looksGun';
import type { FactionId } from '../../data/schema';
import type { HqGunStyle } from '../../data/upgradeLooks';
import { BODY_KEYS, FACTION_FIGURE_KEYS, RIM_KEYS } from '../figure/parts';
import { figureSpriteMap } from '../figure';
import {
  type Ctx,
  TAU,
  bagCourse,
  bagWall,
  charOver,
  ellipse,
  fillPoly,
  footing,
  heap,
  looseBag,
  makeSpec,
  mix,
  rgba,
  rimPoly,
  rimRect,
  rng,
  sandbag,
  scorch,
  strokeLine,
} from '../props/kit';
import type { SpriteSpec } from '../types';

export type HqGunState = 'intact' | 'ruin';
const STATES: readonly HqGunState[] = ['intact', 'ruin'];

export function hqGunKey(style: HqGunStyle, faction: FactionId, state: HqGunState): string {
  return `st/hqgun/${style}/${faction}/${state}`;
}

const BAG_W = 15;
const BAG_H = 9;
const HALF_PI = Math.PI / 2;
const BRASS = mix(C.crateRim, C.ember, 0.25);
const GUN_STEEL = FIGURE.colors.steel;
const GUN_LIGHT = FIGURE.colors.steelLight;

// ---------------------------------------------------------------------------
// Crew figures
// ---------------------------------------------------------------------------

interface LegPose {
  /** Bone angles in radians (0 = +x, positive turns down); foot = boot pitch (0 = flat). */
  thigh: number;
  shin: number;
  foot: number;
}

interface CrewPose {
  hip: ArtPoint;
  spine: number;
  chest: number;
  neck: number;
  near: LegPose;
  far: LegPose;
  /** Where the hands reach (the arms bend to get there, elbows down). */
  nearHand: ArtPoint;
  farHand: ArtPoint;
}

interface Part {
  key: string;
  x: number;
  y: number;
  rot: number;
}

function dir(a: number, len: number, from: ArtPoint): ArtPoint {
  return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

/** Two-bone reach from root toward target: the angles of the upper and lower bone. */
function reach(root: ArtPoint, target: ArtPoint, l1: number, l2: number): [number, number] {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const max = (l1 + l2) * FIGURE.reach;
  const min = (l1 + l2) * FIGURE.minReach;
  const d = Math.max(min, Math.min(max, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a1 = base + Math.acos(Math.max(-1, Math.min(1, cosA)));
  const elbow = dir(a1, l1, root);
  const hand = dir(base, d, root);
  return [a1, Math.atan2(hand.y - elbow.y, hand.x - elbow.x)];
}

/** The figure's parts back to front, split where the gun goes: `body` behind the gun, `arm` (near arm) in front. */
function crewParts(faction: FactionId, p: CrewPose): { body: Part[]; arm: Part[] } {
  const B = FIGURE.bones;
  const K = BODY_KEYS;
  const R = RIM_KEYS;
  const fk = FACTION_FIGURE_KEYS[faction];
  const chest = dir(p.spine, B.spineLower, p.hip);
  const neck = dir(p.chest, B.spineUpper, chest);
  const head = dir(p.neck, B.neck, neck);
  const shoulder = dir(p.chest, -FIGURE.shoulderDrop, neck);
  const nKnee = dir(p.near.thigh, B.thigh, p.hip);
  const nAnkle = dir(p.near.shin, B.shin, nKnee);
  const fKnee = dir(p.far.thigh, B.thigh, p.hip);
  const fAnkle = dir(p.far.shin, B.shin, fKnee);
  const [nUa, nFa] = reach(shoulder, p.nearHand, B.upperArm, B.forearm);
  const [fUa, fFa] = reach(shoulder, p.farHand, B.upperArm, B.forearm);
  const nElbow = dir(nUa, B.upperArm, shoulder);
  const fElbow = dir(fUa, B.upperArm, shoulder);
  const at = (key: string, j: ArtPoint, rot: number): Part => ({ key, x: j.x, y: j.y, rot });
  const helm = p.neck + HALF_PI;
  const body: Part[] = [
    at(R.upperArm, shoulder, fUa),
    at(R.forearm, fElbow, fFa),
    at(R.thigh, p.hip, p.far.thigh),
    at(R.shin, fKnee, p.far.shin),
    at(R.boot, fAnkle, p.far.foot),
    at(R.torsoLower, p.hip, p.spine),
    at(R.torsoUpper, chest, p.chest),
    at(R.head, neck, p.neck),
    at(R.thigh, p.hip, p.near.thigh),
    at(R.shin, nKnee, p.near.shin),
    at(R.boot, nAnkle, p.near.foot),
    at(fk.helmetRim, head, helm),
    at(R.upperArm, shoulder, nUa),
    at(R.forearm, nElbow, nFa),
    at(K.upperArmFar, shoulder, fUa),
    at(K.forearmFar, fElbow, fFa),
    at(K.thighFar, p.hip, p.far.thigh),
    at(K.shinFar, fKnee, p.far.shin),
    at(K.bootFar, fAnkle, p.far.foot),
    at(fk.pack, chest, p.chest + HALF_PI),
    at(K.torsoLower, p.hip, p.spine),
    at(K.torsoUpper, chest, p.chest),
    at(fk.pouches, p.hip, p.spine + HALF_PI),
    at(K.thigh, p.hip, p.near.thigh),
    at(K.shin, nKnee, p.near.shin),
    at(K.boot, nAnkle, p.near.foot),
    at(K.head, neck, p.neck),
    at(fk.helmet, head, helm),
  ];
  const arm: Part[] = [at(K.upperArm, shoulder, nUa), at(K.forearm, nElbow, nFa)];
  return { body, arm };
}

function drawParts(ctx: Ctx, parts: readonly Part[]): void {
  const map = figureSpriteMap();
  for (const p of parts) {
    const s = map.get(p.key);
    if (!s) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.translate(-s.ax * s.w, -s.ay * s.h);
    s.draw(ctx);
    ctx.restore();
  }
}

/** Draw a figure sprite (weapon) with its own origin at (x, y). */
function drawFigureSprite(ctx: Ctx, key: string, x: number, y: number, rot: number): void {
  drawParts(ctx, [{ key, x, y, rot }]);
}

// ---------------------------------------------------------------------------
// Guns
// ---------------------------------------------------------------------------

/** Run paint twice, the part beyond kinkX (gun space) turned by `bend` about the kink: a bent barrel. */
function kinked(ctx: Ctx, kinkX: number, bend: number, paint: () => void): void {
  if (bend === 0) {
    paint();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(-80, -40, 80 + kinkX, 80);
  ctx.clip();
  paint();
  ctx.restore();
  ctx.save();
  ctx.translate(kinkX, 0);
  ctx.rotate(bend);
  ctx.translate(-kinkX, 0);
  ctx.beginPath();
  ctx.rect(kinkX, -40, 80, 80);
  ctx.clip();
  paint();
  ctx.restore();
}

/** The nation's light gun: its machine gunner's own weapon sprite (Bren, MG34, DP-27). */
function lightGunModel(faction: FactionId): WeaponModel {
  return FIGURE_LOADOUT[faction].weapon.lmg;
}

/**
 * True if the nation's heavy gun is a water-cooled Maxim pattern drawn with the Vickers painter: the British Vickers,
 * and the Red Army's Maxim M1910 (on its wheeled Sokolov mount with a shield); the Germans fire the MG34 on the Lafette.
 */
function waterCooled(faction: FactionId): boolean {
  return faction !== 'german';
}

/** The Maxim's Sokolov mount: two small spoked wheels, the trail to the rear and the shield before the gunner. */
function sokolovMount(ctx: Ctx, muzzle: ArtPoint, groundY: number): void {
  const wx = muzzle.x - 24;
  const r = 5.6;
  const wy = groundY - r;
  // Trail running back to the ground, and the axle strut up to the cradle.
  strokeLine(ctx, [wx, wy, wx - 22, groundY - 1.2], GUN_STEEL, 1.6);
  strokeLine(ctx, [wx, wy, wx - 4, muzzle.y + 4.6], C.ink, 1.6);
  rimRect(ctx, wx - 12, muzzle.y + 3.4, 16, 2.8, 1, C.ink, C.steelRim, 0.8);
  // The wheel.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(wx, wy, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    strokeLine(ctx, [wx, wy, wx + Math.cos(a) * r, wy + Math.sin(a) * r], GUN_STEEL, 0.6);
  }
  ctx.fillStyle = GUN_LIGHT;
  ctx.beginPath();
  ctx.arc(wx, wy, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // The shield, seen edge-on: a plate standing just behind the jacket, tipped back a little.
  rimPoly(ctx, [muzzle.x - 27, muzzle.y - 11, muzzle.x - 25, muzzle.y - 11, muzzle.x - 23.6, muzzle.y + 7, muzzle.x - 25.6, muzzle.y + 7], mix(GUN_STEEL, C.canvasDark, 0.4), C.steelRim, 0.8);
}

/** The grip (weapon-sprite origin) of the light gun whose muzzle is at `muzzle`, at `angle`. */
function lightGunGrip(faction: FactionId, muzzle: ArtPoint, angle: number): ArtPoint {
  const g = WEAPON_GEOM[lightGunModel(faction)];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: muzzle.x - g.muzzleX * c + g.muzzleY * s, y: muzzle.y - g.muzzleX * s - g.muzzleY * c };
}

/** Light gun with its muzzle at `muzzle`; the bipod legs (if any) splay down to footY. */
function lightGun(ctx: Ctx, faction: FactionId, muzzle: ArtPoint, angle: number, bipodFootY: number | null, bend = 0): void {
  const model = lightGunModel(faction);
  const g = WEAPON_GEOM[model];
  const grip = lightGunGrip(faction, muzzle, angle);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (bipodFootY !== null) {
    const bx = grip.x + g.bipodX * c - g.bipodY * s;
    const by = grip.y + g.bipodX * s + g.bipodY * c;
    strokeLine(ctx, [bx, by, bx + 2.2, bipodFootY], GUN_LIGHT, 0.8);
    strokeLine(ctx, [bx, by, bx + 4.2, bipodFootY], GUN_STEEL, 0.9);
  }
  ctx.save();
  ctx.translate(grip.x, grip.y);
  ctx.rotate(angle);
  kinked(ctx, 14, bend, () => drawFigureSprite(ctx, `fig/weapon/${model}`, 0, 0, 0));
  ctx.restore();
}

const VICKERS_LEN = 42;

/** Vickers: water-jacketed barrel, square receiver and spade grips, in gun space (muzzle at the origin, along -x). */
/** The Vickers, or (maxim) the Red Army's Maxim M1910/30: the same water-cooled pattern with the big winter filler cap on
 * the front of the jacket. */
function paintVickers(ctx: Ctx, maxim: boolean): void {
  // Receiver, spade grips and the rear sight.
  rimRect(ctx, -39, -2.9, 13, 5.8, 0.8, C.ink, C.steelRim, 0.9);
  strokeLine(ctx, [-39, -1.4, -41.6, -1.4], C.ink, 1.2);
  strokeLine(ctx, [-41.6, -2.6, -41.6, 2.2], C.ink, 1.5);
  strokeLine(ctx, [-37.6, -2.2, -27.4, -2.2], rgba(C.steelRim, 0.5), 0.5);
  fillPoly(ctx, [-31.5, -2.9, -30.5, -5, -29.8, -5, -29.8, -2.9], C.ink);
  // The fat water jacket with its corrugations and filler cap.
  rimRect(ctx, -27.6, -3.3, 22, 6.6, 2.4, C.steel, C.steelRim, 1.1);
  for (let x = -25; x < -7; x += 2.6) strokeLine(ctx, [x, -2.6, x, 2.6], rgba(C.ink, 0.55), 0.6);
  strokeLine(ctx, [-26, -2.4, -7, -2.4], rgba(C.steelRim, 0.55), 0.6);
  if (maxim) {
    rimRect(ctx, -14, -6.6, 6, 3.6, 1.4, C.ink, C.steelRim, 0.7);
    strokeLine(ctx, [-14.6, -5.2, -15.6, -4.2], C.ink, 0.9);
  } else {
    rimRect(ctx, -24.8, -5, 3, 1.9, 0.5, C.ink, C.steelRim, 0.6);
  }
  // Front sight, muzzle block and the flared booster.
  fillPoly(ctx, [-8.2, -3.3, -7.5, -5.2, -6.8, -5.2, -6.8, -3.3], C.ink);
  fillPoly(ctx, [-5.8, -2.2, -2.6, -2.2, -2.4, -1.5, 0, -2.6, 0, 1.8, -2.4, 1, -2.6, 1.8, -5.8, 1.8], C.ink);
  strokeLine(ctx, [-5.4, -1.6, -2.8, -1.6], rgba(C.steelRim, 0.6), 0.5);
}

function vickers(ctx: Ctx, muzzle: ArtPoint, angle: number, bend = 0, maxim = false): void {
  ctx.save();
  ctx.translate(muzzle.x, muzzle.y);
  ctx.rotate(angle);
  kinked(ctx, -17, bend, () => paintVickers(ctx, maxim));
  ctx.restore();
}

/** A heavy-gun tripod under a gun whose crosshead is at (x, y): the front leg and two rear legs down to groundY. */
function tripodLegs(ctx: Ctx, x: number, y: number, groundY: number, front: number, rearNear: number, rearFar: number): void {
  strokeLine(ctx, [x, y, x + rearFar, groundY], mix(GUN_STEEL, C.rim, 0.25), 1.3);
  strokeLine(ctx, [x, y, x + front, groundY], GUN_STEEL, 1.6);
  strokeLine(ctx, [x, y, x + rearNear, groundY], C.ink, 1.7);
  strokeLine(ctx, [x - 0.4, y + 0.4, x + rearNear * 0.98, groundY - 0.6], rgba(C.steelRim, 0.45), 0.5);
  ctx.fillStyle = C.ink;
  ellipse(ctx, x + rearNear, groundY - 0.6, 2, 1);
  ctx.fill();
  ellipse(ctx, x + front, groundY - 0.6, 1.8, 0.9);
  ctx.fill();
}

/** The crosshead and cradle that hold a heavy gun on its tripod. */
function crosshead(ctx: Ctx, x: number, y: number, w: number): void {
  rimRect(ctx, x - w / 2, y - 1.6, w, 3.2, 1, C.ink, C.steelRim, 0.8);
  rimRect(ctx, x - 2, y, 4, 4, 0.8, GUN_STEEL, C.steelRim, 0.8);
}

/** The heavy gun for a nation on its tripod: Vickers or MG34 on the Lafette. */
function heavyGun(ctx: Ctx, faction: FactionId, muzzle: ArtPoint, groundY: number): void {
  if (faction === 'soviet') {
    sokolovMount(ctx, muzzle, groundY);
    vickers(ctx, muzzle, 0, 0, true);
  } else if (faction === 'british') {
    const hx = muzzle.x - 26;
    const hy = muzzle.y + 4.6;
    tripodLegs(ctx, hx, hy, groundY, 15, -15, -9);
    crosshead(ctx, hx, hy, 12);
    // The condenser hose from the jacket down behind the bags.
    strokeLine(ctx, [muzzle.x - 7, muzzle.y + 2.6, muzzle.x - 9, muzzle.y + 9, muzzle.x - 15, groundY - 8], C.inkSoft, 1.3);
    vickers(ctx, muzzle, 0);
  } else {
    const grip = lightGunGrip(faction, muzzle, 0);
    const hx = grip.x + 8;
    const hy = grip.y + 4.4;
    tripodLegs(ctx, hx, hy, groundY, 19, -14, -8);
    // The Lafette's long cradle with the buffer under the receiver.
    rimRect(ctx, grip.x - 4, grip.y + 1.8, 18, 2.6, 1, C.ink, C.steelRim, 0.8);
    rimRect(ctx, hx - 2, hy - 1, 4, 4.6, 0.8, GUN_STEEL, C.steelRim, 0.8);
    strokeLine(ctx, [grip.x - 4, grip.y + 4, grip.x - 6, grip.y + 8], C.ink, 1.2);
    lightGun(ctx, faction, muzzle, 0, null);
  }
}

/** Where the belt enters the gun (left side, at the feed). */
function feedPoint(faction: FactionId, muzzle: ArtPoint): ArtPoint {
  return waterCooled(faction) ? { x: muzzle.x - 31, y: muzzle.y + 2.4 } : { x: muzzle.x - 24, y: muzzle.y + 1.6 };
}

/** A cartridge belt hanging along a quadratic curve. */
function belt(ctx: Ctx, from: ArtPoint, ctrl: ArtPoint, to: ArtPoint): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, to.x, to.y);
  ctx.strokeStyle = C.canvasDark;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([0.9, 1.1]);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** A small steel ammunition box; (x, y) is its bottom-left corner on the ground. */
function ammoBox(ctx: Ctx, x: number, y: number, w: number, h: number, open = false): void {
  rimRect(ctx, x, y - h, w, h, 0.8, C.drum, C.drumRim);
  strokeLine(ctx, [x + 0.8, y - h + 1.8, x + w - 0.8, y - h + 1.8], rgba(C.drumDark, 0.9), 0.7);
  if (open) {
    fillPoly(ctx, [x + 1, y - h, x + w - 1, y - h, x + w - 1, y - h + 1.2, x + 1, y - h + 1.2], C.void);
    strokeLine(ctx, [x + 1, y - h, x - 2.5, y - h - 3.5], C.drumDark, 1.2);
  } else {
    strokeLine(ctx, [x + w * 0.35, y - h - 0.6, x + w * 0.65, y - h - 0.6], C.drumDark, 0.9);
  }
  strokeLine(ctx, [x + 1.2, y - 1.4, x + w - 1.2, y - 1.4], rgba(C.drumDark, 0.6), 0.5);
}

/** A wooden ammunition crate; (x, y) is its bottom-left corner on the ground. */
function crate(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rimRect(ctx, x, y - h, w, h, 0.6, C.crate, C.crateRim);
  ctx.fillStyle = C.crateDark;
  ctx.fillRect(x, y - h, 1.4, h);
  ctx.fillRect(x + w - 1.4, y - h, 1.4, h);
  strokeLine(ctx, [x + 1.6, y - h * 0.5, x + w - 1.6, y - h * 0.5], rgba(C.crateDark, 0.8), 0.5);
}

/** A course of bags pushed back into the distance (darker, as in shadow). */
function farCourse(ctx: Ctx, x0: number, x1: number, yBase: number, rows: number, shade: number): void {
  bagWall(ctx, x0, yBase, Math.ceil((x1 - x0) / BAG_W), rows, BAG_W, BAG_H, 2);
  charOver(ctx, x0 - 2, yBase - BAG_H - rows * BAG_H, x1 - x0 + BAG_W + 4, rows * BAG_H + BAG_H + 2, shade);
}

/** Bags burst and slumped into a heap of spilled sand, with a few thrown about. */
function burstBags(ctx: Ctx, x0: number, x1: number, yBase: number, height: number, rand: () => number): void {
  heap(ctx, x0, x1, yBase, height, rand, mix(C.sandbag, C.earth, 0.35), C.sandbagRim);
  const n = Math.max(2, Math.round((x1 - x0) / 13));
  for (let i = 0; i < n; i++) {
    const x = x0 + 6 + ((x1 - x0 - 12) * (i + rand() * 0.6)) / n;
    const top = Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * height * 0.7;
    looseBag(ctx, x, yBase - top * 0.8 - 2, (rand() - 0.5) * 0.9, rand() - 0.6, BAG_W - 2 + rand() * 2, BAG_H - 2.5);
  }
  // Sand dribbling out of the torn bags.
  for (let i = 0; i < n * 3; i++) {
    ctx.fillStyle = rgba(C.sandbagRim, 0.35 + rand() * 0.3);
    ctx.beginPath();
    ctx.arc(x0 + rand() * (x1 - x0), yBase - rand() * 2.5, 0.6 + rand() * 1.1, 0, TAU);
    ctx.fill();
  }
}

/** A log seen from the side, ends sawn; from (x0, y) to (x1, y) of thickness t (y = top edge). */
function log(ctx: Ctx, x0: number, x1: number, y: number, t: number, angle = 0): void {
  ctx.save();
  ctx.translate(x0, y);
  ctx.rotate(angle);
  const len = x1 - x0;
  rimRect(ctx, 0, 0, len, t, t / 2, C.timber, C.timberRim, 1);
  strokeLine(ctx, [t * 0.6, t * 0.62, len - t * 0.8, t * 0.58], rgba(C.timberDark, 0.7), 0.6);
  ctx.fillStyle = mix(C.timberRim, C.sandbagRim, 0.4);
  ellipse(ctx, len - t * 0.35, t / 2, t * 0.32, t * 0.46);
  ctx.fill();
  ctx.strokeStyle = rgba(C.timberDark, 0.8);
  ctx.lineWidth = 0.4;
  ellipse(ctx, len - t * 0.35, t / 2, t * 0.14, t * 0.22);
  ctx.stroke();
  ctx.restore();
}

/** An upright squared post from groundY up to topY. */
function post(ctx: Ctx, x: number, topY: number, groundY: number, w: number): void {
  rimRect(ctx, x - w / 2, topY, w, groundY - topY, 0.6, C.timber, C.timberRim, 0.8);
  strokeLine(ctx, [x + w / 2 - 0.8, topY + 1, x + w / 2 - 0.8, groundY - 1], rgba(C.timberDark, 0.8), 0.7);
}

// ---------------------------------------------------------------------------
// Stage 0: one gunner behind a row of bags
// ---------------------------------------------------------------------------

const PRONE: CrewPose = {
  hip: { x: -27, y: -4.4 },
  spine: -0.17,
  chest: -0.42,
  neck: -0.8,
  near: { thigh: Math.PI + 0.07, shin: Math.PI + 0.38, foot: HALF_PI + 0.4 },
  far: { thigh: Math.PI - 0.06, shin: Math.PI + 0.12, foot: HALF_PI + 0.2 },
  nearHand: { x: 3.6, y: -12.2 },
  farHand: { x: -3, y: -10 },
};

function paintGunner(ctx: Ctx, faction: FactionId, ruin: boolean): void {
  const L = HQ_GUN_LAYOUT.gunner;
  const rand = rng(41);
  if (!ruin) {
    const crew = crewParts(faction, PRONE);
    drawParts(ctx, crew.body);
    bagCourse(ctx, -1, 28, -8, BAG_W, BAG_H, -1, 1);
    lightGun(ctx, faction, L.muzzle, 0, -6);
    drawParts(ctx, crew.arm);
    // The spare magazine pouch or ammunition box at his side.
    ammoBox(ctx, -20, 1.5, 7, 5);
  } else {
    burstBags(ctx, -4, 30, 1.5, 6, rand);
    // The gun knocked off the bags, lying nose down in the dirt with its bipod in the air.
    lightGun(ctx, faction, { x: 30, y: -2 }, 0.16, null, 0.12);
    ammoBox(ctx, -26, 1.5, 7, 5, true);
    looseBag(ctx, -14, -2.5, 0.3, -0.4, BAG_W - 2, BAG_H - 3);
    scorch(ctx, 8, -2, 26, 10, 0.75);
  }
  footing(ctx, -50, 34, 2, 3.5, rand);
}

// ---------------------------------------------------------------------------
// Stage 1: a horseshoe emplacement, gun on a low mount
// ---------------------------------------------------------------------------

const KNEEL: CrewPose = {
  hip: { x: -9, y: -16.4 },
  spine: -0.95,
  chest: -0.62,
  neck: -0.55,
  near: { thigh: 0.04, shin: HALF_PI - 0.03, foot: 0 },
  far: { thigh: HALF_PI + 0.28, shin: Math.PI - 0.06, foot: 1.25 },
  nearHand: { x: 0, y: 0 },
  farHand: { x: 0, y: 0 },
};

function paintEmplacement(ctx: Ctx, faction: FactionId, ruin: boolean): void {
  const L = HQ_GUN_LAYOUT.emplacement;
  const rand = rng(57);
  const grip = lightGunGrip(faction, L.muzzle, 0);
  // The back of the horseshoe, across the far side.
  farCourse(ctx, -34, 12, -4, ruin ? 1 : 2, 0.32);
  if (!ruin) {
    const pose: CrewPose = { ...KNEEL, nearHand: { x: grip.x, y: grip.y + 0.4 }, farHand: { x: grip.x - 8, y: grip.y + 1.6 } };
    const crew = crewParts(faction, pose);
    drawParts(ctx, crew.body);
    // The front wall, two courses, with a timber block and pintle the gun swings on.
    bagWall(ctx, 12, 1, 2, 2, BAG_W, BAG_H, 1);
    rimRect(ctx, grip.x + 4, -17.8, 10, 3.4, 0.6, C.timber, C.timberRim, 0.8);
    strokeLine(ctx, [grip.x + 9, -17.6, grip.x + 9, grip.y + 2], C.ink, 1.6);
    lightGun(ctx, faction, L.muzzle, 0, null);
    drawParts(ctx, crew.arm);
    ammoBox(ctx, -30, -3, 8, 5.5);
  } else {
    burstBags(ctx, 8, 44, 1, 10, rand);
    // The mount snapped, the gun thrown back over the rubble.
    rimPoly(ctx, [10, -6, 18, -9.5, 19.5, -6.5, 11.5, -3], C.timber, C.timberRim, 0.8);
    lightGun(ctx, faction, { x: 30, y: -12 }, -0.3, -4, -0.18);
    ammoBox(ctx, -28, -2, 8, 5.5, true);
  }
  // The near arm of the horseshoe, curling round in front.
  bagCourse(ctx, -38, 10, -6, BAG_W, BAG_H, -38, 3);
  sandbag(ctx, -41, -12.5, BAG_W, BAG_H, -0.1);
  if (ruin) {
    looseBag(ctx, -26, -9, -0.5, -0.3);
    scorch(ctx, 14, -8, 30, 16, 0.75);
    scorch(ctx, -20, -6, 18, 10, 0.5);
  }
  footing(ctx, -42, 44, 2, 5, rand);
}

// ---------------------------------------------------------------------------
// Stage 2: the heavy gun on its tripod behind higher walls
// ---------------------------------------------------------------------------

/** How far in front of a seated gunner's hip his hands hold the gun (wu). */
const SEAT_REACH = 21;

/** Sitting on a box with the hip at (hipX, hipY): thighs slope down to the knees, shins nearly upright to the feet. */
function seated(hipX: number, hipY: number, footY: number): CrewPose {
  const B = FIGURE.bones;
  const kneeY = footY - B.shin * 0.97;
  const thigh = Math.asin(Math.max(-0.3, Math.min(0.9, (kneeY - hipY) / B.thigh)));
  return {
    hip: { x: hipX, y: hipY },
    spine: -1.32,
    chest: -1.08,
    neck: -0.62,
    near: { thigh, shin: Math.asin(0.97), foot: 0 },
    far: { thigh: thigh + 0.1, shin: Math.asin(0.97) + 0.1, foot: 0.1 },
    nearHand: { x: 0, y: 0 },
    farHand: { x: 0, y: 0 },
  };
}

/** Grip points where a heavy gun's gunner holds on: the Vickers spade grips, the MG34's pistol grip and stock. */
function heavyHands(faction: FactionId, muzzle: ArtPoint): [ArtPoint, ArtPoint] {
  if (waterCooled(faction)) {
    const x = muzzle.x - VICKERS_LEN + 0.4;
    return [
      { x, y: muzzle.y + 1.2 },
      { x: x - 0.6, y: muzzle.y - 1.4 },
    ];
  }
  const g = lightGunGrip(faction, muzzle, 0);
  return [
    { x: g.x, y: g.y + 1.2 },
    { x: g.x - 6, y: g.y + 0.4 },
  ];
}

function paintTripod(ctx: Ctx, faction: FactionId, ruin: boolean): void {
  const L = HQ_GUN_LAYOUT.tripod;
  const rand = rng(73);
  farCourse(ctx, -36, 22, -5, ruin ? 1 : 3, 0.32);
  if (!ruin) {
    const [nh, fh] = heavyHands(faction, L.muzzle);
    const base = seated(nh.x - SEAT_REACH, -15.5, -2.6);
    const crew = crewParts(faction, { ...base, nearHand: nh, farHand: fh });
    crate(ctx, base.hip.x - 7, 1, 13, 12);
    drawParts(ctx, crew.body);
    heavyGun(ctx, faction, L.muzzle, 0);
    bagWall(ctx, 22, 1, 2, 3, BAG_W, BAG_H, 1);
    // Re-draw the gun's front over the wall top so the barrel reads clear of the bags.
    if (waterCooled(faction)) vickers(ctx, L.muzzle, 0, 0, faction === 'soviet');
    else lightGun(ctx, faction, L.muzzle, 0, null);
    drawParts(ctx, crew.arm);
    const feed = feedPoint(faction, L.muzzle);
    ammoBox(ctx, 6, -3, 9, 7, true);
    belt(ctx, { x: 9, y: -10 }, { x: feed.x - 4, y: feed.y + 10 }, feed);
    // Spare boxes stacked at the back.
    ammoBox(ctx, -42, -3, 9, 6.5);
    ammoBox(ctx, -41, -9.5, 9, 6.5);
  } else {
    burstBags(ctx, 14, 52, 1, 15, rand);
    // The tripod knocked flat, the gun lying across it with its barrel bent.
    strokeLine(ctx, [-6, -1.5, 16, -10], GUN_STEEL, 1.6);
    strokeLine(ctx, [2, -1, 10, -14], C.ink, 1.6);
    if (waterCooled(faction)) vickers(ctx, { x: 32, y: -11 }, -0.3, 0.32, faction === 'soviet');
    else lightGun(ctx, faction, { x: 30, y: -13 }, -0.32, null, 0.3);
    crate(ctx, -26, 1, 13, 12);
    ammoBox(ctx, -42, -2, 9, 6.5, true);
    looseBag(ctx, -32, -12, 0.4, -0.2);
  }
  bagCourse(ctx, -40, 4, -6, BAG_W, BAG_H, -40, 3);
  sandbag(ctx, -44, -12.6, BAG_W, BAG_H, 0.1);
  if (ruin) {
    scorch(ctx, 20, -12, 34, 18, 0.8);
    scorch(ctx, -26, -6, 20, 10, 0.5);
  }
  footing(ctx, -46, 50, 2, 5, rand);
}

// ---------------------------------------------------------------------------
// Stage 3: the fortified nest
// ---------------------------------------------------------------------------

const LOADER: CrewPose = {
  hip: { x: -27, y: -16.4 },
  spine: -1.3,
  chest: -1.0,
  neck: -0.55,
  near: { thigh: 0.1, shin: HALF_PI - 0.1, foot: 0 },
  far: { thigh: HALF_PI + 0.3, shin: Math.PI - 0.1, foot: 1.25 },
  nearHand: { x: -9, y: -21 },
  farHand: { x: -12, y: -18 },
};

const ROOF_Y = -47;

function paintNestFrame(ctx: Ctx): void {
  // The back revetment of planks inside the nest.
  rimRect(ctx, -46, ROOF_Y, 92, -ROOF_Y, 0.5, C.timberDark, C.timber, 0.8);
  for (let x = -40; x < 44; x += 11) strokeLine(ctx, [x, ROOF_Y + 2, x, -2], rgba(C.void, 0.45), 0.7);
  for (let y = ROOF_Y + 8; y < -2; y += 8) strokeLine(ctx, [-45, y, 45, y], rgba(C.timber, 0.55), 0.6);
  // Shade under the roof.
  const g = ctx.createLinearGradient(0, ROOF_Y, 0, -10);
  g.addColorStop(0, rgba(C.void, 0.55));
  g.addColorStop(1, rgba(C.void, 0.05));
  ctx.fillStyle = g;
  ctx.fillRect(-46, ROOF_Y, 92, -ROOF_Y - 10);
  post(ctx, -44, ROOF_Y, 1, 5);
}

function paintNestRoof(ctx: Ctx): void {
  post(ctx, 44, ROOF_Y, -28, 5);
  log(ctx, -52, 56, ROOF_Y - 6, 6);
  log(ctx, -49, 52, ROOF_Y - 11, 5.5);
  bagCourse(ctx, -46, 50, ROOF_Y - 19, BAG_W, BAG_H, -46, 0);
  bagCourse(ctx, -38, 36, ROOF_Y - 26, BAG_W, BAG_H, -38 + BAG_W / 2, 2);
  // Scrim of sods and grass on top.
  ctx.fillStyle = rgba(C.canvasDark, 0.7);
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(-34 + i * 8.5, ROOF_Y - 26.4, 3.5, 1.4, 0, 0, TAU);
    ctx.fill();
  }
}

function paintNest(ctx: Ctx, faction: FactionId, ruin: boolean): void {
  const L = HQ_GUN_LAYOUT.nest;
  const rand = rng(97);
  // Earth banked behind the nest.
  rimPoly(ctx, [-54, 2, -52, -20, -46, -34, -46, 2], C.earth, C.earthRim);
  if (!ruin) {
    paintNestFrame(ctx);
    const [nh, fh] = heavyHands(faction, L.muzzle);
    const seat = seated(nh.x - SEAT_REACH, -19.5, -2.6);
    const gunner = crewParts(faction, { ...seat, nearHand: nh, farHand: fh });
    const loader = crewParts(faction, LOADER);
    // Boxes: the gunner's seat, the loader's open belt box, spares by the back post.
    crate(ctx, seat.hip.x - 7, 1, 14, 16);
    ammoBox(ctx, -40, 1, 9, 6.5);
    ammoBox(ctx, -39, -5.5, 9, 6.5);
    drawParts(ctx, loader.body);
    drawParts(ctx, loader.arm);
    drawParts(ctx, gunner.body);
    heavyGun(ctx, faction, L.muzzle, 1);
    // The front wall up to the firing slot.
    bagWall(ctx, 26, 1, 2, 4, BAG_W, BAG_H, 1);
    if (waterCooled(faction)) vickers(ctx, L.muzzle, 0, 0, faction === 'soviet');
    else lightGun(ctx, faction, L.muzzle, 0, null);
    const feed = feedPoint(faction, L.muzzle);
    belt(ctx, { x: -13, y: -8 }, { x: -12, y: -26 }, { x: -9, y: -21 });
    belt(ctx, { x: -9, y: -21 }, { x: feed.x - 10, y: feed.y + 12 }, feed);
    ammoBox(ctx, -17, 1, 10, 7, true);
    drawParts(ctx, gunner.arm);
    paintNestRoof(ctx);
    bagCourse(ctx, -50, 18, -5, BAG_W, BAG_H, -50, 3);
    sandbag(ctx, -53, -11.5, BAG_W, BAG_H, 0.1);
  } else {
    // The roof has come down: the back post leans, the logs slide off the front.
    rimRect(ctx, -46, -26, 30, 26, 0.5, C.timberDark, C.timber, 0.8);
    post(ctx, -44, -30, 1, 5);
    ctx.save();
    ctx.translate(-34, 1);
    ctx.rotate(0.35);
    post(ctx, 0, -40, 0, 5);
    ctx.restore();
    log(ctx, -50, 54, -32, 6, 0.36);
    log(ctx, -44, 48, -24, 5.5, 0.1);
    burstBags(ctx, -48, 58, 1, 20, rand);
    burstBags(ctx, 18, 60, 1, 24, rand);
    post(ctx, 44, -22, 1, 5);
    // The broken stump of the front post and the gun's bent barrel poking out of the wreck.
    if (waterCooled(faction)) vickers(ctx, { x: 52, y: -17 }, -0.22, 0.38, faction === 'soviet');
    else lightGun(ctx, faction, { x: 50, y: -19 }, -0.22, null, 0.36);
    log(ctx, -20, 42, -13, 5, -0.12);
    ammoBox(ctx, -42, 1, 9, 6.5, true);
    looseBag(ctx, -12, -24, -0.3, -0.3);
    charOver(ctx, -56, -70, 120, 76, 0.22);
    scorch(ctx, 20, -20, 40, 24, 0.8);
    scorch(ctx, -24, -18, 26, 18, 0.6);
  }
  footing(ctx, -54, 62, 2, 5, rand);
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

const PAINT: Record<HqGunStyle, (ctx: Ctx, faction: FactionId, ruin: boolean) => void> = {
  gunner: paintGunner,
  emplacement: paintEmplacement,
  tripod: paintTripod,
  nest: paintNest,
};

/** Both states (intact, ruin) of one HQ gun style for one nation. */
export function hqGunSpecs(style: HqGunStyle, faction: FactionId): SpriteSpec[] {
  const box = HQ_GUN_LAYOUT[style].box;
  return STATES.map((state) => makeSpec(hqGunKey(style, faction, state), box, (ctx) => PAINT[style](ctx, faction, state === 'ruin')));
}
