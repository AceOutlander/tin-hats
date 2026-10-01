import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import type { ForceDef, MissionDef, UnitKind, UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { checkInvariants, collect, makeBattle, run, testMission, unitsOf, type Seen } from './sim-helpers';

/** A hundred times the health for side 0's units of these kinds, so they live through a long test. */
function tough(...kinds: UnitKind[]): { upgrades: Record<string, number>; upgradeDefs: UpgradeDef[] } {
  const def: UpgradeDef = {
    id: 'tough',
    name: '',
    description: '',
    unit: null,
    levels: [kinds.map((unit) => ({ stat: 'unitHealth' as const, unit, mul: 100 }))],
    costPerLevel: 1,
  };
  return { upgrades: { tough: 1 }, upgradeDefs: [def] };
}

/** Side 0 with `forces` against a lone side-1 pillbox at x 1200 on a 3000 wu field. */
function pillboxField(forces: ForceDef[]): MissionDef {
  return testMission({ length: 3000, pillboxes: [{ id: 1, x: 1200, side: 1, hpMul: 1 }], a: { forces } });
}

describe('pillboxes', () => {
  it('fire their machine gun in bursts at enemies in range', () => {
    const b = makeBattle({ mission: pillboxField([{ kind: 'rifle', count: 4 }]) });
    const events = collect(b, 30, 'shot', 'unitHit', 'unitDied');
    const shots = events.filter((e) => e.type === 'shot' && e.source === 'pillbox');
    expect(shots.length).toBeGreaterThan(WEAPONS.pillboxGun.burst);
    for (const e of shots) {
      expect(e).toMatchObject({ side: 1, weapon: 'pillboxGun', x: 1200, target: 'unit' });
      expect(1200 - e.x2).toBeLessThanOrEqual(WEAPONS.pillboxGun.range);
    }
    const hurt = events.filter((e) => (e.type === 'unitHit' || e.type === 'unitDied') && e.side === 0);
    expect(hurt.length).toBeGreaterThan(0);
    expect(b.state.sides[1].stats.damageDealt).toBeGreaterThan(0);
  });

  it('shrug off bullets', () => {
    const b = makeBattle({ mission: pillboxField([{ kind: 'rifle', count: 6 }]), ...tough('rifle') });
    b.command(0, { type: 'order', order: 'advance' });
    const hits = collect(b, 40, 'structureHit').filter((e) => e.target === 'pillbox');
    expect(hits.length).toBeGreaterThan(20);
    for (const e of hits) {
      expect(e.cause).toBe('bullet');
      expect(e.value).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.fortification, 9);
    }
    const p = b.state.pillboxes[0];
    expect(p.alive).toBe(true);
    expect(p.hp).toBeGreaterThan(p.maxHp * 0.8);
  });

  it('fall to anti-tank rockets and stay as rubble that neither fires nor blocks', () => {
    const b = makeBattle({ mission: pillboxField([{ kind: 'at', count: 2 }]), ...tough('at') });
    b.command(0, { type: 'order', order: 'advance' });
    const events = collect(b, 40, 'structureHit', 'structureDestroyed');
    const hits = events.filter((e) => e.type === 'structureHit' && e.target === 'pillbox');
    expect(hits.length).toBeGreaterThan(0);
    for (const e of hits) {
      expect(e.cause).toBe('antiTank');
      expect(e.value).toBeLessThanOrEqual(WEAPONS.rocket.damage * DAMAGE.antiTank.fortification + 1e-9);
    }
    const destroyed = events.filter((e) => e.type === 'structureDestroyed');
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({ target: 'pillbox', targetIndex: 0, side: 1, x: 1200 });
    const p = b.state.pillboxes[0];
    expect(b.state.pillboxes).toHaveLength(1);
    expect(p.alive).toBe(false);
    expect(p.hp).toBe(0);
    const after = collect(b, 20, 'shot');
    expect(after.some((e) => e.source === 'pillbox')).toBe(false);
    // The anti-tank men walk on past the rubble toward the HQ.
    for (const u of unitsOf(b, 0, 'at')) expect(u.x).toBeGreaterThan(1200 + CONFIG.contactGap);
  });

  it('are worn down by explosives', () => {
    // A mortar posted out of the pillbox gun's reach shells it.
    const b = makeBattle({ mission: pillboxField([{ kind: 'mortar', count: 1, x: 700, behaviour: 'guard' }]) });
    const hits = collect(b, 40, 'structureHit').filter((e) => e.target === 'pillbox');
    expect(hits.length).toBeGreaterThan(0);
    const full = WEAPONS.mortar.damage * DAMAGE.explosive.fortification;
    for (const e of hits) {
      expect(e.cause).toBe('explosive');
      expect(e.value).toBeLessThanOrEqual(full + 1e-9);
    }
    expect(Math.max(...hits.map((e) => e.value))).toBeCloseTo(full, 6);
    expect(DAMAGE.explosive.fortification / DAMAGE.bullet.fortification).toBeGreaterThan(10);
  });
});

describe('barbed wire', () => {
  it('slows enemy infantry inside it, but not its own side', () => {
    const mission = testMission({
      length: 4000,
      wire: [
        { id: 1, x: 1100, width: 100, owner: 0 },
        { id: 2, x: 1400, width: 100, owner: 1 },
      ],
      a: { forces: [{ kind: 'rifle', count: 1 }] },
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const inOwn: number[] = [];
    const inEnemy: number[] = [];
    run(b, 20, () => {
      const u = unitsOf(b, 0, 'rifle')[0];
      const inside = (x: number, c: number) => Math.abs(x - c) < 50;
      if (inside(u.prevX, 1100) && inside(u.x, 1100)) inOwn.push(u.velX);
      if (inside(u.prevX, 1400) && inside(u.x, 1400)) inEnemy.push(u.velX);
    });
    expect(inOwn.length).toBeGreaterThan(5);
    expect(inEnemy.length).toBeGreaterThan(5);
    for (const v of inOwn) expect(v).toBeCloseTo(UNITS.rifle.speed, 6);
    for (const v of inEnemy) expect(v).toBeCloseTo(UNITS.rifle.speed * CONFIG.wireSlow, 6);
    expect(b.state.wires.every((w) => w.alive && w.hp === CONFIG.wireHp)).toBe(true);
  });

  it('is torn only by explosive splash, from either side', () => {
    // Stationary targets (no HQ, so they never move) standing on wire of both sides.
    const field = (shooter: ForceDef): MissionDef =>
      testMission({
        length: 3000,
        wire: [
          { id: 1, x: 1080, width: 80, owner: 1 },
          { id: 2, x: 1150, width: 40, owner: 0 },
        ],
        a: { forces: [shooter] },
        b: { hasHq: false, forces: [{ kind: 'sapper', count: 6, x: 1050 }] },
      });

    const rockets = makeBattle({ mission: field({ kind: 'at', count: 2 }) });
    const rocketBlasts = collect(rockets, 30, 'explosion');
    expect(rocketBlasts.some((e) => e.weapon === 'rocket')).toBe(true);
    expect(rockets.state.wires.every((w) => w.alive && w.hp === CONFIG.wireHp)).toBe(true);

    const shells = makeBattle({ mission: field({ kind: 'mortar', count: 2 }) });
    const events: Seen[] = [];
    run(shells, 60, (b) => {
      checkInvariants(b);
      for (let i = 0; i < b.events.count; i++) {
        const e = b.events.items[i];
        if (e.type === 'wireDestroyed' || e.type === 'explosion') events.push({ ...e, time: b.state.time });
      }
    });
    expect(events.some((e) => e.type === 'explosion' && e.weapon === 'mortar')).toBe(true);
    const torn = events.filter((e) => e.type === 'wireDestroyed');
    expect(torn.length).toBeGreaterThan(0);
    for (const e of torn) expect(e.cause).toBe('explosive');
    // Both belts are within the splash of shells aimed at the targets, so the mortar's own side's wire suffers too.
    const own = shells.state.wires[1];
    expect(own.hp).toBeLessThan(CONFIG.wireHp);
  });

  it('is crushed by enemy tanks driving over it, not by its own side', () => {
    const mission = testMission({
      length: 4000,
      wire: [
        { id: 1, x: 1100, width: 80, owner: 0 },
        { id: 2, x: 1500, width: 80, owner: 1 },
      ],
      a: { forces: [{ kind: 'tank', count: 1 }, { kind: 'rifle', count: 2 }] },
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const torn = collect(b, 30, 'wireDestroyed');
    expect(torn).toHaveLength(1);
    expect(torn[0]).toMatchObject({ targetIndex: 2, side: 1, x: 1500, cause: null });
    expect(b.state.wires[0].alive).toBe(true);
    expect(b.state.wires[1].alive).toBe(false);
    expect(unitsOf(b, 0, 'tank')[0].x).toBeGreaterThan(1500);
  });
});
