/**
 * A Scene is one theatre resolved for one time of day: the graded sky, the
 * haze colour and a `tone` function every painter uses to turn a palette
 * colour into the CSS colour it has at a given distance.
 */
import type { TheatreId, TimeOfDay } from '../../data/schema';
import { THEATRES, TIME_GRADES, type TheatreDef, type TheatrePalette, type TheatreVariant, type TimeGradeDef } from '../../data/theatres';
import { gradeRgb, hexToRgb, mixRgb, rgbToCss, type Rgb } from './color';
import type { Rng } from './rng';

/** Haze never swallows a colour completely, whatever the time-of-day boost. */
const MAX_HAZE = 0.9;

export interface Scene {
  /** The theatre as painted: for the winter variant, with its winter palette, cloud cover, ground and foreground. */
  def: TheatreDef;
  /** The winter variant: painters lay snow on roofs, trees and ridges. */
  winter: boolean;
  pal: TheatrePalette;
  time: TimeOfDay;
  grade: TimeGradeDef;
  seed: number;
  sky: { top: Rgb; mid: Rgb; horizon: Rgb };
  /** What distant things fade toward at this time of day. */
  haze: Rgb;
  /** -1 = lit from the left, 1 = lit from the right. */
  light: -1 | 1;
  /** Graded palette colour mixed toward the haze by `haze` (0..1), as a CSS colour. */
  tone(hex: string, haze?: number, alpha?: number): string;
  /** Same, as channels. */
  rgb(hex: string, haze?: number): Rgb;
  /** The haze colour as CSS. */
  hazeCss(alpha?: number): string;
}

/** What a strip painter is given: tile width, vertical extent in view space, and the strip's haze. */
export interface LayerBox {
  w: number;
  top: number;
  bottom: number;
  haze: number;
}

/** Paints one backdrop strip. The context is already translated so y is view-space. */
export type LayerPainter = (ctx: CanvasRenderingContext2D, sc: Scene, rng: Rng, box: LayerBox) => void;

export interface TheatreArt {
  far: LayerPainter;
  mid: LayerPainter;
  near: LayerPainter;
}

/** A theatre resolved for its variant: the winter palette and the rest merged over the theatre's own. */
export function variantDef(theatre: TheatreId, variant: TheatreVariant): TheatreDef {
  const def = THEATRES[theatre];
  const w = def.winter;
  if (variant !== 'winter' || w === undefined) return def;
  return {
    ...def,
    palette: { ...def.palette, ...w.palette },
    cloudCover: w.cloudCover ?? def.cloudCover,
    groundStyle: w.groundStyle ?? def.groundStyle,
    foreground: w.foreground ?? def.foreground,
  };
}

export function makeScene(theatre: TheatreId, time: TimeOfDay, seed: number, variant: TheatreVariant = 'base'): Scene {
  const def = variantDef(theatre, variant);
  const winter = def !== THEATRES[theatre];
  const pal = def.palette;
  const grade = TIME_GRADES[time];

  const own = {
    top: gradeRgb(hexToRgb(pal.sky.top), grade),
    mid: gradeRgb(hexToRgb(pal.sky.mid), grade),
    horizon: gradeRgb(hexToRgb(pal.sky.horizon), grade),
  };
  const shared = grade.sky;
  const sky =
    shared === null
      ? own
      : {
          top: mixRgb(hexToRgb(shared.top), own.top, grade.skyKeep),
          mid: mixRgb(hexToRgb(shared.mid), own.mid, grade.skyKeep),
          horizon: mixRgb(hexToRgb(shared.horizon), own.horizon, grade.skyKeep),
        };

  const skyLow = mixRgb(sky.horizon, sky.mid, 0.35);
  const haze = mixRgb(gradeRgb(hexToRgb(pal.haze), grade), skyLow, grade.hazeSky);

  const cache = new Map<string, string>();

  const rgb = (hex: string, amount = 0): Rgb => {
    const graded = gradeRgb(hexToRgb(hex), grade);
    if (amount <= 0) return graded;
    return mixRgb(graded, haze, Math.min(MAX_HAZE, amount * (1 + grade.hazeBoost)));
  };

  const tone = (hex: string, amount = 0, alpha = 1): string => {
    const key = `${hex}|${amount.toFixed(3)}|${alpha.toFixed(3)}`;
    let css = cache.get(key);
    if (css === undefined) {
      css = rgbToCss(rgb(hex, amount), alpha);
      cache.set(key, css);
    }
    return css;
  };

  return {
    def,
    winter,
    pal,
    time,
    grade,
    seed,
    sky,
    haze,
    light: grade.light,
    tone,
    rgb,
    hazeCss: (alpha = 1) => rgbToCss(haze, alpha),
  };
}
