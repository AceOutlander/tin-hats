import { afterEach, describe, expect, it, vi } from 'vitest';
import { RENDER } from '../../src/data/render';
import { WEATHER } from '../../src/data/weather';
import { createWeather } from '../../src/fx';
import type { AudioSink } from '../../src/render/contracts';
import { Burners, DelayedFx } from '../../src/render/effects/ambient';
import { EFFECT_HANDLERS } from '../../src/render/effects/handlers';
import type { EffectContext } from '../../src/render/effects';
import { PRESET_DEFS } from '../../src/render/effects/presets';
import { SoundDirector } from '../../src/render/effects/sound';
import { lightningRng, weatherRng } from '../../src/render/weather/rng';
import type { SimEvent, SimEventType } from '../../src/sim';

afterEach(() => {
  vi.restoreAllMocks();
});

function ev(type: SimEventType, fields: Partial<SimEvent> = {}): SimEvent {
  const e: SimEvent = {
    type,
    side: -1,
    source: 'none',
    unit: -1,
    unitId: -1,
    kind: null,
    weapon: null,
    x: 0,
    row: -1,
    x2: 0,
    row2: -1,
    target: 'none',
    targetIndex: -1,
    value: 0,
    hit: false,
    dir: 0,
    cause: null,
    order: null,
    support: null,
    text: null,
  };
  return Object.assign(e, fields);
}

interface Recorder {
  plays: { id: string; x: number; size: number }[];
  sounds: string[];
  floaters: number[];
  orders: string[];
  drops: number;
  strikes: number;
  delayed: string[];
  shakes: string[];
}

/** Just enough of an EffectContext for the handlers: everything on screen, records what is asked of it. */
function fakeFx(playerSide = 0): { fx: EffectContext; rec: Recorder } {
  const rec: Recorder = { plays: [], sounds: [], floaters: [], orders: [], drops: 0, strikes: 0, delayed: [], shakes: [] };
  const hq = { doorX: 220, x: 150 };
  const fake = {
    playerSide,
    night: 0,
    time: 0,
    stepId: 1,
    ruinedAt: [-1, -1],
    p0: { x: 0, y: 0 },
    p1: { x: 0, y: 0 },
    rng: () => 0.5,
    state: { sides: [{ hq, holdLineX: 900, faction: 'british' }, { hq: { doorX: 5780, x: 5850 }, holdLineX: 5100, faction: 'german' }] },
    groundY: () => 404,
    onScreen: () => true,
    lowOk: () => true,
    play: (id: string, x: number, _y: number, _dx: number, _dy: number, _g: number, size: number) => rec.plays.push({ id, x, size }),
    shotOrigin: (e: SimEvent, out: { x: number; y: number }) => {
      out.x = e.x;
      out.y = 370;
    },
    shotTarget: (e: SimEvent, out: { x: number; y: number }) => {
      out.x = e.x2;
      out.y = 380;
    },
    sound: { at: (name: string) => rec.sounds.push(name), global: (name: string) => rec.sounds.push(`global:${name}`) },
    shake: { add: (size: string) => rec.shakes.push(size) },
    floaters: { add: (_x: number, _y: number, v: number) => rec.floaters.push(v) },
    orderMarkers: { add: (o: string) => rec.orders.push(o) },
    targetMarkers: { add: () => undefined },
    sky: {
      airdrop: () => {
        rec.drops++;
      },
      airStrike: () => {
        rec.strikes++;
      },
    },
    flights: { has: () => false, cancelProvisional: () => undefined, spawn: () => undefined },
    tracers: { spawn: () => undefined },
    units: { viewAtSlot: () => null, liveView: () => null, findById: () => null },
    ambient: {
      delayed: { add: (id: string) => rec.delayed.push(id) },
      burners: { add: () => undefined },
    },
  };
  return { fx: fake as unknown as EffectContext, rec };
}

describe('weather rolls', () => {
  it('rains on about 40% of seeded maps and always the same for one seed', () => {
    let rain = 0;
    for (let seed = 0; seed < 4000; seed++) {
      if (createWeather(weatherRng(seed), WEATHER).raining) rain++;
    }
    expect(rain / 4000).toBeGreaterThan(0.36);
    expect(rain / 4000).toBeLessThan(0.44);
    expect(createWeather(weatherRng(77), WEATHER).raining).toBe(createWeather(weatherRng(77), WEATHER).raining);
  });

  it('keeps the lightning random source separate from the weather one', () => {
    expect(lightningRng(5)()).not.toBe(weatherRng(5)());
  });

  it('makes one thunder check per 2 s of battle time, however the frames fall', () => {
    const w = createWeather(weatherRng(1), WEATHER, 'rain');
    for (let i = 0; i < 625; i++) w.update(0.016);
    expect(w.checksMade).toBe(5);
    w.update(7.3);
    expect(w.checksMade).toBe(8);
    w.update(0);
    expect(w.checksMade).toBe(8);
  });
});

describe('sound director', () => {
  function sink(): { audio: AudioSink; log: string[] } {
    const log: string[] = [];
    const audio: AudioSink = {
      play: (name) => log.push(`play:${name}`),
      playAt: (name, x) => log.push(`at:${name}@${x}`),
      startLoop: (name, v) => log.push(`loop:${name}:${v}`),
      stopLoop: (name) => log.push(`stop:${name}`),
      setListener: (c, w) => log.push(`listen:${c}:${w}`),
    };
    return { audio, log };
  }

  it('does nothing without a sink', () => {
    const d = new SoundDirector();
    d.at('rifleShot', 100);
    d.global('thunder');
    d.rain(true);
    d.tanks(2, 0.1);
    d.stopLoops();
    expect(d.hasSink()).toBe(false);
  });

  it('drops a sound that repeats inside its minimum gap and plays it again after', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const d = new SoundDirector();
    const { audio, log } = sink();
    d.setSink(audio);
    d.setView(500, 1000);
    d.at('rifleShot', 500);
    now += 5;
    d.at('rifleShot', 500);
    now += RENDER.audio.minGap.rifleShot * 1000 + 1;
    d.at('rifleShot', 500);
    expect(log.filter((l) => l.startsWith('at:rifleShot')).length).toBe(2);
  });

  it('ignores sounds far outside the view, and ignores unnamed ones', () => {
    const d = new SoundDirector();
    const { audio, log } = sink();
    d.setSink(audio);
    d.setView(500, 1000);
    d.at('rifleShot', 500 + 1000 * (0.5 + RENDER.audio.reachViews) + 10);
    d.at('none', 500);
    expect(log.filter((l) => l.startsWith('at:')).length).toBe(0);
  });

  it('caps the plays per second', () => {
    let now = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const d = new SoundDirector();
    const { audio, log } = sink();
    d.setSink(audio);
    d.setView(500, 1000);
    const names = ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'tankGun', 'explosionMedium', 'dirtHit', 'ricochet'];
    for (let i = 0; i < 200; i++) {
      now += 1;
      d.at(names[i % names.length], 500);
    }
    expect(log.filter((l) => l.startsWith('at:')).length).toBeLessThanOrEqual(RENDER.audio.maxPerSecond);
  });

  it('starts and stops the rain loop, and moves it to a new sink', () => {
    const d = new SoundDirector();
    const a = sink();
    const b = sink();
    d.setSink(a.audio);
    d.rain(true);
    d.rain(true);
    expect(a.log.filter((l) => l.startsWith('loop:rain')).length).toBe(1);
    d.setSink(b.audio);
    expect(a.log).toContain('stop:rain');
    expect(b.log.some((l) => l.startsWith('loop:rain'))).toBe(true);
    d.rain(false);
    expect(b.log).toContain('stop:rain');
  });

  it('runs the tank engine loop while tanks are near and stops it after the hold time', () => {
    const d = new SoundDirector();
    const { audio, log } = sink();
    d.setSink(audio);
    d.tanks(1, 0.016);
    expect(log.some((l) => l.startsWith('loop:tankEngine'))).toBe(true);
    d.tanks(0, RENDER.audio.tankLoopHold * 0.5);
    expect(log.some((l) => l === 'stop:tankEngine')).toBe(false);
    d.tanks(0, RENDER.audio.tankLoopHold * 0.6);
    expect(log.filter((l) => l === 'stop:tankEngine').length).toBe(1);
  });

  it('sets the listener only when the camera moves', () => {
    const d = new SoundDirector();
    const { audio, log } = sink();
    d.setSink(audio);
    d.setView(500, 1000);
    d.setView(500, 1000);
    d.setView(600, 1000);
    expect(log.filter((l) => l.startsWith('listen:')).length).toBe(2);
  });
});

describe('delayed effects and burners', () => {
  it('spawns a delayed preset when its time is up, in time order, and not before', () => {
    const { fx, rec } = fakeFx();
    const d = new DelayedFx();
    d.add('hitPuff', 0.2, 1, 2, 1, 0, 404, 1);
    d.add('bulletDirt', 0.1, 3, 4, 1, 0, 404, 1);
    d.update(fx, 0.05);
    expect(rec.plays.length).toBe(0);
    d.update(fx, 0.06);
    expect(rec.plays.map((p) => p.id)).toEqual(['bulletDirt']);
    d.update(fx, 0.1);
    expect(rec.plays.map((p) => p.id)).toEqual(['bulletDirt', 'hitPuff']);
  });

  it('plays a delayed preset at once when the delay is zero, once an owner has set the hook', () => {
    const { fx, rec } = fakeFx();
    const d = new DelayedFx();
    d.immediate = (id, x, y, dx, dy, g, s) => fx.play(id, x, y, dx, dy, g, s);
    d.add('hitPuff', 0, 1, 2, 1, 0, 404, 1);
    expect(rec.plays.length).toBe(1);
  });

  it('keeps a burner going at its preset interval until its duration ends', () => {
    const { fx, rec } = fakeFx();
    const b = new Burners();
    b.add('tankFire', 100, 380, 1, 1);
    for (let i = 0; i < 100; i++) b.update(fx, 0.05);
    const interval = PRESET_DEFS.tankFire.interval ?? 0.2;
    expect(rec.plays.length).toBeGreaterThanOrEqual(Math.floor(1 / interval) - 1);
    expect(rec.plays.length).toBeLessThanOrEqual(Math.ceil(1 / interval) + 1);
  });
});

describe('effect handlers', () => {
  it('sizes an explosion by its radius: grenade, shell, big', () => {
    for (const [radius, preset, sound] of [
      [40, 'grenadeBurst', 'grenadeExplosion'],
      [85, 'shellExplosion', 'explosionMedium'],
      [130, 'bigExplosion', 'explosionLarge'],
    ] as const) {
      const { fx, rec } = fakeFx();
      EFFECT_HANDLERS.explosion?.(fx, ev('explosion', { x: 3000, value: radius }));
      expect(rec.plays[0].id).toBe(preset);
      expect(rec.sounds).toContain(sound);
    }
  });

  it('gives only the player a +N and a delivery sound', () => {
    const own = fakeFx(0);
    EFFECT_HANDLERS.supplyDelivered?.(own.fx, ev('supplyDelivered', { side: 0, value: 10 }));
    expect(own.rec.floaters).toEqual([10]);
    expect(own.rec.sounds).toContain('suppliesDelivered');
    expect(own.rec.plays[0].id).toBe('supplyPop');
    const enemy = fakeFx(0);
    EFFECT_HANDLERS.supplyDelivered?.(enemy.fx, ev('supplyDelivered', { side: 1, value: 10 }));
    expect(enemy.rec.floaters).toEqual([]);
    expect(enemy.rec.sounds).not.toContain('suppliesDelivered');
  });

  it('puffs at the door when training finishes, and pings only for the player', () => {
    const own = fakeFx(0);
    EFFECT_HANDLERS.trainDone?.(own.fx, ev('trainDone', { side: 0 }));
    expect(own.rec.plays[0].id).toBe('trainPuff');
    expect(own.rec.sounds).toContain('unitTrained');
    const enemy = fakeFx(0);
    EFFECT_HANDLERS.trainDone?.(enemy.fx, ev('trainDone', { side: 1 }));
    expect(enemy.rec.sounds).not.toContain('unitTrained');
  });

  it('whistles and marks the hold line for the player order only', () => {
    const own = fakeFx(0);
    EFFECT_HANDLERS.orderChanged?.(own.fx, ev('orderChanged', { side: 0, order: 'advance' }));
    expect(own.rec.orders).toEqual(['advance']);
    expect(own.rec.sounds).toContain('global:whistleAdvance');
    const enemy = fakeFx(0);
    EFFECT_HANDLERS.orderChanged?.(enemy.fx, ev('orderChanged', { side: 1, order: 'hold' }));
    expect(enemy.rec.orders).toEqual([]);
  });

  it('sends the aircraft for an air strike and a parachute for an airdrop', () => {
    const { fx, rec } = fakeFx();
    EFFECT_HANDLERS.supportIncoming?.(fx, ev('supportIncoming', { side: 0, support: 'airStrike', x: 3000, value: 3 }));
    EFFECT_HANDLERS.supportIncoming?.(fx, ev('supportIncoming', { side: 0, support: 'artillery', x: 3000, value: 2 }));
    EFFECT_HANDLERS.airdrop?.(fx, ev('airdrop', { side: 0, x: 220, value: 25 }));
    expect(rec.strikes).toBe(1);
    expect(rec.drops).toBe(1);
  });

  it('plays the weapon sound for a shot even off screen, and the muzzle flash only on screen', () => {
    const off = fakeFx(0);
    (off.fx as unknown as { onScreen: () => boolean }).onScreen = () => false;
    EFFECT_HANDLERS.shot?.(off.fx, ev('shot', { side: 0, source: 'unit', weapon: 'rifle', x: 500, x2: 700, row: 1, row2: 1, target: 'unit', hit: true, dir: 1 }));
    expect(off.rec.sounds).toContain('rifleShot');
    expect(off.rec.plays.length).toBe(0);
    const on = fakeFx(0);
    EFFECT_HANDLERS.shot?.(on.fx, ev('shot', { side: 0, source: 'unit', weapon: 'rifle', x: 500, x2: 700, row: 1, row2: 1, target: 'unit', hit: true, dir: 1 }));
    expect(on.rec.plays.some((p) => p.id === 'muzzleFlash')).toBe(true);
  });

  it('sends the hit to the tracer instead of showing it at once', () => {
    const { fx, rec } = fakeFx(0);
    EFFECT_HANDLERS.shot?.(fx, ev('shot', { side: 0, source: 'unit', weapon: 'rifle', x: 500, x2: 700, row: 1, row2: 1, target: 'unit', hit: true, dir: 1 }));
    expect(rec.delayed).toEqual(['hitPuff']);
    const miss = fakeFx(0);
    EFFECT_HANDLERS.shot?.(miss.fx, ev('shot', { side: 0, source: 'unit', weapon: 'rifle', x: 500, x2: 700, row: 1, row2: 1, target: 'unit', hit: false, dir: 1 }));
    expect(miss.rec.delayed).toEqual(['bulletDirt']);
  });

  it('collapses a destroyed headquarters once, with blasts and the big shake', () => {
    const { fx, rec } = fakeFx(0);
    EFFECT_HANDLERS.structureDestroyed?.(fx, ev('structureDestroyed', { side: 0, target: 'hq', targetIndex: 0, x: 150 }));
    EFFECT_HANDLERS.structureDestroyed?.(fx, ev('structureDestroyed', { side: 0, target: 'hq', targetIndex: 0, x: 150 }));
    expect(rec.plays.filter((p) => p.id === 'hqCollapse').length).toBe(1);
    expect(rec.delayed.length).toBe(RENDER.fx.hq.collapseBlasts);
    expect(fx.ruinedAt[0]).toBeGreaterThanOrEqual(0);
  });

  it('collapses the losing headquarters when the battle ends without it being destroyed', () => {
    const { fx, rec } = fakeFx(0);
    EFFECT_HANDLERS.battleEnded?.(fx, ev('battleEnded', { side: 1 }));
    expect(rec.plays.some((p) => p.id === 'hqCollapse')).toBe(true);
    expect(fx.ruinedAt[0]).toBeGreaterThanOrEqual(0);
    expect(fx.ruinedAt[1]).toBe(-1);
  });
});
