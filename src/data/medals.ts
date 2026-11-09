/**
 * Medals, upgrade points and the Shop (src/meta/medals.ts applies these rules), pegged to Stick War: Legacy's economy
 * (owner, 2026-11-09; docs/campaigns/economy-benchmark-research.json; DECISIONS 411 to 419): its proportions, missions
 * of play per purchase, not its numbers or its grind.
 *
 * A win pays medals from a score between 0 (a rough clear) and 1 (a perfect one), measured against the mission's own
 * targets below: assault missions on completion time and own casualties, survival missions (fixed length) on own
 * casualties and HQ health. A first win on a difficulty is scaled by the difficulty (the benchmark's 20/30/40: x1,
 * x1.5, x2); a second win pays half the Normal amount and every later one a quarter (the benchmark's 10 and 5), on any
 * difficulty, rounded down. Clearing every mission of a campaign on a difficulty for the first time pays a one-time
 * bonus (the benchmark's 500/1,000/1,500 over 12 stages). Medals buy call-in charges in the Shop on the campaign map
 * (each use in battle spends one), and later cosmetics, one-off boosts and the Poland unlock (a price only: no purchase
 * code in this repo). Quartermaster upgrades are bought with upgrade points, earned by first clears (the benchmark's 2
 * points per stage, 1 point per level). Unit types are not bought: each mission unlocks its own (MissionDef.newUnit,
 * unlocks and its unit list) for every mission after, replays and other campaigns included (owner, 2026-11-09;
 * unitsUnlocked in src/meta/medals.ts).
 */
import type { Difficulty, StructureRef, SupportKind, UnitKind } from './schema';

/** One call-in charge in the Shop: one use in battle (its cooldown still applies between uses). */
export interface ChargeDef {
  kind: SupportKind;
  /** Medals for one charge. */
  price: number;
  /** Charges every new save starts with (and every save converted to version 11), so players learn them. */
  starter: number;
}

/** A call-in lent for one mission, used before the player's own charges (missions designed around that call-in). */
export interface ChargeLoanDef {
  kind: SupportKind;
  count: number;
}

/** Upgrade points (the Quartermaster's own currency, as the benchmark's): earned by first clears, never bought. */
export interface UpgradePointTunables {
  /**
   * Points a mission has paid in all once it has been won on this difficulty or a harder one: a first win on Normal
   * pays 5; a first win on Hard brings it to 8 (3 more after a Normal clear, 8 at once when Hard is the first); Insane
   * to 10. Replays pay none (no grind).
   */
  byDifficulty: Record<Difficulty, number>;
  /** Paid once, with Basic Training's medals. */
  training: number;
  /** Most points a save may hold unspent (anything above is a damaged save). */
  max: number;
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
  /**
   * The share of the medals a win pays by the earlier wins of the same mission on the same difficulty (index 0 the
   * first win, the last entry every later one). Only a first win is scaled by difficultyMul.
   */
  replayFactors: readonly number[];
  /** Paid once per difficulty, the first time every mission of a campaign has been cleared on it. */
  campaignBonus: Record<Difficulty, number>;
  /** Upgrade points (the Quartermaster). */
  points: UpgradePointTunables;
  /** The Shop's call-in charges, in Shop order. */
  charges: ChargeDef[];
  /** Most charges of one call-in a save may hold. */
  maxCharges: number;
  /** Most call-ins the player brings to one mission (the briefing's loadout; lent ones come on top). */
  loadoutSlots: number;
  /** The paid Battle for Poland campaign's medal price (data only: the unlock is built in the private app). */
  polandPrice: number;
  /** Unit types every player has from the start: every campaign starts with them. */
  free: UnitKind[];
  /** Every unit type a player can field, free ones first, in the Armoury's order (core roles, then the new units). */
  units: PlayerUnitDef[];
  /**
   * The plane call-ins sold once, for good, in the Armoury before version 11, at these prices: the step to version 11
   * turns each one bought into charges (src/meta/save.ts migrateToCharges).
   */
  legacyPlanes: { kind: SupportKind; price: number }[];
  /** A plane bought for good before version 11 becomes at least this many charges. */
  legacyPlaneMinCharges: number;
  /**
   * Medals paid per unit type while units were bought in the Armoury (v0.9.0 to v0.11.0). Save version 8 gives them
   * back to every save that bought one, and the type stays unlocked.
   */
  unitRefunds: Partial<Record<UnitKind, number>>;
  /** Per campaign mission id. A mission missing here scores on `fallback`. */
  missions: Record<number, MissionMedalDef>;
  /**
   * Call-in charges lent for one mission, per mission id: the missions designed around a call-in (a director event that
   * offers it, or the mission that introduces it). Lent charges are spent before the player's own and never kept.
   */
  chargeLoans: Record<number, ChargeLoanDef[]>;
  fallback: MissionMedalDef;
  /** Most medals a save may hold (anything above is a damaged save). */
  maxMedals: number;
  /** Most wins counted per mission and difficulty (the replay factor is long since zero by then). */
  maxWins: number;
  /**
   * Medals paid once, the first time Basic Training is finished (src/data/missions/training.ts): two smoke charges'
   * worth, with MEDALS.points.training upgrade points.
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
  // The benchmark's first win of a level on Normal pays 20: a perfect clear does here, a rough one half.
  rough: 10,
  perfect: 20,
  weights: {
    assault: { time: 0.5, casualties: 0.5 },
    survival: { casualties: 0.6, hq: 0.4 },
  },
  hqPerfect: 0.95,
  hqRough: 0.25,
  difficultyMul: { normal: 1, hard: 1.5, insane: 2 },
  replayFactors: [1, 0.5, 0.25],
  // The benchmark pays about twice a campaign's first clears once at its end (500 over 12 x 20): here 10 missions.
  campaignBonus: { normal: 400, hard: 800, insane: 1200 },
  // The benchmark: 2 points a stage, 1 a level, one campaign buys about 55% of the levels. Here 93 levels: a Normal
  // run (50 points) buys 54%, Normal and Hard 86%, all three difficulties every level.
  points: { byDifficulty: { normal: 5, hard: 8, insane: 10 }, training: 3, max: 9999 },
  // The benchmark's spells: cheap 20 to 50 gems (about one first-clear level), mid 100 to 300, big summons 500 to 1,000
  // (about a whole campaign). Smoke after one mission, artillery after two or three, the bomber about a Normal campaign.
  charges: [
    { kind: 'smoke', price: 20, starter: 3 },
    { kind: 'artillery', price: 40, starter: 3 },
    { kind: 'recon', price: 60, starter: 0 },
    { kind: 'fighter', price: 150, starter: 0 },
    { kind: 'airStrike', price: 250, starter: 0 },
    { kind: 'katyusha', price: 300, starter: 0 },
    { kind: 'bomber', price: 500, starter: 0 },
  ],
  maxCharges: 99,
  loadoutSlots: 4,
  // The owner's price (2,999 medals or $5.99; owner, 2026-11-09, overriding the 1,500 of DECISIONS 415): about the
  // Normal, Hard and most of the Insane campaign with their bonuses, like the benchmark's top skins (2,000 to 3,000).
  polandPrice: 2999,
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
  legacyPlanes: [
    { kind: 'recon', price: 210 },
    { kind: 'fighter', price: 300 },
    { kind: 'bomber', price: 450 },
  ],
  legacyPlaneMinCharges: 3,
  // First-cut Stalingrad targets (DECISIONS 345), from the reasonable-player bot on Normal with the mission's own roster
  // (seeds 1 to 3, battle seconds including the prep phase): about 0.8 of its median time and 0.6 of its median losses
  // for full marks, twice its time and three times its losses for none. Survival missions score on losses and HQ health
  // only; their seconds are the clock plus the prep phase. Tuning them on real play is still open. No mission lends
  // anything: each unlocks its own types.
  missions: {
    // The brief's scoring (STALINGRAD.md, each mission's Medals): fixed with HQ health 0.3.
    1001: { targetSeconds: 960, roughSeconds: 1920, targetLost: 15, roughLost: 75, loans: [], expects: STAL_1001, hqHealthWeight: 0.3 },
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
    // Retuned with the mission (DECISIONS 431): about 0.8 of the bot's median between unlimited calls (16 min) and the loan
    // only (21 min).
    1004: { targetSeconds: 900, roughSeconds: 1900, targetLost: 58, roughLost: 290, loans: [], expects: STAL_1004 },
    // Retuned with the mission (DECISIONS 432): about 0.8 of the bot's median between unlimited calls (16.5 min) and no
    // call-in (22.7 min).
    1005: { targetSeconds: 940, roughSeconds: 2000, targetLost: 47, roughLost: 235, loans: [], expects: STAL_1005 },
    // A hold scored on time, as the brief asks. Retuned with the mission (DECISIONS 433): about the bot's median with
    // unlimited calls (16.4 min) for a perfect time, and its slow no-call wins (up to about 35 min) for a rough one.
    1006: { targetSeconds: 940, roughSeconds: 2100, targetLost: 109, roughLost: 545, loans: [], expects: STAL_1006, scoring: 'timed' },
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
    // Retuned with the mission (DECISIONS 437): about 0.8 of the bot's median between unlimited calls (18.5 min) and no
    // call-in (23.7 min) for a perfect time, its slow no-call wins for a rough one; the brief's 65 casualties.
    1010: { targetSeconds: 1000, roughSeconds: 2000, targetLost: 65, roughLost: 325, loans: [], expects: STAL_1009 },
  },
  // Every Stalingrad mission was designed and tuned around its own call-ins (MissionDef.supports, used without limit
  // before charges): the director's support-enable events (1003 and 1007 the Katyusha, 1004 the Il-2, 1009 the Il-2
  // and the Po-2), 1007's own artillery cooldown, 1010's bomber, and the artillery of every mission from 1002 on. Each
  // lends what its design needs: the calls the reasonable-player bot made with no limit (seed 1, Normal), or about
  // half of them where the bot won with none (1002, 1003, 1007). The player's own charges are the extra (DECISIONS
  // 416; the mission tuning pass should cut these as missions are retuned around bought charges).
  chargeLoans: {
    // 1002 lends nothing since its tuning (DECISIONS 429): the bot wins it with no call-in at all.
    // 1003 lends only the brief's new rocket battery since its tuning (DECISIONS 430): the bot wins it with no call-in,
    // and two salvoes let a player meet the Katyusha the mission introduces.
    1003: [{ kind: 'katyusha', count: 2 }],
    // 1004 lends only the brief's Il-2s since its tuning (DECISIONS 431): the division's guns and the 8th Tank Brigade
    // prepare Klin, and two sorties let a player meet the call-in the mission introduces.
    1004: [{ kind: 'airStrike', count: 2 }],
    // 1005 lends nothing since its tuning (DECISIONS 432): the east bank's guns and rocket batteries fire for the
    // landing as scripted barrages, the bot wins it with no call-in, and the mission introduces a unit, not a call-in.
    // 1006 lends nothing since its tuning (DECISIONS 433): the far bank's guns and rocket batteries fire for the climb
    // and the hold as scripted barrages, and the mission introduces units (the sniper, the AA gun), not a call-in.
    // 1007 lends only the brief's rocket battery for the last night since its tuning (DECISIONS 434): the far bank's
    // guns fire on the square for the tank attacks as scripted barrages, and the bot holds the house with no call-in.
    1007: [{ kind: 'katyusha', count: 1 }],
    // 1008 lends nothing since its tuning (DECISIONS 435): the far bank's guns fire on each tank attack in the yard and
    // its rocket batteries on the last push as scripted barrages, and the mission introduces no call-in.
    // 1009 lends only the brief's Il-2s and Po-2s since its tuning (DECISIONS 436): the Front's guns and Il-2s fire for
    // the breakthrough and the Don hills as scripted barrages and a raid, and two sorties of each let a player meet the
    // call-ins the mission brings in from phase 2.
    1009: [
      { kind: 'airStrike', count: 2 },
      { kind: 'recon', count: 2 },
    ],
    // 1010 lends only the brief's Il-2s (the Flak at Gumrak) and the Pe-2 it introduces (the strongpoints) since its
    // tuning (DECISIONS 437): the five opening barrages and the Don Front's guns on the square are scripted.
    1010: [
      { kind: 'airStrike', count: 2 },
      { kind: 'bomber', count: 2 },
    ],
  },
  fallback: { targetSeconds: 300, roughSeconds: 900, targetLost: 10, roughLost: 60, loans: [], expects: ['sapper', 'rifle'] },
  maxMedals: 9_999_999,
  maxWins: 99,
  trainingReward: 40,
};
