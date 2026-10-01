/**
 * Save data: one versioned JSON document in a key-value store that is injected
 * (localStorage in the browser, a Map in tests). Loading validates every field
 * and never throws: missing or damaged data gives a fresh save.
 */
import { DIFFICULTY_LIST } from '../data/difficulty';
import { META } from '../data/meta';
import type { Difficulty, UpgradeLevels } from '../data/schema';

/** The part of Storage the game uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveSettings {
  muted: boolean;
  /** The difficulty the briefing starts on. */
  difficulty: Difficulty;
  hints: boolean;
}

export interface SaveData {
  version: number;
  /** Mission id (as text) to the difficulties it has been cleared on. */
  cleared: Record<string, Difficulty[]>;
  /** Upgrade id to level. Absent = level 0. */
  upgrades: UpgradeLevels;
  settings: SaveSettings;
}

export type LoadStatus = 'ok' | 'fresh' | 'corrupt';

export interface LoadResult {
  data: SaveData;
  status: LoadStatus;
}

const MISSION_KEY = /^[1-9][0-9]{0,3}$/;
const UPGRADE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export function defaultSave(): SaveData {
  return {
    version: META.saveVersion,
    cleared: {},
    upgrades: {},
    settings: { muted: META.defaultMuted, difficulty: META.defaultDifficulty, hints: META.defaultHints },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTY_LIST as readonly string[]).includes(value);
}

/**
 * Check an unknown value and build a clean SaveData from it, or return null when it is not a save
 * this version understands. Unusable parts of an otherwise good save are dropped, not fatal.
 */
export function sanitizeSave(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > META.saveVersion) return null;

  const out = defaultSave();

  if (isRecord(raw.cleared)) {
    for (const key of Object.keys(raw.cleared)) {
      if (!MISSION_KEY.test(key)) continue;
      const list = raw.cleared[key];
      if (!Array.isArray(list)) continue;
      const kept: Difficulty[] = [];
      for (const d of list) if (isDifficulty(d) && !kept.includes(d)) kept.push(d);
      if (kept.length > 0) out.cleared[key] = kept;
    }
  }

  if (isRecord(raw.upgrades)) {
    for (const key of Object.keys(raw.upgrades)) {
      if (!UPGRADE_KEY.test(key)) continue;
      const level = raw.upgrades[key];
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) continue;
      out.upgrades[key] = Math.min(level, META.maxUpgradeLevel);
    }
  }

  if (isRecord(raw.settings)) {
    const s = raw.settings;
    if (typeof s.muted === 'boolean') out.settings.muted = s.muted;
    if (typeof s.hints === 'boolean') out.settings.hints = s.hints;
    if (isDifficulty(s.difficulty)) out.settings.difficulty = s.difficulty;
  }
  return out;
}

/** Read the save. A missing or damaged entry, or a storage that throws, gives defaults. */
export function loadSave(storage: StorageLike | null): LoadResult {
  let text: string | null;
  try {
    text = storage ? storage.getItem(META.saveKey) : null;
  } catch {
    return { data: defaultSave(), status: 'corrupt' };
  }
  if (text === null) return { data: defaultSave(), status: 'fresh' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { data: defaultSave(), status: 'corrupt' };
  }
  const data = sanitizeSave(parsed);
  return data ? { data, status: 'ok' } : { data: defaultSave(), status: 'corrupt' };
}

/** Write the save. Returns false when there is no storage or it refused (full, private mode). */
export function writeSave(storage: StorageLike | null, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(META.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Delete the stored save. */
export function clearSave(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(META.saveKey);
  } catch {
    // Nothing to do: a storage that refuses to delete cannot be fixed from here.
  }
}

/** A store that lives in memory: the fallback when localStorage is unavailable, and the one tests use. */
export function createMemoryStorage(initial?: Record<string, string>): StorageLike {
  const map = new Map<string, string>(initial ? Object.entries(initial) : []);
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}
