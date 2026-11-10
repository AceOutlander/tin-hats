/**
 * Projectile sprites in flight: grenades tumbling in an arc, mortar bombs and
 * artillery shells lobbed high, rockets and tank shells flying nearly flat,
 * bombs falling from an aircraft. Each follows its own curve from the launch
 * point to the landing point over the flight time the simulation gives, spins
 * or points along its path, and leaves a smoke trail where its look has one. Fire from guns off the map plunges
 * steeply from above the top of the screen.
 *
 * "Provisional" flights are drawn for a shot event of a lobbed or direct
 * weapon when no projectile event follows in the same step (the simulation
 * resolves such shots instantly in phase 1); they end in a blast of their own.
 */
import type Phaser from 'phaser';
import { FX_PROJECTILE_SPRITE, type ProjectileLook } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { FactionId } from '../../data/schema';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';
import { isPresetId, PRESET_DEFS, type PresetId } from './presets';

type Img = Phaser.GameObjects.Image;

const F = RENDER.fx.flight;

/** The curve a flight follows. */
export type FlightArc = 'lob' | 'direct' | 'drop' | 'plunge';

/** What a landing provisional flight asks the effects to do. */
export interface FlightLanding {
  (x: number, y: number, weaponId: string): void;
}

const ARC_LOB = 0;
const ARC_DIRECT = 1;
const ARC_DROP = 2;
/** Off-map fire: a straight, steep fall from above the screen top that speeds up a little as it comes down. */
const ARC_PLUNGE = 3;

export class FlightPool {
  private readonly images: Img[] = [];
  private readonly weapon: string[] = [];
  private readonly trail: (PresetId | '')[] = [];
  private readonly key: string[] = [];
  private readonly x0: Float32Array;
  private readonly y0: Float32Array;
  private readonly x1: Float32Array;
  private readonly y1: Float32Array;
  private readonly age: Float32Array;
  private readonly dur: Float32Array;
  private readonly apex: Float32Array;
  private readonly spin: Float32Array;
  private readonly trailT: Float32Array;
  private readonly trailEvery: Float32Array;
  private readonly arc: Uint8Array;
  private readonly step: Int32Array;
  private readonly provisional: Uint8Array;
  private readonly inv: Float32Array;
  private readonly size: Float32Array;
  /** Live flights occupy [0, count). */
  count = 0;
  /** Where the newest trail puff should go: set by update() for the owner's callback. */
  private readonly pos = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly reg: SpriteRegistry,
  ) {
    const n = F.max;
    this.x0 = new Float32Array(n);
    this.y0 = new Float32Array(n);
    this.x1 = new Float32Array(n);
    this.y1 = new Float32Array(n);
    this.age = new Float32Array(n);
    this.dur = new Float32Array(n);
    this.apex = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.trailT = new Float32Array(n);
    this.trailEvery = new Float32Array(n);
    this.arc = new Uint8Array(n);
    this.step = new Int32Array(n);
    this.provisional = new Uint8Array(n);
    this.inv = new Float32Array(n);
    this.size = new Float32Array(n);
  }

  /**
   * Launch a flight. (x0, y0) to (x1, y1) in world space over `duration` s.
   * @param stepId the effects step it was spawned in (for provisional dedupe)
   */
  spawn(
    look: ProjectileLook,
    faction: FactionId,
    arc: FlightArc,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    duration: number,
    weaponId: string,
    stepId: number,
    provisional: boolean,
  ): void {
    if (this.count >= F.max) return;
    const i = this.count++;
    const dist = Math.abs(x1 - x0);
    this.x0[i] = x0;
    this.y0[i] = y0;
    this.x1[i] = x1;
    this.y1[i] = y1;
    this.age[i] = 0;
    this.dur[i] = Math.max(0.05, duration);
    this.apex[i] = arc === 'lob' ? Math.min(F.apexMax, Math.max(F.apexMin, dist * F.apexRatio)) : Math.min(F.dropMax, dist * F.dropRatio);
    this.spin[i] = (F.spin[look] ?? 0) * (x1 >= x0 ? 1 : -1);
    this.trailT[i] = 0;
    this.arc[i] = arc === 'lob' ? ARC_LOB : arc === 'direct' ? ARC_DIRECT : arc === 'plunge' ? ARC_PLUNGE : ARC_DROP;
    this.step[i] = stepId;
    this.provisional[i] = provisional ? 1 : 0;
    this.size[i] = F.scale[look] ?? 1;
    this.weapon[i] = weaponId;
    const t = F.trail[look] ?? '';
    this.trail[i] = t !== '' && isPresetId(t) ? t : '';
    const tr = this.trail[i];
    this.trailEvery[i] = tr === '' ? 0 : (PRESET_DEFS[tr].interval ?? 0.03);
    const k = FX_PROJECTILE_SPRITE[look][faction];
    while (this.images.length <= i) {
      const img = addImage(this.scene, this.layer, this.reg.get(k).frame);
      img.visible = false;
      this.images.push(img);
      this.key.push('');
    }
    if (this.key[i] !== k) {
      const fr: SpriteFrame = this.reg.get(k);
      this.images[i].setFrame(fr.frame);
      this.key[i] = k;
    }
    this.inv[i] = 1 / this.reg.get(k).scale;
    this.images[i].visible = true;
    this.place(i, 0);
  }

  /** Drop provisional flights of this step for a weapon launched near x (a real projectile event has arrived). */
  cancelProvisional(stepId: number, weaponId: string, x: number): void {
    for (let i = 0; i < this.count; i++) {
      if (this.provisional[i] === 1 && this.step[i] === stepId && this.weapon[i] === weaponId && Math.abs(this.x0[i] - x) < 6) {
        this.images[i].visible = false;
        this.remove(i);
        return;
      }
    }
  }

  /** True if a provisional or real flight for this weapon and launch point already exists from this step. */
  has(stepId: number, weaponId: string, x: number): boolean {
    for (let i = 0; i < this.count; i++) {
      if (this.step[i] === stepId && this.weapon[i] === weaponId && Math.abs(this.x0[i] - x) < 6) return true;
    }
    return false;
  }

  clear(): void {
    this.count = 0;
    for (const img of this.images) img.visible = false;
  }

  /** Position at flight fraction t (0..1) into this.pos. */
  private at(i: number, t: number): void {
    const x = this.x0[i] + (this.x1[i] - this.x0[i]) * t;
    const lin = this.y0[i] + (this.y1[i] - this.y0[i]) * t;
    let y: number;
    if (this.arc[i] === ARC_DROP) y = this.y0[i] + (this.y1[i] - this.y0[i]) * t * t;
    else if (this.arc[i] === ARC_PLUNGE) y = this.y0[i] + (this.y1[i] - this.y0[i]) * t * (0.6 + 0.4 * t);
    else y = lin - 4 * this.apex[i] * t * (1 - t);
    this.pos.x = x;
    this.pos.y = y;
  }

  private place(i: number, t: number): void {
    this.at(i, t);
    const px = this.pos.x;
    const py = this.pos.y;
    this.at(i, Math.min(1, t + 0.03));
    let dx = this.pos.x - px;
    let dy = this.pos.y - py;
    if (dx === 0 && dy === 0) {
      dx = this.x1[i] >= this.x0[i] ? 1 : -1;
      dy = 0;
    }
    const img = this.images[i];
    img.x = px;
    img.y = py;
    const s = this.size[i] * this.inv[i];
    img.scaleX = s;
    if (this.spin[i] !== 0) {
      img.rotation = this.spin[i] * this.age[i];
      img.scaleY = s;
    } else {
      img.rotation = Math.atan2(dy, dx);
      img.scaleY = dx < 0 ? -s : s;
    }
    this.pos.x = px;
    this.pos.y = py;
  }

  private remove(i: number): void {
    const last = this.count - 1;
    if (i !== last) this.moveSlot(last, i);
    this.count = last;
  }

  /** Copy slot `from` over slot `to`, swapping the image objects so each keeps its own frame cache. */
  private moveSlot(from: number, to: number): void {
    this.x0[to] = this.x0[from];
    this.y0[to] = this.y0[from];
    this.x1[to] = this.x1[from];
    this.y1[to] = this.y1[from];
    this.age[to] = this.age[from];
    this.dur[to] = this.dur[from];
    this.apex[to] = this.apex[from];
    this.spin[to] = this.spin[from];
    this.trailT[to] = this.trailT[from];
    this.trailEvery[to] = this.trailEvery[from];
    this.arc[to] = this.arc[from];
    this.step[to] = this.step[from];
    this.provisional[to] = this.provisional[from];
    this.inv[to] = this.inv[from];
    this.size[to] = this.size[from];
    this.weapon[to] = this.weapon[from];
    this.trail[to] = this.trail[from];
    const img = this.images[to];
    this.images[to] = this.images[from];
    this.images[from] = img;
    const k = this.key[to];
    this.key[to] = this.key[from];
    this.key[from] = k;
  }

  /**
   * Advance every flight. `trail(preset, x, y, dirX, dirY)` is called for each smoke puff due;
   * `land(x, y, weapon)` for each provisional flight that arrives.
   */
  update(dt: number, trail: (preset: PresetId, x: number, y: number, dx: number, dy: number) => void, land: FlightLanding): void {
    for (let i = this.count - 1; i >= 0; i--) {
      const age = this.age[i] + dt;
      this.age[i] = age;
      if (age >= this.dur[i]) {
        this.images[i].visible = false;
        if (this.provisional[i] === 1) land(this.x1[i], this.y1[i], this.weapon[i]);
        this.remove(i);
        continue;
      }
      const t = age / this.dur[i];
      this.place(i, t);
      const preset = this.trail[i];
      if (preset !== '') {
        const tt = this.trailT[i] + dt;
        const every = this.trailEvery[i];
        if (tt >= every) {
          this.trailT[i] = tt % every;
          const img = this.images[i];
          const back = this.x1[i] >= this.x0[i] ? -1 : 1;
          trail(preset, img.x, img.y, back, 0);
        } else {
          this.trailT[i] = tt;
        }
      }
    }
  }
}
