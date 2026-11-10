/**
 * The prep phase of defensive missions (src/sim/prep.ts, data src/data/prep.ts): the countdown and Ready, the enemy
 * and the mission clock waiting, build sites paid for and worked by one sapper each, cancels, the structures they
 * become, and the test bot's build plan.
 */
import { describe, expect, it } from 'vitest';
import { PREP } from '../../src/data/prep';
import type { MissionDef } from '../../src/data/schema';
import type { Battle } from '../../src/sim';
import { eventsOf, makeBattle, run, runUntil, testMission, unitsOf } from './sim-helpers';

function prepMission(over: Partial<MissionDef> = {}, sappers = 2, supplies = 1000): MissionDef {
  return testMission({
    trenches: [],
    pillboxes: [],
    wire: [],
    prep: { seconds: 40 },
    a: { supplies, sappers },
    b: { supplies: 0, forces: [{ kind: 'rifle', count: 4 }] },
    ...over,
  });
}

/** A spot in side 0's build zone, `frac` of the way from its back to its front. */
function zoneX(b: Battle, frac: number): number {
  const p = b.state.prep;
  if (!p) throw new Error('no prep phase');
  return p.zoneFrom + (p.zoneTo - p.zoneFrom) * frac;
}

describe('the prep phase', () => {
  it('counts down, then ends by itself; the mission clock and events wait for it', () => {
    const m = prepMission({ timer: { seconds: 100, onExpire: 'win', label: 'Hold' }, events: [{ type: 'announce', when: { at: 1 }, text: 'Here they come' }] });
    const b = makeBattle({ mission: m });
    expect(b.state.prep?.active).toBe(true);
    run(b, 20);
    expect(b.state.prep?.secondsLeft).toBeCloseTo(20, 0);
    expect(b.state.timer?.secondsLeft).toBe(100);
    expect(eventsOf(b, 'announce')).toHaveLength(0);
    let ended = false;
    let announced = false;
    run(b, 25, (x) => {
      if (eventsOf(x, 'prepEnded').length > 0) ended = true;
      if (eventsOf(x, 'announce').length > 0) announced = true;
    });
    expect(ended).toBe(true);
    expect(announced).toBe(true);
    expect(b.state.prep?.active).toBe(false);
    expect(b.state.timer?.secondsLeft).toBeLessThan(100);
    expect(b.state.timer?.secondsLeft).toBeGreaterThan(90);
  });

  it('ends at once on Ready', () => {
    const b = makeBattle({ mission: prepMission() });
    run(b, 1);
    b.command(0, { type: 'ready' });
    run(b, 0.2);
    expect(b.state.prep?.active).toBe(false);
    expect(b.state.prep?.endedAt).toBeLessThan(2);
  });

  it('holds the enemy where it stands while it runs', () => {
    const b = makeBattle({ mission: prepMission(), commanders: ['human', 'ai'] });
    run(b, 0.1);
    const before = unitsOf(b, 1).map((u) => u.x);
    run(b, 30);
    expect(unitsOf(b, 1).map((u) => u.x)).toEqual(before);
  });

  it('a mission without one has none, and its clock is the battle clock', () => {
    const b = makeBattle({ mission: testMission() });
    expect(b.state.prep).toBeNull();
    expect(b.state.sites).toEqual([]);
  });
});

describe('building', () => {
  it('pays for a site, sends one sapper, and turns it into a trench when the work is done', () => {
    const b = makeBattle({ mission: prepMission({}, 1) });
    const x = zoneX(b, 0.5);
    const money = b.state.sides[0].supplies;
    b.command(0, { type: 'build', kind: 'foxhole', x });
    run(b, 0.2);
    expect(b.state.sites).toHaveLength(1);
    expect(b.state.sides[0].supplies).toBeLessThan(money - PREP.buildables.foxhole.cost + 5);
    const sapper = unitsOf(b, 0, 'sapper')[0];
    expect(sapper.site).toBe(b.state.sites[0].id);
    const trenchesBefore = b.state.trenches.length;
    // No protection until done.
    expect(b.state.trenches).toHaveLength(trenchesBefore);
    expect(runUntil(b, 40, (x2) => x2.state.sites.length === 0)).toBe(true);
    expect(b.state.trenches).toHaveLength(trenchesBefore + 1);
    const t = b.state.trenches[b.state.trenches.length - 1];
    expect(t.x).toBe(x);
    expect(t.owner).toBe(0);
    expect(t.slots).toBe(PREP.buildables.foxhole.slots);
    // His work done, the sapper goes back to hauling.
    expect(unitsOf(b, 0, 'sapper')[0].site).toBe(-1);
  });

  it('builds one site per sapper at once: two sappers, two sites, both worked', () => {
    const b = makeBattle({ mission: prepMission({}, 2) });
    b.command(0, { type: 'build', kind: 'wire', x: zoneX(b, 0.4) });
    b.command(0, { type: 'build', kind: 'wire', x: zoneX(b, 0.8) });
    run(b, 0.2);
    const workers = new Set(b.state.sites.map((s) => s.worker));
    expect(workers.size).toBe(2);
    expect(runUntil(b, 120, (x) => x.state.sites.length === 0)).toBe(true);
    expect(b.state.wires).toHaveLength(2);
  });

  it('makes pillboxes and wire of the player side', () => {
    const b = makeBattle({ mission: prepMission({}, 2, 2000) });
    b.command(0, { type: 'build', kind: 'pillbox', x: zoneX(b, 0.3) });
    b.command(0, { type: 'build', kind: 'wire', x: zoneX(b, 0.9) });
    expect(runUntil(b, 120, (x) => x.state.sites.length === 0)).toBe(true);
    expect(b.state.pillboxes.map((p) => p.side)).toEqual([0]);
    expect(b.state.wires.map((w) => w.owner)).toEqual([0]);

  });

  it('keeps building after the prep phase ends', () => {
    const b = makeBattle({ mission: prepMission({ prep: { seconds: 5 } }, 1, 2000) });
    b.command(0, { type: 'build', kind: 'pillbox', x: zoneX(b, 0.5) });
    run(b, 10);
    expect(b.state.prep?.active).toBe(false);
    expect(b.state.sites).toHaveLength(1);
    expect(runUntil(b, 120, (x) => x.state.sites.length === 0)).toBe(true);
    expect(b.state.pillboxes).toHaveLength(1);
  });

  it('refuses a site outside the zone, on top of another, without the money, or after the prep phase', () => {
    const b = makeBattle({ mission: prepMission({ prep: { seconds: 20, buildables: ['wire', 'trench'] } }, 1, 150) });
    const p = b.state.prep;
    if (!p) throw new Error('no prep phase');
    b.command(0, { type: 'build', kind: 'wire', x: p.zoneTo + 200 });
    b.command(0, { type: 'build', kind: 'pillbox', x: zoneX(b, 0.5) });
    b.command(1, { type: 'build', kind: 'wire', x: zoneX(b, 0.5) });
    run(b, 0.2);
    expect(b.state.sites).toHaveLength(0);
    b.command(0, { type: 'build', kind: 'trench', x: zoneX(b, 0.5) });
    b.command(0, { type: 'build', kind: 'wire', x: zoneX(b, 0.5) + 10 });
    run(b, 0.2);
    expect(b.state.sites.map((s) => s.kind)).toEqual(['trench']);
    // 150 - 100 left: not enough for another trench.
    b.command(0, { type: 'build', kind: 'trench', x: zoneX(b, 0.1) });
    run(b, 0.2);
    expect(b.state.sites).toHaveLength(1);
    run(b, 25);
    b.command(0, { type: 'build', kind: 'wire', x: zoneX(b, 0.95) });
    run(b, 0.2);
    expect(b.state.sites.every((s) => s.kind === 'trench')).toBe(true);
  });

  it('gives the money back on a cancel and frees the sapper', () => {
    const b = makeBattle({ mission: prepMission({}, 1) });
    const money = b.state.sides[0].supplies;
    b.command(0, { type: 'build', kind: 'trench', x: zoneX(b, 0.5) });
    run(b, 2);
    const id = b.state.sites[0].id;
    const income = b.state.sides[0].supplies - (money - PREP.buildables.trench.cost);
    b.command(0, { type: 'cancelBuild', site: id });
    run(b, 0.1);
    expect(b.state.sites).toHaveLength(0);
    expect(b.state.sides[0].supplies).toBeGreaterThanOrEqual(money + income - 1);
    expect(unitsOf(b, 0, 'sapper')[0].site).toBe(-1);
  });

  it('lets the test bot build its plan and then call Ready', () => {
    const base = prepMission({}, 2, 1000);
    const probe = makeBattle({ mission: base });
    const plan = [
      { kind: 'trench' as const, x: zoneX(probe, 0.6) },
      { kind: 'wire' as const, x: zoneX(probe, 0.9) },
    ];
    const b = makeBattle({ mission: { ...base, prep: { seconds: 60, bot: plan } }, commanders: ['bot', 'ai'] });
    expect(runUntil(b, 60, (x) => x.state.prep?.active === false)).toBe(true);
    expect(b.state.trenches.some((t) => t.owner === 0 && t.x === plan[0].x)).toBe(true);
    expect(b.state.wires.some((w) => w.owner === 0 && w.x === plan[1].x)).toBe(true);
    // Ready before the countdown ran out.
    expect(b.state.prep?.endedAt).toBeLessThan(59);
  });
});
