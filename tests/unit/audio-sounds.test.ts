import { describe, expect, it } from 'vitest';
import { makeClipCurve, makeNoise, normalise, peakOf, seededRandom, softClip } from '../../src/audio/dsp';
import {
  AUDIO,
  LOOP_NAMES,
  LOOPS,
  ONE_SHOT_NAMES,
  ORDER_WHISTLE,
  SOUND_NAMES,
  SOUNDS,
  UI_SOUND,
  isSoundName,
  layerGainSum,
  soundDuration,
  type FilterDef,
  type LfoDef,
  type LoopDef,
  type SoundDef,
} from '../../src/data/sounds';

/** Every sound the brief asks for. */
const REQUIRED = [
  'rifleShot',
  'mgShot',
  'smgShot',
  'sniperShot',
  'bunkerMg',
  'grenadeExplosion',
  'mortarLaunch',
  'shellWhistle',
  'explosionMedium',
  'explosionLarge',
  'tankGun',
  'rocketLaunch',
  'ricochet',
  'dirtHit',
  'tankEngine',
  'uiClick',
  'uiDeny',
  'uiConfirm',
  'whistleFallBack',
  'whistleHold',
  'whistleAdvance',
  'unitTrained',
  'suppliesDelivered',
  'airdrop',
  'planeFlyby',
  'victorySting',
  'defeatSting',
  'rain',
  'thunder',
  // The audit of gameplay events: what the renderer was silent on.
  'grenadeThrow',
  'smokePop',
  'wireSnap',
  'pillboxCollapse',
  'supportCall',
  'trenchCaptured',
  'waveHorn',
  'timerTick',
];

const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
const COLORS = ['white', 'pink', 'brown'];
const FILTERS = ['lowpass', 'highpass', 'bandpass'];

function expectFreq(freq: number, label: string): void {
  expect(Number.isFinite(freq), label).toBe(true);
  expect(freq, label).toBeGreaterThanOrEqual(AUDIO.freqMin);
  expect(freq, label).toBeLessThanOrEqual(AUDIO.freqMax);
}

function expectFilter(filter: FilterDef | undefined, label: string): void {
  if (!filter) return;
  expect(FILTERS, label).toContain(filter.kind);
  expectFreq(filter.freq, `${label} filter freq`);
  if (filter.freqEnd !== undefined) expectFreq(filter.freqEnd, `${label} filter freqEnd`);
  if (filter.sweep !== undefined) expect(filter.sweep, `${label} filter sweep`).toBeGreaterThan(0);
  expect(filter.q, `${label} filter q`).toBeGreaterThanOrEqual(0);
  expect(filter.q, `${label} filter q`).toBeLessThanOrEqual(30);
}

function expectTremolo(lfo: LfoDef | undefined, label: string): void {
  if (!lfo) return;
  expect(lfo.rate, `${label} tremolo rate`).toBeGreaterThan(0);
  expect(lfo.rate, `${label} tremolo rate`).toBeLessThanOrEqual(60);
  expect(lfo.depth, `${label} tremolo depth`).toBeGreaterThan(0);
  expect(lfo.depth, `${label} tremolo depth`).toBeLessThanOrEqual(1);
}

function expectVibrato(lfo: LfoDef | undefined, freq: number, label: string): void {
  if (!lfo) return;
  expect(lfo.rate, `${label} vibrato rate`).toBeGreaterThan(0);
  expect(lfo.rate, `${label} vibrato rate`).toBeLessThanOrEqual(60);
  expect(lfo.depth, `${label} vibrato depth`).toBeGreaterThan(0);
  // The pitch must never swing down to zero.
  expect(lfo.depth, `${label} vibrato depth`).toBeLessThan(freq * 0.5);
}

describe('sound names', () => {
  it('defines every sound the game needs, once', () => {
    for (const name of REQUIRED) expect(SOUND_NAMES, name).toContain(name);
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
    expect(SOUND_NAMES).toEqual([...ONE_SHOT_NAMES, ...LOOP_NAMES]);
  });

  it('has a definition behind every name and no name in both tables', () => {
    for (const name of ONE_SHOT_NAMES) {
      expect(SOUNDS[name], name).toBeDefined();
      expect(name in LOOPS, name).toBe(false);
    }
    for (const name of LOOP_NAMES) expect(LOOPS[name], name).toBeDefined();
    expect(LOOP_NAMES).toEqual(expect.arrayContaining(['rain', 'tankEngine']));
  });

  it('recognises its own names and nothing else', () => {
    for (const name of SOUND_NAMES) expect(isSoundName(name)).toBe(true);
    expect(isSoundName('kazoo')).toBe(false);
    expect(isSoundName('')).toBe(false);
  });

  it('maps every order and UI feedback to a one-shot, with three different whistles', () => {
    const whistles = [ORDER_WHISTLE.fallBack, ORDER_WHISTLE.hold, ORDER_WHISTLE.advance];
    for (const name of whistles) expect(ONE_SHOT_NAMES).toContain(name);
    expect(new Set(whistles).size).toBe(3);
    for (const name of [UI_SOUND.click, UI_SOUND.deny, UI_SOUND.confirm]) expect(ONE_SHOT_NAMES).toContain(name);
  });
});

describe('one-shot definitions', () => {
  const entries = ONE_SHOT_NAMES.map((name) => [name, SOUNDS[name] as SoundDef] as const);

  it.each(entries)('%s has sane mix settings', (_name, def) => {
    expect(def.layers.length).toBeGreaterThan(0);
    expect(def.volume).toBeGreaterThan(AUDIO.minAudible);
    expect(def.volume).toBeLessThanOrEqual(0.9);
    expect(def.minInterval).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(def.maxVoices)).toBe(true);
    expect(def.maxVoices).toBeGreaterThanOrEqual(1);
    expect(def.maxVoices).toBeLessThanOrEqual(AUDIO.maxVoices);
    expect([0, 1]).toContain(def.priority);
    expect(def.pitchJitter).toBeGreaterThanOrEqual(0);
    expect(def.pitchJitter).toBeLessThanOrEqual(0.3);
    expect(def.reach).toBeGreaterThan(0);
    expect(Number.isInteger(def.variants)).toBe(true);
    expect(def.variants).toBeGreaterThanOrEqual(1);
    expect(def.variants).toBeLessThanOrEqual(4);
    const seconds = soundDuration(def);
    expect(seconds).toBeGreaterThan(0.01);
    expect(seconds).toBeLessThan(8);
    expect(layerGainSum(def)).toBeGreaterThan(0);
  });

  it.each(entries)('%s has well-formed layers', (name, def) => {
    def.layers.forEach((layer, i) => {
      const label = `${name} layer ${i}`;
      expect(layer.at, label).toBeGreaterThanOrEqual(0);
      expect(layer.gain, label).toBeGreaterThan(0);
      expect(layer.gain, label).toBeLessThanOrEqual(2);
      expect(layer.attack, `${label} attack`).toBeGreaterThan(0);
      expect(layer.hold, `${label} hold`).toBeGreaterThanOrEqual(0);
      expect(layer.decay, `${label} decay`).toBeGreaterThan(0);
      if (layer.decayShape !== undefined) expect(['exp', 'lin'], label).toContain(layer.decayShape);
      expectFilter(layer.filter, label);
      expectTremolo(layer.tremolo, label);
      if (layer.jitter) {
        expect(layer.jitter.at ?? 0, `${label} jitter at`).toBeGreaterThanOrEqual(0);
        expect(layer.jitter.gain ?? 0, `${label} jitter gain`).toBeGreaterThanOrEqual(0);
        expect(layer.jitter.gain ?? 0, `${label} jitter gain`).toBeLessThan(1);
        expect(layer.jitter.freq ?? 0, `${label} jitter freq`).toBeGreaterThanOrEqual(0);
        expect(layer.jitter.freq ?? 0, `${label} jitter freq`).toBeLessThanOrEqual(0.5);
      }
      if (layer.src === 'tone') {
        expect(WAVES, label).toContain(layer.wave);
        expectFreq(layer.freq, `${label} freq`);
        if (layer.freqEnd !== undefined) expectFreq(layer.freqEnd, `${label} freqEnd`);
        if (layer.sweep !== undefined) expect(layer.sweep, `${label} sweep`).toBeGreaterThan(0);
        if (layer.sweepDelay !== undefined) expect(layer.sweepDelay, `${label} sweepDelay`).toBeGreaterThanOrEqual(0);
        if (layer.detune !== undefined) expect(Math.abs(layer.detune), `${label} detune`).toBeLessThanOrEqual(100);
        expectVibrato(layer.vibrato, layer.freq, label);
      } else {
        expect(layer.src, label).toBe('noise');
        expect(COLORS, label).toContain(layer.color);
      }
    });
  });

  it('randomises thunder and keeps the weapon sounds short enough to retrigger', () => {
    expect(SOUNDS.thunder.variants).toBeGreaterThan(1);
    expect(SOUNDS.thunder.layers.some((layer) => layer.jitter !== undefined)).toBe(true);
    for (const name of ['mgShot', 'smgShot', 'bunkerMg'] as const) {
      expect(soundDuration(SOUNDS[name]), name).toBeLessThan(0.25);
      expect(SOUNDS[name].minInterval, name).toBeGreaterThan(0);
    }
    expect(soundDuration(SOUNDS.sniperShot)).toBeGreaterThan(soundDuration(SOUNDS.rifleShot) * 2);
    expect(soundDuration(SOUNDS.explosionLarge)).toBeGreaterThan(soundDuration(SOUNDS.explosionMedium));
  });

  it('protects UI, whistles and stings from the voice limiter but not gunfire', () => {
    for (const name of ['uiClick', 'uiDeny', 'uiConfirm', 'whistleHold', 'victorySting', 'defeatSting', 'supportCall', 'trenchCaptured', 'waveHorn', 'timerTick'] as const) {
      expect(SOUNDS[name].priority, name).toBe(1);
    }
    for (const name of ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'dirtHit', 'ricochet'] as const) {
      expect(SOUNDS[name].priority, name).toBe(0);
    }
  });
});

describe('the gunfire bed and the ducking blasts', () => {
  it('puts small arms and their impacts on the bed, and nothing that ducks', () => {
    const bed = ONE_SHOT_NAMES.filter((name) => (SOUNDS[name] as SoundDef).bed === true);
    expect(bed).toEqual(expect.arrayContaining(['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'dirtHit', 'ricochet']));
    for (const name of bed) expect((SOUNDS[name] as SoundDef).duck, name).toBeUndefined();
    // The UI, whistles and stings are never ducked: they are not on the bed.
    for (const name of ['uiClick', 'uiDeny', 'uiConfirm', 'whistleAdvance', 'victorySting', 'unitTrained']) expect(bed).not.toContain(name);
  });

  it('ducks the bed under blasts only, deeper and longer for bigger ones', () => {
    const ducking = ONE_SHOT_NAMES.filter((name) => (SOUNDS[name] as SoundDef).duck !== undefined);
    expect(ducking).toEqual(expect.arrayContaining(['grenadeExplosion', 'explosionMedium', 'explosionLarge', 'tankGun', 'pillboxCollapse']));
    for (const name of ducking) {
      const duck = (SOUNDS[name] as SoundDef).duck;
      expect(duck?.depth, name).toBeGreaterThan(0);
      expect(duck?.depth, name).toBeLessThanOrEqual(0.7);
      expect(duck?.seconds, name).toBeGreaterThan(0.1);
      expect(duck?.seconds, name).toBeLessThanOrEqual(1);
    }
    const duck = (name: 'grenadeExplosion' | 'explosionMedium' | 'explosionLarge'): { depth: number; seconds: number } => {
      const d = (SOUNDS[name] as SoundDef).duck;
      if (!d) throw new Error(`${name} does not duck`);
      return d;
    };
    expect(duck('explosionLarge').depth).toBeGreaterThan(duck('explosionMedium').depth);
    expect(duck('explosionMedium').depth).toBeGreaterThan(duck('grenadeExplosion').depth);
    expect(duck('explosionLarge').seconds).toBeGreaterThan(duck('explosionMedium').seconds);
    expect(AUDIO.duckAttack).toBeLessThan(AUDIO.duckRelease);
  });
});

describe('loop definitions', () => {
  const entries = LOOP_NAMES.map((name) => [name, LOOPS[name] as LoopDef] as const);

  it.each(entries)('%s is well-formed', (name, def) => {
    expect(def.layers.length).toBeGreaterThan(0);
    expect(def.volume).toBeGreaterThan(0);
    expect(def.volume).toBeLessThanOrEqual(1);
    expect(def.fadeIn).toBeGreaterThan(0);
    expect(def.fadeOut).toBeGreaterThan(0);
    def.layers.forEach((layer, i) => {
      const label = `${name} layer ${i}`;
      expect(layer.gain, label).toBeGreaterThan(0);
      expect(layer.gain, label).toBeLessThanOrEqual(2);
      expectFilter(layer.filter, label);
      // Loops hold their filters still.
      expect(layer.filter?.freqEnd, label).toBeUndefined();
      expectTremolo(layer.tremolo, label);
      if (layer.src === 'tone') {
        expect(WAVES, label).toContain(layer.wave);
        expectFreq(layer.freq, `${label} freq`);
        expectVibrato(layer.vibrato, layer.freq, label);
      } else {
        expect(COLORS, label).toContain(layer.color);
      }
    });
  });
});

describe('mix constants', () => {
  it('are internally consistent', () => {
    expect(AUDIO.maxVoices).toBeGreaterThan(0);
    expect(AUDIO.spareVoices).toBeGreaterThan(0);
    expect(AUDIO.clipKnee).toBeLessThan(AUDIO.clipCeiling);
    expect(AUDIO.clipCeiling).toBeLessThan(1);
    expect(AUDIO.clipRange).toBeGreaterThan(1);
    expect(AUDIO.compressor.threshold).toBeLessThan(0);
    expect(AUDIO.compressor.ratio).toBeGreaterThan(1);
    expect(AUDIO.panWidth).toBeLessThanOrEqual(1);
    expect(AUDIO.pitchMin).toBeLessThan(1);
    expect(AUDIO.pitchMax).toBeGreaterThan(1);
    expect(AUDIO.noiseCrossfade).toBeLessThan(AUDIO.noiseSeconds / 2);
  });
});

describe('signal helpers', () => {
  it('makes repeatable noise of each colour at the set level', () => {
    for (const color of ['white', 'pink', 'brown'] as const) {
      const a = makeNoise(color, 8000, 400);
      const b = makeNoise(color, 8000, 400);
      expect(a.length).toBe(8000);
      let power = 0;
      let mean = 0;
      for (let i = 0; i < a.length; i++) {
        expect(Number.isFinite(a[i])).toBe(true);
        power += a[i] * a[i];
        mean += a[i];
      }
      expect(Math.sqrt(power / a.length)).toBeCloseTo(AUDIO.noiseRms, 3);
      expect(Math.abs(mean / a.length)).toBeLessThan(1e-4);
      expect(Array.from(a.subarray(0, 32))).toEqual(Array.from(b.subarray(0, 32)));
    }
  });

  it('makes brown noise darker than pink, and pink darker than white', () => {
    // Mean absolute step between neighbouring samples: smaller means less high-frequency energy.
    const roughness = (data: Float32Array): number => {
      let sum = 0;
      for (let i = 1; i < data.length; i++) sum += Math.abs(data[i] - data[i - 1]);
      return sum / (data.length - 1);
    };
    const white = roughness(makeNoise('white', 20000, 0));
    const pink = roughness(makeNoise('pink', 20000, 0));
    const brown = roughness(makeNoise('brown', 20000, 0));
    expect(pink).toBeLessThan(white);
    expect(brown).toBeLessThan(pink * 0.5);
  });

  it('loops brown noise without a jump at the seam', () => {
    const data = makeNoise('brown', 20000, 2000);
    let typical = 0;
    for (let i = 1; i < data.length; i++) typical += Math.abs(data[i] - data[i - 1]);
    typical /= data.length - 1;
    const seam = Math.abs(data[0] - data[data.length - 1]);
    expect(seam).toBeLessThan(typical * 6);
    // Without the crossfade the two ends are unrelated and far apart.
    const plain = makeNoise('brown', 20000, 0);
    expect(Math.abs(plain[0] - plain[plain.length - 1])).toBeGreaterThan(seam);
  });

  it('soft-clips: identity below the knee, monotonic, never reaching the ceiling', () => {
    expect(softClip(0)).toBe(0);
    expect(softClip(0.3)).toBe(0.3);
    expect(softClip(-AUDIO.clipKnee)).toBe(-AUDIO.clipKnee);
    let previous = -Infinity;
    for (let x = -10; x <= 10; x += 0.01) {
      const y = softClip(x);
      expect(y).toBeGreaterThanOrEqual(previous);
      expect(Math.abs(y)).toBeLessThanOrEqual(AUDIO.clipCeiling);
      expect(softClip(-x)).toBeCloseTo(-y, 12);
      previous = y;
    }
    expect(softClip(100)).toBeLessThan(1);
  });

  it('builds a symmetric clip curve that stays below full scale', () => {
    const curve = makeClipCurve();
    expect(curve.length).toBe(AUDIO.clipCurveSize);
    expect(curve[(curve.length - 1) / 2]).toBe(0);
    // The curve is stored as 32-bit floats, so allow for rounding of the ceiling itself.
    expect(peakOf(curve)).toBeLessThanOrEqual(Math.fround(AUDIO.clipCeiling));
    expect(peakOf(curve)).toBeLessThan(1);
    expect(curve[0]).toBeCloseTo(-curve[curve.length - 1], 6);
    // The middle of the curve is the identity: input u maps to u * clipRange.
    const i = Math.round(((0.1 / AUDIO.clipRange + 1) / 2) * (curve.length - 1));
    expect(curve[i]).toBeCloseTo(0.1, 2);
  });

  it('normalises a buffer to a target peak, fades the end and reports the old peak', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < data.length; i++) data[i] = 0.2 * Math.sin(i * 0.3);
    data[500] = -0.25;
    const before = normalise(data, 0.5, 100);
    expect(before).toBeCloseTo(0.25, 6);
    expect(peakOf(data)).toBeCloseTo(0.5, 6);
    expect(Math.abs(data[999])).toBe(0);
    expect(Math.abs(data[998])).toBeLessThan(0.01);
    const silent = new Float32Array(100);
    expect(normalise(silent, 0.5, 10)).toBe(0);
    expect(peakOf(silent)).toBe(0);
  });

  it('has a repeatable seeded generator in 0..1', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const c = seededRandom(43);
    let differs = false;
    for (let i = 0; i < 200; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      if (value !== c()) differs = true;
    }
    expect(differs).toBe(true);
  });
});
