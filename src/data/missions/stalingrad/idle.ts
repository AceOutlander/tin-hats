import type { IdleCounterDef } from '../../schema';

/**
 * The Stalingrad campaign's idle rule (IdleCounterDef; owner, 2026-11-15, DECISIONS 550): what the Germans do to a
 * player who has given no command for four minutes in a phase with no clock. Their commander goes over to the attack
 * and counter-attack groups come in every 90 s, each bigger than the last, the fifth again and again, until the
 * player's HQ has fallen or he takes up the battle again. Four minutes is longer than the test bot ever goes without
 * a command in such a phase (160 s at most), so a player who is playing never meets it.
 */
export const STALINGRAD_IDLE: IdleCounterDef = {
  after: 240,
  every: 90,
  // Armour and the anti-tank teams lead each group: they are first in where the population cap makes a group wait.
  waves: [
    [
      { kind: 'rifle', count: 6 },
      { kind: 'assault', count: 3 },
    ],
    [
      { kind: 'at', count: 1 },
      { kind: 'rifle', count: 8 },
      { kind: 'assault', count: 4 },
      { kind: 'lmg', count: 1 },
    ],
    [
      { kind: 'tank', count: 1 },
      { kind: 'at', count: 2 },
      { kind: 'rifle', count: 10 },
      { kind: 'assault', count: 6 },
    ],
    [
      { kind: 'tank', count: 2 },
      { kind: 'at', count: 2 },
      { kind: 'rifle', count: 12 },
      { kind: 'assault', count: 8 },
      { kind: 'mortar', count: 1 },
    ],
    [
      { kind: 'tank', count: 3 },
      { kind: 'at', count: 3 },
      { kind: 'rifle', count: 14 },
      { kind: 'assault', count: 10 },
      { kind: 'mortar', count: 2 },
    ],
  ],
  banner: 'The Germans are counter-attacking!',
  announce: 'More Germans are coming on.',
};
