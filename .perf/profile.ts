/**
 * Tin Hats heavy-battle profiler (measurement harness, not shipped).
 *
 * Plays the proving ground in the BUILT game, in headless Chromium on the real GPU (ANGLE D3D11) or SwiftShader,
 * as a phone-sized landscape page, CPU-throttled, with both armies fed to the population cap, flamethrowers, mortars,
 * tanks, plane call-ins, blood, rain and battle music. Records per window:
 *   - rAF frame-time distribution (mean, p50, p95, p99, max, share over 16.7 / 33.3 ms), long tasks
 *   - the game's own per-phase JS split (window.__THPERF: sim, afterStep, render, HUD, Phaser draw)
 *   - CDP Performance.getMetrics deltas (script, layout, style recalc, task time, DOM nodes, listeners, heap)
 *   - a CDP CPU profile, source-mapped to the TypeScript sources: top functions by self and total time, by file,
 *     and the top-down call tree
 *   - optional Chrome trace (--trace) for layout / paint / GPU events
 * and samples object counts every few seconds over the whole run (units, unit views, corpses, blood, decals,
 * particles, tracers, game objects, Phaser update list, heap, DOM nodes, listeners) so growth shows up.
 *
 *   x.cmd npx tsx .perf/profile.ts --build                 (first run, or after source changes: builds .perf/build)
 *   x.cmd npx tsx .perf/profile.ts --cpu=4 --seconds=40 --profile --tag=cpu4
 *
 * Flags
 *   --build             rebuild .perf/build (production build + sourcemaps + a window.__PERFAPP hook added by a
 *                       build-time plugin, so the harness can feed side 1 and read view internals; game source untouched)
 *   --dist=.perf/build  folder to serve;  --port=4401
 *   --gpu=1             1 = new headless + ANGLE D3D11 (real GPU), 0 = SwiftShader software WebGL
 *   --cpu=4             CDP CPU throttle for the measured windows (1 = none)
 *   --w=844 --h=390 --dsf=3   viewport (CSS px) and device pixel ratio
 *   --quality=0         effect quality pinned (0 = full; 'auto' = the in-game governor, as real players get)
 *   --pop=100           population cap per side (both sides fed to it)
 *   --opening=0         seconds measured from the battle start at real time (music renders then)
 *   --seconds=40        heavy window length (real seconds)
 *   --long=0            minutes of further real-time fighting after the heavy window, then a second window
 *   --profile           CPU profile each window (saved .cpuprofile + source-mapped summary)
 *   --trace             8 s Chrome trace in the heavy window (layout, paint, GPU)
 *   --norain --noblood --nomusic --noplanes --noflame
 *   --tag=name          output files go to .perf/out/<tag>-*
 *   --headful           show the browser window
 */
import { chromium, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview, type Plugin } from 'vite';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

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
const F = parseFlags();
const num = (k: string, d: number): number => (F.has(k) ? Number(F.get(k)) : d);
const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

const DIST = resolve(ROOT, F.get('dist') ?? '.perf/build');
const PORT = num('port', 4401);
const GPU = num('gpu', 1) === 1;
const CPU = num('cpu', 4);
const W = num('w', 844);
const H = num('h', 390);
const DSF = num('dsf', 3);
const QUALITY = F.get('quality') ?? '0';
const POP = num('pop', 100);
const SUSTAIN = num('sustain', 0.3);
const GROUND = F.get('ground') ?? 'mirror';
const OPENING = num('opening', 0);
const SECONDS = num('seconds', 40);
const LONG_MIN = num('long', 0);
const PROFILE = F.has('profile');
const TRACE = F.has('trace');
const TAG = F.get('tag') ?? `cpu${CPU}`;
const OUT = resolve(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const outPath = (name: string): string => join(OUT, `${TAG}-${name}`);

/** Build-time plugin: expose the app objects on window.__PERFAPP when ?debug=1 (perf build only). */
function exposePlugin(): Plugin {
  return {
    name: 'perf-expose-app',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/main.ts')) return null;
      const marker = 'const debug = debugEnabled(window.location.search) ? installDebug(app, view, ui, audio) : null;';
      if (!code.includes(marker)) throw new Error('perf-expose-app: main.ts marker not found');
      return code.replace(marker, `${marker}\n  if (debug) Reflect.set(window, '__PERFAPP', { app, view, ui, audio });`);
    },
  };
}

async function buildPerf(): Promise<void> {
  console.log(`building ${DIST} (sourcemaps, __PERFAPP hook)...`);
  await build({
    root: ROOT,
    configFile: resolve(ROOT, 'vite.config.ts'),
    logLevel: 'warn',
    plugins: [exposePlugin()],
    build: { outDir: DIST, emptyOutDir: true, sourcemap: true },
  });
}

// ------------------------------------------------------------------ page-side code (strings: no bundler helpers)

const INIT_SCRIPT = `
(() => {
  const N = 1 << 17;
  const L = { t: new Float64Array(N), n: 0 };
  window.__raf = L;
  const tick = (ts) => { L.t[L.n % N] = ts; L.n++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__long = [];
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push([e.startTime, e.duration]); })
      .observe({ entryTypes: ['longtask'] });
  } catch (e) {}
})();
`;

/** Director: run once a second. Keeps the battle heavy and alive. Returns a little state. */
/**
 * The army mix each side is kept at (pop 99 at the default cap: 82 units, infantry heavy so the unit count is close to
 * the owner's "100 per side"). Scaled with --pop.
 */
const MIX: Record<string, number> = { sapper: 4, rifle: 40, lmg: 4, assault: 12, mortar: 3, sniper: 2, medic: 4, at: 2, flame: 8, tank: 2, commander: 1 };

const DIRECTOR = (opts: { pop: number; planes: boolean; flame: boolean; follow: boolean; sustain: number; mode: 'build' | 'fight' | 'natural' }): string => `
(() => {
  const P = window.__PERFAPP, TH = window.__TH;
  const session = P.app.session;
  if (!session) return { ok: false };
  const b = session.battle, s = b.state;
  if (!window.__aiStash) window.__aiStash = [b.ai[0], b.ai[1]];
  const mode = '${opts.mode}';
  const mix = ${JSON.stringify(MIX)};
  const scale = ${opts.pop} / 100;
  let mixUnits = 0;
  for (let si = 0; si < 2; si++) {
    const side = s.sides[si];
    side.popCap = ${opts.pop};
    if (side.supplies < 6000) side.supplies = 6000;
    if (side.hq && side.hq.hp < side.hq.maxHp) side.hq.hp = side.hq.maxHp;
    if (mode === 'build') { b.ai[si] = null; if (side.order !== 'hold') b.command(si, { type: 'order', order: 'hold' }); }
    else b.ai[si] = window.__aiStash[si];
    if (mode === 'natural') continue;
    for (const k in mix) {
      if (k === 'flame' && !${opts.flame}) continue;
      const want = Math.round(mix[k] * scale);
      if (si === 0) mixUnits += want;
      let have = (side.alive[k] || 0) + (side.queue[k] || 0);
      let q = side.queue[k] || 0;
      while (have < want && q < 5) { b.command(si, { type: 'train', kind: k }); have++; q++; }
    }
  }
  if (mode === 'fight') for (let si = 0; si < 2; si++) if (s.sides[si].order !== 'advance') b.command(si, { type: 'order', order: 'advance' });
  // Sustain (fight mode): wounded men get back sustain of their max hp each second and training is hurried, so the
  // field stays near the cap for the whole window instead of emptying after the first clash. Deaths still happen.
  if (mode === 'fight' && ${opts.sustain} > 0) {
    for (let i = 0; i < s.unitCount; i++) { const u = s.units[i]; if (u.alive && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * ${opts.sustain}); }
    for (let i = 0; i < b.trainLeft.length; i++) if (b.trainLeft[i] > 1) b.trainLeft[i] = 1;
  }
  // Where the fighting is: median x of men aiming, firing or reloading (else of everyone outside).
  const xs = [];
  let fighting = 0, alive0 = 0, alive1 = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (u.side === 0) alive0++; else alive1++;
    if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') { xs.push(u.x); fighting++; }
  }
  if (xs.length === 0) for (let i = 0; i < s.unitCount; i++) { const u = s.units[i]; if (u.alive && !u.inside) xs.push(u.x); }
  xs.sort((p, q) => p - q);
  const mid = xs.length ? xs[Math.floor(xs.length / 2)] : s.length / 2;
  if (${opts.follow}) TH.lookAt(mid);
  if (${opts.planes}) {
    const me = s.sides[0];
    let target = mid;
    for (let i = 0; i < s.unitCount; i++) { const u = s.units[i]; if (u.alive && u.side === 1 && !u.inside && Math.abs(u.x - mid) < 500) { target = u.x; break; } }
    for (const k of ['bomber', 'fighter', 'recon', 'artillery', 'airStrike']) {
      if (me.supportAvailable[k] && me.supportCooldown[k] <= 0) b.command(0, { type: 'support', kind: k, x: target });
    }
  }
  const queued = [0, 0];
  for (let si = 0; si < 2; si++) for (const k in s.sides[si].queue) queued[si] += s.sides[si].queue[k];
  window.__dir = { ok: true, over: s.over, time: s.time, pop: [s.sides[0].pop, s.sides[1].pop], alive: [alive0, alive1], queued, mixUnits, fighting, mid };
  return window.__dir;
})()
`;

/** Object counts and memory, read from the game internals. */
const SAMPLE = `
(() => {
  const P = window.__PERFAPP, TH = window.__TH, TP = window.__THPERF;
  const session = P.app.session;
  const v = P.view;
  const out = { t: performance.now(), fighting: window.__dir ? window.__dir.fighting : -1 };
  if (session) {
    const s = session.battle.state;
    out.time = s.time;
    out.pop = [s.sides[0].pop, s.sides[1].pop];
    let a0 = 0, a1 = 0, dead = 0, proj = 0;
    for (let i = 0; i < s.unitCount; i++) { const u = s.units[i]; if (u.alive) { if (u.side === 0) a0++; else a1++; } else dead++; }
    for (const p of s.projectiles) if (p.alive) proj++;
    out.alive = [a0, a1];
    out.unitPool = s.unitCount;
    out.deadSlots = dead;
    out.projectiles = proj;
    out.projectilePool = s.projectiles.length;
    out.smokes = s.smokes.filter((x) => x.alive).length;
  }
  const rs = TP.stats();
  out.unitViews = rs.unitViews; out.unitViewsDrawn = rs.unitViewsDrawn;
  out.bloodPools = rs.bloodPools; out.bloodDrawn = rs.bloodDrawn;
  out.images = rs.images; out.imagesVisible = rs.imagesVisible;
  out.particlesDrawn = rs.particles; out.particlesLive = rs.particlesLive; out.tracers = rs.tracers;
  out.quality = rs.quality; out.canvas = [rs.canvasW, rs.canvasH, rs.dpr];
  try {
    const u = v.units;
    if (u) {
      out.corpses = u.dying.length;
      let fp = 0, tp = 0;
      for (const p of u.figurePool) fp += p.length;
      for (const p of u.tankPool) tp += p.length;
      out.viewPools = [fp, tp];
    }
  } catch (e) {}
  try {
    const d = v.effects && v.effects.ctx && v.effects.ctx.decals;
    if (d) { let live = 0; for (let i = 0; i < d.images.length; i++) if (d.images[i].visible) live++; out.decals = live; out.decalPool = d.images.length; }
  } catch (e) {}
  try {
    let children = 0, updateList = 0;
    for (const sc of v.game.scene.scenes) { children += sc.children.length; updateList += sc.sys.updateList.length; }
    out.sceneChildren = children; out.updateList = updateList;
    out.tweens = v.game.scene.scenes.reduce((n, sc) => n + (sc.tweens ? sc.tweens.getTweens().length : 0), 0);
    out.timers = v.game.scene.scenes.reduce((n, sc) => n + (sc.time && sc.time._active ? sc.time._active.length : 0), 0);
  } catch (e) {}
  const m = performance.memory;
  if (m) out.heapMB = m.usedJSHeapSize / 1048576;
  out.domNodes = document.getElementsByTagName('*').length;
  try { out.layers = TP.layers().filter((l) => l.total >= 20).map((l) => l.name + ' ' + l.total + '/' + l.visible).join(', '); } catch (e) {}
  try { const bm = TH.battleMusic.stats(); out.music = { state: bm.state, ready: bm.piecesReady, total: bm.piecesTotal, buildMs: bm.buildMs, renderMs: bm.renderMs, layer: bm.layer }; } catch (e) {}
  try { const a = TH.audio(); out.audio = a; } catch (e) {}
  return out;
})()
`;

// ------------------------------------------------------------------ stats helpers

interface Dist {
  frames: number;
  seconds: number;
  fps: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  over16_7: number;
  over18_5: number;
  over33_3: number;
  over35: number;
  over50: number;
}

function dist(deltas: number[]): Dist {
  const d = deltas.filter((x) => x > 0).sort((a, b) => a - b);
  const n = d.length;
  const q = (p: number): number => (n ? d[Math.min(n - 1, Math.floor(n * p))] : 0);
  const sum = d.reduce((a, b) => a + b, 0);
  const share = (t: number): number => (n ? (d.filter((x) => x > t).length / n) * 100 : 0);
  return {
    frames: n,
    seconds: sum / 1000,
    fps: sum > 0 ? (n * 1000) / sum : 0,
    mean: n ? sum / n : 0,
    p50: q(0.5),
    p90: q(0.9),
    p95: q(0.95),
    p99: q(0.99),
    max: n ? d[n - 1] : 0,
    over16_7: share(16.7),
    over18_5: share(18.5),
    over33_3: share(33.3),
    over35: share(35),
    over50: share(50),
  };
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics: list } = await cdp.send('Performance.getMetrics');
  const out: Record<string, number> = {};
  for (const m of list) out[m.name] = m.value;
  return out;
}

// ------------------------------------------------------------------ CPU profile analysis (source-mapped)

interface PNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number; scriptId: string };
  hitCount?: number;
  children?: number[];
}
interface Profile {
  nodes: PNode[];
  samples?: number[];
  timeDeltas?: number[];
  startTime: number;
  endTime: number;
}

const maps = new Map<string, TraceMap | null>();
function mapFor(url: string): TraceMap | null {
  if (maps.has(url)) return maps.get(url) ?? null;
  let tm: TraceMap | null = null;
  const m = /\/assets\/([^/?#]+\.js)/.exec(url);
  if (m) {
    const file = join(DIST, 'assets', `${m[1]}.map`);
    if (existsSync(file)) tm = new TraceMap(readFileSync(file, 'utf8'));
  }
  maps.set(url, tm);
  return tm;
}

function shortSource(src: string): string {
  const s = src.replace(/\\/g, '/');
  const i = s.indexOf('node_modules/');
  if (i >= 0) return s.slice(i + 'node_modules/'.length);
  const j = s.indexOf('/src/');
  if (j >= 0) return s.slice(j + 1);
  return s.replace(/^(\.\.\/)+/, '');
}

function label(cf: PNode['callFrame']): { fn: string; file: string } {
  const raw = cf.functionName || '(anonymous)';
  if (!cf.url) return { fn: raw, file: '(native)' };
  const tm = mapFor(cf.url);
  if (tm) {
    const pos = originalPositionFor(tm, { line: cf.lineNumber + 1, column: Math.max(0, cf.columnNumber) });
    if (pos.source) {
      const file = shortSource(pos.source);
      return { fn: `${pos.name ?? raw}`, file: `${file}:${pos.line}` };
    }
  }
  return { fn: raw, file: `${basename(cf.url.split('?')[0])}:${cf.lineNumber + 1}` };
}

interface ProfileSummary {
  sampledMs: number;
  idleMs: number;
  gcMs: number;
  programMs: number;
  topSelf: { pct: number; ms: number; fn: string; at: string }[];
  topTotal: { pct: number; ms: number; fn: string; at: string }[];
  byFile: { pct: number; ms: number; file: string }[];
  tree: string[];
}

function analyse(profile: Profile): ProfileSummary {
  const byId = new Map<number, PNode>();
  for (const n of profile.nodes) byId.set(n.id, n);
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const selfMs = new Map<number, number>();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const dt = (deltas[i + 1] ?? deltas[i] ?? 0) / 1000;
    selfMs.set(samples[i], (selfMs.get(samples[i]) ?? 0) + dt);
    total += dt;
  }
  const labels = new Map<number, { fn: string; file: string; key: string }>();
  for (const n of profile.nodes) {
    const l = label(n.callFrame);
    labels.set(n.id, { ...l, key: `${l.fn} @ ${l.file}` });
  }
  // Node totals
  const nodeTotal = new Map<number, number>();
  const order: number[] = [];
  const root = profile.nodes[0].id;
  const stack = [root];
  while (stack.length) {
    const id = stack.pop() as number;
    order.push(id);
    for (const c of byId.get(id)?.children ?? []) stack.push(c);
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    let t = selfMs.get(id) ?? 0;
    for (const c of byId.get(id)?.children ?? []) t += nodeTotal.get(c) ?? 0;
    nodeTotal.set(id, t);
  }
  const selfBy = new Map<string, number>();
  const fileBy = new Map<string, number>();
  let idle = 0;
  let gc = 0;
  let program = 0;
  for (const [id, ms] of selfMs) {
    const l = labels.get(id);
    if (!l) continue;
    if (l.fn === '(idle)') idle += ms;
    if (l.fn === '(garbage collector)') gc += ms;
    if (l.fn === '(program)') program += ms;
    selfBy.set(l.key, (selfBy.get(l.key) ?? 0) + ms);
    const file = l.file.replace(/:\d+$/, '');
    fileBy.set(file, (fileBy.get(file) ?? 0) + ms);
  }
  // Function totals without double counting recursion: DFS keeping active keys.
  const totalBy = new Map<string, number>();
  const active = new Map<string, number>();
  const walk = (id: number): void => {
    const l = labels.get(id);
    const key = l ? l.key : '?';
    const depth = active.get(key) ?? 0;
    if (depth === 0) totalBy.set(key, (totalBy.get(key) ?? 0) + (nodeTotal.get(id) ?? 0));
    active.set(key, depth + 1);
    for (const c of byId.get(id)?.children ?? []) walk(c);
    active.set(key, depth);
  };
  walk(root);
  const busy = total - idle;
  const fmtRow = (key: string, ms: number): { pct: number; ms: number; fn: string; at: string } => {
    const [fn, at] = key.split(' @ ');
    return { pct: (ms / busy) * 100, ms, fn, at };
  };
  const topSelf = [...selfBy.entries()].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, ms]) => fmtRow(k, ms));
  const topTotal = [...totalBy.entries()]
    .filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(root)'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([k, ms]) => fmtRow(k, ms));
  const byFile = [...fileBy.entries()].filter(([f]) => f !== '(native)' || true).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([file, ms]) => ({ pct: (ms / busy) * 100, ms, file }));
  // Top-down tree: children over 1.5% of busy time, depth <= 14.
  const tree: string[] = [];
  const threshold = busy * 0.015;
  const show = (id: number, depth: number): void => {
    const kids = (byId.get(id)?.children ?? []).filter((c) => (nodeTotal.get(c) ?? 0) >= threshold).sort((a, b) => (nodeTotal.get(b) ?? 0) - (nodeTotal.get(a) ?? 0));
    for (const c of kids) {
      const l = labels.get(c);
      if (!l || l.fn === '(idle)') continue;
      const t = nodeTotal.get(c) ?? 0;
      const s = selfMs.get(c) ?? 0;
      tree.push(`${'  '.repeat(depth)}${((t / busy) * 100).toFixed(1).padStart(5)}% total ${((s / busy) * 100).toFixed(1).padStart(5)}% self  ${l.fn}  [${l.file}]`);
      if (depth < 14) show(c, depth + 1);
    }
  };
  show(root, 0);
  return { sampledMs: total, idleMs: idle, gcMs: gc, programMs: program, topSelf, topTotal, byFile, tree };
}

function printProfile(name: string, p: ProfileSummary, frames: number): string[] {
  const lines: string[] = [];
  const busy = p.sampledMs - p.idleMs;
  lines.push(`\n== CPU profile (${name}): ${p.sampledMs.toFixed(0)} ms sampled, busy ${busy.toFixed(0)} ms (${(busy / Math.max(1, frames)).toFixed(2)} ms per frame), idle ${p.idleMs.toFixed(0)}, GC ${p.gcMs.toFixed(0)} ms, (program) ${p.programMs.toFixed(0)} ms`);
  lines.push('-- top 40 by self time (% of busy, ms per frame)');
  for (const r of p.topSelf) lines.push(`  ${r.pct.toFixed(1).padStart(5)}%  ${(r.ms / Math.max(1, frames)).toFixed(3).padStart(6)} ms/f  ${r.fn}  [${r.at}]`);
  lines.push('-- top 40 by total time');
  for (const r of p.topTotal) lines.push(`  ${r.pct.toFixed(1).padStart(5)}%  ${(r.ms / Math.max(1, frames)).toFixed(3).padStart(6)} ms/f  ${r.fn}  [${r.at}]`);
  lines.push('-- self time by source file');
  for (const r of p.byFile) lines.push(`  ${r.pct.toFixed(1).padStart(5)}%  ${(r.ms / Math.max(1, frames)).toFixed(3).padStart(6)} ms/f  ${r.file}`);
  lines.push('-- top-down call tree (nodes >= 1.5% of busy)');
  lines.push(...p.tree.slice(0, 160));
  return lines;
}

// ------------------------------------------------------------------ trace analysis

function analyseTrace(events: { name: string; ph: string; dur?: number; cat?: string; tid?: number; pid?: number }[]): { name: string; ms: number; count: number }[] {
  const by = new Map<string, { ms: number; count: number }>();
  for (const e of events) {
    if (e.ph !== 'X' || e.dur === undefined) continue;
    const r = by.get(e.name) ?? { ms: 0, count: 0 };
    r.ms += e.dur / 1000;
    r.count++;
    by.set(e.name, r);
  }
  return [...by.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.ms - a.ms).slice(0, 40);
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  if (F.has('build') || !existsSync(join(DIST, 'index.html'))) await buildPerf();
  if (!readdirSync(join(DIST, 'assets')).some((f) => f.endsWith('.map'))) console.log('WARNING: no source maps in dist: names stay minified');

  const server = await preview({ root: ROOT, configFile: resolve(ROOT, 'vite.config.ts'), logLevel: 'error', build: { outDir: DIST }, preview: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  const gpuArgs = GPU
    ? ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({
    channel: GPU ? 'chromium' : undefined,
    headless: !F.has('headful'),
    args: [...gpuArgs, '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'],
  });
  const result: Record<string, unknown> = { tag: TAG, cpu: CPU, gpu: GPU, viewport: `${W}x${H}@${DSF}`, quality: QUALITY, pop: POP, at: new Date().toISOString() };
  const log: string[] = [];
  const say = (s: string): void => {
    console.log(s);
    log.push(s);
  };
  const samples: Record<string, unknown>[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await context.addInitScript(INIT_SCRIPT);
    const page: Page = await context.newPage();
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:${PORT}/?debug=1&quality=${QUALITY}`);
    await page.waitForFunction('window.__TH && window.__TH.ready === true && !!window.__PERFAPP', null, { timeout: 90_000 });
    const renderer = await page.evaluate(`(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
    say(`WebGL renderer: ${String(renderer)}`);
    result.renderer = renderer;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
    await cdp.send('Profiler.enable');
    await cdp.send('HeapProfiler.enable');

    // A key press unlocks the audio (a user gesture), then the battle.
    await page.keyboard.press('Shift');
    await page.mouse.click(4, 4);
    await page.evaluate(`(() => {
      const TH = window.__TH, P = window.__PERFAPP;
      TH.unlockAll();
      TH.autopilot(true);
      P.app.save.settings.showBlood = ${!F.has('noblood')};
      P.app.save.settings.muted = ${F.has('nomusic')};
      TH.startSandbox(7, ${GROUND === 'mirror'});
      ${F.has('norain') ? '' : "TH.forceWeather('rain');"}
    })()`);
    await page.waitForFunction('window.__TH.state().inBattle', null, { timeout: 30_000 });
    await page.evaluate(`(() => { const P = window.__PERFAPP; P.view.setShowBlood(${!F.has('noblood')}); P.audio.setMuted(${F.has('nomusic')}); })()`);
    say(`audio: ${JSON.stringify(await page.evaluate('window.__TH.audio()'))}`);

    const dopts = { pop: POP, planes: !F.has('noplanes'), flame: !F.has('noflame'), follow: true, sustain: SUSTAIN };
    const builder = DIRECTOR({ ...dopts, planes: false, mode: 'build' });
    const director = DIRECTOR({ ...dopts, mode: 'fight' });
    const natural = DIRECTOR({ ...dopts, planes: false, mode: 'natural' });
    const setScale = (k: number): Promise<unknown> => page.evaluate(`window.__TH.setTimeScale(${k})`);
    const throttle = (r: number): Promise<unknown> => cdp.send('Emulation.setCPUThrottlingRate', { rate: r });
    const t0 = Date.now();
    const sample = async (phase: string): Promise<Record<string, unknown>> => {
      const s = (await page.evaluate(SAMPLE)) as Record<string, unknown>;
      const m = await metrics(cdp);
      s.phase = phase;
      s.wall = (Date.now() - t0) / 1000;
      s.listeners = m.JSEventListeners;
      s.nodes = m.Nodes;
      s.cdpHeapMB = m.JSHeapUsedSize / 1048576;
      samples.push(s);
      return s;
    };

    /** One measured window at time scale 1. */
    const measure = async (name: string, seconds: number, opts: { profile: boolean; trace: boolean; direct: boolean }): Promise<Record<string, unknown>> => {
      await page.evaluate('window.__THPERF.reset()');
      const rafStart = (await page.evaluate('window.__raf.n')) as number;
      const longStart = (await page.evaluate('window.__long.length')) as number;
      const m0 = await metrics(cdp);
      const heap0 = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
      if (opts.profile) {
        await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
        await cdp.send('Profiler.start');
      }
      let traceDone: Promise<unknown[]> | null = null;
      const startWall = Date.now();
      let traced = false;
      for (let i = 0; i < seconds; i++) {
        if (opts.direct) await page.evaluate(director);
        if (opts.trace && !traced && i === Math.floor(seconds / 3)) {
          traced = true;
          const events: unknown[] = [];
          cdp.on('Tracing.dataCollected', (e: { value: unknown[] }) => events.push(...e.value));
          traceDone = new Promise((ok) => cdp.once('Tracing.tracingComplete', () => ok(events)));
          await cdp.send('Tracing.start', {
            categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink,cc,gpu,viz,v8.execute,disabled-by-default-v8.gc',
            transferMode: 'ReportEvents',
          });
          setTimeout(() => void cdp.send('Tracing.end'), 8000);
        }
        if (i % 3 === 0) await sample(name);
        await sleep(1000 - ((Date.now() - startWall) % 1000));
      }
      const wall = (Date.now() - startWall) / 1000;
      let prof: Profile | null = null;
      if (opts.profile) prof = (await cdp.send('Profiler.stop')).profile as Profile;
      const m1 = await metrics(cdp);
      const heap1 = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
      const rafEnd = (await page.evaluate('window.__raf.n')) as number;
      const stamps = (await page.evaluate(`Array.from(window.__raf.t.subarray(${rafStart % (1 << 17)}, ${rafEnd % (1 << 17)}))`)) as number[];
      const deltas: number[] = [];
      for (let i = 1; i < stamps.length; i++) deltas.push(stamps[i] - stamps[i - 1]);
      const longs = (await page.evaluate(`window.__long.slice(${longStart})`)) as [number, number][];
      const game = await page.evaluate('window.__THPERF.report()');
      const frames = Math.max(1, deltas.length);
      const per = (k: string): number => ((m1[k] - m0[k]) * 1000) / frames;
      const d = dist(deltas);
      const w: Record<string, unknown> = {
        name,
        wallSeconds: wall,
        raf: d,
        longTasks: { count: longs.length, totalMs: longs.reduce((a, b) => a + b[1], 0), max: longs.reduce((a, b) => Math.max(a, b[1]), 0) },
        game,
        cdpPerFrameMs: {
          task: per('TaskDuration'),
          script: per('ScriptDuration'),
          layout: per('LayoutDuration'),
          recalcStyle: per('RecalcStyleDuration'),
          threadTime: per('ThreadTime'),
          layoutsPerFrame: (m1.LayoutCount - m0.LayoutCount) / frames,
          styleRecalcsPerFrame: (m1.RecalcStyleCount - m0.RecalcStyleCount) / frames,
        },
        heap: { startMB: heap0, endMB: heap1, mbPerMin: ((heap1 - heap0) / wall) * 60 },
        dom: { nodes0: m0.Nodes, nodes1: m1.Nodes, listeners0: m0.JSEventListeners, listeners1: m1.JSEventListeners },
      };
      say(`\n=== window "${name}" (${wall.toFixed(1)} s, cpu x${CPU}) ===`);
      say(`rAF: ${d.frames} frames, ${d.fps.toFixed(1)} fps, mean ${d.mean.toFixed(2)} p50 ${d.p50.toFixed(2)} p90 ${d.p90.toFixed(2)} p95 ${d.p95.toFixed(2)} p99 ${d.p99.toFixed(2)} max ${d.max.toFixed(1)} ms`);
      say(`     over 16.7 ms ${d.over16_7.toFixed(1)}%  over 18.5 ${d.over18_5.toFixed(1)}%  over 33.3 ${d.over33_3.toFixed(1)}%  over 35 ${d.over35.toFixed(1)}%  over 50 ${d.over50.toFixed(1)}%`);
      const lt = w.longTasks as { count: number; totalMs: number; max: number };
      say(`long tasks: ${lt.count} (total ${lt.totalMs.toFixed(0)} ms, max ${lt.max.toFixed(0)} ms)`);
      const g = game as Record<string, { avg: number; p95: number; max: number }> & { stepsPerFrame: number; frames: number };
      const row = (k: string): string => `${k.padEnd(7)} avg ${g[k].avg.toFixed(2).padStart(6)}  p95 ${g[k].p95.toFixed(2).padStart(6)}  max ${g[k].max.toFixed(1).padStart(6)}`;
      say(`game phases (ms/frame, ${g.frames} frames, ${g.stepsPerFrame.toFixed(2)} sim steps/frame):`);
      for (const k of ['sim', 'after', 'render', 'hud', 'js', 'draw', 'interval']) say(`  ${row(k)}`);
      const c = w.cdpPerFrameMs as Record<string, number>;
      say(`CDP per frame: task ${c.task.toFixed(2)} ms, script ${c.script.toFixed(2)}, layout ${c.layout.toFixed(3)} (${c.layoutsPerFrame.toFixed(2)}/frame), style ${c.recalcStyle.toFixed(3)} (${c.styleRecalcsPerFrame.toFixed(2)}/frame), thread CPU ${c.threadTime.toFixed(2)}`);
      say(`heap ${heap0.toFixed(1)} -> ${heap1.toFixed(1)} MB (${((heap1 - heap0) / wall * 60).toFixed(1)} MB/min), DOM nodes ${m0.Nodes} -> ${m1.Nodes}, listeners ${m0.JSEventListeners} -> ${m1.JSEventListeners}`);
      writeFileSync(outPath(`${name}-raf.json`), JSON.stringify({ deltas, longs }));
      if (prof) {
        writeFileSync(outPath(`${name}.cpuprofile`), JSON.stringify(prof));
        const summary = analyse(prof);
        w.profile = { sampledMs: summary.sampledMs, idleMs: summary.idleMs, gcMs: summary.gcMs, topSelf: summary.topSelf, topTotal: summary.topTotal, byFile: summary.byFile };
        const lines = printProfile(name, summary, d.frames);
        writeFileSync(outPath(`${name}-profile.txt`), lines.join('\n'));
        for (const l of lines.slice(0, 75)) say(l);
      }
      if (traceDone) {
        const events = (await traceDone) as { name: string; ph: string; dur?: number }[];
        writeFileSync(outPath(`${name}-trace.json`), JSON.stringify({ traceEvents: events }));
        const top = analyseTrace(events);
        w.trace = top;
        say('-- trace (8 s): event totals');
        for (const t of top.slice(0, 30)) say(`  ${t.ms.toFixed(0).padStart(7)} ms  ${String(t.count).padStart(6)}x  ${t.name}`);
      }
      const last = await sample(name);
      say(`objects: ${JSON.stringify(last)}`);
      return w;
    };

    const windows: Record<string, unknown>[] = [];
    type St = { pop: number[]; fighting: number; alive: number[]; queued: number[]; mixUnits: number; time: number; over: boolean };
    if (OPENING > 0) {
      // The real opening: the AI commanders as they are, music rendering in the background.
      await setScale(1);
      await throttle(CPU);
      await page.evaluate(natural);
      windows.push(await measure('opening', OPENING, { profile: PROFILE, trace: false, direct: false }));
      await page.evaluate(natural);
    }

    // Build-up (unthrottled, fast-forward, effects off): both sides hold and train the mix to the cap.
    await throttle(1);
    await setScale(20);
    const ff0 = Date.now();
    for (;;) {
      const st = (await page.evaluate(builder)) as St;
      if (F.has('verbose')) console.log(`  build ${JSON.stringify(st)}`);
      if ((st.alive[0] >= st.mixUnits * 0.92 && st.alive[1] >= st.mixUnits * 0.92 && st.queued[0] + st.queued[1] <= 2) || Date.now() - ff0 > 90_000) {
        say(`built in ${((Date.now() - ff0) / 1000).toFixed(0)} s wall: battle time ${st.time.toFixed(0)} s, pop ${st.pop.join('/')}, alive ${st.alive.join('/')} (mix ${st.mixUnits})`);
        break;
      }
      await sleep(500);
    }
    // Advance into each other at x4 (effects on) until the lines meet, then real time.
    await setScale(4);
    const c0 = Date.now();
    for (;;) {
      const st = (await page.evaluate(director)) as St;
      if (F.has('verbose')) console.log(`  close ${JSON.stringify(st)}`);
      if (st.fighting >= 30 || Date.now() - c0 > 120_000) {
        say(`contact after ${((Date.now() - c0) / 1000).toFixed(0)} s wall: battle time ${st.time.toFixed(0)} s, alive ${st.alive.join('/')}, fighting ${st.fighting}`);
        break;
      }
      await sleep(500);
    }
    await setScale(1);
    await throttle(CPU);
    for (let i = 0; i < 4; i++) {
      await page.evaluate(director);
      await sleep(1000);
    }
    windows.push(await measure('heavy', SECONDS, { profile: PROFILE, trace: TRACE, direct: true }));

    if (LONG_MIN > 0) {
      const end = Date.now() + LONG_MIN * 60_000;
      let i = 0;
      while (Date.now() < end) {
        await page.evaluate(director);
        if (i++ % 5 === 0) {
          const s = await sample('growth');
          if (i % 30 === 1) say(`growth t=${(s.wall as number).toFixed(0)} s: ${JSON.stringify(s)}`);
        }
        await sleep(1000);
      }
      windows.push(await measure('late', SECONDS, { profile: PROFILE, trace: false, direct: true }));
    }
    await throttle(1);
    result.windows = windows;
    result.samples = samples;
    result.problems = problems.slice(0, 50);
    if (problems.length) say(`page problems (${problems.length}): ${problems.slice(0, 10).join(' | ')}`);
  } finally {
    writeFileSync(outPath('result.json'), JSON.stringify(result, null, 2));
    writeFileSync(outPath('samples.json'), JSON.stringify(samples, null, 1));
    writeFileSync(outPath('log.txt'), log.join('\n'));
    console.log(`\nwrote ${outPath('result.json')}`);
    await browser.close();
    await new Promise<void>((ok) => server.httpServer.close(() => ok()));
  }
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
