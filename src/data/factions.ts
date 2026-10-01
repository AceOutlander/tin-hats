import type { FactionDef, FactionId } from './schema';

/**
 * Factions are pure data so further nations can be added, or the Germans made
 * playable, without touching logic. Rosters are mirrored: stats come from
 * units.ts, only names and looks differ.
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
    },
    unitBlurbs: {
      sapper: 'Hauls supply crates from the dump to the HQ. Does not fight.',
      rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
      lmg: 'Long bursts that shred infantry in the open. Slow on the move.',
      assault: 'Fast, short-ranged, and carries grenades. Clears trenches and hurts pillboxes.',
      mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
      sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
      medic: 'Patches up nearby infantry. Unarmed.',
      at: 'Kills tanks and damages pillboxes. Poor against infantry.',
      tank: 'Shrugs off bullets. High-explosive gun plus machine gun. Costly.',
      heavyTank: 'A lumbering fortress on tracks.',
    },
    supportNames: {
      artillery: 'Artillery Barrage',
      smoke: 'Smoke Screen',
      airStrike: 'Typhoon Air Strike',
    },
    look: {
      helmet: 'brodie',
      tint: '#8c7b4a',
      tintDark: '#5f5331',
      flag: 'unionJack',
      tank: 'churchill',
      heavyTank: 'churchill',
    },
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
    },
    unitBlurbs: {
      sapper: 'Hauls supply crates from the dump to the HQ. Does not fight.',
      rifle: 'Cheap, steady and accurate at medium range. The backbone of the line.',
      lmg: 'Long bursts that shred infantry in the open. Slow on the move.',
      assault: 'Fast, short-ranged, and carries grenades. Clears trenches and hurts pillboxes.',
      mortar: 'Lobs explosive shells over the line. Cracks trenches and pillboxes; helpless up close.',
      sniper: 'Very long range, slow shots, fragile. Picks off gunners, mortars and medics.',
      medic: 'Patches up nearby infantry. Unarmed.',
      at: 'Kills tanks and damages pillboxes. Poor against infantry.',
      tank: 'Shrugs off bullets. High-explosive gun plus machine gun. Costly.',
      heavyTank: 'Seventy tonnes of armour with a long 88. Guards the last line.',
    },
    supportNames: {
      artillery: 'Artillery Barrage',
      smoke: 'Smoke Screen',
      airStrike: 'Stuka Air Strike',
    },
    look: {
      helmet: 'stahlhelm',
      tint: '#5d6964',
      tintDark: '#3d4643',
      flag: 'balkenkreuz',
      tank: 'panzer4',
      heavyTank: 'kingTiger',
    },
  },
};
