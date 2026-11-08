/**
 * Preview page for the Quartermaster supply looks: every dump style per nation, the sapper's bigger load next to the
 * normal crate, the handcart empty and loaded with a soldier at the handle, and the supply truck states. Rasterises
 * the specs the way the renderer will (textureScale x). See looks-supply.html for the query parameters.
 */
import { CART_LAYOUT, DUMP_STYLE_LAYOUT, SUPPLY_TRUCK_LAYOUT } from '../src/data/looksSupply';
import type { FactionId } from '../src/data/schema';
import { SAPPER_CART_HANDLE } from '../src/data/upgradeLooks';
import { VIEW } from '../src/data/view';
import { allFigureSprites } from '../src/art/figure';
import {
  DUMP_STYLE_LIST,
  TRUCK_STATES,
  bigLoadKey,
  cartKey,
  dumpStyleKey,
  supplyLookSpecs,
  truckKey,
} from '../src/art/props/supplyLooks';
import type { SpriteSpec } from '../src/art/types';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: unknown;
  }
}

type Ctx = CanvasRenderingContext2D;

const SCENE_W = 1200;
const ROW_H = 277;
const FACTIONS: FactionId[] = ['british', 'german'];

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

/** Draw a sprite with its origin at (x, y), scaled by k. */
function put(ctx: Ctx, key: string, x: number, y: number, k = 1): void {
  const r = sprite(key);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.drawImage(r.canvas, -r.spec.ax * r.spec.w, -r.spec.ay * r.spec.h, r.spec.w, r.spec.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Options and stage furniture
// ---------------------------------------------------------------------------

type SceneId = 'dumps' | 'haul';
const SCENES: SceneId[] = ['dumps', 'haul'];

// ';' also separates parameters, so the page can be shot through cmd.exe, where '&' cannot be passed.
const params = new URLSearchParams(location.search.replace(/;/g, '&'));
const num = (name: string, fallback: number): number => {
  const raw = params.get(name);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? v : fallback;
};
const scene: SceneId = SCENES.find((s) => s === params.get('sec')) ?? 'dumps';
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
  if (!showAnchors) return;
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

type Pose = 'stand' | 'carry' | 'push';

/**
 * Placeholder soldier: black, VIEW.figureHeight tall, feet at (x, y), facing +x. 'carry' holds a load at the chest
 * (returned centre point); 'push' leans in with both hands at (hx, hy).
 */
function figure(ctx: Ctx, x: number, y: number, pose: Pose, hx = 0, hy = 0): { x: number; y: number } {
  const h = VIEW.figureHeight;
  const lean = pose === 'push' ? 5 : 0;
  const hip = { x: x + lean * 0.3, y: y - h * 0.44 };
  const neck = { x: x + lean + h * 0.03, y: y - h * 0.8 };
  ctx.save();
  ctx.strokeStyle = '#0c0c0c';
  ctx.fillStyle = '#0c0c0c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.3;
  const stride = pose === 'stand' ? h * 0.07 : h * 0.15;
  ctx.beginPath();
  ctx.moveTo(x - stride, y);
  ctx.lineTo(hip.x, hip.y);
  ctx.lineTo(x + stride, y);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(neck.x, neck.y);
  const load = { x: neck.x + 10, y: neck.y + 12 };
  if (pose === 'carry') {
    ctx.moveTo(neck.x, neck.y + 3);
    ctx.lineTo(neck.x + 6, neck.y + 13);
    ctx.lineTo(load.x - 8, load.y + 1);
  } else if (pose === 'push') {
    ctx.moveTo(neck.x, neck.y + 3);
    ctx.lineTo((neck.x + hx) / 2 + 1, (neck.y + hy) / 2 + 5);
    ctx.lineTo(hx, hy);
  } else {
    ctx.moveTo(neck.x, neck.y + 3);
    ctx.lineTo(neck.x + 3, neck.y + 15);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(neck.x + 2, neck.y - h * 0.1, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(neck.x + 2, neck.y - h * 0.13, h * 0.12, h * 0.07, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  return load;
}

/** Arms drawn over a carried load so the hands read as holding it. */
function carryHands(ctx: Ctx, load: { x: number; y: number }, halfW: number): void {
  ctx.save();
  ctx.strokeStyle = '#0c0c0c';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(load.x - halfW - 2, load.y + 1);
  ctx.lineTo(load.x - halfW + 3, load.y + 1);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const DUMP_X: Record<string, number> = { crates: 75, stacked: 245, drums: 470, truck: 900 };

function dumpsScene(ctx: Ctx): void {
  FACTIONS.forEach((faction, row) => {
    const y0 = row * ROW_H;
    const gy = y0 + 205;
    stage(ctx, y0, y0 + ROW_H, gy);
    for (const style of DUMP_STYLE_LIST) {
      const cx = DUMP_X[style];
      put(ctx, dumpStyleKey(style, faction), cx, gy);
      marker(ctx, cx, gy, '#ff4');
      label(ctx, `${faction} ${style} (${DUMP_STYLE_LAYOUT[style].box.w} wu)`, cx, gy + 40);
    }
    // A sapper loading at the drums dump for scale.
    figure(ctx, DUMP_X.drums - 4, gy + 14, 'stand');
  });
}

function haulScene(ctx: Ctx): void {
  // Row 1: crate vs bigger load (life size and 3x), then the handcart empty and loaded with a soldier pushing.
  const y0 = 0;
  const gy = y0 + 200;
  stage(ctx, y0, y0 + ROW_H, gy);
  FACTIONS.forEach((faction, i) => {
    const bx = i * 600;
    const crate = `fig/${faction}/crate`;
    const big = bigLoadKey(faction);
    let load = figure(ctx, bx + 40, gy, 'carry');
    put(ctx, crate, load.x, load.y);
    carryHands(ctx, load, 9);
    load = figure(ctx, bx + 105, gy, 'carry');
    put(ctx, big, load.x, load.y);
    carryHands(ctx, load, 9);
    put(ctx, crate, bx + 525, gy - 130, 3);
    put(ctx, big, bx + 525, gy - 62, 3);
    marker(ctx, bx + 525, gy - 62, '#ff4');
    label(ctx, 'crate / big load', bx + 72, gy + 40);
    label(ctx, 'x3', bx + 525, gy + 40);
    [false, true].forEach((loaded, j) => {
      const cx = bx + 230 + j * 150;
      const feet = cx - SAPPER_CART_HANDLE.x;
      put(ctx, cartKey(faction, loaded), cx, gy);
      figure(ctx, feet, gy, 'push', cx, gy + SAPPER_CART_HANDLE.y);
      marker(ctx, cx, gy + SAPPER_CART_HANDLE.y, '#4cf');
      marker(ctx, cx + CART_LAYOUT.wheel.x, gy + CART_LAYOUT.wheel.y, '#f80');
      marker(ctx, cx, gy, '#ff4');
      label(ctx, `${faction} cart ${loaded ? 'loaded' : 'empty'}`, cx + 18, gy + 40);
    });
  });
  // Row 2: the supply truck states, with a man standing beside each nation's first truck.
  const y1 = ROW_H;
  const gy1 = y1 + 200;
  stage(ctx, y1, y1 + ROW_H, gy1);
  FACTIONS.forEach((faction, i) => {
    TRUCK_STATES.forEach((state, j) => {
      const cx = 90 + i * 600 + j * 175;
      put(ctx, truckKey(faction, state), cx, gy1);
      marker(ctx, cx, gy1, '#ff4');
      label(ctx, `${faction} truck ${state}`, cx, gy1 + 40);
    });
    figure(ctx, 90 + i * 600 - SUPPLY_TRUCK_LAYOUT.length / 2 - 16, gy1 + 10, 'stand');
  });
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ctx2d = canvas.getContext('2d');
if (!ctx2d) throw new Error('2d context unavailable');
const ctx: Ctx = ctx2d;

function render(): void {
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
  if (scene === 'dumps') dumpsScene(ctx);
  else haulScene(ctx);
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
    a.href = `?sec=${s}`;
    a.textContent = s;
    nav.appendChild(a);
  }
}

function boot(): void {
  const crates = new Set(FACTIONS.map((f) => `fig/${f}/crate`));
  const specs = [...FACTIONS.flatMap((f) => supplyLookSpecs(f)), ...allFigureSprites().filter((s) => crates.has(s.key))];
  for (const spec of specs) rasters.set(spec.key, rasterise(spec));
  window.__stats = { sprites: specs.length };
  buildNav();
  render();
  window.addEventListener('resize', render);
  window.__ready = true;
}

boot();
