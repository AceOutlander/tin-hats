/**
 * Medals and the Armoury over a SaveData: the score of a win and the medals it pays, the replay decay per mission
 * and difficulty, buying plane call-ins, the unit types each reached mission unlocks, which units the player may
 * field in a mission (every unlocked type, in every mission, plus any loans) and what a mission really brings that is
 * new. Pure functions; the ones that change a save change it in place.
 */
import { MEDALS, type ArmouryItemDef, type LoanDef, type MissionMedalDef } from '../data/medals';
import type { Difficulty, MissionDef, MissionMode, SupportKind, UnitKind } from '../data/schema';
import { UNITS } from '../data/units';
import type { SaveData } from './save';

/** What a finished battle says about how well it went. */
export interface WinStats {
  /** Battle seconds. */
  seconds: number;
  /** Own units lost. */
  lost: number;
  /** Own HQ health at the end, 0..1. */
  hqFrac: number;
}

/** One part of the score: the figure, its target, and the 0..1 mark it earned. */
export interface ScorePart {
  value: number;
  target: number;
  score: number;
}

/** How the medals of one win were worked out (shown on the victory screen). */
export interface MedalBreakdown {
  mode: MissionMode;
  /** Assault missions only. */
  time: ScorePart | null;
  casualties: ScorePart;
  /** Survival missions only (value and target as 0..1 fractions). */
  hq: ScorePart | null;
  /** 0..1 overall. */
  score: number;
  /** Medals before the difficulty and replay factors. */
  base: number;
  difficulty: Difficulty;
  difficultyMul: number;
  /** Earlier wins of this mission on this difficulty. */
  winsBefore: number;
  /** 1, 0.5, 0.25, ... */
  replayFactor: number;
  /** floor(base * difficultyMul * replayFactor). */
  medals: number;
}

export function missionMedals(missionId: number): MissionMedalDef {
  return MEDALS.missions[missionId] ?? MEDALS.fallback;
}

/** 1 at or under `best`, 0 at or over `worst`, straight in between (works for best > worst too, e.g. HQ health). */
function mark(value: number, best: number, worst: number): number {
  if (best === worst) return value <= best ? 1 : 0;
  const t = (value - best) / (worst - best);
  return Math.max(0, Math.min(1, 1 - t));
}

/** Medal factor of a replay: 1 for the first win on that difficulty, then 0.5, 0.25, ... */
export function replayFactor(winsBefore: number): number {
  return Math.pow(MEDALS.replayFactor, Math.max(0, Math.floor(winsBefore)));
}

/** "50" for "Replay: 50% medals" (rounded down). */
export function replayPercent(winsBefore: number): number {
  return Math.floor(replayFactor(winsBefore) * 100 + 1e-9);
}

/** Score a win and work out its medals. */
export function scoreWin(mode: MissionMode, def: MissionMedalDef, stats: WinStats, difficulty: Difficulty, winsBefore: number): MedalBreakdown {
  const casualties: ScorePart = { value: stats.lost, target: def.targetLost, score: mark(stats.lost, def.targetLost, def.roughLost) };
  let time: ScorePart | null = null;
  let hq: ScorePart | null = null;
  let score: number;
  if (mode === 'survival') {
    const hqFrac = Math.max(0, Math.min(1, stats.hqFrac));
    hq = { value: hqFrac, target: MEDALS.hqPerfect, score: mark(hqFrac, MEDALS.hqPerfect, MEDALS.hqRough) };
    const w = MEDALS.weights.survival;
    score = w.casualties * casualties.score + w.hq * hq.score;
  } else {
    time = { value: stats.seconds, target: def.targetSeconds, score: mark(stats.seconds, def.targetSeconds, def.roughSeconds) };
    const w = MEDALS.weights.assault;
    score = w.time * time.score + w.casualties * casualties.score;
  }
  const base = Math.round(MEDALS.rough + (MEDALS.perfect - MEDALS.rough) * score);
  const difficultyMul = MEDALS.difficultyMul[difficulty];
  const factor = replayFactor(winsBefore);
  return {
    mode,
    time,
    casualties,
    hq,
    score,
    base,
    difficulty,
    difficultyMul,
    winsBefore,
    replayFactor: factor,
    medals: Math.floor(base * difficultyMul * factor + 1e-9),
  };
}

/** Wins of a mission on one difficulty so far. */
export function winsOn(save: SaveData, missionId: number, difficulty: Difficulty): number {
  return save.wins[String(missionId)]?.[difficulty] ?? 0;
}

/** Record a campaign win: score it, count it and pay its medals. */
export function recordWin(save: SaveData, mission: MissionDef, difficulty: Difficulty, stats: WinStats): MedalBreakdown {
  const before = winsOn(save, mission.id, difficulty);
  const result = scoreWin(mission.mode, missionMedals(mission.id), stats, difficulty, before);
  const key = String(mission.id);
  const wins = save.wins[key] ?? {};
  wins[difficulty] = Math.min(MEDALS.maxWins, before + 1);
  save.wins[key] = wins;
  addMedals(save, result.medals);
  return result;
}

/** Give medals (negative takes them, never below zero). Returns the new balance. */
export function addMedals(save: SaveData, n: number): number {
  const delta = Number.isFinite(n) ? Math.trunc(n) : 0;
  save.medals = Math.max(0, Math.min(MEDALS.maxMedals, save.medals + delta));
  return save.medals;
}

// --- The Armoury (plane call-ins) ----------------------------------------------

export function armouryItem(id: string): ArmouryItemDef | undefined {
  return MEDALS.armoury.find((a) => a.id === id);
}

export function isFree(kind: UnitKind): boolean {
  return MEDALS.free.includes(kind);
}

/** Owned: a free unit type, or an Armoury item bought (unit types bought before version 8 included). */
export function ownsItem(save: SaveData, id: string): boolean {
  return (MEDALS.free as readonly string[]).includes(id) || save.armoury.includes(id);
}

export function canBuyItem(save: SaveData, id: string): boolean {
  const item = armouryItem(id);
  return item !== undefined && !ownsItem(save, id) && save.medals >= item.price;
}

/** Buy a plane call-in. Returns false (and changes nothing) if it is not for sale, owned, or too dear. */
export function buyItem(save: SaveData, id: string): boolean {
  const item = armouryItem(id);
  if (item === undefined || !canBuyItem(save, id)) return false;
  save.medals -= item.price;
  save.armoury.push(item.id);
  return true;
}

// --- Unit types unlocked by missions -------------------------------------------

/** True for a mission id the player has reached (may play): the campaign's own rule, or an admin unlock. */
export type Reached = (missionId: number) => boolean;

/** True if the sim can field this kind for the player at all (enemy-only and not-yet-trainable kinds are left out). */
function fieldable(kind: UnitKind): boolean {
  const def = UNITS[kind];
  return def.trainable && def.enemyOnly !== true;
}

/** Every unit type a player can field, in the Armoury's order. */
export function playerUnitKinds(): UnitKind[] {
  return MEDALS.units.map((u) => u.kind).filter(fieldable);
}

/** The unit types reaching this mission unlocks: its newUnit, its unlocks and every player type in its own list. */
export function missionUnlocks(mission: MissionDef): UnitKind[] {
  const out: UnitKind[] = [];
  const all = [...(mission.newUnit ? [mission.newUnit] : []), ...(mission.unlocks ?? []), ...mission.units[0]];
  for (const kind of all) if (fieldable(kind) && !out.includes(kind)) out.push(kind);
  return out;
}

/**
 * The unit types a save has unlocked, in the Armoury's order: the free ones, those bought before version 8, and those
 * every reached mission unlocks, in any campaign (owner, 2026-11-09: once unlocked, a type fields in every mission,
 * replays and other campaigns included, as the player's own nation's version). `except` leaves one mission's own
 * unlocks out (what the player had before it); `free` false leaves the free types out unless a mission lists them.
 */
export function unitsUnlocked(
  save: SaveData,
  missions: readonly MissionDef[],
  reached: Reached,
  except: number | null = null,
  free = true,
): UnitKind[] {
  const got = new Set<string>();
  if (free) for (const kind of MEDALS.free) got.add(kind);
  for (const id of save.armoury) got.add(id);
  for (const m of missions) if (m.id !== except && reached(m.id)) for (const kind of missionUnlocks(m)) got.add(kind);
  return playerUnitKinds().filter((k) => got.has(k));
}

/** The first mission (in the order given) whose unlocks include this type, or null. */
export function unlockingMission(kind: UnitKind, missions: readonly MissionDef[]): MissionDef | null {
  return missions.find((m) => missionUnlocks(m).includes(kind)) ?? null;
}

// --- What the player fields in a mission ---------------------------------------

export interface Roster {
  /** Unit types the player may train. */
  units: UnitKind[];
  /** Call-ins the player may use. */
  supports: SupportKind[];
  /** Types lent for this mission only, as free units at the start. */
  loans: LoanDef[];
}

function soldSupports(): SupportKind[] {
  return MEDALS.armoury.map((a) => a.id);
}

/**
 * Unit types the player may field in this mission, if unlocked: the mission's own list plus every player type. No
 * mission rules out an unlocked type, replays included (owner, 2026-11-08).
 */
export function missionAllows(mission: MissionDef): UnitKind[] {
  const out: UnitKind[] = [...mission.units[0]];
  for (const kind of playerUnitKinds()) if (!out.includes(kind)) out.push(kind);
  return out;
}

/**
 * The player's roster in a mission: the unlocked types (see unitsUnlocked; this mission's own unlocks always count)
 * the mission allows, free ones only where the mission lists them (no sappers in a mission without money); the
 * mission's own call-ins plus bought planes; and loans for the types the mission lends that are not unlocked.
 */
export function missionRoster(save: SaveData, mission: MissionDef, unlocked: readonly UnitKind[] = []): Roster {
  const listed = mission.units[0];
  const own = missionUnlocks(mission);
  const units: UnitKind[] = [];
  for (const kind of missionAllows(mission)) {
    if (!fieldable(kind)) continue;
    const have = isFree(kind) ? listed.includes(kind) : own.includes(kind) || unlocked.includes(kind) || save.armoury.includes(kind);
    if (have) units.push(kind);
  }
  const supports: SupportKind[] = [...mission.supports[0]];
  for (const kind of soldSupports()) if (save.armoury.includes(kind) && !supports.includes(kind)) supports.push(kind);
  const loans: LoanDef[] = [];
  for (const loan of missionMedals(mission.id).loans) {
    if (!units.includes(loan.kind) && fieldable(loan.kind) && loan.count > 0) loans.push({ ...loan });
  }
  return { units, supports, loans };
}

/** The mission as the player gets it: side 0's units and call-ins from the roster, and the loans added to its start. */
export function applyRoster(mission: MissionDef, roster: Roster): MissionDef {
  const start0 = mission.start[0];
  const forces = [...start0.forces];
  for (const loan of roster.loans) forces.push({ kind: loan.kind, count: loan.count });
  return {
    ...mission,
    units: [[...roster.units], [...mission.units[1]]],
    supports: [[...roster.supports], [...mission.supports[1]]],
    start: [{ ...start0, forces }, mission.start[1]],
  };
}

// --- What a mission brings that is new -----------------------------------------

/** The NEW UNIT and NEW SUPPORT cards of a briefing, and the "New:" hints and tips of the battle. */
export interface MissionNews {
  units: UnitKind[];
  support: SupportKind | null;
}

/**
 * What this mission really unlocks for this player: its newUnit and unlocks the player did not have before it, and
 * its newSupport unless the player already had it. `hadUnits` is unitsUnlocked with this mission left out and the free
 * types only where another mission lists them (so mission 1 still introduces riflemen on a first play).
 */
export function missionNews(mission: MissionDef, hadUnits: readonly UnitKind[], hadSupports: readonly SupportKind[]): MissionNews {
  const units: UnitKind[] = [];
  for (const kind of [...(mission.newUnit ? [mission.newUnit] : []), ...(mission.unlocks ?? [])]) {
    if (!hadUnits.includes(kind) && !units.includes(kind)) units.push(kind);
  }
  const support = mission.newSupport !== null && !hadSupports.includes(mission.newSupport) ? mission.newSupport : null;
  return { units, support };
}

/** Call-ins the player had before this mission: those of every other reached mission, and bought planes. */
export function supportsHad(save: SaveData, missions: readonly MissionDef[], reached: Reached, except: number): SupportKind[] {
  const out: SupportKind[] = [];
  for (const m of missions) if (m.id !== except && reached(m.id)) for (const s of m.supports[0]) if (!out.includes(s)) out.push(s);
  for (const s of soldSupports()) if (save.armoury.includes(s) && !out.includes(s)) out.push(s);
  return out;
}

/** What this mission brings that is new for this save (see missionNews). */
export function newsFor(save: SaveData, missions: readonly MissionDef[], reached: Reached, mission: MissionDef): MissionNews {
  return missionNews(mission, unitsUnlocked(save, missions, reached, mission.id, false), supportsHad(save, missions, reached, mission.id));
}

/**
 * The mission with only the news this player really gets: newUnit and unlocks cut to news.units (newUnit first),
 * newSupport to news.support, and every hint `about` something the player already had dropped.
 */
export function withNews(mission: MissionDef, news: MissionNews): MissionDef {
  const fresh: readonly string[] = [...news.units, ...(news.support ? [news.support] : [])];
  return {
    ...mission,
    newUnit: news.units[0] ?? null,
    unlocks: news.units.slice(1),
    newSupport: news.support,
    events: mission.events.filter((e) => e.type !== 'hint' || e.about === undefined || fresh.includes(e.about)),
  };
}
