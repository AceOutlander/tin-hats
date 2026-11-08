import type { SupportDef, SupportKind } from './schema';

/**
 * Support call-ins. Each side has its own cooldown per kind; the first round leaves `delay` seconds
 * after the call and the rest follow evenly over `duration`.
 */
export const SUPPORTS: Record<SupportKind, SupportDef> = {
  artillery: {
    kind: 'artillery',
    cooldown: 60,
    delay: 2.5,
    rounds: 6,
    duration: 3,
    spread: 160,
    weapon: 'artilleryShell',
    smokeRadius: 0,
    smokeTime: 0,
    warning: 1.5,
    launchOffset: 260,
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

  // Aircraft call-ins (job 7): each costs money (SUPPORT_COST) and flies across the field (PLANES), so anti-aircraft guns get a window.
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
};

/** In HUD order. */
export const SUPPORT_KINDS: readonly SupportKind[] = ['artillery', 'smoke', 'airStrike', 'bomber', 'fighter', 'recon'];

/** Money each call-in costs on top of its cooldown. Paid when the call is accepted. */
export const SUPPORT_COST: Record<SupportKind, number> = {
  artillery: 0,
  smoke: 0,
  airStrike: 0,
  bomber: 300,
  fighter: 180,
  recon: 100,
};

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

/** Call-ins whose rounds come down from above: hit-facing armour does not apply to them. */
export const TOP_ATTACK_SUPPORTS: readonly SupportKind[] = ['airStrike', 'bomber', 'fighter'];
