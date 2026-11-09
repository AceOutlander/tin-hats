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
export {
  armyCost,
  armyPop,
  compare,
  equalCounts,
  matchupMission,
  monoArmy,
  runDuel,
  runMatchup,
  type DuelResult,
  type MatchupGround,
  type MatchupResult,
} from './matchup';
export {
  median,
  playMission,
  runMirror,
  runSeries,
  type MirrorResult,
  type MissionRun,
  type MissionSeries,
} from './balanceRuns';
export { SIM_FEATURES } from './features';
export { buildProblem, inPrep, missionTime } from './prep';
export { directorScore, normalPhases, pointOwner, structureHealth, type DirectorScore } from './director';
export { orderCost, orderPop } from './tables';
export { Rng } from './rng';
export { DEPLOY_AUTO, DEPLOY_HQ, TARGET_HQ, TARGET_NONE, TARGET_PILLBOX, TARGET_UNIT } from './types';
export type {
  AdminAction,
  AiReport,
  Battle,
  BattleConfig,
  BattleResult,
  BattleState,
  BarrageState,
  BuildSiteState,
  BuildingState,
  Behaviour,
  CapturePointState,
  Command,
  CommanderKind,
  DirectorState,
  DumpState,
  EndReason,
  EntityKind,
  EventBuffer,
  HqState,
  MountState,
  ObjectiveState,
  PillboxState,
  PrepState,
  ProjectileState,
  SideCheats,
  SideObjectiveState,
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
