/**
 * Medals and the Armoury (src/meta/medals.ts applies these rules).
 *
 * A win pays medals from a score between 0 (a rough clear) and 1 (a perfect one), measured against the mission's own
 * targets below: assault missions on completion time and own casualties, survival missions (fixed length) on own
 * casualties and HQ health. The amount is scaled by the difficulty and halved for every earlier win of the same
 * mission on the same difficulty, then rounded down. Medals buy unit types and plane call-ins in the Armoury and
 * Quartermaster upgrades.
 */
import type { Difficulty, SupportKind, UnitKind } from './schema';

/** A unit type or plane call-in sold in the Armoury. Unit kinds and support kinds never share a name, so the kind is the id. */
export interface ArmouryItemDef {
  id: UnitKind | SupportKind;
  type: 'unit' | 'support';
  /** Price in medals. */
  price: number;
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
  /** Types this mission needs: lent for this mission only when the player has not bought them. */
  loans: LoanDef[];
  /**
   * The sensible army progression (balance test): the types a player should own when this mission starts. Anything
   * not owned must be covered by this mission's loans.
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
  /** Unit types every player has from the start. */
  free: UnitKind[];
  /**
   * Every type a mission's design expects (MissionMedalDef.expects) that the player has not bought is lent for that
   * mission, this many, on top of the mission's own loans: no mission becomes impossible, whatever the prices.
   */
  autoLoanCount: number;
  /** In the Armoury's order: the core roles, then the new units, then the plane call-ins. */
  armoury: ArmouryItemDef[];
  /** Per campaign mission id. A mission missing here scores on `fallback`. */
  missions: Record<number, MissionMedalDef>;
  fallback: MissionMedalDef;
  /** Most medals a save may hold (anything above is a damaged save). */
  maxMedals: number;
  /** Most wins counted per mission and difficulty (the replay factor is long since zero by then). */
  maxWins: number;
  /**
   * Medals paid once, the first time Basic Training is finished (src/data/missions/training.ts): enough for a new
   * player to buy the first unit in the Armoury.
   */
  trainingReward: number;
}

/** Everything that came before mission 2 in the old campaign, and so on: the types each mission's design is built around. */
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
  autoLoanCount: 2,
  armoury: [
    { id: 'lmg', type: 'unit', price: 90, isNew: false },
    { id: 'assault', type: 'unit', price: 135, isNew: false },
    { id: 'mortar', type: 'unit', price: 180, isNew: false },
    { id: 'sniper', type: 'unit', price: 180, isNew: false },
    { id: 'medic', type: 'unit', price: 165, isNew: false },
    { id: 'at', type: 'unit', price: 225, isNew: false },
    { id: 'tank', type: 'unit', price: 390, isNew: false },
    { id: 'apc', type: 'unit', price: 330, isNew: true },
    { id: 'flame', type: 'unit', price: 240, isNew: true },
    { id: 'commander', type: 'unit', price: 270, isNew: true },
    { id: 'aa', type: 'unit', price: 210, isNew: true },
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
    // Enemy tanks from here on: anti-tank teams are lent to anyone who has not bought them.
    7: { targetSeconds: 540, roughSeconds: 1300, targetLost: 14, roughLost: 90, loans: [{ kind: 'at', count: 3 }, { kind: 'medic', count: 2 }], expects: CORE_7 },
    8: { targetSeconds: 400, roughSeconds: 1100, targetLost: 12, roughLost: 80, loans: [{ kind: 'at', count: 3 }, { kind: 'tank', count: 2 }], expects: CORE_8 },
    // Paratroopers at Arnhem: no sappers (no supply economy); bought types, vehicles included, can be used here as anywhere.
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
  // The Bren gunner, first in the Armoury, costs 30; the rest goes toward the next purchase.
  trainingReward: 40,
};
