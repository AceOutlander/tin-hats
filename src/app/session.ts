/**
 * One battle as the app sees it: the sim battle, the HUD model, the support
 * targeting flow, direct control, banners and hints, and the translation of
 * HUD actions and taps into sim commands.
 *
 * Pause, restart, quit and mute are app-level and not handled here.
 */
import { APP } from '../data/app';
import { PREP } from '../data/prep';
import type { BuildableId, Difficulty, MissionDef, SupportKind } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { buildProblem, type AdminAction, type Battle, type UnitState } from '../sim';
import type { BattleCamera, PlacingGhost } from '../render/contracts';
import type { HudAction, HudState } from '../ui/contracts';
import { HudModel, nextDeploy, type HpShownQuery } from './hudModel';
import { playBossWarning, playClockTick, playEventSound, playWaveWarning, type SfxAudio } from './sfx';
import type { Tutorial } from './tutorial';

/** The part of the battle view the session drives. */
export interface SessionView {
  readonly camera: BattleCamera;
  afterStep(): void;
  setControlled(unitId: number): void;
  setTargeting(kind: SupportKind | null): void;
  /** The prep phase's placement ghost, or null to hide it. */
  setPlacing(p: PlacingGhost | null): void;
  /** Whose unit health the player sees (the battle view's HpReveal). */
  readonly hpReveal?: HpShownQuery;
}

export interface SessionOptions {
  /** Whether tutorial hints are switched on (read each time a hint arrives). */
  hints(): boolean;
  /** Whether sound effects should play right now (off while fast-forwarding). */
  sound(): boolean;
  /** The battleEnded event was seen. Called once. */
  onEnded(): void;
  /** The guided tips of this battle, if it has any (campaign missions only). */
  tutorial?: Tutorial | null;
}

/** How often the events the tests care about have happened in this battle (counted from the event stream). */
export interface EventTally {
  /** Call-ins the sim accepted from the player, per support. */
  supportCalled: Record<SupportKind, number>;
  /** The player's call-ins whose rounds were about to land. */
  supportIncoming: Record<SupportKind, number>;
  smokeSpawned: number;
  explosion: number;
  trenchCaptured: number;
  structureDestroyed: number;
  wireDestroyed: number;
  /** Times the player's controlled unit was killed. */
  controlLost: number;
  /** Shots fired by whichever unit the player was controlling at the time. */
  controlledShots: number;
}

function supportCounts(): Record<SupportKind, number> {
  const out = {} as Record<SupportKind, number>;
  for (const kind of SUPPORT_KINDS) out[kind] = 0;
  return out;
}

export function newTally(): EventTally {
  return {
    supportCalled: supportCounts(),
    supportIncoming: supportCounts(),
    smokeSpawned: 0,
    explosion: 0,
    trenchCaptured: 0,
    structureDestroyed: 0,
    wireDestroyed: 0,
    controlLost: 0,
    controlledShots: 0,
  };
}

export class BattleSession {
  readonly hud = new HudModel();
  /** True once the battleEnded event has been seen. */
  ended = false;
  readonly tally: EventTally = newTally();

  private targeting: SupportKind | null = null;
  /** Prep phase: the build being placed, where its ghost stands, and whether the player has tapped a spot for it. */
  private placing: BuildableId | null = null;
  private placeX = 0;
  private placePinned = false;
  private readonly ghost: PlacingGhost = { x: 0, width: 0, ok: false };
  /** Ids of the sites this player placed, newest last (Undo takes the newest still standing). */
  private readonly placed: number[] = [];
  private stickX = 0;
  private fireDown = false;
  private abilityQueued = false;
  private sentX = 0;
  private sentFire = false;
  private bannerUntil = 0;
  /** A King Tiger placed at the start: its spawn event comes before the first step, so it is warned of on that step. */
  private bossAtStart = false;
  private hintUntil = 0;
  /** The whole second of the mission clock that last ticked (-1 = none yet). */
  private lastTick = -1;
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
    const events = battle.events;
    for (let i = 0; i < events.count; i++) if (events.items[i].type === 'bossArrived' && events.items[i].side === 1) this.bossAtStart = true;
  }

  get mission(): MissionDef {
    return this.battle.config.mission;
  }

  /** The support the player is aiming right now, or null. */
  get aiming(): SupportKind | null {
    return this.targeting;
  }

  /** One simulation tick, then the view's event pass, then the app's own reactions to the events. */
  step(): void {
    this.battle.step();
    this.view.afterStep();
    this.handleEvents();
    const state = this.battle.state;
    if (state.timer !== null && !state.over && this.opts.sound()) {
      this.lastTick = playClockTick(this.audio, state.timer.secondsLeft, this.lastTick);
    }
  }

  /**
   * An admin panel action, applied now (paused or not): the view and the app then react to its events (spawns,
   * deaths, a King Tiger's warning, the end of the battle) as they do after a step. Returns what battle.admin returned.
   */
  admin(action: AdminAction): number {
    const n = this.battle.admin(action);
    this.view.afterStep();
    this.handleEvents();
    return n;
  }

  private handleEvents(): void {
    const battle = this.battle;
    const events = battle.events;
    const sound = events.count > 0 && this.opts.sound();
    const tutorial = this.opts.tutorial ?? null;
    if (this.bossAtStart) {
      this.bossAtStart = false;
      this.bossWarning();
    }
    for (let i = 0; i < events.count; i++) {
      const e = events.items[i];
      if (sound) playEventSound(this.audio, e, 0);
      if (tutorial !== null) tutorial.note(e);
      switch (e.type) {
        case 'announce':
        case 'wave':
          if (e.text !== null) this.showBanner(e.text);
          // A plain wave in a survival mission still gets a short notice, but never over an announcement.
          else if (e.type === 'wave' && e.side === 1 && battle.state.mode === 'survival' && !this.bannerUp()) {
            this.showBanner(APP.notices.wave);
          }
          // The enemy wave that the player is told about is also sounded.
          if (sound && e.type === 'wave' && e.side === 1 && (e.text !== null || battle.state.mode === 'survival')) playWaveWarning(this.audio);
          break;
        case 'buildStarted':
          if (e.side === 0) this.placed.push(e.targetIndex);
          break;
        case 'prepEnded':
          this.endPlacing();
          if (!this.bannerUp()) this.showBanner(APP.notices.prepEnded);
          break;
        case 'bossArrived':
          if (e.side === 1) this.bossWarning();
          break;
        // The mission director: a new phase is announced with a horn; a scripted banner with its own sound.
        case 'phaseStarted':
          if (e.text !== null) this.showBanner(e.text);
          if (sound) playWaveWarning(this.audio);
          break;
        case 'banner':
          if (e.text !== null) this.showBanner(e.text);
          if (sound) {
            if (e.value === 2) playBossWarning(this.audio);
            else playWaveWarning(this.audio);
          }
          break;
        case 'objectiveDone':
          // A side objective earned is worth a short notice (never over another banner); the phase's own objectives
          // show on the phase line.
          if (e.value === 1 && e.text !== null && !this.bannerUp()) this.showBanner(APP.notices.sideObjective.replace('{text}', e.text));
          break;
        case 'airdrop':
          if (e.side === 0 && !this.bannerUp()) this.showBanner(APP.notices.airdrop.replace('{n}', String(Math.round(e.value))));
          break;
        case 'hint':
          // The guided tutorial replaces the scripted hints of the mission it teaches in.
          if (e.text !== null && this.opts.hints() && !(tutorial !== null && tutorial.replacesScriptedHints)) {
            this.hud.state.hint = e.text;
            this.hintUntil = battle.state.time + APP.hintSeconds;
          }
          break;
        case 'controlLost':
          if (e.side === 0) {
            this.tally.controlLost++;
            this.clearControlInput();
          }
          break;
        case 'shot':
          if (e.source === 'unit' && e.side === 0 && e.unitId === this.viewControlled) this.tally.controlledShots++;
          break;
        case 'supportCalled':
          if (e.support !== null && e.side === 0) this.tally.supportCalled[e.support]++;
          break;
        case 'supportIncoming':
          if (e.support !== null && e.side === 0) this.tally.supportIncoming[e.support]++;
          break;
        case 'smokeSpawned':
          this.tally.smokeSpawned++;
          break;
        case 'explosion':
          this.tally.explosion++;
          break;
        case 'trenchCaptured':
          this.tally.trenchCaptured++;
          break;
        case 'structureDestroyed':
          this.tally.structureDestroyed++;
          break;
        case 'wireDestroyed':
          this.tally.wireDestroyed++;
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

  /** True while a banner is still on screen (the HUD clears an old one only on its next frame). */
  private bannerUp(): boolean {
    return this.hud.state.banner !== null && this.battle.state.time < this.bannerUntil;
  }

  /** The enemy's King Tiger squad is on the field: a warning banner and horn, like a boss. */
  private bossWarning(): void {
    this.showBanner(APP.notices.boss);
    if (this.opts.sound()) playBossWarning(this.audio);
  }

  private showBanner(text: string): void {
    const st = this.hud.state;
    st.banner = text;
    st.bannerSeq++;
    this.bannerUntil = this.battle.state.time + APP.bannerSeconds;
  }

  /** Once per rendered frame: refresh the HUD state and keep the view's markers in step with the sim. */
  fill(paused: boolean, muted: boolean): HudState {
    const camera = this.view.camera;
    const hud = this.hud;
    hud.refresh(this.battle, camera.centerX, camera.viewWidthWu, this.view.hpReveal ?? null);
    const st = hud.state;
    const time = this.battle.state.time;
    st.paused = paused;
    st.muted = muted;
    st.targeting = this.targeting;
    if (st.banner !== null && time >= this.bannerUntil) st.banner = null;
    if (st.hint !== null && time >= this.hintUntil) st.hint = null;
    const tutorial = this.opts.tutorial ?? null;
    if (tutorial !== null) {
      const dragging = 'dragging' in camera && camera.dragging === true;
      tutorial.update(this.battle, dragging, this.opts.hints(), st);
    }

    const side = this.battle.state.sides[0];
    const controlled = side.controlled >= 0 ? this.battle.state.units[side.controlled] : null;
    const id = controlled && controlled.alive ? controlled.id : -1;
    if (id !== this.viewControlled) {
      this.viewControlled = id;
      this.view.setControlled(id);
    }
    if (controlled && id >= 0) this.followControlled(controlled.x);
    if (this.targeting !== null && (this.ended || !side.supportAvailable[this.targeting])) this.endTargeting();
    this.fillPlacing(st);
    return st;
  }

  /**
   * Prep phase placement: the ghost stands in the middle of the view (so dragging the battlefield carries it along)
   * until the player taps the ground, which pins it there; it is green where the build can go.
   */
  private fillPlacing(st: HudState): void {
    const prep = st.prep;
    if (this.placing !== null && (prep === null || this.ended)) this.endPlacing();
    const kind = this.placing;
    if (prep === null) return;
    prep.placing = kind;
    if (kind === null) {
      prep.placeOk = false;
      return;
    }
    if (!this.placePinned) this.placeX = Math.round(this.view.camera.centerX);
    const ok = buildProblem(this.battle.state, 0, kind, this.placeX) === null;
    prep.placeOk = ok;
    this.ghost.x = this.placeX;
    this.ghost.width = PREP.buildables[kind].width;
    this.ghost.ok = ok;
    this.view.setPlacing(this.ghost);
  }

  private beginPlacing(kind: BuildableId): void {
    if (this.ended || this.battle.state.prep?.active !== true) return;
    this.endTargeting();
    this.placing = kind;
    this.placePinned = false;
  }

  private endPlacing(): void {
    if (this.placing === null) return;
    this.placing = null;
    this.placePinned = false;
    this.view.setPlacing(null);
  }

  /** Place the build where its ghost stands (if it can go there) and stop placing. */
  private confirmBuild(): void {
    const kind = this.placing;
    if (kind === null) return;
    if (buildProblem(this.battle.state, 0, kind, this.placeX) === null) {
      this.battle.command(0, { type: 'build', kind, x: this.placeX });
      this.endPlacing();
    }
  }

  /** Take back the newest of this player's sites still being built. */
  private undoBuild(): void {
    const sites = this.battle.state.sites;
    while (this.placed.length > 0) {
      const id = this.placed.pop() as number;
      if (sites.some((s) => s.id === id)) {
        this.battle.command(0, { type: 'cancelBuild', site: id });
        return;
      }
    }
  }

  /**
   * Keep the controlled unit on screen without gluing the camera to it: the view stays still while the unit is
   * within the dead zone around its anchor (a little behind the centre, so the view looks ahead toward the enemy),
   * and glides after it once it leaves (a finger dragging the view is left alone). The player's side faces +x.
   */
  private followControlled(x: number): void {
    const camera = this.view.camera;
    if ('dragging' in camera && camera.dragging === true) return;
    const dead = camera.viewWidthWu * APP.follow.deadZone;
    const lead = camera.viewWidthWu * APP.follow.lead;
    const off = x + lead - camera.centerX;
    if (off > dead) camera.setCenter(x + lead - dead * APP.follow.settle);
    else if (off < -dead) camera.setCenter(x + lead + dead * APP.follow.settle);
  }

  /** Called at the start of every frame: forward the stick and buttons of a controlled unit. */
  flushControl(): void {
    if (this.ended) return;
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
    if (this.opts.tutorial) this.opts.tutorial.noteAction(action);
    switch (action.type) {
      case 'train':
        this.battle.command(0, { type: 'train', kind: action.kind });
        return true;
      case 'order':
      case 'followArmy':
        // Same shape as the sim's commands; battle.command copies the fields into its queue.
        this.battle.command(0, action);
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
      case 'build':
        this.beginPlacing(action.kind);
        return true;
      case 'confirmBuild':
        this.confirmBuild();
        return true;
      case 'cancelPlacing':
        this.endPlacing();
        return true;
      case 'undoBuild':
        this.undoBuild();
        return true;
      case 'ready':
        this.endPlacing();
        this.battle.command(0, { type: 'ready' });
        return true;
      case 'deploy':
        this.battle.command(0, { type: 'deploy', at: nextDeploy(this.battle.state) });
        return true;
      case 'clear': {
        const chip = this.hud.state.clear;
        if (chip && !chip.busy) this.battle.command(0, { type: 'clear', x: chip.x });
        return true;
      }
      case 'dismissTip':
        return true;
      default:
        return false;
    }
  }

  /** A tap on the battlefield ground at world x. */
  tapGround(x: number): void {
    if (this.placing !== null && !this.ended) {
      // Prep phase: the tap moves the ghost there (Place confirms it).
      this.placeX = Math.round(x);
      this.placePinned = true;
      return;
    }
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
    if (this.targeting !== null || this.ended) return;
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
    this.endPlacing();
    this.stickX = 0;
    this.fireDown = false;
    this.abilityQueued = false;
  }

  private beginTargeting(kind: SupportKind): void {
    if (this.ended) return;
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
