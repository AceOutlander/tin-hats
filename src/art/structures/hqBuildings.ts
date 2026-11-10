/**
 * The HQ buildings a mission may put an HQ in (SideStart.hqLook; FOUNDATIONS.md 4.3): Brest's ring-barracks casemate,
 * the Gerhardt mill and the Univermag department store, each in the three damage states of the Quartermaster's HQ
 * styles and with the same layout conventions (MISSION_HQ_LAYOUT in src/data/looksBuilding.ts). They are drawn with the
 * building pieces of src/art/structures/buildings.ts, with the HQ's door at the layout's doorX.
 */
import { ART_COLORS as C, DAMAGE_STATES, type DamageState } from '../../data/artLayout';
import { MISSION_HQ_LAYOUT, type MissionHqStyle } from '../../data/looksBuilding';
import type { FactionId } from '../../data/schema';
import { makeSpec, rgba, rimRect, rng, sandbag, type Ctx } from '../props/kit';
import type { SpriteSpec } from '../types';
import { paintStack } from './buildings';
import { flagpole } from './hq';

/** Same key scheme as the Quartermaster's HQ styles (hqStyleKey). */
export function missionHqKey(style: MissionHqStyle, faction: FactionId, state: DamageState): string {
  return `st/hqs/${style}/${faction}/${state}`;
}

const SHAPE: Record<MissionHqStyle, { floors: number; slots: number }> = {
  casemate: { floors: 2, slots: 11 },
  mill: { floors: 3, slots: 8 },
  store: { floors: 3, slots: 12 },
};

/** The HQ door: a dark doorway with lamp light inside, and sandbags beside it (none left in the ruin). */
function door(ctx: Ctx, style: MissionHqStyle, state: DamageState): void {
  const L = MISSION_HQ_LAYOUT[style];
  const x0 = L.doorX - L.doorW / 2;
  if (state === 'ruin') {
    ctx.fillStyle = C.void;
    ctx.fillRect(x0 + 4, -24, L.doorW - 8, 24);
    return;
  }
  rimRect(ctx, x0 - 3, -L.doorH - 4, L.doorW + 6, L.doorH + 4, 1, C.timberDark, C.timberRim, 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(x0, -L.doorH, L.doorW, L.doorH);
  const glow = ctx.createRadialGradient(L.doorX, -L.doorH + 20, 1, L.doorX, -L.doorH + 20, 26);
  glow.addColorStop(0, 'rgba(214,160,84,0.3)');
  glow.addColorStop(1, 'rgba(214,160,84,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x0, -L.doorH, L.doorW, L.doorH);
  const rand = rng(41);
  for (let i = 0; i < 3; i++) sandbag(ctx, x0 - 22, -10 - i * 9, 18, 10, rand() - 0.5);
  sandbag(ctx, x0 + L.doorW + 4, -10, 18, 10, 0.2);
}

/**
 * The flagpole on the roof (the flag is the renderer's, hung from flagTop): planted in the casemate's earth bank or
 * behind the parapet, its foot steadied by two sandbags on the roof line. None on the ruin (the flag is down).
 */
function roofFlagpole(ctx: Ctx, style: MissionHqStyle): void {
  const L = MISSION_HQ_LAYOUT[style];
  const x = L.flagBase.x;
  const y = L.flagBase.y;
  flagpole(ctx, L);
  sandbag(ctx, x - 13, y - 7, 14, 7, 0.1);
  sandbag(ctx, x + 1, y - 7, 14, 7, -0.1);
}

function paint(ctx: Ctx, style: MissionHqStyle, state: DamageState): void {
  const L = MISSION_HQ_LAYOUT[style];
  const s = SHAPE[style];
  paintStack(ctx, style, L.bodyW, s.slots, s.floors, state === 'damaged', state === 'ruin');
  if (state !== 'ruin') roofFlagpole(ctx, style);
  door(ctx, style, state);
  if (style === 'store' && state !== 'ruin') {
    // The Univermag's boarded shop windows along the ground floor and its sign band.
    for (let x = -L.bodyW / 2 + 40; x < L.doorX - 30; x += 46) rimRect(ctx, x, -40, 30, 26, 0.5, C.timberDark, C.timberRim, 0.6);
    ctx.fillStyle = rgba(C.void, 0.55);
    ctx.fillRect(-L.bodyW / 2 + 20, -54, L.bodyW - 40, 8);
  }
}

/** The three damage states of a mission HQ building. The faction only names the keys (the building is the town's). */
export function missionHqSpecs(style: MissionHqStyle, faction: FactionId): SpriteSpec[] {
  return DAMAGE_STATES.map((state) => makeSpec(missionHqKey(style, faction, state), MISSION_HQ_LAYOUT[style].box, (c) => paint(c, style, state)));
}
