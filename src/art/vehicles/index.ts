/**
 * Vehicle art: tank rigs (Churchill, Panzer IV, King Tiger, the Soviet T-34, KV-1 and T-60, light tanks and APCs), the
 * call-in aircraft, the air strike aircraft with its ordnance, and the Katyusha launcher truck. Keys are namespaced
 * "veh/...". (The supply trucks are per-battle supply looks: ../props/supplyLooks.)
 */
import { katyushaLauncherSpec } from '../props/supplyLooks';
import type { SpriteSpec } from '../types';
import { aircraftSpecs } from './aircraft';
import { planeSpecs } from './planes';
import { tankSpecs } from './tanks';

export { AIR_KEYS, airStrikeKey, aircraftSpecs } from './aircraft';
export { KATYUSHA_LAUNCHER_KEY } from '../props/supplyLooks';
export {
  TANK_KEYS,
  TANK_LOOKS,
  VEHICLE_LOOKS,
  isGearLook,
  vehicleLookOf,
  rigOf,
  hullOf,
  TANK_TRACK_PITCH,
  createTankPose,
  layoutTank,
  type PartXf,
  type TankKeys,
  type TankPose,
  type TankState,
} from './tankLayout';
export { tankGearKeys, tankGearSpecs, type TankGearKeys } from './tankGear';
export { KV2_KEYS, tankSpecs } from './tanks';
export { PLANE_KINDS, aircraftLookKey, planeGearKey, planeGearSpecs, planeKey, planeShadowKey, planeSpecs } from './planes';

/** Every vehicle sprite. */
export function vehicleSpecs(): SpriteSpec[] {
  return [...tankSpecs(), ...aircraftSpecs(), ...planeSpecs(), katyushaLauncherSpec()];
}
