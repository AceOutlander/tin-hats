/**
 * Counters of the job-7 units (owner's spec in docs/QUEUE.md, "New units" and "Two new German
 * tanks"), in the equal-cost matchup harness and in small set-piece battles. The core kinds keep
 * their own tables in matchups.test.ts; the new kinds are tested here against their counters.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MATCHUP } from '../../src/data/balance';
import type { ForceDef, MissionDef, SupportKind, UnitKind } from '../../src/data/schema';
import { createBattle, matchupMission, runMatchup, type Battle, type MatchupResult } from '../../src/sim';

const SEEDS = MATCHUP.seeds;
const OPEN_DUELS = 2 * SEEDS;
const CLEAR = Math.ceil((2 / 3) * OPEN_DUELS);

const cache = new Map<string, MatchupResult>();
function duel(a: UnitKind, b: UnitKind, ground: 'open' | 'trench'): MatchupResult {
  const key = `${ground}:${a}:${b}`;
  let r = cache.get(key);
  if (!r) {
    r = runMatchup(a, b, ground, SEEDS);
    cache.set(key, r);
  }
  return r;
}

/** Duels won by x in the open over both orderings. */
function openWins(x: UnitKind, y: UnitKind): number {
  return duel(x, y, 'open').winsA + duel(y, x, 'open').winsB;
}

function expectBeats(x: UnitKind, y: UnitKind): void {
  const won = openWins(x, y);
  expect(won, `${x} should beat ${y} in the open (won ${won} of ${OPEN_DUELS})`).toBeGreaterThanOrEqual(CLEAR);
}

describe('flamethrowers', () => {
  it('lose to machine guns and snipers at range in the open', () => {
    expectBeats('lmg', 'flame');
    expectBeats('sniper', 'flame');
  });

  it('burn riflemen out of a trench that riflemen cannot take', () => {
    const flame = duel('flame', 'rifle', 'trench');
    const rifle = duel('rifle', 'rifle', 'trench');
    expect(flame.winsA, `flamethrowers attacking riflemen dug in: ${flame.winsA} of ${SEEDS}`).toBeGreaterThanOrEqual(SEEDS - 1);
    expect(rifle.winsA).toBeLessThan(flame.winsA);
  });
});

describe('APCs', () => {
  it('beat riflemen in the open, barely scratched by their bullets', () => {
    expectBeats('apc', 'rifle');
    expect((duel('apc', 'rifle', 'open').leftA + duel('rifle', 'apc', 'open').leftB) / 2).toBeGreaterThanOrEqual(0.7);
  });

  it('lose to anti-tank teams', () => {
    expectBeats('at', 'apc');
  });
});

describe('the Panzer III', () => {
  it('loses to anti-tank teams and to the heavier tank at equal cost', () => {
    expectBeats('at', 'lightTank');
    expectBeats('tank', 'lightTank');
  });
});

/** A two-sided set piece on the matchup ground: side 0 forces against side 1 forces, both holding (idle). */
function setPiece(a: ForceDef[], b: ForceDef[], supports: SupportKind[] = []): MissionDef {
  const base = matchupMission([{ kind: 'rifle', count: 1 }], [{ kind: 'rifle', count: 1 }], 'open');
  return {
    ...base,
    supports: [supports, supports],
    start: [
      { ...base.start[0], supplies: 5000, forces: a },
      { ...base.start[1], supplies: 5000, forces: b },
    ],
  };
}

function battle(mission: MissionDef, seed: number): Battle {
  return createBattle({ mission, difficulty: 'normal', seed, upgrades: {}, commanders: ['human', 'human'] });
}

function alive(b: Battle, side: number, kind: UnitKind): number {
  let n = 0;
  for (let i = 0; i < b.state.unitCount; i++) {
    const u = b.state.units[i];
    if (u.alive && u.side === side && u.kind === kind) n++;
  }
  return n;
}

function tiger(b: Battle) {
  for (let i = 0; i < b.state.unitCount; i++) {
    const u = b.state.units[i];
    if (u.alive && u.kind === 'heavyTank') return u;
  }
  return null;
}

const TIGER_X = 3300;

describe('the King Tiger', () => {
  it('cannot be killed from the front by a few anti-tank teams, which it destroys', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const b = battle(
        setPiece([{ kind: 'at', count: 3, x: 2950 }], [{ kind: 'heavyTank', count: 1, x: TIGER_X, behaviour: 'guard' }]),
        seed,
      );
      b.command(0, { type: 'order', order: 'advance' });
      for (let t = 0; t < 120 * CONFIG.tickRate && alive(b, 0, 'at') > 0; t++) b.step();
      const k = tiger(b);
      expect(k, `seed ${seed}: the King Tiger survives`).not.toBeNull();
      expect(alive(b, 0, 'at'), `seed ${seed}: anti-tank teams left`).toBe(0);
      expect(k!.hp / k!.maxHp, `seed ${seed}`).toBeGreaterThan(0.5);
    }
  });

  it('dies to a handful of anti-tank teams that get behind it', () => {
    for (let seed = 1; seed <= 4; seed++) {
      // Side 1's tank keeps its front toward side 0 (-x); four teams posted past it fire into its rear.
      const rear: ForceDef[] = [0, 1, 2, 3].map((k) => ({ kind: 'at', count: 1, x: TIGER_X + 160 + 60 * k, behaviour: 'guard' }));
      const b = battle(
        setPiece(
          rear,
          [{ kind: 'heavyTank', count: 1, x: TIGER_X, behaviour: 'guard' }, { kind: 'rifle', count: 1, x: 3900, behaviour: 'guard' }],
        ),
        seed,
      );
      for (let t = 0; t < 120 * CONFIG.tickRate && tiger(b); t++) b.step();
      expect(tiger(b), `seed ${seed}: the King Tiger is dead`).toBeNull();
    }
  });

  it('dies to concentrated anti-tank fire from the front', () => {
    let kills = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const b = battle(
        setPiece(
          Array.from({ length: 12 }, (_, k): ForceDef => ({ kind: 'at', count: 1, x: TIGER_X - 330 + 22 * k, behaviour: 'guard' })),
          [{ kind: 'heavyTank', count: 1, x: TIGER_X, behaviour: 'guard' }],
        ),
        seed,
      );
      for (let t = 0; t < 180 * CONFIG.tickRate && tiger(b); t++) b.step();
      if (!tiger(b)) kills++;
    }
    expect(kills, 'massed anti-tank teams kill it').toBeGreaterThanOrEqual(3);
  });

  it('dies to repeated bombing runs', () => {
    const b = battle(setPiece([{ kind: 'rifle', count: 1, x: 1000, behaviour: 'guard' }], [{ kind: 'heavyTank', count: 1, x: TIGER_X, behaviour: 'guard' }], ['bomber']), 1);
    let runs = 0;
    for (let t = 0; t < 900 * CONFIG.tickRate && tiger(b); t++) {
      if (b.state.sides[0].supportCooldown.bomber <= 0 && b.state.sides[0].supplies >= 300) {
        b.command(0, { type: 'support', kind: 'bomber', x: tiger(b)!.x });
        runs++;
      }
      b.step();
    }
    expect(tiger(b), 'the King Tiger is dead').toBeNull();
    expect(runs, 'bombing runs it took').toBeLessThanOrEqual(5);
  });
});

describe('the commander', () => {
  it('measurably helps the squad around him: more damage dealt than the same squad without his aura', () => {
    const squad = (commanderX: number): ForceDef[] => [
      { kind: 'rifle', count: 8, x: 2500, behaviour: 'guard' },
      { kind: 'commander', count: 1, x: commanderX, behaviour: 'guard' },
    ];
    const enemy: ForceDef[] = [{ kind: 'rifle', count: 8, x: 2700, behaviour: 'guard' }];
    let withAura = 0;
    let without = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const [x, add] of [
        // Behind his squad, inside his aura but out of the enemy's reach (so he draws no fire and fires no shot).
        [2300, (v: number) => (withAura += v)],
        [600, (v: number) => (without += v)],
      ] as const) {
        const b = battle(setPiece(squad(x), enemy), seed);
        for (let t = 0; t < 40 * CONFIG.tickRate; t++) b.step();
        add(b.state.sides[0].stats.damageDealt);
      }
    }
    expect(withAura / without, 'damage with the aura over damage without').toBeGreaterThan(1.02);
  });
});

describe('anti-aircraft guns', () => {
  it('shoot down or drive off most aircraft that cross them', () => {
    let downed = 0;
    let bombsOnTarget = 0;
    let bombsUnopposed = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const guns of [3, 0]) {
        const forces: ForceDef[] = [{ kind: 'rifle', count: 6, x: 3300, behaviour: 'guard' }];
        if (guns > 0) forces.push({ kind: 'aa', count: guns, x: 3500, behaviour: 'guard' });
        const b = battle(setPiece([{ kind: 'rifle', count: 1, x: 600, behaviour: 'guard' }], forces, ['bomber']), seed);
        b.command(0, { type: 'support', kind: 'bomber', x: 3250 });
        for (let t = 0; t < 15 * CONFIG.tickRate; t++) {
          b.step();
          for (let i = 0; i < b.events.count; i++) {
            const e = b.events.items[i];
            if (e.type === 'planeDown') downed++;
            if (e.type === 'projectile' && e.weapon === 'aerialBomb') {
              if (guns > 0) bombsOnTarget++;
              else bombsUnopposed++;
            }
          }
        }
      }
    }
    expect(downed, 'bombers shot down by three guns').toBeGreaterThanOrEqual(SEEDS / 2);
    expect(bombsOnTarget, 'bombs dropped through the flak vs unopposed').toBeLessThan(bombsUnopposed * 0.6);
  });

  it('are weak against ground troops: riflemen beat them at equal cost', () => {
    expectBeats('rifle', 'aa');
  });
});
