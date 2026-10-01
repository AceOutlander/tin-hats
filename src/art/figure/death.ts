/**
 * Death falls. Every death pose is a pure function of the time since death
 * (keyframed tracks, or an analytic ballistic toss for explosions), offset by
 * the live pose at the moment of death so the fall starts exactly where the
 * soldier was and the difference fades out quickly. The body comes to rest and
 * then never moves again (anim.deathStill), so the renderer can fade it out.
 */
import { DEATH_REST, DEATH_TRACKS, FIGURE, FIGURE_CRATE } from '../../data/figure';
import { HALF_PI, clamp01, hash01, lerp, noise1, sampleTrack, smooth01, smoother01, wrapPi } from './math';
import {
  J_CHEST,
  J_FANKLE,
  J_FELBOW,
  J_FHAND,
  J_FKNEE,
  J_HEAD,
  J_HIP,
  J_NANKLE,
  J_NECK,
  J_NELBOW,
  J_NHAND,
  J_NKNEE,
  J_NSHOULDER,
  J_FSHOULDER,
  N_JOINTS,
  C_GND,
  N_POSE,
  POSE_IS_ANGLE,
  P_BIPOD,
  P_CHEST,
  P_FFA,
  P_FFP,
  P_FSH,
  P_FTH,
  P_FUA,
  P_HIPX,
  P_HIPY,
  P_LIFT,
  P_NECK,
  P_NFA,
  P_NFP,
  P_NSH,
  P_NTH,
  P_NUA,
  P_SATCHEL,
  P_SPINE,
  P_TWIST,
  P_WA,
  P_WX,
  P_WY,
  footBottom,
  poseToJoints,
  type FigureAnim,
  type FigureDeath,
} from './pose';

const D = FIGURE.death;
const G = FIGURE.ground;

/** Relative limb pose (angles relative to the lower spine) used by every fall. */
interface RelPose {
  chest: number;
  head: number;
  nearSh: number;
  nearEl: number;
  farSh: number;
  farEl: number;
  nearThigh: number;
  nearKnee: number;
  farThigh: number;
  farKnee: number;
}

const REL: RelPose = { chest: 0, head: 0, nearSh: 0, nearEl: 0, farSh: 0, farEl: 0, nearThigh: 0, nearKnee: 0, farThigh: 0, farKnee: 0 };
const REL_KEYS: readonly (keyof RelPose)[] = ['chest', 'head', 'nearSh', 'nearEl', 'farSh', 'farEl', 'nearThigh', 'nearKnee', 'farThigh', 'farKnee'];

/** Write the absolute pose from a lean (radians from upright, + forward) and REL. */
function applyRel(p: Float64Array, lean: number): void {
  const spine = lean - HALF_PI;
  p[P_SPINE] = spine;
  p[P_CHEST] = spine + REL.chest;
  p[P_NECK] = p[P_CHEST] + REL.head;
  const base = HALF_PI + lean;
  p[P_NUA] = base - REL.nearSh;
  p[P_NFA] = p[P_NUA] - REL.nearEl;
  p[P_FUA] = base - REL.farSh;
  p[P_FFA] = p[P_FUA] - REL.farEl;
  p[P_NTH] = base - REL.nearThigh;
  p[P_NSH] = p[P_NTH] + REL.nearKnee;
  p[P_FTH] = base - REL.farThigh;
  p[P_FSH] = p[P_FTH] + REL.farKnee;
  p[P_NFP] = p[P_NSH] - HALF_PI + D.footFlex;
  p[P_FFP] = p[P_FSH] - HALF_PI + D.footFlex;
  p[P_TWIST] = 0.3;
  p[P_LIFT] = 0;
  p[P_SATCHEL] = p[P_NTH] + 0.25;
}

/** Ballistic toss parameters for the blast death, derived from the live pose at death. */
interface Toss {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  t1: number;
  vb: number;
  tb: number;
}
const TOSS: Toss = { x0: 0, y0: 0, vx: 0, vy: 0, t1: 0, vb: 0, tb: 0 };

function computeToss(a: FigureAnim): void {
  const r1 = hash01(a.seed, 31);
  const r2 = hash01(a.seed, 32);
  TOSS.x0 = a.deathFrom[P_HIPX];
  TOSS.y0 = a.deathFrom[P_HIPY];
  TOSS.vx = a.deathDir * D.blastVx * (0.8 + 0.4 * r1);
  TOSS.vy = D.blastVy * (0.85 + 0.3 * r2);
  const drop = Math.max(0, D.lieHip - TOSS.y0);
  TOSS.t1 = (TOSS.vy + Math.sqrt(TOSS.vy * TOSS.vy + 2 * D.gravity * drop)) / D.gravity;
  const impact = -TOSS.vy + D.gravity * TOSS.t1;
  TOSS.vb = D.bounce * impact;
  TOSS.tb = (2 * TOSS.vb) / D.gravity;
}

/** The death pose (before the start offset and the ground clamp) at time t. */
function deathPose(a: FigureAnim, t: number, p: Float64Array): void {
  if (a.deathVariant === 'blast') {
    computeToss(a);
    const T = TOSS;
    const back = a.deathDir < 0;
    const rest = back ? DEATH_REST.onBack : DEATH_REST.faceDown;
    const sEnd = back ? -1.56 : 1.5;
    const s0 = a.deathFrom[P_SPINE] + HALF_PI;
    let x: number;
    let y: number;
    let lean: number;
    if (t < T.t1) {
      x = T.x0 + T.vx * t;
      y = T.y0 - T.vy * t + 0.5 * D.gravity * t * t;
      lean = lerp(s0, sEnd, smooth01(t / T.t1));
    } else if (t < T.t1 + T.tb) {
      const u = t - T.t1;
      x = T.x0 + T.vx * T.t1 + T.vx * D.bounceVx * u;
      y = D.lieHip - T.vb * u + 0.5 * D.gravity * u * u;
      lean = sEnd - (back ? -1 : 1) * 0.25 * Math.sin((Math.PI * u) / T.tb);
    } else {
      const u = t - T.t1 - T.tb;
      x = T.x0 + T.vx * T.t1 + T.vx * D.bounceVx * T.tb + a.deathDir * D.slideDist * (1 - Math.exp(-u / D.slide));
      y = D.lieHip;
      lean = sEnd;
    }
    const landed = smooth01((t - T.t1) / (T.tb + D.settle));
    const flail = D.flail * (1 - landed) * smooth01(t / 0.2);
    for (let i = 0; i < REL_KEYS.length; i++) {
      const k = REL_KEYS[i];
      REL[k] = lerp(DEATH_REST.air[k], rest[k], landed) + flail * noise1(a.seed * 31 + i, t * D.flailRate) * (i < 2 ? 0.3 : 1);
    }
    if (REL.nearEl < 0) REL.nearEl = 0;
    if (REL.farEl < 0) REL.farEl = 0;
    if (REL.nearKnee < 0) REL.nearKnee = 0;
    if (REL.farKnee < 0) REL.farKnee = 0;
    p[P_HIPX] = x;
    p[P_HIPY] = y;
    applyRel(p, lean);
    return;
  }
  const tr = DEATH_TRACKS[a.deathVariant];
  p[P_HIPX] = sampleTrack(tr.hipX, t);
  p[P_HIPY] = sampleTrack(tr.hipY, t);
  REL.chest = sampleTrack(tr.chest, t);
  REL.head = sampleTrack(tr.head, t);
  REL.nearSh = sampleTrack(tr.nearSh, t);
  REL.nearEl = sampleTrack(tr.nearEl, t);
  REL.farSh = sampleTrack(tr.farSh, t);
  REL.farEl = sampleTrack(tr.farEl, t);
  REL.nearThigh = sampleTrack(tr.nearThigh, t);
  REL.nearKnee = sampleTrack(tr.nearKnee, t);
  REL.farThigh = sampleTrack(tr.farThigh, t);
  REL.farKnee = sampleTrack(tr.farKnee, t);
  applyRel(p, sampleTrack(tr.spine, t));
}

/** First track time at which the hip is as low as the live hip (a kneeling or prone soldier skips the start of the fall). */
function findSkip(a: FigureAnim, hipY: number): number {
  if (a.deathVariant === 'blast' || hipY < D.skipAbove) return 0;
  const tr = DEATH_TRACKS[a.deathVariant];
  const end = tr.still;
  for (let t = 0; t < end; t += 0.01) {
    if (sampleTrack(tr.hipY, t) >= hipY) return t * D.skipShare;
  }
  return end;
}

function startDeath(a: FigureAnim, d: FigureDeath): void {
  a.dead = true;
  a.deathAsked = d.variant;
  a.deathVariant = d.variant;
  // A prone or doubled-over soldier cannot be thrown onto his back: he slumps face down (and the reverse).
  const lean = a.pose[P_SPINE] + HALF_PI;
  if (d.variant !== 'blast' && lean > D.faceDownLean) a.deathVariant = 'crumple';
  else if (d.variant !== 'blast' && lean < -D.faceDownLean) a.deathVariant = 'thrown';
  // Already lying down (prone gunner): mostly keep the pose and just go limp.
  a.deathKeep = d.variant !== 'blast' && lean > D.proneLean ? D.proneKeep : 0;
  a.deathDir = d.dir !== undefined && d.dir > 0 ? 1 : -1;
  a.deathRate = 1 + D.timeSpread * (hash01(a.seed, 21) * 2 - 1);
  a.deathFrom.set(a.pose);
  a.deathGround = a.sv[C_GND] > 0.5;
  a.item = 'none';
  if (a.deathVariant === 'blast') {
    computeToss(a);
    a.deathEnd = TOSS.t1 + TOSS.tb + D.settle + 0.25;
  } else {
    a.deathEnd = DEATH_TRACKS[a.deathVariant].still;
  }
  // A body that keeps most of its pose starts from the end of the fall, so the kept offset is relative to the resting pose.
  a.deathSkip = a.deathKeep > 0 ? a.deathEnd : findSkip(a, a.pose[P_HIPY]);
  if (a.deathSkip > 0 && a.deathKeep === 0) a.deathRate *= D.skipRate;
  deathPose(a, a.deathSkip, a.deathOff);
  for (let i = 0; i < N_POSE; i++) {
    const diff = a.deathFrom[i] - a.deathOff[i];
    a.deathOff[i] = POSE_IS_ANGLE[i] ? wrapPi(diff) : diff;
  }
  // A big difference between the live pose and the fall blends out more slowly.
  a.deathFade = D.fade * (1 + Math.min(1.5, Math.abs(a.deathOff[P_SPINE]))) * (a.deathVariant === 'blast' ? 1.5 : 1);
  planRest(a);
}

const REST = new Float64Array(N_POSE);
const REST_J = new Float64Array(N_JOINTS * 2);
/** Limb root, middle and end joints, first pose index, and the ground clearance of the middle and the end. */
const REST_LIMBS: readonly (readonly [number, number, number, number, number, number])[] = [
  [J_NSHOULDER, J_NELBOW, J_NHAND, P_NUA, G.elbow, G.hand],
  [J_FSHOULDER, J_FELBOW, J_FHAND, P_FUA, G.elbow, G.hand],
  [J_HIP, J_NKNEE, J_NANKLE, P_NTH, G.knee, G.ankle + 0.6],
  [J_HIP, J_FKNEE, J_FANKLE, P_FTH, G.knee, G.ankle + 0.6],
];

/** Rigid swing about (rx, ry) that lifts the point (px, py) to the height -clear, keeping it on its side of the root. */
function swingToClear(rx: number, ry: number, px: number, py: number, clear: number, side: number): number {
  const dx = px - rx;
  const dy = py - ry;
  const pen = py + clear;
  const r = Math.hypot(dx, dy);
  if (pen <= 0 || r < 1e-6) return 0;
  const s = Math.max(-1, Math.min(1, (dy - pen) / r));
  const target = side >= 0 ? Math.asin(s) : Math.PI - Math.asin(s);
  return wrapPi(target - Math.atan2(dy, dx));
}

/**
 * Work out, once, how far each limb of the final lying pose must swing about
 * its root so it rests on the ground instead of in it. The swing is eased in
 * near the end of the fall.
 */
function planRest(a: FigureAnim): void {
  deathPose(a, a.deathEnd, REST);
  for (let i = 0; i < N_POSE; i++) REST[i] += a.deathOff[i] * a.deathKeep;
  a.restFix.fill(0);
  for (let pass = 0; pass < 3; pass++) {
    poseToJoints(REST, REST_J, a.geom);
    for (let l = 0; l < REST_LIMBS.length; l++) {
      const [root, mid, end, i, cMid, cEnd] = REST_LIMBS[l];
      const rx = REST_J[root * 2];
      const ry = REST_J[root * 2 + 1];
      const side = REST_J[end * 2] - rx;
      const dEnd = swingToClear(rx, ry, REST_J[end * 2], REST_J[end * 2 + 1], cEnd, side);
      const dMid = swingToClear(rx, ry, REST_J[mid * 2], REST_J[mid * 2 + 1], cMid, side);
      const d = Math.abs(dEnd) > Math.abs(dMid) ? dEnd : dMid;
      REST[i] += d;
      REST[i + 1] += d;
      a.restFix[l] += d;
    }
  }
}
/** Weapon (or crate) falls from the hands, lands flat and stays. */
function dropWeapon(a: FigureAnim, time: number, p: Float64Array): void {
  const f = a.deathFrom;
  if (a.deathGround && a.geom.baseplate) {
    p[P_WX] = f[P_WX];
    p[P_WY] = f[P_WY];
    p[P_WA] = f[P_WA];
    p[P_BIPOD] = f[P_BIPOD];
    return;
  }
  const crate = a.model === 'crate';
  const rest = -(crate ? FIGURE_CRATE.halfH : a.geom.restY);
  const y0 = f[P_WY];
  const fallT = rest > y0 ? Math.sqrt((2 * (rest - y0)) / D.gravity) : 0.05;
  const u = time - D.weaponFallDelay;
  const k = u <= 0 ? 0 : clamp01(u / fallT);
  const y = u <= 0 ? y0 : Math.min(rest, y0 + 0.5 * D.gravity * u * u);
  const a0 = f[P_WA];
  const flat = crate ? D.crateTilt * a.deathDir : Math.abs(wrapPi(a0)) < HALF_PI ? 0 : Math.PI;
  p[P_WX] = f[P_WX] + a.deathDir * D.weaponDrift * smooth01(k);
  p[P_WY] = Math.min(y, rest);
  p[P_WA] = a0 + wrapPi(flat - a0) * smoother01(k);
  p[P_BIPOD] = p[P_WA] + (f[P_BIPOD] - a0);
}

const LIFT_JOINTS = [J_HIP, J_CHEST, J_NECK, J_HEAD, J_NKNEE, J_FKNEE, J_NELBOW, J_FELBOW, J_NHAND, J_FHAND, J_NANKLE, J_FANKLE];
const LIFT_CLEAR = [G.hip, G.chest, G.neck, G.head, G.knee, G.knee, G.elbow, G.elbow, G.hand, G.hand, G.ankle, G.ankle];

/** Keep the body on top of the ground: lift the whole body by the deepest joint (continuous, keeps bone lengths). */
function groundClamp(a: FigureAnim): void {
  const p = a.pose;
  const j = a.joints;
  poseToJoints(p, j, a.geom);
  let lift = 0;
  for (let i = 0; i < LIFT_JOINTS.length; i++) {
    const pen = j[LIFT_JOINTS[i] * 2 + 1] + LIFT_CLEAR[i];
    if (pen > lift) lift = pen;
  }
  const toeN = j[J_NANKLE * 2 + 1] + footBottom(p[P_NFP]);
  const toeF = j[J_FANKLE * 2 + 1] + footBottom(p[P_FFP]);
  if (toeN > lift) lift = toeN;
  if (toeF > lift) lift = toeF;
  if (lift > 0) {
    p[P_HIPY] -= lift;
    poseToJoints(p, j, a.geom);
  }
}

/** Advance the death fall (allocation free). */
export function updateDeath(a: FigureAnim, d: FigureDeath): void {
  if (!a.dead || a.deathAsked !== d.variant) startDeath(a, d);
  const time = Math.max(0, d.time);
  const t = a.deathSkip + time * a.deathRate;
  const p = a.pose;
  deathPose(a, Math.min(t, a.deathEnd), p);
  const fade = a.deathKeep + (1 - a.deathKeep) * (1 - smoother01(time / a.deathFade));
  for (let i = 0; i < N_POSE; i++) p[i] += a.deathOff[i] * fade;
  const settle = smooth01(time / a.deathFade) * smooth01((t - (a.deathEnd - D.restBlend)) / D.restBlend);
  for (let l = 0; l < REST_LIMBS.length; l++) {
    const i = REST_LIMBS[l][3];
    p[i] += a.restFix[l] * settle;
    p[i + 1] += a.restFix[l] * settle;
  }
  dropWeapon(a, time, p);
  groundClamp(a);
  a.deathStill = t >= a.deathEnd && time >= a.deathFade;
  a.item = 'none';
}
