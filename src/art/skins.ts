/**
 * Cosmetic looks as pictures (src/data/cosmetics.ts SkinLook): a coat of paint over one of the game's own sprites, and
 * the owner's pictures made into sprites. Plain Canvas 2D like all the art; the battle view makes textures of them the
 * first time a battle wears the item (src/render/skins.ts), and the menus draw the same specs into their canvases.
 * Nothing here is touched at startup, and nothing here knows a battle's rules.
 */
import type { SkinImage, SkinLook, SkinPart, SkinPattern, SkinPin, SkinRecolour } from '../data/cosmetics';
import type { SpriteSpec } from './types';

/** The part of the game's own art a picture pinned with `replaces` stands in for (none for 'body'). */
export const PIN_PART: Readonly<Record<SkinPin, SkinPart | null>> = { head: 'helmet', body: null, weapon: 'weapon', hull: 'hull', turret: 'turret', hq: 'hq' };

/** The recolours of a look that paint a part, in the look's order. */
export function recoloursFor(look: SkinLook, part: SkinPart): SkinRecolour[] {
  return (look.recolours ?? []).filter((rc) => rc.parts === undefined || rc.parts.includes(part));
}

/** The parts of the game's own art a look leaves undrawn: those it hides, and those a picture replaces. */
export function hiddenParts(look: SkinLook): Set<SkinPart> {
  const out = new Set<SkinPart>(look.hide ?? []);
  for (const img of look.images ?? []) {
    const part = PIN_PART[img.pin];
    if (img.replaces === true && part !== null) out.add(part);
  }
  return out;
}

export function repaintKey(itemId: string, part: SkinPart, key: string): string {
  return `skin/${itemId}/${part}/${key}`;
}

export function imageKey(itemId: string, index: number): string {
  return `skin/${itemId}/image/${index}`;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Dab a pattern over a w x h sprite (wu). The same sprite gets the same dabs every time. */
function paintPattern(ctx: CanvasRenderingContext2D, w: number, h: number, pattern: SkinPattern, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = pattern.colour;
  if (pattern.kind === 'stripes') {
    // Slanted bands across the whole sprite: `size` wide, spaced so they cover the share asked for.
    const period = pattern.size / Math.max(0.05, Math.min(0.95, pattern.cover));
    const reach = w + h;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.6);
    for (let x = -reach + (rand() * period) / 2; x < reach; x += period) ctx.fillRect(x, -reach, pattern.size, reach * 2);
    ctx.restore();
    return;
  }
  const r = pattern.size / 2;
  const each = Math.PI * r * r;
  const n = Math.max(1, Math.round((pattern.cover * w * h) / each));
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.beginPath();
    if (pattern.kind === 'spots') {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else {
      // A blotch: three overlapping lobes of uneven size.
      for (let k = 0; k < 3; k++) {
        const a = rand() * Math.PI * 2;
        const d = r * 0.6 * rand();
        const cx = x + Math.cos(a) * d;
        const cy = y + Math.sin(a) * d;
        const lobe = r * (0.55 + 0.45 * rand());
        ctx.moveTo(cx + lobe, cy);
        ctx.ellipse(cx, cy, lobe, lobe * (0.6 + 0.4 * rand()), rand() * Math.PI, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}

/**
 * One of the game's sprites with a look's paint over it: each recolour is laid on the sprite's own shape (never
 * outside it), at its strength, with its pattern dabbed on top. The size, the anchor and the outline stay the game's.
 */
export function repaintedSpec(key: string, base: SpriteSpec, recolours: readonly SkinRecolour[]): SpriteSpec {
  const seed = hash(key);
  return {
    key,
    w: base.w,
    h: base.h,
    ax: base.ax,
    ay: base.ay,
    draw(ctx: CanvasRenderingContext2D): void {
      // Painted on a canvas of its own at the resolution it will be drawn at, so the paint only meets this sprite.
      const t = ctx.getTransform();
      const scale = Math.max(0.25, Math.hypot(t.a, t.b));
      const pw = Math.max(1, Math.ceil(base.w * scale));
      const ph = Math.max(1, Math.ceil(base.h * scale));
      const off = document.createElement('canvas');
      off.width = pw;
      off.height = ph;
      const o = off.getContext('2d');
      if (!o) {
        base.draw(ctx);
        return;
      }
      o.scale(pw / base.w, ph / base.h);
      base.draw(o);
      o.globalCompositeOperation = 'source-atop';
      for (const rc of recolours) {
        o.globalAlpha = Math.max(0, Math.min(1, rc.strength));
        o.fillStyle = rc.colour;
        o.fillRect(0, 0, base.w, base.h);
        if (rc.pattern) paintPattern(o, base.w, base.h, rc.pattern, seed);
      }
      ctx.drawImage(off, 0, 0, base.w, base.h);
      off.width = off.height = 0;
    },
  };
}

/** One of the owner's pictures as a sprite of the size and anchor its data entry gives. */
export function imageSpec(key: string, def: SkinImage, source: CanvasImageSource): SpriteSpec {
  return {
    key,
    w: def.w,
    h: def.h,
    ax: def.ax,
    ay: def.ay,
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.drawImage(source, 0, 0, def.w, def.h);
    },
  };
}

// --- the owner's picture files -------------------------------------------------------------------------------------------

/**
 * Every picture in src/cosmetics/art, by file name, as a function that fetches its address. Nothing is fetched until
 * a picture is first needed: a battle that wears its item, or a menu that shows it.
 */
const FILES = import.meta.glob<string>('../cosmetics/art/*.{svg,png}', { query: '?url', import: 'default' });

type Loaded = HTMLImageElement | 'failed';
const cache = new Map<string, Loaded | Promise<Loaded>>();

function fetchImage(file: string): Promise<Loaded> {
  const find = FILES[`../cosmetics/art/${file}`];
  if (!find) {
    console.warn(`Tin Hats: no cosmetic picture "${file}" in src/cosmetics/art`);
    return Promise.resolve('failed');
  }
  return find().then(
    (url) =>
      new Promise<Loaded>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn(`Tin Hats: the cosmetic picture "${file}" could not be read`);
          resolve('failed');
        };
        img.src = url;
      }),
    () => 'failed' as const,
  );
}

/** A picture, once it has loaded; null if it cannot be had. */
export function loadSkinImage(file: string): Promise<HTMLImageElement | null> {
  let entry = cache.get(file);
  if (entry === undefined) {
    entry = fetchImage(file).then((got) => {
      cache.set(file, got);
      return got;
    });
    cache.set(file, entry);
  }
  return Promise.resolve(entry).then((got) => (got === 'failed' ? null : got));
}

/** A picture if it has already loaded, else null (and it starts loading, so a later frame finds it). */
export function skinImageNow(file: string): HTMLImageElement | null {
  const entry = cache.get(file);
  if (entry === undefined) {
    void loadSkinImage(file);
    return null;
  }
  return entry instanceof HTMLImageElement ? entry : null;
}

/** Pictures asked for and still on their way. */
export function skinImagesLoading(): number {
  let n = 0;
  for (const entry of cache.values()) if (entry instanceof Promise) n++;
  return n;
}

/** Every picture of a look, loaded (the ones that cannot be had are left out). */
export function loadLookImages(look: SkinLook): Promise<void> {
  return Promise.all((look.images ?? []).map((img) => loadSkinImage(img.file))).then(() => undefined);
}
