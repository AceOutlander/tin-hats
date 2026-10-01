import type { SupportDef, SupportKind } from './schema';

/** Support call-ins. Simulated from Phase 2; the numbers are first-pass. */
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
  },
};

/** In HUD order. */
export const SUPPORT_KINDS: readonly SupportKind[] = ['artillery', 'smoke', 'airStrike'];
