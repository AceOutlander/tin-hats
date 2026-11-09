/**
 * Tank cannon (owner's change 3, DECISIONS 424): "tanks feel powerful between shots but are vulnerable while
 * reloading". The same squad meets the same tank twice, once with its gun loaded and once just after it fired: the
 * squad that catches it reloading does far better. Small set pieces on the matchup ground, both sides holding.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MATCHUP } from '../../src/data/balance';
import type { ForceDef, MissionDef } from '../../src/data/schema';
import { createBattle, matchupMission, type Battle } from '../../src/sim';

const SEEDS = MATCHUP.seeds;
const TANK_X = 3300;

function setPiece(a: ForceDef[], b: ForceDef[]): MissionDef {
  const base = matchupMission([{ kind: 'rifle', count: 1 }], [{ kind: 'rifle', count: 1 }], 'open');
  return { ...base, start: [{ ...base.start[0], supplies: 0, forces: a }, { ...base.start[1], supplies: 0, forces: b }] };
}

/** Side 0's squad against one side-1 tank; `reloading` = the tank has just fired its main gun. */
function fight(squad: ForceDef[], reloading: boolean, seed: number, seconds: number): { tankLost: number; squadLeft: number } {
  const b: Battle = createBattle({
    mission: setPiece(squad, [{ kind: 'tank', count: 1, x: TANK_X, behaviour: 'guard' }]),
    difficulty: 'normal',
    seed,
    upgrades: {},
    commanders: ['human', 'human'],
  });
  const tank = b.state.units.find((u) => u.alive && u.kind === 'tank')!;
  const men = squad.reduce((n, f) => n + (f.count ?? 1), 0);
  if (reloading) tank.mount.cooldown = tank.mount.weapon!.cooldown;
  for (let t = 0; t < seconds * CONFIG.tickRate && tank.alive; t++) b.step();
  let left = 0;
  for (let i = 0; i < b.state.unitCount; i++) if (b.state.units[i].alive && b.state.units[i].side === 0) left++;
  return { tankLost: tank.alive ? 1 - tank.hp / tank.maxHp : 1, squadLeft: left / men };
}

function mean(squad: ForceDef[], reloading: boolean, seconds: number): { tankLost: number; squadLeft: number } {
  let tankLost = 0;
  let squadLeft = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = fight(squad, reloading, seed, seconds);
    tankLost += r.tankLost / SEEDS;
    squadLeft += r.squadLeft / SEEDS;
  }
  return { tankLost, squadLeft };
}

describe('a tank between shots', () => {
  it('assault troops that close in while it reloads wreck it; against a loaded gun they do much worse', () => {
    const squad: ForceDef[] = [0, 1, 2, 3, 4, 5].map((k) => ({ kind: 'assault', count: 1, x: TANK_X - 150 + 6 * k, behaviour: 'guard' }));
    const reloading = mean(squad, true, 25);
    const loaded = mean(squad, false, 25);
    expect(reloading.tankLost, `tank value lost to assault troops that catch it reloading (loaded: ${loaded.tankLost.toFixed(2)})`).toBeGreaterThanOrEqual(0.5);
    expect(reloading.tankLost).toBeGreaterThan(loaded.tankLost + 0.3);
  });

  it('anti-tank teams that catch it reloading lose fewer men', () => {
    const squad: ForceDef[] = [0, 1].map((k) => ({ kind: 'at', count: 1, x: TANK_X - 300 + 30 * k, behaviour: 'guard' }));
    const reloading = mean(squad, true, 40);
    const loaded = mean(squad, false, 40);
    expect(reloading.squadLeft, `anti-tank teams left (loaded: ${loaded.squadLeft.toFixed(2)})`).toBeGreaterThan(loaded.squadLeft + 0.4);
    expect(reloading.tankLost).toBeGreaterThanOrEqual(loaded.tankLost);
  });
});
