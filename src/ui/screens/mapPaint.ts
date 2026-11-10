/**
 * Draws a campaign's situation map into a canvas: an aged map with coastal waterlines, a graticule, rivers and
 * marshes, the front line of the selected mission's date (with the earlier ones faint behind it), lettering, a compass
 * rose and the campaign route. The mission pins themselves are DOM buttons laid over this canvas.
 */
import { CAMPAIGN_MAP_VIEW, frontOn, projection, type CampaignMapDef, type MapFront, type MapProjection, type MapShape } from '../../data/campaignMap';
import { STALINGRAD_MAP } from '../../data/campaignMapStalingrad';
import { clearLabels, labelBounds, type LabelBox, type Obstacle } from './mapLayout';

/**
 * The room a mission pin takes on the map (CSS px around its centre): the 30 px disc and its selection ring, and
 * the three pips under it. Lettering keeps `pad` clear of this and is moved at most `maxShift`, in `step` px tries.
 */
const PIN_FOOTPRINT = { halfW: 22, up: 21, down: 27, pad: 3, maxShift: CAMPAIGN_MAP_VIEW.labelMaxShiftPx, step: 4 } as const;

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
/** The enemy's front line and the ground behind it (map blue, as the period's Soviet and British maps drew it). */
const FRONT = 'rgba(36, 54, 86, 0.9)';
const FRONT_OLD = 'rgba(36, 54, 86, 0.32)';
const RIVER = 'rgba(58, 96, 110, 0.85)';

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

function ringPath(shapes: readonly MapShape[], w: number, h: number, proj: MapProjection): Path2D {
  const path = new Path2D();
  for (const shape of shapes) {
    const pts = shape.pts;
    for (let i = 0; i < pts.length; i += 2) {
      const x = proj.x(pts[i]) * w;
      const y = proj.y(pts[i + 1]) * h;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
  }
  return path;
}

function linePath(pts: readonly number[], w: number, h: number, proj: MapProjection): Path2D {
  const path = new Path2D();
  for (let i = 0; i < pts.length; i += 2) {
    const x = proj.x(pts[i]) * w;
    const y = proj.y(pts[i + 1]) * h;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/** A front line closed round the map's west edge: the enemy's side of it. */
function heldPath(pts: readonly number[], w: number, h: number, proj: MapProjection): Path2D {
  const path = linePath(pts, w, h, proj);
  const west = proj.x(proj.bounds.lonMin) * w - 50;
  path.lineTo(west, proj.y(pts[pts.length - 1]) * h);
  path.lineTo(west, proj.y(pts[1]) * h);
  path.closePath();
  return path;
}

/** A small tile of diagonal hatching, for the ground the enemy holds. */
function hatch(ctx: CanvasRenderingContext2D, u: number, color: string, horizontal = false): CanvasPattern | null {
  const size = Math.max(4, Math.round(7 * u));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.strokeStyle = color;
  t.lineWidth = Math.max(0.6, 0.8 * u);
  t.beginPath();
  if (horizontal) {
    // Marsh: short broken strokes.
    t.moveTo(size * 0.1, size * 0.3);
    t.lineTo(size * 0.55, size * 0.3);
    t.moveTo(size * 0.5, size * 0.8);
    t.lineTo(size * 0.95, size * 0.8);
  } else {
    t.moveTo(0, size);
    t.lineTo(size, 0);
  }
  t.stroke();
  return ctx.createPattern(tile, 'repeat');
}

/** Width of `text` set with `spacing` between its letters, in the context's current font. */
function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  return total - spacing;
}

function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, angleDeg: number): void {
  const total = spacedWidth(ctx, text, spacing);
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

function cartouche(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, display: string, type: string, map: CampaignMapDef, front: MapFront | null): void {
  const w = 150 * u;
  const h = (front ? 57 : 46) * u;
  ctx.save();
  ctx.translate(cx, cy);
  // A little more opaque over a hatched front, so the legend reads.
  ctx.fillStyle = front ? 'rgba(233, 223, 195, 0.8)' : 'rgba(233, 223, 195, 0.55)';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(74, 63, 40, 0.7)';
  ctx.lineWidth = 1.4 * u;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 0.6 * u;
  ctx.strokeRect(-w / 2 + 3 * u, -h / 2 + 3 * u, w - 6 * u, h - 6 * u);
  const top = -h / 2;
  ctx.fillStyle = 'rgba(58, 48, 28, 0.85)';
  ctx.font = `700 ${12 * u}px ${display}`;
  spacedText(ctx, map.cartouche.title, 0, top + 14 * u, 2.2 * u, 0);
  ctx.font = `${7.2 * u}px ${type}`;
  spacedText(ctx, map.cartouche.region, 0, top + 27.5 * u, 0.4 * u, 0);
  spacedText(ctx, map.cartouche.dates, 0, top + 37 * u, 0.6 * u, 0);
  if (front) {
    // The legend: the enemy's line and the date it is drawn for.
    const y = top + 48 * u;
    ctx.strokeStyle = FRONT;
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.moveTo(-60 * u, y);
    ctx.lineTo(-44 * u, y);
    ctx.stroke();
    ctx.fillStyle = FRONT;
    for (let x = -58; x < -44; x += 5) {
      ctx.beginPath();
      ctx.moveTo((x - 1.6) * u, y);
      ctx.lineTo(x * u, y - 3 * u);
      ctx.lineTo((x + 1.6) * u, y);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(58, 48, 28, 0.85)';
    ctx.font = `${6.6 * u}px ${type}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Front, ${front.label}`, -40 * u, y);
  }
  ctx.restore();
}

/** The enemy's front: the ground behind it hatched, the line itself with small teeth facing our side. */
function paintFront(ctx: CanvasRenderingContext2D, front: MapFront, w: number, h: number, u: number, proj: MapProjection): void {
  const hatching = hatch(ctx, u, 'rgba(36, 54, 86, 0.2)');
  for (const line of front.lines) {
    const held = heldPath(line, w, h, proj);
    ctx.fillStyle = 'rgba(52, 72, 104, 0.1)';
    ctx.fill(held);
    if (hatching) {
      ctx.fillStyle = hatching;
      ctx.fill(held);
    }
  }
  for (const pocket of front.pockets ?? []) {
    const ring = ringPath([{ name: 'pocket', pts: pocket }], w, h, proj);
    ctx.fillStyle = 'rgba(52, 72, 104, 0.16)';
    ctx.fill(ring);
    if (hatching) {
      ctx.fillStyle = hatching;
      ctx.fill(ring);
    }
    // Our ring round it.
    ctx.strokeStyle = 'rgba(156, 43, 31, 0.85)';
    ctx.lineWidth = 2.6 * u;
    ctx.stroke(ring);
    ctx.strokeStyle = FRONT;
    ctx.lineWidth = 1.1 * u;
    ctx.stroke(ring);
  }
  ctx.strokeStyle = FRONT;
  ctx.fillStyle = FRONT;
  ctx.lineWidth = 1.9 * u;
  for (const line of front.lines) {
    ctx.stroke(linePath(line, w, h, proj));
    // Teeth every few px along the line, on its left as it runs south: toward our side.
    const spacing = 9 * u;
    let carry = spacing / 2;
    for (let i = 2; i < line.length; i += 2) {
      const ax = proj.x(line[i - 2]) * w;
      const ay = proj.y(line[i - 1]) * h;
      const bx = proj.x(line[i]) * w;
      const by = proj.y(line[i + 1]) * h;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.01) continue;
      const dx = (bx - ax) / len;
      const dy = (by - ay) / len;
      let t = carry;
      for (; t < len; t += spacing) {
        const px = ax + dx * t;
        const py = ay + dy * t;
        ctx.beginPath();
        ctx.moveTo(px - dx * 1.8 * u, py - dy * 1.8 * u);
        ctx.lineTo(px + dy * 3.2 * u, py - dx * 3.2 * u);
        ctx.lineTo(px + dx * 1.8 * u, py + dy * 1.8 * u);
        ctx.closePath();
        ctx.fill();
      }
      carry = t - len;
    }
  }
}

/**
 * Paint the whole map. `cssW` and `cssH` are the map's size in CSS px; the backing store is scaled by the device pixel
 * ratio (capped). `dateIso` picks the front line drawn (the selected mission's date); a map without fronts ignores it.
 */
export function paintCampaignMap(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  pins: readonly MapPin[],
  map: CampaignMapDef = STALINGRAD_MAP,
  dateIso?: string,
): Obstacle[] {
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
  if (!ctx) return [];

  const proj = projection(map.bounds);
  const B = map.bounds;
  const styles = getComputedStyle(document.documentElement);
  const display = styles.getPropertyValue('--th-font-display').trim() || 'sans-serif';
  const type = styles.getPropertyValue('--th-font-type').trim() || 'monospace';
  const w = cssW;
  const h = cssH;
  /** Everything decorative scales with the map so it reads the same at any size. */
  const u = w / CAMPAIGN_MAP_VIEW.minWidthPx;
  const rnd = grain(map.grainSeed);
  const front = frontOn(map, dateIso);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Sea, slightly deeper toward the open water at the top left.
  const sea = ctx.createLinearGradient(0, 0, w, h);
  sea.addColorStop(0, SEA_DEEP);
  sea.addColorStop(0.45, SEA);
  sea.addColorStop(1, SEA);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);

  // Graticule.
  const step = CAMPAIGN_MAP_VIEW.graticuleStepDeg;
  const graticule = (): void => {
    ctx.beginPath();
    for (let lon = Math.ceil(B.lonMin / step) * step; lon <= B.lonMax; lon += step) {
      const x = Math.round(proj.x(lon) * w) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let lat = Math.ceil(B.latMin / step) * step; lat <= B.latMax; lat += step) {
      const y = Math.round(proj.y(lat) * h) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(58, 48, 28, 0.16)';
  ctx.lineWidth = 0.7 * u;
  graticule();

  // Coastal waterlines: wide soft strokes that the land fill then covers on its own side.
  const land = ringPath(map.land, w, h, proj);
  const water = ringPath(map.water, w, h, proj);
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
  if (map.rivers) {
    // A map whose land is the whole sheet: the seas get their waterlines inside, and the graticule runs over them.
    ctx.save();
    ctx.clip(water);
    for (const width of [17, 11, 5.5]) {
      ctx.strokeStyle = 'rgba(233, 240, 232, 0.2)';
      ctx.lineWidth = width * u;
      ctx.stroke(water);
    }
    ctx.strokeStyle = 'rgba(58, 48, 28, 0.16)';
    ctx.lineWidth = 0.7 * u;
    graticule();
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.05 * u;
  ctx.stroke(land);
  ctx.lineWidth = 0.7 * u;
  ctx.stroke(water);

  // Marshes: a green tint with broken strokes.
  if (map.marsh) {
    const marsh = ringPath(map.marsh, w, h, proj);
    ctx.fillStyle = 'rgba(110, 140, 105, 0.14)';
    ctx.fill(marsh);
    const reeds = hatch(ctx, u, 'rgba(60, 96, 84, 0.42)', true);
    if (reeds) {
      ctx.fillStyle = reeds;
      ctx.fill(marsh);
    }
  }

  // Rivers: a pale bank and the water line.
  for (const river of map.rivers ?? []) {
    const path = linePath(river.pts, w, h, proj);
    ctx.strokeStyle = 'rgba(240, 244, 236, 0.55)';
    ctx.lineWidth = (river.major ? 3.4 : 2.2) * u;
    ctx.stroke(path);
    ctx.strokeStyle = RIVER;
    ctx.lineWidth = (river.major ? 1.5 : 0.9) * u;
    ctx.stroke(path);
  }

  // The front lines: the earlier ones faint, the one of the selected mission's date bold.
  if (front && map.fronts) {
    ctx.strokeStyle = FRONT_OLD;
    ctx.lineWidth = 1 * u;
    ctx.setLineDash([4 * u, 3 * u]);
    for (const f of map.fronts) {
      if (f.date >= front.date) break;
      for (const line of f.lines) ctx.stroke(linePath(line, w, h, proj));
    }
    ctx.setLineDash([]);
    paintFront(ctx, front, w, h, u, proj);
  }

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

  // Town dots stay where the town is; only their names move.
  ctx.fillStyle = INK;
  for (const label of map.labels) {
    if (label.kind !== 'city') continue;
    ctx.beginPath();
    ctx.arc(proj.x(label.lon) * w, proj.y(label.lat) * h, 1.9 * u, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lettering. A label that a mission pin would sit on is moved to the nearest clear spot, so no name is hidden.
  const looks = map.labels.map((label) => {
    switch (label.kind) {
      case 'country':
        return { fill: 'rgba(74, 58, 30, 0.6)', size: 11.5 * u, font: `700 ${11.5 * u}px ${display}`, spacing: 3.4 * u };
      case 'region':
        return { fill: 'rgba(74, 58, 30, 0.5)', size: 7.6 * u, font: `700 ${7.6 * u}px ${display}`, spacing: 1.6 * u };
      case 'city':
        return { fill: 'rgba(52, 42, 24, 0.85)', size: 7.4 * u, font: `${7.4 * u}px ${type}`, spacing: 0.2 * u };
      case 'river':
        return { fill: 'rgba(40, 80, 95, 0.75)', size: 7.6 * u, font: `italic ${7.6 * u}px Georgia, 'Times New Roman', serif`, spacing: 1.8 * u };
      default:
        return { fill: 'rgba(40, 70, 78, 0.62)', size: 9.4 * u, font: `italic ${9.4 * u}px Georgia, 'Times New Roman', serif`, spacing: 2.6 * u };
    }
  });
  const boxes = map.labels.map((label, i): LabelBox => {
    ctx.font = looks[i].font;
    const hw = spacedWidth(ctx, label.text, looks[i].spacing) / 2;
    // A town's name sits just right of its dot.
    const dx = label.kind === 'city' ? hw + 4 * u : 0;
    return {
      x: proj.x(label.lon) * w + dx,
      y: proj.y(label.lat) * h,
      hw,
      hh: looks[i].size * 0.6,
      angle: ((label.angle ?? 0) * Math.PI) / 180,
    };
  });
  const footprints: Obstacle[] = pins.map((p) => ({
    x0: p.x - PIN_FOOTPRINT.halfW,
    y0: p.y - PIN_FOOTPRINT.up,
    x1: p.x + PIN_FOOTPRINT.halfW,
    y1: p.y + PIN_FOOTPRINT.down,
  }));
  // Every name stays inside the inner neatline, so none is cut off at the edge of the sheet.
  const sheet: Obstacle = { x0: 9 * u, y0: 9 * u, x1: w - 9 * u, y1: h - 9 * u };
  const shifts = clearLabels(boxes, footprints, PIN_FOOTPRINT.maxShift, PIN_FOOTPRINT.step, PIN_FOOTPRINT.pad, sheet);
  const placed = boxes.map((b, i) => labelBounds({ ...b, x: b.x + shifts[i].dx, y: b.y + shifts[i].dy }));
  map.labels.forEach((label, i) => {
    ctx.fillStyle = looks[i].fill;
    ctx.font = looks[i].font;
    spacedText(ctx, label.text, boxes[i].x + shifts[i].dx, boxes[i].y + shifts[i].dy, looks[i].spacing, label.angle ?? 0);
  });

  // Degree figures along the top and left edges.
  ctx.fillStyle = 'rgba(58, 48, 28, 0.5)';
  ctx.font = `${6.4 * u}px ${type}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let lon = Math.ceil(B.lonMin / step) * step; lon <= B.lonMax; lon += step) {
    const text = lon === 0 ? '0°' : `${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}`;
    ctx.fillText(text, proj.x(lon) * w + 2 * u, 5 * u);
  }
  for (let lat = Math.ceil(B.latMin / step) * step; lat <= B.latMax; lat += step) {
    ctx.fillText(`${lat}°N`, 5 * u, proj.y(lat) * h + 2 * u);
  }

  compassRose(ctx, proj.x(map.compass.lon) * w, proj.y(map.compass.lat) * h, 17 * u, display);
  cartouche(ctx, proj.x(map.cartouche.lon) * w, proj.y(map.cartouche.lat) * h, u, display, type, map, front);

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
  return placed;
}
