/**
 * Visual QA capture of the production build (run `npm run build` first).
 *
 *   x.cmd npx tsx tools/qa.ts [--w=844] [--h=390] [--dsf=1] [--sdsf=2] [--out=.tools/shots/qa] [--only=a,b] [--frames=10] [--step=50]
 *
 * Plays mission 1 through the ?debug=1 hooks under a Playwright fake clock, so
 * film-strip frames are exactly --step ms of game time apart, and writes:
 *   <w>-<scene>.png         full-screen scenes (battle start, sappers, HQ door, firefight, fall back, ...)
 *   <w>-strip-<name>.png    film strips: consecutive cropped frames around one unit, enlarged
 * Scenes are shot at --dsf; strips come from a second context at --sdsf so the limbs are sharp.
 * --only picks parts: main (the mission 1 walkthrough), strips, defeat, rain.
 */
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import type { DebugState, FieldInfo, UnitInfo } from '../src/app/debug';
import { CONFIG } from '../src/data/config';
import { VIEW } from '../src/data/view';

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
const CSS_PER_WU = H / VIEW.heightWu;
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
  await th<boolean>(page, `startMission(1, 'normal', ${seed})`);
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
  const y = Math.round(Math.min(Math.max(feetY * CSS_PER_WU - height * 0.78, 0), H - height));
  return { x, y, width, height };
}

/** Write an image grid of frames, each enlarged `scale` times with hard pixels. */
async function compose(browser: Browser, name: string, frames: Buffer[], frameW: number, scale: number, cols: number, notes: string[]): Promise<void> {
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
  const path = resolve(OUT, `${W}-strip-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await page.close();
  log(`  ${W}-strip-${name}.png`);
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

async function main(): Promise<number> {
  mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const srv = await preview({ root: ROOT, logLevel: 'error', preview: { port, strictPort: true, host: '127.0.0.1' } });
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const runs: [string, (b: Browser, p: number) => Promise<void>][] = [
    ['main', mainRun],
    ['strips', stripRun],
    ['defeat', defeatRun],
    ['rain', rainRun],
    ['hud', hudRun],
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
    await new Promise<void>((ok) => srv.httpServer.close(() => ok()));
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
