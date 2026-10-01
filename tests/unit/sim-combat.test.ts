import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import { getMission } from '../../src/data/missions';
import type { ForceDef, MissionDef, UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { SIM_FEATURES, runBattle } from '../../src/sim';
import {
  collect,
  configOf,
  eventsOf,
  makeBattle,
  run,
  runUntil,
  testMission,
  unitsOf,
  type Seen,
} from './sim-helpers';

/** A stream of stationary sapper targets (a side with no HQ never moves its sappers) at a fixed distance from the hold line. */
function dummies(distance: number, seconds = 90) {
  return testMission({
    length: 3000,
    b: { hasHq: false },
    events: [
      {
        type: 'wave',
        when: { every: 1.5, from: 0, until: seconds },
        side: 1,
        forces: [{ kind: 'sapper', count: 1, x: 850 + distance }],
      },
    ],
  });
}

/** The same mission with side 0 starting with these forces. */
function withForces(mission: MissionDef, forces: ForceDef[]): MissionDef {
  return { ...mission, start: [{ ...mission.start[0], forces }, mission.start[1]] };
}

/** The hit chance the rifle's data gives at a distance. */
function predictedChance(distance: number): number {
  const w = WEAPONS.rifle;
  const t = Math.min(1, distance / w.range);
  return w.accuracyNear + (w.accuracyFar - w.accuracyNear) * t;
}

/** Rifle shots fired at stationary targets from `distance` away, over several seeds: observed vs predicted hit rate. */
function rifleStats(distance: number, seeds: number): { shots: number; observed: number; predicted: number } {
  let shots = 0;
  let hits = 0;
  let predicted = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const mission = withForces(dummies(distance), [{ kind: 'rifle', count: 4 }]);
    const b = makeBattle({ mission, seed });
    for (const e of collect(b, 90, 'shot')) {
      if (e.source !== 'unit' || e.weapon !== 'rifle') continue;
      shots++;
      if (e.hit) hits++;
      predicted += predictedChance(Math.abs(e.x2 - e.x));
    }
  }
  return { shots, observed: hits / shots, predicted: predicted / shots };
}

describe('rifle fire', () => {
  it('hits more often up close than far away, following the weapon data', () => {
    const near = rifleStats(30, 8);
    const far = rifleStats(300, 8);
    expect(near.shots).toBeGreaterThan(500);
    expect(far.shots).toBeGreaterThan(500);
    expect(Math.abs(near.observed - near.predicted)).toBeLessThan(0.05);
    expect(Math.abs(far.observed - far.predicted)).toBeLessThan(0.05);
    expect(near.predicted).toBeGreaterThan(WEAPONS.rifle.accuracyNear - 0.1);
    expect(far.predicted).toBeLessThan(WEAPONS.rifle.accuracyFar + 0.15);
    expect(near.observed - far.observed).toBeGreaterThan(0.25);
  });

  /**
   * The nearest distance at which an advancing unit of this kind may stop to fire (its engage
   * distance at the worst jitter), less a margin: placed there, it stands and fires at once.
   */
  function standingDistance(kind: 'rifle' | 'lmg'): number {
    const w = WEAPONS[UNITS[kind].weapon as string];
    return Math.floor(w.range * UNITS[kind].engageFrac - CONFIG.engageSpread) - 10;
  }

  /** One rifleman or machine gunner, tough enough to last, in range of an HQ that is too big to fall. */
  function marksman(kind: 'rifle' | 'lmg', distance: number) {
    const toughen: UpgradeDef = {
      id: 'tough',
      name: '',
      description: '',
      unit: null,
      levels: [[{ stat: 'unitHealth', unit: kind, mul: 100 }]],
      costPerLevel: 1,
    };
    const door = 3000 - CONFIG.hqInset - CONFIG.hqDoorOffset;
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind, count: 1, x: door - distance }] },
      b: { hqHpMul: 100 },
    });
    const b = makeBattle({ mission, upgrades: { tough: 1 }, upgradeDefs: [toughen] });
    b.command(0, { type: 'order', order: 'advance' });
    return { b, door };
  }

  it('aims, fires, then reloads: one aimed shot every cooldown', () => {
    const w = WEAPONS.rifle;
    const { b, door } = marksman('rifle', standingDistance('rifle'));
    const rifle = unitsOf(b, 0, 'rifle')[0];
    expect(rifle.maxHp).toBe(UNITS.rifle.hp * 100);
    const actions = new Set<string>();
    const charges: number[] = [];
    const shots: Seen[] = [];
    let lastShotTick = -1;
    run(b, 30, () => {
      for (const e of eventsOf(b, 'shot')) {
        if (e.source === 'unit') {
          shots.push(e);
          lastShotTick = b.state.tick;
        }
      }
      actions.add(rifle.action);
      if (lastShotTick > 0) charges.push(rifle.weaponCharge);
    });
    expect(shots.length).toBeGreaterThan(10);
    const dt = 1 / CONFIG.tickRate;
    expect(shots[0].time).toBeGreaterThanOrEqual(w.aimTime - dt);
    expect(shots[0].time).toBeLessThanOrEqual(w.aimTime + 3 * dt);
    for (let i = 1; i < shots.length; i++) {
      expect(Math.abs(shots[i].time - shots[i - 1].time - w.cooldown)).toBeLessThanOrEqual(1.5 * dt);
    }
    for (const s of shots) {
      expect(s.weapon).toBe('rifle');
      expect(s.side).toBe(0);
      expect(s.unitId).toBe(rifle.id);
      expect(s.kind).toBe('rifle');
      expect(s.x).toBeCloseTo(rifle.x, 6);
      expect(s.x2).toBeCloseTo(door, 6);
      expect(s.target).toBe('hq');
      expect(s.targetIndex).toBe(1);
      expect(s.dir).toBe(1);
      expect(s.row).toBe(rifle.row);
      expect(s.row2).toBe(-1);
    }
    expect(actions.has('fire')).toBe(true);
    expect(actions.has('reload')).toBe(true);
    expect(actions.has('aim')).toBe(true);
    // The charge climbs from 0 to (nearly) 1 over each reload, and drops back when the shot goes off.
    expect(Math.min(...charges)).toBeLessThan(0.1);
    expect(Math.max(...charges)).toBeGreaterThan(0.9);
    expect(Math.max(...charges)).toBeLessThanOrEqual(1);
    expect(rifle.aimX).toBeCloseTo(door, 6);
  });

  it('fires a machine gun in bursts: shots a burstInterval apart, then a cooldown', () => {
    const w = WEAPONS.lmg;
    const { b } = marksman('lmg', standingDistance('lmg'));
    const times: number[] = [];
    run(b, 25, () => {
      for (const e of eventsOf(b, 'shot')) if (e.source === 'unit') times.push(e.time);
    });
    const dt = 1 / CONFIG.tickRate;
    expect(times[0]).toBeGreaterThanOrEqual(w.aimTime - dt);
    expect(times[0]).toBeLessThanOrEqual(w.aimTime + 3 * dt);
    const bursts: number[][] = [[times[0]]];
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > 3 * w.burstInterval + dt) bursts.push([times[i]]);
      else bursts[bursts.length - 1].push(times[i]);
    }
    expect(bursts.length).toBeGreaterThanOrEqual(5);
    // The last burst may be cut off by the end of the run.
    for (let i = 0; i < bursts.length - 1; i++) {
      expect(bursts[i]).toHaveLength(w.burst);
      const span = bursts[i][w.burst - 1] - bursts[i][0];
      expect(span / (w.burst - 1)).toBeGreaterThan(w.burstInterval - 0.015);
      expect(span / (w.burst - 1)).toBeLessThan(w.burstInterval + 0.015);
      const next = bursts[i + 1][0];
      expect(Math.abs(next - bursts[i][w.burst - 1] - w.cooldown)).toBeLessThanOrEqual(2 * dt);
    }
  });

  it('moves on to the next target when one dies', () => {
    const shooter = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [{ kind: 'rifle', count: 1 }] },
        b: { hasHq: false, forces: [{ kind: 'sapper', count: 2, x: 850 + 200 }] },
      }),
    });
    const kills = collect(shooter, 60, 'unitDied').filter((e) => e.side === 1);
    expect(kills).toHaveLength(2);
    expect(kills[1].time).toBeGreaterThan(kills[0].time);
  });
});

describe('damage', () => {
  const hits = (events: Seen[], kind: string, cause: string): number[] =>
    events.filter((e) => e.type === 'unitHit' && e.kind === kind && e.cause === cause).map((e) => e.value);

  it('applies the damage matrix: weapon damage x DAMAGE[type][class]', () => {
    // Rifle bullets against infantry in the open, and 5 percent against a tank.
    const stream = makeBattle({ mission: withForces(dummies(250), [{ kind: 'rifle', count: 4 }]) });
    const bulletsOnInfantry = hits(collect(stream, 40, 'unitHit'), 'sapper', 'bullet');
    expect(bulletsOnInfantry.length).toBeGreaterThan(5);
    for (const v of bulletsOnInfantry) expect(v).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.infantryOpen, 9);

    const antiTank = makeBattle({
      mission: testMission({
        length: 4000,
        a: { forces: [{ kind: 'rifle', count: 12 }, { kind: 'at', count: 4 }] },
        // Close enough for the rockets of the anti-tank men, who stand further back than the riflemen.
        b: { hasHq: false, forces: [{ kind: 'tank', count: 1, x: 850 + 200, behaviour: 'guard' }] },
      }),
    });
    const events = collect(antiTank, 25, 'unitHit');
    const bulletsOnTank = hits(events, 'tank', 'bullet');
    const rocketsOnTank = hits(events, 'tank', 'antiTank');
    expect(bulletsOnTank.length).toBeGreaterThan(5);
    for (const v of bulletsOnTank) expect(v).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.vehicle, 9);
    expect(rocketsOnTank.length).toBeGreaterThan(0);
    const rocketOnTank = WEAPONS.rocket.damage * DAMAGE.antiTank.vehicle;
    for (const v of rocketsOnTank) {
      // While rockets are instant hits the number is exact; with splash it can only fall short of the centre value.
      if (SIM_FEATURES.projectiles) expect(v).toBeLessThanOrEqual(rocketOnTank + 1e-9);
      else expect(v).toBeCloseTo(rocketOnTank, 9);
    }
    // A rocket does far more to the tank than the same shot does to a man.
    expect(rocketOnTank).toBeGreaterThan(4 * WEAPONS.rocket.damage * DAMAGE.antiTank.infantryOpen);
  });

  it('applies the antiTank column to infantry and the bullet column to the HQ', () => {
    const rockets = makeBattle({ mission: withForces(dummies(200), [{ kind: 'at', count: 4 }]) });
    const onMen = hits(collect(rockets, 30, 'unitHit'), 'sapper', 'antiTank');
    expect(onMen.length).toBeGreaterThan(0);
    for (const v of onMen) {
      const full = WEAPONS.rocket.damage * DAMAGE.antiTank.infantryOpen;
      if (SIM_FEATURES.projectiles) expect(v).toBeLessThanOrEqual(full + 1e-9);
      else expect(v).toBeCloseTo(full, 9);
    }

    const b = makeBattle({
      mission: testMission({ length: 3000, a: { forces: [{ kind: 'rifle', count: 6 }] }, b: { hqHpMul: 50 } }),
    });
    b.command(0, { type: 'order', order: 'advance' });
    const onHq = collect(b, 35, 'structureHit').filter((e) => e.target === 'hq' && e.side === 1 && e.cause === 'bullet');
    expect(onHq.length).toBeGreaterThan(5);
    for (const e of onHq) expect(e.value).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.hq, 9);
    const hq = b.state.sides[1].hq;
    expect(hq).not.toBeNull();
    if (hq) expect(hq.maxHp - hq.hp).toBeCloseTo(onHq.reduce((sum, e) => sum + e.value, 0), 6);
  });

  it('kills a unit when its health runs out, and says who killed it and which way it fell', () => {
    const b = makeBattle({ mission: withForces(dummies(200, 10), [{ kind: 'rifle', count: 3 }]) });
    const events = collect(b, 30, 'unitDied', 'unitHit');
    const died = events.filter((e) => e.type === 'unitDied');
    expect(died.length).toBeGreaterThan(0);
    for (const e of died) {
      expect(e.kind).toBe('sapper');
      expect(e.side).toBe(1);
      expect(e.cause).toBe('bullet');
      expect(e.dir).toBe(1);
      expect(e.targetIndex).toBe(0);
      expect(b.state.units[e.unit].alive && b.state.units[e.unit].id === e.unitId).toBe(false);
    }
    expect(b.state.sides[0].stats.kills).toBe(died.length);
    expect(b.state.sides[1].stats.lost).toBe(died.length);
    // Pop is given back when a unit dies: whoever is left is all that counts.
    expect(b.state.sides[1].pop).toBe(unitsOf(b, 1).length * UNITS.sapper.pop);
  });

  it('applies unit upgrades to side 0 only', () => {
    const boost: UpgradeDef = {
      id: 'boost',
      name: '',
      description: '',
      unit: 'rifle',
      levels: [[{ stat: 'unitDamage', unit: 'rifle', mul: 1.5 }, { stat: 'unitHealth', unit: 'rifle', mul: 2 }]],
      costPerLevel: 1,
    };
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind: 'rifle', count: 3 }] },
      b: { forces: [{ kind: 'rifle', count: 3 }], hqHpMul: 50 },
    });
    const b = makeBattle({ mission, upgrades: { boost: 1 }, upgradeDefs: [boost] });
    expect(unitsOf(b, 0, 'rifle')[0].maxHp).toBe(UNITS.rifle.hp * 2);
    expect(unitsOf(b, 1, 'rifle')[0].maxHp).toBe(UNITS.rifle.hp);
    b.command(0, { type: 'order', order: 'advance' });
    const hqHits = collect(b, 30, 'structureHit').filter((e) => e.target === 'hq' && e.side === 1);
    expect(hqHits.length).toBeGreaterThan(0);
    for (const e of hqHits) expect(e.value).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.hq * 1.5, 9);
  });
});

describe('winning and losing', () => {
  it('ends the battle with a win when the enemy HQ falls', () => {
    const mission = testMission({ length: 3000, a: { forces: [{ kind: 'rifle', count: 6 }] }, b: { hqHpMul: 0.02 } });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const ended: Seen[] = [];
    const destroyed: Seen[] = [];
    runUntil(b, 120, () => {
      ended.push(...eventsOf(b, 'battleEnded'));
      destroyed.push(...eventsOf(b, 'structureDestroyed'));
      return b.state.over;
    });
    const s = b.state;
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('hqDestroyed');
    expect(s.sides[1].hq?.alive).toBe(false);
    expect(s.sides[1].hq?.hp).toBe(0);
    expect(s.sides[0].hq?.alive).toBe(true);
    expect(ended).toHaveLength(1);
    expect(ended[0].side).toBe(0);
    expect(ended[0].value).toBeCloseTo(s.time, 6);
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0].target).toBe('hq');
    expect(destroyed[0].side).toBe(1);

    // Nothing moves any more.
    const tick = s.tick;
    b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    b.step();
    expect(s.tick).toBe(tick);
    expect(b.events.count).toBe(0);
  });

  it('ends the battle with a loss when your own HQ falls', () => {
    const mission = testMission({ length: 3000, a: { hqHpMul: 0.02 }, b: { forces: [{ kind: 'rifle', count: 6 }] } });
    const b = makeBattle({ mission });
    b.command(1, { type: 'order', order: 'advance' });
    runUntil(b, 120, () => b.state.over);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(1);
    expect(b.state.endReason).toBe('hqDestroyed');
    expect(b.state.sides[0].hq?.alive).toBe(false);
  });

  it('counts down a mission timer: surviving it wins, a deadline loses', () => {
    const win = makeBattle({ mission: testMission({ timer: { seconds: 5, onExpire: 'win', label: 'Hold out' } }) });
    run(win, 2);
    expect(win.state.timer?.secondsLeft).toBeCloseTo(3, 1);
    expect(win.state.timer?.total).toBe(5);
    expect(win.state.over).toBe(false);
    run(win, 4);
    expect(win.state.over).toBe(true);
    expect(win.state.winner).toBe(0);
    expect(win.state.endReason).toBe('timerSurvived');
    expect(win.state.time).toBeCloseTo(5, 1);

    const lose = makeBattle({ mission: testMission({ timer: { seconds: 5, onExpire: 'lose', label: 'Nightfall' } }) });
    run(lose, 6);
    expect(lose.state.winner).toBe(1);
    expect(lose.state.endReason).toBe('timerExpired');
  });

  it('gives a side with no HQ no economy and no training', () => {
    const mission = testMission({
      b: { hasHq: false, supplies: 0, forces: [{ kind: 'rifle', count: 2 }] },
      timer: { seconds: 20, onExpire: 'win', label: 'Survive' },
    });
    const b = makeBattle({ mission });
    b.command(1, { type: 'train', kind: 'rifle' });
    run(b, 15);
    const side = b.state.sides[1];
    expect(side.hq).toBeNull();
    expect(b.state.dumps[1]).toBeNull();
    expect(side.supplies).toBe(0);
    expect(side.income).toBe(0);
    expect(side.queue.rifle).toBe(0);
    expect(side.available.rifle).toBe(false);
    expect(b.state.over).toBe(false);
    // Its troops still come at you: the scripted force is the whole army.
    expect(unitsOf(b, 1, 'rifle')).toHaveLength(2);
  });

  it('runBattle reports a timeout when nobody wins', () => {
    const result = runBattle(configOf({ commanders: ['idle', 'idle'] }), 20);
    expect(result.timedOut).toBe(true);
    expect(result.winner).toBe(-1);
    expect(result.endReason).toBe('none');
    expect(result.ticks).toBe(20 * CONFIG.tickRate);
    expect(result.seconds).toBeCloseTo(20, 6);
    expect(result.hqHp).toEqual([1, 1]);
  });

  it('runBattle reports who won and the final numbers', () => {
    const mission = getMission(1);
    expect(mission).toBeDefined();
    if (!mission) return;
    const result = runBattle(configOf({ mission, commanders: ['bot', 'ai'], seed: 3 }), 900);
    expect(result.timedOut).toBe(false);
    expect(result.winner).toBe(0);
    expect(result.endReason).toBe('hqDestroyed');
    expect(result.hqHp[0]).toBeGreaterThan(0);
    expect(result.hqHp[1]).toBe(0);
    expect(result.stats[0].trained).toBeGreaterThan(5);
    expect(result.unitsAlive[0]).toBeGreaterThan(0);
  });
});

describe('bookkeeping', () => {
  it('keeps the per-side stats in step with the events', () => {
    const mission = getMission(1);
    expect(mission).toBeDefined();
    if (!mission) return;
    const b = makeBattle({ mission, commanders: ['bot', 'ai'], seed: 5 });
    const died = [0, 0];
    const done = [0, 0];
    const spent = [0, 0];
    const delivered = [0, 0];
    const spawnedIds: number[] = [];
    runUntil(b, 600, () => {
      const { items, count } = b.events;
      for (let i = 0; i < count; i++) {
        const e = items[i];
        if (e.type === 'unitSpawned') spawnedIds.push(e.unitId);
        if (e.type === 'unitDied') died[e.side]++;
        else if (e.type === 'trainDone') done[e.side]++;
        else if (e.type === 'trainStarted' && e.kind) spent[e.side] += UNITS[e.kind].cost;
        else if (e.type === 'supplyDelivered') delivered[e.side] += e.value;
      }
      return b.state.over;
    });
    const [s0, s1] = b.state.sides;
    // Unit ids are never reused, even though the pool slots are.
    expect(spawnedIds.length).toBeGreaterThan(20);
    for (let i = 1; i < spawnedIds.length; i++) expect(spawnedIds[i]).toBeGreaterThan(spawnedIds[i - 1]);
    expect(s0.stats.lost).toBe(died[0]);
    expect(s1.stats.lost).toBe(died[1]);
    expect(s0.stats.kills).toBe(died[1]);
    expect(s1.stats.kills).toBe(died[0]);
    expect(s0.stats.trained).toBe(done[0]);
    expect(s1.stats.trained).toBe(done[1]);
    expect(s0.stats.suppliesSpent).toBe(spent[0]);
    expect(s1.stats.suppliesSpent).toBe(spent[1]);
    const time = b.state.time;
    expect(s0.stats.suppliesGathered).toBeCloseTo(CONFIG.hqIncomePerSec * time + delivered[0], 3);
    // The enemy's mission income multiplier is already inside its delivered amounts.
    expect(s1.stats.suppliesGathered).toBeCloseTo(CONFIG.hqIncomePerSec * mission.start[1].incomeMul * time + delivered[1], 3);
    expect(s0.stats.damageDealt).toBeGreaterThan(0);
  });
});
