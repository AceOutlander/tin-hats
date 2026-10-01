/**
 * Structure views drawn from battle state: HQ bunkers (damage states, waving
 * flag, gun-slit flash), supply dumps, trenches (back wall under the units,
 * front parapet over them), pillboxes and barbed wire. Everything is drawn
 * for the left side facing right and mirrored for side 1.
 */
import Phaser from 'phaser';
import {
  FLAG_KEYS,
  WIRE_KEYS,
  createTileSpan,
  flagStripTint,
  flagWave,
  hqKey,
  pillboxKey,
  tileSpan,
  trenchKey,
  trenchSpec,
  type TrenchPalette,
} from '../art/structures';
import { SUPPLY_KEYS } from '../art/props';
import type { SpriteSpec } from '../art/types';
import { FLAG_LAYOUT, HQ_LAYOUT, PILLBOX_LAYOUT, WIRE_LAYOUT, type DamageState } from '../data/artLayout';
import { FACTIONS } from '../data/factions';
import { FX_SPRITES } from '../data/fx';
import { RENDER } from '../data/render';
import type { FactionId, Side } from '../data/schema';
import { VIEW } from '../data/view';
import type { BattleState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';

type Img = Phaser.GameObjects.Image;

const S = RENDER.structure;

function dirOf(side: number): number {
  return side === 0 ? 1 : -1;
}

/** Point the frame of `img` at `key` (no-op when unchanged), keeping the mirror and scale. */
function setKey(img: Img, reg: SpriteRegistry, key: string, dir: number): void {
  const fr = reg.get(key);
  if (img.frame !== fr.frame) img.setFrame(fr.frame);
  img.scaleX = dir / fr.scale;
  img.scaleY = 1 / fr.scale;
}

/**
 * A flag drawn as vertical strips, each sheared so its top edge follows the
 * wave. Phaser Images cannot shear, so each strip sits in a Container: the
 * shear matrix is split into rotation x scale x rotation (2x2 SVD) between the
 * Container and the Image.
 */
class FlagView {
  private readonly holders: Phaser.GameObjects.Container[] = [];
  private readonly strips: Img[] = [];
  private readonly inv: number;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, reg: SpriteRegistry, flagKey: string) {
    const n = FLAG_LAYOUT.strips;
    reg.addStrips(flagKey, n);
    this.inv = 1 / reg.get(flagKey).scale;
    for (let i = 0; i < n; i++) {
      const holder = new Phaser.GameObjects.Container(scene, 0, 0);
      layer.add(holder);
      const img = addImage(scene, holder, reg.get(`${flagKey}#${i}`).frame);
      this.holders.push(holder);
      this.strips.push(img);
    }
  }

  setVisible(on: boolean): void {
    for (const h of this.holders) h.visible = on;
  }

  destroy(): void {
    for (const h of this.holders) h.destroy();
    this.holders.length = 0;
    this.strips.length = 0;
  }

  /** Hoist top at (x, y); the fly extends toward dir; t = seconds. */
  update(x: number, y: number, dir: number, t: number): void {
    const n = FLAG_LAYOUT.strips;
    const sw = FLAG_LAYOUT.w / n;
    let left = flagWave(t, 0).dy;
    for (let i = 0; i < n; i++) {
      const right = flagWave(t, (i + 1) / n).dy;
      const shade = flagWave(t, (i + 0.5) / n).shade;
      const k = ((right - left) / sw) * dir;
      // SVD of the shear [[1, 0], [k, 1]] = R(phi) * diag(s1, s2) * R(theta).
      const g = k / 2;
      const q = Math.sqrt(1 + g * g);
      const r = Math.abs(g);
      const a1 = Math.atan2(g, 0);
      const a2 = Math.atan2(g, 1);
      const holder = this.holders[i];
      holder.x = x + dir * i * sw;
      holder.y = y + left;
      holder.rotation = (a2 + a1) / 2;
      holder.scaleX = q + r;
      holder.scaleY = q - r;
      const img = this.strips[i];
      img.rotation = (a2 - a1) / 2;
      img.scaleX = dir * this.inv;
      img.scaleY = this.inv;
      img.setTint(flagStripTint(shade));
      left = right;
    }
  }
}

class HqView {
  readonly img: Img;
  readonly flag: FlagView;
  readonly flash: Img;
  flashTime = 0;
  /** Sprite origin x (aligned so the art doorway sits on the sim's door). */
  artX = 0;
  dir = 1;
  faction: FactionId = 'british';
  state: DamageState | '' = '';
  /** Show the ruin although the HQ still has health (the battle ended another way). */
  forcedRuin = false;

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry, faction: FactionId) {
    this.faction = faction;
    this.img = addImage(scene, layers.byName.structures, reg.get(hqKey(faction, 'intact')).frame);
    this.flag = new FlagView(scene, layers.byName.structures, reg, FLAG_KEYS[FACTIONS[faction].look.flag]);
    this.flash = addImage(scene, layers.glow, reg.get(FX_SPRITES.muzzle[1]).frame);
    this.flash.setBlendMode(Phaser.BlendModes.ADD);
    this.flash.visible = false;
  }

  destroy(): void {
    this.img.destroy();
    this.flag.destroy();
    this.flash.destroy();
  }
}

/** Gun-slit muzzle position of each side's HQ in world space, for tracers. */
export interface GunPoint {
  x: number;
  y: number;
  dir: number;
}

export class StructureViews {
  private hqs: (HqView | null)[] = [null, null];
  private readonly dumps: Img[] = [];
  private readonly trenchBack: Img[] = [];
  private readonly trenchFront: Img[] = [];
  private readonly pillboxes: Img[] = [];
  private readonly pillboxFlash: Img[] = [];
  private readonly pillboxFlashTime: number[] = [];
  private readonly pillboxState: (DamageState | '')[] = [];
  private readonly wireBack: Img[][] = [];
  private readonly wireFront: Img[][] = [];
  private readonly wireFlat: Img[][] = [];
  private readonly span = createTileSpan();
  private time = 0;
  private flashInv = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.flashInv = 1 / reg.get(FX_SPRITES.muzzle[1]).scale;
  }

  /** One-piece trench sprites this battle needs, dug in its theatre's earth (built into a per-battle atlas by the view). */
  static battleSpecs(state: BattleState, palette: TrenchPalette): SpriteSpec[] {
    const out: SpriteSpec[] = [];
    const seen = new Set<number>();
    for (const t of state.trenches) {
      const w = Math.round(t.width);
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(trenchSpec('back', w, palette), trenchSpec('front', w, palette));
    }
    return out;
  }

  /** Drop every structure image. */
  clear(): void {
    for (const h of this.hqs) h?.destroy();
    this.hqs = [null, null];
    const lists = [this.dumps, this.trenchBack, this.trenchFront, this.pillboxes, this.pillboxFlash];
    for (const l of lists) {
      for (const img of l) img.destroy();
      l.length = 0;
    }
    for (const group of [this.wireBack, this.wireFront, this.wireFlat]) {
      for (const l of group) for (const img of l) img.destroy();
      group.length = 0;
    }
    this.pillboxFlashTime.length = 0;
    this.pillboxState.length = 0;
  }

  /** Create the views for a battle's structures (`palette`: the one battleSpecs built its trenches in). */
  build(state: BattleState, palette: TrenchPalette): void {
    this.clear();
    const reg = this.reg;
    const gy = VIEW.groundY;
    // Trench back walls first (DEPTH.trenchBack), then fronts (DEPTH.trenchFront).
    for (const t of state.trenches) {
      const backKey = trenchKey('back', t.width, palette);
      const back = addImage(this.scene, this.layers.byName.trenchBack, reg.get(backKey).frame);
      setKey(back, reg, backKey, 1);
      back.x = t.x;
      back.y = gy;
      this.trenchBack.push(back);
      const frontKey = trenchKey('front', t.width, palette);
      const front = addImage(this.scene, this.layers.byName.trenchFront, reg.get(frontKey).frame);
      setKey(front, reg, frontKey, 1);
      front.x = t.x;
      front.y = gy;
      this.trenchFront.push(front);
    }
    for (let side = 0; side < 2; side++) {
      const d = state.dumps[side];
      if (!d) continue;
      const img = addImage(this.scene, this.layers.byName.structures, reg.get(SUPPLY_KEYS.dump).frame);
      setKey(img, reg, SUPPLY_KEYS.dump, dirOf(side));
      img.x = d.x;
      img.y = gy;
      this.dumps.push(img);
    }
    for (const p of state.pillboxes) {
      const img = addImage(this.scene, this.layers.byName.fortification, reg.get(pillboxKey('intact')).frame);
      setKey(img, reg, pillboxKey('intact'), dirOf(p.side));
      img.x = p.x;
      img.y = gy;
      this.pillboxes.push(img);
      const fl = addImage(this.scene, this.layers.glow, reg.get(FX_SPRITES.muzzle[1]).frame);
      fl.setBlendMode(Phaser.BlendModes.ADD);
      fl.visible = false;
      this.pillboxFlash.push(fl);
      this.pillboxFlashTime.push(0);
      this.pillboxState.push('');
    }
    for (const w of state.wires) {
      const back: Img[] = [];
      const front: Img[] = [];
      const flat: Img[] = [];
      tileSpan(w.width, 0, WIRE_LAYOUT.tileW, this.span);
      for (let i = 0; i < this.span.count; i++) {
        const x = w.x + this.span.firstX + i * this.span.step;
        const b = addImage(this.scene, this.layers.byName.structures, reg.get(WIRE_KEYS.back).frame);
        b.x = x;
        b.y = gy + WIRE_LAYOUT.backDy;
        b.setScale(this.span.scaleX / reg.get(WIRE_KEYS.back).scale, 1 / reg.get(WIRE_KEYS.back).scale);
        back.push(b);
        const f = addImage(this.scene, this.layers.byName.wireFront, reg.get(WIRE_KEYS.front).frame);
        f.x = x;
        f.y = gy + WIRE_LAYOUT.frontDy;
        f.setScale(this.span.scaleX / reg.get(WIRE_KEYS.front).scale, 1 / reg.get(WIRE_KEYS.front).scale);
        front.push(f);
        const fl = addImage(this.scene, this.layers.byName.groundDecals, reg.get(WIRE_KEYS.flat).frame);
        fl.x = x;
        fl.y = gy;
        fl.setScale(this.span.scaleX / reg.get(WIRE_KEYS.flat).scale, 1 / reg.get(WIRE_KEYS.flat).scale);
        fl.visible = false;
        flat.push(fl);
      }
      this.wireBack.push(back);
      this.wireFront.push(front);
      this.wireFlat.push(flat);
    }
    for (let side = 0; side < 2; side++) {
      const s = state.sides[side];
      if (!s.hq) continue;
      const hv = new HqView(this.scene, this.layers, reg, s.faction);
      hv.dir = dirOf(side);
      hv.artX = s.hq.doorX - hv.dir * HQ_LAYOUT[s.faction].doorX;
      hv.img.x = hv.artX;
      hv.img.y = gy;
      this.hqs[side] = hv;
    }
  }

  /** An HQ or pillbox fired: flash its gun slit. */
  onStructureShot(source: 'hq' | 'pillbox', index: number): void {
    if (source === 'hq') {
      const hv = this.hqs[index];
      if (hv) hv.flashTime = S.slitFlashTime;
    } else if (index >= 0 && index < this.pillboxFlashTime.length) {
      this.pillboxFlashTime[index] = S.slitFlashTime;
    }
  }

  /** World position of an HQ's gun slit (art), written to out; false if that side has no HQ view. */
  hqGun(side: number, out: GunPoint): boolean {
    const hv = this.hqs[side];
    if (!hv) return false;
    const L = HQ_LAYOUT[hv.faction];
    out.x = hv.artX + hv.dir * L.gunSlit.x;
    out.y = VIEW.groundY + L.gunSlit.y;
    out.dir = hv.dir;
    return true;
  }

  /** World position of fire point `index` on an HQ's roof and walls (smoke and flames), written to out; false if there is none. */
  hqFire(side: number, index: number, out: GunPoint): boolean {
    const hv = this.hqs[side];
    if (!hv) return false;
    const pts = HQ_LAYOUT[hv.faction].fires;
    if (index < 0 || index >= pts.length) return false;
    out.x = hv.artX + hv.dir * pts[index].x;
    out.y = VIEW.groundY + pts[index].y;
    out.dir = hv.dir;
    return true;
  }

  /** Show the ruin of an HQ that still has health (the battle ended another way). */
  forceRuin(side: number): void {
    const hv = this.hqs[side];
    if (hv) hv.forcedRuin = true;
  }

  /** World position of a pillbox's gun slit, written to out. */
  pillboxGun(side: Side, x: number, out: GunPoint): void {
    const d = dirOf(side);
    out.x = x + d * PILLBOX_LAYOUT.slit.x;
    out.y = VIEW.groundY + PILLBOX_LAYOUT.slit.y;
    out.dir = d;
  }

  /** Per-frame update: damage states, flags, flashes. */
  update(state: BattleState, dt: number): void {
    this.time += dt * S.flagSpeed;
    const reg = this.reg;
    for (let side = 0; side < 2; side++) {
      const hv = this.hqs[side];
      const hq = state.sides[side].hq;
      if (!hv || !hq) continue;
      const frac = hq.maxHp > 0 ? hq.hp / hq.maxHp : 0;
      const st: DamageState = !hq.alive || hv.forcedRuin ? 'ruin' : frac > S.hqDamaged ? 'intact' : 'damaged';
      if (st !== hv.state) {
        hv.state = st;
        setKey(hv.img, reg, hqKey(hv.faction, st), hv.dir);
        hv.flag.setVisible(st !== 'ruin');
      }
      const L = HQ_LAYOUT[hv.faction];
      if (st !== 'ruin') hv.flag.update(hv.artX + hv.dir * L.flagTop.x, VIEW.groundY + L.flagTop.y, hv.dir, this.time + side * S.flagPhase);
      hv.flashTime -= dt;
      const on = hv.flashTime > 0 && hq.alive;
      hv.flash.visible = on;
      if (on) {
        hv.flash.x = hv.artX + hv.dir * L.gunSlit.x;
        hv.flash.y = VIEW.groundY + L.gunSlit.y;
        hv.flash.scaleX = hv.dir * S.slitFlashScale * this.flashInv;
        hv.flash.scaleY = S.slitFlashScale * this.flashInv;
      }
    }
    const pbs = state.pillboxes;
    for (let i = 0; i < pbs.length && i < this.pillboxes.length; i++) {
      const p = pbs[i];
      const frac = p.maxHp > 0 ? p.hp / p.maxHp : 0;
      const st: DamageState = !p.alive ? 'ruin' : frac > S.pillboxDamaged ? 'intact' : 'damaged';
      if (st !== this.pillboxState[i]) {
        this.pillboxState[i] = st;
        setKey(this.pillboxes[i], reg, pillboxKey(st), dirOf(p.side));
      }
      this.pillboxFlashTime[i] -= dt;
      const fl = this.pillboxFlash[i];
      const on = this.pillboxFlashTime[i] > 0 && p.alive;
      fl.visible = on;
      if (on) {
        const d = dirOf(p.side);
        fl.x = p.x + d * PILLBOX_LAYOUT.slit.x;
        fl.y = VIEW.groundY + PILLBOX_LAYOUT.slit.y;
        fl.scaleX = d * S.slitFlashScale * this.flashInv;
        fl.scaleY = S.slitFlashScale * this.flashInv;
      }
    }
    const wires = state.wires;
    for (let i = 0; i < wires.length && i < this.wireBack.length; i++) {
      const alive = wires[i].alive;
      const back = this.wireBack[i];
      for (let k = 0; k < back.length; k++) {
        back[k].visible = alive;
        this.wireFront[i][k].visible = alive;
        this.wireFlat[i][k].visible = !alive;
      }
    }
  }
}
