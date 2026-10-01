/**
 * Figure skeleton: the per-unit animation record, the pose vector and forward
 * kinematics. Pure maths, no canvas.
 *
 * Figure space: origin on the ground between the feet, +x the way the figure
 * faces, y negative is up, units are wu. Every bone has a constant length
 * (FIGURE.bones); joints are always produced from the pose vector by forward
 * kinematics, so bone lengths can never drift.
 */
import {
  DEATH_VARIANTS,
  FIGURE,
  FIGURE_KIND_LIST,
  FIGURE_LOADOUT,
  WEAPON_GEOM,
  type DeathVariant,
  type FigureKind,
  type HandItem,
  type WeaponGeom,
  type WeaponModel,
} from '../../data/figure';
import type { FactionId, UnitAction, UnitKind } from '../../data/schema';
import { hash01 } from './math';

// ---------------------------------------------------------------------------
// Pose vector: hip position plus absolute screen angles (y-down, clockwise +).
// ---------------------------------------------------------------------------
export const P_HIPX = 0;
export const P_HIPY = 1;
/** Lower spine (hip to chest), upper spine (chest to neck), neck (neck to head centre). */
export const P_SPINE = 2;
export const P_CHEST = 3;
export const P_NECK = 4;
/** Near / far upper arm and forearm. */
export const P_NUA = 5;
export const P_NFA = 6;
export const P_FUA = 7;
export const P_FFA = 8;
/** Near / far thigh and shin. */
export const P_NTH = 9;
export const P_NSH = 10;
export const P_FTH = 11;
export const P_FSH = 12;
/** Boot pitch, positive = toe down. */
export const P_NFP = 13;
export const P_FFP = 14;
/** Weapon grip position and screen angle of its barrel. */
export const P_WX = 15;
export const P_WY = 16;
export const P_WA = 17;
/** Shoulder twist (wu) and breathing lift (wu). */
export const P_TWIST = 18;
export const P_LIFT = 19;
/** Screen angle of the bipod legs, and of the medic's satchel strap. */
export const P_BIPOD = 20;
export const P_SATCHEL = 21;
export const N_POSE = 22;

/** True for the pose entries that are angles (blended on the circle). */
export const POSE_IS_ANGLE: readonly boolean[] = [
  false, false, true, true, true, true, true, true, true, true, true, true, true, true, true, false, false, true, false, false, true, true,
];

// ---------------------------------------------------------------------------
// Joints, written by forward kinematics: x at 2j, y at 2j + 1.
// ---------------------------------------------------------------------------
export const J_HIP = 0;
export const J_CHEST = 1;
export const J_NECK = 2;
export const J_HEAD = 3;
export const J_NSHOULDER = 4;
export const J_FSHOULDER = 5;
export const J_NELBOW = 6;
export const J_FELBOW = 7;
export const J_NHAND = 8;
export const J_FHAND = 9;
export const J_NKNEE = 10;
export const J_FKNEE = 11;
export const J_NANKLE = 12;
export const J_FANKLE = 13;
/** Toe tips and heels of the boots (on the sole). */
export const J_NTOE = 14;
export const J_FTOE = 15;
export const J_NHEEL = 16;
export const J_FHEEL = 17;
export const J_GRIP = 18;
export const J_MUZZLE = 19;
export const N_JOINTS = 20;

export const JOINT_NAMES: readonly string[] = [
  'hip', 'chest', 'neck', 'head', 'nShoulder', 'fShoulder', 'nElbow', 'fElbow', 'nHand', 'fHand',
  'nKnee', 'fKnee', 'nAnkle', 'fAnkle', 'nToe', 'fToe', 'nHeel', 'fHeel', 'grip', 'muzzle',
];

// ---------------------------------------------------------------------------
// Spring channels of the posed layer (see animate.ts).
// ---------------------------------------------------------------------------
export const C_HIPX = 0;
export const C_HIPY = 1;
export const C_SPINE = 2;
export const C_CHEST = 3;
export const C_HEAD = 4;
export const C_TWIST = 5;
export const C_NFX = 6;
export const C_NFY = 7;
export const C_NFP = 8;
export const C_FFX = 9;
export const C_FFY = 10;
export const C_FFP = 11;
export const C_RELX = 12;
export const C_RELY = 13;
export const C_GNDX = 14;
export const C_GNDY = 15;
export const C_GND = 16;
export const C_WANG = 17;
export const C_AIM = 18;
export const C_NPIN = 19;
export const C_FPIN = 20;
export const C_NPX = 21;
export const C_NPY = 22;
export const C_FPX = 23;
export const C_FPY = 24;
export const C_NSH = 25;
export const C_NEL = 26;
export const C_FSH = 27;
export const C_FEL = 28;
export const C_BIPOD = 29;
export const C_HEADX = 30;
export const C_GAIT = 31;
export const C_STYLE = 32;
export const C_BACK = 33;
export const C_CHEER = 34;
export const C_PLATE = 35;
export const N_CHANNELS = 36;

/** Death of a unit: which fall, seconds since death, and the way the blow travelled. */
export interface FigureDeath {
  variant: DeathVariant;
  time: number;
  /** +1 = the blow travelled the way the figure faces (hit from behind), -1 = hit from the front. Default -1. */
  dir?: number;
}

/** Everything the animation needs from the unit each frame. Reuse one object per unit. */
export interface FigureInput {
  kind: UnitKind;
  /** 'inside' is never drawn; it is treated as idle. */
  action: UnitAction;
  /** Signed speed along the facing direction, wu/s (negative = walking backwards). */
  speed: number;
  /** Signed distance moved along the facing direction this frame, wu. */
  moved: number;
  /** Aim pitch in radians, positive = muzzle up. */
  aimPitch: number;
  inTrench: boolean;
  carrying: boolean;
  controlled: boolean;
  /** Victory cheer. */
  victory: boolean;
  /** One-shot triggers: set for the frame the event happens, then clear. */
  fired: boolean;
  hit: boolean;
  /** Non-null once the unit is dead. */
  death: FigureDeath | null;
}

export function createFigureInput(kind: UnitKind = 'rifle'): FigureInput {
  return {
    kind,
    action: 'idle',
    speed: 0,
    moved: 0,
    aimPitch: 0,
    inTrench: false,
    carrying: false,
    controlled: false,
    victory: false,
    fired: false,
    hit: false,
    death: null,
  };
}

export function isFigureKind(kind: UnitKind): kind is FigureKind {
  return (FIGURE_KIND_LIST as readonly UnitKind[]).includes(kind);
}

/** Per-unit animation state. Create once per unit (or pool and reset). */
export class FigureAnim {
  kind: FigureKind = 'rifle';
  faction: FactionId = 'british';
  seed = 0;
  model: WeaponModel = 'enfield';
  geom: WeaponGeom = WEAPON_GEOM.enfield;

  time = 0;
  action: UnitAction = 'idle';
  actionTime = 0;
  /** Time of the last aim / fire / reload, for relaxing out of the firing stance. */
  lastCombat = -1e9;
  /** False until the first update, which snaps every spring to its target. */
  started = false;
  /** Seeded per unit: kneel instead of stand to fire (riflemen). */
  altAim = false;
  relaxAfter = 0;
  /** Crew weapons stay set up after a fight until the unit moves. */
  emplaced = false;
  /** Spring time multiplier of the current stance change (going prone is slow), and of the stance itself. */
  settle = 1;
  stanceSettle = 1;
  breathPhase = 0;
  /** Seeded per unit: extra weapon tilt (rad) and height (wu) while on the move (FIGURE.gait.carryTiltVar). */
  carryTilt = 0;
  carryLift = 0;
  /** Target offset of a carried weapon from the near shoulder (wu), kept while the weapon is set on the ground. */
  relTX = 5;
  relTY = 11;
  /** Near arm swing and elbow when a throw started. */
  throwSh = 0;
  throwEl = 0;

  // Posed layer springs: value, velocity, target, time constant.
  readonly sv = new Float64Array(N_CHANNELS);
  readonly sd = new Float64Array(N_CHANNELS);
  readonly tg = new Float64Array(N_CHANNELS);
  readonly tau = new Float64Array(N_CHANNELS);

  // Gait state (distance driven).
  phase = 0;
  dist = 0;
  readonly planted = new Uint8Array(2);
  readonly plantW = new Float64Array(2);
  readonly err = new Float64Array(2);
  readonly errS0 = new Float64Array(2);
  /** World position (in travelled distance) of each foot last frame. */
  readonly footWorld = new Float64Array(2);
  readonly footX = new Float64Array(2);
  readonly footY = new Float64Array(2);
  readonly footP = new Float64Array(2);
  /** 1 while the foot bears weight (stance), easing to 0 through the swing. */
  readonly footLoad = new Float64Array(2);
  gHipX = 0;
  gHipY = 0;
  gSpine = 0;
  gChest = 0;
  gHead = 0;
  gTwist = 0;
  gArm = 0;
  gArmFwd = 0;
  gWeaponBob = 0;
  gWeaponRock = 0;
  gElbow = 0;
  exertion = 0;

  /** Free-arm and pinned-arm angles (near upper, near fore, far upper, far fore), unwrapped over time. */
  readonly armFree = new Float64Array(4);
  readonly armIk = new Float64Array(4);
  /** True until the first live frame has been composed. */
  fresh = true;

  // Additive dynamics.
  recoilTarget = 0;
  recoil = 0;
  recoilV = 0;
  duckTarget = 0;
  duck = 0;
  duckV = 0;
  flinch = 0;
  flinchV = 0;
  satchel = 0;
  satchelV = 0;
  /** Seconds since the last shot (for the mortar shell drop and the run-and-gun hold). */
  sinceFire = 1e9;
  /** Secondary motion driven by the hip's vertical acceleration: last hip height and speed, pack bounce (wu along the
   * back, + = down) and helmet wobble (rad), each with its velocity. */
  secY = 0;
  secV = 0;
  pack = 0;
  packV = 0;
  helm = 0;
  helmV = 0;

  // Visible extras.
  item: HandItem = 'none';
  /** True if the item is in the far hand (anti-tank round), false = near hand. */
  itemFar = false;
  weaponVisible = true;
  crateVisible = false;
  /** Mortar baseplate laid flat (0..1). */
  plate = 0;

  // Death.
  dead = false;
  deathVariant: DeathVariant = 'crumple';
  /** The variant the caller asked for (the fall played may differ for a prone body). */
  deathAsked: DeathVariant = 'crumple';
  deathDir = -1;
  deathSkip = 0;
  deathRate = 1;
  /** Share of the live pose kept for good (a prone body barely moves). */
  deathKeep = 0;
  /** Seconds over which the live pose fades into the fall. */
  deathFade = 0.2;
  deathStill = false;
  /** Seconds after which the body lies still (the renderer may fade it out after this). */
  deathEnd = 1;
  readonly deathFrom = new Float64Array(N_POSE);
  readonly deathOff = new Float64Array(N_POSE);
  /** Swing of each limb (near arm, far arm, near leg, far leg) that lays it on the ground at rest. */
  readonly restFix = new Float64Array(4);
  /** The weapon was set on the ground when the unit died (it stays put). */
  deathGround = false;

  // Output.
  readonly pose = new Float64Array(N_POSE);
  readonly joints = new Float64Array(N_JOINTS * 2);
  /** Muzzle position and unit direction in figure space. */
  muzzleX = 0;
  muzzleY = 0;
  muzzleDX = 1;
  muzzleDY = 0;
  /** Where a carried or loaded crate sits (centre) and its rotation. */
  crateX = 0;
  crateY = 0;
  crateRot = 0;
  /** Near hand position (where a thrown grenade leaves the hand). */
  handX = 0;
  handY = 0;
}

/** Create an animation record for one unit. */
export function createFigureAnim(kind: UnitKind, faction: FactionId, seed: number): FigureAnim {
  const a = new FigureAnim();
  resetFigureAnim(a, kind, faction, seed);
  return a;
}

/** Reset a pooled record for a new unit. */
export function resetFigureAnim(a: FigureAnim, kind: UnitKind, faction: FactionId, seed: number): void {
  a.kind = isFigureKind(kind) ? kind : 'rifle';
  a.faction = faction;
  a.seed = seed | 0;
  a.model = FIGURE_LOADOUT[faction].weapon[a.kind];
  a.geom = WEAPON_GEOM[a.model];
  a.time = 0;
  a.action = 'idle';
  a.actionTime = 0;
  a.lastCombat = -1e9;
  a.started = false;
  a.fresh = true;
  a.altAim = hash01(a.seed, 11) < 0.5;
  a.relaxAfter = FIGURE.idle.relaxAfter + FIGURE.idle.relaxSpread * hash01(a.seed, 12);
  a.emplaced = false;
  a.settle = 1;
  a.stanceSettle = 1;
  a.breathPhase = hash01(a.seed, 14);
  a.carryTilt = (hash01(a.seed, 15) * 2 - 1) * FIGURE.gait.carryTiltVar;
  a.carryLift = (hash01(a.seed, 16) * 2 - 1) * FIGURE.gait.carryLiftVar;
  a.relTX = 5;
  a.relTY = 11;
  a.footWorld.fill(0);
  a.plate = 0;
  a.deathGround = false;
  a.sv.fill(0);
  a.sd.fill(0);
  a.tg.fill(0);
  a.tau.fill(0.1);
  a.phase = hash01(a.seed, 13);
  a.dist = 0;
  a.planted.fill(0);
  a.plantW.fill(0);
  a.err.fill(0);
  a.errS0.fill(0);
  a.footLoad.fill(1);
  a.exertion = 0;
  a.recoilTarget = a.recoil = a.recoilV = 0;
  a.duckTarget = a.duck = a.duckV = 0;
  a.flinch = a.flinchV = 0;
  a.satchel = a.satchelV = 0;
  a.sinceFire = 1e9;
  a.secY = a.secV = a.pack = a.packV = a.helm = a.helmV = 0;
  a.item = 'none';
  a.itemFar = false;
  a.weaponVisible = a.model !== 'none' && a.model !== 'crate';
  a.crateVisible = false;
  a.dead = false;
  a.deathVariant = DEATH_VARIANTS[0];
  a.deathDir = -1;
  a.deathSkip = 0;
  a.deathRate = 1;
  a.deathStill = false;
  a.deathEnd = 1;
}

// ---------------------------------------------------------------------------
// Forward kinematics
// ---------------------------------------------------------------------------
const B = FIGURE.bones;

function setJ(j: Float64Array, i: number, x: number, y: number): void {
  j[i * 2] = x;
  j[i * 2 + 1] = y;
}

/** Fill joint positions from a pose vector. */
export function poseToJoints(p: Float64Array, j: Float64Array, geom: WeaponGeom): void {
  const hx = p[P_HIPX];
  const hy = p[P_HIPY];
  setJ(j, J_HIP, hx, hy);
  const cx = hx + Math.cos(p[P_SPINE]) * B.spineLower;
  const cy = hy + Math.sin(p[P_SPINE]) * B.spineLower;
  setJ(j, J_CHEST, cx, cy);
  const ca = p[P_CHEST];
  const ucx = Math.cos(ca);
  const ucy = Math.sin(ca);
  const nx = cx + ucx * B.spineUpper;
  const ny = cy + ucy * B.spineUpper;
  setJ(j, J_NECK, nx, ny);
  setJ(j, J_HEAD, nx + Math.cos(p[P_NECK]) * B.neck, ny + Math.sin(p[P_NECK]) * B.neck);
  // Shoulders hang off the upper spine; "forward" is the spine direction turned clockwise.
  const drop = FIGURE.shoulderDrop - p[P_LIFT];
  const bx = nx - ucx * drop;
  const by = ny - ucy * drop;
  const fx = -ucy;
  const fy = ucx;
  const tw = p[P_TWIST];
  const nsx = bx - fx * tw;
  const nsy = by - fy * tw;
  const fsx = bx + fx * tw;
  const fsy = by + fy * tw;
  setJ(j, J_NSHOULDER, nsx, nsy);
  setJ(j, J_FSHOULDER, fsx, fsy);
  limb(j, J_NELBOW, J_NHAND, nsx, nsy, p[P_NUA], p[P_NFA], B.upperArm, B.forearm);
  limb(j, J_FELBOW, J_FHAND, fsx, fsy, p[P_FUA], p[P_FFA], B.upperArm, B.forearm);
  limb(j, J_NKNEE, J_NANKLE, hx, hy, p[P_NTH], p[P_NSH], B.thigh, B.shin);
  limb(j, J_FKNEE, J_FANKLE, hx, hy, p[P_FTH], p[P_FSH], B.thigh, B.shin);
  foot(j, J_NANKLE, J_NTOE, J_NHEEL, p[P_NFP]);
  foot(j, J_FANKLE, J_FTOE, J_FHEEL, p[P_FFP]);
  const wx = p[P_WX];
  const wy = p[P_WY];
  setJ(j, J_GRIP, wx, wy);
  const c = Math.cos(p[P_WA]);
  const s = Math.sin(p[P_WA]);
  setJ(j, J_MUZZLE, wx + c * geom.muzzleX - s * geom.muzzleY, wy + s * geom.muzzleX + c * geom.muzzleY);
}

function limb(j: Float64Array, mid: number, end: number, rx: number, ry: number, a1: number, a2: number, l1: number, l2: number): void {
  const mx = rx + Math.cos(a1) * l1;
  const my = ry + Math.sin(a1) * l1;
  setJ(j, mid, mx, my);
  setJ(j, end, mx + Math.cos(a2) * l2, my + Math.sin(a2) * l2);
}

function foot(j: Float64Array, ankle: number, toe: number, heel: number, pitch: number): void {
  const ax = j[ankle * 2];
  const ay = j[ankle * 2 + 1];
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const h = FIGURE.ankle;
  const L = FIGURE.footLength;
  const H = -FIGURE.heel;
  setJ(j, toe, ax + c * L - s * h, ay + s * L + c * h);
  setJ(j, heel, ax + c * H - s * h, ay + s * H + c * h);
}

/** Lowest point (largest y) of a foot with its ankle at (ax, ay) and the given pitch, relative to the ankle. */
export function footBottom(pitch: number): number {
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const h = FIGURE.ankle;
  const toe = s * FIGURE.footLength + c * h;
  const heel = -s * FIGURE.heel + c * h;
  return toe > heel ? toe : heel;
}
