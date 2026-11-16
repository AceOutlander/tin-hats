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

/**
 * How asking for an offer ended. Whatever the offer gives, the platform gives it itself (medals through the game's
 * own `GameHost`), so the game only shows the state. `message` is plain words for the player, from the platform.
 */
export type OfferOutcome =
  /** It went through and the player has what was offered. */
  | { readonly kind: 'done'; readonly message: string }
  /** It is on its way but not settled yet: nothing has been given, and the platform finishes it later by itself. */
  | { readonly kind: 'pending'; readonly message: string }
  /** The player backed out: nothing changes and nothing is said. */
  | { readonly kind: 'cancelled' }
  /** It did not go through. */
  | { readonly kind: 'failed'; readonly message: string };

/** One thing on offer. Every word shown, the price label included, comes from the platform. */
export interface StoreOffer {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priceLabel: string;
  /** True when the player already owns it and it cannot be had twice. */
  readonly owned?: boolean;
  /** Set while an earlier request for it is still unsettled: shown under the offer, and it cannot be asked for again. */
  readonly pending?: string;
  buy(): Promise<OfferOutcome>;
}

/** The offers as they stand now. With a `message` the section shows it above the offers (or alone when there are none). */
export interface StoreListing {
  readonly offers: readonly StoreOffer[];
  readonly message?: string;
}

/** A section a platform may add to the Shop. */
export interface StoreSection {
  readonly title: string;
  /** Short lines shown under the offers, as the platform words them. */
  readonly notes?: readonly string[];
  /** The offers, as they stand now (it may take a moment the first time). */
  list(): Promise<StoreListing>;
  /** The listing changed by itself (something unsettled was settled): the Shop asks for it again. */
  onChange?(listener: () => void): Unsubscribe;
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

/**
 * One picture of the extra unit, drawn in code like all the game's art (the same shape as the game's SpriteSpec):
 * sizes and drawing coordinates in world units, the anchor as a 0..1 fraction of w and h. The unit faces right (+x)
 * and its anchor is the point on the ground under the middle of its body.
 */
export interface ExtraUnitPicture {
  /** Unique among every picture of the game: start it with "extra/". */
  readonly key: string;
  readonly w: number;
  readonly h: number;
  readonly ax: number;
  readonly ay: number;
  /** Draw into a context whose origin is the picture's top-left corner. Must not leave state changed. */
  draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * Pictures shown one after another, by key. `rate` is pictures per second for what happens in time (standing,
 * striking, falling) and pictures per world unit travelled for what happens on the move (moving, charging).
 */
export interface ExtraUnitAnim {
  readonly frames: readonly string[];
  readonly rate: number;
}

/** How the extra unit looks: its pictures, which of them show what, and its portrait for buttons and cards. */
export interface ExtraUnitArt {
  /** Every picture the animations name. Made into textures the first time a battle may field the unit, never at startup. */
  readonly pictures: readonly ExtraUnitPicture[];
  /** Standing (a loop). */
  readonly idle: ExtraUnitAnim;
  /** Moving and charging (loops, by distance). */
  readonly move: ExtraUnitAnim;
  readonly charge: ExtraUnitAnim;
  /** One blow, played once each time its weapon strikes. */
  readonly strike: ExtraUnitAnim;
  /** The fall, played once when it dies; the last picture lies there until the body fades. */
  readonly death: ExtraUnitAnim;
  /** Its height and length in world units: where its health pips and its shout go, how big its shadow is. */
  readonly height: number;
  readonly length: number;
  /** Where its weapon strikes from, from the anchor, facing right (world units; up is negative y). */
  readonly reach: { readonly x: number; readonly y: number };
  /** Its portrait, drawn to fill a w x h pixel box (the training button, the cards). */
  portrait(ctx: CanvasRenderingContext2D, w: number, h: number): void;
}

/**
 * A unit a platform adds to the roster, in two halves. Its rules, weapons, sounds and words are data the platform
 * installs while its module loads (`installExtraUnit` in src/data/extraUnit.ts: the game's tables are built from
 * them). This slot is the other half: who may field it and how it is drawn.
 */
export interface ExtraUnitSlot {
  /** The id among `entitlements()` that says the player owns the unit; without it the game never offers it. */
  readonly entitlement: string;
  readonly art: ExtraUnitArt;
}

// --- what the game lends a platform ------------------------------------------------------------------------------------------

/** granted: given and saved. already: this grant was given before, nothing changed. failed: not given (it could not be saved). */
export type GrantResult = 'granted' | 'already' | 'failed';

/** Handed to `Platform.attach` once the game is running. */
export interface GameHost {
  /**
   * Give the player medals, once: `grantId` (letters, digits and . : _ -, 96 at most) names the grant, and a grant
   * the save already holds changes nothing. The medals and the id are written to the save together, before this
   * returns.
   */
  grantMedals(medals: number, grantId: string): GrantResult;
}

// --- a test mode ---------------------------------------------------------------------------------------------------------

/** A switch a platform may put in the admin panel: its own services run against stand-ins while it is on. */
export interface PlatformTestMode {
  /** What the switch is called, and a line under it, as the platform words them. */
  readonly label: string;
  readonly note: string;
  on(): boolean;
  set(on: boolean): void;
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
  /** A test mode switch for the admin panel. */
  readonly testMode: PlatformTestMode | null;
  /** Called once, when the game is running, with what the game lends the platform. */
  attach?(game: GameHost): void;
}
