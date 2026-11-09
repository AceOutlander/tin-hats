import type { CampaignMapDef } from './campaignMap';
import { STALINGRAD_MAP } from './campaignMapStalingrad';
import type { MusicTrackName } from './music';
import { STALINGRAD_MUSIC } from './musicCampaigns';
import type { CampaignDef, CampaignId } from './schema';

/** A campaign with what its screens need: the situation map it is played on and the track that map plays. */
export interface Campaign extends CampaignDef {
  /** The campaign map (src/data/campaignMap.ts): bounds, shapes, rivers, labels and front lines. */
  map: CampaignMapDef;
  /** The between-missions track (src/data/music.ts), on the map, the briefing and the Quartermaster. */
  mapMusic: MusicTrackName;
}

/**
 * The campaigns (docs/campaigns/FOUNDATIONS.md section 6), in select-screen order. Mission ids have four digits by
 * campaign (Stalingrad 1001 to 1010). Stalingrad is the only campaign today: the ten British placeholder missions were
 * removed with its release (owner, docs/QUEUE.md "The current missions are placeholders"). With one campaign on offer
 * Play goes straight to its map; the select screen shows once a second campaign joins this list.
 */
export const CAMPAIGN_IDS: readonly CampaignId[] = ['stalingrad'];

function range(first: number, last: number): number[] {
  const out: number[] = [];
  for (let id = first; id <= last; id++) out.push(id);
  return out;
}

export const CAMPAIGNS: Record<CampaignId, Campaign> = {
  stalingrad: {
    id: 'stalingrad',
    nation: 'soviet',
    title: 'Stalingrad',
    subtitle: 'June 1941 to February 1943',
    missionRange: { first: 1001, last: 1010 },
    missionIds: range(1001, 1010),
    unlock: { always: true },
    card: 'From the first morning at Brest to the ruins on the Volga.',
    // The game's only campaign since the British placeholders went (it ships with their removal). A campaign still
    // being built sets this false: it then shows only on the dev server, with ?unreleased=1, or after the admin unlock.
    released: true,
    map: STALINGRAD_MAP,
    mapMusic: STALINGRAD_MUSIC.map,
  },
};

/** The campaign a mission id belongs to, or null for an id outside every campaign (the proving ground, tests). */
export function campaignOf(missionId: number): CampaignId | null {
  for (const id of CAMPAIGN_IDS) {
    const r = CAMPAIGNS[id].missionRange;
    if (missionId >= r.first && missionId <= r.last) return id;
  }
  return null;
}
