/**
 * Preview page for the parallax backdrops: composites every layer the way the
 * renderer will (tile strips shifted by camX * parallax), with placeholder
 * stick figures on the ground band for scale. See art-backdrops.html for the
 * query parameters.
 */
import {
  backdropLayerX,
  backdropRasterArea,
  getBackdrop,
  getTheatreColours,
  rasteriseBackdropLayer,
  type BackdropLayer,
} from '../src/art/backdrops';
import type { TheatreId, TimeOfDay } from '../src/data/schema';
import { THEATRE_IDS, TIMES_OF_DAY } from '../src/data/theatres';
import { VIEW } from '../src/data/view';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: unknown;
  }
}

interface Options {
  camX: number;
  seed: number;
  hud: boolean;
  seams: boolean;
  rain: boolean;
  tint: boolean;
  figures: boolean;
  only: string | null;
  zoom: number;
  ox: number;
  oy: number;
}

interface Raster {
  layer: BackdropLayer;
  canvas: HTMLCanvasElement;
}

/** Rough share of the view the HUD covers, top and bottom, in wu. */
const HUD_TOP = 48;
const HUD_BOTTOM = 90;
const FIGURE_PITCH = 150;

function rasterise(layers: BackdropLayer[], scaleMul: number): Raster[] {
  return layers.map((layer) => ({ layer, canvas: rasteriseBackdropLayer(layer, layer.scale * scaleMul) }));
}

/** Placeholder soldier: black, 58 wu tall at scale 1, feet at (x, y). */
function stickFigure(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, facing: number, pose: number): void {
  const h = VIEW.figureHeight * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.strokeStyle = '#0c0c0c';
  ctx.fillStyle = '#0c0c0c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.3 * s;
  const hip = -h * 0.44;
  const neck = -h * 0.8;
  const stride = pose === 0 ? 0.1 : 0.2;
  ctx.beginPath();
  // Legs.
  ctx.moveTo(-h * stride, 0);
  ctx.lineTo(-h * 0.03, hip * 0.5);
  ctx.lineTo(0, hip);
  ctx.lineTo(h * (stride + 0.04), hip * 0.48);
  ctx.lineTo(h * stride, 0);
  // Spine.
  ctx.moveTo(0, hip);
  ctx.lineTo(h * 0.04, neck);
  // Arms on a rifle.
  ctx.moveTo(h * 0.04, neck + h * 0.04);
  ctx.lineTo(h * 0.14, neck + h * 0.2);
  ctx.lineTo(h * 0.3, neck + h * 0.14);
  ctx.stroke();
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(-h * 0.02, neck + h * 0.24);
  ctx.lineTo(h * 0.52, neck + h * 0.08);
  ctx.stroke();
  // Head and tin hat.
  ctx.beginPath();
  ctx.arc(h * 0.05, -h * 0.9, h * 0.095, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(h * 0.05, -h * 0.95, h * 0.16, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFigures(ctx: CanvasRenderingContext2D, camX: number, viewW: number): void {
  const first = Math.floor(camX / FIGURE_PITCH) - 1;
  const last = Math.ceil((camX + viewW) / FIGURE_PITCH) + 1;
  for (let row = 0; row < VIEW.rows; row++) {
    for (let i = first; i <= last; i++) {
      if (((i % VIEW.rows) + VIEW.rows) % VIEW.rows !== row) continue;
      // A deterministic scatter: a loose skirmish line with a few gaps.
      const jitter = ((i * 73) % 41) - 20;
      if (((i * 31) % 7 + 7) % 7 === 0) continue;
      const x = i * FIGURE_PITCH + jitter - camX;
      stickFigure(ctx, x, VIEW.groundY + VIEW.rowDy[row], VIEW.rowScale[row], i % 5 === 0 ? -1 : 1, i % 2);
    }
  }
}

/**
 * Composite a set of rasterised layers into a wu-space rectangle of the
 * canvas. `px` = device pixels per wu. Tiles are snapped to device pixels so
 * the preview shows only real seams, not resampling hairlines.
 */
function composite(
  ctx: CanvasRenderingContext2D,
  rasters: Raster[],
  theatre: TheatreId,
  time: TimeOfDay,
  left: number,
  top: number,
  widthPx: number,
  heightPx: number,
  px: number,
  o: Options,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, widthPx, heightPx);
  ctx.clip();
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(left, top, widthPx, heightPx);
  const viewW = widthPx / px + o.ox;
  const toX = (wu: number): number => left + Math.round((wu - o.ox) * px);
  const toY = (wu: number): number => top + Math.round((wu - o.oy) * px);

  const figures = (): void => {
    if (!o.figures) return;
    ctx.save();
    ctx.translate(left - o.ox * px, top - o.oy * px);
    ctx.scale(px, px);
    drawFigures(ctx, o.camX, viewW);
    ctx.restore();
  };

  for (const { layer, canvas } of rasters) {
    if (layer.slot === 'foreground') figures();
    if (o.only !== null && o.only !== layer.slot) continue;
    const x0 = backdropLayerX(layer, o.camX);
    const y0 = toY(layer.y);
    const y1 = toY(layer.y + layer.h);
    if (layer.tile) {
      for (let x = x0; x < viewW; x += layer.w) {
        const a = toX(x);
        const b = toX(x + layer.w);
        ctx.drawImage(canvas, a, y0, b - a, y1 - y0);
      }
    } else {
      const a = toX(x0);
      const b = toX(x0 + layer.w);
      ctx.drawImage(canvas, a, y0, b - a, y1 - y0);
    }
  }

  const colours = getTheatreColours(theatre, time);
  if (o.rain) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = colours.rain.desaturate;
    ctx.fillStyle = '#808080';
    ctx.fillRect(left, top, widthPx, heightPx);
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${colours.rain.darken})`;
    ctx.fillRect(left, top, widthPx, heightPx);
  }
  if (o.tint && colours.nightTintAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = colours.nightTintAlpha;
    ctx.fillStyle = colours.nightTint;
    ctx.fillRect(left, top, widthPx, heightPx);
    ctx.restore();
  }
  if (o.seams) {
    ctx.lineWidth = 2;
    for (const { layer } of rasters) {
      if (!layer.tile) continue;
      ctx.strokeStyle = layer.slot === 'ground' || layer.slot === 'foreground' ? '#ff2a2a' : '#ffe14a';
      for (let x = backdropLayerX(layer, o.camX); x < viewW; x += layer.w) {
        const a = toX(x);
        ctx.beginPath();
        ctx.moveTo(a, toY(layer.y) - 8);
        ctx.lineTo(a, toY(layer.y) + 10);
        ctx.stroke();
      }
    }
  }
  if (o.hud) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(left, toY(0), widthPx, toY(HUD_TOP) - toY(0));
    ctx.fillRect(left, toY(VIEW.heightWu - HUD_BOTTOM), widthPx, toY(VIEW.heightWu) - toY(VIEW.heightWu - HUD_BOTTOM));
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, ctx.measureText(text).width + size, size * 1.5);
  ctx.fillStyle = '#f2efe2';
  ctx.fillText(text, x + size / 2, y + size * 0.25);
}

function isTheatre(v: string | null): v is TheatreId {
  return v !== null && (THEATRE_IDS as readonly string[]).includes(v);
}

function isTime(v: string | null): v is TimeOfDay {
  return v !== null && (TIMES_OF_DAY as readonly string[]).includes(v);
}

function main(): void {
  const q = new URLSearchParams(location.search);
  const num = (name: string, fallback: number): number => {
    const v = q.get(name);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const flag = (name: string, fallback: boolean): boolean => {
    const v = q.get(name);
    return v === null ? fallback : v !== '0';
  };
  const qTheatre = q.get('theatre');
  const qTime = q.get('time');
  const theatre: TheatreId = isTheatre(qTheatre) ? qTheatre : 'france';
  const time: TimeOfDay = isTime(qTime) ? qTime : 'day';
  const o: Options = {
    camX: num('camX', 0),
    seed: num('seed', 1),
    hud: flag('hud', false),
    seams: flag('seams', false),
    rain: flag('rain', false),
    tint: flag('tint', true),
    figures: flag('figures', true),
    only: q.get('only'),
    zoom: num('zoom', 1),
    ox: num('ox', 0),
    oy: num('oy', 0),
  };

  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D context');
  ctx.fillStyle = '#15160f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sheet = q.get('sheet');
  const stats: Record<string, unknown> = {};

  if (sheet !== null && sheet !== '0') {
    // Thumbnails: seven theatres plus two time-of-day variants, or one theatre at all five times.
    const cells: { theatre: TheatreId; time: TimeOfDay }[] =
      sheet === 'times'
        ? TIMES_OF_DAY.map((t) => ({ theatre, time: t }))
        : [
            ...THEATRE_IDS.map((t) => ({ theatre: t, time })),
            { theatre: 'sicily' as TheatreId, time: 'dusk' as TimeOfDay },
            { theatre: 'holland' as TheatreId, time: 'night' as TimeOfDay },
          ];
    const cols = 3;
    const rows = Math.ceil(cells.length / cols);
    const gap = Math.round(3 * dpr);
    const cw = Math.floor((canvas.width - gap * (cols + 1)) / cols);
    const ch = Math.floor((canvas.height - gap * (rows + 1)) / rows);
    cells.forEach((cell, i) => {
      const layers = getBackdrop(cell.theatre, cell.time, o.seed);
      const px = ch / VIEW.heightWu;
      const rasters = rasterise(layers, Math.min(1, (px * 1.2) / 1));
      const left = gap + (i % cols) * (cw + gap);
      const top = gap + Math.floor(i / cols) * (ch + gap);
      composite(ctx, rasters, cell.theatre, cell.time, left, top, cw, ch, px, { ...o, zoom: 1, ox: 0, oy: 0 });
      label(ctx, `${cell.theatre} / ${cell.time}`, left + gap, top + gap, Math.round(9 * dpr));
    });
  } else {
    const t0 = performance.now();
    const layers = getBackdrop(theatre, time, o.seed);
    const timings: Record<string, number> = {};
    const rasters: Raster[] = layers.map((layer) => {
      const s = performance.now();
      const c = rasteriseBackdropLayer(layer);
      timings[layer.slot] = Math.round(performance.now() - s);
      return { layer, canvas: c };
    });
    stats.megapixels = Number((backdropRasterArea(layers) / 1e6).toFixed(2));
    stats.paintMs = timings;
    stats.totalMs = Math.round(performance.now() - t0);
    stats.layers = layers.map((l) => `${l.key} ${l.w}x${l.h}@${l.scale} y=${l.y} tile=${l.tile}`);
    const px = (canvas.height / VIEW.heightWu) * o.zoom;
    composite(ctx, rasters, theatre, time, 0, 0, canvas.width, canvas.height, px, o);
    if (flag('info', false)) {
      label(ctx, `${theatre} / ${time}  camX ${o.camX}  ${String(stats.megapixels)} MP  ${String(stats.totalMs)} ms`, 8 * dpr, 8 * dpr, Math.round(10 * dpr));
    }
  }

  window.__stats = stats;
  window.__ready = true;
}

main();
