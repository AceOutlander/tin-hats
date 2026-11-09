/**
 * The battle track registry. A mission names its track in `MissionDef.music`; a new track is one file in this folder,
 * its name in `BattleTrackName` (src/data/schema.ts) and one line here (docs/MUSIC.md).
 */
import type { BattleTrackDef } from '../musicBattle';
import type { BattleTrackName } from '../schema';
import { ARRAS } from './arras';
import { DUNKIRK } from './dunkirk';
import { CRUSADER } from './crusader';
import { ALAMEIN } from './alamein';
import { CASSINO } from './cassino';
import { PRIMOSOLE } from './primosole';
import { SWORD } from './sword';
import { ARNHEM } from './arnhem';
import { HILL112 } from './hill112';
import { REICHSWALD } from './reichswald';
import { VOLOKOLAMSK } from './volokolamsk';
import { FACTORIES } from './factories';
import { BREST } from './brest';
import { DUBNO } from './dubno';
import { KLIN } from './klin';
import { VOLGA } from './volga';

export type { BattleTrackName };

export const BATTLE_TRACKS: Record<BattleTrackName, BattleTrackDef> = {
  arras: ARRAS,
  dunkirk: DUNKIRK,
  crusader: CRUSADER,
  alamein: ALAMEIN,
  primosole: PRIMOSOLE,
  cassino: CASSINO,
  sword: SWORD,
  hill112: HILL112,
  arnhem: ARNHEM,
  reichswald: REICHSWALD,
  volokolamsk: VOLOKOLAMSK,
  factories: FACTORIES,
  brest: BREST,
  dubno: DUBNO,
  klin: KLIN,
  volga: VOLGA,
};

export const BATTLE_TRACK_NAMES = Object.keys(BATTLE_TRACKS) as BattleTrackName[];
