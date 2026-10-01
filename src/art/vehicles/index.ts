/**
 * Vehicle art: tank rigs (Churchill, Panzer IV, King Tiger) and the air
 * strike aircraft with its ordnance. Keys are namespaced "veh/...".
 */
import type { SpriteSpec } from '../types';
import { aircraftSpecs } from './aircraft';
import { tankSpecs } from './tanks';

export { AIR_KEYS, aircraftSpecs } from './aircraft';
export {
  TANK_KEYS,
  TANK_LOOKS,
  TANK_TRACK_PITCH,
  createTankPose,
  layoutTank,
  type PartXf,
  type TankKeys,
  type TankPose,
  type TankState,
} from './tankLayout';
export { tankSpecs } from './tanks';

/** Every vehicle sprite. */
export function vehicleSpecs(): SpriteSpec[] {
  return [...tankSpecs(), ...aircraftSpecs()];
}
