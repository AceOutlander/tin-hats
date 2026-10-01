/**
 * Event dispatch table for battlefield effects: one handler per sim event
 * type. The renderer calls EFFECT_HANDLERS[event.type] for every event of
 * every step while effects are enabled (they are off while fast-forwarding).
 *
 * Bookkeeping that must happen even with effects off (deaths, firing poses,
 * flinches, gun-slit flashes, ruined headquarters) is done by the view before
 * this table runs. Handlers must not allocate: use the scratch points on the
 * context.
 */
import { HQ_LAYOUT, TANK_LAYOUT } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import { FX_TRACERS } from '../../data/fx';
import { RENDER } from '../../data/render';
import { ORDER_WHISTLE } from '../../data/sounds';
import { SUPPORTS } from '../../data/supports';
import { VIEW } from '../../data/view';
import { WEAPONS } from '../../data/weapons';
import { shakeStrength } from '../../fx';
import type { SimEvent, SimEventType } from '../../sim';
import type { FlightArc } from './flights';
import type { EffectContext } from './index';
import { PRESET_DEFS } from './presets';

export type EffectHandler = (fx: EffectContext, e: SimEvent) => void;

const SH = RENDER.shots;
const R = RENDER.fx;
const AU = RENDER.audio;
const X = R.explosion;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Size of the muzzle blast for weapons that fire a shell or rocket (1 = a tank gun). */
const MUZZLE_SIZE: Readonly<Record<string, number>> = { tankGun: 1, heavyGun: 1.35, rocket: 0.6, mortar: 0.55, airRocket: 0.6, artilleryShell: 1.2 };

function dirOf(side: number): number {
  return side === 0 ? 1 : -1;
}

function arcOf(look: string, delivery: string): FlightArc {
  return look === 'bomb' ? 'drop' : delivery === 'lob' ? 'lob' : 'direct';
}

/** Scratch for launchDir (one at a time, never kept). */
const LAUNCH = { x: 0, y: 0 };

/**
 * Which way a launch flash points: a lobbed round (a mortar) blasts out along the tube, up and forward,
 * not level toward where it will land; anything else points from (dx, dy).
 */
function launchDir(fx: EffectContext, e: SimEvent, lob: boolean, dx: number, dy: number): { x: number; y: number } {
  LAUNCH.x = dx;
  LAUNCH.y = dy;
  if (lob && e.source === 'unit') {
    const v = fx.units.liveView(e.unit, e.unitId);
    if (v && v.shown) v.muzzleDir(LAUNCH);
  }
  return LAUNCH;
}

/* ------------------------------------------------------------------ */
/* Blasts                                                              */
/* ------------------------------------------------------------------ */

/**
 * A full explosion suite at ground x: fireball, dirt fountain, smoke, flash, crater or scorch decal,
 * screen shake and sound, sized by blast radius (wu). Off screen it only shakes and sounds.
 */
export function blast(fx: EffectContext, x: number, radius: number, ground: number): void {
  const small = radius <= X.smallMax;
  const medium = !small && radius <= X.mediumMax;
  const preset = small ? 'grenadeBurst' : medium ? 'shellExplosion' : 'bigExplosion';
  const ref = small ? X.refRadius.small : medium ? X.refRadius.medium : X.refRadius.big;
  const size = clamp(radius / ref, X.sizeMin, X.sizeMax);
  fx.sound.at(small ? 'grenadeExplosion' : medium ? 'explosionMedium' : 'explosionLarge', x);
  if (!fx.onScreen(x - radius, x + radius)) {
    const def = PRESET_DEFS[preset];
    if (def.shake) fx.shake.add(def.shake, shakeStrength(x, fx.camLeft, fx.camRight - fx.camLeft));
    return;
  }
  fx.play(preset, x, ground, 1, 0, ground, size);
  if (fx.night > 0.15) fx.play('flashGlow', x, ground - 26 * size, 1, 0, ground, 2.6 * size);
  if (!small) {
    const S = X.secondary;
    for (let i = 0; i < S.count; i++) {
      const dx = (fx.rng() * 2 - 1) * radius * S.spread;
      fx.ambient.delayed.add('grenadeBurst', S.stagger * (i + 1) + fx.rng() * 0.05, x + dx, ground, 1, 0, ground, 0.7 + fx.rng() * 0.3);
    }
  }
}

/** The blast of a provisional flight that has landed at ground line y: sized by the weapon's splash. */
export function explodeAt(fx: EffectContext, x: number, y: number, weaponId: string): void {
  const w = WEAPONS[weaponId] as (typeof WEAPONS)[string] | undefined;
  blast(fx, x, w && w.splashRadius > 0 ? w.splashRadius : X.smallMax, y);
}

/** A headquarters falls: a chain of blasts along the bunker, a wall of dust and debris, long smoke. */
function collapseHq(fx: EffectContext, side: number): void {
  const st = fx.state;
  if (!st) return;
  const hq = st.sides[side].hq;
  if (!hq || fx.ruinedAt[side] >= 0) return;
  fx.ruinedAt[side] = fx.time;
  const H = R.hq;
  const g = fx.groundY(-1);
  const half = (HQ_LAYOUT[st.sides[side].faction].bodyW / 2) * H.collapseSpread;
  fx.sound.at('explosionLarge', hq.x);
  if (!fx.onScreen(hq.x - half, hq.x + half)) return;
  fx.play('hqCollapse', hq.x, g - 24, 1, 0, g, 1);
  for (let i = 0; i < H.collapseBlasts; i++) {
    const x = hq.x + (fx.rng() * 2 - 1) * half;
    const y = g - 14 - fx.rng() * 50;
    fx.ambient.delayed.add(i % 2 === 0 ? 'bigExplosion' : 'shellExplosion', i * H.collapseStagger, x, y, 1, 0, g, 0.8 + fx.rng() * 0.3);
  }
}

/* ------------------------------------------------------------------ */
/* Shots and projectiles                                               */
/* ------------------------------------------------------------------ */

/** A round fired: muzzle flash, tracer, ejected case, and the hit or dirt that lands when the tracer does. */
function onShot(fx: EffectContext, e: SimEvent): void {
  const weapon = e.weapon ? (WEAPONS[e.weapon] as (typeof WEAPONS)[string] | undefined) : undefined;
  if (weapon) fx.sound.at(weapon.sound, e.x, e.side === fx.playerSide ? 1 : AU.enemyVolume);
  if (!fx.onScreen(e.x, e.x2)) return;
  const from = fx.p0;
  const to = fx.p1;
  fx.shotOrigin(e, from);
  fx.shotTarget(e, to);
  const dir = e.dir === 0 ? (to.x >= from.x ? 1 : -1) : e.dir;
  const gy = fx.groundY(e.row);
  const gy2 = fx.groundY(e.row2);
  const hitscan = !weapon || weapon.delivery === 'hitscan';
  // A shooter hidden behind a tank on a nearer row: no flash on top of the tank, and the round appears at its edge.
  const edge = e.source === 'unit' ? fx.units.coverEdge(from.x, from.y, e.row, dir, e.unit) : NaN;
  const hidden = !Number.isNaN(edge);
  if (hidden) from.x = edge;

  if (hitscan) {
    if (!hidden) {
      fx.play('muzzleFlash', from.x, from.y, to.x - from.x, to.y - from.y, gy, 1);
      if (fx.night > 0.15) fx.play('flashGlow', from.x + dir * 8, from.y, 1, 0, gy, 1);
    }
    if (!hidden && e.source === 'unit' && fx.rng() < (R.casing[weapon?.id ?? ''] ?? R.casingDefault) && fx.lowOk()) {
      fx.play('casing', from.x - dir * 3, from.y + 4, dir, 0, gy, VIEW.rowScale[Math.max(0, e.row)]);
    }
  } else if (weapon) {
    const size = MUZZLE_SIZE[weapon.id] ?? 1;
    if (!hidden && weapon.projectileLook !== 'grenade') {
      const d = launchDir(fx, e, weapon.delivery === 'lob', to.x - from.x, to.y - from.y);
      fx.play('tankMuzzle', from.x, from.y, d.x, d.y, gy, size);
    }
    if (!hidden && fx.night > 0.15) fx.play('flashGlow', from.x + dir * 14, from.y, 1, 0, gy, 2.2 * size);
    if (e.source === 'unit' && (weapon.id === 'tankGun' || weapon.id === 'heavyGun') && fx.lowOk()) {
      fx.play('shellCasing', from.x - dir * 58, from.y + 22, -dir, 0, gy, 1);
    }
    if (weapon.projectileLook !== 'none' && !fx.flights.has(fx.stepId, weapon.id, e.x)) {
      const faction = fx.state ? fx.state.sides[e.side === 1 ? 1 : 0].faction : 'british';
      const dist = Math.abs(to.x - from.x);
      const dur = clamp(dist / Math.max(1, weapon.projectileSpeed), R.flight.provisionalMin, R.flight.provisionalMax);
      fx.flights.spawn(weapon.projectileLook, faction, arcOf(weapon.projectileLook, weapon.delivery), from.x, from.y, to.x, gy2, dur, weapon.id, fx.stepId, true);
    }
    return;
  }

  if (weapon && weapon.tracer !== 'none' && FX_TRACERS[weapon.tracer] && fx.keepTracer()) {
    fx.tracers.spawn(weapon.tracer, from.x, from.y, to.x, to.y);
  }
  // The hit or the dirt shows when the tracer gets there.
  const speed = weapon && weapon.tracer !== 'none' ? FX_TRACERS[weapon.tracer].speed : 2600;
  const delay = Math.min(R.impactMaxDelay, Math.hypot(to.x - from.x, to.y - from.y) / speed);
  if (e.hit) {
    if (e.target === 'unit') {
      const v = fx.units.viewAtSlot(e.targetIndex);
      const armoured = v !== null && (v.kind === 'tank' || v.kind === 'heavyTank');
      if (armoured) {
        fx.ambient.delayed.add('armourSparks', delay, to.x, to.y, -dir, -0.2, gy2, 1);
        if (fx.rng() < AU.impactChance) fx.sound.at('ricochet', to.x, AU.impactVolume);
      } else {
        fx.ambient.delayed.add('hitPuff', delay, to.x, to.y, dir, 0, gy2, 1);
      }
    } else {
      fx.ambient.delayed.add('concreteHit', delay, to.x, to.y, -dir, -0.3, gy2, 1);
      if (fx.rng() < AU.impactChance) fx.sound.at('ricochet', to.x, AU.impactVolume);
    }
  } else {
    fx.ambient.delayed.add('bulletDirt', delay, to.x, to.y, dir, 0, to.y, 1);
    if (fx.rng() < AU.impactChance) fx.sound.at('dirtHit', to.x, AU.impactVolume);
  }
}

/** A shell, rocket, grenade or bomb leaves its launcher (phase 2 events): launch effects and a sprite on its arc. */
function onProjectile(fx: EffectContext, e: SimEvent): void {
  const weapon = e.weapon ? (WEAPONS[e.weapon] as (typeof WEAPONS)[string] | undefined) : undefined;
  if (!weapon || weapon.projectileLook === 'none') return;
  const dupe = fx.flights.has(fx.stepId, weapon.id, e.x);
  if (dupe) fx.flights.cancelProvisional(fx.stepId, weapon.id, e.x);
  else fx.sound.at(weapon.sound, e.x, e.side === fx.playerSide ? 1 : AU.enemyVolume);
  if (!fx.onScreen(e.x, e.x2)) return;
  const from = fx.p0;
  const g = fx.groundY(e.row >= 0 ? e.row : -1);
  const air = weapon.projectileLook === 'bomb';
  const dir = e.x2 >= e.x ? 1 : -1;
  from.x = e.x;
  from.y = air ? g - R.flight.airAltitude : g - SH.muzzleY * VIEW.rowScale[e.row >= 0 ? e.row : 1];
  let hidden = false;
  if (!air && e.source === 'unit') {
    const v = fx.units.liveView(e.unit, e.unitId);
    if (v && v.shown) v.muzzle(from);
    const edge = fx.units.coverEdge(from.x, from.y, e.row, dir, e.unit);
    hidden = !Number.isNaN(edge);
    if (hidden) from.x = edge;
  }
  if (!dupe && !air && !hidden && weapon.projectileLook !== 'grenade') {
    const d = launchDir(fx, e, weapon.delivery === 'lob', dir, 0);
    fx.play('tankMuzzle', from.x, from.y, d.x, d.y, g, MUZZLE_SIZE[weapon.id] ?? 1);
    if (fx.night > 0.15) fx.play('flashGlow', from.x + dir * 14, from.y, 1, 0, g, 2.2);
  }
  const faction = fx.state ? fx.state.sides[e.side === 1 ? 1 : 0].faction : 'british';
  const dist = Math.abs(e.x2 - from.x);
  const dur = e.value > 0 ? e.value : dist / Math.max(1, weapon.projectileSpeed);
  fx.flights.spawn(weapon.projectileLook, faction, arcOf(weapon.projectileLook, weapon.delivery), from.x, from.y, e.x2, fx.groundY(e.row2 >= 0 ? e.row2 : -1), dur, weapon.id, fx.stepId, false);
}

function onExplosion(fx: EffectContext, e: SimEvent): void {
  blast(fx, e.x, e.value > 0 ? e.value : X.smallMax, fx.groundY(e.row >= 0 ? e.row : -1) + (fx.rng() - 0.5) * 12);
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

/** A soldier went down: dust where he fell. A tank blows up and burns. */
function onUnitDied(fx: EffectContext, e: SimEvent): void {
  if (!fx.onScreen(e.x, e.x)) return;
  const row = e.row >= 0 ? e.row : 1;
  const gy = fx.groundY(row);
  const dir = e.dir === 0 ? 1 : e.dir;
  if (e.kind === 'tank' || e.kind === 'heavyTank') {
    const v = fx.units.findById(e.unitId);
    const faction = e.side === 1 ? 'german' : 'british';
    const look = e.kind === 'heavyTank' ? FACTIONS[v ? v.faction : faction].look.heavyTank : FACTIONS[v ? v.faction : faction].look.tank;
    const L = TANK_LAYOUT[look];
    const x = v ? v.x : e.x;
    blast(fx, x, e.kind === 'heavyTank' ? 120 : 88, gy);
    const s = VIEW.rowScale[row];
    fx.ambient.burners.add('tankFire', x - dir * 8 * s, gy - L.height * 0.55 * s, s * R.husk.fireSize, R.husk.fireTime);
    fx.ambient.burners.add('hqSmoke', x - dir * 10 * s, gy - L.height * 0.6 * s, s, R.husk.smokeTime);
    return;
  }
  const s = VIEW.rowScale[row];
  fx.play('hitPuff', e.x, gy - SH.aimY * s, dir, 0, gy, s);
  if (fx.lowOk()) fx.play('deathDust', e.x, gy, dir, 0, gy, s);
}

/** Training finished: a puff in the doorway and the ping for the player's side. */
function onTrainDone(fx: EffectContext, e: SimEvent): void {
  const hq = fx.state?.sides[e.side === 1 ? 1 : 0].hq;
  if (!hq) return;
  if (e.side === fx.playerSide) fx.sound.at('unitTrained', hq.doorX);
  if (fx.onScreen(hq.doorX, hq.doorX)) fx.play('trainPuff', hq.doorX, fx.groundY(-1) - R.door.puffY, 0, -1, fx.groundY(-1), 1);
}

/** A sapper reached the door with supplies: a pop of sparks, and "+N" floating up for the player's side. */
function onSupplyDelivered(fx: EffectContext, e: SimEvent): void {
  const hq = fx.state?.sides[e.side === 1 ? 1 : 0].hq;
  const x = hq ? hq.doorX : e.x;
  const own = e.side === fx.playerSide;
  if (own) fx.sound.at('suppliesDelivered', x);
  if (!fx.onScreen(x, x)) return;
  const g = fx.groundY(-1);
  fx.play('supplyPop', x, g - R.door.supplyY, 0, -1, g, 1);
  if (own || !R.floater.ownSideOnly) fx.floaters.add(x, g - R.floater.y, e.value);
}

function onAirdrop(fx: EffectContext, e: SimEvent): void {
  const hq = fx.state?.sides[e.side === 1 ? 1 : 0].hq;
  fx.sky.airdrop(e.x > 0 ? e.x : hq ? hq.doorX : 0, e.side, e.value);
}

/* ------------------------------------------------------------------ */
/* Structures                                                          */
/* ------------------------------------------------------------------ */

function onStructureDestroyed(fx: EffectContext, e: SimEvent): void {
  const g = fx.groundY(-1);
  if (e.target === 'hq') {
    collapseHq(fx, e.targetIndex);
    return;
  }
  if (e.target !== 'pillbox') return;
  fx.sound.at('explosionMedium', e.x);
  if (!fx.onScreen(e.x - 80, e.x + 80)) return;
  fx.play('pillboxDebris', e.x, g - 28, 1, 0, g, 1);
  blast(fx, e.x, 80, g);
}

function onWireDestroyed(fx: EffectContext, e: SimEvent): void {
  if (!fx.onScreen(e.x, e.x)) return;
  const g = fx.groundY(-1);
  fx.play('wireSnap', e.x, g - 8, 0, -1, g, 1);
}

function onSmokeSpawned(fx: EffectContext, e: SimEvent): void {
  if (!fx.onScreen(e.x - e.value, e.x + e.value)) return;
  const g = fx.groundY(-1);
  fx.play('smokeBurst', e.x, g - 14, 0, -1, g, clamp(e.value / R.smokeScreen.refRadius, 0.7, 1.6));
}

/* ------------------------------------------------------------------ */
/* Orders and call-ins                                                 */
/* ------------------------------------------------------------------ */

/** The player's order changed: the whistle, and a chevron that drops onto the hold line (or the HQ door for Fall Back). */
function onOrderChanged(fx: EffectContext, e: SimEvent): void {
  if (e.side !== fx.playerSide || !e.order || !fx.state) return;
  fx.sound.global(ORDER_WHISTLE[e.order]);
  const s = fx.state.sides[e.side === 1 ? 1 : 0];
  const x = e.order === 'fallBack' && s.hq ? s.hq.doorX : s.holdLineX;
  if (fx.onScreen(x, x)) fx.orderMarkers.add(e.order, x, fx.groundY(-1));
}

/** A call-in is on its way (or was just called): a circle where it will land, and the aircraft for an air strike. */
function onSupport(fx: EffectContext, e: SimEvent): void {
  if (!e.support) return;
  const def = SUPPORTS[e.support];
  const delay = e.value > 0 ? e.value : def.delay;
  const half = e.support === 'smoke' ? def.smokeRadius : def.spread;
  const own = e.side === fx.playerSide;
  if (half > 0) fx.targetMarkers.add(e.x, half, delay + def.duration * 0.6, own ? 0.9 : 0.45);
  if (e.support === 'airStrike') fx.sky.airStrike(e.x, dirOf(e.side), delay);
}

function onBattleEnded(fx: EffectContext, e: SimEvent): void {
  const st = fx.state;
  if (!st || e.side < 0) return;
  for (let side = 0; side < 2; side++) {
    if (side === e.side) continue;
    const hq = st.sides[side].hq;
    if (hq && fx.ruinedAt[side] < 0) collapseHq(fx, side);
  }
}

/** Every effect handler by event type. Extend this table; leave types out to ignore them. */
export const EFFECT_HANDLERS: Partial<Record<SimEventType, EffectHandler>> = {
  shot: onShot,
  projectile: onProjectile,
  explosion: onExplosion,
  unitDied: onUnitDied,
  trainDone: onTrainDone,
  supplyDelivered: onSupplyDelivered,
  airdrop: onAirdrop,
  structureDestroyed: onStructureDestroyed,
  wireDestroyed: onWireDestroyed,
  smokeSpawned: onSmokeSpawned,
  orderChanged: onOrderChanged,
  supportCalled: onSupport,
  supportIncoming: onSupport,
  battleEnded: onBattleEnded,
};
