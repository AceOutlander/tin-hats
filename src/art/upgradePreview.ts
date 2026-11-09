/**
 * The Quartermaster's pictures of how an upgrade level looks in battle: the HQ building, its gun position, the supply
 * dump, the sappers' haul, or a unit wearing its upgrade gear. Painted with the same sprites the battle uses.
 */
import type { FactionId, UpgradeDef, UpgradeLevels } from '../data/schema';
import { LOOK_TRACKS, LOOK_UPGRADE, NATION_LOOKS, type GearLevels, type LookTrack } from '../data/upgradeLooks';
import { UPGRADES } from '../data/upgrades';
import { UPGRADE_PREVIEW } from '../data/looksGear';
import { gearOf, sideLooks, toStage } from '../meta/looks';
import { upgradeVisual } from '../data/upgradeLooks';
import { PLANE_KINDS, planeGearSpecs, planeKey, planeSpecs } from './vehicles';
import { paintUnitPortrait } from './icons';
import { bigLoadSpec, cartSpecs, dumpStyleSpecs, truckSpecs } from './props/supplyLooks';
import { hqGunSpecs } from './structures/hqGun';
import { hqStyleSpecs } from './structures/hqStyles';
import type { SpriteSpec } from './types';

/** The sprite that shows one look track at one stage. */
function trackSpec(track: LookTrack, level: number, faction: FactionId): SpriteSpec | null {
  const nation = NATION_LOOKS[faction];
  const stage = toStage(level);
  switch (track) {
    case 'hq':
      return hqStyleSpecs(nation.hq[stage], faction)[0] ?? null;
    case 'hqGun':
      return hqGunSpecs(nation.hqGun[stage], faction)[0] ?? null;
    case 'dump':
      return dumpStyleSpecs(nation.dump[stage], faction)[0] ?? null;
    case 'sapper': {
      const haul = nation.sapper[stage];
      if (haul === 'bigLoad') return bigLoadSpec(faction);
      if (haul === 'handcart') return cartSpecs(faction)[1] ?? null;
      if (haul === 'truck') return truckSpecs(faction)[1] ?? null;
      return null;
    }
  }
}

/** Draw a sprite standing on a ground line near the bottom of the canvas, as large as fits. */
function paintStanding(canvas: HTMLCanvasElement, spec: SpriteSpec): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const W = canvas.width;
  const H = canvas.height;
  const P = UPGRADE_PREVIEW;
  const groundY = H * P.ground;
  const above = spec.ay * spec.h;
  const below = (1 - spec.ay) * spec.h;
  const scale = Math.min((W * (1 - 2 * P.margin)) / spec.w, (groundY - H * P.margin) / Math.max(above, 1e-3), (H - groundY) / Math.max(below, 1e-3));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2 + (spec.ax - 0.5) * spec.w * scale, groundY);
  ctx.scale(scale, scale);
  ctx.translate(-spec.ax * spec.w, -spec.ay * spec.h);
  spec.draw(ctx);
  ctx.restore();
  return true;
}

/** Draw a sprite centred in the canvas, as large as fits (a plane in the air). */
function paintFitted(canvas: HTMLCanvasElement, spec: SpriteSpec): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const W = canvas.width;
  const H = canvas.height;
  const m = UPGRADE_PREVIEW.margin;
  const scale = Math.min((W * (1 - 2 * m)) / spec.w, (H * (1 - 2 * m)) / spec.h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.translate((W - spec.w * scale) / 2, (H - spec.h * scale) / 2);
  ctx.scale(scale, scale);
  spec.draw(ctx);
  ctx.restore();
  return true;
}

/**
 * Paint how upgrade `upgradeId` looks at `level` for a nation whose other upgrades stand at `current` (a unit's gear
 * shows both of its upgrades, the other one at its bought level). Returns false when there is nothing to show.
 */
export function paintUpgradePreview(
  canvas: HTMLCanvasElement,
  upgradeId: string,
  level: number,
  faction: FactionId,
  current: UpgradeLevels,
  defs: readonly UpgradeDef[] = UPGRADES,
): boolean {
  for (const t of LOOK_TRACKS) {
    if (LOOK_UPGRADE[t] !== upgradeId) continue;
    const spec = trackSpec(t, level, faction);
    return spec ? paintStanding(canvas, spec) : false;
  }
  const def = defs.find((d) => d.id === upgradeId);
  const visual = def ? upgradeVisual(def) : null;
  if (!visual) return false;
  if (visual.type === 'plane') {
    const plane = PLANE_KINDS.find((k) => k === visual.support);
    if (!plane) return false;
    const stage = toStage(level);
    const spec = stage > 0 ? planeGearSpecs(plane, faction, stage)[0] : planeSpecs().find((s) => s.key === planeKey(plane, faction));
    return spec ? paintFitted(canvas, spec) : false;
  }
  if (visual.type !== 'gear') return false;
  const now = gearOf(sideLooks(faction, current, defs), visual.unit);
  const gear: GearLevels = { ...now, [visual.source]: toStage(level) };
  return paintUnitPortrait(canvas, visual.unit, faction, gear);
}
