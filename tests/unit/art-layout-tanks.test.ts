import { describe, expect, it } from 'vitest';
import { TANK_LAYOUT, TANK_MAX_WHEELS } from '../../src/data/artLayout';
import { TANK_KEYS, TANK_LOOKS, TANK_TRACK_PITCH, createTankPose, layoutTank, type TankPose, type TankState } from '../../src/art/vehicles';

const TAU = Math.PI * 2;

function state(look: (typeof TANK_LOOKS)[number], over: Partial<TankState> = {}): TankState {
  return { look, distance: 0, turretAim: 0, recoil: 0, hullRock: 0, ...over };
}

describe('layoutTank', () => {
  it('allocates nothing: it fills and returns the pose it is given, reusing every part object', () => {
    const pose = createTankPose();
    const refsOf = (p: TankPose): object[] => [p.track, p.hull, p.barrel, p.turret, p.muzzle, p.exhaust, p.hullMg, p.wheels, ...p.wheels];
    const before = refsOf(pose);
    const shape = Object.keys(pose).join();
    expect(pose.wheels.length).toBe(TANK_MAX_WHEELS);
    for (let i = 0; i < 300; i++) {
      const look = TANK_LOOKS[i % TANK_LOOKS.length];
      const s = state(look, { distance: i * 3.7, turretAim: Math.sin(i) * 0.2, recoil: (i % 10) / 10, hullRock: Math.cos(i) });
      expect(layoutTank(s, pose)).toBe(pose);
    }
    const after = refsOf(pose);
    expect(after.length).toBe(before.length);
    after.forEach((part, i) => expect(part === before[i], `part ${i} was replaced`).toBe(true));
    expect(Object.keys(pose).join()).toBe(shape);
    expect(pose.wheels.length).toBe(TANK_MAX_WHEELS);
  });

  it('does not grow the heap noticeably over many calls', () => {
    const pose = createTankPose();
    const s = state('kingTiger');
    for (let i = 0; i < 20000; i++) layoutTank(s, pose);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 400000; i++) {
      s.distance = i * 0.5;
      s.recoil = (i % 100) / 100;
      layoutTank(s, pose);
    }
    // A few allocated objects per call would add up to tens of megabytes.
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(12 * 1024 * 1024);
  });

  it('turns every wheel in proportion to distance travelled (angle = distance / radius)', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const a = createTankPose();
      const b = createTankPose();
      layoutTank(state(look, { distance: 5 }), a);
      layoutTank(state(look, { distance: 10 }), b);
      expect(a.wheelCount).toBe(L.wheels.length);
      for (let i = 0; i < L.wheels.length; i++) {
        const r = L.wheels[i].r;
        expect(a.wheels[i].rot).toBeCloseTo(5 / r, 9);
        expect(b.wheels[i].rot).toBeCloseTo(2 * a.wheels[i].rot, 9);
      }
      // A bigger wheel turns through a smaller angle over the same distance.
      const small = L.wheels.reduce((m, w, i) => (w.r < L.wheels[m].r ? i : m), 0);
      const big = L.wheels.reduce((m, w, i) => (w.r > L.wheels[m].r ? i : m), 0);
      expect(a.wheels[small].rot).toBeGreaterThan(a.wheels[big].rot);
      expect(a.wheels[small].rot / a.wheels[big].rot).toBeCloseTo(L.wheels[big].r / L.wheels[small].r, 9);
    }
  });

  it('turns the wheels the other way in reverse and wraps whole turns', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const fwd = createTankPose();
      const back = createTankPose();
      layoutTank(state(look, { distance: 12 }), fwd);
      layoutTank(state(look, { distance: -12 }), back);
      for (let i = 0; i < L.wheels.length; i++) expect(back.wheels[i].rot).toBeCloseTo(-fwd.wheels[i].rot, 9);
      // One full roll of a wheel is a full turn: same picture, and the angle stays bounded.
      const w = L.wheels[0];
      const roll = createTankPose();
      layoutTank(state(look, { distance: TAU * w.r * 1000 + 3 }), roll);
      expect(Math.abs(roll.wheels[0].rot)).toBeLessThan(TAU);
      expect(Math.cos(roll.wheels[0].rot)).toBeCloseTo(Math.cos(3 / w.r), 5);
      expect(Math.sin(roll.wheels[0].rot)).toBeCloseTo(Math.sin(3 / w.r), 5);
    }
  });

  it('scrolls the tread one lug pitch per pitch travelled, through every frame', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const pitch = TANK_TRACK_PITCH[look];
      expect(Math.abs(pitch - L.trackPitch)).toBeLessThan(L.trackPitch * 0.25);
      const pose = createTankPose();
      const seen = new Set<number>();
      for (let k = 0; k < 200; k++) {
        layoutTank(state(look, { distance: (k / 200) * pitch }), pose);
        expect(pose.trackFrame).toBeGreaterThanOrEqual(0);
        expect(pose.trackFrame).toBeLessThan(L.trackFrames);
        seen.add(pose.trackFrame);
      }
      expect(seen.size).toBe(L.trackFrames);
      const a = createTankPose();
      const b = createTankPose();
      layoutTank(state(look, { distance: 0.3 * pitch }), a);
      layoutTank(state(look, { distance: 7.3 * pitch }), b);
      expect(b.trackFrame).toBe(a.trackFrame);
      expect(TANK_KEYS[look].track.length).toBe(L.trackFrames);
    }
  });

  it('slides the barrel back along its own axis on recoil and leaves the muzzle that far behind', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const run = createTankPose();
      const back = createTankPose();
      layoutTank(state(look, { recoil: 0 }), run);
      layoutTank(state(look, { recoil: 1 }), back);
      expect(run.muzzle.x - back.muzzle.x).toBeCloseTo(L.recoilDist, 9);
      expect(run.muzzle.y).toBeCloseTo(back.muzzle.y, 9);
      expect(run.muzzle.x - run.barrel.x).toBeCloseTo(L.barrelLength, 9);
      // Recoil does not move the hull or turret.
      expect(back.turret.x).toBe(run.turret.x);
      expect(back.hull.rot).toBe(run.hull.rot);
    }
  });

  it('elevates the gun about the trunnion, within the look limits, with positive aim raising the muzzle', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const level = createTankPose();
      const up = createTankPose();
      const tooHigh = createTankPose();
      layoutTank(state(look, { turretAim: 0 }), level);
      layoutTank(state(look, { turretAim: 0.1 }), up);
      layoutTank(state(look, { turretAim: 5 }), tooHigh);
      expect(up.muzzle.y).toBeLessThan(level.muzzle.y);
      expect(tooHigh.barrel.rot).toBeCloseTo(-L.elevMax, 9);
      layoutTank(state(look, { turretAim: -5 }), tooHigh);
      expect(tooHigh.barrel.rot).toBeCloseTo(-L.elevMin, 9);
      // The trunnion does not move with elevation.
      expect(up.barrel.x).toBeCloseTo(level.barrel.x, 9);
      expect(up.barrel.y).toBeCloseTo(level.barrel.y, 9);
    }
  });

  it('rocks the hull about its pivot, carrying turret, exhaust and hull MG, and clamps the rock', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const flat = createTankPose();
      const nose = createTankPose();
      const over = createTankPose();
      layoutTank(state(look, { hullRock: 0 }), flat);
      layoutTank(state(look, { hullRock: 1 }), nose);
      layoutTank(state(look, { hullRock: 9 }), over);
      expect(nose.hull.rot).toBeCloseTo(-L.rockMax, 9);
      expect(over.hull.rot).toBeCloseTo(nose.hull.rot, 9);
      expect(nose.turret.rot).toBeCloseTo(nose.hull.rot, 9);
      // Nose up: the hull MG at the front rises, the exhaust at the rear drops.
      expect(nose.hullMg.y).toBeLessThan(flat.hullMg.y);
      expect(nose.exhaust.y).toBeGreaterThan(flat.exhaust.y);
      // Rigid rotation: distances to the pivot are unchanged.
      const d = (p: { x: number; y: number }): number => Math.hypot(p.x - L.rockPivot.x, p.y - L.rockPivot.y);
      expect(d(nose.hullMg)).toBeCloseTo(d(flat.hullMg), 9);
      expect(d(nose.exhaust)).toBeCloseTo(d(flat.exhaust), 9);
      expect(d(nose.turret)).toBeCloseTo(d(flat.turret), 9);
      // The running gear stays on the ground.
      expect(nose.track).toEqual(flat.track);
      expect(nose.wheels[0].y).toBe(flat.wheels[0].y);
    }
  });

  it('puts the muzzle ahead of the turret, the hull MG at the front and the exhaust behind', () => {
    for (const look of TANK_LOOKS) {
      const pose = createTankPose();
      layoutTank(state(look), pose);
      expect(pose.muzzle.x).toBeGreaterThan(pose.turret.x + 40);
      expect(pose.exhaust.x).toBeLessThan(0);
      expect(pose.hullMg.x).toBeGreaterThan(0);
      expect(pose.muzzle.y).toBeLessThan(0);
    }
  });
});
