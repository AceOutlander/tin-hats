import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
