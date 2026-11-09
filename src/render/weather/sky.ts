/**
 * Scripted weather and time of day on screen (FOUNDATIONS.md 4.7). The sim owns the state (BattleState.sky: the
 * weather and time now, the latest change of each and the flares burning); this file draws it, crossfading every
 * change over its whole span while the sim switches at the midpoint:
 * - a veil over the sky and backdrop strips and a lighter one over the whole scene, by weather;
 * - drifting particle fields: snowflakes, the blizzard's driven snow, dust clouds and grit, smoke drifting over the
 *   city, fog banks along the ground;
 * - flares: the star sinking under its parachute, its halo, and the pool of light on the ground (strong at night);
 * - the time of day: the backdrop's skies crossfaded and its land tinted (BackdropView.setSkyMix and setLandTint), and
 *   the night tint's opacity, which the battle view reads back (nightAlpha).
 * Nothing here touches the sim or its random numbers.
 */
import type Phaser from 'phaser';
import { FX_SPRITES } from '../../data/fx';
import type { MissionDef, TimeOfDay, WeatherKind } from '../../data/schema';
import { VIEW } from '../../data/view';
import { FLARE_LOOK, WEATHER_LOOKS, type DriftFieldLook } from '../../data/weather';
import { DriftField, createRng, landTint, mixSeed, nightTintAlpha, rgbInt, weatherVeils, weatherWeight, type Rgb01, type Rng01, type Veil } from '../../fx';
import { timeBlend, weatherBlend, type BattleState } from '../../sim';
import type { SpriteRegistry } from '../atlas';
import type { EffectContext } from '../effects';
import type { BackdropView } from '../backdrop';
import { addImage, type Layers } from '../layers';
import { RENDER_KEYS, WHITE_SIZE } from '../sprites';

type Img = Phaser.GameObjects.Image;

/** Salt for the sky's own random source (the particles), mixed into the visual seed. */
const SKY_SALT = 0x5c1e7a;
/** Particle images are drawn this far (wu) beyond each side of the view. */
const MARGIN = 40;

function fit(img: Img, x: number, y: number, w: number, h: number): void {
  img.x = x;
  img.y = y;
  img.scaleX = w / WHITE_SIZE / VIEW.textureScale;
  img.scaleY = h / WHITE_SIZE / VIEW.textureScale;
}

function hex(s: string): number {
  return parseInt(s.slice(1), 16);
}

/** One drifting field on screen: its particles and their images. */
interface FieldView {
  kind: WeatherKind;
  look: DriftFieldLook;
  field: DriftField;
  images: Img[];
  /** Per image: the drawn size over the sprite's size, before the texture scale. */
  scale: number[];
  shown: boolean;
}

/** The weather kinds a mission can show: its start and every weather event's. */
export function missionWeathers(m: MissionDef): WeatherKind[] {
  const out = new Set<WeatherKind>([m.weather ?? 'clear']);
  const scan = (events: MissionDef['events']): void => {
    for (const e of events) if (e.type === 'weather') out.add(e.to);
  };
  scan(m.events);
  for (const p of m.phases ?? []) scan(p.onEnter ?? []);
  return [...out];
}

/** The times of day a mission passes through: its start and every time event's, in order of first appearance. */
export function missionTimes(m: MissionDef): TimeOfDay[] {
  const out: TimeOfDay[] = [m.timeOfDay];
  const scan = (events: MissionDef['events']): void => {
    for (const e of events) if (e.type === 'time' && !out.includes(e.to)) out.push(e.to);
  };
  scan(m.events);
  for (const p of m.phases ?? []) scan(p.onEnter ?? []);
  return out;
}

export class SkyView {
  private readonly skyVeil: Img;
  private readonly sceneVeil: Img;
  private readonly fields: FieldView[] = [];
  private readonly flares: { star: Img; halo: Img; pool: Img }[] = [];
  private readonly sky: Veil = { color: { r: 1, g: 1, b: 1 }, alpha: 0 };
  private readonly scene: Veil = { color: { r: 1, g: 1, b: 1 }, alpha: 0 };
  private readonly tint: Rgb01 = { r: 1, g: 1, b: 1 };
  private rng: Rng01 = createRng(1);
  private kinds: WeatherKind[] = [];
  private fieldW = 0;
  /** The time the backdrop's land was painted in, and whether the mission changes the time at all. */
  private baseTime: TimeOfDay = 'day';
  private timed = false;
  private attached = false;
  /** The night tint's opacity the battle view should use now (scripted time of day), or -1 to keep its own. */
  nightAlpha = -1;

  constructor(
    private readonly phaser: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
    private readonly fx: EffectContext,
    private readonly backdrop: BackdropView,
  ) {
    const white = reg.get(RENDER_KEYS.whiteTL).frame;
    this.skyVeil = addImage(phaser, layers.grade, white);
    this.skyVeil.visible = false;
    this.sceneVeil = addImage(phaser, layers.byName.nightTint, white);
    this.sceneVeil.visible = false;
  }

  /**
   * Start a battle: which weathers it can show (their fields are made as needed), and, for a mission whose time of
   * day changes, the time its backdrop land was painted in (`baseTime`).
   */
  attach(mission: MissionDef, visualSeed: number, baseTime: TimeOfDay, timed: boolean): void {
    this.clear();
    this.rng = createRng(mixSeed(visualSeed, SKY_SALT));
    this.kinds = missionWeathers(mission);
    this.baseTime = baseTime;
    this.timed = timed;
    this.attached = true;
  }

  clear(): void {
    this.attached = false;
    this.nightAlpha = -1;
    for (const f of this.fields) for (const img of f.images) img.destroy();
    this.fields.length = 0;
    this.fieldW = 0;
    this.skyVeil.visible = false;
    this.sceneVeil.visible = false;
    for (const f of this.flares) {
      f.star.visible = false;
      f.halo.visible = false;
      f.pool.visible = false;
    }
  }

  /** The weathers' fields for a view `viewW` wide (rebuilt when the width changes). */
  private ensureFields(viewW: number): void {
    const width = viewW + 2 * MARGIN;
    if (this.fields.length > 0 && Math.abs(width - this.fieldW) < 2) return;
    for (const f of this.fields) for (const img of f.images) img.destroy();
    this.fields.length = 0;
    this.fieldW = width;
    for (const kind of this.kinds) {
      for (const look of WEATHER_LOOKS[kind].fields) {
        const field = new DriftField(this.rng, width, look);
        const layer = look.sprite === 'flake' ? this.layers.byName.rain : this.layers.byName.smokeScreen;
        const images: Img[] = [];
        const scale: number[] = [];
        for (let i = 0; i < field.count; i++) {
          const key = spriteKey(look.sprite, i);
          const frame = this.reg.get(key);
          const img = addImage(this.phaser, layer, frame.frame);
          img.setTint(hex(look.tint));
          img.visible = false;
          images.push(img);
          scale.push(field.size[i] / frame.w / frame.scale);
        }
        this.fields.push({ kind, look, field, images, scale, shown: false });
      }
    }
  }

  /**
   * Advance by dt battle seconds (0 while paused) and draw. `enabled` is false while fast-forwarding (the fields still
   * drift, nothing is drawn). `night` is how dark the scene is now (0..1).
   */
  update(s: BattleState, dt: number, camLeft: number, viewW: number, enabled: boolean, night: number): void {
    if (!this.attached) return;
    const sky = s.sky;
    // The time of day: the skies crossfade, the land darkens, the night tint follows.
    if (this.timed) {
      const k = timeBlend(s);
      const from = sky.timeOver > 0 ? sky.timeFrom : sky.time;
      const to = sky.timeOver > 0 ? sky.timeTo : sky.time;
      this.backdrop.setSkyMix(from, to, k);
      this.backdrop.setLandTint(rgbInt(landTint(this.baseTime, from, to, k, this.tint)));
      this.nightAlpha = nightTintAlpha(from, to, k);
    }
    // The weather: veils and fields at their share of the crossfade.
    const wk = weatherBlend(s);
    const wFrom = sky.weatherOver > 0 ? sky.weatherFrom : sky.weather;
    const wTo = sky.weatherOver > 0 ? sky.weatherTo : sky.weather;
    weatherVeils(wFrom, wTo, wk, this.sky, this.scene);
    const m = MARGIN;
    this.veil(this.skyVeil, this.sky, camLeft - m, viewW + 2 * m);
    this.veil(this.sceneVeil, this.scene, camLeft - m, viewW + 2 * m);
    if (this.kinds.some((k) => WEATHER_LOOKS[k].fields.length > 0)) this.drawFields(dt, camLeft, viewW, enabled, night, wFrom, wTo, wk);
    this.drawFlares(s, camLeft, viewW, enabled, night);
  }

  /** How much rain the scripted weather shows now (0..1), for the rain streaks. */
  static rainShare(s: BattleState): number {
    const sky = s.sky;
    const from = sky.weatherOver > 0 ? sky.weatherFrom : sky.weather;
    const to = sky.weatherOver > 0 ? sky.weatherTo : sky.weather;
    return weatherWeight('rain', from, to, weatherBlend(s));
  }

  private veil(img: Img, v: Veil, x: number, w: number): void {
    if (v.alpha < 0.002) {
      img.visible = false;
      return;
    }
    fit(img, x, -MARGIN, w, VIEW.heightWu + 2 * MARGIN);
    img.setTint(rgbInt(v.color));
    img.alpha = Math.min(1, v.alpha);
    img.visible = true;
  }

  private drawFields(dt: number, camLeft: number, viewW: number, enabled: boolean, night: number, from: WeatherKind, to: WeatherKind, k: number): void {
    this.ensureFields(viewW);
    const share = this.fx.quality.weatherShare;
    const dim = 1 - 0.55 * night;
    const base = camLeft - MARGIN;
    for (const f of this.fields) {
      const weight = weatherWeight(f.kind, from, to, k);
      f.field.update(dt);
      if (!enabled || weight < 0.01) {
        if (f.shown) for (const img of f.images) img.visible = false;
        f.shown = false;
        continue;
      }
      const field = f.field;
      const wrap = field.width;
      const shift = f.look.parallax * camLeft;
      for (let i = 0; i < field.count; i++) {
        const img = f.images[i];
        if (share < 1 && Math.floor((i + 1) * share) === Math.floor(i * share)) {
          img.visible = false;
          continue;
        }
        let x = (field.x[i] - shift) % wrap;
        if (x < 0) x += wrap;
        img.x = base + x;
        img.y = field.y[i];
        img.setScale(f.scale[i]);
        img.alpha = field.alpha[i] * weight * (f.look.sprite === 'flake' ? 1 : dim);
        img.visible = true;
      }
      f.shown = true;
    }
  }

  private drawFlares(s: BattleState, camLeft: number, viewW: number, enabled: boolean, night: number): void {
    const flares = s.sky.flares;
    const L = FLARE_LOOK;
    const glow = this.reg.get(FX_SPRITES.glow[0]);
    while (this.flares.length < flares.length) {
      const make = (): Img => {
        const img = addImage(this.phaser, this.layers.glow, glow.frame);
        img.visible = false;
        return img;
      };
      this.flares.push({ pool: make(), halo: make(), star: make() });
    }
    for (let i = 0; i < this.flares.length; i++) {
      const v = this.flares[i];
      const f = i < flares.length ? flares[i] : null;
      const near = f !== null && f.x1 >= camLeft - L.halo && f.x0 <= camLeft + viewW + L.halo;
      if (!enabled || f === null || !near) {
        v.star.visible = false;
        v.halo.visible = false;
        v.pool.visible = false;
        continue;
      }
      const life = f.until - f.from;
      const t = s.time - f.from;
      const p = life > 0 ? Math.min(1, Math.max(0, t / life)) : 1;
      const up = Math.min(1, t / L.rise);
      const down = Math.min(1, Math.max(0, (f.until - s.time) / L.fade));
      const bright = up * down;
      const color = hex(L.colors[f.color]);
      const x = f.x + (f.side === 0 ? 1 : -1) * L.drift * p;
      const y = L.burstY + (L.endY - L.burstY) * p;
      const unit = 1 / glow.w / glow.scale;
      v.star.x = x;
      v.star.y = y;
      v.star.setScale(L.star * unit);
      v.star.setTint(0xffffff);
      v.star.alpha = bright;
      v.star.visible = true;
      v.halo.x = x;
      v.halo.y = y;
      v.halo.setScale(L.halo * unit);
      v.halo.setTint(color);
      v.halo.alpha = bright * (0.35 + 0.4 * night);
      v.halo.visible = true;
      v.pool.x = f.x;
      v.pool.y = VIEW.groundY;
      v.pool.scaleX = (f.x1 - f.x0) * unit;
      v.pool.scaleY = 220 * unit;
      v.pool.setTint(color);
      v.pool.alpha = bright * (L.poolDay + (L.poolNight - L.poolDay) * night);
      v.pool.visible = true;
    }
  }
}

function spriteKey(sprite: DriftFieldLook['sprite'], i: number): string {
  switch (sprite) {
    case 'flake':
      return FX_SPRITES.glow[0];
    case 'dust':
      return FX_SPRITES.dust[i % FX_SPRITES.dust.length];
    case 'smoke':
      return FX_SPRITES.smoke[i % FX_SPRITES.smoke.length];
    case 'fog':
      return FX_SPRITES.smokeLight[i % FX_SPRITES.smokeLight.length];
  }
}
