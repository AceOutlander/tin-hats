/**
 * Preview page for structures, vehicles and props. Rasterises every SpriteSpec
 * the way the renderer will (textureScale x) and composites scenes on a ground
 * line with 58 wu stick silhouettes for scale. See art-structures.html for the
 * query parameters.
 */
import {
  AIR_LAYOUT,
  DAMAGE_STATES,
  FLAG_LAYOUT,
  HQ_LAYOUT,
  KV2_TURRET,
  PILLBOX_LAYOUT,
  SUPPLY_LAYOUT,
  TANK_LAYOUT,
  TRENCH_LAYOUT,
  WIRE_LAYOUT,
  type DamageState,
} from '../src/data/artLayout';
import { FACTION_IDS } from '../src/data/factions';
import type { FactionId } from '../src/data/schema';
import { VIEW } from '../src/data/view';
import { DECAL_KEYS, RUBBLE_KEYS, SUPPLY_KEYS, propSpecs } from '../src/art/props';
import { truckKey, truckSpecs } from '../src/art/props/supplyLooks';
import {
  FLAG_KEYS,
  TRENCH_KEYS,
  WIRE_KEYS,
  createTileSpan,
  createWirePieces,
  flagStripTint,
  flagWave,
  hqKey,
  pillboxKey,
  structureSpecs,
  tileSpan,
  wirePieceLayout,
} from '../src/art/structures';
import { AIR_KEYS, KATYUSHA_LAUNCHER_KEY, KV2_KEYS, TANK_KEYS, TANK_LOOKS, VEHICLE_LOOKS, aircraftLookKey, createTankPose, layoutTank, vehicleSpecs, type TankState } from '../src/art/vehicles';
import type { SpriteSpec } from '../src/art/types';
import { buildingKey, buildingSpecs, coverPropSpecs, propKey, windowXs, type BuildingPiece } from '../src/art/structures/buildings';
import { missionHqKey, missionHqSpecs } from '../src/art/structures/hqBuildings';
import { BUILDING_LAYOUT, MISSION_HQ_STYLES } from '../src/data/looksBuilding';
import type { BuildingLook, CoverPropLook } from '../src/data/schema';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: unknown;
  }
}

type Ctx = CanvasRenderingContext2D;
type Look = (typeof VEHICLE_LOOKS)[number];

const SCENE_W = 1200;
const STAGE_H = 280;

// ---------------------------------------------------------------------------
// Rasterising
// ---------------------------------------------------------------------------

interface Raster {
  spec: SpriteSpec;
  canvas: HTMLCanvasElement;
}

const rasters = new Map<string, Raster>();

function rasterise(spec: SpriteSpec): Raster {
  const ts = VIEW.textureScale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.w * ts);
  canvas.height = Math.round(spec.h * ts);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.scale(ts, ts);
  spec.draw(ctx);
  return { spec, canvas };
}

function sprite(key: string): Raster {
  const found = rasters.get(key);
  if (!found) throw new Error(`no sprite with key ${key}`);
  return found;
}

/** Draw a sprite with its origin at (x, y), optionally rotated (radians, clockwise) or mirrored about the origin. */
function put(ctx: Ctx, key: string, x: number, y: number, rot = 0, flip = false, alpha = 1): void {
  const r = sprite(key);
  ctx.save();
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(r.canvas, -r.spec.ax * r.spec.w, -r.spec.ay * r.spec.h, r.spec.w, r.spec.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

type SceneId = 'hq' | 'field' | 'tanks' | 'air' | 'flags' | 'soviet' | 'buildings';
const SCENES: { id: SceneId; h: number }[] = [
  { id: 'hq', h: 560 },
  { id: 'field', h: 620 },
  { id: 'tanks', h: 560 },
  { id: 'air', h: 560 },
  { id: 'flags', h: 340 },
  { id: 'soviet', h: 560 },
  { id: 'buildings', h: 1440 },
];

/** The building types the buildings scene shows: look, width, slots per floor, floors. */
const BUILDING_SHOW: [BuildingLook, number, number, number][] = [
  ['casemate', 160, 6, 2],
  ['church', 140, 5, 2],
  ['izba', 130, 4, 1],
  ['house', 150, 3, 2],
  ['apartment', 220, 7, 4],
  ['station', 200, 4, 2],
  ['factoryHall', 210, 8, 2],
  ['waterTank', 130, 6, 1],
  ['hangar', 220, 6, 1],
  ['sheds', 180, 5, 1],
  ['apartment', 180, 3, 3],
];
const PROP_SHOW: [CoverPropLook, number][] = [
  ['wagons', 150],
  ['ju52Wreck', 190],
  ['he111Wreck', 170],
];

function buildingSpecList(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  const seen = new Set<string>();
  for (const [look, w, n] of BUILDING_SHOW) {
    const k = buildingKey(look, w, n, 'ground');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(...buildingSpecs(look, w, n));
  }
  for (const [look, w] of PROP_SHOW) out.push(...coverPropSpecs(look, w));
  for (const style of MISSION_HQ_STYLES) out.push(...missionHqSpecs(style, 'soviet'));
  return out;
}

/** A building as the battle draws it: interior, facades (a man at some windows), roof; `standing` floors left. */
function building(ctx: Ctx, look: BuildingLook, w: number, n: number, floors: number, x: number, gy: number, damaged: boolean, standing: number): void {
  const L = BUILDING_LAYOUT;
  const key = (p: BuildingPiece): string => buildingKey(look, w, n, p);
  if (standing <= 0) {
    put(ctx, key('rubbleBack'), x, gy);
    figure(ctx, x - 10, gy + VIEW.trenchDepth * 1.6, 1, 1, 'stand');
    put(ctx, key('rubbleFront'), x, gy);
    return;
  }
  ctx.fillStyle = '#15130f';
  ctx.fillRect(x - w / 2, gy - standing * L.floorH, w, standing * L.floorH);
  const xs = windowXs(w, n);
  for (let f = 0; f < standing; f++) {
    for (let i = 0; i < xs.length; i++) if ((i + f) % 2 === 0) figure(ctx, x + xs[i], gy + L.occupantDy - f * L.floorH, 1, 1, 'stand');
  }
  for (let f = 0; f < standing; f++) put(ctx, key(f === 0 ? (damaged ? 'groundDamaged' : 'ground') : damaged ? 'upperDamaged' : 'upper'), x, gy - f * L.floorH);
  put(ctx, key(standing < floors ? 'roofBroken' : 'roof'), x, gy - standing * L.floorH);
}

function buildingsScene(ctx: Ctx): void {
  const rows = [300, 600, 860, 1100, 1400];
  rows.forEach((gy, r) => stage(ctx, r === 0 ? 0 : rows[r - 1] + 1, gy + 20, gy));
  let x = 100;
  let row = 0;
  for (const [look, w, n, floors] of BUILDING_SHOW) {
    if (x + w > SCENE_W - 40) {
      x = 100;
      row++;
    }
    building(ctx, look, w, n, floors, x + w / 2, rows[row], false, floors);
    label(ctx, `${look} (${floors} x ${n})`, x + w / 2, rows[row] + 16);
    x += w + 50;
  }
  // Damage, a fallen floor, rubble.
  row = 2;
  building(ctx, 'apartment', 220, 7, 4, 150, rows[row], true, 4);
  label(ctx, 'damaged', 150, rows[row] + 16);
  building(ctx, 'apartment', 220, 7, 4, 420, rows[row], true, 2);
  label(ctx, 'two floors fallen', 420, rows[row] + 16);
  building(ctx, 'apartment', 220, 7, 4, 680, rows[row], true, 0);
  label(ctx, 'rubble cover', 680, rows[row] + 16);
  building(ctx, 'izba', 130, 4, 1, 900, rows[row], true, 1);
  building(ctx, 'factoryHall', 210, 8, 2, 1080, rows[row], true, 1);
  row = 3;
  x = 100;
  for (const [look, w] of PROP_SHOW) {
    put(ctx, propKey(look, w, 'back'), x + w / 2, rows[row]);
    figure(ctx, x + w / 2, rows[row] + VIEW.trenchDepth * 1.6, 1, 1, 'stand');
    put(ctx, propKey(look, w, 'front'), x + w / 2, rows[row]);
    label(ctx, look, x + w / 2, rows[row] + 16);
    x += w + 40;
  }
  x = 220;
  for (const style of MISSION_HQ_STYLES) {
    put(ctx, missionHqKey(style, 'soviet', 'intact'), x, rows[4]);
    label(ctx, `HQ ${style}`, x, rows[4] + 16);
    x += 380;
  }
}

const params = new URLSearchParams(location.search);
const num = (name: string, fallback: number): number => {
  const raw = params.get(name);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? v : fallback;
};
const secParam = params.get('sec');
const scene = SCENES.find((s) => s.id === secParam) ?? SCENES[0];
const frozenT = params.has('t') ? num('t', 0) : null;
const zoom = num('zoom', 1);
const viewOx = num('ox', 0);
const viewOy = num('oy', 0);
const showAnchors = params.get('anchors') === '1';
const bg = params.get('bg') ?? 'day';

const SKY: Record<string, [string, string, string]> = {
  day: ['#9ea28c', '#c3bd9d', '#6a603f'],
  dusk: ['#6d5a52', '#c08a62', '#4e4430'],
  dark: ['#171a17', '#262a24', '#1c1a12'],
};
const palette = SKY[bg] ?? SKY.day;

// ---------------------------------------------------------------------------
// Stage furniture: sky, ground, labels, stick figures
// ---------------------------------------------------------------------------

function stage(ctx: Ctx, y0: number, y1: number, gy: number): void {
  const sky = ctx.createLinearGradient(0, y0, 0, gy - 30);
  sky.addColorStop(0, palette[0]);
  sky.addColorStop(1, palette[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, y0, SCENE_W, y1 - y0);
  ctx.fillStyle = palette[2];
  ctx.fillRect(0, gy - 34, SCENE_W, y1 - gy + 34);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, gy - 34, SCENE_W, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, gy, SCENE_W, 1);
}

function label(ctx: Ctx, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 0.7, y + 0.7);
  ctx.fillStyle = bg === 'dark' ? '#cfc9b2' : '#e8e3cf';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function marker(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 7);
  ctx.stroke();
  ctx.restore();
}

type Pose = 'stand' | 'walk' | 'carry';

/** Placeholder soldier: black, 58 wu tall at scale 1, feet at (x, y). */
function figure(ctx: Ctx, x: number, y: number, s: number, facing: number, pose: Pose, phase = 0): void {
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
  const swing = pose === 'walk' || pose === 'carry' ? Math.sin(phase) * h * 0.2 : h * 0.07;
  ctx.beginPath();
  ctx.moveTo(-swing, 0);
  ctx.lineTo(0, hip);
  ctx.lineTo(swing, 0);
  ctx.moveTo(0, hip);
  ctx.lineTo(h * 0.03, neck);
  if (pose === 'carry') {
    ctx.moveTo(h * 0.03, neck + 3 * s);
    ctx.lineTo(h * 0.2, neck + h * 0.16);
    ctx.lineTo(h * 0.12, neck - h * 0.02);
  } else {
    ctx.moveTo(h * 0.03, neck + 3 * s);
    ctx.lineTo(h * 0.22, neck + h * 0.12);
    ctx.lineTo(h * 0.42, neck + h * 0.06);
  }
  ctx.stroke();
  if (pose !== 'carry') {
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(h * 0.12, neck + h * 0.14);
    ctx.lineTo(h * 0.62, neck + h * 0.03);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(h * 0.04, neck - h * 0.1, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(h * 0.04, neck - h * 0.13, h * 0.12, h * 0.07, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

/** Figure placed on depth row r (0 far .. 3 near) of the ground line gy, optionally sunk (trench). */
function rowFigure(ctx: Ctx, x: number, gy: number, row: number, sunk: boolean, facing: number, pose: Pose, phase = 0): void {
  figure(ctx, x, gy + VIEW.rowDy[row] + (sunk ? VIEW.trenchDepth : 0), VIEW.rowScale[row], facing, pose, phase);
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

/** Draw a flag as FLAG_LAYOUT.strips strips with its hoist top at (x, y), at the given scale. */
function waveFlag(ctx: Ctx, key: string, x: number, y: number, t: number, k: number): void {
  const r = sprite(key);
  const n = FLAG_LAYOUT.strips;
  const sw = FLAG_LAYOUT.w / n;
  const ts = VIEW.textureScale;
  let left = flagWave(t, 0).dy;
  for (let i = 0; i < n; i++) {
    // Each strip is sheared so its top edge joins its neighbours' (a skewed Image in the renderer).
    const right = flagWave(t, (i + 1) / n).dy;
    const shade = flagWave(t, (i + 0.5) / n).shade;
    const dx = x + i * sw * k;
    ctx.save();
    ctx.transform(1, ((right - left) * k) / (sw * k), 0, 1, dx, y + left * k);
    ctx.drawImage(r.canvas, i * sw * ts, 0, sw * ts, FLAG_LAYOUT.h * ts, 0, 0, sw * k + 0.5, FLAG_LAYOUT.h * k);
    const level = flagStripTint(shade) & 0xff;
    ctx.fillStyle = `rgba(0,0,0,${(1 - level / 255).toFixed(3)})`;
    ctx.fillRect(0, 0, sw * k + 0.5, FLAG_LAYOUT.h * k);
    ctx.restore();
    left = right;
  }
}

// ---------------------------------------------------------------------------
// Scene: HQ bunkers
// ---------------------------------------------------------------------------

function flame(ctx: Ctx, x: number, y: number, t: number, seed: number): void {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const a = (t * 1.7 + seed * 0.31 + i * 0.25) % 1;
    const r = 9 * (1 - a * 0.7);
    ctx.fillStyle = i === 0 ? `rgba(255,190,80,${(0.85 * (1 - a)).toFixed(2)})` : `rgba(208,106,44,${(0.7 * (1 - a)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(t * 6 + seed + i) * 3, y - a * 30, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const a = (t * 0.6 + seed * 0.2 + i / 3) % 1;
    ctx.fillStyle = `rgba(40,38,34,${(0.45 * (1 - a)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x + a * 18, y - 20 - a * 90, 8 + a * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hqScene(ctx: Ctx, t: number): void {
  const factions: FactionId[] = ['british', 'german'];
  factions.forEach((faction, row) => {
    const y0 = row * STAGE_H;
    const gy = y0 + 250;
    stage(ctx, y0, y0 + STAGE_H, gy);
    const L = HQ_LAYOUT[faction];
    const flag = faction === 'british' ? FLAG_KEYS.unionJack : FLAG_KEYS.balkenkreuz;
    DAMAGE_STATES.forEach((state: DamageState, col) => {
      const cx = 215 + col * 385;
      put(ctx, hqKey(faction, state), cx, gy);
      if (state !== 'ruin') waveFlag(ctx, flag, cx + L.flagTop.x, gy + L.flagTop.y, t + col * 0.6, 1);
      if (state === 'ruin') L.fires.forEach((p, i) => flame(ctx, cx + p.x, gy + p.y, t, i * 3 + col));
      // Scale references: one man in the doorway row, one walking out, one at the front.
      rowFigure(ctx, cx + L.doorX + 6, gy, 1, false, 1, 'stand');
      rowFigure(ctx, cx + L.doorX + 70 + ((t * 24) % 40), gy, 2, false, 1, 'walk', t * 7);
      rowFigure(ctx, cx - 120, gy, 3, false, 1, 'stand');
      label(ctx, `${faction} ${state}`, cx, gy + 38);
      if (showAnchors) {
        ctx.save();
        ctx.strokeStyle = '#ff4';
        ctx.beginPath();
        ctx.moveTo(cx + L.doorX, gy - L.doorH);
        ctx.lineTo(cx + L.doorX, gy);
        ctx.stroke();
        ctx.restore();
        marker(ctx, cx + L.gunSlit.x, gy + L.gunSlit.y, '#f44');
        marker(ctx, cx + L.flagTop.x, gy + L.flagTop.y, '#4cf');
        marker(ctx, cx + L.flagBase.x, gy + L.flagBase.y, '#4cf');
        L.fires.forEach((p) => marker(ctx, cx + p.x, gy + p.y, '#f80'));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Scene: field works (trench, pillbox, wire, supplies)
// ---------------------------------------------------------------------------

function trench(ctx: Ctx, cx: number, gy: number, width: number, occupants: { x: number; row: number }[], t: number): void {
  const span = tileSpan(width, TRENCH_LAYOUT.capW, TRENCH_LAYOUT.tileW, createTileSpan());
  const layers: { caps: [string, string]; mid: string }[] = [
    { caps: [TRENCH_KEYS.backCapL, TRENCH_KEYS.backCapR], mid: TRENCH_KEYS.backMid },
    { caps: [TRENCH_KEYS.frontCapL, TRENCH_KEYS.frontCapR], mid: TRENCH_KEYS.frontMid },
  ];
  const drawLayer = (li: number): void => {
    const layer = layers[li];
    put(ctx, layer.caps[0], cx + span.capLeftX, gy);
    for (let i = 0; i < span.count; i++) {
      const r = sprite(layer.mid);
      ctx.save();
      ctx.translate(cx + span.firstX + i * span.step, gy);
      ctx.scale(span.scaleX, 1);
      ctx.drawImage(r.canvas, 0, -r.spec.ay * r.spec.h, r.spec.w, r.spec.h);
      ctx.restore();
    }
    put(ctx, layer.caps[1], cx + span.capRightX, gy);
  };
  drawLayer(0);
  for (const row of [0, 1, 2, 3]) {
    for (const o of occupants) if (o.row === row) rowFigure(ctx, cx + o.x, gy, row, true, 1, 'stand', t);
  }
  drawLayer(1);
}

/** A wire belt of `width` drawn end-on: its pieces' far halves, then whatever stands in it, then the near halves. */
function wireBelt(ctx: Ctx, cx: number, gy: number, width: number, between: () => void): void {
  const p = wirePieceLayout(width, createWirePieces());
  for (let i = 0; i < p.count; i++) put(ctx, WIRE_KEYS.back, cx + p.x[i], gy + WIRE_LAYOUT.dy);
  between();
  for (let i = 0; i < p.count; i++) put(ctx, WIRE_KEYS.front, cx + p.x[i], gy + WIRE_LAYOUT.dy);
}

function fieldScene(ctx: Ctx, t: number): void {
  // Stage A: trenches and pillboxes.
  const ga = 175;
  stage(ctx, 0, 270, ga);
  trench(
    ctx,
    200,
    ga,
    330,
    [
      { x: -110, row: 0 },
      { x: -40, row: 1 },
      { x: 30, row: 2 },
      { x: 100, row: 3 },
      { x: 135, row: 0 },
    ],
    t,
  );
  rowFigure(ctx, 300, ga, 0, false, 1, 'stand');
  trench(ctx, 480, ga, 130, [{ x: -24, row: 1 }, { x: 22, row: 2 }], t);
  label(ctx, 'trench 330 wu, 130 wu (units sink 24 wu)', 340, ga + 66);
  const pbs: DamageState[] = ['intact', 'damaged', 'ruin'];
  pbs.forEach((state, i) => {
    const px = 700 + i * 170;
    put(ctx, pillboxKey(state), px, ga);
    rowFigure(ctx, px - 82, ga, 2, false, 1, 'stand');
    label(ctx, `pillbox ${state}`, px, ga + 36);
    if (showAnchors && state !== 'ruin') marker(ctx, px + PILLBOX_LAYOUT.slit.x, ga + PILLBOX_LAYOUT.slit.y, '#f44');
  });

  // Stage B: wire, supplies, airdrops.
  const gb = 550;
  stage(ctx, 270, 620, gb);
  rowFigure(ctx, 30, gb, 2, false, 1, 'stand');
  wireBelt(ctx, 80, gb, 100, () => figure(ctx, 82, gb + WIRE_LAYOUT.feetDy, 1, 1, 'walk', t * 3));
  wireBelt(ctx, 190, gb, 180, () => undefined);
  put(ctx, WIRE_KEYS.crushed, 310, gb + WIRE_LAYOUT.dy);
  put(ctx, WIRE_KEYS.cut, 380, gb + WIRE_LAYOUT.dy);
  label(ctx, 'wire end-on: 100 wu, 180 wu / crushed, cut', 200, gb + 66);
  put(ctx, SUPPLY_KEYS.dump, 500, gb);
  rowFigure(ctx, 566, gb, 2, false, -1, 'stand');
  label(ctx, 'supply dump', 500, gb + 36);
  // Sapper walking home with a crate on the shoulder.
  const sx = 640 + ((t * 18) % 60);
  figure(ctx, sx, gb + VIEW.rowDy[2], VIEW.rowScale[2], -1, 'carry', t * 6);
  put(ctx, SUPPLY_KEYS.crate, sx - 6, gb + VIEW.rowDy[2] - 50);
  label(ctx, 'carried crate', 670, gb + 36);
  // Airdrop: one swaying in the air, one landed.
  const sway = Math.sin(t * 1.2) * 0.06;
  const dropY = gb - 130 + Math.sin(t * 0.8) * 6;
  ctx.save();
  ctx.translate(900, dropY + SUPPLY_LAYOUT.dropCrateHarnessY);
  ctx.rotate(sway);
  put(ctx, SUPPLY_KEYS.parachute, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(900, dropY + SUPPLY_LAYOUT.dropCrateHarnessY);
  ctx.rotate(sway);
  put(ctx, SUPPLY_KEYS.dropCrate, 0, -SUPPLY_LAYOUT.dropCrateHarnessY);
  ctx.restore();
  put(ctx, SUPPLY_KEYS.parachute, 1040, gb + SUPPLY_LAYOUT.dropCrateHarnessY);
  put(ctx, SUPPLY_KEYS.dropCrate, 1040, gb);
  rowFigure(ctx, 1100, gb, 2, false, -1, 'stand');
  label(ctx, 'airdrop crate + parachute', 970, gb + 36);
}

// ---------------------------------------------------------------------------
// Scene: tanks
// ---------------------------------------------------------------------------

const pose = createTankPose();

interface TankDraw {
  look: Look;
  x: number;
  gy: number;
  facing: number;
  speed: number;
  firePhase: number;
}

function drawTank(ctx: Ctx, d: TankDraw, t: number): void {
  const L = TANK_LAYOUT[d.look];
  const keys = TANK_KEYS[d.look];
  const tf = (t + d.firePhase) % 3.2;
  const recoil = tf < 0.07 ? tf / 0.07 : Math.max(0, 1 - (tf - 0.07) / 0.55);
  const state: TankState = {
    look: d.look,
    distance: d.speed * t,
    turretAim: 0.05 + 0.03 * Math.sin(t * 0.9),
    recoil,
    hullRock: recoil * 0.9 + 0.2 * Math.sin(t * 5.1),
  };
  layoutTank(state, pose);
  ctx.save();
  ctx.translate(d.x, d.gy);
  ctx.scale(d.facing, 1);
  put(ctx, keys.track[pose.trackFrame], pose.track.x, pose.track.y, pose.track.rot);
  for (let i = 0; i < pose.wheelCount; i++) put(ctx, keys.wheels[i], pose.wheels[i].x, pose.wheels[i].y, pose.wheels[i].rot);
  put(ctx, keys.hull, pose.hull.x, pose.hull.y, pose.hull.rot);
  put(ctx, keys.barrel, pose.barrel.x, pose.barrel.y, pose.barrel.rot);
  put(ctx, keys.turret, pose.turret.x, pose.turret.y, pose.turret.rot);
  // Exhaust puffs.
  if (d.speed !== 0) {
    for (let k = 0; k < 5; k++) {
      const a = (t * 1.3 + k / 5) % 1;
      ctx.fillStyle = `rgba(70,68,60,${(0.4 * (1 - a)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(pose.exhaust.x - a * 34, pose.exhaust.y - a * 16, 3 + a * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Muzzle flash.
  if (tf < 0.12) {
    const g = ctx.createRadialGradient(pose.muzzle.x, pose.muzzle.y, 1, pose.muzzle.x, pose.muzzle.y, 22);
    g.addColorStop(0, 'rgba(255,240,170,0.95)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pose.muzzle.x, pose.muzzle.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (showAnchors) {
    marker(ctx, pose.muzzle.x, pose.muzzle.y, '#f44');
    marker(ctx, pose.exhaust.x, pose.exhaust.y, '#f80');
    marker(ctx, pose.hullMg.x, pose.hullMg.y, '#4cf');
    marker(ctx, L.rockPivot.x, L.rockPivot.y, '#ff4');
  }
  ctx.restore();
}

function tanksScene(ctx: Ctx, t: number): void {
  const rows = [
    { gy: 225, facing: 1, speed: 34 },
    { gy: STAGE_H + 225, facing: -1, speed: 0 },
  ];
  // ?soviet=1 shows the Soviet KV-1, T-34 and T-60; ?soviet=2 the Soviet carrier beside the British one and the T-60.
  // ?looks=t26,bt7,kv2 shows any three looks (the era looks of src/data/eras.ts among them).
  const sov = params.get('soviet');
  const custom = (params.get('looks') ?? '').split(',').filter((l): l is Look => (VEHICLE_LOOKS as readonly string[]).includes(l));
  const xs: Partial<Record<Look, number>> =
    custom.length > 0
      ? Object.fromEntries(custom.slice(0, 3).map((l, i) => [l, 215 + i * 350]))
      : sov === '1' ? { kv1: 215, t34: 565, t60: 905 } : sov === '2' ? { carrierSoviet: 215, carrier: 565, t60: 905 } : { churchill: 215, panzer4: 565, kingTiger: 905 };
  rows.forEach((row, r) => {
    stage(ctx, r * STAGE_H, (r + 1) * STAGE_H, row.gy);
    // Ground marks sliding backwards so the track speed can be judged against the ground.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 40; i++) {
      const x = (((i * 61 - row.speed * t * row.facing) % SCENE_W) + SCENE_W) % SCENE_W;
      ctx.fillRect(x, row.gy + 40 + (i % 3) * 9, 8, 2);
    }
    for (const look of VEHICLE_LOOKS) {
      const at = xs[look];
      if (at === undefined) continue;
      const x = row.facing === 1 ? at : SCENE_W - at + 40;
      drawTank(ctx, { look, x, gy: row.gy, facing: row.facing, speed: row.speed, firePhase: look.length * 0.37 }, t);
      rowFigure(ctx, x + row.facing * (TANK_LAYOUT[look].length / 2 + 26), row.gy, 3, false, -row.facing, 'stand');
      label(ctx, look + (row.facing === -1 ? ' (mirrored)' : ''), x, row.gy + 48);
    }
  });
}

// ---------------------------------------------------------------------------
// Scene: aircraft, decals, husks
// ---------------------------------------------------------------------------

function airScene(ctx: Ctx, t: number): void {
  const ga = 220;
  stage(ctx, 0, STAGE_H, ga);
  const px = 150 + ((t * 40) % 400);
  const py = 110 + Math.sin(t * 2) * 3;
  put(ctx, AIR_KEYS.shadow, px - 20, ga + 18, 0, false, 0.6);
  put(ctx, AIR_KEYS.plane, px, py, Math.sin(t * 1.4) * 0.02);
  label(ctx, 'fighter-bomber + shadow', px, ga + 44);
  if (showAnchors) {
    marker(ctx, px + AIR_LAYOUT.rocketRail.x, py + AIR_LAYOUT.rocketRail.y, '#f44');
    marker(ctx, px + AIR_LAYOUT.bombBay.x, py + AIR_LAYOUT.bombBay.y, '#4cf');
  }
  put(ctx, AIR_KEYS.rocket, 620, 110);
  put(ctx, AIR_KEYS.bomb, 680, 110, 0.5);
  label(ctx, 'rocket, bomb', 650, 138);
  put(ctx, DECAL_KEYS.crater, 790, ga + 8);
  put(ctx, DECAL_KEYS.scorch, 920, ga + 8);
  RUBBLE_KEYS.forEach((key, i) => put(ctx, key, 1030 + i * 34, ga + 4 + (i % 2) * 6));
  label(ctx, 'crater, scorch, rubble chunks', 930, ga + 44);
  rowFigure(ctx, 700, ga, 3, false, 1, 'stand');

  const gb = STAGE_H + 235;
  stage(ctx, STAGE_H, STAGE_H * 2, gb);
  TANK_LOOKS.forEach((look, i) => {
    const x = 210 + i * 380;
    put(ctx, TANK_KEYS[look].husk, x, gb);
    rowFigure(ctx, x + TANK_LAYOUT[look].length / 2 + 40, gb, 3, false, -1, 'stand');
    label(ctx, `${look} husk`, x, gb + 36);
  });
  put(ctx, DECAL_KEYS.crater, 560, gb + 18);
}

// ---------------------------------------------------------------------------
// Scene: the Red Army's extra vehicles (the air strike planes, the KV-2, the trucks and the Katyusha launcher)
// ---------------------------------------------------------------------------

function sovietScene(ctx: Ctx): void {
  const ga = 225;
  stage(ctx, 0, STAGE_H, ga);
  put(ctx, AIR_KEYS.plane, 160, 90);
  label(ctx, 'air strike: generic', 160, 150);
  put(ctx, AIR_KEYS.il2, 450, 90);
  label(ctx, 'air strike: Il-2 (soviet)', 450, 150);
  put(ctx, aircraftLookKey('i16'), 655, 80);
  label(ctx, 'fighter, 1941: I-16', 655, 140);
  // The KV-2: the KV-1's track, wheels and hull under the KV-2 turret and howitzer, standing.
  const x = 860;
  const L = TANK_LAYOUT.kv1;
  const keys = TANK_KEYS.kv1;
  layoutTank({ look: 'kv1', distance: 0, turretAim: 0, recoil: 0, hullRock: 0 }, pose);
  ctx.save();
  ctx.translate(x, ga);
  put(ctx, keys.track[0], pose.track.x, pose.track.y);
  for (let i = 0; i < pose.wheelCount; i++) put(ctx, keys.wheels[i], pose.wheels[i].x, pose.wheels[i].y);
  put(ctx, keys.hull, pose.hull.x, pose.hull.y);
  put(ctx, KV2_KEYS.barrel, L.turretRing.x + KV2_TURRET.trunnion.x, L.turretRing.y + KV2_TURRET.trunnion.y);
  put(ctx, KV2_KEYS.turret, L.turretRing.x, L.turretRing.y);
  ctx.restore();
  rowFigure(ctx, x + L.length / 2 + 30, ga, 3, false, -1, 'stand');
  label(ctx, 'KV-2 (1941, registered)', x, ga + 48);

  const gb = STAGE_H + 225;
  stage(ctx, STAGE_H, STAGE_H * 2, gb);
  FACTION_IDS.forEach((f, i) => {
    put(ctx, truckKey(f, 'loaded'), 110 + i * 170, gb);
    label(ctx, ` truck`, 110 + i * 170, gb + 30);
  });
  put(ctx, truckKey('soviet', 'wreck'), 620, gb);
  label(ctx, 'soviet wreck', 620, gb + 30);
  put(ctx, KATYUSHA_LAUNCHER_KEY, 880, gb);
  rowFigure(ctx, 970, gb, 3, false, -1, 'stand');
  label(ctx, 'BM-13 Katyusha (ZiS-6)', 880, gb + 30);
}

// ---------------------------------------------------------------------------
// Scene: flags at 3x
// ---------------------------------------------------------------------------

function flagsScene(ctx: Ctx, t: number): void {
  stage(ctx, 0, 340, 300);
  const k = 3;
  const keys = [FLAG_KEYS.unionJack, FLAG_KEYS.balkenkreuz, FLAG_KEYS.sovietRed];
  keys.forEach((key, i) => {
    const x = 20 + i * 190;
    const r = sprite(key);
    ctx.drawImage(r.canvas, x, 20, FLAG_LAYOUT.w * k, FLAG_LAYOUT.h * k);
    waveFlag(ctx, key, x + 600, 20, t, k);
  });
  label(ctx, 'flat (3x)', 300, 150);
  label(ctx, 'waving, 12 strips (3x)', 900, 150);
  // Actual size, on poles.
  keys.forEach((key, i) => {
    const x = 120 + i * 120;
    ctx.fillStyle = '#2a2318';
    ctx.fillRect(x - 2, 210, 3, 90);
    waveFlag(ctx, key, x + 1, 212, t + i * 0.7, 1);
  });
  label(ctx, 'actual size', 180, 322);
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ctx2d = canvas.getContext('2d');
if (!ctx2d) throw new Error('2d context unavailable');
const ctx: Ctx = ctx2d;

function render(t: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDevicePixelRatio);
  const w = Math.round(window.innerWidth * dpr);
  const h = Math.round(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const k = (w / SCENE_W) * zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#15160f';
  ctx.fillRect(0, 0, w, h);
  ctx.setTransform(k, 0, 0, k, -viewOx * k, -viewOy * k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  switch (scene.id) {
    case 'hq':
      hqScene(ctx, t);
      break;
    case 'field':
      fieldScene(ctx, t);
      break;
    case 'tanks':
      tanksScene(ctx, t);
      break;
    case 'air':
      airScene(ctx, t);
      break;
    case 'flags':
      flagsScene(ctx, t);
      break;
    case 'soviet':
      sovietScene(ctx);
      break;
    case 'buildings':
      buildingsScene(ctx);
      break;
  }
}

function buildNav(): void {
  const nav = document.getElementById('nav');
  if (!nav) return;
  if (params.get('nav') === '0') {
    nav.remove();
    return;
  }
  for (const s of SCENES) {
    const a = document.createElement('a');
    a.href = `?sec=${s.id}`;
    a.textContent = s.id;
    nav.appendChild(a);
  }
}

function boot(): void {
  const specs = [...structureSpecs(), ...vehicleSpecs(), ...propSpecs(), ...FACTION_IDS.flatMap((f) => truckSpecs(f)), ...buildingSpecList()];
  for (const spec of specs) rasters.set(spec.key, rasterise(spec));
  window.__stats = { sprites: specs.length };
  buildNav();
  if (frozenT !== null) {
    render(frozenT);
  } else {
    const start = performance.now();
    const frame = (): void => {
      render((performance.now() - start) / 1000);
      requestAnimationFrame(frame);
    };
    frame();
  }
  window.addEventListener('resize', () => render(frozenT ?? 0));
  window.__ready = true;
}

boot();
