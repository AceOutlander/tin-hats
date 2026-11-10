/**
 * The equipment table (docs/campaigns/FOUNDATIONS.md 5.2): the service window of every vehicle, aircraft, small-arms
 * and infantry look the era table (./eras) or a force (ForceDef.look) can field, from docs/campaigns/HISTORY.md
 * ("equipment by date") and NATIONS.md. tests/unit/eras.test.ts resolves every Stalingrad mission's rosters, start
 * forces, waves and call-ins and fails on a look fielded outside its window. Windows are 'YYYY-MM', both inclusive;
 * `to` absent = to the end of the war. Looks the Stalingrad campaign never fields (the British set) have no window.
 */
export interface EquipmentWindow {
  from: string;
  to?: string;
  note: string;
}

export const EQUIPMENT: Record<string, EquipmentWindow> = {
  // Soviet vehicles.
  t26: { from: '1933-01', to: '1942-12', note: 'T-26 model 1933; the most numerous Soviet tank in June 1941, rare after 1942' },
  bt7: { from: '1935-01', to: '1942-12', note: 'BT-7 model 1937' },
  t60: { from: '1941-09', note: 'T-60, from autumn 1941 (stands in for the T-70 of 1942)' },
  t34: { from: '1940-06', note: 'T-34/76; about 1,000 at the front in June 1941. The T-34-85 (1944-03) is not drawn' },
  kv1: { from: '1939-12', to: '1943-12', note: 'KV-1' },
  kv2: { from: '1940-02', to: '1941-12', note: 'KV-2; rare after 1941' },
  carrierSoviet: { from: '1941-12', note: 'Lend-Lease Universal Carrier' },
  // German vehicles.
  panzer3: { from: '1939-09', to: '1941-12', note: 'Panzer III Ausf. E, 3.7 cm; owner rule: 1939 to 1941 only' },
  panzer3h: { from: '1940-10', to: '1942-12', note: 'Panzer III Ausf. G/H, short 5 cm L/42' },
  panzer3l: { from: '1942-06', to: '1943-12', note: 'Panzer III Ausf. L, long 5 cm L/60, spaced armour; no skirts before 1943' },
  panzer4: { from: '1939-01', to: '1942-12', note: 'Panzer IV Ausf. D/E/F1, short 7.5 cm' },
  panzer4g: { from: '1942-03', note: 'Panzer IV Ausf. F2/G, long 7.5 cm L/43' },
  stug3b: { from: '1940-05', to: '1942-06', note: 'StuG III Ausf. A/B, short 7.5 cm; the likely model at Brest' },
  stug3f: { from: '1942-03', note: 'StuG III Ausf. F, long 7.5 cm L/43' },
  halftrack: { from: '1939-09', note: 'Sd.Kfz. 251' },
  kingTiger: { from: '1944-07', note: 'owner rule: mid-1944 on, only where mission data places it' },
  // Soviet small arms.
  mosin: { from: '1930-01', note: 'Mosin-Nagant 1891/30 (also the Tank Hunters\' rifle)' },
  mosinScoped: { from: '1932-01', note: 'Mosin sniper rifle; PE/PEM scope to 1942, then PU (the difference does not show at phone size)' },
  dp27: { from: '1928-01', note: 'DP-27' },
  ppd: { from: '1940-01', to: '1942-12', note: 'PPD-40' },
  ppsh: { from: '1941-11', note: 'PPSh-41: late 1941 at Moscow, mass from 1942' },
  ptrd: { from: '1941-11', note: 'PTRD-41: first issued to the 316th Rifle Division before 16 November 1941' },
  mortar82: { from: '1937-01', note: '82-PM-37' },
  tt33: { from: '1933-01', note: 'TT-33' },
  // German small arms.
  kar98: { from: '1935-06', note: 'Kar98k' },
  kar98Scoped: { from: '1939-09', note: 'Kar98k with a scope' },
  mg34: { from: '1936-01', note: 'MG34 (the MG42 from 1942 is not drawn; the MG34 stayed in service)' },
  mp40: { from: '1939-09', note: 'MP38 and MP40' },
  mortar: { from: '1934-01', note: 'Granatwerfer 34' },
  pzb39: { from: '1939-09', to: '1943-12', note: 'PzB 39 anti-tank rifle (GrB 39 from 1942)' },
  panzerschreck: { from: '1943-11', note: 'Panzerschreck: East from November 1943' },
  // Shared pieces.
  flamer: { from: '1935-01', note: 'the shared flamethrower (Flammenwerfer 35/41; stands in for the ROKS-2 and ROKS-3)' },
  pistol: { from: '1908-01', note: 'Luger P08 / Walther P38' },
  // Aircraft.
  i16: { from: '1934-01', to: '1943-06', note: 'I-16; the most numerous Soviet fighter in 1941' },
  yak1: { from: '1941-01', note: 'Yak-1' },
  pe2: { from: '1941-06', note: 'Pe-2; few in June 1941' },
  po2: { from: '1928-01', note: 'Po-2' },
  il2: { from: '1941-06', note: 'Il-2 (single-seat in 1941)' },
  ju87: { from: '1937-01', to: '1944-12', note: 'Ju 87 Stuka' },
  he111: { from: '1937-01', note: 'He 111' },
  bf109: { from: '1937-01', note: 'Bf 109' },
  fi156: { from: '1939-01', note: 'Fi 156 Storch' },
  // Infantry looks (ForceDef.look).
  romanian: { from: '1941-06', to: '1944-08', note: 'the Romanian Army on the Eastern Front (mission 1009)' },
};

/** The aircraft each nation flies on a call-in when no era look replaces it (for the equipment test). */
export const DEFAULT_AIRCRAFT: Record<'german' | 'soviet', Record<'airStrike' | 'bomber' | 'fighter' | 'recon', string>> = {
  german: { airStrike: 'ju87', bomber: 'he111', fighter: 'bf109', recon: 'fi156' },
  soviet: { airStrike: 'il2', bomber: 'pe2', fighter: 'yak1', recon: 'po2' },
};

/** Why a look fielded on `dateIso` ('YYYY-MM-DD') is out of its window, or null if it is in service (or has no window). */
export function outOfService(look: string, dateIso: string): string | null {
  const w = EQUIPMENT[look];
  if (!w) return null;
  const month = dateIso.slice(0, 7);
  if (month < w.from) return `${look} (${w.note}): not in service until ${w.from}`;
  if (w.to !== undefined && month > w.to) return `${look} (${w.note}): out of service after ${w.to}`;
  return null;
}
