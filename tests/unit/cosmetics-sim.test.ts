/**
 * Cosmetics are visual only. The simulation cannot read one: nothing a battle's rules import, however far down, is a
 * cosmetics or crates module, and a battle's config has no field for them. (That a battle then plays the same with
 * and without skins worn is run in tests/unit/app-cosmetics.test.ts.)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..', '..', 'src');
const SIM = join(SRC, 'sim');
/** The modules of the feature: none may be reached from the simulation. */
const FORBIDDEN = ['data/cosmetics.ts', 'data/crates.ts', 'meta/cosmetics.ts', 'meta/crates.ts', 'art/skins.ts', 'render/skins.ts'];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : /\.ts$/.test(e.name) ? [join(dir, e.name)] : []));
}

function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts'), base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every source file reachable from `roots` through relative imports (type imports included: stricter than needed). */
function reachable(roots: readonly string[]): Set<string> {
  const seen = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) continue;
      const target = resolveImport(file, spec);
      if (target && /\.ts$/.test(target) && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

describe('the simulation and cosmetics', () => {
  const sim = sources(SIM);
  const reached = [...reachable(sim)].map((f) => relative(SRC, f).replace(/\\/g, '/'));

  it('the check looks at the whole simulation and what it imports', () => {
    expect(sim.length).toBeGreaterThan(20);
    expect(reached).toContain('sim/battle.ts');
    expect(reached).toContain('data/units.ts');
    for (const f of FORBIDDEN.slice(0, 4)) expect(existsSync(join(SRC, f)), f).toBe(true);
  });

  it('nothing the simulation imports, however far down, is a cosmetics or crates module', () => {
    for (const f of FORBIDDEN) expect(reached, f).not.toContain(f);
    expect(reached.filter((f) => /cosmetic|skins?\.ts$|crates\.ts$/i.test(f))).toEqual([]);
    // Nor anything of the app, the view or the platform, through which what is worn travels.
    expect(reached.filter((f) => /^(app|render|ui|platform|art)\//.test(f))).toEqual([]);
  });

  it('no simulation file names a cosmetic or a skin', () => {
    for (const file of sim) {
      const text = readFileSync(file, 'utf8');
      expect(/cosmetic|\bskins?\b|\bworn\b/i.test(text), relative(SRC, file)).toBe(false);
    }
  });
});
