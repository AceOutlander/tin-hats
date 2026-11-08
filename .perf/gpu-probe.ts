// Throwaway: which WebGL renderer does headless Chromium get on this machine with each flag set?
import { chromium } from '@playwright/test';

const variants: { name: string; channel?: string; headless: boolean; args: string[] }[] = [
  { name: 'shell default', headless: true, args: [] },
  { name: 'new-headless d3d11', channel: 'chromium', headless: true, args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'] },
  { name: 'new-headless gl=angle d3d11', channel: 'chromium', headless: true, args: ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization'] },
  { name: 'shell d3d11', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization'] },
];

for (const v of variants) {
  try {
    const browser = await chromium.launch({ channel: v.channel, headless: v.headless, args: v.args });
    const page = await browser.newPage();
    const r = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      if (!gl) return 'no webgl';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)} | ${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}` : gl.getParameter(gl.RENDERER);
    });
    console.log(`${v.name}: ${r}  (${browser.version()})`);
    await browser.close();
  } catch (e) {
    console.log(`${v.name}: FAILED ${(e as Error).message.split('\n')[0]}`);
  }
}
