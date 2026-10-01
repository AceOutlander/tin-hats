import { describe, expect, it } from 'vitest';
import {
  FX,
  FX_KEYS,
  FX_LAYERS,
  FX_PRESET_IDS,
  FX_PRESETS,
  FX_PROJECTILE_SPRITE,
  FX_SHAKE,
  FX_SPRITE_KEYS,
  FX_TRACERS,
  type FxEmitterDef,
  type FxPresetDef,
} from '../../src/data/fx';
import { VIEW } from '../../src/data/view';
import { ParticleSystem, createParticles } from '../../src/fx/particles';
import { createRng } from '../../src/fx/rng';
import { createShake, shakeStrength } from '../../src/fx/shake';

const DT = 1 / 60;

/** A one-emitter preset for testing one behaviour at a time. */
function single(overrides: Partial<FxEmitterDef>): Record<'test', FxPresetDef> {
  return {
    test: {
      emitters: [
        {
          sprites: ['fx/dirt/0'],
          layer: 'effects',
          count: [1, 1],
          life: [1, 1],
          aim: 'dir',
          spread: 0,
          speed: [0, 0],
          scale: [1, 1],
          fadeOut: 1,
          ...overrides,
        },
      ],
    },
  };
}

function system(overrides: Partial<FxEmitterDef>, capacity = 64): ParticleSystem<'test'> {
  const ps = new ParticleSystem(createRng(1), capacity, single(overrides));
  ps.wind = 0;
  return ps;
}

describe('fx data', () => {
  const required = [
    'muzzleFlash',
    'casing',
    'bulletDirt',
    'footDust',
    'trackDust',
    'exhaust',
    'grenadeBurst',
    'shellExplosion',
    'bigExplosion',
    'pillboxDebris',
    'wireSnap',
    'smokeScreen',
    'hitPuff',
    'crateSplinters',
    'rainSplash',
    'waterSplash',
    'armourSparks',
    'tankFire',
  ];

  it('has every preset the brief asks for', () => {
    for (const id of required) expect(FX_PRESET_IDS).toContain(id);
  });

  it('only uses known sprites and layers, with sane ranges', () => {
    const layers = FX_LAYERS.map((l) => l.name as string);
    for (const id of FX_PRESET_IDS) {
      const preset: FxPresetDef = FX_PRESETS[id];
      expect(preset.emitters.length).toBeGreaterThan(0);
      let most = 0;
      for (const em of preset.emitters) {
        expect(em.sprites.length).toBeGreaterThan(0);
        for (const key of em.sprites) expect(FX_SPRITE_KEYS).toContain(key);
        expect(layers).toContain(em.layer);
        for (const range of [em.count, em.life, em.speed, em.scale, em.delay, em.spin, em.forward]) {
          if (range) expect(range[1]).toBeGreaterThanOrEqual(range[0]);
        }
        expect(em.life[0]).toBeGreaterThan(0);
        expect(em.scale[0]).toBeGreaterThan(0);
        expect(em.fadeOut ?? 0.6).toBeLessThan(1);
        expect(em.fadeIn ?? 0).toBeLessThanOrEqual(em.fadeOut ?? 0.6);
        most += em.count[1];
      }
      // One spawn must never swamp the pool.
      expect(most).toBeLessThanOrEqual(FX.capacity / 8);
      if (preset.decal) expect([...FX_KEYS.decal.crater, FX_KEYS.decal.scorch]).toContain(preset.decal);
    }
  });

  it('namespaces every sprite key under fx/ with no duplicates', () => {
    expect(new Set(FX_SPRITE_KEYS).size).toBe(FX_SPRITE_KEYS.length);
    for (const key of FX_SPRITE_KEYS) expect(key.startsWith('fx/')).toBe(true);
  });

  it('gives explosions a screen shake that grows with their size', () => {
    expect(FX_PRESETS.grenadeBurst.shake).toBe('small');
    expect(FX_PRESETS.shellExplosion.shake).toBe('medium');
    expect(FX_PRESETS.bigExplosion.shake).toBe('large');
    expect(FX_SHAKE.medium.amplitude).toBeGreaterThan(FX_SHAKE.small.amplitude);
    expect(FX_SHAKE.large.amplitude).toBeGreaterThan(FX_SHAKE.medium.amplitude);
    expect(FX_SHAKE.large.amplitude).toBeLessThanOrEqual(FX.shakeMax);
  });

  it('has a tracer for each tracer type and a projectile sprite for each look and faction', () => {
    for (const look of ['rifle', 'mg', 'smg', 'sniper'] as const) {
      expect(FX_TRACERS[look].sprite).toBe(FX_KEYS.tracer[look]);
      expect(FX_TRACERS[look].speed).toBeGreaterThan(0);
    }
    for (const look of ['grenade', 'mortar', 'rocket', 'shell', 'bomb'] as const) {
      expect(FX_PROJECTILE_SPRITE[look].british.startsWith('fx/proj/')).toBe(true);
      expect(FX_PROJECTILE_SPRITE[look].german.startsWith('fx/proj/')).toBe(true);
    }
    expect(FX_PROJECTILE_SPRITE.grenade.british).toBe(FX_KEYS.projectile.millsBomb);
    expect(FX_PROJECTILE_SPRITE.grenade.german).toBe(FX_KEYS.projectile.stickGrenade);
  });

  it('makes smoke-screen puffs large, soft-edged in time, long-lived and drifting', () => {
    const em: FxEmitterDef = FX_PRESETS.smokeScreen.emitters[0];
    expect(em.layer).toBe('smokeScreen');
    expect(em.life[0]).toBeGreaterThan(3);
    expect(em.scale[0]).toBeGreaterThan(1);
    expect(em.wind ?? 0).toBeGreaterThan(0);
    expect(em.fadeIn ?? 0).toBeGreaterThan(0);
  });
});

describe('particle pool', () => {
  it('starts empty and spawns the preset count', () => {
    const ps = system({ count: [5, 5] });
    expect(ps.count).toBe(0);
    ps.spawn('test', 10, 20);
    expect(ps.count).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(ps.x[i]).toBe(10);
      expect(ps.y[i]).toBe(20);
      expect(ps.alpha[i]).toBe(1);
      expect(ps.scale[i]).toBe(1);
      expect(ps.sprite[i]).toBe(FX_SPRITE_KEYS.indexOf('fx/dirt/0'));
      expect(FX_LAYERS[ps.layer[i]].name).toBe('effects');
    }
  });

  it('never exceeds its capacity and counts the spawns it drops', () => {
    const ps = system({ count: [10, 10] }, 32);
    for (let i = 0; i < 5; i++) ps.spawn('test', 0, 0);
    expect(ps.count).toBe(32);
    expect(ps.dropped).toBe(18);
    ps.update(DT);
    expect(ps.count).toBe(32);
  });

  it('removes particles when their life ends and reuses the slots', () => {
    const ps = system({ count: [8, 8], life: [0.5, 0.5] }, 8);
    ps.spawn('test', 0, 0);
    for (let i = 0; i < 29; i++) ps.update(DT);
    expect(ps.count).toBe(8);
    ps.update(DT);
    ps.update(DT);
    expect(ps.count).toBe(0);
    ps.spawn('test', 0, 0);
    expect(ps.count).toBe(8);
    expect(ps.dropped).toBe(0);
  });

  it('keeps live particles packed in spawn order when others die', () => {
    const presets: Record<'short' | 'long', FxPresetDef> = {
      short: single({ life: [0.2, 0.2] }).test,
      long: single({ life: [5, 5] }).test,
    };
    const ps = new ParticleSystem(createRng(1), 16, presets);
    ps.spawn('long', 1, 0);
    ps.spawn('short', 2, 0);
    ps.spawn('long', 3, 0);
    ps.spawn('short', 4, 0);
    ps.spawn('long', 5, 0);
    for (let i = 0; i < 20; i++) ps.update(DT);
    expect(ps.count).toBe(3);
    expect(Array.from(ps.x.subarray(0, 3))).toEqual([1, 3, 5]);
  });

  it('does not grow or replace its arrays while running', () => {
    const ps = createParticles(createRng(4), 256);
    const before = [ps.x, ps.y, ps.rotation, ps.scale, ps.alpha, ps.sprite, ps.layer];
    for (let frame = 0; frame < 600; frame++) {
      if (frame % 3 === 0) ps.spawn(FX_PRESET_IDS[(frame / 3) % FX_PRESET_IDS.length], 100, VIEW.groundY - 10, 1, 0);
      ps.update(DT);
      expect(ps.count).toBeLessThanOrEqual(256);
    }
    const after = [ps.x, ps.y, ps.rotation, ps.scale, ps.alpha, ps.sprite, ps.layer];
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toBe(before[i]);
      expect(after[i].length).toBe(256);
    }
  });

  it('clears', () => {
    const ps = system({ count: [5, 5] });
    ps.spawn('test', 0, 0);
    ps.clear();
    expect(ps.count).toBe(0);
  });

  it('ignores zero, negative and invalid time steps', () => {
    const ps = system({ speed: [100, 100] });
    ps.spawn('test', 0, 0, 1, 0);
    ps.update(0);
    ps.update(-1);
    ps.update(Number.NaN);
    expect(ps.count).toBe(1);
    expect(ps.x[0]).toBe(0);
  });
});

describe('particle motion', () => {
  it('launches along the given direction', () => {
    const ps = system({ speed: [120, 120] });
    ps.spawn('test', 0, 0, 0, -3);
    ps.spawn('test', 0, 0, -1, 0);
    for (let i = 0; i < 30; i++) ps.update(DT);
    expect(ps.x[0]).toBeCloseTo(0, 2);
    expect(ps.y[0]).toBeCloseTo(-60, 1);
    expect(ps.x[1]).toBeCloseTo(-60, 1);
    expect(ps.y[1]).toBeCloseTo(0, 2);
  });

  it('turns the launch toward up, mirrored for left-facing spawns', () => {
    const ps = system({ speed: [100, 100], turnUp: Math.PI / 2 + 0.5 });
    ps.spawn('test', 0, 0, 1, 0);
    ps.spawn('test', 0, 0, -1, 0);
    ps.update(0.1);
    // Facing right: thrown up and back (to the left). Facing left: up and back (to the right).
    expect(ps.y[0]).toBeLessThan(0);
    expect(ps.x[0]).toBeLessThan(0);
    expect(ps.y[1]).toBeLessThan(0);
    expect(ps.x[1]).toBeGreaterThan(0);
    expect(ps.x[1]).toBeCloseTo(-ps.x[0], 3);
    expect(ps.y[1]).toBeCloseTo(ps.y[0], 3);
  });

  it('aims up, all round, or along the ground to both sides', () => {
    const up = system({ aim: 'up', spread: 0.4, speed: [100, 100], count: [40, 40] });
    up.spawn('test', 0, 0, 1, 0);
    up.update(0.1);
    for (let i = 0; i < up.count; i++) expect(up.y[i]).toBeLessThan(-9);

    const any = system({ aim: 'any', speed: [100, 100], count: [60, 60] });
    any.spawn('test', 0, 0);
    any.update(0.1);
    let above = 0;
    let below = 0;
    for (let i = 0; i < any.count; i++) {
      if (any.y[i] < 0) above++;
      else below++;
    }
    expect(above).toBeGreaterThan(10);
    expect(below).toBeGreaterThan(10);

    const sides = system({ aim: 'sides', spread: 0.3, speed: [100, 100], count: [60, 60] });
    sides.spawn('test', 0, 0);
    sides.update(0.1);
    let left = 0;
    let right = 0;
    for (let i = 0; i < sides.count; i++) {
      expect(sides.y[i]).toBeLessThanOrEqual(0.001);
      expect(Math.abs(sides.x[i])).toBeGreaterThan(9);
      if (sides.x[i] < 0) left++;
      else right++;
    }
    expect(left).toBeGreaterThan(10);
    expect(right).toBeGreaterThan(10);
  });

  it('falls under gravity', () => {
    const ps = system({ gravity: 600, life: [2, 2] });
    ps.spawn('test', 0, 0, 1, 0, 10_000);
    for (let i = 0; i < 60; i++) ps.update(DT);
    // Half g t squared = 300, within the error of stepping at 60 fps.
    expect(ps.y[0]).toBeGreaterThan(290);
    expect(ps.y[0]).toBeLessThan(310);
  });

  it('rises with negative gravity', () => {
    const ps = system({ gravity: -40 });
    ps.spawn('test', 0, 0);
    for (let i = 0; i < 30; i++) ps.update(DT);
    expect(ps.y[0]).toBeLessThan(0);
  });

  it('slows down with drag, the same at any frame rate', () => {
    const coarse = system({ speed: [200, 200], drag: 3, life: [5, 5] });
    const fine = system({ speed: [200, 200], drag: 3, life: [5, 5] });
    coarse.spawn('test', 0, 0, 1, 0);
    fine.spawn('test', 0, 0, 1, 0);
    for (let i = 0; i < 30; i++) coarse.update(1 / 30);
    for (let i = 0; i < 120; i++) fine.update(1 / 120);
    // Without drag it would travel 200; with drag 3 the limit is 200 / 3.
    expect(fine.x[0]).toBeGreaterThan(55);
    expect(fine.x[0]).toBeLessThan(67);
    expect(Math.abs(coarse.x[0] - fine.x[0])).toBeLessThan(4);
  });

  it('drifts with the wind by its wind share', () => {
    const ps = system({ wind: 0.5, life: [5, 5] });
    ps.wind = 20;
    ps.spawn('test', 0, 0);
    for (let i = 0; i < 60; i++) ps.update(DT);
    expect(ps.x[0]).toBeCloseTo(10, 1);
  });

  it('bounces on the ground line it was given, losing height each time, then rests', () => {
    const groundY = 100;
    const ps = system({ gravity: 700, ground: 'bounce', bounce: 0.5, friction: 0.5, life: [6, 6], spin: [10, 10], rotation: 'random' });
    ps.spawn('test', 0, 0, 1, 0, groundY);
    let touchdowns = 0;
    let apexAfterFirst = groundY;
    let lastY = 0;
    for (let i = 0; i < 300; i++) {
      ps.update(DT);
      expect(ps.y[0]).toBeLessThanOrEqual(groundY);
      if (ps.y[0] === groundY && lastY < groundY) touchdowns++;
      if (touchdowns === 1) apexAfterFirst = Math.min(apexAfterFirst, ps.y[0]);
      lastY = ps.y[0];
    }
    // It leaves the ground again at least once before settling.
    expect(touchdowns).toBeGreaterThanOrEqual(2);
    // Dropped from 100 above the ground with half the speed kept: the first rebound reaches about a quarter of the height.
    expect(groundY - apexAfterFirst).toBeGreaterThan(15);
    expect(groundY - apexAfterFirst).toBeLessThan(35);
    // At rest on the ground, lying flat, not spinning.
    expect(ps.y[0]).toBe(groundY);
    const rot = ps.rotation[0];
    ps.update(DT);
    expect(ps.rotation[0]).toBe(rot);
    expect(Math.abs(Math.sin(rot))).toBeLessThan(1e-5);
  });

  it('uses the system ground line when none is given', () => {
    const ps = system({ gravity: 700, ground: 'stick', life: [6, 6] });
    ps.groundY = 50;
    ps.spawn('test', 0, 0);
    for (let i = 0; i < 120; i++) ps.update(DT);
    expect(ps.y[0]).toBe(50);
  });

  it('sticks or dies on the ground when told to', () => {
    const stick = system({ gravity: 700, ground: 'stick', speed: [50, 50], life: [6, 6] });
    stick.spawn('test', 0, 0, 1, 0, 40);
    for (let i = 0; i < 120; i++) stick.update(DT);
    const x = stick.x[0];
    stick.update(DT);
    expect(stick.count).toBe(1);
    expect(stick.y[0]).toBe(40);
    expect(stick.x[0]).toBe(x);

    const die = system({ gravity: 700, ground: 'die', life: [6, 6] });
    die.spawn('test', 0, 0, 1, 0, 40);
    for (let i = 0; i < 120; i++) die.update(DT);
    expect(die.count).toBe(0);
  });

  it('passes through the ground line by default', () => {
    const ps = system({ gravity: 700, life: [6, 6] });
    ps.spawn('test', 0, 0, 1, 0, 40);
    for (let i = 0; i < 60; i++) ps.update(DT);
    expect(ps.y[0]).toBeGreaterThan(40);
  });

  it('spins, or follows its velocity', () => {
    const spin = system({ spin: [4, 4], rotation: 'none' });
    spin.spawn('test', 0, 0);
    for (let i = 0; i < 30; i++) spin.update(DT);
    expect(Math.abs(spin.rotation[0])).toBeCloseTo(2, 2);

    const follow = system({ rotation: 'velocity', speed: [100, 100], gravity: 800, life: [3, 3] });
    follow.spawn('test', 0, 0, 1, 0, 10_000);
    expect(follow.rotation[0]).toBeCloseTo(0, 5);
    for (let i = 0; i < 60; i++) follow.update(DT);
    // Now falling steeply: pointing mostly down the screen.
    expect(follow.rotation[0]).toBeGreaterThan(1.2);
    expect(follow.rotation[0]).toBeLessThan(Math.PI / 2);
  });

  it('scales positions, speeds and sizes by the size argument', () => {
    const ps = system({ speed: [100, 100], forward: [10, 10], scale: [2, 2] });
    ps.spawn('test', 0, 0, 1, 0, 0, 1);
    ps.spawn('test', 0, 0, 1, 0, 0, 0.5);
    expect(ps.x[0]).toBeCloseTo(10, 4);
    expect(ps.x[1]).toBeCloseTo(5, 4);
    expect(ps.scale[0]).toBeCloseTo(2, 4);
    expect(ps.scale[1]).toBeCloseTo(1, 4);
    ps.update(0.1);
    expect(ps.x[0]).toBeCloseTo(20, 3);
    expect(ps.x[1]).toBeCloseTo(10, 3);
  });
});

describe('particle look', () => {
  it('waits out its delay unseen and unmoved', () => {
    const ps = system({ delay: [0.5, 0.5], speed: [100, 100], life: [1, 1] });
    ps.spawn('test', 0, 0, 1, 0);
    expect(ps.alpha[0]).toBe(0);
    let seen = 0;
    const visit = (): void => {
      seen++;
    };
    for (let i = 0; i < 29; i++) ps.update(DT);
    ps.forEach(visit);
    expect(seen).toBe(0);
    expect(ps.x[0]).toBe(0);
    for (let i = 0; i < 6; i++) ps.update(DT);
    ps.forEach(visit);
    expect(seen).toBe(1);
    expect(ps.alpha[0]).toBeGreaterThan(0);
    expect(ps.x[0]).toBeGreaterThan(0);
    // The delay does not eat into its life.
    for (let i = 0; i < 50; i++) ps.update(DT);
    expect(ps.count).toBe(1);
    for (let i = 0; i < 10; i++) ps.update(DT);
    expect(ps.count).toBe(0);
  });

  it('fades in, holds, and fades out to nothing', () => {
    const ps = system({ alpha: 0.8, fadeIn: 0.2, fadeOut: 0.5, life: [1, 1] });
    ps.spawn('test', 0, 0);
    ps.update(0.1);
    expect(ps.alpha[0]).toBeCloseTo(0.4, 4);
    ps.update(0.2);
    expect(ps.alpha[0]).toBeCloseTo(0.8, 4);
    ps.update(0.45);
    expect(ps.alpha[0]).toBeCloseTo(0.4, 3);
    ps.update(0.24);
    expect(ps.alpha[0]).toBeLessThan(0.02);
    expect(ps.alpha[0]).toBeGreaterThanOrEqual(0);
  });

  it('grows along its scale curve, front-loaded when eased', () => {
    const linear = system({ scale: [1, 1], grow: 3, life: [1, 1] });
    const eased = system({ scale: [1, 1], grow: 3, growEase: 2, life: [1, 1] });
    linear.spawn('test', 0, 0);
    eased.spawn('test', 0, 0);
    linear.update(0.5);
    eased.update(0.5);
    expect(linear.scale[0]).toBeCloseTo(2, 4);
    expect(eased.scale[0]).toBeCloseTo(2.5, 4);
    linear.update(0.49);
    eased.update(0.49);
    expect(linear.scale[0]).toBeCloseTo(2.98, 2);
    expect(eased.scale[0]).toBeCloseTo(3, 2);
  });

  it('shrinks when grow is below 1', () => {
    const ps = system({ scale: [2, 2], grow: 0.5, life: [1, 1] });
    ps.spawn('test', 0, 0);
    ps.update(0.5);
    expect(ps.scale[0]).toBeCloseTo(1.5, 4);
  });

  it('plays animated sprites in order, once', () => {
    const frames = ['fx/fireball/0', 'fx/fireball/1', 'fx/fireball/2', 'fx/fireball/3'];
    const ps = system({ sprites: frames, spriteMode: 'animate', life: [1, 1] });
    ps.spawn('test', 0, 0);
    const seen: number[] = [ps.sprite[0]];
    for (let i = 0; i < 59; i++) {
      ps.update(DT);
      if (ps.count > 0 && seen[seen.length - 1] !== ps.sprite[0]) seen.push(ps.sprite[0]);
    }
    expect(seen).toEqual(frames.map((key) => FX_SPRITE_KEYS.indexOf(key)));
  });

  it('picks one sprite per particle from the list and keeps it', () => {
    const keys = ['fx/smoke/0', 'fx/smoke/1', 'fx/smoke/2', 'fx/smoke/3'];
    const ps = system({ sprites: keys, count: [40, 40], life: [1, 1] });
    ps.spawn('test', 0, 0);
    const first = Array.from(ps.sprite.subarray(0, 40));
    expect(new Set(first).size).toBeGreaterThan(1);
    for (const s of first) expect(keys).toContain(FX_SPRITE_KEYS[s]);
    for (let i = 0; i < 30; i++) ps.update(DT);
    expect(Array.from(ps.sprite.subarray(0, 40))).toEqual(first);
  });

  it('hands the renderer position, rotation, scale, alpha, sprite and layer', () => {
    const ps = system({ count: [3, 3], layer: 'glow', scale: [1.5, 1.5], alpha: 0.5 });
    ps.spawn('test', 7, 9);
    const rows: number[][] = [];
    ps.forEach((x, y, rotation, scale, alpha, sprite, layer) => {
      rows.push([x, y, rotation, scale, alpha, sprite, layer]);
    });
    expect(rows.length).toBe(3);
    const glow = FX_LAYERS.findIndex((l) => l.name === 'glow');
    for (const row of rows) expect(row).toEqual([7, 9, 0, 1.5, 0.5, FX_SPRITE_KEYS.indexOf('fx/dirt/0'), glow]);
    expect(FX_LAYERS[glow].additive).toBe(true);
  });

  it('rejects presets that name unknown sprites', () => {
    expect(() => new ParticleSystem(createRng(1), 8, single({ sprites: ['fx/nope'] }))).toThrow();
  });
});

describe('real presets', () => {
  it('all play to completion with finite values and visible output', () => {
    for (const id of FX_PRESET_IDS) {
      const ps = createParticles(createRng(99));
      ps.spawn(id, 500, VIEW.groundY - 20, 1, 0, VIEW.groundY);
      expect(ps.count).toBeGreaterThan(0);
      let visible = 0;
      const visit = (x: number, y: number, rotation: number, scale: number, alpha: number, sprite: number, layer: number): void => {
        visible++;
        expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(rotation)).toBe(true);
        expect(scale).toBeGreaterThan(0);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(1);
        expect(sprite).toBeLessThan(FX_SPRITE_KEYS.length);
        expect(layer).toBeLessThan(FX_LAYERS.length);
      };
      let frames = 0;
      while (ps.count > 0 && frames < 60 * 12) {
        ps.update(DT);
        ps.forEach(visit);
        frames++;
      }
      expect(ps.count).toBe(0);
      expect(visible).toBeGreaterThan(0);
    }
  });

  it('a cartridge case flips up and back, lands on the ground and stays there', () => {
    const ps = createParticles(createRng(5));
    ps.spawn('casing', 100, VIEW.groundY - 40, 1, 0, VIEW.groundY);
    let highest: number = VIEW.groundY;
    for (let i = 0; i < 48; i++) {
      ps.update(DT);
      highest = Math.min(highest, ps.y[0]);
      expect(ps.y[0]).toBeLessThanOrEqual(VIEW.groundY);
    }
    expect(highest).toBeLessThan(VIEW.groundY - 40);
    expect(ps.x[0]).toBeLessThan(100);
    expect(ps.y[0]).toBeGreaterThan(VIEW.groundY - 8);
  });

  it('a battle-sized burst of effects fits the pool', () => {
    const ps = createParticles(createRng(6));
    // A barrage: four big explosions and two shells in a quarter of a second, with gunfire and a burning tank.
    for (let frame = 0; frame < 120; frame++) {
      if (frame < 16 && frame % 4 === 0) ps.spawn('bigExplosion', 300 + frame * 20, VIEW.groundY);
      if (frame === 6 || frame === 12) ps.spawn('shellExplosion', 700, VIEW.groundY);
      if (frame % 6 === 0) {
        ps.spawn('tankFire', 900, VIEW.groundY - 30);
        for (let g = 0; g < 6; g++) {
          ps.spawn('muzzleFlash', 100 + g * 20, VIEW.groundY - 40);
          ps.spawn('casing', 100 + g * 20, VIEW.groundY - 40);
        }
      }
      ps.update(DT);
    }
    expect(ps.dropped).toBe(0);
  });
});

describe('screen shake', () => {
  it('is still until jolted, wobbles within the amplitude, and dies away in the given time', () => {
    const shake = createShake();
    shake.update(DT);
    expect(shake.x).toBe(0);
    expect(shake.y).toBe(0);
    shake.add('large');
    let peak = 0;
    let time = 0;
    while (time < FX_SHAKE.large.duration - DT) {
      shake.update(DT);
      time += DT;
      peak = Math.max(peak, Math.abs(shake.x), Math.abs(shake.y));
      expect(Math.abs(shake.x)).toBeLessThanOrEqual(FX_SHAKE.large.amplitude);
    }
    expect(peak).toBeGreaterThan(FX_SHAKE.large.amplitude * 0.4);
    shake.update(DT);
    shake.update(DT);
    shake.update(DT);
    expect(shake.x).toBe(0);
    expect(shake.y).toBe(0);
  });

  it('a smaller jolt does not cut a bigger one short', () => {
    const shake = createShake();
    shake.add('large');
    shake.add('small');
    let peak = 0;
    for (let i = 0; i < 10; i++) {
      shake.update(DT);
      peak = Math.max(peak, Math.abs(shake.x));
    }
    expect(peak).toBeGreaterThan(FX_SHAKE.small.amplitude);
  });

  it('weakens with distance off screen', () => {
    expect(shakeStrength(500, 0, 1000)).toBe(1);
    expect(shakeStrength(0, 0, 1000)).toBe(1);
    expect(shakeStrength(1000 + FX.shakeFalloff / 2, 0, 1000)).toBeCloseTo(0.5, 6);
    expect(shakeStrength(-FX.shakeFalloff * 2, 0, 1000)).toBe(0);
  });
});
