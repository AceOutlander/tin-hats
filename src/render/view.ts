/**
 * createBattleView(): the Phaser 4 game, its one scene, and the glue between
 * battle state and every view (backdrop, structures, units, effects, camera,
 * input). See ./contracts.ts for the public API.
 *
 * Device pixels: the game is sized to the parent's CSS size x devicePixelRatio
 * (capped at VIEW.maxDevicePixelRatio) with Scale mode NONE and zoom 1/dpr, so
 * the canvas is styled at CSS size and drawn at full resolution. The camera
 * zoom is canvasHeight / VIEW.viewHeightWu: the same slice of the scene (anchored
 * at its bottom, so only upper sky is cropped) shows vertically on any aspect
 * ratio; wider screens see more of the front.
 */
import Phaser from 'phaser';
import { getTheatreColours } from '../art/backdrops';
import { allFigureSprites } from '../art/figure';
import { listFxSprites } from '../art/fx';
import { propSpecs } from '../art/props';
import { structureSpecs } from '../art/structures';
import { vehicleSpecs } from '../art/vehicles';
import { FX_KEYS } from '../data/fx';
import { RENDER } from '../data/render';
import { SUPPORTS } from '../data/supports';
import { VIEW, VIEW_TOP_WU } from '../data/view';
import type { Battle, BattleState } from '../sim';
import { SpriteRegistry } from './atlas';
import { BackdropView } from './backdrop';
import { CameraRig } from './camera';
import type { AttachOptions, AudioSink, BattleView, RenderStats, TargetingKind, WeatherMode, WeatherStats } from './contracts';
import { EffectsSystem, pillboxAt } from './effects';
import { PanInput } from './input';
import { addImage, createLayers, type Layers } from './layers';
import { RENDER_KEYS, WHITE_SIZE } from './sprites';
import { renderSprites } from './sprites';
import { StructureViews } from './structures';
import { UnitViews } from './units';
import { WeatherView } from './weather';

const ATLAS_GROUP = 'th/atlas';
const BATTLE_GROUP = 'th/battle';

class BattleScene extends Phaser.Scene {
  constructor(private readonly owner: BattleViewImpl) {
    super({ key: 'battle' });
  }

  create(): void {
    this.owner.onCreate(this);
  }

  override update(_time: number, delta: number): void {
    this.owner.onUpdate(delta);
  }
}

/** Parts of the renderer the effects, weather and audio pass builds on. */
export interface RenderInternals {
  scene: Phaser.Scene;
  layers: Layers;
  registry: SpriteRegistry;
  effects: EffectsSystem;
  units: UnitViews;
  structures: StructureViews;
  rig: CameraRig;
}

export class BattleViewImpl implements BattleView {
  readonly game: Phaser.Game;
  readonly camera = new CameraRig();
  onTapUnit: ((unitId: number) => void) | null = null;
  onTapGround: ((worldX: number) => void) | null = null;
  /** Weather requested by attach() (read by the weather pass). */
  weather: WeatherMode = 'auto';
  visualSeed = 0;
  playerSide: 0 | 1 = 0;

  private scene: Phaser.Scene | null = null;
  private layers: Layers | null = null;
  private registry: SpriteRegistry | null = null;
  private backdrop: BackdropView | null = null;
  private units: UnitViews | null = null;
  private structures: StructureViews | null = null;
  private effects: EffectsSystem | null = null;
  private input: PanInput | null = null;
  private weatherView: WeatherView | null = null;
  private nightTint: Phaser.GameObjects.Image | null = null;
  /** The night tint's alpha for the mission's own time of day, and how far setDarkness() has pushed it toward full night. */
  private nightAlpha = 0;
  private darkness = 0;
  private reticle: Phaser.GameObjects.Image | null = null;
  private reticleLine: Phaser.GameObjects.Image | null = null;
  private battle: Battle | null = null;
  private frameHandler: ((dtMs: number) => void) | null = null;
  private targeting: TargetingKind | null = null;
  private hoverX = 0;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private realDt = 0;
  private renderMs = 0;
  private afterStepMs = 0;
  private readonly screenPos = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private ready: ((v: BattleView) => void) | null;
  private debugZoom = 1;
  private debugCenterY: number = VIEW.groundY;

  /**
   * Inspection only (dev pages): magnify the battlefield `mul` times around world
   * y = centerY. Picking and screen positions assume mul = 1.
   */
  setDebugZoom(mul: number, centerY: number = VIEW.groundY - VIEW.figureHeight / 2): void {
    this.debugZoom = Math.max(1, mul);
    this.debugCenterY = centerY;
    this.applySize();
  }

  constructor(
    private readonly parent: HTMLElement,
    ready: (v: BattleView) => void,
  ) {
    this.ready = ready;
    this.measure();
    this.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: Math.round(this.cssW * this.dpr),
      height: Math.round(this.cssH * this.dpr),
      backgroundColor: '#000000',
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      disableContextMenu: true,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / this.dpr, autoRound: false },
      render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
      scene: [new BattleScene(this)],
    });
  }

  /** Read the parent's CSS size and the device pixel ratio to use. */
  private measure(): void {
    this.cssW = Math.max(1, this.parent.clientWidth || window.innerWidth);
    this.cssH = Math.max(1, this.parent.clientHeight || window.innerHeight);
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, VIEW.maxDevicePixelRatio));
  }

  get internals(): RenderInternals | null {
    if (!this.scene || !this.layers || !this.registry || !this.effects || !this.units || !this.structures) return null;
    return {
      scene: this.scene,
      layers: this.layers,
      registry: this.registry,
      effects: this.effects,
      units: this.units,
      structures: this.structures,
      rig: this.camera,
    };
  }

  /** CSS px per wu at the current size. */
  private cssPerWu(): number {
    return this.cssH / VIEW.viewHeightWu;
  }

  onCreate(scene: Phaser.Scene): void {
    this.scene = scene;
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const maxTex = Math.min(RENDER.atlasMaxSize, typeof renderer.getMaxTextureSize === 'function' ? renderer.getMaxTextureSize() : RENDER.atlasMaxSize);
    const reg = new SpriteRegistry(scene.textures);
    reg.addAtlas(ATLAS_GROUP, [...renderSprites(), ...allFigureSprites(), ...listFxSprites(), ...vehicleSpecs(), ...structureSpecs(), ...propSpecs()], VIEW.textureScale, maxTex);
    this.registry = reg;
    const layers = createLayers(scene);
    this.layers = layers;
    // Phaser picks a texture in the fragment shader by comparing an interpolated float with the unit number
    // (`outTexDatum == 7.0`). That comparison can fail on some pixels of rotated quads, which then draw nothing,
    // for every unit but number 0. A batch numbers its textures in the order they first appear, and the backdrop
    // textures come first in a frame (and the foreground strip may start a batch), so an invisible speck from the
    // atlas is drawn before them to make the atlas unit 0.
    for (const layer of [layers.byName.sky, layers.byName.foreground]) {
      const speck = addImage(scene, layer, reg.get(RENDER_KEYS.white).frame);
      speck.setScale(0.01);
      speck.alpha = 0.001;
    }
    this.backdrop = new BackdropView(scene, layers);
    this.units = new UnitViews(scene, layers, reg);
    this.structures = new StructureViews(scene, layers, reg);
    this.effects = new EffectsSystem(scene, layers, reg, this.units, this.structures);

    this.nightTint = addImage(scene, layers.byName.nightTint, reg.get(RENDER_KEYS.whiteTL).frame);
    this.nightTint.visible = false;
    this.reticleLine = addImage(scene, layers.byName.markers, reg.get(RENDER_KEYS.white).frame);
    this.reticleLine.visible = false;
    this.reticle = addImage(scene, layers.byName.markers, reg.get(FX_KEYS.ui.reticle).frame);
    this.reticle.visible = false;
    this.weatherView = new WeatherView(scene, layers, reg, this.effects.ctx);

    this.input = new PanInput(
      this.game.canvas,
      this.camera,
      () => this.cssPerWu(),
      (x, y) => this.tap(x, y),
      (x) => {
        this.hoverX = this.camera.left + x / this.cssPerWu();
      },
    );
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onWindowResize);
      this.resizeObserver.observe(this.parent);
    }
    this.applySize();
    const ready = this.ready;
    this.ready = null;
    if (ready) ready(this);
  }

  onUpdate(deltaMs: number): void {
    this.realDt = Math.min(0.25, Math.max(0, deltaMs / 1000));
    if (this.frameHandler) this.frameHandler(deltaMs);
    else this.render(1, this.realDt);
  }

  private readonly onWindowResize = (): void => {
    this.resize();
  };

  resize(): void {
    const w = this.cssW;
    const h = this.cssH;
    const d = this.dpr;
    this.measure();
    if (w === this.cssW && h === this.cssH && d === this.dpr) return;
    this.applySize();
  }

  private applySize(): void {
    const scale = this.game.scale;
    const pw = Math.round(this.cssW * this.dpr);
    const ph = Math.round(this.cssH * this.dpr);
    scale.setZoom(1 / this.dpr);
    scale.resize(pw, ph);
    const canvas = this.game.canvas;
    canvas.style.width = `${this.cssW}px`;
    canvas.style.height = `${this.cssH}px`;
    canvas.style.display = 'block';
    if (this.scene) this.scene.cameras.main.setSize(pw, ph);
    this.camera.setViewWidth(((pw / ph) * VIEW.viewHeightWu) / this.debugZoom);
  }

  attach(battle: Battle, opts: AttachOptions): void {
    if (!this.registry || !this.structures || !this.units || !this.effects || !this.backdrop) throw new Error('render: attach before the view is ready');
    this.detach();
    this.battle = battle;
    this.playerSide = opts.playerSide;
    this.weather = opts.weather ?? 'auto';
    this.visualSeed = opts.visualSeed;
    const state = battle.state;
    const mission = battle.config.mission;
    this.backdrop.build(mission.theatre, mission.timeOfDay, opts.visualSeed);
    const colours = getTheatreColours(mission.theatre, mission.timeOfDay);
    this.nightAlpha = colours.nightTintAlpha;
    if (this.nightTint) this.nightTint.setTint(colours.int.nightTint);
    const specs = StructureViews.battleSpecs(state);
    if (specs.length > 0) this.registry.addAtlas(BATTLE_GROUP, specs, VIEW.textureScale, RENDER.atlasMaxSize);
    this.structures.build(state);
    this.units.reset(opts.visualSeed);
    this.effects.clear();
    this.effects.ctx.state = state;
    this.effects.ctx.playerSide = opts.playerSide;
    this.effects.ctx.seed(opts.visualSeed);
    this.effects.ctx.time = 0;
    this.darkness = 0;
    this.weatherView?.attach(opts.visualSeed, this.weather, mission.theatre);
    this.camera.setLength(state.length);
    const hq = state.sides[opts.playerSide].hq;
    const dir = opts.playerSide === 0 ? 1 : -1;
    const start = hq ? hq.x + dir * this.camera.viewWidthWu * 0.3 : opts.playerSide === 0 ? 0 : state.length;
    this.camera.setCenter(start, true);
  }

  detach(): void {
    this.battle = null;
    this.units?.reset(this.visualSeed);
    this.structures?.clear();
    this.effects?.clear();
    this.weatherView?.clear();
    if (this.effects) {
      this.effects.ctx.state = null;
      this.effects.ctx.sound.stopLoops();
      this.effects.ctx.sound.reset();
    }
    this.registry?.removeGroup(BATTLE_GROUP);
    if (this.nightTint) this.nightTint.visible = false;
    this.setControlled(-1);
    this.setTargeting(null);
  }

  setFrameHandler(fn: ((dtMs: number) => void) | null): void {
    this.frameHandler = fn;
  }

  afterStep(): void {
    const battle = this.battle;
    const units = this.units;
    const structures = this.structures;
    const effects = this.effects;
    if (!battle || !units || !structures || !effects) return;
    const t0 = performance.now();
    const ev = battle.events;
    const state = battle.state;
    effects.beginStep();
    for (let i = 0; i < ev.count; i++) {
      const e = ev.items[i];
      switch (e.type) {
        case 'shot':
          if (e.source === 'unit') units.onFired(e.unit, e.unitId);
          else if (e.source === 'hq') structures.onStructureShot('hq', e.side);
          else if (e.source === 'pillbox') structures.onStructureShot('pillbox', pillboxAt(state, e.side, e.x));
          break;
        case 'unitHit':
          units.onHit(e.unit, e.unitId);
          break;
        case 'unitDied':
          units.onDied(e.unit, e.unitId, e.cause, e.dir, e.x);
          break;
        case 'battleEnded':
          // The losing headquarters ends as a ruin even when the battle was lost on a timer.
          if (e.side >= 0 && state.sides[e.side === 0 ? 1 : 0].hq) structures.forceRuin(e.side === 0 ? 1 : 0);
          break;
        default:
          break;
      }
      effects.handle(e);
    }
    this.afterStepMs += (performance.now() - t0 - this.afterStepMs) * RENDER.statsSmoothing;
  }

  render(alpha: number, dtSeconds: number): void {
    const scene = this.scene;
    if (!scene || !this.backdrop) return;
    const t0 = performance.now();
    const dt = Math.max(0, dtSeconds);
    const a = Math.max(0, Math.min(1, alpha));
    const rig = this.camera;
    rig.update(this.realDt);
    const cam = scene.cameras.main;
    const left = rig.left;
    const viewW = rig.viewWidthWu;
    // Screen shake moves the camera; a little extra zoom keeps the view inside the picture while it does.
    const shake = this.effects ? this.effects.ctx.shake : null;
    const sx = shake ? shake.x : 0;
    const sy = shake ? shake.y : 0;
    let zoomMul = this.debugZoom;
    if (sx !== 0 || sy !== 0) {
      zoomMul *= Math.max(viewW / Math.max(1, viewW - 2 * Math.abs(sx)), VIEW.viewHeightWu / Math.max(1, VIEW.viewHeightWu - 2 * Math.abs(sy)));
    }
    const zoom = (cam.height / VIEW.viewHeightWu) * zoomMul;
    if (cam.zoom !== zoom) cam.setZoom(zoom);
    cam.centerOn(rig.centerX + sx, (this.debugZoom === 1 ? VIEW_TOP_WU + VIEW.viewHeightWu / 2 : this.debugCenterY) + sy);
    this.backdrop.update(left, viewW);
    const battle = this.battle;
    if (battle && this.units && this.structures && this.effects) {
      const state: BattleState = battle.state;
      const ctx = this.effects.ctx;
      ctx.camLeft = left;
      ctx.camRight = left + viewW;
      ctx.night = this.nightLevel();
      ctx.sound.setView(rig.centerX, viewW);
      this.structures.update(state, dt);
      this.units.update(state, a, dt, left, left + viewW);
      this.weatherView?.update(dt, left, viewW, this.effects.enabled);
      this.effects.update(dt, this.realDt);
    }
    this.placeOverlays(left, viewW);
    this.renderMs += (performance.now() - t0 - this.renderMs) * RENDER.statsSmoothing;
  }

  /** The night tint's opacity now: the mission's own, pushed toward full night by setDarkness(). */
  private nightAlphaNow(): number {
    return this.nightAlpha + (Math.max(this.nightAlpha, RENDER.night.maxAlpha) - this.nightAlpha) * this.darkness;
  }

  /** How dark the scene is, 0 (none) to 1 (full night), for the effects. */
  private nightLevel(): number {
    return Math.min(1, this.nightAlphaNow() / RENDER.night.maxAlpha);
  }

  private placeOverlays(left: number, viewW: number): void {
    const night = this.nightTint;
    if (night) {
      const alpha = this.nightAlphaNow();
      const on = this.battle !== null && alpha > 0.001;
      night.visible = on;
      if (on) {
        night.x = left - 4;
        night.y = -4;
        night.scaleX = (viewW + 8) / WHITE_SIZE / VIEW.textureScale;
        night.scaleY = (VIEW.heightWu + 8) / WHITE_SIZE / VIEW.textureScale;
        night.alpha = alpha;
      }
    }
    const ret = this.reticle;
    const line = this.reticleLine;
    if (ret && line && this.registry) {
      const on = this.targeting !== null && this.battle !== null;
      ret.visible = on;
      line.visible = on;
      if (on && this.targeting !== null) {
        const x = Math.max(left, Math.min(left + viewW, this.hoverX));
        const fr = this.registry.get(FX_KEYS.ui.reticle);
        // The circle shows the call-in's reach: its spread, or a smoke cloud's radius, as the half-width.
        const def = SUPPORTS[this.targeting];
        const half = this.targeting === 'smoke' ? def.smokeRadius : def.spread;
        const k = half > 0 ? (half * 2) / fr.w : RENDER.marker.reticleScale;
        ret.x = x;
        ret.y = VIEW.groundY;
        ret.scaleX = (k * RENDER.marker.reticleScale) / fr.scale;
        ret.scaleY = (Math.min(k, RENDER.marker.reticleMaxTall) * RENDER.marker.reticleScale) / fr.scale;
        line.x = x;
        line.y = VIEW.groundY / 2;
        line.scaleX = 1.2 / WHITE_SIZE / VIEW.textureScale;
        line.scaleY = VIEW.groundY / WHITE_SIZE / VIEW.textureScale;
        line.alpha = RENDER.marker.reticleLineAlpha;
      }
    }
  }

  private tap(cssX: number, cssY: number): void {
    const k = this.cssPerWu();
    const wx = this.camera.left + cssX / k;
    const wy = VIEW_TOP_WU + cssY / k;
    this.hoverX = wx;
    if (this.targeting === null && this.units && this.battle) {
      const id = this.units.pick(this.playerSide, wx, wy, RENDER.input.pickRadius, k);
      if (id >= 0) {
        this.onTapUnit?.(id);
        return;
      }
    }
    this.onTapGround?.(wx);
  }

  setControlled(unitId: number): void {
    if (this.units) this.units.controlledId = unitId;
  }

  setTargeting(kind: TargetingKind | null): void {
    if (kind !== null && this.targeting === null) this.hoverX = this.camera.centerX;
    this.targeting = kind;
  }

  setEffectsEnabled(enabled: boolean): void {
    if (!this.effects) return;
    this.effects.enabled = enabled;
    if (!enabled) this.effects.clear();
  }

  setAudio(audio: AudioSink | null): void {
    this.effects?.ctx.sound.setSink(audio);
  }

  setDarkness(darkness: number): void {
    this.darkness = Math.max(0, Math.min(1, Number.isFinite(darkness) ? darkness : 0));
  }

  forceWeather(mode: 'rain' | 'clear'): void {
    this.weatherView?.force(mode);
  }

  forceThunder(): void {
    this.weatherView?.forceThunder();
  }

  weatherStats(): WeatherStats {
    return this.weatherView ? this.weatherView.stats() : { raining: false, checksMade: 0, strikes: 0 };
  }

  unitScreenPos(unitId: number): { x: number; y: number } | null {
    const v = this.units?.findById(unitId);
    if (!v || !v.shown) return null;
    const k = this.cssPerWu();
    this.screenPos.x = (v.x - this.camera.left) * k;
    this.screenPos.y = (v.y + v.sink - v.bodyH * v.s * 0.5 - VIEW_TOP_WU) * k;
    return this.screenPos;
  }

  getStats(): RenderStats {
    let images = 0;
    let visible = 0;
    const count = (list: Phaser.GameObjects.GameObject[]): void => {
      for (const o of list) {
        if (o instanceof Phaser.GameObjects.Container) {
          count(o.list);
          continue;
        }
        images++;
        if ((o as Phaser.GameObjects.Image).visible) visible++;
      }
    };
    if (this.layers) {
      for (const l of Object.values(this.layers.byName)) count(l.getChildren());
      for (const l of this.layers.rows) count(l.getChildren());
      count(this.layers.glow.getChildren());
      count(this.layers.lit.getChildren());
      count(this.layers.grade.getChildren());
    }
    return {
      fps: this.game.loop.actualFps,
      renderMs: this.renderMs,
      afterStepMs: this.afterStepMs,
      unitViews: this.units?.count() ?? 0,
      unitViewsDrawn: this.units?.drawn ?? 0,
      images,
      imagesVisible: visible,
      tracers: this.effects?.ctx.tracers.count ?? 0,
      particles: this.effects?.particleCount() ?? 0,
      atlasPages: this.registry?.pageCount() ?? 0,
      atlasPixels: this.registry?.pixels() ?? 0,
      backdropPixels: this.backdrop?.pixels ?? 0,
      canvasW: this.game.canvas?.width ?? 0,
      canvasH: this.game.canvas?.height ?? 0,
      dpr: this.dpr,
    };
  }

  destroy(): void {
    this.detach();
    this.effects?.ctx.sound.setSink(null);
    this.input?.destroy();
    this.input = null;
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.backdrop?.clear();
    this.frameHandler = null;
    this.game.destroy(true);
  }
}

/** Boot Phaser inside `parent` (which should fill the screen) and resolve once the atlases are built. */
export function createBattleView(parent: HTMLElement): Promise<BattleView> {
  return new Promise((resolve) => {
    new BattleViewImpl(parent, resolve);
  });
}
