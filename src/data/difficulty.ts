import type { Difficulty, DifficultyDef } from './schema';

/** Difficulty never changes unit stats: only the AI's income, aggression and reaction time. */
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: { id: 'normal', name: 'Normal', aiIncomeMul: 1, aiAggression: 1, aiThinkInterval: 1 },
  hard: { id: 'hard', name: 'Hard', aiIncomeMul: 1.3, aiAggression: 1.2, aiThinkInterval: 0.7 },
  insane: { id: 'insane', name: 'Insane', aiIncomeMul: 1.65, aiAggression: 1.45, aiThinkInterval: 0.5 },
};

/** In menu order. */
export const DIFFICULTY_LIST: readonly Difficulty[] = ['normal', 'hard', 'insane'];
