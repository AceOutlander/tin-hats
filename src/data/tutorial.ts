/**
 * The tutorial as data: the guided steps of Basic Training (the standalone tutorial on the title screen, its own
 * mission in src/data/missions/training.ts), the one-line tips for a unit or support the first time a mission
 * introduces it, and the numbers that decide when a tip starts and ends. The step logic lives in src/app/tutorial.ts;
 * the bubble and the pulsing highlight are drawn by the HUD (src/ui/hud).
 *
 * A step is shown while the player is playing and never blocks anything: it ends when the player does the thing,
 * when its time runs out, or when it is dismissed. The tips of campaign missions are remembered once ended and never
 * shown again; Basic Training's steps run in full every time it is played, whatever the hints setting.
 */
import { BASIC_TRAINING_ID } from './missions/training';
import type { BuildableId, Order, SupportKind, UnitKind } from './schema';

/**
 * What a tip points at. The ids are the data-testid of a HUD control (`train-sapper`, `order-advance`, `order-scope`
 * (the "Orders for" chip of the per-unit-type orders), `support-smoke`, `minimap`, and `fire` and `release` while a
 * unit is under direct control) plus `supplies` (the money readout in the top bar) and `field` (nothing to
 * highlight: the bubble floats above the bottom bar).
 */
export type TipTarget =
  | 'supplies'
  | 'minimap'
  | 'field'
  | 'order-scope'
  | 'fire'
  | 'release'
  | `train-${UnitKind}`
  | `order-${Order}`
  | `support-${SupportKind}`
  | `build-${BuildableId}`
  | 'prep-ready'
  /** The "Deploy at" button, the training bar's first (shown when the mission has spawn points). */
  | 'deploy-at';

/** A fact about the battle or about what the player has done, which must hold. All numbers are minimums. */
export type TutorialCond =
  /** Battle seconds passed. */
  | { t: 'time'; min: number }
  /** Battle seconds since the last tip ended (a way on for a lesson the player skipped). */
  | { t: 'idle'; min: number }
  /** Supplies in hand. */
  | { t: 'supplies'; min: number }
  /** Units of this kind the player has put into training since the battle began. */
  | { t: 'trained'; kind: UnitKind; min: number }
  /** Armed units the player has alive. */
  | { t: 'army'; min: number }
  /** Times the player has tapped this order for the whole army. */
  | { t: 'ordered'; order: Order; min: number }
  /** The order the whole army is under right now. */
  | { t: 'armyOrder'; order: Order }
  /** Build sites the player has placed in a prep phase. */
  | { t: 'placed'; min: number }
  /** The prep phase has ended (Ready, or the countdown ran out). */
  | { t: 'prepOver' }
  /** Orders the player has given one unit type alone (the per-unit-type orders). */
  | { t: 'kindOrdered'; min: number }
  /** Call-ins of this support the sim accepted from the player. */
  | { t: 'called'; support: SupportKind; min: number }
  /** The player's units sitting in a trench slot right now. */
  | { t: 'entrenched'; min: number }
  /** Trenches the player owns right now. */
  | { t: 'trenches'; min: number }
  /** New men are set to deploy at a capture point of the player's choosing (not Front or the HQ) right now. */
  | { t: 'deployPoint' }
  /** An enemy is close to the player's HQ, or the HQ has been hurt. */
  | { t: 'threat' }
  /** The army has been cut down to a fraction of its best size. */
  | { t: 'beaten' }
  /** The player has looked around: dragged the battlefield or used the map strip. */
  | { t: 'panned' }
  /** The player has taken direct control of a unit at some point. */
  | { t: 'controlled' }
  /** A unit is under the player's direct control right now. */
  | { t: 'controlling' }
  /** The player took direct control of a unit and has handed it back (or lost it). */
  | { t: 'released' }
  /** At least one of these holds. */
  | { t: 'any'; of: TutorialCond[] }
  /** Every one of these holds. */
  | { t: 'all'; of: TutorialCond[] };

/** Engine features a step can wait for. A step whose feature is not built yet is left out of the lesson. */
export type TutorialFeature = 'prepPhase';

export interface TutorialStep {
  /** Stable id (campaign tips: remembered in storage once the step has ended). */
  id: string;
  /** `{name}` = the faction's name for the unit or support the step points at; `{reward}` = Basic Training's medals. */
  text: string;
  target: TipTarget;
  /** Ids of steps that must have ended first (a step left out of the lesson does not count). */
  after?: string[];
  /** The step may start once all of these hold. */
  when: TutorialCond[];
  /** The step ends at once when all of these hold (the player did it). A step with none runs for its seconds. */
  done: TutorialCond[];
  /** Battle seconds on screen before the step gives up. */
  seconds: number;
  /** May cut in on the tip that is on screen (the cut tip comes back later). */
  urgent?: boolean;
  /** Offered only once this engine feature exists (TUTORIAL.features). */
  needs?: TutorialFeature;
}

/** Text of a tip for a thing a mission introduces. `{name}` is the faction's name for it. */
export interface NewThingTip {
  text: string;
}

export interface TutorialTunables {
  /** The Basic Training mission: its guided steps run there, every time it is played, whatever the hints setting. */
  trainingMission: number;
  /** Missions whose scripted hints (the `hint` events in the mission data) are replaced by the guided steps. */
  replacesScriptedHints: readonly number[];
  /** Local storage key of the ids of the campaign tips that have ended. */
  storageKey: string;
  /** Most ids kept (a save with more is cut). */
  maxRemembered: number;
  /** Battle seconds between one tip ending and the next starting. */
  gapSeconds: number;
  /** How often (battle seconds) the step logic looks at the battle. */
  evalSeconds: number;
  /** An enemy this close (wu) to the player's HQ, or an HQ below this fraction of its health, is a threat. */
  threatRange: number;
  threatHqFrac: number;
  /** The army is beaten back when it was at least `minPeak` strong and is now at most `frac` of that. */
  beaten: { minPeak: number; frac: number };
  /** Which engine features exist. Steps that need a missing one are skipped (the prep phase is job 6). */
  features: Record<TutorialFeature, boolean>;
  /** The guided steps of Basic Training, in the order they are offered. */
  steps: readonly TutorialStep[];
  /** Tips for the unit and the support a later mission introduces, shown when the battle begins. */
  newUnit: { startAfter: number; seconds: number; tips: Partial<Record<UnitKind, NewThingTip>> };
  newSupport: { startAfter: number; seconds: number; tips: Record<SupportKind, NewThingTip> };
}

export const TUTORIAL: TutorialTunables = {
  trainingMission: BASIC_TRAINING_ID,
  replacesScriptedHints: [BASIC_TRAINING_ID],
  storageKey: 'tinhats.tips',
  maxRemembered: 64,
  gapSeconds: 1.5,
  evalSeconds: 0.2,
  threatRange: 650,
  threatHqFrac: 0.8,
  beaten: { minPeak: 4, frac: 0.4 },
  features: { prepPhase: true },
  // One lesson after another: each step follows the one before it, so the order below is the order of the course.
  // A lesson the player does not do gives up after its seconds and the course goes on.
  steps: [
    {
      id: 'welcome',
      text: 'Welcome to Basic Training. Follow the tips; the X closes any of them.',
      target: 'field',
      when: [{ t: 'time', min: 1 }],
      done: [],
      seconds: 8,
    },
    // Building in a prep phase: Basic Training opens with one, as every defensive mission does.
    {
      id: 'prepPhase',
      text: 'Time to dig in: tap Barbed Wire, tap the ground, then Build here. Ready starts the fight.',
      target: 'build-wire',
      after: ['welcome'],
      when: [],
      done: [{ t: 'any', of: [{ t: 'placed', min: 1 }, { t: 'prepOver' }] }],
      seconds: 30,
      needs: 'prepPhase',
    },
    // Money and sappers.
    {
      id: 'supplies',
      text: 'Money buys troops. Your Sappers carry it from the dump to your HQ, in boxes.',
      target: 'supplies',
      after: ['welcome', 'prepPhase'],
      when: [],
      done: [],
      seconds: 10,
    },
    {
      id: 'trainSapper',
      text: 'Train a Sapper: more Sappers, more money. Tap the Sapper button.',
      target: 'train-sapper',
      after: ['supplies'],
      when: [{ t: 'supplies', min: 50 }],
      done: [{ t: 'trained', kind: 'sapper', min: 1 }],
      seconds: 16,
    },
    // Training units.
    {
      id: 'trainRifle',
      text: 'Now train Riflemen, who do the fighting. Tap the Rifleman button three times.',
      target: 'train-rifle',
      after: ['trainSapper'],
      when: [{ t: 'supplies', min: 45 }],
      done: [{ t: 'trained', kind: 'rifle', min: 3 }],
      seconds: 20,
    },
    // The three army orders, trenches and cover.
    {
      id: 'hold',
      text: 'HOLD: your whole army mans the trench in front of your HQ. Tap HOLD.',
      target: 'order-hold',
      after: ['trainRifle'],
      when: [],
      done: [{ t: 'ordered', order: 'hold', min: 1 }],
      seconds: 12,
    },
    {
      id: 'cover',
      text: 'Men in a trench or a building are hard to hit. Fight from cover when you can.',
      target: 'field',
      after: ['hold'],
      when: [{ t: 'any', of: [{ t: 'entrenched', min: 2 }, { t: 'idle', min: 10 }] }],
      done: [],
      seconds: 10,
    },
    {
      id: 'look',
      text: 'Drag the battlefield to look around, or touch the map strip up here to jump along it.',
      target: 'minimap',
      after: ['cover'],
      when: [],
      done: [{ t: 'panned' }],
      seconds: 12,
    },
    {
      id: 'advance',
      text: 'ADVANCE sends everyone forward. Tap it: your men will take the empty trench ahead.',
      target: 'order-advance',
      after: ['look'],
      // Five men is a fair start; a slow player is sent on after half a minute whatever the size.
      when: [{ t: 'any', of: [{ t: 'army', min: 5 }, { t: 'idle', min: 30 }] }],
      done: [{ t: 'ordered', order: 'advance', min: 1 }],
      seconds: 16,
    },
    {
      id: 'holdForward',
      text: 'Trench taken? Tap HOLD again: the army holds the furthest trench you own.',
      target: 'order-hold',
      after: ['advance'],
      when: [{ t: 'any', of: [{ t: 'trenches', min: 2 }, { t: 'idle', min: 40 }] }],
      done: [{ t: 'armyOrder', order: 'hold' }],
      seconds: 16,
    },
    // Capture points and Deploy: the trench just taken is a capture point, and new men can come in there.
    {
      id: 'deploy',
      text: 'That trench is a capture point. Tap Deploy until it says Forward trench: new men arrive there.',
      target: 'deploy-at',
      after: ['holdForward'],
      when: [],
      done: [{ t: 'deployPoint' }],
      seconds: 20,
    },
    // Per-unit-type orders.
    {
      id: 'kindOrder',
      text: 'Each unit type can have its own orders: tap here, pick a type, then tap an order.',
      target: 'order-scope',
      after: ['deploy'],
      when: [],
      done: [{ t: 'kindOrdered', min: 1 }],
      seconds: 20,
    },
    // Direct control.
    {
      id: 'control',
      text: 'Tap one of your soldiers to take control of him. A joystick and a FIRE button appear.',
      target: 'field',
      after: ['kindOrder'],
      when: [{ t: 'army', min: 1 }],
      done: [{ t: 'controlled' }],
      seconds: 18,
    },
    {
      // Only while a unit is under control; a player who skipped taking control never sees it.
      id: 'drive',
      text: 'Steer him with the joystick and shoot with FIRE. RELEASE hands him back to the army.',
      target: 'fire',
      after: ['control'],
      when: [{ t: 'controlling' }],
      done: [{ t: 'released' }],
      seconds: 20,
    },
    // Call-ins.
    {
      id: 'callIn',
      text: 'Call in the {name}: tap it, then tap the old pillbox ahead. Each call spends one charge.',
      target: 'support-artillery',
      after: ['control'],
      when: [],
      done: [{ t: 'called', support: 'artillery', min: 1 }],
      seconds: 20,
    },
    {
      id: 'fallBack',
      text: 'In trouble? FALL BACK pulls everyone back to a point you hold, or into the HQ. Try it.',
      target: 'order-fallBack',
      after: ['callIn'],
      when: [],
      done: [{ t: 'ordered', order: 'fallBack', min: 1 }],
      seconds: 14,
    },
    {
      // The same lesson when the HQ is in danger: this cannot wait for the rest of the course.
      id: 'fallBackNow',
      text: 'Your HQ is in danger! FALL BACK pulls everyone in, where its machine gun covers them.',
      target: 'order-fallBack',
      when: [{ t: 'time', min: 20 }, { t: 'any', of: [{ t: 'threat' }, { t: 'beaten' }] }],
      done: [{ t: 'ordered', order: 'fallBack', min: 1 }],
      seconds: 14,
      urgent: true,
    },
    // The medals, the Shop and the Quartermaster.
    {
      id: 'medals',
      text: 'Every win pays medals. Finishing Basic Training pays {reward} medals, once.',
      target: 'field',
      after: ['fallBack'],
      when: [],
      done: [],
      seconds: 10,
    },
    {
      id: 'armoury',
      text: 'Spend medals in the Shop on call-in charges. Each briefing lets you pick which ones to bring.',
      target: 'field',
      after: ['medals'],
      when: [],
      done: [],
      seconds: 10,
    },
    {
      id: 'quartermaster',
      text: 'First wins also pay upgrade points: spend them in the Quartermaster, next to the Shop.',
      target: 'field',
      after: ['armoury'],
      when: [],
      done: [],
      seconds: 10,
    },
    {
      id: 'finalAttack',
      text: 'Last lesson: train more men, tap ADVANCE and destroy the enemy HQ to pass.',
      target: 'order-advance',
      after: ['quartermaster'],
      when: [],
      done: [{ t: 'armyOrder', order: 'advance' }],
      seconds: 20,
    },
  ],
  // These point at the button; the mission's own hints say what the new thing is good for.
  newUnit: {
    startAfter: 1,
    seconds: 14,
    tips: {
      lmg: { text: 'New: {name}. Tap its button to train one.' },
      assault: { text: 'New: {name}. Tap its button to train one.' },
      mortar: { text: 'New: {name}. Tap its button to train one.' },
      sniper: { text: 'New: {name}. Tap its button to train one.' },
      medic: { text: 'New: {name}. Tap its button to train one.' },
      at: { text: 'New: {name}. Tap its button to train one.' },
      tank: { text: 'New: {name}. Tap its button to train one.' },
      conscript: { text: 'New: {name}. One tap trains a whole squad at once.' },
      // The new units of job 7, which the Stalingrad missions unlock (DECISIONS 334).
      flame: { text: 'New: {name}. Tap its button to train one.' },
      commander: { text: 'New: {name}. Tap its button to train one.' },
      aa: { text: 'New: {name}. Tap its button to train one.' },
      apc: { text: 'New: {name}. Tap its button to train one.' },
    },
  },
  newSupport: {
    startAfter: 1,
    seconds: 14,
    tips: {
      artillery: { text: 'New: {name}. Tap it, then tap the battlefield where the shells should fall.' },
      smoke: { text: 'New: {name}. Tap it, then tap the ground in front of your men.' },
      airStrike: { text: 'New: {name}. Tap it, then tap the battlefield where the aircraft should strike.' },
      bomber: { text: 'New: {name}. Tap it, then tap the battlefield where the bombs should fall.' },
      fighter: { text: 'New: {name}. Tap it, then tap the battlefield where the fighter should strafe.' },
      recon: { text: 'New: {name}. Tap it, then tap the battlefield to scout.' },
      katyusha: { text: 'New: {name}. Tap it, then tap the battlefield where the rockets should fall.' },
    },
  },
};
