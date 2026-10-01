import { describe, expect, it } from 'vitest';
import { createFigureAnim, createFigureInput, updateFigure, type FigureAnim, type FigureInput } from '../../src/art/figure';
import {
  J_CHEST,
  J_FANKLE,
  J_FELBOW,
  J_FHAND,
  J_FHEEL,
  J_FKNEE,
  J_FSHOULDER,
  J_FTOE,
  J_HEAD,
  J_HIP,
  J_NANKLE,
  J_NECK,
  J_NELBOW,
  J_NHAND,
  J_NHEEL,
  J_NKNEE,
  J_NSHOULDER,
  J_NTOE,
  J_MUZZLE,
  N_JOINTS,
  N_POSE,
} from '../../src/art/figure/pose';
import { DEATH_VARIANTS, FIGURE, FIGURE_KIND_LIST, type DeathVariant, type FigureKind } from '../../src/data/figure';
import type { FactionId, UnitAction } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';

const B = FIGURE.bones;
const DT = 1 / 60;
const FACTIONS: readonly FactionId[] = ['british', 'german'];

interface State {
  name: string;
  action: UnitAction;
  speed?: number;
  back?: boolean;
  trench?: boolean;
  carry?: boolean;
  victory?: boolean;
  hit?: boolean;
  fire?: boolean;
  controlled?: boolean;
  pitch?: number;
}

const STATES: readonly State[] = [
  { name: 'idle', action: 'idle' },
  { name: 'run', action: 'move', speed: 1 },
  { name: 'walk', action: 'move', speed: 0.4 },
  { name: 'back', action: 'move', speed: 0.45, back: true },
  { name: 'aim', action: 'aim', pitch: 0.2 },
  { name: 'fire', action: 'fire', fire: true },
  { name: 'reload', action: 'reload' },
  { name: 'throw', action: 'throw' },
  { name: 'load', action: 'load' },
  { name: 'heal', action: 'heal' },
  { name: 'deploy', action: 'deploy' },
  { name: 'trench', action: 'fire', trench: true, fire: true },
  { name: 'carry', action: 'move', speed: 1, carry: true },
  { name: 'cheer', action: 'idle', victory: true },
  { name: 'hit', action: 'idle', hit: true },
  { name: 'runGun', action: 'fire', speed: 1, fire: true, controlled: true },
  { name: 'inside', action: 'inside' },
];

function apply(inp: FigureInput, kind: FigureKind, s: State, t: number): void {
  const sp = UNITS[kind].speed * (s.speed ?? 0) * (s.back ? -1 : 1);
  inp.action = s.action;
  inp.speed = sp;
  inp.moved = sp * DT;
  inp.inTrench = s.trench ?? false;
  inp.carrying = s.carry ?? false;
  inp.victory = s.victory ?? false;
  inp.controlled = s.controlled ?? false;
  inp.aimPitch = s.pitch ?? 0;
  inp.fired = (s.fire ?? false) && Math.floor(t / 0.3) !== Math.floor((t - DT) / 0.3);
  inp.hit = (s.hit ?? false) && t < DT * 1.5;
  inp.death = null;
}

function dist(j: Float64Array, a: number, b: number): number {
  return Math.hypot(j[a * 2] - j[b * 2], j[a * 2 + 1] - j[b * 2 + 1]);
}

function checkBones(a: FigureAnim): void {
  const j = a.joints;
  const pairs: [number, number, number][] = [
    [J_HIP, J_CHEST, B.spineLower],
    [J_CHEST, J_NECK, B.spineUpper],
    [J_NECK, J_HEAD, B.neck],
    [J_NSHOULDER, J_NELBOW, B.upperArm],
    [J_NELBOW, J_NHAND, B.forearm],
    [J_FSHOULDER, J_FELBOW, B.upperArm],
    [J_FELBOW, J_FHAND, B.forearm],
    [J_HIP, J_NKNEE, B.thigh],
    [J_NKNEE, J_NANKLE, B.shin],
    [J_HIP, J_FKNEE, B.thigh],
    [J_FKNEE, J_FANKLE, B.shin],
  ];
  for (const [p, q, len] of pairs) expect(Math.abs(dist(j, p, q) - len)).toBeLessThan(1e-6);
}

function checkGround(a: FigureAnim): void {
  const j = a.joints;
  for (const k of [J_NANKLE, J_FANKLE, J_NTOE, J_FTOE, J_NHEEL, J_FHEEL]) expect(j[k * 2 + 1]).toBeLessThanOrEqual(1e-6);
}

function checkFinite(a: FigureAnim): void {
  for (let i = 0; i < N_POSE; i++) expect(Number.isFinite(a.pose[i])).toBe(true);
  for (let i = 0; i < N_JOINTS * 2; i++) expect(Number.isFinite(a.joints[i])).toBe(true);
  expect(Number.isFinite(a.muzzleX) && Number.isFinite(a.muzzleY) && Number.isFinite(a.crateX)).toBe(true);
}

/** Largest per-frame movement of any body joint (and of the muzzle) while stepping. */
function maxStep(prev: Float64Array, a: FigureAnim): { body: number; muzzle: number } {
  let body = 0;
  for (let k = 0; k < N_JOINTS; k++) {
    const d = Math.hypot(a.joints[k * 2] - prev[k * 2], a.joints[k * 2 + 1] - prev[k * 2 + 1]);
    if (k === J_MUZZLE) continue;
    if (d > body) body = d;
  }
  const muzzle = Math.hypot(a.joints[J_MUZZLE * 2] - prev[J_MUZZLE * 2], a.joints[J_MUZZLE * 2 + 1] - prev[J_MUZZLE * 2 + 1]);
  return { body, muzzle };
}

/**
 * A joint may not move more than this per 1/60 s frame (wu). Legitimately fast motions stay below it: running feet
 * about 3, the throwing hand about 6, a blast toss or a soldier dropping from a cheer straight into a firing pose
 * about 9. A pop (a pose snapping to another) moves joints 15 wu or more in one frame.
 */
const BODY_BOUND = 10;
const MUZZLE_BOUND = 12;

describe('figure pose', () => {
  it('keeps bone lengths constant, feet above the ground and every number finite through all actions', () => {
    for (const f of FACTIONS) {
      for (const kind of FIGURE_KIND_LIST) {
        const a = createFigureAnim(kind, f, 17);
        const inp = createFigureInput(kind);
        for (const s of STATES) {
          for (let t = 0; t < 1.3; t += DT) {
            apply(inp, kind, s, t);
            updateFigure(a, inp, DT);
            checkFinite(a);
            checkBones(a);
            checkGround(a);
          }
        }
      }
    }
  });

  it('keeps bone lengths and the ground through every death fall', () => {
    for (const kind of FIGURE_KIND_LIST) {
      for (const from of [STATES[0], STATES[1], STATES[4], STATES[11]]) {
        for (const variant of DEATH_VARIANTS) {
          for (const dir of [-1, 1]) {
            const a = createFigureAnim(kind, 'german', 3);
            const inp = createFigureInput(kind);
            for (let t = 0; t < 1; t += DT) {
              apply(inp, kind, from, t);
              updateFigure(a, inp, DT);
            }
            inp.speed = 0;
            inp.moved = 0;
            inp.death = { variant, time: 0, dir };
            for (let t = 0; t < 3; t += DT) {
              inp.death.time = t;
              updateFigure(a, inp, DT);
              checkFinite(a);
              checkBones(a);
              checkGround(a);
            }
            expect(a.deathStill).toBe(true);
          }
        }
      }
    }
  });

  it('ends every death in a body that no longer moves', () => {
    for (const variant of DEATH_VARIANTS) {
      const a = createFigureAnim('rifle', 'british', 8);
      const inp = createFigureInput('rifle');
      updateFigure(a, inp, DT);
      inp.death = { variant: variant as DeathVariant, time: 0 };
      let t = 0;
      while (!a.deathStill && t < 5) {
        t += DT;
        inp.death.time = t;
        updateFigure(a, inp, DT);
      }
      expect(a.deathStill).toBe(true);
      const snap = Float64Array.from(a.joints);
      for (let i = 0; i < 60; i++) {
        t += DT;
        inp.death.time = t;
        updateFigure(a, inp, DT);
      }
      for (let i = 0; i < snap.length; i++) expect(a.joints[i]).toBeCloseTo(snap[i], 9);
    }
  });

  it('plants the stance foot: its world position stays fixed while the unit moves at constant speed', () => {
    const cases: { kind: FigureKind; speed: number; carry: boolean }[] = [];
    for (const kind of FIGURE_KIND_LIST) {
      cases.push({ kind, speed: UNITS[kind].speed, carry: false });
      cases.push({ kind, speed: 40, carry: false });
      cases.push({ kind, speed: -30, carry: false });
    }
    cases.push({ kind: 'sapper', speed: 70, carry: true });
    for (const c of cases) {
      const a = createFigureAnim(c.kind, 'british', 21);
      const inp = createFigureInput(c.kind);
      inp.action = 'move';
      inp.speed = c.speed;
      inp.carrying = c.carry;
      let x = 0;
      const dt = 1 / 120;
      for (let i = 0; i < 360; i++) {
        inp.moved = c.speed * dt;
        x += inp.moved;
        updateFigure(a, inp, dt);
      }
      // Track each foot's toe tip in world space through its stance phases.
      const lo = [Infinity, Infinity];
      const hi = [-Infinity, -Infinity];
      let worst = 0;
      let stances = 0;
      const was = [a.planted[0], a.planted[1]];
      for (let i = 0; i < 480; i++) {
        inp.moved = c.speed * dt;
        x += inp.moved;
        updateFigure(a, inp, dt);
        for (let f = 0; f < 2; f++) {
          const toe = f === 0 ? J_NTOE : J_FTOE;
          const planted = a.planted[f] === 1;
          if (planted && !was[f]) {
            lo[f] = Infinity;
            hi[f] = -Infinity;
            stances++;
          }
          // Skip the heel-strike roll (the boot rocks onto the toe about its heel).
          if (planted && a.footP[f] >= 0) {
            const wx = x + a.joints[toe * 2];
            lo[f] = Math.min(lo[f], wx);
            hi[f] = Math.max(hi[f], wx);
            worst = Math.max(worst, hi[f] - lo[f]);
          }
          was[f] = a.planted[f];
        }
      }
      expect(stances, `${c.kind} at ${c.speed}`).toBeGreaterThan(2);
      expect(worst, `${c.kind} at ${c.speed}`).toBeLessThan(0.25);
    }
  });

  it('blends every transition between actions without popping', () => {
    let worstBody = 0;
    let worstMuzzle = 0;
    let where = '';
    for (const kind of FIGURE_KIND_LIST) {
      for (const s1 of STATES) {
        for (const s2 of STATES) {
          const a = createFigureAnim(kind, kind === 'lmg' || kind === 'at' ? 'german' : 'british', 5);
          const inp = createFigureInput(kind);
          for (let t = 0; t < 1.2; t += DT) {
            apply(inp, kind, s1, t);
            updateFigure(a, inp, DT);
          }
          const prev = Float64Array.from(a.joints);
          for (let t = 0; t < 1.2; t += DT) {
            apply(inp, kind, s2, t);
            updateFigure(a, inp, DT);
            const m = maxStep(prev, a);
            if (m.body > worstBody) {
              worstBody = m.body;
              where = `${kind} ${s1.name} -> ${s2.name} at ${t.toFixed(3)}`;
            }
            worstMuzzle = Math.max(worstMuzzle, m.muzzle);
            prev.set(a.joints);
          }
        }
        // ... and into every death.
        for (const variant of DEATH_VARIANTS) {
          const a = createFigureAnim(kind, 'british', 6);
          const inp = createFigureInput(kind);
          for (let t = 0; t < 1.2; t += DT) {
            apply(inp, kind, s1, t);
            updateFigure(a, inp, DT);
          }
          const prev = Float64Array.from(a.joints);
          inp.death = { variant, time: 0 };
          for (let t = 0; t < 2; t += DT) {
            inp.death.time = t;
            updateFigure(a, inp, DT);
            const m = maxStep(prev, a);
            if (m.body > worstBody) {
              worstBody = m.body;
              where = `${kind} ${s1.name} -> death ${variant} at ${t.toFixed(3)}`;
            }
            prev.set(a.joints);
          }
        }
      }
    }
    expect(worstBody, where).toBeLessThan(BODY_BOUND);
    expect(worstMuzzle).toBeLessThan(MUZZLE_BOUND);
  });

  it('survives extreme and odd inputs without NaN', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const actions: UnitAction[] = ['idle', 'move', 'aim', 'fire', 'reload', 'throw', 'load', 'heal', 'deploy', 'inside'];
    for (const kind of FIGURE_KIND_LIST) {
      const a = createFigureAnim(kind, rnd() < 0.5 ? 'british' : 'german', 99);
      const inp = createFigureInput(kind);
      for (let i = 0; i < 2000; i++) {
        inp.action = actions[Math.floor(rnd() * actions.length)];
        inp.speed = (rnd() - 0.4) * 300;
        const dt = rnd() < 0.05 ? rnd() * 2 : rnd() * 0.05;
        inp.moved = inp.speed * dt;
        inp.aimPitch = (rnd() - 0.5) * 6;
        inp.inTrench = rnd() < 0.2;
        inp.carrying = rnd() < 0.3;
        inp.victory = rnd() < 0.05;
        inp.fired = rnd() < 0.2;
        inp.hit = rnd() < 0.1;
        updateFigure(a, inp, dt);
        checkFinite(a);
        checkBones(a);
        checkGround(a);
      }
    }
  });

  it('exposes the muzzle on the barrel line and the crate under the hands', () => {
    const a = createFigureAnim('rifle', 'british', 1);
    const inp = createFigureInput('rifle');
    inp.action = 'aim';
    for (let i = 0; i < 90; i++) updateFigure(a, inp, DT);
    expect(a.muzzleX).toBeGreaterThan(20);
    expect(Math.hypot(a.muzzleDX, a.muzzleDY)).toBeCloseTo(1, 9);
    const s = createFigureAnim('sapper', 'german', 1);
    const si = createFigureInput('sapper');
    si.carrying = true;
    for (let i = 0; i < 90; i++) updateFigure(s, si, DT);
    expect(s.crateVisible).toBe(true);
    expect(s.crateY).toBeLessThan(-20);
    expect(Math.abs(s.joints[J_NHAND * 2] - s.crateX)).toBeLessThan(FIGURE.bones.forearm);
  });
});
