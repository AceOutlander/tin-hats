/**
 * A battle track in numbers, for composing and tuning src/data/musicTracks without a browser window: renders it piece
 * by piece in headless Chromium as the game does (dev/music-preview.html?battle=<track>) and prints the render times,
 * memory, levels and the mix against the army of 80.
 *
 *   x.cmd npx tsx tools/battle-music-report.ts [track] [--pieces]
 *   x.cmd npx tsx tools/battle-music-report.ts <menu|map|stalingradMap> --loop    (a looping track: render time, size)
 */
import { chromium, type Page } from '@playwright/test';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { BattleMixReport } from '../src/audio/music/battleMix';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Report {
  track: string;
  pieces: number;
  bytes: number;
  budgetBytes: number;
  distinctSeconds: number;
  renderMs: number;
  firstMs: number;
  buildMsMax: number;
  peakDb: number;
  rows: { piece: string; seconds: number; buildMs: number; renderMs: number; peakDb: number; rmsDb: number }[];
  mix: BattleMixReport | null;
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createNetServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => ok(port));
    });
  });
}

async function main(): Promise<number> {
  const track = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'arras';
  const port = await freePort();
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.tools', 'vite-cache', `battle-music-${process.pid}`),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (process.argv.includes('--loop')) return await loopReport(page, port, track, errors);
    await page.goto(`http://127.0.0.1:${port}/dev/music-preview.html?battle=${encodeURIComponent(track)}`);
    await page.waitForFunction(() => (window as unknown as { __battleReady?: boolean }).__battleReady === true, null, { timeout: 300_000 });
    const out = await page.evaluate(() => (window as unknown as { __battle?: Report }).__battle ?? null);
    const err = await page.evaluate(() => (window as unknown as { __battleError?: string }).__battleError ?? null);
    if (!out) {
      console.log(`no measurements: ${err ?? ''} ${errors.join('; ')}`);
      return 1;
    }
    console.log(`${out.track}: ${out.pieces} pieces, ${(out.bytes / 1e6).toFixed(2)} MB held (computed ${(out.budgetBytes / 1e6).toFixed(2)} MB), ${out.distinctSeconds.toFixed(0)} s distinct`);
    console.log(`render ${(out.renderMs / 1000).toFixed(2)} s wall clock, first piece ${out.firstMs.toFixed(0)} ms, longest graph build ${out.buildMsMax.toFixed(1)} ms, loudest piece ${out.peakDb.toFixed(2)} dBFS`);
    if (process.argv.includes('--pieces')) {
      for (const r of out.rows) console.log(`  ${r.piece.padEnd(44)} ${r.seconds.toFixed(1).padStart(5)} s  build ${r.buildMs.toFixed(1).padStart(5)} ms  render ${r.renderMs.toFixed(0).padStart(5)} ms  peak ${r.peakDb.toFixed(1).padStart(6)}  rms ${r.rmsDb.toFixed(1).padStart(6)}`);
    }
    const m = out.mix;
    if (m) {
      console.log(`army of 80: ${m.army.fullLufs.toFixed(1)} LUFS full, ${m.army.phoneLufs.toFixed(1)} phone, peak ${m.army.peakDb.toFixed(1)} dB`);
      for (const l of m.layers) {
        console.log(`  ${l.layer.padEnd(7)} music ${l.fullLufs.toFixed(1)} / ${l.phoneLufs.toFixed(1)} LUFS, army over it ${l.armyOverFull.toFixed(1)} / ${l.armyOverPhone.toFixed(1)} LU, peak ${l.peakDb.toFixed(1)} dBFS`);
      }
      console.log(`stings peak ${m.stingPeakDb.toFixed(1)} dBFS`);
      console.log(m.pass ? 'PASS: every mix target met' : `FAIL:\n  ${m.failures.join('\n  ')}`);
    }
    if (errors.length > 0) console.log(`page errors: ${errors.join('; ')}`);
    return m && m.pass && errors.length === 0 ? 0 : 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** A looping track (menu or campaign map): rendered once as the game does, its length, size and render time. */
async function loopReport(page: Page, port: number, track: string, errors: string[]): Promise<number> {
  await page.goto(`http://127.0.0.1:${port}/dev/music-preview.html?loop=${encodeURIComponent(track)}`);
  await page.waitForFunction(() => (window as unknown as { __loopReady?: boolean }).__loopReady === true, null, { timeout: 300_000 });
  const out = await page.evaluate(
    () => (window as unknown as { __loop?: { track: string; seconds: number; bytes: number; renderMs: number; buildMs: number; rawPeak: number } }).__loop ?? null,
  );
  if (!out) {
    console.log(`no measurements: ${errors.join('; ')}`);
    return 1;
  }
  console.log(`${out.track}: ${out.seconds.toFixed(1)} s loop, ${(out.bytes / 1e6).toFixed(2)} MB, rendered in ${out.renderMs.toFixed(0)} ms (graph ${out.buildMs.toFixed(0)} ms), peak before levelling ${out.rawPeak.toFixed(2)}`);
  if (errors.length > 0) console.log(`page errors: ${errors.join('; ')}`);
  return errors.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
