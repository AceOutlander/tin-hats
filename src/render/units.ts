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
  FIGURE_RIM_PARTS,
  chooseDeathVariant,
  createFigureAnim,
  createFigureInput,
  J_CHEST,
  J_HIP,
  createFigureLayout,
  layoutFigure,
  resetFigureAnim,
  MOLOTOV_KEY,
  setFigureClothing,
  setFigureCrateKey,
  setFigureGear,
  setFigureHeadgear,
  setFigurePointing,
  setFigurePushing,
  setFigureRocketItem,
  setFigureWeapon,
  updateFigure,
  type FigureAnim,
  type FigureDeath,
  type FigureInput,
  type FigurePart,
} from '../art/figure';
import { bigLoadKey, cartKey, truckKey } from '../art/props/supplyLooks';
import {
  PLANE_KINDS,
  TANK_KEYS,
  createTankPose,
  isGearLook,
  layoutTank,
  planeGearSpecs,
  tankGearKeys,
  tankGearSpecs,
  vehicleLookOf,
  type TankPose,
  type TankState,
} from '../art/vehicles';
import type { SpriteSpec } from '../art/types';
import { TANK_LAYOUT, TANK_MAX_WHEELS, TRENCH_LAYOUT, WIRE_LAYOUT, type VehicleLook } from '../data/artLayout';
import { FX_KEYS } from '../data/fx';
import { BUILDING_LAYOUT } from '../data/looksBuilding';
import { GEAR_NONE } from '../data/looksGear';
import { SUPPLY_TRUCK_LAYOUT } from '../data/looksSupply';
import { RENDER } from '../data/render';
import { infantryLookOf, missionEra, resolveEra, unitVehicleLook, teamMateOf, type ResolvedEra, type VehicleKind } from '../data/eras';
import type { DamageType, FactionId, MissionDef, Side, UnitKind } from '../data/schema';
import { SAPPER_CART_HANDLE, type GearLevels, type SapperStyle, type SideLooks } from '../data/upgradeLooks';
import { VIEW } from '../data/view';
import { WEAPONS } from '../data/weapons';
import { createRng, mixSeed, type Rng01 } from '../fx';
import { lookStyle, planeGearOf } from '../meta/looks';
import type { BattleState, UnitState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { BloodPools, type PoolImage } from './blood';
import { apcHopLift } from './apcHop';
import { HpReveal } from './hpReveal';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, SHADOW_H, SHADOW_W, WHITE_SIZE } from './sprites';
import { inStandingWire, wireStruggle } from './wireRules';

type Img = Phaser.GameObjects.Image;

const STATE_FREE = 0;
const STATE_LIVE = 1;
const STATE_DYING = 2;

const U = RENDER.unit;
/** Atlas group of the tank, APC and plane gear variants a battle needs (built in setLooks, dropped in reset). */
const GEAR_GROUP = 'unitGear';
/** Vehicle kinds whose look may carry gear (the look decides: isGearLook). */
const GEAR_VEHICLE_KINDS: readonly UnitKind[] = ['tank', 'heavyTank', 'apc'];

/**
 * Put one part on its image: figure-space position (px, py), rotation and scale (sx, sy), drawn at (x0, y0) with
 * scale s and horizontal facing k (-1..1). While a unit turns, |k| < 1 squashes it the way a body turning on the spot
 * looks: each sprite keeps its length along its own axis (so joints stay joined) and its thickness, and only its
 * horizontal extent shrinks.
 */
function placePart(img: Img, x0: number, y0: number, s: number, k: number, px: number, py: number, rot: number, sx: number, sy: number): void {
  const g = k < 0 ? -1 : 1;
  const m = Math.abs(k);
  img.x = x0 + k * s * px;
  img.y = y0 + s * py;
  if (m > 0.999) {
    img.rotation = g * rot;
    img.scaleX = g * sx;
  } else {
    const c = Math.cos(rot) * m;
    const sn = Math.sin(rot);
    img.rotation = g * Math.atan2(sn, c);
    img.scaleX = g * sx * Math.hypot(c, sn);
  }
  img.scaleY = sy;
}

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
  /** Turn progress, 0 = facing +x .. 1 = facing -x, moved toward `facing` over the turn time. */
  turnP = 0;
  /** Drawn horizontal facing: +1 or -1 at rest, sweeping through 0 while the unit turns round. */
  turnK = 1;
  /** Drawn x last frame, for the distance travelled. */
  lastX = 0;
  /** Fixed visual x offset of this unit (formation spread). */
  jitter = 0;
  /** Interpolated simulation x (without the visual offset) as last drawn. */
  simX = 0;
  /** Crowd spread offset (wu, eased) and this frame's unspread x, see UnitViews.spreadCrowds. */
  crowd = 0;
  crowdTarget = 0;
  /** True while a standing figure steps aside to make room (see UnitViews.spreadCrowds). */
  shuffling = false;
  /** Seconds since death. */
  deadTime = 0;
  /** How far the unit is drawn below its row's ground line (wu), and how far it has stepped into a trench (0..1). */
  sink = 0;
  trenchW = 0;
  /** How far an infantryman has stepped onto the feet line of a wire belt he is inside (0..1, view only). */
  wireW = 0;
  /** How far an occupant has shuffled into his packed place in the narrow pit (0..1, view only). */
  packW = 0;
  alpha = 1;
  appliedAlpha = -1;
  shown = false;
  /** One-shot triggers set by events, consumed by the next render. */
  fired = false;
  hit = false;
  /** Height of the body (wu at scale 1) for picking, pips and screen positions. */
  bodyH: number = VIEW.figureHeight;
  /** Every image of the body, back to front, all in this view's row layer. */
  readonly images: Img[] = [];
  readonly shadow: Img;
  readonly pipBack: Img;
  readonly pips: Img[] = [];
  /** The tint each pip has now, so a frame only touches the pips whose colour changed. */
  private readonly pipTint: number[] = [];
  pipsShown = false;
  private readonly shadowInv: number;
  protected readonly whiteInv: number;

  constructor(
    readonly row: number,
    protected readonly reg: SpriteRegistry,
    scene: Phaser.Scene,
    layers: Layers,
    protected readonly layer: Phaser.GameObjects.Layer = layers.rows[row],
  ) {
    this.shadowInv = 1 / reg.get(RENDER_KEYS.shadow).scale;
    this.whiteInv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
    this.shadow = addImage(scene, layers.byName.shadows, reg.get(RENDER_KEYS.shadow).frame);
    this.shadow.setTint(0x000000);
    this.shadow.visible = false;
    // On the row's own pip layer, not the shared markers layer: a nearer tank must cover the pips of the men behind it.
    const pipLayer = layers.pips[row];
    this.pipBack = addImage(scene, pipLayer, reg.get(RENDER_KEYS.whiteTL).frame);
    this.pipBack.setTint(U.pipBack);
    this.pipBack.visible = false;
    for (let i = 0; i < U.pips; i++) {
      const p = addImage(scene, pipLayer, reg.get(RENDER_KEYS.whiteTL).frame);
      p.visible = false;
      this.pips.push(p);
      this.pipTint.push(-1);
    }
  }

  /** Draw under every other unit of the row (a body on the ground), keeping the parts' own order. */
  sendBack(): void {
    for (let i = this.images.length - 1; i >= 0; i--) this.layer.sendToBack(this.images[i]);
  }

  /** Draw over every other unit of the row (a fresh unit must never hide under a lingering body). */
  bringFront(): void {
    for (let i = 0; i < this.images.length; i++) this.layer.bringToTop(this.images[i]);
  }

  /** Ease the drawn facing toward `facing`: a quick turn on the spot instead of a one-frame mirror flip. */
  stepTurn(dt: number, time: number): void {
    const target = this.facing > 0 ? 0 : 1;
    const p = this.turnP;
    if (p !== target) {
      const step = dt > 0 && time > 0 ? dt / time : 1;
      this.turnP = target > p ? Math.min(target, p + step) : Math.max(target, p - step);
    }
    const e = this.turnP * this.turnP * (3 - 2 * this.turnP);
    this.turnK = Math.cos(Math.PI * e);
  }

  snapTurn(): void {
    this.turnP = this.facing > 0 ? 0 : 1;
    this.turnK = this.facing;
  }

  abstract setShown(on: boolean): void;
  abstract applyAlpha(a: number): void;
  /** Muzzle position in world space (from last frame's pose), written to out. */
  abstract muzzle(out: { x: number; y: number }): void;
  /** Direction the weapon points in world space (not normalised), written to out. */
  abstract muzzleDir(out: { x: number; y: number }): void;

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
      const tint = i < filled ? U.pipFill[this.side] : U.pipEmpty;
      if (this.pipTint[i] !== tint) {
        p.setTint(tint);
        this.pipTint[i] = tint;
      }
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
  readonly keys: string[] = [];
  readonly inv: number[] = [];
  readonly anim: FigureAnim;
  readonly input: FigureInput;
  readonly parts: FigurePart[];
  readonly death: FigureDeath = { variant: 'crumple', time: 0, dir: -1 };
  /** Index of this body's blood pool in UnitViews.blood, or -1 (see ./blood.ts). */
  blood = -1;
  appliedShade = 1;
  /** Seconds into a hop out of an APC (negative = still waiting aboard; >= RENDER.apc.hopTime = done) and its deck height (wu). */
  hopAge: number = RENDER.apc.hopTime;
  hopDeck = 0;
  /** How this sapper moves supplies (upgrade looks); 'crate' for everyone else. */
  haul: SapperStyle = 'crate';
  /** The handcart or the supply truck of a sapper's haul (made the first time a view needs one). */
  private vehicle: Img | null = null;
  private vehicleKey = '';
  private vehicleInv = 1;
  private readonly scene: Phaser.Scene;
  private readonly layers: Layers;
  /** A two-man team's second man (src/data/eras.ts TEAM_MATES), drawn just behind this one; made when first needed. */
  private mate: FigureView | null = null;
  private mateOn = false;
  private readonly mateDeath: FigureDeath = { variant: 'crumple', time: 0, dir: -1 };

  constructor(row: number, reg: SpriteRegistry, scene: Phaser.Scene, layers: Layers) {
    super(row, reg, scene, layers);
    this.scene = scene;
    this.layers = layers;
    const first = reg.get(RENDER_KEYS.white);
    for (let i = 0; i < FIGURE_PART_COUNT; i++) {
      const img = addImage(scene, this.layer, first.frame);
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
    inp.stepping = false;
    inp.victory = false;
    inp.struggling = false;
    inp.fired = false;
    inp.hit = false;
    inp.death = null;
    this.bodyH = VIEW.figureHeight;
    this.haul = 'crate';
    if (this.vehicle) this.vehicle.visible = false;
    this.applyShade(1);
    this.mateOn = false;
    if (this.mate) this.mate.setShown(false);
  }

  /** Make this a two-man team (call after reset): the second man is a `kind` figure, returned for the caller to dress. */
  enableMate(kind: UnitKind, faction: FactionId, seed: number): FigureAnim {
    if (!this.mate) this.mate = new FigureView(this.row, this.reg, this.scene, this.layers);
    this.mate.reset(kind, faction, seed);
    this.mate.faction = faction;
    this.mateOn = true;
    return this.mate.anim;
  }

  /** True while a second man is drawn with this one (for tests and the debug hooks). */
  hasMate(): boolean {
    return this.mateOn;
  }

  override sendBack(): void {
    super.sendBack();
    if (this.mateOn && this.mate) this.mate.sendBack();
  }

  override bringFront(): void {
    // The second man stands behind the gunner: under him in the row's layer.
    if (this.mateOn && this.mate) this.mate.bringFront();
    super.bringFront();
  }

  /**
   * Draw the second man: a step behind the gunner, on his feet line, facing his way. He goes where the gunner goes,
   * covers him with his rifle while he aims and fires, and falls a moment after him.
   */
  private drawMate(dt: number): void {
    const m = this.mate;
    if (!m) return;
    const src = this.input;
    const dir = this.turnK < 0 ? -1 : 1;
    m.x = this.x - dir * U.mateBehind * this.s;
    m.y = this.y;
    m.sink = this.sink;
    m.s = this.s;
    m.turnK = this.turnK;
    m.alpha = this.alpha;
    m.shown = true;
    const inp = m.input;
    const act = src.action;
    inp.action = act === 'fire' || act === 'aim' ? 'aim' : act === 'move' || act === 'idle' ? act : 'idle';
    inp.speed = src.speed;
    inp.stepping = src.stepping;
    inp.moved = src.moved;
    inp.inTrench = src.inTrench;
    inp.carrying = false;
    inp.controlled = false;
    inp.victory = src.victory;
    inp.struggling = src.struggling;
    inp.fired = false;
    inp.hit = src.hit;
    if (src.death) {
      const d = this.mateDeath;
      d.variant = 'crumple';
      d.dir = src.death.dir;
      d.time = Math.max(0, src.death.time - U.mateDeathLag);
      inp.death = d;
    } else inp.death = null;
    m.draw(dt);
  }

  /** A sapper's haul from the upgrade looks (call after reset): a bigger load, a handcart or a supply truck. */
  setHaul(haul: SapperStyle, faction: FactionId): void {
    this.haul = haul;
    setFigureCrateKey(this.anim, haul === 'bigLoad' ? bigLoadKey(faction) : null);
    setFigurePushing(this.anim, haul === 'handcart');
    if (haul === 'handcart' || haul === 'truck') {
      if (!this.vehicle) {
        this.vehicle = addImage(this.scene, this.layer, this.reg.get(RENDER_KEYS.white).frame);
        this.vehicleKey = '';
      }
      // Drawn in front of the figure (the truck stands alone; the cart is pushed ahead of him).
      this.layer.bringToTop(this.vehicle);
    }
  }

  private showVehicle(key: string, x: number, y: number, dir: number): void {
    const img = this.vehicle;
    if (!img) return;
    if (key !== this.vehicleKey) {
      const fr = this.reg.get(key);
      img.setFrame(fr.frame);
      this.vehicleKey = key;
      this.vehicleInv = 1 / fr.scale;
    }
    img.visible = true;
    img.x = x;
    img.y = y;
    img.scaleX = dir * this.s * this.vehicleInv;
    img.scaleY = this.s * this.vehicleInv;
    img.alpha = this.appliedAlpha;
    if (this.appliedShade === 1) img.clearTint();
    else {
      const c = Math.round(this.appliedShade * 255);
      img.setTint((c << 16) | (c << 8) | c);
    }
  }

  setShown(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) {
      for (const img of this.images) img.visible = false;
      if (this.vehicle) this.vehicle.visible = false;
      this.shadow.visible = false;
      this.hidePips();
      if (this.mate) this.mate.setShown(false);
    }
  }

  applyAlpha(a: number): void {
    if (Math.abs(a - this.appliedAlpha) < 0.004) return;
    this.appliedAlpha = a;
    // The light rim fades much faster than the black body, so a half-faded figure is a dark ghost, not an outline drawing.
    const rim = a * a * a;
    const imgs = this.images;
    for (let i = 0; i < imgs.length; i++) imgs[i].alpha = i < FIGURE_RIM_PARTS ? rim : a;
    if (this.mateOn && this.mate) this.mate.applyAlpha(a);
  }

  /** Colour multiplier, 1 = normal, 0 = a black silhouette (a unit in the dark of its HQ doorway). */
  applyShade(k: number): void {
    if (this.mateOn && this.mate) this.mate.applyShade(k);
    const q = k >= 0.995 ? 1 : Math.round(k * 32) / 32;
    if (q === this.appliedShade) return;
    this.appliedShade = q;
    const c = Math.round(q * 255);
    const tint = (c << 16) | (c << 8) | c;
    for (const img of this.images) {
      if (q === 1) img.clearTint();
      else img.setTint(tint);
    }
  }

  /** Update the animation by dt and copy the parts onto the images. */
  draw(dt: number): void {
    updateFigure(this.anim, this.input, dt);
    const x = this.x;
    const y = this.y + this.sink;
    const s = this.s;
    const dir = this.turnK < 0 ? -1 : 1;
    if (this.haul === 'truck') {
      // The sapper drives a supply truck: no figure, a truck rocking gently as it rolls.
      for (let i = 0; i < FIGURE_PART_COUNT; i++) this.images[i].visible = false;
      const key = truckKey(this.faction, this.input.death ? 'wreck' : this.input.carrying ? 'loaded' : 'empty');
      const bob = this.input.death ? 0 : Math.sin(x * U.truckBobFreq) * U.truckBob * s;
      this.showVehicle(key, x, y + bob, dir);
      this.placeShadow(SUPPLY_TRUCK_LAYOUT.length * U.truckShadowK, U.figureShadowH);
      return;
    }
    if (this.mateOn && this.mate) this.drawMate(dt);
    layoutFigure(this.anim, this.parts);
    if (this.haul === 'handcart') {
      if (this.input.death) {
        if (this.vehicle) this.vehicle.visible = false;
      } else this.showVehicle(cartKey(this.faction, this.input.carrying), x + dir * SAPPER_CART_HANDLE.x * s, this.y, dir);
    }
    // Never squash to nothing mid-turn: the figure is at its narrowest for a frame or two, then mirrors.
    const k = this.turnK < 0 ? Math.min(this.turnK, -U.turnMinK) : Math.max(this.turnK, U.turnMinK);
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
      const q = s * this.inv[i];
      img.visible = true;
      placePart(img, x, y, s, k, p.x, p.y, p.rotation, p.scaleX * q, p.scaleY * q);
    }
    this.placeShadow(U.figureShadowW, U.figureShadowH);
  }

  /** World x of the middle of the torso (hip to chest) as last drawn: where a body's blood pool lies. */
  torsoX(): number {
    const j = this.anim.joints;
    const k = this.turnK < 0 ? Math.min(this.turnK, -U.turnMinK) : Math.max(this.turnK, U.turnMinK);
    return this.x + k * this.s * 0.5 * (j[J_HIP * 2] + j[J_CHEST * 2]);
  }

  muzzle(out: { x: number; y: number }): void {
    out.x = this.x + this.turnK * this.s * this.anim.muzzleX;
    out.y = this.y + this.sink + this.s * this.anim.muzzleY;
  }

  muzzleDir(out: { x: number; y: number }): void {
    out.x = (this.turnK < 0 ? -1 : 1) * this.anim.muzzleDX;
    out.y = this.anim.muzzleDY;
  }
}

/** Number of tank part images: track, wheels, hull, barrel, turret, husk. */
const TANK_IMAGES = TANK_MAX_WHEELS + 5;
/** One more image after those: an APC's passengers over the side. */
const PASSENGER_IMAGE = TANK_IMAGES;

/** The hull, turret and gun keys a vehicle draws (its upgrade gear, or the plain parts). */
interface PartKeys {
  readonly hull: string;
  readonly turret: string;
  readonly barrel: string;
  readonly gunExtra: number;
}

/** Plain part keys of the looks without upgrade gear (built once). */
const PLAIN_KEYS = new Map<VehicleLook, PartKeys>();
function plainKeys(look: VehicleLook): PartKeys {
  let k = PLAIN_KEYS.get(look);
  if (!k) {
    const K = TANK_KEYS[look];
    k = { hull: K.hull, turret: K.turret, barrel: K.barrel, gunExtra: 0 };
    PLAIN_KEYS.set(look, k);
  }
  return k;
}

class TankView extends UnitViewBase {
  readonly keys: string[] = [];
  look: VehicleLook = 'churchill';
  /** Hull, turret and gun keys of this tank's upgrade gear (the look's normal keys at level 0). */
  gear: PartKeys = tankGearKeys('churchill', GEAR_NONE);
  /** APC: its squad is still aboard (helmets over the side); cleared by the apcUnload event. */
  loaded = false;
  readonly tank: TankState = { look: 'churchill', distance: 0, turretAim: 0, recoil: 0, hullRock: 0 };
  readonly pose: TankPose = createTankPose();
  inv = 1;
  /** Sprung hull: vertical offset (wu, + = down) and pitch spring (fraction of rockMax) with its velocity. */
  bob = 0;
  rock = 0;
  rockV = 0;
  /** Smoothed ground speed (wu/s, + = forward) for the squat and dip on starting and stopping. */
  speed = 0;
  /** Height (wu) the whole tank is lifted by the lips of a trench it is driving over, and the extra hull pitch. */
  lift = 0;
  liftPitch = 0;
  /** True while the images sit in the layer above the trench parapets (see setOver). */
  over = false;

  /** Move the images above the trench parapets and wire strands (crossing a trench) or back into the row layer. */
  setOver(on: boolean, overLayer: Phaser.GameObjects.Layer): void {
    if (on === this.over) return;
    this.over = on;
    const to = on ? overLayer : this.layer;
    for (let i = 0; i < this.images.length; i++) to.add(this.images[i]);
  }

  /**
   * The ground under the tracks while it drives over trenches: a hump at each lip (the tank bridges the trench
   * itself), giving the whole tank a lift and the hull a pitch as it noses over.
   */
  groundOver(trenches: BattleState['trenches'], wires: BattleState['wires']): boolean {
    const T = U.tank;
    const L = TANK_LAYOUT[this.look];
    const half = L.length * 0.42 * this.s;
    const front = this.x + this.facing * half;
    const rear = this.x - this.facing * half;
    let hf = 0;
    let hr = 0;
    let over = false;
    for (let t = 0; t < trenches.length; t++) {
      const tr = trenches[t];
      const w = tr.width / 2;
      if (this.x + L.length * 0.6 * this.s < tr.x - w || this.x - L.length * 0.6 * this.s > tr.x + w) continue;
      over = true;
      // A building's span (its slot record): the tank passes in front of the facade or the rubble, with no lip to climb.
      if (tr.building >= 0) continue;
      for (let e = -1; e <= 1; e += 2) {
        const lip = tr.x + e * w;
        hf = Math.max(hf, T.lipBump * Math.max(0, 1 - Math.abs(front - lip) / T.lipWidth));
        hr = Math.max(hr, T.lipBump * Math.max(0, 1 - Math.abs(rear - lip) / T.lipWidth));
      }
    }
    this.lift = Math.max(hf, hr) * 0.75;
    this.liftPitch = Math.atan2(hf - hr, 2 * half) / L.rockMax;
    for (let i = 0; i < wires.length && !over; i++) {
      const wr = wires[i];
      over = Math.abs(wr.x - this.x) < (wr.width + L.length * this.s) / 2;
    }
    return over;
  }

  /** The main gun's reload bar (player's own tanks only; showReload). */
  readonly reloadBack: Img;
  readonly reloadFill: Img;
  reloadShown = false;

  constructor(row: number, reg: SpriteRegistry, scene: Phaser.Scene, layers: Layers) {
    super(row, reg, scene, layers);
    const bar = reg.get(RENDER_KEYS.whiteTL).frame;
    this.reloadBack = addImage(scene, layers.pips[row], bar);
    this.reloadBack.setTint(U.reloadBar.back);
    this.reloadBack.visible = false;
    this.reloadFill = addImage(scene, layers.pips[row], bar);
    this.reloadFill.setTint(U.reloadBar.fill);
    this.reloadFill.visible = false;
    const first = reg.get(RENDER_KEYS.white);
    for (let i = 0; i <= PASSENGER_IMAGE; i++) {
      const img = addImage(scene, this.layer, first.frame);
      img.visible = false;
      this.images.push(img);
      this.keys.push('');
    }
  }

  /** `look` = the era's or the force's vehicle look (src/data/eras.ts unitVehicleLook); default = the nation's. */
  reset(kind: UnitKind, faction: FactionId, look: VehicleLook = vehicleLookOf(kind, faction)): void {
    this.look = look;
    this.tank.look = look;
    this.tank.distance = 0;
    this.tank.turretAim = 0;
    this.tank.recoil = 0;
    this.tank.hullRock = 0;
    this.bob = 0;
    this.rock = 0;
    this.rockV = 0;
    this.speed = 0;
    this.loaded = TANK_KEYS[look].passengers !== null;
    this.bodyH = TANK_LAYOUT[look].height;
    this.inv = 1 / this.reg.get(TANK_KEYS[look].hull).scale;
    this.setGear(GEAR_NONE);
    // The gear atlas is rebuilt per battle: never trust a cached frame across a reset.
    this.keys.fill('');
  }

  /** Draw with these gear levels; variants missing from the atlas (setLooks not called for them) fall back to level 0. */
  setGear(gear: GearLevels): void {
    const look = this.look;
    if (!isGearLook(look)) {
      this.gear = plainKeys(look);
    } else {
      const g = tankGearKeys(look, gear);
      const ok = this.reg.has(g.hull) && this.reg.has(g.turret) && this.reg.has(g.barrel);
      this.gear = ok ? g : tankGearKeys(look, GEAR_NONE);
    }
    this.tank.gunExtra = this.gear.gunExtra;
  }

  setShown(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    if (!on) {
      for (const img of this.images) img.visible = false;
      this.shadow.visible = false;
      this.hidePips();
      this.hideReload();
    }
  }

  hideReload(): void {
    if (!this.reloadShown) return;
    this.reloadShown = false;
    this.reloadBack.visible = false;
    this.reloadFill.visible = false;
  }

  /** The reload bar centred over the tank, its bottom at `bottomY`, filled to `frac` (0 = just fired). */
  showReload(frac: number, bottomY: number): void {
    const R = U.reloadBar;
    const s = this.s;
    const k = this.whiteInv;
    const w = R.w * s;
    const h = R.h * s;
    const x0 = this.x - w / 2;
    const y0 = bottomY - h;
    const pad = 0.6 * s;
    const a = this.alpha * R.alpha;
    const back = this.reloadBack;
    back.visible = true;
    back.x = x0 - pad;
    back.y = y0 - pad;
    back.scaleX = (w + pad * 2) * k;
    back.scaleY = (h + pad * 2) * k;
    back.alpha = a;
    const fill = this.reloadFill;
    fill.visible = true;
    fill.x = x0;
    fill.y = y0;
    fill.scaleX = Math.max(0.001, w * frac) * k;
    fill.scaleY = h * k;
    fill.alpha = a;
    this.reloadShown = true;
  }

  applyAlpha(a: number): void {
    if (Math.abs(a - this.appliedAlpha) < 0.004) return;
    this.appliedAlpha = a;
    for (const img of this.images) img.alpha = a;
  }

  /** Place part i; `sprung` parts (hull, turret, gun) ride the suspension bob, the running gear stays on the ground. */
  private put(i: number, key: string, px: number, py: number, rot: number, sprung: boolean): void {
    const img = this.images[i];
    if (key !== this.keys[i]) {
      img.setFrame(this.reg.get(key).frame);
      this.keys[i] = key;
    }
    const s = this.s;
    const k = this.turnK < 0 ? Math.min(this.turnK, -U.tankTurnMinK) : Math.max(this.turnK, U.tankTurnMinK);
    img.visible = true;
    placePart(img, this.x, this.y + ((sprung ? this.bob : 0) - this.lift) * s, s, k, px, py, rot, s * this.inv, s * this.inv);
  }

  /**
   * Suspension (view only): the hull bobs over the ground's bumps while it rolls, squats on pulling away and dips
   * its nose on stopping, and rocks back on a damped spring when the gun fires.
   */
  stepSuspension(velX: number, dt: number): void {
    const T = U.tank;
    const tk = this.tank;
    if (dt <= 0) return;
    const fwd = velX * this.facing;
    const prev = this.speed;
    this.speed += (fwd - prev) * (1 - Math.exp(-dt / T.speedEase));
    const accel = (this.speed - prev) / dt;
    const roll = Math.min(1, Math.abs(this.speed) / T.bobFullSpeed);
    const d = tk.distance;
    this.bob = roll * T.bobAmp * (Math.sin(d * T.bobFreq) * 0.6 + Math.sin(d * T.bobFreq * 2.7 + 1.3) * 0.4);
    // Damped spring on the hull pitch: forced by acceleration (nose up pulling away) and kicked by the gun.
    const w = T.rockFreq;
    const force = T.accelRock * accel - w * w * this.rock - 2 * T.rockDamping * w * this.rockV;
    this.rockV += force * dt;
    if (this.fired) this.rockV += T.fireKick;
    this.rock += this.rockV * dt;
    this.rock = Math.max(-1, Math.min(1, this.rock));
    tk.hullRock = this.rock + roll * T.rollRock * Math.sin(d * T.bobFreq * 1.7 + 0.4) + this.liftPitch;
  }

  draw(dead: boolean): void {
    const keys = TANK_KEYS[this.look];
    const L = TANK_LAYOUT[this.look];
    const img = this.images;
    if (dead) {
      for (let i = 0; i < TANK_IMAGES - 1; i++) img[i].visible = false;
      img[PASSENGER_IMAGE].visible = false;
      this.put(TANK_IMAGES - 1, keys.husk, 0, 0, 0, false);
      this.placeShadow(L.length * U.tankShadowPad, U.tankShadowH);
      return;
    }
    img[TANK_IMAGES - 1].visible = false;
    const pose = layoutTank(this.tank, this.pose);
    let i = 0;
    this.put(i++, keys.track[pose.trackFrame], pose.track.x, pose.track.y, pose.track.rot, false);
    for (let w = 0; w < TANK_MAX_WHEELS; w++, i++) {
      if (w < pose.wheelCount) {
        const xf = pose.wheels[w];
        this.put(i, keys.wheels[w], xf.x, xf.y, xf.rot, false);
      } else {
        img[i].visible = false;
      }
    }
    const g = this.gear;
    this.put(i++, g.hull, pose.hull.x, pose.hull.y, pose.hull.rot, true);
    this.put(i++, g.barrel, pose.barrel.x, pose.barrel.y, pose.barrel.rot, true);
    this.put(i, g.turret, pose.turret.x, pose.turret.y, pose.turret.rot, true);
    const pk = TANK_KEYS[this.look].passengers;
    if (pk !== null && this.loaded) this.put(PASSENGER_IMAGE, pk, pose.passengers.x, pose.passengers.y, pose.passengers.rot, true);
    else img[PASSENGER_IMAGE].visible = false;
    this.placeShadow(L.length * U.tankShadowPad, U.tankShadowH);
  }

  muzzle(out: { x: number; y: number }): void {
    out.x = this.x + this.turnK * this.s * this.pose.muzzle.x;
    out.y = this.y + this.s * (this.pose.muzzle.y + this.bob - this.lift);
  }

  muzzleDir(out: { x: number; y: number }): void {
    out.x = this.turnK < 0 ? -1 : 1;
    out.y = 0;
  }
}

export type UnitView = FigureView | TankView;

/** The APC and the light tank are drawn as the faction's tank until the units job gives them their own art. */
function isVehicle(kind: UnitKind): boolean {
  return kind === 'tank' || kind === 'heavyTank' || kind === 'apc' || kind === 'lightTank';
}

/**
 * How far a unit's depth row and formation offset apply (0..1): 1 out in the field, easing to 0 at its own HQ door,
 * so units file out of the doorway and spread to their rows, and gather into single file to go back in.
 */
function doorSpreadAt(simX: number, u: UnitState, state: BattleState): number {
  const hq = state.sides[u.side].hq;
  if (!hq || isVehicle(u.kind)) return 1;
  const t = Math.min(1, Math.abs(simX - hq.doorX) / U.doorFunnel);
  return t * t * (3 - 2 * t);
}

function doorSpread(u: UnitState, state: BattleState): number {
  return doorSpreadAt(u.prevX, u, state);
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
  /** The same ring above the trench parapets, for a man down in a trench (the low one would be hidden). */
  private readonly ringHigh: Img;
  private readonly ringScale: number;
  /** Scratch for the crowd spread: live figure views per side, sorted by x, and their spread positions. */
  private readonly lanes: FigureView[][] = [[], []];
  private relaxed = new Float64Array(64);
  /** Looks of each side (upgrade gear), from setLooks; null = no gear. */
  private readonly looks: (SideLooks | null)[] = [null, null];
  /** The battle's mission, for the era looks by date (src/data/eras.ts); null = every nation's defaults. */
  private mission: MissionDef | null = null;

  /** The mission whose date and climate pick the units' era looks (call once per battle, after reset). */
  setMission(mission: MissionDef | null): void {
    this.mission = mission;
  }

  private eraOf(faction: FactionId): ResolvedEra {
    return this.mission ? missionEra(this.mission, faction) : resolveEra(faction, null);
  }
  /** Blood pools under the bodies of soldiers killed by gunfire (the "Show blood" setting). */
  readonly blood: BloodPools;
  /** Whose health pips are drawn (the enemy's are hidden unless revealed); the battle view hands in its own. */
  hpReveal = new HpReveal();
  /** Health pips drawn last frame, per side. */
  readonly pipsDrawn: [number, number] = [0, 0];
  /** The last APC unload per side: where, when (battle time), its deck height and how many men have hopped out since. */
  private readonly unloadX: [number, number] = [0, 0];
  private readonly unloadAt: [number, number] = [-1e9, -1e9];
  private readonly unloadDeck: [number, number] = [0, 0];
  private readonly unloadCount: [number, number] = [0, 0];

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
    this.ringHigh = addImage(scene, layers.byName.markers, ring.frame);
    this.ringHigh.visible = false;
    this.ringScale = RENDER.marker.ringScale / ring.scale;
    const pool = reg.get(RENDER_KEYS.blood);
    const images: Img[] = [];
    for (let i = 0; i < RENDER.blood.maxPools; i++) {
      const img = addImage(scene, layers.blood[0], pool.frame);
      img.visible = false;
      images.push(img);
    }
    this.blood = new BloodPools(images, (img: PoolImage, row: number) => layers.blood[row].add(img as Img), 1 / pool.scale);
  }

  /** Start a battle: drop every view, and every side's looks (call setLooks again after this). */
  reset(seed: number): void {
    for (let i = 0; i < this.bySlot.length; i++) {
      const v = this.bySlot[i];
      if (v) this.release(v);
    }
    this.bySlot = [];
    while (this.dying.length > 0) this.release(this.dying[this.dying.length - 1]);
    this.looks[0] = null;
    this.looks[1] = null;
    this.reg.removeGroup(GEAR_GROUP);
    this.seed = seed;
    this.blood.reset();
    this.controlledId = -1;
    this.ring.visible = false;
    this.ringHigh.visible = false;
  }

  /**
   * The looks one side shows (its Quartermaster upgrades), or null for none. Call once per battle after reset() and
   * before the first update: units of that side created from then on wear the gear of looks.gear[kind] (level 0 for
   * kinds not listed). Builds the tank gear sprites the side needs.
   */
  setLooks(side: Side, looks: SideLooks | null): void {
    this.looks[side] = looks;
    if (!looks) return;
    const f = looks.faction;
    const specs: SpriteSpec[] = [];
    for (const kind of GEAR_VEHICLE_KINDS) {
      const look = vehicleLookOf(kind, f);
      if (isGearLook(look)) specs.push(...tankGearSpecs(look, this.gearOf(side, kind)));
    }
    // The call-in planes' gear (PlanePool picks these keys up when the side's plane flies).
    for (const kind of PLANE_KINDS) specs.push(...planeGearSpecs(kind, f, planeGearOf(looks, kind)));
    if (specs.length > 0) this.reg.addAtlas(GEAR_GROUP, specs, VIEW.textureScale, RENDER.atlasMaxSize);
  }

  private gearOf(side: Side, kind: UnitKind): GearLevels {
    return this.looks[side]?.gear[kind] ?? GEAR_NONE;
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

  private acquire(u: UnitState, state: BattleState): UnitView {
    const row = Math.max(0, Math.min(VIEW.rows - 1, u.row | 0));
    let v: UnitView;
    if (isVehicle(u.kind)) {
      const pool = this.tankPool[row];
      const tv = pool.pop() ?? new TankView(row, this.reg, this.scene, this.layers);
      tv.reset(u.kind, u.faction, unitVehicleLook(this.eraOf(u.faction), u.kind as VehicleKind, u.look));
      tv.setGear(this.gearOf(u.side, u.kind));
      v = tv;
    } else {
      const pool = this.figurePool[row];
      const fv = pool.pop() ?? new FigureView(row, this.reg, this.scene, this.layers);
      fv.reset(u.kind, u.faction, mixSeed(this.seed ^ U.seedSalt, u.id));
      // After the reset (which goes back to level 0): this unit's upgrade gear, then its era's cap, clothing and arms
      // (or its force's infantry look: the Romanian line).
      setFigureGear(fv.anim, this.gearOf(u.side, u.kind));
      const era = this.eraOf(u.faction);
      const inf = infantryLookOf(u.look);
      setFigureHeadgear(fv.anim, inf ? inf.headgear : (era.headgear[u.kind] ?? null));
      setFigureClothing(fv.anim, inf ? inf.clothing : (era.clothing[u.kind] ?? null));
      setFigureWeapon(fv.anim, era.weapon[u.kind] ?? null);
      setFigureRocketItem(fv.anim, era.rocketItem[u.kind] === 'molotov' ? MOLOTOV_KEY : null);
      // A two-man team (the PTRD and its number two): the second man in the gunner's cap and coat, with his own rifle.
      const mateKind = inf ? null : teamMateOf(era, u.kind);
      if (mateKind !== null) {
        const ma = fv.enableMate(mateKind, u.faction, mixSeed(this.seed ^ U.mateSalt, u.id));
        setFigureGear(ma, this.gearOf(u.side, mateKind));
        setFigureHeadgear(ma, era.headgear[u.kind] ?? null);
        setFigureClothing(ma, era.clothing[u.kind] ?? null);
        setFigureWeapon(ma, era.weapon[mateKind] ?? null);
      }
      const looks = this.looks[u.side];
      if (u.kind === 'sapper' && looks) fv.setHaul(lookStyle(looks, 'sapper'), u.faction);
      // Firing line in two tiers: the near ranks mostly kneel to fire, the far ranks mostly stand behind them.
      fv.anim.altAim = mixSeed(this.seed ^ U.kneelSalt, u.id) / 4294967296 < U.kneelByRow[row];
      // Climbing out of an APC that just unloaded here: a hop down from its deck, one man after another.
      const k = u.side === 1 ? 1 : 0;
      const A = RENDER.apc;
      if (state.time - this.unloadAt[k] <= A.window && Math.abs(u.x - this.unloadX[k]) <= A.radius) {
        fv.hopAge = -A.stagger * this.unloadCount[k]++;
        fv.hopDeck = this.unloadDeck[k];
      } else {
        fv.hopAge = A.hopTime;
      }
      v = fv;
    }
    v.state = STATE_LIVE;
    v.unitId = u.id;
    v.slot = u.index;
    v.side = u.side;
    v.kind = u.kind;
    v.faction = u.faction;
    v.jitter = isVehicle(u.kind) ? 0 : U.rowStagger[row] + (mixSeed(this.seed, u.id) / 4294967296 - 0.5) * 2 * U.xJitter;
    v.simX = u.prevX;
    v.crowd = 0;
    v.shuffling = false;
    v.x = u.prevX + v.jitter * doorSpread(u, state);
    v.lastX = v.x;
    v.y = VIEW.groundY + VIEW.rowDy[row] * doorSpread(u, state);
    v.s = VIEW.rowScale[row];
    v.facing = u.facing >= 0 ? 1 : -1;
    v.snapTurn();
    v.deadTime = 0;
    v.sink = 0;
    v.trenchW = 0;
    v.wireW = 0;
    v.packW = 0;
    v.alpha = 1;
    v.appliedAlpha = -1;
    v.fired = false;
    v.hit = false;
    v.shown = true;
    v.setShown(false);
    v.bringFront();
    return v;
  }

  private release(v: UnitView): void {
    v.setShown(false);
    if (v instanceof FigureView && v.blood >= 0) {
      this.blood.end(v.blood, v.unitId);
      v.blood = -1;
    }
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
    if (v instanceof TankView) {
      v.setOver(false, this.layers.byName.vehicleOver);
      this.tankPool[v.row].push(v);
    }
    else this.figurePool[v.row].push(v);
  }

  /** The commander gave an order: he points the way while his bubble shows. */
  onSpeech(slot: number, unitId: number): void {
    const v = this.liveView(slot, unitId);
    if (v instanceof FigureView) setFigurePointing(v.anim, RENDER.speech.pointTime);
  }

  /** An APC unloaded at x: it shows empty, and the men who appear next to it hop down from its deck (view only). */
  onApcUnload(slot: number, unitId: number, side: number, x: number, time: number): void {
    const v = this.liveView(slot, unitId);
    let deck: number = RENDER.apc.jump;
    if (v instanceof TankView) {
      v.loaded = false;
      const pass = TANK_LAYOUT[v.look].passengers;
      if (pass) deck = -pass.at.y;
    }
    const k = side === 1 ? 1 : 0;
    this.unloadX[k] = x;
    this.unloadAt[k] = time;
    this.unloadDeck[k] = deck;
    this.unloadCount[k] = 0;
  }

  /** A unit died: its view leaves the slot and plays the fall. */
  onDied(slot: number, unitId: number, cause: DamageType | null, dir: number, x: number): void {
    const v = this.liveView(slot, unitId);
    if (!v) return;
    this.bySlot[slot] = null;
    v.state = STATE_DYING;
    v.deadTime = 0;
    // Fall where the body was drawn (it may stand off its sim x); only snap if it was never drawn near there.
    if (Math.abs(v.simX - x) > U.xJitter) v.x = x + v.jitter;
    this.dying.push(v);
    v.hidePips();
    // A body on the ground lies under everyone still standing in its row.
    if (v instanceof TankView) {
      v.setOver(false, this.layers.byName.vehicleOver);
      v.hideReload();
    }
    v.sendBack();
    if (v instanceof FigureView) {
      const fromFront = dir !== 0 && dir === -v.facing;
      v.death.variant = chooseDeathVariant(cause ?? 'bullet', fromFront, this.rng());
      v.blood = this.blood.onDeath(unitId, v.row, v.kind, cause, v.haul === 'truck');
      // Where it will lie (hidden until the fall is over), so it has a place even while the body is off screen.
      if (v.blood >= 0) this.blood.place(v.blood, unitId, 0, v.x, v.y + v.sink, v.s, 1);
      v.death.time = 0;
      v.death.dir = dir === 0 ? -1 : dir * v.facing;
      v.input.death = v.death;
      v.input.action = 'idle';
      v.input.speed = 0;
      v.input.moved = 0;
    }
  }

  /**
   * A unit fired `weapon`. A tank's hull rocks and its barrel recoils for its main gun only: the coaxial machine gun
   * chattering between main-gun rounds must not look like a shot of the cannon.
   */
  onFired(slot: number, unitId: number, weapon: string | null = null): void {
    const v = this.liveView(slot, unitId);
    if (!v) return;
    if (v instanceof TankView && v.kind !== 'apc' && weapon !== null && WEAPONS[weapon]?.delivery === 'hitscan') return;
    v.fired = true;
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
    this.pipsDrawn[0] = 0;
    this.pipsDrawn[1] = 0;
    this.hpReveal.update(state.time);
    const over = state.over;
    for (let i = 0; i < n; i++) {
      const u = units[i];
      if (u.alive && !this.bySlot[i]) this.bySlot[i] = this.acquire(u, state);
    }
    this.spreadCrowds(state, dt);
    for (let i = 0; i < n; i++) {
      const u = units[i];
      const v = u.alive ? this.bySlot[i] : null;
      if (v) this.updateLive(v, u, state, alpha, dt, camLeft, camRight, over && state.winner === u.side);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      this.updateDying(this.dying[i], dt, camLeft, camRight);
    }
    this.capBodies();
    this.placeRing();
  }

  /**
   * More than RENDER.units.maxBodies bodies and husks lying still: the one closest to its fade (whose fall is over)
   * starts fading now. One per frame, so a barrage's dead thin out gradually.
   */
  private capBodies(): void {
    const list = this.dying;
    if (list.length <= U.maxBodies) return;
    let lying = 0;
    let oldest: UnitView | null = null;
    let best = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const tank = v instanceof TankView;
      const still = tank ? 0 : (v as FigureView).anim.deathEnd;
      const t = v.deadTime - still - (tank ? U.huskLinger : U.corpseLinger);
      if (t >= 0) continue;
      lying++;
      if (v.deadTime >= still && t > best) {
        best = t;
        oldest = v;
      }
    }
    if (lying > U.maxBodies && oldest) oldest.deadTime -= best;
  }

  /**
   * Crowd spread (view only): figures of one side (all depth rows together) that stand closer than U.crowdGap along
   * x are spread apart so a packed firing line reads as men rather than one black mass. The leading man keeps his
   * place and the rest open out behind him (up to U.crowdMax), so the front of a line is always where the sim has it.
   * A walking unit eases toward its spread place; a standing one that is badly crowded steps aside at
   * U.crowdShuffle wu/s with its legs walking (never sliding on the spot).
   */
  private spreadCrowds(state: BattleState, dt: number): void {
    const lanes = this.lanes;
    for (const lane of lanes) lane.length = 0;
    const units = state.units;
    for (let i = 0; i < this.bySlot.length && i < state.unitCount; i++) {
      const v = this.bySlot[i];
      if (!(v instanceof FigureView) || units[i].inside) continue;
      v.crowdTarget = v.simX + v.jitter;
      const lane = lanes[v.side];
      // Insertion keeps the lane sorted by x (nearly sorted already from frame to frame).
      let k = lane.length;
      lane.push(v);
      while (k > 0 && lane[k - 1].crowdTarget > v.crowdTarget) {
        lane[k] = lane[k - 1];
        k--;
      }
      lane[k] = v;
    }
    const gap = U.crowdGap;
    const max = U.crowdMax;
    const ease = dt > 0 ? 1 - Math.exp(-dt / U.crowdEase) : 0;
    for (let side = 0; side < 2; side++) {
      const lane = lanes[side];
      const m = lane.length;
      if (m === 0) continue;
      if (this.relaxed.length < m) this.relaxed = new Float64Array(m * 2);
      const p = this.relaxed;
      // Sweep from the front (the side's facing end) back: each man stands at least `gap` behind the one ahead.
      if (side === 0) {
        p[m - 1] = lane[m - 1].crowdTarget;
        for (let i = m - 2; i >= 0; i--) p[i] = Math.min(lane[i].crowdTarget, p[i + 1] - gap);
      } else {
        p[0] = lane[0].crowdTarget;
        for (let i = 1; i < m; i++) p[i] = Math.max(lane[i].crowdTarget, p[i - 1] + gap);
      }
      for (let i = 0; i < m; i++) {
        const v = lane[i];
        const u = units[v.slot];
        const want = Math.max(-max, Math.min(max, p[i] - v.crowdTarget));
        const d = want - v.crowd;
        if (Math.abs(u.velX) > U.crowdMinSpeed) {
          v.crowd += d * ease;
          v.shuffling = false;
        } else if (u.trenchId < 0 && (v.shuffling || Math.abs(d) > U.crowdDeadband)) {
          // A man standing too close to his neighbour steps aside (the gait is driven by the drawn motion, so his
          // feet step rather than slide).
          const stepMax = U.crowdShuffle * dt;
          v.crowd += Math.max(-stepMax, Math.min(stepMax, d));
          v.shuffling = Math.abs(d) > stepMax;
        }
      }
    }
  }

  private updateLive(v: UnitView, u: UnitState, state: BattleState, alpha: number, dt: number, camLeft: number, camRight: number, victory: boolean): void {
    const simX = u.prevX + (u.x - u.prevX) * alpha;
    const spread = doorSpreadAt(simX, u, state);
    let x = simX + (v.jitter + v.crowd) * spread;
    // A building's men (its slot record, src/sim/buildings.ts): at the windows of their floor, or crouched in its
    // rubble or behind a cover prop (as in a trench, but not packed into a pit).
    const record = u.trenchId >= 0 && u.trench >= 0 && u.trench < state.trenches.length ? state.trenches[u.trench] : null;
    const bld = record !== null && record.building >= 0 && record.building < state.buildings.length ? state.buildings[record.building] : null;
    const atWindow = bld !== null && !bld.rubble;
    if (bld !== null) x = simX;
    // A trench is drawn as one narrow pit seen end-on: its occupants are packed in toward its centre (view only).
    const occupant = record !== null && bld === null;
    v.packW += ((occupant ? 1 : 0) - v.packW) * (dt > 0 ? 1 - Math.exp(-dt / TRENCH_LAYOUT.packTime) : 0);
    if (v.packW > 1e-3 && u.trench >= 0 && u.trench < state.trenches.length) {
      const tr = state.trenches[u.trench];
      const room = TRENCH_LAYOUT.pitW / 2 - TRENCH_LAYOUT.packMargin;
      const k = room / Math.max(room, tr.width / 2);
      const packed = tr.x + Math.max(-room, Math.min(room, (simX - tr.x) * k + v.jitter));
      x += (packed - x) * v.packW;
    }
    const moved = x - v.lastX;
    v.lastX = x;
    v.x = x;
    v.simX = simX;
    v.y = atWindow ? VIEW.groundY + BUILDING_LAYOUT.occupantDy - u.floor * BUILDING_LAYOUT.floorH : VIEW.groundY + VIEW.rowDy[v.row] * spread;
    if (v instanceof FigureView && v.hopAge < RENDER.apc.hopTime) {
      v.hopAge += dt;
      v.y -= apcHopLift(v.hopAge, v.hopDeck) * v.s;
    }
    v.facing = u.facing >= 0 ? 1 : -1;
    const tank = v instanceof TankView;
    v.stepTurn(dt, tank ? U.tankTurnTime : U.turnTime);

    // Door fade: units appear out of and vanish into their own HQ doorway.
    const hq = state.sides[u.side].hq;
    let a = 1;
    let shade = 1;
    if (u.inside || u.action === 'inside') a = 0;
    else if (hq) {
      const d = Math.abs(simX - hq.doorX);
      a = Math.min(1, d / U.doorFade);
      const t = Math.min(1, d / U.doorShade);
      shade = t * t * (3 - 2 * t);
    }
    v.alpha = a;

    // Trench: occupants, and infantry crossing a trench, step down onto the fire step behind the front parapet.
    let into = 0;
    if (!isVehicle(u.kind)) {
      if (u.trenchId >= 0) into = atWindow ? 0 : 1;
      else {
        const tr = state.trenches;
        const half = TRENCH_LAYOUT.pitW / 2;
        for (let t = 0; t < tr.length; t++) {
          // Men walking through a building stay on their feet.
          if (tr[t].building >= 0) continue;
          if (x > tr[t].x - half && x < tr[t].x + half) {
            into = 1;
            break;
          }
        }
      }
    }
    v.trenchW += (into - v.trenchW) * (dt > 0 ? 1 - Math.exp(-dt / U.trenchSinkTime) : 0);
    v.sink = v.trenchW * Math.max(0, VIEW.trenchFeetY + VIEW.rowDy[v.row] * VIEW.trenchRowSpread - v.y);
    // Wire is drawn end-on on one ground line: infantry inside a standing belt step onto its feet line (keeping a little
    // of their row's depth), so the far half of the coil is behind every man passing through and the near half over his legs.
    const wired = into === 0 && !isVehicle(u.kind) && inStandingWire(state.wires, x) ? 1 : 0;
    v.wireW += (wired - v.wireW) * (dt > 0 ? 1 - Math.exp(-dt / WIRE_LAYOUT.squeezeTime) : 0);
    if (v.wireW > 1e-4) v.sink += v.wireW * (VIEW.groundY + WIRE_LAYOUT.feetDy + VIEW.rowDy[v.row] * WIRE_LAYOUT.rowSpread - v.y);

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
      v.applyShade(shade);
      const inp = v.input;
      // When the battle is over the sim stops stepping, so velX and the action are stale: stand still, and the winners cheer.
      inp.action = state.over || u.action === 'inside' ? 'idle' : u.action;
      // The pose lives in figure space, drawn at row scale s: feed it figure-space distances so planted feet stay put.
      // A standing man stepping aside walks with the drawn motion (a few short steps), not the sim's speed.
      const stepping = v.shuffling && Math.abs(u.velX) <= U.crowdMinSpeed && dt > 0;
      const speed = stepping ? moved / dt : state.over ? 0 : u.velX;
      inp.speed = (speed * v.facing) / v.s;
      inp.stepping = stepping;
      inp.moved = (moved * v.facing) / v.s;
      inp.inTrench = v.trenchW > 0.5;
      inp.carrying = u.carrying > 0;
      inp.controlled = u.controlled;
      inp.victory = victory;
      // Inside a standing enemy belt (where the sim slows him): high-kneed short steps with the arms up.
      inp.struggling = !state.over && u.trenchId < 0 && wireStruggle(state.wires, u.side, simX);
      inp.fired = v.fired;
      inp.hit = v.hit;
      inp.death = null;
      v.draw(dt);
    } else {
      const tk = v.tank;
      v.setOver(v.groundOver(state.trenches, state.wires), this.layers.byName.vehicleOver);
      tk.distance += (moved * v.facing) / v.s;
      if (u.kind === 'apc') v.loaded = u.passengers > 0;
      if (v.fired) tk.recoil = 1;
      else tk.recoil = Math.max(0, tk.recoil - dt / U.tankRecoilTime);
      v.stepSuspension(state.over ? 0 : u.velX, dt);
      v.draw(false);
    }
    v.fired = false;
    v.hit = false;
    // Enemy health stays hidden unless revealed (src/render/hpReveal.ts); the player's own units always show theirs.
    if (u.hp < u.maxHp && u.hp > 0 && this.hpReveal.shows(u.side, simX)) {
      v.showPips(u.hp / u.maxHp, v.y + v.sink - v.bodyH * v.s - U.pipLift * v.s);
      this.pipsDrawn[u.side]++;
    } else {
      v.hidePips();
    }
    // The player's own tanks show their main gun's reload, so it is plain when one is vulnerable (DECISIONS 424).
    if (v instanceof TankView) {
      const gun = u.mount.weapon;
      if (u.side === 0 && gun !== null && gun.cooldown >= U.reloadBar.minCooldown && u.weaponCharge < 1) {
        const top = v.y + v.sink - v.bodyH * v.s - U.pipLift * v.s;
        v.showReload(u.weaponCharge, v.pipsShown ? top - U.reloadBar.lift * v.s : top + U.pipH * v.s);
      } else {
        v.hideReload();
      }
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
      if (v instanceof FigureView && v.blood >= 0) this.blood.hide(v.blood, v.unitId);
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
      if (v.blood >= 0) this.blood.place(v.blood, v.unitId, v.deadTime, v.torsoX(), v.y + v.sink, v.s, v.alpha);
    } else {
      v.draw(true);
    }
  }

  /**
   * When a tank drawn in front of depth row `row` covers the point (x, y) (a muzzle behind it), the x of the tank's
   * edge on the `dir` side, where a shot from behind it comes into view; NaN when nothing covers the point.
   * The shooter's own view (pool slot `self`) never counts.
   */
  coverEdge(x: number, y: number, row: number, dir: number, self: number): number {
    const list = this.bySlot;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!(v instanceof TankView) || !v.shown || i === self || (v.row <= row && !v.over)) continue;
      const L = TANK_LAYOUT[v.look];
      const half = L.length * 0.47 * v.s * Math.abs(v.turnK);
      if (Math.abs(x - v.x) > half || y > v.y || y < v.y - (L.height + v.lift) * v.s) continue;
      return v.x + (dir < 0 ? -half : half);
    }
    return NaN;
  }

  private placeRing(): void {
    this.ring.visible = false;
    this.ringHigh.visible = false;
    if (this.controlledId < 0) return;
    let v: UnitView | null = null;
    for (let i = 0; i < this.bySlot.length; i++) {
      const c = this.bySlot[i];
      if (c && c.unitId === this.controlledId) {
        v = c;
        break;
      }
    }
    if (!v || !v.shown) return;
    const M = RENDER.marker;
    const sunk = v.sink > M.ringSinkMin;
    const ring = sunk ? this.ringHigh : this.ring;
    ring.visible = true;
    ring.x = v.x;
    ring.y = sunk ? v.y : v.y + v.sink * 0.5;
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
