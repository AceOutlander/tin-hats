import { CONFIG } from '../data/config';
import { createBattle } from './battle';
import type { Battle, BattleConfig, BattleResult, SideStats } from './types';

function copyStats(stats: SideStats): SideStats {
  return {
    trained: stats.trained,
    lost: stats.lost,
    kills: stats.kills,
    suppliesGathered: stats.suppliesGathered,
    suppliesSpent: stats.suppliesSpent,
    damageDealt: stats.damageDealt,
  };
}

/** Summarise a battle as it stands now. */
export function summarize(battle: Battle): BattleResult {
  const s = battle.state;
  const unitsAlive: [number, number] = [0, 0];
  for (let i = 0; i < s.unitCount; i++) {
    if (s.units[i].alive) unitsAlive[s.units[i].side]++;
  }
  const hq0 = s.sides[0].hq;
  const hq1 = s.sides[1].hq;
  return {
    winner: s.winner,
    endReason: s.endReason,
    timedOut: !s.over,
    ticks: s.tick,
    seconds: s.time,
    stats: [copyStats(s.sides[0].stats), copyStats(s.sides[1].stats)],
    hqHp: [hq0 ? hq0.hp / hq0.maxHp : 0, hq1 ? hq1.hp / hq1.maxHp : 0],
    unitsAlive,
  };
}

/**
 * Run a whole battle headless: step until it ends or `maxSeconds` of battle
 * time have passed (then `timedOut` is true and `winner` is -1).
 */
export function runBattle(config: BattleConfig, maxSeconds: number): BattleResult {
  const battle = createBattle(config);
  const maxTicks = Math.ceil(maxSeconds * CONFIG.tickRate);
  while (!battle.state.over && battle.state.tick < maxTicks) battle.step();
  return summarize(battle);
}
