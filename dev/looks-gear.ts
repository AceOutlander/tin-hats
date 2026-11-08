/**
 * Upgrade gear preview page (dev server only). See looks-gear.html for the URL options.
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
import type { SpriteSpec } from '../src/art/types';
import { TANK_KEYS, TANK_LOOKS, createTankPose, layoutTank, tankGearKeys, tankGearSpecs, tankSpecs } from '../src/art/vehicles';
import { FIGURE_CRATE, FIGURE_KIND_LIST, type FigureKind } from '../src/data/figure';
import type { FactionId, UnitAction } from '../src/data/schema';
import { SAPPER_CART_HANDLE, type GearLevels, type LookStage } from '../src/data/upgradeLooks';
import { UNITS } from '../src/data/units';

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

const FACTION_IDS: readonly FactionId[] = ['british', 'german'];
const LEVELS: readonly [LookStage, LookStage][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [3, 0],
  [0, 3],
];
const SUB = 1 / 240;

function num(name: string, def: number): number {
  const v = params.get(name);
  return v === null || v === '' || Number.isNaN(Number(v)) ? def : Number(v);
}

function gearOf(h: LookStage, d: LookStage): GearLevels {
  return { health: h, damage: d };
}

function step(a: FigureAnim, inp: FigureInput, dt: number): void {
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB, left);
    inp.moved = inp.speed * h;
    updateFigure(a, inp, h);
    left -= h;
  }
}

/** Placeholder bigger load (the other agent's art replaces it): 1.4x the crate, centred like the crate. */
const LOAD_KEY = 'dev/bigLoad';
const EXTRA = new Map<string, SpriteSpec>();
{
  const w = FIGURE_CRATE.halfW * 2 * 1.4;
  const h = FIGURE_CRATE.halfH * 2 * 1.4;
  EXTRA.set(LOAD_KEY, {
    key: LOAD_KEY,
    w,
    h,
    ax: 0.5,
    ay: 0.5,
    draw(c): void {
      c.fillStyle = '#8a6a3a';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e8dcb8';
      c.lineWidth = 0.6;
      c.strokeRect(0.3, 0.3, w - 0.6, h - 0.6);
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();
    },
  });
}

const PARTS: FigurePart[] = createFigureLayout();

function drawSpec(s: SpriteSpec, x: number, y: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate(-s.ax * s.w, -s.ay * s.h);
  s.draw(ctx);
  ctx.restore();
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

function label(text: string, x: number, y: number, size = 11, color = '#f1ead2'): void {
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function background(): void {
  const dark = params.get('bg') === 'dark';
  ctx.fillStyle = dark ? '#23241f' : '#6f6a58';
  ctx.fillRect(0, 0, W, H);
}

function ground(x0: number, x1: number, y: number): void {
  ctx.fillStyle = 'rgba(40, 34, 24, 0.55)';
  ctx.fillRect(x0, y, x1 - x0, 2);
}

function posed(kind: FigureKind, f: FactionId, action: UnitAction, gear: GearLevels, seed: number): FigureAnim {
  const a = createFigureAnim(kind, f, seed);
  a.altAim = false;
  setFigureGear(a, gear);
  const inp = createFigureInput(kind);
  inp.action = action;
  inp.speed = action === 'move' ? UNITS[kind].speed : 0;
  step(a, inp, 1.6 + (seed % 5) * 0.07);
  return a;
}

// ---------------------------------------------------------------------------

function infantry(): void {
  const z = num('z', 0.95);
  const action = (params.get('action') ?? 'move') as UnitAction;
  const only = params.get('kinds');
  const kinds = FIGURE_KIND_LIST.filter((k) => (only ? only.split(',').includes(k) : k !== 'medic' || params.get('medic') !== '0'));
  const cols = LEVELS.length * FACTION_IDS.length;
  const cw = (W - 70) / cols;
  const rh = (H - 30) / kinds.length;
  for (let fi = 0; fi < FACTION_IDS.length; fi++) {
    for (let li = 0; li < LEVELS.length; li++) {
      const cx = 70 + (fi * LEVELS.length + li + 0.5) * cw;
      label(`${FACTION_IDS[fi].slice(0, 2)} ${LEVELS[li][0]},${LEVELS[li][1]}`, cx, 14, 10);
    }
  }
  kinds.forEach((kind, ki) => {
    const gy = 26 + (ki + 1) * rh - 6;
    label(kind, 30, gy - rh * 0.4, 11);
    ground(60, W, gy);
    for (let fi = 0; fi < FACTION_IDS.length; fi++) {
      for (let li = 0; li < LEVELS.length; li++) {
        const [h, d] = LEVELS[li];
        const cx = 70 + (fi * LEVELS.length + li + 0.5) * cw;
        const a = posed(kind, FACTION_IDS[fi], action, gearOf(h, d), 7);
        drawFigure(a, cx - 4 * z, gy, z);
      }
    }
  });
}

function medic(): void {
  const z = num('z', 2.2);
  const levels: LookStage[] = [0, 1, 2, 3];
  const actions: UnitAction[] = ['idle', 'move', 'heal'];
  const cw = W / (levels.length * FACTION_IDS.length);
  const rh = H / actions.length;
  actions.forEach((action, ai) => {
    const gy = (ai + 1) * rh - 10;
    ground(0, W, gy);
    for (let fi = 0; fi < FACTION_IDS.length; fi++) {
      levels.forEach((d, li) => {
        const cx = (fi * levels.length + li + 0.5) * cw;
        const a = posed('medic', FACTION_IDS[fi], action, gearOf(d === 3 ? 3 : 0, d), 9);
        drawFigure(a, cx, gy, z);
        if (ai === 0) label(`${FACTION_IDS[fi]} heal ${d}${d === 3 ? ' + hp3' : ''}`, cx, 14, 11);
      });
    }
  });
}

function sapper(): void {
  const z = num('z', 1.6);
  const f: FactionId = params.get('faction') === 'german' ? 'german' : 'british';
  const frames = 6;
  const cw = W / frames;
  // Row 1: pushing, walking cycle; row 2: pushing, standing / loading / running; row 3: carrying the swapped load.
  const rows = 3;
  const rh = H / rows;
  const speed = UNITS.sapper.speed;
  const walker = createFigureAnim('sapper', f, 3);
  setFigurePushing(walker, true);
  const inp = createFigureInput('sapper');
  inp.carrying = true;
  inp.action = 'move';
  inp.speed = speed;
  step(walker, inp, 2);
  for (let i = 0; i < frames; i++) {
    const cx = (i + 0.3) * cw;
    const gy = rh - 14;
    ground(cx - 20, cx + cw - 20, gy);
    cart(cx, gy, z);
    drawFigure(walker, cx, gy, z);
    step(walker, inp, 0.12);
  }
  label(`pushing, walking at ${speed} wu/s (grey box = placeholder cart, red = SAPPER_CART_HANDLE)`, W / 2, 14, 11);
  const poses: { title: string; action: UnitAction; speed: number; carrying: boolean }[] = [
    { title: 'pushing, standing', action: 'idle', speed: 0, carrying: true },
    { title: 'pushing, empty', action: 'idle', speed: 0, carrying: false },
    { title: 'pushing, loading', action: 'load', speed: 0, carrying: false },
    { title: 'pushing, fast', action: 'move', speed: 70, carrying: true },
  ];
  poses.forEach((p, i) => {
    const a = createFigureAnim('sapper', f, 4 + i);
    setFigurePushing(a, true);
    const q = createFigureInput('sapper');
    q.action = p.action;
    q.speed = p.speed;
    q.carrying = p.carrying;
    step(a, q, 2.3);
    const cx = (i + 0.3) * (W / poses.length);
    const gy = 2 * rh - 14;
    ground(cx - 20, cx + W / poses.length - 20, gy);
    cart(cx, gy, z);
    drawFigure(a, cx, gy, z);
    label(p.title, cx + 20, rh + 14, 11);
  });
  const loads: { title: string; key: string | null; action: UnitAction }[] = [
    { title: 'crate (null key)', key: null, action: 'move' },
    { title: 'swapped load, walking', key: LOAD_KEY, action: 'move' },
    { title: 'swapped load, standing', key: LOAD_KEY, action: 'idle' },
    { title: 'swapped load, loading', key: LOAD_KEY, action: 'load' },
  ];
  loads.forEach((p, i) => {
    const a = createFigureAnim('sapper', f, 8 + i);
    setFigureCrateKey(a, p.key);
    const q = createFigureInput('sapper');
    q.action = p.action;
    q.speed = p.action === 'move' ? speed : 0;
    q.carrying = p.action !== 'load';
    step(a, q, p.action === 'load' ? 1.0 : 2.1);
    const cx = (i + 0.4) * (W / loads.length);
    const gy = 3 * rh - 14;
    ground(cx - 30, cx + W / loads.length - 30, gy);
    drawFigure(a, cx, gy, z);
    label(p.title, cx + 10, 2 * rh + 14, 11);
  });
}

/** Placeholder cart: its anchor is the ground point straight below the handle grip. */
function cart(x: number, gy: number, z: number): void {
  const hx = x + SAPPER_CART_HANDLE.x * z;
  const hy = gy + SAPPER_CART_HANDLE.y * z;
  ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
  ctx.fillRect(hx + 6 * z, gy - 22 * z, 34 * z, 12 * z);
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.9)';
  ctx.lineWidth = 1.2 * z;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + 8 * z, gy - 18 * z);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx + 23 * z, gy - 7 * z, 7 * z, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d0302a';
  ctx.beginPath();
  ctx.arc(hx, hy, 1.4 * z, 0, Math.PI * 2);
  ctx.fill();
}

function tanks(): void {
  const z = num('z', 0.45);
  const base = new Map<string, SpriteSpec>();
  for (const s of tankSpecs()) base.set(s.key, s);
  const cw = W / LEVELS.length;
  const rh = (H - 10) / TANK_LOOKS.length;
  TANK_LOOKS.forEach((look, ti) => {
    const gy = 10 + (ti + 1) * rh - 10;
    ground(0, W, gy);
    LEVELS.forEach(([h, d], li) => {
      const gear = gearOf(h, d);
      const specs = new Map(base);
      for (const s of tankGearSpecs(look, gear)) specs.set(s.key, s);
      const g = tankGearKeys(look, gear);
      const keys = TANK_KEYS[look];
      const pose = layoutTank({ look, distance: 0, turretAim: 0.05, recoil: 0, hullRock: 0, gunExtra: g.gunExtra }, createTankPose());
      const cx = (li + 0.42) * cw;
      ctx.save();
      ctx.translate(cx, gy);
      ctx.scale(z, z);
      const put = (key: string, x: number, y: number, rot: number): void => {
        const s = specs.get(key);
        if (s) drawSpec(s, x, y, rot);
      };
      put(keys.track[0], pose.track.x, pose.track.y, 0);
      for (let i = 0; i < pose.wheelCount; i++) put(keys.wheels[i], pose.wheels[i].x, pose.wheels[i].y, pose.wheels[i].rot);
      put(g.hull, pose.hull.x, pose.hull.y, pose.hull.rot);
      put(g.barrel, pose.barrel.x, pose.barrel.y, pose.barrel.rot);
      put(g.turret, pose.turret.x, pose.turret.y, pose.turret.rot);
      ctx.fillStyle = '#ff2a20';
      ctx.beginPath();
      ctx.arc(pose.muzzle.x, pose.muzzle.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (ti === 0) label(`hp ${h}, dmg ${d}`, cx, 12, 11);
    });
  });
}

background();
const mode = params.get('mode') ?? 'infantry';
if (mode === 'medic') medic();
else if (mode === 'sapper') sapper();
else if (mode === 'tanks') tanks();
else infantry();
window.__ready = true;
