/**
 * Nations as data (docs/campaigns/FOUNDATIONS.md section 5, NATIONS.md): every table keyed by nation has every nation
 * (the Soviet Union included), the Soviet look and roster, signature kinds offered only to their own nation, and the
 * campaign registry (FOUNDATIONS.md section 6).
 */
import { describe, expect, it } from 'vitest';
import { FACTION_FIGURE_KEYS, figureSpriteMap } from '../../src/art/figure';
import { FLAG_KEYS, structureSpecs } from '../../src/art/structures';
import { TANK_KEYS, vehicleSpecs } from '../../src/art/vehicles';
import { HQ_LAYOUT, TANK_LAYOUT, TANK_LOOKS, TRENCH_LAYOUT, VEHICLE_LOOK_EXTRA } from '../../src/data/artLayout';
import { CAMPAIGNS, CAMPAIGN_IDS, campaignOf } from '../../src/data/campaigns';
import { FACTIONS, FACTION_IDS, nationCallsIn, nationFields } from '../../src/data/factions';
import { FIGURE_KIND_LIST, FIGURE_LOADOUT } from '../../src/data/figure';
import { FX_PROJECTILE_SPRITE } from '../../src/data/fx';
import { FIGURE_GEAR_ART, FIGURE_GEAR_NATION, TANK_GEAR_ART } from '../../src/data/looksGear';
import { MISSIONS } from '../../src/data/missions';
import { SANDBOX, SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import type { FactionId, MissionDef } from '../../src/data/schema';
import { SPEECH } from '../../src/data/speech';
import { SUPPORT_KINDS } from '../../src/data/supports';
import { UNIT_KINDS } from '../../src/data/units';
import { NATION_LOOKS } from '../../src/data/upgradeLooks';

const NATIONS = [...FACTION_IDS].sort();

function expectEveryNation(table: object, what: string): void {
  expect(Object.keys(table).sort(), what).toEqual(NATIONS);
}

describe('tables keyed by nation', () => {
  it('include the Soviet Union', () => {
    expect(FACTION_IDS).toContain('soviet');
  });

  it('have an entry for every nation, in data and in art', () => {
    expectEveryNation(FACTIONS, 'FACTIONS');
    expectEveryNation(SPEECH, 'SPEECH');
    expectEveryNation(FIGURE_LOADOUT, 'FIGURE_LOADOUT');
    expectEveryNation(FIGURE_GEAR_NATION, 'FIGURE_GEAR_NATION');
    expectEveryNation(NATION_LOOKS, 'NATION_LOOKS');
    expectEveryNation(HQ_LAYOUT, 'HQ_LAYOUT');
    expectEveryNation(VEHICLE_LOOK_EXTRA, 'VEHICLE_LOOK_EXTRA');
    expectEveryNation(TRENCH_LAYOUT.pennant, 'TRENCH_LAYOUT.pennant');
    for (const [look, byNation] of Object.entries(FX_PROJECTILE_SPRITE)) expectEveryNation(byNation, `FX_PROJECTILE_SPRITE.${look}`);
    expectEveryNation(FACTION_FIGURE_KEYS, 'FACTION_FIGURE_KEYS');
  });

  it('name every unit kind and call-in for every nation, with three kinds of order in its speech', () => {
    for (const f of FACTION_IDS) {
      const def = FACTIONS[f];
      expect(def.id).toBe(f);
      for (const kind of UNIT_KINDS) {
        expect(def.unitNames[kind], `${f} ${kind} name`).toBeTruthy();
        expect(def.unitBlurbs[kind], `${f} ${kind} blurb`).toBeTruthy();
      }
      for (const kind of SUPPORT_KINDS) expect(def.supportNames[kind], `${f} ${kind}`).toBeTruthy();
      for (const order of ['advance', 'hold', 'fallBack'] as const) expect(SPEECH[f][order].length, `${f} ${order}`).toBeGreaterThan(0);
      for (const kind of FIGURE_KIND_LIST) expect(FIGURE_LOADOUT[f].weapon[kind], `${f} ${kind} weapon`).toBeTruthy();
    }
  });

  it('draw every nation: its flag, helmet and rim, its tanks, and the vehicles it borrows', () => {
    const figures = figureSpriteMap();
    const other = new Set([...structureSpecs(), ...vehicleSpecs()].map((s) => s.key));
    for (const f of FACTION_IDS) {
      const look = FACTIONS[f].look;
      expect(other.has(FLAG_KEYS[look.flag]), `${f} flag`).toBe(true);
      expect(figures.has(FACTION_FIGURE_KEYS[f].helmet), `${f} helmet`).toBe(true);
      expect(figures.has(FACTION_FIGURE_KEYS[f].helmetRim), `${f} helmet rim`).toBe(true);
      expect(FIGURE_GEAR_ART.scrim[look.helmet].length % 3, `${f} scrim tufts`).toBe(0);
      for (const v of [look.tank, look.heavyTank, VEHICLE_LOOK_EXTRA[f].apc, VEHICLE_LOOK_EXTRA[f].lightTank]) {
        expect(other.has(TANK_KEYS[v].hull), `${f} ${v} hull`).toBe(true);
        expect(other.has(TANK_KEYS[v].turret), `${f} ${v} turret`).toBe(true);
      }
      expect(TANK_LOOKS).toContain(look.tank);
      expect(TANK_LOOKS).toContain(look.heavyTank);
      expect(TANK_GEAR_ART[look.tank]).toBeDefined();
    }
  });
});

describe('the Soviet Union (NATIONS.md section 3)', () => {
  const soviet = FACTIONS.soviet;

  it('is the Red Army in khaki with the red flag, the SSh-40, the T-34 and the KV-1', () => {
    expect(soviet.name).toBe('Red Army');
    expect(soviet.adjective).toBe('Soviet');
    expect(soviet.look).toEqual({ helmet: 'ssh40', tint: '#7b7650', tintDark: '#4f4b31', flag: 'sovietRed', tank: 't34', heavyTank: 'kv1' });
    expect(soviet.uiAccent).toBe('#b3261e');
    expect(soviet.unitNames.tank).toBe('T-34');
    expect(soviet.supportNames.katyusha).toBe('Katyusha Salvo');
  });

  it('draws its own vehicles in its own colours, never borrowing another nation’s markings', () => {
    for (const v of [soviet.look.tank, soviet.look.heavyTank, VEHICLE_LOOK_EXTRA.soviet.apc, VEHICLE_LOOK_EXTRA.soviet.lightTank]) {
      expect(TANK_LAYOUT[v].faction, v).toBe('soviet');
    }
  });

  it('has the massed conscripts and the Katyusha as its signature kinds', () => {
    expect(soviet.signature).toEqual({ units: ['conscript'], supports: ['katyusha'] });
    expect(nationFields('soviet', 'conscript')).toBe(true);
    expect(nationFields('british', 'conscript')).toBe(false);
    expect(nationFields('german', 'conscript')).toBe(false);
    expect(nationCallsIn('soviet', 'katyusha')).toBe(true);
    expect(nationCallsIn('german', 'katyusha')).toBe(false);
    // Shared roles stay shared.
    for (const f of FACTION_IDS) {
      expect(nationFields(f, 'rifle')).toBe(true);
      expect(nationCallsIn(f, 'artillery')).toBe(true);
    }
  });
});

describe('signature kinds', () => {
  /** Every mission the game ships plus the proving grounds. */
  const missions: readonly MissionDef[] = [...MISSIONS, SANDBOX, SANDBOX_MIRROR];

  it('belong to exactly one nation each', () => {
    const seen = new Map<string, FactionId>();
    for (const f of FACTION_IDS) {
      for (const k of [...FACTIONS[f].signature.units, ...FACTIONS[f].signature.supports]) {
        expect(seen.get(k), `${k} is a signature of two nations`).toBeUndefined();
        seen.set(k, f);
      }
    }
  });

  it('are offered by a mission only to a side of their own nation', () => {
    for (const m of missions) {
      for (const side of [0, 1] as const) {
        const nation = m.start[side].faction;
        for (const kind of m.units[side]) expect(nationFields(nation, kind), `${m.key} side ${side}: ${kind} for ${nation}`).toBe(true);
        for (const kind of m.supports[side]) expect(nationCallsIn(nation, kind), `${m.key} side ${side}: ${kind} for ${nation}`).toBe(true);
        for (const force of m.start[side].forces) expect(nationFields(nation, force.kind), `${m.key} side ${side}: placed ${force.kind}`).toBe(true);
      }
    }
  });
});

describe('the campaign registry (FOUNDATIONS.md section 6)', () => {
  it('lists Stalingrad (Soviet, missions 1001 to 1010, released), the only campaign since the British placeholders went', () => {
    expect([...CAMPAIGN_IDS].sort()).toEqual(Object.keys(CAMPAIGNS).sort());
    const s = CAMPAIGNS.stalingrad;
    expect(s.nation).toBe('soviet');
    expect(s.missionRange).toEqual({ first: 1001, last: 1010 });
    expect(s.missionIds).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
    expect(s.released).toBe(true);
    expect(CAMPAIGN_IDS).toEqual(['stalingrad']);
  });

  it('keeps every campaign’s missions inside its own id range, the ranges apart, and ids the save format accepts', () => {
    for (const id of CAMPAIGN_IDS) {
      const c = CAMPAIGNS[id];
      expect(c.id).toBe(id);
      expect(FACTION_IDS).toContain(c.nation);
      expect(new Set(c.missionIds).size).toBe(c.missionIds.length);
      for (const m of c.missionIds) {
        expect(m).toBeGreaterThanOrEqual(c.missionRange.first);
        expect(m).toBeLessThanOrEqual(c.missionRange.last);
        expect(/^[1-9][0-9]{0,3}$/.test(String(m)), `${m} fits a save`).toBe(true);
        expect(campaignOf(m)).toBe(id);
      }
    }
    for (let i = 0; i < CAMPAIGN_IDS.length; i++) {
      for (let j = 0; j < CAMPAIGN_IDS.length; j++) {
        if (i === j) continue;
        const [a, b] = [CAMPAIGN_IDS[i], CAMPAIGN_IDS[j]];
        const ra = CAMPAIGNS[a].missionRange;
        const rb = CAMPAIGNS[b].missionRange;
        expect(ra.last < rb.first || rb.last < ra.first, `${a} and ${b} overlap`).toBe(true);
      }
    }
  });

  it('places every shipped mission in a campaign of the player’s nation, and the proving ground in none', () => {
    for (const m of MISSIONS) {
      const c = campaignOf(m.id);
      expect(c, `mission ${m.id}`).not.toBeNull();
      if (c) expect(m.start[0].faction, `mission ${m.id}`).toBe(CAMPAIGNS[c].nation);
    }
    expect(campaignOf(SANDBOX.id)).toBeNull();
  });
});
