/**
 * Upgrade gear on the figures (src/data/looksGear.ts): sprite specs for every gear style of every nation, and the
 * key set a figure draws with at given gear levels. Almost every piece is a texture swap of a slot the figure already
 * has (helmet, pack, belt pouches, medic satchel); the bandolier (and the medic's aid strap) has one slot of its own,
 * hidden unless worn. So gear costs nothing extra to draw.
 *
 *   setFigureGear(anim, { health: 2, damage: 1 });   // once, when the unit's view is set up (after resetFigureAnim)
 */
import { FACTIONS } from '../../data/factions';
import { FIGURE, FIGURE_KINDS, FIGURE_LOADOUT, WEAPON_GEOM, type FigureKind, type WeaponModel } from '../../data/figure';
import {
  FIGURE_GEAR_ART as A,
  FIGURE_GEAR_NATION,
  FIGURE_GEAR_SLOT,
  FIGURE_CLOTHING,
  FIGURE_HEADGEAR,
  FIGURE_GEAR_STEPS,
  FIGURE_GEAR_STYLES,
  GEAR_NO_PACK_STYLE,
  type FigureGearSlot,
  type FigureClothing,
  type FigureGearStyle,
  type FigureHeadgear,
} from '../../data/looksGear';
import type { FactionId, HelmetShape } from '../../data/schema';
import { GEAR_STEPS, type GearLevels, type GearStep } from '../../data/upgradeLooks';
import type { SpriteSpec } from '../types';
import { TAU } from './math';
import {
  FACTION_FIGURE_KEYS,
  HELMET_BOX,
  fillPath,
  flamePackKey,
  helmetShapePath,
  helmetSpec,
  line,
  makeSpec,
  mix,
  nationPouchesSpec,
  paintFlamePack,
  paintMills,
  paintStick,
  rrect,
  solid,
} from './parts';
import { paintF1 } from './soviet';
import type { FigureAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const C = A.colors;
const RIM = FIGURE.rimWidth;
const RIM_COLOR = FIGURE.colors.rim;
/** Helmet paths are drawn for a head of radius 5.4 and scaled to the real head (as in ./parts). */
const HK = FIGURE.headRadius / 5.4;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export function gearSpriteKey(f: FactionId, style: FigureGearStyle): string {
  return `fig/${f}/gear/${style}`;
}

const SCRIM_RIM_KEYS: Record<HelmetShape, string> = {
  brodie: 'fig/rim/helmetBrodieScrim',
  stahlhelm: 'fig/rim/helmetStahlhelmScrim',
  ssh40: 'fig/rim/helmetSsh40Scrim',
};

function scrimRimKey(shape: HelmetShape): string {
  return SCRIM_RIM_KEYS[shape];
}

/** The sprite keys a figure draws in its gear slots. */
export interface FigureGearKeys {
  readonly faction: FactionId;
  readonly kind: FigureKind;
  readonly health: number;
  readonly damage: number;
  readonly helmet: string;
  readonly helmetRim: string;
  readonly pack: string;
  readonly packShow: boolean;
  readonly pouches: string;
  readonly pouchesShow: boolean;
  readonly satchel: string;
  readonly satchelShow: boolean;
  /** Strap across the chest (bandolier or the medic's aid strap); null = none. */
  readonly bandolier: string | null;
}

function resolve(f: FactionId, kind: FigureKind, health: number, damage: number): FigureGearKeys {
  const K = FIGURE_KINDS[kind];
  const base = FACTION_FIGURE_KEYS[f];
  const steps: readonly GearStep<FigureGearStyle>[] = FIGURE_GEAR_STEPS[kind] ?? GEAR_STEPS;
  const pick: Partial<Record<FigureGearSlot, GearStep<FigureGearStyle>>> = {};
  for (const s of steps) {
    if (s.level > (s.source === 'health' ? health : damage)) continue;
    const slot = FIGURE_GEAR_SLOT[s.piece];
    const had = pick[slot];
    if (!had || had.level <= s.level) pick[slot] = s;
  }
  const shape = FACTIONS[f].look.helmet;
  const helmet = pick.helmet?.piece;
  let pack = pick.pack?.piece;
  if (pack === 'fullPack' && !K.pack) pack = GEAR_NO_PACK_STYLE;
  // Only the flamethrower has tanks to shield.
  if (pack === 'flameShield' && kind !== 'flame') pack = undefined;
  const pouches = pick.pouches?.piece;
  const satchel = pick.satchel?.piece;
  const strap = pick.bandolier?.piece;
  return {
    faction: f,
    kind,
    health,
    damage,
    helmet: helmet ? gearSpriteKey(f, helmet) : base.helmet,
    helmetRim: helmet === 'helmetScrim' ? scrimRimKey(shape) : base.helmetRim,
    // The flamethrower always wears his fuel tanks in the pack slot (his heat shield is drawn over them).
    pack: kind === 'flame' ? (pack === 'flameShield' ? gearSpriteKey(f, pack) : flamePackKey(f)) : pack ? gearSpriteKey(f, pack) : base.pack,
    packShow: kind === 'flame' || pack !== undefined || K.pack,
    pouches: pouches ? gearSpriteKey(f, pouches) : base.pouches,
    pouchesShow: pouches !== undefined || K.pouches,
    satchel: satchel ? gearSpriteKey(f, satchel) : base.satchel,
    satchelShow: satchel !== undefined || K.satchel,
    // The Red Army's rolled greatcoat rides in the strap slot until a bandolier or aid strap replaces it.
    bandolier: strap ? gearSpriteKey(f, strap) : FIGURE_GEAR_NATION[f].coatRoll.includes(kind) ? base.coatRoll : null,
  };
}

/** Built on first use: [faction][kind][health * 4 + damage]. */
const TABLE = new Map<FactionId, Map<FigureKind, FigureGearKeys[]>>();

/** The key set for a nation, kind and gear levels (cached: no allocation after the first call for a kind). */
export function figureGearKeys(f: FactionId, kind: FigureKind, health: number, damage: number): FigureGearKeys {
  let byKind = TABLE.get(f);
  if (!byKind) {
    byKind = new Map();
    TABLE.set(f, byKind);
  }
  let list = byKind.get(kind);
  if (!list) {
    list = [];
    for (let h = 0; h < 4; h++) for (let d = 0; d < 4; d++) list.push(resolve(f, kind, h, d));
    byKind.set(kind, list);
  }
  const h = Math.max(0, Math.min(3, health | 0));
  const d = Math.max(0, Math.min(3, damage | 0));
  return list[h * 4 + d];
}

/**
 * Draw this figure with gear. Remembered on the anim until resetFigureAnim (which goes back to level 0), so call it
 * after every reset of a pooled anim. Allocation free after the first call for a nation and kind.
 */
export function setFigureGear(anim: FigureAnim, gear: GearLevels): void {
  anim.gear = figureGearKeys(anim.faction, anim.kind, gear.health, gear.damage);
}

/**
 * Wear a cap in place of the helmet (the pilotka, the ushanka, or the helmet over the ushanka; FIGURE_HEADGEAR), or
 * null for the nation's helmet. A cap the nation does not wear is ignored. The cap replaces the helmet at every gear
 * level (no net or scrim on a cap). Remembered until resetFigureAnim; allocation free.
 */
export function setFigureHeadgear(anim: FigureAnim, id: FigureHeadgear | null): void {
  anim.headgear = id && FIGURE_HEADGEAR[anim.faction].includes(id) ? (FACTION_FIGURE_KEYS[anim.faction].headgear[id] ?? null) : null;
}

/**
 * Wear winter clothing over the body (the quilted telogreika or the white snow smock; FIGURE_CLOTHING), or null for the
 * plain body. Clothing the nation does not wear is ignored. Remembered until resetFigureAnim; allocation free.
 */
export function setFigureClothing(anim: FigureAnim, id: FigureClothing | null): void {
  anim.clothing = id && FIGURE_CLOTHING[anim.faction].includes(id) ? (FACTION_FIGURE_KEYS[anim.faction].clothing[id] ?? null) : null;
}

const WEAPON_KEYS = new Map<WeaponModel, { weapon: string | null; bipod: string | null; plate: string | null }>();

/**
 * Carry an era weapon in place of the nation's (the PPD-40 in 1941, the PzB 39 before the Panzerschreck; src/data/eras.ts),
 * or null for the nation's own. Its muzzle and bipod geometry come with it. Remembered until resetFigureAnim; allocation
 * free after the first call for a model.
 */
export function setFigureWeapon(anim: FigureAnim, model: WeaponModel | null): void {
  const m = model ?? FIGURE_LOADOUT[anim.faction].weapon[anim.kind];
  anim.model = m;
  anim.geom = WEAPON_GEOM[m];
  anim.weaponVisible = m !== 'none' && m !== 'crate';
  if (model === null) {
    anim.weaponKeys = null;
    return;
  }
  let keys = WEAPON_KEYS.get(m);
  if (!keys) {
    const g = WEAPON_GEOM[m];
    const none = m === 'none' || m === 'crate';
    keys = { weapon: none ? null : `fig/weapon/${m}`, bipod: g.bipodLen > 0 ? `fig/weapon/${m}Bipod` : null, plate: g.baseplate ? `fig/weapon/${m}Plate` : null };
    WEAPON_KEYS.set(m, keys);
  }
  anim.weaponKeys = keys;
}

/** Hold this sprite for the anti-tank "rocket" hand item (the Tank Hunters' bottle), or null for the nation's round. */
export function setFigureRocketItem(anim: FigureAnim, key: string | null): void {
  anim.rocketKey = key;
}

/** The key a sapper draws instead of his nation's crate while carrying (null = the nation's crate). */
export function setFigureCrateKey(anim: FigureAnim, key: string | null): void {
  anim.crateKey = key;
}

/**
 * Handcart stage: while on, a sapper never shows a crate, and standing or walking his hands grip the cart handle at
 * SAPPER_CART_HANDLE, leaning into the push. The cart itself is drawn by the renderer.
 */
export function setFigurePushing(anim: FigureAnim, on: boolean): void {
  anim.pushing = on;
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

/** Draw a base spec with its anchor at the current origin. */
function drawAt(ctx: Ctx, s: SpriteSpec): void {
  ctx.save();
  ctx.translate(-s.ax * s.w, -s.ay * s.h);
  s.draw(ctx);
  ctx.restore();
}

/** Bounds of a helmet with its scrim tufts, in head space (scaled). */
function helmetBounds(shape: HelmetShape, scrim: boolean, grow: number): [number, number, number, number] {
  const box = HELMET_BOX[shape];
  let x0 = box[0];
  let x1 = box[1];
  let y0 = box[2];
  const y1 = box[3];
  if (scrim) {
    const t = A.scrim[shape];
    for (let i = 0; i < t.length; i += 3) {
      x0 = Math.min(x0, t[i] - t[i + 2] - 0.4);
      x1 = Math.max(x1, t[i] + t[i + 2] + 0.4);
      y0 = Math.min(y0, t[i + 1] - t[i + 2] - 0.4);
    }
  }
  const g = A.net.edge + grow;
  return [x0 * HK - g, y0 * HK - g, x1 * HK + g, y1 * HK + g];
}

/** One scrim tuft: a ragged clump of three blobs. */
function tuft(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
  ctx.moveTo(x - r * 0.35 + r * 0.7, y - r * 0.55);
  ctx.arc(x - r * 0.35, y - r * 0.55, r * 0.7, 0, TAU);
  ctx.moveTo(x + r * 0.5 + r * 0.55, y - r * 0.4);
  ctx.arc(x + r * 0.5, y - r * 0.4, r * 0.55, 0, TAU);
}

function netHelmetSpec(key: string, shape: HelmetShape, tint: string, dark: string, scrim: boolean): SpriteSpec {
  const base = helmetSpec('', shape, tint, dark, false);
  const [x0, y0, x1, y1] = helmetBounds(shape, scrim, 0);
  return makeSpec(key, x0, y0, x1, y1, (ctx) => {
    drawAt(ctx, base);
    ctx.save();
    ctx.scale(HK, HK);
    // The net: a dark mesh over the shell, and its edge hanging a little past the rim.
    ctx.beginPath();
    helmetShapePath(ctx, shape);
    ctx.lineWidth = A.net.edge * 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = C.net;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const sp = A.net.spacing;
    ctx.beginPath();
    for (let d = -24; d <= 24; d += sp) {
      ctx.moveTo(d - 12, -12);
      ctx.lineTo(d + 12, 12);
      ctx.moveTo(d + 12, -12);
      ctx.lineTo(d - 12, 12);
    }
    ctx.lineWidth = A.net.width;
    ctx.strokeStyle = C.net;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.restore();
    if (scrim) {
      const t = A.scrim[shape];
      for (let i = 0, n = 0; i < t.length; i += 3, n++) {
        const col = C.scrim[n % C.scrim.length];
        solid(ctx, col, () => tuft(ctx, t[i], t[i + 1], t[i + 2]), 'rgba(20, 22, 16, 0.9)', 0.45);
      }
    }
    ctx.restore();
  });
}

function scrimRimSpec(shape: HelmetShape): SpriteSpec {
  const [x0, y0, x1, y1] = helmetBounds(shape, true, RIM);
  return makeSpec(scrimRimKey(shape), x0, y0, x1, y1, (ctx) => {
    ctx.scale(HK, HK);
    ctx.beginPath();
    helmetShapePath(ctx, shape);
    const t = A.scrim[shape];
    for (let i = 0; i < t.length; i += 3) tuft(ctx, t[i], t[i + 1], t[i + 2]);
    ctx.fillStyle = RIM_COLOR;
    ctx.fill();
    ctx.lineWidth = ((RIM + A.net.edge) * 2) / HK;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = RIM_COLOR;
    ctx.stroke();
  });
}

function fullPackSpec(key: string, tint: string, dark: string): SpriteSpec {
  const P = A.fullPack;
  return makeSpec(key, P.rollX - 0.8, P.rollY - P.rollR - 0.8, 0.6, P.y + P.h + 0.8, (ctx) => {
    solid(ctx, tint, () => rrect(ctx, P.x, P.y, P.w, P.h, 1.6));
    solid(ctx, dark, () => rrect(ctx, P.x - 0.3, P.y + P.h * 0.45, P.w * 0.62, P.h * 0.4, 1.0));
    line(ctx, dark, 0.6, [P.x + 0.6, P.y + P.h * 0.3, P.x + P.w - 0.4, P.y + P.h * 0.3]);
    // Shoulder strap to the chest.
    line(ctx, dark, 0.7, [P.x + P.w, P.y + 1.4, -0.8, -6.0, 0.0, -4.4]);
    // Blanket roll strapped on top.
    solid(ctx, C.blanket, () => rrect(ctx, P.rollX, P.rollY - P.rollR, P.rollW, P.rollR * 2, P.rollR), 'rgba(30, 28, 20, 0.85)', 0.55);
    line(ctx, C.cottonDark, 0.55, [P.rollX + P.rollW * 0.3, P.rollY - P.rollR, P.rollX + P.rollW * 0.3, P.rollY + P.rollR]);
    line(ctx, C.cottonDark, 0.55, [P.rollX + P.rollW * 0.72, P.rollY - P.rollR, P.rollX + P.rollW * 0.72, P.rollY + P.rollR]);
  });
}

function haversackSpec(key: string, tint: string, dark: string): SpriteSpec {
  const P = A.haversack;
  return makeSpec(key, P.x - 0.8, -7.4, 0.6, P.y + P.h + 0.8, (ctx) => {
    line(ctx, dark, 0.7, [P.x + P.w - 0.6, P.y + 0.6, -1.0, -6.6, 0.0, -5.0]);
    solid(ctx, tint, () => rrect(ctx, P.x, P.y, P.w, P.h, 1.3));
    solid(ctx, dark, () => rrect(ctx, P.x - 0.2, P.y - 0.2, P.w + 0.2, P.h * 0.38, 1.0));
  });
}

/**
 * Full pouches: the base belt kit, a big double pouch in front and a water bottle sticking out behind the hip, both in
 * the nation's light kit colour with a dark edge so they read against the black body at phone size.
 */
function paintFullPouches(ctx: Ctx, base: SpriteSpec, f: FactionId, dark: string): void {
  const P = A.fullPouches;
  const N = FIGURE_GEAR_NATION[f];
  solid(ctx, N.bottle, () => rrect(ctx, P.bottleX, P.bottleY, P.bottleW, P.bottleH, 2.2), P.edge, P.edgeW);
  solid(ctx, N.cap, () => rrect(ctx, P.bottleX + P.bottleW * 0.25, P.bottleY - 1.4, P.bottleW * 0.5, 1.8, 0.5));
  line(ctx, P.edge, 0.6, [P.bottleX + 0.4, P.bottleY + P.bottleH * 0.38, P.bottleX + P.bottleW - 0.4, P.bottleY + P.bottleH * 0.38]);
  drawAt(ctx, base);
  solid(ctx, N.pouch, () => rrect(ctx, P.x, P.y, P.w, P.h, 1.1), P.edge, P.edgeW);
  line(ctx, dark, 0.6, [P.x + 0.3, P.y + 1.8, P.x + P.w - 0.3, P.y + 1.8]);
  line(ctx, dark, 0.55, [P.x + P.w * 0.5, P.y + 1.9, P.x + P.w * 0.5, P.y + P.h - 0.4]);
}

function pouchBounds(): [number, number, number, number] {
  const P = A.fullPouches;
  return [Math.min(-6.2, P.bottleX - 0.8), Math.min(-7.0, P.y - 0.8, P.bottleY - 2.2), Math.max(5.6, P.x + P.w + 0.8), Math.max(0.2, P.bottleY + P.bottleH + 0.8)];
}

function fullPouchesSpec(key: string, f: FactionId, dark: string, base: SpriteSpec): SpriteSpec {
  const [x0, y0, x1, y1] = pouchBounds();
  return makeSpec(key, x0, y0, x1, y1, (ctx) => paintFullPouches(ctx, base, f, dark));
}

function grenadesSpec(key: string, f: FactionId, dark: string, base: SpriteSpec): SpriteSpec {
  const [px0, py0, px1, py1] = pouchBounds();
  const nade = FIGURE_GEAR_NATION[f].grenades;
  if (nade === 'mills' || nade === 'f1') {
    const M = A.mills;
    let x0 = px0;
    let y0 = py0;
    let x1 = px1;
    let y1 = py1;
    const r = Math.max(M.rx, M.ry) * 1.6;
    for (let i = 0; i < M.at.length; i += 2) {
      x0 = Math.min(x0, M.at[i] - r);
      x1 = Math.max(x1, M.at[i] + r);
      y0 = Math.min(y0, M.at[i + 1] - r);
      y1 = Math.max(y1, M.at[i + 1] + r);
    }
    return makeSpec(key, x0, y0, x1, y1, (ctx) => {
      paintFullPouches(ctx, base, f, dark);
      for (let i = 0; i < M.at.length; i += 2) {
        // Hung by the lever from the belt, body below.
        ctx.save();
        ctx.translate(M.at[i], M.at[i + 1]);
        ctx.rotate(Math.PI / 2);
        ctx.scale(M.rx / 1.7, M.ry / 1.35);
        if (nade === 'f1') paintF1(ctx);
        else paintMills(ctx);
        ctx.restore();
      }
    });
  }
  const S = A.stick;
  const m = S.headW + 1;
  let x0 = px0;
  let x1 = px1;
  let y0 = py0;
  let y1 = py1;
  for (let i = 0; i < S.at.length; i += 2) {
    x0 = Math.min(x0, S.at[i] - m);
    x1 = Math.max(x1, S.at[i] + m);
    y0 = Math.min(y0, S.at[i + 1] - m);
    y1 = Math.max(y1, S.at[i + 1] + m);
  }
  return makeSpec(key, x0, y0, x1, y1, (ctx) => {
    paintFullPouches(ctx, base, f, dark);
    // Stick grenades pushed down behind the belt, heads sticking out behind the back.
    for (let i = 0; i < S.at.length; i += 4) {
      const [ax, ay, bx, by] = [S.at[i], S.at[i + 1], S.at[i + 2], S.at[i + 3]];
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(by - ay, bx - ax));
      ctx.scale(Math.hypot(bx - ax, by - ay) / 8.6, S.handle / 1.1);
      paintStick(ctx);
      ctx.restore();
    }
  });
}

function bandolierPath(ctx: Ctx, w: number): void {
  const B = A.bandolier;
  const dx = B.x1 - B.x0;
  const dy = B.y1 - B.y0;
  const L = Math.hypot(dx, dy);
  const nx = (-dy / L) * w * 0.5;
  const ny = (dx / L) * w * 0.5;
  ctx.moveTo(B.x0 + nx, B.y0 + ny);
  ctx.lineTo(B.x1 + nx, B.y1 + ny);
  ctx.lineTo(B.x1 - nx, B.y1 - ny);
  ctx.lineTo(B.x0 - nx, B.y0 - ny);
  ctx.closePath();
}

function bandolierBounds(): [number, number, number, number] {
  const B = A.bandolier;
  const m = B.width + 2.6;
  return [Math.min(B.x0, B.x1) - m, Math.min(B.y0, B.y1) - m, Math.max(B.x0, B.x1) + m, Math.max(B.y0, B.y1) + m];
}

function bandolierSpec(key: string): SpriteSpec {
  const B = A.bandolier;
  const [x0, y0, x1, y1] = bandolierBounds();
  return makeSpec(key, x0, y0, x1, y1, (ctx) => {
    solid(ctx, C.cotton, () => bandolierPath(ctx, B.width), B.edge, B.edgeW);
    // Pocket seams straight across the band.
    const L = Math.hypot(B.x1 - B.x0, B.y1 - B.y0);
    const nx = (-(B.y1 - B.y0) / L) * B.width * 0.5;
    const ny = ((B.x1 - B.x0) / L) * B.width * 0.5;
    for (let i = 1; i <= B.pockets; i++) {
      const t = i / (B.pockets + 1);
      const x = B.x0 + (B.x1 - B.x0) * t;
      const y = B.y0 + (B.y1 - B.y0) * t;
      line(ctx, C.cottonDark, 0.7, [x - nx, y - ny, x + nx, y + ny]);
    }
  });
}

function crossPouch(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  solid(ctx, C.aidWhite, () => rrect(ctx, x, y, w, h, 0.6), 'rgba(40, 36, 30, 0.7)', 0.4);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = Math.min(w, h) * 0.32;
  fillPath(ctx, FIGURE.colors.red, () => {
    ctx.rect(cx - s * 0.32, cy - s, s * 0.64, s * 2);
    ctx.rect(cx - s, cy - s * 0.32, s * 2, s * 0.64);
  });
}

function aidStrapSpec(key: string): SpriteSpec {
  const B = A.bandolier;
  const S = A.aidStrap;
  const [x0, y0, x1, y1] = bandolierBounds();
  return makeSpec(key, x0, y0, x1, y1, (ctx) => {
    solid(ctx, mix(C.aidWhite, C.cottonDark, 0.35), () => bandolierPath(ctx, B.width * 0.7), 'rgba(24, 22, 16, 0.85)', 0.4);
    for (const t of [0.42, 0.78]) {
      const x = B.x0 + (B.x1 - B.x0) * t;
      const y = B.y0 + (B.y1 - B.y0) * t;
      crossPouch(ctx, x - S.pouchW / 2, y - S.pouchH / 2, S.pouchW, S.pouchH);
    }
  });
}

function medicSatchelSpec(key: string, tint: string): SpriteSpec {
  const P = A.medicSatchel;
  return makeSpec(key, -0.8, P.y - 0.8, P.x + P.w + 0.8, P.y + P.h + 0.8, (ctx) => {
    line(ctx, tint, 0.9, [0, 0, P.x + 0.3, 0]);
    solid(ctx, C.aidWhite, () => rrect(ctx, P.x, P.y, P.w, P.h, 1.3), 'rgba(40, 36, 30, 0.55)', 0.4);
    fillPath(ctx, mix(C.aidWhite, '#000000', 0.18), () => ctx.rect(P.x, P.y, 1.5, P.h));
    // Bigger red cross and a strapped-on roll of bandages.
    const cx = P.x + P.w * 0.55;
    fillPath(ctx, FIGURE.colors.red, () => {
      ctx.rect(cx - 0.75, -2.9, 1.5, 5.8);
      ctx.rect(cx - 2.9, -0.75, 5.8, 1.5);
    });
    solid(ctx, mix(C.aidWhite, C.cotton, 0.5), () => rrect(ctx, P.x + P.w - 0.6, P.y + 1.2, 1.9, P.h - 2.4, 0.9), 'rgba(40, 36, 30, 0.6)', 0.4);
  });
}

function aidPouchesSpec(key: string, tint: string): SpriteSpec {
  const P = A.aidPouches;
  return makeSpec(key, P.x - 0.8, P.y - 0.8, Math.max(0.6, P.x + P.w * 2 + P.gap + 0.8), 0.2, (ctx) => {
    solid(ctx, tint, () => rrect(ctx, P.x - 0.4, -4.1, P.w * 2 + P.gap + 0.8, 1.5, 0.6));
    crossPouch(ctx, P.x, P.y, P.w, P.h);
    crossPouch(ctx, P.x + P.w + P.gap, P.y, P.w, P.h);
  });
}

/** The flamethrower's tanks with a pale steel heat shield strapped over their back. */
function flameShieldSpec(key: string, tint: string, dark: string): SpriteSpec {
  const S = A.flameShield;
  return makeSpec(key, S.x - 0.8, S.y - 0.8, 0.8, Math.max(5.4, S.y + S.h + 0.8), (ctx) => {
    paintFlamePack(ctx, tint, dark);
    solid(ctx, C.shield, () => rrect(ctx, S.x, S.y, S.w, S.h, S.r), C.shieldDark, 0.6);
    // Rivets down the plate and the straps holding it to the tanks.
    ctx.fillStyle = C.shieldDark;
    for (let i = 0; i < 4; i++) ctx.fillRect(S.x + S.w * 0.5 - 0.4, S.y + 1.4 + (i * (S.h - 2.8)) / 3 - 0.4, 0.8, 0.8);
    line(ctx, C.shieldDark, 0.7, [S.x + S.w, S.y + S.h * 0.25, S.x + S.w + 3.2, S.y + S.h * 0.25]);
    line(ctx, C.shieldDark, 0.7, [S.x + S.w, S.y + S.h * 0.72, S.x + S.w + 3.2, S.y + S.h * 0.72]);
  });
}

function factionGearSpecs(f: FactionId): SpriteSpec[] {
  const look = FACTIONS[f].look;
  const tint = look.tint;
  const dark = look.tintDark;
  const k = (s: FigureGearStyle): string => gearSpriteKey(f, s);
  const pouchBase = nationPouchesSpec(f, '');
  const out: SpriteSpec[] = [];
  for (const style of FIGURE_GEAR_STYLES) {
    switch (style) {
      case 'helmetNet':
        out.push(netHelmetSpec(k(style), look.helmet, tint, dark, false));
        break;
      case 'helmetScrim':
        out.push(netHelmetSpec(k(style), look.helmet, tint, dark, true));
        break;
      case 'fullPack':
        out.push(fullPackSpec(k(style), tint, dark));
        break;
      case 'haversack':
        out.push(haversackSpec(k(style), tint, dark));
        break;
      case 'fullPouches':
        out.push(fullPouchesSpec(k(style), f, dark, pouchBase));
        break;
      case 'grenades':
        out.push(grenadesSpec(k(style), f, dark, pouchBase));
        break;
      case 'bandolier':
        out.push(bandolierSpec(k(style)));
        break;
      case 'medicSatchel':
        out.push(medicSatchelSpec(k(style), tint));
        break;
      case 'aidPouches':
        out.push(aidPouchesSpec(k(style), tint));
        break;
      case 'aidStrap':
        out.push(aidStrapSpec(k(style)));
        break;
      case 'flameShield':
        out.push(flameShieldSpec(k(style), tint, dark));
        break;
    }
  }
  return out;
}

/** Every gear sprite for every nation, plus the scrim rims per helmet shape. */
export function gearFigureSprites(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  const shapes = new Set<HelmetShape>();
  for (const f of Object.keys(FACTIONS) as FactionId[]) {
    out.push(...factionGearSpecs(f));
    shapes.add(FACTIONS[f].look.helmet);
  }
  for (const s of shapes) out.push(scrimRimSpec(s));
  return out;
}


/** The commander points forward with his free arm for `seconds` (after an order). */
export function setFigurePointing(anim: FigureAnim, seconds: number): void {
  anim.point = Math.max(anim.point, seconds);
}
