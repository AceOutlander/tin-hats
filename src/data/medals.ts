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
import type { Difficulty, SupportKind, UnitKind } from './schema';

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
}

/** The types unlocked before mission 2, and so on: what each mission's design is built around. */
const CORE_1: UnitKind[] = ['sapper', 'rifle'];
const CORE_2: UnitKind[] = [...CORE_1, 'lmg'];
const CORE_3: UnitKind[] = [...CORE_2, 'assault'];
const CORE_4: UnitKind[] = [...CORE_3, 'mortar'];
const CORE_5: UnitKind[] = [...CORE_4, 'sniper'];
const CORE_6: UnitKind[] = [...CORE_5, 'medic'];
const CORE_7: UnitKind[] = [...CORE_6, 'at'];
const CORE_8: UnitKind[] = [...CORE_7, 'tank'];

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
  missions: {
    // The tutorial keeps to riflemen and sappers whatever the player owns.
    1: { targetSeconds: 150, roughSeconds: 360, targetLost: 1, roughLost: 12, loans: [], expects: CORE_1 },
    2: { targetSeconds: 240, roughSeconds: 240, targetLost: 3, roughLost: 25, loans: [{ kind: 'lmg', count: 2 }], expects: CORE_2 },
    3: { targetSeconds: 180, roughSeconds: 420, targetLost: 3, roughLost: 24, loans: [{ kind: 'assault', count: 3 }], expects: CORE_3 },
    4: { targetSeconds: 330, roughSeconds: 840, targetLost: 10, roughLost: 60, loans: [{ kind: 'mortar', count: 2 }], expects: CORE_4 },
    5: { targetSeconds: 330, roughSeconds: 840, targetLost: 12, roughLost: 70, loans: [{ kind: 'sniper', count: 2 }], expects: CORE_5 },
    6: { targetSeconds: 480, roughSeconds: 1100, targetLost: 18, roughLost: 100, loans: [{ kind: 'medic', count: 2 }], expects: CORE_6 },
    // Enemy tanks from here on.
    7: { targetSeconds: 540, roughSeconds: 1300, targetLost: 14, roughLost: 90, loans: [{ kind: 'at', count: 3 }, { kind: 'medic', count: 2 }], expects: CORE_7 },
    8: { targetSeconds: 400, roughSeconds: 1100, targetLost: 12, roughLost: 80, loans: [{ kind: 'at', count: 3 }, { kind: 'tank', count: 2 }], expects: CORE_8 },
    // Paratroopers at Arnhem: no sappers (no supply economy); unlocked types, vehicles included, can be used here as anywhere.
    9: {
      targetSeconds: 360,
      roughSeconds: 360,
      targetLost: 8,
      roughLost: 50,
      loans: [{ kind: 'at', count: 3 }],
      expects: CORE_7,
    },
    10: { targetSeconds: 660, roughSeconds: 1500, targetLost: 30, roughLost: 180, loans: [{ kind: 'at', count: 3 }, { kind: 'tank', count: 2 }], expects: CORE_8 },
  },
  fallback: { targetSeconds: 300, roughSeconds: 900, targetLost: 10, roughLost: 60, loans: [], expects: CORE_1 },
  maxMedals: 9_999_999,
  maxWins: 99,
};
