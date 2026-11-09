import type { CampaignDef, CampaignId } from './schema';

/**
 * The campaigns (docs/campaigns/FOUNDATIONS.md section 6), in select-screen order. Mission ids have four digits by
 * campaign (Stalingrad 1001 to 1010); 'british' is today's campaign (ids 1 to 10), kept until the new campaigns
 * replace it. The campaign map, theme and map music of each campaign come with the campaign select job.
 */
export const CAMPAIGN_IDS: readonly CampaignId[] = ['stalingrad', 'british'];

function range(first: number, last: number): number[] {
  const out: number[] = [];
  for (let id = first; id <= last; id++) out.push(id);
  return out;
}

export const CAMPAIGNS: Record<CampaignId, CampaignDef> = {
  stalingrad: {
    id: 'stalingrad',
    nation: 'soviet',
    title: 'Stalingrad',
    subtitle: 'June 1941 to February 1943',
    missionRange: { first: 1001, last: 1010 },
    missionIds: range(1001, 1010),
    unlock: { always: true },
    card: 'From the first morning at Brest to the ruins on the Volga.',
    // Being built on the stalingrad branch: it must not reach the live site (owner, docs/QUEUE.md).
    released: false,
  },
  british: {
    id: 'british',
    nation: 'british',
    title: 'The Line',
    subtitle: 'May 1940 to February 1945',
    missionRange: { first: 1, last: 10 },
    missionIds: range(1, 10),
    unlock: { always: true },
    card: 'The British campaign: from Arras in 1940 to the Reichswald.',
    released: true,
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
