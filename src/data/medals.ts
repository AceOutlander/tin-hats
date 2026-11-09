/**
 * Medals and the Armoury (src/meta/medals.ts applies these rules).
 *
 * A win pays medals from a score between 0 (a rough clear) and 1 (a perfect one), measured against the mission's own
 * targets below: assault missions on completion time and own casualties, survival missions (fixed length) on own
 * casualties and HQ health. The amount is scaled by the difficulty and halved for every earlier win of the same
 * mission on the same difficulty, then rounded down. Medals buy Quartermaster upgrades and the plane call-ins in the
 * Armoury. Unit types are not bought: each mission unlocks its own (MissionDef.newUnit, unlocks and its unit list) for
 * every mission after, replays and other campaigns included (owner, 2026-11-09; unitsUnlocked in src/meta/medals.ts).
 */
import type { Difficulty, StructureRef, SupportKind, UnitKind } from './schema';

/** A plane call-in sold in the Armoury. */
export interface ArmouryItemDef {
  id: SupportKind;
  type: 'support';
  /** Price in medals. */
  price: number;
  isNew: boolean;
}

/** A unit type the player can field, in the Armoury's order. */
export interface PlayerUnitDef {
  kind: UnitKind;
  /** Shown under the core roles (false) or the new units (true). */
  isNew: boolean;
}

/** A unit type given to a player who has not bought it, for one mission only, as free units at the start. */
export interface LoanDef {
  kind: UnitKind;
  count: number;
}

export interface MissionMedalDef {
  /** Assault missions: at or under targetSeconds scores full marks on time, at or over roughSeconds scores none. */
  targetSeconds: number;
  roughSeconds: number;
  /** Own units lost: at or under targetLost scores full marks, at or over roughLost scores none. */
  targetLost: number;
  roughLost: number;
  /**
   * Types lent for this mission only when the player has not unlocked them (a safety net: a mission unlocks its own
   * types, so a player who reached it normally never needs a loan).
   */
  loans: LoanDef[];
  /**
   * The army progression (balance test): the types a player has unlocked when this mission starts, playing the
   * campaign in order. The balance test checks each one is unlocked, with no loan needed.
   */
  expects: UnitKind[];
  /**
   * How the win is scored (FOUNDATIONS.md 7.1): timed = completion time and casualties; fixed = casualties and HQ health
   * (no time: survival, delay and hold by default). Omitted = by the mission mode (assault and special timed).
   */
  scoring?: 'timed' | 'fixed';
  /** Timed: the clock starts when this phase begins (1003: two fixed holds, then the counter-attack is timed). */
  timedFrom?: string;
  /** Fixed: the share of the score from HQ health (default weights.survival.hq). */
  hqHealthWeight?: number;
  /** Fixed: a defended structure's health at the end is this share of the score too (1007's house). */
  structureWeight?: { ref: StructureRef; weight: number };
  /**
   * Delay missions: every enemy unit of these kinds destroyed beyond `above` adds `per` to the 0..1 score, up to
   * `max` (1002 and 1008: tanks over the kill objective).
   */
  killBonus?: { kinds: UnitKind[]; above: number; per: number; max: number };
}

export interface MedalTunables {
  /** Medals before the difficulty and replay factors: a rough clear (score 0) and a perfect one (score 1). */
  rough: number;
  perfect: number;
  /** How the score is made up, per mission mode. Each pair adds up to 1. */
  weights: {
    assault: { time: number; casualties: number };
    survival: { casualties: number; hq: number };
  };
  /** Survival: HQ health (0..1) at or above hqPerfect scores full marks on HQ, at or below hqRough scores none. */
  hqPerfect: number;
  hqRough: number;
  /** Multiplier on the medals per difficulty. */
  difficultyMul: Record<Difficulty, number>;
  /** Each earlier win of the same mission on the same difficulty multiplies the medals by this. */
  replayFactor: number;
  /** Unit types every player has from the start: every campaign starts with them. */
  free: UnitKind[];
  /** Every unit type a player can field, free ones first, in the Armoury's order (core roles, then the new units). */
  units: PlayerUnitDef[];
  /** What the Armoury sells: the plane call-ins. */
  armoury: ArmouryItemDef[];
  /**
   * Medals paid per unit type while units were bought in the Armoury (v0.9.0 to v0.11.0). Save version 8 gives them
   * back to every save that bought one, and the type stays unlocked.
   */
  unitRefunds: Partial<Record<UnitKind, number>>;
  /** Per campaign mission id. A mission missing here scores on `fallback`. */
  missions: Record<number, MissionMedalDef>;
  fallback: MissionMedalDef;
  /** Most medals a save may hold (anything above is a damaged save). */
  maxMedals: number;
  /** Most wins counted per mission and difficulty (the replay factor is long since zero by then). */
  maxWins: number;
  /**
   * Medals paid once, the first time Basic Training is finished (src/data/missions/training.ts): enough for a new
   * player to buy a few first upgrade levels (units are unlocked by missions since v0.12.0).
   */
  trainingReward: number;
}

/**
 * The Stalingrad army as each mission starts, playing the campaign in order: what that mission and every one before it
 * unlocks (the unlock table, docs/campaigns/STALINGRAD_BUILD.md). Each mission's design is built around it.
 */
const STAL_1001: UnitKind[] = ['sapper', 'rifle', 'lmg', 'at'];
const STAL_1002: UnitKind[] = [...STAL_1001, 'tank', 'mortar'];
const STAL_1003: UnitKind[] = [...STAL_1002, 'assault'];
const STAL_1004: UnitKind[] = [...STAL_1003, 'medic', 'conscript'];
const STAL_1005: UnitKind[] = [...STAL_1004, 'flame'];
const STAL_1006: UnitKind[] = [...STAL_1005, 'sniper', 'aa'];
const STAL_1007: UnitKind[] = [...STAL_1006, 'commander'];
const STAL_1009: UnitKind[] = [...STAL_1007, 'apc'];

export const MEDALS: MedalTunables = {
  rough: 3,
  perfect: 30,
  weights: {
    assault: { time: 0.5, casualties: 0.5 },
    survival: { casualties: 0.6, hq: 0.4 },
  },
  hqPerfect: 0.95,
  hqRough: 0.25,
  difficultyMul: { normal: 1, hard: 1.5, insane: 2.25 },
  replayFactor: 0.5,
  free: ['sapper', 'rifle'],
  units: [
    { kind: 'sapper', isNew: false },
    { kind: 'rifle', isNew: false },
    { kind: 'lmg', isNew: false },
    { kind: 'assault', isNew: false },
    { kind: 'mortar', isNew: false },
    { kind: 'sniper', isNew: false },
    { kind: 'medic', isNew: false },
    { kind: 'at', isNew: false },
    { kind: 'tank', isNew: false },
    { kind: 'apc', isNew: true },
    { kind: 'flame', isNew: true },
    { kind: 'commander', isNew: true },
    { kind: 'aa', isNew: true },
  ],
  unitRefunds: { lmg: 90, assault: 135, mortar: 180, sniper: 180, medic: 165, at: 225, tank: 390, apc: 330, flame: 240, commander: 270, aa: 210 },
  armoury: [
    { id: 'recon', type: 'support', price: 210, isNew: true },
    { id: 'fighter', type: 'support', price: 300, isNew: true },
    { id: 'bomber', type: 'support', price: 450, isNew: true },
  ],
  // First-cut Stalingrad targets (DECISIONS 306), from the reasonable-player bot on Normal with the mission's own roster
  // (seeds 1 to 3, battle seconds including the prep phase): about 0.8 of its median time and 0.6 of its median losses
  // for full marks, twice its time and three times its losses for none. Survival missions score on losses and HQ health
  // only; their seconds are the clock plus the prep phase. Tuning them on real play is still open. No mission lends
  // anything: each unlocks its own types.
  missions: {
    // The brief's scoring (STALINGRAD.md, each mission's Medals): fixed with HQ health 0.3.
    1001: { targetSeconds: 780, roughSeconds: 1560, targetLost: 15, roughLost: 75, loans: [], expects: STAL_1001, hqHealthWeight: 0.3 },
    // A delay: fixed, with a kill bonus for the tanks beyond the twelve of the objective.
    1002: {
      targetSeconds: 630,
      roughSeconds: 1620,
      targetLost: 21,
      roughLost: 105,
      loans: [],
      expects: STAL_1002,
      killBonus: { kinds: ['lightTank', 'tank', 'heavyTank'], above: 12, per: 0.01, max: 0.1 },
    },
    // A hold: the two holds are fixed, Katukov's counter-attack is timed (from its phase; first cut from the bot's 4 to 5 min).
    1003: { targetSeconds: 220, roughSeconds: 600, targetLost: 36, roughLost: 180, loans: [], expects: STAL_1003, scoring: 'timed', timedFrom: 'katukov' },
    1004: { targetSeconds: 630, roughSeconds: 1560, targetLost: 58, roughLost: 290, loans: [], expects: STAL_1004 },
    1005: { targetSeconds: 510, roughSeconds: 1260, targetLost: 47, roughLost: 235, loans: [], expects: STAL_1005 },
    // A hold scored on time, as the brief asks.
    1006: { targetSeconds: 870, roughSeconds: 2160, targetLost: 109, roughLost: 545, loans: [], expects: STAL_1006, scoring: 'timed' },
    // Fixed: HQ health 0.2 and the house itself 0.2 (held at the end).
    1007: {
      targetSeconds: 1380,
      roughSeconds: 2760,
      targetLost: 29,
      roughLost: 145,
      loans: [],
      expects: STAL_1007,
      hqHealthWeight: 0.2,
      structureWeight: { ref: { building: 1 }, weight: 0.2 },
    },
    // The brief's delay: fixed, with a kill bonus.
    1008: {
      targetSeconds: 1320,
      roughSeconds: 2640,
      targetLost: 43,
      roughLost: 215,
      loans: [],
      expects: STAL_1007,
      killBonus: { kinds: ['tank'], above: 12, per: 0.01, max: 0.1 },
    },
    1009: { targetSeconds: 1260, roughSeconds: 3120, targetLost: 56, roughLost: 280, loans: [], expects: STAL_1009 },
    1010: { targetSeconds: 480, roughSeconds: 1200, targetLost: 31, roughLost: 155, loans: [], expects: STAL_1009 },
  },
  fallback: { targetSeconds: 300, roughSeconds: 900, targetLost: 10, roughLost: 60, loans: [], expects: ['sapper', 'rifle'] },
  maxMedals: 9_999_999,
  maxWins: 99,
  // Enough for a new player's first few upgrade levels (a first level costs 10).
  trainingReward: 40,
};
