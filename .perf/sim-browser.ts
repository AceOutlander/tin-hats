/** Run the sim bench inside headless Chromium with CDP CPU throttling.
 *   $env:PLAYWRIGHT_BROWSERS_PATH='C:\dev\tin-hats\.tools\ms-playwright'; node --import tsx .perf/sim-browser.ts [rates=1,4,6]
 */
import { buildSync } from 'esbuild';
import { chromium } from 'playwright';
const rates = (process.argv[2] ?? '1,4,6').split(',').map(Number);
const out = buildSync({ entryPoints: ['.perf/sim-browser-entry.ts'], bundle: true, format: 'iife', write: false, platform: 'browser' });
const code = out.outputFiles[0].text;
const browser = await chromium.launch();
for (const rate of rates) {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await page.setContent('<html><body>bench</body></html>');
  await page.addScriptTag({ content: code });
  await page.evaluate(() => (window as any).__simBench(100, 1, 600)); // warm-up unthrottled JIT
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  console.log(`-- CPU throttle x${rate} (per-tick min of 4 replays, ms) --`);
  for (const n of [50, 80, 100, 140]) {
    const r = await page.evaluate((n) => (window as any).__simBench(n, 4, 600), n);
    console.log(`N=${n}/side: heavy (>=80% alive, ${r.heavyTicks} ticks) mean ${r.heavyMean.toFixed(3)} p95 ${r.heavyP95.toFixed(3)} max ${r.heavyMax.toFixed(3)} | all ticks mean ${r.allMean.toFixed(3)} max ${r.allMax.toFixed(3)}`);
  }
  await page.close();
}
await browser.close();
