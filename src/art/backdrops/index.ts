/**
 * Parallax backdrops for the seven theatres.
 *
 * getBackdrop(theatre, timeOfDay, seed) returns one layer per slot, back to
 * front: sky, celestial, clouds, far, mid and near backdrop strips, the ground
 * plane and a sparse foreground strip. Each layer is a BackdropLayerSpec plus
 * the raster scale, parallax factor and depth the renderer should use.
 *
 * How to place a layer for a camera whose left edge is at world x = camX:
 *   tiling strips:  repeat the tile along x, shifted left by (camX * parallax) mod w
 *   the sun/moon:   left edge at layer.x - camX * parallax
 * and always top edge at layer.y.
 */
import type { TheatreId, TimeOfDay } from '../../data/schema';
import { BACKDROP, THEATRES, TIME_GRADES, type BackdropStripDef, type RainGrade } from '../../data/theatres';
import { DEPTH, PARALLAX, VIEW } from '../../data/view';
import type { BackdropLayerSpec } from '../types';
import { rgbToHex, rgbToInt } from './color';
import { paintForeground } from './foreground';
import { paintGround } from './ground';
import { mistBand } from './kit';
import { mulberry32, subSeed } from './rng';
import { makeScene, type LayerPainter, type Scene, type TheatreArt } from './scene';
import { paintCelestial, paintClouds, paintSky } from './sky';
import { desert } from './theatres/desert';
import { france } from './theatres/france';
import { germany } from './theatres/germany';
import { holland } from './theatres/holland';
import { italy } from './theatres/italy';
import { normandy } from './theatres/normandy';
import { sicily } from './theatres/sicily';

export type BackdropSlot = BackdropLayerSpec['slot'];

/** A backdrop layer with everything the renderer needs to rasterise and place it. */
export interface BackdropLayer extends BackdropLayerSpec {
  /** Texture pixels per wu to rasterise at (far layers 1, ground 2). */
  scale: number;
  /** Scroll factor, equal to PARALLAX[slot]. */
  parallax: number;
  /** Draw depth, equal to DEPTH[slot]. */
  depth: number;
  /** View-space x of the left edge when the camera is at x = 0. Always 0 for tiling strips. */
  x: number;
}

/** Slots in draw order, back to front. getBackdrop returns exactly one layer for each, in this order. */
export const BACKDROP_SLOTS: readonly BackdropSlot[] = [
  'sky',
  'celestial',
  'clouds',
  'farBackdrop',
  'midBackdrop',
  'nearBackdrop',
  'ground',
  'foreground',
];

const ART: Record<TheatreId, TheatreArt> = { france, desert, sicily, italy, normandy, holland, germany };

type Painter = (ctx: CanvasRenderingContext2D) => void;

function layer(theatre: TheatreId, time: TimeOfDay, slot: BackdropSlot, w: number, h: number, x: number, y: number, tile: boolean, paint: Painter): BackdropLayer {
  return {
    key: `bg/${theatre}/${time}/${slot}`,
    slot,
    w,
    h,
    x,
    y,
    tile,
    scale: BACKDROP.rasterScale[slot],
    parallax: PARALLAX[slot],
    depth: DEPTH[slot],
    draw(ctx) {
      ctx.save();
      // Painters work in view-space y; the texture's origin is the layer's top-left corner.
      ctx.translate(0, -y);
      paint(ctx);
      ctx.restore();
    },
  };
}

function strip(sc: Scene, theatre: TheatreId, slot: 'farBackdrop' | 'midBackdrop' | 'nearBackdrop', def: BackdropStripDef, painter: LayerPainter): BackdropLayer {
  const w = BACKDROP.tileW[slot];
  const bottom = BACKDROP.stripBottom;
  return layer(theatre, sc.time, slot, w, bottom - def.top, 0, def.top, true, (ctx) => {
    painter(ctx, sc, mulberry32(subSeed(sc.seed, `${theatre}/${slot}`)), { w, top: def.top, bottom, haze: def.haze });
    mistBand(ctx, w, bottom - def.mistHeight, bottom, sc.hazeCss, def.mist);
  });
}

/**
 * Every backdrop layer for a battle, back to front, one per slot.
 * Deterministic: the same arguments always paint the same pictures.
 */
export function getBackdrop(theatre: TheatreId, timeOfDay: TimeOfDay, seed: number): BackdropLayer[] {
  const sc = makeScene(theatre, timeOfDay, seed);
  const art = ART[theatre];
  const def = sc.def;
  const stream = (name: string) => mulberry32(subSeed(seed, `${theatre}/${name}`));
  const cel = sc.grade.celestial;
  const cs = BACKDROP.celestialSize;
  const skyW = BACKDROP.tileW.sky;
  const cloudW = BACKDROP.tileW.clouds;
  const groundW = BACKDROP.tileW.ground;
  const fgW = BACKDROP.tileW.foreground;

  return [
    layer(theatre, timeOfDay, 'sky', skyW, BACKDROP.stripBottom, 0, 0, true, (ctx) => {
      paintSky(ctx, sc, stream('sky'), skyW, BACKDROP.stripBottom);
    }),
    layer(theatre, timeOfDay, 'celestial', cs, cs, cel.x - cs / 2, cel.y - cs / 2, false, (ctx) => {
      ctx.translate(0, cel.y - cs / 2);
      paintCelestial(ctx, sc, cs);
    }),
    layer(theatre, timeOfDay, 'clouds', cloudW, BACKDROP.cloudsHeight, 0, 0, true, (ctx) => {
      paintClouds(ctx, sc, stream('clouds'), cloudW, BACKDROP.cloudsHeight);
    }),
    strip(sc, theatre, 'farBackdrop', def.layers.far, art.far),
    strip(sc, theatre, 'midBackdrop', def.layers.mid, art.mid),
    strip(sc, theatre, 'nearBackdrop', def.layers.near, art.near),
    layer(theatre, timeOfDay, 'ground', groundW, VIEW.heightWu - BACKDROP.groundTop, 0, BACKDROP.groundTop, true, (ctx) => {
      paintGround(ctx, sc, stream('ground'), groundW);
    }),
    layer(theatre, timeOfDay, 'foreground', fgW, VIEW.heightWu - BACKDROP.foregroundTop, 0, BACKDROP.foregroundTop, true, (ctx) => {
      paintForeground(ctx, sc, stream('foreground'), fgW);
    }),
  ];
}

/** Colours the renderer needs outside the backdrop itself, graded for the time of day. */
export interface TheatreColours {
  /** Ground surface under the units, for patching the ground around cut-outs. CSS hex. */
  ground: string;
  groundDark: string;
  /** Trench walls and floor. */
  soil: string;
  soilDark: string;
  /** Dust kicked up by feet, tracks and shell bursts. */
  dust: string;
  /** Sky at the horizon: fog, smoke and distance fades look right tinted toward it. */
  haze: string;
  /** The same colours as 0xRRGGBB numbers for Phaser tints. */
  int: { ground: number; groundDark: number; soil: number; soilDark: number; dust: number; haze: number; nightTint: number };
  /** Full-screen overlay colour for DEPTH.nightTint and the alpha suggested for this time of day. */
  nightTint: string;
  nightTintAlpha: number;
  /** How much to darken and desaturate the scene while it rains. */
  rain: RainGrade;
}

export function getTheatreColours(theatre: TheatreId, timeOfDay: TimeOfDay): TheatreColours {
  const sc = makeScene(theatre, timeOfDay, 0);
  const P = sc.pal;
  const ground = sc.rgb(P.ground);
  const groundDark = sc.rgb(P.groundDark);
  const soil = sc.rgb(P.soil);
  const soilDark = sc.rgb(P.soilDark);
  const dust = sc.rgb(P.dust);
  const tint = THEATRES[theatre].nightTint;
  return {
    ground: rgbToHex(ground),
    groundDark: rgbToHex(groundDark),
    soil: rgbToHex(soil),
    soilDark: rgbToHex(soilDark),
    dust: rgbToHex(dust),
    haze: rgbToHex(sc.haze),
    int: {
      ground: rgbToInt(ground),
      groundDark: rgbToInt(groundDark),
      soil: rgbToInt(soil),
      soilDark: rgbToInt(soilDark),
      dust: rgbToInt(dust),
      haze: rgbToInt(sc.haze),
      nightTint: parseInt(tint.slice(1), 16),
    },
    nightTint: tint,
    nightTintAlpha: TIME_GRADES[timeOfDay].tintAlpha,
    rain: THEATRES[theatre].rain,
  };
}

/** Texture pixels a set of layers needs once rasterised at their stated scales. */
export function backdropRasterArea(layers: readonly BackdropLayer[]): number {
  let px = 0;
  for (const l of layers) px += Math.ceil(l.w * l.scale) * Math.ceil(l.h * l.scale);
  return px;
}

/**
 * Screen-space x (wu) of a layer's left edge for a camera whose left edge is
 * at world x = camX. For tiling strips the result is in (-w, 0]: draw the tile
 * there and repeat it to the right until the view is covered.
 */
export function backdropLayerX(l: BackdropLayer, camX: number): number {
  const shift = camX * l.parallax;
  if (!l.tile) return l.x - shift;
  const m = ((shift % l.w) + l.w) % l.w;
  return m === 0 ? 0 : -m;
}

export { rasteriseBackdropLayer } from './raster';
