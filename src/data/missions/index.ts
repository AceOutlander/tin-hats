import type { MissionDef } from '../schema';
import { M01 } from './m01';
import { M02 } from './m02';
import { M03 } from './m03';
import { M04 } from './m04';
import { M05 } from './m05';
import { M06 } from './m06';
import { M07 } from './m07';
import { M08 } from './m08';
import { M09 } from './m09';
import { M10 } from './m10';

/** Every mission, in campaign order. Each lives in its own file (m01.ts to m10.ts). */
export const MISSIONS: readonly MissionDef[] = [M01, M02, M03, M04, M05, M06, M07, M08, M09, M10];

/** The mission with this id, or undefined if it does not exist (yet). */
export function getMission(id: number): MissionDef | undefined {
  for (const mission of MISSIONS) {
    if (mission.id === id) return mission;
  }
  return undefined;
}
