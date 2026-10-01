/**
 * Live figure animation. updateFigure() advances one unit's FigureAnim and
 * writes its pose without allocating.
 *
 * Layers, composed every frame:
 *  1. Posed layer: per-channel critically damped springs toward the stance and
 *     upper-body pose of the current action (FIGURE_KINDS), so every transition
 *     blends.
 *  2. Gait layer: a distance-driven gait cycle. Planted feet are anchored in
 *     world space (they never skate), swing feet follow a Hermite arc, the hip
 *     bobs twice per cycle. It is mixed in by the springed gait weight.
 *  3. Additive dynamics: recoil, crew duck, hit flinch, breathing, weight shift,
 *     glances, cheer hops.
 * Legs and arms are solved with two-bone IK into a pose vector of angles, then
 * forward kinematics produce the joints, so bone lengths are always exact.
 */
import { CONFIG } from '../../data/config';
import {
  DEATH_CHOICE,
  FIGURE,
  FIGURE_CRATE,
  FIGURE_GAIT_CARRY,
  FIGURE_KINDS,
  FIGURE_LOADOUT,
  FIGURE_STANCES,
  FIGURE_UPPERS,
  type DeathVariant,
  type FigureKindDef,
  type GaitStyle,
  type StanceDef,
  type UpperDef,
} from '../../data/figure';
import type { DamageType } from '../../data/schema';
import { VIEW } from '../../data/view';
import { updateDeath } from './death';
import { HALF_PI, TAU, clamp, clamp01, frac, hash01, lerp, lerpAngle, ramp, sampleTrack, smooth01, smoothMax, solveIk, springStep } from './math';
import {
  C_AIM,
  C_BACK,
  C_BIPOD,
  C_CHEER,
  C_CHEST,
  C_FEL,
  C_FFP,
  C_FFX,
  C_FFY,
  C_FPIN,
  C_FPX,
  C_FPY,
  C_FSH,
  C_GAIT,
  C_GND,
  C_GNDX,
  C_GNDY,
  C_HEAD,
  C_HEADX,
  C_HIPX,
  C_HIPY,
  C_NEL,
  C_NFP,
  C_NFX,
  C_NFY,
  C_NPIN,
  C_NPX,
  C_NPY,
  C_NSH,
  C_PLATE,
  C_RELX,
  C_RELY,
  C_SPINE,
  C_STYLE,
  C_TWIST,
  C_WANG,
  J_MUZZLE,
  J_NHAND,
  N_CHANNELS,
  P_BIPOD,
  P_CHEST,
  P_FFP,
  P_FTH,
  P_FUA,
  P_HIPX,
  P_HIPY,
  P_LIFT,
  P_NECK,
  P_NFP,
  P_NTH,
  P_NUA,
  P_SATCHEL,
  P_SPINE,
  P_TWIST,
  P_WA,
  P_WX,
  P_WY,
  footBottom,
  isFigureKind,
  poseToJoints,
  type FigureAnim,
  type FigureInput,
} from './pose';

const F = FIGURE;
const BONES = F.bones;
const LEG = BONES.thigh + BONES.shin;

// ---------------------------------------------------------------------------
// Gait style blending (into one scratch record, no allocation per frame)
// ---------------------------------------------------------------------------
const STYLE_KEYS: readonly (keyof GaitStyle)[] = [
  'stride', 'duty', 'lift', 'liftSkew', 'kick', 'toeOff', 'strike', 'center', 'hipHeight', 'bob', 'bobLag',
  'surge', 'hipX', 'lean', 'chest', 'headLevel', 'pitch', 'armSwing', 'elbow', 'elbowSwing', 'twist',
  'weaponBob', 'weaponRock',
];
const GS: GaitStyle = { ...FIGURE_KINDS.rifle.gait.slow };

function blendStyle(a: GaitStyle, b: GaitStyle, t: number): void {
  for (let i = 0; i < STYLE_KEYS.length; i++) {
    const k = STYLE_KEYS[i];
    GS[k] = a[k] + (b[k] - a[k]) * t;
  }
}

// ---------------------------------------------------------------------------
// Keyframed throw (built once from the tunables)
// ---------------------------------------------------------------------------
const TH = F.throw;
const HOLD = FIGURE_UPPERS.throwHold;
const THROW_SH: readonly number[] = [
  0, TH.shStart, TH.windUp, TH.shWound, TH.releaseTime, TH.shRelease, TH.followThrough, TH.shEnd, TH.done, HOLD.nearSh - TAU,
];
const THROW_EL: readonly number[] = [
  0, HOLD.nearEl, TH.windUp, TH.elWound, TH.releaseTime, TH.elRelease, TH.followThrough, TH.elEnd, TH.done, HOLD.nearEl,
];
const THROW_LEAN: readonly number[] = [0, 0, TH.windUp, TH.leanBack, TH.releaseTime + 0.06, TH.leanForward, TH.done, 0.04];
const THROW_HIP: readonly number[] = [0, 0, TH.windUp, TH.hipBack, TH.releaseTime + 0.06, TH.hipForward, TH.done, 0.5];

// ---------------------------------------------------------------------------
// Death choice
// ---------------------------------------------------------------------------

/**
 * Pick a death fall from what killed the unit. fromFront: the blow came from
 * the direction the unit faces. roll: a uniform random number in [0, 1).
 */
export function chooseDeathVariant(cause: DamageType, fromFront: boolean, roll: number): DeathVariant {
  const list = fromFront ? DEATH_CHOICE[cause].front : DEATH_CHOICE[cause].back;
  let total = 0;
  for (let i = 0; i < list.length; i++) total += list[i][1];
  let r = clamp01(roll) * total;
  for (let i = 0; i < list.length; i++) {
    r -= list[i][1];
    if (r < 0) return list[i][0];
  }
  return list[list.length - 1][0];
}

// ---------------------------------------------------------------------------
// Targets of the posed layer
// ---------------------------------------------------------------------------

function setStance(a: FigureAnim, s: StanceDef): void {
  const tg = a.tg;
  tg[C_HIPX] = s.hipX;
  tg[C_HIPY] = s.hipY;
  tg[C_SPINE] = s.spine;
  tg[C_CHEST] = s.chest;
  tg[C_HEAD] = s.head;
  tg[C_TWIST] = s.twist;
  tg[C_NFX] = s.nearFootX;
  tg[C_NFY] = s.nearFootY;
  tg[C_NFP] = s.nearPitch;
  tg[C_FFX] = s.farFootX;
  tg[C_FFY] = s.farFootY;
  tg[C_FFP] = s.farPitch;
  if (s.settle > a.settle) a.settle = s.settle;
  a.stanceSettle = s.settle;
}

function setUpper(a: FigureAnim, u: UpperDef): void {
  const tg = a.tg;
  if (u.ground) {
    tg[C_GNDX] = u.ox;
    tg[C_GNDY] = u.oy;
    tg[C_GND] = 1;
  } else {
    a.relTX = u.ox;
    a.relTY = u.oy;
    tg[C_GND] = 0;
  }
  tg[C_WANG] = u.angle;
  tg[C_AIM] = u.aim;
  tg[C_NPIN] = u.nearPin;
  tg[C_FPIN] = u.farPin;
  tg[C_NPX] = u.nearPx;
  tg[C_NPY] = u.nearPy;
  tg[C_FPX] = u.farPx;
  tg[C_FPY] = u.farPy;
  tg[C_NSH] = u.nearSh;
  tg[C_NEL] = u.nearEl;
  tg[C_FSH] = u.farSh;
  tg[C_FEL] = u.farEl;
  tg[C_BIPOD] = u.bipod;
  tg[C_HEADX] = u.head;
}

/** Up 0 -> 1 between t0 and t1, hold, down to 0 between t2 and t3. */
function env(t: number, t0: number, t1: number, t2: number, t3: number): number {
  if (t <= t0 || t >= t3) return 0;
  if (t < t1) return smooth01((t - t0) / (t1 - t0));
  if (t <= t2) return 1;
  return 1 - smooth01((t - t2) / (t3 - t2));
}

function moveFireUpper(K: FigureKindDef, kind: FigureAnim['kind']): UpperDef {
  if (kind === 'lmg') return K.idle.upper;
  if (kind === 'mortar' || kind === 'sapper' || kind === 'medic') return K.move;
  return K.aim.upper;
}

/** Choose stance and upper-body targets, overlays and spring time constants for this frame. */
function chooseTargets(a: FigureAnim, inp: FigureInput, K: FigureKindDef, moving: boolean): void {
  pickTargets(a, inp, K, moving);
  const r = Math.hypot(a.relTX, a.relTY);
  const ang = Math.atan2(a.relTY, a.relTX);
  a.tg[C_RELX] = r;
  a.tg[C_RELY] = ang + TAU * Math.round((a.sv[C_RELY] - ang) / TAU);
}

function pickTargets(a: FigureAnim, inp: FigureInput, K: FigureKindDef, moving: boolean): void {
  const tg = a.tg;
  const tau = a.tau;
  const t = a.actionTime;
  const act = inp.action === 'inside' ? 'idle' : inp.action;
  const combat = act === 'aim' || act === 'fire' || act === 'reload' || act === 'deploy';
  if (combat) {
    a.lastCombat = a.time;
    a.emplaced = true;
  }
  if (moving) a.emplaced = false;
  const fire = a.altAim && K.aimAlt ? K.aimAlt : K.aim;
  const trench = inp.inTrench && !moving;
  const relaxing = a.time - a.lastCombat < a.relaxAfter || (K.staysEmplaced && a.emplaced);

  a.item = 'none';
  a.itemFar = false;
  a.crateVisible = a.kind === 'sapper' && (inp.carrying || act === 'load');
  a.weaponVisible = a.model !== 'none' && a.model !== 'crate';
  tg[C_GAIT] = moving ? 1 : 0;
  tg[C_CHEER] = inp.victory && !moving ? 1 : 0;
  tg[C_PLATE] = 0;

  // Default time constants.
  const settle = a.settle;
  const body = F.spring.body * settle;
  for (let c = C_HIPX; c <= C_TWIST; c++) tau[c] = body;
  for (let c = C_NFX; c <= C_FFP; c++) tau[c] = F.spring.feet * settle;
  for (let c = C_RELX; c <= C_AIM; c++) tau[c] = F.spring.arm;
  for (let c = C_NPIN; c <= C_FPY; c++) tau[c] = F.spring.pin;
  for (let c = C_NSH; c <= C_FEL; c++) tau[c] = F.spring.arm;
  tau[C_BIPOD] = F.spring.bipod;
  tau[C_PLATE] = F.spring.bipod;
  tau[C_HEADX] = F.spring.body;
  tau[C_GAIT] = F.spring.gait;
  tau[C_STYLE] = F.spring.style;
  tau[C_BACK] = F.spring.style;
  tau[C_CHEER] = F.spring.body;

  if (moving) {
    setStance(a, K.idle.stance);
    if (a.kind === 'sapper' && inp.carrying) setUpper(a, FIGURE_CRATE.carry);
    else if ((act === 'aim' || act === 'fire' || act === 'reload') && (K.runAndGun || inp.controlled)) setUpper(a, moveFireUpper(K, a.kind));
    else {
      setUpper(a, K.move);
      // Personal carry style (hands stay pinned to the weapon, so the arms follow).
      if (a.weaponVisible && tg[C_AIM] === 0) {
        tg[C_WANG] += a.carryTilt;
        a.relTY += a.carryLift;
      }
    }
    return;
  }

  if (inp.victory) {
    setStance(a, FIGURE_STANCES.cheer);
    setUpper(a, K.idle.upper);
    if (K.aloft && a.weaponVisible) {
      tg[C_GND] = 0;
      a.relTX = F.cheer.weaponX;
      a.relTY = F.cheer.weaponY;
      tg[C_WANG] = F.cheer.weaponAngle;
      tg[C_AIM] = 0;
      tg[C_NPIN] = 1;
      tg[C_NPX] = 0;
      tg[C_NPY] = 0;
      tg[C_FPIN] = 0;
    } else {
      tg[C_NPIN] = 0;
      tg[C_FPIN] = 0;
      tg[C_NSH] = F.cheer.armSh;
      tg[C_NEL] = F.cheer.armEl;
      if (a.kind === 'sapper' && inp.carrying) {
        setUpper(a, FIGURE_CRATE.carry);
      }
    }
    tg[C_FSH] = F.cheer.armSh - 0.25;
    tg[C_FEL] = F.cheer.armEl + 0.2;
    tg[C_BIPOD] = 0;
    return;
  }

  if (a.kind === 'sapper' && act !== 'load') {
    setStance(a, trench ? K.trench.stance : K.idle.stance);
    if (inp.carrying) setUpper(a, FIGURE_CRATE.carry);
    else setUpper(a, trench ? K.trench.upper : K.idle.upper);
    return;
  }

  switch (act) {
    case 'aim':
    case 'fire':
      setStance(a, trench ? K.trench.stance : fire.stance);
      setUpper(a, trench ? K.trench.upper : fire.upper);
      if (a.kind === 'mortar' && a.sinceFire < 0.35) {
        // The hand snaps back from the muzzle as the bomb drops.
        tg[C_NPIN] = 0;
        tg[C_NSH] = F.reload.shellSh + 0.5;
        tg[C_NEL] = 1.4;
        tau[C_NPIN] = F.spring.hand;
      }
      break;
    case 'reload':
      setStance(a, trench ? K.trench.stance : fire.stance);
      setUpper(a, trench ? K.trench.upper : fire.upper);
      reloadOverlay(a, K, t);
      break;
    case 'throw': {
      setStance(a, trench ? K.trench.stance : FIGURE_STANCES.throw);
      setUpper(a, FIGURE_UPPERS.throwHold);
      // The keyframed arm starts from wherever the arm was, so the fast spring never snaps.
      const from = 1 - smooth01(t / TH.windUp);
      tg[C_NSH] = sampleTrack(THROW_SH, t) + (a.throwSh - TH.shStart) * from;
      tg[C_NEL] = sampleTrack(THROW_EL, t) + (a.throwEl - HOLD.nearEl) * from;
      tau[C_NSH] = F.spring.throwArm;
      tau[C_NEL] = F.spring.throwArm;
      const lean = sampleTrack(THROW_LEAN, t);
      tg[C_SPINE] += lean;
      tg[C_HEAD] -= lean * 0.6;
      tg[C_HIPX] += sampleTrack(THROW_HIP, t);
      tau[C_SPINE] = F.spring.throwBody;
      tau[C_HIPX] = F.spring.throwBody;
      tau[C_HEAD] = F.spring.throwBody;
      if (t < TH.releaseTime) a.item = FIGURE_LOADOUT[a.faction].grenade;
      break;
    }
    case 'load':
      loadOverlay(a, K, t, inp.carrying);
      break;
    case 'heal': {
      setStance(a, trench ? K.trench.stance : FIGURE_STANCES.heal);
      setUpper(a, FIGURE_UPPERS.free);
      const h = F.heal;
      const ph = t * h.rate + a.seed;
      tg[C_NSH] = h.nearSh + h.swing * Math.sin(ph);
      tg[C_NEL] = h.nearEl + h.swing * 0.8 * Math.cos(ph);
      tg[C_FSH] = h.farSh + h.swing * Math.sin(ph + 2.1);
      tg[C_FEL] = h.farEl + h.swing * 0.6 * Math.cos(ph + 2.1);
      tg[C_HEADX] = 0.15 + h.nod * Math.sin(ph * 0.5);
      tau[C_NSH] = tau[C_NEL] = tau[C_FSH] = tau[C_FEL] = F.spring.hand;
      break;
    }
    case 'deploy': {
      setStance(a, trench ? K.trench.stance : fire.stance);
      setUpper(a, trench ? K.trench.upper : K.rest);
      const d = F.deploy;
      const ph = t * d.rate;
      tg[C_NPIN] = 0;
      tg[C_NSH] = d.reach + 0.22 * Math.sin(ph);
      tg[C_NEL] = 0.7 + 0.35 * Math.sin(ph + 1.3);
      tg[C_HEADX] = d.head;
      tg[C_BIPOD] = clamp01(t * 1.5) * tg[C_BIPOD];
      break;
    }
    default: {
      // idle
      if (trench) {
        setStance(a, K.trench.stance);
        setUpper(a, K.trench.upper);
        tg[C_AIM] *= 0.3;
      } else if (relaxing || inp.controlled) {
        setStance(a, fire.stance);
        setUpper(a, K.rest);
      } else {
        setStance(a, K.idle.stance);
        setUpper(a, K.idle.upper);
      }
    }
  }
  if (a.kind === 'mortar') tg[C_PLATE] = tg[C_GND];
}

function reloadOverlay(a: FigureAnim, K: FigureKindDef, t0: number): void {
  const tg = a.tg;
  const tau = a.tau;
  const R = F.reload;
  const t = t0 / K.reloadPace;
  switch (K.reload) {
    case 'bolt': {
      const toBolt = env(t, R.boltStart, R.boltGrab, R.boltClosed, R.boltDone);
      const pull = env(t, R.boltGrab, R.boltOpen, R.boltOpen, R.boltClosed);
      tg[C_NPX] = lerp(tg[C_NPX], K.reloadX, toBolt) - R.boltPull * pull;
      tg[C_NPY] = lerp(tg[C_NPY], K.reloadY, toBolt) - 0.7 * pull;
      tg[C_WANG] -= R.boltDip * toBolt;
      a.relTY += R.boltDrop * toBolt;
      tg[C_HEADX] += R.boltHead * toBolt;
      tau[C_NPX] = tau[C_NPY] = F.spring.hand;
      break;
    }
    case 'magazine': {
      const u = t - R.magDelay;
      if (u <= 0) break;
      const away = env(u, 0, R.magToPouch, R.magAtPouch, R.magToGun);
      const well = env(u, 0, R.magToPouch, R.magSeated, R.magDone);
      tg[C_FPIN] *= 1 - away;
      // The pouch is on the belt: reach for it relative to the body (a prone gunner reaches forward, not into the ground).
      tg[C_FSH] = R.pouchSh + tg[C_SPINE] * 0.9;
      tg[C_FEL] = R.pouchEl;
      const seat = env(u, R.magToGun, R.magSeated, R.magSeated, R.magDone);
      tg[C_FPX] = lerp(tg[C_FPX], K.reloadX, well);
      tg[C_FPY] = lerp(tg[C_FPY], K.reloadY - 2.2 * away + 0.9 * seat, well);
      tg[C_WANG] += R.magTilt * env(u, 0, R.magToPouch, R.magSeated, R.magDone);
      tau[C_FPIN] = tau[C_FPX] = tau[C_FPY] = F.spring.hand;
      break;
    }
    case 'shell': {
      if (t < R.shellDelay) break;
      tg[C_NPIN] = 0;
      tg[C_NSH] = R.shellSh;
      tg[C_NEL] = R.shellEl;
      if (t >= R.shellReach) {
        a.item = 'shell';
        if (t >= R.shellReach + 0.12) {
          tg[C_NPIN] = 1;
          tg[C_NPX] = a.geom.muzzleX + R.shellHoverX;
          tg[C_NPY] = R.shellHoverY;
          tau[C_NPIN] = F.spring.arm * 1.6;
        }
      }
      break;
    }
    case 'rocket': {
      if (t < R.rocketDelay || t >= R.rocketDone) break;
      if (t < R.rocketReach + 0.1) {
        tg[C_FPIN] = 0;
        tg[C_FSH] = R.rocketSh;
        tg[C_FEL] = R.rocketEl;
        if (t >= R.rocketReach - 0.1) {
          a.item = 'rocket';
          a.itemFar = true;
        }
      } else if (t < R.rocketLoad) {
        a.item = 'rocket';
        a.itemFar = true;
        tg[C_FPIN] = 1;
        tg[C_FPX] = K.reloadX;
        tg[C_FPY] = K.reloadY;
        tau[C_FPIN] = F.spring.arm * 1.6;
      }
      break;
    }
    default:
      break;
  }
}

function loadOverlay(a: FigureAnim, K: FigureKindDef, t: number, carrying: boolean): void {
  const tg = a.tg;
  const L = F.load;
  const lift = CONFIG.sapperLoadTime - L.liftTime;
  if (carrying || t >= lift) {
    setStance(a, K.idle.stance);
    setUpper(a, FIGURE_CRATE.carry);
    a.tau[C_HIPY] = a.tau[C_SPINE] = F.spring.body * 2.2;
    a.tau[C_RELX] = a.tau[C_RELY] = F.spring.body * 2.2;
    return;
  }
  setStance(a, FIGURE_STANCES.load);
  setUpper(a, FIGURE_CRATE.ground);
  const heave = Math.max(0, Math.sin((t / L.heavePeriod) * TAU - HALF_PI)) * ramp(t, 0.35, 0.6);
  tg[C_HIPY] -= L.heaveLift * heave;
  tg[C_SPINE] -= L.heaveSpine * heave;
  tg[C_GNDY] -= L.heaveLift * 0.6 * heave;
}

// ---------------------------------------------------------------------------
// Gait
// ---------------------------------------------------------------------------

/** Hermite basis for the swing foot: from back to front with matching foot speed at both ends. */
function swingX(s: number, xb: number, xf: number, m: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * xb + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * xf + (s3 - s2) * m;
}

/** Re-plant the feet from the nominal cycle (start of a walk from standing). */
function resyncGait(a: FigureAnim): void {
  const duty = GS.duty;
  for (let f = 0; f < 2; f++) {
    const u = frac(a.phase + f * 0.5);
    a.err[f] = 0;
    a.errS0[f] = 0;
    if (u < duty) {
      a.planted[f] = 1;
      a.plantW[f] = a.dist + GS.center + GS.stride * (duty * 0.5 - u);
    } else {
      a.planted[f] = 0;
    }
  }
}

function advanceGait(a: FigureAnim, inp: FigureInput, K: FigureKindDef): void {
  const prof = a.kind === 'sapper' && inp.carrying ? FIGURE_GAIT_CARRY : K.gait;
  blendStyle(prof.slow, prof.fast, clamp01(a.sv[C_STYLE]));
  const back = clamp01(a.sv[C_BACK]);
  if (back > 0) {
    GS.stride *= lerp(1, F.gait.backStride, back);
    GS.lift *= lerp(1, F.gait.backLift, back);
    GS.lean = lerp(GS.lean, F.gait.backLean, back);
    GS.chest = lerp(GS.chest, 0, back);
    GS.center = lerp(GS.center, -GS.center * 0.5, back);
  }
  const stride = GS.stride;
  const duty = GS.duty;
  const moved = inp.moved;
  a.phase += moved / stride;
  if (a.phase > 4096 || a.phase < -4096) a.phase = frac(a.phase);
  a.dist += moved;
  // Starting from a stand, or a jump much longer than a step (a teleport): plant the feet afresh.
  if ((a.sv[C_GAIT] < 0.02 && a.tg[C_GAIT] > 0.5) || Math.abs(moved) > stride * F.gait.teleport) resyncGait(a);

  const half = stride * duty * 0.5;
  const xb = GS.center - half;
  const xf = GS.center + half;
  const m = -stride * (1 - duty) * F.gait.reachTangent;
  const h = F.ankle;
  const L = F.footLength;
  const He = F.heel;
  const peak = 0.5 - 0.3 * GS.liftSkew;
  const warp = Math.log(0.5) / Math.log(peak);
  for (let f = 0; f < 2; f++) {
    const u = frac(a.phase + f * 0.5);
    let x: number;
    let pitch: number;
    let lift = 0;
    let pivot: number;
    if (u < duty) {
      if (!a.planted[f]) {
        a.planted[f] = 1;
        a.plantW[f] = a.footWorld[f];
      }
      x = a.plantW[f] - a.dist;
      a.err[f] = x - (GS.center + stride * (duty * 0.5 - u));
      const q = u / duty;
      const strike = 1 - smooth01(q / F.gait.strikeSpan);
      const rise = smooth01((q - F.gait.heelRiseStart) / (1 - F.gait.heelRiseStart));
      pitch = -GS.strike * strike + GS.toeOff * rise;
      pivot = pitch < 0 ? 1 : 0;
      a.footLoad[f] = 1;
    } else {
      const s = (u - duty) / (1 - duty);
      if (a.planted[f]) {
        a.planted[f] = 0;
        a.errS0[f] = s;
      }
      const decay = 1 - smooth01(Math.abs(s - a.errS0[f]));
      x = swingX(s, xb, xf, m) + a.err[f] * decay;
      const sw = Math.pow(s, warp);
      lift = GS.lift * Math.sin(Math.PI * sw);
      pitch = lerp(GS.toeOff, -GS.strike, smooth01((s - 0.25) / 0.75)) + GS.kick * Math.sin(Math.PI * clamp01(s / 0.7));
      pivot = smooth01(s);
      a.footLoad[f] = 1 - smooth01(Math.min(s, 1 - s) / F.gait.loadSpan);
    }
    a.footWorld[f] = a.dist + x;
    // Roll the foot about its toe tip (heel rise) or its heel (heel strike).
    const c = Math.cos(pitch);
    const sn = Math.sin(pitch);
    const tipX = x + L + (-L * c + h * sn);
    const tipY = -lift + (-L * sn - h * c);
    const heelX = x - He + (He * c + h * sn);
    const heelY = -lift + (He * sn - h * c);
    a.footX[f] = lerp(tipX, heelX, pivot);
    a.footY[f] = lerp(tipY, heelY, pivot);
    a.footP[f] = pitch;
  }

  const ph2 = TAU * 2 * (a.phase - duty * 0.5 - GS.bobLag);
  a.gHipY = -GS.hipHeight - GS.bob * Math.cos(ph2);
  a.gHipX = GS.hipX + GS.surge * Math.sin(TAU * 2 * (a.phase - duty * 0.5));
  a.gSpine = GS.lean + GS.pitch * Math.cos(ph2);
  a.gChest = GS.chest;
  a.gHead = -GS.headLevel * (a.gSpine + a.gChest);
  const armPh = TAU * (a.phase - F.gait.armLag);
  a.gArm = Math.cos(armPh);
  a.gTwist = GS.twist * a.gArm;
  const wPh = ph2 - TAU * 2 * F.gait.weaponLag;
  a.gWeaponBob = -(GS.bob < 0 ? -1 : 1) * GS.weaponBob * Math.cos(wPh);
  a.gWeaponRock = GS.weaponRock * Math.sin(TAU * (a.phase - F.gait.weaponLag));
}

// ---------------------------------------------------------------------------
// Compose the final pose
// ---------------------------------------------------------------------------
const IK = new Float64Array(2);
let nsx = 0;
let nsy = 0;
let fsx = 0;
let fsy = 0;

function shoulders(p: Float64Array): void {
  const hx = p[P_HIPX] + Math.cos(p[P_SPINE]) * BONES.spineLower;
  const hy = p[P_HIPY] + Math.sin(p[P_SPINE]) * BONES.spineLower;
  const ux = Math.cos(p[P_CHEST]);
  const uy = Math.sin(p[P_CHEST]);
  const drop = F.shoulderDrop - p[P_LIFT];
  const bx = hx + ux * (BONES.spineUpper - drop);
  const by = hy + uy * (BONES.spineUpper - drop);
  const tw = p[P_TWIST];
  nsx = bx + uy * tw;
  nsy = by - ux * tw;
  fsx = bx - uy * tw;
  fsy = by + ux * tw;
}

function compose(a: FigureAnim, inp: FigureInput, K: FigureKindDef, dt: number): void {
  const sv = a.sv;
  const p = a.pose;
  const w = clamp01(sv[C_GAIT]);
  const iw = 1 - w;
  const I = F.idle;
  const seed = a.seed;
  const t = a.time;

  // Idle life: breathing, weight shift, the occasional glance.
  const ex = a.exertion;
  a.breathPhase += (dt / I.breathPeriod) * (1 + (I.exertionRate - 1) * ex);
  if (a.breathPhase > 1e4) a.breathPhase = frac(a.breathPhase);
  const breath = Math.sin(a.breathPhase * TAU) * (1 + (I.exertionDepth - 1) * ex);
  const steady = lerp(1, K.steadiness, clamp01(sv[C_AIM]));
  const shift = Math.sin(TAU * (t / I.shiftPeriod + hash01(seed, 1))) * iw * steady;
  const win = Math.floor(t / I.glancePeriod + hash01(seed, 2));
  const wu = frac(t / I.glancePeriod + hash01(seed, 2));
  let glance = 0;
  if (hash01(seed, win) < I.glanceChance) {
    glance = Math.sin(Math.PI * clamp01((wu - 0.15) / 0.6));
    glance = glance * glance * (hash01(win, seed) < 0.5 ? -1 : 0.6) * iw * (1 - sv[C_AIM]);
  }

  const cheerW = clamp01(sv[C_CHEER]);
  const cheerPh = t * F.cheer.rate + seed;
  const hop = cheerW * F.cheer.hop * Math.abs(Math.sin(cheerPh * 0.5));

  let hipX = lerp(sv[C_HIPX], a.gHipX, w) + I.shiftX * shift;
  let hipY = lerp(sv[C_HIPY], a.gHipY, w) + I.shiftDrop * Math.abs(shift) - hop;
  let spine = lerp(sv[C_SPINE], a.gSpine, w) + I.shiftLean * shift;
  let chest = lerp(sv[C_CHEST], a.gChest, w) + I.breathChest * breath * steady;
  let head = lerp(sv[C_HEAD], a.gHead, w) + sv[C_HEADX] + I.glanceAngle * glance;
  const twist = lerp(sv[C_TWIST], a.gTwist, w) + I.glanceTwist * glance;

  const pitch = clamp(inp.aimPitch, -F.aimPitchLimit, F.aimPitchLimit) * clamp01(sv[C_AIM]);
  head -= pitch * 0.55;
  chest -= pitch * 0.18;

  // Recoil, crew duck, hit flinch.
  const R = K.recoil;
  hipX -= R.hip * a.recoil;
  chest -= R.shoulder * a.recoil;
  spine += R.duck * a.duck;
  hipY += R.duck * a.duck * 6;
  head += R.duck * a.duck;
  const fl = a.flinch;
  spine -= F.flinch.spine * fl;
  head -= F.flinch.head * fl;
  hipX -= F.flinch.hipX * fl;
  hipY += F.flinch.hipY * Math.abs(fl);

  // Feet: posed layer mixed with the gait; a foot that has to travel hops.
  const BL = F.gait;
  let nfx = 0;
  let nfy = 0;
  let nfp = 0;
  let ffx = 0;
  let ffy = 0;
  let ffp = 0;
  for (let f = 0; f < 2; f++) {
    const cx = f === 0 ? C_NFX : C_FFX;
    const px = sv[cx];
    const py = sv[cx + 1];
    const pp = sv[cx + 2];
    const gx = a.footX[f];
    const gy = a.footY[f];
    const hopG = BL.blendLift * clamp01(Math.abs(gx - px) / BL.blendLiftSpan) * 4 * w * iw;
    const hopP = BL.blendLift * clamp01(Math.abs(a.sd[cx]) / BL.hopSpeed) * iw;
    const x = lerp(px, gx, w);
    let y = lerp(py, gy, w) - hopG - hopP - hop;
    const pt = lerp(pp, a.footP[f], w);
    const bottom = footBottom(pt);
    if (y + bottom > 0) y = -bottom;
    if (f === 0) {
      nfx = x;
      nfy = y;
      nfp = pt;
    } else {
      ffx = x;
      ffy = y;
      ffp = pt;
    }
  }

  // Lower the hip so weight-bearing feet stay within reach.
  const reach = LEG * F.reach;
  for (let f = 0; f < 2; f++) {
    const ax = f === 0 ? nfx : ffx;
    const ay = f === 0 ? nfy : ffy;
    const load = lerp(1, a.footLoad[f], w);
    const dx = hipX - ax;
    if (Math.abs(dx) < reach) {
      const lim = ay - Math.sqrt(reach * reach - dx * dx);
      hipY = lerp(hipY, smoothMax(hipY, lim, BL.reachSoftness), load);
    }
  }

  p[P_HIPX] = hipX;
  p[P_HIPY] = hipY;
  p[P_SPINE] = spine - HALF_PI;
  p[P_CHEST] = p[P_SPINE] + chest;
  p[P_NECK] = p[P_CHEST] + head;
  p[P_TWIST] = twist;
  p[P_LIFT] = I.breathLift * breath * steady;
  solveIk(hipX, hipY, nfx, nfy, BONES.thigh, BONES.shin, -1, F.reach, F.minReach, p, P_NTH);
  solveIk(hipX, hipY, ffx, ffy, BONES.thigh, BONES.shin, -1, F.reach, F.minReach, p, P_FTH);
  p[P_NFP] = nfp;
  p[P_FFP] = ffp;

  // Weapon: carried relative to the near shoulder, or set on the ground.
  shoulders(p);
  const g = clamp01(sv[C_GND]);
  const rc = Math.cos(-pitch);
  const rs = Math.sin(-pitch);
  // The carried weapon is offset from the near shoulder in polar form (radius, angle), so it swings round the shoulder, never through it.
  const rx = sv[C_RELX] * Math.cos(sv[C_RELY]);
  const ry = sv[C_RELX] * Math.sin(sv[C_RELY]) + a.gWeaponBob * w;
  const carryX = nsx + rx * rc - ry * rs;
  const carryY = nsy + rx * rs + ry * rc;
  let wx = lerp(carryX, sv[C_GNDX], g);
  let wy = lerp(carryY, sv[C_GNDY], g);
  const sway = I.swayAngle * steady * Math.sin(TAU * (t / I.swayPeriod + hash01(seed, 3))) * clamp01(sv[C_AIM]);
  let wPitch = sv[C_WANG] + pitch + R.climb * a.recoil + sway + a.gWeaponRock * w * (1 - g);
  wPitch += cheerW * F.cheer.weaponWave * Math.sin(cheerPh);
  const wa = -wPitch;
  const wc = Math.cos(wa);
  const ws = Math.sin(wa);
  wx -= wc * R.back * a.recoil;
  wy -= ws * R.back * a.recoil;
  p[P_WX] = wx;
  p[P_WY] = wy;
  p[P_WA] = wa;

  // Arms: free (swinging) arm pose mixed with the hand pinned to the weapon.
  const armSwing = GS.armSwing * a.gArm;
  const cheerWave = cheerW * F.cheer.armWave * Math.sin(cheerPh);
  for (let side = 0; side < 2; side++) {
    const near = side === 0;
    const pin = clamp01(sv[near ? C_NPIN : C_FPIN]);
    const swing = near ? -armSwing : armSwing;
    const fwd = clamp01(swing / Math.max(0.05, GS.armSwing));
    const sh = lerp(sv[near ? C_NSH : C_FSH], swing + GS.lean * 0.4, w) + (near ? cheerWave : -cheerWave) - F.flinch.arm * fl;
    const el = Math.max(0.02, lerp(sv[near ? C_NEL : C_FEL], GS.elbow + GS.elbowSwing * fwd, w));
    const sx = near ? nsx : fsx;
    const sy = near ? nsy : fsy;
    const a1 = HALF_PI - sh;
    const a2 = a1 - el;
    const qx = sv[near ? C_NPX : C_FPX];
    const qy = sv[near ? C_NPY : C_FPY];
    const pinX = wx + qx * wc - qy * ws;
    const pinY = wy + qx * ws + qy * wc;
    // Blend free and pinned arms by angle, so the hand never cuts through the shoulder.
    solveIk(sx, sy, pinX, pinY, BONES.upperArm, BONES.forearm, 1, F.reach, F.minReach, IK, 0);
    // Each candidate is unwrapped against its own value last frame, so the blend between them never flips.
    const k = near ? P_NUA : P_FUA;
    const u = near ? 0 : 2;
    const fr = a.armFree;
    const ik = a.armIk;
    fr[u] = nearestTurn(a1, fr[u]);
    fr[u + 1] = nearestTurn(a2, fr[u + 1]);
    // The pinned solution may swing fast when its target passes close to the shoulder: rate-limit it.
    const dmax = a.fresh ? 1e9 : F.armRate * dt;
    ik[u] += clamp(nearestTurn(IK[0], ik[u]) - ik[u], -dmax, dmax);
    ik[u + 1] += clamp(nearestTurn(IK[1], ik[u + 1]) - ik[u + 1], -dmax, dmax);
    // While one candidate is (almost) unused, keep it on the other's turn so a later blend takes the short way.
    if (pin < 1e-3) {
      ik[u] = nearestTurn(ik[u], fr[u]);
      ik[u + 1] = nearestTurn(ik[u + 1], fr[u + 1]);
    } else if (pin > 1 - 1e-3) {
      fr[u] = nearestTurn(fr[u], ik[u]);
      fr[u + 1] = nearestTurn(fr[u + 1], ik[u + 1]);
    }
    p[k] = lerp(fr[u], ik[u], pin);
    p[k + 1] = lerp(fr[u + 1], ik[u + 1], pin);
  }

  // Bipod legs: folded along the barrel or planted on the ground (the trench lip in a trench).
  const geom = a.geom;
  if (geom.bipodLen > 0) {
    const hy = wy + geom.bipodX * ws + geom.bipodY * wc;
    const groundY = inp.inTrench ? -VIEW.trenchDepth : 0;
    const height = groundY - hy;
    const down = height >= geom.bipodLen ? HALF_PI : Math.asin(clamp(height / geom.bipodLen, -1, 1));
    p[P_BIPOD] = lerpAngle(wa + geom.bipodFold, down, clamp01(sv[C_BIPOD]));
  } else {
    p[P_BIPOD] = wa;
  }

  // Medic satchel swings on its strap.
  const satchelTarget = F.satchel.trail * inp.speed + F.satchel.bounce * w * Math.cos(TAU * 2 * a.phase);
  springSatchel(a, satchelTarget, dt);
  p[P_SATCHEL] = HALF_PI + a.satchel;
  a.fresh = false;
}

/** The angle equal to v (mod 2 PI) that is nearest to ref. */
function nearestTurn(v: number, ref: number): number {
  return v + TAU * Math.round((ref - v) / TAU);
}

function springSatchel(a: FigureAnim, target: number, dt: number): void {
  const w = 1 / F.satchel.tau;
  const x = a.satchel - target;
  const k = a.satchelV + w * x;
  const e = Math.exp(-w * dt);
  a.satchel = target + (x + k * dt) * e;
  a.satchelV = (a.satchelV - w * k * dt) * e;
}

// ---------------------------------------------------------------------------
// Public update
// ---------------------------------------------------------------------------

/**
 * Advance one unit's animation by dt seconds and write its pose. Allocation free.
 * Root motion belongs to the sim: the pose is relative to the unit position.
 */
export function updateFigure(a: FigureAnim, inp: FigureInput, dtIn: number): void {
  if (!isFigureKind(inp.kind)) return;
  const dt = clamp(dtIn, 0, F.maxDt);
  if (inp.kind !== a.kind) {
    a.kind = inp.kind;
    a.started = false;
  }
  const K = FIGURE_KINDS[a.kind];
  a.time += dt;
  if (inp.action !== a.action) {
    a.action = inp.action;
    a.actionTime = 0;
    a.throwSh = a.sv[C_NSH] + TAU * Math.round((TH.shStart - a.sv[C_NSH]) / TAU);
    a.throwEl = a.sv[C_NEL];
  } else {
    a.actionTime += dt;
  }

  if (inp.death) {
    updateDeath(a, inp.death);
    finishOutputs(a);
    return;
  }
  if (a.dead) {
    a.dead = false;
    a.deathStill = false;
    a.started = false;
  }

  // One-shot triggers and their dynamics.
  a.sinceFire += dt;
  if (inp.fired) {
    a.recoilTarget = Math.min(K.recoil.max, a.recoilTarget + K.recoil.add);
    a.duckTarget = 1;
    a.sinceFire = 0;
  }
  if (inp.hit) a.flinchV += F.flinch.kick;
  a.recoilTarget *= Math.exp(-dt / K.recoil.decay);
  a.duckTarget *= Math.exp(-dt / K.recoil.duckDecay);
  stepScalarSpring(a, 0, a.recoilTarget, F.recoilAttack, dt);
  stepScalarSpring(a, 1, a.duckTarget, F.recoilAttack * 4, dt);
  stepFlinch(a, dt);

  const speed = inp.speed;
  const moving = Math.abs(speed) > F.gait.minSpeed;
  a.exertion = clamp01(a.exertion + (moving ? dt / F.gait.exertionRise : -dt / F.gait.exertionFall));
  a.settle = Math.max(a.stanceSettle, a.settle - dt * 1.5);

  chooseTargets(a, inp, K, moving);
  const tg = a.tg;
  const prof = a.kind === 'sapper' && inp.carrying ? FIGURE_GAIT_CARRY : K.gait;
  tg[C_STYLE] = ramp(Math.abs(speed), prof.walkSpeed, prof.runSpeed);
  tg[C_BACK] = speed < -F.gait.minSpeed ? 1 : speed > F.gait.minSpeed ? 0 : tg[C_BACK];

  const sv = a.sv;
  const sd = a.sd;
  if (!a.started) {
    for (let c = 0; c < N_CHANNELS; c++) {
      sv[c] = tg[c];
      sd[c] = 0;
    }
    a.started = true;
  } else {
    // Free arms take the short way round after a throw.
    sv[C_NSH] += TAU * Math.round((tg[C_NSH] - sv[C_NSH]) / TAU);
    sv[C_FSH] += TAU * Math.round((tg[C_FSH] - sv[C_FSH]) / TAU);
    for (let c = 0; c < N_CHANNELS; c++) springStep(sv, sd, c, tg[c], a.tau[c], dt);
  }

  advanceGait(a, inp, K);
  compose(a, inp, K, dt);
  poseToJoints(a.pose, a.joints, a.geom);
  finishOutputs(a);
}

/** Exact step of the under-damped hit-flinch oscillator (stable for any dt). */
function stepFlinch(a: FigureAnim, dt: number): void {
  const om = F.flinch.frequency;
  const k = F.flinch.damping * om;
  const wd = om * Math.sqrt(1 - F.flinch.damping * F.flinch.damping);
  const x0 = a.flinch;
  const v0 = a.flinchV;
  const e = Math.exp(-k * dt);
  const c = Math.cos(wd * dt);
  const s = Math.sin(wd * dt);
  a.flinch = e * (x0 * c + ((v0 + k * x0) / wd) * s);
  a.flinchV = e * (v0 * c - ((k * v0 + om * om * x0) / wd) * s);
}

function stepScalarSpring(a: FigureAnim, which: 0 | 1, target: number, tau: number, dt: number): void {
  const w = 1 / tau;
  const x = (which === 0 ? a.recoil : a.duck) - target;
  const v = which === 0 ? a.recoilV : a.duckV;
  const k = v + w * x;
  const e = Math.exp(-w * dt);
  const nx = target + (x + k * dt) * e;
  const nv = (v - w * k * dt) * e;
  if (which === 0) {
    a.recoil = nx;
    a.recoilV = nv;
  } else {
    a.duck = nx;
    a.duckV = nv;
  }
}

function finishOutputs(a: FigureAnim): void {
  const j = a.joints;
  const p = a.pose;
  a.muzzleX = j[J_MUZZLE * 2];
  a.muzzleY = j[J_MUZZLE * 2 + 1];
  a.muzzleDX = Math.cos(p[P_WA]);
  a.muzzleDY = Math.sin(p[P_WA]);
  a.crateX = p[P_WX];
  a.crateY = p[P_WY];
  a.crateRot = p[P_WA];
  a.handX = j[J_NHAND * 2];
  a.handY = j[J_NHAND * 2 + 1];
  a.plate = clamp01(a.sv[C_PLATE]);
}
