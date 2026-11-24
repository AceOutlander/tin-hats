/**
 * A cosmetic item's portrait for the menus (the Appearance tab, an opened crate): the first thing it dresses, drawn
 * with its look by the same canvas painters as every other portrait. One of the owner's pictures that has not loaded
 * yet is left out, and the portrait is painted again when it arrives.
 */
import { FIGURE_PIN, FIGURE_SLOT_PART, setFigureClothing, setFigureHeadgear, type FigureDressing, type FigurePart } from './figure';
import { paintUnitPortrait, type TankDressing } from './icons';
import { hiddenParts, loadLookImages, recoloursFor, repaintKey, repaintedSpec, skinImageNow } from './skins';
import { hqStyleKey, hqStyleSpecs } from './structures/hqStyles';
import type { SpriteSpec } from './types';
import type { PartXf } from './vehicles';
import { FIGURE } from '../data/figure';
import type { CosmeticItem, SkinGlow, SkinImage, SkinLook, SkinPart, SkinPin } from '../data/cosmetics';
import { isVehicleKind } from '../data/eras';
import type { FactionId, UnitKind } from '../data/schema';
import { itemNations, itemParts } from '../meta/cosmetics';
import { lookStyle, sideLooks } from '../meta/looks';

/** One sprite as the look paints it, or null when the look leaves the part out. */
function dressed(item: CosmeticItem, hidden: ReadonlySet<SkinPart>, part: SkinPart, spec: SpriteSpec): SpriteSpec | null {
  if (hidden.has(part)) return null;
  const recolours = recoloursFor(item.look, part);
  return recolours.length > 0 ? repaintedSpec(repaintKey(item.id, part, spec.key), spec, recolours) : spec;
}

function drawGlow(ctx: CanvasRenderingContext2D, glow: SkinGlow): void {
  const r = glow.size / 2;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  const rgb = [1, 3, 5].map((i) => parseInt(glow.colour.slice(i, i + 2), 16)).join(',');
  g.addColorStop(0, `rgba(${rgb},${glow.alpha})`);
  g.addColorStop(0.35, `rgba(${rgb},${glow.alpha * 0.55})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, glow.size, glow.size);
}

/** Draw a look's pictures and glows for the pins `at` knows (the pin's place and turn in the portrait's own space). */
function drawOverlays(ctx: CanvasRenderingContext2D, look: SkinLook, at: (pin: SkinPin) => { x: number; y: number; rot: number } | null): void {
  const put = (def: SkinImage | SkinGlow, draw: () => void): void => {
    const where = at(def.pin);
    if (!where) return;
    ctx.save();
    ctx.translate(where.x, where.y);
    ctx.rotate(where.rot);
    ctx.translate(def.x ?? 0, def.y ?? 0);
    draw();
    ctx.restore();
  };
  for (const img of look.images ?? []) {
    const source = skinImageNow(img.file);
    if (source) put(img, () => ctx.drawImage(source, -img.ax * img.w, -img.ay * img.h, img.w, img.h));
  }
  for (const glow of look.glows ?? []) put(glow, () => drawGlow(ctx, glow));
}

function paintHq(canvas: HTMLCanvasElement, item: CosmeticItem, faction: FactionId): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const style = lookStyle(sideLooks(faction, {}), 'hq');
  const key = hqStyleKey(style, faction, 'intact');
  const own = hqStyleSpecs(style, faction).find((s) => s.key === key);
  if (!own) return;
  const spec = dressed(item, hiddenParts(item.look), 'hq', own);
  const W = canvas.width;
  const H = canvas.height;
  const m = FIGURE.icon.margin;
  const scale = Math.min((W * (1 - 2 * m)) / own.w, (H * (1 - 2 * m)) / own.h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-own.w / 2, -own.h / 2);
  if (spec) spec.draw(ctx);
  // The HQ's pin is the sprite's own anchor: the ground under its art origin.
  drawOverlays(ctx, item.look, (pin) => (pin === 'hq' ? { x: own.ax * own.w, y: own.ay * own.h, rot: 0 } : null));
  ctx.restore();
}

/**
 * Paint the item's portrait into a canvas (its pixel size), as `own` commands it against `enemy`: the player's own
 * nation's unit for an item of the player's side where the item is for that nation, the enemy's for an enemy item.
 */
function paintNow(canvas: HTMLCanvasElement, item: CosmeticItem, own: FactionId, enemy: FactionId): void {
  const nations = itemNations(item);
  const wanted = item.target.side === 'own' ? own : enemy;
  const faction = nations.includes(wanted) ? wanted : nations[0];
  const part = itemParts(item)[0];
  if (part === 'hq') {
    paintHq(canvas, item, faction);
    return;
  }
  const kind: UnitKind = part;
  const hidden = hiddenParts(item.look);
  const look = item.look;
  const figure: FigureDressing = {
    dress: (anim) => {
      if (look.headgear) setFigureHeadgear(anim, look.headgear);
      if (look.clothing) setFigureClothing(anim, look.clothing);
    },
    spec: (slot, spec) => {
      const piece = FIGURE_SLOT_PART[slot];
      return piece === null ? spec : dressed(item, hidden, piece, spec);
    },
    after: (ctx, parts: readonly FigurePart[]) =>
      drawOverlays(ctx, look, (pin) => {
        if (pin !== 'head' && pin !== 'body' && pin !== 'weapon') return null;
        const p = parts[FIGURE_PIN[pin].slot];
        return { x: p.x, y: p.y, rot: p.rotation + FIGURE_PIN[pin].turn };
      }),
  };
  const tank: TankDressing = {
    spec: (piece, spec) => dressed(item, hidden, piece, spec),
    after: (ctx, hull: PartXf, turret: PartXf) => drawOverlays(ctx, look, (pin) => (pin === 'hull' ? hull : pin === 'turret' ? turret : null)),
  };
  paintUnitPortrait(canvas, kind, faction, undefined, undefined, look.weapon ? { weapon: look.weapon } : undefined, isVehicleKind(kind) ? { tank } : { figure });
}

/**
 * Paint an item's portrait, and once more when pictures of its look that were still loading have arrived (unless
 * `alive` says the canvas is no longer wanted).
 */
export function paintCosmeticPreview(canvas: HTMLCanvasElement, item: CosmeticItem, own: FactionId, enemy: FactionId, alive: () => boolean = () => true): void {
  paintNow(canvas, item, own, enemy);
  const waiting = (item.look.images ?? []).some((img) => skinImageNow(img.file) === null);
  if (!waiting) return;
  void loadLookImages(item.look).then(() => {
    if (alive()) paintNow(canvas, item, own, enemy);
  });
}
