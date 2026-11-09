/**
 * Obstacles and water on the battlefield (FOUNDATIONS.md 4.4, 4.6 and 4.8; art in src/art/structures/obstacles.ts):
 * tank traps and road blocks as end-on pieces across their width (far half behind the unit rows, near half over them;
 * the wreck once gone), sandbag walls and the bags along a sandbagged building's front, the minefields the player's side
 * can see (a warning sign at each end and the humps of the mines still there), bridges (the deck under the men, the
 * near girder and piers over the water, the broken ends once blown, a pontoon's planks on boats) and the ferry's boat
 * with its load. Built from battle state; nothing is made for a battle without any of them.
 */
import type Phaser from 'phaser';
import { OBSTACLE_KEYS as K } from '../art/structures/obstacles';
import { OBSTACLE_ART as A } from '../data/obstacles';
import type { BuildableId, MissionDef } from '../data/schema';
import { VIEW } from '../data/view';
import type { BattleState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';

type Img = Phaser.GameObjects.Image;

const NEW_BUILDS: readonly BuildableId[] = ['tankTrap', 'roadBlock', 'sandbags', 'minefield'];

/** True if a mission can show any of this: its own obstacles, fields, bridges or ferries, or a prep that builds them. */
export function obstaclesNeeded(m: MissionDef): boolean {
  if ((m.obstacles?.length ?? 0) > 0 || (m.minefields?.length ?? 0) > 0 || (m.bridges?.length ?? 0) > 0) return true;
  if ((m.capturePoints ?? []).some((p) => p.ferry !== undefined)) return true;
  const preps = [m.prep, ...(m.phases ?? []).map((p) => p.prep)];
  return preps.some((p) => p?.buildables?.some((b) => NEW_BUILDS.includes(b)) === true);
}

/** Deterministic 0..1 for the j-th mine of field `id` (`salt` picks x or the row). */
function h01(id: number, j: number, salt: number): number {
  const s = Math.sin(id * 91.7 + j * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

interface PieceView {
  back: Img[];
  front: Img[];
  alive: boolean;
}

interface FieldView {
  signs: [Img, Img];
  mines: Img[];
  /** Where each mine lies (fixed at build, over the field's first extent) and its depth offset. */
  mineX: number[];
  mineY: number[];
}

interface BridgeView {
  deck: Img[];
  near: Img[];
  broken: [Img, Img];
}

export class ObstacleViews {
  private obstacles: PieceView[] = [];
  private walls: Img[] = [];
  private sandbagCount = 0;
  private fields: FieldView[] = [];
  private bridges: BridgeView[] = [];
  private boats: { hull: Img; load: Img }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {}

  private img(layer: Phaser.GameObjects.Layer, key: string, x: number, y: number, scaleX = 1): Img {
    const fr = this.reg.get(key);
    const img = addImage(this.scene, layer, fr.frame);
    img.x = x;
    img.y = y;
    img.scaleX = scaleX / fr.scale;
    img.scaleY = 1 / fr.scale;
    return img;
  }

  private setKey(img: Img, key: string, scaleX = 1): void {
    const fr = this.reg.get(key);
    if (img.frame !== fr.frame) img.setFrame(fr.frame);
    img.scaleX = scaleX / fr.scale;
    img.scaleY = 1 / fr.scale;
  }

  clear(): void {
    for (const o of this.obstacles) for (const img of [...o.back, ...o.front]) img.destroy();
    for (const img of this.walls) img.destroy();
    for (const f of this.fields) for (const img of [...f.signs, ...f.mines]) img.destroy();
    for (const b of this.bridges) for (const img of [...b.deck, ...b.near, ...b.broken]) img.destroy();
    for (const b of this.boats) {
      b.hull.destroy();
      b.load.destroy();
    }
    this.obstacles = [];
    this.walls = [];
    this.sandbagCount = 0;
    this.fields = [];
    this.bridges = [];
    this.boats = [];
  }

  build(state: BattleState): void {
    this.clear();
    const gy = VIEW.groundY;
    for (const b of state.bridges) {
      const span = b.x1 - b.x0;
      const n = Math.max(1, Math.round(span / A.deckTileW));
      const sx = span / (n * A.deckTileW);
      const pontoon = b.look === 'pontoon';
      const deck: Img[] = [];
      const near: Img[] = [];
      for (let i = 0; i < n; i++) {
        const x = b.x0 + i * A.deckTileW * sx;
        deck.push(this.img(this.layers.byName.groundDecals, pontoon ? K.pontoonDeck : K.deck, x, gy, sx));
        near.push(this.img(this.layers.byName.trenchFront, pontoon ? K.pontoonNear : K.deckNear, x, gy, sx));
      }
      const broken: [Img, Img] = [
        this.img(this.layers.byName.groundDecals, K.deckBroken, b.x0, gy, 1),
        this.img(this.layers.byName.groundDecals, K.deckBroken, b.x1, gy, -1),
      ];
      this.bridges.push({ deck, near, broken });
    }
    for (let i = 0; i < state.ferries.length; i++) {
      const hull = this.img(this.layers.byName.structures, K.boat, 0, gy + A.boatDy);
      const load = this.img(this.layers.byName.structures, K.boatLoad, 0, gy + A.boatDy);
      hull.visible = false;
      load.visible = false;
      this.boats.push({ hull, load });
    }
    this.sync(state);
  }

  /** Views for what the battle added since (built in a prep phase): obstacles, fields and sandbags. */
  sync(state: BattleState): void {
    const gy = VIEW.groundY;
    for (let i = this.obstacles.length; i < state.obstacles.length; i++) {
      const o = state.obstacles[i];
      const n = Math.max(1, Math.min(6, Math.round(o.width / A.piecePitch)));
      const trap = o.kind === 'tankTrap';
      const back: Img[] = [];
      const front: Img[] = [];
      for (let j = 0; j < n; j++) {
        const x = o.x + (j - (n - 1) / 2) * A.piecePitch;
        back.push(this.img(this.layers.byName.structures, trap ? K.hedgehogBack : K.roadBlockBack, x, gy));
        front.push(this.img(this.layers.byName.wireFront, trap ? K.hedgehogFront : K.roadBlockFront, x, gy));
      }
      this.obstacles.push({ back, front, alive: true });
    }
    for (let i = this.sandbagCount; i < state.sandbags.length; i++) {
      const sb = state.sandbags[i];
      if (sb.building >= 0) {
        const sx = sb.width / A.lowTileW;
        this.walls.push(this.img(this.layers.byName.wireFront, K.sandbagLow, sb.x - sb.width / 2, gy + 44, sx));
      } else {
        const sx = sb.width / A.wallTileW;
        this.walls.push(this.img(this.layers.byName.trenchBack, K.sandbagBack, sb.x - sb.width / 2, gy, sx));
        this.walls.push(this.img(this.layers.byName.trenchFront, K.sandbagFront, sb.x - sb.width / 2, gy, sx));
      }
    }
    this.sandbagCount = state.sandbags.length;
    for (let i = this.fields.length; i < state.minefields.length; i++) {
      const f = state.minefields[i];
      const x0 = f.x - f.width / 2;
      const signs: [Img, Img] = [
        this.img(this.layers.byName.structures, K.mineSign, x0, gy - 34),
        this.img(this.layers.byName.structures, K.mineSign, x0 + f.width, gy - 34),
      ];
      const count = Math.max(1, Math.round((f.width / 100) * A.minesPer100));
      const mines: Img[] = [];
      const mineX: number[] = [];
      const mineY: number[] = [];
      for (let j = 0; j < count; j++) {
        mineX.push(x0 + h01(f.id, j, 1) * f.width);
        mineY.push(VIEW.rowDy[Math.floor(h01(f.id, j, 2) * VIEW.rows)] + (h01(f.id, j, 3) - 0.5) * 12);
        mines.push(this.img(this.layers.byName.groundDecals, K.mine, mineX[j], gy + mineY[j]));
      }
      this.fields.push({ signs, mines, mineX, mineY });
    }
  }

  /** Every frame: what stands, what the player's side can see, and where the boats are. */
  update(state: BattleState, playerSide: number): void {
    for (let i = 0; i < this.obstacles.length && i < state.obstacles.length; i++) {
      const o = state.obstacles[i];
      const v = this.obstacles[i];
      if (o.alive === v.alive) continue;
      v.alive = o.alive;
      const down = o.kind === 'tankTrap' ? K.hedgehogDown : K.roadBlockDown;
      for (const img of v.back) this.setKey(img, down);
      for (const img of v.front) img.visible = false;
    }
    const side = playerSide === 1 ? 1 : 0;
    for (let i = 0; i < this.fields.length && i < state.minefields.length; i++) {
      const f = state.minefields[i];
      const v = this.fields[i];
      const seen = f.alive && f.known[side];
      const x0 = f.x - f.width / 2;
      const x1 = f.x + f.width / 2;
      v.signs[0].visible = seen;
      v.signs[1].visible = seen;
      if (seen) {
        v.signs[0].x = x0;
        v.signs[1].x = x1;
      }
      // As many mines as the density says are still there, of those inside what is left of the field.
      const shown = Math.round(v.mines.length * Math.min(1, f.density / 0.6));
      for (let j = 0; j < v.mines.length; j++) v.mines[j].visible = seen && j < shown && v.mineX[j] >= x0 && v.mineX[j] <= x1;
    }
    for (let i = 0; i < this.bridges.length && i < state.bridges.length; i++) {
      const b = state.bridges[i];
      const v = this.bridges[i];
      for (const img of v.deck) img.visible = b.standing;
      for (const img of v.near) img.visible = b.standing;
      const broken = !b.standing && b.downAt >= 0;
      v.broken[0].visible = broken;
      v.broken[1].visible = broken;
    }
    for (let i = 0; i < this.boats.length && i < state.ferries.length; i++) {
      const f = state.ferries[i];
      const v = this.boats[i];
      v.hull.visible = f.sailing;
      v.load.visible = f.sailing && f.load > 0;
      if (!f.sailing) continue;
      const dir = f.to >= f.from ? 1 : -1;
      v.hull.x = f.boatX;
      v.load.x = f.boatX;
      const fr = this.reg.get(K.boat);
      v.hull.scaleX = dir / fr.scale;
      v.load.scaleX = dir / fr.scale;
    }
  }
}
