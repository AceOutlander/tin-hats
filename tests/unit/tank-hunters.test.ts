/**
 * The 1941 Tank Hunters stalk (DECISIONS 460): a vehicle that stops out of the bundle's reach draws them out of cover to
 * crawl up and throw, and a vehicle's guns cannot pick out a man stalking it; other anti-tank weapons never stalk.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { WEAPONS } from '../../src/data/weapons';
import type { MissionDef } from '../../src/data/schema';
import { makeBattle, testMission, unitsOf } from './sim-helpers';

const HUNTER_X = 900;

function field(tankX: number, dateIso = '1941-06-22', faction: 'soviet' | 'british' = 'soviet'): MissionDef {
  return {
    ...testMission({
      length: 6000,
      a: { faction, forces: [{ kind: 'at', count: 1, x: HUNTER_X }] },
      b: { faction: 'german', forces: [{ kind: 'tank', count: 1, x: tankX }] },
    }),
    dateIso,
  };
}

describe('Tank Hunters', () => {
  it('reach further for a tank than they can throw: stalkRange only on the bundles', () => {
    const bundle = WEAPONS.atGrenades;
    expect(bundle.stalkRange ?? 0).toBeGreaterThan(bundle.range);
    for (const w of Object.values(WEAPONS)) if (w.id !== 'atGrenades') expect(w.stalkRange ?? 0, w.id).toBe(0);
    expect(CONFIG.stalkCrawlMul).toBeGreaterThan(0);
    expect(CONFIG.stalkCrawlMul).toBeLessThan(1);
  });

  it('crawl out to a tank closing on them, unseen by its guns, and set it on fire', () => {
    const b = makeBattle({ mission: field(2000) });
    b.command(1, { type: 'order', order: 'advance' });
    const speed = unitsOf(b, 0, 'at')[0].def.speed;
    let stalked = false;
    let fastest = 0;
    let nearest = Infinity;
    const shots: { kind: string | null; weapon: string | null }[] = [];
    for (let t = 0; t < 30 * CONFIG.tickRate && !b.state.over; t++) {
      b.step();
      const h = unitsOf(b, 0, 'at')[0];
      const tank = unitsOf(b, 1, 'tank')[0];
      if (h === undefined || tank === undefined) break;
      if (h.stalking) stalked = true;
      const crawling = h.stalking && Math.abs(h.goalX - h.x) <= (WEAPONS.atGrenades.stalkRange ?? 0);
      if (crawling && Math.abs(h.velX) > fastest) fastest = Math.abs(h.velX);
      nearest = Math.min(nearest, Math.abs(tank.x - h.x));
      for (let k = 0; k < b.events.count; k++) {
        const e = b.events.items[k];
        if (e.type === 'shot' && e.target === 'unit') shots.push({ kind: e.kind, weapon: e.weapon });
      }
    }
    expect(nearest, 'the tank came within its own gun range of him').toBeLessThan(WEAPONS.tankGun.range);
    expect(stalked, 'he leaves his place to stalk the tank').toBe(true);
    expect(fastest, 'he crawls').toBeGreaterThan(0);
    expect(fastest, 'on his belly for the last stretch: slower than his walk').toBeLessThanOrEqual(speed * CONFIG.stalkCrawlMul + 1e-6);
    expect(shots.filter((s) => s.kind === 'tank').map((s) => s.weapon), "the tank's guns never pick him out").toEqual([]);
    expect(shots.filter((s) => s.kind === 'at' && s.weapon === 'atGrenades').length, 'he throws').toBeGreaterThan(0);
    expect(unitsOf(b, 1, 'tank'), 'the tank is knocked out').toEqual([]);
    expect(unitsOf(b, 0, 'at'), 'and he lives').toHaveLength(1);
  });

  it('stay with the line while a tank is beyond their stalking reach', () => {
    const reach = WEAPONS.atGrenades.stalkRange ?? 0;
    const near = makeBattle({ mission: field(HUNTER_X + reach + 400) });
    const none = makeBattle({ mission: field(5800) });
    for (let t = 0; t < 3 * CONFIG.tickRate; t++) {
      near.step();
      none.step();
      expect(unitsOf(near, 0, 'at')[0].stalking).toBe(false);
    }
    expect(unitsOf(near, 0, 'at')[0].x).toBe(unitsOf(none, 0, 'at')[0].x);
  });

  it('only the bundles stalk: the anti-tank rifle and the PIAT shoot from where they are', () => {
    for (const m of [field(HUNTER_X + 280, '1942-09-15'), field(HUNTER_X + 280, '1944-06-06', 'british')]) {
      const b = makeBattle({ mission: m });
      let stalked = false;
      for (let t = 0; t < 3 * CONFIG.tickRate; t++) {
        b.step();
        for (const u of unitsOf(b, 0, 'at')) if (u.stalking) stalked = true;
      }
      expect(stalked).toBe(false);
    }
  });
});
