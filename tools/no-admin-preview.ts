/**
 * Builds the game without the admin panel and serves that build, for playwright.noadmin.config.ts.
 *
 *   x.cmd npx tsx tools/no-admin-preview.ts [port]
 *
 * It makes the build the way another repo's build does (docs/PLATFORM.md, "A build without the admin panel"): the
 * switch is set in the environment, then the game's own Vite builds with the game's own config. The build goes into
 * a folder under node_modules/.cache (never into dist, which is the website's) and is served until this is stopped.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'node_modules', '.cache', 'tin-hats-no-admin-panel');
const port = Number(process.argv[2] ?? 4193);

process.env.TIN_HATS_ADMIN_PANEL = 'off';
process.chdir(ROOT);
await build({ root: ROOT, logLevel: 'error', build: { outDir: OUT, emptyOutDir: true } });
const server = await preview({ root: ROOT, logLevel: 'error', build: { outDir: OUT }, preview: { host: '127.0.0.1', port, strictPort: true } });
console.log(`Tin Hats without the admin panel: ${server.resolvedUrls?.local[0] ?? `http://127.0.0.1:${port}/`}`);
