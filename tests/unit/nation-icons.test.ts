/**
 * Wrong-nation kit icons (owner, 2026-11-15: the top bar's MEN icon was a British Brodie helmet in the Soviet
 * campaign). The sibling of nation-words.test.ts for pictures: every HUD and menu icon that shows a nation's kit is
 * drawn from the nation's own data (FactionLook.helmet), on every screen, for every nation the game has, and nothing
 * in the UI can draw a helmet without saying whose it is.
 *
 * - The battle HUD (the population icon in the top bar and on every train button, the "all units" icon of the order
 *   scope) wears the helmet of the player's nation in that battle (HudState.helmet).
 * - A campaign's screens (the Quartermaster's HQ group, the result banner) wear the helmet of the campaign's nation
 *   (CampaignView.helmet).
 * - The title's helmet is the game's logo, the Brodie "tin hat", whoever is played.
 * Unit portraits, flags, vehicles and call-in pictures are painted from the nation's art and are checked in
 * art-soviet.test.ts, nations.test.ts and upgrade-visuals.test.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCampaignView } from '../../src/app/campaignView';
import { HudModel } from '../../src/app/hudModel';
import { CAMPAIGNS, CAMPAIGN_IDS, UPCOMING_CAMPAIGNS } from '../../src/data/campaigns';
import { FACTIONS } from '../../src/data/factions';
import { MISSIONS } from '../../src/data/missions';
import { SANDBOX } from '../../src/data/missions/sandbox';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { trainingMission } from '../../src/data/missions/training';
import type { FactionId, HelmetShape, MissionDef } from '../../src/data/schema';
import { UPGRADES } from '../../src/data/upgrades';
import { defaultSave } from '../../src/meta';
import { createBattle } from '../../src/sim';
import { HUD_HELMET_SHAPES, ICONS, kitIcon, type KitIconName } from '../../src/ui/hud/icons';

const NATIONS = Object.keys(FACTIONS) as FactionId[];
/** The nations a player can be: those of the campaigns, playable and to come. */
const PLAYER_NATIONS = [...new Set<FactionId>([...CAMPAIGN_IDS.map((id) => CAMPAIGNS[id].nation), ...UPCOMING_CAMPAIGNS.map((c) => c.nation)])];
const KIT_ICONS: KitIconName[] = ['helmet', 'army'];

function hudHelmet(mission: MissionDef): HelmetShape {
  const battle = createBattle({ mission, difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['human', 'ai'] });
  const model = new HudModel();
  model.begin(battle);
  return model.state.helmet;
}

/** Every .ts file under a source folder, with its path relative to the repo. */
function sources(dir: string): Array<[string, string]> {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const out: Array<[string, string]> = [];
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(root, rel))) {
      const path = `${rel}/${name}`;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else if (name.endsWith('.ts')) out.push([path, readFileSync(join(root, path), 'utf8')]);
    }
  };
  walk(dir);
  return out;
}

describe('every nation has its own helmet, and the HUD can draw each', () => {
  it('no two nations share a helmet', () => {
    const shapes = NATIONS.map((n) => FACTIONS[n].look.helmet);
    expect(new Set(shapes).size).toBe(NATIONS.length);
    expect(FACTIONS.soviet.look.helmet).toBe('ssh40');
    expect(FACTIONS.british.look.helmet).toBe('brodie');
    expect(FACTIONS.german.look.helmet).toBe('stahlhelm');
  });

  it('the HUD has a drawing for every nation\'s helmet, each different from every other', () => {
    for (const n of NATIONS) expect(HUD_HELMET_SHAPES, n).toContain(FACTIONS[n].look.helmet);
    for (const name of KIT_ICONS) {
      const drawn = NATIONS.map((n) => kitIcon(name, FACTIONS[n].look.helmet));
      for (const markup of drawn) expect(markup).toMatch(/^<svg viewBox="0 0 24 24"[^>]*>.*<path.* d="M[^"]+".*<\/svg>$/);
      expect(new Set(drawn).size, name).toBe(NATIONS.length);
    }
    // The whole army is three of the nation's helmets.
    for (const shape of HUD_HELMET_SHAPES) expect(kitIcon('army', shape).match(/<path /g)).toHaveLength(3);
  });

  it('the HUD keeps no helmet of its own: the fixed icons show no nation\'s kit', () => {
    expect(Object.keys(ICONS)).not.toContain('helmet');
    expect(Object.keys(ICONS)).not.toContain('army');
    const helmets = HUD_HELMET_SHAPES.map((shape) => kitIcon('helmet', shape).match(/ d="([^"]+)"/)?.[1] ?? '');
    for (const [name, markup] of Object.entries(ICONS)) {
      for (const d of helmets) expect(markup.includes(d), name).toBe(false);
    }
  });
});

describe('the battle HUD wears the helmet of the player\'s nation', () => {
  it.each(MISSIONS.map((m) => [m.id, m] as const))('mission %i', (_id, m) => {
    expect(hudHelmet(m)).toBe(FACTIONS[m.start[0].faction].look.helmet);
  });

  it('every Stalingrad battle shows the Soviet helmet, never the Brodie', () => {
    for (const m of STALINGRAD_MISSIONS) expect(hudHelmet(m), `mission ${m.id}`).toBe('ssh40');
  });

  it('the British proving ground shows the Brodie, and Basic Training its player\'s own', () => {
    expect(hudHelmet(SANDBOX)).toBe('brodie');
    for (const n of PLAYER_NATIONS) expect(hudHelmet(trainingMission(n)), n).toBe(FACTIONS[n].look.helmet);
  });

  it('a second battle as another nation changes it (the model is reused between battles)', () => {
    const model = new HudModel();
    for (const mission of [SANDBOX, STALINGRAD_MISSIONS[0], SANDBOX]) {
      model.begin(createBattle({ mission, difficulty: 'normal', seed: 1, upgrades: {}, commanders: ['human', 'ai'] }));
      expect(model.state.helmet).toBe(FACTIONS[mission.start[0].faction].look.helmet);
    }
  });
});

describe('a campaign\'s screens wear the helmet of its nation', () => {
  it.each(NATIONS)('%s: the map, the Quartermaster and the result screen are handed that nation\'s helmet', (nation) => {
    const view = buildCampaignView(defaultSave(), STALINGRAD_MISSIONS, UPGRADES, true, nation);
    expect(view.helmet).toBe(FACTIONS[nation].look.helmet);
  });

  it('every campaign, playable or to come, is played as a nation with a helmet the HUD and the menus can draw', () => {
    for (const nation of PLAYER_NATIONS) expect(HUD_HELMET_SHAPES, nation).toContain(FACTIONS[nation].look.helmet);
    expect(PLAYER_NATIONS).toEqual(expect.arrayContaining(['soviet', 'british']));
  });
});

describe('nothing in the UI draws a helmet without saying whose', () => {
  const ui = sources('src/ui');
  const app = sources('src/app');

  it('helmetIcon has no default shape, and every call names the campaign\'s helmet or the game\'s emblem', () => {
    const icons = ui.find(([path]) => path === 'src/ui/shell/icons.ts')?.[1] ?? '';
    expect(icons).toContain('export function helmetIcon(className: string, shape: HelmetShape): SVGSVGElement');
    const calls: string[] = [];
    for (const [path, text] of ui) {
      if (path === 'src/ui/shell/icons.ts') continue;
      for (const m of text.matchAll(/helmetIcon\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) calls.push(`${path}: ${m[1]}`);
    }
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      // The second argument: the campaign view's helmet, or (on the title only) the game's emblem.
      const shape = call.slice(call.lastIndexOf(',') + 1).trim();
      if (call.startsWith('src/ui/screens/title.ts')) expect(shape, call).toBe('GAME_EMBLEM');
      else expect(shape, call).toMatch(/(^|\.)helmet$/);
    }
  });

  it('names no helmet shape outside the two drawing tables and the game\'s emblem', () => {
    const allowed = new Set(['src/ui/hud/icons.ts', 'src/ui/shell/icons.ts']);
    const literal = new RegExp(`['"](${HUD_HELMET_SHAPES.join('|')})['"]`);
    for (const [path, text] of [...ui, ...app]) {
      if (allowed.has(path)) continue;
      expect(literal.test(text), `${path} names a helmet shape itself instead of reading the nation's`).toBe(false);
    }
    // In the menu icons the only shape named outside the table's keys is the emblem's.
    const icons = ui.find(([path]) => path === 'src/ui/shell/icons.ts')?.[1] ?? '';
    expect(icons.match(literal)?.[1]).toBe('brodie');
    expect(icons.match(new RegExp(literal, 'g'))).toHaveLength(1);
  });

  it('the HUD\'s population and army icons are kit slots, filled from the battle\'s nation', () => {
    const hud = ui.find(([path]) => path === 'src/ui/hud/index.ts')?.[1] ?? '';
    expect(hud.match(/kitSlot\('helmet'/g)).toHaveLength(2);
    expect(hud.match(/kitSlot\('army'/g)).toHaveLength(2);
    expect(hud).not.toMatch(/icon\('(helmet|army)'/);
    expect(hud).toContain('this.paintKit(s.helmet)');
  });
});
