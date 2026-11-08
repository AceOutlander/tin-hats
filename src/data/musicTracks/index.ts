/**
 * The battle track registry. A mission names its track in `MissionDef.music`; a new track is one file in this folder,
 * its name in `BattleTrackName` (src/data/schema.ts) and one line here (docs/MUSIC.md).
 */
import type { BattleTrackDef } from '../musicBattle';
import type { BattleTrackName } from '../schema';
import { ARRAS } from './arras';

export type { BattleTrackName };

export const BATTLE_TRACKS: Record<BattleTrackName, BattleTrackDef> = {
  arras: ARRAS,
};

export const BATTLE_TRACK_NAMES = Object.keys(BATTLE_TRACKS) as BattleTrackName[];
