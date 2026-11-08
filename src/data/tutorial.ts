/**
 * The tutorial as data: the guided steps of mission 1, the one-line tips for a
 * unit or support the first time a mission introduces it, and the numbers that
 * decide when a tip starts and ends. The step logic lives in src/app/tutorial.ts;
 * the bubble and the pulsing highlight are drawn by the HUD (src/ui/hud).
 *
 * A step is shown while the player is playing and never blocks anything: it
 * ends when the player does the thing, when its time runs out, or when it is
 * dismissed, and once ended it is remembered and never shown again.
 */
import type { Order, SupportKind, UnitKind } from './schema';

/**
 * What a tip points at. The ids are the data-testid of a HUD control (`train-sapper`, `order-advance`,
 * `support-smoke`, `minimap`) plus `supplies` (the supplies readout in the top bar) and `field` (nothing to
 * highlight: the bubble floats above the bottom bar).
 */
export type TipTarget = 'supplies' | 'minimap' | 'field' | `train-${UnitKind}` | `order-${Order}` | `support-${SupportKind}`;

/** A fact about the battle or about what the player has done, which must hold. All numbers are minimums. */
export type TutorialCond =
  /** Battle seconds passed. */
  | { t: 'time'; min: number }
  /** Supplies in hand. */
  | { t: 'supplies'; min: number }
  /** Units of this kind the player has put into training since the battle began. */
  | { t: 'trained'; kind: UnitKind; min: number }
  /** Armed units the player has alive. */
  | { t: 'army'; min: number }
  /** Times the player has tapped this order. */
  | { t: 'ordered'; order: Order; min: number }
  /** Call-ins of this support the sim accepted from the player. */
  | { t: 'called'; support: SupportKind; min: number }
  /** An enemy is close to the player's HQ, or the HQ has been hurt. */
  | { t: 'threat' }
  /** The army has been cut down to a fraction of its best size. */
  | { t: 'beaten' }
  /** The player has looked around: dragged the battlefield or used the map strip. */
  | { t: 'panned' }
  /** The player has taken direct control of a unit. */
  | { t: 'controlled' }
  /** At least one of these holds. */
  | { t: 'any'; of: TutorialCond[] }
  /** Every one of these holds. */
  | { t: 'all'; of: TutorialCond[] };

export interface TutorialStep {
  /** Stable id, remembered in the save once the step has ended. */
  id: string;
  text: string;
  target: TipTarget;
  /** Ids of steps that must have ended first. */
  after?: string[];
  /** The step may start once all of these hold. */
  when: TutorialCond[];
  /** The step ends at once when all of these hold (the player did it). A step with none runs for its seconds. */
  done: TutorialCond[];
  /** Battle seconds on screen before the step gives up. */
  seconds: number;
  /** May cut in on the tip that is on screen (the cut tip comes back later). */
  urgent?: boolean;
}

/** Text of a tip for a thing a mission introduces. `{name}` is the faction's name for it. */
export interface NewThingTip {
  text: string;
}

export interface TutorialTunables {
  /** The mission the guided steps belong to. */
  firstMission: number;
  /** Missions whose scripted hints (the `hint` events in the mission data) are replaced by the guided steps. */
  replacesScriptedHints: readonly number[];
  /** Local storage key of the ids of the tips that have ended. */
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
  /** The guided steps of the first mission, in the order they are offered. */
  steps: readonly TutorialStep[];
  /** Tips for the unit and the support a later mission introduces, shown when the battle begins. */
  newUnit: { startAfter: number; seconds: number; tips: Partial<Record<UnitKind, NewThingTip>> };
  newSupport: { startAfter: number; seconds: number; tips: Record<SupportKind, NewThingTip> };
}

export const TUTORIAL: TutorialTunables = {
  firstMission: 1,
  replacesScriptedHints: [1],
  storageKey: 'tinhats.tips',
  maxRemembered: 64,
  gapSeconds: 1.5,
  evalSeconds: 0.2,
  threatRange: 650,
  threatHqFrac: 0.8,
  beaten: { minPeak: 4, frac: 0.4 },
  steps: [
    {
      id: 'supplies',
      text: 'Supplies buy troops. Your Sappers carry them from the dump to your HQ.',
      target: 'supplies',
      when: [{ t: 'time', min: 1 }],
      done: [{ t: 'trained', kind: 'sapper', min: 1 }],
      seconds: 9,
    },
    {
      id: 'trainSapper',
      text: 'Train a Sapper: more Sappers, more supplies. Tap the Sapper button.',
      target: 'train-sapper',
      after: ['supplies'],
      when: [{ t: 'supplies', min: 50 }],
      done: [{ t: 'trained', kind: 'sapper', min: 1 }],
      seconds: 14,
    },
    {
      id: 'trainRifle',
      text: 'Now train Riflemen, who do the fighting. Tap the Rifleman button a few times.',
      target: 'train-rifle',
      after: ['trainSapper'],
      when: [{ t: 'supplies', min: 45 }],
      done: [{ t: 'trained', kind: 'rifle', min: 2 }],
      seconds: 16,
    },
    {
      id: 'hold',
      text: 'HOLD keeps your army guarding the line near your HQ. Your Sappers keep working.',
      target: 'order-hold',
      after: ['trainRifle'],
      when: [],
      done: [{ t: 'ordered', order: 'hold', min: 1 }],
      seconds: 9,
    },
    {
      id: 'look',
      text: 'Drag the battlefield to look around, or touch the map strip up here to jump along it.',
      target: 'minimap',
      after: ['hold'],
      when: [{ t: 'time', min: 30 }],
      done: [{ t: 'panned' }],
      seconds: 12,
    },
    {
      id: 'advance',
      text: 'Your army is ready. ADVANCE sends everyone forward to destroy the enemy HQ.',
      target: 'order-advance',
      after: ['hold'],
      // Six men is a fair start; a slow player is told by the three-minute mark whatever the size.
      when: [{ t: 'any', of: [{ t: 'army', min: 6 }, { t: 'all', of: [{ t: 'time', min: 180 }, { t: 'army', min: 3 }] }] }],
      done: [{ t: 'ordered', order: 'advance', min: 1 }],
      seconds: 20,
    },
    {
      id: 'control',
      text: 'Tap one of your soldiers to take control of him. A joystick and a FIRE button appear.',
      target: 'field',
      after: ['look'],
      when: [{ t: 'army', min: 3 }, { t: 'time', min: 50 }],
      done: [{ t: 'controlled' }],
      seconds: 14,
    },
    {
      id: 'fallBack',
      text: 'In trouble? FALL BACK pulls everyone into the HQ, where its machine gun covers them.',
      target: 'order-fallBack',
      // Needs no other step first: when the HQ is in danger this cannot wait for the rest of the lesson.
      when: [{ t: 'time', min: 20 }, { t: 'any', of: [{ t: 'threat' }, { t: 'beaten' }] }],
      done: [{ t: 'ordered', order: 'fallBack', min: 1 }],
      seconds: 14,
      urgent: true,
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
    },
  },
};

