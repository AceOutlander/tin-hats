/**
 * Figure parts as SpriteSpecs (keys "fig/..."). Body parts are flat black with
 * a separate light rim layer drawn behind the whole figure, so the silhouette
 * reads on dark backdrops while limbs crossing the body stay clean. Helmets and
 * kit carry the faction tint; weapons are drawn as readable silhouettes.
 *
 * Frames:
 *  - limbs, torso pieces and the head are drawn along +x from their root joint
 *    (rotation = bone angle);
 *  - helmets, pack and pouches are drawn upright (x forward, y down) and rotate
 *    with the bone they sit on (rotation = bone angle + PI/2);
 *  - weapons are drawn in weapon space: the grip at the origin, +x toward the
 *    muzzle, +y toward the underside (rotation = barrel angle);
 *  - boots: ankle at the origin, sole at y = FIGURE.ankle (rotation = pitch).
 */
import { FACTIONS } from '../../data/factions';
import { FIGURE, FIGURE_CRATE, FIGURE_KIND_LIST, FIGURE_LOADOUT, WEAPON_GEOM, type FigureKind, type HandItem, type WeaponModel } from '../../data/figure';
import type { FactionId } from '../../data/schema';
import type { SpriteSpec } from '../types';
import { gearFigureSprites } from './gear';
import { TAU } from './math';

type Ctx = CanvasRenderingContext2D;
type Paint = (ctx: Ctx) => void;

const C = FIGURE.colors;
const RAD = FIGURE.radius;
const B = FIGURE.bones;
const RIM = FIGURE.rimWidth;

export function makeSpec(key: string, x0: number, y0: number, x1: number, y1: number, paint: Paint): SpriteSpec {
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    key,
    w,
    h,
    ax: -x0 / w,
    ay: -y0 / h,
    draw(ctx: Ctx): void {
      ctx.save();
      ctx.translate(-x0, -y0);
      paint(ctx);
      ctx.restore();
    },
  };
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function ch(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

export function mix(a: string, b: string, t: number): string {
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
    out += Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------
function poly(ctx: Ctx, pts: readonly number[]): void {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillPath(ctx: Ctx, color: string, build: () => void): void {
  ctx.beginPath();
  build();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Fill a path and give it a thin light edge so dark kit reads on dark ground. */
export function solid(ctx: Ctx, color: string, build: () => void, edge = 'rgba(232, 226, 206, 0.32)', edgeWidth = 0.32): void {
  ctx.beginPath();
  build();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = edgeWidth;
  ctx.strokeStyle = edge;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function line(ctx: Ctx, color: string, width: number, pts: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function dot(ctx: Ctx, color: string, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Tapered capsule along +x from 0 to L (union of two circles and the band between them). */
function capsule(ctx: Ctx, L: number, r0: number, r1: number): void {
  ctx.moveTo(0, -r0);
  ctx.lineTo(L, -r1);
  ctx.lineTo(L, r1);
  ctx.lineTo(0, r0);
  ctx.closePath();
  ctx.moveTo(r0, 0);
  ctx.arc(0, 0, r0, 0, TAU);
  ctx.moveTo(L + r1, 0);
  ctx.arc(L, 0, r1, 0, TAU);
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------
function limbSpec(key: string, L: number, r: readonly number[], color: string, grow: number): SpriteSpec {
  const a = r[0] + grow;
  const b = r[1] + grow;
  const m = Math.max(a, b);
  return makeSpec(key, -a, -m, L + b, m, (ctx) => fillPath(ctx, color, () => capsule(ctx, L, a, b)));
}

const NECK_R = 1.9;

function headSpec(key: string, color: string, grow: number): SpriteSpec {
  const hr = FIGURE.headRadius + grow;
  const nr = NECK_R + grow;
  const L = B.neck;
  return makeSpec(key, -nr, -hr, L + hr, hr, (ctx) =>
    fillPath(ctx, color, () => {
      capsule(ctx, L * 0.6, nr, nr);
      ctx.moveTo(L + hr, 0);
      ctx.arc(L, 0, hr, 0, TAU);
    }),
  );
}

// Light rubber and a pale canister so the mask reads against the black silhouette at phone size.
const MASK_RUBBER = '#8f8a72';
const MASK_RUBBER_EDGE = '#5d5947';
const MASK_SNOUT = '#77725d';
const MASK_STRAP = '#4a4637';
const MASK_CAN = '#a59c7b';
const MASK_CAN_DARK = '#5a5442';
const MASK_RING = '#cfc6a6';

/**
 * The flamethrower's head: the plain head wearing a gas mask (rubber face piece, one round lens glowing with the fire
 * in front of him, the snout and its filter canister hanging below the chin, straps round the back of the head).
 */
function headMaskSpec(key: string): SpriteSpec {
  const hr = FIGURE.headRadius;
  const L = B.neck;
  const k = hr / 5;
  return makeSpec(key, Math.min(-NECK_R, L - 11 * k), -hr - 0.6, L + hr + 0.4, 10.8 * k, (ctx) => {
    fillPath(ctx, C.body, () => {
      capsule(ctx, L * 0.6, NECK_R, NECK_R);
      ctx.moveTo(L + hr, 0);
      ctx.arc(L, 0, hr, 0, TAU);
    });
    // Mask paths are drawn upright (x toward the face, y down, origin at the head centre) for a head of radius 5.
    ctx.translate(L, 0);
    ctx.rotate(Math.PI / 2);
    ctx.scale(k, k);
    line(ctx, MASK_STRAP, 0.9, [0.6, -2.7, -4.3, -3.3]);
    line(ctx, MASK_STRAP, 0.9, [-0.2, 2.8, -4.5, 1.6]);
    // Face piece, with a darker rim so it separates from the head.
    const face = (): void => {
      ctx.moveTo(0.3, -3.6);
      ctx.quadraticCurveTo(3.9, -3.9, 5.1, -2.3);
      ctx.quadraticCurveTo(6.0, -0.2, 5.6, 1.7);
      ctx.quadraticCurveTo(4.8, 4.5, 2.6, 4.9);
      ctx.quadraticCurveTo(0.2, 4.9, -0.9, 3.5);
      ctx.quadraticCurveTo(-1.8, 0.2, 0.3, -3.6);
      ctx.closePath();
    };
    solid(ctx, MASK_RUBBER_EDGE, face);
    ctx.save();
    ctx.translate(2.4, 0.6);
    ctx.scale(0.86, 0.86);
    ctx.translate(-2.4, -0.6);
    solid(ctx, MASK_RUBBER, face);
    ctx.restore();
    // Snout and the round filter canister hanging from it.
    solid(ctx, MASK_SNOUT, () => poly(ctx, [3.6, 0.8, 6.2, 1.5, 7.3, 3.5, 5.5, 4.8, 3.4, 3.3]));
    line(ctx, MASK_RUBBER_EDGE, 0.5, [4.4, 1.5, 6.2, 4.2]);
    ctx.save();
    ctx.translate(6.6, 6.6);
    ctx.rotate(-0.3);
    solid(ctx, MASK_CAN_DARK, () => rrect(ctx, -2.5, -2.9, 5.0, 5.9, 1.4));
    solid(ctx, MASK_CAN, () => rrect(ctx, -2.1, -2.5, 4.2, 5.1, 1.1));
    line(ctx, MASK_CAN_DARK, 0.55, [-2.1, -0.7, 2.1, -0.7]);
    line(ctx, MASK_CAN_DARK, 0.55, [-2.1, 1.0, 2.1, 1.0]);
    solid(ctx, MASK_CAN_DARK, () => rrect(ctx, -1.8, 2.3, 3.6, 0.9, 0.35));
    ctx.restore();
    // The lens: a steel ring round glass that glows orange with the flames.
    dot(ctx, MASK_RING, 3.4, -1.0, 1.75);
    const g = ctx.createRadialGradient(3.6, -1.2, 0.1, 3.4, -1.0, 1.35);
    g.addColorStop(0, '#fff3b8');
    g.addColorStop(0.45, '#f7a438');
    g.addColorStop(1, '#9c3e16');
    ctx.beginPath();
    ctx.arc(3.4, -1.0, 1.3, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    dot(ctx, 'rgba(255, 255, 255, 0.75)', 3.9, -1.5, 0.3);
  });
}

function bootPath(ctx: Ctx): void {
  const h = FIGURE.ankle;
  const L = FIGURE.footLength;
  const He = FIGURE.heel;
  ctx.moveTo(-He - 0.2, 0.9);
  ctx.quadraticCurveTo(-He - 0.3, h, -He + 0.6, h);
  ctx.lineTo(L - 0.9, h);
  ctx.quadraticCurveTo(L + 0.2, h, L, h - 1.0);
  ctx.quadraticCurveTo(L - 0.6, -0.1, 2.6, -0.4);
  ctx.lineTo(1.8, -1.2);
  ctx.quadraticCurveTo(1.7, -2.3, 0.2, -2.3);
  ctx.lineTo(-1.4, -2.3);
  ctx.quadraticCurveTo(-He - 0.3, -2.1, -He - 0.2, 0.9);
  ctx.closePath();
}

function bootSpec(key: string, color: string, grow: number): SpriteSpec {
  const h = FIGURE.ankle;
  return makeSpec(key, -FIGURE.heel - 0.6 - grow, -2.6 - grow, FIGURE.footLength + 0.6 + grow, h + 0.2 + grow, (ctx) => {
    ctx.beginPath();
    bootPath(ctx);
    ctx.fillStyle = color;
    ctx.fill();
    if (grow > 0) {
      ctx.lineWidth = grow * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------------------
// Helmets (head space: origin at the head centre, x toward the face, y down)
// ---------------------------------------------------------------------------
export function brodiePath(ctx: Ctx): void {
  // Wide flat brim with a shallow bowl on top.
  ctx.moveTo(-9.0, -2.5);
  ctx.quadraticCurveTo(-8.7, -3.5, -6.0, -3.6);
  ctx.bezierCurveTo(-5.6, -8.9, 5.6, -8.9, 6.0, -3.6);
  ctx.quadraticCurveTo(8.7, -3.5, 9.0, -2.5);
  ctx.quadraticCurveTo(8.8, -2.1, 8.0, -2.3);
  ctx.quadraticCurveTo(0, -3.0, -8.0, -2.3);
  ctx.quadraticCurveTo(-8.8, -2.1, -9.0, -2.5);
  ctx.closePath();
}

export function stahlhelmPath(ctx: Ctx): void {
  // Deep dome, short visor, the skirt flaring out over the ear and the neck.
  ctx.moveTo(6.9, -2.3);
  ctx.quadraticCurveTo(6.5, -2.9, 5.6, -3.4);
  ctx.bezierCurveTo(5.2, -10.2, -6.0, -10.0, -6.1, -3.6);
  ctx.quadraticCurveTo(-6.4, -0.6, -8.3, 1.4);
  ctx.quadraticCurveTo(-8.2, 2.3, -7.0, 2.0);
  ctx.quadraticCurveTo(-4.8, 0.9, -3.4, -0.6);
  ctx.quadraticCurveTo(0.6, -1.3, 4.2, -1.7);
  ctx.quadraticCurveTo(6.0, -1.8, 6.9, -2.3);
  ctx.closePath();
}

export function helmetSpec(key: string, kind: 'brodie' | 'stahlhelm', tint: string, dark: string, rim: boolean): SpriteSpec {
  // Paths are drawn for a head of radius 5.4 and scaled to the real head.
  const k = FIGURE.headRadius / 5.4;
  const x0 = (kind === 'brodie' ? -10.4 : -9.2) * k;
  const x1 = (kind === 'brodie' ? 10.4 : 7.8) * k;
  const y0 = (kind === 'brodie' ? -9.2 : -10.4) * k;
  const y1 = (kind === 'brodie' ? 0.3 : 3.2) * k;
  const g = rim ? RIM : 0;
  return makeSpec(key, x0 - g, y0 - g, x1 + g, y1 + g, (ctx) => {
    ctx.scale(k, k);
    ctx.beginPath();
    if (kind === 'brodie') brodiePath(ctx);
    else stahlhelmPath(ctx);
    if (rim) {
      ctx.lineWidth = (RIM * 2) / k;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = C.rim;
      ctx.stroke();
      ctx.fillStyle = C.rim;
      ctx.fill();
      return;
    }
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const light = mix(tint, '#ffffff', 0.28);
    if (kind === 'brodie') {
      // Shading under the bowl's curve, a highlight on the crown and the brim's dark underside.
      fillPath(ctx, light, () => ctx.ellipse(-1.2, -7.2, 3.6, 1.0, -0.1, 0, TAU));
      fillPath(ctx, dark, () => ctx.rect(-10, -3.0, 20, 1.2));
      line(ctx, mix(dark, '#000000', 0.25), 0.5, [-5.8, -3.9, 5.8, -3.9]);
    } else {
      fillPath(ctx, light, () => ctx.ellipse(-0.8, -7.9, 3.2, 1.1, -0.15, 0, TAU));
      // The step where the skirt flares out, and the vent lug.
      line(ctx, dark, 0.6, [5.4, -3.2, 1.2, -3.0, -3.4, -2.6, -6.0, -1.8]);
      dot(ctx, dark, -2.0, -5.0, 0.55);
      fillPath(ctx, dark, () => {
        ctx.moveTo(-6.2, -1.0);
        ctx.quadraticCurveTo(-6.8, 0.8, -8.3, 1.6);
        ctx.lineTo(-7.0, 2.2);
        ctx.quadraticCurveTo(-5.6, 1.0, -4.6, -0.6);
        ctx.closePath();
      });
    }
    ctx.restore();
    ctx.beginPath();
    if (kind === 'brodie') brodiePath(ctx);
    else stahlhelmPath(ctx);
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = mix(dark, '#000000', 0.4);
    ctx.stroke();
  });
}

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------
function packSpec(key: string, tint: string, dark: string): SpriteSpec {
  // Anchored at the chest joint, upright: the upper spine runs from y = 0 to y = -8.
  return makeSpec(key, -9.0, -9.4, 0.6, 0.6, (ctx) => {
    solid(ctx, tint, () => rrect(ctx, -8.2, -7.2, 5.4, 7.4, 1.5));
    solid(ctx, dark, () => rrect(ctx, -8.6, -8.8, 6.2, 2.2, 1.1));
    line(ctx, dark, 0.6, [-7.6, -3.4, -3.2, -3.4]);
    line(ctx, dark, 0.7, [-3.2, -6.6, -0.8, -6.0, 0.0, -4.4]);
  });
}

export function pouchesSpec(key: string, tint: string, dark: string): SpriteSpec {
  // Anchored at the hip, upright: belt, ammunition pouch at the front, entrenching tool behind.
  return makeSpec(key, -6.2, -7.0, 5.6, 0.2, (ctx) => {
    solid(ctx, dark, () => rrect(ctx, -5.6, -6.4, 2.9, 5.6, 1.0));
    solid(ctx, tint, () => rrect(ctx, -3.9, -4.1, 7.8, 1.6, 0.6));
    solid(ctx, tint, () => rrect(ctx, 1.6, -6.6, 3.6, 4.6, 0.9));
    line(ctx, dark, 0.45, [1.9, -5.3, 4.9, -5.3]);
  });
}

function satchelSpec(key: string, tint: string): SpriteSpec {
  // Hangs along +x from its strap point.
  return makeSpec(key, -0.8, -4.0, 10.6, 4.0, (ctx) => {
    line(ctx, tint, 0.9, [0, 0, 3.2, 0]);
    solid(ctx, C.white, () => rrect(ctx, 3.0, -3.4, 7.0, 6.8, 1.2), 'rgba(40, 36, 30, 0.55)', 0.4);
    fillPath(ctx, C.red, () => {
      ctx.rect(5.9, -2.3, 1.2, 4.6);
      ctx.rect(4.2, -0.6, 4.6, 1.2);
    });
    fillPath(ctx, mix(C.white, '#000000', 0.18), () => ctx.rect(3.0, -3.4, 1.4, 6.8));
  });
}

function armbandSpec(): SpriteSpec {
  return makeSpec('fig/kit/armband', -0.2, -2.4, 5.0, 2.4, (ctx) => {
    fillPath(ctx, C.white, () => ctx.rect(2.5, -2.1, 2.2, 4.2));
    fillPath(ctx, C.red, () => {
      ctx.rect(3.3, -1.2, 0.7, 2.4);
      ctx.rect(2.5, -0.35, 2.2, 0.7);
    });
  });
}

function crateSpec(key: string, tint: string, dark: string): SpriteSpec {
  const hw = FIGURE_CRATE.halfW;
  const hh = FIGURE_CRATE.halfH;
  const wood = mix(C.crate, tint, 0.45);
  const woodDark = mix(C.crateDark, dark, 0.4);
  return makeSpec(key, -hw - 0.8, -hh - 0.8, hw + 0.8, hh + 0.8, (ctx) => {
    solid(ctx, wood, () => rrect(ctx, -hw, -hh, hw * 2, hh * 2, 0.7), 'rgba(236, 228, 204, 0.4)', 0.4);
    line(ctx, woodDark, 0.35, [-hw + 0.6, -hh * 0.33, hw - 0.6, -hh * 0.33]);
    line(ctx, woodDark, 0.35, [-hw + 0.6, hh * 0.33, hw - 0.6, hh * 0.33]);
    fillPath(ctx, woodDark, () => {
      ctx.rect(-hw, -hh, 1.5, hh * 2);
      ctx.rect(hw - 1.5, -hh, 1.5, hh * 2);
    });
    // Stencil band.
    fillPath(ctx, mix(C.white, wood, 0.35), () => ctx.rect(-2.6, -1.0, 5.2, 2.0));
    fillPath(ctx, woodDark, () => {
      ctx.rect(-2.0, -0.45, 1.0, 0.9);
      ctx.rect(-0.5, -0.45, 1.0, 0.9);
      ctx.rect(1.0, -0.45, 1.0, 0.9);
    });
  });
}

// ---------------------------------------------------------------------------
// Weapons (weapon space)
// ---------------------------------------------------------------------------
const STEEL = C.steel;
const STEEL_L = C.steelLight;
const WOOD = C.wood;
const WOOD_L = C.woodLight;
const BLACK = '#141518';

interface RifleOpts {
  muzzle: number;
  foreEnd: number;
  mag: boolean;
  scope: boolean;
  german: boolean;
}

function paintRifle(ctx: Ctx, o: RifleOpts): void {
  // Stock: butt, wrist, fore-end.
  solid(ctx, WOOD, () =>
    poly(ctx, [
      -11.4, -1.2, -5.0, -0.9, -1.6, -0.5, 0.4, -1.0, o.foreEnd, -1.0, o.foreEnd + 0.6, -0.4, o.foreEnd, 0.7, 4.8, 0.9, 1.4,
      0.9, 0.2, 1.2, -0.6, 2.2, -2.8, 1.7, -11.6, 3.1,
    ]),
  );
  line(ctx, WOOD_L, 0.4, [-10.6, -0.7, -5.0, -0.5]);
  // Barrel and action.
  solid(ctx, STEEL, () => ctx.rect(1.0, -1.15, o.muzzle - 1.0, 0.9));
  solid(ctx, STEEL, () => rrect(ctx, -0.8, -1.8, 7.4, 1.5, 0.5));
  if (o.mag) solid(ctx, STEEL, () => rrect(ctx, 2.3, 0.4, 2.2, 1.8, 0.3));
  // Trigger guard.
  line(ctx, STEEL_L, 0.35, [-0.2, 1.0, 0.2, 2.0, 1.4, 2.0, 1.6, 1.0]);
  // Bolt handle (reload point at about (2.2, -2)).
  if (o.german) {
    line(ctx, STEEL_L, 0.45, [2.0, -1.2, 2.5, -0.2, 2.9, 0.9]);
    dot(ctx, STEEL_L, 2.9, 0.9, 0.55);
  } else {
    line(ctx, STEEL_L, 0.45, [2.0, -1.3, 2.4, -2.6]);
    dot(ctx, STEEL_L, 2.4, -2.6, 0.6);
  }
  // Sights, bands and muzzle.
  solid(ctx, STEEL, () => ctx.rect(o.muzzle - 1.3, -2.0, 0.5, 0.9));
  if (!o.scope) solid(ctx, STEEL, () => ctx.rect(5.8, -2.4, 1.6, 0.8));
  line(ctx, STEEL_L, 0.5, [o.foreEnd - 4.0, -1.1, o.foreEnd - 4.0, 0.8]);
  if (o.german) line(ctx, STEEL_L, 0.5, [o.foreEnd - 0.4, -1.1, o.foreEnd - 0.4, 0.7]);
  if (o.scope) {
    solid(ctx, BLACK, () => {
      rrect(ctx, -0.6, -3.6, 9.6, 1.5, 0.7);
    });
    solid(ctx, BLACK, () => rrect(ctx, 8.4, -4.0, 1.8, 2.3, 0.6));
    solid(ctx, BLACK, () => rrect(ctx, -1.8, -3.8, 1.5, 1.9, 0.5));
    line(ctx, STEEL, 0.6, [1.4, -2.1, 1.4, -1.4]);
    line(ctx, STEEL, 0.6, [6.4, -2.1, 6.4, -1.4]);
    dot(ctx, 'rgba(170, 200, 220, 0.75)', 10.0, -2.85, 0.45);
  }
}

function paintBren(ctx: Ctx): void {
  solid(ctx, WOOD, () => poly(ctx, [-11.2, -1.0, -4.0, -0.8, -1.8, -1.3, -1.8, 1.0, -4.6, 1.4, -11.4, 3.0]));
  line(ctx, STEEL_L, 0.5, [-11.0, -0.6, -11.2, 2.6]);
  solid(ctx, WOOD, () => poly(ctx, [-0.6, 0.8, 1.4, 0.8, 0.8, 4.2, -1.2, 4.0]));
  solid(ctx, STEEL, () => rrect(ctx, -2.0, -1.7, 12.4, 2.7, 0.6));
  // The curved top magazine.
  solid(ctx, STEEL, () => {
    ctx.moveTo(2.0, -1.6);
    ctx.bezierCurveTo(2.1, -5.0, 3.8, -7.8, 6.2, -9.2);
    ctx.lineTo(8.7, -8.3);
    ctx.bezierCurveTo(6.8, -6.8, 7.4, -4.3, 7.8, -1.6);
    ctx.closePath();
  });
  line(ctx, STEEL_L, 0.35, [3.0, -2.2, 3.6, -6.0, 6.0, -8.4]);
  // Barrel, gas cylinder, carry handle, cone flash hider.
  solid(ctx, STEEL, () => ctx.rect(10.0, -1.1, 13.8, 1.0));
  solid(ctx, STEEL, () => ctx.rect(10.0, 0.0, 9.6, 0.8));
  line(ctx, STEEL, 0.55, [11.4, -1.0, 12.2, -3.0, 14.4, -3.0, 15.0, -1.0]);
  solid(ctx, STEEL, () => poly(ctx, [23.6, -1.0, 25.6, -1.5, 25.6, 0.3, 23.6, -0.1]));
}

function paintMg34(ctx: Ctx): void {
  solid(ctx, BLACK, () => poly(ctx, [-10.6, -1.0, -3.0, -0.9, -1.6, -1.6, -1.6, 0.9, -3.6, 1.0, -10.8, 2.7]));
  solid(ctx, BLACK, () => poly(ctx, [-0.8, 0.8, 1.0, 0.8, 0.2, 4.0, -1.6, 3.8]));
  solid(ctx, STEEL, () => rrect(ctx, -1.8, -1.7, 8.4, 2.6, 0.5));
  solid(ctx, STEEL, () => rrect(ctx, -0.2, -2.5, 5.6, 1.2, 0.5));
  // Perforated barrel jacket.
  solid(ctx, STEEL, () => rrect(ctx, 6.4, -1.7, 17.8, 2.2, 1.0));
  for (let x = 8.0; x < 23; x += 2.2) fillPath(ctx, STEEL_L, () => ctx.ellipse(x, -0.6, 0.65, 0.45, 0, 0, TAU));
  solid(ctx, STEEL, () => poly(ctx, [24.2, -1.3, 27.2, -1.7, 27.2, 0.5, 24.2, 0.1]));
  line(ctx, STEEL_L, 0.5, [22.5, -1.7, 22.5, -3.0]);
  // Drum magazine on the side.
  solid(ctx, STEEL, () => ctx.arc(2.6, 2.3, 2.6, 0, TAU));
  line(ctx, STEEL_L, 0.4, [2.6, 0.4, 2.6, 4.2]);
  dot(ctx, STEEL_L, 2.6, 2.3, 0.7);
}

function paintSten(ctx: Ctx): void {
  // Skeleton stock of steel tube.
  line(ctx, STEEL, 0.75, [-0.4, -0.6, -9.0, -0.6, -9.0, 2.6, -0.6, 0.6]);
  line(ctx, STEEL, 1.0, [-9.0, -1.0, -9.0, 3.0]);
  solid(ctx, STEEL, () => rrect(ctx, -0.8, -1.5, 10.6, 2.0, 0.9));
  // Perforated barrel sleeve and muzzle.
  solid(ctx, STEEL, () => rrect(ctx, 9.6, -1.3, 4.0, 1.5, 0.5));
  for (let x = 10.4; x < 13.4; x += 1.1) dot(ctx, STEEL_L, x, -0.55, 0.3);
  solid(ctx, STEEL, () => ctx.rect(13.4, -1.0, 1.2, 0.8));
  // Side magazine, seen end-on below the body.
  solid(ctx, STEEL, () => poly(ctx, [4.6, 0.2, 6.6, 0.2, 7.0, 3.4, 5.0, 3.4]));
  solid(ctx, STEEL, () => poly(ctx, [-0.4, 0.4, 2.2, 0.4, 1.6, 1.8, -0.2, 1.8]));
}

function paintMp40(ctx: Ctx): void {
  // Folding stock (unfolded) and butt plate.
  line(ctx, STEEL, 0.55, [-1.0, -0.6, -8.4, -0.7]);
  line(ctx, STEEL, 0.55, [-1.0, 1.0, -8.4, 1.2]);
  line(ctx, STEEL, 0.9, [-8.6, -1.6, -8.6, 2.4]);
  solid(ctx, BLACK, () => poly(ctx, [-0.6, 0.6, 1.4, 0.6, 0.8, 4.0, -1.0, 3.8]));
  solid(ctx, STEEL, () => rrect(ctx, -1.2, -1.6, 10.4, 2.3, 0.8));
  // The long straight magazine.
  solid(ctx, STEEL, () => poly(ctx, [4.3, 0.6, 6.1, 0.6, 6.6, 9.6, 4.8, 9.6]));
  line(ctx, STEEL_L, 0.3, [5.2, 1.0, 5.6, 9.0]);
  // Barrel and the resting bar under it.
  solid(ctx, STEEL, () => ctx.rect(9.0, -1.3, 6.2, 0.9));
  solid(ctx, BLACK, () => ctx.rect(11.6, -0.5, 1.6, 1.0));
}

function paintMortarTube(ctx: Ctx): void {
  solid(ctx, STEEL, () => ctx.arc(0.4, 0, 1.7, 0, TAU));
  solid(ctx, STEEL, () => ctx.rect(0.2, -1.35, 21.3, 2.7));
  solid(ctx, STEEL, () => rrect(ctx, 20.2, -1.7, 1.4, 3.4, 0.4));
  line(ctx, STEEL_L, 0.4, [1.5, -0.8, 19.8, -0.8]);
  solid(ctx, STEEL, () => rrect(ctx, 12.6, -3.1, 2.6, 1.8, 0.4));
  solid(ctx, BLACK, () => rrect(ctx, 13.0, -4.8, 1.8, 1.8, 0.3));
}

function paintMortarBipod(ctx: Ctx): void {
  const L = WEAPON_GEOM.mortar.bipodLen;
  solid(ctx, STEEL, () => rrect(ctx, -1.6, -1.6, 3.2, 3.2, 0.8));
  line(ctx, STEEL_L, 0.7, [0, 0, L - 0.4, -1.4]);
  line(ctx, STEEL, 0.85, [0, 0, L, 0.6]);
  line(ctx, STEEL, 0.6, [L * 0.45, -0.5, L * 0.45 + 0.4, 2.0]);
  dot(ctx, STEEL, L, 0.6, 0.9);
}

function paintMortarPlate(ctx: Ctx): void {
  solid(ctx, STEEL, () => poly(ctx, [-7.4, 0.2, -6.6, -1.0, 6.6, -1.0, 7.4, 0.2, 6.8, 1.6, -6.8, 1.6]));
  line(ctx, STEEL_L, 0.4, [-5.6, -0.4, 5.6, -0.4]);
  solid(ctx, STEEL, () => rrect(ctx, -1.6, -2.0, 3.2, 1.4, 0.5));
}

function paintBipod(ctx: Ctx, L: number): void {
  line(ctx, STEEL_L, 0.5, [0, 0, L - 0.3, -0.9]);
  line(ctx, STEEL, 0.65, [0, 0, L, 0.4]);
  dot(ctx, STEEL, L, 0.4, 0.6);
  solid(ctx, STEEL, () => ctx.arc(0, 0, 0.8, 0, TAU));
}

function paintPiat(ctx: Ctx): void {
  const y = WEAPON_GEOM.piat.muzzleY;
  // Shoulder pad, main spring body, the open bomb tray at the front.
  solid(ctx, BLACK, () => rrect(ctx, -11.0, y - 3.0, 2.4, 6.2, 1.0));
  solid(ctx, STEEL, () => rrect(ctx, -9.0, y - 2.3, 23.0, 4.6, 1.4));
  line(ctx, STEEL_L, 0.45, [-7.6, y - 1.4, 12.6, y - 1.4]);
  solid(ctx, STEEL, () => ctx.rect(13.6, y + 1.2, 7.4, 0.9));
  solid(ctx, STEEL, () => rrect(ctx, 19.8, y - 2.4, 1.4, 4.6, 0.5));
  line(ctx, STEEL, 0.6, [13.8, y - 1.9, 20.0, y - 1.9]);
  // Sight on top, trigger grip below.
  solid(ctx, BLACK, () => rrect(ctx, 6.8, y - 4.4, 2.0, 2.2, 0.4));
  solid(ctx, STEEL, () => poly(ctx, [-1.2, y + 2.2, 1.4, y + 2.2, 1.0, 3.2, -1.0, 3.0]));
  line(ctx, STEEL_L, 0.35, [1.4, 0.0, 2.6, 1.4, 1.2, 1.6]);
}

function paintPanzerschreck(ctx: Ctx): void {
  const y = WEAPON_GEOM.panzerschreck.muzzleY;
  solid(ctx, STEEL, () => ctx.rect(-12.0, y - 1.8, 38.5, 3.6));
  solid(ctx, STEEL, () => rrect(ctx, -12.6, y - 2.3, 1.4, 4.6, 0.4));
  solid(ctx, STEEL, () => rrect(ctx, 25.4, y - 2.2, 1.2, 4.4, 0.4));
  line(ctx, STEEL_L, 0.45, [-10.8, y - 1.0, 24.8, y - 1.0]);
  // Blast shield, seen edge-on, with its viewing window frame.
  solid(ctx, mix(STEEL, '#3c4636', 0.5), () => rrect(ctx, 4.4, y - 8.6, 1.5, 12.4, 0.4));
  line(ctx, STEEL_L, 0.35, [5.1, y - 7.8, 5.1, y - 4.6]);
  // Grips, shoulder rest and front sight.
  solid(ctx, WOOD, () => poly(ctx, [-1.0, y + 1.6, 1.0, y + 1.6, 0.8, 3.4, -0.8, 3.2]));
  solid(ctx, STEEL, () => poly(ctx, [8.6, y + 1.6, 10.0, y + 1.6, 9.8, 1.6, 8.6, 1.6]));
  solid(ctx, STEEL, () => poly(ctx, [-7.2, y + 1.6, -3.2, y + 1.6, -3.6, 0.8, -7.0, 0.6]));
  line(ctx, STEEL, 0.4, [13.0, y - 1.8, 13.0, y - 3.6, 14.2, y - 3.6, 14.2, y - 1.8]);
}

// ---------------------------------------------------------------------------
// Hand items (held at the origin, +x along the forearm)
// ---------------------------------------------------------------------------
export function paintMills(ctx: Ctx): void {
  const g = '#3a4430';
  solid(ctx, g, () => ctx.ellipse(0.4, 0, 1.7, 1.35, 0, 0, TAU));
  line(ctx, mix(g, '#000000', 0.4), 0.25, [-0.6, -1.2, -0.6, 1.2]);
  line(ctx, mix(g, '#000000', 0.4), 0.25, [0.6, -1.3, 0.6, 1.3]);
  line(ctx, mix(g, '#000000', 0.4), 0.25, [-1.1, 0, 2.0, 0]);
  line(ctx, STEEL_L, 0.35, [-1.2, -0.8, -1.8, 0.8]);
}

export function paintStick(ctx: Ctx): void {
  solid(ctx, WOOD_L, () => rrect(ctx, -1.4, -0.55, 6.6, 1.1, 0.5));
  solid(ctx, '#4b5246', () => rrect(ctx, 5.0, -1.35, 3.6, 2.7, 0.5));
  line(ctx, STEEL_L, 0.3, [5.3, -1.0, 5.3, 1.0]);
}

function paintShell(ctx: Ctx): void {
  const g = '#4a5040';
  line(ctx, STEEL, 0.9, [-5.6, 0, -2.2, 0]);
  solid(ctx, STEEL, () => poly(ctx, [-6.2, -1.2, -4.8, -0.2, -4.8, 0.2, -6.2, 1.2]));
  solid(ctx, g, () => {
    ctx.moveTo(-2.4, -0.7);
    ctx.quadraticCurveTo(-1.2, -1.45, 1.2, -1.3);
    ctx.quadraticCurveTo(3.4, -0.9, 3.8, 0);
    ctx.quadraticCurveTo(3.4, 0.9, 1.2, 1.3);
    ctx.quadraticCurveTo(-1.2, 1.45, -2.4, 0.7);
    ctx.closePath();
  });
  line(ctx, '#c9b46a', 0.35, [0.6, -1.3, 0.6, 1.3]);
}

/** Flamethrower wand: rear grip, fuel valve, long tube and the nozzle with its igniter underneath. */
function paintFlamer(ctx: Ctx): void {
  solid(ctx, STEEL, () => rrect(ctx, -7.0, -1.1, 25.0, 1.9, 0.8));
  line(ctx, STEEL_L, 0.4, [-5.6, -0.7, 16.0, -0.7]);
  // Rear pistol grip and the front grip with its valve wheel.
  solid(ctx, WOOD, () => poly(ctx, [-1.4, 0.6, 0.8, 0.6, 0.2, 4.4, -1.8, 4.0]));
  solid(ctx, WOOD, () => poly(ctx, [7.4, 0.6, 9.2, 0.6, 9.0, 3.6, 7.2, 3.6]));
  solid(ctx, BLACK, () => rrect(ctx, 3.6, -2.4, 1.6, 4.0, 0.6));
  // Nozzle flare and the igniter cartridge below it.
  solid(ctx, BLACK, () => poly(ctx, [17.6, -1.5, 19.6, -1.9, 19.6, 1.1, 17.6, 0.9]));
  solid(ctx, STEEL, () => rrect(ctx, 14.0, 0.9, 4.0, 1.6, 0.6));
  dot(ctx, '#d0632a', 18.4, 1.7, 0.45);
}

/** Commander's revolver (or pistol): barrel and slide, cylinder, grip. */
function paintPistol(ctx: Ctx): void {
  solid(ctx, STEEL, () => rrect(ctx, -1.2, -1.9, 9.0, 1.7, 0.5));
  solid(ctx, STEEL, () => rrect(ctx, 0.0, -2.3, 3.0, 2.6, 0.7));
  solid(ctx, WOOD, () => poly(ctx, [-1.2, -0.4, 0.8, -0.4, 0.2, 3.4, -1.9, 3.0]));
  line(ctx, STEEL_L, 0.3, [0.8, 0.2, 2.0, 1.2, 0.8, 1.4]);
}

/** Flamethrower fuel and gas tanks on his back, harness and hose stub, in pack space (anchored at the chest joint like the pack). */
export function paintFlamePack(ctx: Ctx, tint: string, dark: string): void {
  // Far tank, the gas bottle between, the near tank (side on they overlap).
  solid(ctx, dark, () => rrect(ctx, -9.8, -9.6, 4.2, 14.2, 2.0));
  solid(ctx, STEEL, () => rrect(ctx, -6.4, -8.0, 2.4, 9.6, 1.2));
  solid(ctx, tint, () => rrect(ctx, -8.4, -9.0, 4.4, 14.0, 2.1), 'rgba(20, 21, 15, 0.6)', 0.4);
  line(ctx, dark, 0.5, [-8.0, -5.6, -4.4, -5.6]);
  line(ctx, dark, 0.5, [-8.0, 1.6, -4.4, 1.6]);
  // Harness strap over the shoulder and the hose stub at the bottom.
  line(ctx, dark, 0.7, [-4.2, -7.4, -1.2, -7.0, 0.2, -5.0]);
  line(ctx, BLACK, 0.9, [-6.2, 5.0, -4.2, 5.0]);
}

function flamePackSpec(key: string, tint: string, dark: string): SpriteSpec {
  return makeSpec(key, -10.6, -10.6, 0.8, 5.4, (ctx) => paintFlamePack(ctx, tint, dark));
}

function paintPiatBomb(ctx: Ctx): void {
  line(ctx, STEEL, 1.1, [-5.0, 0, 0.6, 0]);
  solid(ctx, STEEL, () => rrect(ctx, -5.4, -1.0, 1.2, 2.0, 0.3));
  solid(ctx, '#4a5040', () => {
    ctx.moveTo(0.4, -1.0);
    ctx.quadraticCurveTo(1.6, -1.9, 3.8, -1.7);
    ctx.quadraticCurveTo(6.0, -1.2, 6.4, 0);
    ctx.quadraticCurveTo(6.0, 1.2, 3.8, 1.7);
    ctx.quadraticCurveTo(1.6, 1.9, 0.4, 1.0);
    ctx.closePath();
  });
}

function paintRocket(ctx: Ctx): void {
  line(ctx, STEEL, 1.0, [-5.4, 0, 1.0, 0]);
  solid(ctx, STEEL, () => rrect(ctx, -5.8, -0.9, 1.4, 1.8, 0.3));
  solid(ctx, '#535b4c', () => poly(ctx, [0.8, -1.25, 4.4, -1.25, 6.8, 0, 4.4, 1.25, 0.8, 1.25]));
}

// ---------------------------------------------------------------------------
// Keys and the full sprite list
// ---------------------------------------------------------------------------
export const BODY_KEYS = {
  upperArm: 'fig/body/upperArm',
  forearm: 'fig/body/forearm',
  thigh: 'fig/body/thigh',
  shin: 'fig/body/shin',
  boot: 'fig/body/boot',
  upperArmFar: 'fig/body/upperArmFar',
  forearmFar: 'fig/body/forearmFar',
  thighFar: 'fig/body/thighFar',
  shinFar: 'fig/body/shinFar',
  bootFar: 'fig/body/bootFar',
  torsoLower: 'fig/body/torsoLower',
  torsoUpper: 'fig/body/torsoUpper',
  head: 'fig/body/head',
  /** The flamethrower's head, wearing a gas mask. */
  headMask: 'fig/body/headMask',
  armband: 'fig/kit/armband',
} as const;

export const RIM_KEYS = {
  upperArm: 'fig/rim/upperArm',
  forearm: 'fig/rim/forearm',
  thigh: 'fig/rim/thigh',
  shin: 'fig/rim/shin',
  boot: 'fig/rim/boot',
  torsoLower: 'fig/rim/torsoLower',
  torsoUpper: 'fig/rim/torsoUpper',
  head: 'fig/rim/head',
  brodie: 'fig/rim/helmetBrodie',
  stahlhelm: 'fig/rim/helmetStahlhelm',
} as const;

/** Keys of everything that depends on the faction. */
export interface FactionFigureKeys {
  helmet: string;
  helmetRim: string;
  pack: string;
  pouches: string;
  satchel: string;
  crate: string;
  /** Weapon, bipod and baseplate per kind (null = none). */
  weapon: Record<FigureKind, string | null>;
  bipod: Record<FigureKind, string | null>;
  plate: Record<FigureKind, string | null>;
  item: Record<HandItem, string | null>;
}

function weaponKey(m: WeaponModel): string | null {
  return m === 'none' || m === 'crate' ? null : `fig/weapon/${m}`;
}

function buildKeys(f: FactionId): FactionFigureKeys {
  const L = FIGURE_LOADOUT[f];
  const weapon = {} as Record<FigureKind, string | null>;
  const bipod = {} as Record<FigureKind, string | null>;
  const plate = {} as Record<FigureKind, string | null>;
  for (const k of FIGURE_KIND_LIST) {
    const m = L.weapon[k];
    weapon[k] = weaponKey(m);
    bipod[k] = WEAPON_GEOM[m].bipodLen > 0 ? `fig/weapon/${m}Bipod` : null;
    plate[k] = WEAPON_GEOM[m].baseplate ? `fig/weapon/${m}Plate` : null;
  }
  return {
    helmet: `fig/${f}/helmet`,
    helmetRim: FACTIONS[f].look.helmet === 'brodie' ? RIM_KEYS.brodie : RIM_KEYS.stahlhelm,
    pack: `fig/${f}/pack`,
    pouches: `fig/${f}/pouches`,
    satchel: `fig/${f}/satchel`,
    crate: `fig/${f}/crate`,
    weapon,
    bipod,
    plate,
    item: {
      none: null,
      mills: 'fig/item/mills',
      stick: 'fig/item/stick',
      shell: 'fig/item/shell',
      rocket: L.weapon.at === 'piat' ? 'fig/item/piatBomb' : 'fig/item/rocket',
    },
  };
}

/** The flamethrower's tanks, worn in the pack slot (FigureGearKeys.pack). */
export function flamePackKey(f: FactionId): string {
  return `fig/${f}/flamePack`;
}

export const FACTION_FIGURE_KEYS: Record<FactionId, FactionFigureKeys> = {
  british: buildKeys('british'),
  german: buildKeys('german'),
};

function weaponSpecs(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  const add = (m: WeaponModel, x0: number, y0: number, x1: number, y1: number, paint: Paint): void => {
    out.push(makeSpec(`fig/weapon/${m}`, x0, y0, x1, y1, paint));
  };
  add('enfield', -12.2, -3.4, 25.4, 3.8, (c) => paintRifle(c, { muzzle: WEAPON_GEOM.enfield.muzzleX, foreEnd: 21.6, mag: true, scope: false, german: false }));
  add('kar98', -12.2, -3.4, 26.0, 3.8, (c) => paintRifle(c, { muzzle: WEAPON_GEOM.kar98.muzzleX, foreEnd: 17.6, mag: false, scope: false, german: true }));
  add('enfieldScoped', -12.2, -4.6, 25.4, 3.8, (c) => paintRifle(c, { muzzle: WEAPON_GEOM.enfieldScoped.muzzleX, foreEnd: 21.6, mag: true, scope: true, german: false }));
  add('kar98Scoped', -12.2, -4.6, 26.0, 3.8, (c) => paintRifle(c, { muzzle: WEAPON_GEOM.kar98Scoped.muzzleX, foreEnd: 17.6, mag: false, scope: true, german: true }));
  add('bren', -12.0, -9.8, 26.2, 4.8, paintBren);
  add('mg34', -11.4, -3.2, 27.8, 5.4, paintMg34);
  add('sten', -9.8, -2.0, 15.2, 4.0, paintSten);
  add('mp40', -9.2, -2.2, 15.8, 10.2, paintMp40);
  add('mortar', -1.8, -5.2, 22.2, 2.2, paintMortarTube);
  add('piat', -11.6, -8.2, 21.8, 3.8, paintPiat);
  add('panzerschreck', -13.2, -12.6, 27.2, 4.0, paintPanzerschreck);
  add('flamer', -7.6, -2.8, 20.2, 4.8, paintFlamer);
  add('pistol', -2.4, -2.8, 8.2, 3.8, paintPistol);
  const bren = WEAPON_GEOM.bren.bipodLen;
  out.push(makeSpec('fig/weapon/brenBipod', -1.2, -1.6, bren + 1.0, 1.4, (c) => paintBipod(c, bren)));
  const mg = WEAPON_GEOM.mg34.bipodLen;
  out.push(makeSpec('fig/weapon/mg34Bipod', -1.2, -1.6, mg + 1.0, 1.4, (c) => paintBipod(c, mg)));
  const mb = WEAPON_GEOM.mortar.bipodLen;
  out.push(makeSpec('fig/weapon/mortarBipod', -2.0, -2.2, mb + 1.2, 2.6, paintMortarBipod));
  out.push(makeSpec('fig/weapon/mortarPlate', -7.8, -2.4, 7.8, 2.0, paintMortarPlate));
  out.push(makeSpec('fig/item/mills', -2.2, -1.8, 2.4, 1.8, paintMills));
  out.push(makeSpec('fig/item/stick', -1.8, -1.8, 9.0, 1.8, paintStick));
  out.push(makeSpec('fig/item/shell', -6.6, -1.8, 4.2, 1.8, paintShell));
  out.push(makeSpec('fig/item/piatBomb', -5.8, -2.2, 6.8, 2.2, paintPiatBomb));
  out.push(makeSpec('fig/item/rocket', -6.2, -1.6, 7.2, 1.6, paintRocket));
  return out;
}

function bodySpecs(): SpriteSpec[] {
  const K = BODY_KEYS;
  const R = RIM_KEYS;
  return [
    limbSpec(K.upperArm, B.upperArm, RAD.upperArm, C.body, 0),
    limbSpec(K.forearm, B.forearm, RAD.forearm, C.body, 0),
    limbSpec(K.thigh, B.thigh, RAD.thigh, C.body, 0),
    limbSpec(K.shin, B.shin, RAD.shin, C.body, 0),
    bootSpec(K.boot, C.body, 0),
    limbSpec(K.upperArmFar, B.upperArm, RAD.upperArm, C.bodyFar, 0),
    limbSpec(K.forearmFar, B.forearm, RAD.forearm, C.bodyFar, 0),
    limbSpec(K.thighFar, B.thigh, RAD.thigh, C.bodyFar, 0),
    limbSpec(K.shinFar, B.shin, RAD.shin, C.bodyFar, 0),
    bootSpec(K.bootFar, C.bodyFar, 0),
    limbSpec(K.torsoLower, B.spineLower, RAD.torsoLower, C.body, 0),
    limbSpec(K.torsoUpper, B.spineUpper, RAD.torsoUpper, C.body, 0),
    headSpec(K.head, C.body, 0),
    headMaskSpec(K.headMask),
    armbandSpec(),
    limbSpec(R.upperArm, B.upperArm, RAD.upperArm, C.rim, RIM),
    limbSpec(R.forearm, B.forearm, RAD.forearm, C.rim, RIM),
    limbSpec(R.thigh, B.thigh, RAD.thigh, C.rim, RIM),
    limbSpec(R.shin, B.shin, RAD.shin, C.rim, RIM),
    bootSpec(R.boot, C.rim, RIM),
    limbSpec(R.torsoLower, B.spineLower, RAD.torsoLower, C.rim, RIM),
    limbSpec(R.torsoUpper, B.spineUpper, RAD.torsoUpper, C.rim, RIM),
    headSpec(R.head, C.rim, RIM),
    helmetSpec(R.brodie, 'brodie', C.rim, C.rim, true),
    helmetSpec(R.stahlhelm, 'stahlhelm', C.rim, C.rim, true),
  ];
}

function factionSpecs(f: FactionId): SpriteSpec[] {
  const look = FACTIONS[f].look;
  const k = FACTION_FIGURE_KEYS[f];
  return [
    helmetSpec(k.helmet, look.helmet, look.tint, look.tintDark, false),
    packSpec(k.pack, look.tint, look.tintDark),
    flamePackSpec(flamePackKey(f), look.tint, look.tintDark),
    pouchesSpec(k.pouches, look.tint, look.tintDark),
    satchelSpec(k.satchel, look.tint),
    crateSpec(k.crate, look.tint, look.tintDark),
  ];
}

let cache: SpriteSpec[] | null = null;
let cacheMap: Map<string, SpriteSpec> | null = null;

/** The figure sprites without upgrade gear (body, rims, helmets, kit, weapons, items) for every faction. */
export function baseFigureSprites(): SpriteSpec[] {
  const out = [...bodySpecs(), ...weaponSpecs()];
  for (const f of Object.keys(FACTIONS) as FactionId[]) out.push(...factionSpecs(f));
  return out;
}

/** Every figure sprite (body, rims, helmets, kit, upgrade gear, weapons, items) for every faction. */
export function allFigureSprites(): SpriteSpec[] {
  // ./gear uses the painters above; it only calls back into this module at run time, never while loading.
  if (!cache) cache = [...baseFigureSprites(), ...gearFigureSprites()];
  return cache;
}

/** Lookup by key (built once). */
export function figureSpriteMap(): Map<string, SpriteSpec> {
  if (!cacheMap) {
    cacheMap = new Map();
    for (const s of allFigureSprites()) cacheMap.set(s.key, s);
  }
  return cacheMap;
}
