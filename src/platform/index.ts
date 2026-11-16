/**
 * The platform the game runs on: here, the website, which provides nothing (docs/PLATFORM.md).
 *
 * This is the one module another build replaces with its own (it must export the same `platform`). Keep it to this:
 * the game reads `platform` from here and everything else about platforms lives in ./types and ./shell.
 */
import type { Platform } from './types';

const NOTHING_OWNED: ReadonlySet<string> = new Set<string>();

export const platform: Platform = {
  installed: false,
  shell: null,
  store: null,
  reward: null,
  settings: null,
  entitlements: () => NOTHING_OWNED,
  extraUnit: null,
  testMode: null,
};
