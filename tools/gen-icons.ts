/**
 * Draws the app icons with Canvas 2D in headless Chromium and writes them to public/icons:
 *
 *   x.cmd npm run icons
 *
 * The emblem is the game's own Brodie helmet (the path, colours and shading of src/art/figure/parts.ts) on a brass-ringed
 * olive badge over the dark theme colour, with a row of sandbags below. Colours are read from src/ui/theme.css, so the
 * icons follow the theme. Output (all PNG):
 *
 *   icon-192.png, icon-512.png     purpose "any": rounded square, transparent corners
 *   icon-maskable-512.png          purpose "maskable": full bleed, emblem inside the 80 percent safe circle
 *   apple-touch-icon.png (180)     full bleed (iOS rounds the corners itself)
 *   favicon-32.png                 browser tab
 *
 * The PNGs are committed; run this again only when the emblem or the theme colours change. The drawing code is a plain
 * script string because it runs inside the page (no imports there).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public', 'icons');

/** A colour of the theme (`--th-<name>`), read from the stylesheet. */
function themeColour(css: string, name: string): string {
  const m = new RegExp(`--th-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`theme.css has no --th-${name}`);
  return m[1];
}

interface IconJob {
  file: string;
  size: number;
  mode: 'any' | 'full' | 'maskable';
}

const JOBS: IconJob[] = [
  { file: 'icon-192.png', size: 192, mode: 'any' },
  { file: 'icon-512.png', size: 512, mode: 'any' },
  { file: 'icon-maskable-512.png', size: 512, mode: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, mode: 'full' },
  { file: 'favicon-32.png', size: 32, mode: 'any' },
];

/** Runs in the page. `P` = palette, `size` in px, `mode` = 'any' | 'full' | 'maskable'. Returns a PNG data URL. */
const DRAW = `
(function (P, size, mode) {
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext('2d');
  var S = size;

  // Background: dark theme colour, a little lighter in the middle. 'any' icons have rounded corners.
  ctx.save();
  if (mode === 'any') {
    var r = S * 0.2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(S, 0, S, S, r);
    ctx.arcTo(S, S, 0, S, r);
    ctx.arcTo(0, S, 0, 0, r);
    ctx.arcTo(0, 0, S, 0, r);
    ctx.closePath();
    ctx.clip();
  }
  var bg = ctx.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.78);
  bg.addColorStop(0, P.inkSoft);
  bg.addColorStop(1, P.ink);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // A row of sandbags along the bottom, as at the edge of a trench.
  var bagH = S * 0.085;
  var bagW = S * 0.19;
  for (var row = 0; row < 2; row++) {
    var y = S - bagH * (row + 1) + S * 0.005;
    var off = row % 2 === 0 ? 0 : -bagW / 2;
    for (var x = off; x < S; x += bagW) {
      ctx.beginPath();
      var rx = S * 0.03;
      ctx.moveTo(x + rx, y);
      ctx.arcTo(x + bagW, y, x + bagW, y + bagH, rx);
      ctx.arcTo(x + bagW, y + bagH, x, y + bagH, rx);
      ctx.arcTo(x, y + bagH, x, y, rx);
      ctx.arcTo(x, y, x + bagW, y, rx);
      ctx.closePath();
      ctx.fillStyle = row === 0 ? P.khakiDark : P.khaki;
      ctx.globalAlpha = row === 0 ? 0.85 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, S * 0.006);
      ctx.strokeStyle = P.ink;
      ctx.stroke();
    }
  }

  // The badge: an olive disc with a brass ring.
  var cx = S * 0.5;
  var cy = S * 0.47;
  var br = S * (mode === 'maskable' ? 0.3 : mode === 'full' ? 0.36 : 0.35);
  var disc = ctx.createRadialGradient(cx - br * 0.2, cy - br * 0.3, br * 0.1, cx, cy, br);
  disc.addColorStop(0, P.olive);
  disc.addColorStop(1, P.oliveDark);
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, S * 0.022);
  ctx.strokeStyle = P.brass;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, br * 0.9, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.6, S * 0.006);
  ctx.strokeStyle = P.ink;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // The Brodie helmet (the path of src/art/figure/parts.ts, head space), centred on the badge.
  var k = (br * 1.55) / 18;
  ctx.save();
  ctx.translate(cx, cy + 5.0 * k);
  ctx.scale(k, k);
  function brodie() {
    ctx.beginPath();
    ctx.moveTo(-9.0, -2.5);
    ctx.quadraticCurveTo(-8.7, -3.5, -6.0, -3.6);
    ctx.bezierCurveTo(-5.6, -8.9, 5.6, -8.9, 6.0, -3.6);
    ctx.quadraticCurveTo(8.7, -3.5, 9.0, -2.5);
    ctx.quadraticCurveTo(8.8, -2.1, 8.0, -2.3);
    ctx.quadraticCurveTo(0, -3.0, -8.0, -2.3);
    ctx.quadraticCurveTo(-8.8, -2.1, -9.0, -2.5);
    ctx.closePath();
  }
  // A soft shadow under the brim.
  ctx.save();
  ctx.translate(0, 1.4);
  brodie();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();
  // The dark rim round the helmet, as the game draws every figure part.
  brodie();
  ctx.lineWidth = 1.7;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.ink;
  ctx.stroke();
  ctx.fillStyle = P.ink;
  ctx.fill();
  // The shell, the crown highlight and the brim's dark underside.
  brodie();
  ctx.fillStyle = P.khaki;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(-1.2, -7.2, 3.6, 1.0, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = P.khakiLight;
  ctx.fill();
  ctx.fillStyle = P.khakiDark;
  ctx.fillRect(-10, -3.0, 20, 1.2);
  ctx.beginPath();
  ctx.moveTo(-5.8, -3.9);
  ctx.lineTo(5.8, -3.9);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = P.khakiShade;
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  ctx.restore();
  return canvas.toDataURL('image/png');
})
`;

async function main(): Promise<void> {
  const css = readFileSync(resolve(ROOT, 'src', 'ui', 'theme.css'), 'utf8');
  const khaki = themeColour(css, 'khaki');
  const palette = {
    ink: themeColour(css, 'ink'),
    inkSoft: themeColour(css, 'ink-soft'),
    olive: themeColour(css, 'olive'),
    oliveDark: themeColour(css, 'olive-dark'),
    khaki,
    khakiDark: themeColour(css, 'khaki-dark'),
    brass: themeColour(css, 'brass'),
    // The helmet's own highlight and shade are the khaki mixed with white and black (parts.ts does the same).
    khakiLight: mix(khaki, '#ffffff', 0.28),
    khakiShade: mix(themeColour(css, 'khaki-dark'), '#000000', 0.25),
  };
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    for (const job of JOBS) {
      const url = (await page.evaluate(`${DRAW}(${JSON.stringify(palette)}, ${job.size}, ${JSON.stringify(job.mode)})`)) as string;
      const png = Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
      writeFileSync(resolve(OUT, job.file), png);
      console.log(`${job.file}  ${job.size}x${job.size}  ${job.mode}  ${png.length} bytes`);
    }
  } finally {
    await browser.close();
  }
}

/** Mix two #rrggbb colours: share `t` of `b`. */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
