/**
 * Stick-figure proportions, poses and animation tunables. Pure data: the pose
 * maths lives in src/art/figure.
 *
 * Conventions used by every number here
 *  - Figure space: origin on the ground between the feet, +x is the way the
 *    figure faces, y is NEGATIVE upwards, units are wu. A standing figure is
 *    VIEW.figureHeight tall (feet to helmet top).
 *  - Spine angles (spine, chest, head) lean from straight up, positive = forward.
 *    chest is relative to spine, head is relative to chest.
 *  - Limb angles swing from straight down, positive = forward. Elbow and knee
 *    values are flex angles (0 = straight limb).
 *  - Weapon pitch is positive with the muzzle raised. Weapon-space points have
 *    their origin at the trigger grip, +x toward the muzzle, +y toward the underside.
 *  - "near" is the limb on the camera side (drawn in front), "far" the other one.
 */
import type { DamageType, FactionId, UnitKind } from './schema';
import { VIEW } from './view';

export type FigureKind = Exclude<UnitKind, 'tank' | 'heavyTank'>;

export const FIGURE_KIND_LIST: readonly FigureKind[] = [
  'sapper',
  'rifle',
  'lmg',
  'assault',
  'mortar',
  'sniper',
  'medic',
  'at',
];

/** crumple = folds and falls on its face; thrown = knocked backward by a bullet; spin = staggers, flails and drops; blast = tossed through the air. */
export type DeathVariant = 'crumple' | 'thrown' | 'spin' | 'blast';
export const DEATH_VARIANTS: readonly DeathVariant[] = ['crumple', 'thrown', 'spin', 'blast'];

export type WeaponModel =
  | 'none'
  | 'crate'
  | 'enfield'
  | 'kar98'
  | 'enfieldScoped'
  | 'kar98Scoped'
  | 'bren'
  | 'mg34'
  | 'sten'
  | 'mp40'
  | 'mortar'
  | 'piat'
  | 'panzerschreck';

/** Small item drawn in a hand: grenades, a mortar bomb, an anti-tank round. */
export type HandItem = 'none' | 'mills' | 'stick' | 'shell' | 'rocket';

/** How a kind works its weapon during the `reload` action. */
export type ReloadStyle = 'none' | 'bolt' | 'magazine' | 'shell' | 'rocket';

export interface StanceDef {
  hipX: number;
  hipY: number;
  spine: number;
  chest: number;
  head: number;
  /** Ankle positions. */
  nearFootX: number;
  nearFootY: number;
  farFootX: number;
  farFootY: number;
  /** Boot pitch in radians, positive = toe down. */
  nearPitch: number;
  farPitch: number;
  /** Shoulder twist in wu: the near shoulder moves back and the far one forward by this much. */
  twist: number;
  /** Multiplier on the body spring time while getting into or out of this stance (going prone is slow). */
  settle: number;
}

export interface UpperDef {
  /** False: (ox, oy) is the grip's offset from the near shoulder. True: (ox, oy) is an absolute figure-space position (weapon stood on the ground). */
  ground: boolean;
  ox: number;
  oy: number;
  /** Weapon pitch at rest. */
  angle: number;
  /** Share of the aim pitch added to the weapon pitch (and used to swing the offset around the shoulder). */
  aim: number;
  /** 1 = the hand holds the weapon at (px, py) in weapon space; 0 = the arm is free and uses the angles below. */
  nearPin: number;
  farPin: number;
  nearPx: number;
  nearPy: number;
  farPx: number;
  farPy: number;
  /** Free-arm pose: shoulder swing and elbow flex. */
  nearSh: number;
  nearEl: number;
  farSh: number;
  farEl: number;
  /** 1 = bipod legs down. */
  bipod: number;
  /** Extra head tilt added to the stance (cheek on the stock). */
  head: number;
}

export interface PoseDef {
  stance: StanceDef;
  upper: UpperDef;
}

export interface GaitStyle {
  /** Distance covered by one full cycle (two steps), wu. */
  stride: number;
  /** Share of the cycle each foot spends planted. Below 0.5 there is a flight phase. */
  duty: number;
  /** Peak height of the swinging foot, and how early in the swing it peaks (0 = middle). */
  lift: number;
  liftSkew: number;
  /** Extra toe-down pitch of the trailing foot during the swing. */
  kick: number;
  /** Heel-rise angle at push-off and toe-up angle at heel strike. */
  toeOff: number;
  strike: number;
  /** x of the middle of the stance path relative to the hip rest position. */
  center: number;
  /** Hip height above the ground, and its twice-per-cycle bob (positive = highest over the planted foot, negative = lowest there). */
  hipHeight: number;
  bob: number;
  /** Delay of the bob behind mid-stance, in cycles. */
  bobLag: number;
  /** Forward-and-back surge of the hip, wu. */
  surge: number;
  hipX: number;
  /** Torso lean, extra chest bend, and how much of the lean the head cancels. */
  lean: number;
  chest: number;
  headLevel: number;
  /** Torso rocking with each step. */
  pitch: number;
  /** Free-arm swing amplitude, base elbow flex and extra flex on the forward swing. */
  armSwing: number;
  elbow: number;
  elbowSwing: number;
  /** Shoulder counter-rotation, wu. */
  twist: number;
  /** Carried weapon: vertical bounce (wu) and rocking (rad), both lagging the body. */
  weaponBob: number;
  weaponRock: number;
}

export interface GaitProfile {
  /** Below walkSpeed the slow style is used, above runSpeed the fast one (wu/s). */
  walkSpeed: number;
  runSpeed: number;
  slow: GaitStyle;
  fast: GaitStyle;
}

export interface RecoilDef {
  /** Added to the recoil level per shot, and its cap. */
  add: number;
  max: number;
  /** Seconds for the kick to decay to 1/e. */
  decay: number;
  /** At recoil 1: weapon slides back (wu), muzzle climbs (rad), chest rocks back (rad), hip shifts back (wu). */
  back: number;
  climb: number;
  shoulder: number;
  hip: number;
  /** Slow body reaction (crew ducking, launcher back-blast): crouch amount (rad of spine) and its decay. */
  duck: number;
  duckDecay: number;
}

export interface FigureKindDef {
  idle: PoseDef;
  /** Upper body while moving (the legs and torso come from the gait). */
  move: UpperDef;
  /** Firing stance. */
  aim: PoseDef;
  /** Alternative firing stance picked per unit by seed (rifleman kneeling); null = always `aim`. */
  aimAlt: PoseDef | null;
  /** Upper body while waiting in the firing stance between targets. */
  rest: UpperDef;
  /** Standing in a trench: shoulders above the parapet, weapon rested. */
  trench: PoseDef;
  gait: GaitProfile;
  recoil: RecoilDef;
  reload: ReloadStyle;
  /** Weapon-space point the loading hand goes to (magazine well, breech, bolt). */
  reloadX: number;
  reloadY: number;
  /** True if the unit stays in its firing stance while idle until it moves (crew weapons). */
  staysEmplaced: boolean;
  /** True if it keeps the weapon shouldered while moving in the aim or fire action. */
  runAndGun: boolean;
  /** Breathing and aim sway multiplier while aiming (snipers are steady). */
  steadiness: number;
  /** Time stretch of the reload hand motion (a sniper works the bolt slowly). */
  reloadPace: number;
  /** True if the weapon can be waved overhead in the victory cheer. */
  aloft: boolean;
  /** Kit pieces worn. */
  pack: boolean;
  pouches: boolean;
  satchel: boolean;
}

const DEG = Math.PI / 180;

function stance(over: Partial<StanceDef>): StanceDef {
  return {
    hipX: -0.5,
    hipY: -28.9,
    spine: 0.02,
    chest: 0.04,
    head: -0.02,
    nearFootX: 2.6,
    nearFootY: -2.6,
    farFootX: -3.2,
    farFootY: -2.6,
    nearPitch: 0,
    farPitch: 0,
    twist: 0.6,
    settle: 1,
    ...over,
  };
}

function upper(over: Partial<UpperDef>): UpperDef {
  return {
    ground: false,
    // Unarmed poses park the (invisible) weapon point at the hip, never at the shoulder joint itself.
    ox: 5,
    oy: 11,
    angle: 0,
    aim: 0,
    nearPin: 0,
    farPin: 0,
    nearPx: 0,
    nearPy: 0,
    farPx: 0,
    farPy: 0,
    nearSh: 0.08,
    nearEl: 0.24,
    farSh: -0.05,
    farEl: 0.2,
    bipod: 0,
    head: 0,
    ...over,
  };
}

function gait(over: Partial<GaitStyle>): GaitStyle {
  return {
    stride: 38,
    duty: 0.6,
    lift: 3.4,
    liftSkew: 0.15,
    kick: 0.25,
    toeOff: 0.6,
    strike: 0.3,
    center: 0.5,
    hipHeight: 27.6,
    bob: 1.0,
    bobLag: 0.02,
    surge: 0.4,
    hipX: -0.5,
    lean: 0.05,
    chest: 0.04,
    headLevel: 0.6,
    pitch: 0.012,
    armSwing: 0.5,
    elbow: 0.25,
    elbowSwing: 0.25,
    twist: 0.9,
    weaponBob: 0.5,
    weaponRock: 0.03,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Stances
// ---------------------------------------------------------------------------

const STAND = stance({});
/** Offhand firing stance: support-side foot forward, shoulders turned. */
const STAND_READY = stance({
  hipX: -1,
  hipY: -28.0,
  spine: 0.1,
  chest: 0.08,
  head: 0.06,
  nearFootX: -6.5,
  farFootX: 6.6,
  twist: 1.5,
});
const ASSAULT_READY = stance({
  hipX: -0.5,
  hipY: -26.0,
  spine: 0.26,
  chest: 0.1,
  head: -0.12,
  nearFootX: -7.4,
  farFootX: 7.6,
  twist: 1.5,
});
/** Near knee down, far foot forward. */
const KNEEL = stance({
  hipX: -3.5,
  hipY: -15.4,
  spine: 0.16,
  chest: 0.08,
  head: 0.04,
  nearFootX: -14.2,
  nearFootY: -5,
  nearPitch: 1.25,
  farFootX: 8.6,
  twist: 1.5,
});
const KNEEL_STEADY = stance({ ...KNEEL, spine: 0.24, chest: 0.1, head: 0 });
const KNEEL_UPRIGHT = stance({ ...KNEEL, spine: 0.06, chest: 0.04, head: 0.02, twist: 1.2 });
const KNEEL_CREW = stance({
  ...KNEEL,
  hipX: -3,
  spine: 0.3,
  chest: 0.14,
  head: -0.16,
  farFootX: 6.4,
  twist: 1.0,
});
const KNEEL_HEAL = stance({ ...KNEEL, hipX: -4, spine: 0.44, chest: 0.2, head: 0.12, twist: 0.4 });
const PRONE = stance({
  hipX: -9,
  hipY: -3.9,
  spine: 1.36,
  chest: -0.24,
  head: -0.4,
  nearFootX: -35.6,
  nearFootY: -2.3,
  farFootX: -34.6,
  farFootY: -2.1,
  nearPitch: 3.0,
  farPitch: 3.05,
  twist: 1.6,
  settle: 2.1,
});
const TRENCH = stance({
  hipX: -4,
  hipY: -18.2,
  spine: 0.52,
  chest: 0.22,
  head: -0.36,
  nearFootX: -8,
  farFootX: 3.6,
  twist: 1.5,
});
const LOAD_BEND = stance({ hipX: -4.5, hipY: -23.2, spine: 1.0, chest: 0.26, head: -0.3, twist: 0, settle: 1.4 });
const CHEER = stance({ hipY: -28.0, spine: -0.05, chest: -0.06, head: -0.2, twist: 0 });
const THROW = stance({ hipX: -1, hipY: -27.4, spine: 0.04, chest: 0.04, head: -0.04, nearFootX: -7, farFootX: 7.2, twist: 1.0 });

export const FIGURE_STANCES = {
  stand: STAND,
  load: LOAD_BEND,
  heal: KNEEL_HEAL,
  cheer: CHEER,
  throw: THROW,
} as const;

// ---------------------------------------------------------------------------
// Gaits
// ---------------------------------------------------------------------------

const WALK = gait({ stride: 40, hipHeight: 27.4 });
/**
 * Run: the foot lands about 8 wu ahead of the hip with the knee nearly straight,
 * the hip is lowest over the planted foot, and the push-off rolls onto the toe
 * with the leg extended behind. Short flight phase.
 */
const RUN = gait({
  stride: 58,
  duty: 0.36,
  lift: 8.5,
  liftSkew: 0.3,
  kick: 0.6,
  toeOff: 0.8,
  strike: 0.25,
  center: -3.8,
  hipHeight: 28.6,
  bob: -1.0,
  bobLag: 0.03,
  surge: 0.6,
  hipX: -1,
  lean: 0.36,
  chest: 0.08,
  headLevel: 0.6,
  pitch: 0.03,
  armSwing: 0.95,
  elbow: 1.35,
  elbowSwing: 0.35,
  twist: 1.5,
  weaponBob: 1.1,
  weaponRock: 0.07,
});
/** Assault trooper: long low strides, body pitched forward. */
const SPRINT = gait({
  ...RUN,
  stride: 66,
  duty: 0.33,
  lift: 10,
  liftSkew: 0.4,
  kick: 0.8,
  center: -3.6,
  hipHeight: 26.8,
  bob: -1.3,
  lean: 0.5,
  chest: 0.1,
  headLevel: 0.75,
  twist: 1.8,
  weaponBob: 1.2,
  weaponRock: 0.09,
});
/** Heavy-weapon crews: shorter, heavier steps with more knee bend. */
const JOG_LOADED = gait({
  ...RUN,
  stride: 48,
  duty: 0.42,
  lift: 6,
  liftSkew: 0.3,
  kick: 0.45,
  center: -2.0,
  hipHeight: 27.2,
  bob: -1.4,
  bobLag: 0.045,
  lean: 0.27,
  chest: 0.14,
  headLevel: 0.65,
  pitch: 0.04,
  armSwing: 0.55,
  elbow: 1.0,
  twist: 0.9,
  weaponBob: 1.5,
  weaponRock: 0.05,
});
const JOG = gait({
  ...RUN,
  stride: 54,
  duty: 0.38,
  lift: 8,
  center: -2.6,
  hipHeight: 28.4,
  bob: -1.0,
  lean: 0.2,
  chest: 0.05,
  armSwing: 1.0,
  elbow: 1.4,
});
const STALK = gait({ ...RUN, stride: 52, duty: 0.4, lift: 7, center: -2.4, hipHeight: 26.8, lean: 0.38, chest: 0.12, bob: -1.0 });
/** Sapper hauling a crate: short heavy steps, back straight against the load. */
const HAUL = gait({
  ...RUN,
  stride: 46,
  duty: 0.46,
  lift: 5,
  liftSkew: 0.25,
  kick: 0.35,
  center: -1.0,
  hipHeight: 27.0,
  bob: -1.6,
  bobLag: 0.05,
  lean: 0.1,
  chest: -0.12,
  headLevel: 0.2,
  pitch: 0.045,
  twist: 0.5,
  weaponBob: 1.6,
  weaponRock: 0.04,
});
const HAUL_SLOW = gait({ ...WALK, stride: 34, lift: 2.6, hipHeight: 27.0, bob: 1.0, lean: 0.08, chest: -0.1, headLevel: 0.2, twist: 0.4, weaponBob: 1.0 });

const GAIT_INFANTRY: GaitProfile = { walkSpeed: 32, runSpeed: 70, slow: WALK, fast: RUN };
const GAIT_ASSAULT: GaitProfile = { walkSpeed: 36, runSpeed: 96, slow: WALK, fast: SPRINT };
const GAIT_LOADED: GaitProfile = { walkSpeed: 26, runSpeed: 50, slow: WALK, fast: JOG_LOADED };
const GAIT_LIGHT: GaitProfile = { walkSpeed: 32, runSpeed: 70, slow: WALK, fast: JOG };
const GAIT_SNIPER: GaitProfile = { walkSpeed: 30, runSpeed: 62, slow: WALK, fast: STALK };
/** Used instead of the kind's own profile while a crate is carried. */
export const FIGURE_GAIT_CARRY: GaitProfile = { walkSpeed: 28, runSpeed: 66, slow: HAUL_SLOW, fast: HAUL };

// ---------------------------------------------------------------------------
// Recoil
// ---------------------------------------------------------------------------

const NO_RECOIL: RecoilDef = { add: 0, max: 0, decay: 0.1, back: 0, climb: 0, shoulder: 0, hip: 0, duck: 0, duckDecay: 0.2 };
const RIFLE_RECOIL: RecoilDef = { add: 1, max: 1, decay: 0.11, back: 3.6, climb: 0.17, shoulder: 0.11, hip: 0.9, duck: 0, duckDecay: 0.2 };
const SNIPER_RECOIL: RecoilDef = { add: 1, max: 1, decay: 0.15, back: 4.2, climb: 0.2, shoulder: 0.13, hip: 1.0, duck: 0, duckDecay: 0.2 };
const SMG_RECOIL: RecoilDef = { add: 0.7, max: 1.2, decay: 0.055, back: 1.5, climb: 0.07, shoulder: 0.045, hip: 0.4, duck: 0, duckDecay: 0.2 };
const LMG_RECOIL: RecoilDef = { add: 0.75, max: 1.25, decay: 0.05, back: 1.4, climb: 0.03, shoulder: 0.03, hip: 0.5, duck: 0, duckDecay: 0.2 };
const MORTAR_RECOIL: RecoilDef = { add: 1, max: 1, decay: 0.09, back: 1.2, climb: 0, shoulder: 0, hip: 0, duck: 0.3, duckDecay: 0.32 };
const ROCKET_RECOIL: RecoilDef = { add: 1, max: 1, decay: 0.14, back: 2.6, climb: 0.12, shoulder: 0.16, hip: 1.6, duck: 0.1, duckDecay: 0.3 };

// ---------------------------------------------------------------------------
// Per-kind poses
// ---------------------------------------------------------------------------

const RIFLE_HOLD = { nearPin: 1, farPin: 1, farPx: 7.4, farPy: 0.9 } as const;
const RIFLE_AIM = upper({ ...RIFLE_HOLD, ox: 11.0, oy: -2.8, aim: 1, head: 0.24 });
const RIFLE_REST = upper({ ...RIFLE_HOLD, ox: 6.2, oy: 4.6, angle: -0.3, aim: 0.3 });
const RIFLE_MOVE = upper({ ...RIFLE_HOLD, ox: 3.2, oy: 9.0, angle: 0.75 });
/** Order arms: butt on the ground by the near foot, hand near the muzzle. */
const RIFLE_ORDER = upper({ ground: true, ox: 4.4, oy: -10.7, angle: 1.5, nearPin: 1, nearPx: 15.6, nearPy: 0.2, farPx: 7.4, farPy: 0.9 });

const SMG_HOLD = { nearPin: 1, farPin: 1, farPx: 6.3, farPy: 1.3 } as const;
const SMG_AIM = upper({ ...SMG_HOLD, ox: 8.2, oy: -2.2, aim: 1, head: 0.18 });

const LMG_HOLD = { nearPin: 1, farPin: 1, farPx: 6.6, farPy: 1.3 } as const;
const LMG_HIP = upper({ ...LMG_HOLD, ox: 2.4, oy: 12, angle: -0.08 });

/** Tube over the shoulder, muzzle up behind, base held in front of the chest. */
const MORTAR_SHOULDER = upper({ ox: 5.4, oy: 6.4, angle: 2.42, nearPin: 1, nearPx: 2.6, nearPy: 0.6, farSh: -0.1, farEl: 0.5 });
const MORTAR_SET = upper({
  ground: true,
  ox: 10,
  oy: -1.3,
  angle: 1.1,
  aim: 0.12,
  nearSh: 0.75,
  nearEl: 0.9,
  farPin: 1,
  farPx: 11,
  farPy: 1.3,
  bipod: 1,
});

const AT_HOLD = { nearPin: 1, farPx: 4.6, farPy: 0.4 } as const;
/** Launcher carried on the shoulder, muzzle raised. */
const AT_SHOULDER = upper({ ...AT_HOLD, ox: 4.6, oy: 4.0, angle: 0.4 });
const AT_AIM = upper({ ...AT_HOLD, farPin: 1, ox: 8.4, oy: 2.3, aim: 1, head: 0.14 });

const CRATE_HOLD = { nearPin: 1, farPin: 1, nearPx: 2.4, nearPy: 3.6, farPx: 1.4, farPy: 3.6 } as const;
/** Sapper upper-body poses with a crate. */
export const FIGURE_CRATE = {
  carry: upper({ ...CRATE_HOLD, ox: 6.2, oy: 6.6, angle: 0.04 }),
  ground: upper({ ...CRATE_HOLD, ground: true, ox: 12.5, oy: -4.6 }),
  /** Half size of the crate in wu (it rests on the ground at y = -halfH). */
  halfW: 6.5,
  halfH: 4.4,
} as const;

const FREE = upper({});

export const FIGURE_KINDS: Record<FigureKind, FigureKindDef> = {
  sapper: {
    idle: { stance: STAND, upper: FREE },
    move: upper({ nearSh: 0.1, nearEl: 0.2, farSh: 0, farEl: 0.2 }),
    aim: { stance: STAND, upper: FREE },
    aimAlt: null,
    rest: FREE,
    trench: { stance: TRENCH, upper: upper({ nearSh: 0.9, nearEl: 0.8, farSh: 1.0, farEl: 0.7 }) },
    gait: GAIT_LIGHT,
    recoil: NO_RECOIL,
    reload: 'none',
    reloadX: 0,
    reloadY: 0,
    staysEmplaced: false,
    runAndGun: false,
    steadiness: 1,
    reloadPace: 1,
    aloft: false,
    pack: false,
    pouches: true,
    satchel: false,
  },
  rifle: {
    idle: { stance: STAND, upper: RIFLE_ORDER },
    move: RIFLE_MOVE,
    aim: { stance: STAND_READY, upper: RIFLE_AIM },
    aimAlt: { stance: KNEEL, upper: RIFLE_AIM },
    rest: RIFLE_REST,
    trench: { stance: TRENCH, upper: upper({ ...RIFLE_HOLD, ox: 11.0, oy: -2.4, aim: 1, head: 0.2 }) },
    gait: GAIT_INFANTRY,
    recoil: RIFLE_RECOIL,
    reload: 'bolt',
    reloadX: 2.2,
    reloadY: -2,
    staysEmplaced: false,
    runAndGun: false,
    steadiness: 1,
    reloadPace: 1,
    aloft: true,
    pack: true,
    pouches: true,
    satchel: false,
  },
  lmg: {
    idle: { stance: STAND, upper: LMG_HIP },
    move: upper({ ...LMG_HOLD, ox: 2, oy: 11.4, angle: 0.12 }),
    aim: {
      stance: PRONE,
      upper: upper({ nearPin: 1, farPin: 1, farPx: -5.4, farPy: -1.5, ox: 10.3, oy: -0.7, aim: 0.5, bipod: 1, head: 0.1 }),
    },
    aimAlt: null,
    rest: upper({ nearPin: 1, farPin: 1, farPx: -5.4, farPy: -1.5, ox: 10.3, oy: -0.7, aim: 0.2, bipod: 1, head: -0.1 }),
    trench: {
      stance: stance({ ...TRENCH, spine: 0.6, chest: 0.24 }),
      upper: upper({ nearPin: 1, farPin: 1, farPx: -5.4, farPy: -1.5, ox: 10.3, oy: -1.4, aim: 0.6, bipod: 1, head: 0.14 }),
    },
    gait: GAIT_LOADED,
    recoil: LMG_RECOIL,
    reload: 'magazine',
    reloadX: 4.6,
    reloadY: -4.5,
    staysEmplaced: true,
    runAndGun: false,
    steadiness: 0.6,
    reloadPace: 1,
    aloft: true,
    pack: true,
    pouches: true,
    satchel: false,
  },
  assault: {
    idle: { stance: STAND, upper: upper({ ...SMG_HOLD, ox: 3.8, oy: 10, angle: -0.38 }) },
    move: upper({ ...SMG_HOLD, ox: 5, oy: 8.2, angle: 0.1 }),
    aim: { stance: ASSAULT_READY, upper: SMG_AIM },
    aimAlt: null,
    rest: upper({ ...SMG_HOLD, ox: 5.4, oy: 5.4, angle: -0.22, aim: 0.3 }),
    trench: { stance: TRENCH, upper: upper({ ...SMG_HOLD, ox: 8.2, oy: -2, aim: 1, head: 0.16 }) },
    gait: GAIT_ASSAULT,
    recoil: SMG_RECOIL,
    reload: 'magazine',
    reloadX: 6.2,
    reloadY: 2.6,
    staysEmplaced: false,
    runAndGun: true,
    steadiness: 1.2,
    reloadPace: 1,
    aloft: true,
    pack: false,
    pouches: true,
    satchel: false,
  },
  mortar: {
    idle: { stance: STAND, upper: MORTAR_SHOULDER },
    move: MORTAR_SHOULDER,
    aim: { stance: KNEEL_CREW, upper: MORTAR_SET },
    aimAlt: null,
    rest: MORTAR_SET,
    trench: { stance: TRENCH, upper: upper({ ...MORTAR_SET, ox: 13, oy: VIEW.trenchDepth * -1 - 1.3 }) },
    gait: GAIT_LOADED,
    recoil: MORTAR_RECOIL,
    reload: 'shell',
    reloadX: 21,
    reloadY: 0,
    staysEmplaced: true,
    runAndGun: false,
    steadiness: 1,
    reloadPace: 1,
    aloft: false,
    pack: true,
    pouches: true,
    satchel: false,
  },
  sniper: {
    idle: { stance: STAND, upper: upper({ ...RIFLE_HOLD, ox: 1.2, oy: 9.4, angle: 1.05 }) },
    move: upper({ ...RIFLE_HOLD, ox: 2.4, oy: 10, angle: 0.55 }),
    aim: { stance: KNEEL_STEADY, upper: upper({ ...RIFLE_HOLD, ox: 11.0, oy: -3, aim: 1, head: 0.3 }) },
    aimAlt: null,
    rest: RIFLE_REST,
    trench: { stance: TRENCH, upper: upper({ ...RIFLE_HOLD, ox: 11.0, oy: -2.6, aim: 1, head: 0.24 }) },
    gait: GAIT_SNIPER,
    recoil: SNIPER_RECOIL,
    reload: 'bolt',
    reloadX: 2.2,
    reloadY: -2,
    staysEmplaced: true,
    runAndGun: false,
    steadiness: 0.25,
    reloadPace: 1.45,
    aloft: true,
    pack: false,
    pouches: true,
    satchel: false,
  },
  medic: {
    idle: { stance: STAND, upper: upper({ nearSh: 0.32, nearEl: 0.62, farSh: -0.14, farEl: 0.4 }) },
    move: upper({ nearSh: 0.1, nearEl: 0.2, farSh: 0, farEl: 0.2 }),
    aim: { stance: STAND, upper: FREE },
    aimAlt: null,
    rest: FREE,
    trench: { stance: TRENCH, upper: upper({ nearSh: 0.9, nearEl: 0.8, farSh: 1.0, farEl: 0.7 }) },
    gait: GAIT_LIGHT,
    recoil: NO_RECOIL,
    reload: 'none',
    reloadX: 0,
    reloadY: 0,
    staysEmplaced: false,
    runAndGun: false,
    steadiness: 1,
    reloadPace: 1,
    aloft: false,
    pack: false,
    pouches: false,
    satchel: true,
  },
  at: {
    idle: { stance: STAND, upper: AT_SHOULDER },
    move: upper({ ...AT_SHOULDER, farPin: 1 }),
    aim: { stance: KNEEL_UPRIGHT, upper: AT_AIM },
    aimAlt: null,
    rest: upper({ ...AT_AIM, aim: 0.3, angle: 0.06, head: 0 }),
    trench: { stance: TRENCH, upper: upper({ ...AT_AIM, oy: 1.8 }) },
    gait: GAIT_LOADED,
    recoil: ROCKET_RECOIL,
    reload: 'rocket',
    reloadX: 11,
    reloadY: -3.2,
    staysEmplaced: true,
    runAndGun: false,
    steadiness: 0.8,
    reloadPace: 1,
    aloft: true,
    pack: true,
    pouches: true,
    satchel: false,
  },
};

/** Upper-body poses that are the same for every kind (or only used by one). */
export const FIGURE_UPPERS = {
  /** Assault trooper mid-throw: the gun hangs in the far hand. */
  throwHold: upper({ farPin: 1, farPx: 6.3, farPy: 1.3, ox: 2.6, oy: 11.5, angle: -0.6 }),
  free: FREE,
} as const;

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

export interface WeaponGeom {
  /** Muzzle in weapon space. */
  muzzleX: number;
  muzzleY: number;
  /** Bipod hinge in weapon space, leg length, and the leg direction relative to the barrel when folded. bipodLen 0 = no bipod. */
  bipodX: number;
  bipodY: number;
  bipodLen: number;
  bipodFold: number;
  /** True if it has a separate baseplate that lies flat when the weapon is set up (mortar). */
  baseplate: boolean;
  /** Where the dropped weapon comes to rest above the ground (half its thickness). */
  restY: number;
}

function geom(over: Partial<WeaponGeom>): WeaponGeom {
  return { muzzleX: 24, muzzleY: -0.6, bipodX: 0, bipodY: 0, bipodLen: 0, bipodFold: 0, baseplate: false, restY: 1.6, ...over };
}

export const WEAPON_GEOM: Record<WeaponModel, WeaponGeom> = {
  none: geom({ muzzleX: 0, muzzleY: 0 }),
  crate: geom({ muzzleX: 0, muzzleY: 0, restY: FIGURE_CRATE.halfH }),
  enfield: geom({ muzzleX: 24.6, muzzleY: -0.6 }),
  kar98: geom({ muzzleX: 25.2, muzzleY: -0.6 }),
  enfieldScoped: geom({ muzzleX: 24.6, muzzleY: -0.6 }),
  kar98Scoped: geom({ muzzleX: 25.2, muzzleY: -0.6 }),
  bren: geom({ muzzleX: 25.6, muzzleY: -0.6, bipodX: 19, bipodY: 0.4, bipodLen: 9.4, bipodFold: 0.12 }),
  mg34: geom({ muzzleX: 27.2, muzzleY: -0.6, bipodX: 21.5, bipodY: 0.3, bipodLen: 9.4, bipodFold: 0.12 }),
  sten: geom({ muzzleX: 14.6, muzzleY: -0.6 }),
  mp40: geom({ muzzleX: 15.2, muzzleY: -0.8 }),
  mortar: geom({ muzzleX: 21.5, muzzleY: 0, bipodX: 14, bipodY: 0, bipodLen: 15.6, bipodFold: Math.PI - 0.14, baseplate: true, restY: 2 }),
  piat: geom({ muzzleX: 21, muzzleY: -3.1, restY: 2.6 }),
  panzerschreck: geom({ muzzleX: 26.5, muzzleY: -3.3, restY: 2.2 }),
};

export interface FigureLoadout {
  weapon: Record<FigureKind, WeaponModel>;
  grenade: HandItem;
}

export const FIGURE_LOADOUT: Record<FactionId, FigureLoadout> = {
  british: {
    weapon: {
      sapper: 'crate',
      rifle: 'enfield',
      lmg: 'bren',
      assault: 'sten',
      mortar: 'mortar',
      sniper: 'enfieldScoped',
      medic: 'none',
      at: 'piat',
    },
    grenade: 'mills',
  },
  german: {
    weapon: {
      sapper: 'crate',
      rifle: 'kar98',
      lmg: 'mg34',
      assault: 'mp40',
      mortar: 'mortar',
      sniper: 'kar98Scoped',
      medic: 'none',
      at: 'panzerschreck',
    },
    grenade: 'stick',
  },
};

// ---------------------------------------------------------------------------
// Death animations
// ---------------------------------------------------------------------------

/**
 * One keyframed channel: [time, value, time, value, ...], linear in between and
 * smoothed by the death springs. Limb angles are relative to the lower spine
 * (0 = in line with the body, positive = flexed toward the body's front).
 */
export type Track = readonly number[];

export interface DeathTracks {
  /** Hip x offset from where the figure stood, and absolute hip y. */
  hipX: Track;
  hipY: Track;
  spine: Track;
  chest: Track;
  head: Track;
  nearSh: Track;
  nearEl: Track;
  farSh: Track;
  farEl: Track;
  nearThigh: Track;
  nearKnee: Track;
  farThigh: Track;
  farKnee: Track;
  /** Seconds after which the body lies still. */
  still: number;
}

export const DEATH_TRACKS: Record<Exclude<DeathVariant, 'blast'>, DeathTracks> = {
  crumple: {
    hipX: [0, 0, 0.15, 0.5, 0.5, 3.5, 0.95, 10, 1.1, 10.5],
    hipY: [0, -26.5, 0.12, -27.2, 0.5, -13.5, 0.64, -12.6, 0.95, -3.7, 1.02, -4.5, 1.1, -3.7],
    spine: [0, 0.05, 0.1, -0.14, 0.5, 0.3, 0.65, 0.46, 0.95, 1.52, 1.1, 1.48],
    chest: [0, 0.05, 0.5, 0.3, 0.95, 0.05],
    head: [0, 0, 0.1, -0.35, 0.5, 0.45, 0.95, 0.2, 1.05, 0.3],
    nearSh: [0, 0.4, 0.12, 0.9, 0.5, 0.15, 0.95, 2.75],
    nearEl: [0, 1.0, 0.5, 0.35, 0.95, 0.5],
    farSh: [0, 0.4, 0.5, 0.3, 0.95, 0.5],
    farEl: [0, 1.0, 0.5, 0.5, 0.95, 1.6],
    nearThigh: [0, 0.1, 0.5, 1.0, 0.65, 1.0, 0.95, 0.12],
    nearKnee: [0, 0.2, 0.5, 2.05, 0.65, 2.1, 0.95, 0.25],
    farThigh: [0, 0, 0.5, 0.8, 0.65, 0.85, 0.95, 0.3],
    farKnee: [0, 0.2, 0.5, 1.9, 0.65, 2.0, 0.95, 0.75],
    still: 1.5,
  },
  thrown: {
    hipX: [0, 0, 0.08, -2, 0.3, -14, 0.5, -21, 0.7, -24, 0.9, -25],
    hipY: [0, -26.5, 0.1, -29.5, 0.2, -30, 0.34, -20, 0.48, -4.2, 0.56, -6.4, 0.66, -3.8],
    spine: [0, 0.05, 0.07, -0.45, 0.2, -0.9, 0.36, -1.35, 0.48, -1.62, 0.6, -1.5, 0.7, -1.56],
    chest: [0, 0.05, 0.08, -0.25, 0.48, -0.1, 0.7, 0],
    head: [0, 0, 0.06, -0.5, 0.25, 0.3, 0.48, -0.2, 0.7, 0.05],
    nearSh: [0, 0.5, 0.1, 1.5, 0.3, 2.2, 0.5, 2.9, 0.7, 2.95],
    nearEl: [0, 1.0, 0.1, 0.3, 0.5, 0.5, 0.7, 0.7],
    farSh: [0, 0.5, 0.1, 1.2, 0.3, 1.0, 0.5, -0.1, 0.7, -0.3],
    farEl: [0, 1.0, 0.12, 0.4, 0.7, 0.3],
    nearThigh: [0, 0.1, 0.12, 0.5, 0.3, 1.1, 0.48, 0.9, 0.7, 0.8],
    nearKnee: [0, 0.2, 0.3, 0.6, 0.48, 1.2, 0.7, 1.6],
    farThigh: [0, 0, 0.12, 0.3, 0.3, 0.8, 0.48, 0.2, 0.7, 0.05],
    farKnee: [0, 0.2, 0.3, 0.3, 0.7, 0.15],
    still: 1.2,
  },
  spin: {
    hipX: [0, 0, 0.1, -1.5, 0.45, -7, 0.9, -11, 1.1, -11.5],
    hipY: [0, -26.5, 0.1, -27.5, 0.45, -23, 0.7, -11, 0.92, -3.8, 1.0, -4.8, 1.1, -3.8],
    spine: [0, 0.05, 0.1, -0.35, 0.3, 0.15, 0.5, 0.55, 0.7, -0.3, 0.92, -1.5, 1.1, -1.56],
    chest: [0, 0.05, 0.3, 0.3, 0.5, 0.35, 0.92, -0.05],
    head: [0, 0, 0.08, -0.45, 0.4, 0.4, 0.7, -0.3, 0.95, 0.1],
    nearSh: [0, 0.5, 0.12, 2.6, 0.35, 4.2, 0.55, 5.6, 0.75, 6.6, 0.95, 6.1],
    nearEl: [0, 1.0, 0.12, 0.2, 0.55, 0.4, 0.92, 0.5],
    farSh: [0, 0.5, 0.15, 1.0, 0.5, 0.9, 0.92, 0.6],
    farEl: [0, 1.0, 0.15, 2.0, 0.5, 2.2, 0.92, 1.9],
    nearThigh: [0, 0.1, 0.2, 0.6, 0.45, -0.2, 0.7, 0.9, 0.92, 1.0],
    nearKnee: [0, 0.2, 0.2, 0.9, 0.45, 0.3, 0.7, 1.6, 0.92, 1.9],
    farThigh: [0, 0, 0.2, -0.2, 0.45, 0.5, 0.7, 0.6, 0.92, 0.55],
    farKnee: [0, 0.2, 0.45, 0.7, 0.7, 1.5, 0.92, 1.3],
    still: 1.5,
  },
};

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

export const FIGURE = {
  height: VIEW.figureHeight,
  /** Bone lengths in wu. They never change in any pose. */
  bones: {
    thigh: 13.4,
    shin: 13.4,
    spineLower: 9,
    spineUpper: 8,
    neck: 5.2,
    upperArm: 9,
    forearm: 9,
  },
  headRadius: 5.0,
  /** Height of the ankle joint above the sole when the foot is flat. */
  ankle: 2.6,
  /** Ankle to toe tip, and ankle back to the heel, along the sole. */
  footLength: 5.2,
  heel: 1.8,
  /** The shoulders sit this far below the neck joint, along the upper spine. */
  shoulderDrop: 1.6,
  /** Limbs never straighten past this share of their full length, nor fold tighter than minReach. */
  reach: 0.992,
  minReach: 0.18,
  /** Half thickness of each part at its start and end joint (wu). */
  radius: {
    thigh: [2.35, 2.1],
    shin: [2.1, 1.8],
    upperArm: [1.95, 1.75],
    forearm: [1.75, 1.8],
    torsoLower: [3.1, 3.4],
    torsoUpper: [3.4, 3.0],
  },
  colors: {
    /** Camera-side limbs, torso and head. */
    body: '#0c0c0e',
    /** Far-side limbs: a touch lighter so crossing legs and arms read. */
    bodyFar: '#25272b',
    /** Opaque so overlapping rim pieces never double up at the joints. */
    rim: '#a49e8f',
    steel: '#2a2f35',
    steelLight: '#4b535b',
    wood: '#4a3320',
    woodLight: '#6a4a2c',
    white: '#e6e1cf',
    red: '#b3322b',
    crate: '#70583a',
    crateDark: '#463622',
  },
  /** Width of the light rim drawn under the black parts (wu). */
  rimWidth: 0.75,
  /** How far joints must stay above the ground so the drawn limb does not sink into it. */
  ground: {
    hip: 3.0,
    chest: 3.2,
    neck: 2.2,
    head: 4.6,
    knee: 1.8,
    elbow: 1.5,
    hand: 1.4,
    ankle: 2.0,
  },
  /** Spring time constants in seconds (critically damped; about 5x this to settle). */
  spring: {
    body: 0.072,
    feet: 0.07,
    arm: 0.07,
    pin: 0.055,
    hand: 0.04,
    gait: 0.075,
    style: 0.16,
    bipod: 0.09,
    item: 0.035,
    /** Death: stiff, so the keyframed tracks stay snappy. */
    death: 0.042,
    deathLimb: 0.055,
    dropWeapon: 0.11,
    /** The throwing arm and the body lunge are fast. */
    throwArm: 0.012,
    throwBody: 0.04,
  },
  /** Fastest a pinned arm may swing (rad/s), so a hand never whips round when its grip passes close to the shoulder. */
  armRate: 15,
  /** Rise time of the recoil kick (s): sharp, but never a one-frame pop. */
  recoilAttack: 0.014,
  /** Largest dt one update will take; longer frames are clamped (a tab that was hidden). */
  maxDt: 0.1,
  aimPitchLimit: 40 * DEG,
  gait: {
    /** Below this speed (wu/s) the figure stands. */
    minSpeed: 4,
    /** Share of the stance after which the heel starts to rise. */
    heelRiseStart: 0.55,
    /** Share of the stance over which the toe comes down after heel strike. */
    strikeSpan: 0.16,
    /** Walking backwards: stride and foot lift multipliers, and the torso lean. */
    backStride: 0.72,
    backLift: 0.7,
    backLean: -0.08,
    /** Softness (wu) of the clamp that lowers the hip so a planted foot stays in reach. */
    reachSoftness: 0.5,
    /** While blending between standing and the gait, a foot that has to travel hops this high. */
    blendLift: 2.6,
    blendLiftSpan: 7,
    /** Posed feet moving at this speed (wu/s) are lifted by the full blendLift. */
    hopSpeed: 60,
    /** Swing foot reach: share of the stance foot speed kept at lift-off and touchdown (the foot reaches past its mark and pulls back). */
    reachTangent: 0.55,
    /** Share of the swing at each end over which the foot still carries weight (for the hip reach clamp). */
    loadSpan: 0.12,
    /** A move longer than this share of a stride in one update re-plants the feet (a teleport, or a frame after a long pause). */
    teleport: 0.35,
    /** The arms and the carried weapon trail the legs by this share of a cycle. */
    armLag: 0.035,
    weaponLag: 0.06,
    /** Exertion builds while moving and fades while standing (seconds); it deepens the breathing. */
    exertionRise: 2.5,
    exertionFall: 5,
  },
  idle: {
    breathPeriod: 3.3,
    breathChest: 0.016,
    breathLift: 0.3,
    /** Extra breathing depth and speed at full exertion. */
    exertionDepth: 2.2,
    exertionRate: 1.9,
    shiftPeriod: 6.4,
    shiftX: 1.1,
    shiftDrop: 0.35,
    shiftLean: 0.022,
    /** A glance may happen once per window; chance per window and size of the head turn. */
    glancePeriod: 3.7,
    glanceChance: 0.42,
    glanceAngle: 0.28,
    glanceTwist: 0.9,
    /** Seconds a soldier stays in his firing stance after the last target before standing up. */
    relaxAfter: 3.2,
    relaxSpread: 2.4,
    /** Weapon sway while aiming. */
    swayAngle: 0.012,
    swayPeriod: 2.3,
  },
  /** Hit flinch: an under-damped jolt backward (kick is the velocity added per hit). */
  flinch: {
    kick: 22,
    frequency: 16,
    damping: 0.5,
    spine: 0.35,
    head: 0.5,
    hipX: 2.5,
    hipY: 1.3,
    arm: 0.5,
  },
  reload: {
    /** Bolt action, seconds into the reload: hand leaves the grip, grabs the bolt, bolt open, bolt closed, hand back. */
    boltStart: 0.1,
    boltGrab: 0.24,
    boltOpen: 0.38,
    boltClosed: 0.52,
    boltDone: 0.7,
    boltPull: 4.4,
    /** The rifle comes off the aim line while the bolt is worked. */
    boltDip: 0.3,
    boltDrop: 2.4,
    boltHead: -0.26,
    /** Magazine change: only shown when the reload lasts longer than magDelay. */
    magDelay: 0.34,
    magToPouch: 0.2,
    magAtPouch: 0.42,
    magToGun: 0.66,
    magSeated: 0.82,
    magDone: 1.02,
    magTilt: 0.2,
    pouchSh: 0.3,
    pouchEl: 1.05,
    /** Mortar: fetch a bomb from beside the knee and hold it over the muzzle. */
    shellDelay: 0.5,
    shellReach: 0.85,
    shellLift: 1.5,
    shellSh: -0.25,
    shellEl: 0.35,
    shellHoverX: -1.6,
    shellHoverY: -3,
    /** Anti-tank: the far hand takes a round from the pack and feeds the launcher. */
    rocketDelay: 0.5,
    rocketReach: 0.9,
    rocketLoad: 1.5,
    rocketDone: 2.0,
    rocketSh: -0.7,
    rocketEl: 1.7,
  },
  throw: {
    /** Seconds from the start of the throw action to the moment the grenade leaves the hand. */
    releaseTime: 0.36,
    windUp: 0.22,
    followThrough: 0.56,
    done: 0.9,
    /** Throwing-arm swing and elbow flex at rest, wound up, at release and at the end. */
    shStart: 0.3,
    shWound: -2.15,
    shRelease: -4.25,
    shEnd: -5.2,
    elWound: 1.9,
    elRelease: 0.25,
    elEnd: 0.6,
    /** Body: lean back, then lunge. */
    leanBack: -0.26,
    leanForward: 0.42,
    hipBack: -2.2,
    hipForward: 3,
    /** Where the grenade leaves the hand is exposed by the pose; this is the item's offset along the forearm. */
    itemOffset: 1.2,
  },
  load: {
    /** The crate comes up to the chest this many seconds before loading ends. */
    liftTime: 0.6,
    heavePeriod: 0.9,
    heaveLift: 2.2,
    heaveSpine: 0.12,
  },
  heal: {
    rate: 6.5,
    nearSh: 0.95,
    nearEl: 0.85,
    farSh: 1.2,
    farEl: 0.6,
    swing: 0.22,
    nod: 0.05,
  },
  deploy: {
    rate: 9,
    reach: 1.6,
    head: 0.22,
  },
  cheer: {
    rate: 9.5,
    hop: 1.3,
    /** Weapon held aloft relative to the near shoulder. */
    weaponX: 3,
    weaponY: -15.5,
    weaponAngle: 1.15,
    weaponWave: 0.22,
    armSh: 2.75,
    armEl: 0.3,
    armWave: 0.3,
  },
  satchel: {
    /** The satchel trails by this many radians per wu/s and bounces with each step. */
    trail: 0.0035,
    bounce: 0.16,
    tau: 0.09,
  },
  death: {
    /** Legs and arms hang this loosely (rad of random wobble) while a body is in the air. */
    flail: 0.55,
    flailRate: 6,
    /** Blast toss: launch speeds (wu/s), gravity (wu/s^2), bounce and slide. */
    blastVx: 62,
    blastVy: 140,
    gravity: 520,
    bounce: 0.3,
    bounceVx: 0.45,
    slide: 0.22,
    slideDist: 4,
    /** Seconds the body keeps settling after it lands before it is still. */
    settle: 0.5,
    /** A dropped weapon ends up this far from where it was let go. */
    weaponDrift: 5,
    weaponFallDelay: 0.08,
    crateTilt: 0.2,
    /** Relaxed foot: toe pointed this far beyond a right angle to the shin. */
    footFlex: 0.9,
    /** Speed variation between bodies (+- share). */
    timeSpread: 0.12,
    /** Seconds over which the live pose at the moment of death fades into the fall. */
    fade: 0.22,
    /** Hip height of a body lying on the ground. */
    lieHip: -3.8,
    /** A soldier whose hip is lower than this (kneeling, prone) skips the start of the fall. */
    skipAbove: -20,
    /** Share of the matching track time actually skipped (the start offset absorbs the rest), and the slower rate of a skipped fall. */
    skipShare: 0.7,
    /** A body bent further than this (rad of lean) when shot falls on its face; one leaning back that far falls on its back. */
    faceDownLean: 0.8,
    /** Lying prone (lean beyond this) when killed: keep this share of the live pose and only go limp. */
    proneLean: 1.1,
    proneKeep: 0.8,
    /** Seconds before the body comes to rest over which limbs settle onto the ground. */
    restBlend: 0.45,
    skipRate: 0.8,
  },
  icon: {
    /** Empty margin around a unit portrait as a share of the canvas. */
    margin: 0.08,
  },
} as const;

/** Lying poses the blast toss settles into, as limb angles relative to the spine. */
export const DEATH_REST = {
  faceDown: { chest: 0.05, head: 0.25, nearSh: 2.8, nearEl: 0.5, farSh: 0.5, farEl: 1.5, nearThigh: 0.1, nearKnee: 0.2, farThigh: 0.35, farKnee: 0.8 },
  onBack: { chest: 0, head: 0.05, nearSh: 2.9, nearEl: 0.7, farSh: -0.3, farEl: 0.3, nearThigh: 0.8, nearKnee: 1.6, farThigh: 0.05, farKnee: 0.15 },
  /** Limbs flung wide in the air. */
  air: { chest: -0.1, head: -0.2, nearSh: 2.3, nearEl: 0.4, farSh: 1.4, farEl: 0.5, nearThigh: 0.7, nearKnee: 0.8, farThigh: -0.3, farKnee: 0.5 },
} as const;

/**
 * Weights for choosing a death by what killed the soldier. Bullets from the
 * front (the blow travels against the facing) throw him back or spin him;
 * bullets from behind pitch him forward; explosions always toss.
 */
export const DEATH_CHOICE: Record<DamageType, { front: readonly [DeathVariant, number][]; back: readonly [DeathVariant, number][] }> = {
  bullet: {
    front: [
      ['thrown', 0.42],
      ['spin', 0.3],
      ['crumple', 0.28],
    ],
    back: [
      ['crumple', 0.7],
      ['spin', 0.3],
    ],
  },
  explosive: { front: [['blast', 1]], back: [['blast', 1]] },
  antiTank: { front: [['blast', 1]], back: [['blast', 1]] },
};
