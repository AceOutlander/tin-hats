/**
 * Era table for the Stalingrad mission tests (not a test file itself). Until the equipment test of FOUNDATIONS 5.2
 * (src/data/equipment.ts, per look and weapon) exists, this checks rosters per unit kind: each kind stands for its
 * nation's period equipment (NATIONS.md, HISTORY.md), and a mission may field it only inside that equipment's service
 * window. The names shown for some kinds are still the 1942 to 1943 set (docs/campaigns/STALINGRAD_BUILD.md, era
 * names); the windows below are those of the period equipment the kind stands for on the mission's date.
 */
import type { FactionId, MissionDef, Side, SupportKind, UnitKind } from '../../src/data/schema';

/** A service window: ISO dates (YYYY-MM-DD), `to` inclusive; null = never fielded by this nation in this campaign. */
export interface EraWindow {
  from: string;
  to?: string;
  /** The period equipment the kind stands for. */
  as: string;
}

type EraTable<K extends string> = Record<'german' | 'soviet', Record<K, EraWindow | null>>;

export const UNIT_ERA: EraTable<UnitKind> = {
  german: {
    sapper: { from: '1935-03-16', as: 'Pioniere with satchel charges' },
    rifle: { from: '1935-06-21', as: 'Kar98k' },
    lmg: { from: '1936-01-01', as: 'MG34 (MG42 from 1942)' },
    assault: { from: '1938-01-01', as: 'MP38 and MP40' },
    mortar: { from: '1934-01-01', as: 'Granatwerfer 34' },
    sniper: { from: '1939-09-01', as: 'Kar98k with a scope' },
    medic: { from: '1935-03-16', as: 'Sanitäter' },
    at: { from: '1936-01-01', as: 'Pak 36 crew (Pak 38 from 1940, Pak 40 from 1941-11); Panzerschreck name waits for era names' },
    tank: { from: '1937-10-01', as: 'Panzer IV short (Ausf. D/E), StuG III Ausf. B; long-gun Panzer IV from 1942' },
    // No Tiger or King Tiger anywhere in this campaign (STALINGRAD.md enemy roster).
    heavyTank: { from: '1944-07-01', as: 'King Tiger (owner rule: mid-1944 on)' },
    apc: { from: '1939-09-01', as: 'SdKfz 251' },
    flame: { from: '1935-01-01', as: 'Flammenwerfer 35 (FmW 41 from 1941)' },
    commander: { from: '1935-03-16', as: 'Leutnant' },
    aa: { from: '1935-01-01', as: '2 cm Flak' },
    lightTank: { from: '1939-09-01', to: '1941-12-31', as: 'Panzer III Ausf. E, 3.7 cm (owner rule: 1939 to 1941 only)' },
    conscript: null,
  },
  soviet: {
    sapper: { from: '1918-01-01', as: 'sappers' },
    rifle: { from: '1930-01-01', as: 'Mosin-Nagant M1891/30' },
    lmg: { from: '1928-01-01', as: 'DP-27' },
    assault: { from: '1940-01-01', as: 'PPD-40 (PPSh-41 from late 1941)' },
    mortar: { from: '1937-01-01', as: '82-PM-37 (50 mm company mortars from 1938)' },
    sniper: { from: '1932-01-01', as: 'Mosin with the PE scope' },
    medic: { from: '1918-01-01', as: 'sanitarka' },
    at: { from: '1941-06-22', as: 'Tank Hunters with grenade bundles; the PTRD from 1941-11' },
    tank: { from: '1940-03-01', as: 'T-34/76' },
    heavyTank: { from: '1939-12-01', as: 'KV-1 (KV-2 from 1940)' },
    apc: { from: '1941-12-01', as: 'Lend-Lease Universal Carrier' },
    flame: { from: '1940-01-01', as: 'ROKS-2 (ROKS-3 from 1942)' },
    commander: { from: '1918-01-01', as: 'lieutenant' },
    aa: { from: '1939-01-01', as: '37 mm 61-K' },
    lightTank: { from: '1931-01-01', as: 'T-26 and BT-7 (T-60 from 1941-09, T-70 from 1942)' },
    conscript: { from: '1941-07-01', as: 'militia (opolchenie) battalions' },
  },
};

export const SUPPORT_ERA: EraTable<SupportKind> = {
  german: {
    artillery: { from: '1935-01-01', as: '10.5 cm leFH 18' },
    smoke: { from: '1935-01-01', as: 'smoke shells' },
    airStrike: { from: '1937-01-01', as: 'Ju 87 Stuka' },
    bomber: { from: '1937-01-01', as: 'He 111' },
    fighter: { from: '1937-01-01', as: 'Bf 109' },
    recon: { from: '1935-01-01', as: 'Hs 126 / Fw 189' },
    katyusha: null,
  },
  soviet: {
    artillery: { from: '1918-01-01', as: '76 mm divisional guns' },
    smoke: { from: '1918-01-01', as: 'smoke shells' },
    airStrike: { from: '1941-06-01', as: 'Il-2 (single-seat in 1941)' },
    bomber: { from: '1936-01-01', as: 'SB, then Pe-2' },
    fighter: { from: '1939-01-01', as: 'I-16, then Yak-1' },
    recon: { from: '1935-01-01', as: 'R-5, then Po-2' },
    katyusha: { from: '1941-07-14', as: 'BM-13 (first used at Orsha, 14 July 1941)' },
  },
};

/** Each Stalingrad mission's date (FOUNDATIONS 9.1 `dateIso`, which MissionDef does not carry yet). */
export const MISSION_DATE_ISO: Record<number, string> = {
  1001: '1941-06-22',
  1002: '1941-06-27',
  1003: '1941-11-16',
  1004: '1941-12-12',
  1005: '1942-09-15',
};

/** Every unit kind a side can field in a mission: trainable, placed at the start, or arriving in a wave. */
export function rosterKinds(m: MissionDef, side: Side): Set<UnitKind> {
  const kinds = new Set<UnitKind>(m.units[side]);
  for (const f of m.start[side].forces) kinds.add(f.kind);
  if (m.start[side].sappers > 0 && m.units[side].includes('sapper')) kinds.add('sapper');
  for (const e of m.events) {
    if (e.type === 'wave' && e.side === side) for (const f of e.forces) kinds.add(f.kind);
  }
  return kinds;
}

/** Why `window` does not cover `date` for this nation, or null if it does. */
export function outOfEra(window: EraWindow | null, date: string): string | null {
  if (window === null) return 'never fielded by this nation';
  if (date < window.from) return `${window.as}: not in service until ${window.from}`;
  if (window.to !== undefined && date > window.to) return `${window.as}: out of service after ${window.to}`;
  return null;
}

/** The era table's nations: the campaign fields Soviet and German sides only (Romanians come later, mission 1009). */
export function eraNation(f: FactionId): 'german' | 'soviet' {
  if (f === 'german' || f === 'soviet') return f;
  throw new Error(`no era table for ${f}`);
}
