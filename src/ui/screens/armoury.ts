/**
 * Armoury screen: every unit type and plane call-in, with its icon, its names in every nation and its price in
 * medals. Riflemen and sappers are free; anything else is bought once with medals and then fields for every nation.
 * Reached from the campaign map.
 */
import type { SupportKind, UnitKind } from '../../data/schema';
import type { ArmouryItemView } from '../contracts';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph, supportIcon, unitIcon } from '../shell/icons';
import { withScrollCue } from '../shell/scrollCue';
import type { ScreenFactory } from '../shell/types';

interface Section {
  name: string;
  items: ArmouryItemView[];
}

/** Core roles (free ones first), then the new units, then the plane call-ins. */
export function armourySections(items: readonly ArmouryItemView[]): Section[] {
  const core: Section = { name: 'Core roles', items: [] };
  const fresh: Section = { name: 'New units', items: [] };
  const planes: Section = { name: 'Air support', items: [] };
  for (const item of items) {
    if (item.type === 'support') planes.items.push(item);
    else if (item.isNew) fresh.items.push(item);
    else core.items.push(item);
  }
  return [core, fresh, planes].filter((s) => s.items.length > 0);
}

export const armouryScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-qm th-armoury');
  root.dataset.screen = 'armoury';

  const bar = el('header', 'th-bar');
  const back = button({
    testid: 'back',
    className: 'th-btn-icon',
    aria: 'Back to the map',
    content: [glyph('back')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('campaign');
    },
  });
  const points = el('div', 'th-points');
  const medalsNum = el('span', 'th-points-num');
  medalsNum.dataset.testid = 'medals-available';
  add(points, glyph('medal', 'th-icon th-points-icon'), medalsNum, el('span', 'th-points-sub', 'medals to spend'));
  add(bar, back, stencil('h1', 'ARMOURY', 'th-bar-title'), points);

  const list = el('div', 'th-qm-list th-scroll');
  list.dataset.scroll = '';
  const listCue = withScrollCue(list, 'dark');
  add(root, bar, listCue.el);

  function icon(item: ArmouryItemView): Element {
    return item.type === 'unit' ? unitIcon(item.kind as UnitKind, 40, ctx.opts.paintUnitIcon) : supportIcon(item.kind as SupportKind, 'th-support-icon th-arm-plane');
  }

  function itemCard(item: ArmouryItemView): HTMLElement {
    const card = el('article', 'th-up th-arm');
    card.dataset.testid = `armoury-item-${item.id}`;
    card.dataset.owned = item.owned ? 'true' : 'false';
    if (item.owned) card.classList.add('is-max');
    const pic = el('div', 'th-arm-icon');
    pic.append(icon(item));
    const text = el('div', 'th-up-text');
    add(text, el('h3', 'th-up-name', item.name), el('p', 'th-up-desc', item.blurb));
    const price = el('span', 'th-btn-sub');
    let label: string;
    if (item.free) {
      label = 'Free';
      price.textContent = 'Issued';
    } else if (item.owned) {
      label = 'Owned';
      price.textContent = 'All nations';
    } else {
      label = 'Buy';
      add(price, glyph('medal', 'th-icon th-icon-small'), String(item.price));
    }
    const buy = button({
      testid: `armoury-buy-${item.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-up-buy',
      aria: item.owned ? `${item.name}: owned` : `Buy ${item.name} for ${item.price} medals`,
      content: [el('span', 'th-btn-label', label), price],
      onTap: () => {
        if (!item.canBuy) {
          ctx.app.uiSound('deny');
          return;
        }
        ctx.app.uiSound('confirm');
        if (ctx.app.buyArmoury) ctx.app.buyArmoury(item.id);
        ctx.reload();
      },
    });
    buy.disabled = !item.canBuy;
    const side = el('div', 'th-up-side');
    side.append(buy);
    add(card, pic, text, side);
    return card;
  }

  function render(): void {
    const view = ctx.view();
    medalsNum.textContent = String(view.medals ?? view.pointsAvailable);
    const scrollTop = list.scrollTop;
    clear(list);
    const sections = armourySections(view.armoury ?? []);
    if (sections.length === 0) list.append(el('p', 'th-type th-qm-empty', 'The Armoury is empty.'));
    for (const s of sections) {
      const section = el('section', 'th-qm-group');
      const heading = el('h2', 'th-group');
      add(heading, glyph('medal', 'th-icon th-group-icon'), el('span', undefined, s.name));
      const grid = el('div', 'th-qm-grid');
      for (const item of s.items) grid.append(itemCard(item));
      add(section, heading, grid);
      list.append(section);
    }
    list.scrollTop = scrollTop;
    listCue.update();
  }

  render();

  return {
    el: root,
    refresh: render,
    resize: () => listCue.update(),
    destroy: () => listCue.destroy(),
    back() {
      ctx.go('campaign');
    },
  };
};
