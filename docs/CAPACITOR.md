# Wrapping Tin Hats with Capacitor (Android and iOS)

Nothing here is installed yet. This is the recipe for later; each step is a few minutes. The web build in `dist/` is the
app: Capacitor only puts it in a native WebView (Android System WebView, iOS WKWebView).

## What is already compatible

| Need | How the project meets it |
| --- | --- |
| Files load from a native origin (`https://localhost` on Android, `capacitor://localhost` on iOS) | `vite.config.ts` has `base: './'`: every script, style, icon and the manifest is a relative URL. `dist/` also runs from any sub-path. |
| No network, no CORS, no ATS / cleartext settings | Everything is drawn in code (Canvas 2D art, WebAudio sound). The built game makes no request to another host. The browser test `tests/e2e/pwa.spec.ts` plays a mission with the network cut and fails on any failed request. |
| Notches, rounded corners, home indicator | `index.html` has `viewport-fit=cover`; `src/ui/theme.css` exposes `--th-safe-top/right/bottom/left` from `env(safe-area-inset-*)` and the HUD and menus pad with them. |
| Landscape only | The web manifest says `landscape`; a portrait phone sees the "rotate your phone" screen and the battle pauses. Native shells still need the lock below. |
| Pause when the app goes to the background | `src/app/page.ts` pauses on `visibilitychange` and `pagehide`, which the WebViews fire on app switch and screen lock. |
| Saves | `localStorage` (key `tinhats.save`) lives in the app's own WebView storage; it survives restarts and updates. |
| Touch input | Pointer events with `touch-action: none` on the battlefield; double-tap zoom and text selection are blocked (`src/ui/shell/lockdown.ts`). |
| The service worker | **Not needed inside the wrapper** (the files are on the device) and not used: `src/pwa/register.ts` skips registration when `Capacitor.isNativePlatform()` is true or the origin is not http(s). The PWA files (`manifest.webmanifest`, `sw.js`) simply sit unused in the bundle. |

## What to add

### 1. Packages and project (from the repo root)

```powershell
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/android @capacitor/ios @capacitor/screen-orientation @capacitor/status-bar @capacitor/app
npx cap init "Tin Hats" com.yourname.tinhats --web-dir dist
npm run build
npx cap add android
npx cap add ios          # needs a Mac with Xcode
npx cap sync             # copy dist/ and plugins into both projects (after every build)
npx cap open android     # Android Studio
npx cap open ios         # Xcode
```

`capacitor.config.ts` (created by `cap init`; set these):

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.tinhats',
  appName: 'Tin Hats',
  webDir: 'dist',
  backgroundColor: '#14150f', // --th-ink: no white flash before the first frame
  ios: { contentInset: 'never' }, // the page handles safe areas itself
  android: { allowMixedContent: false },
};

export default config;
```

### 2. Lock the screen to landscape

A tiny start-up module, loaded only in the wrapper (put the call in `src/main.ts` next to `registerServiceWorker()`):

```ts
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';

export async function nativeSetup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ScreenOrientation.lock({ orientation: 'landscape' }); // both landscape sides, follows the sensor
  await StatusBar.hide();
}
```

Also set it in the native projects so the app starts landscape (no portrait flash on launch):

- Android `android/app/src/main/AndroidManifest.xml`, on `<activity>`: `android:screenOrientation="sensorLandscape"`.
- iOS `ios/App/App/Info.plist`: `UISupportedInterfaceOrientations` = `UIInterfaceOrientationLandscapeLeft`, `UIInterfaceOrientationLandscapeRight` (remove the portrait entries, also in the `~ipad` key) and `UIStatusBarHidden` = true.

### 3. Full screen and cutouts

- Android: in `android/app/src/main/res/values/styles.xml` add `<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>` to the app theme so the game draws under the camera cut-out (the page keeps the HUD inside `--th-safe-*`). For immersive mode, hide the system bars in `MainActivity.onCreate` with `WindowInsetsControllerCompat(window, window.decorView).hide(WindowInsetsCompat.Type.systemBars())`.
- iOS: set `UIViewControllerBasedStatusBarAppearance` = false in `Info.plist`; to hide the home indicator override `prefersHomeIndicatorAutoHidden` in a `CAPBridgeViewController` subclass.

### 4. Icons and splash screen

`public/icons/icon-maskable-512.png` is the app icon art (full bleed, emblem inside the safe circle). Generate the native sets with the official tool:

```powershell
npm install -D @capacitor/assets
# put a 1024 x 1024 icon at assets/icon-only.png (re-run tools/gen-icons.ts with a 1024 job, or upscale the 512),
# and a 2732 x 2732 splash at assets/splash.png (plain #14150f with the badge in the middle)
npx capacitor-assets generate --iconBackgroundColor '#14150f' --splashBackgroundColor '#14150f'
```

### 5. Small native-only behaviours worth adding

- Android back button: `App.addListener('backButton', ...)` from `@capacitor/app` should open the pause menu (and exit from the title screen); the default closes the app.
- Audio: WebAudio starts after the first touch, as in the browser; nothing to do. If sound is muted by the iOS silent switch, that is the platform default for WebAudio in a WebView.
- Fixed viewport zoom: already off (`maximum-scale=1`, `user-scalable=no`), as the WebViews honour it.

## Day-to-day

```powershell
npm run build; npx cap sync            # after changing the game
npx cap run android --live-reload --external   # dev server on the phone (Vite `npm run dev` must be running)
```

- **Debug the WebView:** Android: `chrome://inspect` on the desktop (the page, console and performance tools work as in Chrome). iOS: Safari, Develop menu, the device.
- **Debug hooks and frame costs:** `?debug=1` is a URL parameter; in a built app set `server.url` in `capacitor.config.ts` to the dev machine, e.g. `http://192.168.1.20:4173/?debug=1`, then `window.__TH` and `window.__THPERF` (the per-frame probe that `tools/perf.ts` reads) are available in the inspector. Remove `server.url` before a release build.
- **Release:** Android: Build, Generate Signed Bundle (AAB) in Android Studio, upload to Play Console. iOS: Archive in Xcode, upload to App Store Connect (an Apple developer account is required).
- **Updates** are new store builds. The PWA update flow (`sw.js` waiting until the next launch) is for the web version only.
