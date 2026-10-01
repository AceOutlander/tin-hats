/**
 * Things that come down from the sky or fly across it: the air-strike
 * aircraft with its shadow, and airdrop crates under parachutes.
 */
import type Phaser from 'phaser';
import { SUPPORTS } from '../../data/supports';
import { RENDER } from '../../data/render';
import { SUPPLY_KEYS } from '../../art/props';
import { AIR_KEYS } from '../../art/vehicles';
import { AIR_LAYOUT, SUPPLY_LAYOUT } from '../../data/artLayout';
import type { SpriteRegistry } from '../atlas';
import { addImage, type Layers } from '../layers';
import type { EffectContext } from './index';

type Img = Phaser.GameObjects.Image;

const A = RENDER.fx.aircraft;
const D = RENDER.fx.airdrop;
const MAX_PLANES = 3;
const MAX_DROPS = 4;

class Plane {
  active = false;
  x = 0;
  dir = 1;
  speed = 0;
  endX = 0;
  age = 0;
  exhaustT = 0;
  heard = false;
  readonly body: Img;
  readonly shadow: Img;

  constructor(body: Img, shadow: Img) {
    this.body = body;
    this.shadow = shadow;
  }
}

class Drop {
  active = false;
  x = 0;
  age = 0;
  side = 0;
  supplies = 0;
  landed = false;
  landedAt = 0;
  heard = false;
  readonly crate: Img;
  readonly canopy: Img;

  constructor(crate: Img, canopy: Img) {
    this.crate = crate;
    this.canopy = canopy;
  }
}

export class SkyPool {
  private readonly planes: Plane[] = [];
  private readonly drops: Drop[] = [];
  private readonly planeInv: number;
  private readonly shadowInv: number;
  private readonly crateInv: number;
  private readonly canopyInv: number;

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry) {
    const plane = reg.get(AIR_KEYS.plane);
    const shadow = reg.get(AIR_KEYS.shadow);
    const crate = reg.get(SUPPLY_KEYS.dropCrate);
    const canopy = reg.get(SUPPLY_KEYS.parachute);
    this.planeInv = 1 / plane.scale;
    this.shadowInv = 1 / shadow.scale;
    this.crateInv = 1 / crate.scale;
    this.canopyInv = 1 / canopy.scale;
    for (let i = 0; i < MAX_PLANES; i++) {
      const sh = addImage(scene, layers.byName.shadows, shadow.frame);
      const body = addImage(scene, layers.byName.effects, plane.frame);
      sh.visible = false;
      body.visible = false;
      this.planes.push(new Plane(body, sh));
    }
    for (let i = 0; i < MAX_DROPS; i++) {
      const c = addImage(scene, layers.byName.effects, crate.frame);
      const p = addImage(scene, layers.byName.effects, canopy.frame);
      c.visible = false;
      p.visible = false;
      this.drops.push(new Drop(c, p));
    }
  }

  clear(): void {
    for (const p of this.planes) {
      p.active = false;
      p.body.visible = false;
      p.shadow.visible = false;
    }
    for (const d of this.drops) {
      d.active = false;
      d.crate.visible = false;
      d.canopy.visible = false;
    }
  }

  /**
   * An aircraft flies over the strike strip centred on `x`: it reaches the strip's near edge after `delay`
   * seconds (when the first rocket leaves) and leaves the far side. `dir` is the way it flies (the caller's way).
   */
  airStrike(x: number, dir: number, delay: number): void {
    const def = SUPPORTS.airStrike;
    const speed = Math.max(A.minSpeed, Math.min(A.maxSpeed, def.duration > 0 ? (2 * def.spread) / def.duration : A.minSpeed));
    const first = x - dir * def.spread;
    const endX = x + dir * (def.spread + A.overrun);
    // The same call-in announced twice (called, then incoming): keep one aircraft and re-time it.
    let p = this.planes.find((q) => q.active && q.dir === dir && Math.abs(q.endX - endX) < 30);
    const fresh = p === undefined;
    if (!p) p = this.planes.find((q) => !q.active) ?? this.planes[0];
    p.active = true;
    p.dir = dir;
    p.speed = speed;
    p.x = first - dir * speed * Math.max(0, delay);
    p.endX = endX;
    if (fresh) {
      p.age = 0;
      p.exhaustT = 0;
      p.heard = false;
    }
  }

  /** A supply crate parachutes down to land at x. */
  airdrop(x: number, side: number, supplies: number): void {
    let d = this.drops.find((q) => !q.active);
    if (!d) d = this.drops[0];
    d.active = true;
    d.x = x;
    d.age = 0;
    d.side = side;
    d.supplies = supplies;
    d.landed = false;
    d.landedAt = 0;
    d.heard = false;
  }

  update(dt: number, fx: EffectContext): void {
    for (const p of this.planes) if (p.active) this.updatePlane(p, dt, fx);
    for (const d of this.drops) if (d.active) this.updateDrop(d, dt, fx);
  }

  private updatePlane(p: Plane, dt: number, fx: EffectContext): void {
    p.age += dt;
    p.x += p.dir * p.speed * dt;
    if ((p.endX - p.x) * p.dir <= 0) {
      p.active = false;
      p.body.visible = false;
      p.shadow.visible = false;
      return;
    }
    const gy = fx.groundY(-1);
    const near = p.x > fx.camLeft - 320 && p.x < fx.camRight + 320;
    p.body.visible = near;
    p.shadow.visible = near;
    if (!near) return;
    if (!p.heard) {
      p.heard = true;
      fx.sound.at('planeFlyby', p.x);
    }
    const y = gy - A.altitude + Math.sin(p.age * 3.1) * 3;
    const bank = Math.sin(p.age * 1.7) * 0.012 * p.dir;
    p.body.x = p.x;
    p.body.y = y;
    p.body.rotation = bank;
    p.body.scaleX = p.dir * A.scale * this.planeInv;
    p.body.scaleY = A.scale * this.planeInv;
    p.shadow.x = p.x;
    p.shadow.y = gy + 10;
    p.shadow.scaleX = p.dir * A.scale * this.shadowInv;
    p.shadow.scaleY = A.scale * this.shadowInv;
    p.shadow.alpha = A.shadowAlpha;
    p.exhaustT += dt;
    if (p.exhaustT >= A.exhaustInterval) {
      p.exhaustT = 0;
      if (fx.lowOk()) fx.play('exhaust', p.x - p.dir * AIR_LAYOUT.planeBox.ox * 0.9, y - 6, -p.dir, 0.1, gy, 1.4);
    }
  }

  private updateDrop(d: Drop, dt: number, fx: EffectContext): void {
    d.age += dt;
    const gy = fx.groundY(-1);
    const crateH = SUPPLY_LAYOUT.dropCrateBox.h;
    const harness = -SUPPLY_LAYOUT.dropCrateHarnessY * D.crateScale;
    const startY = -D.startAbove;
    const onScreen = fx.onScreen(d.x - 60, d.x + 60);
    if (!d.heard && d.age >= D.fall - D.soundLead) {
      d.heard = true;
      fx.sound.at('airdrop', d.x);
    }
    if (!d.landed && d.age >= D.fall) {
      d.landed = true;
      d.landedAt = d.age;
      if (onScreen) {
        fx.play('landingDust', d.x, gy, 1, 0, gy, 1);
        if (d.side === fx.playerSide || !RENDER.fx.floater.ownSideOnly) fx.floaters.add(d.x, gy - RENDER.fx.floater.y, d.supplies);
      }
    }
    if (!d.landed) {
      const p = d.age / D.fall;
      const sway = Math.sin(d.age * D.swayRate) * D.swayX * (1 - 0.6 * p);
      const tilt = Math.cos(d.age * D.swayRate) * D.swayTilt * (1 - 0.5 * p);
      const px = d.x + sway;
      const crateBottom = startY + (gy - startY) * p;
      const py = crateBottom - harness;
      d.canopy.visible = onScreen;
      d.crate.visible = onScreen;
      if (!onScreen) return;
      d.canopy.x = px;
      d.canopy.y = py;
      d.canopy.rotation = tilt;
      d.canopy.setScale(D.canopyScale * this.canopyInv);
      d.canopy.alpha = 1;
      d.crate.x = px - Math.sin(tilt) * harness;
      d.crate.y = py + Math.cos(tilt) * harness;
      d.crate.rotation = tilt;
      d.crate.setScale(D.crateScale * this.crateInv);
      d.crate.alpha = 1;
      return;
    }
    const since = d.age - d.landedAt;
    if (since > D.collapse + D.crateLinger + 0.6) {
      d.active = false;
      d.crate.visible = false;
      d.canopy.visible = false;
      return;
    }
    d.crate.visible = onScreen;
    d.canopy.visible = onScreen && since < D.collapse;
    if (!onScreen) return;
    d.crate.x = d.x;
    d.crate.y = gy;
    d.crate.rotation = 0;
    d.crate.setScale(D.crateScale * this.crateInv);
    const fade = since > D.collapse + D.crateLinger ? 1 - (since - D.collapse - D.crateLinger) / 0.6 : 1;
    d.crate.alpha = fade;
    if (d.canopy.visible) {
      const k = since / D.collapse;
      const lean = Math.floor(d.x) % 2 === 0 ? 1 : -1;
      d.canopy.x = d.x + k * 18 * lean;
      d.canopy.y = gy - crateH * D.crateScale * 0.6 + k * 14;
      d.canopy.rotation = 0.35 * k * lean;
      d.canopy.scaleX = D.canopyScale * this.canopyInv * (1 + 0.25 * k);
      d.canopy.scaleY = D.canopyScale * this.canopyInv * (1 - 0.8 * k);
      d.canopy.alpha = 1 - k * k;
    }
  }
}
