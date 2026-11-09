/**
 * Effects preview page (dev server only). Plain 2D canvas, no Phaser.
 * See art-fx.html for the query parameters.
 */
import { listFxSprites } from '../src/art/fx';
import type { SpriteSpec } from '../src/art/types';
import {
  FX_KEYS,
  FX_LAYERS,
  FX_PRESET_IDS,
  FX_PRESETS,
  FX_SPRITE_KEYS,
  type FxPresetDef,
  type FxPresetId,
} from '../src/data/fx';
import { VIEW } from '../src/data/view';
import { WEATHER } from '../src/data/weather';
import {
  createLightning,
  createParticles,
  createRainField,
  createRng,
  createShake,
  createWeather,
  type ParticleSystem,
  type Rng01,
  type ScreenShake,
} from '../src/fx';

declare global {
  interface Window {
    __ready?: boolean;
  }
}

const STEP = 1 / 60;
// ';' is accepted between parameters as well as '&', because '&' cannot be passed through x.cmd on Windows.
const params = new URLSearchParams(location.search.replace(/;/g, '&'));
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const dpr = window.devicePixelRatio || 1;
const cssW = window.innerWidth;
const cssH = window.innerHeight;
canvas.width = Math.round(cssW * dpr);
canvas.height = Math.round(cssH * dpr);

function numberParam(name: string, fallback: number): number {
  const raw = params.get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

interface Tex {
  spec: SpriteSpec;
  image: HTMLCanvasElement;
}

/** The game rasterises at VIEW.textureScale; ?tex=N overrides it to inspect the drawing itself. */
const texScale = numberParam('tex', VIEW.textureScale);

function rasterise(spec: SpriteSpec, scale: number): Tex {
  const image = document.createElement('canvas');
  image.width = Math.max(1, Math.ceil(spec.w * scale));
  image.height = Math.max(1, Math.ceil(spec.h * scale));
  const c = image.getContext('2d') as CanvasRenderingContext2D;
  c.scale(scale, scale);
  spec.draw(c);
  return { spec, image };
}

const specs = listFxSprites();
const texByKey = new Map<string, Tex>();
for (const spec of specs) texByKey.set(spec.key, rasterise(spec, texScale));

function tex(key: string): Tex {
  const found = texByKey.get(key);
  if (!found) throw new Error(`no sprite for ${key}`);
  return found;
}

/** Particle sprite index (into FX_SPRITE_KEYS) to texture. */
const particleTex: Tex[] = FX_SPRITE_KEYS.map(tex);

function drawTex(c: CanvasRenderingContext2D, t: Tex, x: number, y: number, rotation: number, scaleX: number, scaleY: number, alpha: number): void {
  c.save();
  c.translate(x, y);
  if (rotation !== 0) c.rotate(rotation);
  c.scale(scaleX, scaleY);
  c.globalAlpha = alpha;
  c.drawImage(t.image, -t.spec.ax * t.spec.w, -t.spec.ay * t.spec.h, t.spec.w, t.spec.h);
  c.restore();
}

function drawParticles(c: CanvasRenderingContext2D, ps: ParticleSystem): void {
  for (let layer = 0; layer < FX_LAYERS.length; layer++) {
    c.globalCompositeOperation = FX_LAYERS[layer].additive ? 'lighter' : 'source-over';
    for (let i = 0; i < ps.count; i++) {
      if (ps.layer[i] !== layer || ps.alpha[i] <= 0) continue;
      drawTex(c, particleTex[ps.sprite[i]], ps.x[i], ps.y[i], ps.rotation[i], ps.scale[i], ps.scale[i], ps.alpha[i]);
    }
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Preset cells                                                        */
/* ------------------------------------------------------------------ */

interface Show {
  /** CSS pixels per wu in a 260 px wide cell. */
  zoom: number;
  /** Loop length, seconds. */
  period: number;
  /** Spawn height above the ground line, wu. */
  height: number;
  dirX: number;
  dirY: number;
  /** Keep spawning for this long (continuous effects and bursts). */
  emitFor?: number;
  /** Seconds between spawns; defaults to the preset's interval. */
  gap?: number;
  /** Random spread of the spawn point, wu. */
  spreadX?: number;
  spreadY?: number;
  /** The spawn point moves along x at this speed (rocket trail). */
  travel?: number;
  startX?: number;
  /** Where the 58 wu reference figure stands; omitted = no figure. */
  figureX?: number;
}

const SHOW: Record<FxPresetId, Show> = {
  muzzleFlash: { zoom: 2.6, period: 0.9, height: 38, dirX: 1, dirY: 0, startX: -14, figureX: -34, emitFor: 0.25, gap: 0.12 },
  tankMuzzle: { zoom: 1.5, period: 2, height: 40, dirX: 1, dirY: 0, startX: -50, figureX: -75 },
  casing: { zoom: 2.6, period: 1.7, height: 38, dirX: 1, dirY: 0, startX: 10, figureX: 22, emitFor: 0.4, gap: 0.1 },
  shellCasing: { zoom: 2.4, period: 2.2, height: 30, dirX: 1, dirY: 0, startX: 20, figureX: -40 },
  bulletDirt: { zoom: 2.6, period: 1, height: 0, dirX: 1, dirY: 0, figureX: -34 },
  footDust: { zoom: 2.6, period: 1.2, height: 0, dirX: 1, dirY: 0, startX: 10, figureX: 22, emitFor: 0.7, gap: 0.3 },
  trackDust: { zoom: 2.2, period: 2.6, height: 0, dirX: 1, dirY: 0, startX: 30, emitFor: 1.5, figureX: -44 },
  exhaust: { zoom: 2.4, period: 2.6, height: 26, dirX: -0.4, dirY: -1, emitFor: 1.7, figureX: 36 },
  katyushaTrail: { zoom: 1.0, period: 2.4, height: 60, dirX: -1, dirY: 0.3, startX: -160, travel: 520, emitFor: 0.8 },
  rocketTrail: { zoom: 1.5, period: 1.6, height: 44, dirX: -1, dirY: 0, startX: -110, travel: 420, emitFor: 0.5 },
  grenadeBurst: { zoom: 1.7, period: 2.3, height: 0, dirX: 0, dirY: -1, figureX: -62 },
  shellExplosion: { zoom: 1.1, period: 3.3, height: 0, dirX: 0, dirY: -1, figureX: -95 },
  bigExplosion: { zoom: 0.72, period: 4.4, height: 0, dirX: 0, dirY: -1, figureX: -150 },
  shellDust: { zoom: 0.72, period: 4.4, height: 0, dirX: 1, dirY: 0, figureX: -150 },
  barrelSmoke: { zoom: 1.5, period: 3, height: 40, dirX: 1, dirY: 0, figureX: -75 },
  pillboxDebris: { zoom: 1.1, period: 3.3, height: 22, dirX: 0, dirY: -1, figureX: -95 },
  wireSnap: { zoom: 2.2, period: 1.9, height: 14, dirX: 0, dirY: -1, figureX: -50 },
  smokeScreen: { zoom: 0.72, period: 9, height: 34, dirX: 0, dirY: -1, emitFor: 5, spreadX: 70, spreadY: 14, figureX: -150 },
  smokeBurst: { zoom: 0.85, period: 4.6, height: 6, dirX: 0, dirY: -1, figureX: -130 },
  hitPuff: { zoom: 2.6, period: 1.4, height: 40, dirX: 1, dirY: 0, startX: -20, figureX: -24 },
  crateSplinters: { zoom: 2.2, period: 2, height: 9, dirX: 0, dirY: -1, figureX: -52 },
  rainSplash: { zoom: 3.4, period: 1.2, height: 0, dirX: 0, dirY: -1, emitFor: 1.2, gap: 0.06, spreadX: 30, figureX: -32 },
  waterSplash: { zoom: 1.7, period: 1.8, height: 0, dirX: 0, dirY: -1, figureX: -62 },
  armourSparks: { zoom: 2.6, period: 1.1, height: 34, dirX: -1, dirY: -0.3, startX: 24, figureX: -40 },
  tankFire: { zoom: 1.5, period: 6, height: 26, dirX: 0, dirY: -1, emitFor: 5, figureX: -70 },
};

interface Cell {
  id: FxPresetId;
  show: Show;
  preset: FxPresetDef;
  ps: ParticleSystem;
  shake: ScreenShake;
  rng: Rng01;
  time: number;
  nextSpawn: number;
}

function makeCell(id: FxPresetId, seed: number): Cell {
  const ps = createParticles(createRng(seed), 768);
  ps.groundY = 0;
  const cell: Cell = {
    id,
    show: SHOW[id],
    preset: FX_PRESETS[id],
    ps,
    shake: createShake(),
    rng: createRng(seed ^ 0x5bd1e995),
    time: 0,
    nextSpawn: 0,
  };
  spawnDue(cell);
  return cell;
}

function spawnDue(cell: Cell): void {
  const { show, preset } = cell;
  const gap = show.gap ?? preset.interval ?? Number.POSITIVE_INFINITY;
  const emitFor = show.emitFor ?? 0;
  while (cell.nextSpawn <= cell.time + 1e-9 && cell.nextSpawn <= emitFor + 1e-9) {
    const x = (show.startX ?? 0) + (show.travel ?? 0) * cell.nextSpawn + (cell.rng() * 2 - 1) * (show.spreadX ?? 0);
    const y = -show.height + (cell.rng() * 2 - 1) * (show.spreadY ?? 0);
    cell.ps.spawn(cell.id, x, y, show.dirX, show.dirY, 0);
    if (preset.shake) cell.shake.add(preset.shake);
    cell.nextSpawn += gap;
  }
}

function resetCell(cell: Cell): void {
  cell.ps.clear();
  cell.time = 0;
  cell.nextSpawn = 0;
  spawnDue(cell);
}

function advanceCell(cell: Cell, dt: number): void {
  cell.time += dt;
  cell.ps.update(dt);
  cell.shake.update(dt);
  spawnDue(cell);
}

function simulateCell(cell: Cell, seconds: number): void {
  resetCell(cell);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) advanceCell(cell, STEP);
}

/** A plain 58 wu figure for scale: feet at (x, 0). */
function drawFigure(c: CanvasRenderingContext2D, x: number): void {
  const h = VIEW.figureHeight;
  c.save();
  c.strokeStyle = '#141414';
  c.fillStyle = '#141414';
  c.lineCap = 'round';
  c.lineWidth = 4.2;
  c.beginPath();
  c.moveTo(x - 6, 0);
  c.lineTo(x, -h * 0.45);
  c.lineTo(x + 6, 0);
  c.moveTo(x, -h * 0.45);
  c.lineTo(x, -h * 0.78);
  c.moveTo(x - 8, -h * 0.5);
  c.lineTo(x, -h * 0.74);
  c.lineTo(x + 8, -h * 0.5);
  c.stroke();
  c.beginPath();
  c.arc(x, -h * 0.88, h * 0.105, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

const SKY = '#7d868a';
const GROUND = '#5f5a4b';
const GROUND_EDGE = '#77705d';

function drawCell(cell: Cell, px: number, py: number, w: number, h: number, label: string): void {
  const k = cell.show.zoom * (w / 260);
  const groundPx = py + h * 0.8;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  ctx.rect(px + 1, py + 1, w - 2, h - 2);
  ctx.clip();
  ctx.fillStyle = SKY;
  ctx.fillRect(px, py, w, h);
  ctx.fillStyle = GROUND;
  ctx.fillRect(px, groundPx, w, h);
  ctx.fillStyle = GROUND_EDGE;
  ctx.fillRect(px, groundPx, w, 1.5);

  ctx.translate(px + w / 2 + cell.shake.x * k, groundPx + cell.shake.y * k);
  ctx.scale(k, k);
  if (cell.show.figureX !== undefined) drawFigure(ctx, cell.show.figureX);
  drawParticles(ctx, cell.ps);
  ctx.restore();

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(label, px + 7, py + 16);
  ctx.fillStyle = '#f2efe6';
  ctx.fillText(label, px + 6, py + 15);
  ctx.restore();
}

/** Pick the column count that gives the largest cells of a pleasant shape. */
function gridFor(count: number, aspect: number): { cols: number; rows: number; w: number; h: number } {
  let best = { cols: 1, rows: count, w: 0, h: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const w = Math.min(cssW / cols, (cssH / rows) * aspect);
    if (w > best.w) best = { cols, rows, w, h: w / aspect };
  }
  return best;
}

function clear(): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2b2d2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function runLoop(frame: (dt: number) => void, freezeAt: number | null, simulate: (seconds: number) => void): void {
  if (freezeAt !== null) {
    simulate(freezeAt);
    frame(0);
    window.__ready = true;
    return;
  }
  let last = performance.now();
  const tick = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000) * numberParam('speed', 1);
    last = now;
    frame(dt);
    window.__ready = true;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const freezeAt = params.has('t') ? numberParam('t', 0) : null;
const seed = numberParam('seed', 7);

function presetGrid(): void {
  const cells = FX_PRESET_IDS.map((id, i) => makeCell(id, seed + i * 101));
  const grid = gridFor(cells.length, 1.3);
  const offsetX = (cssW - grid.cols * grid.w) / 2;
  const frame = (dt: number): void => {
    clear();
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (dt > 0) {
        advanceCell(cell, dt);
        if (cell.time >= cell.show.period) resetCell(cell);
      }
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      drawCell(cell, offsetX + col * grid.w, row * grid.h, grid.w, grid.h, `${cell.id}  ${cell.ps.count}`);
    }
  };
  runLoop(frame, freezeAt, (seconds) => {
    for (const cell of cells) simulateCell(cell, Math.min(seconds, cell.show.period));
  });
}

/**
 * Film strips: each preset frozen at evenly spaced moments (same seed in every
 * frame). One preset wraps over several rows; several presets get a row each.
 */
function presetStrips(ids: FxPresetId[]): void {
  const frames = Math.max(1, Math.round(numberParam('frames', 8)));
  const first = numberParam('from', 0);
  const single = ids.length === 1;
  const aspect = 1.3;
  const grid = single
    ? gridFor(frames, aspect)
    : (() => {
        const w = Math.min(cssW / frames, (cssH / ids.length) * aspect);
        return { cols: frames, rows: ids.length, w, h: w / aspect };
      })();
  const offsetX = (cssW - grid.cols * grid.w) / 2;
  clear();
  for (let p = 0; p < ids.length; p++) {
    const id = ids[p];
    const step = numberParam('step', (SHOW[id].period * 0.9 - first) / Math.max(1, frames - 1));
    for (let i = 0; i < frames; i++) {
      const cell = makeCell(id, seed);
      const time = first + i * step;
      simulateCell(cell, time);
      const col = single ? i % grid.cols : i;
      const row = single ? Math.floor(i / grid.cols) : p;
      drawCell(cell, offsetX + col * grid.w, row * grid.h, grid.w, grid.h, `${id}  t=${time.toFixed(2)}s  n=${cell.ps.count}`);
    }
  }
  window.__ready = true;
}

/* ------------------------------------------------------------------ */
/* Sprite sheet                                                        */
/* ------------------------------------------------------------------ */

function spriteSheet(): void {
  const zoom = numberParam('z', 2);
  const filter = params.get('filter') ?? '';
  const bg = params.get('bg') === 'dark' ? '#1d1f20' : params.get('bg') === 'light' ? '#b4b8b4' : '#6f7578';
  const shown = specs.filter((spec) => spec.key.includes(filter));
  // Crisp at the chosen zoom, so the drawing can be judged on its own.
  const sharp = shown.map((spec) => rasterise(spec, Math.max(texScale, zoom * dpr)));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font = '10px ui-monospace, Consolas, monospace';
  const pad = 10;
  const labelH = 14;
  let x = pad;
  let y = pad;
  let rowH = 0;
  for (const t of sharp) {
    const w = t.spec.w * zoom;
    const h = t.spec.h * zoom;
    const label = t.spec.key.replace(/^fx\//, '');
    const cellW = Math.max(w, ctx.measureText(label).width) + pad;
    if (x + cellW > cssW) {
      x = pad;
      y += rowH + labelH + pad;
      rowH = 0;
    }
    ctx.drawImage(t.image, x, y, w, h);
    // Anchor cross.
    ctx.strokeStyle = 'rgba(255,60,200,0.7)';
    ctx.lineWidth = 1;
    const ax = x + t.spec.ax * w;
    const ay = y + t.spec.ay * h;
    ctx.beginPath();
    ctx.moveTo(ax - 3, ay);
    ctx.lineTo(ax + 3, ay);
    ctx.moveTo(ax, ay - 3);
    ctx.lineTo(ax, ay + 3);
    ctx.stroke();
    ctx.fillStyle = params.get('bg') === 'light' ? '#222' : '#f0ede4';
    ctx.fillText(label, x, y + h + 11);
    rowH = Math.max(rowH, h);
    x += cellW;
  }
  window.__ready = true;
}

/* ------------------------------------------------------------------ */
/* Rain scene                                                          */
/* ------------------------------------------------------------------ */

function rainScene(): void {
  const k = cssH / VIEW.heightWu;
  const widthWu = cssW / k;
  const rng = createRng(seed);
  const weather = createWeather(rng, WEATHER, 'rain');
  const rain = createRainField(rng, widthWu);
  const lightning = createLightning(rng);
  const ps = createParticles(createRng(seed + 1));
  const look = WEATHER.rain;
  const flashLook = WEATHER.lightning;
  const forceThunder = params.get('thunder') === '1';
  const farTex = tex(FX_KEYS.rain.far);
  const nearTex = tex(FX_KEYS.rain.near);
  let time = 0;
  let nextForced = 1;
  let thunderText = 0;

  // Start with the rain already fully in.
  for (let i = 0; i < Math.ceil(look.fadeIn / STEP) + 30; i++) {
    const splashes = rain.update(STEP);
    for (let s = 0; s < splashes; s++) ps.spawn('rainSplash', rain.splashX(), rain.splashY(), 0, -1);
    ps.update(STEP);
  }

  const advance = (dt: number): void => {
    time += dt;
    if (forceThunder && time + 1e-9 >= nextForced) {
      weather.forceThunder();
      nextForced += 4;
    }
    const strikes = weather.update(dt);
    for (let s = 0; s < strikes; s++) lightning.strike(0, widthWu);
    if (lightning.update(dt)) thunderText = 1.2;
    thunderText = Math.max(0, thunderText - dt);
    const splashes = rain.update(dt);
    for (let s = 0; s < splashes; s++) {
      const y = rain.splashY();
      ps.spawn('rainSplash', rain.splashX(), y, 0, -1, y);
    }
    ps.update(dt);
  };

  const hills = (base: number, height: number, wave: number, colour: string): void => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.horizonY + 2);
    for (let x = 0; x <= widthWu + 20; x += 20) {
      const y = base - height * (0.5 + 0.5 * Math.sin(x / wave + base)) - height * 0.3 * Math.sin(x / (wave * 0.37) + 1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(widthWu + 20, VIEW.horizonY + 2);
    ctx.closePath();
    ctx.fill();
  };

  const draw = (): void => {
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW.horizonY);
    sky.addColorStop(0, '#8a98a6');
    sky.addColorStop(1, '#c4c7c0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, widthWu, VIEW.horizonY + 2);

    // The bolt sits in the sky, behind the hills.
    if (lightning.boltAlpha > 0) {
      const bolt = lightning.bolt;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let b = 0; b < bolt.count; b++) {
          ctx.strokeStyle = pass === 0 ? flashLook.boltGlow : flashLook.boltColor;
          ctx.globalAlpha = lightning.boltAlpha * bolt.alpha[b] * (pass === 0 ? 0.35 : 1);
          ctx.lineWidth = bolt.width[b] * (pass === 0 ? 4 : 1);
          ctx.beginPath();
          const first = bolt.start[b];
          for (let i = 0; i < bolt.length[b]; i++) {
            const p = (first + i) * 2;
            if (i === 0) ctx.moveTo(bolt.points[p], bolt.points[p + 1]);
            else ctx.lineTo(bolt.points[p], bolt.points[p + 1]);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    hills(VIEW.horizonY - 6, 46, 210, '#8d9a94');
    hills(VIEW.horizonY + 2, 26, 130, '#75836f');
    const ground = ctx.createLinearGradient(0, VIEW.horizonY, 0, VIEW.heightWu);
    ground.addColorStop(0, '#77765a');
    ground.addColorStop(1, '#5c5a44');
    ctx.fillStyle = ground;
    ctx.fillRect(0, VIEW.horizonY, widthWu, VIEW.heightWu - VIEW.horizonY);

    ctx.save();
    for (let i = 0; i < 5; i++) {
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * k * (widthWu * (0.16 + 0.17 * i)), dpr * k * (VIEW.groundY + VIEW.rowDy[i % VIEW.rows]));
      drawFigure(ctx, 0);
    }
    ctx.restore();
    drawParticles(ctx, ps);

    // Sky and scene darkening.
    ctx.globalAlpha = look.skyDarken * rain.intensity;
    ctx.fillStyle = look.skyTint;
    ctx.fillRect(0, 0, widthWu, VIEW.heightWu);
    ctx.globalAlpha = 1;

    for (let i = 0; i < rain.count; i++) {
      const layer = look.layers[rain.layer[i]];
      drawTex(ctx, rain.layer[i] === 0 ? farTex : nearTex, rain.x[i], rain.y[i], rain.rotation, layer.scale, layer.scale, layer.alpha * rain.intensity);
    }

    if (lightning.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lightning.flash * flashLook.flashAlpha;
      ctx.fillStyle = flashLook.flashColor;
      ctx.fillRect(0, 0, widthWu, VIEW.heightWu);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '11px ui-monospace, Consolas, monospace';
    ctx.fillStyle = '#f2efe6';
    const note = `rain  t=${time.toFixed(2)}s  checks=${weather.checksMade}  strikes=${weather.strikes}  flash=${lightning.flash.toFixed(2)}${thunderText > 0 ? '  THUNDER' : ''}`;
    ctx.fillText(note, 8, 16);
  };

  runLoop(
    (dt) => {
      if (dt > 0) advance(dt);
      draw();
    },
    freezeAt,
    (seconds) => {
      const steps = Math.round(seconds / STEP);
      for (let i = 0; i < steps; i++) advance(STEP);
    },
  );
}

const view = params.get('view');
const only = (params.get('only') ?? '')
  .split(',')
  .filter((id): id is FxPresetId => (FX_PRESET_IDS as string[]).includes(id));
if (view === 'sprites') spriteSheet();
else if (view === 'rain') rainScene();
else if (only.length > 0) presetStrips(only);
else presetGrid();
