/**
 * Art contract. All art in Tin Hats is drawn in code with the plain Canvas 2D
 * API, as pure functions that know nothing about Phaser. The Phaser renderer
 * rasterises SpriteSpecs into texture atlases at boot; the DOM UI can draw the
 * same specs into <canvas> elements for icons.
 */

/** One drawable piece. Sizes and drawing coordinates are in world units (wu). */
export interface SpriteSpec {
  /** Unique texture frame key, e.g. "fig/british/helmet" or "fx/muzzle/2". */
  key: string;
  /** Size in wu. The rasteriser scales the context, so draw() always works in wu. */
  w: number;
  h: number;
  /** Anchor (origin) as a 0..1 fraction of w and h: the point placed at the sprite's position. */
  ax: number;
  ay: number;
  /** Draw into a context whose origin is this sprite's top-left corner. Must not leave state changed. */
  draw(ctx: CanvasRenderingContext2D): void;
}

/** A wide backdrop strip that tiles horizontally. */
export interface BackdropLayerSpec {
  key: string;
  /** Which parallax slot it fills. */
  slot: 'sky' | 'celestial' | 'clouds' | 'farBackdrop' | 'midBackdrop' | 'nearBackdrop' | 'ground' | 'foreground';
  /** Tile size in wu. Height is at most the view height (540). */
  w: number;
  h: number;
  /** y of the tile's top edge in view space (0 = top of the screen). */
  y: number;
  /** True if the strip repeats along x; false for single objects such as the sun. */
  tile: boolean;
  draw(ctx: CanvasRenderingContext2D): void;
}
