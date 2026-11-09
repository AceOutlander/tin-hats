/**
 * What the admin panel's DOM (src/ui/admin) asks of the app (src/app/admin.ts). Plain data both ways: the panel never
 * sees the simulation, the save or the view.
 */
import type { Difficulty, SupportKind, TimeOfDay, UnitKind, WeatherKind } from '../../data/schema';

export type AdminSide = 'mine' | 'enemy';
export type AdminTarget = AdminSide | 'all' | 'selected';
export type WeatherChoice = 'auto' | 'rain' | 'clear';
export type OverlayLayer = 'readout' | 'ranges' | 'hitboxes' | 'points';

/** What a spawn tap places: a unit kind or a squad id (data/admin.ts squads), for a side, so many at a time. */
export interface SpawnSpec {
  what: UnitKind | string;
  side: AdminSide;
  count: number;
}

export type AdminCommand =
  | { type: 'unlockMissions' }
  | { type: 'jump'; missionId: number; difficulty: Difficulty }
  | { type: 'medals'; amount: number }
  | { type: 'points'; amount: number }
  | { type: 'charges'; amount: number }
  | { type: 'upgrade'; id: string; level: number }
  | { type: 'resetSave' }
  | { type: 'addSupplies'; amount: number }
  | { type: 'setSupplies'; amount: number }
  | { type: 'freezeSupplies'; on: boolean }
  | { type: 'infiniteSupplies'; on: boolean }
  | { type: 'instantTrain'; on: boolean }
  | { type: 'end'; win: boolean }
  | { type: 'fireEvent'; index: number }
  /** The mission director moves to this phase now (its PhaseDef.assume put in place). */
  | { type: 'jumpPhase'; phase: string }
  | { type: 'restart'; difficulty: Difficulty }
  | { type: 'weather'; mode: WeatherChoice }
  | { type: 'timeOfDay'; darkness: number | null }
  /** The sim's scripted weather or time of day changes now, over 10 s (FOUNDATIONS.md 4.7). */
  | { type: 'sky'; weather?: WeatherKind; time?: TimeOfDay }
  /** Arm spawning (every tap on the field places `spec`) or stop it (null). */
  | { type: 'place'; spec: SpawnSpec | null }
  /** Arm picking (the next tap on the field selects a unit) or stop it. */
  | { type: 'pick'; on: boolean }
  | { type: 'units'; action: 'kill' | 'heal' | 'invincible' | 'mortal'; target: AdminTarget }
  | { type: 'hqInvincible'; side: AdminSide; on: boolean }
  /** Enemy units join the player: the selected one, or every one on the field. */
  | { type: 'takeOver'; target: 'selected' | 'enemy' }
  | { type: 'fill'; side: AdminSide; kind: UnitKind }
  | { type: 'speed'; scale: number }
  | { type: 'showFps'; on: boolean }
  | { type: 'overlay'; layer: OverlayLayer; on: boolean }
  | { type: 'revealHp'; on: boolean };

export interface AdminBattleInfo {
  missionTitle: string;
  difficulty: Difficulty;
  over: boolean;
  supplies: number;
  frozen: boolean;
  infinite: boolean;
  instantTrain: boolean;
  /** Mine, enemy. */
  hqInvincible: [boolean, boolean];
  sideInvincible: [boolean, boolean];
  /** The mission's scripted events, in data order. */
  events: { index: number; label: string }[];
  /** The mission's phases (a mission of several), for "jump to phase". */
  phases?: { id: string; label: string; current: boolean }[];
  /** Unit names of each side's nation, for the spawn chips. */
  names: [Record<UnitKind, string>, Record<UnitKind, string>];
}

export interface AdminSelected {
  id: number;
  label: string;
  side: AdminSide;
  hp: number;
  maxHp: number;
  invincible: boolean;
}

export interface AdminInfo {
  medals: number;
  /** Upgrade points to spend. */
  points: number;
  /** Call-in charges held, in Shop order. */
  charges: { kind: SupportKind; count: number }[];
  missions: { id: number; title: string }[];
  upgrades: { id: string; name: string; level: number; max: number }[];
  unlockedAll: boolean;
  /** Null outside a battle. */
  battle: AdminBattleInfo | null;
  timeScale: number;
  weather: WeatherChoice;
  darkness: number | null;
  showFps: boolean;
  hpRevealed: boolean;
  overlays: Record<OverlayLayer, boolean>;
  placing: SpawnSpec | null;
  picking: boolean;
  /** The picked unit while it lives. */
  selected: AdminSelected | null;
}

/**
 * One frame of the debug drawing, in CSS px over the battlefield, written into reused arrays (nothing allocated per
 * frame; sized for every unit and point a battle can have): `boxes` = 4 numbers per unit (left, top, width, height)
 * with `boxSide` its side (0 mine, 1 enemy); `ranges` = 4 per armed unit (x0, x1, y, side); `marks` = 3 per point
 * (x, MARK_* kind, owning side or -1).
 */
/** Debug marks: an HQ door (where trained units walk out), the map edge a side with no HQ comes in from, a scripted wave's landing spot, a trench (a capture point). */
export const MARK_HQ = 0;
export const MARK_EDGE = 1;
export const MARK_WAVE = 2;
export const MARK_TRENCH = 3;
/** A building or cover prop (FOUNDATIONS.md 4.3): its slot record in state.trenches. */
export const MARK_BUILDING = 4;

export interface AdminDebugFrame {
  boxes: Float32Array;
  boxSide: Uint8Array;
  boxCount: number;
  ranges: Float32Array;
  rangeCount: number;
  marks: Float32Array;
  markCount: number;
  /** CSS y of the ground line. */
  groundY: number;
}

export interface AdminApi {
  /** A tap on the title helmet; true when it completes the secret run (open the prompt, or the panel if unlocked). */
  helmetTap(): boolean;
  /** Check a typed code; true unlocks the panel for this session. A wrong code changes nothing. */
  submitCode(code: string): boolean;
  isUnlocked(): boolean;
  lock(): void;
  info(): AdminInfo;
  run(command: AdminCommand): void;
  /** The save as JSON text, and a pasted one taken in (checked first; false leaves everything as it was). */
  exportSave(): string;
  importSave(text: string): boolean;
  /** Fill the debug drawing for this frame; false outside a battle. */
  debugFrame(out: AdminDebugFrame): boolean;
  /** The text readout: unit counts, the AI's plan and orders, spawn and capture points. */
  readout(): string;
  /** The panel shows this when something changed outside it (a unit picked or placed, a battle started or ended). */
  onChange: (() => void) | null;
}
