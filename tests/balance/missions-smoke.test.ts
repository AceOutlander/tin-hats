/**
 * Every campaign mission, played by the reasonable-player bot and by the idle commander against
 * the AI on Normal, runs to an end within a generous cap without breaking the sim's invariants:
 * nothing NaN, no negative supplies, every unit on the map, the lines never crossing, and no unit
 * stuck in 'move' without moving for 30 s. Who wins is asserted in missions.test.ts; here the
 * results are printed as a table (vitest hides it unless run with --silent=false:
 * x.cmd npx vitest run tests/balance/missions-smoke.test.ts --silent=false).
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { MISSIONS } from '../../src/data/missions';
import { createBattle, summarize, type BattleResult, type CommanderKind } from '../../src/sim';
import { strictWatch } from './helpers';

const SEEDS = [1, 2];
/** Battle seconds before a run counts as never ending. */
const CAP_SECONDS = 45 * 60;

interface Row {
  mission: number;
  p0: CommanderKind;
  results: BattleResult[];
}

const rows: Row[] = [];

function play(missionIndex: number, p0: CommanderKind, seed: number): BattleResult {
  const mission = MISSIONS[missionIndex];
  const b = createBattle({ mission, difficulty: 'normal', seed, upgrades: {}, commanders: [p0, 'ai'] });
  const watch = strictWatch();
  const maxTicks = CAP_SECONDS * CONFIG.tickRate;
  while (!b.state.over && b.state.tick < maxTicks) {
    b.step();
    watch(b);
  }
  return summarize(b);
}

describe('every mission runs to an end without breaking invariants', () => {
  for (let m = 0; m < MISSIONS.length; m++) {
    for (const p0 of ['bot', 'idle'] as const) {
      it(`mission ${MISSIONS[m].id} with the ${p0} commander`, () => {
        const results = SEEDS.map((seed) => play(m, p0, seed));
        rows.push({ mission: MISSIONS[m].id, p0, results });
        for (const r of results) {
          expect(r.timedOut, `mission ${MISSIONS[m].id} ${p0}`).toBe(false);
          expect(r.endReason).not.toBe('none');
        }
      });
    }
  }

  it('prints the results table', () => {
    // Runs last; with a -t filter some rows may be missing.
    if (rows.length === 0) return;
    rows.sort((a, b) => a.mission - b.mission || a.p0.localeCompare(b.p0));
    const lines = ['mission  p0    results (winner @ minutes, reason)'];
    for (const row of rows) {
      const cells = row.results.map((r) => `${r.timedOut ? 'none' : r.winner === 0 ? 'WIN ' : r.winner === 1 ? 'LOSS' : 'DRAW'} @ ${(r.seconds / 60).toFixed(1)} ${r.endReason}`);
      lines.push(`${String(row.mission).padStart(7)}  ${row.p0.padEnd(5)} ${cells.join(' | ')}`);
    }
    console.log(lines.join('\n'));
  });
});
