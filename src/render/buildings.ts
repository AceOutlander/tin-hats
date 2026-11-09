/**
 * Building and cover-prop views (FOUNDATIONS.md 4.3), drawn from battle state. A standing building is its dark
 * interior (plain strips under the units), a facade piece per standing floor and a roof (a broken top once a floor
 * has fallen) over the units, so its men show at the windows; damaged pieces once its walls are down to
 * BUILDING_LAYOUT.damaged of their health; and, once it falls, rubble stumps behind the men and a heap in front of
 * them. A cover prop is its body behind the men and low cover in front. The men themselves are drawn by the unit views
 * (src/render/units.ts: at their floor's windows, or crouched in the rubble).
 */
import type Phaser from 'phaser';
import { buildingKey, buildingSpecs, coverPropSpecs, propKey, type BuildingPiece } from '../art/structures/buildings';
import type { SpriteSpec } from '../art/types';
import { BUILDING_LAYOUT as BL } from '../data/looksBuilding';
import type { BuildingLook, CoverPropLook } from '../data/schema';
import { VIEW } from '../data/view';
import type { BattleState, BuildingState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, WHITE_SIZE } from './sprites';

type Img = Phaser.GameObjects.Image;

/** Everything drawn for one building or prop. */
interface BuildingView {
  /** Interior strips and facade pieces per floor (index = floor), the roof, the rubble. Props use back and front only. */
  interior: Img[];
  floors: Img[];
  roof: Img | null;
  back: Img;
  front: Img;
  /** What it shows now: floors standing, damaged, rubble (-1 = not drawn yet). */
  shown: number;
}

function setFrame(img: Img, reg: SpriteRegistry, key: string): void {
  const fr = reg.get(key);
  if (img.frame !== fr.frame) img.setFrame(fr.frame);
  img.scaleX = 1 / fr.scale;
  img.scaleY = 1 / fr.scale;
}

export class BuildingViews {
  private views: BuildingView[] = [];
  private readonly whiteInv: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.whiteInv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
  }

  /** The pieces this battle's buildings and props need, one set per look, width and slots per floor. */
  static battleSpecs(state: BattleState): SpriteSpec[] {
    const out: SpriteSpec[] = [];
    const seen = new Set<string>();
    for (const b of state.buildings) {
      const key = b.prop ? propKey(b.look, b.width, 'back') : buildingKey(b.look, b.width, b.slotsPerFloor, 'ground');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(...(b.prop ? coverPropSpecs(b.look as CoverPropLook, b.width) : buildingSpecs(b.look as BuildingLook, b.width, b.slotsPerFloor)));
    }
    return out;
  }

  clear(): void {
    for (const v of this.views) {
      for (const img of [...v.interior, ...v.floors, v.back, v.front]) img.destroy();
      v.roof?.destroy();
    }
    this.views = [];
  }

  build(state: BattleState): void {
    this.clear();
    const reg = this.reg;
    const gy = VIEW.groundY;
    for (const b of state.buildings) {
      const s = this.scene;
      if (b.prop) {
        const back = addImage(s, this.layers.byName.structures, reg.get(propKey(b.look, b.width, 'back')).frame);
        setFrame(back, reg, propKey(b.look, b.width, 'back'));
        back.x = b.x;
        back.y = gy;
        const front = addImage(s, this.layers.byName.trenchFront, reg.get(propKey(b.look, b.width, 'front')).frame);
        setFrame(front, reg, propKey(b.look, b.width, 'front'));
        front.x = b.x;
        front.y = gy;
        this.views.push({ interior: [], floors: [], roof: null, back, front, shown: 0 });
        continue;
      }
      const key = (piece: BuildingPiece): string => buildingKey(b.look, b.width, b.slotsPerFloor, piece);
      const interior: Img[] = [];
      const floors: Img[] = [];
      for (let f = 0; f < b.floors; f++) {
        const strip = addImage(s, this.layers.byName.structures, reg.get(RENDER_KEYS.whiteTL).frame);
        strip.setTint(BL.interior);
        strip.x = b.x - b.width / 2;
        strip.y = gy - (f + 1) * BL.floorH;
        strip.scaleX = b.width * this.whiteInv;
        strip.scaleY = BL.floorH * this.whiteInv;
        interior.push(strip);
        const img = addImage(s, this.layers.byName.trenchFront, reg.get(key(f === 0 ? 'ground' : 'upper')).frame);
        img.x = b.x;
        img.y = gy - f * BL.floorH;
        floors.push(img);
      }
      const roof = addImage(s, this.layers.byName.trenchFront, reg.get(key('roof')).frame);
      roof.x = b.x;
      const back = addImage(s, this.layers.byName.structures, reg.get(key('rubbleBack')).frame);
      setFrame(back, reg, key('rubbleBack'));
      back.x = b.x;
      back.y = gy;
      const front = addImage(s, this.layers.byName.trenchFront, reg.get(key('rubbleFront')).frame);
      setFrame(front, reg, key('rubbleFront'));
      front.x = b.x;
      front.y = gy;
      this.views.push({ interior, floors, roof, back, front, shown: -1 });
    }
    this.update(state);
  }

  /** Damage states, fallen floors and rubble (only when they change). */
  update(state: BattleState): void {
    const reg = this.reg;
    const gy = VIEW.groundY;
    for (let i = 0; i < this.views.length && i < state.buildings.length; i++) {
      const b: BuildingState = state.buildings[i];
      const v = this.views[i];
      if (b.prop || !v.roof) continue;
      const damaged = b.maxHp > 0 && b.hp <= b.maxHp * BL.damaged;
      const shown = b.rubble ? 0 : b.floorsLeft * 2 + (damaged ? 1 : 0);
      if (shown === v.shown) continue;
      v.shown = shown;
      const key = (piece: BuildingPiece): string => buildingKey(b.look, b.width, b.slotsPerFloor, piece);
      const standing = b.rubble ? 0 : b.floorsLeft;
      for (let f = 0; f < v.floors.length; f++) {
        const on = f < standing;
        v.floors[f].visible = on;
        v.interior[f].visible = on;
        if (on) setFrame(v.floors[f], reg, key(f === 0 ? (damaged ? 'groundDamaged' : 'ground') : damaged ? 'upperDamaged' : 'upper'));
      }
      v.roof.visible = standing > 0;
      if (standing > 0) {
        setFrame(v.roof, reg, key(standing < b.floors ? 'roofBroken' : 'roof'));
        v.roof.y = gy - standing * BL.floorH;
      }
      v.back.visible = b.rubble;
      v.front.visible = b.rubble;
    }
  }
}

