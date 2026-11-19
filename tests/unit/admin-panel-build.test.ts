/**
 * A build may leave the admin panel out (docs/PLATFORM.md, "A build without the admin panel"): not hidden, absent.
 *
 * The game reaches the panel through one module, src/adminPanel/index.ts. A build made with TIN_HATS_ADMIN_PANEL=off
 * resolves that module to the empty src/adminPanel/none.ts (vite.config.ts), and the panel's controller, lock, data
 * (with the hash of its code), DOM, styles, entry gesture and debug hook are then not in the build at all.
 *
 * The first half checks the source keeps to that one door. The second half makes the two builds for real, exactly
 * as `vite build` makes the website's (about two seconds each, into temporary folders), and looks at what came out.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN } from '../../src/data/admin';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'src');
const DOOR = join(SRC, 'adminPanel');
const SWITCH = 'TIN_HATS_ADMIN_PANEL';

/** Everything that is the admin panel's own, as paths under src (a folder ends with a slash). */
const PANEL = ['app/admin.ts', 'app/adminLock.ts', 'data/admin.ts', 'ui/admin/'];

/** True for a path (as an import names it, with or without ".ts") that is one of the panel's files. */
function isPanel(path: string): boolean {
  const rel = relative(SRC, path).split(sep).join('/');
  return PANEL.some((p) => (p.endsWith('/') ? `${rel}/`.startsWith(p) : rel === p || `${rel}.ts` === p));
}

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name), ext) : ext.test(e.name) ? [join(dir, e.name)] : []));
}

/** Every relative import of a source file: what it wrote and the file or folder it names. */
function importsOf(file: string): { spec: string; target: string }[] {
  const text = readFileSync(file, 'utf8');
  const out: { spec: string; target: string }[] = [];
  for (const m of text.matchAll(/\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/g)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec.startsWith('.')) out.push({ spec, target: resolve(dirname(file), spec) });
  }
  return out;
}

describe('the admin panel in the source', () => {
  const sources = filesUnder(SRC, /\.ts$/);

  it('is reached by the game through src/adminPanel/index.ts and nothing else', () => {
    const wrong: string[] = [];
    let doorReads = 0;
    for (const file of sources) {
      if (isPanel(file)) continue;
      for (const { spec, target } of importsOf(file)) {
        if (!isPanel(target)) continue;
        if (file === join(DOOR, 'index.ts')) doorReads++;
        else wrong.push(`${relative(ROOT, file)}: '${spec}'`);
      }
    }
    // Not even for a type: a build without the panel must be able to drop every one of these files.
    expect(wrong).toEqual([]);
    expect(doorReads).toBeGreaterThanOrEqual(2);
  });

  it('that module is imported by its folder, never by its file, and the empty one by nobody', () => {
    const wrong: string[] = [];
    let readers = 0;
    for (const file of sources) {
      for (const { spec, target } of importsOf(file)) {
        if (target === join(DOOR, 'none') || target === join(DOOR, 'none.ts')) wrong.push(`${relative(ROOT, file)}: '${spec}'`);
        if (target !== DOOR && target !== join(DOOR, 'index') && target !== join(DOOR, 'index.ts')) continue;
        readers++;
        // The build's switch looks for this spelling (vite.config.ts).
        if (!/(^|\/)adminPanel$/.test(spec)) wrong.push(`${relative(ROOT, file)}: '${spec}'`);
      }
    }
    expect(wrong).toEqual([]);
    expect(readers).toBe(1);
  });

  it('the empty module brings nothing with it but its types, and those bring no code', () => {
    const none = readFileSync(join(DOOR, 'none.ts'), 'utf8');
    expect([...none.matchAll(/^import .*$/gm)].map((m) => m[0])).toEqual(["import type { CreateAdminPanel } from './types';"]);
    const types = readFileSync(join(DOOR, 'types.ts'), 'utf8');
    for (const line of [...types.matchAll(/^import .*$/gm)].map((m) => m[0])) expect(line).toMatch(/^import type /);
    expect(types).not.toMatch(/^export (const|function|class|let|var|enum) /m);
  });
});

/**
 * What only the admin panel brings into a build. None of these may be in a build made without it; every one of them
 * is in the website's (checked too, so that a renamed class cannot make the first check pass by looking for nothing).
 * docs/PLATFORM.md lists the same marks for a platform's own check of its build.
 */
const MARKS: readonly string[] = [
  // Its elements and styles (src/ui/admin: classes and test ids).
  'th-admin-',
  'admin-prompt',
  'admin-code',
  'admin-button',
  // The secret entry: the mark put on the title's helmet, and the listener that looks for it.
  'data-admin-tap',
  // The code: the salt and the salted hash it is compared with (src/data/admin.ts).
  ADMIN.passcode.salt,
  ADMIN.passcode.sha256,
  // Its debug hook (window.__TH.admin.useHash).
  'useHash',
  // The entry for a platform's test mode (src/data/admin.ts).
  'Platform test mode',
];

const run = promisify(execFile);

/** `vite build` as the website runs it, into a folder of its own, with the switch set as given. */
async function build(out: string, value: string | undefined): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // The test runner's own setting would make it a development build.
  delete env.NODE_ENV;
  delete env[SWITCH];
  if (value !== undefined) env[SWITCH] = value;
  await run(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, env });
}

interface Built {
  file: string;
  text: string;
}

function built(dir: string): Built[] {
  return filesUnder(dir, /\.(js|css|html|webmanifest)$/).map((file) => ({ file: relative(dir, file).split(sep).join('/'), text: readFileSync(file, 'utf8') }));
}

function bytes(files: readonly Built[], ext: RegExp): number {
  return files.filter((f) => ext.test(f.file)).reduce((n, f) => n + f.text.length, 0);
}

describe('the admin panel in a build', () => {
  const dirs = { with: '', without: '' };

  beforeAll(async () => {
    dirs.with = mkdtempSync(join(tmpdir(), 'th-panel-on-'));
    dirs.without = mkdtempSync(join(tmpdir(), 'th-panel-off-'));
    await Promise.all([build(dirs.with, undefined), build(dirs.without, 'off')]);
  });

  afterAll(() => {
    for (const dir of Object.values(dirs)) if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('the marks name what the data holds', () => {
    expect(ADMIN.tabs.flatMap((tab) => tab.entries.map((entry) => entry.label))).toContain('Platform test mode');
    expect(ADMIN.passcode.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(MARKS.every((m) => m.length >= 6)).toBe(true);
  });

  it("the website's build has the panel, whole", () => {
    const all = built(dirs.with)
      .map((f) => f.text)
      .join('\n');
    for (const mark of MARKS) expect(all.includes(mark), `the website's build lacks "${mark}"`).toBe(true);
  });

  it('a build with the switch off has nothing of it', () => {
    const files = built(dirs.without);
    expect(files.length).toBeGreaterThan(5);
    for (const { file, text } of files) for (const mark of MARKS) expect(text.includes(mark), `${file} contains "${mark}"`).toBe(false);
  });

  it('and is the same game otherwise, smaller by the panel', () => {
    const on = built(dirs.with);
    const off = built(dirs.without);
    // The same files: the page, the loader, the engine, the game, the HUD, their styles, the manifest, the worker.
    const shape = (files: readonly Built[]): string[] => files.map((f) => f.file.replace(/-[\w-]{8}\.(js|css)$/, '.$1')).sort();
    expect(shape(off)).toEqual(shape(on));
    // The title's helmet and the version line are still there; the panel's script and styles are gone.
    const game = off.map((f) => f.text).join('\n');
    for (const kept of ['title-helmet', 'settings-version', 'th-logo-helmet']) expect(game.includes(kept), kept).toBe(true);
    expect(bytes(on, /\.js$/) - bytes(off, /\.js$/)).toBeGreaterThan(20_000);
    expect(bytes(on, /\.css$/) - bytes(off, /\.css$/)).toBeGreaterThan(3_000);
  });

  it('a switch set to anything but on or off stops the build', async () => {
    const out = mkdtempSync(join(tmpdir(), 'th-panel-bad-'));
    try {
      await expect(build(out, 'no')).rejects.toThrow(/TIN_HATS_ADMIN_PANEL is "no"/);
      await expect(build(out, 'on')).resolves.toBeUndefined();
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
