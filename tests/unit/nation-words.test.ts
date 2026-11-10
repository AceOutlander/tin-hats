/**
 * Wrong-nation words on Soviet screens (owner, 2026-11-09: "British wording in the Soviet Armoury"; the sweep found a
 * British "Most secret" stamp on every Soviet briefing). Every player-visible string the Stalingrad campaign shows is
 * scanned: unit names and button labels of every mission's era, call-in names, the Shop and the Quartermaster, the
 * briefing sheet's heading, stamp, title, objective, intelligence and orders, the loadout, the tips, the mission
 * director's lines, timers and end texts, the result lines, the call-in blurbs and the map's printed names.
 *
 * British words and phrases may appear nowhere. German words may name the enemy (the intelligence, the director's
 * warnings), but never the player's own units, buttons, call-ins, Shop, Quartermaster or own-forces lines.
 * Builds on tests/unit/upgrade-text.test.ts (the Quartermaster and Shop scan).
 */
import { describe, expect, it } from 'vitest';
import { buildCampaignView } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { STALINGRAD_MAP } from '../../src/data/campaignMapStalingrad';
import { missionEra, INFANTRY_LOOKS, VEHICLE_LOOK_NAMES } from '../../src/data/eras';
import { FACTIONS } from '../../src/data/factions';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { trainingMission } from '../../src/data/missions/training';
import { TUTORIAL } from '../../src/data/tutorial';
import { NATION_WORDS } from '../../src/data/upgradeText';
import { UPGRADES } from '../../src/data/upgrades';
import { defaultSave } from '../../src/meta';

/** British paperwork and slang that a Red Army screen must never show (with the British units and weapons). */
const BRITISH_PHRASES = ['Most secret', 'Tommies', 'Jerry', 'Jerries', 'Blighty', 'RAF', 'Royal', 'Brodie', 'Home Guard'];

function words(list: readonly string[]): RegExp {
  const escaped = list.map((w) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`);
}

const BRITISH = words([...NATION_WORDS.british, ...BRITISH_PHRASES]);
const GERMAN = words(NATION_WORDS.german);

/** Every string inside a value (objects, arrays), with a path for the failure message. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

function expectNone(re: RegExp, value: unknown, label: string): void {
  for (const [path, text] of strings(value)) expect(text, `${label} ${path}`).not.toMatch(re);
}

describe('no other nation on a Soviet screen', () => {
  it.each(STALINGRAD_MISSIONS.map((m) => [m.id, m] as const))('mission %i: the Red Army\'s own names, buttons and call-ins are Soviet', (_id, m) => {
    const era = missionEra(m, 'soviet');
    const own = { names: era.names, buttons: era.buttonNames, blurbs: era.blurbs, supports: era.supportNames };
    expectNone(BRITISH, own, `${m.id} era`);
    expectNone(GERMAN, own, `${m.id} era`);
    // The player's own forces as the briefing lists them.
    expectNone(GERMAN, m.intel?.friendly ?? [], `${m.id} our forces`);
    // Per-force looks the Red Army fields keep Soviet names (a KV-2 among the KV-1s, ski troops).
    for (const f of m.start[0].forces) {
      if (f.look === undefined) continue;
      const name = f.look in INFANTRY_LOOKS ? INFANTRY_LOOKS[f.look as keyof typeof INFANTRY_LOOKS].names[f.kind] : VEHICLE_LOOK_NAMES[f.look as keyof typeof VEHICLE_LOOK_NAMES];
      expect(name ?? '', `${m.id} ${f.kind} ${f.look}`).not.toMatch(GERMAN);
      expect(name ?? '', `${m.id} ${f.kind} ${f.look}`).not.toMatch(BRITISH);
    }
  });

  it.each(STALINGRAD_MISSIONS.map((m) => [m.id, m] as const))('mission %i: every line it shows (briefing, intel, director, tips, timers, end texts) has no British word', (_id, m) => {
    expectNone(BRITISH, m, `${m.id}`);
  });

  it('stamps the Soviet orders sheet in Red Army paperwork, not the British "Most secret"', () => {
    expect(FACTIONS.soviet.orders.stamp).not.toMatch(BRITISH);
    expect(FACTIONS.soviet.orders.title).not.toMatch(/^Operation order$/);
    const view = buildCampaignView(defaultSave(), STALINGRAD_MISSIONS, UPGRADES, true, 'soviet');
    for (const card of view.missions) {
      expect(card.orders, `${card.id}`).toEqual(FACTIONS.soviet.orders);
      // The card as the map and the briefing show it, loadout names and loans included.
      expectNone(BRITISH, { ...card, id: undefined }, `card ${card.id}`);
      expectNone(GERMAN, [card.callIns?.map((c) => c.name), card.loans?.map((l) => l.name), card.newUnit, card.newSupport, card.moreNewUnits], `card ${card.id}`);
    }
  });

  it('keeps the Shop, the Quartermaster, the tips, the result lines, the call-in blurbs and the map free of British words', () => {
    const view = buildCampaignView(defaultSave(), STALINGRAD_MISSIONS, UPGRADES, true, 'soviet');
    expectNone(BRITISH, { upgrades: view.upgrades, armoury: view.armoury }, 'Soviet Shop and Quartermaster');
    expectNone(GERMAN, { upgrades: view.upgrades.map((u) => [u.group, u.name, u.description]), armoury: view.armoury?.map((a) => [a.name, a.blurb]) }, 'Soviet Shop and Quartermaster');
    expectNone(BRITISH, TUTORIAL, 'tips');
    expectNone(BRITISH, APP.reasons, 'result lines');
    expectNone(BRITISH, APP.supportBlurbs, 'call-in blurbs');
    expectNone(BRITISH, STALINGRAD_MAP.labels.map((l) => l.text), 'map labels');
    expectNone(BRITISH, STALINGRAD_MAP.cartouche, 'map cartouche');
    // Basic Training as the Red Army (the title's lessons when Stalingrad is on show).
    const training = trainingMission('soviet');
    expectNone(BRITISH, { briefing: training.briefing, objective: training.objective, title: training.title }, 'Basic Training');
  });
});
