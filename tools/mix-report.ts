/**
 * The menu mix in numbers, for tuning src/data/music.ts, src/data/menuStorm.ts and the default sliders without a
 * browser window: renders the music, the rain bed and a thunder like dev/music-preview.html does and prints the
 * measurements (full range and through the phone speaker model) against the targets.
 *
 *   x.cmd npx tsx tools/mix-report.ts
 */
import { chromium } from '@playwright/test';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { MixReport } from '../src/audio/music';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
  const port = await freePort();
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.tools', 'vite-cache', `mix-${process.pid}`),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/dev/music-preview.html`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 180_000 });
    const out = await page.evaluate(() => (window as unknown as { __music?: { track: Record<string, number>; mix: MixReport } }).__music ?? null);
    if (!out) {
      console.log(`no measurements; page errors: ${errors.join('; ')}`);
      return 1;
    }
    const { track, mix } = out;
    // --precise prints three decimals (to show that two runs agree exactly, not just to the tenth).
    const digits = process.argv.includes('--precise') ? 3 : 1;
    const f = (n: number): string => n.toFixed(digits).padStart(digits + 5);
    console.log(`track: ${track.seconds.toFixed(1)} s, rendered in ${track.renderMs.toFixed(0)} ms, raw peak ${track.rawPeak.toFixed(3)}`);
    console.log(`sliders music ${mix.sliders.music}, ambience ${mix.sliders.ambience}, sfx ${mix.sliders.sfx}; thunder loudness ${mix.thunderLoudness.toFixed(2)}`);
    console.log('                                  full   phone');
    const row = (name: string, key: keyof MixReport['full']): void => console.log(`${name.padEnd(32)}${f(mix.full[key])}  ${f(mix.phone[key])}`);
    row('music LUFS', 'musicLufs');
    row('rain LUFS', 'rainLufs');
    row('music over rain LU', 'musicOverRain');
    row('bed momentary max', 'bedMomentary');
    row('bed short-term max', 'bedShortTerm');
    row('bed peak dB', 'bedPeakDb');
    row('thunder momentary max', 'thunderMomentary');
    row('thunder short-term max', 'thunderShortTerm');
    row('thunder peak dB', 'thunderPeakDb');
    row('thunder momentary over bed', 'thunderMomentaryOverBed');
    row('thunder short-term over bed', 'thunderShortTermOverBed');
    row('thunder peak over bed', 'thunderPeakOverBed');
    const c = mix.chain;
    const a = mix.chainAtFull;
    const p = digits + 1;
    console.log(`chain at defaults: output peak ${c.outputPeak.toFixed(p)}, bed reduction ${c.bedReductionDb.toFixed(digits)} dB, max ${c.maxReductionDb.toFixed(digits)} dB, ${c.pumpSeconds.toFixed(2)} s pumping`);
    console.log(`chain at full:     output peak ${a.outputPeak.toFixed(p)}, bed reduction ${a.bedReductionDb.toFixed(digits)} dB, max ${a.maxReductionDb.toFixed(digits)} dB, ${a.pumpSeconds.toFixed(2)} s pumping`);
    if (process.argv.includes('--series')) {
      console.log(`reduction at defaults, every 0.05 s: ${c.series.map((r) => r.toFixed(1)).join(' ')}`);
    }
    console.log(mix.pass ? 'PASS: every mix target met' : `FAIL:\n  ${mix.failures.join('\n  ')}`);
    return mix.pass ? 0 : 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
