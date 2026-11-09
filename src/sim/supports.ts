/**
 * Support call-ins: artillery barrages, smoke screens, air strikes, aircraft (bomber, fighter,
 * recon) and the Soviet Katyusha salvo (a scatter barrage like artillery, much wider and longer to
 * reload), and the anti-aircraft fire against them. Each side has its own
 * cooldown per kind. A call (validated in commands.ts) starts the cooldown and a strike: the first
 * round leaves SUPPORTS[kind].delay seconds later and the rest follow evenly over `duration`.
 * Rounds are ordinary projectiles (splash through the deferred damage queue, friendly units
 * unharmed); smoke is an ordinary cloud.
 */
import { CONFIG } from '../data/config';
import type { Side, SupportDef, SupportKind } from '../data/schema';
import { ANTI_AIR, PLANES, SUPPORTS, SUPPORT_KINDS, TOP_ATTACK_SUPPORTS, UNLIMITED_SUPPORT_COST, type PlaneDef } from '../data/supports';
import { LAUNCH, launch, spawnSmoke } from './projectiles';
import { airGrounded } from './sky';
import { KIND_ANTI_AIR, weaponIndex } from './tables';
import { spotMinefields } from './mines';
import type { UnitState } from './types';
import type { World } from './world';

export const SUPPORT_COUNT = SUPPORT_KINDS.length;
const SUPPORT_DEFS: readonly SupportDef[] = SUPPORT_KINDS.map((kind) => SUPPORTS[kind]);
const SUPPORT_WEAPON: Int32Array = Int32Array.from(SUPPORT_DEFS, (def) => weaponIndex(def.weapon));

/** World.planeState values. */
export const PLANE_NONE = 0;
/** On its run: it drops its rounds (or, a recon plane, looks) when it gets there. */
export const PLANE_FLYING = 1;
/** Driven off by anti-aircraft fire: it flies on out of the battle and drops nothing more. */
export const PLANE_BROKE_OFF = 2;

/** Per support index: its aircraft, or null for a call-in with no plane (artillery, smoke, the air strike). */
const PLANE_DEFS: readonly (PlaneDef | null)[] = SUPPORT_KINDS.map((kind) => PLANES[kind] ?? null);
/** Per support index: 1 if its rounds come down from above (aircraft, and the Typhoon air strike). */
const TOP_ATTACK: Uint8Array = Uint8Array.from(SUPPORT_KINDS, (kind) => (TOP_ATTACK_SUPPORTS.includes(kind) ? 1 : 0));

/** True if the side may call this support right now (offered by the mission, a charge left, off cooldown, battle running). */
export function canCallSupport(w: World, si: number, kind: SupportKind): boolean {
  const side = w.state.sides[si];
  return (
    !w.state.over &&
    side.supportAvailable[kind] === true &&
    side.supportCooldown[kind] <= 0 &&
    // A charge left (the player's Shop charges, no money: owner, 2026-11-09); a side without charges (-1, the AI)
    // pays its own rule's price instead.
    (side.supportCharges[kind] > 0 || (side.supportCharges[kind] < 0 && side.supplies >= UNLIMITED_SUPPORT_COST[kind])) &&
    // One aircraft of a kind per side at a time (its run may outlast a short cooldown).
    w.planeState[si * SUPPORT_COUNT + SUPPORT_KINDS.indexOf(kind)] === PLANE_NONE &&
    // No aircraft in fog or a blizzard, nor at night but for the nation's night flyers (FOUNDATIONS.md 4.7).
    airGrounded(w.state, si as Side, kind) === null
  );
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
  side.supportCooldown[kind] = side.supportCooldownFull[kind];
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

  const plane = PLANE_DEFS[k];
  if (plane !== null) {
    w.planeState[slot] = PLANE_FLYING;
    w.planeHp[slot] = plane.hp;
    w.planePassed[slot] = 0;
    w.planesUp[si]++;
    w.planesSeen[1 - si]++;
    if (passStart(def, plane) <= 0) emitPass(w, si, k);
  }
}

/** Seconds after the call at which the aircraft enters the battle. */
function passStart(def: SupportDef, plane: PlaneDef): number {
  const t = def.delay - plane.approach;
  return t > 0 ? t : 0;
}

/** Seconds after the call at which the aircraft has left the battle. */
function passEnd(def: SupportDef, plane: PlaneDef): number {
  return def.delay + (def.rounds > 0 ? def.duration : 0) + plane.exit;
}

/** Scratch: the result of planeX (a typed array, so the double is not boxed). */
const PLANE_X = new Float64Array(1);

/**
 * Where aircraft k of side si is `t` seconds after its call, in PLANE_X[0]. A bomber or fighter is
 * over the near end of its strip when its first round leaves and sweeps the strip in `duration`; a
 * plane with no rounds (recon) is over the target at `delay` and flies at its own speed.
 */
function planeX(w: World, si: number, k: number, t: number): void {
  const def = SUPPORT_DEFS[k];
  const plane = PLANE_DEFS[k];
  const dir = si === 0 ? 1 : -1;
  const x = w.strikeX[si * SUPPORT_COUNT + k];
  const sweep = def.rounds > 1 && def.duration > 0 && def.pattern === 'sweep';
  const spread = def.spread * w.mods[si].supportReach[k];
  const speed = sweep ? (2 * spread) / def.duration : plane ? plane.speed : 0;
  const ref = sweep ? x - dir * spread : x;
  PLANE_X[0] = ref + dir * speed * (t - def.delay);
}

/** The aircraft enters: one planePass event for its whole crossing. */
function emitPass(w: World, si: number, k: number): void {
  const def = SUPPORT_DEFS[k];
  const plane = PLANE_DEFS[k];
  if (!plane) return;
  w.planePassed[si * SUPPORT_COUNT + k] = 1;
  const t0 = passStart(def, plane);
  const t1 = passEnd(def, plane);
  const e = w.events.emit('planePass');
  e.side = si;
  e.support = SUPPORT_KINDS[k];
  planeX(w, si, k, t0);
  e.x = PLANE_X[0];
  planeX(w, si, k, t1);
  e.x2 = PLANE_X[0];
  e.row = plane.row;
  e.value = t1 - t0;
  e.dir = si === 0 ? 1 : -1;
}

/** The aircraft has left (or gone down): the slot is free for the next call. */
function endPlane(w: World, si: number, k: number): void {
  const slot = si * SUPPORT_COUNT + k;
  w.planeState[slot] = PLANE_NONE;
  w.planesUp[si]--;
  w.strikeTime[slot] = -1;
}

/** A recon plane over its target: enemy health shows within `spread` for `duration` seconds. */
function reveal(w: World, si: number, k: number): void {
  const def = SUPPORT_DEFS[k];
  const e = w.events.emit('reconReveal');
  e.side = si;
  e.support = SUPPORT_KINDS[k];
  e.x = w.strikeX[si * SUPPORT_COUNT + k];
  e.value = def.spread * w.mods[si].supportReach[k];
  e.x2 = def.duration * w.mods[si].supportTime[k];
  // The observer marks the minefields he flies over (FOUNDATIONS.md 4.6).
  if (w.state.minefields.length > 0) spotMinefields(w, si, e.x, e.value);
}

/** Advance aircraft k of side si to `t` seconds after its call: enter, drop its rounds or look, leave. */
function updatePlane(w: World, si: number, k: number, t: number): void {
  const slot = si * SUPPORT_COUNT + k;
  const def = SUPPORT_DEFS[k];
  const plane = PLANE_DEFS[k];
  if (!plane) return;
  if (w.planePassed[slot] === 0 && t >= passStart(def, plane) - 1e-9) emitPass(w, si, k);
  if (w.planeState[slot] === PLANE_FLYING && t >= def.delay - 1e-9) {
    if (def.rounds <= 0) {
      if (w.strikeFired[slot] === 0) {
        w.strikeFired[slot] = 1;
        reveal(w, si, k);
      }
    } else {
      const interval = def.rounds > 1 ? def.duration / (def.rounds - 1) : 0;
      while (w.strikeFired[slot] < def.rounds && t >= def.delay + w.strikeFired[slot] * interval - 1e-9) {
        if (SUPPORT_WEAPON[k] >= 0) fireRound(w, si, k, w.strikeFired[slot]);
        w.strikeFired[slot]++;
      }
    }
  }
  if (t >= passEnd(def, plane) - 1e-9) endPlane(w, si, k);
}

/** Launch round `n` of a strike in progress. */
function fireRound(w: World, si: number, k: number, n: number): void {
  const def = SUPPORT_DEFS[k];
  const s = w.state;
  const dir = si === 0 ? 1 : -1;
  const x = w.strikeX[si * SUPPORT_COUNT + k];
  const spread = def.spread * w.mods[si].supportReach[k];
  let land: number;
  if (def.pattern === 'sweep') {
    // The aircraft sweeps the strip in its own direction of flight, one rocket after another.
    land = def.rounds > 1 ? x - dir * spread + (dir * 2 * spread * n) / (def.rounds - 1) : x;
  } else {
    land = x + (w.rng.next() * 2 - 1) * spread;
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
  LAUNCH[5] = def.vehicleDamageMul;
  LAUNCH[6] = TOP_ATTACK[k];
  launch(w, si, SUPPORT_WEAPON[k], n % CONFIG.rows, -1, null, 'none');
}

/** Tick the cooldowns and every strike and aircraft in progress (both sides in one pass). */
export function updateSupports(w: World): void {
  const s = w.state;
  const dt = w.dt;
  for (let si = 0; si < 2; si++) {
    // Named stores (not cooldowns[kind]) keep the fractional seconds from being boxed every tick.
    const cd = s.sides[si].supportCooldown;
    if (cd.artillery > 0) cd.artillery = cd.artillery > dt ? cd.artillery - dt : 0;
    if (cd.smoke > 0) cd.smoke = cd.smoke > dt ? cd.smoke - dt : 0;
    if (cd.airStrike > 0) cd.airStrike = cd.airStrike > dt ? cd.airStrike - dt : 0;
    if (cd.bomber > 0) cd.bomber = cd.bomber > dt ? cd.bomber - dt : 0;
    if (cd.fighter > 0) cd.fighter = cd.fighter > dt ? cd.fighter - dt : 0;
    if (cd.recon > 0) cd.recon = cd.recon > dt ? cd.recon - dt : 0;
    if (cd.katyusha > 0) cd.katyusha = cd.katyusha > dt ? cd.katyusha - dt : 0;
    for (let k = 0; k < SUPPORT_COUNT; k++) {
      const slot = si * SUPPORT_COUNT + k;
      if (w.strikeTime[slot] < 0) continue;
      const def = SUPPORT_DEFS[k];
      const t = w.strikeTime[slot] + dt;
      w.strikeTime[slot] = t;
      if (w.strikeWarned[slot] === 0 && t >= def.delay - def.warning) announce(w, si, k, def.delay - t);
      if (PLANE_DEFS[k] !== null) {
        updatePlane(w, si, k, t);
        continue;
      }
      if (t < def.delay - 1e-9) continue;

      if (def.rounds <= 0) {
        // Smoke: one cloud at the target.
        if (def.smokeRadius > 0 && def.smokeTime > 0) spawnSmoke(w, w.strikeX[slot], def.smokeRadius * w.mods[si].supportReach[k], def.smokeTime * w.mods[si].supportTime[k], si);
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

/** A hit from anti-aircraft fire on aircraft k of side si: it breaks off when badly hurt and goes down at 0. */
function hitPlane(w: World, si: number, k: number, damage: number): void {
  const slot = si * SUPPORT_COUNT + k;
  const plane = PLANE_DEFS[k];
  if (!plane || w.planeState[slot] === PLANE_NONE) return;
  w.planeHp[slot] -= damage;
  w.state.sides[1 - si].stats.damageDealt += damage;
  if (w.planeHp[slot] <= 0) {
    const e = w.events.emit('planeDown');
    e.side = si;
    e.support = SUPPORT_KINDS[k];
    planeX(w, si, k, w.strikeTime[slot]);
    e.x = PLANE_X[0];
    e.row = plane.row;
    endPlane(w, si, k);
  } else if (w.planeState[slot] === PLANE_FLYING && w.planeHp[slot] <= plane.hp * plane.driveOffFrac) {
    w.planeState[slot] = PLANE_BROKE_OFF;
  }
}

/** Scratch of the target search in fireAntiAir: [0] x of the plane found, [1] its distance. */
const AIR = new Float64Array(2);

/** Index of the nearest enemy aircraft that has entered the battle within ANTI_AIR.range of gun u (x in AIR[0]), or -1. */
function nearestPlane(w: World, u: UnitState): number {
  const enemy = 1 - u.side;
  let best = -1;
  AIR[1] = ANTI_AIR.range;
  for (let k = 0; k < SUPPORT_COUNT; k++) {
    const slot = enemy * SUPPORT_COUNT + k;
    if (w.planeState[slot] === PLANE_NONE || w.planePassed[slot] === 0) continue;
    planeX(w, enemy, k, w.strikeTime[slot]);
    const d = PLANE_X[0] > u.x ? PLANE_X[0] - u.x : u.x - PLANE_X[0];
    if (d > AIR[1]) continue;
    AIR[1] = d;
    AIR[0] = PLANE_X[0];
    best = k;
  }
  return best;
}

/**
 * Anti-aircraft guns that are set up (standing, crew weapon deployed) fire at the nearest enemy
 * plane within reach: ANTI_AIR.burst rounds every ANTI_AIR.cooldown seconds, each a `shot` event at
 * the plane (target 'none', row2 -1). While a plane is in reach the gun holds its fire at the ground
 * (World.aaEngaged). Runs before fireUnits; draws no random number while no plane is up.
 */
export function fireAntiAir(w: World): void {
  const s = w.state;
  if (w.planesUp[0] + w.planesUp[1] === 0) {
    if (w.aaAny !== 0) {
      w.aaEngaged.fill(0);
      w.aaAny = 0;
    }
    return;
  }
  w.aaEngaged.fill(0);
  w.aaAny = 0;
  const units = s.units;
  const dt = w.dt;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || KIND_ANTI_AIR[u.kindIndex] !== 1) continue;
    if (u.aaCooldown > 0) u.aaCooldown = u.aaCooldown > dt ? u.aaCooldown - dt : 0;
    const enemy = 1 - u.side;
    if (w.planesUp[enemy] === 0 || u.velX !== 0 || u.setup > 0) continue;
    const k = nearestPlane(w, u);
    if (k < 0) continue;
    w.aaEngaged[i] = 1;
    w.aaAny = 1;
    if (u.aaCooldown > 0) continue;
    u.aaCooldown = ANTI_AIR.cooldown;
    const px = AIR[0];
    for (let b = 0; b < ANTI_AIR.burst; b++) {
      if (w.planeState[enemy * SUPPORT_COUNT + k] === PLANE_NONE) break;
      const hit = w.rng.next() < ANTI_AIR.accuracy * u.accuracy;
      const e = w.events.emit('shot');
      e.side = u.side;
      e.source = 'unit';
      e.unit = u.index;
      e.unitId = u.id;
      e.kind = u.kind;
      e.weapon = u.def.weapon;
      e.x = u.x;
      e.row = u.row;
      e.x2 = px;
      e.row2 = -1;
      e.target = 'none';
      e.hit = hit;
      e.dir = px >= u.x ? 1 : -1;
      if (hit) hitPlane(w, enemy, k, ANTI_AIR.damage * w.mods[u.side].unitDamage[u.kindIndex]);
    }
  }
}
