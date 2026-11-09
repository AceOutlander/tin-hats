/**
 * Tank upgrade gear (src/data/looksGear.ts): extra hull, turret and gun sprites per look and gear level. Health gear
 * builds up on the hull (spare track links, then bolted plates, then sandbags), damage gear on the turret (a stowage
 * box, then a machine gun on the cupola) and the gun (a longer barrel with a muzzle brake). Level 0 is the look's
 * normal keys (TANK_KEYS). The variants are not in the boot atlas: the renderer builds what a battle needs from
 * tankGearSpecs() into a per-battle atlas.
 *
 *   const keys = tankGearKeys(look, gear);   // hull / turret / barrel keys and the extra gun length
 *   state.gunExtra = keys.gunExtra;          // so layoutTank puts the muzzle (flash, shell) at the longer gun's tip
 */
import { ART_COLORS as C, TANK_LAYOUT, type ArtBox, type GearLook } from '../../data/artLayout';
import { TANK_GEAR_ART, TANK_GEAR_PART } from '../../data/looksGear';
import { TANK_GEAR_STEPS, type GearLevels } from '../../data/upgradeLooks';
import { type Ctx, makeSpec, mix, rgba, rimRect, sandbag, strokeLine } from '../props/kit';
import type { SpriteSpec } from '../types';
import { TANK_KEYS } from './tankLayout';
import { HULL, TURRET, type TankPalette, paintBarrel, palette, tube } from './tanks';

export interface TankGearKeys {
  readonly look: GearLook;
  readonly hull: string;
  readonly turret: string;
  readonly barrel: string;
  /** Extra gun length in wu (TankState.gunExtra), 0 without the long gun. */
  readonly gunExtra: number;
}

/** Highest level of each tank part at these gear levels (0 = the normal sprite). */
function partLevels(gear: GearLevels): { hull: number; turret: number; barrel: number } {
  const out = { hull: 0, turret: 0, barrel: 0 };
  for (const s of TANK_GEAR_STEPS) {
    if (s.level > (s.source === 'health' ? gear.health : gear.damage)) continue;
    const part = TANK_GEAR_PART[s.piece];
    // Each part counts how many of its pieces are on (they build up: the sprite at n draws pieces 1..n).
    out[part]++;
  }
  return out;
}

function hullKey(look: GearLook, n: number): string {
  return n === 0 ? TANK_KEYS[look].hull : `veh/${look}/hull/gear${n}`;
}

function turretKey(look: GearLook, n: number): string {
  return n === 0 ? TANK_KEYS[look].turret : `veh/${look}/turret/gear${n}`;
}

function barrelKey(look: GearLook, n: number): string {
  return n === 0 ? TANK_KEYS[look].barrel : `veh/${look}/barrel/long`;
}

const KEY_CACHE = new Map<GearLook, TankGearKeys[]>();

function clampLevel(n: number): number {
  return Math.max(0, Math.min(3, n | 0));
}

/** Keys a tank of this look draws at these gear levels (cached: no allocation after the first call per look). */
export function tankGearKeys(look: GearLook, gear: GearLevels): TankGearKeys {
  let list = KEY_CACHE.get(look);
  if (!list) {
    list = [];
    for (let h = 0; h < 4; h++) {
      for (let d = 0; d < 4; d++) {
        const n = partLevels({ health: h as 0, damage: d as 0 });
        list.push({
          look,
          hull: hullKey(look, n.hull),
          turret: turretKey(look, n.turret),
          barrel: barrelKey(look, n.barrel),
          gunExtra: n.barrel > 0 ? TANK_GEAR_ART[look].longGun.extra : 0,
        });
      }
    }
    KEY_CACHE.set(look, list);
  }
  return list[clampLevel(gear.health) * 4 + clampLevel(gear.damage)];
}

function pad(box: ArtBox, p: readonly [number, number, number]): ArtBox {
  const [front, top, back] = p;
  return { w: box.w + front + back, h: box.h + top, ox: box.ox + back, oy: box.oy + top };
}

// ---------------------------------------------------------------------------
// Painters (tank space for the hull, turret space for the turret)
// ---------------------------------------------------------------------------

function trackLinks(ctx: Ctx, look: GearLook): void {
  const L = TANK_GEAR_ART[look].links;
  for (let i = 0; i < L.n; i++) {
    const x = L.x + i * L.dx;
    const y = L.y + i * L.dy;
    ctx.fillStyle = C.trackBand;
    ctx.fillRect(x, y, L.w, L.h);
    ctx.fillStyle = C.trackLug;
    ctx.fillRect(x + L.w * 0.2, y + L.h * 0.15, L.w * 0.6, L.h * 0.25);
    ctx.fillRect(x + L.w * 0.2, y + L.h * 0.6, L.w * 0.6, L.h * 0.25);
  }
}

function applique(ctx: Ctx, look: GearLook, P: TankPalette): void {
  const R = TANK_GEAR_ART[look].applique;
  for (let i = 0; i < R.length; i += 4) {
    const [x, y, w, h] = [R[i], R[i + 1], R[i + 2], R[i + 3]];
    rimRect(ctx, x, y, w, h, 0.8, mix(P.panelLit, P.body, 0.35), P.rim, 1);
    // Bolt heads in the corners.
    ctx.fillStyle = rgba(P.rim, 0.9);
    for (const bx of [x + 1.6, x + w - 2.6]) for (const by of [y + 1.4, y + h - 2.4]) ctx.fillRect(bx, by, 1.1, 1.1);
  }
}

function sandbags(ctx: Ctx, look: GearLook): void {
  const S = TANK_GEAR_ART[look].sandbags;
  for (let i = 0; i < S.n; i++) sandbag(ctx, S.x + i * S.dx - S.w / 2, S.y + i * S.dy - S.h / 2, S.w, S.h, ((i * 3) % 4) / 4 - 0.3);
  // A second, shorter course on top.
  for (let i = 0; i < S.n - 1; i++) {
    sandbag(ctx, S.x + (i + 0.5) * S.dx - S.w / 2, S.y + (i + 0.5) * S.dy - S.h / 2 - S.h + 1.6, S.w, S.h, ((i * 3 + 1) % 4) / 4 - 0.3);
  }
}

function stowage(ctx: Ctx, look: GearLook, P: TankPalette): void {
  const [x, y, w, h] = TANK_GEAR_ART[look].stowage;
  rimRect(ctx, x, y, w, h, 1.6, P.panel, P.rim, 1);
  strokeLine(ctx, [x + 1.4, y + h * 0.36, x + w - 1.4, y + h * 0.36], P.bodyDark, 1.1);
  // A rolled tarpaulin strapped on top.
  rimRect(ctx, x - 1, y - 4.2, w + 3, 4.4, 2.2, mix(C.sandbag, P.panel, 0.55), P.rim, 0.8);
}

function cupolaMg(ctx: Ctx, look: GearLook, P: TankPalette): void {
  const M = TANK_GEAR_ART[look].cupolaMg;
  // Pintle post, then the gun at its angle: receiver, barrel pointing forward, a drum magazine.
  strokeLine(ctx, [M.x, M.y, M.x, M.y - M.post], P.bodyDark, 1.3);
  ctx.save();
  ctx.translate(M.x, M.y - M.post);
  ctx.rotate(M.angle);
  rimRect(ctx, -3.5, -2.6, 7, 3, 0.8, C.ink, P.rim, 0.8);
  strokeLine(ctx, [3, -1.3, 3 + M.len, -1.3], C.ink, 1.3);
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(-0.8, -3.6, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintHullGear(ctx: Ctx, look: GearLook, P: TankPalette, n: number): void {
  HULL[look](ctx, P);
  if (n >= 3) sandbags(ctx, look);
  if (n >= 2) applique(ctx, look, P);
  if (n >= 1) trackLinks(ctx, look);
}

function paintTurretGear(ctx: Ctx, look: GearLook, P: TankPalette, n: number): void {
  if (n >= 1) stowage(ctx, look, P);
  TURRET[look](ctx, P);
  if (n >= 2) cupolaMg(ctx, look, P);
}

function paintLongGun(ctx: Ctx, look: GearLook, P: TankPalette): void {
  const G = TANK_GEAR_ART[look].longGun;
  const len = TANK_LAYOUT[look].barrelLength + G.extra;
  paintBarrel(ctx, look, P, len);
  if (G.brakeLen > 0) {
    // Double-baffle muzzle brake at the tip.
    tube(ctx, [len - G.brakeLen, len, G.brakeHalf], P);
    ctx.fillStyle = C.void;
    ctx.fillRect(len - G.brakeLen * 0.62, -G.brakeHalf * 0.55, G.brakeLen * 0.24, G.brakeHalf * 1.1);
  }
}

function longGunBox(look: GearLook): ArtBox {
  const L = TANK_LAYOUT[look];
  const G = TANK_GEAR_ART[look].longGun;
  const half = Math.max(L.barrelBox.oy, Math.ceil(G.brakeHalf) + 2);
  return { w: L.barrelBox.w + G.extra, h: half * 2, ox: L.barrelBox.ox, oy: half };
}

/** The sprites a tank of this look needs at these gear levels, beyond its normal ones (empty at level 0). */
export function tankGearSpecs(look: GearLook, gear: GearLevels): SpriteSpec[] {
  const L = TANK_LAYOUT[look];
  const A = TANK_GEAR_ART[look];
  const n = partLevels(gear);
  const P = palette(look);
  const out: SpriteSpec[] = [];
  if (n.hull > 0) {
    const h = n.hull;
    out.push(
      makeSpec(hullKey(look, h), pad(L.hullBox, A.hullPad), (ctx) => {
        ctx.translate(-L.rockPivot.x, -L.rockPivot.y);
        paintHullGear(ctx, look, P, h);
      }),
    );
  }
  if (n.turret > 0) {
    const t = n.turret;
    out.push(makeSpec(turretKey(look, t), pad(L.turretBox, A.turretPad), (ctx) => paintTurretGear(ctx, look, P, t)));
  }
  if (n.barrel > 0) out.push(makeSpec(barrelKey(look, n.barrel), longGunBox(look), (ctx) => paintLongGun(ctx, look, P)));
  return out;
}
