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
import type { AppApi, ControlState, HudState, SupportButtonState, TrainButtonState } from '../contracts';
import {
  FRAC,
  clockSeconds,
  formatClock,
  formatIncome,
  hpLevel,
  incomeTenths,
  quant,
  shortName,
  stickValue,
  stripFrac,
} from './format';
import { ICONS, type IconName } from './icons';
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
const SUPPORT_ICON: Record<SupportKind, IconName> = { artillery: 'artillery', smoke: 'smoke', airStrike: 'airStrike' };
const LEVEL: readonly string[] = ['0', '1', '2'];

/** Longest label that fits a training or support button before it is cut to its first word. */
const NAME_CHARS = 10;
/** Middle of the joystick travel that reads as "not moving". */
const STICK_DEAD_ZONE = 0.14;
/** The minimap is repainted on every Nth update, and at once whenever the camera moves. */
const MINIMAP_EVERY = 4;
const BANNER_CLASS_A = 'th-banner show-a';
const BANNER_CLASS_B = 'th-banner show-b';

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
  private rawName = '';

  constructor(parent: HTMLElement, kind: UnitKind) {
    this.kind = kind;
    const b = button('th-btn th-tbtn', `train-${kind}`, kind, parent);
    this.node = b;
    const win = el('span', 'th-tbtn-win', b);
    this.canvas = el('canvas', 'th-tbtn-ico', win);
    this.sweep = new FracCell(el('span', 'th-tbtn-sweep', win));
    this.queuedText = new TextCell(el('span', 'th-badge th-tbtn-q', win));
    this.fieldedText = new TextCell(el('span', 'th-badge th-tbtn-n', win));
    this.name = new TextCell(el('span', 'th-tbtn-name', b));
    const price = el('span', 'th-tbtn-price', b);
    const cost = el('span', 'th-tbtn-cost', price);
    icon('crate', cost);
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
      this.name.set(shortName(s.name, NAME_CHARS));
      this.node.setAttribute('aria-label', `Train ${s.name}`);
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

class SupportView {
  readonly node: HTMLButtonElement;
  readonly kind: SupportKind;
  ready = false;
  private readonly name: TextCell;
  private readonly seconds: TextCell;
  private readonly sweep: FracCell;
  private readonly readyFlag: FlagCell;
  private readonly active: FlagCell;
  private rawName = '';

  constructor(parent: HTMLElement, kind: SupportKind) {
    this.kind = kind;
    const b = button('th-btn th-sbtn', `support-${kind}`, kind, parent);
    this.node = b;
    this.sweep = new FracCell(el('span', 'th-sweep', b));
    icon(SUPPORT_ICON[kind], b);
    this.name = new TextCell(el('span', 'th-sbtn-name', b));
    this.seconds = new TextCell(el('span', 'th-sbtn-sec', b));
    this.readyFlag = new FlagCell(b, 'is-ready');
    this.active = new FlagCell(b, 'is-active');
    b.addEventListener('animationend', () => b.classList.remove('is-deny'));
  }

  apply(s: SupportButtonState, targeting: SupportKind | null): void {
    if (s.name !== this.rawName) {
      this.rawName = s.name;
      this.name.set(shortName(s.name, NAME_CHARS - 1));
      this.node.setAttribute('aria-label', s.name);
    }
    this.ready = s.charge >= 1;
    this.readyFlag.set(this.ready);
    if (!this.ready) {
      this.sweep.set(s.charge);
      this.seconds.set(clockSeconds(s.secondsLeft));
    }
    this.active.set(targeting === s.kind);
  }
}

class HudView implements Hud {
  private readonly app: AppApi;
  private readonly paint: PaintUnitIcon;
  private readonly root: HTMLDivElement;
  private state: HudState | null = null;
  private visible = true;
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

  // Bottom bar.
  private readonly trainWrap: HTMLElement;
  private readonly trainBar: HTMLElement;
  private readonly trainViews: TrainView[] = [];
  private readonly supportBox: HTMLElement;
  private readonly supportViews: SupportView[] = [];
  private readonly orderButtons: HTMLButtonElement[] = [];
  private lastOrder: Order | null = null;

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
  private readonly fireSweep: FracCell;
  private readonly abilityButton: HTMLButtonElement;
  private readonly abilityHidden: FlagCell;
  private readonly abilityName: TextCell;
  private readonly abilitySweep: FracCell;
  private abilityReady = false;

  private readonly pausedFlag: FlagCell;
  private paused = false;
  private readonly mutedFlag: FlagCell;

  constructor(parent: HTMLElement, app: AppApi, opts: HudOptions) {
    this.app = app;
    this.paint = opts.paintUnitIcon ?? paintFallbackIcon;
    const root = el('div', 'th-hud', parent);
    this.root = root;
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // ----- Top bar -----
    const top = el('div', 'th-top', root);

    const supplies = el('div', 'th-res th-supplies', top);
    icon('crate', supplies);
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

    const map = el('div', 'th-map', top);
    map.dataset.testid = 'minimap';
    map.dataset.interactive = '';
    this.mapBlock = map;
    const hqRow = el('div', 'th-hqrow', map);
    const own = el('div', 'th-hq th-hq-own', hqRow);
    el('span', '', own, 'HQ');
    this.ownHq = new BarCell(el('span', 'th-bar', own));
    const enemy = el('div', 'th-hq th-hq-enemy', hqRow);
    el('span', '', enemy, 'Enemy');
    this.enemyHq = new BarCell(el('span', 'th-bar', enemy));
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
    this.objText = new TextCell(el('span', 'th-obj-text', obj));
    this.objTime = el('span', 'th-obj-time', obj);
    this.hasTimer = new FlagCell(obj, 'has-timer');
    this.urgent = new FlagCell(obj, 'is-urgent');

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

    // ----- Left edge: supports -----
    this.supportBox = el('div', 'th-supports', root);

    // ----- Right edge: direct-control buttons -----
    const fireRow = el('div', 'th-firerow', root);
    const release = button('th-btn th-fbtn th-release', 'release', 'Release unit', fireRow);
    icon('close', release);
    el('span', 'th-fbtn-label', release, 'Release');
    onTap(release, () => this.doRelease());
    const ability = button('th-btn th-fbtn th-ability', 'ability', 'Ability', fireRow);
    this.abilitySweep = new FracCell(el('span', 'th-sweep', ability));
    icon('ability', ability);
    this.abilityName = new TextCell(el('span', 'th-fbtn-label', ability));
    this.abilityHidden = new FlagCell(ability, 'is-hidden');
    this.abilityButton = ability;
    ability.addEventListener('animationend', () => ability.classList.remove('is-deny'));
    onPress(ability, () => this.doAbility());
    const fire = button('th-btn th-fbtn th-fire', 'fire', 'Fire', fireRow);
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
    const stick = el('div', 'th-plate th-stick', bottom);
    stick.dataset.testid = 'stick';
    stick.dataset.interactive = '';
    icon('chevLeft', stick, 'th-stick-arrow th-stick-arrow-l');
    icon('chevRight', stick, 'th-stick-arrow th-stick-arrow-r');
    this.knob = el('div', 'th-stick-knob', stick);
    this.stick = stick;
    this.bindStick();

    const card = el('div', 'th-plate th-card', root);
    this.cardCanvas = el('canvas', 'th-card-ico', card);
    const cardCol = el('div', 'th-card-col', card);
    this.cardName = new TextCell(el('span', 'th-card-name', cardCol));
    this.cardHp = new BarCell(el('span', 'th-bar', cardCol));
    this.controlFlag = new FlagCell(root, 'is-control');

    const trainWrap = el('div', 'th-plate th-trainwrap', bottom);
    this.trainWrap = trainWrap;
    const trainBar = el('div', 'th-train', trainWrap);
    trainBar.dataset.interactive = '';
    this.trainBar = trainBar;
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

    const orders = el('div', 'th-plate th-orders', bottom);
    for (let i = 0; i < ORDERS.length; i++) {
      const order = ORDERS[i];
      const b = button('th-btn th-obtn', `order-${order}`, ORDER_LABEL[order], orders);
      icon(order, b);
      el('span', '', b, ORDER_LABEL[order]);
      onPress(b, () => this.doOrder(order));
      this.orderButtons.push(b);
    }

    // ----- Pause overlay -----
    const overlay = el('div', 'th-pause', root);
    const panel = el('div', 'th-pause-panel', overlay);
    el('div', 'th-pause-title', panel, 'Paused');
    const pauseMute = button('th-btn th-pbtn th-pbtn-quiet', 'pause-mute', 'Sound', panel);
    icon('soundOn', pauseMute, 'th-ico-on');
    icon('soundOff', pauseMute, 'th-ico-off');
    el('span', 'th-ico-on', pauseMute, 'Sound on');
    el('span', 'th-ico-off', pauseMute, 'Sound off');
    onTap(pauseMute, () => this.doMute());
    const resume = button('th-btn th-pbtn th-pbtn-wide', 'resume', 'Resume', panel);
    icon('play', resume);
    el('span', '', resume, 'Resume');
    onTap(resume, () => this.doOverlay('resume'));
    const restart = button('th-btn th-pbtn', 'restart', 'Restart', panel);
    icon('restart', restart);
    el('span', '', restart, 'Restart');
    onTap(restart, () => this.doOverlay('restart'));
    const quit = button('th-btn th-pbtn', 'quit', 'Quit to map', panel);
    icon('quit', quit);
    el('span', '', quit, 'Quit to map');
    onTap(quit, () => this.doOverlay('quit'));
    this.pausedFlag = new FlagCell(root, 'is-paused');
    this.mutedFlag = new FlagCell(root, 'is-muted');

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

    this.ownHq.set(s.hqHp, s.hqMaxHp);
    const enemyHp = s.enemyHqHp;
    this.enemyHidden.set(enemyHp === null);
    if (enemyHp !== null) this.enemyHq.set(enemyHp, s.enemyHqMaxHp);

    if (s.order !== this.lastOrder) {
      this.lastOrder = s.order;
      for (let i = 0; i < ORDERS.length; i++) {
        this.orderButtons[i].classList.toggle('is-active', ORDERS[i] === s.order);
      }
    }

    const train = s.train;
    if (!this.trainMatches(train)) this.rebuildTrain(train);
    for (let i = 0; i < train.length; i++) this.trainViews[i].apply(train[i]);

    const supports = s.supports;
    if (!this.supportsMatch(supports)) this.rebuildSupports(supports);
    for (let i = 0; i < supports.length; i++) this.supportViews[i].apply(supports[i], s.targeting);

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

    if (s.paused !== this.paused) {
      this.paused = s.paused;
      this.pausedFlag.set(s.paused);
      if (s.paused) this.releaseInputs();
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
    this.cardHp.set(c.hp, c.maxHp);
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
    this.onLayout();
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
    this.supportViews.length = 0;
    for (let i = 0; i < list.length; i++) {
      const view = new SupportView(this.supportBox, list[i].kind);
      onTap(view.node, () => this.doSupport(view));
      this.supportViews.push(view);
    }
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
    this.onTrainScroll();
  };

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
    return this.visible && this.state !== null && !this.state.paused;
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
    this.app.dispatch({ type: 'order', order });
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
        if (s.paused) this.doOverlay('resume');
        else if (s.targeting !== null) this.doCancelTargeting();
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

  private readonly onBlur = (): void => {
    this.releaseInputs();
  };

  // ------------------------------------------------------------------ lifecycle

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    if (!v) this.releaseInputs();
    this.visible = v;
    this.root.hidden = !v;
    if (v) this.onLayout();
  }

  destroy(): void {
    this.releaseInputs();
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
