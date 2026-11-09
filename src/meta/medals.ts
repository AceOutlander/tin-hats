/**
 * Medals and the Armoury over a SaveData: the score of a win and the medals it pays, the replay decay per mission
 * and difficulty, buying unit types and plane call-ins, and which units the player may field in a mission (what the
 * Armoury owns, in every mission, plus loans). Pure functions; the ones that change a save change it in place.
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

// --- The Armoury --------------------------------------------------------------

export function armouryItem(id: string): ArmouryItemDef | undefined {
  return MEDALS.armoury.find((a) => a.id === id);
}

export function isFree(kind: UnitKind): boolean {
  return MEDALS.free.includes(kind);
}

/** Owned: free, or bought. */
export function ownsItem(save: SaveData, id: string): boolean {
  return (MEDALS.free as readonly string[]).includes(id) || save.armoury.includes(id);
}

export function canBuyItem(save: SaveData, id: string): boolean {
  const item = armouryItem(id);
  return item !== undefined && !ownsItem(save, id) && save.medals >= item.price;
}

/** Buy a unit type or call-in. Returns false (and changes nothing) if it is not for sale, owned, or too dear. */
export function buyItem(save: SaveData, id: string): boolean {
  const item = armouryItem(id);
  if (item === undefined || !canBuyItem(save, id)) return false;
  save.medals -= item.price;
  save.armoury.push(item.id);
  return true;
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

/** Types sold in the Armoury, by kind of item. */
function soldUnits(): UnitKind[] {
  return MEDALS.armoury.filter((a) => a.type === 'unit').map((a) => a.id as UnitKind);
}

function soldSupports(): SupportKind[] {
  return MEDALS.armoury.filter((a) => a.type === 'support').map((a) => a.id as SupportKind);
}

/**
 * Unit types the player may field in this mission, if owned: the mission's own list plus every type sold in the
 * Armoury. No mission rules out a bought type, replays included (owner, 2026-11-08).
 */
export function missionAllows(mission: MissionDef): UnitKind[] {
  const out: UnitKind[] = [...mission.units[0]];
  for (const kind of soldUnits()) if (!out.includes(kind)) out.push(kind);
  return out;
}

/** True if the sim can field this kind for the player at all (enemy-only and not-yet-trainable kinds are left out). */
function fieldable(kind: UnitKind): boolean {
  const def = UNITS[kind];
  return def.trainable && def.enemyOnly !== true;
}

/**
 * The player's roster in a mission: owned types the mission allows (free ones the mission lists), the mission's own
 * call-ins plus owned planes, and loans for the types the mission needs that the player has not bought.
 */
export function missionRoster(save: SaveData, mission: MissionDef): Roster {
  const listed = mission.units[0];
  const units: UnitKind[] = [];
  for (const kind of missionAllows(mission)) {
    if (!fieldable(kind)) continue;
    // Free types come only where the mission lists them (no sappers in a mission without an economy).
    if (isFree(kind) ? listed.includes(kind) : save.armoury.includes(kind)) units.push(kind);
  }
  const supports: SupportKind[] = [...mission.supports[0]];
  for (const kind of soldSupports()) if (save.armoury.includes(kind) && !supports.includes(kind)) supports.push(kind);
  const loans: LoanDef[] = [];
  const def = missionMedals(mission.id);
  for (const loan of def.loans) {
    if (!units.includes(loan.kind) && fieldable(loan.kind) && loan.count > 0) loans.push({ ...loan });
  }
  // Whatever else the design expects and the player has not bought comes on loan too (free types the mission does
  // not list stay out, like sappers where there is no money).
  for (const kind of def.expects) {
    if (isFree(kind) || units.includes(kind) || !fieldable(kind) || loans.some((l) => l.kind === kind)) continue;
    if (MEDALS.autoLoanCount > 0) loans.push({ kind, count: MEDALS.autoLoanCount });
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
