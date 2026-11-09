/**
 * The beta version (owner, 2026-11-08): one number in package.json, "0.X.Y" while in beta, and "What's new" notes in
 * src/data/version.ts for exactly that version, so every push to live bumps both together.
 */
import { describe, expect, it } from 'vitest';
import { version } from '../../package.json';
import { RELEASE_STAGE, WHATS_NEW } from '../../src/data/version';

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
