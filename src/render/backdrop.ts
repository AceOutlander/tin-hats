/**
 * Parallax backdrop: each layer from getBackdrop() becomes its own texture,
 * rasterised at the scale the backdrop module recommends, drawn as a few
 * repeated Images placed every frame from backdropLayerX().
 */
import Phaser from 'phaser';
import { backdropLayerX, backdropRasterArea, getBackdrop, rasteriseBackdropLayer, type BackdropLayer, type BackdropSlot } from '../art/backdrops';
import type { TheatreId, TimeOfDay } from '../data/schema';
import type { LayerName, Layers } from './layers';

/** Alpha above which a texture pixel counts as solid when a layer's skyline is measured. */
const SOLID_ALPHA = 110;

interface LayerView {
  def: BackdropLayer;
  texKey: string;
  images: Phaser.GameObjects.Image[];
  /** Multiply tint of every image (0xffffff = as painted). */
  tint: number;
  hidden: boolean;
  /** Skyline: world y of the highest solid pixel in each wu column of the tile (measured on request). */
  skyline: Float32Array | null;
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

  /** Build (or keep) the textures for this theatre, time and seed. Old textures are freed. */
  build(theatre: TheatreId, time: TimeOfDay, seed: number): void {
    const ident = `${theatre}/${time}/${seed}`;
    if (ident === this.ident) return;
    this.clear();
    this.ident = ident;
    this.version++;
    const defs = getBackdrop(theatre, time, seed);
    this.pixels = backdropRasterArea(defs);
    for (const def of defs) {
      const texKey = `bgtex/${def.slot}`;
      const canvas = rasteriseBackdropLayer(def);
      const tex = this.scene.textures.addCanvas(texKey, canvas);
      if (!tex) throw new Error(`backdrop texture ${texKey} already exists`);
      this.views.push({ def, texKey, images: [], tint: 0xffffff, hidden: false, skyline: null });
    }
  }

  /** Free every backdrop texture and image. */
  clear(): void {
    for (const v of this.views) {
      for (const img of v.images) img.destroy();
      this.scene.textures.remove(v.texKey);
    }
    this.views = [];
    this.ident = '';
    this.pixels = 0;
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
  }

  /** Leave a layer out of the picture (the sun in a storm). */
  setHidden(slot: BackdropSlot, hidden: boolean): void {
    const v = this.find(slot);
    if (!v || v.hidden === hidden) return;
    v.hidden = hidden;
    if (hidden) for (const img of v.images) img.visible = false;
  }

  /** Hide or show every layer at once. */
  setAllHidden(hidden: boolean): void {
    for (const v of this.views) {
      v.hidden = hidden;
      if (hidden) for (const img of v.images) img.visible = false;
    }
  }

  /** Back to the layers as painted: no tint. */
  resetLook(): void {
    for (const v of this.views) {
      if (v.tint === 0xffffff) continue;
      v.tint = 0xffffff;
      for (const img of v.images) img.clearTint();
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
    for (let n = 0; n < this.views.length; n++) {
      const v = this.views[n];
      const def = v.def;
      if (v.hidden) continue;
      const need = def.tile ? Math.ceil(viewW / def.w) + 1 : 1;
      while (v.images.length < need) {
        const img = new Phaser.GameObjects.Image(this.scene, 0, 0, v.texKey);
        img.setOrigin(0, 0);
        img.setScale(1 / def.scale);
        if (v.tint !== 0xffffff) img.setTint(v.tint);
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
      }
    }
  }
}
