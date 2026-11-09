/**
 * Visual QA capture of the production build (run `npm run build` first).
 *
 *   x.cmd npx tsx tools/qa.ts [--w=844] [--h=390] [--dsf=1] [--sdsf=2] [--out=.tools/shots/qa] [--only=a,b] [--frames=10] [--step=50]
 *
 * Plays the first campaign mission (Stalingrad 1001) through the ?debug=1 hooks under a Playwright fake clock, so
 * film-strip frames are exactly --step ms of game time apart, and writes:
 *   <w>-<scene>.png         full-screen scenes (battle start, sappers, HQ door, firefight, fall back, ...)
 *   <w>-strip-<name>.png    film strips: consecutive cropped frames around one unit, enlarged
 * Scenes are shot at --dsf; strips come from a second context at --sdsf so the limbs are sharp.
 * --only picks parts: main (the first mission walkthrough), strips, defeat, rain, hud, sandbox (the Phase 2 proving
 * ground, `<w>-sb-*.png`; add sbstrips for its film strips, --seed=11 picks the battle), missions (every campaign
 * mission played by the test bot, `<w>-mNN-*.png`; --missions=1001,1005 and --mseed=7 narrow it), campaign (map,
 * Quartermaster, briefing and result screens on a prepared save), and page (dev/render-preview.html on the
 * Vite dev server, no build needed: see pageRun for its flags).
 */
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';
import type { DebugState, FieldInfo, ProjectileInfo, UnitInfo } from '../src/app/debug';
import { CONFIG } from '../src/data/config';
import { META } from '../src/data/meta';
import { MISSIONS } from '../src/data/missions';
import { UPGRADES } from '../src/data/upgrades';
import { VIEW, VIEW_TOP_WU } from '../src/data/view';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flags = new Map<string, string>();
for (const a of args) {
  const eq = a.indexOf('=');
  if (a.startsWith('--')) flags.set(eq < 0 ? a.slice(2) : a.slice(2, eq), eq < 0 ? 'true' : a.slice(eq + 1));
}
const W = Number(flags.get('w') ?? 844);
const H = Number(flags.get('h') ?? 390);
const DSF = Number(flags.get('dsf') ?? 1);
const SDSF = Number(flags.get('sdsf') ?? 2);
const OUT = resolve(ROOT, flags.get('out') ?? '.tools/shots/qa');
const ONLY = new Set((flags.get('only') ?? 'main,strips,defeat,rain').split(','));
const FRAMES = Number(flags.get('frames') ?? 10);
const STEP = Number(flags.get('step') ?? 50);
const CSS_PER_WU = H / VIEW.viewHeightWu;
/** Device scale factor of the page being captured. */
let curDsf = DSF;

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

const log = (msg: string): void => console.log(msg);
const problems: string[] = [];

// --- page helpers -------------------------------------------------------------

const th = <T>(page: Page, expr: string): Promise<T> => page.evaluate(`window.__TH.${expr}`) as Promise<T>;
const st = (page: Page): Promise<DebugState> => th<DebugState>(page, 'state()');
const fieldOf = (page: Page): Promise<FieldInfo | null> => th<FieldInfo | null>(page, 'field()');
const unitsOf = (page: Page): Promise<UnitInfo[]> => th<UnitInfo[]>(page, 'units()');
const lookAt = (page: Page, x: number): Promise<void> => th<void>(page, `lookAt(${x.toFixed(1)})`);
const speed = (page: Page, k: number): Promise<void> => th<void>(page, `setTimeScale(${k})`);
const grant = (page: Page, n: number): Promise<void> => th<void>(page, `grantSupplies(${n})`);
const camLeft = async (page: Page): Promise<number> => (await th<{ left: number }>(page, 'camera()')).left;

async function tapId(page: Page, id: string): Promise<void> {
  try {
    await page.getByTestId(id).tap({ timeout: 1500 });
  } catch {
    // Gone or covered (the battle may have ended).
  }
}

async function waitFor(page: Page, what: string, ok: () => Promise<boolean>, ms = 60_000, poll = 120): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return true;
    await page.waitForTimeout(poll);
  }
  log(`  timed out waiting for ${what}`);
  return false;
}

async function pauseClock(page: Page): Promise<void> {
  // After a resume the clock's own time can run a little ahead of what Date.now() last returned.
  for (const ahead of [30, 300, 3000]) {
    const now = (await page.evaluate('Date.now()')) as number;
    try {
      await page.clock.pauseAt(now + ahead);
      return;
    } catch {
      // try further ahead
    }
  }
}

async function shot(page: Page, name: string): Promise<void> {
  const path = resolve(OUT, `${W}-${name}.png`);
  await page.screenshot({ path });
  log(`  ${W}-${name}.png`);
}

async function begin(page: Page, seed: number): Promise<void> {
  await th<boolean>(page, `startMission(${MISSIONS[0].id}, 'normal', ${seed})`);
  await waitFor(page, 'battle', async () => (await st(page)).screen === 'battle');
  await page.getByTestId('order-advance').waitFor({ timeout: 20_000 });
}

async function trainRifles(page: Page, count: number): Promise<void> {
  await speed(page, 20);
  for (let i = 0; i < 240; i++) {
    const s = await st(page);
    if (s.units[0].rifle >= count) break;
    if (s.supplies < 200) await grant(page, 400);
    if (s.queue.rifle < 3) await tapId(page, 'train-rifle');
    await page.waitForTimeout(200);
  }
}

// --- film strips -----------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen box (CSS px) around world x on unit row `row`, feet near the bottom. */
async function boxAt(page: Page, worldX: number, row: number, wWu: number, hWu: number): Promise<Box> {
  const left = await camLeft(page);
  const feetY = VIEW.groundY + VIEW.rowDy[row];
  const cx = (worldX - left) * CSS_PER_WU;
  const width = Math.round(wWu * CSS_PER_WU);
  const height = Math.round(hWu * CSS_PER_WU);
  const x = Math.round(Math.min(Math.max(cx - width / 2, 0), W - width));
  const y = Math.round(Math.min(Math.max((feetY - VIEW_TOP_WU) * CSS_PER_WU - height * 0.78, 0), H - height));
  return { x, y, width, height };
}

/** Write an image grid of frames, each enlarged `scale` times with hard pixels. */
async function compose(browser: Browser, name: string, frames: Buffer[], frameW: number, scale: number, cols: number, notes: string[]): Promise<void> {
  await composeAs(browser, `${W}-strip-${name}.png`, frames, frameW, scale, cols, notes);
}

async function composeAs(browser: Browser, file: string, frames: Buffer[], frameW: number, scale: number, cols: number, notes: string[]): Promise<void> {
  if (frames.length === 0) return;
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const cells = frames
    .map(
      (b, i) =>
        `<figure><img src="data:image/png;base64,${b.toString('base64')}" style="width:${Math.round(frameW * scale)}px"><figcaption>${i}${notes[i] ? ' ' + notes[i] : ''}</figcaption></figure>`,
    )
    .join('');
  await page.setContent(
    `<html><body style="margin:0;background:#222;font:12px monospace;color:#ddd"><div style="display:grid;grid-template-columns:repeat(${cols},max-content);gap:3px;padding:3px">${cells}</div>` +
      `<style>figure{margin:0}img{display:block;image-rendering:pixelated}figcaption{padding:1px 2px}</style></body></html>`,
  );
  await page.screenshot({ path: resolve(OUT, file), fullPage: true });
  await page.close();
  log(`  ${file}`);
}

/**
 * Freeze the clock and take `n` frames `STEP` ms apart around one unit.
 * follow = keep the crop on the unit; otherwise the crop stays put so foot sliding shows against the ground.
 */
async function strip(
  browser: Browser,
  page: Page,
  name: string,
  unit: UnitInfo,
  opts: { follow?: boolean; wWu?: number; hWu?: number; n?: number; cols?: number; step?: number },
): Promise<void> {
  const n = opts.n ?? FRAMES;
  const wWu = opts.wWu ?? 120;
  const hWu = opts.hWu ?? 95;
  await pauseClock(page);
  let box = await boxAt(page, unit.x, unit.row, wWu, hWu);
  const frames: Buffer[] = [];
  const notes: string[] = [];
  for (let i = 0; i < n; i++) {
    const all = await unitsOf(page);
    const me = all.find((u) => u.id === unit.id);
    if (me && opts.follow) box = await boxAt(page, me.x, me.row, wWu, hWu);
    notes.push(me ? `${me.action}${me.carrying ? '+c' : ''}` : 'dead');
    frames.push(await page.screenshot({ clip: box }));
    await page.clock.runFor(opts.step ?? STEP);
  }
  await page.clock.resume();
  await compose(browser, name, frames, box.width * curDsf, 3 / curDsf, opts.cols ?? Math.min(n, 6), notes);
}

/** Follow the lowest-health enemy in the fight until one dies, keeping the frames around the death. */
async function deathStrip(browser: Browser, page: Page): Promise<void> {
  await pauseClock(page);
  const ring: { buf: Buffer; note: string }[] = [];
  let target: UnitInfo | null = null;
  let after = -1;
  let box: Box | null = null;
  for (let i = 0; i < 400; i++) {
    const all = await unitsOf(page);
    if (target) {
      const me = all.find((u) => u.id === target?.id);
      if (!me && after < 0) after = 0;
      if (me) target = me;
    }
    if (!target || (after < 0 && i % 60 === 59)) {
      const enemies = all.filter((u) => u.side === 1 && u.kind !== 'sapper' && !u.inside);
      enemies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      target = enemies[0] ?? null;
      if (!target) break;
      ring.length = 0;
    }
    if (after < 0 || !box) box = await boxAt(page, target.x, target.row, 130, 90);
    ring.push({ buf: await page.screenshot({ clip: box }), note: after < 0 ? target.action : `dead+${after}` });
    if (ring.length > 3 && after < 0) ring.shift();
    if (after >= 0) after++;
    if (after >= FRAMES) break;
    await page.clock.runFor(STEP);
  }
  await page.clock.resume();
  if (after < 0) {
    log('  no death caught');
    return;
  }
  await compose(browser, 'death', ring.map((r) => r.buf), (box?.width ?? 100) * curDsf, 3 / curDsf, 6, ring.map((r) => r.note));
}

// --- scenarios ----------------------------------------------------------------------

async function openGame(browser: Browser, port: number, dsf: number): Promise<{ ctx: BrowserContext; page: Page }> {
  curDsf = dsf;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${port}/?debug=1`);
  await page.waitForFunction('window.__TH && window.__TH.ready === true', undefined, { timeout: 60_000 });
  return { ctx, page };
}

function hqDoor(side: 0 | 1, f: FieldInfo): number {
  return side === 0 ? f.playerHqX + CONFIG.hqDoorOffset : f.enemyHqX - CONFIG.hqDoorOffset;
}

async function mainRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, DSF);
  log('main');
  await begin(page, 5);
  await waitFor(page, 'tick 45', async () => (await st(page)).tick > 45);
  await shot(page, 'battle-start');

  await waitFor(page, 'a sapper carrying', async () => ((await fieldOf(page))?.sappersCarrying ?? 0) > 0, 90_000);
  const carrier = (await unitsOf(page)).find((u) => u.side === 0 && u.carrying);
  if (carrier) await lookAt(page, carrier.x + 120);
  await page.waitForTimeout(300);
  await shot(page, 'sappers');

  // Units pouring out of the HQ door.
  const f0 = (await fieldOf(page)) as FieldInfo;
  await grant(page, 1000);
  for (let i = 0; i < 6; i++) await tapId(page, 'train-rifle');
  await speed(page, 3);
  await lookAt(page, hqDoor(0, f0) + 230);
  await waitFor(page, 'riflemen out', async () => (await st(page)).units[0].rifle >= 3, 60_000);
  await speed(page, 1);
  await page.waitForTimeout(400);
  await shot(page, 'hq-door');

  // March.
  await trainRifles(page, 9);
  await tapId(page, 'order-advance');
  await speed(page, 4);
  await waitFor(page, 'march', async () => {
    const f = await fieldOf(page);
    return f !== null && f.playerFrontX !== null && f.playerFrontX > f.playerHqX + 900;
  });
  await speed(page, 1);
  const f1 = (await fieldOf(page)) as FieldInfo;
  await lookAt(page, (f1.playerFrontX ?? 0) - 150);
  await page.waitForTimeout(500);
  await shot(page, 'advance');

  // Firefight at mid-map.
  await speed(page, 6);
  await waitFor(page, 'gap 700', async () => ((await fieldOf(page))?.gap ?? 9999) < 700, 90_000);
  await speed(page, 2);
  await waitFor(page, 'gap 280', async () => ((await fieldOf(page))?.gap ?? 9999) < 280, 60_000);
  await speed(page, 1);
  for (let i = 0; i < 3; i++) {
    const f = await fieldOf(page);
    if (f && f.playerFrontX !== null && f.enemyFrontX !== null) await lookAt(page, (f.playerFrontX + f.enemyFrontX) / 2);
    await page.waitForTimeout(600);
  }
  await shot(page, 'firefight');

  // Fall back.
  await tapId(page, 'order-fallBack');
  await page.waitForTimeout(1600);
  const f3 = await fieldOf(page);
  if (f3 && f3.playerFrontX !== null) await lookAt(page, f3.playerFrontX - 150);
  await page.waitForTimeout(200);
  await shot(page, 'fall-back');
  await speed(page, 3);
  await lookAt(page, hqDoor(0, f0) + 200);
  await page.waitForTimeout(2500);
  await speed(page, 1);
  await shot(page, 'hq-garrison');

  // Advance on the enemy HQ.
  await tapId(page, 'order-advance');
  await speed(page, 8);
  for (let i = 0; i < 600; i++) {
    await grant(page, 800);
    await tapId(page, 'train-rifle');
    await tapId(page, 'train-rifle');
    const s = await st(page);
    const hq = s.hq[1];
    if (s.over || (hq && hq.hp < hq.max * 0.75)) break;
    await page.waitForTimeout(150);
  }
  await speed(page, 1);
  const f4 = await fieldOf(page);
  if (f4) await lookAt(page, f4.enemyHqX - 280);
  await page.waitForTimeout(700);
  await shot(page, 'hq-attack');
  await speed(page, 4);
  for (let i = 0; i < 600; i++) {
    await grant(page, 800);
    await tapId(page, 'train-rifle');
    const s = await st(page);
    const hq = s.hq[1];
    if (s.over || (hq && hq.hp < hq.max * 0.3)) break;
    await page.waitForTimeout(150);
  }
  await speed(page, 1);
  if (f4) await lookAt(page, f4.enemyHqX - 250);
  await page.waitForTimeout(700);
  await shot(page, 'hq-burning');

  await speed(page, 4);
  await waitFor(page, 'the enemy HQ nearly down', async () => {
    await grant(page, 800);
    await tapId(page, 'train-rifle');
    const s = await st(page);
    return s.over || (s.hq[1] !== null && s.hq[1].hp < s.hq[1].max * 0.08);
  }, 120_000, 150);
  await speed(page, 1);
  await waitFor(page, 'the end', async () => (await st(page)).over, 60_000, 50);
  const winner = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'rifle' && !u.inside);
  if (winner) {
    await lookAt(page, winner.x);
    await page.waitForTimeout(50);
    await strip(browser, page, 'cheer', winner, { wWu: 110, n: 8, cols: 8, step: 100, follow: true });
  }
  if (f4) await lookAt(page, f4.enemyHqX - 250);
  await page.waitForTimeout(600);
  await shot(page, 'victory-field');
  await page.getByTestId('result-reason').waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  await shot(page, 'victory');
  await ctx.close();
}

async function stripRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, SDSF);
  log('strips');
  await begin(page, 5);
  await waitFor(page, 'tick 45', async () => (await st(page)).tick > 45);

  // The two riflemen standing at the hold line (breathing, weight shift), 100 ms apart.
  const guard = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'rifle' && u.action === 'idle');
  if (guard) {
    await lookAt(page, guard.x);
    await page.waitForTimeout(100);
    await pauseClock(page);
    const frames: Buffer[] = [];
    const box = await boxAt(page, guard.x, guard.row, 80, 80);
    for (let i = 0; i < 8; i++) {
      frames.push(await page.screenshot({ clip: box }));
      await page.clock.runFor(250);
    }
    await page.clock.resume();
    await compose(browser, 'idle', frames, box.width * curDsf, 3 / curDsf, 8, frames.map((_, i) => `${i * 250}ms`));
  }
  // A sapper loading at the dump.
  await waitFor(page, 'a sapper loading', async () => (await unitsOf(page)).some((u) => u.side === 0 && u.action === 'load'), 60_000, 50);
  const loader = (await unitsOf(page)).find((u) => u.side === 0 && u.action === 'load');
  if (loader) {
    await lookAt(page, loader.x);
    await page.waitForTimeout(50);
    await strip(browser, page, 'sapper-load', loader, { wWu: 90, hWu: 80, n: 12, step: 180 });
  }

  // A sapper walking out empty, then one carrying a crate home.
  const empty = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'sapper' && u.action === 'move' && !u.carrying);
  if (empty) {
    await lookAt(page, empty.x + 100);
    await page.waitForTimeout(100);
    await strip(browser, page, 'sapper-walk', empty, { wWu: 75, hWu: 75, n: 12 });
  }
  await waitFor(page, 'a carrying sapper', async () => (await unitsOf(page)).some((u) => u.side === 0 && u.carrying && u.action === 'move'), 90_000);
  const carrier = (await unitsOf(page)).find((u) => u.side === 0 && u.carrying && u.action === 'move');
  if (carrier) {
    await lookAt(page, carrier.x - 100);
    await page.waitForTimeout(100);
    await strip(browser, page, 'sapper-carry', carrier, { wWu: 110, n: 12 });
  }

  // A rifleman walking out of the door.
  const f0 = (await fieldOf(page)) as FieldInfo;
  const door = hqDoor(0, f0);
  const before = new Set((await unitsOf(page)).map((u) => u.id));
  const isNew = (u: UnitInfo): boolean => u.side === 0 && u.kind === 'rifle' && !before.has(u.id);
  await grant(page, 600);
  await tapId(page, 'train-rifle');
  await tapId(page, 'train-rifle');
  await lookAt(page, door + 150);
  await waitFor(page, 'a new rifleman at the door', async () => (await unitsOf(page)).some(isNew), 30_000, 30);
  const fresh = (await unitsOf(page)).find(isNew);
  if (fresh) await strip(browser, page, 'door-out', { ...fresh, x: door + 40, row: 1 }, { wWu: 140, n: 12 });

  await trainRifles(page, 8);
  await tapId(page, 'order-advance');
  await speed(page, 4);
  await waitFor(page, 'march', async () => {
    const f = await fieldOf(page);
    return f !== null && f.playerFrontX !== null && f.playerFrontX > f.playerHqX + 900;
  });
  await speed(page, 1);
  await page.waitForTimeout(300);
  const runner = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'rifle' && u.action === 'move');
  if (runner) {
    await lookAt(page, runner.x + 60);
    await page.waitForTimeout(100);
    await strip(browser, page, 'rifle-run', runner, { wWu: 120, n: 12 });
    await strip(browser, page, 'rifle-run-follow', runner, { wWu: 90, n: 12, follow: true });
  }

  await speed(page, 6);
  await waitFor(page, 'gap 400', async () => ((await fieldOf(page))?.gap ?? 9999) < 400, 90_000);
  await speed(page, 1);
  const shooting = (u: UnitInfo): boolean => u.side === 0 && u.kind === 'rifle' && (u.action === 'aim' || u.action === 'fire' || u.action === 'reload');
  await waitFor(page, 'a rifleman shooting', async () => (await unitsOf(page)).some(shooting), 20_000, 100);
  const shooter = (await unitsOf(page)).find(shooting);
  if (shooter) {
    await lookAt(page, shooter.x + 100);
    await page.waitForTimeout(100);
    await strip(browser, page, 'rifle-fire', shooter, { wWu: 110, n: 12, follow: true });
  }
  const f = await fieldOf(page);
  if (f && f.enemyFrontX !== null) await lookAt(page, f.enemyFrontX);
  await page.waitForTimeout(100);
  await deathStrip(browser, page);
  // Enemy riflemen fighting, for the side read.
  const foe = (await unitsOf(page)).find((u) => u.side === 1 && u.kind === 'rifle');
  if (foe) {
    await lookAt(page, foe.x - 60);
    await page.waitForTimeout(100);
    await strip(browser, page, 'enemy-fire', foe, { wWu: 130, n: 6, follow: true });
  }

  // Fall back: the run home and into the door.
  await tapId(page, 'order-fallBack');
  await page.waitForTimeout(700);
  const back = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'rifle' && u.action === 'move');
  if (back) {
    await lookAt(page, back.x - 60);
    await page.waitForTimeout(100);
    await strip(browser, page, 'fallback-run', back, { wWu: 90, n: 12, follow: true });
  }
  await speed(page, 4);
  await lookAt(page, door + 150);
  const homing = (u: UnitInfo): boolean => u.side === 0 && u.kind === 'rifle' && !u.inside && u.x < door + 75;
  await waitFor(page, 'a unit near the door', async () => (await unitsOf(page)).some(homing), 60_000, 25);
  await speed(page, 1);
  const homer = (await unitsOf(page)).find(homing);
  if (homer) await strip(browser, page, 'door-in', { ...homer, x: door + 40, row: 1 }, { wWu: 140, n: 12 });
  await ctx.close();
}

async function defeatRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, DSF);
  log('defeat');
  await begin(page, 3);
  await speed(page, 120);
  await waitFor(page, 'own HQ nearly down', async () => {
    const s = await st(page);
    return s.over || (s.hq[0] !== null && s.hq[0].hp < s.hq[0].max * 0.15);
  }, 170_000, 100);
  await speed(page, 1);
  const f = await fieldOf(page);
  if (f) await lookAt(page, f.playerHqX + 330);
  await page.waitForTimeout(1500);
  await shot(page, 'hq-burning-own');
  await speed(page, 2);
  await waitFor(page, 'defeat', async () => (await st(page)).over, 120_000, 50);
  await speed(page, 1);
  await page.waitForTimeout(1500);
  await shot(page, 'defeat-field');
  await page.getByTestId('result-reason').waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  await shot(page, 'defeat');
  await ctx.close();
}

async function rainRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, DSF);
  log('rain');
  await begin(page, 7);
  await th<void>(page, `forceWeather('rain')`);
  await grant(page, 600);
  for (let i = 0; i < 3; i++) await tapId(page, 'train-rifle');
  await page.waitForTimeout(3500);
  const f = (await fieldOf(page)) as FieldInfo;
  await lookAt(page, f.playerHqX + 450);
  await page.waitForTimeout(500);
  await shot(page, 'rain');
  await pauseClock(page);
  await th<void>(page, 'forceThunder()');
  const frames: Buffer[] = [];
  const notes: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.clock.runFor(STEP);
    const buf = await page.screenshot();
    frames.push(buf);
    notes.push(`${(i + 1) * STEP}ms`);
    if (i === 1) writeFileSync(resolve(OUT, `${W}-rain-flash.png`), buf);
  }
  await page.clock.resume();
  await compose(browser, 'lightning', frames, W * DSF, 0.5 / DSF, 4, notes);
  await ctx.close();
}

/**
 * --only=page: the renderer preview page (Vite dev server, so no build needed) shot under the fake clock.
 *   --q="army=14&skip=20"   query string for dev/render-preview.html (scene=..., cam=..., zoom=... and so on)
 *   --page=dev/art-figures.html   another dev page instead (it must set window.__ready)
 *   --at=0,200,400          times (ms of game time after the page is ready) to shoot; several are composed into a sheet
 *   --clip=x,y,w,h          crop (CSS px); --cols=4 and --scale=1 lay out the sheet; --name=out names the file
 */
async function pageRun(browser: Browser): Promise<void> {
  const port = await freePort();
  const srv = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.tools', 'vite-cache', 'qa'),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await srv.listen();
  try {
    curDsf = DSF;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${port}/${flags.get('page') ?? 'dev/render-preview.html'}?${flags.get('q') ?? ''}`, { timeout: 180_000 });
    await page.waitForFunction('window.__ready === true', undefined, { timeout: 180_000 });
    await pauseClock(page);
    const at = (flags.get('at') ?? '0').split(',').map(Number);
    const c = flags.get('clip')?.split(',').map(Number);
    const clip = c && c.length === 4 ? { x: c[0], y: c[1], width: c[2], height: c[3] } : undefined;
    const name = flags.get('name') ?? 'page';
    const frames: Buffer[] = [];
    let now = 0;
    for (const t of at) {
      if (t > now) await page.clock.runFor(t - now);
      now = Math.max(now, t);
      frames.push(await page.screenshot(clip ? { clip } : {}));
    }
    if (frames.length === 1) {
      writeFileSync(resolve(OUT, `${W}-${name}.png`), frames[0]);
      log(`  ${W}-${name}.png`);
    } else {
      const fw = (clip ? clip.width : W) * DSF;
      await composeAs(browser, `${W}-${name}.png`, frames, fw, Number(flags.get('scale') ?? 1) / DSF, Number(flags.get('cols') ?? 4), at.map((t) => `${t}ms`));
    }
    await ctx.close();
  } finally {
    await srv.close();
  }
}

/** Close-up of the HUD unit cards while training (progress sweep, queue badges). */
async function hudRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, 3);
  log('hud');
  await begin(page, 5);
  await grant(page, 1000);
  for (let i = 0; i < 4; i++) await tapId(page, 'train-rifle');
  await tapId(page, 'train-sapper');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(OUT, `${W}-hud-cards.png`), clip: { x: 0, y: H - 80, width: 160, height: 80 } });
  await page.screenshot({ path: resolve(OUT, `${W}-hud-top.png`), clip: { x: 0, y: 0, width: W, height: 60 } });
  log(`  ${W}-hud-cards.png, ${W}-hud-top.png`);
  await ctx.close();
}

// --- Phase 3: every mission, and the campaign screens ----------------------------------------

/**
 * Missions to capture (--missions=1001,1005,1010; default all ten), the base battle seed (--mseed; mission N uses
 * mseed + N) and the missions shot in rain (--rainy=8; the others are forced clear so each theatre shows).
 */
const MISSION_IDS = (flags.get('missions') ?? MISSIONS.map((m) => m.id).join(',')).split(',').map(Number);
const MISSION_SEED = Number(flags.get('mseed') ?? 7);
const RAINY = new Set((flags.get('rainy') ?? '8').split(',').map(Number));
/** Seed for a deadline mission (--lateseed): one where the bot is still fighting as night falls. */
const LATE_SEED = Number(flags.get('lateseed') ?? 31);

/** The most forward fighting unit of each side on the field (the player faces +x), or null. */
async function fronts(page: Page): Promise<{ mine: number | null; theirs: number | null }> {
  let mine: number | null = null;
  let theirs: number | null = null;
  for (const u of await unitsOf(page)) {
    if (u.inside || u.kind === 'sapper') continue;
    if (u.side === 0) {
      if (mine === null || u.x > mine) mine = u.x;
    } else if (theirs === null || u.x < theirs) {
      theirs = u.x;
    }
  }
  return { mine, theirs };
}

/**
 * --only=missions: each mission from the production build, played for the player by the sim's test bot
 * (debug autopilot): `mNN-open` (the opening view), `mNN-line` (the first German line), `mNN-boss` (a King
 * Tiger, if any), `mNN-mid` (the front once the lines are in contact well into the battle) and, for a deadline
 * mission, `mNN-late` (near the end of its clock).
 */
async function missionsRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, DSF);
  log('missions');
  await th<void>(page, 'autopilot(true)');
  for (const id of MISSION_IDS) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) continue;
    const tag = `m${String(id).padStart(2, '0')}`;
    const seed = m.timer && m.timer.onExpire === 'lose' ? LATE_SEED : MISSION_SEED + id;
    await th<boolean>(page, `startMission(${id}, 'normal', ${seed})`);
    await waitFor(page, 'battle', async () => (await st(page)).screen === 'battle');
    await page.getByTestId('order-advance').waitFor({ timeout: 20_000 });
    await th<void>(page, `forceWeather('${RAINY.has(id) ? 'rain' : 'clear'}')`);
    await waitFor(page, 'tick 45', async () => (await st(page)).tick > 45);
    await shot(page, `${tag}-open`);
    const enemy = [...m.trenches.filter((t) => t.owner === 1).map((t) => t.x), ...m.pillboxes.filter((p) => p.side === 1).map((p) => p.x)];
    if (enemy.length > 0) {
      await lookAt(page, Math.min(...enemy) + 250);
      await page.waitForTimeout(500);
      await shot(page, `${tag}-line`);
    }
    const boss = (await unitsOf(page)).find((u) => u.kind === 'heavyTank');
    if (boss) {
      await lookAt(page, boss.x - 120);
      await page.waitForTimeout(500);
      await shot(page, `${tag}-boss`);
    }
    await speed(page, 10);
    const minTime = m.timer ? m.timer.seconds * 0.45 : 150;
    await waitFor(
      page,
      `${tag} contact`,
      async () => {
        const s = await st(page);
        if (s.screen !== 'battle' || s.over) return true;
        if (s.time < minTime) return false;
        const f = await fronts(page);
        return f.mine !== null && f.theirs !== null && f.theirs - f.mine < 420;
      },
      300_000,
      400,
    );
    await speed(page, 1);
    const f = await fronts(page);
    if (f.mine !== null) await lookAt(page, f.mine + 120);
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-mid`);
    if (m.timer && m.timer.onExpire === 'lose') {
      const lateAt = m.timer.seconds * 0.12;
      await speed(page, 10);
      await waitFor(
        page,
        `${tag} late`,
        async () => {
          const s = await st(page);
          return s.screen !== 'battle' || s.over || (s.timer ?? 0) < lateAt;
        },
        240_000,
        400,
      );
      await speed(page, 1);
      const g = await fronts(page);
      if (g.mine !== null) await lookAt(page, g.mine + 120);
      await page.waitForTimeout(1200);
      await shot(page, `${tag}-late`);
    }
  }
  await th<void>(page, 'autopilot(false)');
  await ctx.close();
}

/**
 * --only=campaign: the menus on a save with four missions cleared and eight points spent: `campaign` (the map),
 * `quartermaster`, `briefing` (mission 5, with its NEW cards) and `result` (mission 5 played to the end by the
 * test bot at speed).
 */
async function campaignRun(browser: Browser, port: number): Promise<void> {
  const ids = UPGRADES.map((u) => u.id);
  const save = {
    version: META.saveVersion,
    cleared: { 1001: ['normal'], 1002: ['normal'], 1003: ['hard'], 1004: ['normal'] },
    upgrades: { [ids[0]]: 2, [ids[2]]: 1, [ids[5]]: 2, [ids[6]]: 3 },
    lastMission: 1004,
    settings: { muted: true, difficulty: 'normal', hints: true },
  };
  curDsf = DSF;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  await ctx.addInitScript(`try { localStorage.setItem(${JSON.stringify(META.saveKey)}, ${JSON.stringify(JSON.stringify(save))}); } catch (e) {}`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/?debug=1`);
  await page.waitForFunction('window.__TH && window.__TH.ready === true', undefined, { timeout: 60_000 });
  log('campaign');
  const screenIs = (name: string) => waitFor(page, name, async () => (await st(page)).screen === name, 20_000);
  await tapId(page, 'play');
  await screenIs('campaign');
  await page.waitForTimeout(900);
  await shot(page, 'campaign');
  await tapId(page, 'quartermaster');
  await screenIs('quartermaster');
  await page.waitForTimeout(900);
  await shot(page, 'quartermaster');
  await tapId(page, 'back');
  await screenIs('campaign');
  await page.waitForTimeout(600);
  await tapId(page, 'mission-pin-1005');
  await page.waitForTimeout(400);
  await tapId(page, 'mission-start');
  await screenIs('briefing');
  // Let the typewriter finish the three paragraphs.
  await page.waitForTimeout(9000);
  await shot(page, 'briefing');
  await th<void>(page, 'autopilot(true)');
  await tapId(page, 'begin');
  await screenIs('battle');
  await speed(page, 12);
  await waitFor(page, 'result', async () => (await st(page)).screen === 'result', 400_000, 500);
  await page.waitForTimeout(1200);
  await shot(page, 'result');
  await ctx.close();
}

// --- the proving ground (Phase 2) ---------------------------------------------------------

/** Seed of the proving-ground run (--seed). */
const SB_SEED = Number(flags.get('seed') ?? 11);
/** The proving ground's fortifications (src/data/missions/sandbox.ts). */
const SB = { ownTrench: 1700, enemyTrenches: [4700, 6000], enemyWire: 4450, pillboxes: [4900, 6200] } as const;

const projOf = (page: Page): Promise<ProjectileInfo[]> => th<ProjectileInfo[]>(page, 'projectiles()');

async function beginSandbox(page: Page, seed: number): Promise<void> {
  await th<boolean>(page, `startSandbox(${seed})`);
  await waitFor(page, 'battle', async () => (await st(page)).screen === 'battle');
  await page.getByTestId('order-hold').waitFor({ timeout: 20_000 });
}

/** A real tap on the battlefield at world x, high on the screen where no soldier stands. */
async function tapWorldAt(page: Page, x: number, fy = 0.3): Promise<boolean> {
  const c = await th<{ left: number; cssPerWu: number }>(page, 'camera()');
  const sx = (x - c.left) * c.cssPerWu;
  if (sx < 0 || sx > W) {
    log(`  world x ${x.toFixed(0)} is off screen (camera left ${c.left.toFixed(0)})`);
    return false;
  }
  await page.touchscreen.tap(sx, H * fy);
  return true;
}

/** Call a support on world x with real taps (button, then the field). */
async function callSupport(page: Page, kind: string, x: number): Promise<boolean> {
  await lookAt(page, x);
  await page.waitForTimeout(200);
  await tapId(page, `support-${kind}`);
  if (!(await waitFor(page, `${kind} aimed`, async () => (await st(page)).targeting === kind, 5000))) return false;
  if (!(await tapWorldAt(page, x))) return false;
  return waitFor(page, `${kind} called`, async () => ((await st(page)).tally.supportCalled as Record<string, number>)[kind] > 0, 5000);
}

/** With the clock paused, step game time until `found` says so. The clock stays paused when it does. */
async function catchUntil(page: Page, found: () => Promise<boolean>, maxMs: number, step = 33): Promise<boolean> {
  await pauseClock(page);
  for (let t = 0; t < maxMs; t += step) {
    if (await found()) return true;
    await page.clock.runFor(step);
  }
  await page.clock.resume();
  return false;
}

/**
 * Film one unit around a moment that cannot be predicted (a launch): frames STEP ms apart go into a ring of
 * `before` frames until `fired` reports the round, then `after` more are taken. The crop stays put.
 */
async function launchStrip(
  browser: Browser,
  page: Page,
  name: string,
  unit: UnitInfo,
  fired: (ps: ProjectileInfo[], me: UnitInfo) => boolean,
  opts: { wWu: number; hWu: number; before?: number; after?: number; maxMs?: number; dx?: number; follow?: boolean },
): Promise<boolean> {
  await lookAt(page, unit.x + (opts.dx ?? 0));
  await pauseClock(page);
  let box = await boxAt(page, unit.x, unit.row, opts.wWu, opts.hWu);
  const before = opts.before ?? 4;
  const after = opts.after ?? 8;
  const ring: { buf: Buffer; note: string }[] = [];
  let left = -1;
  for (let t = 0; t < (opts.maxMs ?? 8000) && left !== 0; t += STEP) {
    const me = (await unitsOf(page)).find((u) => u.id === unit.id);
    if (!me && left < 0) break;
    if (me && opts.follow) box = await boxAt(page, me.x, me.row, opts.wWu, opts.hWu);
    if (left < 0 && me && fired(await projOf(page), me)) left = after;
    ring.push({ buf: await page.screenshot({ clip: box }), note: `${me ? me.action : 'dead'}${left === after ? ' LAUNCH' : ''}` });
    if (left < 0 && ring.length > before) ring.shift();
    if (left > 0) left--;
    await page.clock.runFor(STEP);
  }
  await page.clock.resume();
  if (left !== 0) {
    log(`  ${name}: no launch caught`);
    return false;
  }
  await compose(browser, name, ring.map((r) => r.buf), box.width * curDsf, 3 / curDsf, 6, ring.map((r) => r.note));
  return true;
}

/** Direct control with the real joystick: out of the trench, FIRE held, back into the trench and let go. */
async function controlScenes(browser: Browser, ctx: BrowserContext, page: Page, strips: boolean): Promise<void> {
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: { x: number; y: number; id: number }[]): Promise<void> => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  };
  const man = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'rifle' && u.trench === 1);
  if (!man) return;
  await lookAt(page, SB.ownTrench + 120);
  await page.waitForTimeout(200);
  const where = await th<{ x: number; y: number } | null>(page, `unitScreenPos(${man.id})`);
  if (!where) return;
  await page.touchscreen.tap(where.x, where.y);
  if (!(await waitFor(page, 'control', async () => (await st(page)).controlled !== null, 5000))) return;
  await page.waitForTimeout(300);
  await shot(page, 'sb-control-trench');
  const stick = await page.getByTestId('stick').boundingBox();
  const fire = await page.getByTestId('fire').boundingBox();
  if (!stick || !fire) return;
  const cx = stick.x + stick.width / 2;
  const cy = stick.y + stick.height / 2;
  const right = { x: cx + stick.width / 2 - 6, y: cy, id: 0 };
  const left = { x: cx - stick.width / 2 + 6, y: cy, id: 0 };
  const thumb = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 1 };
  await touch('touchStart', [{ x: cx, y: cy, id: 0 }]);
  await touch('touchMove', [right]);
  if (strips) await strip(browser, page, 'trench-out', man, { wWu: 200, hWu: 100, n: 12, step: 120, follow: true });
  else await page.waitForTimeout(1200);
  await touch('touchStart', [right, thumb]);
  await page.waitForTimeout(600);
  await shot(page, 'sb-control');
  await touch('touchEnd', []);
  // Back left; let go of the stick inside the trench so he takes a slot.
  await touch('touchStart', [left]);
  await waitFor(page, 'over the trench', async () => (await st(page)).controlled !== null && ((await st(page)).controlled?.x ?? 0) < SB.ownTrench + 35, 20_000, 25);
  await touch('touchEnd', []);
  const me = (await unitsOf(page)).find((u) => u.id === man.id);
  if (strips && me) await strip(browser, page, 'trench-in', me, { wWu: 160, hWu: 100, n: 12, step: 100, follow: true });
  else await page.waitForTimeout(1200);
  log(`  back in the trench: ${String((await st(page)).controlled?.inTrench)}`);
  await tapId(page, 'release');
  if (!(await waitFor(page, 'released', async () => (await st(page)).controlled === null, 3000))) await page.keyboard.press('KeyR');
  await waitFor(page, 'released (R)', async () => (await st(page)).controlled === null, 3000);
  await cdp.detach();
}

/** Take the Churchill with a tap, drive it with the stick into the German wire and shoot the moment it goes flat. */
async function tankThroughWire(browser: Browser, ctx: BrowserContext, page: Page, strips: boolean): Promise<void> {
  const tank = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'tank');
  if (!tank) return;
  await lookAt(page, tank.x);
  await page.waitForTimeout(200);
  const where = await th<{ x: number; y: number } | null>(page, `unitScreenPos(${tank.id})`);
  if (!where) return;
  await page.touchscreen.tap(where.x, where.y);
  if (!(await waitFor(page, 'tank control', async () => (await st(page)).controlled?.kind === 'tank', 5000))) return;
  const stick = await page.getByTestId('stick').boundingBox();
  if (!stick) return;
  const cdp = await ctx.newCDPSession(page);
  const push = { x: stick.x + stick.width - 6, y: stick.y + stick.height / 2, id: 0 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stick.x + stick.width / 2, y: push.y, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [push] });
  if (strips) {
    await page.waitForTimeout(600);
    const me = (await unitsOf(page)).find((u) => u.id === tank.id);
    if (me) await strip(browser, page, 'tank-drive', me, { wWu: 280, hWu: 130, n: 12, step: 66, follow: true });
  }
  await speed(page, 8);
  await waitFor(page, 'the tank at the wire', async () => ((await st(page)).controlled?.x ?? 0) > SB.enemyWire - 420, 90_000, 50);
  await speed(page, 1);
  await lookAt(page, SB.enemyWire + 40);
  let pre = false;
  const crushed = await catchUntil(page, async () => {
    const s = await st(page);
    if (!pre && (s.controlled?.x ?? 0) > SB.enemyWire - 200) {
      pre = true;
      await shot(page, 'sb-wire-pre');
    }
    return s.tally.wireDestroyed > 0 || s.controlled === null;
  }, 15_000, 50);
  if (crushed) {
    await page.clock.runFor(250);
    await shot(page, 'sb-wire');
    await page.clock.resume();
  } else log(`  the wire was not crushed (tank at ${String((await st(page)).controlled?.x)})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await tapId(page, 'release');
  if (!(await waitFor(page, 'released', async () => (await st(page)).controlled === null, 3000))) await page.keyboard.press('KeyR');
}

/**
 * --only=sandbox (and sbstrips for the film strips): the proving ground from the production build. Covers the
 * Phase 2 scenes (trench garrison, direct control, the three call-ins, an armoured push through wire into the German
 * trenches and pillboxes, the specialists at work, rain) and strips of a mortar, a grenade throw, a tank and a trench.
 */
async function sandboxRun(browser: Browser, port: number): Promise<void> {
  const { ctx, page } = await openGame(browser, port, DSF);
  const strips = ONLY.has('sbstrips');
  log('sandbox');
  await beginSandbox(page, SB_SEED);
  await th<void>(page, `forceWeather('clear')`);
  await grant(page, 3000);
  await th<void>(page, 'grantPopulation(60)');
  await waitFor(page, 'tick 60', async () => (await st(page)).tick > 60);
  await lookAt(page, SB.ownTrench + 120);
  await page.waitForTimeout(400);
  await shot(page, 'sb-trench');
  // The German garrison and its specialists, for the faction read.
  await lookAt(page, SB.enemyTrenches[0] + 250);
  await page.waitForTimeout(300);
  await shot(page, 'sb-germans');

  await controlScenes(browser, ctx, page, strips);
  await tankThroughWire(browser, ctx, page, strips);

  // The three call-ins, on the German trench and the ground in front of it.
  if (await callSupport(page, 'artillery', SB.enemyTrenches[0])) {
    const blasts = (await st(page)).tally.explosion;
    await waitFor(page, 'shells', async () => (await st(page)).tally.explosion > blasts, 30_000, 50);
    await page.waitForTimeout(250);
    await shot(page, 'sb-artillery');
    await page.waitForTimeout(900);
    await shot(page, 'sb-artillery-2');
  }
  if (await callSupport(page, 'smoke', SB.enemyWire - 150)) {
    await waitFor(page, 'smoke', async () => (await st(page)).smokes > 0, 30_000, 50);
    await page.waitForTimeout(1500);
    await shot(page, 'sb-smoke');
  }
  if (await callSupport(page, 'airStrike', SB.pillboxes[0])) {
    await waitFor(page, 'the plane', async () => ((await st(page)).tally.supportIncoming as Record<string, number>).airStrike > 0, 30_000, 50);
    await pauseClock(page);
    await page.clock.runFor(2150);
    await shot(page, 'sb-airstrike');
    await page.clock.runFor(450);
    await shot(page, 'sb-airstrike-2');
    await page.clock.resume();
  }

  // Build an army and send it forward; shoot each sight the first time it shows up.
  const army = ['tank', 'assault', 'mortar', 'at', 'rifle', 'assault', 'medic', 'rifle', 'tank', 'sniper', 'mortar', 'rifle'];
  await speed(page, 6);
  for (let i = 0; i < 80; i++) {
    const s = await st(page);
    if (s.units[0].tank >= 2 && s.units[0].assault >= 4 && s.units[0].mortar >= 2) break;
    await grant(page, 1500);
    for (const k of army) if ((s.queue as Record<string, number>)[k] < 1) await tapId(page, `train-${k}`);
    await page.waitForTimeout(200);
  }
  await speed(page, 1);
  // Every British kind waiting behind the line, for the silhouette read.
  await lookAt(page, SB.ownTrench - 250);
  await page.waitForTimeout(600);
  await shot(page, 'sb-army');
  const leaver = (await unitsOf(page)).find((u) => u.side === 0 && u.trench === 1 && u.kind === 'rifle');
  if (strips && leaver) {
    await lookAt(page, leaver.x + 40);
    await page.waitForTimeout(100);
  }
  await tapId(page, 'order-advance');
  if (strips && leaver) await strip(browser, page, 'trench-advance', leaver, { wWu: 200, hWu: 100, n: 12, step: 100 });

  const want = new Set(['assault', 'mortar-pillbox', 'rubble', 'duel', 'at', 'medic', 'sniper', 'rain']);
  if (strips) for (const k of ['tank-strip', 'throw-strip', 'mortar-strip', 'drop-strip']) want.add(k);
  const end = Date.now() + 300_000;
  let fast = 3;
  let ruinSeen = -1;
  let dropTries = 0;
  while (want.size > 0 && Date.now() < end) {
    await speed(page, fast);
    await grant(page, 800);
    let s = await st(page);
    if (s.over) break;
    for (const k of army) {
      if (s.pop < s.popCap - 6 && (s.queue as Record<string, number>)[k] < 1) await tapId(page, `train-${k}`);
    }
    s = await st(page);
    const us = await unitsOf(page);
    const mine = us.filter((u) => u.side === 0 && !u.inside);
    const tanks = mine.filter((u) => u.kind === 'tank');
    const foeTanks = us.filter((u) => u.side === 1 && (u.kind === 'tank' || u.kind === 'heavyTank'));
    const pb = s.pillboxes;
    const enemyWorks = [...SB.enemyTrenches, ...pb.filter((p) => p.alive).map((p) => p.x)];
    let took = false;
    const snap = async (key: string, x: number, name: string): Promise<void> => {
      await speed(page, 1);
      await lookAt(page, x);
      await page.waitForTimeout(250);
      await shot(page, name);
      want.delete(key);
      took = true;
    };
    // A grenade in the air over a German trench or pillbox.
    if (!took && want.has('assault') && mine.some((u) => u.kind === 'assault' && u.action === 'throw')) {
      await speed(page, 1);
      let at = 0;
      const ok = await catchUntil(page, async () => {
        const g = (await projOf(page)).find((p) => p.side === 0 && p.weapon === 'grenade' && p.t > 0.35 && enemyWorks.some((x) => Math.abs(p.toX - x) < 160));
        if (g) at = (g.fromX + g.toX) / 2;
        return g !== undefined;
      }, 4000);
      if (ok) {
        await lookAt(page, at + 40);
        await page.clock.runFor(20);
        await shot(page, 'sb-assault');
        await page.clock.resume();
        want.delete('assault');
      }
      took = true;
    }
    // A mortar bomb coming down on a pillbox.
    const box0 = pb.find((p) => p.alive);
    if (!took && want.has('mortar-pillbox') && box0 && mine.some((u) => u.kind === 'mortar' && (u.action === 'aim' || u.action === 'fire' || u.action === 'reload'))) {
      await speed(page, 1);
      const ok = await catchUntil(page, async () => (await projOf(page)).some((p) => p.side === 0 && p.weapon === 'mortar' && p.t > 0.72 && Math.abs(p.toX - box0.x) < 220), 6000);
      if (ok) {
        await lookAt(page, box0.x - 160);
        await page.clock.runFor(20);
        await shot(page, 'sb-mortar-pillbox');
        await page.clock.resume();
        want.delete('mortar-pillbox');
      }
      took = true;
    }
    const ruin = pb.find((p) => !p.alive);
    if (ruin && ruinSeen < 0) ruinSeen = s.time;
    if (!took && want.has('rubble') && ruin && s.time > ruinSeen + 6) await snap('rubble', ruin.x + 60, 'sb-rubble');
    for (const t of tanks) {
      const foe = foeTanks.find((f) => Math.abs(f.x - t.x) < 650);
      if (!took && want.has('duel') && foe) await snap('duel', (t.x + foe.x) / 2, 'sb-tank-duel');
    }
    const at = mine.find((u) => u.kind === 'at' && u.action === 'fire') ?? us.find((u) => u.kind === 'at' && !u.inside && u.action === 'fire');
    if (!took && want.has('at') && at) await snap('at', at.x + 160 * (at.side === 0 ? 1 : -1), 'sb-at');
    const medic = mine.find((u) => u.kind === 'medic' && u.action === 'heal');
    if (!took && want.has('medic') && medic) await snap('medic', medic.x, 'sb-medic');
    const sniper = mine.find((u) => u.kind === 'sniper' && (u.action === 'aim' || u.action === 'fire'));
    if (!took && want.has('sniper') && sniper) await snap('sniper', sniper.x + 200, 'sb-sniper');
    if (!took && want.has('rain') && want.size <= 6) {
      await speed(page, 1);
      await th<void>(page, `forceWeather('rain')`);
      const f = await fieldOf(page);
      await lookAt(page, (f?.playerFrontX ?? SB.enemyTrenches[0]) - 120);
      await page.waitForTimeout(1600);
      await shot(page, 'sb-rain');
      await th<void>(page, `forceWeather('clear')`);
      want.delete('rain');
      took = true;
    }
    // Strips: wait under a paused clock for the launch, keeping a few frames from before it.
    // Near rows only: a tank or a burnt-out husk on a nearer row would hide the man.
    const clear = (u: UnitInfo): boolean => u.row >= 2 && !tanks.some((t) => Math.abs(t.x - u.x) < 230 && t.row > u.row);
    if (!took && want.has('throw-strip') && mine.some((u) => u.kind === 'assault' && u.row >= 2 && enemyWorks.some((x) => Math.abs(x - u.x) < 300))) {
      await speed(page, 1);
      // Catch the start of a throw (the round leaves the hand config.throwReleaseTime later), then film to the release.
      const caught: { u: UnitInfo | undefined } = { u: undefined };
      await catchUntil(page, async () => {
        caught.u = (await unitsOf(page)).find((u) => u.side === 0 && u.kind === 'assault' && u.action === 'throw' && u.actionTime < 0.1 && clear(u));
        return caught.u !== undefined;
      }, 6000, 33);
      const who = caught.u;
      if (who) {
        const ok = await launchStrip(browser, page, 'throw', who, (ps, me) => ps.some((p) => p.side === 0 && p.weapon === 'grenade' && Math.abs(p.fromX - me.x) < 80 && p.t < 0.25), { wWu: 150, hWu: 110, before: 10, after: 8, dx: 40 });
        if (ok) want.delete('throw-strip');
      }
      took = true;
    }
    const tube = mine.find((u) => u.kind === 'mortar' && (u.action === 'aim' || u.action === 'reload') && clear(u));
    if (!took && want.has('mortar-strip') && tube) {
      await speed(page, 1);
      const ok = await launchStrip(browser, page, 'mortar', tube, (ps) => ps.some((p) => p.side === 0 && p.weapon === 'mortar' && Math.abs(p.fromX - tube.x) < 40 && p.t < 0.2), { wWu: 130, hWu: 140, before: 4, after: 8, dx: 40 });
      if (ok) want.delete('mortar-strip');
      took = true;
    }
    const gunner = tanks.find((u) => u.action === 'aim' || u.action === 'reload');
    if (!took && want.has('tank-strip') && gunner) {
      await speed(page, 1);
      const ok = await launchStrip(browser, page, 'tank-fire', gunner, (ps) => ps.some((p) => p.side === 0 && p.weapon === 'tankGun' && Math.abs(p.fromX - gunner.x) < 160 && p.t < 0.3), { wWu: 280, hWu: 130, before: 3, after: 9, dx: 60 });
      if (ok) want.delete('tank-strip');
      took = true;
    }
    // A man taking his place in a trench (either side), filmed from a few steps out. Many walkers pass a trench without
    // a free slot, so this is tried last and only a few times.
    const occupancy = (u: UnitInfo): number => {
      const t = s.trenches.find((tr) => tr.owner === u.side && Math.abs(tr.x - u.x) < 150);
      return t && t.occupants < 6 ? t.x : NaN;
    };
    const dropper = us.find((u) => !u.inside && u.trench < 0 && u.action === 'move' && u.kind !== 'tank' && u.kind !== 'heavyTank' && u.kind !== 'sapper' && !Number.isNaN(occupancy(u)));
    if (!took && want.has('drop-strip') && dropper && dropTries < 4) {
      dropTries++;
      await speed(page, 1);
      const ok = await launchStrip(browser, page, 'trench-drop', dropper, (_ps, me) => me.trench >= 0, { wWu: 160, hWu: 100, before: 10, after: 8, follow: true, maxMs: 5000 });
      if (ok) want.delete('drop-strip');
      took = true;
    }
    fast = took ? 3 : Math.min(fast + 1, 6);
    await page.waitForTimeout(took ? 50 : 300);
  }
  if (want.size > 0) log(`  not seen: ${[...want].join(', ')}`);
  await ctx.close();
}

async function main(): Promise<number> {
  mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  // The production build is only served for the parts that play the real game.
  const needDist = [...ONLY].some((p) => p !== 'page');
  const srv = needDist ? await preview({ root: ROOT, logLevel: 'error', preview: { port, strictPort: true, host: '127.0.0.1' } }) : null;
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const runs: [string, (b: Browser, p: number) => Promise<void>][] = [
    ['main', mainRun],
    ['strips', stripRun],
    ['defeat', defeatRun],
    ['rain', rainRun],
    ['hud', hudRun],
    ['missions', missionsRun],
    ['campaign', campaignRun],
    ['sandbox', sandboxRun],
    ['page', pageRun],
  ];
  try {
    for (const [name, run] of runs) {
      if (!ONLY.has(name)) continue;
      try {
        await run(browser, port);
      } catch (e) {
        log(`run ${name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    await browser.close();
    if (srv) await new Promise<void>((ok) => srv.httpServer.close(() => ok()));
  }
  log(problems.length ? `page problems:\n  ${problems.slice(0, 20).join('\n  ')}` : 'page problems: none');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
