/**
 * The hidden admin panel (src/app/admin.ts, src/ui/admin): how it is opened, what its tabs list, and its step sizes.
 *
 * The passcode itself is never stored: only a salted SHA-256 of it. The repo is public and the game runs in the
 * player's browser, so this only keeps the code from being read in passing; it is not real security, and it does not
 * need to be (the panel only changes the player's own game). The panel's tabs are data: a later job adds an entry to
 * a tab here (and a control for its id in src/ui/admin/panel.ts); an entry with `pending` shows greyed out with that note.
 */
import type { UnitKind } from './schema';

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
  medalGrants: readonly number[];
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
        { id: 'unlockMissions', label: 'Missions' },
        { id: 'unlockCampaigns', label: 'Campaigns and nations', pending: 'Arrives with the campaigns job' },
        { id: 'jump', label: 'Jump to mission' },
        { id: 'phase', label: 'Mission phase', pending: 'Arrives with the mission phases job' },
        { id: 'medals', label: 'Medals (upgrade points)' },
        { id: 'upgrades', label: 'Quartermaster levels' },
        { id: 'save', label: 'Save' },
      ],
    },
    {
      id: 'battle',
      label: 'Battle',
      entries: [
        { id: 'supplies', label: 'Money' },
        { id: 'instantTrain', label: 'Training' },
        { id: 'instantBuild', label: 'Instant building', pending: 'Arrives with the prep phase (job 6)' },
        { id: 'prep', label: 'Prep phase', pending: 'Arrives with the prep phase (job 6)' },
        { id: 'end', label: 'End the battle' },
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
  medalGrants: [10, 100, 1000],
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
