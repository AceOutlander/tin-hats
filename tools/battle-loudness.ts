/**
 * Battle sounds through the real audio engine, measured, for one or more source trees side by side: a rifle shot, a
 * machine-gun burst, a large explosion, the tank gun, a UI click, the battle rain loop, battle thunder, the stings and
 * an army of 80 firing (dev/battle-loudness.html renders them offline and reads peak, K-weighted loudness and the
 * compressor's gain reduction).
 *
 *   x.cmd npx tsx tools/battle-loudness.ts [--trees=now:/,ref:/.tools/wt-ref/] [--sliders=default|full]
 *
 * Each tree is a folder under the project root that holds a src/ (for example a git worktree of an older commit under
 * .tools); the first one is compared with every other.
 */
import { chromium } from '@playwright/test';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import type { BattleMeasure } from '../dev/battle-loudness';

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
  const arg = (name: string, fallback: string): string => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const trees = arg('trees', 'now:/').split(',').map((t) => {
    const at = t.indexOf(':');
    return { name: t.slice(0, at), root: t.slice(at + 1) };
  });
  const sliders = arg('sliders', 'default');
  // --menu measures the title's own sounds through the engine instead (rain bed, thunder, music).
  const menu = process.argv.includes('--menu') ? '&menu=1' : '';
  const port = await freePort();
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.tools', 'vite-cache', `battle-${process.pid}`),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const browser = await chromium.launch();
  const results = new Map<string, BattleMeasure[]>();
  try {
    for (const tree of trees) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/dev/battle-loudness.html?root=${encodeURIComponent(tree.root)}&sliders=${sliders}${menu}`);
      await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 300_000 });
      const err = await page.evaluate(() => (window as unknown as { __battleError?: string }).__battleError ?? null);
      if (err || errors.length > 0) throw new Error(`${tree.name}: ${err ?? ''} ${errors.join('; ')}`);
      results.set(tree.name, await page.evaluate(() => (window as unknown as { __battle: BattleMeasure[] }).__battle));
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const f = (n: number): string => n.toFixed(2).padStart(7);
  console.log(`sliders: ${sliders}; peak dB / integrated LUFS / loudest momentary LUFS / compressor max and mean gain reduction dB`);
  const first = results.get(trees[0].name) ?? [];
  for (let i = 0; i < first.length; i++) {
    console.log(first[i].name);
    for (const tree of trees) {
      const m = (results.get(tree.name) ?? [])[i];
      const base = first[i];
      const diff = tree === trees[0] ? '' : `   diff peak ${f(m.peakDb - base.peakDb)} loudness ${f(m.lufs - base.lufs)}`;
      console.log(`  ${tree.name.padEnd(8)}${f(m.peakDb)} ${f(m.lufs)} ${f(m.momentaryMax)}   GR ${f(m.maxReductionDb)} ${f(m.meanReductionDb)}   over knee ${f(m.overKnee)}%${diff}`);
    }
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
