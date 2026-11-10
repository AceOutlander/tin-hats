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
  // A CPU-backed canvas: drawn once and uploaded once as a texture, which a GPU canvas makes the browser read back
  // first (seconds at a battle start under a software GPU; DECISIONS 406).
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error(`no 2D context for backdrop layer ${layer.key}`);
  ctx.scale(scale, scale);
  layer.draw(ctx);
  return canvas;
}
