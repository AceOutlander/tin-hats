/**
 * Capture points on the battlefield (FOUNDATIONS.md 4.5): a flagpole at the centre of each zone with the holder's
 * colours (run up the pole after a capture), two short posts marking the zone's edges, and a thin bar over the pole
 * that fills in the taker's colours while a side holds the zone alone. Everything is tinted copies of the white
 * sprite, so nothing new goes into the atlas.
 */
import type Phaser from 'phaser';
import { TRENCH_LAYOUT } from '../data/artLayout';
import { POINT_ART } from '../data/ground';
import { VIEW } from '../data/view';
import type { BattleState } from '../sim';
import type { SpriteRegistry } from './atlas';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, WHITE_SIZE } from './sprites';
import { pointFlag } from './flagMounts';

type Img = Phaser.GameObjects.Image;

interface PointView {
  pole: Img;
  flag: Img;
  posts: [Img, Img];
  barBack: Img;
  bar: Img;
  /** The owner the flag shows, and how far it has run up the pole (0..1). */
  owner: number;
  hoist: number;
}

export class PointViews {
  private views: PointView[] = [];
  private readonly inv: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.inv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
  }

  private rect(layer: Phaser.GameObjects.Layer, x: number, y: number, w: number, h: number, tint: number): Img {
    const img = addImage(this.scene, layer, this.reg.get(RENDER_KEYS.whiteTL).frame);
    img.x = x;
    img.y = y;
    img.scaleX = w * this.inv;
    img.scaleY = h * this.inv;
    img.setTint(tint);
    return img;
  }

  clear(): void {
    for (const v of this.views) {
      for (const img of [v.pole, v.flag, v.posts[0], v.posts[1], v.barBack, v.bar]) img.destroy();
    }
    this.views = [];
  }

  build(state: BattleState): void {
    this.clear();
    const A = POINT_ART;
    const base = VIEW.groundY + A.backY;
    const back = this.layers.byName.structures;
    const top = this.layers.byName.markers;
    for (const p of state.points) {
      const half = p.width / 2;
      const pole = this.rect(back, p.x - A.poleW / 2, base - A.poleH, A.poleW, A.poleH, A.poleColor);
      const flag = this.rect(back, p.x + A.poleW / 2, base - A.poleH, A.flagW, A.flagH, A.neutralFlag);
      const posts: [Img, Img] = [
        this.rect(back, p.x - half - A.postW / 2, base - A.postH, A.postW, A.postH, A.postColor),
        this.rect(back, p.x + half - A.postW / 2, base - A.postH, A.postW, A.postH, A.postColor),
      ];
      const barY = base - A.poleH - A.barGap - A.barH;
      const barBack = this.rect(top, p.x - A.barW / 2, barY, A.barW, A.barH, A.barBack);
      const bar = this.rect(top, p.x - A.barW / 2, barY, A.barW, A.barH, A.neutralFlag);
      barBack.visible = false;
      bar.visible = false;
      this.views.push({ pole, flag, posts, barBack, bar, owner: -2, hoist: 1 });
    }
  }

  update(state: BattleState, dt: number): void {
    const A = POINT_ART;
    const points = state.points;
    for (let i = 0; i < points.length && i < this.views.length; i++) {
      const p = points[i];
      const v = this.views[i];
      if (p.owner !== v.owner) {
        // A capture runs the new colours up the pole; the first frame of the battle shows them already up.
        v.hoist = v.owner === -2 ? 1 : 0;
        v.owner = p.owner;
        v.flag.setTint(p.owner === 0 || p.owner === 1 ? TRENCH_LAYOUT.pennant[state.sides[p.owner].faction] : A.neutralFlag);
      }
      if (v.hoist < 1) v.hoist = Math.min(1, v.hoist + dt / A.hoist);
      // The cloth flies away from the holder's own end of the field, its hoist on the pole (src/render/flagMounts.ts).
      const cloth = pointFlag(p.x, p.owner === 1 ? -1 : 1, v.hoist, VIEW.groundY).cloth;
      v.flag.x = cloth.hoistX;
      v.flag.y = cloth.top;
      v.flag.scaleX = cloth.dir * cloth.w * this.inv;
      const taking = p.capturing === 0 || p.capturing === 1;
      v.barBack.visible = taking;
      v.bar.visible = taking;
      if (taking) {
        v.bar.scaleX = Math.max(0, Math.min(1, p.progress)) * A.barW * this.inv;
        v.bar.setTint(TRENCH_LAYOUT.pennant[state.sides[p.capturing].faction]);
      }
    }
  }
}
