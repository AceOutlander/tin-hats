/**
 * Tank rig layout. Pure maths, no canvas: turns a tank's animation state into
 * part transforms the renderer applies to the sprites from ./tanks.
 *
 * Tank space: origin on the ground under the hull centre, +x forward (the
 * tank is drawn facing right), -y up. For a tank facing left the renderer
 * negates every x and every rotation.
 *
 * Draw order, back to front: track, wheels (in array order), hull, barrel, turret.
 */
import { TANK_LAYOUT, TANK_LOOKS, TANK_MAX_WHEELS, VEHICLE_LOOK_EXTRA, VEHICLE_LOOKS, type ArtPoint, type TankLook, type VehicleLook } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import type { FactionId, UnitKind } from '../../data/schema';
import { makeBelt } from './belt';

export interface TankState {
  look: VehicleLook;
  /** Distance travelled along the ground in wu (signed: forward is positive). */
  distance: number;
  /** Gun elevation in radians, positive = up. Clamped to the look's limits. */
  turretAim: number;
  /** 0 = barrel run out, 1 = fully recoiled. */
  recoil: number;
  /** -1..1, hull pitch on its suspension as a fraction of the look's rockMax; positive lifts the nose. */
  hullRock: number;
  /** Extra gun length (wu) of the long-gun upgrade (tankGearKeys().gunExtra); default 0. */
  gunExtra?: number;
}

/** Where to put a sprite's origin, and its rotation in radians (clockwise on screen). */
export interface PartXf {
  x: number;
  y: number;
  rot: number;
}

export interface TankPose {
  /** Static on the ground; `trackFrame` picks which tread phase sprite to show. */
  track: PartXf;
  trackFrame: number;
  /** One entry per wheel of the look, in draw order; only the first `wheelCount` are valid. */
  wheels: PartXf[];
  wheelCount: number;
  hull: PartXf;
  barrel: PartXf;
  turret: PartXf;
  /** APC passengers sprite (rides the hull; unused for tanks). */
  passengers: PartXf;
  /** Muzzle tip (flash, shell spawn), exhaust outlet (smoke puffs) and hull machine gun. */
  muzzle: ArtPoint;
  exhaust: ArtPoint;
  hullMg: ArtPoint;
}

export interface TankKeys {
  hull: string;
  turret: string;
  barrel: string;
  /** One key per tread phase: index with TankPose.trackFrame. */
  track: string[];
  /** One key per wheel, parallel to TankPose.wheels. */
  wheels: string[];
  husk: string;
  /** APC passengers over the side (null for tanks). */
  passengers: string | null;
}

/** Wheel sprite key: one per kind, plus one per extra radius of that kind (the half-track's big front wheel). */
function wheelKey(look: VehicleLook, i: number): string {
  const wheels = TANK_LAYOUT[look].wheels;
  const w = wheels[i];
  const first = wheels.find((o) => o.kind === w.kind);
  return first && first.r !== w.r ? `veh/${look}/wheel/${w.kind}/${w.r}` : `veh/${look}/wheel/${w.kind}`;
}

function buildKeys(look: VehicleLook): TankKeys {
  const L = TANK_LAYOUT[look];
  const track: string[] = [];
  for (let i = 0; i < L.trackFrames; i++) track.push(`veh/${look}/track/${i}`);
  return {
    hull: `veh/${look}/hull`,
    turret: `veh/${look}/turret`,
    barrel: `veh/${look}/barrel`,
    track,
    wheels: L.wheels.map((_, i) => wheelKey(look, i)),
    husk: `veh/${look}/husk`,
    passengers: L.passengers ? `veh/${look}/passengers` : null,
  };
}

function buildPitch(look: VehicleLook): number {
  const L = TANK_LAYOUT[look];
  const length = makeBelt(L.belt, L.trackThickness / 2).length;
  return length / Math.max(1, Math.round(length / L.trackPitch));
}

function perLook<T>(make: (look: VehicleLook) => T): Record<VehicleLook, T> {
  const out = {} as Record<VehicleLook, T>;
  for (const look of VEHICLE_LOOKS) out[look] = make(look);
  return out;
}

/** Sprite keys of every part of each vehicle look. */
export const TANK_KEYS: Record<VehicleLook, TankKeys> = perLook(buildKeys);

/** Real distance between tread lugs: the nominal pitch adjusted so a whole number fits round the loop. */
export const TANK_TRACK_PITCH: Record<VehicleLook, number> = perLook(buildPitch);

const TAU = Math.PI * 2;

/** Allocate a pose once per tank view; layoutTank() only ever writes into it. */
export function createTankPose(): TankPose {
  const wheels: PartXf[] = [];
  for (let i = 0; i < TANK_MAX_WHEELS; i++) wheels.push({ x: 0, y: 0, rot: 0 });
  return {
    track: { x: 0, y: 0, rot: 0 },
    trackFrame: 0,
    wheels,
    wheelCount: 0,
    hull: { x: 0, y: 0, rot: 0 },
    barrel: { x: 0, y: 0, rot: 0 },
    turret: { x: 0, y: 0, rot: 0 },
    passengers: { x: 0, y: 0, rot: 0 },
    muzzle: { x: 0, y: 0 },
    exhaust: { x: 0, y: 0 },
    hullMg: { x: 0, y: 0 },
  };
}

/**
 * Fill `out` for the given state. Allocates nothing.
 *
 * Wheels and track stay on the ground and turn with the distance travelled
 * (rolling without slipping: angle = distance / radius). The hull pitches
 * about its rock pivot and carries the turret, gun, exhaust and hull MG with it.
 */
export function layoutTank(state: TankState, out: TankPose): TankPose {
  const L = TANK_LAYOUT[state.look];
  const distance = state.distance;

  // Running gear.
  const wheels = L.wheels;
  const count = wheels.length;
  for (let i = 0; i < count; i++) {
    const def = wheels[i];
    const xf = out.wheels[i];
    xf.x = def.x;
    xf.y = def.y;
    xf.rot = (distance / def.r) % TAU;
  }
  out.wheelCount = count;
  out.track.x = 0;
  out.track.y = 0;
  out.track.rot = 0;
  let phase = distance / TANK_TRACK_PITCH[state.look];
  phase -= Math.floor(phase);
  out.trackFrame = Math.min(L.trackFrames - 1, Math.floor(phase * L.trackFrames));

  // Hull pitch: canvas rotation is clockwise, so nose-up is negative.
  const rock = Math.max(-1, Math.min(1, state.hullRock)) * L.rockMax;
  const rot = -rock;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const px = L.rockPivot.x;
  const py = L.rockPivot.y;
  out.hull.x = px;
  out.hull.y = py;
  out.hull.rot = rot;

  let vx = L.turretRing.x - px;
  let vy = L.turretRing.y - py;
  out.turret.x = px + vx * cos - vy * sin;
  out.turret.y = py + vx * sin + vy * cos;
  out.turret.rot = rot;

  const pass = L.passengers;
  if (pass) {
    vx = pass.at.x - px;
    vy = pass.at.y - py;
    out.passengers.x = px + vx * cos - vy * sin;
    out.passengers.y = py + vx * sin + vy * cos;
    out.passengers.rot = rot;
  }

  vx = L.exhaust.x - px;
  vy = L.exhaust.y - py;
  out.exhaust.x = px + vx * cos - vy * sin;
  out.exhaust.y = py + vx * sin + vy * cos;

  vx = L.hullMg.x - px;
  vy = L.hullMg.y - py;
  out.hullMg.x = px + vx * cos - vy * sin;
  out.hullMg.y = py + vx * sin + vy * cos;

  // Gun: elevates about the trunnion and slides back along its own axis on recoil.
  const elev = Math.max(L.elevMin, Math.min(L.elevMax, state.turretAim));
  const gunRot = rot - elev;
  const gcos = Math.cos(gunRot);
  const gsin = Math.sin(gunRot);
  const slide = Math.max(0, Math.min(1, state.recoil)) * L.recoilDist;
  vx = L.trunnion.x - px;
  vy = L.trunnion.y - py;
  const tx = px + vx * cos - vy * sin;
  const ty = py + vx * sin + vy * cos;
  out.barrel.x = tx - gcos * slide;
  out.barrel.y = ty - gsin * slide;
  out.barrel.rot = gunRot;
  const len = L.barrelLength + (state.gunExtra ?? 0);
  out.muzzle.x = out.barrel.x + gcos * len;
  out.muzzle.y = out.barrel.y + gsin * len;
  return out;
}

/** Every tank look, for iterating. */
export { TANK_LOOKS, VEHICLE_LOOKS };

/** The look a vehicle kind of a faction draws with. */
export function vehicleLookOf(kind: UnitKind, faction: FactionId): VehicleLook {
  if (kind === 'heavyTank') return FACTIONS[faction].look.heavyTank;
  if (kind === 'apc' || kind === 'lightTank') return VEHICLE_LOOK_EXTRA[faction][kind];
  return FACTIONS[faction].look.tank;
}

/** True for the looks that carry Quartermaster upgrade gear (tankGearKeys / tankGearSpecs take only these). */
export function isGearLook(look: VehicleLook): look is TankLook {
  return (TANK_LOOKS as readonly string[]).includes(look);
}
