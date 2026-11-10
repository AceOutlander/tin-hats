/**
 * Era-correct forces by date (docs/campaigns/FOUNDATIONS.md 5.1 and 5.2; src/data/eras.ts, src/data/equipment.ts):
 * every Stalingrad mission resolves, for both sides, to names and looks inside their service windows (no PPSh, T-34-85
 * or long Panzer III in June 1941; the later Panzer III in the 1942 missions), the winter missions wear the winter
 * looks, the per-force looks and roster nations reach the units, and a mission without a date (the proving ground, Basic Training) is unchanged.
 */
import { describe, expect, it } from 'vitest';
import { AIRCRAFT_LOOKS, TANK_LAYOUT, VEHICLE_LOOKS, type VehicleLook } from '../../src/data/artLayout';
import { DEFAULT_AIRCRAFT, EQUIPMENT, SIM_WEAPON_EQUIPMENT, outOfService } from '../../src/data/equipment';
import {
  INFANTRY_LOOKS,
  NATION_ERAS,
  VEHICLE_KINDS,
  defaultVehicleLooks,
  infantryLookOf,
  isVehicleKind,
  missionEra,
  resolveEra,
  unitDisplayName,
  unitVehicleLook,
  type ResolvedEra,
} from '../../src/data/eras';
import { FACTION_IDS, FACTIONS } from '../../src/data/factions';
import { FIGURE_LOADOUT, WEAPON_GEOM } from '../../src/data/figure';
import { isFigureKind } from '../../src/art/figure';
import { FIGURE_CLOTHING, FIGURE_HEADGEAR } from '../../src/data/looksGear';
import { FIELD } from './fixtures';
import { SANDBOX, SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { BASIC_TRAINING } from '../../src/data/missions/training';
import type { FactionId, ForceDef, MissionDef, Side, SupportKind, UnitKind } from '../../src/data/schema';
import { UNITS, UNIT_KINDS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { vehicleLookOf } from '../../src/art/vehicles';
import { makeBattle, run, testMission, unitsOf } from './sim-helpers';

const AIR: readonly ('airStrike' | 'bomber' | 'fighter' | 'recon')[] = ['airStrike', 'bomber', 'fighter', 'recon'];

/** Every force a side fields: its start forces and every wave of that side. */
function forcesOf(m: MissionDef, side: Side): ForceDef[] {
  const out = [...m.start[side].forces];
  for (const e of m.events) if (e.type === 'wave' && e.side === side) out.push(...e.forces);
  return out;
}

interface Fielded {
  /** Equipment ids fielded (vehicle, weapon, aircraft and infantry looks), each with what fields it. */
  equipment: Map<string, string>;
  vehicles: Set<VehicleLook>;
  names: Set<string>;
}

/** What a side of a mission fields on its date: its trainable kinds, start forces, waves and call-ins, resolved. */
function fielded(m: MissionDef, side: Side): Fielded {
  const nation = m.start[side].faction;
  const era = missionEra(m, nation);
  const out: Fielded = { equipment: new Map(), vehicles: new Set(), names: new Set() };
  const add = (id: string, what: string): void => {
    if (!out.equipment.has(id)) out.equipment.set(id, what);
  };
  const unit = (kind: UnitKind, look: string, e: ResolvedEra, f: FactionId): void => {
    out.names.add(unitDisplayName(e, kind, look));
    if (isVehicleKind(kind)) {
      const v = unitVehicleLook(e, kind, look);
      out.vehicles.add(v);
      add(v, `${f} ${kind}`);
      return;
    }
    const inf = infantryLookOf(look);
    if (inf) add(look, `${f} ${kind}`);
    if (isFigureKind(kind)) add(e.weapon[kind] ?? FIGURE_LOADOUT[f].weapon[kind], `${f} ${kind}`);
    // What the sim fires (the anti-tank kind's rifle, bundles or rocket; ResolvedEra.arms): the same window.
    const fires = e.arms[kind] ?? UNITS[kind].weapon;
    const eq = fires !== null ? SIM_WEAPON_EQUIPMENT[fires]?.[f as 'british' | 'german' | 'soviet'] : undefined;
    if (eq !== undefined) add(eq, `${f} ${kind} (${fires})`);
  };
  for (const kind of m.units[side]) unit(kind, '', era, nation);
  if (m.start[side].sappers > 0 && m.units[side].includes('sapper')) unit('sapper', '', era, nation);
  for (const f of forcesOf(m, side)) {
    const fNation = f.nation ?? m.start[side].rosterNation?.[f.kind] ?? nation;
    unit(f.kind, f.look ?? '', missionEra(m, fNation), fNation);
  }
  for (const s of m.supports[side] as SupportKind[]) {
    out.names.add(era.supportNames[s]);
    if ((AIR as readonly string[]).includes(s) && (nation === 'german' || nation === 'soviet')) {
      const k = s as (typeof AIR)[number];
      add(era.aircraft[k] ?? DEFAULT_AIRCRAFT[nation][k], `${nation} ${s}`);
    }
  }
  return out;
}

const STAL = STALINGRAD_MISSIONS.map((m) => [m.id, m] as const);
const M = (id: number): MissionDef => {
  const m = STALINGRAD_MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`no mission ${id}`);
  return m;
};

describe('the era table (FOUNDATIONS.md 5.1)', () => {
  it('has eras for every nation, each a valid month range with a unique id', () => {
    const ids = new Set<string>();
    for (const f of FACTION_IDS) {
      expect(NATION_ERAS[f].length, f).toBeGreaterThan(0);
      for (const e of NATION_ERAS[f]) {
        expect(ids.has(e.id), e.id).toBe(false);
        ids.add(e.id);
        expect(e.from, e.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(e.to, e.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(e.from <= e.to, e.id).toBe(true);
      }
    }
  });

  it('names only looks that are drawn and worn by that nation', () => {
    for (const f of FACTION_IDS) {
      for (const e of NATION_ERAS[f]) {
        const L = e.look ?? {};
        for (const v of Object.values(L.vehicle ?? {})) {
          expect(VEHICLE_LOOKS, `${e.id} ${v}`).toContain(v);
          expect(TANK_LAYOUT[v].faction, `${e.id} ${v}`).toBe(f);
        }
        for (const w of Object.values(L.weapon ?? {})) expect(WEAPON_GEOM[w], `${e.id} ${w}`).toBeDefined();
        for (const a of Object.values(L.aircraft ?? {})) expect(AIRCRAFT_LOOKS[a].faction, `${e.id} ${a}`).toBe(f);
        for (const h of Object.values(L.headgear ?? {})) if (h) expect(FIGURE_HEADGEAR[f], `${e.id} ${h}`).toContain(h);
        for (const c of Object.values(L.clothing ?? {})) if (c) expect(FIGURE_CLOTHING[f], `${e.id} ${c}`).toContain(c);
      }
    }
    for (const [id, look] of Object.entries(INFANTRY_LOOKS)) {
      expect(FIGURE_HEADGEAR[look.nation], id).toContain(look.headgear);
      expect(FIGURE_CLOTHING[look.nation], id).toContain(look.clothing);
    }
  });

  it('gives a mission without a date every nation’s defaults: today’s names and looks', () => {
    for (const f of FACTION_IDS) {
      const e = resolveEra(f, null);
      expect(e.eras).toEqual([]);
      expect(e.names).toEqual(FACTIONS[f].unitNames);
      expect(e.supportNames).toEqual(FACTIONS[f].supportNames);
      expect(e.buttonNames).toEqual(FACTIONS[f].buttonNames);
      expect(e.blurbs).toEqual(FACTIONS[f].unitBlurbs);
      for (const kind of VEHICLE_KINDS) expect(e.vehicle[kind], `${f} ${kind}`).toBe(vehicleLookOf(kind, f));
      expect([e.headgear, e.clothing, e.weapon, e.rocketItem, e.aircraft]).toEqual([{}, {}, {}, {}, {}]);
    }
  });
});

describe('a mission without a date is unchanged (the proving ground, Basic Training, the test field)', () => {
  it.each([FIELD, SANDBOX, SANDBOX_MIRROR, BASIC_TRAINING].map((m) => [m.id, m] as const))(
    'mission %i has no date for the era table, so both sides show their default names and looks',
    (_id, m) => {
      expect(m.dateIso).toBeUndefined();
      for (const side of [0, 1] as const) {
        const f = m.start[side].faction;
        const e = missionEra(m, f);
        expect(e.names).toEqual(FACTIONS[f].unitNames);
        expect(e.vehicle).toEqual(defaultVehicleLooks(f));
        for (const force of forcesOf(m, side)) expect(force.look, `${m.id} ${force.kind}`).toBeUndefined();
        expect(m.start[side].rosterNation).toBeUndefined();
      }
    },
  );
});

describe('every Stalingrad mission is era-correct for both sides (FOUNDATIONS.md 5.2)', () => {
  it.each(STAL)('mission %i has an ISO date matching its date line, and a climate', (_id, m) => {
    expect(m.dateIso).toMatch(/^19(41|42|43)-\d{2}-\d{2}$/);
    expect(m.date).toContain(m.dateIso?.slice(0, 4));
    expect(m.climate).toBeDefined();
  });

  it.each(STAL)('mission %i fields every vehicle, weapon, aircraft and infantry look inside its service window', (_id, m) => {
    const date = m.dateIso ?? '';
    for (const side of [0, 1] as const) {
      const f = fielded(m, side);
      for (const [id, what] of f.equipment) expect(outOfService(id, date), `${what}: ${id}`).toBeNull();
      // Every vehicle look is in the equipment table (a look with no window would escape the test).
      for (const v of f.vehicles) expect(EQUIPMENT[v], `${m.id} side ${side} ${v}`).toBeDefined();
    }
  });

  it.each(STAL)('mission %i names only per-force looks of the right kind and nation', (_id, m) => {
    for (const side of [0, 1] as const) {
      for (const force of forcesOf(m, side)) {
        if (force.look === undefined) continue;
        const nation = force.nation ?? m.start[side].rosterNation?.[force.kind] ?? m.start[side].faction;
        const inf = infantryLookOf(force.look);
        if (inf) {
          expect(isVehicleKind(force.kind), `${m.id} ${force.kind} ${force.look}`).toBe(false);
          expect(inf.nation, `${m.id} ${force.look}`).toBe(nation);
        } else {
          expect(isVehicleKind(force.kind), `${m.id} ${force.kind} ${force.look}`).toBe(true);
          expect(TANK_LAYOUT[force.look as VehicleLook].faction, `${m.id} ${force.look}`).toBe(nation);
        }
      }
    }
  });

  it('shows no PPSh, T-34-85 or long Panzer III in June 1941, and the 1941 Red Army of the brief', () => {
    for (const id of [1001, 1002]) {
      const m = M(id);
      const sov = fielded(m, 0);
      const ger = fielded(m, 1);
      for (const f of [sov, ger]) {
        expect([...f.equipment.keys()], `${id}`).not.toContain('ppsh');
        expect([...f.equipment.keys()], `${id}`).not.toContain('ptrd');
        for (const late of ['panzer3l', 'panzer4g', 'stug3f'] as const) expect(f.vehicles.has(late), `${id} ${late}`).toBe(false);
        for (const n of f.names) expect(n, `${id}`).not.toMatch(/PPSh|T-34-?\/?85|Panzerschreck|Ausf\. [JLG]\b/);
      }
      const e = missionEra(m, 'soviet');
      expect([e.names.assault, e.names.at, e.names.conscript, e.names.lightTank, e.supportNames.fighter]).toEqual([
        'PPD Trooper',
        'Tank Hunters',
        'Militia Squad',
        'BT-7',
        'I-16 Fighter',
      ]);
      expect(e.weapon.assault).toBe('ppd');
      expect(e.aircraft.fighter).toBe('i16');
      // Summer: caps for the rear ranks, helmets at the front, no winter clothing.
      expect(e.headgear.sapper).toBe('pilotka');
      expect(e.headgear.rifle).toBeUndefined();
      expect(e.clothing).toEqual({});
    }
    // Dubno: the KV-2 among the KVs and the T-26s with the BT-7s; the German Panzer III with both guns.
    const dubno = fielded(M(1002), 0);
    for (const v of ['kv1', 'kv2', 't34', 'bt7', 't26'] as const) expect(dubno.vehicles.has(v), v).toBe(true);
    expect(dubno.names).toContain('KV-2');
    expect(dubno.names).toContain('T-26');
    const dubnoGer = fielded(M(1002), 1);
    for (const v of ['panzer3', 'panzer3h', 'panzer4'] as const) expect(dubnoGer.vehicles.has(v), v).toBe(true);
    // Brest: the StuG III Ausf. B battery.
    const brestTanks = forcesOf(M(1001), 1).filter((f) => f.kind === 'tank');
    expect(brestTanks.length).toBe(2);
    for (const t of brestTanks) expect(t.look).toBe('stug3b');
  });

  it('brings the PTRD in November 1941 and keeps the PPD through 1941', () => {
    for (const id of [1003, 1004]) {
      const e = missionEra(M(id), 'soviet');
      expect(e.names.at, `${id}`).toBe('AT Rifle Team');
      expect(e.names.assault, `${id}`).toBe('PPD Trooper');
      expect(e.weapon.at, `${id}`).toBeUndefined();
    }
    for (const id of [1005, 1006, 1007, 1008, 1009, 1010]) {
      const e = missionEra(M(id), 'soviet');
      expect([e.names.assault, e.names.at, e.names.conscript], `${id}`).toEqual(['PPSh Trooper', 'AT Rifle Team', 'Conscript Squad']);
      expect(e.weapon.assault, `${id}`).toBeUndefined();
      expect(e.aircraft.fighter, `${id}`).toBeUndefined();
    }
  });

  it('fields the later Panzer III in every 1942 mission and the Ausf. E only in 1941', () => {
    for (const m of STALINGRAD_MISSIONS) {
      const ger = fielded(m, 1);
      const y1942 = (m.dateIso ?? '') >= '1942-06';
      expect(ger.vehicles.has('panzer3l'), `${m.id} later Panzer III`).toBe(y1942);
      if (y1942) {
        expect(ger.vehicles.has('panzer3'), `${m.id} Panzer III Ausf. E`).toBe(false);
        expect(ger.vehicles.has('panzer4'), `${m.id} short Panzer IV`).toBe(false);
        expect(missionEra(m, 'german').names.tank).toBe('Panzer III Ausf. L');
      }
      // No Panzerschreck before November 1943: the PzB 39 team.
      expect(missionEra(m, 'german').names.at, `${m.id}`).toBe('PzB 39 Team');
      expect([...ger.equipment.keys()], `${m.id}`).not.toContain('panzerschreck');
    }
    // The long Panzer IV and the StuG III Ausf. F appear in the city and the steppe.
    const all1942 = STALINGRAD_MISSIONS.filter((m) => (m.dateIso ?? '') >= '1942-06').flatMap((m) => [...fielded(m, 1).vehicles]);
    expect(all1942).toContain('panzer4g');
    expect(all1942).toContain('stug3f');
  });

  it('dresses the winter missions for the snow: the ushanka and telogreika, snipers in smocks', () => {
    for (const id of [1003, 1004, 1009, 1010]) {
      const m = M(id);
      expect(m.climate, `${id}`).toBe('winter');
      const e = missionEra(m, 'soviet');
      expect([e.headgear.rifle, e.clothing.rifle], `${id} rifleman`).toEqual(['helmetUshanka', 'telogreika']);
      expect([e.headgear.sapper, e.clothing.sapper], `${id} sapper`).toEqual(['ushanka', 'telogreika']);
      expect([e.headgear.sniper, e.clothing.sniper], `${id} sniper`).toEqual(['snowHood', 'snowSmock']);
    }
    for (const id of [1005, 1006, 1007, 1008]) {
      const e = missionEra(M(id), 'soviet');
      expect(e.clothing, `${id}`).toEqual({});
      expect(e.headgear.mortar, `${id}`).toBe('pilotka');
    }
    // The Germans had no winter kit in 1941; in November 1942 helmet covers and the white winter suit at the front;
    // in the pocket in January 1943 covered helmets over greatcoats.
    for (const id of [1003, 1004]) {
      const e = missionEra(M(id), 'german');
      expect([e.headgear, e.clothing], `${id}`).toEqual([{}, {}]);
    }
    const uranus = missionEra(M(1009), 'german');
    expect([uranus.headgear.rifle, uranus.clothing.rifle]).toEqual(['helmetCover', 'snowSmock']);
    expect(uranus.clothing.sapper).toBeUndefined();
    const ring = missionEra(M(1010), 'german');
    expect([ring.headgear.rifle, ring.clothing.rifle]).toEqual(['helmetCover', undefined]);
    // Klin's ski troops go in white.
    const ski = M(1004).start[0].forces.find((f) => f.look === 'skiTroops');
    expect(ski?.kind).toBe('assault');
  });

  it('fields the Romanian line of mission 1009 as German troops in the Romanian look', () => {
    const m = M(1009);
    const romanian = forcesOf(m, 1).filter((f) => f.look === 'romanian');
    expect(romanian.length).toBeGreaterThanOrEqual(5);
    // The Romanian line (trenches 2 and 3) and Perelazovsky (its houses, buildings 2 and 3; trench 4 before buildings,
    // FOUNDATIONS.md 4.3).
    expect(new Set(romanian.filter((f) => f.buildingId === undefined).map((f) => f.trenchId))).toEqual(new Set([2, 3]));
    expect(new Set(romanian.filter((f) => f.trenchId === undefined).map((f) => f.buildingId))).toEqual(new Set([2, 3]));
    const look = INFANTRY_LOOKS.romanian;
    expect([look.nation, look.headgear, look.clothing]).toEqual(['german', 'adrian', 'greatcoatRomanian']);
    expect(unitDisplayName(missionEra(m, 'german'), 'rifle', 'romanian')).toContain('Romanian');
    expect(m.start[1].faction).toBe('german');
  });
});

describe('per-force looks and roster nations reach the units (FOUNDATIONS.md 5.1)', () => {
  it('carries ForceDef.look onto the spawned units, start forces and waves alike, and names them by it', () => {
    const b = makeBattle({
      mission: testMission({
        length: 6000,
        a: { forces: [{ kind: 'heavyTank', count: 1, x: 900, look: 'kv2' }, { kind: 'heavyTank', count: 1, x: 1000 }] },
        events: [{ type: 'wave', when: { at: 0.5 }, side: 1, forces: [{ kind: 'rifle', count: 2, x: 5000, look: 'romanian' }] }],
      }),
    });
    run(b, 1);
    const kvs = unitsOf(b, 0, 'heavyTank');
    expect(kvs.map((u) => u.look).sort()).toEqual(['', 'kv2']);
    expect(unitsOf(b, 1, 'rifle').map((u) => u.look)).toEqual(['romanian', 'romanian']);
    const era = missionEra(b.config.mission, 'british');
    expect(unitDisplayName(era, 'heavyTank', 'kv2')).toBe('KV-2');
    expect(unitDisplayName(era, 'heavyTank', '')).toBe(era.names.heavyTank);
  });

  it('fields a kind as another nation with SideStart.rosterNation, and a force as one with ForceDef.nation', () => {
    const b = makeBattle({
      mission: testMission({
        length: 6000,
        b: {
          faction: 'german',
          rosterNation: { lightTank: 'soviet' },
          forces: [
            { kind: 'lightTank', count: 1, x: 5000 },
            { kind: 'rifle', count: 1, x: 5100, nation: 'soviet' },
            { kind: 'rifle', count: 1, x: 5200 },
          ],
        },
      }),
    });
    run(b, 0.2);
    expect(unitsOf(b, 1, 'lightTank').map((u) => u.faction)).toEqual(['soviet']);
    expect(unitsOf(b, 1, 'rifle').map((u) => u.faction).sort()).toEqual(['german', 'soviet']);
    // A trained unit of the roster kind is that nation's too.
    expect(b.state.sides[1].faction).toBe('german');
  });

  it('keeps every unit kind named in every era of every nation', () => {
    for (const f of FACTION_IDS) {
      for (const m of [...STALINGRAD_MISSIONS, FIELD]) {
        const e = missionEra(m, f);
        for (const kind of UNIT_KINDS) expect(e.names[kind], `${m.id} ${f} ${kind}`).toBeTruthy();
      }
    }
  });
});

describe('anti-tank units by era (owner, 2026-11-09; DECISIONS 455)', () => {
  it('never gives the Red Army a rocket: Tank Hunters with bundles before November 1941, the AT Rifle Team after', () => {
    for (const m of STALINGRAD_MISSIONS) {
      const e = missionEra(m, 'soviet');
      const fires = e.arms.at ?? UNITS.at.weapon;
      expect(fires, `${m.id}`).not.toBe('rocket');
      expect(WEAPONS[fires ?? ''].projectileLook, `${m.id}`).not.toBe('rocket');
      if ((m.dateIso ?? '') < '1941-11') {
        expect([e.names.at, e.buttonNames.at, fires], `${m.id}`).toEqual(['Tank Hunters', 'AT Bundle', 'atGrenades']);
      } else {
        expect([e.names.at, e.buttonNames.at, fires], `${m.id}`).toEqual(['AT Rifle Team', 'AT Rifle', 'atRifle']);
      }
    }
    // Without a date (the proving ground): the AT Rifle Team too.
    expect(resolveEra('soviet', null).arms.at).toBe('atRifle');
  });

  it('gives the German anti-tank kind the PzB 39 rifle until the Panzerschreck of November 1943', () => {
    for (const m of STALINGRAD_MISSIONS) {
      const e = missionEra(m, 'german');
      expect([e.names.at, e.arms.at], `${m.id}`).toEqual(['PzB 39 Team', 'atRifle']);
    }
    expect(resolveEra('german', '1944-06-06').arms.at).toBeUndefined();
    expect(resolveEra('german', '1944-06-06').names.at).toBe('Panzerschreck Team');
  });

  it('fires an armour-piercing round with no rocket and no backblast, or throws the bundle from close up', () => {
    const rifle = WEAPONS.atRifle;
    const rocket = WEAPONS.rocket;
    // The anti-tank role stays mirrored: the rifle has the rocket's numbers (DECISIONS 424 to 427 hold for both).
    for (const k of ['damageType', 'damage', 'range', 'aimTime', 'cooldown', 'projectileSpeed', 'splashRadius', 'scatter', 'targets', 'prefer'] as const) {
      expect(rifle[k], k).toEqual(rocket[k]);
    }
    expect([rifle.projectileLook, rifle.sound, rifle.thrown]).toEqual(['apRound', 'atRifleShot', false]);
    const bundle = WEAPONS.atGrenades;
    expect(bundle.thrown).toBe(true);
    expect(bundle.projectileLook).toBe('molotov');
    expect(bundle.range).toBeLessThan(rocket.range / 2);
    expect(bundle.damageType).toBe('antiTank');
  });

  it('arms the units in the sim by their era: what is drawn is what fires', () => {
    const at = (m: MissionDef, side: Side): string[] => {
      const b = makeBattle({ mission: m });
      run(b, 0.5);
      return unitsOf(b, side, 'at').map((u) => u.mount.weapon?.id ?? '');
    };
    const brest = { ...testMission({ length: 6000, a: { faction: 'soviet', forces: [{ kind: 'at', count: 2, x: 900 }] } }), dateIso: '1941-06-22' };
    expect(at(brest, 0)).toEqual(['atGrenades', 'atGrenades']);
    const city = { ...testMission({ length: 6000, a: { faction: 'soviet', forces: [{ kind: 'at', count: 1, x: 900 }] }, b: { faction: 'german', forces: [{ kind: 'at', count: 1, x: 5000 }] } }), dateIso: '1942-09-15' };
    expect(at(city, 0)).toEqual(['atRifle']);
    expect(at(city, 1)).toEqual(['atRifle']);
    // The British PIAT and a dateless German Panzerschreck keep the kind's rocket.
    expect(at(testMission({ length: 6000, a: { forces: [{ kind: 'at', count: 1, x: 900 }] } }), 0)).toEqual(['rocket']);
  });

  it('says on every Soviet unit button what the unit is (no bare "Hunters")', () => {
    for (const m of STALINGRAD_MISSIONS) {
      const e = missionEra(m, 'soviet');
      for (const kind of m.units[0]) {
        const label = e.buttonNames[kind] ?? e.names[kind];
        expect(label, `${m.id} ${kind}`).not.toMatch(/^(Hunters|Schreck|Werfer|Flammer)$/);
      }
    }
  });
});
