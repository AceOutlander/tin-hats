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
import type { Difficulty, UnitKind, UpgradeDef, UpgradeLevels } from '../data/schema';
import { clampVolume } from '../data/sounds';
import { UPGRADES } from '../data/upgrades';
import { costUpTo, maxLevel } from './campaign';

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
  /** A small frame-rate readout (fps and frame times) in a corner of the battle (off by default). */
  showFps: boolean;
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
    showFps: META.defaultShowFps,
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

/** Basic Training, the standalone tutorial (version 8). */
export interface TrainingRecord {
  /** Finished at least once: its one-time medal reward has been paid. */
  done: boolean;
  /** The player turned down the offer on the title screen (it is not offered again; the button stays). */
  skipped: boolean;
}

export interface SaveData {
  version: number;
  /** Mission id (as text) to the difficulties it has been cleared on. */
  cleared: Record<string, Difficulty[]>;
  /** Upgrade id to level. Absent = level 0. Levels are paid for in medals when bought, so they are not checked again. */
  upgrades: UpgradeLevels;
  /** Medals to spend (the Armoury and the Quartermaster). */
  medals: number;
  /**
   * Plane call-ins bought in the Armoury, unit types bought before version 8 (units were sold from v0.9.0 to v0.11.0)
   * and unit types the removed British missions had unlocked (version 10): they all stay unlocked. Free types are
   * never listed.
   */
  armoury: string[];
  /** Mission id (as text) to wins per difficulty: the replay decay of the medals. */
  wins: Record<string, Partial<Record<Difficulty, number>>>;
  /** The mission last started from the campaign, or 0 when none (the map opens on it). */
  lastMission: number;
  /** Basic Training: finished (reward paid) and offer turned down. */
  training: TrainingRecord;
  settings: SaveSettings;
  /** Progress on the removed British placeholder missions (version 10), kept as it was; absent when there was none. */
  legacy?: LegacyRecord;
}

/**
 * The British placeholder campaign's progress (mission ids 1 to 10), archived by the step to version 10 when those
 * missions were removed: their clears and wins as they stood, so nothing a player did is thrown away. Nothing reads it
 * to play; the medals, upgrades, call-ins and unit types it earned stay in the save's own fields.
 */
export interface LegacyRecord {
  cleared: Record<string, Difficulty[]>;
  wins: Record<string, Partial<Record<Difficulty, number>>>;
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
  /**
   * With several campaigns: each campaign's mission ids in its own order (together the same ids as `missionIds`). The
   * "no progress past the first mission not cleared" rule then holds per campaign, not across the joined list.
   */
  campaigns?: readonly (readonly number[])[];
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
    training: { done: false, skipped: false },
    settings: defaultSettings(),
  };
}

/**
 * Cleared missions of a version 5 (or older) document, as that version counted them: mission key to the valid
 * difficulties, in campaign order, stopping at the first mission not cleared.
 */
function legacyCleared(raw: unknown, ids: readonly number[]): Map<string, Difficulty[]> {
  const out = new Map<string, Difficulty[]>();
  if (!isRecord(raw)) return out;
  for (const id of ids) {
    const list = raw[String(id)];
    const ds = Array.isArray(list) ? DIFFICULTY_LIST.filter((d) => list.includes(d)) : [];
    if (ds.length === 0) break;
    out.set(String(id), ds);
  }
  return out;
}

/**
 * Medals replace upgrade points and per-mission unit unlocks (version 5 to 6). The old rule still holds for the old
 * points: each cleared mission earned META.firstClearPoints, one point bought one level, and levels the points never
 * paid for are cut (in the Quartermaster's order). Upgrades bought stay; the points left unspent become medals at
 * META.legacyPointMedals each (plane call-ins were never part of a version 5 save, so nothing is marked bought: since
 * version 8 the missions a save has reached unlock their unit types again, see unitsUnlocked in medals.ts); and
 * each cleared mission and difficulty counts as one win, so a replay pays half. A save that old played the British
 * campaign (ids 1 to 10, META.legacyCampaign), the only one there was.
 */
export function migrateToMedals(
  doc: Record<string, unknown>,
  ids: readonly number[] = META.legacyCampaign.ids,
  defs: readonly UpgradeDef[] = UPGRADES,
): void {
  const cleared = legacyCleared(doc.cleared, ids);
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
  const wins: Record<string, Partial<Record<Difficulty, number>>> = {};
  for (const [key, ds] of cleared) {
    const w: Partial<Record<Difficulty, number>> = {};
    for (const d of ds) w[d] = 1;
    wins[key] = w;
  }
  doc.armoury = [];
  doc.wins = wins;
}

/**
 * Units are unlocked by missions again, not bought (version 7 to 8, owner 2026-11-09). Every unit type the save bought
 * stays unlocked (it stays in the armoury list) and its price comes back as medals (MEDALS.unitRefunds); plane
 * call-ins stay bought. Upgrade levels were re-priced from META.legacyUpgradeLevelMedals each to the table's own
 * prices (cheaper first levels), so a save is given back what its levels cost then minus what they cost now; levels
 * are kept.
 */
export function migrateToUnlocks(doc: Record<string, unknown>, defs: readonly UpgradeDef[] = UPGRADES): void {
  let medals = typeof doc.medals === 'number' && Number.isFinite(doc.medals) && doc.medals > 0 ? Math.floor(doc.medals) : 0;
  if (Array.isArray(doc.armoury)) {
    const seen = new Set<string>();
    for (const id of doc.armoury) {
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      medals += MEDALS.unitRefunds[id as UnitKind] ?? 0;
    }
  }
  const levels = isRecord(doc.upgrades) ? doc.upgrades : {};
  for (const def of defs) {
    const level = levels[def.id];
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) continue;
    const kept = Math.min(level, maxLevel(def));
    medals += Math.max(0, kept * META.legacyUpgradeLevelMedals - costUpTo(def, kept));
  }
  doc.medals = Math.min(MEDALS.maxMedals, medals);
}

/**
 * The ten British placeholder missions are removed (version 9 to 10, owner 2026-11-08, docs/QUEUE.md). Nothing earned
 * is lost: medals, upgrade levels, plane call-ins and Basic Training stay as they are, and every unit type the British
 * missions had unlocked (those of each mission reached: the cleared ones in campaign order and the next one, as
 * unitsUnlocked counted them) joins the armoury list, so it stays unlocked in every campaign. The British clears and
 * wins move to the `legacy` block, and the map no longer opens on a British mission. A save without any British
 * progress gets no legacy block.
 */
export function migrateRemoveBritish(doc: Record<string, unknown>): void {
  const legacy = META.legacyCampaign;
  const keys = new Set(legacy.ids.map(String));
  const cleared: Record<string, unknown> = isRecord(doc.cleared) ? { ...doc.cleared } : {};
  const wins: Record<string, unknown> = isRecord(doc.wins) ? { ...doc.wins } : {};
  // The unit types of every reached British mission: the first is always reached, each later one once the one before
  // it was cleared.
  const kinds: UnitKind[] = [];
  for (const id of legacy.ids) {
    for (const kind of legacy.unlocks[id] ?? []) if (!kinds.includes(kind)) kinds.push(kind);
    const list = cleared[String(id)];
    if (!Array.isArray(list) || !list.some(isDifficulty)) break;
  }
  const armoury: unknown[] = Array.isArray(doc.armoury) ? [...(doc.armoury as unknown[])] : [];
  for (const kind of kinds) if (!(MEDALS.free as readonly string[]).includes(kind) && !armoury.includes(kind)) armoury.push(kind);
  doc.armoury = armoury;
  const old: { cleared: Record<string, unknown>; wins: Record<string, unknown> } = { cleared: {}, wins: {} };
  for (const key of Object.keys(cleared)) {
    if (!keys.has(key)) continue;
    old.cleared[key] = cleared[key];
    delete cleared[key];
  }
  for (const key of Object.keys(wins)) {
    if (!keys.has(key)) continue;
    old.wins[key] = wins[key];
    delete wins[key];
  }
  doc.cleared = cleared;
  doc.wins = wins;
  if (Object.keys(old.cleared).length > 0 || Object.keys(old.wins).length > 0) doc.legacy = old;
  if (typeof doc.lastMission === 'number' && keys.has(String(doc.lastMission))) doc.lastMission = 0;
}

/** Ids a save's armoury list may hold: plane call-ins sold there, and unit types kept unlocked (bought before version 8, or unlocked by the British missions before version 10). */
function isArmouryId(id: string): boolean {
  if (MEDALS.armoury.some((a) => a.id === id)) return true;
  return MEDALS.units.some((u) => u.kind === id) && !(MEDALS.free as readonly string[]).includes(id);
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
  // 6 -> 7: "Show FPS" joins the settings, off (its default) for every older save.
  6: (doc) => {
    if (!isRecord(doc.settings)) return;
    doc.settings = { ...doc.settings, showFps: META.defaultShowFps };
  },
  // 7 -> 8: units are unlocked by missions again (see migrateToUnlocks).
  7: (doc) => migrateToUnlocks(doc),
  // 8 -> 9: Basic Training joins the game. Nobody has finished it or turned it down yet, so every player can still
  // earn its one-time reward and is offered it once on the title screen.
  8: (doc) => {
    doc.training = { done: false, skipped: false };
  },
  // 9 -> 10: the British placeholder missions are removed; what they earned stays and their progress is archived (see
  // migrateRemoveBritish).
  9: (doc) => migrateRemoveBritish(doc),
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

function sanitizeCleared(raw: unknown, out: SaveData, missionIds: readonly number[] | undefined, campaigns?: readonly (readonly number[])[]): void {
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
  // A mission can only have been cleared if the one before it (in its own campaign) was: progress stops at the first gap.
  for (const ids of campaigns ?? [missionIds]) {
    for (const id of ids) {
      const list = kept[String(id)];
      if (!list || !missionIds.includes(id)) break;
      out.cleared[String(id)] = list;
    }
  }
}

/** The legacy block, checked: British mission ids only, valid difficulties and win counts; null when nothing is left. */
function sanitizeLegacy(raw: unknown): LegacyRecord | null {
  if (!isRecord(raw)) return null;
  const keys = new Set(META.legacyCampaign.ids.map(String));
  const out: LegacyRecord = { cleared: {}, wins: {} };
  if (isRecord(raw.cleared)) {
    for (const key of Object.keys(raw.cleared)) {
      const list = raw.cleared[key];
      if (!keys.has(key) || !Array.isArray(list)) continue;
      const ds = DIFFICULTY_LIST.filter((d) => list.includes(d));
      if (ds.length > 0) out.cleared[key] = ds;
    }
  }
  if (isRecord(raw.wins)) {
    for (const key of Object.keys(raw.wins)) {
      const per = raw.wins[key];
      if (!keys.has(key) || !isRecord(per)) continue;
      const kept: Partial<Record<Difficulty, number>> = {};
      for (const d of DIFFICULTY_LIST) {
        const n = per[d];
        if (typeof n === 'number' && Number.isInteger(n) && n >= 1) kept[d] = Math.min(MEDALS.maxWins, n);
      }
      if (Object.keys(kept).length > 0) out.wins[key] = kept;
    }
  }
  return Object.keys(out.cleared).length > 0 || Object.keys(out.wins).length > 0 ? out : null;
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
      if (typeof id === 'string' && isArmouryId(id) && !out.armoury.includes(id)) out.armoury.push(id);
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
  sanitizeCleared(doc.cleared, out, rules.missionIds, rules.campaigns);
  sanitizeUpgrades(doc.upgrades, out, rules.upgradeDefs);
  sanitizeMedals(doc, out, rules.missionIds);

  if (isRecord(doc.training)) {
    out.training.done = doc.training.done === true;
    out.training.skipped = doc.training.skipped === true;
  }
  const legacy = sanitizeLegacy(doc.legacy);
  if (legacy) out.legacy = legacy;

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
    settings.showFps = cleanSetting('showFps', s.showFps);
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
