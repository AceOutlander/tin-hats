/**
 * Stick-figure preview page (dev server only). See art-figures.html for the URL options.
 */
import { MOLOTOV_KEY, createFigureAnim, createFigureInput, drawFigure2d, paintUnitIcon, setFigureClothing, setFigureGear, setFigureHeadgear, setFigureRocketItem, setFigureWeapon, updateFigure, type FigureAnim, type FigureInput } from '../src/art/figure';
import { infantryLookOf, missionEra } from '../src/data/eras';
import { getStalingradMission } from '../src/data/missions/stalingrad';
import { FIGURE_CLOTHING_LIST, FIGURE_HEADGEAR_LIST, type FigureClothing, type FigureHeadgear } from '../src/data/looksGear';
import type { LookStage } from '../src/data/upgradeLooks';
import { ramp } from '../src/art/figure/math';
import { FACTIONS } from '../src/data/factions';
import { DEATH_VARIANTS, FIGURE, FIGURE_GAIT_CARRY, FIGURE_KINDS, FIGURE_KIND_LIST, type DeathVariant, type FigureKind } from '../src/data/figure';
import type { FactionId, UnitAction } from '../src/data/schema';
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

/** The two nations shown side by side: ?nations=soviet,german (default British and German). */
const FACTION_IDS: readonly FactionId[] = nationsParam();

function nationsParam(): FactionId[] {
  const all = Object.keys(FACTIONS) as FactionId[];
  const asked = (params.get('nations') ?? '').split(',').filter((n): n is FactionId => (all as string[]).includes(n));
  return asked.length === 2 ? asked : ['british', 'german'];
}
const SUB = 1 / 240;

function num(name: string, def: number): number {
  const v = params.get(name);
  return v === null || v === '' || Number.isNaN(Number(v)) ? def : Number(v);
}

function kindParam(): FigureKind {
  const k = params.get('kind') ?? 'rifle';
  return (FIGURE_KIND_LIST as readonly string[]).includes(k) ? (k as FigureKind) : 'rifle';
}

function factionParam(): FactionId {
  const f = params.get('faction');
  return f === 'german' || f === 'soviet' ? f : 'british';
}

/** Advance with small sub-steps, moving at the input's speed. */
function step(a: FigureAnim, inp: FigureInput, dt: number): void {
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB, left);
    inp.moved = inp.speed * h;
    updateFigure(a, inp, h);
    inp.fired = false;
    inp.hit = false;
    left -= h;
  }
}

function strideFor(kind: FigureKind, speed: number, carrying: boolean): number {
  const prof = kind === 'sapper' && carrying ? FIGURE_GAIT_CARRY : FIGURE_KINDS[kind].gait;
  const w = ramp(Math.abs(speed), prof.walkSpeed, prof.runSpeed);
  const s = prof.slow.stride + (prof.fast.stride - prof.slow.stride) * w;
  return speed < 0 ? s * FIGURE.gait.backStride : s;
}

function drawAt(a: FigureAnim, x: number, y: number, z: number, facing = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(z * facing, z);
  drawFigure2d(ctx, a);
  ctx.restore();
}

function label(text: string, x: number, y: number, color = '#3b3a35', size = 11): void {
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function trenchWall(x: number, y: number, z: number, w: number, alpha: number): void {
  ctx.fillStyle = `rgba(92, 78, 56, ${alpha})`;
  ctx.fillRect(x + 6 * z, y - VIEW.trenchDepth * z, w, VIEW.trenchDepth * z + 3 * z);
  ctx.fillStyle = '#6d5c40';
  ctx.fillRect(x + 6 * z, y - VIEW.trenchDepth * z - 2 * z, w, 2 * z);
}

// ---------------------------------------------------------------------------
// Strip mode: evenly spaced phases of one action side by side
// ---------------------------------------------------------------------------
type Special = 'cheer' | 'hit' | 'death';

interface StripSpec {
  kind: FigureKind;
  faction: FactionId;
  action: string;
  frames: number;
  carry?: boolean;
  trench?: boolean;
  alt?: boolean;
  from?: UnitAction;
  dur?: number;
  t0?: number;
  death?: DeathVariant;
  dir?: number;
  speed?: number;
  back?: boolean;
  pitch?: number;
  seed?: number;
  /** Fire again every this many seconds while the strip runs (bursts). */
  every?: number;
}

/** Draw one strip with its ground line at groundY; cells are cellW wu wide at zoom z, starting at x0. */
function drawStrip(sp: StripSpec, x0: number, groundY: number, cellW: number, z: number, title: boolean): void {
  const a = createFigureAnim(sp.kind, sp.faction, sp.seed ?? 5);
  if (sp.alt !== undefined) a.altAim = sp.alt;
  const inp = createFigureInput(sp.kind);
  inp.carrying = sp.carry ?? false;
  inp.inTrench = sp.trench ?? false;
  inp.aimPitch = sp.pitch ?? 0;
  inp.action = sp.from ?? 'idle';
  step(a, inp, 1.5);
  const frames = sp.frames;
  const times: number[] = [];
  const special = (['cheer', 'hit', 'death'] as string[]).includes(sp.action) ? (sp.action as Special) : null;
  let speed = 0;
  if (sp.action === 'move') {
    speed = (sp.speed ?? UNITS[sp.kind].speed) * (sp.back ? -1 : 1);
    inp.action = 'move';
    inp.speed = speed;
    step(a, inp, 2.0);
    const cycle = strideFor(sp.kind, speed, inp.carrying) / Math.abs(speed);
    for (let i = 0; i < frames; i++) times.push((cycle * i) / frames);
  } else {
    const dur = sp.dur ?? (special === 'death' ? 1.6 : 1.0);
    const t0 = sp.t0 ?? 0;
    for (let i = 0; i < frames; i++) times.push(t0 + (frames === 1 ? 0 : (dur * i) / (frames - 1)));
    if (special === 'cheer') inp.victory = true;
    else if (special === 'hit') inp.hit = true;
    else if (special === 'death') inp.death = { variant: sp.death ?? 'crumple', time: 0, dir: sp.dir ?? -1 };
    else {
      inp.action = sp.action as UnitAction;
      if (sp.action === 'fire') inp.fired = true;
    }
  }
  let t = 0;
  let nextShot = sp.every ?? Infinity;
  for (let i = 0; i < frames; i++) {
    const target = times[i];
    while (t < target - 1e-9) {
      const h = Math.min(SUB, target - t);
      if (inp.death) {
        inp.death.time += h;
        updateFigure(a, inp, h);
      } else {
        if (t >= nextShot) {
          inp.fired = true;
          nextShot += sp.every ?? Infinity;
        }
        step(a, inp, h);
      }
      t += h;
    }
    const cx = x0 + (i + 0.5) * cellW * z - (sp.action === 'move' ? 0 : 6 * z);
    ctx.strokeStyle = 'rgba(60, 56, 48, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + i * cellW * z + 3, groundY + 0.5);
    ctx.lineTo(x0 + (i + 1) * cellW * z - 3, groundY + 0.5);
    ctx.stroke();
    if (sp.trench) trenchWall(cx, groundY, z, 22 * z, 0.18);
    drawAt(a, cx, groundY, z);
    if (sp.trench) trenchWall(cx, groundY, z, 22 * z, 0.55);
    label(`${target.toFixed(2)}`, cx, groundY + 11, '#6b675c', 9);
  }
  const name = `${sp.faction} ${sp.kind} ${sp.action}${sp.trench ? ' (trench)' : ''}${speed ? ` ${Math.abs(speed)} wu/s${speed < 0 ? ' backwards' : ''}` : ''}`;
  if (title) label(name, W / 2, 18, '#3b3a35', 13);
  else {
    ctx.textAlign = 'left';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#3b3a35';
    ctx.fillText(name, x0 + 4, groundY - 62 * z);
  }
}

function stripMode(): void {
  const kind = kindParam();
  const action = params.get('action') ?? 'move';
  const frames = Math.max(1, Math.round(num('frames', 12)));
  const sp: StripSpec = {
    kind,
    faction: factionParam(),
    action,
    frames,
    carry: params.get('carry') === '1',
    trench: params.get('trench') === '1',
    alt: params.has('alt') ? params.get('alt') === '1' : undefined,
    from: (params.get('from') ?? 'idle') as UnitAction,
    dur: params.has('dur') ? num('dur', 1) : undefined,
    t0: num('t0', 0),
    death: (params.get('death') ?? 'crumple') as DeathVariant,
    dir: num('dir', -1),
    speed: params.has('speed') ? num('speed', 80) : undefined,
    back: params.get('back') === '1',
    pitch: num('pitch', 0),
    seed: num('seed', 5),
  };
  const cellW = num('cell', action === 'move' ? 62 : 74);
  const z = num('z', Math.min((W - 20) / (frames * cellW), (H - 30) / 92));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = params.get('bg') === 'dark' ? '#25282a' : '#ece7da';
  ctx.fillRect(0, 0, W, H);
  drawStrip(sp, (W - frames * cellW * z) / 2, H / 2 + 40 * z, cellW, z, true);
  window.__ready = true;
}

/** Several action strips stacked in one image (for reviews). */
function actionsMode(): void {
  const set = params.get('set') ?? 'a';
  const f = 8;
  const rowsA: StripSpec[] = [
    { kind: 'rifle', faction: 'british', action: 'fire', frames: f, from: 'aim', alt: false, dur: 0.35 },
    { kind: 'rifle', faction: 'german', action: 'reload', frames: f, from: 'fire', alt: false, dur: 0.75 },
    { kind: 'lmg', faction: 'british', action: 'reload', frames: f, from: 'aim', dur: 1.1, t0: 0.3 },
    { kind: 'lmg', faction: 'german', action: 'fire', frames: f, from: 'aim', dur: 0.5, every: 0.09 },
    { kind: 'mortar', faction: 'british', action: 'reload', frames: f, from: 'aim', dur: 1.7 },
    { kind: 'at', faction: 'german', action: 'reload', frames: f, from: 'aim', dur: 2.0 },
  ];
  const rowsB: StripSpec[] = [
    { kind: 'sapper', faction: 'british', action: 'load', frames: f, dur: 2.0 },
    { kind: 'medic', faction: 'german', action: 'heal', frames: f, dur: 1.0 },
    { kind: 'mortar', faction: 'german', action: 'deploy', frames: f, from: 'move', dur: 1.0 },
    { kind: 'rifle', faction: 'british', action: 'fire', frames: f, trench: true, from: 'aim', dur: 0.5 },
    { kind: 'sniper', faction: 'british', action: 'cheer', frames: f, dur: 0.8 },
    { kind: 'at', faction: 'british', action: 'fire', frames: f, from: 'aim', dur: 0.5 },
  ];
  const rowsC: StripSpec[] = [
    { kind: 'assault', faction: 'german', action: 'move', frames: f },
    { kind: 'lmg', faction: 'british', action: 'move', frames: f },
    { kind: 'sapper', faction: 'german', action: 'move', frames: f, carry: true },
    { kind: 'medic', faction: 'british', action: 'move', frames: f },
    { kind: 'rifle', faction: 'german', action: 'move', frames: f, speed: 30 },
    { kind: 'rifle', faction: 'british', action: 'move', frames: f, speed: 36, back: true },
  ];
  const rows = set === 'b' ? rowsB : set === 'c' ? rowsC : rowsA;
  const cellW = 74;
  const rowH = 76;
  const z = num('z', Math.min((W - 20) / (f * cellW), (H - 10) / (rows.length * rowH)));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ece7da';
  ctx.fillRect(0, 0, W, H);
  const x0 = (W - f * cellW * z) / 2;
  rows.forEach((r, i) => drawStrip(r, x0, (i + 0.85) * rowH * z + 4, cellW, z, false));
  window.__ready = true;
}
// ---------------------------------------------------------------------------
// Deaths sheet
// ---------------------------------------------------------------------------
function deathsMode(): void {
  const rows: { variant: DeathVariant; dir: number; kind: FigureKind; faction: FactionId; from: UnitAction }[] = [
    { variant: 'crumple', dir: 1, kind: 'rifle', faction: 'british', from: 'move' },
    { variant: 'thrown', dir: -1, kind: 'rifle', faction: 'german', from: 'aim' },
    { variant: 'spin', dir: -1, kind: 'assault', faction: 'british', from: 'aim' },
    { variant: 'blast', dir: -1, kind: 'lmg', faction: 'german', from: 'idle' },
    { variant: 'blast', dir: 1, kind: 'sapper', faction: 'british', from: 'move' },
    { variant: 'crumple', dir: 1, kind: 'sniper', faction: 'german', from: 'aim' },
  ];
  const cols = Math.round(num('frames', 9));
  const cellW = 86;
  const cellH = 64;
  const z = num('z', Math.min((W - 20) / (cols * cellW), (H - 20) / (rows.length * cellH)));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ece7da';
  ctx.fillRect(0, 0, W, H);
  const x0 = (W - cols * cellW * z) / 2;
  const y0 = (H - rows.length * cellH * z) / 2;
  rows.forEach((r, ri) => {
    const a = createFigureAnim(r.kind, r.faction, 40 + ri);
    const inp = createFigureInput(r.kind);
    inp.action = r.from;
    inp.carrying = r.kind === 'sapper';
    inp.speed = r.from === 'move' ? UNITS[r.kind].speed : 0;
    step(a, inp, 1.5);
    inp.speed = 0;
    inp.moved = 0;
    inp.death = { variant: r.variant, time: 0, dir: r.dir };
    const end = r.variant === 'blast' ? 1.8 : 1.5;
    const gy = y0 + (ri + 0.82) * cellH * z;
    let t = 0;
    for (let c = 0; c < cols; c++) {
      const target = (end * c) / (cols - 1);
      while (t < target - 1e-9) {
        const h = Math.min(SUB, target - t);
        inp.death.time += h;
        updateFigure(a, inp, h);
        t += h;
      }
      const cx = x0 + (c + (r.variant === 'blast' ? (r.dir < 0 ? 0.95 : 0.08) : r.dir < 0 ? 0.75 : 0.3)) * cellW * z;
      ctx.strokeStyle = 'rgba(60, 56, 48, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x0 + c * cellW * z + 2, gy + 0.5);
      ctx.lineTo(x0 + (c + 1) * cellW * z - 2, gy + 0.5);
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 + c * cellW * z, gy - cellH * z, cellW * z, cellH * z + 14);
      ctx.clip();
      drawAt(a, cx, gy, z);
      ctx.restore();
      label(`${target.toFixed(2)}${a.deathStill ? ' still' : ''}`, x0 + (c + 0.5) * cellW * z, gy + 12, '#6b675c', 9);
    }
    label(`${r.variant} ${r.dir < 0 ? 'from front' : 'from behind'}`, x0 + 4, gy - cellH * z * 0.78, '#3b3a35', 11);
  });
  window.__ready = true;
}

// ---------------------------------------------------------------------------
// Sheet: every kind and faction in one pose
// ---------------------------------------------------------------------------
/** ?headgear=pilotka|ushanka|helmetUshanka puts that cap on the nations that wear it (sheet mode). */
function headgearParam(): FigureHeadgear | null {
  const h = params.get('headgear') ?? '';
  return (FIGURE_HEADGEAR_LIST as readonly string[]).includes(h) ? (h as FigureHeadgear) : null;
}

/** ?clothing=telogreika|snowSmock puts that winter clothing on the nations that wear it (sheet mode). */
function clothingParam(): FigureClothing | null {
  const c = params.get('clothing') ?? '';
  return (FIGURE_CLOTHING_LIST as readonly string[]).includes(c) ? (c as FigureClothing) : null;
}

/** ?gear=2,3 draws upgrade gear at health 2, damage 3 (sheet mode). */
function gearParam(): { health: LookStage; damage: LookStage } | null {
  const g = (params.get('gear') ?? '').split(',').map(Number);
  if (g.length !== 2 || g.some((v) => !Number.isInteger(v) || v < 0 || v > 3)) return null;
  return { health: g[0] as LookStage, damage: g[1] as LookStage };
}

function sheetMode(): void {
  const actionName = (params.get('action') ?? 'idle') as UnitAction;
  // ?kinds=rifle,lmg limits the sheet to those kinds.
  const only = (params.get('kinds') ?? '').split(',');
  const kinds = FIGURE_KIND_LIST.filter((k) => only[0] === '' || only.includes(k));
  const cap = headgearParam();
  const cloth = clothingParam();
  const gear = gearParam();
  const cellW = 70;
  const cellH = 84;
  const z = num('z', Math.min((W - 20) / (kinds.length * cellW), (H - 20) / (2 * cellH)));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = params.get('bg') === 'dark' ? '#25282a' : '#ece7da';
  ctx.fillRect(0, 0, W, H);
  const x0 = (W - kinds.length * cellW * z) / 2;
  FACTION_IDS.forEach((f, fi) => {
    const gy = (H - 2 * cellH * z) / 2 + (fi + 0.8) * cellH * z;
    kinds.forEach((k, ki) => {
      const a = createFigureAnim(k, f, 9 + ki);
      if (gear) setFigureGear(a, gear);
      setFigureHeadgear(a, cap);
      setFigureClothing(a, cloth);
      // ?mission=1009 dresses and arms every figure in that mission's era (src/data/eras.ts); ?look=romanian a force look.
      const m = getStalingradMission(num('mission', 0));
      if (m) {
        const era = missionEra(m, f);
        const inf = infantryLookOf(params.get('look') ?? '');
        setFigureHeadgear(a, inf ? inf.headgear : (era.headgear[k] ?? null));
        setFigureClothing(a, inf ? inf.clothing : (era.clothing[k] ?? null));
        setFigureWeapon(a, era.weapon[k] ?? null);
        setFigureRocketItem(a, era.rocketItem[k] ? MOLOTOV_KEY : null);
      }
      if (params.has('alt')) a.altAim = params.get('alt') === '1';
      const inp = createFigureInput(k);
      inp.carrying = k === 'sapper' && params.get('carry') !== '0';
      inp.inTrench = params.get('trench') === '1';
      inp.victory = params.get('cheer') === '1';
      inp.action = actionName;
      if (actionName === 'move') inp.speed = UNITS[k].speed;
      step(a, inp, num('t', 1.6));
      const cx = x0 + (ki + 0.42) * cellW * z;
      ctx.strokeStyle = 'rgba(60, 56, 48, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x0 + ki * cellW * z + 3, gy + 0.5);
      ctx.lineTo(x0 + (ki + 1) * cellW * z - 3, gy + 0.5);
      ctx.stroke();
      drawAt(a, cx, gy, z);
      label(`${k}`, cx, gy + 14, params.get('bg') === 'dark' ? '#c9c2b0' : '#6b675c', 10);
    });
  });
  window.__ready = true;
}

// ---------------------------------------------------------------------------
// Live grid
// ---------------------------------------------------------------------------
type SegName = UnitAction | 'run' | 'back' | 'trench' | 'hit' | 'cheer' | 'die' | 'carryIdle' | 'carryRun';

interface Seg {
  name: SegName;
  dur: number;
}

interface Actor {
  kind: FigureKind;
  faction: FactionId;
  anim: FigureAnim;
  input: FigureInput;
  segs: Seg[];
  seg: number;
  t: number;
  shotT: number;
  deaths: number;
}

function timeline(k: FigureKind): Seg[] {
  const s = (name: SegName, dur: number): Seg => ({ name, dur });
  if (k === 'sapper') {
    return [s('idle', 2), s('run', 2.6), s('load', 2.0), s('carryIdle', 1.0), s('carryRun', 2.8), s('back', 1.6), s('hit', 1.0), s('cheer', 2), s('die', 3.2)];
  }
  if (k === 'medic') return [s('idle', 2), s('run', 2.6), s('heal', 2.6), s('idle', 1), s('back', 1.6), s('trench', 2), s('hit', 1.0), s('cheer', 2), s('die', 3.2)];
  const crew = FIGURE_KINDS[k].staysEmplaced;
  const out: Seg[] = [s('idle', 2), s('run', 2.6)];
  if (crew) out.push(s('deploy', 1.2));
  out.push(s('aim', 1.4), s('fire', 1.6), s('reload', k === 'mortar' ? 2.6 : k === 'at' ? 2.4 : 1.6));
  if (k === 'assault') out.push(s('throw', 1.1), s('throw', 1.1));
  out.push(s('fire', 1.2), s('idle', 1.5), s('back', 1.6), s('trench', 3), s('hit', 1.0), s('cheer', 2), s('die', 3.2));
  return out;
}

const FIRE_GAP: Record<FigureKind, number> = { sapper: 1, rifle: 0.9, conscript: 1.1, lmg: 0.09, assault: 0.085, mortar: 1.2, sniper: 1.4, medic: 1, at: 1.5, flame: 0.5, commander: 1.1, aa: 0.15 };

function applySeg(a: Actor, seg: Seg, dt: number): void {
  const inp = a.input;
  const sp = UNITS[a.kind].speed;
  inp.speed = 0;
  inp.inTrench = false;
  inp.victory = false;
  inp.carrying = false;
  inp.death = null;
  inp.action = 'idle';
  switch (seg.name) {
    case 'run':
      inp.action = 'move';
      inp.speed = sp;
      break;
    case 'carryRun':
      inp.action = 'move';
      inp.speed = sp;
      inp.carrying = true;
      break;
    case 'carryIdle':
      inp.carrying = true;
      break;
    case 'back':
      inp.action = 'move';
      inp.speed = -sp * 0.45;
      break;
    case 'trench':
      inp.inTrench = true;
      inp.action = a.kind === 'medic' ? 'idle' : a.t < 0.8 ? 'aim' : 'fire';
      break;
    case 'hit':
      if (a.t < dt || (a.t >= 0.5 && a.t - dt < 0.5)) inp.hit = true;
      break;
    case 'cheer':
      inp.victory = true;
      break;
    case 'die':
      inp.death = { variant: DEATH_VARIANTS[a.deaths % DEATH_VARIANTS.length], time: a.t, dir: a.deaths % 2 === 0 ? -1 : 1 };
      break;
    default:
      inp.action = seg.name;
      if (seg.name === 'load') inp.carrying = false;
  }
  if (inp.action === 'fire') {
    a.shotT -= dt;
    if (a.shotT <= 0) {
      inp.fired = true;
      a.shotT += FIRE_GAP[a.kind];
    }
  } else a.shotT = 0;
}

interface Runner {
  anim: FigureAnim;
  input: FigureInput;
  kind: FigureKind;
  x: number;
  facing: number;
  t: number;
}

function liveMode(): void {
  const actors: Actor[] = [];
  FACTION_IDS.forEach((f, fi) =>
    FIGURE_KIND_LIST.forEach((k, ki) => {
      const anim = createFigureAnim(k, f, fi * 31 + ki * 7 + 1);
      actors.push({ kind: k, faction: f, anim, input: createFigureInput(k), segs: timeline(k), seg: 0, t: ki * 0.37, shotT: 0, deaths: fi + ki });
    }),
  );
  const runners: Runner[] = [];
  const laneW = 1000;
  FACTION_IDS.forEach((f, fi) =>
    FIGURE_KIND_LIST.forEach((k, ki) => {
      const anim = createFigureAnim(k, f, 100 + fi * 13 + ki);
      runners.push({ anim, input: createFigureInput(k), kind: k, x: (ki * 125 + fi * 60) % laneW, facing: fi === 0 ? 1 : -1, t: ki * 1.3 + fi * 2.1 });
    }),
  );
  const cellW = 100;
  const cellH = 96;
  const laneH = 120;
  const worldW = FIGURE_KIND_LIST.length * cellW;
  const worldH = 2 * cellH + laneH;
  const z = num('z', Math.min((W - 10) / worldW, (H - 10) / worldH));
  const slow = num('speed', 1);
  let last = performance.now();
  let frames = 0;

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000) * slow;
    last = now;
    for (const a of actors) {
      let seg = a.segs[a.seg];
      a.t += dt;
      if (a.t >= seg.dur) {
        a.t -= seg.dur;
        if (seg.name === 'die') a.deaths++;
        a.seg = (a.seg + 1) % a.segs.length;
        seg = a.segs[a.seg];
      }
      applySeg(a, seg, dt);
      step(a.anim, a.input, dt);
    }
    for (const r of runners) {
      r.t += dt;
      const cyc = r.t % 9;
      const sp = UNITS[r.kind].speed;
      r.input.carrying = r.kind === 'sapper' && Math.floor(r.t / 9) % 2 === 0;
      if (cyc < 6) {
        r.input.action = 'move';
        r.input.speed = sp;
      } else if (cyc < 7.4) {
        r.input.action = 'idle';
        r.input.speed = 0;
      } else {
        r.input.action = 'move';
        r.input.speed = -sp * 0.45;
      }
      step(r.anim, r.input, dt);
      r.x += r.input.speed * dt * r.facing;
      if (r.x > laneW + 40) r.x -= laneW + 80;
      if (r.x < -40) r.x += laneW + 80;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = (W - worldW * z) / 2;
    const oy = (H - worldH * z) / 2;
    const sky = ctx.createLinearGradient(0, oy, 0, oy + 2 * cellH * z);
    sky.addColorStop(0, '#d9d3c2');
    sky.addColorStop(1, '#a9a490');
    ctx.fillStyle = '#1f2122';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = sky;
    ctx.fillRect(ox, oy, worldW * z, 2 * cellH * z);
    actors.forEach((a, i) => {
      const col = i % FIGURE_KIND_LIST.length;
      const row = Math.floor(i / FIGURE_KIND_LIST.length);
      const cx = ox + (col + 0.45) * cellW * z;
      const gy = oy + (row + 0.8) * cellH * z;
      ctx.fillStyle = '#7d7660';
      ctx.fillRect(ox + col * cellW * z, gy, cellW * z, 2);
      const inTrench = a.input.inTrench;
      if (inTrench) trenchWall(cx, gy, z, 30 * z, 0.0);
      drawAt(a.anim, cx, gy + (inTrench ? 0 : 0), z);
      if (inTrench) trenchWall(cx, gy, z, 30 * z, 0.92);
      const seg = a.segs[a.seg];
      label(`${a.faction === 'british' ? 'GB' : 'DE'} ${a.kind}: ${seg.name}`, cx, gy + 13, '#2f2d28', Math.max(8, 10 * Math.min(1, z)));
    });
    // Runner lane on a dark ground to check the rim light.
    const ly = oy + 2 * cellH * z;
    const night = ctx.createLinearGradient(0, ly, 0, ly + laneH * z);
    night.addColorStop(0, '#2c3236');
    night.addColorStop(1, '#3a3a30');
    ctx.fillStyle = night;
    ctx.fillRect(ox, ly, worldW * z, laneH * z);
    const scaleX = (worldW * z) / laneW;
    runners.forEach((r, i) => {
      const gy = ly + (0.5 + (i % 2) * 0.38) * laneH * z;
      ctx.fillStyle = '#4c4636';
      ctx.fillRect(ox, gy, worldW * z, 2);
      drawAt(r.anim, ox + r.x * scaleX, gy, z * 0.9, r.facing);
    });
    frames++;
    if (frames === 3) window.__ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Icons: paintUnitIcon() at a few sizes
// ---------------------------------------------------------------------------
function iconsMode(): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#30332f';
  ctx.fillRect(0, 0, W, H);
  const sizes = [96, 48, 28];
  let y = 10;
  for (const size of sizes) {
    FACTION_IDS.forEach((f, fi) => {
      FIGURE_KIND_LIST.forEach((k, ki) => {
        const c = document.createElement('canvas');
        c.width = Math.round(size * dpr);
        c.height = Math.round(size * dpr);
        paintUnitIcon(c, k, f);
        const x = 10 + (fi * FIGURE_KIND_LIST.length + ki) * (size + 6);
        ctx.fillStyle = '#e4dfd0';
        ctx.fillRect(x, y, size, size);
        ctx.drawImage(c, x, y, size, size);
      });
    });
    y += size + 10;
  }
  window.__ready = true;
}

const mode = params.get('mode');
if (mode === 'strip') stripMode();
else if (mode === 'actions') actionsMode();
else if (mode === 'icons') iconsMode();
else if (mode === 'deaths') deathsMode();
else if (mode === 'sheet') sheetMode();
else liveMode();
