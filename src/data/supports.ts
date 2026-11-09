import type { BarrageWeapon, SupportDef, SupportKind } from './schema';

/**
 * Support call-ins. Each side has its own cooldown per kind; the first round leaves `delay` seconds
 * after the call and the rest follow evenly over `duration`. Off-map fire (OFF_MAP: artillery, Katyusha) counts
 * `delay` to the first round's landing instead: it is fired, unseen, its fall time earlier.
 */
export const SUPPORTS: Record<SupportKind, SupportDef> = {
  // Realistic artillery (owner, 2026-11-09): guns kilometres away, never shown. The first shell lands `delay` seconds
  // after the call (its whistle starts OFF_MAP[weapon].fall before that) and the rest arrive one by one over `duration`.
  artillery: {
    kind: 'artillery',
    cooldown: 60,
    delay: 4,
    rounds: 8,
    duration: 5,
    spread: 180,
    weapon: 'artilleryShell',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 1.6,
    launchOffset: 0,
    hqDamageMul: 0.25,
    vehicleDamageMul: 1,
    pattern: 'scatter',
  },
  smoke: {
    kind: 'smoke',
    cooldown: 45,
    delay: 1.5,
    rounds: 0,
    duration: 0,
    spread: 0,
    weapon: null,
    smokeRadius: 170,
    smokeTime: 9,
    warning: 1.5,
    launchOffset: 0,
    hqDamageMul: 0,
    vehicleDamageMul: 1,
    pattern: 'scatter',
  },
  airStrike: {
    kind: 'airStrike',
    cooldown: 90,
    delay: 3.5,
    rounds: 5,
    duration: 1.2,
    spread: 260,
    weapon: 'airRocket',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 2.5,
    launchOffset: 140,
    hqDamageMul: 0.25,
    vehicleDamageMul: 3,
    pattern: 'sweep',
  },

  // Aircraft call-ins (job 7): each flies across the field (PLANES), so anti-aircraft guns get a window. No call-in
  // costs the player in-battle money since 2026-11-09 (owner): the player's are Shop charges (MEDALS.charges); a side
  // without charges (the AI) pays UNLIMITED_SUPPORT_COST.
  bomber: {
    kind: 'bomber',
    cooldown: 120,
    delay: 4,
    rounds: 8,
    duration: 1.6,
    spread: 360,
    weapon: 'aerialBomb',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 3,
    launchOffset: 140,
    hqDamageMul: 0.25,
    vehicleDamageMul: 5,
    pattern: 'sweep',
  },
  fighter: {
    kind: 'fighter',
    cooldown: 75,
    delay: 3,
    rounds: 10,
    duration: 1,
    spread: 200,
    weapon: 'strafeMg',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 2,
    launchOffset: 80,
    hqDamageMul: 0.1,
    vehicleDamageMul: 0.5,
    pattern: 'sweep',
  },
  recon: {
    kind: 'recon',
    cooldown: 60,
    delay: 3,
    rounds: 0,
    duration: 20,
    spread: 600,
    weapon: null,
    smokeRadius: 0,
    smokeTime: 0,
    warning: 2,
    launchOffset: 0,
    hqDamageMul: 0,
    vehicleDamageMul: 1,
    pattern: 'scatter',
  },

  // The Soviet signature call-in (docs/campaigns/NATIONS.md): a BM-13 battery's salvo. Many light rockets scattered at
  // random over a strip far wider than an artillery barrage, with a long cooldown. About the same damage per minute as
  // the barrage, all at once and spread thin: men spread out or under cover come through it (tests/unit/nations.test.ts).
  katyusha: {
    kind: 'katyusha',
    cooldown: 150,
    delay: 4.5,
    rounds: 18,
    duration: 4.5,
    spread: 420,
    weapon: 'katyushaRocket',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 1.3,
    launchOffset: 0,
    hqDamageMul: 0.2,
    vehicleDamageMul: 0.8,
    pattern: 'scatter',
  },
};

/** In HUD order. */
export const SUPPORT_KINDS: readonly SupportKind[] = ['artillery', 'smoke', 'airStrike', 'bomber', 'fighter', 'recon', 'katyusha'];

/**
 * An aircraft call-in in flight. It enters approach seconds before its first round, crosses the
 * strip at the speed that sweeps it in `duration` (or `speed` when it has no rounds), and leaves
 * `exit` seconds after the last one: the whole crossing is one planePass event. Anti-aircraft fire
 * takes its health; at or below driveOffFrac of it the pilot turns for home and drops nothing more,
 * at 0 it goes down (planeDown).
 */
export interface PlaneDef {
  hp: number;
  /** Seconds of flight before the first round, and after the last. */
  approach: number;
  exit: number;
  /** Speed in wu/s for a plane with no rounds (recon); bombers and fighters sweep their strip in `duration`. */
  speed: number;
  /** Altitude row for the view (0 = highest). */
  row: number;
  /** Fraction of its health at which it breaks off its run. */
  driveOffFrac: number;
}

export interface AntiAirDef {
  /** Horizontal reach of an anti-aircraft gun against a plane overhead (wu). */
  range: number;
  /** Seconds between bursts at a plane, shots per burst, hit chance per shot and damage per hit. */
  cooldown: number;
  burst: number;
  accuracy: number;
  damage: number;
}

export const PLANES: Partial<Record<SupportKind, PlaneDef>> = {
  bomber: { hp: 160, approach: 2.5, exit: 2, speed: 0, row: 0, driveOffFrac: 0.5 },
  fighter: { hp: 100, approach: 2, exit: 1.5, speed: 0, row: 1, driveOffFrac: 0.4 },
  recon: { hp: 80, approach: 2.5, exit: 2.5, speed: 420, row: 0, driveOffFrac: 0.5 },
};

export const ANTI_AIR: AntiAirDef = {
  range: 520,
  cooldown: 0.5,
  burst: 1,
  accuracy: 0.5,
  damage: 30,
};

/**
 * Fire from guns and launchers off the map (owner, 2026-11-09: "the guns are kilometres away and never shown"): the
 * artillery and Katyusha call-ins and every scripted barrage. Each round falls `fall` seconds from high above the top
 * of the screen (the length of its incoming whistle or rocket shriek, which rises as it falls: the two are kept in step
 * by tests/unit/sim-artillery.test.ts) and lands steeply, entering `slant` wu short of its landing point on the firer's
 * side. No muzzle, no gun: the renderer draws it from above the screen top.
 */
export interface OffMapFire {
  fall: number;
  slant: number;
  /** Its incoming sound (src/data/sounds.ts), as long as its fall. */
  sound: 'incomingWhistle' | 'rocketShriek';
}

export const OFF_MAP: Readonly<Record<BarrageWeapon, OffMapFire>> = {
  artilleryShell: { fall: 1.6, slant: 110, sound: 'incomingWhistle' },
  siegeShell: { fall: 1.6, slant: 70, sound: 'incomingWhistle' },
  mortar21: { fall: 1.6, slant: 60, sound: 'incomingWhistle' },
  heavyBomb: { fall: 1.6, slant: 40, sound: 'incomingWhistle' },
  aerialBomb: { fall: 1.6, slant: 40, sound: 'incomingWhistle' },
  nebelwerfer: { fall: 1.3, slant: 170, sound: 'rocketShriek' },
  katyushaRocket: { fall: 1.3, slant: 190, sound: 'rocketShriek' },
};

/** The off-map fire of a weapon id, or null for a weapon fired on the battlefield (or from an aircraft in sight). */
export function offMapFire(weapon: string | null): OffMapFire | null {
  return weapon !== null && Object.prototype.hasOwnProperty.call(OFF_MAP, weapon) ? OFF_MAP[weapon as BarrageWeapon] : null;
}

/** Call-ins whose rounds come down from above: hit-facing armour does not apply to them. */
export const TOP_ATTACK_SUPPORTS: readonly SupportKind[] = ['airStrike', 'bomber', 'fighter'];

/**
 * Money a call costs a side that is not limited by charges: the enemy AI, the balance bot and the proving ground (no
 * SideStart.supportCharges). That is the AI's own rule (owner, 2026-11-09: "the enemy AI isn't limited by medals"):
 * it keeps the prices call-ins had before charges, so its use of aircraft and every mission's balance stay as tuned.
 * A side with charges (the player from the briefing) pays none.
 */
export const UNLIMITED_SUPPORT_COST: Record<SupportKind, number> = {
  artillery: 0,
  smoke: 0,
  airStrike: 0,
  bomber: 300,
  fighter: 180,
  recon: 100,
  katyusha: 0,
};
