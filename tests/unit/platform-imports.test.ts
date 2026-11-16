/**
 * The platform module is the one file another build replaces (docs/PLATFORM.md), by the name the game imports it
 * under: its folder, "platform". A file that reached it some other way ("./index", "platform/index") would keep the
 * website's empty platform in a build that swapped the module, and the game would then run on two platforms at once.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..', '..', 'src');
const PLATFORM = join(SRC, 'platform');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : /\.ts$/.test(e.name) ? [join(dir, e.name)] : []));
}

describe('imports of the platform module', () => {
  it('always name its folder, never its file', () => {
    const wrong: string[] = [];
    let readers = 0;
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/g)) {
        const spec = m[1] ?? m[2] ?? m[3];
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(file), spec);
        if (target !== PLATFORM && target !== join(PLATFORM, 'index') && target !== join(PLATFORM, 'index.ts')) continue;
        readers++;
        if (!/(^|\/)platform$/.test(spec)) wrong.push(`${file}: '${spec}'`);
      }
    }
    expect(wrong).toEqual([]);
    // The game does read it (the shell, the Shop, the extra unit): the check above looked at something.
    expect(readers).toBeGreaterThanOrEqual(2);
  });
});
