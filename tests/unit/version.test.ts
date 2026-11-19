/**
 * The beta version (owner, 2026-11-08): one number in package.json, "0.X.Y" while in beta, and "What's new" notes in
 * src/data/version.ts for exactly that version, so every push to live bumps both together.
 *
 * The release stage (the word before the number) has one source too: RELEASE_STAGE, put before the number by
 * versionLabel and nowhere else. A platform may name another stage, or none (owner, 2026-11-17).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { RELEASE_STAGE, WHATS_NEW, versionLabel } from '../../src/data/version';
import { platform } from '../../src/platform';

const ROOT = resolve(import.meta.dirname, '..', '..');

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name), ext) : ext.test(e.name) ? [join(dir, e.name)] : []));
}

describe('the version', () => {
  it('is a beta 0.X.Y number', () => {
    expect(version).toMatch(/^0\.\d+\.\d+$/);
    expect(RELEASE_STAGE).toBe('Beta');
  });

  it("has What's new notes for the current version, newest first, in plain short lines", () => {
    expect(WHATS_NEW[0].version).toBe(version);
    expect(WHATS_NEW[0].items.length).toBeGreaterThan(0);
    for (const line of WHATS_NEW[0].items) expect(line.length).toBeLessThanOrEqual(140);
    const seen = new Set<string>();
    for (const n of WHATS_NEW) {
      expect(seen.has(n.version), n.version).toBe(false);
      seen.add(n.version);
    }
  });
});

describe('the release stage', () => {
  it('on the website the version reads exactly as before: "Beta v0.X.Y"', () => {
    expect(versionLabel(version)).toBe(`Beta v${version}`);
    expect(versionLabel('0.9.0')).toBe('Beta v0.9.0');
    // The website's platform names no stage, so the game's own is used.
    expect(platform.releaseStage).toBeUndefined();
    expect(versionLabel(version, platform.releaseStage)).toBe(`Beta v${version}`);
  });

  it('a platform may name its own stage, or none', () => {
    expect(versionLabel('0.9.0', 'Early access')).toBe('Early access v0.9.0');
    expect(versionLabel('0.9.0', '')).toBe('v0.9.0');
    // Spaces around a stage are not shown, and a stage of spaces alone is none.
    expect(versionLabel('0.9.0', '  Preview ')).toBe('Preview v0.9.0');
    expect(versionLabel('0.9.0', '   ')).toBe('v0.9.0');
  });

  it('has one source: the word is in src/data/version.ts and nowhere else the player could be shown it', () => {
    const data = join(ROOT, 'src', 'data', 'version.ts');
    const files = [...filesUnder(join(ROOT, 'src'), /\.(ts|css|html|json)$/), join(ROOT, 'index.html'), join(ROOT, 'vite.config.ts')];
    if (existsSync(join(ROOT, 'public'))) files.push(...filesUnder(join(ROOT, 'public'), /\.(html|json|webmanifest|txt|svg)$/));
    expect(files.length).toBeGreaterThan(100);
    const name = (file: string): string => relative(ROOT, file).split(sep).join('/');
    const worded: string[] = [];
    const readers: string[] = [];
    const callers: string[] = [];
    for (const file of files) {
      if (file === data) continue;
      const text = readFileSync(file, 'utf8');
      if (/\bbeta\b/i.test(text)) worded.push(name(file));
      if (/\bRELEASE_STAGE\b/.test(text)) readers.push(name(file));
      if (/\bversionLabel\(/.test(text)) callers.push(name(file));
    }
    // The title, Settings, the "What's new" heading, the update notice, the page's title and the manifest: none
    // spells the stage out and none reads the constant.
    expect(worded).toEqual([]);
    expect(readers).toEqual([]);
    // The two places that show it (the title's corner, Settings' first "About" line) take the UI's one text, and the
    // UI asks the one function that words it.
    expect(callers).toEqual(['src/ui/index.ts']);
  });
});
