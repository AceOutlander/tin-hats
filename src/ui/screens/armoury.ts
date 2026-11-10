/**
 * The Shop (it was the Armoury; screen id and test ids kept): call-in charges bought with medals, one at a time (each
 * use in battle spends one; owner, 2026-11-09), the extras (the Battle for Poland as a locked entry with its medal
 * price: no purchase flow in this repo), and every unit type (free, unlocked, or locked with the mission that unlocks
 * it; units are unlocked by missions, never sold). Reached from the campaign map.
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

/** Call-in charges, then the extras, then the core roles (free ones first) and the new units. */
export function armourySections(items: readonly ArmouryItemView[]): Section[] {
  const charges: Section = { name: 'Call-in charges', items: [] };
  const extras: Section = { name: 'Extras', items: [] };
  const core: Section = { name: 'Core roles', items: [] };
  const fresh: Section = { name: 'New units', items: [] };
  for (const item of items) {
    if (item.type === 'support') charges.items.push(item);
    else if (item.type === 'extra') extras.items.push(item);
    else if (item.isNew) fresh.items.push(item);
    else core.items.push(item);
  }
  return [charges, extras, core, fresh].filter((s) => s.items.length > 0);
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
  add(bar, back, stencil('h1', 'SHOP', 'th-bar-title'), points);

  const list = el('div', 'th-qm-list th-scroll');
  list.dataset.scroll = '';
  const listCue = withScrollCue(list, 'dark');
  add(root, bar, listCue.el);

  function icon(item: ArmouryItemView): Element {
    if (item.type === 'support') return supportIcon(item.kind as SupportKind, 'th-support-icon th-arm-plane');
    if (item.type === 'extra') return glyph('lock', 'th-icon th-arm-lock');
    return unitIcon(item.kind as UnitKind, 40, ctx.opts.paintUnitIcon);
  }

  function itemCard(item: ArmouryItemView): HTMLElement {
    const card = el('article', 'th-up th-arm');
    card.dataset.testid = `armoury-item-${item.id}`;
    card.dataset.owned = item.owned ? 'true' : 'false';
    if (item.owned) card.classList.add('is-max');
    const pic = el('div', 'th-arm-icon');
    pic.append(icon(item));
    const text = el('div', 'th-up-text');
    const name = el('h3', 'th-up-name', item.name);
    if (item.type === 'support') {
      const held = el('span', 'th-arm-count', ` ×${item.count ?? 0}`);
      held.dataset.testid = `armoury-count-${item.id}`;
      name.append(held);
    }
    add(text, name, el('p', 'th-up-desc', item.blurb));
    const price = el('span', 'th-btn-sub');
    let label: string;
    let aria: string;
    if (item.type === 'support') {
      label = 'Buy 1';
      add(price, glyph('medal', 'th-icon th-icon-small'), String(item.price));
      aria = `Buy one ${item.name} charge for ${item.price} medals (${item.count ?? 0} held)`;
    } else if (item.type === 'extra') {
      // A price in data only: the unlock itself is never in this repo.
      label = item.lockedNote ?? 'Locked';
      add(price, glyph('medal', 'th-icon th-icon-small'), String(item.price));
      aria = `${item.name}: ${item.price} medals, ${(item.lockedNote ?? 'locked').toLowerCase()}`;
    } else if (item.free) {
      label = 'Free';
      price.textContent = 'Issued';
      aria = `${item.name}: unlocked`;
    } else if (item.owned) {
      // "Unlocked" ran past the 56 px button (sweep, DECISIONS 456): "Owned" says the same and fits.
      label = 'Owned';
      price.textContent = 'All nations';
      aria = `${item.name}: unlocked`;
    } else {
      // Units are unlocked by missions, never bought (owner, 2026-11-09).
      label = 'Locked';
      price.textContent = item.lockedNote ?? '';
      aria = `${item.name}: unlocked in ${item.lockedNote ?? 'a later mission'}`;
    }
    const buy = button({
      testid: `armoury-buy-${item.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-up-buy',
      aria,
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
    medalsNum.textContent = String(view.medals ?? 0);
    const scrollTop = list.scrollTop;
    clear(list);
    const sections = armourySections(view.armoury ?? []);
    if (sections.length === 0) list.append(el('p', 'th-type th-qm-empty', 'The Shop is empty.'));
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
