/**
 * The prep phase on the battlefield: each build site as a pegged-out patch of turned earth with a progress bar above
 * it (it gives no protection until done, so it is drawn plainly), and the ghost of the build the player is placing,
 * green where it can go and red where it cannot. Pooled images on the markers layer; nothing is drawn for a mission
 * without a prep phase.
 */
import type Phaser from 'phaser';
import { RENDER } from '../data/render';
import { VIEW } from '../data/view';
import type { BattleState } from '../sim';
import type { SpriteRegistry } from './atlas';
import type { PlacingGhost } from './contracts';
import { addImage, type Layers } from './layers';
import { RENDER_KEYS, WHITE_SIZE } from './sprites';

type Img = Phaser.GameObjects.Image;

/** What the player is placing (see PlacingGhost). */
export type Placing = PlacingGhost;

const S = RENDER.buildSites;

export class BuildSiteViews {
  private readonly patches: Img[] = [];
  private readonly barBack: Img[] = [];
  private readonly barFill: Img[] = [];
  private readonly ghost: Img;
  private readonly ghostEdge: Img;
  private readonly inv: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.inv = 1 / (WHITE_SIZE * reg.get(RENDER_KEYS.whiteTL).scale);
    this.ghost = this.white(S.ghostOk);
    this.ghostEdge = this.white(S.ghostOk);
  }

  private white(tint: number): Img {
    const img = addImage(this.scene, this.layers.byName.markers, this.reg.get(RENDER_KEYS.whiteTL).frame);
    img.setTint(tint);
    img.visible = false;
    return img;
  }

  private box(img: Img, left: number, top: number, w: number, h: number): void {
    img.x = left;
    img.y = top;
    img.scaleX = w * this.inv;
    img.scaleY = h * this.inv;
  }

  update(state: BattleState, placing: Placing | null): void {
    const sites = state.sites;
    while (this.patches.length < sites.length) {
      this.patches.push(this.white(S.patch));
      this.barBack.push(this.white(S.barBack));
      this.barFill.push(this.white(S.barFill));
    }
    const gy = VIEW.groundY;
    for (let i = 0; i < this.patches.length; i++) {
      const on = i < sites.length;
      const patch = this.patches[i];
      const back = this.barBack[i];
      const fill = this.barFill[i];
      patch.visible = on;
      back.visible = on;
      fill.visible = on;
      if (!on) continue;
      const site = sites[i];
      const left = site.x - site.width / 2;
      this.box(patch, left, gy - S.patchH, site.width, S.patchH * 2);
      patch.alpha = S.patchAlpha + (1 - S.patchAlpha) * site.progress * 0.5;
      const barW = Math.max(S.barMinW, site.width * 0.8);
      const barLeft = site.x - barW / 2;
      const barTop = gy - S.barY;
      this.box(back, barLeft - 1, barTop - 1, barW + 2, S.barH + 2);
      back.alpha = 0.8;
      this.box(fill, barLeft, barTop, Math.max(0.01, barW * site.progress), S.barH);
      fill.setTint(site.worker >= 0 ? S.barFill : S.barIdle);
    }
    const g = this.ghost;
    const e = this.ghostEdge;
    g.visible = placing !== null;
    e.visible = placing !== null;
    if (placing !== null) {
      const tint = placing.ok ? S.ghostOk : S.ghostBad;
      const left = placing.x - placing.width / 2;
      this.box(g, left, gy - S.ghostH, placing.width, S.ghostH);
      g.setTint(tint);
      g.alpha = S.ghostAlpha;
      this.box(e, left, gy - 1, placing.width, 3);
      e.setTint(tint);
      e.alpha = 1;
    }
  }

  clear(): void {
    for (const list of [this.patches, this.barBack, this.barFill]) {
      for (const img of list) img.destroy();
      list.length = 0;
    }
    this.ghost.visible = false;
    this.ghostEdge.visible = false;
  }
}
