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
};

/** In HUD order. */
export const SUPPORT_KINDS: readonly SupportKind[] = ['artillery', 'smoke', 'airStrike'];
