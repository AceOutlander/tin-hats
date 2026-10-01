/**
 * Draws the campaign map into a canvas: an aged situation map with coastal
 * waterlines, a graticule, lettering, a compass rose and the campaign route.
 * The mission pins themselves are DOM buttons laid over this canvas.
 */
import { CAMPAIGN_MAP_VIEW, MAP_BOUNDS, MAP_LABELS, MAP_LAND, MAP_WATER, mapX, mapY, type MapShape } from '../../data/campaignMap';

export type PinState = 'locked' | 'open' | 'cleared';

export interface MapPin {
  id: number;
  /** Where the pin button sits (map px). */
  x: number;
  y: number;
  /** The true location it points at (map px). */
  ax: number;
  ay: number;
  state: PinState;
}

const INK = '#4a3f28';
const SEA = '#a7bab4';
const SEA_DEEP = '#93aaa6';
const LAND = '#e5d9b6';
const LAND_SHADE = '#d6c89f';
const ROUTE = '#9c2b1f';

/** Small deterministic generator so the paper grain is identical on every repaint. */
function grain(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringPath(shapes: readonly MapShape[], w: number, h: number): Path2D {
  const path = new Path2D();
  for (const shape of shapes) {
    const pts = shape.pts;
    for (let i = 0; i < pts.length; i += 2) {
      const x = mapX(pts[i]) * w;
      const y = mapY(pts[i + 1]) * h;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
  }
  return path;
}

function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, angleDeg: number): void {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  ctx.save();
  ctx.translate(x, y);
  if (angleDeg !== 0) ctx.rotate((angleDeg * Math.PI) / 180);
  let cx = -total / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const ch of text) {
    ctx.fillText(ch, cx, 0);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.restore();
}

function compassRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, font: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(74, 63, 40, 0.55)';
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const long = i === 0 ? r : r * 0.8;
    ctx.rotate(i === 0 ? 0 : Math.PI / 2);
    ctx.fillStyle = 'rgba(74, 63, 40, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -long);
    ctx.lineTo(r * 0.16, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(233, 223, 195, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -long);
    ctx.lineTo(-r * 0.16, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(74, 63, 40, 0.8)';
  ctx.font = `700 ${Math.round(r * 0.5)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', cx, cy - r * 1.12);
}

function cartouche(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, display: string, type: string): void {
  const w = 150 * u;
  const h = 46 * u;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(233, 223, 195, 0.55)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(74, 63, 40, 0.7)';
  ctx.lineWidth = 1.4 * u;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 0.6 * u;
  ctx.strokeRect(-w / 2 + 3 * u, -h / 2 + 3 * u, w - 6 * u, h - 6 * u);
  ctx.fillStyle = 'rgba(58, 48, 28, 0.85)';
  ctx.font = `700 ${12 * u}px ${display}`;
  spacedText(ctx, 'SITUATION MAP', 0, -9 * u, 2.2 * u, 0);
  ctx.font = `${7.2 * u}px ${type}`;
  spacedText(ctx, 'W. EUROPE & N. AFRICA', 0, 4.5 * u, 0.4 * u, 0);
  spacedText(ctx, '1940 – 1945', 0, 14 * u, 0.6 * u, 0);
  ctx.restore();
}

/**
 * Paint the whole map. `cssW` and `cssH` are the map's size in CSS px; the
 * backing store is scaled by the device pixel ratio (capped).
 */
export function paintCampaignMap(canvas: HTMLCanvasElement, cssW: number, cssH: number, pins: readonly MapPin[]): void {
  const dpr = Math.min(CAMPAIGN_MAP_VIEW.maxPixelRatio, Math.max(1, window.devicePixelRatio || 1));
  const pw = Math.round(cssW * dpr);
  const ph = Math.round(cssH * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const display = styles.getPropertyValue('--th-font-display').trim() || 'sans-serif';
  const type = styles.getPropertyValue('--th-font-type').trim() || 'monospace';
  const w = cssW;
  const h = cssH;
  /** Everything decorative scales with the map so it reads the same at any size. */
  const u = w / CAMPAIGN_MAP_VIEW.minWidthPx;
  const rnd = grain(1940);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Sea, slightly deeper toward the open Atlantic.
  const sea = ctx.createLinearGradient(0, 0, w, h);
  sea.addColorStop(0, SEA_DEEP);
  sea.addColorStop(0.45, SEA);
  sea.addColorStop(1, SEA);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);

  // Graticule.
  const step = CAMPAIGN_MAP_VIEW.graticuleStepDeg;
  ctx.strokeStyle = 'rgba(58, 48, 28, 0.16)';
  ctx.lineWidth = 0.7 * u;
  ctx.beginPath();
  for (let lon = Math.ceil(MAP_BOUNDS.lonMin / step) * step; lon <= MAP_BOUNDS.lonMax; lon += step) {
    const x = Math.round(mapX(lon) * w) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let lat = Math.ceil(MAP_BOUNDS.latMin / step) * step; lat <= MAP_BOUNDS.latMax; lat += step) {
    const y = Math.round(mapY(lat) * h) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Coastal waterlines: wide soft strokes that the land fill then covers on its own side.
  const land = ringPath(MAP_LAND, w, h);
  const water = ringPath(MAP_WATER, w, h);
  for (const width of [17, 11, 5.5]) {
    ctx.strokeStyle = 'rgba(233, 240, 232, 0.2)';
    ctx.lineWidth = width * u;
    ctx.stroke(land);
  }
  ctx.fillStyle = LAND;
  ctx.fill(land);

  // Land tone: a little relief shading and paper grain, clipped to the land.
  ctx.save();
  ctx.clip(land);
  const shade = ctx.createLinearGradient(0, 0, w * 0.4, h);
  shade.addColorStop(0, 'rgba(214, 200, 159, 0)');
  shade.addColorStop(1, LAND_SHADE);
  ctx.fillStyle = shade;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(120, 100, 60, 0.22)';
  ctx.lineWidth = 5 * u;
  ctx.stroke(land);
  ctx.restore();

  ctx.fillStyle = SEA;
  ctx.fill(water);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.05 * u;
  ctx.stroke(land);
  ctx.lineWidth = 0.7 * u;
  ctx.stroke(water);

  // Paper grain and a few foxing spots over everything.
  const specks = Math.round((w * h) / 520);
  for (let i = 0; i < specks; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const dark = rnd() < 0.6;
    ctx.fillStyle = dark ? 'rgba(58, 48, 28, 0.07)' : 'rgba(255, 250, 232, 0.09)';
    const s = (0.6 + rnd() * 1.4) * u;
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = (14 + rnd() * 34) * u;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r);
    spot.addColorStop(0, 'rgba(140, 110, 60, 0.10)');
    spot.addColorStop(1, 'rgba(140, 110, 60, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fold creases.
  for (const frac of [1 / 3, 2 / 3]) {
    const x = Math.round(w * frac) + 0.5;
    ctx.strokeStyle = 'rgba(255, 250, 232, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 48, 28, 0.13)';
    ctx.beginPath();
    ctx.moveTo(x + 1, 0);
    ctx.lineTo(x + 1, h);
    ctx.stroke();
  }
  {
    const y = Math.round(h * 0.5) + 0.5;
    ctx.strokeStyle = 'rgba(255, 250, 232, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 48, 28, 0.13)';
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(w, y + 1);
    ctx.stroke();
  }

  // Lettering.
  for (const label of MAP_LABELS) {
    const x = mapX(label.lon) * w;
    const y = mapY(label.lat) * h;
    if (label.kind === 'country') {
      ctx.fillStyle = 'rgba(74, 58, 30, 0.6)';
      ctx.font = `700 ${11.5 * u}px ${display}`;
      spacedText(ctx, label.text, x, y, 3.4 * u, label.angle ?? 0);
    } else if (label.kind === 'region') {
      ctx.fillStyle = 'rgba(74, 58, 30, 0.5)';
      ctx.font = `700 ${7.6 * u}px ${display}`;
      spacedText(ctx, label.text, x, y, 1.6 * u, label.angle ?? 0);
    } else {
      ctx.fillStyle = 'rgba(40, 70, 78, 0.62)';
      ctx.font = `italic ${9.4 * u}px Georgia, 'Times New Roman', serif`;
      spacedText(ctx, label.text, x, y, 2.6 * u, label.angle ?? 0);
    }
  }

  // Degree figures along the top and left edges.
  ctx.fillStyle = 'rgba(58, 48, 28, 0.5)';
  ctx.font = `${6.4 * u}px ${type}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let lon = Math.ceil(MAP_BOUNDS.lonMin / step) * step; lon <= MAP_BOUNDS.lonMax; lon += step) {
    const text = lon === 0 ? '0°' : `${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`;
    ctx.fillText(text, mapX(lon) * w + 2 * u, 5 * u);
  }
  for (let lat = Math.ceil(MAP_BOUNDS.latMin / step) * step; lat <= MAP_BOUNDS.latMax; lat += step) {
    ctx.fillText(`${lat}°N`, 5 * u, mapY(lat) * h + 2 * u);
  }

  compassRose(ctx, mapX(-8.4) * w, mapY(49.6) * h, 17 * u, display);
  cartouche(ctx, mapX(0.4) * w, mapY(30.7) * h, u, display, type);

  // The route, in mission order: red where the next mission is open, faint where it is still locked.
  ctx.lineWidth = 2 * u;
  for (let i = 1; i < pins.length; i++) {
    const a = pins[i - 1];
    const b = pins[i];
    const open = b.state !== 'locked';
    ctx.strokeStyle = open ? ROUTE : 'rgba(58, 48, 28, 0.38)';
    ctx.setLineDash(open ? [7 * u, 5 * u] : [1.5 * u, 6 * u]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Leaders from displaced pins back to the real place.
  for (const pin of pins) {
    const dist = Math.hypot(pin.x - pin.ax, pin.y - pin.ay);
    ctx.fillStyle = pin.state === 'locked' ? 'rgba(58, 48, 28, 0.7)' : ROUTE;
    if (dist > 8 * u) {
      ctx.strokeStyle = 'rgba(40, 32, 18, 0.75)';
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.moveTo(pin.x, pin.y);
      ctx.lineTo(pin.ax, pin.ay);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(pin.ax, pin.ay, 2.8 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(233, 223, 195, 0.9)';
    ctx.lineWidth = 0.9 * u;
    ctx.stroke();
  }

  // Neatline and a soft vignette so the sheet looks handled.
  ctx.strokeStyle = 'rgba(58, 48, 28, 0.7)';
  ctx.lineWidth = 2 * u;
  ctx.strokeRect(3 * u, 3 * u, w - 6 * u, h - 6 * u);
  ctx.lineWidth = 0.7 * u;
  ctx.strokeRect(7 * u, 7 * u, w - 14 * u, h - 14 * u);
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(60, 44, 20, 0)');
  vignette.addColorStop(1, 'rgba(60, 44, 20, 0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
