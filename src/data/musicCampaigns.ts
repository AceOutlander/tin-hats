/**
 * Which music each campaign plays: its theme (src/data/musicThemes.ts), its map track (src/data/music.ts) and the
 * battle track of every mission (src/data/musicTracks). A mission file sets `music: STALINGRAD_MUSIC.missions[id]`.
 *
 * The Stalingrad brief (docs/campaigns/STALINGRAD.md) gives every mission its own track, and all ten are written:
 * `brest`, `dubno`, `volokolamsk` and `klin` (1941), `volga`, `kurgan`, `pavlov` and `factories` (the city), `uranus`
 * and `ring` (the encirclement). `planned` is empty now; a mission still waiting for its own track would play the
 * nearer written one in setting and name its own there (docs/campaigns/STALINGRAD_BUILD.md).
 */
import type { MusicTrackName } from './music';
import type { ThemeName } from './musicThemes';
import type { BattleTrackName } from './schema';

export interface CampaignMusic<Id extends number> {
  theme: ThemeName;
  map: MusicTrackName;
  /** The track each mission plays today. */
  missions: Readonly<Record<Id, BattleTrackName>>;
  /** The track each mission is to get, where it differs (the brief's name for a track not written yet). */
  planned: Readonly<Partial<Record<Id, string>>>;
}

export type StalingradMissionId = 1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007 | 1008 | 1009 | 1010;

export const STALINGRAD_MUSIC: CampaignMusic<StalingradMissionId> = {
  theme: 'sovietWinter',
  map: 'stalingradMap',
  missions: {
    1001: 'brest',
    1002: 'dubno',
    1003: 'volokolamsk',
    1004: 'klin',
    1005: 'volga',
    1006: 'kurgan',
    1007: 'pavlov',
    1008: 'factories',
    1009: 'uranus',
    1010: 'ring',
  },
  planned: {},
};
