/**
 * layoutFigure(): turns an animated pose into part transforms (sprite key,
 * position, rotation, scale) in figure-local wu, back to front, so a renderer
 * only copies numbers onto pooled images. The part list has a fixed length and
 * order; parts that are not shown this frame have visible = false.
 *
 * Facing left: mirror every part (x -> -x, rotation -> -rotation, scaleX -> -scaleX),
 * or simply flip the container that holds the parts.
 */
import { figureGearKeys } from './gear';
import { HALF_PI } from './math';
import { BODY_KEYS, FACTION_FIGURE_KEYS, RIM_KEYS } from './parts';
import {
  J_CHEST,
  J_FANKLE,
  J_FELBOW,
  J_FHAND,
  J_FKNEE,
  J_FSHOULDER,
  J_GRIP,
  J_HEAD,
  J_HIP,
  J_NANKLE,
  J_NECK,
  J_NELBOW,
  J_NHAND,
  J_NKNEE,
  J_NSHOULDER,
  P_BIPOD,
  P_CHEST,
  P_FFA,
  P_FFP,
  P_FSH,
  P_FTH,
  P_FUA,
  P_NECK,
  P_NFA,
  P_NFP,
  P_NSH,
  P_NTH,
  P_NUA,
  P_SATCHEL,
  P_SPINE,
  P_WA,
  type FigureAnim,
} from './pose';

/** One positioned sprite. Units are wu in figure space (origin on the ground between the feet, +x = facing). */
export interface FigurePart {
  key: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
}

// Slots, back to front. The rim pass is a light silhouette outline behind the whole figure.
const S_RIM_FAR_UA = 0;
const S_RIM_FAR_FA = 1;
const S_RIM_FAR_TH = 2;
const S_RIM_FAR_SH = 3;
const S_RIM_FAR_BOOT = 4;
const S_RIM_TORSO_LO = 5;
const S_RIM_TORSO_UP = 6;
const S_RIM_HEAD = 7;
const S_RIM_NEAR_TH = 8;
const S_RIM_NEAR_SH = 9;
const S_RIM_NEAR_BOOT = 10;
const S_RIM_HELMET = 11;
const S_RIM_NEAR_UA = 12;
const S_RIM_NEAR_FA = 13;
const S_FAR_UA = 14;
const S_FAR_FA = 15;
const S_FAR_ITEM = 16;
const S_FAR_TH = 17;
const S_FAR_SH = 18;
const S_FAR_BOOT = 19;
const S_PACK = 20;
const S_TORSO_LO = 21;
const S_TORSO_UP = 22;
const S_POUCHES = 23;
/** Upgrade gear: a strap across the chest (bandolier, medic's aid strap). Hidden unless worn. */
const S_BANDOLIER = 24;
const S_NEAR_TH = 25;
const S_NEAR_SH = 26;
const S_NEAR_BOOT = 27;
const S_SATCHEL = 28;
const S_HEAD = 29;
const S_HELMET = 30;
const S_PLATE = 31;
const S_BIPOD = 32;
const S_WEAPON = 33;
const S_NEAR_ITEM = 34;
const S_NEAR_UA = 35;
const S_ARMBAND = 36;
const S_NEAR_FA = 37;

/** Number of parts every layout has. */
export const FIGURE_PART_COUNT = 38;
/** Parts 0 .. FIGURE_RIM_PARTS - 1 are the light rim behind the body (a renderer fades them faster than the body). */
export const FIGURE_RIM_PARTS = S_RIM_NEAR_FA + 1;

/** Allocate a part list once per unit (or per pooled view). */
export function createFigureLayout(): FigurePart[] {
  const out: FigurePart[] = [];
  for (let i = 0; i < FIGURE_PART_COUNT; i++) out.push({ key: '', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, visible: false });
  return out;
}

function put(o: FigurePart, key: string | null, x: number, y: number, rotation: number, visible = true): void {
  o.key = key ?? '';
  o.x = x;
  o.y = y;
  o.rotation = rotation;
  o.scaleX = 1;
  o.scaleY = 1;
  o.visible = visible && key !== null;
}

function putJ(o: FigurePart, key: string | null, j: Float64Array, joint: number, rotation: number, visible = true): void {
  put(o, key, j[joint * 2], j[joint * 2 + 1], rotation, visible);
}

/** Fill `out` (from createFigureLayout) with this frame's parts. Allocation free. */
export function layoutFigure(a: FigureAnim, out: FigurePart[]): void {
  const j = a.joints;
  const p = a.pose;
  const keys = FACTION_FIGURE_KEYS[a.faction];
  // Gear keys (the level-0 set unless setFigureGear was called for this nation and kind).
  const ag = a.gear;
  const G = ag && ag.kind === a.kind && ag.faction === a.faction ? ag : figureGearKeys(a.faction, a.kind, 0, 0);
  const B = BODY_KEYS;
  const R = RIM_KEYS;

  // Rim pass.
  putJ(out[S_RIM_FAR_UA], R.upperArm, j, J_FSHOULDER, p[P_FUA]);
  putJ(out[S_RIM_FAR_FA], R.forearm, j, J_FELBOW, p[P_FFA]);
  putJ(out[S_RIM_FAR_TH], R.thigh, j, J_HIP, p[P_FTH]);
  putJ(out[S_RIM_FAR_SH], R.shin, j, J_FKNEE, p[P_FSH]);
  putJ(out[S_RIM_FAR_BOOT], R.boot, j, J_FANKLE, p[P_FFP]);
  putJ(out[S_RIM_TORSO_LO], R.torsoLower, j, J_HIP, p[P_SPINE]);
  putJ(out[S_RIM_TORSO_UP], R.torsoUpper, j, J_CHEST, p[P_CHEST]);
  putJ(out[S_RIM_HEAD], R.head, j, J_NECK, p[P_NECK]);
  putJ(out[S_RIM_NEAR_TH], R.thigh, j, J_HIP, p[P_NTH]);
  putJ(out[S_RIM_NEAR_SH], R.shin, j, J_NKNEE, p[P_NSH]);
  putJ(out[S_RIM_NEAR_BOOT], R.boot, j, J_NANKLE, p[P_NFP]);
  // The helmet wobbles on the head a moment behind the body (secondary motion).
  const helmRot = p[P_NECK] + HALF_PI + a.helm;
  putJ(out[S_RIM_HELMET], G.helmetRim, j, J_HEAD, helmRot);
  putJ(out[S_RIM_NEAR_UA], R.upperArm, j, J_NSHOULDER, p[P_NUA]);
  putJ(out[S_RIM_NEAR_FA], R.forearm, j, J_NELBOW, p[P_NFA]);

  // Far side.
  putJ(out[S_FAR_UA], B.upperArmFar, j, J_FSHOULDER, p[P_FUA]);
  putJ(out[S_FAR_FA], B.forearmFar, j, J_FELBOW, p[P_FFA]);
  putJ(out[S_FAR_ITEM], keys.item[a.item], j, J_FHAND, p[P_FFA], a.itemFar);
  putJ(out[S_FAR_TH], B.thighFar, j, J_HIP, p[P_FTH]);
  putJ(out[S_FAR_SH], B.shinFar, j, J_FKNEE, p[P_FSH]);
  putJ(out[S_FAR_BOOT], B.bootFar, j, J_FANKLE, p[P_FFP]);

  // Body and kit.
  // The pack bounces along the back (secondary motion).
  const ch = p[P_CHEST];
  put(out[S_PACK], G.pack, j[J_CHEST * 2] - Math.cos(ch) * a.pack, j[J_CHEST * 2 + 1] - Math.sin(ch) * a.pack, ch + HALF_PI, G.packShow);
  putJ(out[S_TORSO_LO], B.torsoLower, j, J_HIP, p[P_SPINE]);
  putJ(out[S_TORSO_UP], B.torsoUpper, j, J_CHEST, p[P_CHEST]);
  putJ(out[S_POUCHES], G.pouches, j, J_HIP, p[P_SPINE] + HALF_PI, G.pouchesShow);
  putJ(out[S_BANDOLIER], G.bandolier, j, J_CHEST, ch + HALF_PI);

  // Near leg, satchel, head and helmet.
  putJ(out[S_NEAR_TH], B.thigh, j, J_HIP, p[P_NTH]);
  putJ(out[S_NEAR_SH], B.shin, j, J_NKNEE, p[P_NSH]);
  putJ(out[S_NEAR_BOOT], B.boot, j, J_NANKLE, p[P_NFP]);
  const sp = p[P_SPINE];
  const sx = j[J_HIP * 2] + Math.cos(sp) * 1.6 - Math.sin(sp) * 1.2;
  const sy = j[J_HIP * 2 + 1] + Math.sin(sp) * 1.6 + Math.cos(sp) * 1.2;
  put(out[S_SATCHEL], G.satchel, sx, sy, p[P_SATCHEL], G.satchelShow);
  putJ(out[S_HEAD], B.head, j, J_NECK, p[P_NECK]);
  putJ(out[S_HELMET], G.helmet, j, J_HEAD, helmRot);

  // Weapon (or crate), its bipod and baseplate, hand items.
  const wa = p[P_WA];
  const gx = j[J_GRIP * 2];
  const gy = j[J_GRIP * 2 + 1];
  put(out[S_PLATE], keys.plate[a.kind], gx, gy, 0, a.weaponVisible && a.plate > 0.5);
  const g = a.geom;
  const c = Math.cos(wa);
  const s = Math.sin(wa);
  put(out[S_BIPOD], keys.bipod[a.kind], gx + g.bipodX * c - g.bipodY * s, gy + g.bipodX * s + g.bipodY * c, p[P_BIPOD], a.weaponVisible);
  if (a.crateVisible) put(out[S_WEAPON], a.crateKey ?? keys.crate, gx, gy, wa);
  else put(out[S_WEAPON], keys.weapon[a.kind], gx, gy, wa, a.weaponVisible);
  putJ(out[S_NEAR_ITEM], keys.item[a.item], j, J_NHAND, p[P_NFA], !a.itemFar);

  // Near arm.
  putJ(out[S_NEAR_UA], B.upperArm, j, J_NSHOULDER, p[P_NUA]);
  putJ(out[S_ARMBAND], B.armband, j, J_NSHOULDER, p[P_NUA], a.kind === 'medic');
  putJ(out[S_NEAR_FA], B.forearm, j, J_NELBOW, p[P_NFA]);
}
