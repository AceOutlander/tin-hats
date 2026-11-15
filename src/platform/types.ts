/**
 * What the game may be given by the place it runs in (docs/PLATFORM.md).
 *
 * The website gives it nothing: every part is absent (src/platform/index.ts) and the game shows and does nothing for
 * it. A build for another place (an installed app) swaps that one module for its own and fills in the parts it has.
 * The game only ever reads this interface: it never knows who is behind it. This file has no imports and no side
 * effects, so any build can type against it.
 */

/** Removes a listener added through the platform. */
export type Unsubscribe = () => void;

// --- the installed app: lifecycle and the system back action ---------------------------------------------------------------

/** Present when the game runs as an installed app rather than a browser page. */
export interface AppShell {
  /** The app went to the background (another app in front, the screen locked). */
  onPause(listener: () => void): Unsubscribe;
  /** The app is in front again. */
  onResume(listener: () => void): Unsubscribe;
  /**
   * The system "back" action. The listener returns true when the game used it (closed a panel, paused the battle,
   * went back a screen); false leaves it to the platform, which may put the app away. One listener at a time.
   */
  onBack(listener: () => boolean): Unsubscribe;
  /** Ask the device to keep the screen lit (a battle is on) or let it dim as usual. */
  keepAwake(on: boolean): void;
}

// --- a store section in the Shop ---------------------------------------------------------------------------------------

/** What a completed offer gives the player. */
export type OfferOutcome =
  | { readonly kind: 'medals'; readonly medals: number }
  | { readonly kind: 'entitlement'; readonly id: string }
  /** The player backed out: nothing changes and nothing is said. */
  | { readonly kind: 'cancelled' }
  /** It did not go through; `message` is plain words for the player. */
  | { readonly kind: 'failed'; readonly message: string };

/** One thing on offer. Every word shown, the price label included, comes from the platform. */
export interface StoreOffer {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priceLabel: string;
  /** True when the player already owns it and it cannot be had twice. */
  readonly owned?: boolean;
  buy(): Promise<OfferOutcome>;
}

/** A section a platform may add to the Shop. */
export interface StoreSection {
  readonly title: string;
  /** The offers, as they stand now (it may take a moment the first time). */
  offers(): Promise<readonly StoreOffer[]>;
}

// --- a reward the player may ask for -----------------------------------------------------------------------------------

export interface RewardStatus {
  /** Whether one can be shown right now. */
  readonly available: boolean;
  /** How many are left today. */
  readonly leftToday: number;
  /** The medals one gives. */
  readonly medals: number;
}

/** Something the player may choose to sit through for medals. Never shown unless the player asks. */
export interface RewardOffer {
  status(): RewardStatus;
  /** Show it. Resolves with the medals to grant, or null when it was not seen to the end. */
  show(): Promise<{ readonly medals: number } | null>;
}

// --- saves kept somewhere other than this device -----------------------------------------------------------------------

export type CloudStatus = 'off' | 'signed-out' | 'ready' | 'syncing' | 'error';

/** A place to keep the save besides this device. The data is the save as text; merging is the provider's business. */
export interface CloudSave {
  status(): CloudStatus;
  /** The save kept there, or null when there is none. */
  load(): Promise<string | null>;
  /** Keep this save there. Resolves false when it could not be kept (the game carries on with the local one). */
  save(data: string): Promise<boolean>;
}

// --- an extra unit ---------------------------------------------------------------------------------------------------------

/** A unit a platform may add to the roster. Left open on purpose: the first platform to provide one settles its shape. */
export interface ExtraUnitSlot {
  readonly id: string;
  readonly [key: string]: unknown;
}

// --- the whole ---------------------------------------------------------------------------------------------------------------

export interface Platform {
  /** True when the game runs as an installed app. */
  readonly installed: boolean;
  /** Lifecycle and the back action of an installed app. */
  readonly shell: AppShell | null;
  /** A store section for the Shop. */
  readonly store: StoreSection | null;
  /** A reward the player may ask for. */
  readonly reward: RewardOffer | null;
  /** Saves kept besides this device. */
  readonly cloud: CloudSave | null;
  /** What the platform says the player owns, by id. */
  entitlements(): ReadonlySet<string>;
  /** An extra unit for the roster. */
  readonly extraUnit: ExtraUnitSlot | null;
}
