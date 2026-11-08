/**
 * Throwaway micro-benchmark (not part of the game): what one hidden pooled Image and one visible Image cost Phaser 4's
 * layer draw per frame, and what Layer.sendToBack costs on a big row layer. Uses the patched .perf/dist (window.__THVIEW).
 *   x.cmd npx tsx .perf/bench.ts [--cpu=4]
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cpu = Number((process.argv.find((a) => a.startsWith('--cpu=')) ?? '--cpu=4').slice(6));
const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

const SETUP = `(() => {
  const v = window.__THVIEW;
  const scene = v.scene;
  const frame = v.registry.get('rd/white').frame;
  const B = window.__BENCH = { ms: 0, frames: 0 };
  const layer = scene.add.layer();
  layer.setDepth(19.5);
  const orig = layer._renderSteps[0];
  layer._renderSteps[0] = function () { const t = performance.now(); orig.apply(this, arguments); B.ms += performance.now() - t; B.frames++; };
  const imgs = [];
  const Img = scene.sys.game.config.constructor; // unused
  for (let i = 0; i < 10000; i++) {
    const img = scene.make.image({ x: 0, y: 0, key: frame.texture.key, frame: frame.name }, false);
    img.visible = false;
    layer.add(img);
    imgs.push(img);
  }
  B.layer = layer; B.imgs = imgs;
  B.reset = () => { B.ms = 0; B.frames = 0; };
  B.show = (n) => { const c = v.camera; for (let i = 0; i < imgs.length; i++) { const im = imgs[i]; im.visible = i < n; im.x = c.left + 50 + (i % 400) * 2; im.y = 300 + ((i / 400) | 0); im.alpha = 0.02; im.setScale(0.05); } };
  B.result = () => ({ msPerFrame: B.ms / Math.max(1, B.frames), frames: B.frames });
  B.sendBack = (layerChildren) => {
    // A row layer with layerChildren images: time 38 sendToBack + 38 bringToTop (one death + one spawn).
    const l = scene.add.layer();
    const list = [];
    for (let i = 0; i < layerChildren; i++) { const im = scene.make.image({ x: 0, y: 0, key: frame.texture.key, frame: frame.name }, false); im.visible = false; l.add(im); list.push(im); }
    const views = 20;
    const t = performance.now();
    for (let k = 0; k < views; k++) {
      const base = (k * 97) % (layerChildren - 40);
      for (let i = 37; i >= 0; i--) l.sendToBack(list[base + i]);
      for (let i = 0; i < 38; i++) l.bringToTop(list[base + i]);
    }
    const ms = (performance.now() - t) / views;
    l.destroy();
    return ms;
  };
  B.makeImages = (n) => { const t = performance.now(); const tmp = []; for (let i = 0; i < n; i++) { const im = scene.make.image({ x: 0, y: 0, key: frame.texture.key, frame: frame.name }, false); im.setFrame(frame); layer.add(im); tmp.push(im); } const ms = performance.now() - t; for (const im of tmp) im.destroy(); return ms; };
})()`;

async function main(): Promise<void> {
  const server = await preview({ root: ROOT, logLevel: 'error', build: { outDir: '.perf/dist' }, preview: { port: 0, strictPort: false, host: '127.0.0.1' } });
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('page error', e.message));
    await page.goto(`http://127.0.0.1:${port}/?debug=1&quality=0`);
    await page.waitForFunction('window.__TH && window.__TH.ready === true', null, { timeout: 60_000 });
    await page.evaluate('(() => { const th = window.__TH; th.unlockAll(); th.startSandbox(1); })()');
    await page.waitForFunction('window.__TH.state().inBattle', null, { timeout: 30_000 });
    await sleep(1500);
    await page.evaluate(SETUP);
    const cdp = await context.newCDPSession(page);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const window = async (label: string, show: number): Promise<number> => {
      await page.evaluate(`window.__BENCH.show(${show}); window.__BENCH.reset()`);
      await sleep(3000);
      const r = (await page.evaluate('window.__BENCH.result()')) as { msPerFrame: number; frames: number };
      console.log(`${label.padEnd(36)} ${r.msPerFrame.toFixed(3)} ms/frame over ${r.frames} frames`);
      return r.msPerFrame;
    };
    const hidden = await window('10000 hidden images', 0);
    const vis1 = await window('2000 visible + 8000 hidden', 2000);
    const vis2 = await window('5000 visible + 5000 hidden', 5000);
    const perVisible = (vis2 - vis1) / 3000;
    console.log(`=> per hidden image ${(hidden / 10000 * 1000).toFixed(3)} us/frame, per visible image ${(perVisible * 1000).toFixed(2)} us/frame (cpu x${cpu})`);
    for (const n of [1000, 3000]) {
      const ms = (await page.evaluate(`window.__BENCH.sendBack(${n})`)) as number;
      console.log(`sendToBack x38 + bringToTop x38 on a ${n}-image layer: ${ms.toFixed(2)} ms`);
    }
    const mk = (await page.evaluate('window.__BENCH.makeImages(440)')) as number;
    console.log(`creating 440 Images (10 figure views) : ${mk.toFixed(2)} ms`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
