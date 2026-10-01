/**
 * Parallax backdrop: each layer from getBackdrop() becomes its own texture,
 * rasterised at the scale the backdrop module recommends, drawn as a few
 * repeated Images placed every frame from backdropLayerX().
 */
import Phaser from 'phaser';
import { backdropLayerX, backdropRasterArea, getBackdrop, rasteriseBackdropLayer, type BackdropLayer } from '../art/backdrops';
import type { TheatreId, TimeOfDay } from '../data/schema';
import type { LayerName, Layers } from './layers';

interface LayerView {
  def: BackdropLayer;
  texKey: string;
  images: Phaser.GameObjects.Image[];
}

export class BackdropView {
  private views: LayerView[] = [];
  private ident = '';
  pixels = 0;

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
    const defs = getBackdrop(theatre, time, seed);
    this.pixels = backdropRasterArea(defs);
    for (const def of defs) {
      const texKey = `bgtex/${def.slot}`;
      const canvas = rasteriseBackdropLayer(def);
      const tex = this.scene.textures.addCanvas(texKey, canvas);
      if (!tex) throw new Error(`backdrop texture ${texKey} already exists`);
      this.views.push({ def, texKey, images: [] });
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

  /** Place every layer for a view whose left edge is at world x = camLeft and that is viewW wide. */
  update(camLeft: number, viewW: number): void {
    for (let n = 0; n < this.views.length; n++) {
      const v = this.views[n];
      const def = v.def;
      const need = def.tile ? Math.ceil(viewW / def.w) + 1 : 1;
      while (v.images.length < need) {
        const img = new Phaser.GameObjects.Image(this.scene, 0, 0, v.texKey);
        img.setOrigin(0, 0);
        img.setScale(1 / def.scale);
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
