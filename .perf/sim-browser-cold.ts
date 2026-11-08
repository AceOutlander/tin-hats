/** Cold (first battle in a fresh page, JIT not warm) sim cost under CPU throttling, mean ms/tick per 1 s of battle. */
import { buildSync } from 'esbuild';
import { chromium } from 'playwright';
const rate = Number(process.argv[2] ?? 4);
const code = buildSync({ entryPoints: ['.perf/sim-browser-entry.ts'], bundle: true, format: 'iife', write: false, platform: 'browser' }).outputFiles[0].text;
const browser = await chromium.launch();
for (let k = 0; k < 3; k++) {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.setContent('<html><body>bench</body></html>');
  await page.addScriptTag({ content: code });
  const cold = await page.evaluate(() => (window as any).__simOnce(100, 600));
  const warm = await page.evaluate(() => (window as any).__simOnce(100, 600));
  const fmt = (r: { batches: number[]; worst: number }) => `${r.batches.slice(0, 12).map((x) => x.toFixed(2)).join(' ')} | worst tick ${r.worst.toFixed(1)}`;
  console.log(`x${rate} page ${k} cold: ${fmt(cold)}`);
  console.log(`x${rate} page ${k} warm: ${fmt(warm)}`);
  await page.close();
}
await browser.close();
