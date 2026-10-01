/**
 * One battle as the app sees it: the sim battle, the HUD model, the support
 * targeting flow, direct control, banners and hints, and the translation of
 * HUD actions and taps into sim commands.
 *
 * Pause, restart, quit and mute are app-level and not handled here.
 * Direct control and supports are wired against the command API but guarded on
 * SIM_FEATURES, so they stay inert until the sim implements them.
 */
import { APP } from '../data/app';
import type { Difficulty, MissionDef, SupportKind } from '../data/schema';
import { SIM_FEATURES, type Battle, type UnitState } from '../sim';
import type { BattleCamera } from '../render/contracts';
import type { HudAction, HudState } from '../ui/contracts';
import { HudModel } from './hudModel';
import { playEventSound, type SfxAudio } from './sfx';

/** The part of the battle view the session drives. */
export interface SessionView {
  readonly camera: BattleCamera;
  afterStep(): void;
  setControlled(unitId: number): void;
  setTargeting(kind: SupportKind | null): void;
}

export interface SessionOptions {
  /** Whether tutorial hints are switched on (read each time a hint arrives). */
  hints(): boolean;
  /** Whether sound effects should play right now (off while fast-forwarding). */
  sound(): boolean;
  /** The battleEnded event was seen. Called once. */
  onEnded(): void;
}

export class BattleSession {
  readonly hud = new HudModel();
  /** True once the battleEnded event has been seen. */
  ended = false;

  private targeting: SupportKind | null = null;
  private stickX = 0;
  private fireDown = false;
  private abilityQueued = false;
  private sentX = 0;
  private sentFire = false;
  private bannerUntil = 0;
  private hintUntil = 0;
  private viewControlled = -1;

  constructor(
    readonly battle: Battle,
    readonly difficulty: Difficulty,
    readonly seed: number,
    private readonly view: SessionView,
    private readonly audio: SfxAudio,
    private readonly opts: SessionOptions,
  ) {
    this.hud.begin(battle);
  }

  get mission(): MissionDef {
    return this.battle.config.mission;
  }

  /** One simulation tick, then the view's event pass, then the app's own reactions to the events. */
  step(): void {
    this.battle.step();
    this.view.afterStep();
    this.handleEvents();
  }

  private handleEvents(): void {
    const battle = this.battle;
    const events = battle.events;
    const sound = events.count > 0 && this.opts.sound();
    for (let i = 0; i < events.count; i++) {
      const e = events.items[i];
      if (sound) playEventSound(this.audio, e, 0);
      switch (e.type) {
        case 'announce':
        case 'wave':
          if (e.text !== null) {
            const st = this.hud.state;
            st.banner = e.text;
            st.bannerSeq++;
            this.bannerUntil = battle.state.time + APP.bannerSeconds;
          }
          break;
        case 'hint':
          if (e.text !== null && this.opts.hints()) {
            this.hud.state.hint = e.text;
            this.hintUntil = battle.state.time + APP.hintSeconds;
          }
          break;
        case 'controlLost':
          if (e.side === 0) this.clearControlInput();
          break;
        case 'battleEnded':
          if (!this.ended) {
            this.ended = true;
            this.endTargeting();
            this.clearControlInput();
            this.opts.onEnded();
          }
          break;
        default:
          break;
      }
    }
  }

  /** Once per rendered frame: refresh the HUD state and keep the view's markers in step with the sim. */
  fill(paused: boolean, muted: boolean): HudState {
    const camera = this.view.camera;
    const hud = this.hud;
    hud.refresh(this.battle, camera.centerX, camera.viewWidthWu);
    const st = hud.state;
    const time = this.battle.state.time;
    st.paused = paused;
    st.muted = muted;
    st.targeting = this.targeting;
    if (st.banner !== null && time >= this.bannerUntil) st.banner = null;
    if (st.hint !== null && time >= this.hintUntil) st.hint = null;

    const side = this.battle.state.sides[0];
    const controlled = SIM_FEATURES.directControl && side.controlled >= 0 ? this.battle.state.units[side.controlled] : null;
    const id = controlled && controlled.alive ? controlled.id : -1;
    if (id !== this.viewControlled) {
      this.viewControlled = id;
      this.view.setControlled(id);
    }
    if (controlled && id >= 0) camera.setCenter(controlled.x);
    if (this.targeting !== null && (this.ended || !side.supportAvailable[this.targeting])) this.endTargeting();
    return st;
  }

  /** Called at the start of every frame: forward the stick and buttons of a controlled unit. */
  flushControl(): void {
    if (!SIM_FEATURES.directControl || this.ended) return;
    if (this.battle.state.sides[0].controlled < 0) return;
    const active = this.stickX !== 0 || this.fireDown || this.abilityQueued;
    if (!active && this.sentX === 0 && !this.sentFire) return;
    this.battle.command(0, { type: 'controlInput', moveX: this.stickX, fire: this.fireDown, ability: this.abilityQueued });
    this.sentX = this.stickX;
    this.sentFire = this.fireDown;
    this.abilityQueued = false;
  }

  /** Handle a HUD action that concerns the battle itself. Returns false for the app-level ones. */
  dispatch(action: HudAction): boolean {
    switch (action.type) {
      case 'train':
        this.battle.command(0, { type: 'train', kind: action.kind });
        return true;
      case 'order':
        this.battle.command(0, { type: 'order', order: action.order });
        return true;
      case 'support':
        this.beginTargeting(action.kind);
        return true;
      case 'cancelTargeting':
        this.endTargeting();
        return true;
      case 'stick':
        this.stickX = Math.max(-1, Math.min(1, action.x));
        return true;
      case 'fire':
        this.fireDown = action.down;
        return true;
      case 'ability':
        this.abilityQueued = true;
        return true;
      case 'release':
        this.release();
        return true;
      case 'minimap':
        this.view.camera.jumpToFrac(action.frac);
        return true;
      default:
        return false;
    }
  }

  /** A tap on the battlefield ground at world x. */
  tapGround(x: number): void {
    if (this.targeting === null || this.ended) return;
    const kind = this.targeting;
    const side = this.battle.state.sides[0];
    if (side.supportAvailable[kind] && side.supportCooldown[kind] <= 0) {
      this.battle.command(0, { type: 'support', kind, x });
    }
    this.endTargeting();
  }

  /** A tap on one of the player's units: take direct control of it, or let go if it is the one controlled. */
  tapUnit(unitId: number): void {
    if (!SIM_FEATURES.directControl || this.targeting !== null || this.ended) return;
    const unit = this.findUnit(unitId);
    if (unit === null || unit.side !== 0 || !unit.def.controllable) return;
    if (unit.controlled) {
      this.release();
    } else {
      this.clearControlInput();
      this.battle.command(0, { type: 'control', unit: unit.id });
    }
  }

  /** Stop targeting, release control: used when the player leaves the battle or pauses. */
  stopInputs(): void {
    this.endTargeting();
    this.stickX = 0;
    this.fireDown = false;
    this.abilityQueued = false;
  }

  private beginTargeting(kind: SupportKind): void {
    if (!SIM_FEATURES.supports || this.ended) return;
    const side = this.battle.state.sides[0];
    if (!side.supportAvailable[kind] || side.supportCooldown[kind] > 0) return;
    this.targeting = kind;
    this.view.setTargeting(kind);
  }

  private endTargeting(): void {
    if (this.targeting === null) return;
    this.targeting = null;
    this.view.setTargeting(null);
  }

  private release(): void {
    if (!SIM_FEATURES.directControl) return;
    this.clearControlInput();
    this.battle.command(0, { type: 'control', unit: -1 });
  }

  private clearControlInput(): void {
    this.stickX = 0;
    this.fireDown = false;
    this.abilityQueued = false;
    if (this.sentX !== 0 || this.sentFire) {
      this.battle.command(0, { type: 'controlInput', moveX: 0, fire: false, ability: false });
    }
    this.sentX = 0;
    this.sentFire = false;
  }

  private findUnit(unitId: number): UnitState | null {
    const state = this.battle.state;
    for (let i = 0; i < state.unitCount; i++) {
      const u = state.units[i];
      if (u.alive && u.id === unitId) return u;
    }
    return null;
  }
}
