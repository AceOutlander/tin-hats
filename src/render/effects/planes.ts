/**
 * Call-in aircraft crossing the sky (planePass): the nation's bomber, fighter or recon plane at its altitude, with a
 * ground shadow, engine sound and exhaust; shot down (planeDown) it noses over trailing smoke and fire, shrinks as it
 * falls away beyond the battle and crashes at the horizon. Also the anti-aircraft flak puffs and the recon camera
 * glint. Everything is pooled; nothing allocates per frame.
 */
import type Phaser from 'phaser';
import { PLANE_LAYOUT, type PlaneKind } from '../../data/artLayout';
import { RENDER } from '../../data/render';
import type { FactionId } from '../../data/schema';
import { PLANE_KINDS, planeGearKey, planeKey, planeShadowKey } from '../../art/vehicles';
import type { SideLooks } from '../../data/upgradeLooks';
import { planeGearOf } from '../../meta/looks';
import type { SpriteRegistry } from '../atlas';
import { addImage, type Layers } from '../layers';
import { CALLIN_KEYS, RENDER_KEYS } from '../sprites';
import { planeAltitude, planePassTime, planePassX } from './callinMath';
import type { EffectContext } from './index';

export { isPlaneKind, planeAltitude, planePassTime, planePassX } from './callinMath';

type Img = Phaser.GameObjects.Image;

const P = RENDER.planes;
const AA = RENDER.antiAir;

const FLYING = 1;
const FALLING = 2;

class Plane {
  state = 0;
  kind: PlaneKind = 'fighter';
  faction: FactionId = 'british';
  side = 0;
  x0 = 0;
  x1 = 0;
  dur = 1;
  age = 0;
  x = 0;
  y = 0;
  alt = 0;
  dir = 1;
  heard = false;
  exhaustT = 0;
  glintT = 0;
  /** Falling: velocity, dive angle and time since it was hit. */
  vx = 0;
  vy = 0;
  dive = 0;
  fallT = 0;
  smokeT = 0;
  inv = 1;
  shadowInv = 1;
  key = '';
  shadowKey = '';

  constructor(
    readonly body: Img,
    readonly shadow: Img,
  ) {}
}

class Puff {
  live = false;
  age = 0;
  life = 1;
  grow = 1;
  scale = 1;
  constructor(readonly img: Img) {}
}

export class PlanePool {
  private readonly planes: Plane[] = [];
  private readonly flak: Puff[] = [];
  private readonly glints: Puff[] = [];
  private flakNext = 0;
  private glintNext = 0;
  private readonly flakInv: number;
  private readonly glowInv: number;
  /** Plane gear level per side and plane type (PLANE_KINDS order), from setLooks. */
  private readonly gear = new Int8Array(2 * PLANE_KINDS.length);

  constructor(
    scene: Phaser.Scene,
    layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    const first = reg.get(planeKey('fighter', 'british'));
    const sh = reg.get(planeShadowKey('fighter'));
    for (let i = 0; i < P.max; i++) {
      const s = addImage(scene, layers.byName.shadows, sh.frame);
      const b = addImage(scene, layers.byName.effects, first.frame);
      s.visible = false;
      b.visible = false;
      this.planes.push(new Plane(b, s));
    }
    const flak = reg.get(CALLIN_KEYS.flak);
    this.flakInv = 1 / flak.scale;
    for (let i = 0; i < AA.flakMax; i++) {
      const img = addImage(scene, layers.byName.effects, flak.frame);
      img.visible = false;
      this.flak.push(new Puff(img));
    }
    const glow = reg.get(RENDER_KEYS.glow);
    this.glowInv = 1 / glow.scale;
    for (let i = 0; i < 4; i++) {
      const img = addImage(scene, layers.byName.effects, glow.frame);
      img.visible = false;
      img.setBlendMode(1);
      this.glints.push(new Puff(img));
    }
  }

  /** The gear a side's planes wear (its Quartermaster call-in upgrades); null = none. The sprites come from the unit gear atlas. */
  setLooks(side: number, looks: SideLooks | null): void {
    for (let i = 0; i < PLANE_KINDS.length; i++) this.gear[side * PLANE_KINDS.length + i] = planeGearOf(looks, PLANE_KINDS[i]);
  }

  clear(): void {
    for (const p of this.planes) {
      p.state = 0;
      p.body.visible = false;
      p.shadow.visible = false;
    }
    for (const f of this.flak) {
      f.live = false;
      f.img.visible = false;
    }
    for (const g of this.glints) {
      g.live = false;
      g.img.visible = false;
    }
  }

  /** Planes in the air (flying or falling). */
  active(): number {
    let n = 0;
    for (const p of this.planes) if (p.state !== 0) n++;
    return n;
  }

  /** A pass starts: the plane enters at x0 and flies to x1 over `value` s (or at its type's speed). */
  pass(kind: PlaneKind, faction: FactionId, side: number, x0: number, x1: number, row: number, value: number): void {
    let p: Plane | null = null;
    for (const q of this.planes) {
      if (q.state === 0) {
        p = q;
        break;
      }
    }
    if (!p) p = this.planes[0];
    p.state = FLYING;
    p.kind = kind;
    p.faction = faction;
    p.side = side;
    p.x0 = x0;
    p.x1 = x1;
    p.dur = planePassTime(kind, x0, x1, value);
    p.age = 0;
    p.x = x0;
    p.alt = planeAltitude(kind, row);
    p.dir = x1 >= x0 ? 1 : -1;
    p.heard = false;
    p.exhaustT = 0;
    p.glintT = 0;
    p.fallT = 0;
    p.dive = 0;
    // Its gear variant when the side has the upgrade and the battle built the sprite, else the plain plane.
    const level = this.gear[(side === 1 ? 1 : 0) * PLANE_KINDS.length + PLANE_KINDS.indexOf(kind)];
    const geared = level > 0 ? planeGearKey(kind, faction, level) : '';
    const k = geared !== '' && this.reg.has(geared) ? geared : planeKey(kind, faction);
    if (k !== p.key) {
      const fr = this.reg.get(k);
      p.body.setFrame(fr.frame);
      p.inv = 1 / fr.scale;
      p.key = k;
    }
    const sk = planeShadowKey(kind);
    if (sk !== p.shadowKey) {
      const fr = this.reg.get(sk);
      p.shadow.setFrame(fr.frame);
      p.shadowInv = 1 / fr.scale;
      p.shadowKey = sk;
    }
  }

  /** Anti-aircraft fire brought down the plane of `side` and `kind` nearest x: it falls away beyond the battle. */
  down(kind: PlaneKind, side: number, x: number): void {
    let best: Plane | null = null;
    let bestD = Infinity;
    for (const p of this.planes) {
      if (p.state !== FLYING || p.kind !== kind || p.side !== side) continue;
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    best.state = FALLING;
    best.vx = (best.dir * Math.abs(best.x1 - best.x0)) / Math.max(0.1, best.dur);
    best.vy = 0;
    best.fallT = 0;
    best.smokeT = 0;
  }

  /** The guns (or camera) of the flying plane of `side` and `kind` nearest x, into `out`; false if none is up. */
  gunAt(kind: PlaneKind, side: number, x: number, out: { x: number; y: number }): boolean {
    let best: Plane | null = null;
    let bestD = Infinity;
    for (const p of this.planes) {
      if (p.state !== FLYING || p.kind !== kind || p.side !== side) continue;
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return false;
    const g = PLANE_LAYOUT[kind].guns;
    out.x = best.x + best.dir * g.x;
    out.y = best.y + g.y;
    return true;
  }

  /** The nearest plane of the side other than `side` (an AA gun's target), into `out`; false if none. */
  targetFor(side: number, x: number, out: { x: number; y: number }): boolean {
    let best: Plane | null = null;
    let bestD = Infinity;
    for (const p of this.planes) {
      if (p.state === 0 || p.side === side) continue;
      const d = Math.abs(p.x - x);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return false;
    out.x = best.x;
    out.y = best.y;
    return true;
  }

  /** A flak burst at (x, y), shown after `delay` s. */
  flakAt(x: number, y: number, delay: number): void {
    const f = this.flak[this.flakNext];
    this.flakNext = (this.flakNext + 1) % this.flak.length;
    f.live = true;
    f.age = -Math.max(0, delay);
    f.life = AA.flakLife;
    f.scale = AA.flakScale;
    f.grow = AA.flakGrow;
    f.img.x = x;
    f.img.y = y;
    f.img.visible = false;
  }

  private glint(x: number, y: number): void {
    const G = P.glint;
    const g = this.glints[this.glintNext];
    this.glintNext = (this.glintNext + 1) % this.glints.length;
    g.live = true;
    g.age = 0;
    g.life = G.life;
    g.scale = G.scale;
    g.img.x = x;
    g.img.y = y;
    g.img.setTint(G.tint);
  }

  update(dt: number, fx: EffectContext): void {
    for (const p of this.planes) if (p.state !== 0) this.updatePlane(p, dt, fx);
    for (const f of this.flak) {
      if (!f.live) continue;
      f.age += dt;
      if (f.age < 0) continue;
      if (f.age >= f.life) {
        f.live = false;
        f.img.visible = false;
        continue;
      }
      const k = f.age / f.life;
      f.img.visible = fx.onScreen(f.img.x - 40, f.img.x + 40);
      f.img.setScale(f.scale * (0.5 + f.grow * Math.sqrt(k)) * this.flakInv);
      f.img.alpha = AA.flakAlpha * (1 - k * k);
    }
    for (const g of this.glints) {
      if (!g.live) continue;
      g.age += dt;
      if (g.age >= g.life) {
        g.live = false;
        g.img.visible = false;
        continue;
      }
      const k = g.age / g.life;
      g.img.visible = true;
      g.img.setScale(g.scale * Math.sin(Math.PI * k) * this.glowInv);
      g.img.alpha = 1 - k;
    }
  }

  private hide(p: Plane): void {
    p.state = 0;
    p.body.visible = false;
    p.shadow.visible = false;
  }

  private updatePlane(p: Plane, dt: number, fx: EffectContext): void {
    p.age += dt;
    const gy = fx.groundY(-1);
    const scale = P.scale[p.kind] ?? 1;
    if (p.state === FLYING) {
      p.x = planePassX(p.x0, p.x1, p.dur, p.age);
      if (p.age > p.dur + P.overrun) {
        this.hide(p);
        return;
      }
      p.y = gy - p.alt + Math.sin(p.age * P.bobRate) * P.bob;
    } else {
      const F = P.fall;
      p.fallT += dt;
      p.vy += F.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.dive = Math.min(F.maxDive, p.dive + F.diveRate * dt);
      if (p.fallT >= F.time || p.y >= gy - F.horizonLift) {
        // Down beyond the battle: a distant fireball and a column of smoke at the horizon.
        const cy = Math.min(p.y, gy - F.horizonLift);
        fx.sound.at('explosionLarge', p.x, F.crashVolume);
        if (fx.onScreen(p.x - 80, p.x + 80)) {
          fx.play('bigExplosion', p.x, cy, 0, -1, cy, F.crashSize);
          fx.ambient.burners.add('hqSmoke', p.x, cy, F.crashSize, F.smokeTime);
        }
        this.hide(p);
        return;
      }
    }
    const near = p.x > fx.camLeft - P.cullMargin && p.x < fx.camRight + P.cullMargin;
    p.body.visible = near;
    p.shadow.visible = near && p.state === FLYING;
    if (!near) return;
    if (!p.heard) {
      p.heard = true;
      fx.sound.at(P.sound[p.kind] ?? 'planeFlyby', p.x);
    }
    let s = scale;
    let rot = Math.sin(p.age * 1.7) * 0.012 * p.dir;
    if (p.state === FALLING) {
      const F = P.fall;
      const k = Math.min(1, p.fallT / F.time);
      s = scale * (1 - (1 - F.endScale) * k);
      rot = p.dir * (p.dive + Math.sin(p.fallT * 6) * F.spin);
      p.smokeT += dt;
      if (p.smokeT >= F.smokeInterval) {
        p.smokeT = 0;
        const t = PLANE_LAYOUT[p.kind].tail;
        fx.play('hqSmoke', p.x - p.dir * t.x * -0.2 * s, p.y, -p.dir, -0.3, gy, s);
        if (fx.lowOk()) fx.play('tankFire', p.x, p.y, -p.dir, 0, gy, F.fireSize * s);
      }
    }
    p.body.x = p.x;
    p.body.y = p.y;
    p.body.rotation = rot;
    p.body.scaleX = p.dir * s * p.inv;
    p.body.scaleY = s * p.inv;
    if (p.state === FLYING) {
      p.shadow.x = p.x;
      p.shadow.y = gy + P.shadowDy;
      p.shadow.scaleX = p.dir * scale * p.shadowInv;
      p.shadow.scaleY = scale * p.shadowInv;
      p.shadow.alpha = P.shadowAlpha;
      p.exhaustT += dt;
      if (p.exhaustT >= P.exhaustInterval) {
        p.exhaustT = 0;
        if (fx.lowOk()) fx.play('exhaust', p.x - p.dir * PLANE_LAYOUT[p.kind].box.ox * 0.85 * s, p.y - 4, -p.dir, 0.1, gy, 1.2);
      }
      if (p.kind === 'recon') {
        p.glintT += dt;
        if (p.glintT >= P.glint.interval) {
          p.glintT = 0;
          const c = PLANE_LAYOUT.recon.camera;
          this.glint(p.x + p.dir * c.x * s, p.y + c.y * s);
        }
      }
    }
  }
}
