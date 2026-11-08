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
  createWirePieces,
  flagStripTint,
  flagWave,
  pillboxKey,
  trenchKey,
  trenchSpec,
  wirePieceLayout,
  type TrenchPalette,
} from '../art/structures';
import { bigLoadSpec, cartSpecs, dumpStyleKey, dumpStyleSpecs, truckSpecs } from '../art/props/supplyLooks';
import { hqGunKey, hqGunSpecs } from '../art/structures/hqGun';
import { hqStyleKey, hqStyleSpecs } from '../art/structures/hqStyles';
import type { SpriteSpec } from '../art/types';
import { FLAG_LAYOUT, PILLBOX_LAYOUT, TRENCH_LAYOUT, WIRE_LAYOUT, type DamageState } from '../data/artLayout';
import { FACTIONS } from '../data/factions';
import { FX_SPRITES } from '../data/fx';
import { HQ_GUN_LAYOUT } from '../data/looksGun';
import { HQ_STYLE_LAYOUT } from '../data/looksHq';
import { RENDER } from '../data/render';
import type { DamageType, FactionId, Side } from '../data/schema';
import type { HqGunStyle, HqStyle, SideLooks } from '../data/upgradeLooks';
import { VIEW } from '../data/view';
import { lookStyle } from '../meta/looks';
import type { BattleState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, WHITE_SIZE } from './sprites';
import { WireWreck, pieceLag } from './wireRules';

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
  /** The HQ machine-gun position on the ground in front of the building. */
  readonly gun: Img;
  readonly flag: FlagView;
  readonly flash: Img;
  flashTime = 0;
  /** Sprite origin x (aligned so the art doorway sits on the sim's door). */
  artX = 0;
  dir = 1;
  faction: FactionId = 'british';
  /** Building and gun-position styles, from the side's upgrade looks. */
  style: HqStyle;
  gunStyle: HqGunStyle;
  state: DamageState | '' = '';
  /** Show the ruin although the HQ still has health (the battle ended another way). */
  forcedRuin = false;

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry, faction: FactionId, style: HqStyle, gunStyle: HqGunStyle) {
    this.faction = faction;
    this.style = style;
    this.gunStyle = gunStyle;
    this.img = addImage(scene, layers.byName.structures, reg.get(hqStyleKey(style, faction, 'intact')).frame);
    this.gun = addImage(scene, layers.byName.structures, reg.get(hqGunKey(gunStyle, faction, 'intact')).frame);
    this.flag = new FlagView(scene, layers.byName.structures, reg, FLAG_KEYS[FACTIONS[faction].look.flag]);
    this.flash = addImage(scene, layers.glow, reg.get(FX_SPRITES.muzzle[1]).frame);
    this.flash.setBlendMode(Phaser.BlendModes.ADD);
    this.flash.visible = false;
  }

  /** World x of the gun position's base. */
  gunX(): number {
    return this.artX + this.dir * HQ_STYLE_LAYOUT[this.style].gunNest.x;
  }

  destroy(): void {
    this.img.destroy();
    this.gun.destroy();
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
  /** Owner's pennant per trench (stake and cloth), the owner it shows and how far it has faded in. */
  private readonly trenchStake: Img[] = [];
  private readonly trenchPennant: Img[] = [];
  private readonly trenchOwner: number[] = [];
  private readonly trenchFade: number[] = [];
  private whiteInv = 1;
  private readonly pillboxes: Img[] = [];
  private readonly pillboxFlash: Img[] = [];
  private readonly pillboxFlashTime: number[] = [];
  private readonly pillboxState: (DamageState | '')[] = [];
  /** Per wire belt (state.wires order), per end-on piece: back half, front half, and the two debris sprites. */
  private readonly wireBack: Img[][] = [];
  private readonly wireFront: Img[][] = [];
  private readonly wireCrushed: Img[][] = [];
  private readonly wireCut: Img[][] = [];
  private readonly wireIds: number[] = [];
  /** Offset of each piece from its belt's centre (wu). */
  private readonly wireOffsets: number[][] = [];
  private readonly wireWrecks: WireWreck[] = [];
  private readonly pieces = createWirePieces();
  private time = 0;
  private flashInv = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.flashInv = 1 / reg.get(FX_SPRITES.muzzle[1]).scale;
    this.whiteInv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
  }

  /** One-piece trench sprites this battle needs, dug in its theatre's earth (built into a per-battle atlas by the view). */
  static battleSpecs(state: BattleState, palette: TrenchPalette, looks: readonly SideLooks[]): SpriteSpec[] {
    const out: SpriteSpec[] = [];
    // The HQ, its gun position and the dump in each side's upgrade looks.
    const keys = new Set<string>();
    const addAll = (specs: SpriteSpec[]): void => {
      for (const sp of specs) {
        if (keys.has(sp.key)) continue;
        keys.add(sp.key);
        out.push(sp);
      }
    };
    for (let side = 0; side < 2; side++) {
      const l = looks[side];
      if (!l) continue;
      const f = state.sides[side].faction;
      if (state.sides[side].hq) {
        addAll(hqStyleSpecs(lookStyle(l, 'hq'), f));
        addAll(hqGunSpecs(lookStyle(l, 'hqGun'), f));
      }
      if (state.dumps[side]) addAll(dumpStyleSpecs(lookStyle(l, 'dump'), f));
      // What the side's sappers haul with (the unit views draw it).
      const haul = lookStyle(l, 'sapper');
      if (haul === 'bigLoad') addAll([bigLoadSpec(f)]);
      else if (haul === 'handcart') addAll(cartSpecs(f));
      else if (haul === 'truck') addAll(truckSpecs(f));
    }
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
    const lists = [this.dumps, this.trenchBack, this.trenchFront, this.trenchStake, this.trenchPennant, this.pillboxes, this.pillboxFlash];
    for (const l of lists) {
      for (const img of l) img.destroy();
      l.length = 0;
    }
    for (const group of [this.wireBack, this.wireFront, this.wireCrushed, this.wireCut]) {
      for (const l of group) for (const img of l) img.destroy();
      group.length = 0;
    }
    this.wireIds.length = 0;
    this.wireOffsets.length = 0;
    this.wireWrecks.length = 0;
    this.pillboxFlashTime.length = 0;
    this.pillboxState.length = 0;
    this.trenchOwner.length = 0;
    this.trenchFade.length = 0;
  }

  /** Create the views for a battle's structures (`palette`: the one battleSpecs built its trenches in). */
  build(state: BattleState, palette: TrenchPalette, looks: readonly SideLooks[]): void {
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
      const stake = addImage(this.scene, this.layers.byName.trenchFront, reg.get(RENDER_KEYS.whiteTL).frame);
      stake.setTint(TRENCH_LAYOUT.stakeColor);
      stake.visible = false;
      this.trenchStake.push(stake);
      const pennant = addImage(this.scene, this.layers.byName.trenchFront, reg.get(RENDER_KEYS.whiteTL).frame);
      pennant.visible = false;
      this.trenchPennant.push(pennant);
      this.trenchOwner.push(-2);
      this.trenchFade.push(1);
    }
    for (let side = 0; side < 2; side++) {
      const d = state.dumps[side];
      // A side that can never have sappers (mission 9 lives on airdrops) has no use for a dump.
      if (!d || state.sides[side].available.sapper !== true) continue;
      const dumpKey = dumpStyleKey(lookStyle(looks[side], 'dump'), state.sides[side].faction);
      const img = addImage(this.scene, this.layers.byName.structures, reg.get(dumpKey).frame);
      setKey(img, reg, dumpKey, dirOf(side));
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
    // Wire: one or a few end-on pieces per belt, centred in its width (the far half behind every unit row, the near
    // half over them), with the debris each piece leaves on the ground once the belt is destroyed.
    const wy = gy + WIRE_LAYOUT.dy;
    const piece = (key: string, layer: Phaser.GameObjects.Layer, x: number, sx: number): Img => {
      const fr = reg.get(key);
      const img = addImage(this.scene, layer, fr.frame);
      img.x = x;
      img.y = wy;
      img.setScale(sx / fr.scale, 1 / fr.scale);
      return img;
    };
    for (const w of state.wires) {
      const back: Img[] = [];
      const front: Img[] = [];
      const crushed: Img[] = [];
      const cut: Img[] = [];
      const p = wirePieceLayout(w.width, this.pieces);
      for (let i = 0; i < p.count; i++) {
        const x = w.x + p.x[i];
        back.push(piece(WIRE_KEYS.back, this.layers.byName.structures, x, p.scaleX));
        front.push(piece(WIRE_KEYS.front, this.layers.byName.wireFront, x, p.scaleX));
        const c = piece(WIRE_KEYS.crushed, this.layers.byName.groundDecals, x, p.scaleX);
        c.visible = false;
        crushed.push(c);
        const k = piece(WIRE_KEYS.cut, this.layers.byName.groundDecals, x, p.scaleX);
        k.visible = false;
        cut.push(k);
      }
      this.wireBack.push(back);
      this.wireFront.push(front);
      this.wireCrushed.push(crushed);
      this.wireCut.push(cut);
      this.wireIds.push(w.id);
      this.wireOffsets.push(Array.from(p.x.subarray(0, p.count)));
      this.wireWrecks.push(new WireWreck());
    }
    for (let side = 0; side < 2; side++) {
      const s = state.sides[side];
      if (!s.hq) continue;
      const hv = new HqView(this.scene, this.layers, reg, s.faction, lookStyle(looks[side], 'hq'), lookStyle(looks[side], 'hqGun'));
      hv.dir = dirOf(side);
      hv.artX = s.hq.doorX - hv.dir * HQ_STYLE_LAYOUT[hv.style].doorX;
      hv.img.x = hv.artX;
      hv.img.y = gy;
      setKey(hv.img, reg, hqStyleKey(hv.style, hv.faction, 'intact'), hv.dir);
      hv.gun.x = hv.gunX();
      hv.gun.y = gy;
      setKey(hv.gun, reg, hqGunKey(hv.gunStyle, hv.faction, 'intact'), hv.dir);
      this.hqs[side] = hv;
    }
  }

  /**
   * A wire belt was destroyed (sim event wireDestroyed: `id` = wire id, `owner` = its side). Crushed (cause null, a
   * tank): the coil folds over flat the way the enemy's tank drives (toward the owner); blown apart: debris at once.
   */
  onWireDestroyed(id: number, owner: number, cause: DamageType | null): void {
    for (let i = 0; i < this.wireIds.length; i++) {
      if (this.wireIds[i] !== id) continue;
      const dir = owner === 1 ? 1 : -1;
      const n = this.wireOffsets[i].length;
      this.wireWrecks[i].destroy(cause, dir, pieceLag(dir * ((n - 1) / 2) * WIRE_LAYOUT.pitch, n, dir));
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
    const m = HQ_GUN_LAYOUT[hv.gunStyle].muzzle;
    out.x = hv.gunX() + hv.dir * m.x;
    out.y = VIEW.groundY + m.y;
    out.dir = hv.dir;
    return true;
  }

  /** World position of fire point `index` on an HQ's roof and walls (smoke and flames), written to out; false if there is none. */
  hqFire(side: number, index: number, out: GunPoint): boolean {
    const hv = this.hqs[side];
    if (!hv) return false;
    const pts = HQ_STYLE_LAYOUT[hv.style].fires;
    if (index < 0 || index >= pts.length) return false;
    out.x = hv.artX + hv.dir * pts[index].x;
    out.y = VIEW.groundY + pts[index].y;
    out.dir = hv.dir;
    return true;
  }

  /** Width (wu) of an HQ's building, for effects spread along it; 0 if that side has no HQ view. */
  hqBodyW(side: number): number {
    const hv = this.hqs[side];
    return hv ? HQ_STYLE_LAYOUT[hv.style].bodyW : 0;
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

  /**
   * Trenches: the pit faces the owner's enemy (the art is drawn facing right; an unowned trench faces right, as
   * built by the attacker), and the owner's pennant stands on a stake at the friendly lip, fading in after a capture.
   */
  private updateTrenches(state: BattleState, dt: number): void {
    const T = TRENCH_LAYOUT;
    const trenches = state.trenches;
    for (let i = 0; i < trenches.length && i < this.trenchBack.length; i++) {
      const t = trenches[i];
      if (t.owner !== this.trenchOwner[i]) {
        this.trenchOwner[i] = t.owner;
        this.trenchFade[i] = this.trenchFade.length > 0 && this.time > 0 ? 0 : 1;
        const dir = t.owner === 1 ? -1 : 1;
        this.trenchBack[i].scaleX = Math.abs(this.trenchBack[i].scaleX) * dir;
        this.trenchFront[i].scaleX = Math.abs(this.trenchFront[i].scaleX) * dir;
        const stake = this.trenchStake[i];
        const pen = this.trenchPennant[i];
        const on = t.owner === 0 || t.owner === 1;
        stake.visible = on;
        pen.visible = on;
        if (on) {
          const k = this.whiteInv;
          const lipX = t.x - dir * (T.pitW / 2 + 4);
          stake.x = lipX - T.stakeW / 2;
          stake.y = VIEW.groundY + T.pitNearY - T.stakeH;
          stake.scaleX = T.stakeW * k;
          stake.scaleY = T.stakeH * k;
          pen.x = lipX;
          pen.y = stake.y;
          pen.scaleX = -dir * T.pennantW * k;
          pen.scaleY = T.pennantH * k;
          pen.setTint(T.pennant[state.sides[t.owner].faction]);
        }
      }
      if (this.trenchFade[i] < 1) {
        this.trenchFade[i] = Math.min(1, this.trenchFade[i] + dt / T.pennantFade);
        this.trenchPennant[i].alpha = this.trenchFade[i];
        this.trenchStake[i].alpha = this.trenchFade[i];
      }
    }
  }

  /** Per-frame update: damage states, flags, flashes. */
  update(state: BattleState, dt: number): void {
    this.time += dt * S.flagSpeed;
    this.updateTrenches(state, dt);
    const reg = this.reg;
    for (let side = 0; side < 2; side++) {
      const hv = this.hqs[side];
      const hq = state.sides[side].hq;
      if (!hv || !hq) continue;
      const frac = hq.maxHp > 0 ? hq.hp / hq.maxHp : 0;
      const st: DamageState = !hq.alive || hv.forcedRuin ? 'ruin' : frac > S.hqDamaged ? 'intact' : 'damaged';
      if (st !== hv.state) {
        hv.state = st;
        setKey(hv.img, reg, hqStyleKey(hv.style, hv.faction, st), hv.dir);
        setKey(hv.gun, reg, hqGunKey(hv.gunStyle, hv.faction, st === 'ruin' ? 'ruin' : 'intact'), hv.dir);
        hv.flag.setVisible(st !== 'ruin');
      }
      const L = HQ_STYLE_LAYOUT[hv.style];
      if (st !== 'ruin') hv.flag.update(hv.artX + hv.dir * L.flagTop.x, VIEW.groundY + L.flagTop.y, hv.dir, this.time + side * S.flagPhase);
      hv.flashTime -= dt;
      const on = hv.flashTime > 0 && hq.alive;
      hv.flash.visible = on;
      if (on) {
        const m = HQ_GUN_LAYOUT[hv.gunStyle].muzzle;
        hv.flash.x = hv.gunX() + hv.dir * m.x;
        hv.flash.y = VIEW.groundY + m.y;
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
    this.updateWires(state, dt);
  }

  /** Wire belts: standing, folding flat under a tank, or lying as debris. */
  private updateWires(state: BattleState, dt: number): void {
    const wires = state.wires;
    const inv = 1 / this.reg.get(WIRE_KEYS.front).scale;
    for (let i = 0; i < wires.length && i < this.wireBack.length; i++) {
      const wr = this.wireWrecks[i];
      // Gone without an event we saw (a view attached after the fact): show it blown apart.
      if (!wires[i].alive && wr.look === 'standing') wr.destroy('explosive', 1);
      if (wr.look === 'standing') continue;
      wr.step(dt);
      const back = this.wireBack[i];
      const front = this.wireFront[i];
      const crushed = this.wireCrushed[i];
      const cut = this.wireCut[i];
      const offs = this.wireOffsets[i];
      for (let k = 0; k < back.length; k++) {
        const lag = pieceLag(offs[k], offs.length, wr.dir);
        const standing = wr.standingShown(lag);
        back[k].visible = standing;
        front[k].visible = standing;
        if (standing) {
          const sy = wr.standingScaleY(lag) * inv;
          const lean = wr.lean(lag);
          const a = wr.standingAlpha(lag);
          back[k].scaleY = sy;
          front[k].scaleY = sy;
          back[k].rotation = lean;
          front[k].rotation = lean;
          back[k].alpha = a;
          front[k].alpha = a;
        }
        const debris = wr.debris(lag);
        const da = wr.debrisAlpha(lag);
        crushed[k].visible = debris === 'crushed';
        cut[k].visible = debris === 'cut';
        crushed[k].alpha = da;
        cut[k].alpha = da;
      }
    }
  }
}
