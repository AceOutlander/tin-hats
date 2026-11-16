import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { platform } from '../../src/platform';
import { installShell, isBackPress, pressBack } from '../../src/platform/shell';
import type { AppShell, Platform } from '../../src/platform/types';

const ROOT = join(import.meta.dirname, '..', '..');

/** A shell the test drives by hand. */
function fakeShell(): AppShell & { pause(): void; resume(): void; back(): boolean | null; awake: boolean[]; listeners(): number } {
  const pause = new Set<() => void>();
  const resume = new Set<() => void>();
  let back: (() => boolean) | null = null;
  const awake: boolean[] = [];
  return {
    onPause(l) {
      pause.add(l);
      return () => pause.delete(l);
    },
    onResume(l) {
      resume.add(l);
      return () => resume.delete(l);
    },
    onBack(l) {
      back = l;
      return () => {
        if (back === l) back = null;
      };
    },
    keepAwake: (on) => void awake.push(on),
    pause: () => pause.forEach((l) => l()),
    resume: () => resume.forEach((l) => l()),
    back: () => (back ? back() : null),
    awake,
    listeners: () => pause.size + resume.size + (back ? 1 : 0),
  };
}

function fakeApp(): { pageHidden(): void; pageShown(): void; calls: string[] } {
  const calls: string[] = [];
  return { calls, pageHidden: () => void calls.push('hidden'), pageShown: () => void calls.push('shown') };
}

/** Node has no KeyboardEvent: a stand-in with the two fields the game's key listeners read. */
class FakeKeyboardEvent extends Event {
  readonly key: string;
  readonly code: string;
  constructor(type: string, init: KeyboardEventInit) {
    super(type, init);
    this.key = init.key ?? '';
    this.code = init.code ?? '';
  }
}

const realKeyboardEvent = (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent;
afterEach(() => {
  (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = realKeyboardEvent;
});

describe('the website platform', () => {
  it('provides nothing', () => {
    expect(platform.installed).toBe(false);
    expect(platform.shell).toBeNull();
    expect(platform.store).toBeNull();
    expect(platform.reward).toBeNull();
    expect(platform.settings).toBeNull();
    expect(platform.extraUnit).toBeNull();
    expect(platform.testMode).toBeNull();
    expect(platform.attach).toBeUndefined();
    expect(platform.entitlements().size).toBe(0);
  });

  it('installs no listener and never touches the app', () => {
    const app = fakeApp();
    const handle = installShell(platform, app, new EventTarget() as Document);
    for (const screen of ['title', 'battle', 'result', 'campaign'] as const) handle.screenChanged(screen);
    handle.destroy();
    expect(app.calls).toEqual([]);
  });

  it('is one module that imports nothing but its types', () => {
    const src = readFileSync(join(ROOT, 'src/platform/index.ts'), 'utf8');
    const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0]);
    expect(imports).toEqual(["import type { Platform } from './types';"]);
    // The types pull nothing in either, so any build can type against them.
    expect(readFileSync(join(ROOT, 'src/platform/types.ts'), 'utf8')).not.toMatch(/^import /m);
  });
});

describe('an installed app', () => {
  const withShell = (shell: AppShell): Platform => ({ ...platform, installed: true, shell });

  it('pauses like a hidden page when it goes to the background, and comes back like a shown one', () => {
    const shell = fakeShell();
    const app = fakeApp();
    installShell(withShell(shell), app, new EventTarget() as Document);
    shell.pause();
    expect(app.calls).toEqual(['hidden']);
    shell.resume();
    expect(app.calls).toEqual(['hidden', 'shown']);
  });

  it('passes the back action on as the back key and reports whether the game used it', () => {
    (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = FakeKeyboardEvent;
    const shell = fakeShell();
    const doc = new EventTarget();
    installShell(withShell(shell), fakeApp(), doc as Document);

    // Nothing to go back to (the title): the platform decides.
    expect(shell.back()).toBe(false);

    const seen: { key: string; back: boolean }[] = [];
    doc.addEventListener('keydown', (ev) => {
      seen.push({ key: (ev as KeyboardEvent).key, back: isBackPress(ev) });
      ev.preventDefault();
    });
    expect(shell.back()).toBe(true);
    expect(seen).toEqual([{ key: 'Escape', back: true }]);

    // A key the player pressed is not a back press.
    expect(isBackPress(new FakeKeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
    expect(pressBack(doc as Document)).toBe(true);
  });

  it('keeps the screen lit during a battle only, and says so once', () => {
    const shell = fakeShell();
    const handle = installShell(withShell(shell), fakeApp(), new EventTarget() as Document);
    for (const screen of ['title', 'campaigns', 'campaign', 'briefing'] as const) handle.screenChanged(screen);
    expect(shell.awake).toEqual([]);
    handle.screenChanged('battle');
    handle.screenChanged('battle');
    expect(shell.awake).toEqual([true]);
    handle.screenChanged('result');
    expect(shell.awake).toEqual([true, false]);
  });

  it('lets go of everything when removed', () => {
    const shell = fakeShell();
    const handle = installShell(withShell(shell), fakeApp(), new EventTarget() as Document);
    expect(shell.listeners()).toBe(3);
    handle.screenChanged('battle');
    handle.destroy();
    expect(shell.listeners()).toBe(0);
    expect(shell.awake).toEqual([true, false]);
  });
});

/** Words that only a build for another platform would bring into the scripts. */
const FOREIGN = [/@capacitor\//, /capacitor\/(app|core|android)/i, /registerPlugin/, /tin-hats-android/];

function filesUnder(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path, ext));
    else if (ext.test(entry.name)) out.push(path);
  }
  return out;
}

describe('the website carries no other platform', () => {
  it('has none in its source or its packages', () => {
    for (const file of filesUnder(join(ROOT, 'src'), /\.(ts|css)$/)) {
      const text = readFileSync(file, 'utf8');
      for (const word of FOREIGN) expect(word.test(text), `${file} mentions ${word}`).toBe(false);
    }
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: object; devDependencies?: object };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.filter((n) => /capacitor|cordova/i.test(n))).toEqual([]);
  });

  // `npm run check` builds before it tests, so the build is looked at there; a clean checkout with no build has
  // only the source check above.
  it.runIf(existsSync(join(ROOT, 'dist', 'index.html')))('has none in its built scripts', () => {
    const scripts = filesUnder(join(ROOT, 'dist'), /\.(js|html|css)$/);
    expect(scripts.length).toBeGreaterThan(3);
    for (const file of scripts) {
      const text = readFileSync(file, 'utf8');
      for (const word of FOREIGN) expect(word.test(text), `${file} mentions ${word}`).toBe(false);
    }
  });
});
