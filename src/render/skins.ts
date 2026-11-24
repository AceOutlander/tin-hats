/**
 * What is worn, for the battle view: the cosmetic item drawn on each unit kind and HQ of each side, and the textures
 * that takes. Nothing is made at startup or for a battle that wears nothing: a repainted sprite is painted the first
 * frame a unit needs it and joins the atlas at the end of that frame (the unit is drawn in the game's own art until
 * then, a frame at most); one of the owner's pictures joins once its file has loaded. The textures are dropped when
 * the battle is.
 *
 * Purely a matter of drawing: the views ask here which picture to put on an image they were going to draw anyway.
 */
import { figureSpriteMap } from '../art/figure';
import { hiddenParts, imageKey, imageSpec, recoloursFor, repaintKey, repaintedSpec, skinImageNow, skinImagesLoading } from '../art/skins';
import type { SpriteSpec } from '../art/types';
import { vehicleSpecs } from '../art/vehicles';
import { COSMETICS, type CosmeticItem, type SkinGlow, type SkinImage, type SkinPart, type SkinRecolour } from '../data/cosmetics';
import { RENDER } from '../data/render';
import { VIEW } from '../data/view';
import type { WearPart, WornLooks } from '../meta';
import type { SpriteRegistry } from './atlas';

/** Atlas group of everything a battle's cosmetics need (made on first use, dropped with the battle). */
const SKIN_GROUP = 'skins';

/** The picture drawn in place of one of the game's sprites: `key` once `ready`, the game's own until then. */
export interface SkinFrame {
  readonly key: string;
  ready: boolean;
}

/** One picture or glow a worn item adds to a unit. An image's `key` can be drawn once `ready`. */
export type SkinOverlay = { readonly kind: 'image'; readonly def: SkinImage; readonly key: string; ready: boolean } | { readonly kind: 'glow'; readonly def: SkinGlow };

interface Queued {
  frame: SkinFrame;
  base: string;
  recolours: readonly SkinRecolour[];
}

/** One item as a battle draws it. Made once per battle and shared by every unit that wears it. */
export class WornSkin {
  readonly hidden: ReadonlySet<SkinPart>;
  /** Its pictures, then its glows: COSMETICS.maxOverlays at most. */
  readonly overlays: readonly SkinOverlay[];
  private readonly paint = new Map<SkinPart, readonly SkinRecolour[]>();
  private readonly frames = new Map<SkinPart, Map<string, SkinFrame>>();

  constructor(
    readonly item: CosmeticItem,
    private readonly queue: (q: Queued) => void,
  ) {
    const look = item.look;
    this.hidden = hiddenParts(look);
    const overlays: SkinOverlay[] = [];
    (look.images ?? []).forEach((def, i) => overlays.push({ kind: 'image', def, key: imageKey(item.id, i), ready: false }));
    for (const def of look.glows ?? []) overlays.push({ kind: 'glow', def });
    this.overlays = overlays.slice(0, COSMETICS.maxOverlays);
  }

  /**
   * The repainted picture for one of the game's sprites on this part, or null when the item leaves the part as it is.
   * Asked every frame: it allocates only the first time a sprite is met.
   */
  frameFor(part: SkinPart, key: string): SkinFrame | null {
    let recolours = this.paint.get(part);
    if (recolours === undefined) {
      recolours = recoloursFor(this.item.look, part);
      this.paint.set(part, recolours);
    }
    if (recolours.length === 0) return null;
    let byKey = this.frames.get(part);
    if (!byKey) {
      byKey = new Map();
      this.frames.set(part, byKey);
    }
    let frame = byKey.get(key);
    if (!frame) {
      frame = { key: repaintKey(this.item.id, part, key), ready: false };
      byKey.set(key, frame);
      this.queue({ frame, base: key, recolours });
    }
    return frame;
  }
}

export class SkinStore {
  private worn: WornLooks | null = null;
  private readonly skins = new Map<string, WornSkin>();
  private pending: Queued[] = [];
  /** Sprites a battle built for itself (upgrade gear, the HQ buildings), by key: what a repaint paints over. */
  private readonly known = new Map<string, SpriteSpec>();
  private vehicles: Map<string, SpriteSpec> | null = null;
  private sprites = 0;
  private images = 0;
  private readonly missing = new Set<string>();

  constructor(private readonly reg: SpriteRegistry) {}

  /** A battle begins (what its player wears) or ends (null): the last battle's skins and their textures go. */
  setWorn(worn: WornLooks | null): void {
    this.worn = worn;
    this.skins.clear();
    this.pending = [];
    this.known.clear();
    this.sprites = 0;
    this.images = 0;
    this.reg.removeGroup(SKIN_GROUP);
  }

  /** True while this battle wears anything at all. */
  get active(): boolean {
    return this.worn !== null;
  }

  /** Sprites this battle made for itself, which a repaint may need to paint over. */
  know(specs: readonly SpriteSpec[]): void {
    if (!this.worn) return;
    for (const s of specs) this.known.set(s.key, s);
  }

  /** The item a side wears on a unit kind or on its HQ, as this battle draws it; null for none. */
  skinFor(side: number, part: WearPart): WornSkin | null {
    const item = this.worn?.sides[side === 1 ? 1 : 0].get(part);
    if (!item) return null;
    let skin = this.skins.get(item.id);
    if (!skin) {
      skin = new WornSkin(item, (q) => this.pending.push(q));
      this.skins.set(item.id, skin);
    }
    return skin;
  }

  private baseSpec(key: string): SpriteSpec | undefined {
    const own = this.known.get(key) ?? figureSpriteMap().get(key);
    if (own) return own;
    if (!this.vehicles) {
      this.vehicles = new Map();
      for (const s of vehicleSpecs()) this.vehicles.set(s.key, s);
    }
    return this.vehicles.get(key);
  }

  /**
   * End of a frame: paint what the frame asked for, add the pictures whose files have arrived, and make one atlas page
   * of them. Does nothing (and costs nothing) in a battle that wears nothing, or once everything is made.
   */
  flush(): void {
    if (!this.worn) return;
    const specs: SpriteSpec[] = [];
    const made: SkinFrame[] = [];
    for (const q of this.pending) {
      const base = this.baseSpec(q.base);
      if (!base) {
        // Art this store cannot find stays the game's own.
        if (!this.missing.has(q.base)) {
          this.missing.add(q.base);
          console.warn(`render: no sprite to repaint for "${q.base}"`);
        }
        continue;
      }
      specs.push(repaintedSpec(q.frame.key, base, q.recolours));
      made.push(q.frame);
    }
    this.pending = [];
    const arrived: { ready: boolean }[] = [];
    for (const skin of this.skins.values()) {
      for (const o of skin.overlays) {
        if (o.kind !== 'image' || o.ready) continue;
        const img = skinImageNow(o.def.file);
        if (!img) continue;
        specs.push(imageSpec(o.key, o.def, img));
        arrived.push(o);
      }
    }
    if (specs.length === 0) return;
    this.reg.addAtlas(SKIN_GROUP, specs, VIEW.textureScale, RENDER.atlasMaxSize);
    for (const f of made) f.ready = true;
    for (const o of arrived) o.ready = true;
    this.sprites += made.length;
    this.images += arrived.length;
  }

  stats(): { sprites: number; images: number; loading: number } {
    return { sprites: this.sprites, images: this.images, loading: this.worn ? skinImagesLoading() : 0 };
  }
}
