import { describe, expect, it } from 'vitest';
import { PLANE_LAYOUT, TANK_LAYOUT, VEHICLE_LOOKS } from '../../src/data/artLayout';
import { RENDER } from '../../src/data/render';
import { SPEECH } from '../../src/data/speech';
import { apcHopLift } from '../../src/render/apcHop';
import { showAlpha, speechLine, speechOrder } from '../../src/render/effects/callinMath';
import { planeAltitude, planePassTime, planePassX } from '../../src/render/effects/callinMath';
import { speechHeight, speechWidth } from '../../src/render/sprites';

describe('commander speech lines', () => {
  it('picks SPEECH[faction][order][seed % n] and wraps any seed', () => {
    for (const f of ['british', 'german'] as const) {
      for (const o of ['fallBack', 'hold', 'advance'] as const) {
        const lines = SPEECH[f][o];
        for (let s = 0; s < lines.length * 3; s++) expect(speechLine(f, o, s).text).toBe(lines[s % lines.length]);
        expect(speechLine(f, o, -3).index).toBeGreaterThanOrEqual(0);
        expect(speechLine(f, o, Number.NaN).index).toBe(0);
      }
    }
  });
  it('maps the contract order numbers', () => {
    expect(speechOrder(0)).toBe('fallBack');
    expect(speechOrder(1)).toBe('hold');
    expect(speechOrder(2)).toBe('advance');
    expect(speechOrder('hold')).toBe('hold');
  });
  it('every bubble is a sensible phone-sized width', () => {
    for (const f of ['british', 'german'] as const) {
      for (const o of ['fallBack', 'hold', 'advance'] as const) for (const l of SPEECH[f][o]) expect(speechWidth(l)).toBeLessThan(320);
    }
    expect(speechHeight()).toBeGreaterThan(RENDER.speech.font);
  });
});

describe('speech bubble fades', () => {
  it('fades in, holds and fades out, then is gone', () => {
    const B = RENDER.speech;
    expect(showAlpha(0, B.time, B.pop, B.fade)).toBe(0);
    expect(showAlpha(B.time / 2, B.time, B.pop, B.fade)).toBe(1);
    expect(showAlpha(B.time - B.fade / 2, B.time, B.pop, B.fade)).toBeCloseTo(0.5);
    expect(showAlpha(B.time, B.time, B.pop, B.fade)).toBe(0);
    expect(showAlpha(-1, B.time, B.pop, B.fade)).toBe(0);
  });
});

describe('plane passes', () => {
  it('interpolates linearly from start to end over the pass time', () => {
    expect(planePassX(100, 900, 4, 0)).toBe(100);
    expect(planePassX(100, 900, 4, 2)).toBe(500);
    expect(planePassX(100, 900, 4, 4)).toBe(900);
    expect(planePassX(900, 100, 4, 1)).toBe(700);
  });
  it('uses the event time, else the type speed', () => {
    expect(planePassTime('bomber', 0, 1000, 5)).toBe(5);
    expect(planePassTime('fighter', 0, 760, 0)).toBeCloseTo(760 / (RENDER.planes.speed.fighter ?? 1));
  });
  it('flies higher on higher rows and stays inside the view', () => {
    for (const k of ['bomber', 'fighter', 'recon'] as const) {
      expect(planeAltitude(k, 1)).toBeGreaterThan(planeAltitude(k, 0));
      expect(planeAltitude(k, 2) + PLANE_LAYOUT[k].box.oy).toBeLessThan(540);
    }
  });
});

describe('APC unload hop', () => {
  it('waits on the deck, hops and lands on the ground', () => {
    expect(apcHopLift(-0.1, 30)).toBe(30);
    expect(apcHopLift(0, 30)).toBe(30);
    expect(apcHopLift(RENDER.apc.hopTime, 30)).toBe(0);
    expect(apcHopLift(RENDER.apc.hopTime * 0.5, 30)).toBeGreaterThan(0);
  });
});

describe('vehicle layouts', () => {
  it('the Panzer III is clearly smaller than the Panzer IV', () => {
    expect(TANK_LAYOUT.panzer3.length).toBeLessThan(TANK_LAYOUT.panzer4.length * 0.9);
    expect(TANK_LAYOUT.panzer3.height).toBeLessThan(TANK_LAYOUT.panzer4.height);
    expect(TANK_LAYOUT.panzer3.barrelLength).toBeLessThan(TANK_LAYOUT.panzer4.barrelLength);
  });
  it('anchors sit inside each sprite box and APCs carry passengers', () => {
    for (const look of VEHICLE_LOOKS) {
      const L = TANK_LAYOUT[look];
      for (const b of [L.trackBox, L.hullBox, L.turretBox, L.barrelBox, L.huskBox]) {
        expect(b.ox).toBeGreaterThanOrEqual(0);
        expect(b.ox).toBeLessThanOrEqual(b.w);
        expect(b.oy).toBeGreaterThanOrEqual(0);
        expect(b.oy).toBeLessThanOrEqual(b.h);
      }
      for (const w of L.wheels) expect(Math.abs(w.x)).toBeLessThan(L.trackBox.w);
    }
    expect(TANK_LAYOUT.carrier.passengers).toBeDefined();
    expect(TANK_LAYOUT.halftrack.passengers).toBeDefined();
  });
});
