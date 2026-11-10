import type { MissionDef } from '../../schema';
import { M1001 } from './m1001';
import { M1002 } from './m1002';
import { M1003 } from './m1003';
import { M1004 } from './m1004';
import { M1005 } from './m1005';
import { M1006 } from './m1006';
import { M1007 } from './m1007';
import { M1008 } from './m1008';
import { M1009 } from './m1009';
import { M1010 } from './m1010';

/**
 * The Stalingrad campaign's missions (docs/campaigns/STALINGRAD.md), in play order, ids 1001 to 1010. Each lives in
 * its own file (m1001.ts to m1010.ts). MISSIONS (../index.ts) lists them, and src/data/campaigns.ts gives the
 * campaign its map and card.
 */
export const STALINGRAD_MISSIONS: readonly MissionDef[] = [M1001, M1002, M1003, M1004, M1005, M1006, M1007, M1008, M1009, M1010];

/** The Stalingrad mission with this id, or undefined if it does not exist (yet). */
export function getStalingradMission(id: number): MissionDef | undefined {
  for (const mission of STALINGRAD_MISSIONS) {
    if (mission.id === id) return mission;
  }
  return undefined;
}
