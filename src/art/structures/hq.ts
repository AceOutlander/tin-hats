/**
 * HQ bunkers, one per faction, each in three damage states. Drawn for the
 * left side facing right (door and gun toward +x); the renderer mirrors the
 * right-hand HQ. Anchors are in HQ_LAYOUT (src/data/artLayout.ts).
 */
import { ART_COLORS as C, DAMAGE_STATES, HQ_LAYOUT, type DamageState, type HqLayout } from '../../data/artLayout';
import type { FactionId } from '../../data/schema';
import {
  type Ctx,
  TAU,
  bagCourse,
  bagPile,
  bagWall,
  bite,
  charOver,
  chunk,
  concreteFace,
  ember,
  fillPoly,
  footing,
  heap,
  inside,
  looseBag,
  machineGun,
  makeSpec,
  mix,
  poly,
  rebar,
  rgba,
  rimPoly,
  rimRect,
  rimmed,
  rng,
  sandbag,
  scorch,
  shellHole,
  strokeLine,
} from '../props/kit';
import type { SpriteSpec } from '../types';

export function hqKey(faction: FactionId, state: DamageState): string {
  return `st/hq/${faction}/${state}`;
}

const BAG_W = 18;
const BAG_H = 10;

function flagpole(ctx: Ctx, L: HqLayout): void {
  const x = L.flagBase.x;
  strokeLine(ctx, [x, L.flagBase.y + 6, x, L.flagTop.y - 3], C.inkSoft, 2.6);
  strokeLine(ctx, [x - 0.7, L.flagBase.y + 6, x - 0.7, L.flagTop.y - 2], rgba(C.rim, 0.8), 0.8);
  ctx.fillStyle = C.rim;
  ctx.beginPath();
  ctx.arc(x, L.flagTop.y - 4.5, 2.2, 0, TAU);
  ctx.fill();
  // Cleat and halyard.
  strokeLine(ctx, [x + 1.6, L.flagTop.y - 1, x + 1.6, L.flagBase.y - 22], rgba(C.rim, 0.45), 0.5);
  ctx.fillStyle = C.inkSoft;
  ctx.fillRect(x - 2.5, L.flagBase.y - 24, 5, 2.2);
}

function poleStump(ctx: Ctx, L: HqLayout, baseY: number): void {
  const x = L.flagBase.x;
  strokeLine(ctx, [x, baseY, x + 5, baseY - 30], C.inkSoft, 2.6);
  strokeLine(ctx, [x + 5, baseY - 30, x + 7.5, baseY - 35], C.inkSoft, 1.2);
  // The rest of the pole lies across the wreckage.
  strokeLine(ctx, [x + 10, baseY + 6, x + 78, baseY + 30], C.inkSoft, 2.4);
}

/** Remove everything above a jagged profile, then light the broken edge. */
function breakAbove(ctx: Ctx, profile: readonly number[], top: number): void {
  const n = profile.length;
  bite(ctx, [profile[0], top, ...profile, profile[n - 2], top]);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.translate(0, 1.1);
  strokeLine(ctx, profile, rgba(C.concreteRim, 0.75), 1.6);
  ctx.restore();
}

/** Paint behind what is already there: the far wall seen through the gaps of a ruin. */
function behind(ctx: Ctx, pts: readonly number[], color: string): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  fillPoly(ctx, pts, color);
  ctx.restore();
}

function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number): void {
  strokeLine(ctx, [x0, y0, x1, y1], C.timberDark, width);
  strokeLine(ctx, [x0, y0 - width * 0.3, x1, y1 - width * 0.3], rgba(C.timberRim, 0.7), width * 0.28);
}


// ---------------------------------------------------------------------------
// British: sandbagged concrete and timber command bunker with a radio mast
// ---------------------------------------------------------------------------

const B_MAST_X = -108;
const B_MAST_BASE = -94;
const B_MAST_TOP = -206;

function latticeSection(ctx: Ctx, y0: number, y1: number, half0: number, half1: number): void {
  const steps = Math.max(1, Math.round((y0 - y1) / 13));
  ctx.strokeStyle = C.inkSoft;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-half0, y0);
  ctx.lineTo(-half1, y1);
  ctx.moveTo(half0, y0);
  ctx.lineTo(half1, y1);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < steps; i++) {
    const ua = i / steps;
    const ub = (i + 1) / steps;
    const ya = y0 + (y1 - y0) * ua;
    const yb = y0 + (y1 - y0) * ub;
    const ha = half0 + (half1 - half0) * ua;
    const hb = half0 + (half1 - half0) * ub;
    const s = i % 2 === 0 ? 1 : -1;
    ctx.moveTo(-ha * s, ya);
    ctx.lineTo(hb * s, yb);
    ctx.moveTo(-hb, yb);
    ctx.lineTo(hb, yb);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(C.rim, 0.55);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-half0 - 0.6, y0);
  ctx.lineTo(-half1 - 0.6, y1);
  ctx.stroke();
}

function radioMast(ctx: Ctx, state: DamageState): void {
  const kinkY = -164;
  ctx.save();
  ctx.translate(B_MAST_X, 0);
  // Guy wires.
  ctx.strokeStyle = rgba(C.ink, 0.55);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -150);
  ctx.lineTo(-50, -62);
  ctx.moveTo(0, -150);
  ctx.lineTo(46, -100);
  ctx.stroke();
  if (state === 'intact') {
    latticeSection(ctx, B_MAST_BASE, B_MAST_TOP, 6, 1.4);
    strokeLine(ctx, [0, B_MAST_TOP, 0, B_MAST_TOP - 16], C.inkSoft, 0.9);
    strokeLine(ctx, [-11, -188, 11, -188], C.inkSoft, 1.1);
    strokeLine(ctx, [-8, -176, 8, -176], C.inkSoft, 1.1);
  } else {
    // Shot through: the top section hangs over to the rear.
    latticeSection(ctx, B_MAST_BASE, kinkY, 6, 3);
    ctx.translate(0, kinkY);
    ctx.rotate(-2.15);
    latticeSection(ctx, 0, -(kinkY - B_MAST_TOP), 3, 1.4);
    strokeLine(ctx, [-9, -20, 9, -20], C.inkSoft, 1.1);
  }
  ctx.restore();
}

function britishBody(ctx: Ctx, L: HqLayout, rand: () => number): void {
  // Earth banked up against the rear, and the earth cover on the roof.
  rimPoly(ctx, [-174, 2, -162, -28, -146, -62, -126, -90, -100, -100, -100, 2], C.earth, C.earthRim);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-138, -88);
      c.quadraticCurveTo(-70, -126, 10, -116);
      c.quadraticCurveTo(76, -108, 106, -86);
      c.lineTo(106, -78);
      c.lineTo(-138, -78);
      c.closePath();
    },
    C.earth,
    C.earthRim,
  );

  // Main wall.
  const wall = [-132, -80, 98, -80, 98, 2, -132, 2];
  rimPoly(ctx, wall, C.concrete, C.concreteRim);
  inside(
    ctx,
    (c) => poly(c, wall),
    () => {
      concreteFace(ctx, -132, 98, -80, 2, rand);
      ctx.fillStyle = rgba(C.concreteDark, 0.45);
      ctx.fillRect(-132, -9, 230, 12);
      // Shadow under the roof beams.
      ctx.fillStyle = rgba(C.void, 0.35);
      ctx.fillRect(-132, -80, 230, 5);
    },
  );

  // Firing position at the front.
  const nose = [96, -74, 140, -74, 152, -62, 152, 2, 96, 2];
  rimPoly(ctx, nose, mix(C.concrete, C.concreteDark, 0.3), C.concreteRim);
  inside(
    ctx,
    (c) => poly(c, nose),
    () => concreteFace(ctx, 96, 152, -74, 2, rand),
  );
  fillPoly(ctx, [105, -58, 152, -58, 152, -37, 105, -37], C.concreteDark);
  strokeLine(ctx, [105, -58.4, 152, -58.4], rgba(C.concreteRim, 0.8), 0.9);
  fillPoly(ctx, [110, -53, 152, -53, 152, -42, 110, -42], C.void);
  machineGun(ctx, L.gunSlit, 24);

  // Timber roof: a heavy beam with the log ends showing.
  rimRect(ctx, -140, -93, 248, 14, 2, C.timber, C.timberRim);
  for (let x = -131; x <= 100; x += 13.6) {
    ctx.fillStyle = C.timberDark;
    ctx.beginPath();
    ctx.arc(x, -86, 5.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.timber, C.timberRim, 0.35);
    ctx.beginPath();
    ctx.arc(x, -86.4, 4.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(C.timberDark, 0.8);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(x, -86.4, 2.1, 0, TAU);
    ctx.stroke();
  }

  // Stovepipe.
  rimRect(ctx, 70, -124, 5, 34, 1, C.steel, C.steelRim);
  rimPoly(ctx, [66, -124, 72.5, -130, 79, -124], C.steel, C.steelRim, 1);

  // Sandbag crown on the roof.
  bagCourse(ctx, -120, 78, -102, BAG_W, BAG_H, -120);
  bagCourse(ctx, -93, 40, -110.2, BAG_W, BAG_H, -93, 1);
  sandbag(ctx, 84, -102, 16, BAG_H, -0.3);

  // Vision slit with a timber shutter in the main wall.
  fillPoly(ctx, [-96, -62, -60, -62, -60, -50, -96, -50], C.concreteDark);
  fillPoly(ctx, [-93, -59.5, -63, -59.5, -63, -52.5, -93, -52.5], C.void);
  rimRect(ctx, -99, -66, 42, 4, 1, C.timber, C.timberRim, 0.9);

  // Doorway: timber frame around a dark opening, lamp glow inside.
  const dl = L.doorX - L.doorW / 2;
  ctx.fillStyle = C.void;
  ctx.fillRect(dl, -L.doorH, L.doorW, L.doorH + 2);
  const glow = ctx.createRadialGradient(L.doorX + 4, -L.doorH + 16, 1, L.doorX + 4, -L.doorH + 16, 30);
  glow.addColorStop(0, 'rgba(214,160,84,0.34)');
  glow.addColorStop(1, 'rgba(214,160,84,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(dl, -L.doorH, L.doorW, L.doorH);
  rimRect(ctx, dl - 5, -L.doorH - 1, 5, L.doorH + 3, 1, C.timber, C.timberRim);
  rimRect(ctx, dl + L.doorW, -L.doorH - 1, 5, L.doorH + 3, 1, C.timber, C.timberRim);
  rimRect(ctx, dl - 9, -L.doorH - 8, L.doorW + 18, 8, 1.5, C.timber, C.timberRim);

  // Sandbags: rear buttress, a wall beside the door, a pile under the gun.
  bagPile(ctx, -172, 2, 3, 3, BAG_W, BAG_H, 1);
  bagWall(ctx, -34, 2, 3, 3, BAG_W, BAG_H);
  bagPile(ctx, 120, 2, 3, 3, BAG_W, BAG_H, 2);

  // A crate and a can by the door.
  rimRect(ctx, 68, -15, 20, 16, 1, C.crate, C.crateRim);
  fillPoly(ctx, [68, -8, 88, -8, 88, -6.8, 68, -6.8], C.crateDark);
  rimRect(ctx, 90, -11, 7, 12, 1.5, C.drum, C.drumRim);
}

function paintBritish(ctx: Ctx, state: DamageState): void {
  const L = HQ_LAYOUT.british;
  const rand = rng(1940);
  const ruin = state === 'ruin';
  if (!ruin) {
    radioMast(ctx, state);
    flagpole(ctx, L);
  }
  britishBody(ctx, L, rand);

  if (state !== 'intact') {
    const drand = rng(77);
    bite(ctx, [34, -122, 40, -104, 47, -99, 55, -103, 62, -96, 70, -106, 66, -122]);
    bite(ctx, [132, -80, 135, -70, 142, -66, 147, -58, 156, -56, 156, -80]);
    shellHole(ctx, -40, -40, 9, drand);
    shellHole(ctx, 122, -22, 6, drand);
    shellHole(ctx, -112, -58, 6, drand);
    scorch(ctx, -40, -40, 36, 28, 0.6);
    scorch(ctx, 52, -96, 30, 22, 0.7);
    scorch(ctx, 138, -64, 24, 22, 0.6);
    scorch(ctx, 8, -18, 22, 18, 0.35);
  }

  if (ruin) {
    const rrand = rng(451);
    const profile = [
      -178, -18, -160, -30, -148, -24, -136, -58, -128, -44, -116, -78, -104, -84, -96, -62, -84, -70, -70, -40, -58, -52, -44, -26, -30,
      -34, -14, -18, 2, -24, 18, -52, 26, -72, 40, -76, 52, -58, 64, -66, 74, -40, 88, -48, 100, -68, 112, -72, 124, -50, 138, -58, 150,
      -30, 162, -20, 180, -8,
    ];
    breakAbove(ctx, profile, -232);
    behind(
      ctx,
      [-140, 2, -138, -64, -122, -96, -108, -78, -92, -100, -74, -88, -60, -64, -46, -70, -28, -48, -10, -56, 6, -40, 22, -66, 44, -86, 58,
        -70, 72, -80, 86, -60, 104, -78, 120, -62, 140, -44, 150, 2],
      mix(C.concreteDark, C.char, 0.55),
    );
    radioMastStump(ctx);
    poleStump(ctx, L, -34);
    // Wreckage: roof beams, bags and broken concrete spilled out in front.
    heap(ctx, -150, 30, 4, 26, rrand, mix(C.earth, C.concreteDark, 0.5), C.earthRim);
    heap(ctx, 10, 168, 4, 22, rrand, mix(C.earth, C.concreteDark, 0.6), C.earthRim);
    beam(ctx, -96, -6, -30, -46, 5);
    beam(ctx, -20, -4, 34, -38, 5);
    beam(ctx, 60, -10, 124, -30, 4.5);
    beam(ctx, -64, -14, 6, -8, 4);
    for (let i = 0; i < 16; i++) {
      chunk(ctx, -150 + rrand() * 300, -2 - rrand() * 16, 7 + rrand() * 9, rrand, mix(C.concrete, C.concreteDark, rrand()), C.concreteRim);
    }
    looseBag(ctx, -122, -8, 0.5, 0);
    looseBag(ctx, -44, -4, -0.3, -0.3);
    looseBag(ctx, 96, -6, 0.2, 0.2);
    looseBag(ctx, 144, -3, -0.6, -0.2);
    charOver(ctx, -178, -232, 360, 250, 0.42);
    for (const f of L.fires) {
      ember(ctx, f.x, f.y + 14, 16, 0.55);
      ember(ctx, f.x + 9 - rrand() * 18, f.y + 20, 5, 0.8);
    }
    for (let i = 0; i < 9; i++) ember(ctx, -130 + rrand() * 260, -6 - rrand() * 30, 2 + rrand() * 2.5, 0.75);
  } else if (state === 'damaged') {
    const drand = rng(78);
    for (let i = 0; i < 7; i++) {
      chunk(ctx, -70 + drand() * 220, -1 - drand() * 3, 5 + drand() * 6, drand, mix(C.concrete, C.concreteDark, drand()), C.concreteRim);
    }
    looseBag(ctx, 30, -100, 0.9, -0.2);
    looseBag(ctx, 108, -4, 0.4, 0.1);
  }
  footing(ctx, -176, 176, 2, 9, rand);
}

function radioMastStump(ctx: Ctx): void {
  ctx.save();
  ctx.translate(B_MAST_X, 0);
  latticeSection(ctx, -70, -118, 6, 4.6);
  ctx.restore();
  // The fallen mast lies across the wreckage.
  ctx.save();
  ctx.translate(B_MAST_X + 14, -30);
  ctx.rotate(1.28);
  latticeSection(ctx, 0, -110, 4.6, 1.4);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// German: angular poured-concrete bunker with a steel observation cupola
// ---------------------------------------------------------------------------

function germanBody(ctx: Ctx, L: HqLayout, rand: () => number): void {
  const body = mix(C.concrete, C.steel, 0.32);
  const bodyDark = mix(C.concreteDark, C.steel, 0.3);

  // Aerial.
  strokeLine(ctx, [-120, -104, -127, -178], C.inkSoft, 0.9);

  // Main block with a sloped, chamfered rear.
  const block = [-152, 2, -146, -62, -126, -93, 66, -93, 66, 2];
  rimPoly(ctx, block, body, C.concreteRim);
  inside(
    ctx,
    (c) => poly(c, block),
    () => {
      concreteFace(ctx, -152, 66, -93, 2, rand);
      // Angular disruptive camouflage, very low contrast.
      fillPoly(ctx, [-150, -40, -110, -70, -84, -52, -96, -18, -140, -8], rgba(bodyDark, 0.5));
      fillPoly(ctx, [-56, -93, -20, -93, -4, -60, -30, -40, -62, -66], rgba(bodyDark, 0.5));
      fillPoly(ctx, [-70, 2, -40, -22, -6, -12, 4, 2], rgba(bodyDark, 0.45));
      fillPoly(ctx, [40, -93, 66, -93, 66, -50, 52, -58], rgba(bodyDark, 0.5));
      ctx.fillStyle = rgba(C.void, 0.4);
      ctx.fillRect(-152, -93, 220, 6);
      ctx.fillStyle = rgba(C.concreteDark, 0.45);
      ctx.fillRect(-152, -9, 220, 12);
    },
  );

  // Front casemate with a sloped face.
  const casemate = [62, 2, 62, -83, 112, -83, 152, -47, 152, 2];
  rimPoly(ctx, casemate, mix(body, bodyDark, 0.45), C.concreteRim);
  inside(
    ctx,
    (c) => poly(c, casemate),
    () => {
      concreteFace(ctx, 62, 152, -83, 2, rand);
      fillPoly(ctx, [62, -30, 96, -22, 120, 2, 62, 2], rgba(bodyDark, 0.5));
    },
  );
  // Stepped embrasure.
  fillPoly(ctx, [96, -67, 128.7, -67, 152, -46, 152, -39, 96, -39], bodyDark);
  strokeLine(ctx, [96, -67.4, 128.7, -67.4], rgba(C.concreteRim, 0.7), 0.9);
  fillPoly(ctx, [102, -62.5, 133.7, -62.5, 152, -46, 152, -43.5, 102, -43.5], mix(bodyDark, C.void, 0.55));
  fillPoly(ctx, [108, -58, 138.7, -58, 150, -48, 108, -48], C.void);
  machineGun(ctx, L.gunSlit, 24);

  // Roof slabs: thick, overhanging, with a dark soffit.
  rimPoly(ctx, [58, -83, 58, -92, 115, -92, 159, -52, 154, -45, 111, -83], mix(body, C.concreteRim, 0.16), C.concreteRim, 1.5);
  rimPoly(ctx, [-137, -93, -131, -109, 69, -109, 77, -99, 77, -93], mix(body, C.concreteRim, 0.16), C.concreteRim, 1.5);
  strokeLine(ctx, [-135, -92.4, 76, -92.4], rgba(C.void, 0.55), 1.4);

  // Steel observation cupola.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-92, -108.5);
      c.bezierCurveTo(-92, -131, -54, -131, -54, -108.5);
      c.closePath();
    },
    C.steel,
    C.steelRim,
    0.3,
    1.5,
  );
  ctx.fillStyle = C.void;
  ctx.fillRect(-84, -120, 7, 2.2);
  ctx.fillRect(-70, -120, 7, 2.2);

  // Vent pipes.
  for (const vx of [-104, -92]) {
    ctx.fillStyle = C.void;
    ctx.beginPath();
    ctx.arc(vx, -70, 2.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(C.concreteRim, 0.7);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Recessed doorway with a steel blast door standing ajar.
  const dx = L.doorX;
  const hw = L.doorW / 2;
  fillPoly(ctx, [dx - hw - 6, 2, dx - hw - 6, -L.doorH - 8, dx + hw + 6, -L.doorH - 8, dx + hw + 6, 2], bodyDark);
  strokeLine(ctx, [dx - hw - 6, -L.doorH - 8.4, dx + hw + 6, -L.doorH - 8.4], rgba(C.concreteRim, 0.8), 0.9);
  ctx.fillStyle = C.void;
  ctx.fillRect(dx - hw, -L.doorH, L.doorW, L.doorH + 2);
  const glow = ctx.createRadialGradient(dx + 3, -L.doorH + 14, 1, dx + 3, -L.doorH + 14, 26);
  glow.addColorStop(0, 'rgba(196,170,110,0.26)');
  glow.addColorStop(1, 'rgba(196,170,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(dx - hw, -L.doorH, L.doorW, L.doorH);
  rimPoly(ctx, [dx - hw, -L.doorH, dx - hw + 8, -L.doorH + 3, dx - hw + 8, -1, dx - hw, 2], C.steel, C.steelRim);
  ctx.fillStyle = rgba(C.steelRim, 0.8);
  for (const ry of [-52, -32, -12]) ctx.fillRect(dx - hw + 2.5, ry, 1.4, 1.4);

  // Sandbags: a few at the rear, a wall beside the door, a low pile under the gun.
  bagPile(ctx, -172, 2, 2, 2, BAG_W, BAG_H, 1);
  bagWall(ctx, -44, 2, 3, 2, BAG_W, BAG_H);
  bagPile(ctx, 122, 2, 3, 2, BAG_W, BAG_H, 2);
}

function paintGerman(ctx: Ctx, state: DamageState): void {
  const L = HQ_LAYOUT.german;
  const rand = rng(1944);
  const ruin = state === 'ruin';
  if (!ruin) flagpole(ctx, L);
  germanBody(ctx, L, rand);

  if (state !== 'intact') {
    const drand = rng(31);
    bite(ctx, [48, -116, 52, -100, 60, -96, 66, -88, 76, -90, 84, -96, 84, -116]);
    bite(ctx, [-160, -70, -144, -72, -138, -80, -128, -84, -124, -98, -160, -98]);
    shellHole(ctx, -30, -48, 10, drand);
    shellHole(ctx, 88, -20, 6, drand);
    shellHole(ctx, -116, -30, 6, drand);
    scorch(ctx, -30, -48, 38, 30, 0.6);
    scorch(ctx, 66, -92, 30, 22, 0.7);
    scorch(ctx, 128, -56, 26, 22, 0.55);
    scorch(ctx, -128, -84, 22, 20, 0.5);
    rebar(ctx, 60, -97, drand);
  }

  if (ruin) {
    const rrand = rng(912);
    const profile = [
      -178, -14, -158, -24, -150, -52, -140, -46, -132, -78, -120, -72, -110, -92, -98, -66, -86, -74, -72, -44, -60, -50, -46, -28, -30,
      -40, -16, -22, 0, -30, 12, -60, 22, -80, 36, -84, 48, -64, 58, -70, 70, -42, 84, -52, 96, -74, 108, -66, 120, -48, 134, -54, 146,
      -28, 160, -18, 180, -8,
    ];
    breakAbove(ctx, profile, -232);
    behind(
      ctx,
      [-146, 2, -142, -70, -128, -98, -112, -84, -96, -102, -78, -80, -60, -70, -44, -78, -26, -52, -8, -60, 8, -44, 24, -72, 42, -92, 60,
        -74, 76, -84, 92, -62, 110, -72, 126, -50, 142, -36, 150, 2],
      mix(C.concreteDark, C.char, 0.55),
    );
    poleStump(ctx, L, -36);
    heap(ctx, -156, 20, 4, 24, rrand, mix(C.concreteDark, C.earth, 0.4), C.concreteRim);
    heap(ctx, 0, 170, 4, 22, rrand, mix(C.concreteDark, C.earth, 0.5), C.concreteRim);
    // Slabs of roof lying where they fell, and the cupola tipped off its seat.
    rimPoly(ctx, [-104, -6, -52, -40, -44, -32, -94, 4], mix(C.concrete, C.steel, 0.3), C.concreteRim, 1.4);
    rimPoly(ctx, [36, -4, 96, -28, 102, -18, 44, 6], mix(C.concrete, C.steel, 0.3), C.concreteRim, 1.4);
    ctx.save();
    ctx.translate(-14, -8);
    ctx.rotate(0.5);
    rimmed(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(-19, 0);
        c.bezierCurveTo(-19, -22, 19, -22, 19, 0);
        c.closePath();
      },
      C.steel,
      C.steelRim,
    );
    ctx.restore();
    rebar(ctx, -70, -30, rrand);
    rebar(ctx, 70, -20, rrand);
    rebar(ctx, -128, -40, rrand);
    rebar(ctx, 118, -36, rrand);
    for (let i = 0; i < 18; i++) {
      chunk(ctx, -152 + rrand() * 306, -2 - rrand() * 16, 7 + rrand() * 10, rrand, mix(C.concrete, C.concreteDark, rrand()), C.concreteRim);
    }
    looseBag(ctx, -150, -4, 0.4, 0);
    looseBag(ctx, 150, -3, -0.5, -0.2);
    charOver(ctx, -178, -232, 360, 250, 0.42);
    for (const f of L.fires) {
      ember(ctx, f.x, f.y + 14, 16, 0.55);
      ember(ctx, f.x + 9 - rrand() * 18, f.y + 20, 5, 0.8);
    }
    for (let i = 0; i < 9; i++) ember(ctx, -130 + rrand() * 260, -6 - rrand() * 30, 2 + rrand() * 2.5, 0.75);
  } else if (state === 'damaged') {
    const drand = rng(32);
    for (let i = 0; i < 7; i++) {
      chunk(ctx, -90 + drand() * 240, -1 - drand() * 3, 5 + drand() * 6, drand, mix(C.concrete, C.concreteDark, drand()), C.concreteRim);
    }
    rimPoly(ctx, [70, -2, 92, -10, 96, -4, 76, 4], mix(C.concrete, C.steel, 0.3), C.concreteRim, 1.2);
  }
  footing(ctx, -176, 176, 2, 9, rand);
}

export function hqSpecs(): SpriteSpec[] {
  const specs: SpriteSpec[] = [];
  for (const state of DAMAGE_STATES) {
    specs.push(makeSpec(hqKey('british', state), HQ_LAYOUT.british.box, (ctx) => paintBritish(ctx, state)));
    specs.push(makeSpec(hqKey('german', state), HQ_LAYOUT.german.box, (ctx) => paintGerman(ctx, state)));
  }
  return specs;
}
