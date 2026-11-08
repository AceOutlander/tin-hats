import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { RENDER } from '../../src/data/render';
import type { DamageType, UnitKind } from '../../src/data/schema';
import { UNIT_KINDS } from '../../src/data/units';
import { createMemoryStorage, loadSave } from '../../src/meta';
import { BloodPools, bleeds, poolSpread, type PoolImage } from '../../src/render/blood';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

const B = RENDER.blood;

function makePools(cap: number = B.maxPools) {
  const images: PoolImage[] = [];
  for (let i = 0; i < cap; i++) images.push({ x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, visible: false });
  const rows: number[] = Array<number>(cap).fill(-1);
  const pools = new BloodPools(images, (img, row) => (rows[images.indexOf(img)] = row), 1);
  const visible = () => images.filter((img) => img.visible).length;
  return { pools, images, rows, visible };
}

/** One rifleman shot dead (unit id `id`, depth row 2). */
function shot(pools: BloodPools, id: number, kind: UnitKind = 'rifle', cause: DamageType | null = 'bullet'): number {
  return pools.onDeath(id, 2, kind, cause, false);
}

describe('blood: which deaths bleed', () => {
  it('only infantry killed by gunfire', () => {
    const vehicles: UnitKind[] = ['tank', 'heavyTank'];
    for (const kind of UNIT_KINDS) {
      const infantry = !vehicles.includes(kind);
      expect(bleeds(kind, 'bullet', false), kind).toBe(infantry);
      expect(bleeds(kind, 'explosive', false), kind).toBe(false);
      expect(bleeds(kind, 'antiTank', false), kind).toBe(false);
      expect(bleeds(kind, null, false), kind).toBe(false);
    }
    // A sapper driving his supply truck is a vehicle.
    expect(bleeds('sapper', 'bullet', true)).toBe(false);
  });

  it('gives no pool, and counts no death, for anything else', () => {
    const { pools, visible } = makePools();
    expect(shot(pools, 1, 'rifle', 'explosive')).toBe(-1);
    expect(shot(pools, 2, 'lmg', 'antiTank')).toBe(-1);
    expect(shot(pools, 3, 'tank', 'bullet')).toBe(-1);
    expect(shot(pools, 4, 'heavyTank', 'antiTank')).toBe(-1);
    expect(pools.onDeath(5, 1, 'sapper', 'bullet', true)).toBe(-1);
    expect(pools.count()).toBe(0);
    expect(pools.bleedingDeaths).toBe(0);
    expect(visible()).toBe(0);
  });
});

describe('blood: a pool', () => {
  it('waits for the fall, then spreads to full size over about a second', () => {
    expect(poolSpread(0)).toBe(0);
    expect(poolSpread(B.delay - 0.01)).toBe(0);
    expect(poolSpread(B.delay)).toBeCloseTo(B.startScale, 9);
    let last = 0;
    for (let t = B.delay; t <= B.delay + B.spreadTime; t += 0.05) {
      const k = poolSpread(t);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
    expect(poolSpread(B.delay + B.spreadTime / 2)).toBeLessThan(1);
    expect(poolSpread(B.delay + B.spreadTime)).toBe(1);
    expect(poolSpread(60)).toBe(1);
    expect(B.spreadTime).toBeGreaterThanOrEqual(0.7);
    expect(B.spreadTime).toBeLessThanOrEqual(1.3);
  });

  it('lies on the ground under the body, in its row, and fades with it', () => {
    const { pools, images, rows } = makePools();
    const i = shot(pools, 7);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(rows[i]).toBe(2);
    const img = images[i];
    pools.place(i, 7, 0.1, 500, 300, 1, 1);
    expect(img.visible).toBe(false);
    pools.place(i, 7, B.delay + B.spreadTime, 500, 300, 1, 1);
    expect(img.visible).toBe(true);
    expect(img.x).toBe(500);
    expect(img.y).toBeCloseTo(300 + B.dropY, 9);
    expect(img.alpha).toBeCloseTo(B.alpha, 9);
    // Small: never wider than the size spread allows (a body is about 58 wu tall).
    expect(img.scaleX * B.spriteW).toBeLessThanOrEqual(B.spriteW * (1 + B.sizeSpread) + 1e-9);
    expect(img.scaleX * B.spriteW).toBeLessThan(45);
    // The body fades: so does the pool, at the same rate.
    pools.place(i, 7, 8, 500, 300, 1, 0.5);
    expect(img.alpha).toBeCloseTo(B.alpha * 0.5, 9);
    pools.place(i, 7, 9, 500, 300, 1, 0);
    expect(img.visible).toBe(false);
    // The body goes: the pool is free.
    pools.end(i, 7);
    expect(pools.count()).toBe(0);
    expect(img.visible).toBe(false);
  });

  it('hides while its body is off screen and keeps its place', () => {
    const { pools, images } = makePools();
    const i = shot(pools, 3);
    pools.place(i, 3, 2, 100, 300, 1, 1);
    pools.hide(i, 3);
    expect(images[i].visible).toBe(false);
    expect(pools.drawn()).toBe(0);
    expect(pools.count()).toBe(1);
    pools.place(i, 3, 2.1, 100, 300, 1, 1);
    expect(images[i].visible).toBe(true);
    expect(pools.drawn()).toBe(1);
  });
});

describe('blood: the pooled decals', () => {
  it('never has more pools than the cap, in a battle of hundreds of deaths', () => {
    const { pools, visible } = makePools();
    expect(pools.cap).toBe(B.maxPools);
    const slots: number[] = [];
    for (let id = 1; id <= 400; id++) {
      const i = shot(pools, id);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(B.maxPools);
      slots.push(i);
      pools.place(i, id, 2, id * 10, 300, 1, 1);
      expect(pools.count()).toBeLessThanOrEqual(B.maxPools);
      expect(visible()).toBeLessThanOrEqual(B.maxPools);
    }
    expect(pools.count()).toBe(B.maxPools);
    expect(pools.bleedingDeaths).toBe(400);
    expect(new Set(slots).size).toBe(B.maxPools);
  });

  it('takes over the oldest pool when full, and its old body finds it gone', () => {
    const { pools, images } = makePools(3);
    const a = shot(pools, 1);
    const b = shot(pools, 2);
    const c = shot(pools, 3);
    expect(new Set([a, b, c]).size).toBe(3);
    const d = shot(pools, 4);
    expect(d).toBe(a);
    expect(pools.owns(a, 1)).toBe(false);
    expect(pools.owns(d, 4)).toBe(true);
    // The first body can no longer move, hide or free the pool it lost.
    pools.place(d, 4, 2, 40, 300, 1, 1);
    pools.place(a, 1, 2, 10, 300, 1, 1);
    expect(images[d].x).toBe(40);
    pools.end(a, 1);
    expect(images[d].visible).toBe(true);
    expect(pools.count()).toBe(3);
    // Next oldest is the second.
    expect(shot(pools, 5)).toBe(b);
  });

  it('reuses a freed pool before taking over a live one', () => {
    const { pools } = makePools(3);
    shot(pools, 1);
    const b = shot(pools, 2);
    shot(pools, 3);
    pools.end(b, 2);
    expect(pools.count()).toBe(2);
    expect(shot(pools, 4)).toBe(b);
    expect(pools.owns(b, 4)).toBe(true);
    expect(pools.count()).toBe(3);
  });

  it('starts every battle empty', () => {
    const { pools, visible } = makePools();
    for (let id = 1; id <= 5; id++) pools.place(shot(pools, id), id, 2, 0, 0, 1, 1);
    pools.reset();
    expect(pools.count()).toBe(0);
    expect(pools.bleedingDeaths).toBe(0);
    expect(visible()).toBe(0);
  });
});

describe('blood: the "Show blood" setting', () => {
  it('off: no pool at all, and the ones on the ground go at once', () => {
    const { pools, visible } = makePools();
    for (let id = 1; id <= 5; id++) pools.place(shot(pools, id), id, 2, 0, 0, 1, 1);
    expect(visible()).toBe(5);
    pools.setEnabled(false);
    expect(pools.enabled).toBe(false);
    expect(pools.count()).toBe(0);
    expect(visible()).toBe(0);
    for (let id = 6; id <= 20; id++) {
      expect(shot(pools, id)).toBe(-1);
    }
    expect(pools.count()).toBe(0);
    expect(visible()).toBe(0);
    // The gunfire deaths are still counted (the debug hooks compare the two).
    expect(pools.bleedingDeaths).toBe(20);
    // On again: new deaths bleed.
    pools.setEnabled(true);
    expect(shot(pools, 21)).toBeGreaterThanOrEqual(0);
    expect(pools.count()).toBe(1);
  });

  it('the app hands the saved setting to the view, live and at start, and saves a change', () => {
    const view = createFakeView();
    // Start the fake the wrong way round, so the app must set it.
    view.showBlood = false;
    const storage = createMemoryStorage();
    const app = new App({ view, audio: createFakeAudio(), storage, missions: [quickMission(1, true)], upgradeDefs: [] });
    app.attachUi(createFakeUi());
    expect(view.showBlood).toBe(true);
    expect(app.campaign().settings.showBlood).toBe(true);
    app.setSetting('showBlood', false);
    expect(view.showBlood).toBe(false);
    expect(loadSave(storage).data.settings.showBlood).toBe(false);
    expect(app.campaign().settings.showBlood).toBe(false);

    const next = createFakeView();
    next.showBlood = true;
    new App({ view: next, audio: createFakeAudio(), storage, missions: [quickMission(1, true)], upgradeDefs: [] });
    expect(next.showBlood).toBe(false);

    app.setSetting('showBlood', true);
    expect(view.showBlood).toBe(true);
    // A reset puts it back on.
    app.setSetting('showBlood', false);
    app.resetSave();
    expect(view.showBlood).toBe(true);
  });
});
