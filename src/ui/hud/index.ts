/**
 * The in-battle HUD, built from DOM elements over the Phaser canvas.
 *
 * createHud() builds the whole tree once. update(state) then runs every frame:
 * it compares each displayed value with the one last written and touches the
 * DOM only on a change, without allocating. Player input goes back to the app
 * as HudAction objects through AppApi.dispatch.
 */
import type { Order, SupportKind, UnitKind } from '../../data/schema';
import { VIEW } from '../../data/view';
import type { AppApi, ControlState, HudState, SupportButtonState, TipState, TipTarget, TrainButtonState } from '../contracts';
import { CallInFold, callInRows } from './callins';
import {
  FRAC,
  clockSeconds,
  formatClock,
  formatFps,
  formatIncome,
  hpLevel,
  incomeTenths,
  quant,
  shortName,
  BUTTON_NAME_CHARS,
  stickValue,
  stripFrac,
  trainButtonName,
  deployPlaceFit,
} from './format';
import { ICONS, type IconName } from './icons';
import { PrepPanel } from './prep';
import { capturePointer, isPrimaryPointer, onPress, onTap } from './input';
import { MINIMAP_PAD, MinimapView } from './minimap';
import './hud.css';

export type PaintUnitIcon = (canvas: HTMLCanvasElement, kind: UnitKind, side: 0 | 1) => void;

export interface HudOptions {
  /** Draws a unit portrait into a canvas whose width and height are already set (device pixels). */
  paintUnitIcon?: PaintUnitIcon;
}

export interface HudRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hud {
  /** Call every rendered frame. Allocation-free; writes to the DOM only when a shown value changed. */
  update(state: HudState): void;
  setVisible(v: boolean): void;
  destroy(): void;
  /** Client rectangles of every control currently shown, keyed by data-testid. */
  getButtonRects(): Record<string, HudRect>;
}

const ORDERS: readonly Order[] = ['fallBack', 'hold', 'advance'];
const ORDER_LABEL: Record<Order, string> = { fallBack: 'Fall Back', hold: 'Hold', advance: 'Advance' };
const SUPPORT_ICON: Record<SupportKind, IconName> = {
  artillery: 'artillery',
  smoke: 'smoke',
  airStrike: 'airStrike',
  bomber: 'bomber',
  fighter: 'fighter',
  recon: 'recon',
  katyusha: 'katyusha',
};
const LEVEL: readonly string[] = ['0', '1', '2'];

/** Longest label that fits a training or support button before it is cut to its first word. */
const NAME_CHARS = BUTTON_NAME_CHARS;

/** Middle of the joystick travel that reads as "not moving". */
const STICK_DEAD_ZONE = 0.14;
/** The minimap is repainted on every Nth update, and at once whenever the camera moves. */
const MINIMAP_EVERY = 4;
const BANNER_CLASS_A = 'th-banner show-a';
const BANNER_CLASS_B = 'th-banner show-b';
/**
 * A tap on a control that lands within HUD_SPOT_PX of the last tap on a menu screen, less than HUD_ARM_MS after it, is the
 * second tap of a double-tap on Begin (or Retry) and not a command: the Advance button now sits where the thumb is.
 */
const HUD_ARM_MS = 400;
const HUD_SPOT_PX = 24;
/** Where a tutorial bubble sits relative to the control it explains (`float` = the control is the battlefield itself). */
type TipSide = 'above' | 'below' | 'right' | 'float';
/** The tip bubble is re-measured on every Nth update while it is up (the training bar may scroll under it). */
const TIP_EVERY = 12;
/** Gap between a bubble and its control, and the margin it keeps from the screen edge (CSS px). */
const TIP_GAP = 10;
const TIP_MARGIN = 6;
/** Keep the bubble's arrow this far from the bubble's corners. */
const TIP_ARROW_INSET = 16;
/** A bubble is narrowed to fit beside the objective plate only if it can stay at least this wide (CSS px). */
const TIP_NARROW_MIN = 170;

function tipSideOf(target: TipTarget): TipSide {
  if (target === 'supplies' || target === 'minimap' || target === 'prep-ready' || target.startsWith('build-')) return 'below';
  if (target === 'field') return 'float';
  return target.startsWith('support-') ? 'right' : 'above';
}

function clampTo(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function icon(name: IconName, parent: HTMLElement, extra = ''): HTMLSpanElement {
  const s = el('span', extra ? `th-ico ${extra}` : 'th-ico', parent);
  s.innerHTML = ICONS[name];
  return s;
}

function button(cls: string, testId: string, label: string, parent: HTMLElement): HTMLButtonElement {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.tabIndex = -1;
  b.dataset.testid = testId;
  b.setAttribute('aria-label', label);
  // A mouse press must not leave the button focused, or a later Space (fire) would "click" it too.
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

function paintFallbackIcon(canvas: HTMLCanvasElement, kind: UnitKind): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#14150f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(canvas.height * 0.62)}px sans-serif`;
  ctx.fillText(kind.charAt(0).toUpperCase(), canvas.width / 2, canvas.height * 0.56);
}

/** Text node that is rewritten only when its value changes. */
class TextCell {
  private last: string | number | null = null;
  constructor(private readonly node: HTMLElement) {}
  set(v: string | number): void {
    if (v === this.last) return;
    this.last = v;
    this.node.textContent = typeof v === 'number' ? String(v) : v;
  }
}

/** CSS class that is toggled only when its state changes. */
class FlagCell {
  private last: boolean | null = null;
  constructor(
    private readonly node: HTMLElement,
    private readonly cls: string,
  ) {}
  set(on: boolean): void {
    if (on === this.last) return;
    this.last = on;
    this.node.classList.toggle(this.cls, on);
  }
}

/** A 0..1 fraction exposed to CSS as --p, quantised so it is written at most STEPS times per fill. */
class FracCell {
  private last = -1;
  constructor(private readonly node: HTMLElement) {}
  set(fraction: number): number {
    const q = quant(fraction);
    if (q !== this.last) {
      this.last = q;
      this.node.style.setProperty('--p', FRAC[q]);
    }
    return q;
  }
}

/** Health bar: fill fraction plus a colour band. */
class BarCell {
  private readonly fill: FracCell;
  private lastLevel = -1;
  constructor(private readonly bar: HTMLElement) {
    this.fill = new FracCell(el('i', 'th-bar-fill', bar));
  }
  set(hp: number, maxHp: number): void {
    const level = hpLevel(this.fill.set(maxHp > 0 ? hp / maxHp : 0));
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.bar.dataset.lvl = LEVEL[level];
    }
  }
}

class TrainView {
  readonly node: HTMLButtonElement;
  readonly canvas: HTMLCanvasElement;
  readonly kind: UnitKind;
  affordable = false;
  private readonly name: TextCell;
  private readonly cost: TextCell;
  private readonly pop: TextCell;
  private readonly queuedText: TextCell;
  private readonly fieldedText: TextCell;
  private readonly sweep: FracCell;
  private readonly training: FlagCell;
  private readonly queued: FlagCell;
  private readonly fielded: FlagCell;
  private readonly short: FlagCell;
  private readonly ownBadge: HTMLElement;
  private readonly hasOwn: FlagCell;
  /** This kind's own order as last shown (null = it follows the army). */
  ownOrder: Order | null = null;
  fullName = '';
  private rawName = '';

  constructor(parent: HTMLElement, kind: UnitKind) {
    this.kind = kind;
    const b = button('th-hbtn th-tbtn', `train-${kind}`, kind, parent);
    this.node = b;
    const win = el('span', 'th-tbtn-win', b);
    this.canvas = el('canvas', 'th-tbtn-ico', win);
    this.sweep = new FracCell(el('span', 'th-tbtn-sweep', win));
    this.queuedText = new TextCell(el('span', 'th-badge th-tbtn-q', win));
    this.fieldedText = new TextCell(el('span', 'th-badge th-tbtn-n', win));
    // Who is on special orders: a tiny order glyph in the portrait's lower corner.
    this.ownBadge = el('span', 'th-tbtn-o', win);
    this.hasOwn = new FlagCell(b, 'has-order');
    this.name = new TextCell(el('span', 'th-tbtn-name', b));
    const price = el('span', 'th-tbtn-price', b);
    const cost = el('span', 'th-tbtn-cost', price);
    icon('money', cost);
    this.cost = new TextCell(el('span', '', cost));
    const pop = el('span', 'th-tbtn-pop', price);
    icon('helmet', pop);
    this.pop = new TextCell(el('span', '', pop));
    this.training = new FlagCell(b, 'is-training');
    this.queued = new FlagCell(b, 'is-queued');
    this.fielded = new FlagCell(b, 'has-fielded');
    this.short = new FlagCell(b, 'is-short');
    b.addEventListener('animationend', () => b.classList.remove('is-deny'));
  }

  apply(s: TrainButtonState): void {
    if (s.name !== this.rawName) {
      this.rawName = s.name;
      this.name.set(trainButtonName(s.label));
      this.node.setAttribute('aria-label', `Train ${s.name}`);
    }
    this.fullName = s.name;
    if (s.ownOrder !== this.ownOrder) {
      this.ownOrder = s.ownOrder;
      this.hasOwn.set(s.ownOrder !== null);
      this.ownBadge.innerHTML = s.ownOrder === null ? '' : ICONS[s.ownOrder];
      this.ownBadge.dataset.order = s.ownOrder ?? '';
    }
    this.cost.set(s.cost);
    this.pop.set(s.pop);
    this.queued.set(s.queued > 0);
    if (s.queued > 0) this.queuedText.set(s.queued);
    this.fielded.set(s.fielded > 0);
    if (s.fielded > 0) this.fieldedText.set(s.fielded);
    const training = s.queued > 0 && s.progress > 0;
    this.training.set(training);
    if (training) this.sweep.set(s.progress);
    this.affordable = s.affordable;
    this.short.set(!s.affordable);
  }
}

/** One unit kind in the order scope picker: its portrait and name (the short button label where the name is too long). */
class PickView {
  readonly node: HTMLButtonElement;
  readonly canvas: HTMLCanvasElement;
  readonly kind: UnitKind;
  readonly name: string;

  constructor(parent: HTMLElement, kind: UnitKind, name: string, label: string) {
    this.kind = kind;
    this.name = name;
    const b = button('th-hbtn th-pick', `scope-${kind}`, `Orders for ${name}`, parent);
    this.node = b;
    const win = el('span', 'th-pick-win', b);
    this.canvas = el('canvas', 'th-pick-ico', win);
    el('span', 'th-pick-name', b, label);
  }
}

/** What a grounded call-in button shows in place of its clock (FOUNDATIONS.md 4.7). */
const GROUNDED_LABEL: Record<NonNullable<SupportButtonState['grounded']>, string> = { fog: 'Fog', blizzard: 'Storm', night: 'Night' };

/** "x3" for the charges left on a call-in button, made once (the HUD must not allocate per frame); "" when not limited. */
const CHARGE_TEXT: readonly string[] = Array.from({ length: 100 }, (_, n) => `×${n}`);
function chargeText(n: number): string {
  return n < 0 ? '' : CHARGE_TEXT[Math.min(n, CHARGE_TEXT.length - 1)];
}

/** One call-in: its button in the call-ins column, and its mini pip on the folded "Call-ins" toggle. */
class SupportView {
  readonly node: HTMLButtonElement;
  readonly pip: HTMLElement;
  readonly kind: SupportKind;
  ready = false;
  private readonly name: TextCell;
  private readonly seconds: TextCell;
  private readonly sweep: FracCell;
  private readonly readyFlag: FlagCell;
  private readonly active: FlagCell;
  private readonly pipSweep: FracCell;
  private readonly pipReady: FlagCell;
  private readonly pipActive: FlagCell;
  private readonly groundedFlag: FlagCell;
  /** The charges left ("x3"; empty when not limited), and the button's look when none are left. */
  private readonly count: TextCell;
  private readonly outFlag: FlagCell;
  private rawName = '';
  private rawGrounded: SupportButtonState['grounded'] = null;

  constructor(parent: HTMLElement, pipParent: HTMLElement, kind: SupportKind) {
    this.kind = kind;
    const b = button('th-hbtn th-sbtn', `support-${kind}`, kind, parent);
    this.node = b;
    this.sweep = new FracCell(el('span', 'th-sweep', b));
    icon(SUPPORT_ICON[kind], b);
    this.name = new TextCell(el('span', 'th-sbtn-name', b));
    this.seconds = new TextCell(el('span', 'th-sbtn-sec', b));
    const count = el('span', 'th-sbtn-count', b);
    count.dataset.testid = `support-count-${kind}`;
    this.count = new TextCell(count);
    this.outFlag = new FlagCell(b, 'is-out');
    this.readyFlag = new FlagCell(b, 'is-ready');
    this.active = new FlagCell(b, 'is-active');
    this.groundedFlag = new FlagCell(b, 'is-grounded');
    b.addEventListener('animationend', () => b.classList.remove('is-deny'));
    const pip = el('span', 'th-pip', pipParent);
    pip.dataset.kind = kind;
    this.pip = pip;
    this.pipSweep = new FracCell(el('span', 'th-sweep', pip));
    icon(SUPPORT_ICON[kind], pip);
    this.pipReady = new FlagCell(pip, 'is-ready');
    this.pipActive = new FlagCell(pip, 'is-active');
  }

  apply(s: SupportButtonState, targeting: SupportKind | null): void {
    if (s.name !== this.rawName || s.grounded !== this.rawGrounded) {
      this.rawName = s.name;
      this.rawGrounded = s.grounded;
      this.name.set(shortName(s.name, NAME_CHARS - 1));
      this.node.setAttribute('aria-label', s.grounded === null ? s.name : `${s.name}: grounded (${GROUNDED_LABEL[s.grounded].toLowerCase()})`);
    }
    // Aircraft grounded by fog, a blizzard or the night: not ready, and the button says why. No charges left: "Out".
    const out = s.charges === 0;
    this.ready = s.charge >= 1 && s.grounded === null && !out;
    this.readyFlag.set(this.ready);
    this.pipReady.set(this.ready);
    this.groundedFlag.set(s.grounded !== null);
    this.outFlag.set(out);
    this.count.set(chargeText(s.charges));
    if (!this.ready) {
      this.sweep.set(s.grounded !== null || out ? 0 : s.charge);
      this.pipSweep.set(s.grounded !== null || out ? 0 : s.charge);
      this.seconds.set(out ? 'Out' : s.grounded !== null ? GROUNDED_LABEL[s.grounded] : clockSeconds(s.secondsLeft));
    }
    this.active.set(targeting === s.kind);
    this.pipActive.set(targeting === s.kind);
  }
}

class HudView implements Hud {
  private readonly app: AppApi;
  private readonly paint: PaintUnitIcon;
  private readonly root: HTMLDivElement;
  private state: HudState | null = null;
  private visible = true;
  /** The last tap that ended on a menu screen (the HUD was hidden), and where the latest finger went down: see HUD_ARM_MS. */
  private menuTap = { t: -Infinity, x: 0, y: 0 };
  private lastDown = { x: 0, y: 0 };
  private dpr = 1;
  private readonly observer: ResizeObserver | null;

  // Top bar.
  private readonly supplies: TextCell;
  private readonly income: HTMLElement;
  private lastIncome = Number.NaN;
  private readonly pop: TextCell;
  private readonly popCap: HTMLElement;
  private lastPopCap = -1;
  private readonly popFull: FlagCell;
  private readonly ownHq: BarCell;
  private readonly enemyHq: BarCell;
  private readonly enemyHidden: FlagCell;
  private readonly mapBlock: HTMLElement;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly minimap: MinimapView;
  private mapPid = -1;
  private mapLeft = 0;
  private mapWidth = 1;
  private mapFrac = -1;
  private mapFrame = 0;
  private lastCamX = Number.NaN;
  private lastCamW = Number.NaN;

  // Objective, banners, hint.
  private readonly objText: TextCell;
  private readonly objTime: HTMLElement;
  /** The mission director's phase line under the plate, and whether there is one. */
  private readonly phaseText: TextCell;
  private readonly hasPhase: FlagCell;
  /** The pause screen's side objectives (FOUNDATIONS.md 3.4). */
  private readonly pauseObjectives: HTMLElement;
  private lastClock = -1;
  private readonly hasTimer: FlagCell;
  private readonly urgent: FlagCell;
  private readonly targetName: TextCell;
  private lastTargeting: SupportKind | null = null;
  private readonly targetingFlag: FlagCell;
  private readonly banner: HTMLElement;
  private lastBanner: string | null = null;
  private lastBannerSeq = Number.NaN;
  private bannerAlt = false;
  private readonly hintText: TextCell;
  private readonly hintOn: FlagCell;
  private readonly prep: PrepPanel;
  private readonly objBox: HTMLElement;

  // Tutorial tip.
  private readonly tipBox: HTMLElement;
  private readonly tipText: HTMLElement;
  private readonly ordersBox: HTMLElement;
  private tipSeq = -1;
  private tipTarget: HTMLElement | null = null;
  private tipSide: TipSide = 'float';
  private tipAlt = false;
  private tipTick = 0;
  private tipX = Number.NaN;
  private tipY = Number.NaN;
  private tipArrow = Number.NaN;
  private tipArrowOn: boolean | null = null;

  // Bottom bar.
  private readonly trainWrap: HTMLElement;
  private readonly trainBar: HTMLElement;
  /**
   * The "Deploy at" button (FOUNDATIONS.md 4.5): in the training bar, at its left end, beside the unit buttons (owner,
   * 2026-11-09: it must not cover the battlefield); hidden unless the mission has spawn points.
   */
  private readonly deployButton: HTMLButtonElement;
  private readonly deployText: TextCell;
  private readonly deployClosed: FlagCell;
  private readonly deployFront: FlagCell;
  private readonly deployIn: FlagCell;
  private deployShown: boolean | null = null;
  private deployLabel = '';
  /** The "Clear" chip (FOUNDATIONS.md 4.6 and 4.8): a tab on the training bar's top edge. */
  private readonly clearButton: HTMLButtonElement;
  private readonly clearText: TextCell;
  private readonly clearBusy: FlagCell;
  private clearShown: boolean | null = null;
  private readonly trainViews: TrainView[] = [];
  private readonly supportViews: SupportView[] = [];
  // Call-ins: a "Call-ins" toggle with a mini pip per call-in, which opens the column of call-in buttons above it.
  private readonly callIns: HTMLElement;
  private readonly callInToggle: HTMLButtonElement;
  private readonly pipBox: HTMLElement;
  private readonly supportBox: HTMLElement;
  private readonly callInReady: FlagCell;
  private readonly fold = new CallInFold();
  private callInMax = -1;
  private readonly topBar: HTMLElement;
  private readonly cardBox: HTMLElement;
  private readonly orderButtons: HTMLButtonElement[] = [];
  private lastOrder: Order | null = null;
  private lastFollow = false;
  private orderDirty = true;

  // Order scope: the three order buttons command the whole army (scope null) or one unit kind.
  private scope: UnitKind | null = null;
  private readonly scopeButton: HTMLButtonElement;
  private readonly scopeCanvas: HTMLCanvasElement;
  private readonly scopeName: TextCell;
  private readonly scopeFlag: FlagCell;
  private readonly followButton: HTMLButtonElement;
  private readonly picker: HTMLElement;
  private readonly pickAll: HTMLButtonElement;
  private readonly pickViews: PickView[] = [];
  private pickerOpen = false;

  // Direct control.
  private readonly controlFlag: FlagCell;
  private controlOn = false;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private stickPid = -1;
  private stickCx = 0;
  private stickRadius = 1;
  private stickX = 0;
  private keyLeft = false;
  private keyRight = false;
  private sentX = 0;
  /** Reused for the per-frame repeat of the current stick value, so update() does not allocate. */
  private readonly stickRepeat: { type: 'stick'; x: number } = { type: 'stick', x: 0 };
  private fireButtonDown = false;
  private fireKeyDown = false;
  private sentFire = false;
  private readonly cardCanvas: HTMLCanvasElement;
  private cardKind: UnitKind | null = null;
  private readonly cardName: TextCell;
  private readonly cardHp: BarCell;
  private readonly cardHpHidden: FlagCell;
  private readonly fireSweep: FracCell;
  private readonly abilityButton: HTMLButtonElement;
  private readonly abilityHidden: FlagCell;
  private readonly abilityName: TextCell;
  private readonly abilitySweep: FracCell;
  private abilityReady = false;

  private readonly pausedFlag: FlagCell;
  private paused = false;

  // "Show FPS" readout.
  private readonly fpsText: TextCell;
  private readonly fpsOn: FlagCell;
  private fpsSeq = -1;
  private readonly mutedFlag: FlagCell;

  constructor(parent: HTMLElement, app: AppApi, opts: HudOptions) {
    this.app = app;
    this.paint = opts.paintUnitIcon ?? paintFallbackIcon;
    const root = el('div', 'th-hud', parent);
    this.root = root;
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // ----- Top bar -----
    const top = el('div', 'th-top', root);
    this.topBar = top;

    const supplies = el('div', 'th-res th-supplies', top);
    supplies.dataset.tip = 'supplies';
    icon('money', supplies);
    const supCol = el('div', 'th-res-col', supplies);
    this.supplies = new TextCell(el('span', 'th-supplies-num', supCol, '0'));
    this.income = el('span', 'th-supplies-inc', supCol);

    const pop = el('div', 'th-res th-pop', top);
    icon('helmet', pop);
    const popCol = el('div', 'th-res-col', pop);
    const popLine = el('div', 'th-pop-line', popCol);
    this.pop = new TextCell(el('span', 'th-pop-num', popLine, '0'));
    this.popCap = el('span', 'th-pop-cap', popLine);
    el('span', 'th-pop-label', popCol, 'Men');
    this.popFull = new FlagCell(pop, 'is-full');

    const map = el('div', 'th-hmap', top);
    map.dataset.testid = 'minimap';
    map.dataset.interactive = '';
    this.mapBlock = map;
    const hqRow = el('div', 'th-hqrow', map);
    const own = el('div', 'th-hq th-hq-own', hqRow);
    el('span', '', own, 'HQ');
    this.ownHq = new BarCell(el('span', 'th-hbar', own));
    const enemy = el('div', 'th-hq th-hq-enemy', hqRow);
    el('span', '', enemy, 'Enemy');
    this.enemyHq = new BarCell(el('span', 'th-hbar', enemy));
    this.enemyHidden = new FlagCell(enemy, 'is-hidden');
    this.mapCanvas = el('canvas', 'th-minimap', map);
    this.minimap = new MinimapView(this.mapCanvas);
    this.bindMinimap();

    const mute = button('th-ibtn', 'mute', 'Mute', top);
    const muteFace = el('span', 'th-ibtn-face', mute);
    icon('soundOn', muteFace, 'th-ico-on');
    icon('soundOff', muteFace, 'th-ico-off');
    onTap(mute, () => this.doMute());
    const pause = button('th-ibtn', 'pause', 'Pause', top);
    icon('pause', el('span', 'th-ibtn-face', pause));
    onTap(pause, () => this.doPause());

    // ----- Top centre -----
    const center = el('div', 'th-center', root);
    const obj = el('div', 'th-obj', center);
    this.objBox = obj;
    this.objText = new TextCell(el('span', 'th-obj-text', obj));
    this.objTime = el('span', 'th-obj-time', obj);
    this.hasTimer = new FlagCell(obj, 'has-timer');
    this.urgent = new FlagCell(obj, 'is-urgent');
    this.phaseText = new TextCell(el('div', 'th-obj-phase', center));
    this.hasPhase = new FlagCell(center, 'has-phase');

    const target = el('div', 'th-target', center);
    const targetText = el('div', 'th-target-text', target);
    this.targetName = new TextCell(el('span', 'th-target-name', targetText));
    el('span', 'th-target-tip', targetText, 'Tap the battlefield');
    const cancel = button('th-cancel', 'cancel-targeting', 'Cancel', target);
    icon('close', cancel);
    el('span', '', cancel, 'Cancel');
    onTap(cancel, () => this.doCancelTargeting());
    this.targetingFlag = new FlagCell(root, 'is-targeting');

    this.banner = el('div', 'th-banner', center);
    const hint = el('div', 'th-hint', center);
    this.hintText = new TextCell(hint);
    this.hintOn = new FlagCell(hint, 'is-on');

    // ----- Prep phase (defensive missions): countdown, Ready, builds -----
    this.prep = new PrepPanel(center, (action) => {
      if (!this.live()) return;
      this.app.uiSound('click');
      this.app.dispatch(action);
    });

    // ----- Left edge: call-ins, folded into one toggle until it is tapped -----
    const callIns = el('div', 'th-callins', root);
    callIns.hidden = true;
    this.callIns = callIns;
    const toggle = button('th-hbtn th-cbtn', 'callins', 'Call-ins', callIns);
    toggle.setAttribute('aria-expanded', 'false');
    const head = el('span', 'th-cbtn-head', toggle);
    el('span', 'th-cbtn-label', head, 'Call-ins');
    icon('chevRight', head, 'th-cbtn-chev');
    this.pipBox = el('span', 'th-pips', toggle);
    this.callInToggle = toggle;
    this.callInReady = new FlagCell(toggle, 'has-ready');
    onTap(toggle, () => this.doCallIns());
    const supportBox = el('div', 'th-supports', callIns);
    supportBox.dataset.testid = 'callins-column';
    supportBox.hidden = true;
    this.supportBox = supportBox;

    // ----- Right edge: direct-control buttons -----
    const fireRow = el('div', 'th-firerow', root);
    const release = button('th-hbtn th-fbtn th-release', 'release', 'Release unit', fireRow);
    icon('close', release);
    el('span', 'th-fbtn-label', release, 'Release');
    onTap(release, () => this.doRelease());
    const ability = button('th-hbtn th-fbtn th-ability', 'ability', 'Ability', fireRow);
    this.abilitySweep = new FracCell(el('span', 'th-sweep', ability));
    icon('ability', ability);
    this.abilityName = new TextCell(el('span', 'th-fbtn-label', ability));
    this.abilityHidden = new FlagCell(ability, 'is-hidden');
    this.abilityButton = ability;
    ability.addEventListener('animationend', () => ability.classList.remove('is-deny'));
    onPress(ability, () => this.doAbility());
    const fire = button('th-hbtn th-fbtn th-fire', 'fire', 'Fire', fireRow);
    this.fireSweep = new FracCell(el('span', 'th-sweep', fire));
    icon('fire', fire);
    el('span', 'th-fbtn-label', fire, 'Fire');
    onPress(
      fire,
      () => {
        this.fireButtonDown = true;
        this.syncFire();
      },
      () => {
        this.fireButtonDown = false;
        this.syncFire();
      },
    );

    // ----- Bottom bar -----
    const bottom = el('div', 'th-bottom', root);
    const stick = el('div', 'th-hplate th-stick', bottom);
    stick.dataset.testid = 'stick';
    stick.dataset.interactive = '';
    icon('chevLeft', stick, 'th-stick-arrow th-stick-arrow-l');
    icon('chevRight', stick, 'th-stick-arrow th-stick-arrow-r');
    this.knob = el('div', 'th-stick-knob', stick);
    this.stick = stick;
    this.bindStick();

    const card = el('div', 'th-hplate th-ctrl-card', root);
    this.cardBox = card;
    this.cardCanvas = el('canvas', 'th-card-ico', card);
    const cardCol = el('div', 'th-card-col', card);
    this.cardName = new TextCell(el('span', 'th-card-name', cardCol));
    const cardBar = el('span', 'th-hbar', cardCol);
    this.cardHp = new BarCell(cardBar);
    this.cardHpHidden = new FlagCell(cardBar, 'is-hidden');
    this.controlFlag = new FlagCell(root, 'is-control');

    const trainWrap = el('div', 'th-hplate th-trainwrap', bottom);
    this.trainWrap = trainWrap;
    // "Deploy at": the bar's first button, outside its scrolling part; each tap steps to the next spawn point (the
    // front, the HQ...). A caption, the place (two short lines at most) and a "front" mark when it follows the front.
    const deploy = button('th-hbtn th-deploy', 'deploy-at', 'Deploy at', trainWrap);
    deploy.hidden = true;
    el('span', 'th-deploy-cap', deploy, 'Deploy');
    this.deployText = new TextCell(el('span', 'th-deploy-text', deploy));
    el('span', 'th-deploy-front', deploy, 'Front');
    this.deployClosed = new FlagCell(deploy, 'is-closed');
    this.deployFront = new FlagCell(deploy, 'is-front');
    this.deployIn = new FlagCell(trainWrap, 'has-deploy');
    this.deployButton = deploy;
    onTap(deploy, () => this.app.dispatch({ type: 'deploy' }));
    const trainBar = el('div', 'th-train', trainWrap);
    trainBar.dataset.interactive = '';
    this.trainBar = trainBar;
    // "Clear": a sapper goes to clear the enemy minefield or obstacle in view.
    const clear = button('th-hbtn th-clear', 'clear-job', 'Send a sapper to clear it', trainWrap);
    clear.hidden = true;
    this.clearText = new TextCell(el('span', 'th-deploy-text', clear));
    this.clearBusy = new FlagCell(clear, 'is-busy');
    this.clearButton = clear;
    onTap(clear, () => this.app.dispatch({ type: 'clear' }));
    icon('chevLeft', el('span', 'th-more th-more-l', trainWrap));
    icon('chevRight', el('span', 'th-more th-more-r', trainWrap));
    trainBar.addEventListener('scroll', this.onTrainScroll, { passive: true });
    trainBar.addEventListener(
      'wheel',
      (e) => {
        trainBar.scrollLeft += e.deltaX + e.deltaY;
        e.preventDefault();
      },
      { passive: false },
    );

    const orders = el('div', 'th-hplate th-horders', bottom);
    this.ordersBox = orders;
    // "Orders for": who the three order buttons speak to. Tapping it opens the picker of unit kinds.
    const scopeButton = button('th-hbtn th-scope', 'order-scope', 'Orders for all units', orders);
    this.scopeButton = scopeButton;
    el('span', 'th-scope-cap', scopeButton, 'Orders for');
    const scopeWin = el('span', 'th-scope-win', scopeButton);
    icon('army', scopeWin, 'th-scope-all');
    this.scopeCanvas = el('canvas', 'th-scope-ico', scopeWin);
    this.scopeName = new TextCell(el('span', 'th-scope-name', scopeButton));
    this.scopeName.set('All');
    this.scopeFlag = new FlagCell(orders, 'is-scoped');
    onTap(scopeButton, () => this.doScopeButton());
    for (let i = 0; i < ORDERS.length; i++) {
      const order = ORDERS[i];
      const b = button('th-hbtn th-obtn', `order-${order}`, ORDER_LABEL[order], orders);
      icon(order, b);
      el('span', '', b, ORDER_LABEL[order]);
      onPress(b, () => this.doOrder(order));
      this.orderButtons.push(b);
    }
    const follow = button('th-hbtn th-obtn th-follow', 'order-follow', 'Follow army', orders);
    icon('follow', follow);
    el('span', 'th-follow-text', follow, 'Follow army');
    onPress(follow, () => this.doFollow());
    follow.hidden = true;
    this.followButton = follow;

    // ----- Order scope picker: "All units" and every kind this mission allows -----
    const picker = el('div', 'th-hplate th-picker', root);
    picker.dataset.testid = 'scope-picker';
    picker.dataset.interactive = '';
    picker.hidden = true;
    this.picker = picker;
    el('div', 'th-picker-title', picker, 'Orders for');
    const pickAll = button('th-hbtn th-pick', 'scope-all', 'All units', picker);
    const allWin = el('span', 'th-pick-win', pickAll);
    icon('army', allWin);
    el('span', 'th-pick-name', pickAll, 'All units');
    onTap(pickAll, () => this.doPick(null));
    this.pickAll = pickAll;

    // ----- Tutorial tip: a bubble beside the control it explains, which pulses while the tip is up -----
    const tip = el('div', 'th-tip', root);
    tip.dataset.testid = 'tip';
    this.tipBox = tip;
    this.tipText = el('span', 'th-tip-text', tip);
    const tipClose = button('th-tip-x', 'tip-dismiss', 'Close hint', tip);
    icon('close', tipClose);
    onTap(tipClose, () => this.doDismissTip());
    el('i', 'th-tip-arrow', tip);

    // ----- Pause overlay -----
    const overlay = el('div', 'th-pause', root);
    const panel = el('div', 'th-pause-panel', overlay);
    el('div', 'th-pause-title', panel, 'Paused');
    this.pauseObjectives = el('div', 'th-pause-objectives', panel);
    const pauseMute = button('th-hbtn th-pbtn th-pbtn-quiet', 'pause-mute', 'Sound', panel);
    icon('soundOn', pauseMute, 'th-ico-on');
    icon('soundOff', pauseMute, 'th-ico-off');
    el('span', 'th-ico-on', pauseMute, 'Sound on');
    el('span', 'th-ico-off', pauseMute, 'Sound off');
    onTap(pauseMute, () => this.doMute());
    const resume = button('th-hbtn th-pbtn th-pbtn-wide', 'resume', 'Resume', panel);
    icon('play', resume);
    el('span', '', resume, 'Resume');
    onTap(resume, () => this.doOverlay('resume'));
    const restart = button('th-hbtn th-pbtn', 'restart', 'Restart', panel);
    icon('restart', restart);
    el('span', '', restart, 'Restart');
    onTap(restart, () => this.doOverlay('restart'));
    const quit = button('th-hbtn th-pbtn', 'quit', 'Quit to map', panel);
    icon('quit', quit);
    el('span', '', quit, 'Quit to map');
    onTap(quit, () => this.doOverlay('quit'));
    this.pausedFlag = new FlagCell(root, 'is-paused');
    this.mutedFlag = new FlagCell(root, 'is-muted');

    // The frame-rate readout: under the top bar on the right, clear of the buttons; it never takes a touch.
    this.fpsText = new TextCell(el('div', 'th-fps', root));
    this.fpsOn = new FlagCell(root, 'has-fps');

    document.addEventListener('pointerdown', this.onAnyDown, true);
    document.addEventListener('pointerup', this.onAnyUp, true);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.onLayout);
      this.observer.observe(root);
    } else {
      this.observer = null;
      window.addEventListener('resize', this.onLayout);
    }
    this.onLayout();
  }

  // ------------------------------------------------------------------ per-frame update

  update(s: HudState): void {
    this.state = s;
    if (!this.visible) return;

    this.prep.update(s.prep);
    this.supplies.set(Math.floor(s.supplies));
    const income = incomeTenths(s.incomePerSec);
    if (income !== this.lastIncome) {
      this.lastIncome = income;
      this.income.textContent = formatIncome(income);
    }
    this.pop.set(s.pop);
    if (s.popCap !== this.lastPopCap) {
      this.lastPopCap = s.popCap;
      this.popCap.textContent = `/${s.popCap}`;
    }
    this.popFull.set(s.pop >= s.popCap);

    const timer = s.timer;
    this.hasTimer.set(timer !== null);
    if (timer !== null) {
      this.objText.set(timer.label);
      const clock = clockSeconds(timer.secondsLeft);
      if (clock !== this.lastClock) {
        this.lastClock = clock;
        this.objTime.textContent = formatClock(clock);
      }
      this.urgent.set(timer.urgent);
    } else {
      this.objText.set(s.objective);
      this.urgent.set(false);
    }
    const phaseLine = s.phaseLine ?? null;
    this.hasPhase.set(phaseLine !== null);
    if (phaseLine !== null) this.phaseText.set(phaseLine);

    this.ownHq.set(s.hqHp, s.hqMaxHp);
    const enemyHp = s.enemyHqHp;
    this.enemyHidden.set(enemyHp === null);
    if (enemyHp !== null) this.enemyHq.set(enemyHp, s.enemyHqMaxHp);

    const train = s.train;
    if (!this.trainMatches(train)) this.rebuildTrain(train);
    for (let i = 0; i < train.length; i++) this.trainViews[i].apply(train[i]);
    const deploy = s.deploy ?? null;
    const showDeploy = deploy !== null && train.length > 0;
    if (showDeploy !== this.deployShown) {
      this.deployShown = showDeploy;
      this.deployButton.hidden = !showDeploy;
      this.deployIn.set(showDeploy);
    }
    if (deploy !== null && showDeploy) {
      this.deployText.set(deploy.place);
      this.deployClosed.set(deploy.closed);
      this.deployFront.set(deploy.front);
      if (deploy.label !== this.deployLabel) {
        this.deployLabel = deploy.label;
        this.deployButton.setAttribute('aria-label', deploy.label);
        this.deployButton.style.setProperty('--dep-fit', String(deployPlaceFit(deploy.place)));
      }
    }
    const clear = s.clear ?? null;
    const showClear = clear !== null && train.length > 0;
    if (showClear !== this.clearShown) {
      this.clearShown = showClear;
      this.clearButton.hidden = !showClear;
    }
    if (clear !== null && showClear) {
      this.clearText.set(clear.label);
      this.clearBusy.set(clear.busy);
    }

    // Army scope lights the army order. A kind scope lights the order that kind obeys: its own, or the
    // army's together with Follow army while it has none.
    let own: Order | null = null;
    if (this.scope !== null) {
      for (let i = 0; i < train.length; i++) if (train[i].kind === this.scope) own = train[i].ownOrder;
    }
    const lit: Order = own ?? s.order;
    const follow = this.scope !== null && own === null;
    if (this.orderDirty || lit !== this.lastOrder || follow !== this.lastFollow) {
      this.orderDirty = false;
      this.lastOrder = lit;
      this.lastFollow = follow;
      for (let i = 0; i < ORDERS.length; i++) {
        this.orderButtons[i].classList.toggle('is-active', ORDERS[i] === lit);
      }
      this.followButton.classList.toggle('is-active', follow);
    }
    if (s.paused && this.pickerOpen) this.closePicker();

    const supports = s.supports;
    if (!this.supportsMatch(supports)) this.rebuildSupports(supports);
    let anyReady = false;
    for (let i = 0; i < supports.length; i++) {
      const view = this.supportViews[i];
      view.apply(supports[i], s.targeting);
      if (view.ready) anyReady = true;
    }
    this.callInReady.set(anyReady);
    // The call went out (the aim ended with a tap on the battlefield): fold the column away.
    if (this.fold.track(s.targeting, s.paused)) this.showFold();

    if (s.targeting !== this.lastTargeting) {
      this.lastTargeting = s.targeting;
      this.targetingFlag.set(s.targeting !== null);
      for (let i = 0; i < supports.length; i++) {
        if (supports[i].kind === s.targeting) this.targetName.set(supports[i].name);
      }
    }

    const control = s.control;
    if ((control !== null) !== this.controlOn) {
      this.controlOn = control !== null;
      this.controlFlag.set(this.controlOn);
      if (!this.controlOn) this.releaseInputs();
      this.onLayout();
    }
    if (control !== null) this.applyControl(control);

    const fps = s.fps;
    this.fpsOn.set(fps !== null);
    if (fps !== null && fps.seq !== this.fpsSeq) {
      this.fpsSeq = fps.seq;
      this.fpsText.set(formatFps(fps.fps, fps.avgMs, fps.worstMs));
    }

    if (s.paused !== this.paused) {
      this.paused = s.paused;
      this.pausedFlag.set(s.paused);
      if (s.paused) {
        this.releaseInputs();
        this.showPauseObjectives(s.sideObjectives ?? []);
      }
    }
    this.mutedFlag.set(s.muted);

    const banner = s.banner;
    const bannerAppeared = banner !== null && this.lastBanner === null;
    if (banner !== this.lastBanner) {
      this.lastBanner = banner;
      if (banner !== null) this.banner.textContent = banner;
      else this.banner.className = 'th-banner';
    }
    if (s.bannerSeq !== this.lastBannerSeq || bannerAppeared) {
      this.lastBannerSeq = s.bannerSeq;
      if (banner !== null) {
        this.bannerAlt = !this.bannerAlt;
        this.banner.className = this.bannerAlt ? BANNER_CLASS_A : BANNER_CLASS_B;
      }
    }

    const hint = s.hint;
    this.hintOn.set(hint !== null);
    if (hint !== null) this.hintText.set(hint);

    const tip = s.tip;
    if (tip === null) {
      if (this.tipSeq !== -1) this.hideTip();
    } else if (tip.seq !== this.tipSeq) {
      this.showTip(tip);
    } else if (++this.tipTick % TIP_EVERY === 0) {
      this.placeTip();
    }

    const map = s.minimap;
    const camMoved = map.camX !== this.lastCamX || map.camW !== this.lastCamW;
    if (camMoved || this.mapFrame === 0) {
      this.lastCamX = map.camX;
      this.lastCamW = map.camW;
      this.minimap.draw(map);
    }
    this.mapFrame = (this.mapFrame + 1) % MINIMAP_EVERY;

    // A held stick or key keeps reporting, so the app may treat stick actions as a stream.
    if (this.controlOn && this.sentX !== 0 && !s.paused) {
      this.stickRepeat.x = this.sentX;
      this.app.dispatch(this.stickRepeat);
    }
  }

  private applyControl(c: ControlState): void {
    this.cardName.set(c.name);
    if (c.kind !== this.cardKind) {
      this.cardKind = c.kind;
      this.paintIcon(this.cardCanvas, c.kind);
    }
    this.cardHpHidden.set(!c.hpShown);
    if (c.hpShown) this.cardHp.set(c.hp, c.maxHp);
    this.fireSweep.set(c.reload);
    this.abilityHidden.set(!c.hasAbility);
    if (c.hasAbility) {
      this.abilityName.set(c.abilityName);
      this.abilitySweep.set(c.abilityCharge);
      this.abilityReady = c.abilityCharge >= 1;
    }
  }

  private trainMatches(list: TrainButtonState[]): boolean {
    if (list.length !== this.trainViews.length) return false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].kind !== this.trainViews[i].kind) return false;
    }
    return true;
  }

  private rebuildTrain(list: TrainButtonState[]): void {
    this.trainBar.textContent = '';
    this.trainViews.length = 0;
    for (let i = 0; i < list.length; i++) {
      const view = new TrainView(this.trainBar, list[i].kind);
      onTap(view.node, () => this.doTrain(view));
      this.trainViews.push(view);
    }
    this.trainWrap.hidden = list.length === 0;
    this.rebuildPicker(list);
    this.onLayout();
  }

  // ------------------------------------------------------------------ order scope

  private rebuildPicker(list: TrainButtonState[]): void {
    for (let i = 0; i < this.pickViews.length; i++) this.pickViews[i].node.remove();
    this.pickViews.length = 0;
    let keep = false;
    for (let i = 0; i < list.length; i++) {
      const view = new PickView(this.picker, list[i].kind, list[i].name, list[i].label);
      onTap(view.node, () => this.doPick(view.kind));
      this.pickViews.push(view);
      if (list[i].kind === this.scope) keep = true;
    }
    this.scopeButton.hidden = list.length === 0;
    if (!keep) this.setScope(null);
    else this.setScope(this.scope);
  }

  /** Point the three order buttons at the whole army (null) or at one unit kind. */
  private setScope(kind: UnitKind | null): void {
    this.scope = kind;
    this.orderDirty = true;
    let name = 'All units';
    for (let i = 0; i < this.trainViews.length; i++) if (this.trainViews[i].kind === kind) name = this.trainViews[i].fullName;
    for (let i = 0; i < this.pickViews.length; i++) {
      const v = this.pickViews[i];
      if (v.kind === kind) name = v.name;
      v.node.classList.toggle('is-active', v.kind === kind);
    }
    this.pickAll.classList.toggle('is-active', kind === null);
    this.scopeName.set(kind === null ? 'All' : shortName(name, NAME_CHARS));
    this.scopeButton.setAttribute('aria-label', `Orders for ${kind === null ? 'all units' : name}`);
    this.scopeFlag.set(kind !== null);
    this.followButton.hidden = kind === null;
    if (kind !== null) {
      // Repaint on the next layout pass too: the canvas has no size until the chip shows it.
      this.scopeCanvas.dataset.kind = '';
      this.paintIcon(this.scopeCanvas, kind);
    }
    this.onLayout();
  }

  /** Open the "Orders for" picker. One pop-up at a time: the call-ins fold and step aside so the picker has the width. */
  private openPicker(): void {
    this.pickerOpen = true;
    if (this.fold.open) {
      this.fold.toggle();
      this.showFold();
    }
    this.callIns.classList.add('is-away');
    this.picker.hidden = false;
    this.scopeButton.classList.add('is-open');
    for (let i = 0; i < this.pickViews.length; i++) this.paintIcon(this.pickViews[i].canvas, this.pickViews[i].kind);
  }

  private closePicker(): void {
    if (!this.pickerOpen) return;
    this.pickerOpen = false;
    this.picker.hidden = true;
    this.callIns.classList.remove('is-away');
    this.scopeButton.classList.remove('is-open');
  }

  private doScopeButton(): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    if (this.pickerOpen) this.closePicker();
    else this.openPicker();
  }

  private doPick(kind: UnitKind | null): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    this.setScope(kind);
    this.closePicker();
  }

  /** Keyboard: All, then each kind in training-bar order, then All again. */
  private cycleScope(): void {
    const views = this.trainViews;
    let next: UnitKind | null = views.length > 0 ? views[0].kind : null;
    for (let i = 0; i < views.length; i++) {
      if (views[i].kind === this.scope) next = i + 1 < views.length ? views[i + 1].kind : null;
    }
    this.app.uiSound('click');
    this.setScope(next);
  }

  private doFollow(): void {
    if (!this.live() || this.scope === null) return;
    this.app.uiSound('click');
    this.app.dispatch({ type: 'followArmy', kind: this.scope });
  }

  private supportsMatch(list: SupportButtonState[]): boolean {
    if (list.length !== this.supportViews.length) return false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].kind !== this.supportViews[i].kind) return false;
    }
    return true;
  }

  private rebuildSupports(list: SupportButtonState[]): void {
    this.supportBox.textContent = '';
    this.pipBox.textContent = '';
    this.supportViews.length = 0;
    for (let i = 0; i < list.length; i++) {
      const view = new SupportView(this.supportBox, this.pipBox, list[i].kind);
      onTap(view.node, () => this.doSupport(view));
      this.supportViews.push(view);
    }
    this.pipBox.dataset.n = String(list.length);
    this.callIns.hidden = list.length === 0;
    this.callInMax = -1;
    if (list.length === 0) this.fold.reset();
    this.showFold();
  }

  // ------------------------------------------------------------------ call-ins column

  /** Show the column open or folded, as the fold says, and move a tip that points at a call-in to what is now shown. */
  private showFold(): void {
    const open = this.fold.open;
    this.supportBox.hidden = !open;
    this.callInToggle.classList.toggle('is-open', open);
    this.callInToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) this.layoutCallIns();
    if (this.tipSeq !== -1 && this.state !== null && this.state.tip !== null) {
      this.retargetTip(this.state.tip.target);
      this.placeTip();
    }
  }

  /**
   * Spread the open column's buttons over as few columns as fit between the top bar (or the unit card while
   * controlling) and the toggle, balanced so six read 3 + 3. Runs on open and on layout changes, not per frame.
   */
  private layoutCallIns(): void {
    const box = this.supportBox;
    const first = this.supportViews.length > 0 ? this.supportViews[0].node : null;
    if (!this.fold.open || first === null) return;
    const size = first.offsetHeight;
    if (size <= 0) return;
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    const ceiling = this.controlOn ? this.cardBox.getBoundingClientRect().bottom : this.topBar.getBoundingClientRect().bottom;
    const room = this.callInToggle.getBoundingClientRect().top - gap * 2 - ceiling;
    const rows = callInRows(this.supportViews.length, size, gap, room);
    const max = Math.ceil(rows * size + (rows - 1) * gap);
    if (max !== this.callInMax) {
      this.callInMax = max;
      box.style.maxHeight = `${max}px`;
    }
  }

  private doCallIns(): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    this.fold.toggle();
    this.showFold();
  }

  // ------------------------------------------------------------------ layout

  private readonly onLayout = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDevicePixelRatio);
    const mw = this.mapCanvas.clientWidth;
    const mh = this.mapCanvas.clientHeight;
    if (mw > 0 && mh > 0 && this.minimap.resize(mw, mh, this.dpr)) {
      this.mapFrame = 0;
      if (this.state) this.minimap.draw(this.state.minimap);
    }
    for (let i = 0; i < this.trainViews.length; i++) {
      const v = this.trainViews[i];
      this.paintIcon(v.canvas, v.kind);
    }
    if (this.cardKind !== null) this.paintIcon(this.cardCanvas, this.cardKind);
    if (this.scope !== null) this.paintIcon(this.scopeCanvas, this.scope);
    if (this.pickerOpen) {
      for (let i = 0; i < this.pickViews.length; i++) this.paintIcon(this.pickViews[i].canvas, this.pickViews[i].kind);
    }
    this.onTrainScroll();
    this.layoutCallIns();
    if (this.tipSeq !== -1) this.placeTip();
  };

  // ------------------------------------------------------------------ tutorial tip

  private tipElement(target: TipTarget): HTMLElement | null {
    if (target === 'field') return null;
    const selector = target === 'supplies' ? '[data-tip="supplies"]' : `[data-testid="${target}"]`;
    const node = this.root.querySelector<HTMLElement>(selector);
    // A call-in in the folded column: point at the toggle that opens it.
    if (node !== null && !this.fold.open && this.supportBox.contains(node)) return this.callInToggle;
    return node;
  }

  /** Light the control a tip explains (and scroll the training bar to it). */
  private retargetTip(target: TipTarget): void {
    this.clearTipTarget();
    const node = this.tipElement(target);
    this.tipTarget = node;
    if (node !== null) {
      node.classList.add('th-glow');
      if (this.trainBar.contains(node)) this.scrollTrainTo(node);
    }
  }

  private showTip(tip: TipState): void {
    this.tipSeq = tip.seq;
    this.tipText.textContent = tip.text;
    this.tipSide = tipSideOf(tip.target);
    this.retargetTip(tip.target);
    // Two identical animations: swapping between them replays the pop-in for the next tip.
    this.tipAlt = !this.tipAlt;
    this.tipBox.className = this.tipAlt ? 'th-tip show-a' : 'th-tip show-b';
    this.tipBox.dataset.side = this.tipSide;
    this.tipX = Number.NaN;
    this.tipY = Number.NaN;
    this.tipArrow = Number.NaN;
    this.tipArrowOn = null;
    this.tipBox.style.maxWidth = '';
    this.placeTip();
  }

  private hideTip(): void {
    this.clearTipTarget();
    this.tipSeq = -1;
    this.tipBox.className = 'th-tip';
    // A finished tip leaves nothing behind: the hidden bubble must not keep its words (screen readers, page text).
    this.tipText.textContent = '';
  }

  private clearTipTarget(): void {
    if (this.tipTarget !== null) this.tipTarget.classList.remove('th-glow');
    this.tipTarget = null;
  }

  /** Scroll the training bar just far enough that the highlighted button is fully in view. */
  private scrollTrainTo(button: HTMLElement): void {
    const bar = this.trainBar;
    const b = button.getBoundingClientRect();
    const r = bar.getBoundingClientRect();
    if (b.left < r.left) bar.scrollLeft -= r.left - b.left + 4;
    else if (b.right > r.right) bar.scrollLeft += b.right - r.right + 4;
  }

  /** Put the bubble beside its control, inside the screen, with its arrow on the control. */
  private placeTip(): void {
    const box = this.tipBox;
    let bw = box.offsetWidth;
    let bh = box.offsetHeight;
    if (bw === 0 || bh === 0) return;
    const root = this.root.getBoundingClientRect();
    const t = this.tipTarget !== null ? this.tipTarget.getBoundingClientRect() : null;
    let x = (root.width - bw) / 2;
    let y: number;
    let arrow = 0;
    let arrowOn = t !== null;
    if (t === null || this.tipSide === 'float') {
      // No control to point at: float above the bottom bar, in the middle.
      y = this.ordersBox.getBoundingClientRect().top - root.top - bh - TIP_GAP;
      arrowOn = false;
    } else if (this.tipSide === 'right') {
      // Beside the whole call-ins column, so a bubble for a button in its first column does not cover the second.
      let right = t.right;
      if (this.tipTarget !== null && this.supportBox.contains(this.tipTarget)) {
        for (let i = 0; i < this.supportViews.length; i++) right = Math.max(right, this.supportViews[i].node.getBoundingClientRect().right);
      }
      x = right - root.left + TIP_GAP;
      y = t.top + t.height / 2 - root.top - bh / 2;
      arrow = clampTo(t.top + t.height / 2 - root.top - y, TIP_ARROW_INSET, bh - TIP_ARROW_INSET);
    } else {
      const centre = t.left + t.width / 2 - root.left;
      if (this.tipSide === 'above') {
        y = t.top - root.top - bh - TIP_GAP;
      } else {
        y = t.bottom - root.top + TIP_GAP / 2;
        // The objective plate hangs under the middle of the top bar. A bubble that would cover it is narrowed to the
        // space beside it if there is enough, and otherwise set below it, away from its control (no arrow then).
        const o = this.objBox.getBoundingClientRect();
        const left = clampTo(centre - bw / 2, TIP_MARGIN, Math.max(TIP_MARGIN, root.width - TIP_MARGIN - bw));
        if (o.right > root.left + left && o.left < root.left + left + bw && o.bottom - root.top + 2 > y) {
          const room = o.left - root.left - TIP_GAP - left;
          if (room >= TIP_NARROW_MIN && room < bw) {
            box.style.maxWidth = `${Math.floor(room)}px`;
            bw = box.offsetWidth;
            bh = box.offsetHeight;
          } else {
            y = o.bottom - root.top + 4;
            arrowOn = false;
          }
        }
      }
      x = clampTo(centre - bw / 2, TIP_MARGIN, Math.max(TIP_MARGIN, root.width - TIP_MARGIN - bw));
      arrow = clampTo(centre - x, TIP_ARROW_INSET, bw - TIP_ARROW_INSET);
    }
    x = clampTo(x, TIP_MARGIN, Math.max(TIP_MARGIN, root.width - TIP_MARGIN - bw));
    y = clampTo(y, TIP_MARGIN, Math.max(TIP_MARGIN, root.height - TIP_MARGIN - bh));
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx !== this.tipX || ry !== this.tipY) {
      this.tipX = rx;
      this.tipY = ry;
      box.style.left = `${rx}px`;
      box.style.top = `${ry}px`;
    }
    const ra = Math.round(arrow);
    if (ra !== this.tipArrow) {
      this.tipArrow = ra;
      box.style.setProperty('--arrow', `${ra}px`);
    }
    if (arrowOn !== this.tipArrowOn) {
      this.tipArrowOn = arrowOn;
      box.dataset.arrow = arrowOn ? 'on' : 'off';
    }
  }

  /** Size a portrait canvas to its CSS box and (re)paint it; skipped while it is hidden or already current. */
  private paintIcon(canvas: HTMLCanvasElement, kind: UnitKind): void {
    const w = Math.round(canvas.clientWidth * this.dpr);
    const h = Math.round(canvas.clientHeight * this.dpr);
    if (w < 2 || h < 2) return;
    if (canvas.width === w && canvas.height === h && canvas.dataset.kind === kind) return;
    canvas.width = w;
    canvas.height = h;
    canvas.dataset.kind = kind;
    this.paint(canvas, kind, 0);
  }

  private readonly onTrainScroll = (): void => {
    const bar = this.trainBar;
    const max = bar.scrollWidth - bar.clientWidth;
    this.trainWrap.classList.toggle('more-l', bar.scrollLeft > 2);
    this.trainWrap.classList.toggle('more-r', bar.scrollLeft < max - 2);
  };

  // ------------------------------------------------------------------ actions

  private live(): boolean {
    if (!this.visible || this.state === null || this.state.paused) return false;
    const m = this.menuTap;
    const again = performance.now() - m.t < HUD_ARM_MS && Math.hypot(this.lastDown.x - m.x, this.lastDown.y - m.y) < HUD_SPOT_PX;
    return !again;
  }

  private doTrain(view: TrainView): void {
    if (!this.live()) return;
    if (!view.affordable) {
      this.deny(view.node);
      return;
    }
    this.app.uiSound('click');
    this.app.dispatch({ type: 'train', kind: view.kind });
  }

  private doOrder(order: Order): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    const kind = this.scope;
    this.app.dispatch(kind === null ? { type: 'order', order } : { type: 'order', order, kind });
  }

  private doSupport(view: SupportView): void {
    if (!this.live() || this.state === null) return;
    if (this.state.targeting === view.kind) {
      this.doCancelTargeting();
      return;
    }
    if (!view.ready) {
      this.deny(view.node);
      return;
    }
    this.app.uiSound('click');
    this.app.dispatch({ type: 'support', kind: view.kind });
  }

  private doCancelTargeting(): void {
    if (!this.live()) return;
    this.fold.noteCancel();
    this.app.uiSound('click');
    this.app.dispatch({ type: 'cancelTargeting' });
  }

  private doAbility(): void {
    if (!this.live() || !this.controlOn) return;
    if (!this.abilityReady) {
      this.deny(this.abilityButton);
      return;
    }
    this.app.dispatch({ type: 'ability' });
  }

  private doRelease(): void {
    if (!this.live() || !this.controlOn) return;
    this.app.uiSound('click');
    this.app.dispatch({ type: 'release' });
  }

  private doDismissTip(): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    this.app.dispatch({ type: 'dismissTip' });
  }

  private doPause(): void {
    if (!this.live()) return;
    this.app.uiSound('click');
    this.app.dispatch({ type: 'pause' });
  }

  private doMute(): void {
    if (!this.visible) return;
    this.app.dispatch({ type: 'toggleMute' });
    this.app.uiSound('click');
  }

  private doOverlay(type: 'resume' | 'restart' | 'quit'): void {
    if (!this.visible || this.state === null || !this.state.paused) return;
    this.app.uiSound(type === 'resume' ? 'click' : 'confirm');
    this.app.dispatch({ type });
  }

  private deny(node: HTMLElement): void {
    this.app.uiSound('deny');
    node.classList.add('is-deny');
  }

  // ------------------------------------------------------------------ joystick, fire, minimap

  private bindStick(): void {
    const stick = this.stick;
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPid) return;
      this.stickPid = -1;
      this.stickX = 0;
      this.knob.style.transform = '';
      this.syncMove();
    };
    stick.addEventListener('pointerdown', (e) => {
      if (!isPrimaryPointer(e) || this.stickPid !== -1 || !this.live()) return;
      this.stickPid = e.pointerId;
      capturePointer(stick, e.pointerId);
      const r = stick.getBoundingClientRect();
      this.stickCx = r.left + r.width / 2;
      this.stickRadius = Math.max(8, (r.width - this.knob.offsetWidth) / 2 - 4);
      e.preventDefault();
      this.moveStick(e.clientX);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPid) this.moveStick(e.clientX);
    });
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('lostpointercapture', end);
  }

  private moveStick(clientX: number): void {
    let dx = clientX - this.stickCx;
    if (dx > this.stickRadius) dx = this.stickRadius;
    else if (dx < -this.stickRadius) dx = -this.stickRadius;
    this.knob.style.transform = `translateX(${Math.round(dx)}px)`;
    this.stickX = stickValue(dx, this.stickRadius, STICK_DEAD_ZONE);
    this.syncMove();
  }

  /** Emit a stick action whenever the combined joystick and keyboard deflection changes. */
  private syncMove(): void {
    const x = this.stickPid !== -1 ? this.stickX : (this.keyRight ? 1 : 0) - (this.keyLeft ? 1 : 0);
    if (x === this.sentX) return;
    this.sentX = x;
    this.app.dispatch({ type: 'stick', x });
  }

  private syncFire(): void {
    const down = (this.fireButtonDown || this.fireKeyDown) && this.controlOn && this.live();
    if (down === this.sentFire) return;
    this.sentFire = down;
    this.app.dispatch({ type: 'fire', down });
  }

  /** The side objectives on the pause screen: each line, ticked when earned, struck through when failed. */
  private showPauseObjectives(list: { text: string; status: 'open' | 'done' | 'failed' }[]): void {
    const box = this.pauseObjectives;
    box.replaceChildren();
    if (list.length === 0) return;
    el('div', 'th-pause-objectives-title', box, 'Side objectives');
    for (const so of list) el('div', `th-pause-objective is-${so.status}`, box, so.text);
  }

  /** Let go of everything held: stick to centre, fire up. Used on pause, loss of control, blur and hide. */
  private releaseInputs(): void {
    this.stickPid = -1;
    this.stickX = 0;
    this.keyLeft = false;
    this.keyRight = false;
    this.fireButtonDown = false;
    this.fireKeyDown = false;
    this.knob.style.transform = '';
    this.syncMove();
    this.syncFire();
  }

  private bindMinimap(): void {
    const block = this.mapBlock;
    const end = (e: PointerEvent): void => {
      if (e.pointerId === this.mapPid) this.mapPid = -1;
    };
    block.addEventListener('pointerdown', (e) => {
      if (!isPrimaryPointer(e) || this.mapPid !== -1 || !this.live()) return;
      this.mapPid = e.pointerId;
      capturePointer(block, e.pointerId);
      const r = this.mapCanvas.getBoundingClientRect();
      this.mapLeft = r.left;
      this.mapWidth = r.width;
      this.mapFrac = -1;
      e.preventDefault();
      this.jumpMap(e.clientX);
    });
    block.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.mapPid) this.jumpMap(e.clientX);
    });
    block.addEventListener('pointerup', end);
    block.addEventListener('pointercancel', end);
    block.addEventListener('lostpointercapture', end);
  }

  private jumpMap(clientX: number): void {
    const frac = stripFrac(clientX, this.mapLeft, this.mapWidth, MINIMAP_PAD);
    if (frac === this.mapFrac) return;
    this.mapFrac = frac;
    this.app.dispatch({ type: 'minimap', frac });
  }

  // ------------------------------------------------------------------ keyboard (desktop testing)

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const s = this.state;
    if (!this.visible || s === null || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (code === 'Escape') {
      if (!e.repeat) {
        if (this.pickerOpen) this.closePicker();
        else if (s.paused) this.doOverlay('resume');
        else if (s.targeting !== null) this.doCancelTargeting();
        else if (this.fold.open) this.doCallIns();
        else this.doPause();
      }
      e.preventDefault();
      return;
    }
    if (code === 'KeyM') {
      if (!e.repeat) this.doMute();
      e.preventDefault();
      return;
    }
    if (s.paused) return;

    if (this.controlOn) {
      let handled = true;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        this.keyLeft = true;
        this.syncMove();
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        this.keyRight = true;
        this.syncMove();
      } else if (code === 'Space') {
        this.fireKeyDown = true;
        this.syncFire();
      } else if (code === 'KeyF') {
        if (!e.repeat && s.control !== null && s.control.hasAbility) this.doAbility();
      } else if (code === 'KeyR') {
        if (!e.repeat) this.doRelease();
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        return;
      }
    }

    if (e.repeat) return;
    if (code === 'KeyQ') this.doOrder('fallBack');
    else if (code === 'KeyW') this.doOrder('hold');
    else if (code === 'KeyE') this.doOrder('advance');
    else if (code === 'KeyS') this.cycleScope();
    else if (code.length === 6 && code.startsWith('Digit')) {
      const index = code.charCodeAt(5) - 49;
      if (index < 0 || index >= this.trainViews.length) return;
      this.doTrain(this.trainViews[index]);
    } else return;
    e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'KeyA' || code === 'ArrowLeft') {
      this.keyLeft = false;
      this.syncMove();
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      this.keyRight = false;
      this.syncMove();
    } else if (code === 'Space') {
      this.fireKeyDown = false;
      this.syncFire();
    }
  };

  private readonly onAnyDown = (e: PointerEvent): void => {
    this.lastDown.x = e.clientX;
    this.lastDown.y = e.clientY;
    // A press anywhere outside the picker (and its chip, which toggles it) closes it.
    if (this.pickerOpen && e.target instanceof Node && !this.picker.contains(e.target) && !this.scopeButton.contains(e.target)) {
      this.closePicker();
    }
  };

  private readonly onAnyUp = (e: PointerEvent): void => {
    if (this.visible) return;
    this.menuTap = { t: performance.now(), x: e.clientX, y: e.clientY };
  };

  private readonly onBlur = (): void => {
    this.releaseInputs();
  };

  // ------------------------------------------------------------------ lifecycle

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    if (!v) {
      this.releaseInputs();
      this.hideTip();
      // Every battle starts with orders for the whole army.
      this.closePicker();
      this.setScope(null);
      // ... and with the call-ins folded away.
      this.fold.reset();
      this.showFold();
    }
    this.visible = v;
    this.root.hidden = !v;
    if (v) this.onLayout();
  }

  destroy(): void {
    this.releaseInputs();
    document.removeEventListener('pointerdown', this.onAnyDown, true);
    document.removeEventListener('pointerup', this.onAnyUp, true);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    if (this.observer) this.observer.disconnect();
    else window.removeEventListener('resize', this.onLayout);
    this.visible = false;
    this.root.remove();
  }

  getButtonRects(): Record<string, HudRect> {
    const out: Record<string, HudRect> = {};
    const nodes = this.root.querySelectorAll<HTMLElement>('[data-testid]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const id = node.dataset.testid;
      const r = node.getBoundingClientRect();
      if (!id || r.width <= 0 || r.height <= 0) continue;
      out[id] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return out;
  }
}

export function createHud(root: HTMLElement, app: AppApi, opts: HudOptions = {}): Hud {
  return new HudView(root, app, opts);
}
