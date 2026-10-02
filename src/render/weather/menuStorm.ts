/**
 * The title screen's storm, drawn: the French fields under a storm light, rain in three depths (a faint slow layer
 * behind the tree line, sharper and faster ones in front, the nearest over everything), splashes on the grass, the
 * flash that lights the sky and, now and then, a fork in the distance behind the church spire so the spire stands out
 * against it. The timing comes from src/fx/menuStorm.ts; every number from src/data/menuStorm.ts.
 *
 * Pooled images only: after the first frames nothing is created, and a frame writes positions and nothing else.
 */
import type Phaser from 'phaser';
import { franceSpireTileX } from '../../art/backdrops';
import { FX_SPRITES } from '../../data/fx';
import { MENU_STORM, type MenuTints } from '../../data/menuStorm';
import { VIEW, VIEW_TOP_WU } from '../../data/view';
import { createBoltBuffer, generateBolt, MenuRain, type MenuStormState } from '../../fx';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import type { BackdropView } from '../backdrop';
import type { MenuSceneStats } from '../contracts';
import { addImage, type Layers } from '../layers';
import { RENDER_KEYS, WHITE_SIZE } from '../sprites';
import { BoltView } from './bolt';

type Img = Phaser.GameObjects.Image;

const M = MENU_STORM;
const SLOTS: readonly (keyof MenuTints)[] = ['sky', 'clouds', 'farBackdrop', 'midBackdrop', 'nearBackdrop', 'ground', 'foreground'];
/** Seed of the rain field's own random numbers. */
const RAIN_SEED = 0x7e1a;

function hex(s: string): number {
  return parseInt(s.slice(1), 16);
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Colour a mixed toward b by t (0..1), as 0xRRGGBB. */
function mix(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * k);
  return (r << 16) | (g << 8) | bl;
}

export class MenuStormView {
  private shown = false;
  private readonly rain: MenuRain;
  private readonly streaks: Img[][] = [];
  private readonly drawn: Int32Array;
  private readonly splashImgs: Img[] = [];
  private readonly splashFrame: Int8Array;
  private readonly splashFrames: SpriteFrame[];
  private readonly streakFrame: SpriteFrame;
  private readonly streakLayers: Phaser.GameObjects.Layer[];
  private readonly skyFlash: Img;
  private readonly forkGlow: Img;
  private readonly glowFrame: SpriteFrame;
  private readonly bolt: BoltView;
  private readonly boltBuf = createBoltBuffer(M.fork.shape);
  private boltSeq = -1;
  private boltShown = false;
  private readonly stormTint: Int32Array;
  private readonly flashTint = hex(M.colours.flash);
  private readonly rainTint = hex(M.rain.colour);
  /** Where the camera sits and where the spire is, for the current backdrop build and screen width. */
  private placedVersion = -1;
  private placedW = -1;
  private left = 0;
  private spireOffset = 0;
  private spireY = 230;
  /** Rain layout inputs last used, and the fade the streak opacities were last set for. */
  private laidW = -1;
  private laidH = -1;
  private laidView = -1;
  private laidShare = -1;
  private lastFade = -1;
  private readonly statsOut: MenuSceneStats = { shown: false, drops: [0, 0, 0], splashes: 0, rainShare: 1, spireX: 0, spireY: 0, forkDrawn: false, skyFlash: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    reg: SpriteRegistry,
    private readonly backdrop: BackdropView,
  ) {
    this.rain = new MenuRain(RAIN_SEED, VIEW_TOP_WU - M.rain.overscan, VIEW.viewBottomWu + M.rain.overscan);
    this.drawn = new Int32Array(this.rain.layers);
    this.streakFrame = reg.get(RENDER_KEYS.streak);
    this.streakLayers = [layers.byName.menuRainFar, layers.byName.menuRainMid, layers.byName.rain];
    for (let l = 0; l < this.rain.layers; l++) this.streaks.push([]);
    this.splashFrames = FX_SPRITES.rainSplash.map((key) => reg.get(key));
    this.splashFrame = new Int8Array(M.rain.maxSplashes).fill(-1);
    const white = reg.get(RENDER_KEYS.whiteTL).frame;
    this.skyFlash = addImage(scene, layers.byName.menuSkyFlash, white);
    this.skyFlash.setTint(hex(M.colours.skyFlash));
    this.skyFlash.visible = false;
    this.glowFrame = reg.get(RENDER_KEYS.glow);
    this.forkGlow = addImage(scene, layers.byName.menuFork, this.glowFrame.frame);
    this.forkGlow.setTint(hex(M.fork.glowColour));
    this.forkGlow.visible = false;
    this.bolt = new BoltView(scene, layers.byName.menuFork, reg);
    this.stormTint = new Int32Array(SLOTS.length);
    for (let i = 0; i < SLOTS.length; i++) this.stormTint[i] = hex(M.colours.storm[SLOTS[i]]);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Put the storm scene up (building the backdrop the first time and after a battle replaced it), or take it down. */
  show(on: boolean): void {
    if (on) {
      const S = M.scene;
      this.backdrop.build(S.theatre, S.timeOfDay, S.seed);
      this.backdrop.setAllHidden(false);
      // A storm has no sun.
      this.backdrop.setHidden('celestial', true);
      this.shown = true;
      return;
    }
    if (!this.shown) return;
    this.shown = false;
    this.hideAll();
    // The menus behind the title show a dark page, as before the storm.
    this.backdrop.resetLook();
    this.backdrop.setAllHidden(true);
  }

  private hideAll(): void {
    for (let l = 0; l < this.streaks.length; l++) {
      for (const img of this.streaks[l]) img.visible = false;
      this.drawn[l] = 0;
    }
    for (const img of this.splashImgs) img.visible = false;
    this.splashFrame.fill(-1);
    this.skyFlash.visible = false;
    this.forkGlow.visible = false;
    this.bolt.hide();
    this.boltShown = false;
    this.lastFade = -1;
  }

  /**
   * Where the camera's left edge goes for a view viewW wu wide: the spire lands at spireScreenFrac of the width, and of
   * the camera positions that do that, the one where the nearer hedgerow trees and poplars leave it most in the clear.
   */
  cameraLeft(viewW: number): number {
    const version = this.backdrop.version;
    if (version === this.placedVersion && Math.abs(viewW - this.placedW) < 0.5) return this.left;
    this.placedVersion = version;
    this.placedW = viewW;
    const far = this.backdrop.layer('farBackdrop');
    const farSky = this.backdrop.skyline('farBackdrop');
    if (!far || !farSky) {
      this.left = 0;
      return 0;
    }
    const S = M.scene;
    const spireTile = franceSpireTileX();
    let tip = Infinity;
    for (let d = -3; d <= 3; d++) tip = Math.min(tip, farSky[Math.floor(mod(spireTile + d, farSky.length))]);
    this.spireY = tip;
    const offset = S.spireScreenFrac * viewW;
    this.spireOffset = offset;
    const base = mod(spireTile - offset, far.w) / far.parallax;
    const step = far.w / far.parallax;
    const occluders = [this.backdrop.layer('midBackdrop'), this.backdrop.layer('nearBackdrop')];
    const skylines = [this.backdrop.skyline('midBackdrop'), this.backdrop.skyline('nearBackdrop')];
    let best = base;
    let bestClear = -Infinity;
    for (let k = 0; k < S.cameraCandidates; k++) {
      const left = base + k * step;
      let clear = Infinity;
      for (let n = 0; n < occluders.length; n++) {
        const layer = occluders[n];
        const sky = skylines[n];
        if (!layer || !sky) continue;
        for (let d = -S.spireClearHalf; d <= S.spireClearHalf; d += 2) {
          const tx = mod(left * layer.parallax + offset + d, layer.w);
          clear = Math.min(clear, sky[Math.min(sky.length - 1, Math.floor(tx))]);
        }
      }
      if (clear > bestClear) {
        bestClear = clear;
        best = left;
      }
    }
    this.left = best;
    return best;
  }

  /**
   * Draw one frame. `dt` = storm seconds advanced (0 while paused or frozen: nothing moves), `fade` 0..1 scales the
   * rain and the light, `share` (0..1) is the effect quality's share of rain to draw.
   */
  update(storm: MenuStormState, dt: number, fade: number, left: number, viewW: number, cssW: number, cssH: number, share: number): void {
    if (!this.shown) return;
    if (cssW !== this.laidW || cssH !== this.laidH || Math.abs(viewW - this.laidView) > 0.5 || share !== this.laidShare) {
      this.laidW = cssW;
      this.laidH = cssH;
      this.laidView = viewW;
      this.laidShare = share;
      this.rain.layout(cssW, cssH, viewW + 2 * M.rain.overscan, share);
      this.lastFade = -1;
    }
    this.rain.update(dt);
    this.drawLight(storm, fade, left, viewW);
    this.drawRain(fade, left);
    this.drawSplashes(fade, left);
  }

  private drawLight(storm: MenuStormState, fade: number, left: number, viewW: number): void {
    const look = storm.reduced ? M.glow : M.flash;
    const flash = storm.flash;
    // The storm light on every layer, pulled toward white by the flash (most in the sky, least on the near grass).
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      this.backdrop.setTint(slot, flash > 0 ? mix(this.stormTint[i], this.flashTint, flash * look.tintShare[slot]) : this.stormTint[i]);
    }
    const sky = flash * look.skyAlpha * fade;
    this.statsOut.skyFlash = sky;
    if (sky > 0.002) {
      const img = this.skyFlash;
      img.x = left - 4;
      img.y = -4;
      img.scaleX = (viewW + 8) / WHITE_SIZE / VIEW.textureScale;
      img.scaleY = (VIEW.heightWu + 8) / WHITE_SIZE / VIEW.textureScale;
      img.alpha = Math.min(1, sky);
      img.visible = true;
    } else {
      this.skyFlash.visible = false;
    }

    const fork = storm.fork * fade;
    if (fork > 0.002) {
      const spireX = left + this.spireOffset;
      if (storm.flashSeq !== this.boltSeq) {
        this.boltSeq = storm.flashSeq;
        this.shapeFork(storm, spireX);
      }
      this.bolt.draw(this.boltBuf, fork * M.fork.alpha);
      this.boltShown = true;
      const g = this.forkGlow;
      // Centred a little below the tip: the spire and the roofs stand dark against the light of the strike.
      g.x = spireX;
      g.y = this.spireY + 16;
      g.scaleX = M.fork.glowW / (this.glowFrame.w * this.glowFrame.scale);
      g.scaleY = M.fork.glowH / (this.glowFrame.h * this.glowFrame.scale);
      g.alpha = Math.min(1, fork * M.fork.glowAlpha);
      g.visible = true;
    } else if (this.boltShown) {
      this.bolt.hide();
      this.boltShown = false;
      this.forkGlow.visible = false;
    }
    this.statsOut.forkDrawn = this.boltShown;
  }

  /** A new fork: it lands beside the spire and its foot is hidden behind the hills. */
  private shapeFork(storm: MenuStormState, spireX: number): void {
    const F = M.fork;
    const spireTile = franceSpireTileX();
    const side = storm.forkSide * F.landJitter;
    const farSky = this.backdrop.skyline('farBackdrop');
    const hills = farSky ? farSky[Math.floor(mod(spireTile + side, farSky.length))] : this.spireY;
    const footY = Math.max(this.spireY + F.footBelowTip, hills + F.footBelowHills);
    const topY = VIEW_TOP_WU - F.startAbove;
    const landX = spireX + side;
    const lean = ((((storm.forkSeed >>> 9) & 1023) / 1023) * 2 - 1) * F.shape.lean;
    generateBolt(storm.forkSeed, landX + (footY - topY) * lean, topY, landX, footY, F.shape, this.boltBuf);
  }

  private drawRain(fade: number, left: number): void {
    const rain = this.rain;
    const fr = this.streakFrame;
    const relayAlpha = fade !== this.lastFade;
    this.lastFade = fade;
    const L = M.rain.layers;
    for (let l = 0; l < rain.layers; l++) {
      const pool = this.streaks[l];
      const count = rain.count[l];
      const first = rain.start[l];
      const def = L[l];
      while (pool.length < count) {
        const img = addImage(this.scene, this.streakLayers[l], fr.frame);
        img.setTint(this.rainTint);
        img.rotation = rain.rotation[l];
        img.scaleX = def.width / (fr.w * fr.scale);
        img.scaleY = def.length / (fr.h * fr.scale);
        img.visible = false;
        pool.push(img);
      }
      const before = this.drawn[l];
      for (let k = 0; k < count; k++) {
        const img = pool[k];
        const i = first + k;
        img.x = left - M.rain.overscan + rain.x[i];
        img.y = rain.y[i];
        if (relayAlpha || k >= before) {
          img.alpha = rain.alpha[i] * fade;
          img.visible = true;
        }
      }
      for (let k = count; k < before; k++) pool[k].visible = false;
      this.drawn[l] = count;
      this.statsOut.drops[l] = count;
    }
  }

  private drawSplashes(fade: number, left: number): void {
    const rain = this.rain;
    const life = M.rain.splashLife;
    const frames = this.splashFrames;
    const n = rain.splashAge.length;
    let live = 0;
    for (let i = 0; i < n; i++) {
      const age = rain.splashAge[i];
      let img = this.splashImgs[i] as Img | undefined;
      if (age >= life) {
        if (img && this.splashFrame[i] >= 0) {
          img.visible = false;
          this.splashFrame[i] = -1;
        }
        continue;
      }
      live++;
      const f = Math.min(frames.length - 1, Math.floor((age / life) * frames.length));
      if (!img) {
        img = addImage(this.scene, this.layers.byName.groundDecals, frames[f].frame);
        this.splashImgs[i] = img;
      }
      if (this.splashFrame[i] !== f) {
        img.setFrame(frames[f].frame);
        this.splashFrame[i] = f;
      }
      const fr = frames[f];
      const s = rain.splashScale[i] / fr.scale;
      img.x = left - M.rain.overscan + rain.splashX[i];
      img.y = rain.splashY[i];
      img.scaleX = s;
      img.scaleY = s;
      img.alpha = M.rain.splashAlpha * (1 - 0.5 * (age / life)) * fade;
      img.visible = true;
    }
    this.statsOut.splashes = live;
  }

  stats(): MenuSceneStats {
    const s = this.statsOut;
    s.shown = this.shown;
    s.rainShare = this.rain.share;
    s.spireX = this.left + this.spireOffset;
    s.spireY = this.spireY;
    if (!this.shown) {
      s.drops[0] = 0;
      s.drops[1] = 0;
      s.drops[2] = 0;
      s.splashes = 0;
    }
    return s;
  }
}
