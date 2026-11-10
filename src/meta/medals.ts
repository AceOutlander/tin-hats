/**
 * Medals, upgrade points and the Shop over a SaveData: the score of a win, the medals and upgrade points it pays, the
 * replay decay per mission and difficulty, the campaign bonus, buying call-in charges and choosing the call-ins brought
 * to a mission, the unit types each reached mission unlocks, which units the player may field in a mission (every
 * unlocked type, in every mission, plus any loans) and what a mission really brings that is new. Pure functions; the
 * ones that change a save change it in place.
 */
import { DIFFICULTY_LIST } from '../data/difficulty';
import { MEDALS, type ChargeDef, type ChargeLoanDef, type LoanDef, type MissionMedalDef } from '../data/medals';
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
  /** Seconds on the mission clock (prep phases left out) and when each phase began (src/sim/director.ts directorScore). */
  missionSeconds?: number;
  phaseStarts?: Record<string, number>;
  /** Every side objective begun, and whether it was earned. */
  sideObjectives?: { id: string; text: string; bonus: number; done: boolean }[];
  /** Enemy units that died, per kind (the kill bonus). */
  enemyLost?: Partial<Record<UnitKind, number>>;
  /** The defended structure's 0..1 health at the end (MissionMedalDef.structureWeight). */
  structureFrac?: number;
}

/** What a win earned on top of its score: side objectives and the kill bonus, as shares of the 0..1 score. */
export interface ScoreBonus {
  /** Each side objective begun, its bonus and whether it was earned. */
  objectives: { text: string; bonus: number; done: boolean }[];
  /** Enemy units of the bonus kinds destroyed, the count the bonus starts above, and what they added. */
  kills: { value: number; above: number; score: number } | null;
  /** The total added (side objectives earned plus kills), before the score is capped at 1. */
  total: number;
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
  /** A defended structure's health (fixed scoring with MissionMedalDef.structureWeight; 0..1 fractions), or null. */
  structure: ScorePart | null;
  /** Side objectives and the kill bonus, or null when the mission has neither. */
  bonus: ScoreBonus | null;
  /** 0..1 overall. */
  score: number;
  /** Medals before the difficulty and replay factors. */
  base: number;
  difficulty: Difficulty;
  /** The difficulty's multiplier on a first win; 1 on a replay (the benchmark's replays pay alike on every difficulty). */
  difficultyMul: number;
  /** Earlier wins of this mission on this difficulty. */
  winsBefore: number;
  /** 1, 0.5, then 0.25 for every later win. */
  replayFactor: number;
  /** floor(base * difficultyMul * replayFactor). */
  medals: number;
  /** The one-time campaign bonus this win paid on top (it cleared the whole campaign on this difficulty), else 0. */
  campaignBonus: number;
  /** Upgrade points this win paid (a first win on this difficulty or the first on a harder one), else 0. */
  points: number;
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

/** Medal factor of a replay: 1 for the first win on that difficulty, then 0.5, then 0.25 for every later win. */
export function replayFactor(winsBefore: number): number {
  const f = MEDALS.replayFactors;
  return f[Math.min(f.length - 1, Math.max(0, Math.floor(winsBefore)))];
}

/** "50" for "Replay: 50% medals" (rounded down). */
export function replayPercent(winsBefore: number): number {
  return Math.floor(replayFactor(winsBefore) * 100 + 1e-9);
}

/** How a mission mode scores when its medal targets do not say: assault and special on time, the rest fixed. */
export function defaultScoring(mode: MissionMode): 'timed' | 'fixed' {
  return mode === 'assault' || mode === 'special' ? 'timed' : 'fixed';
}

/**
 * Score a win and work out its medals (FOUNDATIONS.md 7.1). Timed: time (from MissionMedalDef.timedFrom's phase if
 * given) and casualties. Fixed: casualties, HQ health and, with structureWeight, a defended structure's health. Then
 * the side objectives earned and the kill bonus are added and the score is capped at 1, so a perfect run pays what it
 * always did and the bonuses make up for a rougher one.
 */
export function scoreWin(mode: MissionMode, def: MissionMedalDef, stats: WinStats, difficulty: Difficulty, winsBefore: number): MedalBreakdown {
  const casualties: ScorePart = { value: stats.lost, target: def.targetLost, score: mark(stats.lost, def.targetLost, def.roughLost) };
  let time: ScorePart | null = null;
  let hq: ScorePart | null = null;
  let structure: ScorePart | null = null;
  let score: number;
  if ((def.scoring ?? defaultScoring(mode)) === 'fixed') {
    const hqFrac = Math.max(0, Math.min(1, stats.hqFrac));
    hq = { value: hqFrac, target: MEDALS.hqPerfect, score: mark(hqFrac, MEDALS.hqPerfect, MEDALS.hqRough) };
    const w = MEDALS.weights.survival;
    const sw = def.structureWeight ? def.structureWeight.weight : 0;
    if (def.structureWeight) {
      const frac = Math.max(0, Math.min(1, stats.structureFrac ?? 0));
      structure = { value: frac, target: 1, score: frac };
    }
    if (def.hqHealthWeight === undefined && sw === 0) {
      // The survival formula, as it always was.
      score = w.casualties * casualties.score + w.hq * hq.score;
    } else {
      const hqWeight = def.hqHealthWeight ?? w.hq;
      score = (1 - hqWeight - sw) * casualties.score + hqWeight * hq.score + (structure ? sw * structure.score : 0);
    }
  } else {
    const start = def.timedFrom !== undefined ? stats.phaseStarts?.[def.timedFrom] : undefined;
    const seconds = start !== undefined && stats.missionSeconds !== undefined ? Math.max(0, stats.missionSeconds - start) : stats.seconds;
    time = { value: seconds, target: def.targetSeconds, score: mark(seconds, def.targetSeconds, def.roughSeconds) };
    const w = MEDALS.weights.assault;
    score = w.time * time.score + w.casualties * casualties.score;
  }
  let bonus: ScoreBonus | null = null;
  const sides = stats.sideObjectives ?? [];
  if (sides.length > 0 || def.killBonus) {
    let total = 0;
    for (const so of sides) if (so.done) total += so.bonus;
    let kills: ScoreBonus['kills'] = null;
    if (def.killBonus) {
      const kb = def.killBonus;
      let n = 0;
      for (const kind of kb.kinds) n += stats.enemyLost?.[kind] ?? 0;
      const add = Math.min(kb.max, Math.max(0, n - kb.above) * kb.per);
      kills = { value: n, above: kb.above, score: add };
      total += add;
    }
    bonus = { objectives: sides.map((so) => ({ text: so.text, bonus: so.bonus, done: so.done })), kills, total };
    score = Math.min(1, score + total);
  }
  const base = Math.round(MEDALS.rough + (MEDALS.perfect - MEDALS.rough) * score);
  const difficultyMul = winsBefore <= 0 ? MEDALS.difficultyMul[difficulty] : 1;
  const factor = replayFactor(winsBefore);
  return {
    mode,
    time,
    casualties,
    hq,
    structure,
    bonus,
    score,
    base,
    difficulty,
    difficultyMul,
    winsBefore,
    replayFactor: factor,
    medals: Math.floor(base * difficultyMul * factor + 1e-9),
    campaignBonus: 0,
    points: 0,
  };
}

/** Wins of a mission on one difficulty so far. */
export function winsOn(save: SaveData, missionId: number, difficulty: Difficulty): number {
  return save.wins[String(missionId)]?.[difficulty] ?? 0;
}

/** Upgrade points a mission has paid once it has been won on these difficulties (the hardest counts). */
export function missionPoints(difficulties: readonly Difficulty[]): number {
  let most = 0;
  for (const d of difficulties) most = Math.max(most, MEDALS.points.byDifficulty[d]);
  return most;
}

/** The difficulties a mission has been won on (its win counts). */
function wonOn(save: SaveData, missionId: number): Difficulty[] {
  return DIFFICULTY_LIST.filter((d) => winsOn(save, missionId, d) > 0);
}

/**
 * Record a campaign win: score it, count it and pay its medals and upgrade points. With `campaignIds` (every mission of
 * its campaign), the first win that leaves the whole campaign cleared on this difficulty also pays the campaign bonus;
 * recordClear must have recorded this clear first.
 */
export function recordWin(
  save: SaveData,
  mission: MissionDef,
  difficulty: Difficulty,
  stats: WinStats,
  campaignIds: readonly number[] = [],
): MedalBreakdown {
  const before = winsOn(save, mission.id, difficulty);
  const result = scoreWin(mission.mode, missionMedals(mission.id), stats, difficulty, before);
  const pointsBefore = missionPoints(wonOn(save, mission.id));
  const key = String(mission.id);
  const wins = save.wins[key] ?? {};
  wins[difficulty] = Math.min(MEDALS.maxWins, before + 1);
  save.wins[key] = wins;
  result.points = Math.max(0, missionPoints(wonOn(save, mission.id)) - pointsBefore);
  if (before === 0 && campaignIds.includes(mission.id) && campaignIds.every((id) => (save.cleared[String(id)] ?? []).includes(difficulty))) {
    result.campaignBonus = MEDALS.campaignBonus[difficulty];
  }
  addMedals(save, result.medals + result.campaignBonus);
  addPoints(save, result.points);
  return result;
}

/**
 * Basic Training was finished: the first time, it is recorded and pays MEDALS.trainingReward and the training's
 * upgrade points; after that it pays nothing. Returns the medals paid.
 */
export function completeTraining(save: SaveData): number {
  if (save.training.done) return 0;
  save.training.done = true;
  const before = save.medals;
  addPoints(save, MEDALS.points.training);
  return addMedals(save, MEDALS.trainingReward) - before;
}

/** Give upgrade points (negative takes them, never below zero). Returns the new balance. */
export function addPoints(save: SaveData, n: number): number {
  const delta = Number.isFinite(n) ? Math.trunc(n) : 0;
  save.points = Math.max(0, Math.min(MEDALS.points.max, save.points + delta));
  return save.points;
}

/** Basic Training is offered on the title screen until it has been finished or the player turned it down. */
export function trainingOffered(save: SaveData): boolean {
  return !save.training.done && !save.training.skipped;
}

/** Give medals (negative takes them, never below zero). Returns the new balance. */
export function addMedals(save: SaveData, n: number): number {
  const delta = Number.isFinite(n) ? Math.trunc(n) : 0;
  save.medals = Math.max(0, Math.min(MEDALS.maxMedals, save.medals + delta));
  return save.medals;
}

// --- The Shop: call-in charges -------------------------------------------------

/** The Shop's entry for a call-in, or undefined for one it does not sell. */
export function chargeDef(kind: string): ChargeDef | undefined {
  return MEDALS.charges.find((c) => c.kind === kind);
}

/** Charges of a call-in the save holds. */
export function chargesOf(save: SaveData, kind: SupportKind): number {
  return save.charges[kind] ?? 0;
}

/** The charges every new save starts with. */
export function starterCharges(): Partial<Record<SupportKind, number>> {
  const out: Partial<Record<SupportKind, number>> = {};
  for (const c of MEDALS.charges) if (c.starter > 0) out[c.kind] = c.starter;
  return out;
}

/** The loadout of a new save: the call-ins it has starter charges of. */
export function starterLoadout(): SupportKind[] {
  return MEDALS.charges.filter((c) => c.starter > 0).map((c) => c.kind).slice(0, MEDALS.loadoutSlots);
}

/** Give charges of a call-in (negative takes them; kept within 0..MEDALS.maxCharges). Returns the new count. */
export function addCharges(save: SaveData, kind: SupportKind, n: number): number {
  if (chargeDef(kind) === undefined) return chargesOf(save, kind);
  const delta = Number.isFinite(n) ? Math.trunc(n) : 0;
  const next = Math.max(0, Math.min(MEDALS.maxCharges, chargesOf(save, kind) + delta));
  if (next > 0) save.charges[kind] = next;
  else delete save.charges[kind];
  return next;
}

export function canBuyCharge(save: SaveData, kind: string): boolean {
  const def = chargeDef(kind);
  return def !== undefined && save.medals >= def.price && chargesOf(save, def.kind) < MEDALS.maxCharges;
}

/**
 * Buy one charge of a call-in for its price in medals. A call-in bought for the first time joins the loadout while it
 * has a free slot. Returns false (and changes nothing) if it is not sold, too dear, or at the most a save may hold.
 */
export function buyCharge(save: SaveData, kind: string): boolean {
  const def = chargeDef(kind);
  if (def === undefined || !canBuyCharge(save, kind)) return false;
  save.medals -= def.price;
  addCharges(save, def.kind, 1);
  if (!save.loadout.includes(def.kind) && save.loadout.length < MEDALS.loadoutSlots) save.loadout.push(def.kind);
  return true;
}

/** The call-in charges a mission lends (the missions designed around a call-in). */
export function chargeLoans(missionId: number): ChargeLoanDef[] {
  return (MEDALS.chargeLoans[missionId] ?? []).filter((l) => chargeDef(l.kind) !== undefined && l.count > 0).map((l) => ({ ...l }));
}

/** One call-in the player can bring to a mission: the charges held, those lent, and whether it is in the loadout. */
export interface LoadoutOption {
  kind: SupportKind;
  owned: number;
  loan: number;
  /** Brought: in the save's loadout with charges, or lent (lent ones always come). */
  chosen: boolean;
}

/** The call-ins the player can bring to this mission, in Shop order: every one with charges held or lent. */
export function loadoutOptions(save: SaveData, missionId: number): LoadoutOption[] {
  const loans = chargeLoans(missionId);
  const out: LoadoutOption[] = [];
  let slots = MEDALS.loadoutSlots;
  for (const c of MEDALS.charges) {
    const owned = chargesOf(save, c.kind);
    const loan = loans.find((l) => l.kind === c.kind)?.count ?? 0;
    if (owned <= 0 && loan <= 0) continue;
    let chosen = loan > 0;
    if (!chosen && owned > 0 && save.loadout.includes(c.kind) && slots > 0) {
      chosen = true;
      slots -= 1;
    }
    out.push({ kind: c.kind, owned, loan, chosen });
  }
  return out;
}

/**
 * Put a call-in in or out of the loadout. Lent call-ins always come and use no slot; a full loadout (MEDALS.loadoutSlots
 * of the player's own) takes no more. Returns false when nothing changed.
 */
export function toggleLoadout(save: SaveData, kind: SupportKind): boolean {
  if (chargeDef(kind) === undefined) return false;
  const at = save.loadout.indexOf(kind);
  if (at >= 0) {
    save.loadout.splice(at, 1);
    return true;
  }
  const held = save.loadout.filter((k) => chargesOf(save, k) > 0).length;
  if (held >= MEDALS.loadoutSlots) return false;
  // Kinds with no charges left free their slot.
  save.loadout = save.loadout.filter((k) => chargesOf(save, k) > 0);
  save.loadout.push(kind);
  return true;
}

export function isFree(kind: UnitKind): boolean {
  return MEDALS.free.includes(kind);
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
 * The unit types a save has unlocked, in the Armoury's order: the free ones, those its armoury list keeps (bought before
 * version 8, or unlocked by the removed British missions: save version 10), and those
 * every reached mission unlocks, in any campaign (owner, 2026-11-09: once unlocked, a type fields in every mission,
 * replays and other campaigns included, as the player's own nation's version). `except` leaves one mission's own
 * unlocks out (what the player had before it); `free` false leaves the free types out unless a mission lists them.
 * A nation's signature kind (the Soviet conscripts) is not in the Armoury's list: it comes after the others, once a
 * reached mission lists it (each mission that fields it lists it, so a replay does not call it new again).
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
  const signature: UnitKind[] = [];
  for (const m of missions) {
    if (m.id === except || !reached(m.id)) continue;
    for (const kind of missionUnlocks(m)) {
      got.add(kind);
      if (!MEDALS.units.some((u) => u.kind === kind) && !signature.includes(kind)) signature.push(kind);
    }
  }
  return [...playerUnitKinds().filter((k) => got.has(k)), ...signature];
}

/** The first mission (in the order given) whose unlocks include this type, or null. */
export function unlockingMission(kind: UnitKind, missions: readonly MissionDef[]): MissionDef | null {
  return missions.find((m) => missionUnlocks(m).includes(kind)) ?? null;
}

// --- What the player fields in a mission ---------------------------------------

export interface Roster {
  /** Unit types the player may train. */
  units: UnitKind[];
  /** Call-ins the player brings (the loadout, and those lent). */
  supports: SupportKind[];
  /** Charges of each call-in brought: the player's own plus those lent. */
  charges: Partial<Record<SupportKind, number>>;
  /** Of those, the charges lent for this mission only (spent first, never kept). */
  chargeLoans: Partial<Record<SupportKind, number>>;
  /** Types lent for this mission only, as free units at the start. */
  loans: LoanDef[];
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
 * the mission allows, free ones only where the mission lists them (no sappers in a mission without money); the call-ins
 * of the loadout and those the mission lends, with their charges (owner, 2026-11-09: every call-in is medal-bought
 * charges, in any mission); and loans for the types the mission lends that are not unlocked.
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
  const supports: SupportKind[] = [];
  const charges: Partial<Record<SupportKind, number>> = {};
  const lent: Partial<Record<SupportKind, number>> = {};
  for (const o of loadoutOptions(save, mission.id)) {
    if (!o.chosen) continue;
    supports.push(o.kind);
    charges[o.kind] = o.owned + o.loan;
    if (o.loan > 0) lent[o.kind] = o.loan;
  }
  const loans: LoanDef[] = [];
  for (const loan of missionMedals(mission.id).loans) {
    if (!units.includes(loan.kind) && fieldable(loan.kind) && loan.count > 0) loans.push({ ...loan });
  }
  return { units, supports, charges, chargeLoans: lent, loans };
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
    start: [{ ...start0, forces, supportCharges: { ...roster.charges } }, mission.start[1]],
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
 * types only where another mission lists them (so a first mission that lists them still introduces them on a first play).
 */
export function missionNews(mission: MissionDef, hadUnits: readonly UnitKind[], hadSupports: readonly SupportKind[]): MissionNews {
  const units: UnitKind[] = [];
  for (const kind of [...(mission.newUnit ? [mission.newUnit] : []), ...(mission.unlocks ?? [])]) {
    if (!hadUnits.includes(kind) && !units.includes(kind)) units.push(kind);
  }
  const support = mission.newSupport !== null && !hadSupports.includes(mission.newSupport) ? mission.newSupport : null;
  return { units, support };
}

/** Call-ins the player had before this mission: those of every other reached mission, and those it holds charges of. */
export function supportsHad(save: SaveData, missions: readonly MissionDef[], reached: Reached, except: number): SupportKind[] {
  const out: SupportKind[] = [];
  for (const m of missions) if (m.id !== except && reached(m.id)) for (const s of m.supports[0]) if (!out.includes(s)) out.push(s);
  for (const c of MEDALS.charges) if (chargesOf(save, c.kind) > 0 && !out.includes(c.kind)) out.push(c.kind);
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
