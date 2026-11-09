/**
 * Which main gun each vehicle look carries (owner's change 3, DECISIONS 424): the cannon scale by calibre, so a KV-2's
 * 152 mm hits hardest and reloads slowest and a T-60's 20 mm stays a light autocannon. A look not listed keeps its
 * kind's gun (UNITS[kind].weapon): the Panzer IV's and StuG B's short 7.5 cm, the T-34's 76.2 mm and the Churchill's
 * 75 mm are the tank's `tankGun`, the King Tiger's 8.8 cm the `heavyGun`, the Panzer III E and H, the BT-7, the T-26
 * and the cruiser the `lightTankGun`. The hull and coaxial machine guns (UnitDef.secondary) are untouched and keep
 * firing between main-gun rounds.
 */
import type { VehicleLook } from './artLayout';
import type { UnitKind } from './schema';
import { UNITS } from './units';

export const TANK_GUNS: Partial<Record<VehicleLook, string>> = {
  t60: 'gun20',
  // The KV-1 carries the T-34's 76.2 mm, whatever kind it fields as.
  kv1: 'tankGun',
  kv2: 'gun152',
  panzer3l: 'gun50L',
  panzer4g: 'gun75L',
  stug3f: 'gun75L',
};

/** The main gun of a unit of `kind` drawn with vehicle look `look` (null for an unarmed kind). */
export function vehicleGun(kind: UnitKind, look: VehicleLook): string | null {
  const own = UNITS[kind].weapon;
  if (own === null || UNITS[kind].class !== 'vehicle' || kind === 'apc') return own;
  return TANK_GUNS[look] ?? own;
}
