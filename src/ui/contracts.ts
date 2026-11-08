/**
 * Contract between the DOM user interface (src/ui) and the app glue (src/app).
 *
 * The UI never imports the simulation or Phaser. It renders the view models
 * below and reports what the player did through AppApi. The app glue builds
 * these models from the simulation and the save data.
 */
import type { Difficulty, Order, SupportKind, TheatreId, UnitKind } from '../data/schema';
import type { TipTarget } from '../data/tutorial';

export type { TipTarget };

export type ScreenId = 'title' | 'campaign' | 'briefing' | 'quartermaster' | 'armoury' | 'battle' | 'result' | 'settings';

export interface TrainButtonState {
  kind: UnitKind;
  /** Full name, for the details and the screen reader. */
  name: string;
  /** Short label that fits the button ("Flamer" for "Flamethrower"). */
  label: string;
  cost: number;
  pop: number;
  /** Units of this kind waiting or in training. */
  queued: number;
  /** 0..1 progress of the one currently in training; 0 when idle. */
  progress: number;
  /** Alive on the field. */
  fielded: number;
  /** False when supplies or population are short. */
  affordable: boolean;
  /** This kind's own order, or null while it follows the army order. */
  ownOrder: Order | null;
}

export interface SupportButtonState {
  kind: SupportKind;
  name: string;
  /** 0..1, 1 = ready. */
  charge: number;
  secondsLeft: number;
}

export interface ControlState {
  kind: UnitKind;
  name: string;
  hp: number;
  maxHp: number;
  /** False hides the health bar: the unit is not the player's own and its health is not revealed. */
  hpShown: boolean;
  /** 0..1, 1 = ready to fire. */
  reload: number;
  hasAbility: boolean;
  abilityName: string;
  /** 0..1, 1 = ready. */
  abilityCharge: number;
}

export interface MinimapState {
  length: number;
  /** Camera window in world units. */
  camX: number;
  camW: number;
  /** HQ x and health fraction per side, or null when a side has no HQ. */
  hq: [{ x: number; hp: number } | null, { x: number; hp: number } | null];
  /** Flat arrays, reused every frame; only the first *Count entries are valid. */
  trenchX: Float32Array;
  trenchW: Float32Array;
  /** -1 unowned, 0 or 1 owner side. */
  trenchOwner: Int8Array;
  trenchCount: number;
  pillboxX: Float32Array;
  pillboxSide: Int8Array;
  pillboxCount: number;
  unitX: Float32Array;
  unitSide: Int8Array;
  /** 1 for vehicles, 0 for infantry. */
  unitBig: Int8Array;
  unitCount: number;
  /** Faction colours for side 0 and side 1. */
  colors: [string, string];
}

/** A guided tutorial tip: a bubble that points at one control, which pulses while the tip is up. */
export interface TipState {
  /** Changes whenever a new tip starts. */
  seq: number;
  text: string;
  target: TipTarget;
}

/** Polled by the HUD every frame. The same object is reused; the HUD must only touch the DOM when a value changed. */
export interface HudState {
  supplies: number;
  incomePerSec: number;
  pop: number;
  popCap: number;
  order: Order;
  train: TrainButtonState[];
  supports: SupportButtonState[];
  /** The support waiting for the player to tap a target on the battlefield, if any. */
  targeting: SupportKind | null;
  control: ControlState | null;
  timer: { label: string; secondsLeft: number; urgent: boolean } | null;
  objective: string;
  hqHp: number;
  hqMaxHp: number;
  /** Null in survival missions. */
  enemyHqHp: number | null;
  enemyHqMaxHp: number;
  paused: boolean;
  muted: boolean;
  /** Tutorial hint or announcement to show, with a counter that changes whenever a new one arrives. */
  banner: string | null;
  bannerSeq: number;
  hint: string | null;
  /** The tutorial tip on show, or null. The object is reused; compare `seq`. */
  tip: TipState | null;
  minimap: MinimapState;
}

export type HudAction =
  | { type: 'train'; kind: UnitKind }
  /** The army-wide order, or with `kind` that unit kind's own order. */
  | { type: 'order'; order: Order; kind?: UnitKind }
  /** That kind follows the army order again (every kind when `kind` is left out). */
  | { type: 'followArmy'; kind?: UnitKind }
  | { type: 'support'; kind: SupportKind }
  | { type: 'cancelTargeting' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'quit' }
  | { type: 'toggleMute' }
  /** The player closed the tutorial tip. */
  | { type: 'dismissTip' }
  /** Joystick deflection while directly controlling a unit: -1 (left) .. 1 (right). */
  | { type: 'stick'; x: number }
  | { type: 'fire'; down: boolean }
  | { type: 'ability' }
  | { type: 'release' }
  /** Jump the camera so that this fraction (0..1) of the map is centred. */
  | { type: 'minimap'; frac: number };

export interface MissionCard {
  id: number;
  title: string;
  location: string;
  date: string;
  theatre: TheatreId;
  mapPos: { lon: number; lat: number };
  briefing: string[];
  objective: string;
  unlocked: boolean;
  cleared: Record<Difficulty, boolean>;
  newUnit: { kind: UnitKind; name: string; blurb: string } | null;
  newSupport: { kind: SupportKind; name: string; blurb: string } | null;
  /** Share of the medals a win pays on each difficulty: 100 for the first win there, then 50, 25, ... */
  replayPercent?: Record<Difficulty, number>;
  /** Types lent for this mission only because the player has not bought them. */
  loans?: { kind: UnitKind; name: string; count: number }[];
}

/** One unit type or plane call-in in the Armoury. */
export interface ArmouryItemView {
  id: string;
  type: 'unit' | 'support';
  /** For drawing its icon: a UnitKind when type is 'unit', a SupportKind when 'support'. */
  kind: UnitKind | SupportKind;
  /** Per-nation names, e.g. "Bren Gunner / MG34 Gunner". */
  name: string;
  blurb: string;
  /** In medals; 0 for the free types. */
  price: number;
  /** Shown under "New units" rather than the core roles. */
  isNew: boolean;
  free: boolean;
  owned: boolean;
  canBuy: boolean;
}

/** One part of a win's score on the victory screen. */
export interface ScorePartView {
  value: number;
  target: number;
  /** 0..1. */
  score: number;
}

/** The medals a win earned, and how. */
export interface MedalResultView {
  medals: number;
  /** Assault missions only: battle seconds against the target. */
  time: ScorePartView | null;
  /** Own units lost against the target. */
  casualties: ScorePartView;
  /** Survival missions only: HQ health 0..1 against the target. */
  hq: ScorePartView | null;
  /** Medals before the difficulty and replay factors. */
  base: number;
  difficultyMul: number;
  /** 100, 50, 25, ... */
  replayPercent: number;
}

export interface UpgradeView {
  id: string;
  name: string;
  description: string;
  unit: UnitKind | null;
  level: number;
  maxLevel: number;
  cost: number;
  /** Short text per level, e.g. "+10% health". */
  levelText: string[];
  canBuy: boolean;
  canRefund: boolean;
}

export interface SettingsView {
  muted: boolean;
  difficulty: Difficulty;
  hints: boolean;
  /** Volume sliders, whole numbers 0..100: Music (music and the stings), Ambience (rain and thunder), Sound effects (everything else). */
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  /** Lightning as a slow soft glow instead of sharp flashes, for photosensitive players. */
  reduceFlash: boolean;
  /** "Show blood": a small dark pool under each soldier killed by gunfire (on by default). */
  showBlood: boolean;
}

/**
 * Raindrops running down the title panel (src/fx/menuStorm.ts PanelDrops). The same object every frame; only the first
 * `count` entries are valid. Positions are fractions of the panel, so the UI scales them to whatever size it is.
 */
export interface PanelDropsState {
  count: number;
  /** 0..1 across the panel. */
  readonly x: Float32Array;
  /** 0..1 down the panel: the head of the drop. */
  readonly y: Float32Array;
  /** Length of the wet trail above the head, as a fraction of the panel height. */
  readonly trail: Float32Array;
  /** Radius of the head in CSS px. */
  readonly size: Float32Array;
  /** Opacity 0..1 (drops fade in where they form). */
  readonly alpha: Float32Array;
  /** Changes whenever the drops moved. */
  version: number;
}

export interface CampaignView {
  missions: MissionCard[];
  /** The mission last started (0 or absent when none): the map opens on it when it is unlocked. */
  lastMission?: number;
  pointsEarned: number;
  pointsSpent: number;
  pointsAvailable: number;
  upgrades: UpgradeView[];
  settings: SettingsView;
  difficulties: { id: Difficulty; name: string }[];
  /** Medals to spend (the Quartermaster's pointsAvailable is the same number). */
  medals?: number;
  /** The Armoury, in its order: core roles, new units, plane call-ins. */
  armoury?: ArmouryItemView[];
}

export interface ResultView {
  won: boolean;
  missionId: number;
  title: string;
  /** e.g. "Enemy HQ destroyed", "Your HQ was overrun", "Night fell before the bridge was taken". */
  reason: string;
  difficulty: Difficulty;
  timeSec: number;
  unitsTrained: number;
  unitsLost: number;
  enemiesKilled: number;
  suppliesGathered: number;
  /** Medals awarded by this result (0 for a defeat). */
  pointsAwarded: number;
  nextMissionId: number | null;
  /** The score breakdown of a campaign win; absent for a defeat or a battle outside the campaign. */
  medals?: MedalResultView | null;
}

/** Implemented by src/app, called by the UI. */
export interface AppApi {
  campaign(): CampaignView;
  startMission(id: number, difficulty: Difficulty): void;
  buyUpgrade(id: string): void;
  /** Buy a unit type or plane call-in in the Armoury (optional so older stand-ins of the app still fit). */
  buyArmoury?(id: string): void;
  refundUpgrade(id: string): void;
  refundAll(): void;
  setSetting<K extends keyof SettingsView>(key: K, value: SettingsView[K]): void;
  resetSave(): void;
  /** Forget which tutorial tips have been shown, so the guided tips come round again. */
  replayHints(): void;
  dispatch(action: HudAction): void;
  /** Play a short UI sound (button click etc.). */
  uiSound(name: 'click' | 'deny' | 'confirm'): void;
}

/** Implemented by src/ui (createUi), called by the app glue. */
export interface UiApi {
  show(screen: ScreenId, payload?: { missionId?: number; result?: ResultView }): void;
  current(): ScreenId;
  /** Called every rendered frame during a battle. Must not allocate and must only write to the DOM on change. */
  updateHud(state: HudState): void;
  /** Called every frame while the title storm runs: the drops running down the title panel. Must not allocate. */
  updateTitleDrops(drops: PanelDropsState): void;
  /** Re-read campaign(), e.g. after the save changed. */
  refresh(): void;
}

export type CreateUi = (root: HTMLElement, app: AppApi) => UiApi;
