/**
 * Throwaway render probe (not part of the game). Serves .perf/dist (patched to expose window.__THVIEW), plays the
 * proving ground until it is busy, then times every Phaser layer's draw and the main UnitViews / effects methods per
 * frame, under a CPU throttle.
 *   x.cmd npx tsx .perf/probe.ts [--cpu=4] [--units=90] [--seconds=12] [--w=844 --h=390 --dsf=1]
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flags = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags.set(m[1], m[2] ?? 'true');
}
const cpu = Number(flags.get('cpu') ?? 4);
const wantUnits = Number(flags.get('units') ?? 90);
const seconds = Number(flags.get('seconds') ?? 12);
const width = Number(flags.get('w') ?? 844);
const height = Number(flags.get('h') ?? 390);
const dsf = Number(flags.get('dsf') ?? 1);
const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

const INSTRUMENT = `(() => {
  const v = window.__THVIEW, C = window.__THCLS;
  const P = window.__PROBE = { layers: {}, fns: {}, frames: 0, maxFrame: {}, cur: {} };
  const L = v.layers;
  const all = [];
  for (const [n, l] of Object.entries(L.byName)) all.push([n, l]);
  L.rows.forEach((l, i) => all.push(['unitRow' + i, l]));
  L.pips.forEach((l, i) => all.push(['pips' + i, l]));
  L.blood.forEach((l, i) => all.push(['blood' + i, l]));
  all.push(['glow', L.glow], ['lit', L.lit], ['grade', L.grade]);
  for (const [n, l] of all) {
    const orig = l._renderSteps[0];
    P.layers[n] = 0;
    l._renderSteps[0] = function () { const t = performance.now(); orig.apply(this, arguments); P.layers[n] += performance.now() - t; };
  }
  const wrap = (obj, name, label) => {
    const orig = obj[name];
    P.fns[label] = { ms: 0, calls: 0 };
    obj[name] = function () { const t = performance.now(); const r = orig.apply(this, arguments); const d = performance.now() - t; const f = P.fns[label]; f.ms += d; f.calls++; P.cur[label] = (P.cur[label] || 0) + d; return r; };
  };
  wrap(C.UnitViews.prototype, 'update', 'UnitViews.update');
  wrap(C.UnitViews.prototype, 'acquire', 'UnitViews.acquire');
  wrap(C.UnitViews.prototype, 'onDied', 'UnitViews.onDied');
  wrap(C.UnitViews.prototype, 'release', 'UnitViews.release');
  wrap(C.UnitViews.prototype, 'spreadCrowds', 'UnitViews.spreadCrowds');
  wrap(C.UnitViews.prototype, 'updateDying', 'UnitViews.updateDying');
  wrap(C.FigureView.prototype, 'draw', 'FigureView.draw');
  wrap(C.TankView.prototype, 'draw', 'TankView.draw');
  wrap(C.ParticleDrawer.prototype, 'draw', 'ParticleDrawer.draw');
  wrap(v.effects, 'update', 'EffectsSystem.update');
  wrap(v.backdrop, 'update', 'BackdropView.update');
  wrap(v.structures, 'update', 'StructureViews.update');
  wrap(v, 'afterStep', 'view.afterStep');
  wrap(v, 'render', 'view.render');
  // Per-frame maxima of the wrapped functions, sampled at post-render.
  v.game.events.on('postrender', () => {
    P.frames++;
    for (const [k, d] of Object.entries(P.cur)) { if (!(P.maxFrame[k] >= d)) P.maxFrame[k] = d; P.cur[k] = 0; }
  });
  P.reset = () => { for (const k in P.layers) P.layers[k] = 0; for (const k in P.fns) { P.fns[k].ms = 0; P.fns[k].calls = 0; } P.frames = 0; P.maxFrame = {}; P.cur = {}; };
})()`;

async function main(): Promise<void> {
  const server = await preview({ root: ROOT, logLevel: 'error', build: { outDir: '.perf/dist' }, preview: { port: 0, strictPort: false, host: '127.0.0.1' } });
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('page error', e.message));
    await page.goto(`http://127.0.0.1:${port}/?debug=1&quality=0`);
    await page.waitForFunction('window.__TH && window.__TH.ready === true', null, { timeout: 60_000 });
    const cdp = await context.newCDPSession(page);
    await page.evaluate('(() => { const th = window.__TH; th.autopilot(true); th.unlockAll(); th.startSandbox(1); th.grantPopulation(80); })()');
    await page.waitForFunction('window.__TH.state().inBattle', null, { timeout: 30_000 });
    await page.evaluate('window.__TH.setTimeScale(8)');
    const follow = `(() => { const th = window.__TH; th.grantSupplies(3000); const xs = []; for (const u of th.units()) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') xs.push(u.x); if (xs.length === 0) for (const u of th.units()) if (!u.inside) xs.push(u.x); if (xs.length) { xs.sort((a, b) => a - b); th.lookAt(xs[xs.length >> 1]); } let n = 0, f = 0; for (const u of th.units()) { n++; if (u.action === 'aim' || u.action === 'fire') f++; } return [n, f, th.field() ? th.field().gap : 99999]; })()`;
    const t0 = Date.now();
    for (;;) {
      const [n, f, gap] = (await page.evaluate(follow)) as [number, number, number];
      if (n >= wantUnits && f >= 5 && gap < 450) break;
      if (Date.now() - t0 > 300_000) throw new Error(`not heavy: ${n} units ${f} firing`);
      await sleep(300);
    }
    await page.evaluate('window.__TH.setTimeScale(1)');
    await sleep(2000);
    await page.evaluate(INSTRUMENT);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.evaluate('window.__PROBE.reset(); window.__THPERF.reset()');
    const counts: string[] = [];
    for (let s = 0; s < seconds; s++) {
      await page.evaluate(follow);
      await sleep(1000);
      if (s === Math.floor(seconds / 2)) counts.push(JSON.stringify(await page.evaluate('window.__THPERF.layers()')));
    }
    const probe = (await page.evaluate('JSON.parse(JSON.stringify(window.__PROBE))')) as {
      layers: Record<string, number>;
      fns: Record<string, { ms: number; calls: number }>;
      frames: number;
      maxFrame: Record<string, number>;
    };
    const rep = (await page.evaluate('window.__THPERF.report()')) as Record<string, { avg: number; p95: number; max: number }> & { frames: number; seconds: number };
    const stats = (await page.evaluate('window.__THPERF.stats()')) as Record<string, number>;
    const units = (await page.evaluate(follow)) as number[];
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const fr = Math.max(1, probe.frames);
    console.log(`cpu x${cpu} ${width}x${height} dsf ${dsf}: ${rep.frames} frames in ${rep.seconds.toFixed(1)} s (${(rep.frames / rep.seconds).toFixed(1)} fps), units now ${units[0]}`);
    console.log(`phases ms/frame avg (p95, max): render ${rep.render.avg.toFixed(2)} (${rep.render.p95.toFixed(1)}, ${rep.render.max.toFixed(1)})  draw ${rep.draw.avg.toFixed(2)} (${rep.draw.p95.toFixed(1)}, ${rep.draw.max.toFixed(1)})  sim ${rep.sim.avg.toFixed(2)}  after ${rep.after.avg.toFixed(2)}  hud ${rep.hud.avg.toFixed(2)}  interval ${rep.interval.avg.toFixed(1)} (${rep.interval.p95.toFixed(1)})`);
    console.log(`stats: images ${stats.images} visible ${stats.imagesVisible} unitViews ${stats.unitViews} drawn ${stats.unitViewsDrawn} particles ${stats.particles} live ${stats.particlesLive} tracers ${stats.tracers} blood ${stats.bloodPools} atlasPages ${stats.atlasPages} atlasPx ${stats.atlasPixels} canvas ${stats.canvasW}x${stats.canvasH} dpr ${stats.dpr} quality ${stats.quality}`);
    let layerTotal = 0;
    for (const v of Object.values(probe.layers)) layerTotal += v;
    console.log(`Phaser layer draw (JS submit) total ${(layerTotal / fr).toFixed(2)} ms/frame:`);
    for (const [k, v] of Object.entries(probe.layers).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${k.padEnd(16)} ${(v / fr).toFixed(3)} ms/frame`);
    console.log('wrapped functions (ms/frame avg, calls/frame, worst frame ms):');
    for (const [k, v] of Object.entries(probe.fns).sort((a, b) => b[1].ms - a[1].ms)) console.log(`  ${k.padEnd(24)} ${(v.ms / fr).toFixed(3)}  calls ${(v.calls / fr).toFixed(1)}  worst ${(probe.maxFrame[k] ?? 0).toFixed(2)}  per-call ${(v.ms / Math.max(1, v.calls)).toFixed(4)}`);
    console.log('layers mid-window:', counts[0]);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});

