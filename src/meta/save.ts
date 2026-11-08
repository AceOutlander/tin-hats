/**
 * Save data: one versioned JSON document in a key-value store that is injected
 * (localStorage in the browser, a Map in tests). Loading migrates older versions,
 * validates every field, clamps values that cannot be true (levels above the
 * maximum, negative medals, progress with a gap) and never throws:
 * missing or damaged data gives a fresh save.
 */
import { DIFFICULTY_LIST } from '../data/difficulty';
import { MEDALS } from '../data/medals';
import { META } from '../data/meta';
import { MISSIONS } from '../data/missions';
import type { Difficulty, MissionDef, UpgradeDef, UpgradeLevels } from '../data/schema';
import { clampVolume } from '../data/sounds';
import { UPGRADES } from '../data/upgrades';
import { maxLevel } from './campaign';

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
  /** A small dark pool under each soldier killed by gunfire (on by default). */
  showBlood: boolean;
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
    showBlood: META.defaultShowBlood,
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
  /** Upgrade id to level. Absent = level 0. Levels are paid for in medals when bought, so they are not checked again. */
  upgrades: UpgradeLevels;
  /** Medals to spend (the Armoury and the Quartermaster). */
  medals: number;
  /** Armoury items bought (unit kinds and plane call-ins), in the order bought. Free types are never listed. */
  armoury: string[];
  /** Mission id (as text) to wins per difficulty: the replay decay of the medals. */
  wins: Record<string, Partial<Record<Difficulty, number>>>;
  /** The mission last started from the campaign, or 0 when none (the map opens on it). */
  lastMission: number;
  settings: SaveSettings;
}

/**
 * ok = read as stored (after any version upgrade); fresh = nothing stored; corrupt = unusable, defaults given;
 * repaired = upgrading or checking it failed, so progress was kept and the settings went back to defaults.
 */
export type LoadStatus = 'ok' | 'fresh' | 'corrupt' | 'repaired';

export interface LoadResult {
  data: SaveData;
  status: LoadStatus;
}

/** What the game knows about itself, so a save can be checked against it. Both parts are optional. */
export interface SaveRules {
  /** Missions that exist, in campaign order. Progress on any other mission, or beyond the first mission not cleared, is dropped. */
  missionIds?: readonly number[];
  /** The Quartermaster table. Unknown upgrades are dropped and levels are capped. */
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
    medals: 0,
    armoury: [],
    wins: {},
    lastMission: 0,
    settings: defaultSettings(),
  };
}

/**
 * Cleared missions of a version 5 (or older) document, as that version counted them: mission key to the valid
 * difficulties, in campaign order, stopping at the first mission not cleared.
 */
function legacyCleared(raw: unknown, missions: readonly MissionDef[]): Map<string, Difficulty[]> {
  const out = new Map<string, Difficulty[]>();
  if (!isRecord(raw)) return out;
  for (const m of missions) {
    const list = raw[String(m.id)];
    const ds = Array.isArray(list) ? DIFFICULTY_LIST.filter((d) => list.includes(d)) : [];
    if (ds.length === 0) break;
    out.set(String(m.id), ds);
  }
  return out;
}

/**
 * Medals replace upgrade points and per-mission unit unlocks (version 5 to 6). The old rule still holds for the old
 * points: each cleared mission earned META.firstClearPoints, one point bought one level, and levels the points never
 * paid for are cut (in the Quartermaster's order). Upgrades bought stay; the points left unspent become medals at
 * META.legacyPointMedals each; every unit type the player could field in a mission they cleared counts as bought; and
 * each cleared mission and difficulty counts as one win, so a replay pays half.
 */
export function migrateToMedals(
  doc: Record<string, unknown>,
  missions: readonly MissionDef[] = MISSIONS,
  defs: readonly UpgradeDef[] = UPGRADES,
): void {
  const cleared = legacyCleared(doc.cleared, missions);
  let budget = cleared.size * META.firstClearPoints;
  const oldLevels = isRecord(doc.upgrades) ? doc.upgrades : {};
  // Upgrades this table does not know are left for sanitizeSave to keep or drop by its own rules.
  const upgrades: Record<string, unknown> = {};
  for (const key of Object.keys(oldLevels)) if (!defs.some((d) => d.id === key)) upgrades[key] = oldLevels[key];
  for (const def of defs) {
    const level = oldLevels[def.id];
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) continue;
    const kept = Math.min(level, maxLevel(def), budget);
    if (kept <= 0) continue;
    upgrades[def.id] = kept;
    budget -= kept;
  }
  doc.upgrades = upgrades;
  doc.medals = budget * META.legacyPointMedals;
  const sold = new Set<string>(MEDALS.armoury.map((a) => a.id));
  const owned: string[] = [];
  const wins: Record<string, Partial<Record<Difficulty, number>>> = {};
  for (const [key, ds] of cleared) {
    const mission = missions.find((m) => String(m.id) === key);
    if (mission) for (const kind of mission.units[0]) if (sold.has(kind) && !owned.includes(kind)) owned.push(kind);
    const w: Partial<Record<Difficulty, number>> = {};
    for (const d of ds) w[d] = 1;
    wins[key] = w;
  }
  doc.armoury = owned;
  doc.wins = wins;
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
  // 4 -> 5: "Show blood" joins the settings, on (its default) for every older save.
  4: (doc) => {
    if (!isRecord(doc.settings)) return;
    doc.settings = { ...doc.settings, showBlood: META.defaultShowBlood };
  },
  // 5 -> 6: medals and the Armoury (see migrateToMedals).
  5: (doc) => migrateToMedals(doc),
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
}

function sanitizeMedals(doc: Record<string, unknown>, out: SaveData, missionIds: readonly number[] | undefined): void {
  const medals = doc.medals;
  if (typeof medals === 'number' && Number.isFinite(medals) && medals > 0) out.medals = Math.min(MEDALS.maxMedals, Math.floor(medals));
  if (Array.isArray(doc.armoury)) {
    for (const id of doc.armoury) {
      if (typeof id === 'string' && MEDALS.armoury.some((a) => a.id === id) && !out.armoury.includes(id)) out.armoury.push(id);
    }
  }
  if (!isRecord(doc.wins)) return;
  for (const key of Object.keys(doc.wins)) {
    if (!MISSION_KEY.test(key)) continue;
    if (missionIds !== undefined && !missionIds.includes(Number(key))) continue;
    const per = doc.wins[key];
    if (!isRecord(per)) continue;
    const kept: Partial<Record<Difficulty, number>> = {};
    let any = false;
    for (const d of DIFFICULTY_LIST) {
      const n = per[d];
      if (typeof n === 'number' && Number.isInteger(n) && n >= 1) {
        kept[d] = Math.min(MEDALS.maxWins, n);
        any = true;
      }
    }
    if (any) out.wins[key] = kept;
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
  sanitizeMedals(doc, out, rules.missionIds);

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
    settings.showBlood = cleanSetting('showBlood', s.showBlood);
  }
  return out;
}

/** Copy a stored save that could not be used as it was into its own slot, so the next write does not destroy it. */
function keepUnreadable(storage: StorageLike | null, text: string): void {
  if (!storage || text.length > META.unreadableMaxChars) return;
  try {
    storage.setItem(META.unreadableKey, text);
  } catch {
    // A full or read-only storage: nothing more can be done, and loading must go on.
  }
}

/**
 * Read the save. Never throws, whatever is stored: a missing or damaged entry, or a storage that throws, gives
 * defaults. Checking and upgrading a save are written not to throw either, but if a step ever does (a mistake in a
 * migration, a half-updated copy of the game), the player loses the settings at most, never the start of the game:
 * the save is read again without its settings, and only if that fails too does a fresh save take its place.
 */
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
    keepUnreadable(storage, text);
    return { data: defaultSave(), status: 'corrupt' };
  }
  try {
    const data = sanitizeSave(parsed, rules);
    if (data) return { data, status: 'ok' };
    keepUnreadable(storage, text);
    return { data: defaultSave(), status: 'corrupt' };
  } catch {
    keepUnreadable(storage, text);
  }
  try {
    const data = isRecord(parsed) ? sanitizeSave({ ...parsed, settings: undefined }, rules) : null;
    if (data) return { data, status: 'repaired' };
  } catch {
    // Not even the progress could be read: a fresh save it is.
  }
  return { data: defaultSave(), status: 'corrupt' };
}

/**
 * Build something on the real storage; if what is stored there makes that throw, report it and build again on an
 * empty in-memory store. The last line of defence at start-up: saved data can never stop the game from starting.
 * The stored data is left untouched, and that session runs on defaults without saving.
 */
export function withStorageFallback<T>(
  storage: StorageLike,
  build: (storage: StorageLike) => T,
  report: (err: unknown) => void,
): T {
  try {
    return build(storage);
  } catch (err) {
    report(err);
    return build(createMemoryStorage());
  }
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
