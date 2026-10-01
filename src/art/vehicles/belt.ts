/**
 * Geometry of a tank track: a belt wrapped round a convex loop of pulleys.
 * Pure maths (no canvas state is needed to build it), used to draw the track
 * band and to space the tread lugs evenly round the loop.
 */
export interface BeltPulley {
  x: number;
  y: number;
  r: number;
}

interface BeltArc {
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
}

interface BeltLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Belt {
  /** Alternating: arc round pulley i, then the straight run to pulley i + 1. */
  arcs: BeltArc[];
  lines: BeltLine[];
  /** Arc lengths and line lengths in order arc0, line0, arc1, line1, ... */
  lengths: number[];
  length: number;
}

export interface BeltPoint {
  x: number;
  y: number;
  /** Unit outward normal. */
  nx: number;
  ny: number;
}

const TAU = Math.PI * 2;

/**
 * Build the belt round `pulleys`, listed clockwise on screen (y down). `grow`
 * is added to every radius: use half the track thickness for the centre line.
 */
export function makeBelt(pulleys: readonly BeltPulley[], grow: number): Belt {
  const n = pulleys.length;
  // Outward normal of the tangent run leaving each pulley.
  const mx: number[] = [];
  const my: number[] = [];
  const lines: BeltLine[] = [];
  for (let i = 0; i < n; i++) {
    const a = pulleys[i];
    const b = pulleys[(i + 1) % n];
    const ra = a.r + grow;
    const rb = b.r + grow;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / dist;
    const dy = (b.y - a.y) / dist;
    const sin = (ra - rb) / dist;
    const cos = Math.sqrt(Math.max(0, 1 - sin * sin));
    // Clockwise travel on screen: the outside is to the left of the direction of travel.
    const nx = dy;
    const ny = -dx;
    const ux = cos * nx + sin * dx;
    const uy = cos * ny + sin * dy;
    mx.push(ux);
    my.push(uy);
    lines.push({ x0: a.x + ra * ux, y0: a.y + ra * uy, x1: b.x + rb * ux, y1: b.y + rb * uy });
  }
  const arcs: BeltArc[] = [];
  const lengths: number[] = [];
  let length = 0;
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n;
    const p = pulleys[i];
    const r = p.r + grow;
    const a0 = Math.atan2(my[prev], mx[prev]);
    let a1 = Math.atan2(my[i], mx[i]);
    while (a1 < a0) a1 += TAU;
    arcs.push({ cx: p.x, cy: p.y, r, a0, a1 });
    const arcLen = r * (a1 - a0);
    const line = lines[i];
    const lineLen = Math.hypot(line.x1 - line.x0, line.y1 - line.y0);
    lengths.push(arcLen, lineLen);
    length += arcLen + lineLen;
  }
  return { arcs, lines, lengths, length };
}

/** Trace the closed belt path on a canvas context. */
export function beltPath(ctx: CanvasRenderingContext2D, belt: Belt): void {
  ctx.beginPath();
  for (let i = 0; i < belt.arcs.length; i++) {
    const arc = belt.arcs[i];
    ctx.arc(arc.cx, arc.cy, arc.r, arc.a0, arc.a1);
    ctx.lineTo(belt.lines[i].x1, belt.lines[i].y1);
  }
  ctx.closePath();
}

/** Point and outward normal at arc length s (wraps round the loop). s grows clockwise: forward along the top run. */
export function beltPoint(belt: Belt, s: number, out: BeltPoint): BeltPoint {
  let rest = s % belt.length;
  if (rest < 0) rest += belt.length;
  const n = belt.arcs.length;
  for (let i = 0; i < n; i++) {
    const arcLen = belt.lengths[i * 2];
    const arc = belt.arcs[i];
    if (rest <= arcLen) {
      const a = arc.a0 + rest / arc.r;
      out.nx = Math.cos(a);
      out.ny = Math.sin(a);
      out.x = arc.cx + arc.r * out.nx;
      out.y = arc.cy + arc.r * out.ny;
      return out;
    }
    rest -= arcLen;
    const lineLen = belt.lengths[i * 2 + 1];
    const line = belt.lines[i];
    if (rest <= lineLen || i === n - 1) {
      const u = lineLen > 0 ? Math.min(1, rest / lineLen) : 0;
      out.x = line.x0 + (line.x1 - line.x0) * u;
      out.y = line.y0 + (line.y1 - line.y0) * u;
      const dx = (line.x1 - line.x0) / (lineLen || 1);
      const dy = (line.y1 - line.y0) / (lineLen || 1);
      out.nx = dy;
      out.ny = -dx;
      return out;
    }
    rest -= lineLen;
  }
  return out;
}
