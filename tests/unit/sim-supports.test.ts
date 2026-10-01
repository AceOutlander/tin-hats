import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import { SANDBOX, SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import type { ForceDef } from '../../src/data/schema';
import { SUPPORTS } from '../../src/data/supports';
import { WEAPONS } from '../../src/data/weapons';
import { SIM_FEATURES } from '../../src/sim';
import { DT, checkInvariants, collect, eventsOf, makeBattle, run, testMission } from './sim-helpers';

const posted = (kind: ForceDef['kind'], x: number, count = 1): ForceDef => ({ kind, count, x, behaviour: 'guard' });

describe('support call-ins', () => {
  it('are switched on', () => {
    expect(SIM_FEATURES.supports).toBe(true);
  });

  it('follow the mission availability and each side has its own cooldown per kind', () => {
    const b = makeBattle({ mission: testMission({ supports: [['artillery', 'smoke'], ['airStrike']] }) });
    b.command(0, { type: 'support', kind: 'artillery', x: 3000 });
    b.command(0, { type: 'support', kind: 'artillery', x: 3100 }); // cooling down by now
    b.command(0, { type: 'support', kind: 'airStrike', x: 3000 }); // not offered to side 0
    b.command(1, { type: 'support', kind: 'artillery', x: 3000 }); // not offered to side 1
    b.command(1, { type: 'support', kind: 'airStrike', x: 99999 }); // clamped to the map
    b.command(0, { type: 'support', kind: 'smoke', x: Number.NaN }); // no target
    b.step();
    const called = eventsOf(b, 'supportCalled');
    expect(called).toHaveLength(2);
    expect(called[0]).toMatchObject({ side: 0, support: 'artillery', x: 3000, value: SUPPORTS.artillery.delay, dir: 1 });
    expect(called[1]).toMatchObject({ side: 1, support: 'airStrike', x: b.state.length, value: SUPPORTS.airStrike.delay, dir: -1 });
    const [s0, s1] = b.state.sides;
    expect(s0.supportCooldown.artillery).toBeCloseTo(SUPPORTS.artillery.cooldown - DT, 9);
    expect(s0.supportCooldown.smoke).toBe(0);
    expect(s1.supportCooldown.airStrike).toBeCloseTo(SUPPORTS.airStrike.cooldown - DT, 9);
    expect(s1.supportCooldown.artillery).toBe(0);

    // Dropped while cooling down; accepted again the tick after it reaches 0.
    run(b, SUPPORTS.artillery.cooldown - 2);
    b.command(0, { type: 'support', kind: 'artillery', x: 2000 });
    b.step();
    expect(eventsOf(b, 'supportCalled')).toHaveLength(0);
    run(b, 2, () => checkInvariants(b));
    expect(s0.supportCooldown.artillery).toBe(0);
    b.command(0, { type: 'support', kind: 'artillery', x: 2000 });
    b.step();
    expect(eventsOf(b, 'supportCalled')).toHaveLength(1);
  });

  it('artillery: warns, then lands its shells within the spread over its duration, hurting only the enemy', () => {
    const art = SUPPORTS.artillery;
    const b = makeBattle({
      mission: testMission({
        supports: [['artillery'], []],
        a: { forces: [posted('rifle', 2950, 3)] },
        b: { forces: [posted('rifle', 3150, 3)] },
      }),
    });
    b.command(0, { type: 'support', kind: 'artillery', x: 3050 });
    const events = collect(b, art.delay + art.duration + 3);
    const t0 = DT; // the call landed on the first step
    const incoming = events.filter((e) => e.type === 'supportIncoming');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ side: 0, support: 'artillery', x: 3050, dir: 1 });
    expect(incoming[0].time - t0).toBeCloseTo(art.delay - art.warning, 1);
    expect(incoming[0].value).toBeCloseTo(art.warning, 1);

    const shells = events.filter((e) => e.type === 'projectile' && e.weapon === art.weapon);
    expect(shells).toHaveLength(art.rounds);
    for (const s of shells) {
      expect(s.source).toBe('none');
      expect(s.side).toBe(0);
      expect(Math.abs(s.x2 - 3050)).toBeLessThanOrEqual(art.spread + 1e-9);
      expect(s.x2 - s.x).toBeCloseTo(art.launchOffset, 6);
    }
    expect(shells[0].time - t0).toBeCloseTo(art.delay, 1);
    expect(shells[shells.length - 1].time - shells[0].time).toBeCloseTo(art.duration, 1);
    expect(events.filter((e) => e.type === 'explosion' && e.weapon === art.weapon)).toHaveLength(art.rounds);

    const blasts = events.filter((e) => (e.type === 'unitHit' || e.type === 'unitDied') && e.cause === 'explosive');
    expect(blasts.length).toBeGreaterThan(0);
    expect(blasts.every((e) => e.side === 1)).toBe(true);
  });

  it('smoke: a cloud at the target after the delay that stops direct fire across it until it clears', () => {
    const sm = SUPPORTS.smoke;
    const b = makeBattle({
      mission: testMission({
        supports: [['smoke'], []],
        a: { forces: [posted('rifle', 2850)] },
        b: { forces: [posted('rifle', 3150)] },
      }),
    });
    run(b, 3);
    expect(collect(b, 4, 'shot').length).toBeGreaterThan(0);
    b.command(0, { type: 'support', kind: 'smoke', x: 3000 });
    const during = collect(b, sm.delay + 0.5);
    const spawned = during.filter((e) => e.type === 'smokeSpawned');
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({ side: 0, x: 3000, value: sm.smokeRadius, x2: sm.smokeTime });
    expect(b.state.smokes.filter((s) => s.alive)).toHaveLength(1);
    // While it lasts nobody fires across it: the posts (blinded, then shot at) only meet at point-blank range.
    const blind = collect(b, sm.smokeTime - 2, 'shot');
    for (const e of blind) expect(Math.abs(e.x2 - e.x)).toBeLessThanOrEqual(CONFIG.smokePointBlank);
    run(b, 2, () => checkInvariants(b));
    expect(b.state.smokes.filter((s) => s.alive)).toHaveLength(0);
  });

  it('air strike: rockets sweep the strip in the caller\'s direction and punch hard against tanks', () => {
    const air = SUPPORTS.airStrike;
    const b = makeBattle({ mission: testMission({ supports: [[], ['airStrike']], a: { forces: [posted('tank', 3000)] } }) });
    b.command(1, { type: 'support', kind: 'airStrike', x: 3000 });
    const events = collect(b, air.delay + air.duration + 2);
    const rockets = events.filter((e) => e.type === 'projectile' && e.weapon === air.weapon);
    expect(rockets).toHaveLength(air.rounds);
    // Side 1 flies toward -x: the first rocket on the far (+x) end of the strip, the last on the near one.
    expect(rockets[0].x2).toBeCloseTo(3000 + air.spread, 6);
    expect(rockets[rockets.length - 1].x2).toBeCloseTo(3000 - air.spread, 6);
    for (let i = 1; i < rockets.length; i++) {
      expect(rockets[i].x2).toBeLessThan(rockets[i - 1].x2);
      expect(rockets[i].time - rockets[i - 1].time).toBeCloseTo(air.duration / (air.rounds - 1), 1);
    }
    expect(rockets.every((r) => r.dir === -1 && r.x - r.x2 === air.launchOffset)).toBe(true);
    const hits = events.filter((e) => e.type === 'unitHit' && e.kind === 'tank').map((e) => e.value);
    expect(hits.length).toBeGreaterThan(0);
    const full = WEAPONS[air.weapon as string].damage * DAMAGE.explosive.vehicle * air.vehicleDamageMul;
    expect(Math.max(...hits)).toBeCloseTo(full, 6);
    expect(air.vehicleDamageMul).toBeGreaterThan(1);
  });

  it('do only a fraction of their damage to an HQ', () => {
    const art = SUPPORTS.artillery;
    const b = makeBattle({ mission: testMission({ supports: [['artillery'], []], b: { hqHpMul: 10 } }) });
    const hq = b.state.sides[1].hq;
    expect(hq).not.toBeNull();
    b.command(0, { type: 'support', kind: 'artillery', x: hq?.x ?? 0 });
    const hits = collect(b, art.delay + art.duration + 2, 'structureHit').filter((e) => e.target === 'hq');
    expect(hits.length).toBeGreaterThan(0);
    const cap = WEAPONS[art.weapon as string].damage * DAMAGE.explosive.hq * art.hqDamageMul;
    for (const h of hits) expect(h.value).toBeLessThanOrEqual(cap + 1e-9);
    expect(art.hqDamageMul).toBeLessThan(1);
  });
});

describe('the AI and the bot with supports', () => {
  it('call them under the same cooldowns, at the enemy, on the proving ground', () => {
    const b = makeBattle({ mission: SANDBOX_MIRROR, commanders: ['ai', 'ai'], seed: 4 });
    const calls = collect(b, 420, 'supportCalled');
    for (const side of [0, 1]) {
      const mine = calls.filter((e) => e.side === side);
      expect(mine.some((e) => e.support === 'artillery'), `side ${side} artillery`).toBe(true);
      for (const kind of ['artillery', 'smoke', 'airStrike'] as const) {
        const times = mine.filter((e) => e.support === kind).map((e) => e.time);
        for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(SUPPORTS[kind].cooldown - DT);
      }
    }
  });

  it('the bot calls them too, following mission.bot', () => {
    const b = makeBattle({ mission: SANDBOX, commanders: ['bot', 'idle'], seed: 2 });
    const calls = collect(b, 300, 'supportCalled');
    expect(calls.filter((e) => e.side === 0).length).toBeGreaterThan(0);
    expect(calls.filter((e) => e.side === 1)).toHaveLength(0);
  });
});
