/**
 * Performance harness: plays a heavy battle in the BUILT game (headless Chromium, software WebGL) through the debug
 * hooks and reports the JavaScript cost of a frame, split into sim step, view afterStep, view render and HUD update,
 * plus Phaser's own draw, the live object counts and the JS heap. GPU time is meaningless on software WebGL, so only
 * JS cost is judged: sim + afterStep + render + HUD must average under the budget (default 6 ms).
 *
 *   x.cmd npm run build                     (or build somewhere else, see --dist)
 *   x.cmd npx tsx tools/perf.ts [flags]
 *
 * --scene=mission|sandbox   mission (default) plays the campaign mission --mission=1010; sandbox is the proving ground
 * --mission=1010 --seed=1 --difficulty=normal
 * --units=80      fast-forward (effects off) until this many units are alive ...
 * --fighting=4    ... this many of them are aiming, firing or reloading ...
 * --gap=450       ... and the two front lines are within this many wu of each other; then play at real speed
 * --rain          force rain for the whole run (hundreds of streaks and splashes: the heaviest steady effect)
 * --nofeed        do not top up the player's supplies and population cap (by default the test bot is fed so the
 *                 battle stays big for the whole window)
 * --seconds=30    length of the measured window in real time
 * --warmup=4      seconds of real-time play before the window (effect pools grow, JIT warms up)
 * --dist=dist     build folder to serve (an unminified build gives readable names for --profile:
 *                 x.cmd npx vite build --outDir .tools/perf-dist --minify false --emptyOutDir)
 * --cpu=1         CPU throttle factor (4 is roughly a mid-range phone)
 * --quality=auto|0|1|2   pin an effect quality level (default auto = the frame-time governor decides; the game itself
 *                 pins level 0 under browser automation unless the page asks for ?quality=auto)
 * --w=844 --h=390 --dsf=1   viewport (CSS px) and device pixel ratio
 * --budget=6      exit code 1 when the average JS ms per frame is not under this
 * --profile       CPU-profile the window and print the busiest functions
 * --allocs        sample the allocations of the window (also the ones already collected) and print the biggest allocating functions
 * --json=file     also write the result as JSON
 */
import { chromium, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import type { DebugApi } from '../src/app/debug';
import type { PerfHook } from '../src/render/view';
import type { PerfReport } from '../src/render/perf';
import type { Difficulty } from '../src/data/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Hooked = { __TH: DebugApi; __THPERF: PerfHook; __heap: { last: number; allocated: number; drops: number; samples: number } };

function parseFlags(): Map<string, string> {
  const flags = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq < 0) flags.set(a.slice(2), 'true');
    else flags.set(a.slice(2, eq), a.slice(eq + 1));
  }
  return flags;
}

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

interface Sample {
  t: number;
  unitsMine: number;
  unitsTheirs: number;
  images: number;
  visible: number;
  particles: number;
  particlesLive: number;
  tracers: number;
  unitViews: number;
  unitViewsDrawn: number;
  quality: number;
  heapMB: number;
}

interface Result {
  scene: string;
  viewport: string;
  cpu: number;
  report: PerfReport;
  fps: number;
  /** Main-thread CPU and script milliseconds per frame over the window (CPU time: other programs on the machine do not count). */
  cpuMsPerFrame: number;
  scriptMsPerFrame: number;
  stepMsPerTick: number;
  units: { avg: number; min: number; max: number };
  live: { images: number; visible: number; particlesPeak: number; particlesAvg: number; tracersPeak: number; unitViews: number; unitViewsDrawn: number };
  quality: { final: number; drops: number; raises: number };
  heap: { retainedMBPerMin: number; allocatedMBPerSec: number; gcs: number; startMB: number; endMB: number };
  longTasks: number;
  ended: boolean;
}

async function heapMB(cdp: CDPSession, collect: boolean): Promise<number> {
  if (collect) await cdp.send('HeapProfiler.collectGarbage');
  const usage = await cdp.send('Runtime.getHeapUsage');
  return usage.usedSize / (1024 * 1024);
}

/** Main-thread CPU and script seconds so far (CDP Performance domain). ThreadTime is CPU time, so other programs taking the core do not count. */
async function threadMetrics(cdp: CDPSession): Promise<{ thread: number; script: number }> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name: string): number => metrics.find((m) => m.name === name)?.value ?? 0;
  return { thread: get('ThreadTime'), script: get('ScriptDuration') };
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits).padStart(6 + (digits > 2 ? 1 : 0));
}

function row(label: string, s: { avg: number; p95: number; max: number }): string {
  return `  ${label.padEnd(30)} avg ${fmt(s.avg)}   p95 ${fmt(s.p95)}   max ${fmt(s.max)}`;
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
}

function printProfile(profile: { nodes: ProfileNode[]; samples?: number[]; timeDeltas?: number[] }): void {
  const byId = new Map<number, ProfileNode>();
  for (const n of profile.nodes) byId.set(n.id, n);
  const self = new Map<string, number>();
  let total = 0;
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i++) {
    const node = byId.get(samples[i]);
    if (!node) continue;
    const dt = (deltas[i + 1] ?? deltas[i] ?? 0) / 1000;
    const cf = node.callFrame;
    const key = `${cf.functionName || '(anonymous)'}  ${cf.url.split('/').pop() ?? ''}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + dt);
    total += dt;
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log(`\nCPU profile: ${total.toFixed(0)} ms sampled; busiest functions by self time`);
  for (const [key, ms] of top) console.log(`  ${((ms / total) * 100).toFixed(1).padStart(5)}%  ${ms.toFixed(0).padStart(6)} ms  ${key}`);
}

interface AllocNode {
  callFrame: { functionName: string; url: string; lineNumber: number };
  selfSize: number;
  children: AllocNode[];
}

function printAllocs(head: AllocNode, seconds: number): void {
  const bySite = new Map<string, number>();
  let total = 0;
  const stack: AllocNode[] = [head];
  while (stack.length > 0) {
    const node = stack.pop() as AllocNode;
    if (node.selfSize > 0) {
      const cf = node.callFrame;
      const key = `${cf.functionName || '(anonymous)'}  ${cf.url.split('/').pop() ?? ''}:${cf.lineNumber + 1}`;
      bySite.set(key, (bySite.get(key) ?? 0) + node.selfSize);
      total += node.selfSize;
    }
    for (const c of node.children) stack.push(c);
  }
  const top = [...bySite.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log(`\nAllocation sampling: ${(total / (1024 * 1024)).toFixed(1)} MB sampled over ${seconds.toFixed(0)} s; biggest allocating functions`);
  for (const [key, bytes] of top) console.log(`  ${((bytes / total) * 100).toFixed(1).padStart(5)}%  ${(bytes / 1024 / seconds).toFixed(1).padStart(8)} KB/s  ${key}`);
}

async function main(): Promise<number> {
  const flags = parseFlags();
  const scene = flags.get('scene') ?? 'mission';
  const missionId = Number(flags.get('mission') ?? 1010);
  const seed = Number(flags.get('seed') ?? 1);
  const difficulty = (flags.get('difficulty') ?? 'normal') as Difficulty;
  const wantUnits = Number(flags.get('units') ?? 80);
  const wantFighting = Number(flags.get('fighting') ?? 4);
  const wantGap = Number(flags.get('gap') ?? 450);
  const ffScale = Number(flags.get('ff') ?? 20);
  const seconds = Number(flags.get('seconds') ?? 30);
  const warmup = Number(flags.get('warmup') ?? 4);
  const dist = flags.get('dist') ?? 'dist';
  const cpu = Number(flags.get('cpu') ?? 1);
  const quality = flags.get('quality') ?? 'auto';
  const width = Number(flags.get('w') ?? 844);
  const height = Number(flags.get('h') ?? 390);
  const dsf = Number(flags.get('dsf') ?? 1);
  const budget = Number(flags.get('budget') ?? 6);
  const profile = flags.has('profile');
  const allocs = flags.has('allocs');

  const server = await preview({
    root: ROOT,
    logLevel: 'error',
    build: { outDir: dist },
    preview: { port: 0, strictPort: false, host: '127.0.0.1' },
  });
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 4173;

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info'],
  });
  let exit = 0;
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
    const page: Page = await context.newPage();
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/?debug=1&quality=${quality}`);
    await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await cdp.send('Profiler.enable');
    await cdp.send('Performance.enable');

    // Long tasks (anything over 50 ms on the main thread) and heap polling inside the page.
    await page.evaluate(() => {
      const w = window as unknown as Hooked & { __longTasks: number };
      w.__longTasks = 0;
      try {
        new PerformanceObserver((list) => {
          w.__longTasks += list.getEntries().length;
        }).observe({ entryTypes: ['longtask'] });
      } catch {
        // Not supported: the count stays 0.
      }
      // performance.memory hands out a fresh snapshot on every read. (No named inner functions in page code: the
      // bundler's name helper does not exist inside the page.)
      const perfMem = performance as unknown as { memory?: { usedJSHeapSize: number } };
      w.__heap = { last: perfMem.memory?.usedJSHeapSize ?? 0, allocated: 0, drops: 0, samples: 0 };
      setInterval(() => {
        const now = perfMem.memory?.usedJSHeapSize ?? 0;
        if (now >= w.__heap.last) w.__heap.allocated += now - w.__heap.last;
        else w.__heap.drops++;
        w.__heap.last = now;
        w.__heap.samples++;
      }, 50);
    });

    // --- the heavy scene ---
    const startScene = (): Promise<void> =>
      page.evaluate(
        ([kind, id, s, d, feed]) => {
          const th = (window as unknown as Hooked).__TH;
          th.autopilot(true);
          th.unlockAll();
          if (kind === 'sandbox') th.startSandbox(s as number);
          else th.startMission(id as number, d as Difficulty, s as number);
          if (feed) th.grantPopulation(80);
        },
        [scene, missionId, seed, difficulty, !flags.has('nofeed')] as [string, number, number, string, boolean],
      );
    await startScene();
    await page.waitForFunction(() => (window as unknown as Hooked).__TH.state().inBattle, null, { timeout: 30_000 });

    const alive = (): Promise<{ mine: number; theirs: number; fighting: number; gap: number; over: boolean; time: number }> =>
      page.evaluate(() => {
        const th = (window as unknown as Hooked).__TH;
        const st = th.state();
        let mine = 0;
        let theirs = 0;
        for (const k of Object.keys(st.units[0])) {
          mine += (st.units[0] as Record<string, number>)[k];
          theirs += (st.units[1] as Record<string, number>)[k];
        }
        let fighting = 0;
        for (const u of th.units()) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') fighting++;
        const gap = th.field()?.gap ?? 99999;
        return { mine, theirs, fighting, gap, over: st.over, time: st.time };
      });

    // Keep the player's bot fed and the camera on the fighting, so the scene stays heavy for the whole window.
    const follow = (): Promise<void> =>
      page.evaluate((feed) => {
        const th = (window as unknown as Hooked).__TH;
        if (feed) th.grantSupplies(3000);
        // Look at the middle of the fighting: the median x of the men who are aiming, firing or reloading
        // (everyone out in the open when nobody is).
        const xs: number[] = [];
        const units = th.units();
        for (const u of units) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') xs.push(u.x);
        if (xs.length === 0) for (const u of units) if (!u.inside) xs.push(u.x);
        if (xs.length > 0) {
          xs.sort((p, q) => p - q);
          th.lookAt(xs[Math.floor(xs.length / 2)]);
        }
      }, !flags.has('nofeed'));

    if (flags.has('rain')) await page.evaluate(() => (window as unknown as Hooked).__TH.forceWeather('rain'));
    const setScale = (k: number): Promise<void> => page.evaluate((v) => (window as unknown as Hooked).__TH.setTimeScale(v), k);
    const heapCounters = (): Promise<{ allocated: number; drops: number; longTasks: number }> =>
      page.evaluate(() => {
        const w = window as unknown as Hooked & { __longTasks: number };
        return { allocated: w.__heap.allocated, drops: w.__heap.drops, longTasks: w.__longTasks };
      });

    /**
     * Fast-forward (effects off; the frame probe leaves those frames out) until the battle is heavy: enough units
     * alive and enough of them aiming or firing. A battle that ends first is started again.
     */
    const reachHeavy = async (): Promise<void> => {
      const start = Date.now();
      await setScale(ffScale);
      let a = await alive();
      while (a.mine + a.theirs < wantUnits || a.fighting < wantFighting || a.gap > wantGap) {
        if (Date.now() - start > 240_000) throw new Error('the battle never became heavy enough (try lower --units, --fighting or a wider --gap)');
        if (a.over) {
          await startScene();
        } else {
          await sleep(150);
          await follow();
        }
        a = await alive();
        if (flags.has('trace')) console.log(`  t=${a.time.toFixed(0)} s units ${a.mine}+${a.theirs} fighting ${a.fighting} gap ${a.gap.toFixed(0)}`);
      }
      await setScale(1);
      console.log(
        `heavy after ${((Date.now() - start) / 1000).toFixed(1)} s: ${a.mine} + ${a.theirs} units (${a.fighting} aiming or firing), battle time ${a.time.toFixed(0)} s`,
      );
    };

    await reachHeavy();
    for (let t = 0; t < warmup; t++) {
      await follow();
      await sleep(1000);
    }
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.evaluate(() => (window as unknown as Hooked).__THPERF.reset());
    const heapStart = await heapMB(cdp, true);
    const counters = await heapCounters();
    const cpuStart = await threadMetrics(cdp);
    let allocated = 0;
    let drops = 0;
    let longTasks = 0;
    if (profile) {
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
    }
    if (allocs) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const samples: Sample[] = [];
    let played = 0;
    let ended = false;
    while (played < seconds) {
      const second = Date.now();
      await follow();
      await sleep(1000);
      played += (Date.now() - second) / 1000;
      const s = await page.evaluate(() => {
        const w = window as unknown as Hooked;
        const st = w.__TH.state();
        const rs = w.__THPERF.stats();
        let mine = 0;
        let theirs = 0;
        for (const k of Object.keys(st.units[0])) {
          mine += (st.units[0] as Record<string, number>)[k];
          theirs += (st.units[1] as Record<string, number>)[k];
        }
        return {
          over: st.over,
          sample: {
            t: 0,
            unitsMine: mine,
            unitsTheirs: theirs,
            images: rs.images,
            visible: rs.imagesVisible,
            particles: rs.particles,
            particlesLive: rs.particlesLive,
            tracers: rs.tracers,
            unitViews: rs.unitViews,
            unitViewsDrawn: rs.unitViewsDrawn,
            quality: rs.quality,
            heapMB: 0,
          },
        };
      });
      s.sample.t = played;
      if (flags.has('trace')) console.log(`  play ${played.toFixed(1)} s: frames ${(await page.evaluate(() => (window as unknown as Hooked).__THPERF.report().frames))} units ${s.sample.unitsMine + s.sample.unitsTheirs} over ${String(s.over)}`);
      samples.push(s.sample);
      if (s.over) {
        ended = true;
        break;
      }
    }
    const cpuEnd = await threadMetrics(cdp);
    const now = await heapCounters();
    allocated += now.allocated - counters.allocated;
    drops += now.drops - counters.drops;
    longTasks += now.longTasks - counters.longTasks;
    const elapsed = played;
    let cpuProfile: { nodes: ProfileNode[]; samples?: number[]; timeDeltas?: number[] } | null = null;
    if (profile) cpuProfile = (await cdp.send('Profiler.stop')).profile;
    let allocProfile: AllocNode | null = null;
    if (allocs) allocProfile = (await cdp.send('HeapProfiler.stopSampling')).profile.head;
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const report = await page.evaluate(() => (window as unknown as Hooked).__THPERF.report());
    const quality1 = await page.evaluate(() => (window as unknown as Hooked).__THPERF.quality());
    const finalStats = await page.evaluate(() => (window as unknown as Hooked).__THPERF.stats());
    const stepMsPerTick = await page.evaluate(() => (window as unknown as Hooked).__TH.perf().stepMsAvg);
    const layers = await page.evaluate(() => (window as unknown as Hooked).__THPERF.layers());
    const heapEnd = await heapMB(cdp, true);
    const sum = (f: (s: Sample) => number): number => samples.reduce((x, s) => x + f(s), 0);
    const maxOf = (f: (s: Sample) => number): number => samples.reduce((x, s) => Math.max(x, f(s)), 0);
    const n = Math.max(1, samples.length);
    const unitTotals = samples.map((s) => s.unitsMine + s.unitsTheirs);
    const result: Result = {
      scene: scene === 'sandbox' ? `proving ground, seed ${seed}` : `mission ${missionId} ${difficulty}, seed ${seed}`,
      viewport: `${width}x${height} dsf ${dsf}`,
      cpu,
      report,
      fps: elapsed > 0 ? report.frames / elapsed : 0,
      cpuMsPerFrame: ((cpuEnd.thread - cpuStart.thread) * 1000) / Math.max(1, report.frames),
      scriptMsPerFrame: ((cpuEnd.script - cpuStart.script) * 1000) / Math.max(1, report.frames),
      stepMsPerTick,
      units: { avg: sum((s) => s.unitsMine + s.unitsTheirs) / n, min: Math.min(...unitTotals), max: Math.max(...unitTotals) },
      live: {
        images: Math.round(sum((s) => s.images) / n),
        visible: Math.round(sum((s) => s.visible) / n),
        particlesPeak: maxOf((s) => s.particlesLive),
        particlesAvg: Math.round(sum((s) => s.particlesLive) / n),
        tracersPeak: maxOf((s) => s.tracers),
        unitViews: Math.round(sum((s) => s.unitViews) / n),
        unitViewsDrawn: Math.round(sum((s) => s.unitViewsDrawn) / n),
      },
      quality: { final: quality1.level, drops: quality1.drops, raises: quality1.raises },
      heap: {
        retainedMBPerMin: ((heapEnd - heapStart) / elapsed) * 60,
        allocatedMBPerSec: allocated / (1024 * 1024) / elapsed,
        gcs: drops,
        startMB: heapStart,
        endMB: heapEnd,
      },
      longTasks,
      ended,
    };

    console.log(`\n${result.scene}, ${result.viewport}, cpu x${cpu}, quality ${quality}${ended ? ' (the battle ended inside the window)' : ''}`);
    console.log(`${report.frames} frames over ${elapsed.toFixed(1)} s of play (${result.fps.toFixed(1)} fps), ${report.stepsPerFrame.toFixed(2)} sim steps per frame, ${stepMsPerTick.toFixed(3)} ms per step (smoothed)`);
    console.log('JS milliseconds per frame');
    console.log(row('sim step (input, steps, app)', report.sim));
    console.log(row('view afterStep (events)', report.after));
    console.log(row('view render (layout)', report.render));
    console.log(row('HUD update', report.hud));
    console.log(row('SIM + RENDER + HUD (budget)', report.js));
    console.log(row('Phaser draw (informational)', report.draw));
    console.log(row('frame interval', report.interval));
    // Under CPU throttling Chrome stretches tasks with idle waits: ThreadTime stays real CPU time while ScriptDuration is
    // wall time, so the script figure is then the larger one and is labelled as such.
    const scriptNote = cpu > 1 ? `script wall time ${result.scriptMsPerFrame.toFixed(2)} ms, stretched by the x${cpu} throttle` : `of which script ${result.scriptMsPerFrame.toFixed(2)} ms`;
    console.log(`  main thread CPU per frame      ${result.cpuMsPerFrame.toFixed(2)} ms (${scriptNote}) (CPU time, so other programs on the machine do not inflate it)`);
    console.log(
      `live objects: ${result.units.avg.toFixed(0)} units (${result.units.min} to ${result.units.max}), ${result.live.unitViews} unit views (${result.live.unitViewsDrawn} drawn), ` +
        `${result.live.images} images (${result.live.visible} visible), particles avg ${result.live.particlesAvg} peak ${result.live.particlesPeak}, tracers peak ${result.live.tracersPeak}`,
    );
    console.log(
      `heap: ${result.heap.startMB.toFixed(1)} -> ${result.heap.endMB.toFixed(1)} MB after GC (${result.heap.retainedMBPerMin >= 0 ? '+' : ''}${result.heap.retainedMBPerMin.toFixed(2)} MB/min retained), ` +
        `about ${result.heap.allocatedMBPerSec.toFixed(2)} MB/s allocated, ${result.heap.gcs} collections, ${result.longTasks} long tasks`,
    );
    const busy = layers.filter((l) => l.total >= 25).sort((p, q) => q.total - p.total);
    console.log(`game objects by layer (total/visible): ${busy.map((l) => `${l.name} ${l.total}/${l.visible}`).join(', ')}`);
    console.log(`quality: level ${result.quality.final} (${result.quality.drops} drops, ${result.quality.raises} raises), canvas ${finalStats.canvasW}x${finalStats.canvasH} px (pixel ratio ${finalStats.dpr})`);
    if (problems.length > 0) console.log(`PAGE PROBLEMS:\n  ${problems.join('\n  ')}`);
    const pass = report.js.avg < budget;
    console.log(`${pass ? 'PASS' : 'FAIL'}: average JS ${report.js.avg.toFixed(2)} ms per frame against a budget of ${budget} ms`);
    if (!pass) exit = 1;
    if (problems.length > 0) exit = 1;
    if (cpuProfile) printProfile(cpuProfile);
    if (allocProfile) printAllocs(allocProfile, elapsed);
    const jsonOut = flags.get('json');
    if (jsonOut) {
      mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
      writeFileSync(resolve(jsonOut), JSON.stringify(result, null, 2));
    }
  } finally {
    await browser.close();
    await new Promise<void>((ok) => server.httpServer.close(() => ok()));
  }
  return exit;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
