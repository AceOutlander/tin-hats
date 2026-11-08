/**
 * Vehicle art: tank rigs (Churchill, Panzer IV, King Tiger) and the air
 * strike aircraft with its ordnance. Keys are namespaced "veh/...".
 */
import type { SpriteSpec } from '../types';
import { aircraftSpecs } from './aircraft';
import { planeSpecs } from './planes';
import { tankSpecs } from './tanks';

export { AIR_KEYS, aircraftSpecs } from './aircraft';
export {
  TANK_KEYS,
  TANK_LOOKS,
  VEHICLE_LOOKS,
  isGearLook,
  vehicleLookOf,
  TANK_TRACK_PITCH,
  createTankPose,
  layoutTank,
  type PartXf,
  type TankKeys,
  type TankPose,
  type TankState,
} from './tankLayout';
export { tankGearKeys, tankGearSpecs, type TankGearKeys } from './tankGear';
export { tankSpecs } from './tanks';
export { PLANE_KINDS, planeKey, planeShadowKey, planeSpecs } from './planes';

/** Every vehicle sprite. */
export function vehicleSpecs(): SpriteSpec[] {
  return [...tankSpecs(), ...aircraftSpecs(), ...planeSpecs()];
}
