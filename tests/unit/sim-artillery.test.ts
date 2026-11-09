/**
 * Realistic artillery (owner, 2026-11-09): guns kilometres away and never shown; a delay of a few seconds before the
 * first shell lands, then shells one by one over several seconds, each falling steeply from above the screen with a
 * whistle that rises as it falls; scatter around the target; a faint target marker for the player's own barrages only;
 * enemy barrages whistle too. Applies to the artillery and Katyusha call-ins and every scripted barrage.
 */
import { describe, expect, it } from 'vitest';
import type { BarrageWeapon, SupportKind } from '../../src/data/schema';
import { SOUNDS, soundDuration, type SoundDef } from '../../src/data/sounds';
import { OFF_MAP, SUPPORTS, offMapFire } from '../../src/data/supports';
import { WEAPONS } from '../../src/data/weapons';
import { targetMarkerPeak } from '../../src/render/effects/callinMath';
import { DT, collect, makeBattle, testMission, type Seen } from './sim-helpers';

const OFF_MAP_SUPPORTS: readonly SupportKind[] = ['artillery', 'katyusha'];

/** Every projectile and explosion of call-in `kind` fired by `side` at x 3000. */
function strike(kind: SupportKind, seed = 1, side: 0 | 1 = 0): { shells: Seen[]; landed: Seen[] } {
  const b = makeBattle({ seed, mission: testMission({ supports: side === 0 ? [[kind], []] : [[], [kind]] }) });
  b.command(side, { type: 'support', kind, x: 3000 });
  const def = SUPPORTS[kind];
  const events = collect(b, def.delay + def.duration + 2, 'projectile', 'explosion');
  return {
    shells: events.filter((e) => e.type === 'projectile' && e.weapon === def.weapon),
    landed: events.filter((e) => e.type === 'explosion' && e.weapon === def.weapon),
  };
}

describe('off-map artillery and rockets', () => {
  it.each(OFF_MAP_SUPPORTS)('%s: nothing lands for a few seconds after the call, then the first round', (kind) => {
    const def = SUPPORTS[kind];
    expect(def.delay).toBeGreaterThanOrEqual(3);
    const { shells, landed } = strike(kind);
    const t0 = DT; // the call is taken on the first step
    // Within a few ticks (the call is taken mid-tick, a round lands on the tick its flight is up).
    expect(Math.abs(landed[0].time - t0 - def.delay)).toBeLessThanOrEqual(3 * DT);
    // The whistle starts one fall before the landing: the round is already in the air, fired unseen.
    expect(shells[0].time - t0).toBeCloseTo(def.delay - OFF_MAP[def.weapon as BarrageWeapon].fall, 1);
  });

  it.each(OFF_MAP_SUPPORTS)('%s: rounds arrive one by one over several seconds, never all at once', (kind) => {
    const def = SUPPORTS[kind];
    const { landed } = strike(kind);
    expect(landed).toHaveLength(def.rounds);
    for (let i = 1; i < landed.length; i++) expect(landed[i].time - landed[i - 1].time).toBeGreaterThan(DT / 2);
    expect(landed[landed.length - 1].time - landed[0].time).toBeCloseTo(def.duration, 1);
    expect(def.duration).toBeGreaterThanOrEqual(4);
  });

  it.each(OFF_MAP_SUPPORTS)('%s: falls steeply from off the map (no gun on the battlefield)', (kind) => {
    const def = SUPPORTS[kind];
    const off = OFF_MAP[def.weapon as BarrageWeapon];
    for (const side of [0, 1] as const) {
      const { shells } = strike(kind, 1, side);
      for (const s of shells) {
        expect(s.hit).toBe(true);
        expect(s.source).toBe('none');
        expect(s.value).toBeCloseTo(off.fall, 9);
        // Enters a little short of its landing point on the firer's side: steep, not a flat shot from a visible gun.
        expect((s.x2 - s.x) * (side === 0 ? 1 : -1)).toBeCloseTo(off.slant, 6);
        expect(off.slant).toBeLessThan(off.fall * 150);
      }
    }
  });

  it.each(OFF_MAP_SUPPORTS)('%s: scatters around the target area, not pinpoint', (kind) => {
    const def = SUPPORTS[kind];
    const xs = [1, 2, 3, 4].flatMap((seed) => strike(kind, seed).landed.map((e) => e.x));
    for (const x of xs) expect(Math.abs(x - 3000)).toBeLessThanOrEqual(def.spread + 1e-9);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBeGreaterThan(xs.length * 0.9);
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    expect(sd).toBeGreaterThan(def.spread * 0.35);
    expect(Math.abs(mean - 3000)).toBeLessThan(def.spread * 0.4);
  });

  it.each(OFF_MAP_SUPPORTS)('%s: is deterministic for a seed (scatter from the battle RNG)', (kind) => {
    const a = strike(kind, 7).landed.map((e) => [e.time, e.x]);
    const b = strike(kind, 7).landed.map((e) => [e.time, e.x]);
    const c = strike(kind, 8).landed.map((e) => e.x);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a.map((p) => p[1]));
  });
});

describe('scripted barrages', () => {
  const barrage = (side: 0 | 1, weapon: BarrageWeapon, seed = 3): Seen[] => {
    const m = testMission({
      events: [{ type: 'barrage', when: { at: 1 }, side, x: 2500, spread: 200, rounds: 5, duration: 4, weapon, warning: 'Incoming!' }],
    });
    return collect(makeBattle({ mission: m, seed }), 14, 'barrageCalled', 'projectile', 'explosion');
  };

  it.each(Object.keys(OFF_MAP) as BarrageWeapon[])('%s comes from off the map, one by one, after its warning delay', (weapon) => {
    const seen = barrage(1, weapon);
    const shells = seen.filter((e) => e.type === 'projectile' && e.weapon === weapon);
    const landed = seen.filter((e) => e.type === 'explosion' && e.weapon === weapon);
    const called = seen.filter((e) => e.type === 'barrageCalled');
    expect(called).toHaveLength(1);
    expect(called[0]).toMatchObject({ side: 1, weapon, x: 2500, value: 200, row2: 5 });
    expect(shells).toHaveLength(5);
    expect(shells.every((s) => s.hit && s.value === OFF_MAP[weapon].fall)).toBe(true);
    // A warned barrage waits 3 s, then each round falls for its fall time.
    expect(landed[0].time - called[0].time).toBeCloseTo(3 + OFF_MAP[weapon].fall, 1);
    expect(called[0].x2).toBeCloseTo(3 + OFF_MAP[weapon].fall + 4, 9);
    for (let i = 1; i < landed.length; i++) expect(landed[i].time - landed[i - 1].time).toBeCloseTo(1, 1);
    for (const e of landed) expect(Math.abs(e.x - 2500)).toBeLessThanOrEqual(200);
  });

  it('is deterministic for a seed', () => {
    const xs = (seed: number): number[] => barrage(0, 'artilleryShell', seed).filter((e) => e.type === 'explosion').map((e) => e.x);
    expect(xs(11)).toEqual(xs(11));
    expect(xs(11)).not.toEqual(xs(12));
  });
});

describe('the target marker', () => {
  it('shows faintly for the player\'s own barrages and call-ins only', () => {
    for (const player of [0, 1]) {
      const own = targetMarkerPeak(player, player);
      expect(own).toBeGreaterThan(0);
      expect(own).toBeLessThanOrEqual(0.5);
      expect(targetMarkerPeak(1 - player, player)).toBe(0);
    }
  });
});

describe('the incoming whistle', () => {
  const rising = (def: SoundDef): boolean =>
    def.layers.every((l) => l.src !== 'tone' || (l.freqEnd !== undefined && l.freqEnd > l.freq));

  it.each(Object.keys(OFF_MAP) as BarrageWeapon[])('%s: rises in pitch for exactly its fall and is heard from far off', (weapon) => {
    const name = OFF_MAP[weapon].sound;
    const def = SOUNDS[name];
    expect(WEAPONS[weapon]).toBeDefined();
    expect(def, name).toBeDefined();
    expect(rising(def), name).toBe(true);
    expect(Math.abs(soundDuration(def) - OFF_MAP[weapon].fall)).toBeLessThan(0.05);
    // Heard well beyond the view: an enemy barrage's whistle is the warning to take cover.
    expect(def.reach).toBeGreaterThanOrEqual(2);
  });

  it('is only for fire from off the map', () => {
    expect(offMapFire('rifle')).toBeNull();
    expect(offMapFire('aerialBomb')).not.toBeNull();
    expect(offMapFire(null)).toBeNull();
  });
});
