/**
 * Where every flag in the battle hangs (owner, 2026-11-09: "Every flag must hang from a visible flagpole that's
 * attached to something ... The flag's edge attaches to the pole and waves away from it, and the pole stands straight
 * and sits on the surface it's mounted on"). One place works out each pole and the cloth on it, for the HQ flags, the
 * capture-point flags and the trench pennants; the renderers (structures.ts, points.ts) place their images from these,
 * and tests/unit/flag-mounts.test.ts checks that no cloth is ever off its pole or its pole off its mount. No Phaser here.
 */
import { FLAG_LAYOUT, TRENCH_LAYOUT, type ArtPoint } from '../data/artLayout';
import { POINT_ART } from '../data/ground';

/** A straight, upright pole: its centre line x, its top and its foot (world y, down is +), and its width. */
export interface Pole {
  x: number;
  top: number;
  base: number;
  w: number;
}

/** The cloth: its hoist edge x (on the pole), its top, its size, and which way it flies from the pole (+1 = +x). */
export interface Cloth {
  hoistX: number;
  top: number;
  w: number;
  h: number;
  dir: 1 | -1;
}

export interface FlagMount {
  pole: Pole;
  cloth: Cloth;
}

/**
 * An HQ's flag: the pole the HQ sprite draws from flagBase (on the ground, a roof or a dugout's top) up to flagTop, and
 * the flag hung by its hoist from flagTop, flying toward `dir` (the HQ's facing). `artX` is the sprite's origin x and
 * `groundY` the world ground line.
 */
export function hqFlag(L: { flagBase: ArtPoint; flagTop: ArtPoint }, artX: number, dir: 1 | -1, groundY: number): FlagMount {
  const x = artX + dir * L.flagTop.x;
  return {
    pole: { x: artX + dir * L.flagBase.x, top: groundY + L.flagTop.y, base: groundY + L.flagBase.y, w: 2.6 },
    cloth: { hoistX: x, top: groundY + L.flagTop.y, w: FLAG_LAYOUT.w, h: FLAG_LAYOUT.h, dir },
  };
}

/**
 * A trench's pennant: a stake driven in at the friendly lip of the pit (its foot at the lip), the cloth tied at its top
 * and flying back toward the holder's own side. `dir` is +1 for side 0's trench, -1 for side 1's.
 */
export function trenchPennant(trenchX: number, dir: 1 | -1, groundY: number): FlagMount {
  const T = TRENCH_LAYOUT;
  const lipX = trenchX - dir * (T.pitW / 2 + 4);
  const base = groundY + T.pitNearY;
  const top = base - T.stakeH;
  return {
    pole: { x: lipX, top, base, w: T.stakeW },
    cloth: { hoistX: lipX, top, w: T.pennantW, h: T.pennantH, dir: dir === 1 ? -1 : 1 },
  };
}

/**
 * A capture point's flag: the pole planted at the point's centre, the holder's colours run up it (`hoist` 0 = at the
 * foot, 1 = at the top), flying away from the holder's end of the field.
 */
export function pointFlag(x: number, dir: 1 | -1, hoist: number, groundY: number): FlagMount {
  const A = POINT_ART;
  const base = groundY + A.backY;
  const h = Math.max(0, Math.min(1, hoist));
  return {
    pole: { x, top: base - A.poleH, base, w: A.poleW },
    cloth: { hoistX: x + (dir * A.poleW) / 2, top: base - A.flagH - (A.poleH - A.flagH) * h, w: A.flagW, h: A.flagH, dir },
  };
}

/**
 * True when the cloth hangs on its pole: its hoist edge on the pole, its top no higher than the pole's top and its foot
 * above the pole's foot (so the pole is seen holding it), and the pole upright with some length.
 */
export function hangsOnPole(m: FlagMount): boolean {
  const { pole, cloth } = m;
  const onPole = Math.abs(cloth.hoistX - pole.x) <= pole.w / 2 + 0.01;
  return pole.w >= 1.5 && pole.base - pole.top > cloth.h && onPole && cloth.top >= pole.top - 0.01 && cloth.top + cloth.h <= pole.base + 0.01;
}
