/**
 * The Soviet signature kinds in the sim (docs/campaigns/NATIONS.md section 2): conscripts trained a whole squad per
 * order, and the Katyusha salvo, a scatter barrage far wider than the artillery's with a long cooldown.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { SUPPORTS } from '../../src/data/supports';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { orderCost, orderPop } from '../../src/sim';
import { checkInvariants, collect, makeBattle, run, testMission, unitsOf } from './sim-helpers';

const SQUAD = UNITS.conscript.squad ?? 1;

/** Soviet side 0 with conscripts and the Katyusha, German side 1. */
function soviet(extra: Parameters<typeof testMission>[0] = {}) {
  return testMission({
    units: [['sapper', 'rifle', 'conscript'], ['sapper', 'rifle']],
    supports: [['artillery', 'katyusha'], ['artillery']],
    ...extra,
    a: { faction: 'soviet', supplies: 2000, ...extra.a },
    b: { faction: 'german', supplies: 2000, ...extra.b },
  });
}

describe('conscripts', () => {
  it('are cheap, frail riflemen with worse aim, trained five to an order', () => {
    const c = UNITS.conscript;
    const r = UNITS.rifle;
    expect(SQUAD).toBe(5);
    expect(c.cost).toBeLessThan(r.cost);
    expect(c.hp).toBeLessThan(r.hp);
    const cw = WEAPONS[c.weapon ?? ''];
    const rw = WEAPONS[r.weapon ?? ''];
    expect(cw.accuracyNear).toBeLessThan(rw.accuracyNear);
    expect(cw.accuracyFar).toBeLessThan(rw.accuracyFar);
    expect(orderCost('conscript')).toBe(c.cost * SQUAD);
    expect(orderPop('conscript')).toBe(c.pop * SQUAD);
    expect(orderCost('rifle')).toBe(r.cost);
    expect(orderPop('rifle')).toBe(r.pop);
  });

  it('cost a whole squad per order and send all of it out of the HQ when the order is done', () => {
    const b = makeBattle({ mission: soviet() });
    const side = b.state.sides[0];
    const supplies = side.supplies;
    b.command(0, { type: 'train', kind: 'conscript' });
    run(b, 0.1);
    expect(side.queue.conscript).toBe(1);
    expect(side.pop).toBe(orderPop('conscript'));
    expect(side.supplies).toBeCloseTo(supplies - orderCost('conscript') + 0.1 * CONFIG.hqIncomePerSec, 3);
    run(b, UNITS.conscript.trainTime - 0.3);
    expect(unitsOf(b, 0, 'conscript')).toHaveLength(0);
    const done = collect(b, 0.5, 'trainDone');
    expect(done.filter((e) => e.kind === 'conscript')).toHaveLength(SQUAD);
    expect(unitsOf(b, 0, 'conscript')).toHaveLength(SQUAD);
    expect(side.queue.conscript).toBe(0);
    expect(side.stats.trained).toBe(SQUAD);
    expect(side.pop).toBe(orderPop('conscript'));
    checkInvariants(b);
  });

  it('cannot be ordered without the money or the room for the whole squad', () => {
    const poor = makeBattle({ mission: soviet({ a: { supplies: orderCost('conscript') - 1 } }) });
    poor.command(0, { type: 'train', kind: 'conscript' });
    run(poor, 0.1);
    expect(poor.state.sides[0].queue.conscript).toBe(0);
    // Room for fewer men than a squad: the order is refused, a single rifleman still fits.
    const crowded = makeBattle({ mission: soviet() });
    const s = crowded.state.sides[0];
    s.pop = s.popCap - (SQUAD - 1);
    crowded.command(0, { type: 'train', kind: 'conscript' });
    crowded.command(0, { type: 'train', kind: 'rifle' });
    run(crowded, 0.1);
    expect(s.queue.conscript).toBe(0);
    expect(s.queue.rifle).toBe(1);
  });

  it('queue several squads, one after the other', () => {
    const b = makeBattle({ mission: soviet() });
    b.command(0, { type: 'train', kind: 'conscript' });
    b.command(0, { type: 'train', kind: 'conscript' });
    run(b, 0.1);
    expect(b.state.sides[0].queue.conscript).toBe(2);
    run(b, 2 * UNITS.conscript.trainTime + 0.5);
    expect(unitsOf(b, 0, 'conscript')).toHaveLength(2 * SQUAD);
    expect(b.state.sides[0].queue.conscript).toBe(0);
    checkInvariants(b);
  });
});

describe('the Katyusha', () => {
  /** Landing points of every round of side 0's call of `kind` at x. */
  function salvo(kind: 'katyusha' | 'artillery', x: number, seed = 1): number[] {
    const b = makeBattle({ mission: soviet(), seed });
    b.command(0, { type: 'support', kind, x });
    const weapon = SUPPORTS[kind].weapon;
    return collect(b, SUPPORTS[kind].delay + SUPPORTS[kind].duration + 1, 'projectile')
      .filter((e) => e.weapon === weapon)
      .map((e) => e.x2);
  }

  it('fires many rockets scattered over a strip far wider than an artillery barrage', () => {
    const k = SUPPORTS.katyusha;
    const a = SUPPORTS.artillery;
    expect(k.rounds).toBeGreaterThan(2 * a.rounds);
    expect(k.spread).toBeGreaterThan(2 * a.spread);
    expect(k.cooldown).toBeGreaterThan(2 * a.cooldown);
    const x = 4000;
    const rockets = salvo('katyusha', x);
    expect(rockets).toHaveLength(k.rounds);
    for (const land of rockets) expect(Math.abs(land - x)).toBeLessThanOrEqual(k.spread + 1e-6);
    const width = Math.max(...rockets) - Math.min(...rockets);
    // Inaccurate: the rockets land all over the strip, not bunched on the mark.
    expect(width).toBeGreaterThan(k.spread);
    const shells = salvo('artillery', x);
    expect(width).toBeGreaterThan(Math.max(...shells) - Math.min(...shells));
  });

  it('starts its long cooldown, warns the target side, and is deterministic for a seed', () => {
    const b = makeBattle({ mission: soviet() });
    b.command(0, { type: 'support', kind: 'katyusha', x: 4000 });
    const events = collect(b, 1, 'supportCalled', 'supportIncoming');
    expect(events.filter((e) => e.type === 'supportCalled' && e.support === 'katyusha')).toHaveLength(1);
    expect(b.state.sides[0].supportCooldown.katyusha).toBeCloseTo(SUPPORTS.katyusha.cooldown - 1, 1);
    // A second call during the cooldown is ignored.
    b.command(0, { type: 'support', kind: 'katyusha', x: 4000 });
    expect(collect(b, 0.2, 'supportCalled')).toHaveLength(0);
    expect(salvo('katyusha', 3500, 7)).toEqual(salvo('katyusha', 3500, 7));
  });

  it('is not available to a side the mission does not give it', () => {
    const b = makeBattle({ mission: soviet() });
    b.command(1, { type: 'support', kind: 'katyusha', x: 2000 });
    expect(collect(b, 6, 'supportCalled', 'projectile').filter((e) => e.weapon === 'katyushaRocket' || e.type === 'supportCalled')).toHaveLength(0);
  });

  it('hurts men bunched up far more than the same men spread out', () => {
    // Twenty riflemen of side 1 on a 60 wu patch, or spread over 2400 wu; the salvo is aimed at their middle.
    const x = 4000;
    const loss = (gap: number): number => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const forces = [];
        for (let i = 0; i < 20; i++) forces.push({ kind: 'rifle' as const, count: 1, x: x - 10 * gap + i * gap, behaviour: 'guard' as const });
        const b = makeBattle({ mission: soviet({ b: { forces } }), seed });
        const hp0 = unitsOf(b, 1, 'rifle').reduce((s, u) => s + u.hp, 0);
        b.command(0, { type: 'support', kind: 'katyusha', x });
        run(b, SUPPORTS.katyusha.delay + SUPPORTS.katyusha.duration + 2);
        total += hp0 - unitsOf(b, 1, 'rifle').reduce((s, u) => s + u.hp, 0);
      }
      return total;
    };
    expect(loss(3)).toBeGreaterThan(2 * loss(120));
  });
});
