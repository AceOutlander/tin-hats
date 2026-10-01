/**
 * Supplies: the dump where sappers load (crates, fuel drums, a tarpaulined
 * stack), the crate a sapper carries, and the airdrop crate with its parachute.
 */
import { ART_COLORS as C, SUPPLY_LAYOUT as S } from '../../data/artLayout';
import type { SpriteSpec } from '../types';
import { type Ctx, TAU, ellipse, fillPoly, footing, inside, makeSpec, mix, rgba, rimRect, rimmed, rng, rr, strokeLine } from './kit';

export const SUPPLY_KEYS = {
  dump: 'prop/dump',
  crate: 'prop/crate',
  dropCrate: 'prop/dropCrate',
  parachute: 'prop/parachute',
} as const;

/** A wooden crate; (x, y) is its top-left corner. */
function crate(ctx: Ctx, x: number, y: number, w: number, h: number, shade = 0, mark = true): void {
  const body = shade >= 0 ? mix(C.crate, C.crateRim, shade) : mix(C.crate, C.crateDark, -shade);
  rimRect(ctx, x, y, w, h, 0.8, body, C.crateRim, 1.2);
  // Plank joints and end battens.
  ctx.fillStyle = rgba(C.crateDark, 0.75);
  const planks = Math.max(2, Math.round(h / 6.5));
  for (let i = 1; i < planks; i++) ctx.fillRect(x + 0.5, y + (h * i) / planks - 0.4, w - 1, 0.9);
  ctx.fillStyle = C.crateDark;
  ctx.fillRect(x + 1.6, y + 1.2, Math.max(1.8, w * 0.09), h - 1.2);
  ctx.fillRect(x + w - 1.6 - Math.max(1.8, w * 0.09), y + 1.2, Math.max(1.8, w * 0.09), h - 1.2);
  if (mark && w > 16) {
    // Stencilled stripe, no lettering.
    ctx.fillStyle = rgba(C.flagWhite, 0.5);
    ctx.fillRect(x + w * 0.36, y + h * 0.36, w * 0.28, Math.max(1.4, h * 0.14));
  }
}

/** An upright fuel drum standing on yBase. */
function drum(ctx: Ctx, x: number, yBase: number, w: number, h: number, dark = 0): void {
  const body = mix(C.drum, C.drumDark, dark);
  rimRect(ctx, x, yBase - h, w, h, 2, body, C.drumRim, 1.3);
  ctx.fillStyle = rgba(C.drumDark, 0.9);
  ctx.fillRect(x, yBase - h * 0.68, w, 1.3);
  ctx.fillRect(x, yBase - h * 0.34, w, 1.3);
  ctx.fillStyle = rgba(C.drumRim, 0.45);
  ctx.fillRect(x + w * 0.16, yBase - h + 2.4, 1.6, h - 4.8);
  // Shaded side away from the light.
  ctx.fillStyle = rgba(C.void, 0.28);
  ctx.fillRect(x + w * 0.68, yBase - h + 1.6, w * 0.32 - 0.6, h - 2.4);
}

function jerrycan(ctx: Ctx, x: number, yBase: number): void {
  rimRect(ctx, x, yBase - 13, 8.5, 13, 1.6, C.drum, C.drumRim, 1.1);
  fillPoly(ctx, [x + 1.6, yBase - 15.6, x + 6, yBase - 15.6, x + 6, yBase - 13, x + 1.6, yBase - 13], C.drumDark);
  ctx.strokeStyle = rgba(C.drumDark, 0.9);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 1.8, yBase - 10.6);
  ctx.lineTo(x + 6.7, yBase - 2.6);
  ctx.moveTo(x + 6.7, yBase - 10.6);
  ctx.lineTo(x + 1.8, yBase - 2.6);
  ctx.stroke();
}

function sack(ctx: Ctx, x: number, yBase: number, w: number, h: number, tone: number): void {
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(x, yBase);
      c.bezierCurveTo(x - 1.6, yBase - h * 0.8, x + w * 0.2, yBase - h, x + w * 0.5, yBase - h);
      c.bezierCurveTo(x + w * 0.82, yBase - h, x + w + 1.6, yBase - h * 0.8, x + w, yBase);
      c.closePath();
    },
    mix(C.sandbag, C.silk, 0.25 + tone),
    mix(C.sandbagRim, C.silk, 0.5),
    0.2,
    1.2,
  );
}

function paintDump(ctx: Ctx): void {
  const rand = rng(9);
  // Rear rank: drums and a crate, slightly darker.
  drum(ctx, 36, -3, 16, 31, 0.45);
  drum(ctx, 54, -3, 16, 31, 0.5);
  crate(ctx, -80, -24, 26, 22, -0.45, false);

  // Tarpaulined stack in the middle with crate corners showing underneath.
  crate(ctx, -30, -20, 26, 20, -0.2);
  crate(ctx, 2, -17, 24, 17, -0.1, false);
  const tarp = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(-40, -7);
    c.bezierCurveTo(-39, -26, -36, -45, -24, -51);
    c.bezierCurveTo(-12, -57, 10, -55, 18, -47);
    c.bezierCurveTo(27, -39, 30, -24, 33, -11);
    c.lineTo(26, -14);
    c.lineTo(19, -9);
    c.lineTo(10, -15);
    c.lineTo(2, -9);
    c.lineTo(-8, -16);
    c.lineTo(-18, -8);
    c.lineTo(-28, -14);
    c.closePath();
  };
  rimmed(ctx, tarp, C.canvas, C.canvasRim, 0.4, 1.5);
  inside(ctx, tarp, () => {
    // Folds and the shaded side.
    ctx.fillStyle = rgba(C.canvasDark, 0.55);
    ctx.beginPath();
    ctx.moveTo(6, -56);
    ctx.bezierCurveTo(14, -40, 18, -26, 20, -6);
    ctx.lineTo(40, -6);
    ctx.lineTo(40, -56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(C.canvasDark, 0.8);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, -50);
    ctx.quadraticCurveTo(-27, -30, -29, -13);
    ctx.moveTo(-8, -54);
    ctx.quadraticCurveTo(-9, -34, -8, -16);
    ctx.moveTo(8, -52);
    ctx.quadraticCurveTo(10, -32, 10, -15);
    ctx.stroke();
    ctx.strokeStyle = rgba(C.canvasRim, 0.5);
    ctx.beginPath();
    ctx.moveTo(-20.5, -50);
    ctx.quadraticCurveTo(-25.5, -30, -27.5, -13);
    ctx.moveTo(-6.5, -54);
    ctx.quadraticCurveTo(-7.5, -34, -6.5, -16);
    ctx.stroke();
  });
  // Lashing ropes pegged to the ground.
  strokeLine(ctx, [-34, -38, -46, -1], rgba(C.silk, 0.6), 0.7);
  strokeLine(ctx, [26, -30, 34, -1], rgba(C.silk, 0.6), 0.7);
  strokeLine(ctx, [-37, -30, 29, -26], rgba(C.canvasDark, 0.9), 0.9);

  // Front rank: stacked crates on the left, drums and cans on the right, sacks in front.
  crate(ctx, -72, -19, 27, 19, 0);
  crate(ctx, -66, -35, 25, 16, 0.18);
  crate(ctx, -44, -14, 20, 14, -0.15, false);
  drum(ctx, 44, 1, 17, 32, 0);
  drum(ctx, 62, 1, 17, 32, 0.15);
  jerrycan(ctx, 26, 1);
  jerrycan(ctx, 35.5, 1);
  sack(ctx, -22, 1, 17, 9.5, 0);
  sack(ctx, -6, 1, 17, 9.5, 0.12);
  sack(ctx, -14, -7.5, 17, 9, 0.06);
  footing(ctx, -84, 84, 1, 6, rand);
}

function paintCrate(ctx: Ctx): void {
  crate(ctx, -9.5, -6.5, 19, 13, 0.1);
  // Rope handles.
  ctx.strokeStyle = rgba(C.silk, 0.75);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9.5, -3);
  ctx.quadraticCurveTo(-11.5, 0, -9.5, 3);
  ctx.moveTo(9.5, -3);
  ctx.quadraticCurveTo(11.5, 0, 9.5, 3);
  ctx.stroke();
}

function paintDropCrate(ctx: Ctx): void {
  crate(ctx, -15, -21, 30, 20, 0.05);
  // Webbing straps and the harness ring the parachute clips to.
  ctx.fillStyle = C.canvasDark;
  ctx.fillRect(-8.5, -21, 3, 20);
  ctx.fillRect(5.5, -21, 3, 20);
  ctx.fillStyle = rgba(C.canvasRim, 0.6);
  ctx.fillRect(-8.5, -21, 3, 1.2);
  ctx.fillRect(5.5, -21, 3, 1.2);
  strokeLine(ctx, [-7, -21, 0, S.dropCrateHarnessY, 7, -21], C.canvasDark, 1.2);
  ctx.strokeStyle = C.steelRim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, S.dropCrateHarnessY, 1.5, 0, TAU);
  ctx.stroke();
  // Skid battens.
  ctx.fillStyle = C.crateDark;
  ctx.fillRect(-14, -1.2, 6, 2.6);
  ctx.fillRect(8, -1.2, 6, 2.6);
}

function paintParachute(ctx: Ctx): void {
  const rimY = -58;
  const half = 40;
  const gores = 6;
  // Shroud lines from every scallop point down to the harness.
  ctx.strokeStyle = rgba(C.ink, 0.7);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  for (let i = 0; i <= gores; i++) {
    ctx.moveTo(-half + (i * half * 2) / gores, rimY);
    ctx.lineTo(0, 0);
  }
  ctx.stroke();
  const canopy = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(-half, rimY);
    c.bezierCurveTo(-half - 2, rimY - 28, -20, -98, 0, -98);
    c.bezierCurveTo(20, -98, half + 2, rimY - 28, half, rimY);
    for (let i = gores - 1; i >= 0; i--) {
      const x1 = -half + (i * half * 2) / gores;
      const x0 = x1 + (half * 2) / gores;
      c.quadraticCurveTo((x0 + x1) / 2, rimY - 6.5, x1, rimY);
    }
    c.closePath();
  };
  rimmed(ctx, canopy, C.silk, '#e2ddc8', 0.3, 1.6);
  inside(ctx, canopy, () => {
    // Alternate gores sit in shade; seams run to the apex.
    for (let i = 0; i < gores; i++) {
      const x0 = -half + (i * half * 2) / gores;
      const x1 = x0 + (half * 2) / gores;
      if (i % 2 === 1) {
        ctx.fillStyle = rgba(C.silkDark, 0.55);
        ctx.beginPath();
        ctx.moveTo(x0, rimY);
        ctx.quadraticCurveTo(x0 * 0.72, -84, 0, -98);
        ctx.quadraticCurveTo(x1 * 0.72, -84, x1, rimY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.strokeStyle = rgba(C.earthDark, 0.35);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 1; i < gores; i++) {
      const x = -half + (i * half * 2) / gores;
      ctx.moveTo(x, rimY);
      ctx.quadraticCurveTo(x * 0.72, -84, 0, -98);
    }
    ctx.stroke();
    // Underside shadow toward the far edge.
    const g = ctx.createLinearGradient(-half, 0, half, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(-half - 4, -100, half * 2 + 8, 50);
  });
  // Vent at the apex.
  ctx.fillStyle = rgba(C.earthDark, 0.5);
  ellipse(ctx, 0, -96.6, 3.4, 1);
  ctx.fill();
  rr(ctx, -1.6, -2.4, 3.2, 3.2, 1);
  ctx.fillStyle = C.steel;
  ctx.fill();
}

export function supplySpecs(): SpriteSpec[] {
  return [
    makeSpec(SUPPLY_KEYS.dump, S.dumpBox, paintDump),
    makeSpec(SUPPLY_KEYS.crate, S.crateBox, paintCrate),
    makeSpec(SUPPLY_KEYS.dropCrate, S.dropCrateBox, paintDropCrate),
    makeSpec(SUPPLY_KEYS.parachute, S.parachuteBox, paintParachute),
  ];
}
