import type { AiDef } from './schema';

/** Tunables of the AI commander. The same values drive the enemy, mirrored test battles and the test bot. */
export const AI: AiDef = {
  attackRatio: 1.25,
  holdRatio: 0.6,
  retreatRatio: 0.45,
  returnRatio: 0.8,
  minOrderInterval: 6,
  minAttackStrength: 225,
  regroupFrac: 0.4,
  groupRadius: 600,
  popCapAttackFrac: 0.9,
  attackArmyPop: 40,
  impatienceAfter: 200,
  impatientRatio: 0.85,
  threatDistance: 450,
  maxQueueDepth: 2,
  surplusSupplies: 150,
  reserveSupplies: 2000,
  botThinkInterval: 1,
  atPerTank: 1,
  mortarsVsDugIn: 2,
  assaultVsDugIn: 3,
  infantryPerLmg: 8,
  maxReaction: 4,

  dugInWeight: 1.5,
  pillboxValue: 150,
  hqThreatDistance: 500,
  hqValue: 250,
  minAdvanceTime: 20,
  commitRatio: 1.6,
  advantageRatio: 1.8,

  supportReach: 1200,
  supportGap: 10,
  artilleryRadius: 140,
  artilleryMinValue: 240,
  airStrikeMinValue: 360,
  smokeMinGap: 220,
  smokeMaxGap: 700,
};

/**
 * AI tunables added in the balance phase. They live beside AI rather than in AiDef so the shared
 * contract in schema.ts stays as it is.
 */
export interface AiRecoveryDef {
  /**
   * The enemy at the hold line counts as a threat to the HQ (and so can trigger Fall Back) only
   * while that line lies within this distance of the HQ door. An army outnumbered at a captured
   * trench far forward holds it instead of running the length of the map with the enemy behind it.
   */
  homeLineReach: number;
  /**
   * A side that loses when the mission clock runs out stops waiting for the perfect moment once
   * this many seconds are left: it attacks with whatever has gathered and keeps attacking.
   */
  deadlineRush: number;
}

export const AI_RECOVERY: AiRecoveryDef = {
  homeLineReach: 1900,
  deadlineRush: 150,
};
