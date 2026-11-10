/**
 * The hidden admin panel (src/app/admin.ts, src/ui/admin): how it is opened, what its tabs list, and its step sizes.
 *
 * The passcode itself is never stored: only a salted SHA-256 of it. The repo is public and the game runs in the
 * player's browser, so this only keeps the code from being read in passing; it is not real security, and it does not
 * need to be (the panel only changes the player's own game). The panel's tabs are data: a later job adds an entry to
 * a tab here (and a control for its id in src/ui/admin/panel.ts); an entry with `pending` shows greyed out with that note.
 */
import type { FactionId, ForceLookId, SupportKind, UnitKind } from './schema';

/** A spawnable group: one kind, or a squad of several (the King Tiger with its veteran escort). */
export interface AdminSquadDef {
  id: string;
  label: string;
  /** ehind = wu behind the tapped spot (toward the side's own HQ) where that member's group starts. */
  members: readonly { kind: UnitKind; count: number; veteran?: boolean; behind?: number }[];
}

export type AdminTabId = 'campaign' | 'battle' | 'units' | 'speed' | 'debug';

export interface AdminEntryDef {
  /** The control the panel builds for it (src/ui/admin/panel.ts). */
  id: string;
  label: string;
  /** Shown greyed out with this note: the system it needs comes with a later job. */
  pending?: string;
}

export interface AdminTabDef {
  id: AdminTabId;
  label: string;
  entries: readonly AdminEntryDef[];
}

/** An era variant the spawn tab offers (ForceDef.look): drawn, named and armed as that look, for the kinds listed. */
export interface AdminLookDef {
  look: ForceLookId;
  label: string;
  /** The nation it belongs to: the spawned units are that nation's (names, looks, a vehicle's gun). */
  nation: FactionId;
  kinds: readonly UnitKind[];
}

export interface AdminTunables {
  /** SHA-256 (hex) of salt + the passcode, the code trimmed and in lower case (phone keyboards capitalise). */
  passcode: { salt: string; sha256: string };
  /** Taps on the title screen's helmet that open the prompt, each within tapGapMs of the one before. */
  taps: number;
  tapGapMs: number;
  /** The same on a computer: this key (KeyboardEvent.code) with these modifiers held. */
  keys: { code: string; ctrl: boolean; alt: boolean; shift: boolean };
  /** Longest passcode the prompt accepts (characters). */
  maxCodeLength: number;
  tabs: readonly AdminTabDef[];
  /** Units per spawn tap. */
  batches: readonly number[];
  squads: readonly AdminSquadDef[];
  /** "Fill to the cap" uses the kind picked for spawning; a squad pick fills with this kind. */
  fillKind: UnitKind;
  /** Speed buttons (0 = frozen: nothing moves, the panel still works). */
  timeScales: readonly number[];
  /** Medals the panel gives at a tap (negative = takes, never below zero). */
  medalGrants: readonly number[];
  /** Upgrade points the panel gives at a tap (negative = takes). */
  pointGrants: readonly number[];
  /** Charges of every call-in the panel gives at a tap. */
  chargeGrants: readonly number[];
  /** Charges of one call-in the panel gives at a tap (negative = takes). */
  chargeSteps: readonly number[];
  /** The call-ins' names on the charge rows. */
  chargeNames: Record<SupportKind, string>;
  /** Spawn as another nation than the side's own (null = the side's own). */
  spawnNations: readonly { nation: FactionId | null; label: string }[];
  /** Era variants to spawn (the side's own era look when none is picked). */
  spawnLooks: readonly AdminLookDef[];
  supplyGrants: readonly number[];
  /** What "infinite" supplies are held at. */
  infiniteSupplies: number;
  /** Night tint per time-of-day button; null = the mission's own light. */
  timesOfDay: readonly { label: string; darkness: number | null }[];
  /** A ground tap in "pick a unit" mode takes the nearest unit within this many wu. */
  pickRadiusWu: number;
  /** The debug view: readout refresh (ms), colours per side, and the outline height of a vehicle as a share of its width. */
  debug: { readoutMs: number; sideColours: readonly [string, string]; markColour: string; vehicleHeight: number };
  /** What the import box says when the pasted text is not a save it can use. */
  importRejected: string;
}

export const ADMIN: AdminTunables = {
  passcode: { salt: 'tin-hats/admin/v1:', sha256: '1c58fb4bcd05e171fb6d85837131af0f513dfe0f81afed0293330cdf319314cc' },
  taps: 7,
  tapGapMs: 700,
  keys: { code: 'KeyH', ctrl: true, alt: true, shift: true },
  maxCodeLength: 64,
  tabs: [
    {
      id: 'campaign',
      label: 'Campaign',
      entries: [
        { id: 'unlockMissions', label: 'Unlock all' },
        { id: 'jump', label: 'Jump to a mission and phase' },
        { id: 'medals', label: 'Medals' },
        { id: 'points', label: 'Upgrade points' },
        { id: 'charges', label: 'Call-in charges' },
        { id: 'upgrades', label: 'Quartermaster levels' },
        { id: 'save', label: 'Save' },
      ],
    },
    {
      id: 'battle',
      label: 'Battle',
      entries: [
        { id: 'supplies', label: 'Money' },
        { id: 'instantTrain', label: 'Training and building' },
        { id: 'prep', label: 'Prep phase' },
        { id: 'end', label: 'End the battle' },
        { id: 'phases', label: 'Mission phases' },
        { id: 'events', label: 'Scripted events' },
        { id: 'difficulty', label: 'Difficulty (restarts)' },
        { id: 'weather', label: 'Weather' },
        { id: 'timeOfDay', label: 'Time of day' },
      ],
    },
    {
      id: 'units',
      label: 'Units',
      entries: [
        { id: 'spawn', label: 'Spawn' },
        { id: 'fill', label: 'Fill the army to the cap' },
        { id: 'pick', label: 'Selected unit' },
        { id: 'groups', label: 'Whole sides' },
        { id: 'hq', label: 'Invincible HQ' },
        { id: 'takeOver', label: 'Take control of enemy units' },
      ],
    },
    {
      id: 'speed',
      label: 'Speed',
      entries: [{ id: 'speed', label: 'Game speed' }],
    },
    {
      id: 'debug',
      label: 'Debug',
      entries: [
        { id: 'showFps', label: 'FPS readout' },
        { id: 'readout', label: 'Unit counts and AI plan' },
        { id: 'overlays', label: 'On the battlefield' },
        { id: 'revealHp', label: 'Enemy health' },
        { id: 'renderer', label: 'Renderer' },
      ],
    },
  ],
  batches: [1, 10, 50],
  squads: [
    {
      id: 'kingTigerSquad',
      label: 'King Tiger squad',
      // As the old British mission 10 fielded it: the tank and its veteran escort.
      members: [
        { kind: 'heavyTank', count: 1 },
        { kind: 'rifle', count: 3, veteran: true, behind: 140 },
      ],
    },
  ],
  fillKind: 'rifle',
  timeScales: [0, 0.25, 0.5, 1, 2, 4, 8],
  medalGrants: [-100, -10, 10, 100, 1000],
  pointGrants: [-5, 5, 50],
  chargeGrants: [1, 10],
  chargeSteps: [-1, 1, 10],
  chargeNames: { smoke: 'Smoke', artillery: 'Artillery', recon: 'Recon plane', fighter: 'Fighter', airStrike: 'Air strike', katyusha: 'Katyusha', bomber: 'Bomber' },
  spawnNations: [
    { nation: null, label: 'Own' },
    { nation: 'soviet', label: 'Soviet' },
    { nation: 'german', label: 'German' },
  ],
  spawnLooks: [
    { look: 't26', label: 'T-26', nation: 'soviet', kinds: ['lightTank', 'tank'] },
    { look: 'bt7', label: 'BT-7', nation: 'soviet', kinds: ['lightTank', 'tank'] },
    { look: 't60', label: 'T-60', nation: 'soviet', kinds: ['lightTank', 'tank'] },
    { look: 't34', label: 'T-34', nation: 'soviet', kinds: ['tank', 'lightTank'] },
    { look: 'kv1', label: 'KV-1', nation: 'soviet', kinds: ['tank', 'heavyTank'] },
    { look: 'kv2', label: 'KV-2', nation: 'soviet', kinds: ['tank', 'heavyTank'] },
    { look: 'panzer3', label: 'Panzer III E', nation: 'german', kinds: ['lightTank', 'tank'] },
    { look: 'panzer3h', label: 'Panzer III H', nation: 'german', kinds: ['lightTank', 'tank'] },
    { look: 'panzer3l', label: 'Panzer III L', nation: 'german', kinds: ['tank', 'lightTank'] },
    { look: 'panzer4', label: 'Panzer IV', nation: 'german', kinds: ['tank'] },
    { look: 'panzer4g', label: 'Panzer IV G', nation: 'german', kinds: ['tank'] },
    { look: 'stug3b', label: 'StuG III B', nation: 'german', kinds: ['tank'] },
    { look: 'stug3f', label: 'StuG III F', nation: 'german', kinds: ['tank'] },
    { look: 'skiTroops', label: 'Ski troops', nation: 'soviet', kinds: ['rifle', 'assault'] },
    { look: 'romanian', label: 'Romanian', nation: 'german', kinds: ['rifle', 'lmg', 'assault', 'mortar', 'at', 'sniper', 'medic'] },
  ],
  supplyGrants: [500, 5000],
  infiniteSupplies: 99999,
  timesOfDay: [
    { label: 'Mission', darkness: null },
    { label: 'Day', darkness: 0 },
    { label: 'Dusk', darkness: 0.5 },
    { label: 'Night', darkness: 1 },
  ],
  pickRadiusWu: 60,
  debug: { readoutMs: 250, sideColours: ['#7fd0ff', '#ff7f6a'], markColour: '#ffd34a', vehicleHeight: 0.45 },
  importRejected: 'That is not a Tin Hats save.',
};
