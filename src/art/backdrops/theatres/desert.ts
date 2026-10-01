/** Western Desert: escarpments, dunes, a heat-bleached sky, scrub and the odd wrecked truck. */
import { SCENES } from '../../../data/theatres';
import {
  TAU,
  fillBelow,
  fillPoly,
  line,
  noiseProfile,
  oval,
  pathBelow,
  rock,
  sineProfile,
  smoothstep,
  spread,
  strokeAlong,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type Profile,
} from '../kit';
import { range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.desert;

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  // The far jebel: long, low tablelands almost lost in the haze.
  const n1 = noiseProfile(rng, w, 5, 3, 0.45, false);
  const yBack: Profile = (x) => S.farMesaY - 8 - S.farMesaHeight * 0.7 * smoothstep((n1(x) - 0.38) * 3.4) - n1(x) * 5;
  fillBelow(ctx, w, yBack, bottom, vGrad(ctx, S.farMesaY - 50, bottom, sc.tone(P.far, haze + 0.14), sc.tone(P.far, haze + 0.3)));

  // The nearer escarpment: cap rock, banded cliffs and scree aprons.
  const n2 = noiseProfile(rng, w, 7, 3, 0.5, false);
  const plateau: Profile = (x) => smoothstep((n2(x) - 0.44) * 4.6);
  const yMesa: Profile = (x) => S.farMesaY + 8 - S.farMesaHeight * plateau(x) - n2(x) * 5;
  fillBelow(ctx, w, yMesa, bottom, vGrad(ctx, S.farMesaY - S.farMesaHeight, bottom, sc.tone(P.farAlt, haze - 0.06), sc.tone(P.farAlt, haze + 0.12)), 2);
  ctx.save();
  pathBelow(ctx, w, yMesa, bottom, 2);
  ctx.clip();
  ctx.fillStyle = sc.tone(P.far, haze - 0.1, 0.4);
  for (const k of [0.2, 0.42, 0.63, 0.82]) {
    ctx.fillRect(0, S.farMesaY + 8 - S.farMesaHeight * k, w, 2.2);
  }
  ctx.strokeStyle = sc.tone(P.stoneShade, haze - 0.05, 0.4);
  ctx.lineWidth = 4;
  strokeAlong(ctx, w, yMesa, 2, 2);
  // Shadowed gullies down the cliff face.
  ctx.strokeStyle = sc.tone(P.far, haze - 0.12, 0.35);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 70; i++) {
    const gx = range(rng, 4, w - 4);
    const top = yMesa(gx);
    const len = (S.farMesaY + 8 - top) * range(rng, 0.4, 0.75);
    if (len < 6) continue;
    line(ctx, gx, top + 3, gx + range(rng, -3, 3), top + len);
  }
  ctx.restore();
  const yScree: Profile = (x) => S.farMesaY + 12 - S.farMesaHeight * 0.36 * plateau(x) - n2(x) * 3;
  fillBelow(ctx, w, yScree, bottom, vGrad(ctx, S.farMesaY - 10, bottom, sc.tone(P.mid, haze + 0.02), sc.tone(P.mid, haze + 0.16)), 2);
};

/** A crescent dune: long windward slope toward the light, steep slip face in shadow. */
function dune(ctx: Ctx, cx: number, base: number, wl: number, wr: number, h: number, lit: string | CanvasGradient, shade: string, light: number): void {
  const lee = -light;
  const xw = cx - lee * wl;
  const xl = cx + lee * wr;
  const top = base - h;
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(xw, base + 1);
  ctx.bezierCurveTo(xw + lee * wl * 0.45, base - h * 0.08, cx - lee * wl * 0.35, top - h * 0.02, cx, top);
  ctx.bezierCurveTo(cx + lee * wr * 0.3, top + h * 0.4, cx + lee * wr * 0.6, base - h * 0.1, xl, base + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + lee * wr * 0.3, top + h * 0.4, cx + lee * wr * 0.6, base - h * 0.1, xl, base + 1);
  ctx.lineTo(cx - lee * wl * 0.16, base + 1);
  ctx.bezierCurveTo(cx - lee * wl * 0.02, base - h * 0.45, cx - lee * wl * 0.06, top + h * 0.3, cx, top);
  ctx.fill();
}

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  // The sand sea behind the dunes.
  const swell = sineProfile(rng, w, [2, 3, 5], 0.8);
  const plain: Profile = (x) => S.duneBaseY - 14 + swell(x) * 4;
  fillBelow(ctx, w, plain, bottom, vGrad(ctx, S.duneBaseY - 20, bottom, sc.tone(P.midAlt, haze + 0.12), sc.tone(P.mid, haze + 0.08)));

  // Rock outcrops breaking the sand.
  for (let i = 0; i < 5; i++) {
    const rx = rng() * w;
    const rw = range(rng, 34, 70);
    wrappedSeeded(w, rx, rw, rng, (cx, r) => {
      rock(ctx, r, cx, plain(cx) + 6, rw, rw * range(r, 0.22, 0.34), sc.tone(P.stone, haze + 0.06), sc.tone(P.stoneShade, haze + 0.06), sc.light);
    });
  }

  // Dunes, farthest first: each row a little lower, larger and less hazy.
  const xs = spread(rng, w, S.dunes, 0.9);
  const dunes = xs.map((x) => ({ x, depth: rng(), size: range(rng, 0.55, 1) }));
  dunes.sort((a, b) => a.depth - b.depth);
  for (const d of dunes) {
    const base = S.duneBaseY - 10 + d.depth * 16;
    const h = S.duneHeight * d.size * (0.7 + d.depth * 0.4);
    const wl = h * range(rng, 3.4, 4.6);
    const wr = h * range(rng, 1.3, 1.8);
    const hz = haze + 0.08 - d.depth * 0.1;
    wrapped(w, d.x, wl + wr, (cx) => {
      dune(ctx, cx, base, wl, wr, h, vGrad(ctx, base - h, base, sc.tone(P.mid, hz - 0.04), sc.tone(P.mid, hz + 0.06)), sc.tone(P.midAlt, hz), sc.light);
    });
  }

  // Sand in front of the dunes.
  const front: Profile = (x) => S.duneBaseY + 6 + swell(x + 300) * 2.5;
  fillBelow(ctx, w, front, bottom, vGrad(ctx, S.duneBaseY, bottom, sc.tone(P.mid, haze - 0.04), sc.tone(P.mid, haze + 0.06)));
};

/** Burnt-out lorry sunk in the sand. Origin = ground under the middle of the chassis; it faces `facing`. */
function truckWreck(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, haze: number, facing: number): void {
  const P = sc.pal;
  const body = sc.tone(P.metal, haze);
  const dark = sc.tone(P.metalShade, haze);
  const rust = sc.tone(P.roof, haze + 0.05);
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(facing, 1);
  ctx.rotate(-0.07);

  // Rear wheel half buried, front tyre burnt to the rim.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(-25, -6, 8.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(33, -7, 8.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(33, -7, 4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-25, -6, 4, 0, TAU);
  ctx.fill();

  // Chassis rail and cargo bed.
  ctx.fillStyle = dark;
  ctx.fillRect(-45, -17, 90, 4);
  ctx.fillStyle = body;
  ctx.fillRect(-46, -29, 53, 12);
  ctx.fillStyle = dark;
  ctx.fillRect(-46, -24.5, 53, 1);
  ctx.fillRect(-46, -20.5, 53, 1);
  // A dropped side board.
  fillPoly(ctx, [-30, -29, -17, -29, -13, -20, -26, -20], rust);

  // Bare canvas hoops and a sagging ridge pole.
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const hx of [-43, -29, -15, -1]) {
    ctx.beginPath();
    ctx.moveTo(hx, -29);
    ctx.lineTo(hx, -44);
    ctx.quadraticCurveTo(hx + 1, -48, hx + 5, -48);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-41, -48);
  ctx.quadraticCurveTo(-20, -43, 3, -47);
  ctx.stroke();

  // Cab with a gaping windscreen, and the bonnet.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(9, -17);
  ctx.lineTo(9, -40);
  ctx.quadraticCurveTo(9, -43, 12, -43);
  ctx.lineTo(25, -43);
  ctx.lineTo(28, -32);
  ctx.lineTo(28, -17);
  ctx.closePath();
  // Window hole, wound the other way so it stays open.
  ctx.moveTo(13, -39);
  ctx.lineTo(13, -31);
  ctx.lineTo(25, -31);
  ctx.lineTo(23, -39);
  ctx.closePath();
  ctx.fill('evenodd');
  fillPoly(ctx, [28, -17, 28, -32, 43, -29, 44, -17], body);
  ctx.fillStyle = dark;
  ctx.fillRect(42, -29, 2.4, 12);
  ctx.fillRect(17.5, -30, 1, 13);
  // Bonnet lid thrown open.
  ctx.strokeStyle = rust;
  ctx.lineWidth = 1.6;
  line(ctx, 29, -32, 40, -43);
  // Front mudguard.
  ctx.strokeStyle = body;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(33, -8, 11, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Rust blooms.
  ctx.fillStyle = rust;
  for (let i = 0; i < 5; i++) oval(ctx, range(rng, -42, 2), range(rng, -27, -19), range(rng, 1.5, 4), range(rng, 1, 2));
  ctx.restore();

  // Sand drifted against it.
  ctx.fillStyle = sc.tone(P.near, haze);
  oval(ctx, x - facing * 6, base + 2, 58, 6);
}

function scrubBush(ctx: Ctx, rng: Rng, x: number, base: number, s: number, lit: string, shade: string): void {
  const twigs = 9 + Math.floor(rng() * 5);
  ctx.lineCap = 'round';
  for (let i = 0; i < twigs; i++) {
    const a = -Math.PI / 2 + range(rng, -1.2, 1.2);
    const len = s * range(rng, 0.5, 1);
    ctx.strokeStyle = i % 2 === 0 ? shade : lit;
    ctx.lineWidth = Math.max(0.6, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, base - len * 0.6, x + Math.cos(a) * len * 1.1, base + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.fillStyle = lit;
  for (let i = 0; i < 5; i++) oval(ctx, x + range(rng, -0.7, 0.7) * s, base - range(rng, 0.35, 0.8) * s, s * 0.22, s * 0.14);
}

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const swell = sineProfile(rng, w, [2, 3, 5, 9], 0.8);
  const y: Profile = (x) => S.nearSwellY + swell(x) * S.nearSwellAmp;

  // A rocky ledge runs behind the nearest swell.
  const ledgeNoise = noiseProfile(rng, w, 9, 3, 0.5, true);
  const ledge: Profile = (x) => S.nearSwellY - 3 - Math.max(0, ledgeNoise(x) - 0.5) * 46;
  fillBelow(ctx, w, ledge, bottom, vGrad(ctx, S.nearSwellY - 24, S.nearSwellY + 6, sc.tone(P.stone, haze + 0.08), sc.tone(P.stoneShade, haze + 0.08)), 2);
  ctx.save();
  pathBelow(ctx, w, ledge, bottom, 2);
  ctx.clip();
  ctx.fillStyle = sc.tone(P.stoneShade, haze, 0.45);
  for (const dy of [5, 11, 17]) ctx.fillRect(0, S.nearSwellY - 3 - dy, w, 1.6);
  ctx.restore();

  const wreckXs = spread(rng, w, S.wrecks, 0.4);
  for (const wx of wreckXs) {
    const tx = Math.min(w - 90, Math.max(90, wx));
    truckWreck(ctx, sc, rng, tx, y(tx) + 3, haze, rng() < 0.5 ? -1 : 1);
    // Abandoned fuel drums.
    for (let k = 0; k < 3; k++) {
      const dx = tx + 74 + k * 9 + range(rng, -2, 2);
      const lying = k === 2;
      ctx.fillStyle = sc.tone(P.metal, haze + 0.04);
      if (lying) ctx.fillRect(dx, y(dx) - 4, 10, 6.5);
      else ctx.fillRect(dx, y(dx) - 9, 6.5, 11);
      ctx.fillStyle = sc.tone(P.metalShade, haze + 0.04);
      if (lying) ctx.fillRect(dx + 3, y(dx) - 4, 1, 6.5);
      else ctx.fillRect(dx, y(dx) - 5.5, 6.5, 1);
    }
  }

  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.nearSwellY - S.nearSwellAmp, bottom, sc.tone(P.near, haze), sc.tone(P.ground, 0.22)));
  // Wind ripples across the swell.
  ctx.strokeStyle = sc.tone(P.nearAlt, haze, 0.3);
  ctx.lineWidth = 0.9;
  for (const dy of [5, 10, 16]) strokeAlong(ctx, w, (x) => y(x) + swell(x * 2 + dy * 31) * 1.5, dy);

  for (let i = 0; i < S.rocks; i++) {
    const rx = rng() * w;
    const rw = range(rng, 10, 26);
    wrappedSeeded(w, rx, rw, rng, (cx, r) => {
      rock(ctx, r, cx, y(cx) + 3, rw, rw * range(r, 0.4, 0.6), sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze), sc.light);
    });
  }
  for (let i = 0; i < S.scrub; i++) {
    const sx = rng() * w;
    const s = range(rng, 7, 13);
    wrappedSeeded(w, sx, s * 1.5, rng, (cx, r) => {
      scrubBush(ctx, r, cx, y(cx) + 2.5, s, sc.tone(P.foliage, haze), sc.tone(P.foliageShade, haze));
    });
  }
};

export const desert: TheatreArt = { far, mid, near };
