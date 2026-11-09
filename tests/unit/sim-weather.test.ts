/**
 * Scripted weather and time of day in the sim (src/sim/sky.ts, FOUNDATIONS.md 4.7): visibility caps direct fire for
 * both sides, flares lift it, night and its per-mission override, changes switching at their midpoint, aircraft
 * grounded by fog, blizzard and night (but the Po-2), the blizzard's slow going and poor long shots, and that a mission
 * without any of it plays exactly as before. Battles are the test field with a few placed units.
 */
import { describe, expect, it } from 'vitest';
import type { ForceDef, MissionDef, MissionEventDef } from '../../src/data/schema';
import { WEATHER_SIM } from '../../src/data/weather';
import { WEAPONS } from '../../src/data/weapons';
import { MISSIONS } from '../../src/data/missions';
import { THEATRES } from '../../src/data/theatres';
import { airGrounded, scriptsWeather, timeBlend, visibilityOf, weatherBlend } from '../../src/sim';
import { FIELD } from './fixtures';
import { collect, makeBattle, run, snapshot, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

const RIFLE = WEAPONS.rifle.range;

/** A rifleman of each side, frozen at their posts `gap` wu apart, in this weather (and these events). */
function duel(gap: number, over: MissionOverrides = {}, aKind: ForceDef['kind'] = 'rifle'): MissionDef {
  return testMission({
    a: { forces: [{ kind: aKind, count: 1, x: 2000, behaviour: 'guard', leash: 0 }] },
    b: { forces: [{ kind: 'rifle', count: 1, x: 2000 + gap, behaviour: 'guard', leash: 0 }] },
    ...over,
  });
}

/** Shots side 0 fires in the first `seconds`. */
function shots(m: MissionDef, seconds: number): number {
  const b = makeBattle({ mission: m });
  return collect(b, seconds, 'shot').filter((e) => e.side === 0).length;
}

describe('a mission without scripted weather', () => {
  it('is clear by day: visibility 1, nothing grounded, no random-rain switch', () => {
    const b = makeBattle({ mission: testMission() });
    const sky = b.state.sky;
    expect(sky.weather).toBe('clear');
    expect(sky.time).toBe(FIELD.timeOfDay);
    expect(sky.visibility).toBe(1);
    expect(sky.infantrySpeed).toBe(1);
    expect(sky.accuracyFar).toBe(1);
    expect(sky.scripted).toBe(false);
    expect(airGrounded(b.state, 0, 'airStrike')).toBeNull();
    expect(scriptsWeather(FIELD)).toBe(false);
  });

  it('plays exactly as the same battle under a scripted clear sky, or snow (which changes nothing in the sim)', () => {
    const base = { ...FIELD };
    const clear = { ...FIELD, weather: 'clear' as const };
    const snow = { ...FIELD, weather: 'snow' as const, events: [...FIELD.events, { type: 'weather', when: { at: 30 }, to: 'overcast', over: 20 } as MissionEventDef] };
    const one = makeBattle({ mission: base, commanders: ['bot', 'ai'], seed: 5 });
    const two = makeBattle({ mission: clear, commanders: ['bot', 'ai'], seed: 5 });
    const three = makeBattle({ mission: snow, commanders: ['bot', 'ai'], seed: 5 });
    for (let i = 0; i < 6; i++) {
      run(one, 30);
      run(two, 30);
      run(three, 30);
      expect(snapshot(two)).toBe(snapshot(one));
      expect(snapshot(three)).toBe(snapshot(one));
    }
    expect(three.state.sky.weather).toBe('overcast');
  });
});

describe('visibility', () => {
  it('has the brief numbers, the lower of weather and time applying', () => {
    expect(visibilityOf('fog', 'day')).toBe(0.6);
    expect(visibilityOf('blizzard', 'day')).toBe(0.7);
    expect(visibilityOf('dust', 'day')).toBe(0.8);
    expect(visibilityOf('smoke', 'day')).toBe(0.85);
    expect(visibilityOf('clear', 'night')).toBe(0.65);
    expect(visibilityOf('smoke', 'night')).toBe(0.65);
    expect(visibilityOf('fog', 'night')).toBe(0.6);
    expect(visibilityOf('clear', 'night', 0.8)).toBe(0.8);
    for (const t of ['dawn', 'day', 'overcast', 'dusk'] as const) expect(visibilityOf('clear', t)).toBe(1);
  });

  it('caps the range at which a rifleman picks a target, for both sides alike', () => {
    const gap = RIFLE * 0.82;
    expect(shots(duel(gap), 6)).toBeGreaterThan(0);
    expect(shots(duel(gap, { weather: 'fog' }), 6)).toBe(0);
    expect(shots(duel(gap, { weather: 'dust' }), 6)).toBe(0);
    expect(shots(duel(gap, { weather: 'smoke' }), 6)).toBeGreaterThan(0);
    // Inside the visible range the fog changes nothing.
    expect(shots(duel(RIFLE * 0.5, { weather: 'fog' }), 6)).toBeGreaterThan(0);
    // The enemy rifleman is just as blind.
    const b = makeBattle({ mission: duel(gap, { weather: 'fog' }) });
    expect(collect(b, 6, 'shot').length).toBe(0);
  });

  it('leaves lobbed weapons alone: a mortar still finds a target out in the fog', () => {
    const gap = WEAPONS.mortar.range * 0.8;
    expect(gap).toBeGreaterThan(WEAPONS.mortar.minRange);
    expect(shots(duel(gap, { weather: 'fog' }, 'mortar'), 10)).toBeGreaterThan(0);
  });

  it('is the night factor at night, or the mission\'s own nightVisibility', () => {
    const gap = RIFLE * 0.75;
    expect(shots(duel(gap, { timeOfDay: 'night' }), 6)).toBe(0);
    expect(shots(duel(gap, { timeOfDay: 'night', nightVisibility: 0.8 }), 6)).toBeGreaterThan(0);
    expect(shots(duel(gap, { timeOfDay: 'dusk' }), 6)).toBeGreaterThan(0);
  });

  it('drops a target that the fog swallows', () => {
    const gap = RIFLE * 0.8;
    const m = duel(gap, { events: [{ type: 'weather', when: { at: 5 }, to: 'fog', over: 0 }] });
    const b = makeBattle({ mission: m });
    expect(collect(b, 5, 'shot').filter((e) => e.side === 0).length).toBeGreaterThan(0);
    run(b, 0.5);
    expect(collect(b, 6, 'shot').length).toBe(0);
  });
});

describe('flares', () => {
  it('light their stretch for 20 s: targets under them can be seen from out of the fog, then the dark returns', () => {
    const gap = RIFLE * 0.8;
    const flare: MissionEventDef = { type: 'flare', when: { at: 2 }, x: 2000 + gap };
    const b = makeBattle({ mission: duel(gap, { weather: 'fog', events: [flare] }) });
    expect(collect(b, 2, 'shot').filter((e) => e.side === 0).length).toBe(0);
    expect(b.state.sky.flares.length).toBe(1);
    const f = b.state.sky.flares[0];
    expect(f.x1 - f.x0).toBe(WEATHER_SIM.flare.width);
    expect(f.until - f.from).toBe(WEATHER_SIM.flare.seconds);
    // Both men stand inside the lit stretch (1,500 wu wide), so both see and fire.
    expect(collect(b, 15, 'shot').filter((e) => e.side === 0).length).toBeGreaterThan(0);
    run(b, 6);
    expect(b.state.sky.flares.length).toBe(0);
    expect(collect(b, 6, 'shot').length).toBe(0);
  });

  it('light only their own stretch: a target outside it stays hidden', () => {
    const gap = RIFLE * 0.8;
    const flare: MissionEventDef = { type: 'flare', when: { at: 1 }, x: 2000 + gap + 2000, width: 1000 };
    expect(shots(duel(gap, { weather: 'fog', events: [flare] }), 8)).toBe(0);
  });
});

describe('weather and time changes', () => {
  it('switch the sim at the midpoint while the view crossfades over the whole span', () => {
    const events: MissionEventDef[] = [
      { type: 'weather', when: { at: 10 }, to: 'fog', over: 20 },
      { type: 'time', when: { at: 10 }, to: 'night', over: 40 },
    ];
    const b = makeBattle({ mission: testMission({ events }) });
    run(b, 19.9);
    expect(b.state.sky.weather).toBe('clear');
    expect(b.state.sky.visibility).toBe(1);
    expect(weatherBlend(b.state)).toBeGreaterThan(0.4);
    expect(weatherBlend(b.state)).toBeLessThan(0.5);
    run(b, 0.2);
    expect(b.state.sky.weather).toBe('fog');
    expect(b.state.sky.visibility).toBe(0.6);
    expect(b.state.sky.scripted).toBe(true);
    expect(b.state.sky.time).toBe('day');
    run(b, 10);
    expect(b.state.sky.time).toBe('night');
    expect(b.state.sky.weatherFrom).toBe('clear');
    expect(b.state.sky.weatherTo).toBe('fog');
    expect(weatherBlend(b.state)).toBe(1);
    expect(timeBlend(b.state)).toBeLessThan(1);
    run(b, 20);
    expect(timeBlend(b.state)).toBe(1);
  });

  it('are deterministic: the same battle twice gives the same ticks', () => {
    const events: MissionEventDef[] = [
      { type: 'weather', when: { at: 20 }, to: 'blizzard', over: 10 },
      { type: 'flare', when: { every: 15, from: 5 }, x: 3000 },
      { type: 'time', when: { at: 60 }, to: 'night', over: 10 },
    ];
    const m = { ...FIELD, weather: 'fog' as const, events: [...FIELD.events, ...events] };
    const one = makeBattle({ mission: m, commanders: ['bot', 'ai'], seed: 9 });
    const two = makeBattle({ mission: m, commanders: ['bot', 'ai'], seed: 9 });
    for (let i = 0; i < 5; i++) {
      run(one, 30);
      run(two, 30);
      expect(snapshot(two)).toBe(snapshot(one));
    }
  });
});

describe('aircraft', () => {
  const air = (over: MissionOverrides): MissionDef =>
    testMission({ supports: [['airStrike', 'artillery', 'recon'], ['airStrike']], a: { supplies: 5000 }, b: { supplies: 5000 }, ...over });

  function calls(m: MissionDef, kind: 'airStrike' | 'artillery' | 'recon', side: 0 | 1 = 0): number {
    const b = makeBattle({ mission: m });
    b.command(side, { type: 'support', kind, x: 3000 });
    return collect(b, 1, 'supportCalled').filter((e) => e.side === side).length;
  }

  it('are grounded in fog and blizzard, for both sides; the guns still fire', () => {
    expect(calls(air({}), 'airStrike')).toBe(1);
    for (const weather of ['fog', 'blizzard'] as const) {
      expect(calls(air({ weather }), 'airStrike')).toBe(0);
      expect(calls(air({ weather }), 'airStrike', 1)).toBe(0);
      expect(calls(air({ weather }), 'artillery')).toBe(1);
    }
    for (const weather of ['snow', 'dust', 'smoke', 'overcast', 'rain'] as const) expect(calls(air({ weather }), 'airStrike')).toBe(1);
  });

  it('do not fly at night, but for the nation\'s night flyers (the Soviet Po-2)', () => {
    expect(calls(air({ timeOfDay: 'night' }), 'airStrike')).toBe(0);
    expect(calls(air({ timeOfDay: 'night' }), 'recon')).toBe(0);
    const soviet = air({ timeOfDay: 'night', a: { supplies: 5000, faction: 'soviet' } });
    expect(calls(soviet, 'recon')).toBe(1);
    expect(calls(soviet, 'airStrike')).toBe(0);
    expect(calls(air({ timeOfDay: 'dawn' }), 'airStrike')).toBe(1);
  });

  it('skip a scripted raid while grounded', () => {
    const raid: MissionEventDef = { type: 'airRaid', when: { at: 1 }, side: 1, support: 'airStrike', x: 2000 };
    const fly = makeBattle({ mission: air({ events: [raid] }) });
    expect(collect(fly, 3, 'supportCalled').length).toBe(1);
    const fog = makeBattle({ mission: air({ weather: 'fog', events: [raid] }) });
    expect(collect(fog, 3, 'supportCalled').length).toBe(0);
  });
});

describe('the blizzard', () => {
  it('slows men on foot x0.9, not vehicles, and spoils long shots', () => {
    const walk = (weather: 'clear' | 'blizzard', kind: 'rifle' | 'tank'): number => {
      const m = testMission({ weather, a: { forces: [{ kind, count: 1, x: 1500 }] } });
      const b = makeBattle({ mission: m });
      b.command(0, { type: 'order', order: 'advance' });
      run(b, 0.5);
      const x0 = unitsOf(b, 0, kind)[0].x;
      run(b, 4);
      return unitsOf(b, 0, kind)[0].x - x0;
    };
    const clear = walk('clear', 'rifle');
    expect(clear).toBeGreaterThan(20);
    expect(walk('blizzard', 'rifle') / clear).toBeCloseTo(WEATHER_SIM.blizzard.infantrySpeed, 2);
    expect(walk('blizzard', 'tank')).toBeCloseTo(walk('clear', 'tank'), 6);
    const b = makeBattle({ mission: testMission({ weather: 'blizzard' }) });
    expect(b.state.sky.accuracyFar).toBe(WEATHER_SIM.blizzard.accuracyFar);
    expect(b.state.sky.infantrySpeed).toBe(WEATHER_SIM.blizzard.infantrySpeed);
  });

  it('makes long rifle shots miss more often', () => {
    // Many duels at 90% of the visible range: the blizzard's hit share is lower.
    const share = (weather: 'snow' | 'blizzard'): number => {
      let hit = 0;
      let all = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const b = makeBattle({ mission: duel(RIFLE * 0.62, { weather }), seed });
        for (const e of collect(b, 12, 'shot')) {
          all++;
          if (e.hit) hit++;
        }
      }
      return hit / all;
    };
    expect(share('blizzard')).toBeLessThan(share('snow'));
  });
});

describe('the Stalingrad missions', () => {
  const stalingrad = MISSIONS.filter((m) => m.id >= 1001 && m.id <= 1010);

  it('script their weather on the Soviet theatres, at most two backdrops each', () => {
    expect(stalingrad.length).toBe(10);
    for (const m of stalingrad) {
      expect(scriptsWeather(m), `${m.id}`).toBe(true);
      expect(['russiaSummer', 'stalingrad', 'steppe']).toContain(m.theatre);
      const sets = new Set([m.theatre, ...(m.sectors ?? []).map((s) => s.backdrop ?? m.theatre)]);
      expect(sets.size, `${m.id}`).toBeLessThanOrEqual(2);
      if (m.climate === 'winter') expect(THEATRES[m.theatre].winter, `${m.id}`).toBeDefined();
    }
    const two = stalingrad.filter((m) => (m.sectors ?? []).some((s) => s.backdrop !== undefined && s.backdrop !== m.theatre)).map((m) => m.id);
    expect(two).toEqual([1004, 1010]);
  });

  it('have the brief\'s weather and time: 1004 opens in a night blizzard with a flare over the village; 1009 in fog', () => {
    const m1004 = stalingrad.find((m) => m.id === 1004)!;
    expect([m1004.weather, m1004.timeOfDay]).toEqual(['blizzard', 'night']);
    const b = makeBattle({ mission: m1004, commanders: ['bot', 'ai'] });
    expect(b.state.sky.visibility).toBe(0.65);
    expect(airGrounded(b.state, 0, 'airStrike')).toBe('blizzard');
    expect(m1004.events.some((e) => e.type === 'flare' && 'delay' in e.when && 'phase' in e.when && e.when.phase === 'night' && e.when.delay === 200)).toBe(true);
    const m1009 = stalingrad.find((m) => m.id === 1009)!;
    expect(m1009.weather).toBe('fog');
    const kinds = (id: number, type: 'weather' | 'time'): string[] =>
      stalingrad.find((m) => m.id === id)!.events.flatMap((e) => (e.type === type ? [e.to] : []));
    expect(kinds(1009, 'weather')).toEqual(['clear', 'blizzard']);
    expect(kinds(1009, 'time')).toEqual(['day', 'night']);
    expect(kinds(1004, 'weather')).toEqual(['snow', 'clear']);
    expect(kinds(1004, 'time')).toEqual(['dawn', 'day']);
    expect(kinds(1010, 'weather')).toEqual(['blizzard', 'snow', 'clear']);
    expect(kinds(1007, 'time')).toEqual(['day', 'night', 'day', 'night']);
    expect(kinds(1005, 'time')).toEqual(['dawn', 'day']);
  });
});
