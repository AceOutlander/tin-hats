/**
 * Upgrade looks audit page (dev server only). See looks-audit.html for the URL options.
 */
import {
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  figureSpriteMap,
  layoutFigure,
  setFigureCrateKey,
  setFigureGear,
  setFigurePushing,
  updateFigure,
  type FigureAnim,
  type FigureInput,
  type FigurePart,
} from '../src/art/figure';
import { bigLoadSpec, cartSpecs, dumpStyleSpecs, truckSpecs } from '../src/art/props/supplyLooks';
import { hqGunSpecs } from '../src/art/structures/hqGun';
import { hqStyleSpecs } from '../src/art/structures/hqStyles';
import type { SpriteSpec } from '../src/art/types';
import {
  PLANE_KINDS,
  TANK_KEYS,
  createTankPose,
  isGearLook,
  layoutTank,
  planeGearSpecs,
  planeKey,
  planeSpecs,
  tankGearKeys,
  tankGearSpecs,
  tankSpecs,
  vehicleLookOf,
} from '../src/art/vehicles';
import type { PlaneKind } from '../src/data/artLayout';
import { FIGURE_KIND_LIST, type FigureKind } from '../src/data/figure';
import type { FactionId, UnitAction, UnitKind } from '../src/data/schema';
import { NATION_LOOKS, SAPPER_CART_HANDLE, type GearLevels, type LookStage, type LookTrack } from '../src/data/upgradeLooks';
import { UNITS } from '../src/data/units';
import { VIEW } from '../src/data/view';

declare global {
  interface Window {
    __ready?: boolean;
  }
}

const params = new URLSearchParams(location.search.replace(/;/g, '&'));
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx2 = canvas.getContext('2d');
if (!ctx2) throw new Error('no 2d context');
const ctx: CanvasRenderingContext2D = ctx2;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const W = window.innerWidth;
const H = window.innerHeight;
canvas.width = Math.round(W * dpr);
canvas.height = Math.round(H * dpr);
ctx.scale(dpr, dpr);

/** Battle zoom: CSS px per wu on an 844x390 phone (the camera shows VIEW.viewHeightWu vertically). */
const BATTLE = 390 / VIEW.viewHeightWu;
const CLOSE = BATTLE * 2;
const NATIONS: readonly FactionId[] = ['british', 'german'];
const SUB = 1 / 240;
const action = (params.get('action') ?? 'idle') as UnitAction;

function label(text: string, x: number, y: number, size = 11, color = '#f4eed8', align: CanvasTextAlign = 'center'): void {
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(text, x + 0.8, y + 0.8);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function band(y0: number, y1: number, gy: number, title: string): void {
  const sky = ctx.createLinearGradient(0, y0, 0, gy);
  sky.addColorStop(0, '#9ea28c');
  sky.addColorStop(1, '#c3bd9d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, y0, W, gy - y0);
  ctx.fillStyle = '#6a603f';
  ctx.fillRect(0, gy, W, y1 - gy);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, gy, W, 1.5);
  label(title, 6, y0 + 12, 10, '#1d1c16', 'left');
}

/**
 * Draw a sprite the way the game does: painted alone on a transparent canvas first (as in its atlas cell, so
 * source-atop paint stays on the sprite), at the current scale, then placed.
 */
function drawSpec(s: SpriteSpec, x: number, y: number, rot: number): void {
  const t = ctx.getTransform();
  const k = Math.max(0.1, Math.hypot(t.a, t.b));
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.ceil(s.w * k));
  off.height = Math.max(1, Math.ceil(s.h * k));
  const o = off.getContext('2d');
  if (!o) return;
  o.scale(k, k);
  s.draw(o);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate(-s.ax * s.w, -s.ay * s.h);
  ctx.drawImage(off, 0, 0, off.width / k, off.height / k);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

const PARTS: FigurePart[] = createFigureLayout();
const EXTRA = new Map<string, SpriteSpec>();

function step(a: FigureAnim, inp: FigureInput, dt: number): void {
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB, left);
    inp.moved = inp.speed * h;
    updateFigure(a, inp, h);
    left -= h;
  }
}

function drawFigure(a: FigureAnim, x: number, y: number, z: number): void {
  layoutFigure(a, PARTS);
  const map = figureSpriteMap();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(z, z);
  for (const p of PARTS) {
    if (!p.visible) continue;
    const s = map.get(p.key) ?? EXTRA.get(p.key);
    if (s) drawSpec(s, p.x, p.y, p.rotation);
  }
  ctx.restore();
}

function posed(kind: FigureKind, f: FactionId, gear: GearLevels, carrying = false, pushing = false, crate: string | null = null): FigureAnim {
  const a = createFigureAnim(kind, f, 7);
  a.altAim = false;
  setFigureGear(a, gear);
  setFigurePushing(a, pushing);
  setFigureCrateKey(a, crate);
  const inp = createFigureInput(kind);
  inp.action = carrying ? 'move' : action;
  inp.carrying = carrying;
  inp.speed = inp.action === 'move' ? UNITS[kind].speed : 0;
  step(a, inp, 1.7);
  return a;
}

/** The sequence shown at battle zoom: level 0, each health level, each damage level, and both at 3. */
const SEQUENCE: readonly [LookStage, LookStage, string][] = [
  [0, 0, 'L0'],
  [1, 0, 'hp1'],
  [2, 0, 'hp2'],
  [3, 0, 'hp3'],
  [0, 1, 'dmg1'],
  [0, 2, 'dmg2'],
  [0, 3, 'dmg3'],
  [3, 3, 'L3'],
];

function figureAudit(kind: FigureKind): void {
  const rowH = 82;
  NATIONS.forEach((f, ni) => {
    const y0 = ni * rowH;
    const gy = y0 + rowH - 14;
    band(y0, y0 + rowH, gy, `${f}, battle zoom`);
    const cw = W / SEQUENCE.length;
    SEQUENCE.forEach(([h, d, name], i) => {
      const cx = (i + 0.42) * cw;
      drawFigure(posed(kind, f, { health: h, damage: d }), cx, gy, BATTLE);
      label(name, cx, gy + 12, 10);
    });
  });
  const y0 = 2 * rowH;
  const gy = H - 16;
  band(y0, H, gy, '2x close-up: level 0 and level 3 (health 3, damage 3)');
  const cw = W / 4;
  NATIONS.forEach((f, ni) => {
    ([0, 3] as const).forEach((lv, li) => {
      const cx = (ni * 2 + li + 0.42) * cw;
      drawFigure(posed(kind, f, { health: lv, damage: lv }), cx, gy, CLOSE);
      label(`${f} L${lv}`, cx, gy + 13, 11);
    });
  });
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const VEHICLE_SPECS = new Map<string, SpriteSpec>();
for (const s of tankSpecs()) VEHICLE_SPECS.set(s.key, s);

function drawVehicle(kind: UnitKind, f: FactionId, gear: GearLevels, x: number, gy: number, z: number): void {
  const look = vehicleLookOf(kind, f);
  const keys = TANK_KEYS[look];
  let hull = keys.hull;
  let turret = keys.turret;
  let barrel = keys.barrel;
  let gunExtra = 0;
  if (isGearLook(look)) {
    for (const s of tankGearSpecs(look, gear)) VEHICLE_SPECS.set(s.key, s);
    const g = tankGearKeys(look, gear);
    hull = g.hull;
    turret = g.turret;
    barrel = g.barrel;
    gunExtra = g.gunExtra;
  }
  const pose = layoutTank({ look, distance: 0, turretAim: 0.05, recoil: 0, hullRock: 0, gunExtra }, createTankPose());
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(z, z);
  const put = (key: string, px: number, py: number, rot: number): void => {
    const s = VEHICLE_SPECS.get(key);
    if (s) drawSpec(s, px, py, rot);
  };
  put(keys.track[0], pose.track.x, pose.track.y, 0);
  for (let i = 0; i < pose.wheelCount; i++) put(keys.wheels[i], pose.wheels[i].x, pose.wheels[i].y, pose.wheels[i].rot);
  put(hull, pose.hull.x, pose.hull.y, pose.hull.rot);
  put(barrel, pose.barrel.x, pose.barrel.y, pose.barrel.rot);
  put(turret, pose.turret.x, pose.turret.y, pose.turret.rot);
  if (keys.passengers) put(keys.passengers, pose.passengers.x, pose.passengers.y, pose.passengers.rot);
  ctx.restore();
}

function vehicleAudit(kind: UnitKind): void {
  // Battle zoom: each nation's levels in two rows of four.
  const rowH = 112;
  let y = 0;
  NATIONS.forEach((f) => {
    for (let r = 0; r < 2; r++) {
      const gy = y + rowH - 16;
      band(y, y + rowH, gy, r === 0 ? `${f}, battle zoom` : '');
      for (let i = 0; i < 4; i++) {
        const [h, d, name] = SEQUENCE[r * 4 + i];
        const cx = (i + 0.5) * (W / 4);
        drawVehicle(kind, f, { health: h, damage: d }, cx, gy, BATTLE);
        label(name, cx, gy + 12, 10);
      }
      y += rowH;
    }
  });
  const gy = H - 16;
  band(y, H, gy, '2x close-up, british: level 0 and level 3');
  ([0, 3] as const).forEach((lv, i) => {
    const cx = (i + 0.5) * (W / 2);
    drawVehicle(kind, 'british', { health: lv, damage: lv }, cx, gy, CLOSE);
    label(`L${lv}`, cx, gy + 13, 11);
  });
}

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

function planeSpec(kind: PlaneKind, f: FactionId, level: number): SpriteSpec | undefined {
  if (level > 0) return planeGearSpecs(kind, f, level)[0];
  return planeSpecs().find((s) => s.key === planeKey(kind, f));
}

function planeAudit(kind: PlaneKind): void {
  // Four levels to a row, or two when the plane is too long for a quarter of the page (the bomber).
  const base = planeSpec(kind, 'british', 0);
  const cols = base && base.w * BATTLE > W / 4 - 8 ? 2 : 4;
  const rowH = 92;
  let y = 0;
  NATIONS.forEach((f) => {
    for (let r = 0; r < 4 / cols; r++) {
      band(y, y + rowH, y + rowH, r === 0 ? `${f}, battle zoom: levels 0 to 3` : '');
      for (let c = 0; c < cols; c++) {
        const lv = r * cols + c;
        const cx = (c + 0.5) * (W / cols);
        const s = planeSpec(kind, f, lv);
        if (s) {
          ctx.save();
          ctx.translate(cx, y + rowH * 0.5);
          ctx.scale(BATTLE, BATTLE);
          drawSpec(s, 0, 0, 0);
          ctx.restore();
        }
        label(`L${lv}`, cx, y + rowH - 6, 10);
      }
      y += rowH;
    }
  });
  const y0 = y;
  band(y0, H, H, '2x close-up, british: level 0 and level 3');
  ([0, 3] as const).forEach((lv, i) => {
    const cx = (i + 0.5) * (W / 2);
    const s = planeSpec(kind, 'british', lv);
    if (s) {
      ctx.save();
      ctx.translate(cx, y0 + (H - y0) * 0.5);
      ctx.scale(Math.min(CLOSE, (W / 2 - 20) / s.w), Math.min(CLOSE, (W / 2 - 20) / s.w));
      drawSpec(s, 0, 0, 0);
      ctx.restore();
    }
    label(`L${lv}`, cx, H - 8, 11);
  });
}

// ---------------------------------------------------------------------------
// HQ, HQ gun, dump and sapper haul
// ---------------------------------------------------------------------------

function trackSprite(track: LookTrack, f: FactionId, stage: LookStage, cx: number, gy: number): void {
  const nation = NATION_LOOKS[f];
  const at = (s: SpriteSpec | undefined, x = cx): void => {
    if (!s) return;
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(BATTLE, BATTLE);
    drawSpec(s, 0, 0, 0);
    ctx.restore();
  };
  if (track === 'hq') at(hqStyleSpecs(nation.hq[stage], f)[0]);
  else if (track === 'hqGun') at(hqGunSpecs(nation.hqGun[stage], f)[0]);
  else if (track === 'dump') at(dumpStyleSpecs(nation.dump[stage], f)[0]);
  else {
    const haul = nation.sapper[stage];
    if (haul === 'truck') at(truckSpecs(f)[1]);
    else if (haul === 'handcart') {
      const a = posed('sapper', f, { health: 0, damage: 0 }, true, true);
      at(cartSpecs(f)[1], cx + SAPPER_CART_HANDLE.x * BATTLE);
      drawFigure(a, cx, gy, BATTLE);
    } else {
      const big = bigLoadSpec(f);
      EXTRA.set(big.key, big);
      drawFigure(posed('sapper', f, { health: 0, damage: 0 }, true, false, haul === 'bigLoad' ? big.key : null), cx, gy, BATTLE);
    }
  }
}

function trackAudit(track: LookTrack, f: FactionId): void {
  const rowH = H / 2;
  for (let r = 0; r < 2; r++) {
    const y0 = r * rowH;
    const gy = y0 + rowH - 18;
    band(y0, y0 + rowH, gy, r === 0 ? `${f} ${track}, battle zoom` : '');
    for (let c = 0; c < 2; c++) {
      const stage = (r * 2 + c) as LookStage;
      const cx = (c + 0.5) * (W / 2);
      trackSprite(track, f, stage, cx, gy);
      label(`level ${stage}: ${NATION_LOOKS[f][track][stage]}`, cx, gy + 13, 11);
    }
  }
}

// ---------------------------------------------------------------------------

ctx.fillStyle = '#6f6a58';
ctx.fillRect(0, 0, W, H);
const unit = params.get('unit');
const plane = params.get('plane');
const track = params.get('track');
if (unit) {
  if ((FIGURE_KIND_LIST as readonly string[]).includes(unit)) figureAudit(unit as FigureKind);
  else vehicleAudit(unit as UnitKind);
} else if (plane && (PLANE_KINDS as readonly string[]).includes(plane)) {
  planeAudit(plane as PlaneKind);
} else {
  const t = (['hq', 'hqGun', 'dump', 'sapper'] as const).find((x) => x === track) ?? 'hq';
  trackAudit(t, params.get('f') === 'german' ? 'german' : 'british');
}
window.__ready = true;
