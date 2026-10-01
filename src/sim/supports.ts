/**
 * Support call-ins: artillery barrages, smoke screens and air strikes. Each side has its own
 * cooldown per kind. A call (validated in commands.ts) starts the cooldown and a strike: the first
 * round leaves SUPPORTS[kind].delay seconds later and the rest follow evenly over `duration`.
 * Rounds are ordinary projectiles (splash through the deferred damage queue, friendly units
 * unharmed); smoke is an ordinary cloud.
 */
import { CONFIG } from '../data/config';
import type { SupportDef, SupportKind } from '../data/schema';
import { SUPPORTS, SUPPORT_KINDS } from '../data/supports';
import { LAUNCH, launch, spawnSmoke } from './projectiles';
import { weaponIndex } from './tables';
import type { World } from './world';

export const SUPPORT_COUNT = SUPPORT_KINDS.length;
const SUPPORT_DEFS: readonly SupportDef[] = SUPPORT_KINDS.map((kind) => SUPPORTS[kind]);
const SUPPORT_WEAPON: Int32Array = Int32Array.from(SUPPORT_DEFS, (def) => weaponIndex(def.weapon));

/** True if the side may call this support right now (offered by the mission, off cooldown, battle running). */
export function canCallSupport(w: World, si: number, kind: SupportKind): boolean {
  const side = w.state.sides[si];
  return !w.state.over && side.supportAvailable[kind] === true && side.supportCooldown[kind] <= 0;
}

/** Announce that the rounds of strike `slot` arrive in `lead` seconds. */
function announce(w: World, si: number, k: number, lead: number): void {
  w.strikeWarned[si * SUPPORT_COUNT + k] = 1;
  const e = w.events.emit('supportIncoming');
  e.side = si;
  e.support = SUPPORT_KINDS[k];
  e.x = w.strikeX[si * SUPPORT_COUNT + k];
  e.value = lead > 0 ? lead : 0;
  e.dir = si === 0 ? 1 : -1;
}

/**
 * Call support `kind` for side `si` at world x. The caller has checked canCallSupport. The x is
 * clamped to the map. Starts the cooldown and the strike, and emits supportCalled.
 */
export function callSupport(w: World, si: number, kind: SupportKind, x: number): void {
  const s = w.state;
  const side = s.sides[si];
  const def = SUPPORTS[kind];
  const k = SUPPORT_KINDS.indexOf(kind);
  const slot = si * SUPPORT_COUNT + k;
  const tx = x < 0 ? 0 : x > s.length ? s.length : x;
  side.supportCooldown[kind] = def.cooldown;
  w.strikeTime[slot] = 0;
  w.strikeX[slot] = tx;
  w.strikeFired[slot] = 0;
  w.strikeWarned[slot] = 0;

  const e = w.events.emit('supportCalled');
  e.side = si;
  e.support = kind;
  e.x = tx;
  e.value = def.delay;
  e.dir = si === 0 ? 1 : -1;
  if (def.warning >= def.delay) announce(w, si, k, def.delay);
}

/** Launch round `n` of a strike in progress. */
function fireRound(w: World, si: number, k: number, n: number): void {
  const def = SUPPORT_DEFS[k];
  const s = w.state;
  const dir = si === 0 ? 1 : -1;
  const x = w.strikeX[si * SUPPORT_COUNT + k];
  let land: number;
  if (def.pattern === 'sweep') {
    // The aircraft sweeps the strip in its own direction of flight, one rocket after another.
    land = def.rounds > 1 ? x - dir * def.spread + (dir * 2 * def.spread * n) / (def.rounds - 1) : x;
  } else {
    land = x + (w.rng.next() * 2 - 1) * def.spread;
  }
  if (land < 0) land = 0;
  else if (land > s.length) land = s.length;
  let from = land - dir * def.launchOffset;
  if (from < 0) from = 0;
  else if (from > s.length) from = s.length;
  LAUNCH[0] = from;
  LAUNCH[1] = land;
  LAUNCH[2] = 1;
  LAUNCH[3] = 0;
  LAUNCH[4] = def.hqDamageMul;
  launch(w, si, SUPPORT_WEAPON[k], n % CONFIG.rows, -1, null, 'none');
}

/** Tick the cooldowns and every strike in progress (both sides in one pass). */
export function updateSupports(w: World): void {
  const s = w.state;
  const dt = w.dt;
  for (let si = 0; si < 2; si++) {
    const cooldowns = s.sides[si].supportCooldown;
    for (let k = 0; k < SUPPORT_COUNT; k++) {
      const kind = SUPPORT_KINDS[k];
      const left = cooldowns[kind];
      if (left > 0) cooldowns[kind] = left > dt ? left - dt : 0;

      const slot = si * SUPPORT_COUNT + k;
      if (w.strikeTime[slot] < 0) continue;
      const def = SUPPORT_DEFS[k];
      const t = w.strikeTime[slot] + dt;
      w.strikeTime[slot] = t;
      if (w.strikeWarned[slot] === 0 && t >= def.delay - def.warning) announce(w, si, k, def.delay - t);
      if (t < def.delay - 1e-9) continue;

      if (def.rounds <= 0) {
        // Smoke: one cloud at the target.
        if (def.smokeRadius > 0 && def.smokeTime > 0) spawnSmoke(w, w.strikeX[slot], def.smokeRadius, def.smokeTime, si);
        w.strikeTime[slot] = -1;
        continue;
      }
      const interval = def.rounds > 1 ? def.duration / (def.rounds - 1) : 0;
      while (w.strikeFired[slot] < def.rounds && t >= def.delay + w.strikeFired[slot] * interval - 1e-9) {
        if (SUPPORT_WEAPON[k] >= 0) fireRound(w, si, k, w.strikeFired[slot]);
        w.strikeFired[slot]++;
      }
      if (w.strikeFired[slot] >= def.rounds) w.strikeTime[slot] = -1;
    }
  }
}
