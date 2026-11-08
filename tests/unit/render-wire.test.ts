import { describe, expect, it } from 'vitest';
import { createWirePieces, wirePieceLayout, wireSpecs, WIRE_KEYS } from '../../src/art/structures';
import { WIRE_LAYOUT as W } from '../../src/data/artLayout';
import { MISSIONS } from '../../src/data/missions';
import { VIEW } from '../../src/data/view';
import { WireWreck, inStandingWire, pieceLag, wireStruggle, type WireLike } from '../../src/render/wireRules';

const FIG = VIEW.figureHeight;

describe('wire piece layout (end-on pieces inside a belt of any width)', () => {
  const widths = [0, 5, 20, W.pieceW - 1, W.pieceW, 60, 100, 110, 117, 118, 120, 160, 180, 200, 220, 260, 400, 1000, Number.NaN];
  for (const m of MISSIONS) for (const w of m.wire) widths.push(w.width);

  it('puts one to a few pieces, centred on the belt and wholly inside its width', () => {
    const p = createWirePieces();
    for (const width of widths) {
      wirePieceLayout(width, p);
      expect(p.count, `${width}`).toBeGreaterThanOrEqual(1);
      expect(p.count, `${width}`).toBeLessThanOrEqual(W.maxPieces);
      let sum = 0;
      for (let i = 0; i < p.count; i++) {
        sum += p.x[i];
        if (width > 0) expect(Math.abs(p.x[i]) + (W.pieceW * p.scaleX) / 2, `${width} piece ${i}`).toBeLessThanOrEqual(width / 2 + 1e-9);
        if (i > 0) expect(p.x[i] - p.x[i - 1]).toBeCloseTo(W.pitch, 9);
      }
      expect(Math.abs(sum), `${width} centred`).toBeLessThan(1e-9);
      expect(Number.isFinite(p.scaleX) && p.scaleX >= 0 && p.scaleX <= 1).toBe(true);
    }
  });

  it('adds pieces as the belt widens and draws every mission belt at full size', () => {
    const p = createWirePieces();
    let last = 0;
    for (let w = 0; w <= 600; w += 5) {
      const n = wirePieceLayout(w, p).count;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(last).toBe(W.maxPieces);
    for (const m of MISSIONS) {
      for (const w of m.wire) expect(wirePieceLayout(w.width, p).scaleX, `${m.id} wire ${w.id}`).toBe(1);
    }
  });

  it('keeps each piece an end-on cross-section: narrow, taller than wide, waist to chest high, apart from its neighbours', () => {
    // Taller than wide, and narrow next to a soldier.
    expect(W.postH).toBeGreaterThan(W.pieceW);
    expect(W.pieceW).toBeLessThan(FIG * 0.75);
    // Waist (about half a figure) to chest (about three quarters) high, coil top included.
    expect(W.postH).toBeGreaterThanOrEqual(FIG * 0.5);
    expect(W.postH).toBeLessThanOrEqual(FIG * 0.8);
    expect(-(W.coilY - W.coilR)).toBeGreaterThanOrEqual(FIG * 0.45);
    expect(-(W.coilY - W.coilR)).toBeLessThanOrEqual(W.postH);
    // The coil and the picket legs fit the piece's footprint.
    expect(2 * W.legHalf).toBeLessThanOrEqual(W.pieceW);
    expect(2 * W.coilR).toBeLessThanOrEqual(W.pieceW);
    // Separate cross-sections, never a strip: the gap between two pieces is at least a piece wide.
    expect(W.pitch - W.pieceW).toBeGreaterThanOrEqual(W.pieceW);
    // Both halves share one box (they stack exactly), standing on the ground line; the debris lies low.
    expect(W.backBox).toEqual(W.frontBox);
    expect(W.frontBox.oy).toBeGreaterThanOrEqual(W.postH);
    expect(W.frontBox.w).toBeLessThan(W.frontBox.h);
    expect(W.crushedBox.oy).toBeLessThan(W.postH / 2);
    expect(W.cutBox.oy).toBeLessThan(W.postH / 2);
    const keys = wireSpecs().map((s) => s.key);
    expect(keys.sort()).toEqual(Object.values(WIRE_KEYS).sort());
  });
});

describe('wire struggle flag (view only, mirrors the sim slow)', () => {
  const wires: WireLike[] = [
    { x: 1000, width: 100, owner: 1, alive: true },
    { x: 2000, width: 160, owner: 0, alive: true },
    { x: 3000, width: 120, owner: 1, alive: false },
  ];

  it('is set only inside a standing belt of the other side, edges included', () => {
    expect(wireStruggle(wires, 0, 1000)).toBe(true);
    expect(wireStruggle(wires, 0, 950)).toBe(true);
    expect(wireStruggle(wires, 0, 1050)).toBe(true);
    expect(wireStruggle(wires, 0, 949.9)).toBe(false);
    expect(wireStruggle(wires, 0, 1050.1)).toBe(false);
    // The side that laid it knows the gaps.
    expect(wireStruggle(wires, 1, 1000)).toBe(false);
    expect(wireStruggle(wires, 0, 2000)).toBe(false);
    expect(wireStruggle(wires, 1, 2000)).toBe(true);
    // Crushed or blown wire slows nobody.
    expect(wireStruggle(wires, 0, 3000)).toBe(false);
    expect(wireStruggle([], 0, 1000)).toBe(false);
  });

  it('draws anyone inside a standing belt on its feet line, whoever owns it', () => {
    expect(inStandingWire(wires, 1000)).toBe(true);
    expect(inStandingWire(wires, 2070)).toBe(true);
    expect(inStandingWire(wires, 3000)).toBe(false);
    expect(inStandingWire(wires, 1500)).toBe(false);
    // The squeezed rows keep their order and stay behind the coil's own ground line.
    for (const dy of VIEW.rowDy) expect(W.feetDy + dy * W.rowSpread).toBeLessThanOrEqual(W.dy);
  });
});

describe('wire destroyed: crushed by a tank, or blown apart', () => {
  it('stands until destroyed', () => {
    const w = new WireWreck();
    w.step(1);
    expect(w.look).toBe('standing');
    expect(w.fold()).toBe(0);
    expect(w.standingShown()).toBe(true);
    expect(w.standingScaleY()).toBe(1);
    expect(w.lean()).toBe(0);
    expect(w.debris()).toBe('');
    expect(w.debrisAlpha()).toBe(0);
  });

  it('folds the coil flat the way the tank drives, then leaves a flattened tangle on the ground', () => {
    for (const dir of [1, -1]) {
      const w = new WireWreck();
      w.destroy(null, dir);
      expect(w.look).toBe('collapsing');
      let last = 0;
      let sawBoth = false;
      for (let t = 0; t < W.collapseTime + 0.2; t += 1 / 60) {
        w.step(1 / 60);
        const f = w.fold();
        expect(f).toBeGreaterThanOrEqual(last);
        last = f;
        expect(Math.sign(w.lean()) * dir).toBeGreaterThanOrEqual(0);
        expect(w.standingScaleY()).toBeGreaterThanOrEqual(W.collapseFlat - 1e-9);
        expect(w.standingAlpha()).toBeGreaterThanOrEqual(0);
        if (w.standingShown() && w.debris() === 'crushed') sawBoth = true;
      }
      // The tangle fades in while the coil goes down: never a frame with nothing there.
      expect(sawBoth).toBe(true);
      expect(w.look).toBe('crushed');
      expect(w.standingShown()).toBe(false);
      expect(w.debris()).toBe('crushed');
      expect(w.debrisAlpha()).toBe(1);
      // A later event changes nothing.
      w.destroy('explosive', 1);
      expect(w.debris()).toBe('crushed');
    }
  });

  it('crushes the pieces of a wide belt one after another as the tank reaches them', () => {
    const p = wirePieceLayout(260, createWirePieces());
    expect(p.count).toBe(3);
    const lags = [0, 1, 2].map((i) => pieceLag(p.x[i], p.count, 1));
    expect(lags[0]).toBe(0);
    expect(lags[1]).toBeCloseTo(W.collapseStagger, 9);
    expect(lags[2]).toBeCloseTo(2 * W.collapseStagger, 9);
    const back = [0, 1, 2].map((i) => pieceLag(p.x[i], p.count, -1));
    expect(back).toEqual([lags[2], lags[1], lags[0]]);
    const w = new WireWreck();
    w.destroy(null, 1, lags[2]);
    w.step(W.collapseTime + 0.01);
    expect(w.debris(lags[0])).toBe('crushed');
    expect(w.standingShown(lags[2])).toBe(true);
    expect(w.look).toBe('collapsing');
    w.step(lags[2]);
    expect(w.look).toBe('crushed');
    expect(w.standingShown(lags[2])).toBe(false);
  });

  it('shows blown debris at once when a shell cuts it', () => {
    const w = new WireWreck();
    w.destroy('explosive', 1);
    expect(w.look).toBe('cut');
    expect(w.standingShown()).toBe(false);
    expect(w.debris()).toBe('cut');
    expect(w.debrisAlpha()).toBe(1);
    w.step(Number.NaN);
    w.step(-1);
    expect(w.debris()).toBe('cut');
    w.reset();
    expect(w.look).toBe('standing');
  });
});
