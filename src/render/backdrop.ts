/**
 * Parallax backdrop: each layer from getBackdrop() becomes its own texture,
 * rasterised at the scale the backdrop module recommends, drawn as a few
 * repeated Images placed every frame from backdropLayerX().
 *
 * A mission laid out in sectors (FOUNDATIONS.md 4.1) also gets one ground tile per other ground style it uses, drawn
 * over the theatre's ground across those sectors (cropped to them), and a blend image GROUND_BLEND wu wide centred on
 * every edge between two styles, so one ground fades into the next.
 *
 * Scripted time of day and a second theatre (FOUNDATIONS.md 4.1 and 4.7, BackdropExtras): the sky, the sun or moon
 * and the clouds are painted for every time of day the mission passes through and crossfaded (setSkyMix); the land
 * strips are painted once, in the brightest of those times, and tinted darker (setLandTint). A second theatre's three
 * backdrop strips are drawn over the first and faded in over SECOND_BLEND wu around each edge of its stretches, by
 * where the camera is. Without extras nothing of this is built, and the backdrop is drawn exactly as before.
 */
import Phaser from 'phaser';
import {
  backdropLayerX,
  backdropRasterArea,
  getBackdrop,
  getGroundLayer,
  rasteriseBackdropLayer,
  type BackdropLayer,
  type BackdropSlot,
} from '../art/backdrops';
import type { TheatreId, TimeOfDay } from '../data/schema';
import { type GroundStyle, type TheatreVariant } from '../data/theatres';
import { variantDef } from '../art/backdrops/scene';
import { secondWeight } from '../fx';
import type { LayerName, Layers } from './layers';

/** Alpha above which a texture pixel counts as solid when a layer's skyline is measured. */
const SOLID_ALPHA = 110;
/** Width (wu) of the cross-fade between two grounds at a sector edge. */
const GROUND_BLEND = 200;
/** Tile width (wu) of the extra ground styles: half the theatre ground's, to keep their textures small on phones. */
const EXTRA_GROUND_TILE = 1024;
/** Images kept ready per sector overlay (each covers one tile; a wide view needs a few). */
const BAND_POOL = 4;

/** What a mission adds to its backdrop (all optional; none = the plain backdrop as before). */
export interface BackdropExtras {
  /** The theatre's variant (the winter look of a winter mission). */
  variant?: TheatreVariant;
  /** Every other time of day the mission's events pass through: their sky, sun or moon and clouds are painted too. */
  times?: readonly TimeOfDay[];
  /** A second theatre over these stretches of the field (SectorDef.backdrop): its far, mid and near strips. */
  second?: { theatre: TheatreId; variant: TheatreVariant; spans: readonly { from: number; to: number }[] };
}



/** A stretch of the field drawn in one ground style (the mission's sectors, merged where neighbours match). */
export interface GroundBand {
  from: number;
  to: number;
  style: GroundStyle;
}

interface BandView {
  from: number;
  to: number;
  def: BackdropLayer;
  images: Phaser.GameObjects.Image[];
}

interface BlendView {
  texKey: string;
  img: Phaser.GameObjects.Image;
}

interface LayerView {
  def: BackdropLayer;
  texKey: string;
  images: Phaser.GameObjects.Image[];
  /** Multiply tint of every image (0xffffff = as painted). */
  tint: number;
  hidden: boolean;
  /** Skyline: world y of the highest solid pixel in each wu column of the tile (measured on request). */
  skyline: Float32Array | null;
  /** Opacity of every image (the crossfades of the extras; 1 for the main layers). */
  alpha: number;
}

/** An extra layer: a sky, sun or moon, or clouds of another time of day, or a strip of the second theatre. */
interface ExtraView extends LayerView {
  time: TimeOfDay | null;
}

export class BackdropView {
  private views: LayerView[] = [];
  private ident = '';
  pixels = 0;
  /** Bumped on every build that made new textures. */
  version = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
  ) {}

  /** The sector overlays of other ground styles, the blends at their edges, and the extra ground textures. */
  private bands: BandView[] = [];
  private blends: BlendView[] = [];
  private groundKeys: string[] = [];
  /** The extras' layers (other times' skies, the second theatre's strips) and the second theatre's stretches. */
  private extras: ExtraView[] = [];
  private secondSpans: readonly { from: number; to: number }[] = [];
  private landTint = 0xffffff;
  /** The time of day the main layers were painted in. */
  private baseTime: TimeOfDay = 'day';

  /**
   * Build (or keep) the textures for this theatre, time and seed, and for a mission in sectors its other grounds
   * (`ground`: the sectors' ground styles, left to right). Old textures are freed.
   */
  build(theatre: TheatreId, time: TimeOfDay, seed: number, ground: readonly GroundBand[] = [], extras: BackdropExtras = {}): void {
    const bands = mergeBands(ground);
    const variant = extras.variant ?? 'base';
    const times = (extras.times ?? []).filter((t, i, all) => t !== time && all.indexOf(t) === i);
    const second = extras.second;
    const extra = `${variant}/${times.join('+')}/${second ? `${second.theatre}~${second.variant}:${second.spans.map((s) => `${s.from}-${s.to}`).join(',')}` : ''}`;
    const ident = `${theatre}/${time}/${seed}/${bands.map((b) => `${b.from}-${b.to}:${b.style}`).join(',')}/${extra}`;
    if (ident === this.ident) return;
    const __c = performance.now();
    this.clear();
    console.log('[T] clear', (performance.now() - __c).toFixed(0));
    this.ident = ident;
    this.version++;
    this.baseTime = time;
    let __g = performance.now();
    const defs = getBackdrop(theatre, time, seed, variant);
    console.log('[T] getBackdrop', (performance.now() - __g).toFixed(0));
    this.pixels = backdropRasterArea(defs);
    let groundCanvas: HTMLCanvasElement | null = null;
    for (const def of defs) {
      const texKey = `bgtex/${def.slot}`;
      const __a = performance.now();
      const canvas = rasteriseBackdropLayer(def);
      console.log('[T] layer', def.slot, canvas.width + 'x' + canvas.height, (performance.now() - __a).toFixed(0));
      __g = performance.now();
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1);
      console.log('[T]   flush', (performance.now() - __g).toFixed(0));
      __g = performance.now();
      if (def.slot === 'ground') groundCanvas = canvas;
      const tex = this.scene.textures.addCanvas(texKey, canvas);
      if (!tex) throw new Error(`backdrop texture ${texKey} already exists`);
      console.log('[T]   addCanvas', (performance.now() - __g).toFixed(0));
      this.views.push({ def, texKey, images: [], tint: 0xffffff, hidden: false, skyline: null, alpha: 1 });
    }
    for (const t of times) {
      for (const def of getBackdrop(theatre, t, seed, variant)) {
        if (def.slot !== 'sky' && def.slot !== 'celestial' && def.slot !== 'clouds') continue;
        this.addExtra(def, `bgtex/${def.slot}/${t}`, t);
      }
    }
    if (second) {
      this.secondSpans = second.spans;
      for (const def of getBackdrop(second.theatre, time, seed, second.variant)) {
        if (def.slot !== 'farBackdrop' && def.slot !== 'midBackdrop' && def.slot !== 'nearBackdrop') continue;
        this.addExtra(def, `bgtex/${def.slot}/second`, null);
      }
    }
    const base = variantDef(theatre, variant).groundStyle;
    const groundDef = this.find('ground')?.def;
    if (!groundDef || !groundCanvas || !bands.some((b) => b.style !== base)) return;
    this.buildGround(theatre, time, seed, bands, base, groundDef, groundCanvas, variant);
  }

  /** Rasterise one extra layer, starting unseen (alpha 0). */
  private addExtra(def: BackdropLayer, texKey: string, time: TimeOfDay | null): void {
    const __a = performance.now();
    if (!this.scene.textures.addCanvas(texKey, rasteriseBackdropLayer(def))) throw new Error(`backdrop texture ${texKey} already exists`);
    console.log('[T] extra', texKey, (performance.now() - __a).toFixed(0));
    this.pixels += backdropRasterArea([def]);
    this.extras.push({ def, texKey, images: [], tint: 0xffffff, hidden: false, skyline: null, alpha: 0, time });
  }

  /**
   * The sky, sun or moon and clouds during a change of the time of day from `from` to `to`, `k` of the way: the
   * later time's layers are drawn over the earlier ones at opacity k. Only times given to build() (and its own) show.
   */
  setSkyMix(from: TimeOfDay, to: TimeOfDay, k: number): void {
    const fading = from !== to;
    const base = this.baseTime;
    const fromKnown = from === base || this.extras.some((e) => e.time === from);
    // A time's layers: opacity 1 for the earlier time (or a time not built: the main ones), k over it for the later.
    const look = (time: TimeOfDay, main: boolean): [number, number] => {
      if (time === from || (main && !fromKnown)) return [1, 1];
      if (fading && time === to) return [k, 2];
      return [0, 0];
    };
    const apply = (v: LayerView, time: TimeOfDay, main: boolean): void => {
      const [alpha, depth] = look(time, main);
      v.alpha = alpha;
      for (const img of v.images) if (img.depth !== depth) img.setDepth(depth);
    };
    for (const v of this.views) if (v.def.slot === 'sky' || v.def.slot === 'celestial' || v.def.slot === 'clouds') apply(v, base, true);
    for (const e of this.extras) if (e.time !== null) apply(e, e.time, false);
  }

  /** Multiply-tint every land layer (the strips, the ground and its sector overlays, the foreground; both theatres). */
  setLandTint(tint: number): void {
    if (tint === this.landTint) return;
    this.landTint = tint;
    for (const slot of ['farBackdrop', 'midBackdrop', 'nearBackdrop', 'ground', 'foreground'] as const) this.setTint(slot, tint);
    for (const e of this.extras) {
      if (e.time !== null) continue;
      e.tint = tint;
      for (const img of e.images) img.setTint(tint);
    }
  }

  private buildGround(
    theatre: TheatreId,
    time: TimeOfDay,
    seed: number,
    bands: GroundBand[],
    base: GroundStyle,
    groundDef: BackdropLayer,
    groundCanvas: HTMLCanvasElement,
    variant: TheatreVariant,
  ): void {
    // One tile per other style the mission uses.
    const tiles = new Map<GroundStyle, { def: BackdropLayer; canvas: HTMLCanvasElement }>();
    tiles.set(base, { def: groundDef, canvas: groundCanvas });
    for (const b of bands) {
      if (tiles.has(b.style)) continue;
      const def = getGroundLayer(theatre, time, seed, b.style, EXTRA_GROUND_TILE, variant);
      const __a = performance.now();
      const canvas = rasteriseBackdropLayer(def);
      console.log('[T] groundtile', b.style, (performance.now() - __a).toFixed(0));
      const texKey = `bgtex/ground/${b.style}`;
      if (!this.scene.textures.addCanvas(texKey, canvas)) throw new Error(`backdrop texture ${texKey} already exists`);
      this.groundKeys.push(texKey);
      this.pixels += backdropRasterArea([def]);
      tiles.set(b.style, { def: { ...def, key: texKey }, canvas });
    }
    // Overlays first (the decal layer: above the theatre's ground, below craters and trenches), blends over them.
    const layer = this.layers.byName.groundDecals;
    for (const b of bands) {
      if (b.style === base) continue;
      const t = tiles.get(b.style)!;
      const view: BandView = { from: b.from, to: b.to, def: t.def, images: [] };
      for (let i = 0; i < BAND_POOL; i++) view.images.push(this.groundImage(layer, t.def.key, t.def));
      this.bands.push(view);
    }
    for (let i = 1; i < bands.length; i++) {
      const left = tiles.get(bands[i - 1].style)!;
      const right = tiles.get(bands[i].style)!;
      const edge = bands[i].from;
      const __a = performance.now();
      const canvas = blendCanvas(left, right, edge - GROUND_BLEND / 2, GROUND_BLEND, groundDef);
      console.log('[T] blend', i, (performance.now() - __a).toFixed(0));
      const texKey = `bgtex/ground/blend${i}`;
      if (!this.scene.textures.addCanvas(texKey, canvas)) throw new Error(`backdrop texture ${texKey} already exists`);
      this.groundKeys.push(texKey);
      const img = this.groundImage(layer, texKey, groundDef);
      img.x = edge - GROUND_BLEND / 2;
      img.y = groundDef.y;
      img.visible = true;
      this.blends.push({ texKey, img });
    }
  }

  private groundImage(layer: Phaser.GameObjects.Layer, texKey: string, def: BackdropLayer): Phaser.GameObjects.Image {
    const img = new Phaser.GameObjects.Image(this.scene, 0, 0, texKey);
    img.setOrigin(0, 0);
    img.setScale(1 / def.scale);
    img.visible = false;
    layer.add(img);
    return img;
  }

  /** Free every backdrop texture and image. */
  clear(): void {
    for (const v of this.views) {
      for (const img of v.images) img.destroy();
      this.scene.textures.remove(v.texKey);
    }
    for (const b of this.bands) for (const img of b.images) img.destroy();
    for (const b of this.blends) b.img.destroy();
    for (const key of this.groundKeys) this.scene.textures.remove(key);
    for (const e of this.extras) {
      for (const img of e.images) img.destroy();
      this.scene.textures.remove(e.texKey);
    }
    this.extras = [];
    this.secondSpans = [];
    this.landTint = 0xffffff;
    this.bands = [];
    this.blends = [];
    this.groundKeys = [];
    this.views = [];
    this.ident = '';
    this.pixels = 0;
  }

  /** Every image that draws the ground: the theatre's tiles, the sector overlays and the blends. */
  private groundExtras(each: (img: Phaser.GameObjects.Image) => void): void {
    for (const b of this.bands) for (const img of b.images) each(img);
    for (const b of this.blends) each(b.img);
  }

  private find(slot: BackdropSlot): LayerView | null {
    for (const v of this.views) if (v.def.slot === slot) return v;
    return null;
  }

  /** The layer definition of a slot, or null before a build. */
  layer(slot: BackdropSlot): BackdropLayer | null {
    return this.find(slot)?.def ?? null;
  }

  /** Multiply-tint one layer (0xffffff = as painted). Cheap when nothing changes. */
  setTint(slot: BackdropSlot, tint: number): void {
    const v = this.find(slot);
    if (!v || v.tint === tint) return;
    v.tint = tint;
    for (const img of v.images) img.setTint(tint);
    if (slot === 'ground') this.groundExtras((img) => img.setTint(tint));
  }

  /** Leave a layer out of the picture (the sun in a storm). */
  setHidden(slot: BackdropSlot, hidden: boolean): void {
    const v = this.find(slot);
    if (!v || v.hidden === hidden) return;
    v.hidden = hidden;
    if (hidden) for (const img of v.images) img.visible = false;
    if (hidden && slot === 'ground') this.groundExtras((img) => (img.visible = false));
  }

  /** Hide or show every layer at once. */
  setAllHidden(hidden: boolean): void {
    for (const v of this.views) {
      v.hidden = hidden;
      if (hidden) for (const img of v.images) img.visible = false;
    }
    for (const e of this.extras) {
      e.hidden = hidden;
      if (hidden) for (const img of e.images) img.visible = false;
    }
    if (hidden) this.groundExtras((img) => (img.visible = false));
  }

  /** Back to the layers as painted: no tint. */
  resetLook(): void {
    this.landTint = 0xffffff;
    for (const e of this.extras) {
      e.tint = 0xffffff;
      for (const img of e.images) img.clearTint();
    }
    for (const v of this.views) {
      if (v.tint === 0xffffff) continue;
      v.tint = 0xffffff;
      for (const img of v.images) img.clearTint();
      if (v.def.slot === 'ground') this.groundExtras((img) => img.clearTint());
    }
  }

  /**
   * A tiling strip's skyline: for every wu column of its tile, the world y of the highest solid pixel (the bottom of
   * the strip where a column is empty). Read back from the texture once and kept until the next build.
   */
  skyline(slot: BackdropSlot): Float32Array | null {
    const v = this.find(slot);
    if (!v) return null;
    if (v.skyline) return v.skyline;
    const def = v.def;
    const source = this.scene.textures.get(v.texKey).getSourceImage();
    if (!(source instanceof HTMLCanvasElement)) return null;
    const ctx = source.getContext('2d');
    if (!ctx) return null;
    const w = source.width;
    const h = source.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const cols = Math.max(1, Math.round(def.w));
    const out = new Float32Array(cols);
    for (let c = 0; c < cols; c++) {
      const px = Math.min(w - 1, Math.floor((c + 0.5) * def.scale));
      let top = def.y + def.h;
      for (let row = 0; row < h; row++) {
        if (data[(row * w + px) * 4 + 3] > SOLID_ALPHA) {
          top = def.y + row / def.scale;
          break;
        }
      }
      out[c] = top;
    }
    v.skyline = out;
    return out;
  }

  /** Place every layer for a view whose left edge is at world x = camLeft and that is viewW wide. */
  update(camLeft: number, viewW: number): void {
    if (this.extras.length > 0) {
      // The second theatre fades in by where the camera looks; under it, the first theatre's strips can go once covered.
      const w2 = this.secondSpans.length > 0 ? secondWeight(this.secondSpans, camLeft + viewW / 2) : 0;
      for (const e of this.extras) if (e.time === null) e.alpha = w2;
      for (const v of this.views) {
        const strip = v.def.slot === 'farBackdrop' || v.def.slot === 'midBackdrop' || v.def.slot === 'nearBackdrop';
        if (strip && this.secondSpans.length > 0) v.alpha = w2 >= 0.999 ? 0 : 1;
      }
      this.place(this.extras, camLeft, viewW);
    }
    this.place(this.views, camLeft, viewW);
    if (this.bands.length > 0 || this.blends.length > 0) this.updateGround(camLeft, viewW);
  }

  private place(views: readonly LayerView[], camLeft: number, viewW: number): void {
    for (let n = 0; n < views.length; n++) {
      const v = views[n];
      const def = v.def;
      if (v.hidden) continue;
      if (v.alpha <= 0.002) {
        for (const img of v.images) img.visible = false;
        continue;
      }
      const need = def.tile ? Math.ceil(viewW / def.w) + 1 : 1;
      while (v.images.length < need) {
        const img = new Phaser.GameObjects.Image(this.scene, 0, 0, v.texKey);
        img.setOrigin(0, 0);
        img.setScale(1 / def.scale);
        if (v.tint !== 0xffffff) img.setTint(v.tint);
        // An extra draws over the main layer of its slot.
        if (views !== this.views) img.setDepth(1);
        this.layers.byName[def.slot as LayerName].add(img);
        v.images.push(img);
      }
      const x0 = camLeft + backdropLayerX(def, camLeft);
      for (let i = 0; i < v.images.length; i++) {
        const img = v.images[i];
        const on = i < need && x0 + i * def.w < camLeft + viewW;
        img.visible = on;
        if (!on) continue;
        img.x = x0 + i * def.w;
        img.y = def.y;
        if (img.alpha !== v.alpha) img.alpha = v.alpha;
      }
    }
  }

  /** The sector overlays (each tile cropped to its sector) and the blends at their edges, for the camera's view. */
  private updateGround(camLeft: number, viewW: number): void {
    const hidden = this.find('ground')?.hidden ?? false;
    const camRight = camLeft + viewW;
    for (const b of this.bands) {
      const def = b.def;
      const w = def.w;
      const a = Math.max(b.from, camLeft);
      const z = Math.min(b.to, camRight);
      const k0 = Math.floor(a / w);
      const count = hidden || z <= a ? 0 : Math.floor((z - 1e-6) / w) - k0 + 1;
      for (let i = 0; i < b.images.length; i++) {
        const img = b.images[i];
        const on = i < count;
        img.visible = on;
        if (!on) continue;
        const x0 = (k0 + i) * w;
        const from = Math.max(b.from, x0);
        const to = Math.min(b.to, x0 + w);
        img.x = x0;
        img.y = def.y;
        img.setCrop((from - x0) * def.scale, 0, (to - from) * def.scale, def.h * def.scale);
      }
    }
    for (const b of this.blends) {
      const x = b.img.x;
      b.img.visible = !hidden && x < camRight && x + GROUND_BLEND > camLeft;
    }
  }
}

/** Neighbouring stretches of the same style become one band (no blend between them). */
function mergeBands(ground: readonly GroundBand[]): GroundBand[] {
  const out: GroundBand[] = [];
  for (const g of ground) {
    const last = out[out.length - 1];
    if (last && last.style === g.style && last.to === g.from) last.to = g.to;
    else out.push({ from: g.from, to: g.to, style: g.style });
  }
  return out;
}

/** Copy the tile's pixels under world [x0, x0 + width) into ctx at 0 (a tiling strip: world x maps to x mod tile width). */
function drawSlice(ctx: CanvasRenderingContext2D, tile: { def: BackdropLayer; canvas: HTMLCanvasElement }, x0: number, width: number, scale: number): void {
  const w = tile.def.w;
  const src = tile.def.scale;
  const h = tile.def.h;
  let x = x0;
  while (x < x0 + width - 1e-6) {
    const tx = ((x % w) + w) % w;
    const seg = Math.min(w - tx, x0 + width - x);
    ctx.drawImage(tile.canvas, tx * src, 0, seg * src, h * src, (x - x0) * scale, 0, seg * scale, h * scale);
    x += seg;
  }
}

/** A blend `width` wu wide from world x0: the left ground fading into the right one, left to right. */
function blendCanvas(
  left: { def: BackdropLayer; canvas: HTMLCanvasElement },
  right: { def: BackdropLayer; canvas: HTMLCanvasElement },
  x0: number,
  width: number,
  base: BackdropLayer,
): HTMLCanvasElement {
  const scale = base.scale;
  const pw = Math.ceil(width * scale);
  const ph = Math.ceil(base.h * scale);
  const out = document.createElement('canvas');
  out.width = pw;
  out.height = ph;
  const ctx = out.getContext('2d');
  const top = document.createElement('canvas');
  top.width = pw;
  top.height = ph;
  const tctx = top.getContext('2d');
  if (!ctx || !tctx) return out;
  drawSlice(ctx, left, x0, width, scale);
  drawSlice(tctx, right, x0, width, scale);
  // The right ground through a soft ramp, eased at both ends so the seam never reads as a line.
  const ramp = tctx.createLinearGradient(0, 0, pw, 0);
  ramp.addColorStop(0, 'rgba(0,0,0,0)');
  ramp.addColorStop(0.35, 'rgba(0,0,0,0.25)');
  ramp.addColorStop(0.65, 'rgba(0,0,0,0.75)');
  ramp.addColorStop(1, 'rgba(0,0,0,1)');
  tctx.globalCompositeOperation = 'destination-in';
  tctx.fillStyle = ramp;
  tctx.fillRect(0, 0, pw, ph);
  ctx.drawImage(top, 0, 0);
  return out;
}
