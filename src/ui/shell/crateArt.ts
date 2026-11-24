/**
 * The supply crate, drawn in code: a semi-dark olive wooden weapons crate with stencilled markings (generic shapes,
 * no lettering), metal corner brackets and a padlock on the front. The Shop's cards show it shut; the opening draws it
 * every frame with its padlock shaking, torn off and gone, and its lid thrown open.
 *
 * Other crate types are the same crate with their wood in their own tint (src/data/crates.ts), until they get looks
 * of their own. Nothing here is drawn before the Shop's crate section or an opening first needs it.
 */

/** The Standard Crate's own wood. */
const OLIVE = '#4c5631';

export interface CratePose {
  /** 0 = shut, 1 = thrown open. */
  lid: number;
  /** The padlock: its swing in radians, how far it has flown from the hasp (in crate widths) and its spin; `gone` = not drawn. */
  lockSwing: number;
  lockFlyX: number;
  lockFlyY: number;
  lockSpin: number;
  lockGone: boolean;
  /** A sideways wobble of the whole crate, in crate widths. */
  wobble: number;
}

export const CRATE_SHUT: CratePose = { lid: 0, lockSwing: 0, lockFlyX: 0, lockFlyY: 0, lockSpin: 0, lockGone: false, wobble: 0 };

function shade(hex: string, k: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (v: number): number => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${mix(c[0])},${mix(c[1])},${mix(c[2])})`;
}

function bracket(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number, u: number): void {
  // An L of dark steel hugging a corner, with two rivets.
  ctx.fillStyle = '#2b2d2a';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + sx * 9 * u, y);
  ctx.lineTo(x + sx * 9 * u, y + sy * 3 * u);
  ctx.lineTo(x + sx * 3 * u, y + sy * 3 * u);
  ctx.lineTo(x + sx * 3 * u, y + sy * 9 * u);
  ctx.lineTo(x, y + sy * 9 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8b8f86';
  for (const [dx, dy] of [
    [6.5, 1.5],
    [1.5, 6.5],
  ]) {
    ctx.beginPath();
    ctx.arc(x + sx * dx * u, y + sy * dy * u, 0.7 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw the crate with its base centred at (cx, baseY), `width` wide (its body is 0.62 of that tall). Returns nothing;
 * leaves the context as it found it.
 */
export function drawCrate(ctx: CanvasRenderingContext2D, cx: number, baseY: number, width: number, tint: string | null, pose: CratePose = CRATE_SHUT): void {
  const wood = tint ?? OLIVE;
  const u = width / 100;
  const w = width;
  const h = width * 0.62;
  const lidH = 9 * u;
  ctx.save();
  ctx.translate(cx + pose.wobble * w, baseY);
  const x0 = -w / 2;
  const y0 = -h;

  // The lid thrown open, seen from the front: it stands up behind the crate on its back hinges, its underside toward
  // us, and the dark of the inside shows where it lay.
  if (pose.lid > 0.02) {
    const up = pose.lid * h * 0.56;
    ctx.fillStyle = shade(wood, -0.34);
    ctx.fillRect(x0 + 1 * u, y0 + lidH - up, w - 2 * u, up);
    ctx.fillStyle = shade(wood, -0.48);
    ctx.fillRect(x0 + 14 * u, y0 + lidH - up, 6 * u, up);
    ctx.fillRect(x0 + w - 20 * u, y0 + lidH - up, 6 * u, up);
    ctx.fillStyle = shade(wood, 0.1);
    ctx.fillRect(x0 - 1 * u, y0 + lidH - up - 2.5 * u, w + 2 * u, 2.5 * u);
    ctx.fillStyle = '#12120b';
    ctx.fillRect(x0 + 2 * u, y0 + 3 * u, w - 4 * u, lidH - 3 * u);
  }

  // Body: three planks, the middle one a touch lighter, with their seams and a little grain.
  for (let i = 0; i < 3; i++) {
    const py = y0 + lidH + (i * (h - lidH)) / 3;
    ctx.fillStyle = shade(wood, i === 1 ? 0.07 : i === 2 ? -0.12 : -0.03);
    ctx.fillRect(x0, py, w, (h - lidH) / 3 + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x0, py + (h - lidH) / 3 - 0.6 * u, w, 0.9 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let g = 0; g < 4; g++) ctx.fillRect(x0 + (8 + g * 23 + i * 5) * u, py + (3 + ((g * 7 + i * 3) % 6)) * u, 13 * u, 0.5 * u);
  }
  // Two upright battens.
  ctx.fillStyle = shade(wood, -0.2);
  ctx.fillRect(x0 + 13 * u, y0 + lidH, 7 * u, h - lidH);
  ctx.fillRect(x0 + w - 20 * u, y0 + lidH, 7 * u, h - lidH);

  // Stencilled markings: generic shapes only (bars, a broken frame, an arrow), never lettering.
  ctx.fillStyle = 'rgba(232,226,198,0.82)';
  const my = y0 + lidH + 7 * u;
  for (const [bx, bw] of [
    [26, 5],
    [33, 9],
    [44, 3],
  ]) ctx.fillRect(x0 + bx * u, my, bw * u, 5 * u);
  ctx.fillRect(x0 + 26 * u, my + 8 * u, 21 * u, 1.6 * u);
  // An upward arrow in a broken frame.
  const ax = x0 + 66 * u;
  const ay = y0 + lidH + 5 * u;
  ctx.fillRect(ax, ay, 4 * u, 1.3 * u);
  ctx.fillRect(ax + 8 * u, ay, 4 * u, 1.3 * u);
  ctx.fillRect(ax, ay + 15 * u, 4 * u, 1.3 * u);
  ctx.fillRect(ax + 8 * u, ay + 15 * u, 4 * u, 1.3 * u);
  ctx.fillRect(ax, ay, 1.3 * u, 4 * u);
  ctx.fillRect(ax + 10.7 * u, ay, 1.3 * u, 4 * u);
  ctx.fillRect(ax, ay + 12.3 * u, 1.3 * u, 4 * u);
  ctx.fillRect(ax + 10.7 * u, ay + 12.3 * u, 1.3 * u, 4 * u);
  ctx.beginPath();
  ctx.moveTo(ax + 6 * u, ay + 3 * u);
  ctx.lineTo(ax + 9.5 * u, ay + 7.5 * u);
  ctx.lineTo(ax + 7.2 * u, ay + 7.5 * u);
  ctx.lineTo(ax + 7.2 * u, ay + 13 * u);
  ctx.lineTo(ax + 4.8 * u, ay + 13 * u);
  ctx.lineTo(ax + 4.8 * u, ay + 7.5 * u);
  ctx.lineTo(ax + 2.5 * u, ay + 7.5 * u);
  ctx.closePath();
  ctx.fill();

  // Metal corner brackets on the body.
  bracket(ctx, x0, y0 + lidH, 1, 1, u);
  bracket(ctx, x0 + w, y0 + lidH, -1, 1, u);
  bracket(ctx, x0, 0, 1, -1, u);
  bracket(ctx, x0 + w, 0, -1, -1, u);

  // The hasp on the front, under the lid's edge.
  const hx = 0;
  const hy = y0 + lidH + 2 * u;
  ctx.fillStyle = '#2b2d2a';
  ctx.fillRect(hx - 4 * u, hy - 3 * u, 8 * u, 9 * u);
  ctx.fillStyle = '#6f736b';
  ctx.fillRect(hx - 2.2 * u, hy + 1 * u, 4.4 * u, 3 * u);

  // The lid shut: a slab a little wider than the body, lying on top of it (open, it is the upright board drawn first).
  if (pose.lid <= 0.02) {
    ctx.save();
    ctx.translate(x0 - 2 * u, y0 + lidH);
    ctx.fillStyle = shade(wood, 0.1);
    ctx.fillRect(0, -lidH, w + 4 * u, lidH);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, -1 * u, w + 4 * u, 1 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, -lidH, w + 4 * u, 1 * u);
    bracket(ctx, 0, -lidH, 1, 1, u * 0.8);
    bracket(ctx, w + 4 * u, -lidH, -1, 1, u * 0.8);
    ctx.restore();
  }

  // The padlock, hanging from the hasp (or flying off it).
  if (!pose.lockGone) {
    ctx.save();
    ctx.translate(hx + pose.lockFlyX * w, hy + 3 * u + pose.lockFlyY * w);
    ctx.rotate(pose.lockSwing + pose.lockSpin);
    // Shackle.
    ctx.strokeStyle = '#b9bdb4';
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.arc(0, 4 * u, 3.4 * u, Math.PI, 0);
    ctx.stroke();
    // Body.
    ctx.fillStyle = '#b08a3a';
    ctx.fillRect(-5.5 * u, 4 * u, 11 * u, 9.5 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-5.5 * u, 4 * u, 11 * u, 1.4 * u);
    ctx.fillStyle = '#2a2210';
    ctx.beginPath();
    ctx.arc(0, 8 * u, 1.4 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-0.6 * u, 8 * u, 1.2 * u, 3.2 * u);
    ctx.restore();
  }
  ctx.restore();
}

/** The shut crate filling a small canvas (a Shop card's picture). */
export function paintCrateIcon(canvas: HTMLCanvasElement, tint: string | null): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const width = Math.min(canvas.width * 0.9, (canvas.height * 0.9) / 0.72);
  drawCrate(ctx, canvas.width / 2, canvas.height * 0.93, width, tint);
}
