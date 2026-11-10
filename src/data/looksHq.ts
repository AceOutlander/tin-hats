/**
 * Layout data for every HQ style a Quartermaster "HQ health" upgrade can show (see HqStyle in upgradeLooks.ts):
 * the small field tent, the big tent, the timber dugout and the two nations' concrete bunkers. Same conventions as
 * HQ_LAYOUT in artLayout.ts: origin = bottom centre of the body on the ground line, +x toward the enemy, -y up.
 *
 * The HQ machine gun is not part of these sprites: it is a separate gun-position sprite whose base centre sits on the
 * ground at `gunNest`, in front of the HQ (+x), clear of the doorway.
 */
import { HQ_LAYOUT, type ArtPoint, type HqLayout } from './artLayout';
import type { HqStyle } from './upgradeLooks';

export interface HqStyleLayout extends Omit<HqLayout, 'gunSlit'> {
  /** Ground point (y = 0) for the base centre of the separate HQ gun-position sprite, beyond the body's right edge. */
  gunNest: ArtPoint;
}

/** How far the gun position's base centre sits beyond the right edge of the body, in wu. */
const GUN_NEST_CLEAR = 60;

/** Today's bunker layout without its built-in gun slit, plus the gun position in front of it. */
function bunker(L: HqLayout): HqStyleLayout {
  return {
    box: L.box,
    bodyW: L.bodyW,
    bodyH: L.bodyH,
    doorX: L.doorX,
    doorW: L.doorW,
    doorH: L.doorH,
    flagBase: L.flagBase,
    flagTop: L.flagTop,
    fires: L.fires,
    gunNest: { x: L.bodyW / 2 + GUN_NEST_CLEAR, y: 0 },
  };
}

export const HQ_STYLE_LAYOUT: Record<HqStyle, HqStyleLayout> = {
  /** Stage 0: a small ridge-tent command post behind a low wall of bags. */
  tent: {
    box: { w: 290, h: 196, ox: 145, oy: 182 },
    bodyW: 176,
    bodyH: 112,
    doorX: 38,
    doorW: 32,
    doorH: 58,
    flagBase: { x: -112, y: 0 },
    flagTop: { x: -112, y: -164 },
    fires: [
      { x: -50, y: -40 },
      { x: 8, y: -52 },
      { x: 62, y: -30 },
    ],
    gunNest: { x: 176 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Stage 1: a big tent with an annex, a higher bag wall, a camouflage net and a radio aerial. */
  bigTent: {
    box: { w: 356, h: 222, ox: 178, oy: 206 },
    bodyW: 264,
    bodyH: 126,
    doorX: 64,
    doorW: 34,
    doorH: 60,
    flagBase: { x: -148, y: 0 },
    flagTop: { x: -148, y: -188 },
    fires: [
      { x: -88, y: -36 },
      { x: -4, y: -62 },
      { x: 90, y: -40 },
    ],
    gunNest: { x: 264 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Stage 2: a timber-and-sandbag dugout, earth-covered, low, under a camouflage net. */
  dugout: {
    box: { w: 356, h: 214, ox: 178, oy: 200 },
    bodyW: 280,
    bodyH: 92,
    doorX: 40,
    doorW: 34,
    doorH: 60,
    flagBase: { x: -58, y: -88 },
    flagTop: { x: -58, y: -192 },
    fires: [
      { x: -76, y: -44 },
      { x: -6, y: -56 },
      { x: 92, y: -40 },
    ],
    gunNest: { x: 280 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Stage 3: today's concrete bunkers (the gun slit is empty: the gun stands in its own position). */
  bunkerBritish: bunker(HQ_LAYOUT.british),
  bunkerGerman: bunker(HQ_LAYOUT.german),
  /** Soviet stage 0: a ridge tent of rain capes (plash-palatki) buttoned together, behind a low bank of earth. */
  capeTent: {
    box: { w: 290, h: 196, ox: 145, oy: 182 },
    bodyW: 180,
    bodyH: 104,
    doorX: 38,
    doorW: 30,
    doorH: 58,
    flagBase: { x: -112, y: 0 },
    flagTop: { x: -112, y: -164 },
    fires: [
      { x: -50, y: -36 },
      { x: 6, y: -50 },
      { x: 60, y: -28 },
    ],
    gunNest: { x: 180 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Soviet stage 1: the zemlyanka, a dugout under a mound of earth and sod, its entrance cut into the front. */
  zemlyanka: {
    box: { w: 340, h: 204, ox: 170, oy: 192 },
    bodyW: 240,
    bodyH: 80,
    doorX: 44,
    doorW: 32,
    doorH: 60,
    flagBase: { x: -60, y: -76 },
    flagTop: { x: -60, y: -180 },
    fires: [
      { x: -72, y: -40 },
      { x: -4, y: -58 },
      { x: 84, y: -30 },
    ],
    gunNest: { x: 240 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Soviet stage 2: a log dugout under three courses of logs and earth (the dugout's walls). */
  logDugout: {
    box: { w: 356, h: 220, ox: 178, oy: 206 },
    bodyW: 280,
    bodyH: 112,
    doorX: 40,
    doorW: 34,
    doorH: 60,
    flagBase: { x: -58, y: -108 },
    flagTop: { x: -58, y: -198 },
    fires: [
      { x: -76, y: -44 },
      { x: -6, y: -70 },
      { x: 92, y: -40 },
    ],
    gunNest: { x: 280 / 2 + GUN_NEST_CLEAR, y: 0 },
  },
  /** Soviet stage 3: the concrete DOT, earthed over (the gun slit is empty: the gun stands in its own position). */
  bunkerSoviet: bunker(HQ_LAYOUT.soviet),
};
