/**
 * The ground plane strip: from the horizon to the bottom of the view. The
 * band the units walk on is kept mid-to-light and low in contrast so black
 * figures read against it; texture gets coarser toward the camera.
 */
import { GROUND_PALETTES } from '../../data/ground';
import { BACKDROP, type GroundStyle } from '../../data/theatres';
import { VIEW } from '../../data/view';
import { mixRgb, rgbToCss } from './color';
import { TAU, clamp, fillBelow, lerp, oval, sineProfile, wrapped, wrappedSeeded, type Ctx } from './kit';
import { range, type Rng } from './rng';
import type { Scene } from './scene';

const H = VIEW.horizonY;
const B = VIEW.heightWu;

/** 0 at the horizon, 1 at the bottom of the view. */
function depthAt(y: number): number {
  return clamp((y - H) / (B - H), 0, 1);
}

/** Random y on the ground plane; `power` > 1 crowds things toward the horizon, as perspective does. */
function planeY(rng: Rng, power: number): number {
  return H + 5 + (B - H - 5) * Math.pow(rng(), power);
}

function pebble(ctx: Ctx, x: number, y: number, r: number, lit: string, shade: string): void {
  ctx.fillStyle = shade;
  oval(ctx, x, y, r, r * 0.55);
  ctx.fillStyle = lit;
  oval(ctx, x - r * 0.12, y - r * 0.14, r * 0.78, r * 0.36);
}

function tuft(ctx: Ctx, rng: Rng, x: number, y: number, len: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, len * 0.12);
  ctx.lineCap = 'round';
  const blades = 3 + Math.floor(rng() * 3);
  ctx.beginPath();
  for (let i = 0; i < blades; i++) {
    const ox = range(rng, -0.5, 0.5) * len;
    ctx.moveTo(x + ox * 0.4, y);
    ctx.lineTo(x + ox, y - len * range(rng, 0.6, 1));
  }
  ctx.stroke();
}

function scatterTufts(ctx: Ctx, rng: Rng, w: number, count: number, minLen: number, maxLen: number, colors: readonly string[]): void {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.5);
    const len = lerp(minLen, maxLen, depthAt(y)) * range(rng, 0.7, 1.3);
    const color = colors[Math.floor(rng() * colors.length)];
    wrappedSeeded(w, x, len, rng, (cx, r) => tuft(ctx, r, cx, y, len, color));
  }
}

function scatterPebbles(ctx: Ctx, rng: Rng, w: number, count: number, minR: number, maxR: number, lit: string, shade: string): void {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.4);
    const r = lerp(minR, maxR, depthAt(y)) * range(rng, 0.6, 1.4);
    wrapped(w, x, r, (cx) => pebble(ctx, cx, y, r, lit, shade));
  }
}

/** Flat blotches lying on the plane, squashed harder near the horizon. */
function scatterPatches(ctx: Ctx, rng: Rng, w: number, count: number, minR: number, maxR: number, color: string, power: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = planeY(rng, power);
    const d = depthAt(y);
    const rx = lerp(minR, maxR, d) * range(rng, 0.6, 1.5);
    const ry = Math.max(0.8, rx * lerp(0.07, 0.17, d));
    wrapped(w, x, rx, (cx) => oval(ctx, cx, y, rx, ry));
  }
}

function ripples(ctx: Ctx, rng: Rng, w: number, count: number, dark: string, light: string): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.3);
    const d = depthAt(y);
    const len = lerp(10, 54, d) * range(rng, 0.6, 1.4);
    const sag = lerp(0.6, 3, d) * range(rng, 0.5, 1.2);
    const lw = lerp(0.5, 1.3, d);
    wrapped(w, x, len, (cx) => {
      ctx.lineWidth = lw;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, y);
      ctx.quadraticCurveTo(cx, y + sag, cx + len / 2, y);
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, y + lw);
      ctx.quadraticCurveTo(cx, y + sag + lw, cx + len / 2, y + lw);
      ctx.stroke();
    });
  }
}

function grassDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  scatterPatches(ctx, rng, w, 16, 14, 60, sc.tone(P.track, 0, 0.2), 1.2);
  scatterTufts(ctx, rng, w, 560, 2.2, 8, [sc.tone(P.tuft, 0, 0.5), sc.tone(P.groundDark, 0, 0.6), sc.tone(P.groundLight, 0, 0.6)]);
  // Wild flowers: specks only.
  const flower = sc.tone(P.pale, 0, 0.55);
  ctx.fillStyle = flower;
  for (let i = 0; i < 90; i++) {
    const x = range(rng, 2, w - 2);
    const y = planeY(rng, 1.4);
    oval(ctx, x, y, lerp(0.5, 1.2, depthAt(y)), lerp(0.4, 0.9, depthAt(y)));
  }
}

function sandDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  ripples(ctx, rng, w, 320, sc.tone(P.groundDark, 0, 0.3), sc.tone(P.groundLight, 0, 0.35));
  scatterPebbles(ctx, rng, w, 120, 0.8, 3.6, sc.tone(P.pebble, 0.1), sc.tone(P.stoneShade, 0.1));
  scatterTufts(ctx, rng, w, 26, 3, 9, [sc.tone(P.tuft, 0, 0.7)]);
}

function dryDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  scatterPatches(ctx, rng, w, 14, 14, 54, sc.tone(P.soil, 0, 0.12), 1.2);
  scatterTufts(ctx, rng, w, 420, 2.4, 8.5, [sc.tone(P.tuft, 0, 0.55), sc.tone(P.groundLight, 0, 0.7), sc.tone(P.groundDark, 0, 0.5)]);
  scatterPebbles(ctx, rng, w, 150, 0.8, 3.8, sc.tone(P.pebble, 0.05), sc.tone(P.stoneShade, 0.05));
  // Cracks in baked earth.
  ctx.strokeStyle = sc.tone(P.soil, 0, 0.22);
  ctx.lineCap = 'round';
  for (let i = 0; i < 44; i++) {
    const x = range(rng, 30, w - 30);
    const y = planeY(rng, 1.2);
    const d = depthAt(y);
    ctx.lineWidth = lerp(0.4, 1, d);
    ctx.beginPath();
    ctx.moveTo(x, y);
    let px = x;
    let py = y;
    for (let k = 0; k < 4; k++) {
      px += range(rng, 3, 12) * lerp(0.5, 1.6, d);
      py += range(rng, -1, 1) * lerp(0.4, 1.6, d);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function mudDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  // Ruts: long, slightly wavy grooves with a pale lip.
  for (let i = 0; i < 30; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.1);
    const d = depthAt(y);
    const len = lerp(70, 260, d) * range(rng, 0.6, 1.3);
    const lw = lerp(0.7, 2.6, d);
    const bend = range(rng, -1, 1) * lerp(1, 5, d);
    wrapped(w, x, len, (cx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = lw;
      ctx.strokeStyle = sc.tone(P.groundDark, 0, 0.42);
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, y);
      ctx.quadraticCurveTo(cx, y + bend, cx + len / 2, y);
      ctx.stroke();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = sc.tone(P.groundLight, 0, 0.4);
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, y + lw * 0.8);
      ctx.quadraticCurveTo(cx, y + bend + lw * 0.8, cx + len / 2, y + lw * 0.8);
      ctx.stroke();
    });
  }
  // Puddles hold the sky.
  const puddle = rgbToCss(mixRgb(sc.sky.mid, sc.rgb(P.ground), 0.3), 0.75);
  for (let i = 0; i < 24; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.1);
    const d = depthAt(y);
    const rx = lerp(8, 46, d) * range(rng, 0.6, 1.4);
    const ry = Math.max(0.9, rx * lerp(0.08, 0.16, d));
    wrapped(w, x, rx * 1.2, (cx) => {
      ctx.fillStyle = sc.tone(P.groundDark, 0, 0.35);
      oval(ctx, cx, y, rx * 1.12, ry * 1.3);
      ctx.fillStyle = puddle;
      oval(ctx, cx, y, rx, ry);
    });
  }
  scatterPebbles(ctx, rng, w, 130, 0.9, 4.2, sc.tone(P.stone, 0.05), sc.tone(P.stoneShade, 0.05));
  scatterTufts(ctx, rng, w, 90, 2.2, 7, [sc.tone(P.tuft, 0, 0.55)]);
}

function beachDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  // Wet sheen left by the tide, mostly on the seaward (far) side.
  scatterPatches(ctx, rng, w, 34, 30, 120, rgbToCss(mixRgb(sc.sky.mid, sc.rgb(P.waterLight), 0.5), 0.2), 2);
  ripples(ctx, rng, w, 240, sc.tone(P.groundDark, 0, 0.28), sc.tone(P.groundLight, 0, 0.32));
  scatterPebbles(ctx, rng, w, 170, 0.7, 3.2, sc.tone(P.pebble, 0.08), sc.tone(P.stoneShade, 0.08));
  // Shell specks.
  ctx.fillStyle = sc.tone(P.pale, 0, 0.6);
  for (let i = 0; i < 120; i++) {
    const x = range(rng, 2, w - 2);
    const y = planeY(rng, 1.3);
    const r = lerp(0.5, 1.3, depthAt(y));
    oval(ctx, x, y, r, r * 0.6);
  }
}

function cobbleDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  const joint = sc.tone(P.groundDark, 0, 0.42);
  const lightSett = sc.tone(P.groundLight, 0, 0.3);
  const darkSett = sc.tone(P.groundDark, 0, 0.22);
  let y = H + 1;
  let row = 0;
  while (y < B) {
    const d = depthAt(y);
    const rh = lerp(2.1, 9.5, d);
    const n = Math.round(w / (rh * 2.3));
    const sw = w / n;
    const off = row % 2 === 0 ? 0 : sw / 2;
    // A few setts a touch lighter or darker than their neighbours.
    for (let i = 0; i < n; i++) {
      const v = rng();
      if (v < 0.16) {
        ctx.fillStyle = v < 0.09 ? lightSett : darkSett;
        const x0 = off + i * sw;
        ctx.fillRect(x0, y, sw, rh);
        if (x0 + sw > w) ctx.fillRect(x0 - w, y, sw, rh);
      }
    }
    ctx.strokeStyle = joint;
    ctx.lineWidth = lerp(0.35, 1, d);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    for (let i = 0; i <= n; i++) {
      const x0 = off + i * sw;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0, y + rh);
    }
    ctx.stroke();
    y += rh;
    row++;
  }
  // Brick and mortar rubble.
  for (let i = 0; i < 90; i++) {
    const x = range(rng, 6, w - 6);
    const yy = planeY(rng, 1.3);
    const s = lerp(1, 3.6, depthAt(yy)) * range(rng, 0.7, 1.3);
    ctx.fillStyle = rng() < 0.6 ? sc.tone(P.pebble, 0.1) : sc.tone(P.stone, 0.1);
    ctx.fillRect(x, yy, s * 1.8, s * 0.8);
    ctx.fillStyle = sc.tone(P.groundDark, 0, 0.5);
    ctx.fillRect(x, yy + s * 0.8, s * 1.8, s * 0.25);
  }
  scatterTufts(ctx, rng, w, 40, 2, 6, [sc.tone(P.tuft, 0, 0.6)]);
}

function forestDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  // Frost and old snow lying in the hollows.
  scatterPatches(ctx, rng, w, 60, 12, 70, sc.tone(P.pale, 0, 0.3), 1.5);
  // Needle litter.
  ctx.strokeStyle = sc.tone(P.soil, 0, 0.3);
  ctx.lineCap = 'round';
  for (let i = 0; i < 620; i++) {
    const x = range(rng, 4, w - 4);
    const y = planeY(rng, 1.4);
    const d = depthAt(y);
    const len = lerp(1, 4.5, d);
    const a = range(rng, -0.6, 0.6);
    ctx.lineWidth = lerp(0.4, 0.9, d);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.4);
    ctx.stroke();
  }
  // Fallen twigs.
  ctx.strokeStyle = sc.tone(P.trunk, 0, 0.5);
  for (let i = 0; i < 46; i++) {
    const x = range(rng, 20, w - 20);
    const y = planeY(rng, 1.2);
    const d = depthAt(y);
    const len = lerp(4, 22, d) * range(rng, 0.6, 1.3);
    ctx.lineWidth = lerp(0.5, 1.4, d);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.6, y - range(rng, -1, 1) * lerp(0.4, 2, d));
    ctx.lineTo(x + len, y + range(rng, -1, 1) * lerp(0.4, 2, d));
    ctx.stroke();
  }
  scatterTufts(ctx, rng, w, 200, 2.2, 8, [sc.tone(P.foliage, 0, 0.55), sc.tone(P.tuft, 0, 0.5)]);
  scatterPebbles(ctx, rng, w, 50, 0.8, 3.4, sc.tone(P.pebble, 0.05), sc.tone(P.stoneShade, 0.05));
}

/** Paint the whole ground strip. The context is in view-space y. */
/** Wind-packed snow: soft drifts lit on top, a few dry stalks and stones showing through, boot prints in the band. */
function snowDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number, deep: boolean): void {
  const P = sc.pal;
  // Drifts: long low mounds, the far side lit and the near side in blue shadow.
  const drifts = deep ? 46 : 26;
  for (let i = 0; i < drifts; i++) {
    const x = rng() * w;
    const y = planeY(rng, 1.3);
    const d = depthAt(y);
    const rx = lerp(18, deep ? 120 : 80, d) * range(rng, 0.6, 1.4);
    const ry = Math.max(0.8, rx * lerp(0.05, deep ? 0.14 : 0.1, d));
    wrapped(w, x, rx, (cx) => {
      ctx.fillStyle = sc.tone(P.groundDark, 0, deep ? 0.3 : 0.22);
      oval(ctx, cx, y + ry * 0.45, rx, ry);
      ctx.fillStyle = sc.tone(P.groundLight, 0, 0.85);
      oval(ctx, cx - rx * 0.05, y, rx * 0.92, ry * 0.8);
    });
  }
  // Wind ripples in the crust.
  ripples(ctx, rng, w, deep ? 90 : 160, sc.tone(P.groundDark, 0, 0.18), sc.tone(P.groundLight, 0, 0.5));
  // Boot prints and sled tracks along the walked band.
  ctx.fillStyle = sc.tone(P.groundDark, 0, deep ? 0.32 : 0.24);
  const half = BACKDROP.trackHalfHeight;
  for (let i = 0; i < (deep ? 70 : 120); i++) {
    const x = range(rng, 2, w - 2);
    const y = VIEW.groundY + range(rng, -0.8, 1) * half;
    const d = depthAt(y);
    oval(ctx, x, y, lerp(0.8, 2.2, d) * (deep ? 1.4 : 1), lerp(0.3, 0.8, d));
  }
  // What pokes through: dry stalks and the odd dark stone.
  scatterTufts(ctx, rng, w, deep ? 30 : 90, 2.4, 8, [sc.tone(P.tuft, 0, 0.6), sc.tone(P.soil, 0, 0.45)]);
  scatterPebbles(ctx, rng, w, deep ? 14 : 40, 0.8, 3.2, sc.tone(P.pebble, 0.05), sc.tone(P.soilDark, 0.05));
}

/** A city's rubble: broken brick and concrete, charred timbers, dust and the odd twisted rail. */
function rubbleDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  scatterPatches(ctx, rng, w, 40, 16, 70, sc.tone(P.soilDark, 0, 0.18), 1.3);
  scatterPatches(ctx, rng, w, 30, 20, 90, sc.tone(P.groundLight, 0, 0.18), 1.3);
  // Brick and block fragments, lit on top with a dark underside.
  for (let i = 0; i < 260; i++) {
    const x = range(rng, 4, w - 4);
    const y = planeY(rng, 1.35);
    const d = depthAt(y);
    const s = lerp(0.9, 4.4, d) * range(rng, 0.6, 1.5);
    const v = rng();
    ctx.fillStyle = v < 0.45 ? sc.tone(P.pebble, 0.05) : v < 0.8 ? sc.tone(P.stone, 0.05) : sc.tone(P.groundLight, 0.05);
    ctx.fillRect(x, y, s * range(rng, 1.2, 2.2), s * 0.75);
    ctx.fillStyle = sc.tone(P.soilDark, 0, 0.55);
    ctx.fillRect(x, y + s * 0.75, s * 1.6, s * 0.28);
  }
  // Charred beams and bent rods lying askew.
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = range(rng, 20, w - 20);
    const y = planeY(rng, 1.2);
    const d = depthAt(y);
    const len = lerp(6, 34, d) * range(rng, 0.6, 1.3);
    const tilt = range(rng, -0.25, 0.25);
    ctx.strokeStyle = rng() < 0.7 ? sc.tone(P.trunk, 0, 0.7) : sc.tone(P.metalShade, 0, 0.7);
    ctx.lineWidth = lerp(0.6, 2.2, d);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len * tilt * lerp(0.2, 0.5, d));
    ctx.stroke();
  }
  scatterPebbles(ctx, rng, w, 160, 0.6, 2.8, sc.tone(P.stone, 0.05), sc.tone(P.stoneShade, 0.05));
  scatterTufts(ctx, rng, w, 24, 2, 5.5, [sc.tone(P.tuft, 0, 0.5)]);
}

/** Open steppe: thick dry grass in bunches, a few wormwood clumps and dusty bare patches. */
function steppeDetail(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  scatterPatches(ctx, rng, w, 22, 18, 80, sc.tone(P.soil, 0, 0.14), 1.2);
  scatterTufts(ctx, rng, w, 700, 2.6, 9.5, [sc.tone(P.tuft, 0, 0.6), sc.tone(P.groundLight, 0, 0.65), sc.tone(P.groundDark, 0, 0.55)]);
  // Grey-green wormwood clumps.
  ctx.fillStyle = sc.tone(P.foliageAlt, 0.1, 0.35);
  for (let i = 0; i < 40; i++) {
    const x = range(rng, 4, w - 4);
    const y = planeY(rng, 1.4);
    const r = lerp(0.8, 3.2, depthAt(y));
    oval(ctx, x, y, r * 1.6, r * 0.7);
  }
  scatterPebbles(ctx, rng, w, 40, 0.7, 2.6, sc.tone(P.pebble, 0.05), sc.tone(P.stoneShade, 0.05));
}

/**
 * Paint the whole ground strip. The context is in view-space y. `style` (default: the theatre's own) picks the
 * detail; a style with its own colours (GROUND_PALETTES: snow, deep snow, rubble, steppe) paints in them.
 */
export function paintGround(ctx: Ctx, base: Scene, rng: Rng, w: number, style: GroundStyle = base.def.groundStyle): void {
  const own = GROUND_PALETTES[style];
  const sc: Scene = own ? { ...base, pal: { ...base.pal, ...own } } : base;
  const P = sc.pal;
  const edge = sineProfile(rng, w, [3, 7, 13, 23], 0.5);
  const yEdge = (x: number): number => H - 2.4 + edge(x) * BACKDROP.groundEdgeAmp;

  const g = ctx.createLinearGradient(0, H - 4, 0, B);
  const stop = (y: number): number => (y - (H - 4)) / (B - (H - 4));
  g.addColorStop(0, sc.tone(P.ground, 0.22));
  g.addColorStop(stop(VIEW.groundY - 26), sc.tone(P.ground, 0.06));
  g.addColorStop(stop(VIEW.groundY + 30), sc.tone(P.ground));
  g.addColorStop(1, rgbToCss(mixRgb(sc.rgb(P.ground), sc.rgb(P.groundDark), 0.75)));
  fillBelow(ctx, w, yEdge, B + 2, g, 4);

  // Everything else stays on the ground: clip to it so nothing pokes over the far edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-6, B + 2);
  for (let x = -6; x <= w + 6; x += 4) ctx.lineTo(x, yEdge(x));
  ctx.lineTo(w + 6, B + 2);
  ctx.closePath();
  ctx.clip();

  // Broad, soft mottling in two tones.
  scatterPatches(ctx, rng, w, 70, 26, 150, sc.tone(P.groundLight, 0, 0.16), 1.4);
  scatterPatches(ctx, rng, w, 70, 26, 150, sc.tone(P.groundDark, 0, 0.14), 1.4);

  // The worn band where the units walk: a touch lighter than its surroundings.
  const half = BACKDROP.trackHalfHeight;
  const tg = ctx.createLinearGradient(0, VIEW.groundY - half, 0, VIEW.groundY + half * 1.3);
  tg.addColorStop(0, sc.tone(P.track, 0, 0));
  tg.addColorStop(0.35, sc.tone(P.track, 0, BACKDROP.trackAlpha));
  tg.addColorStop(0.7, sc.tone(P.track, 0, BACKDROP.trackAlpha));
  tg.addColorStop(1, sc.tone(P.track, 0, 0));
  ctx.fillStyle = tg;
  ctx.fillRect(0, VIEW.groundY - half, w, half * 2.3);
  scatterBand(ctx, rng, w, sc.tone(P.track, 0, 0.2));

  switch (style) {
    case 'snow':
      snowDetail(ctx, sc, rng, w, false);
      break;
    case 'deepSnow':
      snowDetail(ctx, sc, rng, w, true);
      break;
    case 'rubble':
      rubbleDetail(ctx, sc, rng, w);
      break;
    case 'steppe':
      steppeDetail(ctx, sc, rng, w);
      break;
    case 'grass':
      grassDetail(ctx, sc, rng, w);
      break;
    case 'sand':
      sandDetail(ctx, sc, rng, w);
      break;
    case 'dry':
      dryDetail(ctx, sc, rng, w);
      break;
    case 'mud':
      mudDetail(ctx, sc, rng, w);
      break;
    case 'beach':
      beachDetail(ctx, sc, rng, w);
      break;
    case 'cobble':
      cobbleDetail(ctx, sc, rng, w);
      break;
    case 'forest':
      forestDetail(ctx, sc, rng, w);
      break;
  }

  // The foot of the view sits under the HUD: let it fall away a little darker.
  const fg = ctx.createLinearGradient(0, VIEW.groundY + 50, 0, B);
  fg.addColorStop(0, sc.tone(P.soilDark, 0, 0));
  fg.addColorStop(1, sc.tone(P.soilDark, 0, BACKDROP.groundFootShade));
  ctx.fillStyle = fg;
  ctx.fillRect(0, VIEW.groundY + 50, w, B - VIEW.groundY - 50);
  ctx.restore();
}

/** Long worn streaks inside the walked band. */
function scatterBand(ctx: Ctx, rng: Rng, w: number, color: string): void {
  ctx.fillStyle = color;
  const half = BACKDROP.trackHalfHeight;
  for (let i = 0; i < 26; i++) {
    const x = rng() * w;
    const y = VIEW.groundY + range(rng, -0.7, 0.9) * half;
    const rx = range(rng, 50, 170);
    const ry = range(rng, 1.4, 3.6);
    wrapped(w, x, rx, (cx) => {
      ctx.beginPath();
      ctx.ellipse(cx, y, rx, ry, 0, 0, TAU);
      ctx.fill();
    });
  }
}
