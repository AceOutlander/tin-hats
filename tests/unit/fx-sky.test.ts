/**
 * The view's side of scripted weather and time of day (src/fx/sky.ts, src/render/weather/sky.ts helpers, the
 * backdrop's second theatre and winter variants): crossfade weights and veils, the land tint, drifting fields, which
 * weathers and times a mission passes through, and the Soviet theatres' winter looks.
 */
import { describe, expect, it } from 'vitest';
import { getBackdrop, getTheatreColours, theatreKey } from '../../src/art/backdrops';
import { variantDef } from '../../src/art/backdrops/scene';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
import { THEATRES, THEATRE_IDS, TIME_GRADES, theatreVariant } from '../../src/data/theatres';
import { WEATHER_KINDS, WEATHER_LOOKS } from '../../src/data/weather';
import {
  DriftField,
  SECOND_BLEND,
  brightestTime,
  createRng,
  landTint,
  missionTimes,
  missionWeathers,
  mixVeil,
  nightTintAlpha,
  rgbInt,
  secondWeight,
  weatherVeils,
  weatherWeight,
  type Veil,
} from '../../src/fx';

const veil = (): Veil => ({ color: { r: 0, g: 0, b: 0 }, alpha: 0 });

describe('weather crossfade', () => {
  it('weights the two weathers by the progress, and a settled weather fully', () => {
    expect(weatherWeight('fog', 'fog', 'fog', 0.3)).toBe(1);
    expect(weatherWeight('snow', 'fog', 'fog', 0.3)).toBe(0);
    expect(weatherWeight('fog', 'fog', 'clear', 0.25)).toBeCloseTo(0.75, 9);
    expect(weatherWeight('clear', 'fog', 'clear', 0.25)).toBeCloseTo(0.25, 9);
    expect(weatherWeight('snow', 'fog', 'clear', 0.25)).toBe(0);
  });

  it('mixes the veils: one weather alone gives its own, and the mix runs between them', () => {
    for (const k of WEATHER_KINDS) {
      const sky = veil();
      const scene = veil();
      weatherVeils(k, k, 0.5, sky, scene);
      expect(sky.alpha).toBeCloseTo(WEATHER_LOOKS[k].skyAlpha, 9);
      expect(scene.alpha).toBeCloseTo(WEATHER_LOOKS[k].sceneAlpha, 9);
    }
    const a = veil();
    const b = veil();
    weatherVeils('clear', 'fog', 0, a, b);
    expect(a.alpha).toBe(0);
    weatherVeils('clear', 'fog', 1, a, b);
    expect(a.alpha).toBeCloseTo(WEATHER_LOOKS.fog.skyAlpha, 9);
    weatherVeils('clear', 'fog', 0.5, a, b);
    expect(a.alpha).toBeGreaterThan(0);
    expect(a.alpha).toBeLessThan(WEATHER_LOOKS.fog.skyAlpha);
    const out = veil();
    mixVeil({ color: { r: 1, g: 0, b: 0 }, alpha: 0.5 }, 1, { color: { r: 0, g: 0, b: 1 }, alpha: 0.5 }, 1, out);
    expect(out.alpha).toBeCloseTo(0.75, 9);
    expect(out.color.r).toBeCloseTo(0.5, 9);
    expect(out.color.b).toBeCloseTo(0.5, 9);
  });
});

describe('time of day', () => {
  it('paints the land in the brightest time and tints it darker for the others', () => {
    expect(brightestTime(['night', 'dawn', 'day'])).toBe('day');
    expect(brightestTime(['night', 'dusk'])).toBe('dusk');
    expect(brightestTime(['night'])).toBe('night');
    const t = { r: 0, g: 0, b: 0 };
    expect(rgbInt(landTint('day', 'day', 'day', 0, t))).toBe(0xffffff);
    landTint('day', 'day', 'night', 1, t);
    expect([t.r, t.g, t.b]).toEqual([...TIME_GRADES.night.mul]);
    landTint('day', 'day', 'night', 0.5, t);
    expect(t.r).toBeCloseTo((1 + TIME_GRADES.night.mul[0]) / 2, 9);
    // Never brighter than as painted.
    landTint('night', 'night', 'day', 1, t);
    expect(Math.max(t.r, t.g, t.b)).toBeLessThanOrEqual(1);
    expect(nightTintAlpha('day', 'night', 0.5)).toBeCloseTo(TIME_GRADES.night.tintAlpha / 2, 9);
  });

  it('lists the times and weathers a mission passes through', () => {
    const byId = (id: number): MissionDef => MISSIONS.find((m) => m.id === id)!;
    expect(missionTimes(byId(1004))).toEqual(['night', 'dawn', 'day']);
    expect(missionTimes(byId(1007))).toEqual(['night', 'day']);
    expect(missionTimes(byId(1006))).toEqual(['overcast']);
    expect(missionWeathers(byId(1009)).sort()).toEqual(['blizzard', 'clear', 'fog']);
    expect(missionWeathers(byId(1006))).toEqual(['smoke']);
  });
});

describe('drifting fields', () => {
  it('fill the width, stay in their band and wrap, the same from the same seed', () => {
    const look = WEATHER_LOOKS.blizzard.fields[0];
    const a = new DriftField(createRng(4), 1200, look);
    const b = new DriftField(createRng(4), 1200, look);
    expect(a.count).toBeGreaterThan(look.perScreen);
    for (let n = 0; n < 200; n++) {
      a.update(1 / 30);
      b.update(1 / 30);
    }
    for (let i = 0; i < a.count; i++) {
      expect(a.x[i]).toBeGreaterThanOrEqual(0);
      expect(a.x[i]).toBeLessThan(1200);
      expect(a.y[i]).toBeGreaterThanOrEqual(look.y0 - 1e-3);
      expect(a.y[i]).toBeLessThanOrEqual(look.y1 + 1e-3);
      expect(a.x[i]).toBe(b.x[i]);
    }
  });
});

describe('the second theatre', () => {
  it('fades in over 600 wu centred on each edge of its stretches', () => {
    const spans = [{ from: 19000, to: 26000 }];
    expect(SECOND_BLEND).toBe(600);
    expect(secondWeight(spans, 18000)).toBe(0);
    expect(secondWeight(spans, 18700)).toBe(0);
    expect(secondWeight(spans, 19000)).toBeCloseTo(0.5, 9);
    expect(secondWeight(spans, 19300)).toBe(1);
    expect(secondWeight(spans, 25000)).toBe(1);
    expect(secondWeight(spans, 26300)).toBe(0);
    expect(secondWeight([], 20000)).toBe(0);
  });
});

describe('the Soviet theatres', () => {
  it('have winter variants that a winter mission gets, with their own texture keys', () => {
    for (const id of ['russiaSummer', 'stalingrad', 'steppe'] as const) {
      expect(THEATRE_IDS).toContain(id);
      expect(THEATRES[id].winter).toBeDefined();
      expect(theatreVariant(id, 'winter')).toBe('winter');
      expect(theatreVariant(id, 'city')).toBe('base');
      expect(variantDef(id, 'winter').groundStyle).toBe('snow');
      const winter = getBackdrop(id, 'day', 3, 'winter');
      for (const l of winter) expect(l.key.startsWith(`bg/${theatreKey(id, 'winter')}/day/`)).toBe(true);
      expect(theatreKey(id, 'winter')).toBe(`${id}~winter`);
      // The winter ground is lighter than the summer's.
      const lum = (hex: string): number => {
        const v = parseInt(hex.slice(1), 16);
        return ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255);
      };
      expect(lum(getTheatreColours(id, 'day', 'winter').ground)).toBeGreaterThan(lum(getTheatreColours(id, 'day').ground));
    }
    // The old theatres have no winter look: a winter mission there is painted as before.
    expect(theatreVariant('france', 'winter')).toBe('base');
    expect(getBackdrop('france', 'day', 3, 'winter').map((l) => l.key)).toEqual(getBackdrop('france', 'day', 3).map((l) => l.key));
  });
});
