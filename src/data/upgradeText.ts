/**
 * The Quartermaster's upgrade names and one-line texts, per nation (owner, 2026-11-09: "Every upgrade's name,
 * description and picture must come from the selected campaign's nation"). Ids, levels, costs and effects stay shared
 * across nations (src/data/upgrades.ts; saves and balance are unchanged): only the words differ. One entry per unit
 * type per nation, keyed by the unit type (not its name), so a unit renamed in src/data/factions.ts keeps its text;
 * the HQ, sapper and call-in tracks are keyed by upgrade id. The British text is also the upgrades' own default.
 */
import type { FactionId, UnitKind } from './schema';

/** Name and one-line text of one upgrade track. */
export interface TrackText {
  name: string;
  description: string;
}

/** A unit type's two tracks: its health track and its damage track (healing for a unit that heals). */
export interface UnitUpgradeText {
  health: TrackText;
  /** The damage track, or the healing track of a unit that heals instead of fighting. */
  second: TrackText;
}

/** The nations the player commands, which have their own upgrade text (the Germans are never the player's side). */
export type UpgradeTextNation = Exclude<FactionId, 'german'>;

export const UNIT_UPGRADE_TEXT: Record<UpgradeTextNation, Partial<Record<UnitKind, UnitUpgradeText>>> = {
  british: {
    rifle: {
      health: { name: 'Rifleman Fieldcraft', description: 'Riflemen keep their heads down.' },
      second: { name: 'Rifleman Musketry', description: 'Riflemen train on the range until every round counts.' },
    },
    lmg: {
      health: { name: 'Bren Gun Pits', description: 'Bren gunners dig in faster and deeper.' },
      second: { name: 'Bren Gun Drill', description: 'Faster magazine changes and tighter bursts.' },
    },
    assault: {
      health: { name: 'Assault Conditioning', description: 'Assault Troopers are hardened by battle school.' },
      second: { name: 'Close Quarter Battle', description: 'Assault Troopers hit harder with gun and grenade.' },
    },
    mortar: {
      health: { name: 'Mortar Pit Drill', description: 'Mortar crews site their pits under cover.' },
      second: { name: 'Mortar Ranging', description: 'Mortar crews bracket the target sooner.' },
    },
    sniper: {
      health: { name: 'Sniper Camouflage', description: 'Snipers use scrim and ghillie to stay alive.' },
      second: { name: 'Telescopic Sights', description: 'Better optics for the sniper rifle.' },
    },
    medic: {
      health: { name: 'Medic Armbands', description: 'Medics learn to move between cover.' },
      second: { name: 'Field Dressings', description: 'Medics carry better kit and patch men up faster.' },
    },
    at: {
      health: { name: 'PIAT Team Cover', description: 'PIAT teams stalk from better cover.' },
      second: { name: 'PIAT Bomb Drill', description: 'PIAT teams aim for the weak spots.' },
    },
    tank: {
      health: { name: 'Appliqué Armour', description: 'Extra plates bolted to the Churchill.' },
      second: { name: 'Tank Gunnery School', description: 'Churchill crews lay their guns faster and truer.' },
    },
    apc: {
      health: { name: 'Carrier Armour', description: 'Spare track and sandbags turn more bullets off the Carrier.' },
      second: { name: 'Carrier Gunnery', description: 'More ammunition and a second gun for the Carrier crew.' },
    },
    flame: {
      health: { name: 'Flamer Protection', description: 'Flamethrowers learn to work from cover in heat-proof kit.' },
      second: { name: 'Fuel Mixture', description: 'A thicker fuel that clings and burns hotter.' },
    },
    commander: {
      health: { name: 'Officer Training', description: 'The Lieutenant keeps low and leads from cover.' },
      second: { name: 'Revolver Practice', description: 'The Lieutenant shoots straighter with his own revolver. His aura is unchanged.' },
    },
    aa: {
      health: { name: 'Gun Pit Revetment', description: 'Bofors crews dig their gun pit deeper.' },
      second: { name: 'Predictor Drill', description: 'Bofors crews lead their targets and hit harder.' },
    },
  },
  // The Red Army of 1941 to 1943: Mosin and PPSh, the DP, the 82 mm mortar, anti-tank rifles, T-34 crews, the 37 mm AA
  // gun, the sanitarka and the storm groups of Stalingrad. The anti-tank text names the weapon, not the unit, so it
  // fits whatever that unit is called.
  soviet: {
    rifle: {
      health: { name: 'Dig In Deep', description: 'Riflemen dig in with the entrenching spade and keep low.' },
      second: { name: 'Mosin Marksmanship', description: 'Range drill with the Mosin until every round counts.' },
    },
    lmg: {
      health: { name: 'DP Gun Nests', description: 'DP gunners site their nests in rubble and dig them deeper.' },
      second: { name: 'Pan Magazine Drill', description: 'Quicker pan changes and short, sure bursts from the DP.' },
    },
    assault: {
      health: { name: 'Storm Group Training', description: 'PPSh troopers learn to cross the ruins from cover to cover.' },
      second: { name: 'Grenade, Then PPSh', description: 'A grenade through the door, then the drum: rooms and trenches fall faster.' },
    },
    mortar: {
      health: { name: '82 mm Pit Drill', description: 'The 82 mm crews site their pits behind walls and in craters.' },
      second: { name: 'Forward Observer', description: 'A spotter with a field telephone: the 82 mm brackets the target sooner.' },
    },
    sniper: {
      health: { name: 'Camouflage Capes', description: 'Snipers lie up under capes and rubble and are seldom seen.' },
      second: { name: 'PU Scope', description: 'A better PU scope on the Mosin sniper rifle.' },
    },
    medic: {
      health: { name: 'Crawl to the Wounded', description: 'The sanitarka crawls between cover to reach the wounded.' },
      second: { name: 'Dressing Packs', description: 'Better dressings in the bag: she patches men up faster.' },
    },
    at: {
      health: { name: 'Anti-tank Rifle Pits', description: 'The anti-tank riflemen fire from deep, narrow slit trenches.' },
      second: { name: 'Aim for the Tracks', description: 'Shots placed on tracks, sides and vision slits, where the armour is thin.' },
    },
    tank: {
      health: { name: 'Welded Plates', description: 'Extra plates welded on the T-34\'s hull and turret at the factory.' },
      second: { name: 'Tank Gunnery Courses', description: 'T-34 crews lay the 76 mm gun faster and truer.' },
    },
    apc: {
      health: { name: 'Carrier Armour', description: 'Spare track links and sandbags turn more bullets off the Carrier.' },
      second: { name: 'Carrier DP Drill', description: 'More pans for the DP on the Carrier, and a crew that fires on the move.' },
    },
    flame: {
      health: { name: 'Flame Section Cover', description: 'ROKS men learn to creep up from cover in heavy canvas.' },
      second: { name: 'Thickened Fuel', description: 'A thicker fuel that clings to walls and burns hotter.' },
    },
    commander: {
      health: { name: 'Officer Courses', description: 'The Lieutenant keeps low and leads from cover.' },
      second: { name: 'TT Pistol Practice', description: 'The Lieutenant shoots straighter with his TT. His aura is unchanged.' },
    },
    aa: {
      health: { name: 'Dug-in AA Pit', description: 'The 37 mm crew digs its gun pit deep and walls it with earth.' },
      second: { name: 'Sky Watch Drill', description: 'Lookouts call the bearing early: the 37 mm crew leads its targets.' },
    },
  },
};

/** The HQ, sapper and call-in tracks, by upgrade id. */
export const GENERAL_UPGRADE_TEXT: Record<UpgradeTextNation, Record<string, TrackText>> = {
  british: {
    sapperDrill: { name: 'Sapper Drill', description: 'Sappers march faster and carry more per trip.' },
    hqIncome: { name: 'Requisition Orders', description: 'The HQ draws more money from the rear.' },
    hqHealth: { name: 'Sandbagged HQ', description: 'Extra sandbags and timber on the command post.' },
    hqGun: { name: 'HQ Vickers Gun', description: 'A better-served HQ machine gun: it hits harder and fires faster.' },
    reconOptics: { name: 'Long-Range Cameras', description: 'Better cameras and a longer loiter: the recon plane sees a wider area for longer.' },
    fighterTurnaround: { name: 'Fighter Turnaround', description: 'Ground crews rearm and refuel the fighters faster: the strafing run is ready sooner.' },
    bomberTurnaround: { name: 'Bomber Turnaround', description: 'Faster bombing-up on the airfield: the bomber is ready to fly again sooner.' },
  },
  soviet: {
    sapperDrill: { name: 'Sapper Battalion Drill', description: 'Sappers move at the double and load more per trip.' },
    hqIncome: { name: 'Front Supply Orders', description: 'The front\'s rear services send more to the HQ.' },
    hqHealth: { name: 'Log-Covered Command Post', description: 'Logs, earth and sandbags over the command post.' },
    hqGun: { name: 'HQ Maxim Gun', description: 'The command post\'s Maxim crew fires harder and faster.' },
    reconOptics: { name: 'Night Reconnaissance', description: 'Better cameras and a longer loiter: the Po-2 sees a wider area for longer.' },
    fighterTurnaround: { name: 'Yak Turnaround', description: 'Ground crews rearm and refuel the Yaks faster: the strafing run is ready sooner.' },
    bomberTurnaround: { name: 'Pe-2 Turnaround', description: 'Faster bombing-up on the airfield: the Pe-2 is ready to fly again sooner.' },
  },
};

/**
 * Words that belong to one nation's units, weapons and vehicles and must never appear in another nation's Quartermaster
 * or Shop (the test of that rule, tests/unit/upgrade-text.test.ts, scans for them).
 */
export const NATION_WORDS: Record<FactionId, readonly string[]> = {
  british: ['PIAT', 'Churchill', 'Bren', 'Bofors', 'Vickers', 'Sten', 'Lee-Enfield', 'Enfield', 'Tommy', 'Sherman', 'Cromwell', 'Matilda', 'Spitfire', 'Hurricane', 'Lysander', 'Blenheim', 'Mills'],
  german: ['Panzerschreck', 'Panzerfaust', 'MG 34', 'MG34', 'MP 40', 'MP40', 'Kar98', 'Stuka', 'Messerschmitt', 'Panzer IV', 'StuG', 'Tiger'],
  soviet: ['PTRD', 'T-34', 'KV-1', 'Mosin', 'PPSh', 'DP Gunner', 'Maxim', 'ROKS', 'Katyusha', 'Il-2', 'Pe-2', 'Yak', 'Po-2', 'Sanitarka', 'sanitarka'],
};

/** The name and text of an upgrade for a nation: its own words, else the upgrade's default (British) words. */
export function upgradeTextFor(
  def: { id: string; name: string; description: string; unit: UnitKind | null },
  nation: FactionId,
): TrackText {
  if (nation === 'german') return { name: def.name, description: def.description };
  if (def.unit !== null) {
    const unit = UNIT_UPGRADE_TEXT[nation][def.unit];
    if (unit) return def.id === `${def.unit}Health` ? unit.health : unit.second;
  }
  return GENERAL_UPGRADE_TEXT[nation][def.id] ?? { name: def.name, description: def.description };
}
