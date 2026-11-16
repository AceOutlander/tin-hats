/**
 * The extra unit slot (src/data/extraUnit.ts, docs/PLATFORM.md): a made-up unit is installed before the game's data is
 * read, and the generic capabilities it leans on are checked: a place in every table, the battle's switch (side 0
 * only, never the enemy), the blow that needs contact, the charge, and the limit per battle.
 *
 * tests/unit/extra-unit-absent.test.ts holds the other half: with nothing installed, nothing is different.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { installExtraUnit } from '../../src/data/extraUnit';
import type { MissionDef } from '../../src/data/schema';
import type * as SimModule from '../../src/sim';
import type { Battle, CommanderKind, SimEvent } from '../../src/sim';
import type * as MatchupModule from '../../src/sim/matchup';
import { MADE_UP_EXTRA } from './extra-unit-made-up';

// Before anything else of the game is read (the imports above are types, or the slot itself).
installExtraUnit(MADE_UP_EXTRA);

let sim: typeof SimModule;
let matchup: typeof MatchupModule;
let SANDBOX: MissionDef;
let tickRate: number;

beforeAll(async () => {
  sim = await import('../../src/sim');
  matchup = await import('../../src/sim/matchup');
  SANDBOX = (await import('../../src/data/missions/sandbox')).SANDBOX;
  tickRate = (await import('../../src/data/config')).CONFIG.tickRate;
});

function battleOf(extraUnit: boolean | undefined, commanders: [CommanderKind, CommanderKind] = ['human', 'idle']): Battle {
  return sim.createBattle({ mission: SANDBOX, difficulty: 'normal', seed: 7, upgrades: {}, commanders, extraUnit });
}

function run(battle: Battle, seconds: number, each?: (e: SimEvent) => void): void {
  const end = battle.state.tick + Math.ceil(seconds * tickRate);
  while (battle.state.tick < end && !battle.state.over) {
    battle.step();
    if (each) for (let i = 0; i < battle.events.count; i++) each(battle.events.items[i]);
  }
}

describe('an installed extra unit', () => {
  it('is in every table the game builds from its data', async () => {
    const { UNITS, UNIT_KINDS } = await import('../../src/data/units');
    const { WEAPONS } = await import('../../src/data/weapons');
    const { ONE_SHOT_NAMES, isSoundName } = await import('../../src/data/sounds');
    const { FACTIONS, FACTION_IDS } = await import('../../src/data/factions');
    const { resolveEra } = await import('../../src/data/eras');
    expect(UNIT_KINDS[UNIT_KINDS.length - 1]).toBe('extra');
    expect(UNIT_KINDS.filter((k) => k === 'extra')).toHaveLength(1);
    expect(UNITS.extra).toBe(MADE_UP_EXTRA.unit);
    expect(WEAPONS.madeUpBlade).toBe(MADE_UP_EXTRA.weapons[0]);
    expect(ONE_SHOT_NAMES as string[]).toContain('madeUpClang');
    expect(isSoundName('madeUpClang')).toBe(true);
    for (const id of FACTION_IDS) {
      expect(FACTIONS[id].unitNames.extra).toBe('Champion');
      const era = resolveEra(id, '1942-09-14', 'city');
      expect(era.names.extra).toBe('Champion');
      expect(era.buttonNames.extra).toBe('Champ');
      expect(era.blurbs.extra).toBe(MADE_UP_EXTRA.blurb);
    }
  });

  it('cannot be installed twice, nor once the data has been read', () => {
    expect(() => installExtraUnit(MADE_UP_EXTRA)).toThrow();
  });

  it('is trainable by side 0 only, and only when the battle says so', () => {
    expect(battleOf(undefined).state.sides[0].available.extra).toBe(false);
    expect(battleOf(false).state.sides[0].available.extra).toBe(false);
    const on = battleOf(true);
    expect(on.state.sides[0].available.extra).toBe(true);
    expect(on.state.sides[1].available.extra).toBe(false);
  });

  it('is never handed out by a mission list, and never trained by the enemy', () => {
    const listed: MissionDef = { ...SANDBOX, units: [[...SANDBOX.units[0], 'extra'], [...SANDBOX.units[1], 'extra']] };
    const battle = sim.createBattle({ mission: listed, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['bot', 'ai'], extraUnit: true });
    expect(battle.state.sides[1].available.extra).toBe(false);
    expect(sim.createBattle({ mission: listed, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['bot', 'ai'] }).state.sides[0].available.extra).toBe(false);
    let enemySeen = 0;
    run(battle, 240, (e) => {
      if (e.type === 'unitSpawned' && e.kind === 'extra' && e.side === 1) enemySeen++;
    });
    battle.command(1, { type: 'train', kind: 'extra' });
    run(battle, 1);
    expect(enemySeen).toBe(0);
    expect(battle.state.sides[1].queue.extra).toBe(0);
    expect(battle.state.sides[1].alive.extra).toBe(0);
  });

  it('is limited per battle: one trained, and no second one even after the first is lost', () => {
    const battle = battleOf(true);
    battle.admin({ type: 'setSupplies', side: 0, amount: 5000 });
    battle.command(0, { type: 'train', kind: 'extra' });
    battle.command(0, { type: 'train', kind: 'extra' });
    run(battle, 1);
    const side = battle.state.sides[0];
    expect(side.queue.extra).toBe(1);
    run(battle, MADE_UP_EXTRA.unit.trainTime + 2);
    expect(side.alive.extra).toBe(1);
    battle.command(0, { type: 'train', kind: 'extra' });
    run(battle, 1);
    expect(side.queue.extra).toBe(0);
    const u = battle.state.units.find((x) => x.alive && x.kind === 'extra');
    if (!u) throw new Error('the extra unit is not on the field');
    expect(battle.admin({ type: 'kill', side: 0, unit: u.id })).toBe(1);
    expect(side.alive.extra).toBe(0);
    expect(side.stats.lostByKind.extra).toBe(1);
    battle.command(0, { type: 'train', kind: 'extra' });
    run(battle, 1);
    expect(side.queue.extra).toBe(0);
  });

  it('fights hand to hand: every blow is struck within reach and lands', () => {
    const battle = sim.createBattle({
      mission: matchup.matchupMission([{ kind: 'extra', count: 1 }], [{ kind: 'rifle', count: 4 }], 'open'),
      difficulty: 'normal',
      seed: 11,
      upgrades: {},
      commanders: ['human', 'human'],
    });
    battle.command(0, { type: 'order', order: 'advance' });
    battle.command(1, { type: 'order', order: 'hold' });
    let blows = 0;
    run(battle, 60, (e) => {
      if (e.type !== 'shot' || e.weapon !== 'madeUpBlade') return;
      blows++;
      expect(e.hit).toBe(true);
      expect(Math.abs(e.x2 - e.x)).toBeLessThanOrEqual(MADE_UP_EXTRA.weapons[0].range + 1e-6);
    });
    expect(blows).toBeGreaterThan(3);
    expect(battle.state.sides[1].stats.lost).toBeGreaterThan(0);
  });

  it('reaches men in a trench from its edge, and no further', () => {
    const battle = sim.createBattle({
      mission: matchup.matchupMission([{ kind: 'extra', count: 1 }], [{ kind: 'rifle', count: 4 }], 'trench'),
      difficulty: 'normal',
      seed: 11,
      upgrades: {},
      commanders: ['human', 'human'],
    });
    battle.command(0, { type: 'order', order: 'advance' });
    battle.command(1, { type: 'order', order: 'hold' });
    const reach = MADE_UP_EXTRA.weapons[0].range;
    run(battle, 1);
    const trench = battle.state.trenches.find((t) => t.occupants > 0);
    if (!trench) throw new Error('the defenders are not in a trench');
    let blows = 0;
    let beyondReach = 0;
    run(battle, 90, (e) => {
      // Its blows at the men (once they are gone it rides on to their headquarters).
      if (e.type !== 'shot' || e.weapon !== 'madeUpBlade' || e.target !== 'unit') return;
      blows++;
      expect(e.hit).toBe(true);
      // The man may stand further away than the blade is long; the near edge of his trench never is.
      if (Math.abs(e.x2 - e.x) > reach) beyondReach++;
      expect(Math.max(0, Math.abs(trench.x - e.x) - trench.width / 2)).toBeLessThanOrEqual(reach + 1e-6);
    });
    expect(blows).toBeGreaterThan(3);
    expect(beyondReach).toBeGreaterThan(0);
    expect(battle.state.sides[1].stats.lost).toBe(4);
  });

  it('charges: faster with the enemy near, announced at most once every few seconds', () => {
    const battle = sim.createBattle({
      mission: matchup.matchupMission([{ kind: 'extra', count: 1 }], [{ kind: 'rifle', count: 2 }], 'open'),
      difficulty: 'normal',
      seed: 5,
      upgrades: {},
      commanders: ['human', 'human'],
    });
    battle.command(0, { type: 'order', order: 'advance' });
    battle.command(1, { type: 'order', order: 'hold' });
    const base = MADE_UP_EXTRA.unit.speed;
    const charge = MADE_UP_EXTRA.unit.charge;
    if (!charge) throw new Error('the made-up unit has no charge');
    const times: number[] = [];
    let fastest = 0;
    let plain = 0;
    const end = battle.state.tick + 40 * tickRate;
    while (battle.state.tick < end && !battle.state.over) {
      battle.step();
      for (let i = 0; i < battle.events.count; i++) {
        const e = battle.events.items[i];
        if (e.type !== 'charge') continue;
        expect(e.kind).toBe('extra');
        expect(e.side).toBe(0);
        expect(e.value).toBeGreaterThanOrEqual(0);
        times.push(battle.state.time);
      }
      const u = battle.state.units.find((x) => x.alive && x.kind === 'extra');
      if (!u) break;
      if (u.velX > fastest) fastest = u.velX;
      if (!u.charging && u.velX > plain) plain = u.velX;
    }
    expect(times.length).toBeGreaterThan(0);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(charge.every - 1e-6);
    expect(plain).toBeLessThanOrEqual(base + 1e-6);
    expect(fastest).toBeGreaterThan(base * 1.2);
    expect(fastest).toBeLessThanOrEqual(base * charge.speedMul + 1e-6);
  });

  it('takes hits as a vehicle does: bullets do little, anti-tank weapons a great deal', () => {
    const rifles = matchup.runDuel([{ kind: 'extra', count: 1 }], [{ kind: 'rifle', count: 5 }], 'open', 2);
    expect(rifles.winner).toBe(0);
    expect(rifles.left[0]).toBeGreaterThan(0.7);
    const at = matchup.runDuel([{ kind: 'extra', count: 1 }], [{ kind: 'at', count: 4 }], 'open', 2);
    expect(at.winner).toBe(1);
  });
});
