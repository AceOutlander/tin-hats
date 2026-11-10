/**
 * The Quartermaster and the Shop speak the nation of the campaign on the map (owner, 2026-11-09): every upgrade's
 * name, text and picture, every Shop entry, and the briefings, tips and victory text of the Stalingrad campaign carry
 * no other nation's units, weapons or vehicles ("PIAT" or "Churchill" in the Soviet Armoury). Upgrade ids, levels,
 * costs and effects stay shared, so saves and balance are untouched.
 */
import { describe, expect, it } from 'vitest';
import { buildCampaignView } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { FACTIONS } from '../../src/data/factions';
import { FIGURE_LOADOUT } from '../../src/data/figure';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { BASIC_TRAINING } from '../../src/data/missions/training';
import type { FactionId } from '../../src/data/schema';
import { TUTORIAL } from '../../src/data/tutorial';
import { GENERAL_UPGRADE_TEXT, NATION_WORDS, UNIT_UPGRADE_TEXT, upgradeTextFor, type UpgradeTextNation } from '../../src/data/upgradeText';
import { UPGRADES, upgradableKinds } from '../../src/data/upgrades';
import { defaultSave } from '../../src/meta';
import { vehicleLookOf } from '../../src/art/vehicles/tankLayout';

const PLAYER_NATIONS: readonly UpgradeTextNation[] = ['british', 'soviet'];

/** The words of every nation but `nation`, as whole words. */
function foreignWords(nation: FactionId, others: readonly FactionId[] = ['british', 'german', 'soviet']): RegExp {
  const words = others.filter((n) => n !== nation).flatMap((n) => NATION_WORDS[n]);
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`);
}

describe('upgrade text per nation', () => {
  it('has one entry per upgradable unit type per player nation, and text for every HQ, sapper and call-in track', () => {
    for (const nation of PLAYER_NATIONS) {
      for (const kind of upgradableKinds()) expect(UNIT_UPGRADE_TEXT[nation][kind], `${nation} ${kind}`).toBeDefined();
      for (const def of UPGRADES) {
        if (def.unit === null) expect(GENERAL_UPGRADE_TEXT[nation][def.id], `${nation} ${def.id}`).toBeDefined();
      }
    }
  });

  it('writes the Soviet tracks in their own words, not the British ones with a name swapped', () => {
    for (const def of UPGRADES) {
      const gb = upgradeTextFor(def, 'british');
      const su = upgradeTextFor(def, 'soviet');
      expect(su.description.length, def.id).toBeGreaterThan(15);
      expect(su.name.length, def.id).toBeGreaterThan(3);
      // Only the generic fuel and armour lines may share a name; descriptions differ unless nothing nation-specific is in them.
      if (gb.description === su.description) expect(gb.description, def.id).not.toMatch(foreignWords('soviet'));
    }
    expect(upgradeTextFor(UPGRADES.find((d) => d.id === 'atDamage')!, 'soviet').name).not.toMatch(/PIAT/);
    expect(upgradeTextFor(UPGRADES.find((d) => d.id === 'tankHealth')!, 'soviet').description).toMatch(/T-34/);
  });

  it.each(PLAYER_NATIONS)('keeps every upgrade and Shop entry of the %s Quartermaster free of other nations\' units', (nation) => {
    const view = buildCampaignView(defaultSave(), STALINGRAD_MISSIONS, UPGRADES, true, nation);
    const foreign = foreignWords(nation);
    for (const u of view.upgrades) {
      expect(`${u.group}: ${u.name}. ${u.description}`, `${nation} ${u.id}`).not.toMatch(foreign);
    }
    for (const a of view.armoury ?? []) {
      expect(`${a.name}. ${a.blurb}. ${a.lockedNote ?? ''}`, `${nation} ${a.id}`).not.toMatch(foreign);
    }
    // Ids, levels and costs stay shared across nations.
    const british = buildCampaignView(defaultSave(), STALINGRAD_MISSIONS, UPGRADES, true, 'british');
    expect(view.upgrades.map((u) => [u.id, u.maxLevel, u.cost, u.levelText])).toEqual(british.upgrades.map((u) => [u.id, u.maxLevel, u.cost, u.levelText]));
  });

  it.each(PLAYER_NATIONS)('paints the %s pictures with that nation\'s own soldiers and vehicles', (nation) => {
    const foreignWeapons: Record<UpgradeTextNation, readonly string[]> = {
      british: ['mosin', 'mosinScoped', 'dp27', 'ppsh', 'ptrd', 'tt33', 'kar98', 'kar98Scoped', 'mg34', 'mp40', 'panzerschreck'],
      soviet: ['enfield', 'enfieldScoped', 'bren', 'sten', 'piat', 'kar98', 'kar98Scoped', 'mg34', 'mp40', 'panzerschreck'],
    };
    for (const kind of upgradableKinds()) {
      if (kind === 'tank' || kind === 'apc') continue;
      const weapon = FIGURE_LOADOUT[nation].weapon[kind as keyof (typeof FIGURE_LOADOUT)['soviet']['weapon']];
      expect(foreignWeapons[nation], `${nation} ${kind}: ${weapon}`).not.toContain(weapon);
    }
    expect(vehicleLookOf('tank', nation)).toBe(FACTIONS[nation].look.tank);
    if (nation === 'soviet') {
      expect(vehicleLookOf('tank', 'soviet')).toBe('t34');
      expect(vehicleLookOf('apc', 'soviet')).toBe('carrierSoviet');
      expect(FIGURE_LOADOUT.soviet.weapon.at).toBe('ptrd');
    }
  });
});

describe('the Stalingrad campaign\'s words', () => {
  const british = foreignWords('soviet', ['british']);

  it('has briefings, objectives, own-side intel and in-mission text with no British unit or weapon', () => {
    for (const m of STALINGRAD_MISSIONS) {
      const own = { title: m.title, briefing: m.briefing, objective: m.objective, friendly: m.intel?.friendly ?? [], location: m.location };
      expect(JSON.stringify(own), m.title).not.toMatch(british);
      // The rest of the mission (director lines, tips, timer and end texts), less the enemy intel which names the Germans.
      const rest = { ...m, intel: undefined } as Record<string, unknown>;
      expect(JSON.stringify(rest), m.title).not.toMatch(british);
    }
  });

  it('has tips, the Basic Training lessons and the victory and defeat lines with no British unit or weapon', () => {
    expect(JSON.stringify(TUTORIAL)).not.toMatch(british);
    expect(JSON.stringify(BASIC_TRAINING)).not.toMatch(british);
    expect(JSON.stringify(APP.reasons)).not.toMatch(british);
    expect(JSON.stringify(APP.supportBlurbs)).not.toMatch(british);
  });
});
