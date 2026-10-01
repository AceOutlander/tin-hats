/**
 * One Phaser Layer per draw slot in DEPTH (src/data/view.ts), plus one per
 * unit row. Objects never change depth: they live in the layer of their slot
 * and keep their insertion order inside it, so the scene never re-sorts.
 */
import Phaser from 'phaser';
import { DEPTH, VIEW } from '../data/view';

export type LayerName = Exclude<keyof typeof DEPTH, 'unitRow0'>;

export interface Layers {
  /** Every slot of DEPTH except the unit rows. */
  readonly byName: Record<LayerName, Phaser.GameObjects.Layer>;
  /** Unit row r draws at DEPTH.unitRow0 + r (0 = farthest). */
  readonly rows: Phaser.GameObjects.Layer[];
  /** Additive (glow) effects, just above DEPTH.effects, so blend changes do not break up the effects batch. */
  readonly glow: Phaser.GameObjects.Layer;
}

export function createLayers(scene: Phaser.Scene): Layers {
  const byName = {} as Record<LayerName, Phaser.GameObjects.Layer>;
  for (const name of Object.keys(DEPTH) as (keyof typeof DEPTH)[]) {
    if (name === 'unitRow0') continue;
    const layer = scene.add.layer();
    layer.setDepth(DEPTH[name]);
    byName[name] = layer;
  }
  const rows: Phaser.GameObjects.Layer[] = [];
  for (let r = 0; r < VIEW.rows; r++) {
    const layer = scene.add.layer();
    layer.setDepth(DEPTH.unitRow0 + r);
    rows.push(layer);
  }
  const glow = scene.add.layer();
  glow.setDepth(DEPTH.effects + 0.5);
  return { byName, rows, glow };
}

/** Make an Image that is not on any display list yet, then add it to `layer`. */
export function addImage(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer | Phaser.GameObjects.Container, frame: Phaser.Textures.Frame): Phaser.GameObjects.Image {
  const img = new Phaser.GameObjects.Image(scene, 0, 0, frame.texture.key, frame.name);
  // Re-apply so the frame's custom pivot becomes the origin.
  img.setFrame(frame);
  layer.add(img);
  return img;
}
