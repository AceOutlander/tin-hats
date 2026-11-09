/** Types shared by the UI shell and the menu screens. */
import type { Difficulty, FactionLook } from '../../data/schema';
import type { AppApi, CampaignView, HudState, PanelDropsState, ResultView, ScreenId } from '../contracts';
import type { PaintUnitIcon, PaintUpgradePreview } from './icons';

/** What the HUD track's createHud returns (src/ui/hud/index.ts). */
export interface HudHandle {
  update(state: HudState): void;
  setVisible(visible: boolean): void;
  destroy(): void;
  getButtonRects(): unknown;
}

export interface HudOptions {
  paintUnitIcon?: PaintUnitIcon;
}

export type CreateHud = (root: HTMLElement, app: AppApi, opts: HudOptions) => HudHandle;

export interface UiOptions {
  /** Paints a unit portrait into a canvas; supplied by the art track through the app glue. */
  paintUnitIcon?: PaintUnitIcon;
  /** Paints the battle look of an upgrade level for the Quartermaster; without it the cards show no picture. */
  paintUpgradePreview?: PaintUpgradePreview;
  /** Paints a nation's flag to fill a canvas (the campaign select cards); without it the cards show a plain swatch. */
  paintFlag?: (canvas: HTMLCanvasElement, flag: FactionLook['flag']) => void;
  /**
   * The HUD factory. When omitted the UI loads src/ui/hud/index.ts itself (lazily, and
   * carries on without a HUD if that module is missing). Pass `null` to run with no HUD.
   */
  createHud?: CreateHud | null;
  /** Called after every screen change, including the first. */
  onScreen?: (screen: ScreenId) => void;
  /** Called when the "rotate your phone" overlay appears (true) or goes away (false). */
  onPortrait?: (portrait: boolean) => void;
  /** Version text on the title screen; defaults to the package version. */
  version?: string;
  /** Install the page lockdown (scroll, zoom, selection, context menu). Default true. */
  lockdown?: boolean;
}

export interface ShowPayload {
  missionId?: number;
  result?: ResultView;
}

/** Menu state that outlives a single screen. */
export interface UiSession {
  /** Mission selected on the map and shown in the briefing; 0 = pick a sensible default. */
  missionId: number;
  /** Difficulty picked in the briefing this session; null = use the saved default. */
  difficulty: Difficulty | null;
  /** The last result handed to show('result'). */
  result: ResultView | null;
  /** Where the Settings screen returns to. */
  settingsFrom: ScreenId;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  yes: string;
  no: string;
  onYes: () => void;
}

export interface ScreenCtx {
  app: AppApi;
  opts: UiOptions;
  session: UiSession;
  /** The campaign view read when the screen was shown or last refreshed. */
  view(): CampaignView;
  /** Re-read campaign() and refresh the current screen (after a purchase, a setting change...). */
  reload(): void;
  go(screen: ScreenId, payload?: ShowPayload): void;
  confirm(request: ConfirmRequest): void;
  /** True when the player's last input was a key press (so focus rings are wanted). */
  keyboard(): boolean;
}

export interface ScreenView {
  el: HTMLElement;
  /** The campaign view changed: update in place. */
  refresh?(): void;
  /** Esc, or the screen's own Back button. */
  back?(): void;
  /** The viewport changed size. */
  resize?(): void;
  /** Called once the element is in the document (sizes can be measured). */
  mounted?(): void;
  destroy?(): void;
  /** Arrow keys and other screen-specific shortcuts; return true if handled. */
  key?(ev: KeyboardEvent): boolean;
  /** The title storm's drops on the panel moved (every frame while it runs). Must not allocate. */
  drops?(state: PanelDropsState): void;
}

export type ScreenFactory = (ctx: ScreenCtx) => ScreenView;
