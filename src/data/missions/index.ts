import type { MissionDef } from '../schema';
import { STALINGRAD_MISSIONS } from './stalingrad';

/**
 * Every campaign mission, campaign by campaign in select-screen order (src/data/campaigns.ts CAMPAIGN_IDS), each in
 * its own play order. Today that is Stalingrad, 1001 to 1010 (src/data/missions/stalingrad). The ten British
 * placeholder missions (ids 1 to 10) were removed for the Stalingrad release (owner, docs/QUEUE.md); saves keep what
 * they earned there (save version 10, src/meta/save.ts). The proving ground (./sandbox.ts) and Basic Training
 * (./training.ts) are not campaign missions and are not listed.
 */
export const MISSIONS: readonly MissionDef[] = [...STALINGRAD_MISSIONS];

/** The campaign mission with this id, or undefined if it does not exist (yet). */
export function getMission(id: number): MissionDef | undefined {
  for (const mission of MISSIONS) {
    if (mission.id === id) return mission;
  }
  return undefined;
}
