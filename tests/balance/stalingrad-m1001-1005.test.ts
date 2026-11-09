/**
 * The Stalingrad campaign played in order from a fresh save: before each mission the player has unlocked every type
 * the bot trains there and the mission lists, with no Armoury loan, so the bot's runs in tests/balance/missions.test.ts
 * (the bot wins at least 85 percent of the seeds in the expected time, no battle undecided, the idle commander loses
 * every seed, the sim's invariants on every tick) are the battles a player gets.
 *
 * The bot plays each mission with the mission's own unit list; since the unlocks of v0.12.0 (DECISIONS 295) that list
 * is what the player has unlocked by then. The per-mission runs of 1001 to 1005 that this file held moved to
 * tests/balance/missions.test.ts, which runs them on all ten missions since the British placeholders were removed.
 */
import { describe, expect, it } from 'vitest';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { defaultSave, isUnlocked, missionRoster, recordClear, unitsUnlocked } from '../../src/meta';

describe('the Stalingrad campaign played in order from a fresh save', () => {
  it('gives the player, unlocked by then, every type the bot trains and the mission lists, with nothing on loan', () => {
    const save = defaultSave();
    const ids = STALINGRAD_MISSIONS.map((m) => m.id);
    const report: string[] = [];
    for (const m of STALINGRAD_MISSIONS) {
      const roster = missionRoster(save, m, unitsUnlocked(save, STALINGRAD_MISSIONS, (id) => isUnlocked(save, ids, id)));
      const missing = [...new Set([...m.bot.build.map((b) => b.kind), ...m.units[0]])].filter((k) => !roster.units.includes(k));
      if (missing.length > 0 || roster.loans.length > 0) report.push(`m${m.id}: missing [${missing.join(' ')}], loans [${roster.loans.map((l) => l.kind).join(' ')}]`);
      recordClear(save, m.id, 'normal');
    }
    expect(report).toEqual([]);
  });
});
