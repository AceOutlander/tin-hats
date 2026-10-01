import { describe, expect, it } from 'vitest';
import {
  FRAC,
  STEPS,
  clockSeconds,
  formatClock,
  formatIncome,
  hpLevel,
  incomeTenths,
  quant,
  shortName,
  stickValue,
  stripFrac,
} from '../../src/ui/hud/format';
import { lighten } from '../../src/ui/hud/minimap';

describe('hud quantising', () => {
  it('clamps and rounds fractions to 0..STEPS', () => {
    expect(quant(0)).toBe(0);
    expect(quant(-3)).toBe(0);
    expect(quant(Number.NaN)).toBe(0);
    expect(quant(1)).toBe(STEPS);
    expect(quant(7)).toBe(STEPS);
    expect(quant(0.5)).toBe(STEPS / 2);
    expect(quant(0.004)).toBe(0);
  });

  it('has a prebuilt CSS string for every step', () => {
    expect(FRAC).toHaveLength(STEPS + 1);
    expect(FRAC[0]).toBe('0');
    expect(FRAC[STEPS]).toBe('1');
    expect(FRAC[25]).toBe('0.25');
  });

  it('bands health into good, worn and critical', () => {
    expect(hpLevel(quant(1))).toBe(2);
    expect(hpLevel(quant(0.51))).toBe(2);
    expect(hpLevel(quant(0.5))).toBe(1);
    expect(hpLevel(quant(0.26))).toBe(1);
    expect(hpLevel(quant(0.25))).toBe(0);
    expect(hpLevel(quant(0))).toBe(0);
  });
});

describe('hud text', () => {
  it('rounds countdowns up and formats m:ss', () => {
    expect(clockSeconds(24.2)).toBe(25);
    expect(clockSeconds(0.01)).toBe(1);
    expect(clockSeconds(0)).toBe(0);
    expect(clockSeconds(-4)).toBe(0);
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3600)).toBe('60:00');
  });

  it('formats income in tenths', () => {
    expect(formatIncome(incomeTenths(2.5))).toBe('+2.5/s');
    expect(formatIncome(incomeTenths(0))).toBe('+0.0/s');
    expect(formatIncome(incomeTenths(12.04))).toBe('+12.0/s');
    expect(formatIncome(incomeTenths(-1.5))).toBe('-1.5/s');
    expect(incomeTenths(Number.NaN)).toBe(0);
  });

  it('shortens long names to their first word only when needed', () => {
    expect(shortName('Rifleman', 10)).toBe('Rifleman');
    expect(shortName('Assault Trooper', 10)).toBe('Assault');
    expect(shortName('Bren Gunner', 10)).toBe('Bren');
    expect(shortName('Bren Gunner', 11)).toBe('Bren Gunner');
    expect(shortName('PIAT Team', 6)).toBe('PIAT');
    expect(shortName('  Sniper  ', 10)).toBe('Sniper');
    expect(shortName('Mortarmen', 4)).toBe('Mortarmen');
  });
});

describe('hud joystick and strip maths', () => {
  it('returns 0 inside the dead zone and +-1 at the rim', () => {
    expect(stickValue(0, 40, 0.14)).toBe(0);
    expect(stickValue(5, 40, 0.14)).toBe(0);
    expect(stickValue(40, 40, 0.14)).toBe(1);
    expect(stickValue(-40, 40, 0.14)).toBe(-1);
    expect(stickValue(400, 40, 0.14)).toBe(1);
    expect(stickValue(-400, 40, 0.14)).toBe(-1);
  });

  it('ramps smoothly and symmetrically in steps of 0.05', () => {
    const half = stickValue(20, 40, 0.14);
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.6);
    expect(stickValue(-20, 40, 0.14)).toBe(-half);
    expect(Math.round(half * 20)).toBeCloseTo(half * 20, 9);
  });

  it('is safe with a bad radius or offset', () => {
    expect(stickValue(10, 0, 0.14)).toBe(0);
    expect(stickValue(Number.NaN, 40, 0.14)).toBe(0);
  });

  it('maps a pointer x to 0..1 along a padded strip', () => {
    expect(stripFrac(100, 100, 400, 4)).toBe(0);
    expect(stripFrac(500, 100, 400, 4)).toBe(1);
    expect(stripFrac(300, 100, 400, 0)).toBeCloseTo(0.5, 9);
    expect(stripFrac(300, 100, 400, 4)).toBeCloseTo(0.5, 9);
    expect(stripFrac(-50, 100, 400, 4)).toBe(0);
    expect(stripFrac(900, 100, 400, 4)).toBe(1);
    expect(stripFrac(5, 0, 6, 4)).toBe(0);
  });
});

describe('minimap colours', () => {
  it('mixes a hex colour toward white', () => {
    expect(lighten('#000000', 0.5)).toBe('rgb(128, 128, 128)');
    expect(lighten('#ffffff', 0.5)).toBe('rgb(255, 255, 255)');
    expect(lighten('#8c7b4a', 0)).toBe('rgb(140, 123, 74)');
  });

  it('leaves other colour formats alone', () => {
    expect(lighten('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)');
    expect(lighten('red', 0.5)).toBe('red');
  });
});
