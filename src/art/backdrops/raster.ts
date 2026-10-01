/** Rasterise a backdrop layer into a canvas at its stated scale (browser only). */
import type { BackdropLayerSpec } from '../types';

/**
 * Returns a canvas of ceil(w * scale) x ceil(h * scale) pixels holding the
 * layer. `scale` defaults to the layer's own raster scale; pass a smaller one
 * for thumbnails.
 */
export function rasteriseBackdropLayer(layer: BackdropLayerSpec & { scale: number }, scale: number = layer.scale): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(layer.w * scale);
  canvas.height = Math.ceil(layer.h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`no 2D context for backdrop layer ${layer.key}`);
  ctx.scale(scale, scale);
  layer.draw(ctx);
  return canvas;
}
