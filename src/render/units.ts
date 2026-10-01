/**
 * Unit views: pooled sets of Images positioned every frame from the figure
 * rig (layoutFigure) or the tank rig (layoutTank). One pool per depth row, so
 * a view's images stay together, in order, inside their row's Layer.
 *
 * A view follows one unit (matched by unique id). When the unit dies the view
 * leaves its pool slot, plays the death fall (or shows the tank husk), lingers,
 * fades and goes back to the pool.
 */
import type Phaser from 'phaser';
import {
  FIGURE_PART_COUNT,
  chooseDeathVariant,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  layoutFigure,
  resetFigureAnim,
  updateFigure,
  type FigureAnim,
  type FigureDeath,
  type FigureInput,
  type FigurePart,
} from '../art/figure';
import { TANK_KEYS, createTankPose, layoutTank, type TankPose, type TankState } from '../art/vehicles';
import { TANK_LAYOUT, TANK_MAX_WHEELS, type TankLook } from '../data/artLayout';
import { FACTIONS } from '../data/factions';
import { FX_KEYS } from '../data/fx';
import { RENDER } from '../data/render';
import type { DamageType, FactionId, Side, UnitKind } from '../data/schema';
import { VIEW } from '../data/view';
import { createRng, mixSeed, type Rng01 } from '../fx';
import type { BattleState, UnitState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, SHADOW_H, SHADOW_W, WHITE_SIZE } from './sprites';

type Img = Phaser.GameObjects.Image;

const STATE_FREE = 0;
const STATE_LIVE = 1;
const STATE_DYING = 2;

const U = RENDER.unit;

/** Fields shared by figure and tank views. */
abstract class UnitViewBase {
  state = STATE_FREE;
  unitId = -1;
  /** Pool slot of the unit in state.units while live. */
  slot = -1;
  side: Side = 0;
  kind: UnitKind = 'rifle';
  faction: FactionId = 'british';
  /** Drawn position of the feet, scale and facing. */
  x = 0;
  y = 0;
  s = 1;
  facing = 1;
  /** Drawn x last frame, for the distance travelled. */
  lastX = 0;
  /** Fixed visual x offset of this unit (formation spread). */
  jitter = 0;
  /** Seconds since death. */
  deadTime = 0;
  sink = 0;
  alpha = 1;
  appliedAlpha = -1;
  shown = false;
  /** One-shot triggers set by events, consumed by the next render. */
  fired = false;
  hit = false;
  /** Height of the body (wu at scale 1) for picking, pips and screen positions. */
  bodyH: number = VIEW.figureHeight;
  readonly shadow: Img;
  readonly pipBack: Img;
  readonly pips: Img[] = [];
  pipsShown = false;
  private readonly shadowInv: number;
  private readonly whiteInv: number;

  constructor(
    readonly row: number,
    protected readonly reg: SpriteRegistry,
    scene: Phaser.Scene,
    layers: Layers,
  ) {
    this.shadowInv = 1 / reg.get(RENDER_KEYS.shadow).scale;
    this.whiteInv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
    this.shadow = addImage(scene, layers.byName.shadows, reg.get(RENDER_KEYS.shadow).frame);
    this.shadow.setTint(0x000000);
    this.shadow.visible = false;
    this.pipBack = addImage(scene, layers.byName.markers, reg.get(RENDER_KEYS.whiteTL).frame);
    this.pipBack.setTint(U.pipBack);
    this.pipBack.visible = false;
    for (let i = 0; i < U.pips; i++) {
      const p = addImage(scene, layers.byName.markers, reg.get(RENDER_KEYS.whiteTL).frame);
      p.visible = false;
      this.pips.push(p);
    }
  }

  abstract setShown(on: boolean): void;
  abstract applyAlpha(a: number): void;
  /** Muzzle position in world space (from last frame's pose), written to out. */
  abstract muzzle(out: { x: number; y: number }): void;

  hidePips(): void {
    if (!this.pipsShown) return;
    this.pipsShown = false;
    this.pipBack.visible = false;
    for (const p of this.pips) p.visible = false;
  }

  showPips(frac: number, topY: number): void {
    const n = this.pips.length;
    const s = this.s;
    const pw = U.pipW * s;
    const gap = U.pipGap * s;
    const total = n * pw + (n - 1) * gap;
    const x0 = this.x - total / 2;
    const k = this.whiteInv;
    const back = this.pipBack;
    back.visible = true;
    back.x = x0 - gap;
    back.y = topY - gap;
    back.scaleX = (total + gap * 2) * k;
    back.scaleY = (U.pipH * s + gap * 2) * k;
    back.alpha = this.alpha;
    const filled = Math.ceil(frac * n - 1e-6);
    for (let i = 0; i < n; i++) {
      const p = this.pips[i];
      p.visible = true;
      p.x = x0 + i * (pw + gap);
      p.y = topY;
      p.scaleX = pw * k;
      p.scaleY = U.pipH * s * k;
      p.setTint(i < filled ? U.pipFill[this.side] : U.pipEmpty);
      p.alpha = this.alpha;
    }
    this.pipsShown = true;
  }

  placeShadow(w: number, h: number): void {
    const sh = this.shadow;
    sh.visible = true;
    sh.x = this.x;
    sh.y = this.y + this.sink;
    sh.scaleX = ((w * this.s) / SHADOW_W) * this.shadowInv;
    sh.scaleY = ((h * this.s) / SHADOW_H) * this.shadowInv;
    sh.alpha = U.shadowAlpha * this.alpha;
  }
}

class FigureView extends UnitViewBase {
  readonly images: Img[] = [];
  readonly keys: string[] = [];
  readonly inv: number[] = [];
  readonly anim: FigureAnim;
  readonly input: FigureInput;
  readonly parts: FigurePart[];
  readonly death: FigureDeath = { variant: 'crumple', time: 0, dir: -1 };

  constructor(row: number, reg: SpriteRegistry, scene: Phaser.Scene, layers: Layers) {
    super(row, reg, scene, layers);
    const layer = layers.rows[row];
    const first = reg.get(RENDER_KEYS.white);
    for (let i = 0; i < FIGURE_PART_COUNT; i++) {
      const img = addImage(scene, layer, first.frame);
      img.visible = false;
      this.images.push(img);
      this.keys.push('');
      this.inv.push(1);
    }
    this.anim = createFigureAnim('rifle', 'british', 0);
    this.input = createFigureInput('rifle');
    this.parts = createFigureLayout();
  }

  reset(kind: UnitKind, faction: FactionId, seed: number): void {
    resetFigureAnim(this.anim, kind, faction, seed);
    const inp = this.input;
    inp.kind = kind;
    inp.action = 'idle';
    inp.speed = 0;
    inp.moved = 0;
    inp.aimPitch = 0;
    inp.inTrench = false;
    inp.carrying = false;
    inp.controlled = false;
    inp.victory = false;
    inp.fired = false;
    inp.hit = false;
    inp.death = null;
    this.bodyH = VIEW.figureHeight;
  }

  setShown(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) {
      for (const img of this.images) img.visible = false;
      this.shadow.visible = false;
      this.hidePips();
    }
  }

  applyAlpha(a: number): void {
    if (Math.abs(a - this.appliedAlpha) < 0.004) return;
    this.appliedAlpha = a;
    for (const img of this.images) img.alpha = a;
  }

  /** Update the animation by dt and copy the parts onto the images. */
  draw(dt: number): void {
    updateFigure(this.anim, this.input, dt);
    layoutFigure(this.anim, this.parts);
    const x = this.x;
    const y = this.y + this.sink;
    const s = this.s;
    const f = this.facing;
    const parts = this.parts;
    for (let i = 0; i < FIGURE_PART_COUNT; i++) {
      const p = parts[i];
      const img = this.images[i];
      if (!p.visible) {
        img.visible = false;
        continue;
      }
      if (p.key !== this.keys[i]) {
        const fr = this.reg.get(p.key);
        img.setFrame(fr.frame);
        this.keys[i] = p.key;
        this.inv[i] = 1 / fr.scale;
      }
      const k = s * this.inv[i];
      img.visible = true;
      img.x = x + f * s * p.x;
      img.y = y + s * p.y;
      img.rotation = f * p.rotation;
      img.scaleX = f * p.scaleX * k;
      img.scaleY = p.scaleY * k;
    }
    this.placeShadow(U.figureShadowW, U.figureShadowH);
  }

  muzzle(out: { x: number; y: number }): void {
    out.x = this.x + this.facing * this.s * this.anim.muzzleX;
    out.y = this.y + this.sink + this.s * this.anim.muzzleY;
  }
}

/** Number of tank part images: track, wheels, hull, barrel, turret, husk. */
const TANK_IMAGES = TANK_MAX_WHEELS + 5;

class TankView extends UnitViewBase {
  readonly images: Img[] = [];
  readonly keys: string[] = [];
  look: TankLook = 'churchill';
  readonly tank: TankState = { look: 'churchill', distance: 0, turretAim: 0, recoil: 0, hullRock: 0 };
  readonly pose: TankPose = createTankPose();
  inv = 1;

  constructor(row: number, reg: SpriteRegistry, scene: Phaser.Scene, layers: Layers) {
    super(row, reg, scene, layers);
    const layer = layers.rows[row];
    const first = reg.get(RENDER_KEYS.white);
    for (let i = 0; i < TANK_IMAGES; i++) {
      const img = addImage(scene, layer, first.frame);
      img.visible = false;
      this.images.push(img);
      this.keys.push('');
    }
  }

  reset(kind: UnitKind, faction: FactionId): void {
    const look = kind === 'heavyTank' ? FACTIONS[faction].look.heavyTank : FACTIONS[faction].look.tank;
    this.look = look;
    this.tank.look = look;
    this.tank.distance = 0;
    this.tank.turretAim = 0;
    this.tank.recoil = 0;
    this.tank.hullRock = 0;
    this.bodyH = TANK_LAYOUT[look].height;
    this.inv = 1 / this.reg.get(TANK_KEYS[look].hull).scale;
  }

  setShown(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) {
      for (const img of this.images) img.visible = false;
      this.shadow.visible = false;
      this.hidePips();
    }
  }

  applyAlpha(a: number): void {
    if (Math.abs(a - this.appliedAlpha) < 0.004) return;
    this.appliedAlpha = a;
    for (const img of this.images) img.alpha = a;
  }

  private put(i: number, key: string, px: number, py: number, rot: number): void {
    const img = this.images[i];
    if (key !== this.keys[i]) {
      img.setFrame(this.reg.get(key).frame);
      this.keys[i] = key;
    }
    const s = this.s;
    const f = this.facing;
    img.visible = true;
    img.x = this.x + f * s * px;
    img.y = this.y + s * py;
    img.rotation = f * rot;
    img.scaleX = f * s * this.inv;
    img.scaleY = s * this.inv;
  }

  draw(dead: boolean): void {
    const keys = TANK_KEYS[this.look];
    const L = TANK_LAYOUT[this.look];
    const img = this.images;
    if (dead) {
      for (let i = 0; i < TANK_IMAGES - 1; i++) img[i].visible = false;
      this.put(TANK_IMAGES - 1, keys.husk, 0, 0, 0);
      this.placeShadow(L.length * U.tankShadowPad, U.tankShadowH);
      return;
    }
    img[TANK_IMAGES - 1].visible = false;
    const pose = layoutTank(this.tank, this.pose);
    let i = 0;
    this.put(i++, keys.track[pose.trackFrame], pose.track.x, pose.track.y, pose.track.rot);
    for (let w = 0; w < TANK_MAX_WHEELS; w++, i++) {
      if (w < pose.wheelCount) {
        const xf = pose.wheels[w];
        this.put(i, keys.wheels[w], xf.x, xf.y, xf.rot);
      } else {
        img[i].visible = false;
      }
    }
    this.put(i++, keys.hull, pose.hull.x, pose.hull.y, pose.hull.rot);
    this.put(i++, keys.barrel, pose.barrel.x, pose.barrel.y, pose.barrel.rot);
    this.put(i, keys.turret, pose.turret.x, pose.turret.y, pose.turret.rot);
    this.placeShadow(L.length * U.tankShadowPad, U.tankShadowH);
  }

  muzzle(out: { x: number; y: number }): void {
    out.x = this.x + this.facing * this.s * this.pose.muzzle.x;
    out.y = this.y + this.s * this.pose.muzzle.y;
  }
}

export type UnitView = FigureView | TankView;

function isVehicle(kind: UnitKind): boolean {
  return kind === 'tank' || kind === 'heavyTank';
}

/** Every unit view of the battle: creation, per-frame layout, deaths, picking. */
export class UnitViews {
  /** View of the unit in each pool slot (matched on unitId). */
  private bySlot: (UnitView | null)[] = [];
  private readonly dying: UnitView[] = [];
  private readonly figurePool: FigureView[][] = [];
  private readonly tankPool: TankView[][] = [];
  private readonly rng: Rng01;
  private seed = 0;
  controlledId = -1;
  drawn = 0;
  private readonly ring: Img;
  private readonly ringScale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    for (let r = 0; r < VIEW.rows; r++) {
      this.figurePool.push([]);
      this.tankPool.push([]);
    }
    this.rng = createRng(1);
    const ring = reg.get(FX_KEYS.ui.selectRing);
    this.ring = addImage(scene, layers.byName.shadows, ring.frame);
    this.ring.visible = false;
    this.ringScale = RENDER.marker.ringScale / ring.scale;
  }

  /** Start a battle: drop every view. */
  reset(seed: number): void {
    for (let i = 0; i < this.bySlot.length; i++) {
      const v = this.bySlot[i];
      if (v) this.release(v);
    }
    this.bySlot = [];
    while (this.dying.length > 0) this.release(this.dying[this.dying.length - 1]);
    this.seed = seed;
    this.controlledId = -1;
    this.ring.visible = false;
  }

  /** Views alive (live and dying). */
  count(): number {
    let n = this.dying.length;
    for (const v of this.bySlot) if (v) n++;
    return n;
  }

  /** The live view of a unit, or null. */
  liveView(slot: number, unitId: number): UnitView | null {
    const v = slot >= 0 && slot < this.bySlot.length ? this.bySlot[slot] : null;
    return v && v.unitId === unitId ? v : null;
  }

  /** The live view in a pool slot, whoever it belongs to (shot events name targets by slot only). */
  viewAtSlot(slot: number): UnitView | null {
    return slot >= 0 && slot < this.bySlot.length ? this.bySlot[slot] : null;
  }

  /** Find any view (live or dying) by unit id. */
  findById(unitId: number): UnitView | null {
    for (let i = 0; i < this.bySlot.length; i++) {
      const v = this.bySlot[i];
      if (v && v.unitId === unitId) return v;
    }
    for (let i = 0; i < this.dying.length; i++) if (this.dying[i].unitId === unitId) return this.dying[i];
    return null;
  }

  private acquire(u: UnitState): UnitView {
    const row = Math.max(0, Math.min(VIEW.rows - 1, u.row | 0));
    let v: UnitView;
    if (isVehicle(u.kind)) {
      const pool = this.tankPool[row];
      const tv = pool.pop() ?? new TankView(row, this.reg, this.scene, this.layers);
      tv.reset(u.kind, u.faction);
      v = tv;
    } else {
      const pool = this.figurePool[row];
      const fv = pool.pop() ?? new FigureView(row, this.reg, this.scene, this.layers);
      fv.reset(u.kind, u.faction, mixSeed(this.seed ^ U.seedSalt, u.id));
      v = fv;
    }
    v.state = STATE_LIVE;
    v.unitId = u.id;
    v.slot = u.index;
    v.side = u.side;
    v.kind = u.kind;
    v.faction = u.faction;
    v.jitter = isVehicle(u.kind) ? 0 : (mixSeed(this.seed, u.id) / 4294967296 - 0.5) * 2 * U.xJitter;
    v.x = u.prevX + v.jitter;
    v.lastX = v.x;
    v.y = VIEW.groundY + VIEW.rowDy[row];
    v.s = VIEW.rowScale[row];
    v.facing = u.facing >= 0 ? 1 : -1;
    v.deadTime = 0;
    v.sink = 0;
    v.alpha = 1;
    v.appliedAlpha = -1;
    v.fired = false;
    v.hit = false;
    v.shown = true;
    v.setShown(false);
    return v;
  }

  private release(v: UnitView): void {
    v.setShown(false);
    if (v.state === STATE_DYING) {
      const i = this.dying.indexOf(v);
      if (i >= 0) {
        this.dying[i] = this.dying[this.dying.length - 1];
        this.dying.pop();
      }
    } else if (v.slot >= 0 && this.bySlot[v.slot] === v) {
      this.bySlot[v.slot] = null;
    }
    v.state = STATE_FREE;
    v.unitId = -1;
    v.slot = -1;
    if (v instanceof TankView) this.tankPool[v.row].push(v);
    else this.figurePool[v.row].push(v);
  }

  /** A unit died: its view leaves the slot and plays the fall. */
  onDied(slot: number, unitId: number, cause: DamageType | null, dir: number, x: number): void {
    const v = this.liveView(slot, unitId);
    if (!v) return;
    this.bySlot[slot] = null;
    v.state = STATE_DYING;
    v.deadTime = 0;
    v.x = x + v.jitter;
    this.dying.push(v);
    v.hidePips();
    if (v instanceof FigureView) {
      const fromFront = dir !== 0 && dir === -v.facing;
      v.death.variant = chooseDeathVariant(cause ?? 'bullet', fromFront, this.rng());
      v.death.time = 0;
      v.death.dir = dir === 0 ? -1 : dir * v.facing;
      v.input.death = v.death;
      v.input.action = 'idle';
      v.input.speed = 0;
      v.input.moved = 0;
    }
  }

  onFired(slot: number, unitId: number): void {
    const v = this.liveView(slot, unitId);
    if (v) v.fired = true;
  }

  onHit(slot: number, unitId: number): void {
    const v = this.liveView(slot, unitId);
    if (v) v.hit = true;
  }

  /**
   * Lay out every unit for this frame.
   * @param camLeft,camRight world x of the view edges (for culling)
   */
  update(state: BattleState, alpha: number, dt: number, camLeft: number, camRight: number): void {
    const units = state.units;
    const n = state.unitCount;
    if (this.bySlot.length < units.length) {
      for (let i = this.bySlot.length; i < units.length; i++) this.bySlot.push(null);
    }
    // Views whose unit is gone without a death event (pool slot reused or freed).
    for (let i = 0; i < this.bySlot.length; i++) {
      const v = this.bySlot[i];
      if (!v) continue;
      const u = i < n ? units[i] : null;
      if (!u || !u.alive || u.id !== v.unitId) this.release(v);
    }
    this.drawn = 0;
    const over = state.over;
    for (let i = 0; i < n; i++) {
      const u = units[i];
      if (!u.alive) continue;
      let v = this.bySlot[i];
      if (!v) {
        v = this.acquire(u);
        this.bySlot[i] = v;
      }
      this.updateLive(v, u, state, alpha, dt, camLeft, camRight, over && state.winner === u.side);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      this.updateDying(this.dying[i], dt, camLeft, camRight);
    }
    this.placeRing();
  }

  private updateLive(v: UnitView, u: UnitState, state: BattleState, alpha: number, dt: number, camLeft: number, camRight: number, victory: boolean): void {
    const x = u.prevX + (u.x - u.prevX) * alpha + v.jitter;
    const moved = x - v.lastX;
    v.lastX = x;
    v.x = x;
    v.facing = u.facing >= 0 ? 1 : -1;

    // Door fade: units appear out of and vanish into their own HQ doorway.
    const hq = state.sides[u.side].hq;
    let a = 1;
    if (u.inside || u.action === 'inside') a = 0;
    else if (hq) a = Math.min(1, Math.abs(x - hq.doorX) / U.doorFade);
    v.alpha = a;

    // Trench sink: occupants, and infantry crossing a trench, dip into it.
    let target = 0;
    if (!isVehicle(u.kind)) {
      if (u.trenchId >= 0) target = VIEW.trenchDepth;
      else {
        const tr = state.trenches;
        for (let t = 0; t < tr.length; t++) {
          const half = tr[t].width / 2;
          if (x > tr[t].x - half && x < tr[t].x + half) {
            target = VIEW.trenchDepth;
            break;
          }
        }
      }
    }
    v.sink += (target - v.sink) * (dt > 0 ? 1 - Math.exp(-dt / U.trenchSinkTime) : 0);

    const visible = a > 0.01 && x > camLeft - U.cullMargin && x < camRight + U.cullMargin;
    if (!visible) {
      v.setShown(false);
      // Keep the triggers for when it comes back into view? No: they are momentary.
      v.fired = false;
      v.hit = false;
      if (v instanceof TankView) v.tank.distance += moved * v.facing;
      return;
    }
    v.shown = true;
    this.drawn++;
    v.applyAlpha(a);
    if (v instanceof FigureView) {
      const inp = v.input;
      // When the battle is over the sim stops stepping, so velX and the action are stale: stand still, and the winners cheer.
      inp.action = state.over || u.action === 'inside' ? 'idle' : u.action;
      // The pose lives in figure space, drawn at row scale s: feed it figure-space distances so planted feet stay put.
      inp.speed = state.over ? 0 : (u.velX * v.facing) / v.s;
      inp.moved = (moved * v.facing) / v.s;
      inp.inTrench = v.sink > VIEW.trenchDepth * 0.5;
      inp.carrying = u.carrying > 0;
      inp.controlled = u.controlled;
      inp.victory = victory;
      inp.fired = v.fired;
      inp.hit = v.hit;
      inp.death = null;
      v.draw(dt);
    } else {
      const tk = v.tank;
      tk.distance += (moved * v.facing) / v.s;
      if (v.fired) tk.recoil = 1;
      else tk.recoil = Math.max(0, tk.recoil - dt / U.tankRecoilTime);
      tk.hullRock = U.tankFireRock * tk.recoil * tk.recoil;
      v.draw(false);
    }
    v.fired = false;
    v.hit = false;
    if (u.hp < u.maxHp && u.hp > 0) {
      v.showPips(u.hp / u.maxHp, v.y + v.sink - v.bodyH * v.s - U.pipLift * v.s);
    } else {
      v.hidePips();
    }
  }

  private updateDying(v: UnitView, dt: number, camLeft: number, camRight: number): void {
    v.deadTime += dt;
    const tank = v instanceof TankView;
    const still = tank ? 0 : (v as FigureView).anim.deathEnd;
    const linger = tank ? U.huskLinger : U.corpseLinger;
    const fade = tank ? U.huskFade : U.corpseFade;
    const t = v.deadTime - still - linger;
    if (t >= fade) {
      this.release(v);
      return;
    }
    v.alpha = t > 0 ? 1 - t / fade : 1;
    const visible = v.x > camLeft - U.cullMargin && v.x < camRight + U.cullMargin;
    if (!visible) {
      v.setShown(false);
      if (v instanceof FigureView) v.death.time = v.deadTime;
      return;
    }
    v.shown = true;
    this.drawn++;
    v.applyAlpha(v.alpha);
    if (v instanceof FigureView) {
      v.death.time = v.deadTime;
      v.input.death = v.death;
      v.input.fired = false;
      v.input.hit = false;
      v.draw(dt);
    } else {
      v.draw(true);
    }
  }

  private placeRing(): void {
    const ring = this.ring;
    if (this.controlledId < 0) {
      ring.visible = false;
      return;
    }
    let v: UnitView | null = null;
    for (let i = 0; i < this.bySlot.length; i++) {
      const c = this.bySlot[i];
      if (c && c.unitId === this.controlledId) {
        v = c;
        break;
      }
    }
    if (!v || !v.shown) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    ring.x = v.x;
    ring.y = v.y + v.sink * 0.5;
    const M = RENDER.marker;
    const k = v instanceof TankView ? TANK_LAYOUT[v.look].length / M.ringBaseW : 1;
    ring.scaleX = this.ringScale * v.s * k;
    ring.scaleY = this.ringScale * v.s * Math.min(k, M.ringMaxTall);
    ring.alpha = RENDER.marker.ringAlpha;
  }

  /**
   * The nearest live, drawn unit of `side` whose body centre is within `radius`
   * CSS px of the point (world x, world y); -1 if none. cssPerWu converts.
   */
  pick(side: Side, wx: number, wy: number, radiusCss: number, cssPerWu: number): number {
    let best = -1;
    let bestD = radiusCss;
    for (const v of this.bySlot) {
      if (!v || v.side !== side || !v.shown || v.alpha < 0.5) continue;
      const cy = v.y + v.sink - v.bodyH * v.s * 0.5;
      const dx = (v.x - wx) * cssPerWu;
      // Generous: distance to the body's vertical extent, not just its centre.
      const half = v.bodyH * v.s * 0.5 * cssPerWu;
      const dyRaw = Math.abs(cy - wy) * cssPerWu;
      const dy = Math.max(0, dyRaw - half * 0.6);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = v.unitId;
      }
    }
    return best;
  }
}
