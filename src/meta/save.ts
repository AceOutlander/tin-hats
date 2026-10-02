/**
 * Save data: one versioned JSON document in a key-value store that is injected
 * (localStorage in the browser, a Map in tests). Loading migrates older versions,
 * validates every field, clamps values that cannot be true (levels above the
 * maximum, more points spent than earned, progress with a gap) and never throws:
 * missing or damaged data gives a fresh save.
 */
import { DIFFICULTY_LIST } from '../data/difficulty';
import { META } from '../data/meta';
import type { Difficulty, UpgradeDef, UpgradeLevels } from '../data/schema';
import { clampVolume } from '../data/sounds';
import { maxLevel, pointsEarned } from './campaign';

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
  /** Volume sliders, whole numbers 0..100: Music (music and the stings), Ambience (rain and thunder), Sound effects (the rest). */
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  /** Lightning as a slow soft glow instead of sharp flashes (title screen and battles). */
  reduceFlash: boolean;
}

/** The volume settings, by key. */
export const VOLUME_KEYS = ['musicVolume', 'ambienceVolume', 'sfxVolume'] as const;
export type VolumeKey = (typeof VOLUME_KEYS)[number];

/** Settings of a fresh save. */
export function defaultSettings(): SaveSettings {
  return {
    muted: META.defaultMuted,
    difficulty: META.defaultDifficulty,
    hints: META.defaultHints,
    musicVolume: META.defaultMusicVolume,
    ambienceVolume: META.defaultAmbienceVolume,
    sfxVolume: META.defaultSfxVolume,
    reduceFlash: META.defaultReduceFlash,
  };
}

/**
 * One setting checked and clamped: a volume becomes a whole number 0..100, anything of the wrong type gives the
 * default. Used for the stored save and for every change the player makes.
 */
export function cleanSetting<K extends keyof SaveSettings>(key: K, value: unknown): SaveSettings[K] {
  const fallback = defaultSettings()[key];
  switch (key) {
    case 'musicVolume':
    case 'ambienceVolume':
    case 'sfxVolume':
      return clampVolume(value, fallback as number) as SaveSettings[K];
    case 'difficulty':
      return (isDifficulty(value) ? value : fallback) as SaveSettings[K];
    default:
      return (typeof value === 'boolean' ? value : fallback) as SaveSettings[K];
  }
}

export interface SaveData {
  version: number;
  /** Mission id (as text) to the difficulties it has been cleared on. */
  cleared: Record<string, Difficulty[]>;
  /** Upgrade id to level. Absent = level 0. */
  upgrades: UpgradeLevels;
  /** The mission last started from the campaign, or 0 when none (the map opens on it). */
  lastMission: number;
  settings: SaveSettings;
}

export type LoadStatus = 'ok' | 'fresh' | 'corrupt';

export interface LoadResult {
  data: SaveData;
  status: LoadStatus;
}

/** What the game knows about itself, so a save can be checked against it. Both parts are optional. */
export interface SaveRules {
  /** Missions that exist, in campaign order. Progress on any other mission, or beyond the first mission not cleared, is dropped. */
  missionIds?: readonly number[];
  /** The Quartermaster table. Unknown upgrades are dropped, levels are capped, and no more points may be spent than were earned. */
  upgradeDefs?: readonly UpgradeDef[];
}

const MISSION_KEY = /^[1-9][0-9]{0,3}$/;
const UPGRADE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const MAX_MISSION_ID = 9999;

export function defaultSave(): SaveData {
  return {
    version: META.saveVersion,
    cleared: {},
    upgrades: {},
    lastMission: 0,
    settings: defaultSettings(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTY_LIST as readonly string[]).includes(value);
}

/**
 * One step per old version: `MIGRATIONS[n]` turns a version n document into a version n + 1 one, in place.
 * A step only adds or reshapes; `sanitizeSave` still checks every value afterwards.
 */
const MIGRATIONS: Readonly<Record<number, (doc: Record<string, unknown>) => void>> = {
  // 1 -> 2: the save remembers the mission last played.
  1: (doc) => {
    doc.lastMission = 0;
  },
  // 2 -> 3: three volume sliders and "Reduce flashing" join the settings, at the defaults version 3 had.
  2: (doc) => {
    if (!isRecord(doc.settings)) return;
    const v3 = META.v3DefaultVolumes;
    doc.settings = {
      ...doc.settings,
      musicVolume: v3.music,
      ambienceVolume: v3.ambience,
      sfxVolume: v3.sfx,
      reduceFlash: META.defaultReduceFlash,
    };
  },
  // 3 -> 4: the default volumes changed (the menu mix). A slider still at version 3's default was never touched, so it
  // moves to today's default; one the player set is left as it is.
  3: (doc) => {
    if (!isRecord(doc.settings)) return;
    const s = { ...doc.settings };
    const v3 = META.v3DefaultVolumes;
    if (s.musicVolume === v3.music) s.musicVolume = META.defaultMusicVolume;
    if (s.ambienceVolume === v3.ambience) s.ambienceVolume = META.defaultAmbienceVolume;
    if (s.sfxVolume === v3.sfx) s.sfxVolume = META.defaultSfxVolume;
    doc.settings = s;
  },
};

/** Bring an older document up to the current version. Null if it is not a document, or its version is unknown or from the future. */
export function migrateSave(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  let version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > META.saveVersion) return null;
  const doc: Record<string, unknown> = { ...raw };
  while (version < META.saveVersion) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    step(doc);
    version += 1;
    doc.version = version;
  }
  return doc;
}

function sanitizeCleared(raw: unknown, out: SaveData, missionIds: readonly number[] | undefined): void {
  if (!isRecord(raw)) return;
  const kept: Record<string, Difficulty[]> = {};
  for (const key of Object.keys(raw)) {
    if (!MISSION_KEY.test(key)) continue;
    const list = raw[key];
    if (!Array.isArray(list)) continue;
    const difficulties: Difficulty[] = [];
    for (const d of list) if (isDifficulty(d) && !difficulties.includes(d)) difficulties.push(d);
    if (difficulties.length > 0) kept[key] = difficulties;
  }
  if (missionIds === undefined) {
    out.cleared = kept;
    return;
  }
  // A mission can only have been cleared if the one before it was: progress stops at the first gap.
  for (const id of missionIds) {
    const list = kept[String(id)];
    if (!list) break;
    out.cleared[String(id)] = list;
  }
}

function sanitizeUpgrades(raw: unknown, out: SaveData, defs: readonly UpgradeDef[] | undefined): void {
  if (!isRecord(raw)) return;
  for (const key of Object.keys(raw)) {
    if (!UPGRADE_KEY.test(key)) continue;
    const level = raw[key];
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) continue;
    const def = defs?.find((d) => d.id === key);
    if (defs !== undefined && def === undefined) continue;
    out.upgrades[key] = Math.min(level, def ? maxLevel(def) : META.maxUpgradeLevel);
  }
  if (defs === undefined) return;
  // Never more spent than earned: keep levels in the table's order while the points last, cut the rest.
  let budget = pointsEarned(out);
  for (const def of defs) {
    const level = out.upgrades[def.id];
    if (level === undefined) continue;
    const affordable = def.costPerLevel > 0 ? Math.floor(budget / def.costPerLevel) : level;
    const kept = Math.min(level, affordable);
    if (kept <= 0) delete out.upgrades[def.id];
    else out.upgrades[def.id] = kept;
    budget -= Math.max(0, kept) * def.costPerLevel;
  }
}

/**
 * Check an unknown value and build a clean SaveData from it, or return null when it is not a save
 * this version understands. Unusable parts of an otherwise good save are dropped, not fatal.
 */
export function sanitizeSave(raw: unknown, rules: SaveRules = {}): SaveData | null {
  const doc = migrateSave(raw);
  if (!doc) return null;

  const out = defaultSave();
  sanitizeCleared(doc.cleared, out, rules.missionIds);
  sanitizeUpgrades(doc.upgrades, out, rules.upgradeDefs);

  const last = doc.lastMission;
  if (typeof last === 'number' && Number.isInteger(last) && last >= 1 && last <= MAX_MISSION_ID) {
    if (rules.missionIds === undefined || rules.missionIds.includes(last)) out.lastMission = last;
  }

  if (isRecord(doc.settings)) {
    const s = doc.settings;
    const settings = out.settings;
    settings.muted = cleanSetting('muted', s.muted);
    settings.hints = cleanSetting('hints', s.hints);
    settings.difficulty = cleanSetting('difficulty', s.difficulty);
    for (const key of VOLUME_KEYS) settings[key] = cleanSetting(key, s[key]);
    settings.reduceFlash = cleanSetting('reduceFlash', s.reduceFlash);
  }
  return out;
}

/** Read the save. A missing or damaged entry, or a storage that throws, gives defaults. */
export function loadSave(storage: StorageLike | null, rules: SaveRules = {}): LoadResult {
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
  const data = sanitizeSave(parsed, rules);
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
