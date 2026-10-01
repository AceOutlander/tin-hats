import type { MissionDef } from '../schema';
import { M01 } from './m01';

/** Every mission, in campaign order. */
export const MISSIONS: readonly MissionDef[] = [M01];

/** The mission with this id, or undefined if it does not exist (yet). */
export function getMission(id: number): MissionDef | undefined {
  for (const mission of MISSIONS) {
    if (mission.id === id) return mission;
  }
  return undefined;
}
