import { describe, expect, it } from 'vitest';
import { MusicIntensity, type IntensityState } from '../../src/app/musicIntensity';
import { MUSIC_BATTLE, type MusicLayer } from '../../src/data/musicBattle';

const R = MUSIC_BATTLE.intensity;

interface FakeUnit {
  alive: boolean;
  inside: boolean;
  side: number;
  x: number;
  mount: { weapon: object | null };
}

/** A battle with the player's HQ at x = 0 and the enemy's far to the right. */
class Field {
  time = 0;
  units: FakeUnit[] = [];
  hq = { x: 0, hp: 1000, alive: true };
  timer: { secondsLeft: number } | null = null;
  over = false;

  /** `n` armed soldiers of `side` spread over [from, to]. */
  add(side: number, n: number, from: number, to: number, armed = true): this {
    for (let i = 0; i < n; i++) this.units.push({ alive: true, inside: false, side, x: from + ((to - from) * i) / Math.max(1, n - 1), mount: { weapon: armed ? {} : null } });
    return this;
  }

  clear(side: number): this {
    this.units = this.units.filter((u) => u.side !== side);
    return this;
  }

  get state(): IntensityState {
    return {
      time: this.time,
      units: this.units,
      unitCount: this.units.length,
      sides: [{ hq: this.hq }, { hq: null }],
      timer: this.timer,
      over: this.over,
    } as unknown as IntensityState;
  }
}

/** Run the rules every 1/30 s of battle time for `seconds`; returns the layers in the order they were reached. */
function play(m: MusicIntensity, f: Field, seconds: number): MusicLayer[] {
  const out: MusicLayer[] = [];
  const end = f.time + seconds;
  while (f.time < end - 1e-9) {
    f.time += 1 / 30;
    const l = m.update(f.state);
    if (out[out.length - 1] !== l) out.push(l);
  }
  return out;
}

/** Two armies meeting at x = 3000: `a` of the player's, `b` of the enemy's, inside the band. */
function fight(a: number, b: number): Field {
  return new Field().add(0, a, 2700, 3000).add(1, b, 3100, 3400);
}

describe('the battle-music intensity rules', () => {
  it('calls for combat at 20 armed soldiers a side close together, not at 19', () => {
    expect(R.combat.enter).toBe(20);
    const m = new MusicIntensity();
    const f = fight(20, 20);
    expect(play(m, f, 30)).toEqual(['build', 'combat']);
    expect(m.fighting).toEqual([20, 20]);
    const n = new MusicIntensity();
    expect(play(n, fight(19, 40), 30)).toEqual(['build']);
    // Unarmed men (sappers) do not count.
    const s = new MusicIntensity();
    expect(play(s, fight(19, 20).add(0, 5, 2900, 3000, false), 30)).toEqual(['build']);
  });

  it('only counts soldiers within the band of the other front, and only when the fronts are that close', () => {
    const m = new MusicIntensity();
    // Two armies of 30 a long way apart: no fight.
    const far = new Field().add(0, 30, 500, 1500).add(1, 30, 1500 + R.combat.band + 50, 4000);
    expect(play(m, far, 30)).toEqual(['build']);
    expect(m.fighting).toEqual([0, 0]);
    // The fronts touch, but most of each army is far behind its front: only the ones near count.
    const m2 = new MusicIntensity();
    const strung = new Field().add(0, 10, 2700, 3000).add(0, 30, 0, 1500).add(1, 30, 3100, 3300);
    expect(play(m2, strung, 30)).toEqual(['build']);
    expect(m2.fighting[0]).toBe(10);
  });

  it('holds combat until a side falls below the exit count (hysteresis), and for the hold time at least', () => {
    const m = new MusicIntensity();
    const f = fight(25, 25);
    play(m, f, 20);
    expect(m.layer).toBe('combat');
    const changed = f.time;
    // Down to 15 a side: between exit (14) and enter (20), still combat.
    f.clear(0).add(0, 15, 2700, 3000);
    play(m, f, 60);
    expect(m.layer).toBe('combat');
    // Below the exit count: back to build, but never before the hold time is over and the calm confirmed.
    f.clear(0).add(0, R.combat.exit - 1, 2700, 3000);
    const layers = play(m, f, 60);
    expect(layers).toEqual(['combat', 'build']);
    expect(f.time - changed).toBeGreaterThanOrEqual(R.hold.combat);
  });

  it('never flips layer more often than the hold times allow, however the fight flickers', () => {
    const m = new MusicIntensity();
    const busy = fight(30, 30);
    const quiet = new Field().add(0, 5, 2700, 3000).add(1, 5, 3100, 3400);
    const changes: number[] = [];
    const layers: MusicLayer[] = [m.layer];
    let last = m.layer;
    for (let k = 0; k < 600; k++) {
      // The fight comes and goes every three seconds.
      const f = Math.floor(k / 90) % 2 === 0 ? busy : quiet;
      f.time = k / 30;
      const l = m.update(f.state);
      if (l !== last) {
        changes.push(f.time);
        layers.push(l);
        last = l;
      }
    }
    expect(changes.length).toBeGreaterThan(0);
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i] - changes[i - 1]).toBeGreaterThanOrEqual(R.escalateHold - 1e-9);
      // Going back to the layer it just left waits that layer's full hold: no flipping back and forth.
      if (layers[i + 1] === layers[i - 1]) expect(changes[i] - changes[i - 1]).toBeGreaterThanOrEqual(R.hold[layers[i]] - 1e-9);
    }
  });

  it('turns tense when the HQ is hit or an enemy comes near it, and above combat', () => {
    // Damage to the HQ.
    const m = new MusicIntensity();
    const f = new Field();
    play(m, f, 12);
    f.hq.hp -= 50;
    expect(play(m, f, 3)).toEqual(['build', 'tense']);
    // It eases off once the damage is old and the hold is over.
    play(m, f, R.tense.damageSeconds + R.hold.tense + R.confirm.build + 2);
    expect(m.layer).toBe('build');
    // An enemy walks up to the HQ: tense within the enter distance, kept until it is beyond the exit distance.
    const n = new MusicIntensity();
    const g = new Field().add(1, 1, R.tense.enterDistance - 10, R.tense.enterDistance - 10);
    play(n, g, 15);
    expect(n.layer).toBe('tense');
    g.units[0].x = (R.tense.enterDistance + R.tense.exitDistance) / 2;
    play(n, g, 40);
    expect(n.layer).toBe('tense');
    g.units[0].x = R.tense.exitDistance + 50;
    play(n, g, 40);
    expect(n.layer).toBe('build');
    // A big fight and the HQ under fire: tense wins.
    const o = new MusicIntensity();
    const h = fight(30, 30);
    play(o, h, 30);
    expect(o.layer).toBe('combat');
    h.hq.hp -= 10;
    // Rising to tense waits only the short escalation hold, well inside the damage window.
    play(o, h, R.escalateHold + R.confirm.tense + 1.5);
    expect(o.layer).toBe('tense');
  });

  it('keeps counting the fight while the HQ is threatened, so combat after the threat needs 20 a side again', () => {
    const m = new MusicIntensity();
    const h = fight(30, 30);
    play(m, h, 30);
    expect(m.layer).toBe('combat');
    // An enemy at the HQ: tense, and the fight is still counted meanwhile.
    h.add(1, 1, R.tense.enterDistance - 10, R.tense.enterDistance - 10);
    play(m, h, R.escalateHold + R.confirm.tense + 2);
    expect(m.layer).toBe('tense');
    // The fight dies down to 5 a side (below the exit count), then builds back up to 16: between exit and enter.
    h.clear(0).add(0, 5, 2700, 3000);
    play(m, h, 10);
    expect(m.fighting[0]).toBe(5);
    h.clear(0).add(0, 16, 2700, 3000);
    play(m, h, 10);
    // The threat goes: 16 a side never reached 20 again, so the music calms to build instead of falling back to combat.
    h.units = h.units.filter((u) => !(u.side === 1 && u.x < 1000));
    const layers = play(m, h, R.hold.tense + R.confirm.build + 10);
    expect(layers).toEqual(['tense', 'build']);
    expect(m.changes.map((c) => c.to)).toEqual(['combat', 'tense', 'build']);
    expect(m.changes[0].fighting).toEqual([30, 30]);
    expect(m.changes[1].near).toBe(true);
  });

  it('turns tense when a survival or deadline clock is nearly out', () => {
    const m = new MusicIntensity();
    const f = new Field();
    f.timer = { secondsLeft: R.tense.timerSeconds + 30 };
    play(m, f, 15);
    expect(m.layer).toBe('build');
    f.timer.secondsLeft = R.tense.timerSeconds - 1;
    play(m, f, 3);
    expect(m.layer).toBe('tense');
  });

  it('plays the prep layer in a prep phase, can be forced by the debug hooks, and stops checking when the battle is over', () => {
    const m = new MusicIntensity();
    const f = new Field();
    m.setPrep(true);
    play(m, f, R.hold.build + 2);
    expect(m.layer).toBe('prep');
    m.setPrep(false);
    play(m, f, R.hold.prep + R.confirm.build + 2);
    expect(m.layer).toBe('build');
    m.force('combat');
    expect(m.layer).toBe('combat');
    play(m, f, 30);
    expect(m.layer).toBe('combat');
    m.force(null);
    play(m, f, R.hold.combat + R.confirm.build + 2);
    expect(m.layer).toBe('build');
    f.over = true;
    f.hq.hp = 1;
    play(m, f, 5);
    expect(m.layer).toBe('build');
  });

  it('keeps its numbers in data: thresholds, the band, distances, confirm and hold times', () => {
    expect(R.combat.exit).toBeLessThan(R.combat.enter);
    expect(R.tense.exitDistance).toBeGreaterThan(R.tense.enterDistance);
    expect(R.escalateHold).toBeGreaterThanOrEqual(3);
    for (const layer of ['build', 'combat', 'tense', 'prep'] as const) {
      expect(R.hold[layer]).toBeGreaterThanOrEqual(5);
      expect(R.confirm[layer]).toBeGreaterThanOrEqual(0);
    }
    // Crossfades of several seconds.
    for (const s of Object.values(MUSIC_BATTLE.player.crossfade)) expect(s).toBeGreaterThanOrEqual(2);
  });
});
