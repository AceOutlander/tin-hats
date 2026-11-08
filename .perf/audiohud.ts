/**
 * Throwaway audit harness (audio + DOM HUD). Dev server (readable URLs), audio unlocked by a real click, heavy battle,
 * CPU throttled. Phase A: baseline window after the battle music is fully rendered. Phase B: the same battle while the
 * engine's battle-music render loop runs again (exactly what happens in the first minutes of every battle).
 *
 *   x.cmd npx tsx .perf/audiohud.ts [--cpu=4] [--seconds=15] [--mission=10] [--units=120]
 */
import { chromium, type CDPSession } from '@playwright/test';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flags = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const eq = a.indexOf('=');
  if (a.startsWith('--')) flags.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? 'true' : a.slice(eq + 1));
}
const CPU = Number(flags.get('cpu') ?? 4);
const SECONDS = Number(flags.get('seconds') ?? 15);
const MISSION = Number(flags.get('mission') ?? 10);
const WANT_UNITS = Number(flags.get('units') ?? 120);
const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

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

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = any;

const INIT = `
(() => {
  const w = window;
  w.__audit = { live: {}, offline: {}, offlineCtx: 0, liveCtx: 0, longTasks: [], frames: [] };
  const names = ['createGain','createBufferSource','createOscillator','createBiquadFilter','createStereoPanner','createConvolver','createWaveShaper','createDynamicsCompressor','createBuffer','createAnalyser','createConstantSource'];
  const P = (w.BaseAudioContext || w.AudioContext).prototype;
  for (const n of names) {
    const orig = P[n];
    if (!orig) continue;
    P[n] = function (...a) {
      const bag = (w.OfflineAudioContext && this instanceof w.OfflineAudioContext) ? w.__audit.offline : w.__audit.live;
      bag[n] = (bag[n] || 0) + 1;
      return orig.apply(this, a);
    };
  }
  const O = w.OfflineAudioContext;
  if (O) {
    w.OfflineAudioContext = class extends O { constructor(...a) { super(...a); w.__audit.offlineCtx++; } };
  }
  const A = w.AudioContext;
  if (A) {
    w.AudioContext = class extends A { constructor(...a) { super(...a); w.__audit.liveCtx++; } };
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__audit.longTasks.push({ t: e.startTime, d: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch {}
  let last = 0;
  const tick = (t) => {
    if (last) w.__audit.frames.push(t - last);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
`;

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount: number;
  children?: number[];
}

function attribute(profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }, frames: number): { files: [string, number][]; funcs: [string, number][]; totalMs: number } {
  const byId = new Map<number, ProfileNode>();
  for (const n of profile.nodes) byId.set(n.id, n);
  const self = new Map<number, number>();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  const files = new Map<string, number>();
  const funcs = new Map<string, number>();
  let total = 0;
  for (const [id, ms] of self) {
    const n = byId.get(id);
    if (!n) continue;
    total += ms;
    const url = n.callFrame.url;
    let file = url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '');
    if (!file) file = `(${n.callFrame.functionName || 'native'})`;
    if (file.includes('node_modules/.vite') || file.includes('node_modules')) file = file.includes('phaser') ? 'phaser' : 'node_modules';
    files.set(file, (files.get(file) ?? 0) + ms);
    const key = `${n.callFrame.functionName || '(anon)'} ${file}:${n.callFrame.lineNumber + 1}`;
    funcs.set(key, (funcs.get(key) ?? 0) + ms);
  }
  const perFrame = (m: Map<string, number>): [string, number][] => [...m.entries()].map(([k, v]) => [k, v / frames] as [string, number]).sort((a, b) => b[1] - a[1]);
  return { files: perFrame(files), funcs: perFrame(funcs), totalMs: total };
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const r = await cdp.send('Performance.getMetrics');
  const out: Record<string, number> = {};
  for (const m of r.metrics) out[m.name] = m.value;
  return out;
}

function stats(v: number[]): { n: number; avg: number; p95: number; p99: number; max: number; over33: number; over50: number } {
  const s = [...v].sort((a, b) => a - b);
  const n = s.length;
  const sum = s.reduce((a, b) => a + b, 0);
  return { n, avg: n ? sum / n : 0, p95: s[Math.floor(n * 0.95)] ?? 0, p99: s[Math.floor(n * 0.99)] ?? 0, max: s[n - 1] ?? 0, over33: s.filter((x) => x > 33.4).length, over50: s.filter((x) => x > 50).length };
}

async function main(): Promise<void> {
  const port = await freePort();
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.perf', `vite-cache-${process.pid}`),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
  });
  const out: Record<string, unknown> = { cpu: CPU, seconds: SECONDS, mission: MISSION };
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await context.addInitScript(INIT);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?debug=1&quality=auto`, { timeout: 300_000, waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window as W).__TH?.ready === true, null, { timeout: 300_000 });
    // A real gesture: the app's pointerdown handler calls audio.unlock().
    await page.mouse.click(5, 5);
    await sleep(500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Performance.enable');
    console.log('audio after click', await page.evaluate(() => (window as W).__TH.audio()));

    const start = (): Promise<void> =>
      page.evaluate((id) => {
        const th = (window as W).__TH;
        th.autopilot(true);
        th.unlockAll();
        th.startMission(id, 'hard', 1);
      }, MISSION);
    await start();
    await page.waitForFunction(() => (window as W).__TH.state().inBattle, null, { timeout: 60_000 });
    const loadAt = Date.now();
    const alive = (): Promise<{ n: number; mine: number; theirs: number; fighting: number; over: boolean; time: number; music: string; pieces: string }> =>
      page.evaluate(() => {
        const th = (window as W).__TH;
        const st = th.state();
        let mine = 0;
        let theirs = 0;
        for (const k of Object.keys(st.units[0])) {
          mine += st.units[0][k];
          theirs += st.units[1][k];
        }
        let fighting = 0;
        for (const u of th.units()) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') fighting++;
        const b = th.battleMusic.stats();
        return { n: mine + theirs, mine, theirs, fighting, over: st.over, time: st.time, music: b.state, pieces: `${b.piecesReady}/${b.piecesTotal}` };
      });
    const follow = (): Promise<void> =>
      page.evaluate(() => {
        const th = (window as W).__TH;
        th.grantSupplies(3000);
        const xs: number[] = [];
        for (const u of th.units()) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') xs.push(u.x);
        if (xs.length === 0) for (const u of th.units()) if (!u.inside) xs.push(u.x);
        if (xs.length) {
          xs.sort((p, q) => p - q);
          th.lookAt(xs[Math.floor(xs.length / 2)]);
        }
      });

    // How long the stock background render takes with the battle running at real speed, unthrottled and throttled.
    // (Measured from battle load at real speed with the CPU throttled the whole time: the real phone case.)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.evaluate(() => {
      (window as W).__audit.frames.length = 0;
      (window as W).__audit.longTasks.length = 0;
    });
    let a = await alive();
    const t0 = Date.now();
    const timeline: string[] = [];
    while (a.music !== 'ready' && a.music !== 'failed' && Date.now() - t0 < 400_000) {
      await follow();
      await sleep(2000);
      a = await alive();
      timeline.push(`${((Date.now() - loadAt) / 1000).toFixed(0)}s music ${a.music} ${a.pieces} units ${a.mine}+${a.theirs} fighting ${a.fighting}`);
    }
    const renderFrames = await page.evaluate(() => (window as W).__audit.frames.slice());
    const renderLong = await page.evaluate(() => (window as W).__audit.longTasks.slice());
    const bstats = await page.evaluate(() => (window as W).__TH.battleMusic.stats());
    out.stockRender = { wallSec: (Date.now() - loadAt) / 1000, engine: { renderMs: bstats.renderMs, firstMs: bstats.firstMs, buildMs: bstats.buildMs, buildMsTotal: bstats.buildMsTotal, pieces: bstats.piecesTotal, bytes: bstats.bytes, rate: bstats.sampleRate }, frames: stats(renderFrames), longTasks: renderLong.length, longMs: renderLong.reduce((s: number, x: { d: number }) => s + x.d, 0), timeline };
    console.log('stock render (throttled from load):', JSON.stringify(out.stockRender, null, 1));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    // Fast-forward to a heavy battle.
    await page.evaluate(() => (window as W).__TH.setTimeScale(20));
    a = await alive();
    const ff = Date.now();
    while (a.n < WANT_UNITS || a.fighting < 20) {
      if (Date.now() - ff > 240_000) break;
      if (a.over) await start();
      await sleep(300);
      await follow();
      a = await alive();
    }
    await page.evaluate(() => (window as W).__TH.setTimeScale(1));
    console.log('heavy:', a);
    for (let i = 0; i < 3; i++) {
      await follow();
      await sleep(1000);
    }

    const windowRun = async (label: string, during?: () => Promise<void>): Promise<void> => {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      const before = await page.evaluate(() => {
        const w = window as W;
        w.__audit.frames.length = 0;
        w.__audit.longTasks.length = 0;
        w.__THPERF.reset();
        return { live: { ...w.__audit.live }, offline: { ...w.__audit.offline }, offlineCtx: w.__audit.offlineCtx, sfx: w.__TH.audio() };
      });
      const m0 = await metrics(cdp);
      await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
      await cdp.send('Profiler.start');
      const begin = Date.now();
      const task = during ? during() : Promise.resolve();
      while (Date.now() - begin < SECONDS * 1000) {
        await follow();
        await sleep(1000);
      }
      const { profile } = await cdp.send('Profiler.stop');
      await task;
      const m1 = await metrics(cdp);
      const after = await page.evaluate(() => {
        const w = window as W;
        return { live: { ...w.__audit.live }, offline: { ...w.__audit.offline }, offlineCtx: w.__audit.offlineCtx, sfx: w.__TH.audio(), frames: w.__audit.frames.slice(), longTasks: w.__audit.longTasks.slice(), report: w.__THPERF.report(), quality: w.__THPERF.quality() };
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const secs = (Date.now() - begin) / 1000;
      const diff = (x: Record<string, number>, y: Record<string, number>): Record<string, string> => {
        const r: Record<string, string> = {};
        for (const k of Object.keys(y)) r[k] = ((y[k] - (x[k] ?? 0)) / secs).toFixed(1) + '/s';
        return r;
      };
      const fr = stats(after.frames);
      const att = attribute(profile as never, Math.max(1, fr.n));
      const pick = (re: RegExp): number => att.files.filter(([f]) => re.test(f)).reduce((s, [, v]) => s + v, 0);
      const units = await alive();
      const res = {
        label,
        units: `${units.mine}+${units.theirs} fighting ${units.fighting}`,
        frames: fr,
        perf: { js: after.report.js, hud: after.report.hud, render: after.report.render, sim: after.report.sim, draw: after.report.draw, interval: after.report.interval },
        quality: after.quality,
        longTasks: after.longTasks.length,
        longTaskMs: after.longTasks.reduce((s: number, x: { d: number }) => s + x.d, 0),
        longTaskMax: after.longTasks.reduce((s: number, x: { d: number }) => Math.max(s, x.d), 0),
        liveNodesPerSec: diff(before.live, after.live),
        offlineNodesPerSec: diff(before.offline, after.offline),
        offlineCtxPerSec: ((after.offlineCtx - before.offlineCtx) / secs).toFixed(2),
        sfx: { playedPerSec: ((after.sfx.played - before.sfx.played) / secs).toFixed(1), droppedPerSec: ((after.sfx.dropped - before.sfx.dropped) / secs).toFixed(1), state: after.sfx.state },
        style: {
          layoutsPerSec: ((m1.LayoutCount - m0.LayoutCount) / secs).toFixed(1),
          layoutMsPerSec: (((m1.LayoutDuration - m0.LayoutDuration) * 1000) / secs).toFixed(2),
          recalcPerSec: ((m1.RecalcStyleCount - m0.RecalcStyleCount) / secs).toFixed(1),
          recalcMsPerSec: (((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000) / secs).toFixed(2),
          scriptMsPerSec: (((m1.ScriptDuration - m0.ScriptDuration) * 1000) / secs).toFixed(1),
          taskMsPerSec: (((m1.TaskDuration - m0.TaskDuration) * 1000) / secs).toFixed(1),
        },
        profileMsPerFrame: {
          total: att.totalMs / Math.max(1, fr.n),
          audio: pick(/^src\/audio\//),
          hud: pick(/^src\/ui\/hud\//),
          hudModel: pick(/^src\/app\/hudModel/),
          app: pick(/^src\/app\//),
          sim: pick(/^src\/sim\//),
          render: pick(/^src\/render\//),
          art: pick(/^src\/art\//),
          phaser: pick(/^phaser$/),
          gc: pick(/\(garbage collector\)/),
          idle: pick(/\(idle\)/),
          program: pick(/\(program\)/),
        },
        topFiles: att.files.slice(0, 25).map(([f, v]) => `${v.toFixed(3)} ms/frame  ${f}`),
        audioHudFuncs: att.funcs.filter(([f]) => /src\/(audio|ui\/hud|app\/hudModel|app\/musicIntensity|app\/sfx|render\/effects\/sound)/.test(f)).slice(0, 25).map(([f, v]) => `${v.toFixed(4)} ms/frame  ${f}`),
      };
      console.log(JSON.stringify(res, null, 1));
      (out as Record<string, unknown>)[label] = res;
    };

    await windowRun('A_baseline_music_ready');
    // Phase B: rerun the engine's background render loop (src/audio/engine.ts renderBattle) for this battle's track,
    // in the page, with the shipped settings (24 ms gaps, 16 kHz, chunked graph build).
    const pieceLog: unknown[] = [];
    await windowRun('B_during_music_render', async () => {
      const r = await page.evaluate(async (limitMs) => {
        const battle = await import('/src/audio/music/battle.ts' as string);
        const tracks = await import('/src/data/musicTracks/index.ts' as string);
        const mb = await import('/src/data/musicBattle.ts' as string);
        const th = (window as W).__TH;
        const name = th.battleMusic.stats().track ?? 'arras';
        const def = tracks.BATTLE_TRACKS[name];
        const Off = (window as W).OfflineAudioContext;
        const R = mb.MUSIC_BATTLE.render;
        const started = performance.now();
        const rows: { piece: string; buildMs: number; buildMsTotal: number; renderMs: number }[] = [];
        for (const p of battle.battlePieces(def)) {
          if (performance.now() - started > limitMs) break;
          const d = await battle.renderBattlePiece(def, p, Off, R.sampleRate);
          rows.push({ piece: `${p.section}/${p.layer ?? p.sting}`, buildMs: +d.buildMs.toFixed(1), buildMsTotal: +d.buildMsTotal.toFixed(1), renderMs: Math.round(d.renderMs) });
          await new Promise((ok) => setTimeout(ok, R.gapMs));
        }
        return { name, rows };
      }, SECONDS * 1000);
      pieceLog.push(r);
    });
    out.phaseBPieces = pieceLog;
    console.log('phase B pieces', JSON.stringify(pieceLog));
    // Phase C: a mission restart (the stock path: release, re-prepare, render from load) measured on the heavy scene is
    // not possible, so instead show the sfx engine alone: mute vs unmuted is not exposed; skip.
    out.errors = errors;
  } finally {
    writeFileSync(resolve(ROOT, '.perf', `audiohud-cpu${CPU}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    await server.close();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
