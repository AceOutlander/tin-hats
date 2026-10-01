/**
 * Weather view. The controller in src/fx decides (once per battle, from the
 * view's own seeded random source) whether it rains and, while it does, makes
 * one thunder check for every 2 s of unpaused battle time; this file draws the
 * result:
 *
 * - rain: two depths of streaks in screen space that slide a little with the
 *   camera pan, ground splashes on the walkable band, a dark desaturated grade
 *   over the sky and backdrop and a lighter one over the whole scene;
 * - lightning: a bolt in the sky, a double white flash over everything, then
 *   thunder after its delay.
 *
 * Nothing here touches the simulation or its random numbers.
 */
import type Phaser from 'phaser';
import { FX_KEYS } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { TheatreId } from '../../data/schema';
import { THEATRES } from '../../data/theatres';
import { VIEW } from '../../data/view';
import { WEATHER, type RainLook } from '../../data/weather';
import { createLightning, createRainField, createRng, createWeather, type LightningFx, type RainField, type Rng01, type Weather, type WeatherOverride } from '../../fx';
import type { SpriteRegistry } from '../atlas';
import type { WeatherMode, WeatherStats } from '../contracts';
import type { EffectContext } from '../effects';
import { addImage, type Layers } from '../layers';
import { RENDER_KEYS, WHITE_SIZE } from '../sprites';
import { BoltView } from './bolt';
import { lightningRng, weatherRng } from './rng';

type Img = Phaser.GameObjects.Image;

const W = RENDER.weather;
const LIGHT = WEATHER.lightning;
/** The rain data with the streak counts scaled by the view's density setting. */
const LOOK: RainLook = {
  ...WEATHER.rain,
  layers: [
    { ...WEATHER.rain.layers[0], streaks: WEATHER.rain.layers[0].streaks * W.density },
    { ...WEATHER.rain.layers[1], streaks: WEATHER.rain.layers[1].streaks * W.density },
  ],
};
/** The grey that colours are pulled toward in the rain. */
const GREY = { r: 0x80, g: 0x85, b: 0x8c };
const GREY_TINT = 0x80858c;

function hex(s: string): number {
  return parseInt(s.slice(1), 16);
}

const SKY_TINT = hex(LOOK.skyTint);
const FLASH_TINT = hex(LIGHT.flashColor);

/** Stretch a top-left-anchored white square to the rectangle (x, y, w, h) in wu. */
function fit(img: Img, x: number, y: number, w: number, h: number): void {
  img.x = x;
  img.y = y;
  img.scaleX = w / WHITE_SIZE / VIEW.textureScale;
  img.scaleY = h / WHITE_SIZE / VIEW.textureScale;
}

export class WeatherView {
  private weather: Weather | null = null;
  private lightning: LightningFx | null = null;
  private field: RainField | null = null;
  private fieldW = 0;
  private rng: Rng01 = createRng(1);
  private lightRng: Rng01 = createRng(2);
  private theatre: TheatreId = 'france';
  private readonly streaks: Img[] = [];
  private readonly rainLayer: Phaser.GameObjects.Layer;
  private readonly farInv: number;
  private readonly nearInv: number;
  private readonly skyGrade: Img;
  private readonly sceneGrade: Img;
  private readonly flash: Img;
  private readonly bolt: BoltView;
  private lastIntensity = -1;
  private lastShare = 1;
  private streaksShown = false;
  private flashShown = false;
  private boltShown = false;
  private attached = false;

  constructor(
    scene: Phaser.Scene,
    layers: Layers,
    private readonly reg: SpriteRegistry,
    private readonly fx: EffectContext,
  ) {
    this.rainLayer = layers.byName.rain;
    this.farInv = LOOK.layers[0].scale / reg.get(FX_KEYS.rain.far).scale;
    this.nearInv = LOOK.layers[1].scale / reg.get(FX_KEYS.rain.near).scale;
    const white = reg.get(RENDER_KEYS.whiteTL).frame;
    this.skyGrade = addImage(scene, layers.grade, white);
    this.skyGrade.setTint(SKY_TINT);
    this.skyGrade.visible = false;
    this.bolt = new BoltView(scene, layers.grade, reg);
    this.sceneGrade = addImage(scene, layers.byName.nightTint, white);
    this.sceneGrade.setTint(GREY_TINT);
    this.sceneGrade.visible = false;
    this.flash = addImage(scene, layers.byName.lightningFlash, white);
    this.flash.setTint(FLASH_TINT);
    this.flash.visible = false;
  }

  /**
   * Start a battle's weather: roll the rain (40% per map, from src/data/weather.ts) from the visual seed,
   * or take the requested mode. Restarts the thunder checks.
   */
  attach(visualSeed: number, mode: WeatherMode, theatre: TheatreId): void {
    this.rng = weatherRng(visualSeed);
    this.lightRng = lightningRng(visualSeed);
    this.theatre = theatre;
    this.attached = true;
    this.decide(mode === 'auto' ? undefined : mode);
  }

  /** Back to nothing (battle detached). */
  clear(): void {
    this.attached = false;
    this.weather = null;
    this.lightning = null;
    this.field = null;
    this.fx.sound.rain(false);
    this.hideAll();
  }

  /** Debug: change the weather now. The rain fades in again and the thunder checks start over. */
  force(mode: 'rain' | 'clear'): void {
    if (this.attached) this.decide(mode);
  }

  /** Debug: a lightning strike on the next update, rain or not. */
  forceThunder(): void {
    this.weather?.forceThunder();
  }

  stats(): WeatherStats {
    const w = this.weather;
    return { raining: w?.raining ?? false, checksMade: w?.checksMade ?? 0, strikes: w?.strikes ?? 0 };
  }

  private decide(override: WeatherOverride): void {
    this.weather = createWeather(this.rng, WEATHER, override);
    this.lightning = createLightning(this.lightRng);
    this.field = null;
    this.fieldW = 0;
    this.lastIntensity = -1;
    this.fx.sound.rain(this.weather.raining);
    this.hideAll();
  }

  private hideAll(): void {
    this.skyGrade.visible = false;
    this.sceneGrade.visible = false;
    this.flash.visible = false;
    this.bolt.hide();
    for (const s of this.streaks) s.visible = false;
    this.streaksShown = false;
    this.flashShown = false;
    this.boltShown = false;
  }

  /**
   * Advance by dt battle seconds (0 while paused) and draw. `enabled` is false while fast-forwarding:
   * the weather itself still runs (the thunder checks must not skip time) but streaks, splashes, flashes and sounds are left out.
   */
  update(dt: number, camLeft: number, viewW: number, enabled: boolean): void {
    const weather = this.weather;
    const lightning = this.lightning;
    if (!weather || !lightning) return;
    const struck = weather.update(dt);
    for (let i = 0; i < struck; i++) lightning.strike(camLeft, viewW);
    if (lightning.update(dt) && enabled) this.fx.sound.global('thunder', RENDER.audio.thunderVolume);
    this.drawLightning(lightning, camLeft, viewW, enabled);
    if (weather.raining) this.drawRain(dt, camLeft, viewW, enabled);
  }

  private drawLightning(lightning: LightningFx, camLeft: number, viewW: number, enabled: boolean): void {
    const m = W.margin;
    const flash = enabled ? lightning.flash : 0;
    if (flash > 0.002) {
      fit(this.flash, camLeft - m, -m, viewW + 2 * m, VIEW.heightWu + 2 * m);
      this.flash.alpha = Math.min(1, flash * LIGHT.flashAlpha * W.flashGain);
      this.flash.visible = true;
      this.flashShown = true;
    } else if (this.flashShown) {
      this.flash.visible = false;
      this.flashShown = false;
    }
    const a = enabled ? lightning.boltAlpha : 0;
    if (a > 0.002) {
      this.bolt.draw(lightning.bolt, a);
      this.boltShown = true;
    } else if (this.boltShown) {
      this.bolt.hide();
      this.boltShown = false;
    }
  }

  private ensureField(viewW: number): RainField {
    const width = viewW + 2 * W.margin;
    if (this.field && Math.abs(width - this.fieldW) < 2) return this.field;
    const intensity = this.field ? this.field.intensity : 0;
    const field = createRainField(this.rng, width, VIEW.heightWu, LOOK);
    this.field = field;
    this.fieldW = width;
    // Keep the fade-in where it was when the view is resized: advance a fresh field by the same amount.
    if (intensity > 0) field.update(intensity * LOOK.fadeIn);
    for (let i = 0; i < field.count; i++) {
      let img = this.streaks[i] as Img | undefined;
      const far = field.layer[i] === 0;
      if (!img) {
        img = addImage(this.fx.scene, this.rainLayer, this.reg.get(far ? FX_KEYS.rain.far : FX_KEYS.rain.near).frame);
        this.streaks.push(img);
      }
      img.setFrame(this.reg.get(far ? FX_KEYS.rain.far : FX_KEYS.rain.near).frame);
      img.rotation = field.rotation;
      img.setScale(far ? this.farInv : this.nearInv);
      img.visible = false;
    }
    for (let i = field.count; i < this.streaks.length; i++) this.streaks[i].visible = false;
    this.streaksShown = false;
    this.lastIntensity = -1;
    return field;
  }

  private drawRain(dt: number, camLeft: number, viewW: number, enabled: boolean): void {
    const field = this.ensureField(viewW);
    const splashes = field.update(dt);
    const intensity = field.intensity;
    const m = W.margin;
    const grade = THEATRES[this.theatre].rain;
    // Sky and backdrop: the flat dark tint. Whole scene: the theatre's own darken and desaturate.
    fit(this.skyGrade, camLeft - m, -m, viewW + 2 * m, VIEW.heightWu + 2 * m);
    this.skyGrade.alpha = LOOK.skyDarken * intensity;
    this.skyGrade.visible = true;
    const s = grade.desaturate * W.sceneGrade * intensity;
    const d = grade.darken * W.sceneGrade * intensity;
    const alpha = 1 - (1 - s) * (1 - d);
    fit(this.sceneGrade, camLeft - m, -m, viewW + 2 * m, VIEW.heightWu + 2 * m);
    this.sceneGrade.alpha = alpha;
    this.sceneGrade.setTint(alpha > 0.001 ? this.mixTint((s * (1 - d)) / alpha) : GREY_TINT);
    this.sceneGrade.visible = true;

    if (!enabled) {
      if (this.streaksShown) {
        for (let i = 0; i < field.count; i++) this.streaks[i].visible = false;
        this.streaksShown = false;
      }
      return;
    }
    const base = camLeft - m;
    const wrap = this.fieldW;
    const parFar = W.parallax[0] * camLeft;
    const parNear = W.parallax[1] * camLeft;
    // A lower quality level draws an even share of the streaks.
    const share = this.fx.quality.weatherShare;
    const alphaChanged = intensity !== this.lastIntensity || share !== this.lastShare;
    this.lastIntensity = intensity;
    this.lastShare = share;
    for (let i = 0; i < field.count; i++) {
      const img = this.streaks[i];
      if (share < 1 && Math.floor((i + 1) * share) === Math.floor(i * share)) {
        img.visible = false;
        continue;
      }
      const far = i < field.farCount;
      let x = (field.x[i] - (far ? parFar : parNear)) % wrap;
      if (x < 0) x += wrap;
      img.x = base + x;
      img.y = field.y[i];
      if (alphaChanged || !this.streaksShown) img.alpha = LOOK.layers[far ? 0 : 1].alpha * intensity;
      img.visible = true;
    }
    this.streaksShown = true;
    if (dt > 0 && this.fx.lowOk()) {
      for (let i = 0; i < splashes; i++) {
        const y = field.splashY();
        this.fx.play('rainSplash', base + field.splashX(), y, 0, 0, y, W.splashSize);
      }
    }
  }

  /** The tint that is the rain grey scaled toward black: share k of the grey (the rest is the darkness). */
  private mixTint(k: number): number {
    const c = Math.max(0, Math.min(1, k));
    const r = Math.round(GREY.r * c);
    const g = Math.round(GREY.g * c);
    const b = Math.round(GREY.b * c);
    return (r << 16) | (g << 8) | b;
  }
}
