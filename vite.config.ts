import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** A colour of the game theme (`--th-<name>` in src/ui/theme.css): the manifest and the page meta use the same ones. */
function themeColour(name: string): string {
  const css = readFileSync(new URL('./src/ui/theme.css', import.meta.url), 'utf8');
  const m = new RegExp(`--th-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`src/ui/theme.css has no --th-${name}`);
  return m[1];
}

const INK = themeColour('ink');

/** The short git commit this build is made from (shown in Settings so a bug report matches an exact build). */
function buildId(): string {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

/** The two big scripts the page's loader (src/main.ts) starts one after the other: the engine and the game. */
const BIG_SCRIPTS = ['phaser', 'boot'];

/**
 * Put a modulepreload link for each big script in the built index.html, so the browser fetches (and compiles) both
 * from the moment it reads the page, while the loader still starts them in turn. Without the links the game's script
 * would only be asked for once the engine had started.
 */
function preloadBigScripts(): Plugin {
  return {
    name: 'tin-hats-preload-big-scripts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx): HtmlTagDescriptor[] {
        const tags: HtmlTagDescriptor[] = [];
        for (const name of BIG_SCRIPTS) {
          const chunk = Object.values(ctx.bundle ?? {}).find((c) => c.type === 'chunk' && c.name === name);
          if (!chunk) throw new Error(`the build has no "${name}" script to preload`);
          tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${chunk.fileName}` }, injectTo: 'head' });
        }
        return tags;
      },
    },
  };
}

/** The switch a build sets to leave the admin panel out: `TIN_HATS_ADMIN_PANEL=off` in its environment. */
const ADMIN_PANEL_SWITCH = 'TIN_HATS_ADMIN_PANEL';
/** The module that joins the admin panel to the game, and the empty one a build without the panel gets in its place. */
const ADMIN_PANEL = fileURLToPath(new URL('./src/adminPanel/index.ts', import.meta.url));
const NO_ADMIN_PANEL = fileURLToPath(new URL('./src/adminPanel/none.ts', import.meta.url));

/** The same file, whatever the slashes and the case of the drive letter. */
function samePath(a: string, b: string): boolean {
  const norm = (p: string): string => resolve(p).split(sep).join('/').toLowerCase();
  return norm(a) === norm(b);
}

/** True when this build must not contain the admin panel. Anything but on, off or nothing stops the build. */
function adminPanelOff(): boolean {
  const value = process.env[ADMIN_PANEL_SWITCH];
  if (value === undefined || value === '' || value === 'on') return false;
  if (value === 'off') return true;
  throw new Error(`${ADMIN_PANEL_SWITCH} is "${value}": it must be "on" or "off"`);
}

/**
 * A build without the admin panel (docs/PLATFORM.md): with the switch off, the one module through which the game
 * reaches the panel (src/adminPanel/index.ts) resolves to the empty src/adminPanel/none.ts, so the panel's code,
 * styles, entry gesture and code hash never enter the build. The website's build never sets the switch and is not
 * touched by this.
 */
function adminPanelSwitch(): Plugin {
  let off = false;
  let swapped = 0;
  return {
    name: 'tin-hats-admin-panel-switch',
    enforce: 'pre',
    config() {
      off = adminPanelOff();
    },
    async resolveId(source, importer, options) {
      if (!off || !importer || !/(^|[/])adminPanel$/.test(source)) return null;
      const found = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!found || !samePath(found.id, ADMIN_PANEL)) return null;
      swapped++;
      return NO_ADMIN_PANEL;
    },
    buildEnd(error) {
      if (off && !error && swapped === 0) throw new Error('the game never imported src/adminPanel: the admin panel was not left out');
    },
  };
}

// base './' keeps every asset URL relative so the build can be dropped into a
// Capacitor webview (file-style origin) as well as served from any sub-path.
export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: {
    target: 'es2022',
    // Phaser alone is a 1.4 MB script (about 360 kB gzipped) and now has a chunk of its own; the game's code is the other
    // 560 kB (190 kB gzipped). The engine is the only chunk over Vite's default 500 kB warning, so the limit sits just
    // above it: any other chunk past 1.5 MB, or Phaser growing past it, still warns.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Phaser rarely changes and is most of the bytes: its own long-lived chunk keeps the app chunk small and the
        // browser (and service worker) cache useful across game updates.
        manualChunks(id: string): string | undefined {
          return id.includes('node_modules/phaser/') ? 'phaser' : undefined;
        },
      },
    },
  },
  server: { host: true },
  preview: { host: true },
  plugins: [
    adminPanelSwitch(),
    preloadBigScripts(),
    VitePWA({
      // The page registers the worker itself (src/pwa), so nothing is injected and no update prompt appears mid-battle.
      injectRegister: false,
      registerType: 'prompt',
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Tin Hats',
        short_name: 'Tin Hats',
        description: 'A 2D side-view WW2 real-time strategy game. Train, order, and win the battle.',
        lang: 'en',
        categories: ['games'],
        start_url: './',
        scope: './',
        // Fullscreen where the browser supports it, a plain app window elsewhere; always landscape.
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        theme_color: INK,
        background_color: INK,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the build makes is precached, so the game starts and plays with no network.
        globPatterns: ['**/*.{html,js,css,png,svg,webmanifest,woff2}'],
        // The Phaser chunk is over the 2 MiB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // A new version installs in the background and waits: it takes over on the next launch (src/pwa), never in
        // the middle of a battle. Only a first install claims the open page.
        skipWaiting: false,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
