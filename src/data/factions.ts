import type { FactionDef, FactionId, SupportKind, UnitKind } from './schema';

/**
 * Factions are pure data so further nations can be added, or the Germans made
 * playable, without touching logic. Rosters are mirrored: stats come from
 * units.ts, only names and looks differ, plus each nation's signature kinds
 * (docs/campaigns/NATIONS.md), which only that nation fields.
 */
export const FACTIONS: Record<FactionId, FactionDef> = {
  british: {
    id: 'british',
    name: 'British Army',
    adjective: 'British',
    unitNames: {
      sapper: 'Sapper',
      rifle: 'Rifleman',
      lmg: 'Bren Gunner',
      assault: 'Assault Trooper',
      mortar: 'Mortar Team',
      sniper: 'Sniper',
      medic: 'Medic',
      at: 'PIAT Team',
      tank: 'Churchill',
      heavyTank: 'Heavy Churchill',
      apc: 'Universal Carrier',
      flame: 'Flamethrower',
      commander: 'Lieutenant',
      aa: 'Bofors Crew',
      lightTank: 'Cruiser Tank',
      conscript: 'Conscript Squad',
    },
    buttonNames: { apc: 'Carrier', flame: 'Flamer', commander: 'Lt.' },
    unitBlurbs: {
      sapper: 'Carries boxes from the dump to the HQ: that is your money. Does not fight.',
      rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
      lmg: 'Long bursts that shred infantry in the open. Slow on the move.',
      assault: 'Fast, short-ranged, and carries grenades. Clears trenches and hurts pillboxes.',
      mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
      sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
      medic: 'Patches up nearby infantry. Unarmed.',
      at: 'Kills tanks and damages pillboxes. Poor against infantry.',
      tank: 'Shrugs off bullets. High-explosive gun plus machine gun. Costly.',
      heavyTank: 'A lumbering fortress on tracks.',
      apc: 'Fast and bullet-proof, with a machine gun. Carries a squad to the front.',
      flame: 'Short range. Burns out trenches and pillboxes. A hit from behind sets his fuel alight.',
      commander: 'Fragile, with a revolver. Nearby soldiers deal 5% more damage. One at a time.',
      aa: 'A quick-firing gun that shoots down or drives off enemy planes.',
      lightTank: 'A light, fast tank with a small gun.',
      conscript: 'A whole squad of poorly trained riflemen per order: cheap and many.',
    },
    supportNames: {
      artillery: 'Artillery Barrage',
      smoke: 'Smoke Screen',
      airStrike: 'Typhoon Air Strike',
      bomber: 'Bomber',
      fighter: 'Fighter',
      recon: 'Recon Plane',
      katyusha: 'Rocket Salvo',
    },
    look: {
      helmet: 'brodie',
      tint: '#8c7b4a',
      tintDark: '#5f5331',
      flag: 'unionJack',
      tank: 'churchill',
      heavyTank: 'churchill',
    },
    orders: { title: 'Operation order', stamp: 'Most secret' },
    uiAccent: '#2f4f7f',
    signature: { units: [], supports: [] },
  },
  german: {
    id: 'german',
    name: 'German Army',
    adjective: 'German',
    unitNames: {
      sapper: 'Pionier',
      rifle: 'Schütze',
      lmg: 'MG34 Gunner',
      assault: 'MP40 Trooper',
      mortar: 'Granatwerfer Team',
      sniper: 'Scharfschütze',
      medic: 'Sanitäter',
      at: 'Panzerschreck Team',
      tank: 'Panzer IV',
      heavyTank: 'King Tiger',
      apc: 'SdKfz 251',
      flame: 'Flammenwerfer',
      commander: 'Leutnant',
      aa: 'Flak Crew',
      lightTank: 'Panzer III',
      conscript: 'Conscript Squad',
    },
    buttonNames: { mortar: 'Werfer', at: 'Schreck', sniper: 'Sniper', flame: 'Flammer', commander: 'Leutnant' },
    unitBlurbs: {
      sapper: 'Carries boxes from the dump to the HQ: that is your money. Does not fight.',
      rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
      lmg: 'Long bursts that shred infantry in the open. Slow on the move.',
      assault: 'Fast, short-ranged, and carries grenades. Clears trenches and hurts pillboxes.',
      mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
      sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
      medic: 'Patches up nearby infantry. Unarmed.',
      at: 'Kills tanks and damages pillboxes. Poor against infantry.',
      tank: 'Shrugs off bullets. High-explosive gun plus machine gun. Costly.',
      heavyTank: 'Seventy tonnes of armour with a long 88. Guards the last line.',
      apc: 'Fast and bullet-proof, with a machine gun. Carries a squad to the front.',
      flame: 'Short range. Burns out trenches and pillboxes. A hit from behind sets his fuel alight.',
      commander: 'Fragile, with a pistol. Nearby soldiers deal 5% more damage. One at a time.',
      aa: 'A quick-firing gun that shoots down or drives off enemy planes.',
      lightTank: 'Fast and light, with a small gun that struggles against heavy armour.',
      conscript: 'A whole squad of poorly trained riflemen per order: cheap and many.',
    },
    supportNames: {
      artillery: 'Artillery Barrage',
      smoke: 'Smoke Screen',
      airStrike: 'Stuka Air Strike',
      bomber: 'Heinkel Bomber',
      fighter: 'Messerschmitt Fighter',
      recon: 'Storch Recon Plane',
      katyusha: 'Rocket Salvo',
    },
    look: {
      helmet: 'stahlhelm',
      tint: '#5d6964',
      tintDark: '#3d4643',
      flag: 'ironCross',
      tank: 'panzer4',
      heavyTank: 'kingTiger',
    },
    orders: { title: 'Operation order', stamp: 'Geheim' },
    uiAccent: '#4a4a4a',
    signature: { units: [], supports: [] },
  },
  soviet: {
    id: 'soviet',
    name: 'Red Army',
    adjective: 'Soviet',
    // Names of the 1942 to 1943 era (NATIONS.md section 3): the Stalingrad battles. Era-by-date names come with the
    // NationEraDef work (FOUNDATIONS.md section 5.1).
    unitNames: {
      sapper: 'Sapper',
      rifle: 'Rifleman',
      lmg: 'DP Gunner',
      assault: 'PPSh Trooper',
      mortar: 'Mortar Crew',
      sniper: 'Sniper',
      medic: 'Sanitarka',
      at: 'AT Rifle Team',
      tank: 'T-34',
      heavyTank: 'KV-1',
      apc: 'Universal Carrier',
      flame: 'ROKS Flamethrower',
      commander: 'Lieutenant',
      aa: 'AA Gun Crew',
      lightTank: 'T-60',
      conscript: 'Conscript Squad',
    },
    buttonNames: { at: 'AT Rifle', apc: 'Carrier', flame: 'Flamer', commander: 'Lt.', aa: 'AA Crew' },
    unitBlurbs: {
      sapper: 'Carries boxes from the dump to the HQ: that is your money. Does not fight.',
      rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
      lmg: 'Long bursts from a pan-fed DP. Shreds infantry in the open. Slow on the move.',
      assault: 'Fast, with a drum-fed PPSh and grenades. Clears trenches and hurts pillboxes.',
      mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
      sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
      medic: 'Patches up nearby infantry. Unarmed.',
      at: 'Two men with the long PTRD anti-tank rifle: an armour-piercing round that holes tanks from the side and damages pillboxes. Poor against infantry.',
      tank: 'Sloped armour and a 76 mm gun plus machine gun. Costly.',
      heavyTank: 'Thick armour that small guns cannot crack.',
      apc: 'Fast and bullet-proof, with a machine gun. Carries a squad to the front.',
      flame: 'Short range. Burns out trenches and pillboxes. A hit from behind sets his fuel alight.',
      commander: 'Fragile, with a pistol. Nearby soldiers deal 5% more damage. One at a time.',
      aa: 'A quick-firing gun that shoots down or drives off enemy planes.',
      lightTank: 'A light, fast tank with a small gun.',
      conscript: 'A whole squad of poorly trained riflemen per order: cheap and many. Machine guns and mortars cut them down.',
    },
    supportNames: {
      artillery: 'Artillery Barrage',
      smoke: 'Smoke Screen',
      airStrike: 'Il-2 Shturmovik',
      bomber: 'Pe-2 Bomber',
      fighter: 'Yak-1 Fighter',
      recon: 'Po-2 Recon Plane',
      katyusha: 'Katyusha Salvo',
    },
    look: {
      helmet: 'ssh40',
      tint: '#7b7650',
      tintDark: '#4f4b31',
      flag: 'sovietRed',
      tank: 't34',
      heavyTank: 'kv1',
    },
    // A Red Army combat order (boyevoy prikaz) stamped Secret (sekretno); "Most secret" was the British marking.
    orders: { title: 'Combat order', stamp: 'Secret' },
    uiAccent: '#b3261e',
    signature: { units: ['conscript'], supports: ['katyusha'] },
  },
};

/** Every nation, in FACTIONS order. */
export const FACTION_IDS: readonly FactionId[] = Object.keys(FACTIONS) as FactionId[];

/** True if `kind` is some nation's signature unit kind (NATIONS.md section 2). */
function signatureUnit(kind: UnitKind): boolean {
  return FACTION_IDS.some((f) => FACTIONS[f].signature.units.includes(kind));
}

function signatureSupport(kind: SupportKind): boolean {
  return FACTION_IDS.some((f) => FACTIONS[f].signature.supports.includes(kind));
}

/** True if the nation fields this unit kind: every shared role, and a signature kind only for its own nation. */
export function nationFields(nation: FactionId, kind: UnitKind): boolean {
  return !signatureUnit(kind) || FACTIONS[nation].signature.units.includes(kind);
}

/** True if the nation may call this support: every shared call-in, and a signature one only for its own nation. */
export function nationCallsIn(nation: FactionId, kind: SupportKind): boolean {
  return !signatureSupport(kind) || FACTIONS[nation].signature.supports.includes(kind);
}
