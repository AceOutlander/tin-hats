/**
 * Effects that come from the battle's state rather than from one event:
 * delayed spawns (impacts that wait for their tracer), long burners (tank
 * wrecks), footstep and track dust, tank exhausts, the smoke and fire of a
 * damaged headquarters, and smoke-screen clouds.
 */
import { TANK_LAYOUT } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import { RENDER } from '../../data/render';
import type { BattleState } from '../../sim';
import type { GunPoint } from '../structures';
import type { EffectContext } from './index';
import { PRESET_DEFS, type PresetId } from './presets';

const R = RENDER.fx;
const FIRE_POINTS = 3;
const MAX_BURNERS = 12;

/** Spawns that wait a moment: a hit or miss lands when its tracer arrives. */
export class DelayedFx {
  private count = 0;
  private readonly id: PresetId[] = [];
  private readonly t: Float32Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly dx: Float32Array;
  private readonly dy: Float32Array;
  private readonly ground: Float32Array;
  private readonly size: Float32Array;

  constructor() {
    const n = R.delayedCapacity;
    this.t = new Float32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    this.ground = new Float32Array(n);
    this.size = new Float32Array(n);
  }

  add(id: PresetId, delay: number, x: number, y: number, dx: number, dy: number, ground: number, size: number): void {
    if (delay <= 0.001) {
      this.immediate?.(id, x, y, dx, dy, ground, size);
      return;
    }
    const n = this.count;
    if (n >= R.delayedCapacity) return;
    this.id[n] = id;
    this.t[n] = delay;
    this.x[n] = x;
    this.y[n] = y;
    this.dx[n] = dx;
    this.dy[n] = dy;
    this.ground[n] = ground;
    this.size[n] = size;
    this.count = n + 1;
  }

  /** Set by the owner: plays a preset at once (for delays of zero). */
  immediate: ((id: PresetId, x: number, y: number, dx: number, dy: number, ground: number, size: number) => void) | null = null;

  update(fx: EffectContext, dt: number): void {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const left = this.t[i] - dt;
      if (left <= 0) {
        fx.play(this.id[i], this.x[i], this.y[i], this.dx[i], this.dy[i], this.ground[i], this.size[i]);
        continue;
      }
      if (w !== i) {
        this.id[w] = this.id[i];
        this.x[w] = this.x[i];
        this.y[w] = this.y[i];
        this.dx[w] = this.dx[i];
        this.dy[w] = this.dy[i];
        this.ground[w] = this.ground[i];
        this.size[w] = this.size[i];
      }
      this.t[w] = left;
      w++;
    }
    this.count = w;
  }

  clear(): void {
    this.count = 0;
  }
}

/** Long-running emitters that stay where they were put (a burning tank wreck). */
export class Burners {
  private count = 0;
  private readonly id: PresetId[] = [];
  private readonly x: Float32Array = new Float32Array(MAX_BURNERS);
  private readonly y: Float32Array = new Float32Array(MAX_BURNERS);
  private readonly size: Float32Array = new Float32Array(MAX_BURNERS);
  private readonly interval: Float32Array = new Float32Array(MAX_BURNERS);
  private readonly timer: Float32Array = new Float32Array(MAX_BURNERS);
  private readonly left: Float32Array = new Float32Array(MAX_BURNERS);

  add(id: PresetId, x: number, y: number, size: number, duration: number): void {
    if (this.count >= MAX_BURNERS) return;
    const n = this.count++;
    this.id[n] = id;
    this.x[n] = x;
    this.y[n] = y;
    this.size[n] = size;
    this.interval[n] = intervalOf(id);
    this.timer[n] = 0;
    this.left[n] = duration;
  }

  update(fx: EffectContext, dt: number): void {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const left = this.left[i] - dt;
      if (left <= 0) continue;
      let t = this.timer[i] + dt;
      if (t >= this.interval[i]) {
        // Keep the remainder so the rate is right even when frames are longer than the interval.
        t = t - this.interval[i] < this.interval[i] ? t - this.interval[i] : 0;
        if (fx.onScreen(this.x[i] - 80, this.x[i] + 80) && fx.lowOk()) fx.play(this.id[i], this.x[i], this.y[i], 0, -1, this.y[i], this.size[i]);
      }
      if (w !== i) {
        this.id[w] = this.id[i];
        this.x[w] = this.x[i];
        this.y[w] = this.y[i];
        this.size[w] = this.size[i];
        this.interval[w] = this.interval[i];
      }
      this.timer[w] = t;
      this.left[w] = left;
      w++;
    }
    this.count = w;
  }

  clear(): void {
    this.count = 0;
  }
}

/** Seconds between spawns of a continuous preset (its `interval`), 0.2 if it has none. */
function intervalOf(id: PresetId): number {
  return PRESET_DEFS[id].interval ?? 0.2;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const GUN: GunPoint = { x: 0, y: 0, dir: 1 };

export class Ambient {
  readonly delayed = new DelayedFx();
  readonly burners = new Burners();
  private foot = new Float32Array(0);
  private track = new Float32Array(0);
  private exhaust = new Float32Array(0);
  private readonly smokeT = new Float32Array(2);
  private readonly fireT = new Float32Array(2 * FIRE_POINTS);
  private readonly ruinT = new Float32Array(2);
  private readonly smokePoint = new Int32Array(2);
  private smokeCloud = new Float32Array(0);
  /** Tanks near the view this frame (for the engine loop). */
  tanksNear = 0;

  constructor(fx: EffectContext) {
    this.delayed.immediate = (id, x, y, dx, dy, ground, size) => fx.play(id, x, y, dx, dy, ground, size);
  }

  clear(): void {
    this.delayed.clear();
    this.burners.clear();
    this.foot.fill(0);
    this.track.fill(0);
    this.exhaust.fill(0);
    this.smokeT.fill(0);
    this.fireT.fill(0);
    this.ruinT.fill(0);
    this.smokeCloud.fill(0);
    this.tanksNear = 0;
  }

  update(fx: EffectContext, state: BattleState, dt: number): void {
    this.delayed.update(fx, dt);
    this.burners.update(fx, dt);
    this.units(fx, state, dt);
    this.hqs(fx, state, dt);
    this.smokes(fx, state, dt);
  }

  private units(fx: EffectContext, state: BattleState, dt: number): void {
    const n = state.units.length;
    if (this.foot.length < n) {
      this.foot = new Float32Array(n);
      this.track = new Float32Array(n);
      this.exhaust = new Float32Array(n);
    }
    let tanks = 0;
    let puffs = 0;
    const F = R.foot;
    const T = R.tank;
    for (let i = 0; i < state.unitCount; i++) {
      const u = state.units[i];
      if (!u.alive || u.inside) continue;
      const v = fx.units.viewAtSlot(i);
      if (!v || !v.shown || v.unitId !== u.id) continue;
      if (u.kind === 'tank' || u.kind === 'heavyTank') {
        tanks++;
        const look = 'look' in v ? v.look : u.kind === 'heavyTank' ? FACTIONS[u.faction].look.heavyTank : FACTIONS[u.faction].look.tank;
        const L = TANK_LAYOUT[look];
        const speed = Math.abs(u.velX);
        if (speed >= T.minSpeed && u.action === 'move') {
          const t = this.track[i] + dt;
          if (t >= T.trackDust) {
            this.track[i] = 0;
            if (fx.lowOk()) fx.play('trackDust', v.x - v.facing * L.length * 0.45 * v.s, v.y + T.trackDustY, v.facing, 0, v.y, v.s);
          } else {
            this.track[i] = t;
          }
        }
        const e = this.exhaust[i] + dt * (speed >= T.minSpeed ? 1 : 0.5);
        if (e >= T.exhaust) {
          this.exhaust[i] = 0;
          if (fx.lowOk()) fx.play('exhaust', v.x + v.facing * v.s * L.exhaust.x, v.y + v.s * L.exhaust.y, -v.facing, -0.7, v.y, v.s);
        } else {
          this.exhaust[i] = e;
        }
        continue;
      }
      if (u.action !== 'move' || v.sink > 6 || v.alpha < 0.5) continue;
      const speed = Math.abs(u.velX);
      if (speed < F.minSpeed) {
        this.foot[i] = 0;
        continue;
      }
      let acc = this.foot[i] + speed * dt;
      while (acc >= F.stride) {
        acc -= F.stride;
        if (puffs < F.maxPerFrame && fx.lowOk()) {
          puffs++;
          const dir = u.velX >= 0 ? 1 : -1;
          fx.play('footDust', v.x - dir * 5, v.y, dir, 0, v.y, v.s);
        }
      }
      this.foot[i] = acc;
    }
    this.tanksNear = tanks;
  }

  private hqs(fx: EffectContext, state: BattleState, dt: number): void {
    const H = R.hq;
    for (let side = 0; side < 2; side++) {
      const hq = state.sides[side].hq;
      if (!hq) continue;
      if (!fx.onScreen(hq.x - 200, hq.x + 200)) continue;
      const frac = hq.maxHp > 0 ? hq.hp / hq.maxHp : 0;
      const ruinedAt = fx.ruinedAt[side];
      if (!hq.alive || ruinedAt >= 0) {
        const since = ruinedAt >= 0 ? fx.time - ruinedAt : 0;
        this.ruinT[side] += dt;
        if (this.ruinT[side] >= 0.16) {
          this.ruinT[side] = 0;
          if (fx.lowOk()) fx.play('hqRuinSmoke', hq.x + (fx.rng() - 0.5) * 110, fx.groundY(-1) - 30, 0, -1, fx.groundY(-1), 1);
        }
        if (since < H.ruinFireTime) this.fires(fx, side, FIRE_POINTS, 1, 0.1, dt);
        continue;
      }
      if (frac < H.smokeBelow) {
        const t = clamp01((H.smokeBelow - frac) / H.smokeBelow);
        this.smokeT[side] += dt;
        if (this.smokeT[side] >= lerp(H.smokeInterval[0], H.smokeInterval[1], t)) {
          this.smokeT[side] = 0;
          const k = this.smokePoint[side]++ % FIRE_POINTS;
          if (fx.structures.hqFire(side, k, GUN) && fx.lowOk()) fx.play('hqSmoke', GUN.x, GUN.y - 8, 0, -1, GUN.y, 0.7 + t * 0.7);
        }
      }
      if (frac < H.fireBelow) {
        const t = clamp01((H.fireBelow - frac) / H.fireBelow);
        const count = 1 + Math.floor(t * (FIRE_POINTS - 1 + 0.999));
        this.fires(fx, side, count, lerp(H.fireSize[0], H.fireSize[1], t), lerp(H.fireInterval[0], H.fireInterval[1], t), dt);
      }
    }
  }

  private fires(fx: EffectContext, side: number, count: number, size: number, interval: number, dt: number): void {
    for (let k = 0; k < count; k++) {
      const idx = side * FIRE_POINTS + k;
      this.fireT[idx] += dt;
      if (this.fireT[idx] < interval) continue;
      this.fireT[idx] = 0;
      if (fx.structures.hqFire(side, k, GUN) && fx.lowOk()) fx.play('tankFire', GUN.x, GUN.y, 0, -1, GUN.y, size);
    }
  }

  private smokes(fx: EffectContext, state: BattleState, dt: number): void {
    const list = state.smokes;
    if (this.smokeCloud.length < list.length) this.smokeCloud = new Float32Array(list.length);
    const base = intervalOf('smokeScreen');
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s.alive) {
        this.smokeCloud[i] = 0;
        continue;
      }
      if (s.timeLeft < 1.2 || !fx.onScreen(s.x - s.radius, s.x + s.radius)) continue;
      const t = this.smokeCloud[i] + dt;
      const interval = (base * R.smokeScreen.refRadius) / (Math.max(40, s.radius) * R.smokeScreen.density);
      if (t >= interval) {
        this.smokeCloud[i] = 0;
        const g = fx.groundY(-1);
        fx.play('smokeScreen', s.x + (fx.rng() * 2 - 1) * Math.max(0, s.radius - 40), g - R.smokeScreen.height * (0.4 + fx.rng() * 0.8), 0, -1, g, 1);
      } else {
        this.smokeCloud[i] = t;
      }
    }
  }
}
