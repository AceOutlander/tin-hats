/**
 * Public API of the simulation. Everything the app, renderer, HUD, tests and
 * tools need is exported from here; do not import other files of src/sim directly.
 *
 *   const battle = createBattle({ mission, difficulty, seed, upgrades, commanders });
 *   battle.command(0, { type: 'train', kind: 'rifle' });
 *   battle.step();                 // one tick of 1 / CONFIG.tickRate seconds
 *   battle.state / battle.events   // read-only; events are cleared at the start of every step
 */
export { createBattle } from './battle';
export { runBattle, summarize } from './run';
export { SIM_FEATURES } from './features';
export { Rng } from './rng';
export { TARGET_HQ, TARGET_NONE, TARGET_PILLBOX, TARGET_UNIT } from './types';
export type {
  Battle,
  BattleConfig,
  BattleResult,
  BattleState,
  Behaviour,
  Command,
  CommanderKind,
  DumpState,
  EndReason,
  EntityKind,
  EventBuffer,
  HqState,
  MountState,
  PillboxState,
  ProjectileState,
  SideState,
  SideStats,
  SimEvent,
  SimEventType,
  SimFeatures,
  SmokeState,
  TimerState,
  TrenchState,
  UnitState,
  WireState,
} from './types';
