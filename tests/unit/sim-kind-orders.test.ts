import { describe, expect, it } from 'vitest';
import type { UnitKind } from '../../src/data/schema';
import type { Battle } from '../../src/sim';
import { checkInvariants, collect, makeBattle, mirrored, run, runUntil, snapshot, testMission, unitsOf } from './sim-helpers';

/** Riflemen and Bren gunners for side 0 (and the same for side 1 in the mirrored battle), on a long empty field. */
const MIX = testMission({
  length: 6000,
  a: { sappers: 2, forces: [{ kind: 'rifle', count: 4 }, { kind: 'lmg', count: 2 }] },
});

/** How far the foremost living unit of this kind on the field stands in front of its side's hold line. */
function ahead(b: Battle, side: 0 | 1, kind: UnitKind): number {
  const s = b.state.sides[side];
  const dir = side === 0 ? 1 : -1;
  let best = -Infinity;
  for (const u of unitsOf(b, side, kind)) if (!u.inside) best = Math.max(best, (u.x - s.holdLineX) * dir);
  return best;
}

describe('orders per unit kind', () => {
  it('starts with no overrides, so every kind follows the army order', () => {
    const b = makeBattle({ mission: MIX });
    for (const side of b.state.sides) {
      for (const kind of Object.keys(side.kindOrders) as UnitKind[]) expect(side.kindOrders[kind]).toBeNull();
    }
  });

  it('a kind override changes only that kind: everyone advances, the Bren gunners hold', () => {
    const b = makeBattle({ mission: MIX });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    const changes = collect(b, 12, 'orderChanged');
    expect(changes.map((e) => [e.side, e.order, e.kind])).toEqual([
      [0, 'advance', null],
      [0, 'hold', 'lmg'],
    ]);
    const s0 = b.state.sides[0];
    expect(s0.order).toBe('advance');
    expect(s0.kindOrders.lmg).toBe('hold');
    expect(s0.kindOrders.rifle).toBeNull();
    expect(ahead(b, 0, 'rifle')).toBeGreaterThan(500);
    expect(ahead(b, 0, 'lmg')).toBeLessThanOrEqual(1e-6);
    // Sappers keep working under Hold.
    expect(unitsOf(b, 0, 'sapper').every((u) => !u.inside)).toBe(true);
    // The other side is untouched.
    expect(b.state.sides[1].kindOrders.lmg).toBeNull();
  });

  it('setting the army order keeps the overrides', () => {
    const b = makeBattle({ mission: MIX });
    b.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 1);
    const s0 = b.state.sides[0];
    expect(s0.order).toBe('fallBack');
    expect(s0.kindOrders.lmg).toBe('hold');
    runUntil(b, 25, () => unitsOf(b, 0, 'rifle').every((u) => u.inside));
    expect(unitsOf(b, 0, 'rifle').every((u) => u.inside)).toBe(true);
    expect(unitsOf(b, 0, 'lmg').every((u) => !u.inside)).toBe(true);
  });

  it('Fall Back for one kind sends only that kind inside the HQ, and new units of it stay inside', () => {
    const b = makeBattle({ mission: testMission({ ...MIX, a: { ...MIX.start[0], supplies: 1000 } }) });
    const hq = b.state.sides[0].hq;
    if (!hq) throw new Error('side 0 has an HQ');
    b.command(0, { type: 'order', order: 'fallBack', kind: 'lmg' });
    const done = runUntil(b, 25, () => unitsOf(b, 0, 'lmg').every((u) => u.inside));
    expect(done).toBe(true);
    expect(hq.garrison).toBe(2);
    expect(unitsOf(b, 0, 'rifle').every((u) => !u.inside)).toBe(true);
    expect(unitsOf(b, 0, 'sapper').every((u) => !u.inside)).toBe(true);
    b.command(0, { type: 'train', kind: 'lmg' });
    b.command(0, { type: 'train', kind: 'rifle' });
    runUntil(b, 30, () => unitsOf(b, 0, 'lmg').length === 3 && unitsOf(b, 0, 'rifle').length === 5);
    expect(unitsOf(b, 0, 'lmg').every((u) => u.inside)).toBe(true);
    expect(unitsOf(b, 0, 'rifle').every((u) => !u.inside)).toBe(true);
    run(b, 1, () => checkInvariants(b));
  });

  it('Fall Back for sappers only brings the sappers in and stops their income', () => {
    const b = makeBattle({ mission: MIX });
    run(b, 1);
    const working = b.state.sides[0].income;
    b.command(0, { type: 'order', order: 'fallBack', kind: 'sapper' });
    runUntil(b, 30, () => unitsOf(b, 0, 'sapper').every((u) => u.inside));
    expect(unitsOf(b, 0, 'sapper').every((u) => u.inside)).toBe(true);
    expect(unitsOf(b, 0).filter((u) => u.kind !== 'sapper').every((u) => !u.inside)).toBe(true);
    expect(b.state.sides[0].income).toBeLessThan(working);
    // Hold is "keep working": they come back out and shuttle again.
    b.command(0, { type: 'order', order: 'hold', kind: 'sapper' });
    run(b, 5);
    expect(unitsOf(b, 0, 'sapper').every((u) => !u.inside)).toBe(true);
    expect(b.state.sides[0].income).toBeCloseTo(working, 6);
  });

  it('Follow army clears one override (and every override without a kind)', () => {
    const b = makeBattle({ mission: MIX });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    b.command(0, { type: 'order', order: 'hold', kind: 'rifle' });
    run(b, 6);
    expect(ahead(b, 0, 'lmg')).toBeLessThanOrEqual(1e-6);
    expect(ahead(b, 0, 'rifle')).toBeLessThanOrEqual(1e-6);

    b.command(0, { type: 'followArmy', kind: 'lmg' });
    const changes = collect(b, 10, 'orderChanged');
    expect(changes.map((e) => [e.order, e.kind])).toEqual([['advance', 'lmg']]);
    const s0 = b.state.sides[0];
    expect(s0.kindOrders.lmg).toBeNull();
    expect(s0.kindOrders.rifle).toBe('hold');
    expect(ahead(b, 0, 'lmg')).toBeGreaterThan(300);
    expect(ahead(b, 0, 'rifle')).toBeLessThanOrEqual(1e-6);

    // Following again is a no-op; clearing all frees the riflemen too.
    b.command(0, { type: 'followArmy', kind: 'lmg' });
    b.command(0, { type: 'followArmy' });
    const more = collect(b, 10, 'orderChanged');
    expect(more.map((e) => [e.order, e.kind])).toEqual([['advance', 'rifle']]);
    expect(s0.kindOrders.rifle).toBeNull();
    expect(ahead(b, 0, 'rifle')).toBeGreaterThan(300);
  });

  it('drops unknown kinds and orders, and repeats of the current override', () => {
    const b = makeBattle({ mission: MIX });
    b.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    b.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    b.command(0, { type: 'order', order: 'hold', kind: 'nobody' as UnitKind });
    b.command(0, { type: 'order', order: 'charge' as 'hold', kind: 'rifle' });
    b.command(0, { type: 'followArmy', kind: 'nobody' as UnitKind });
    const changes = collect(b, 1, 'orderChanged');
    expect(changes).toHaveLength(1);
    expect(b.state.sides[0].kindOrders.rifle).toBeNull();
    expect('nobody' in b.state.sides[0].kindOrders).toBe(false);
  });

  it('a directly controlled unit ignores its kind order', () => {
    const b = makeBattle({ mission: MIX });
    const [mine, other] = unitsOf(b, 0, 'lmg');
    b.command(0, { type: 'control', unit: mine.id });
    b.command(0, { type: 'order', order: 'fallBack', kind: 'lmg' });
    run(b, 25);
    expect(other.inside).toBe(true);
    expect(mine.inside).toBe(false);
    expect(mine.controlled).toBe(true);
  });

  it('is deterministic and side-symmetric', () => {
    const play = (): Battle => {
      const b = makeBattle({ mission: mirrored(MIX), seed: 7 });
      for (const side of [0, 1] as const) {
        b.command(side, { type: 'order', order: 'advance' });
        b.command(side, { type: 'order', order: 'hold', kind: 'lmg' });
        b.command(side, { type: 'order', order: 'fallBack', kind: 'sapper' });
      }
      run(b, 20, () => checkInvariants(b));
      return b;
    };
    const a = play();
    expect(snapshot(a)).toBe(snapshot(play()));
    for (const kind of ['rifle', 'lmg'] as const) expect(ahead(a, 0, kind)).toBeCloseTo(ahead(a, 1, kind), 6);
    expect(unitsOf(a, 0, 'sapper').every((u) => u.inside)).toBe(true);
    expect(unitsOf(a, 1, 'sapper').every((u) => u.inside)).toBe(true);
  });
});
