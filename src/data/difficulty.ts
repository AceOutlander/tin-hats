import type { Difficulty, DifficultyDef } from './schema';

/**
 * Difficulty never changes unit stats: only the AI's income (passive, sappers and airdrops), its
 * aggression and reaction time, the size of the waves it sends and how big its army may grow.
 */
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: { id: 'normal', name: 'Normal', aiIncomeMul: 1, aiAggression: 1, aiWaveMul: 1, aiPopCapMul: 1, aiThinkInterval: 1 },
  hard: { id: 'hard', name: 'Hard', aiIncomeMul: 1.3, aiAggression: 1.2, aiWaveMul: 1.3, aiPopCapMul: 1.15, aiThinkInterval: 0.7 },
  insane: { id: 'insane', name: 'Insane', aiIncomeMul: 1.65, aiAggression: 1.45, aiWaveMul: 1.6, aiPopCapMul: 1.3, aiThinkInterval: 0.5 },
};

/** In menu order. */
export const DIFFICULTY_LIST: readonly Difficulty[] = ['normal', 'hard', 'insane'];
