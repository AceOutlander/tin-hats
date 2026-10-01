/**
 * Quartermaster screen: the upgrade list grouped by HQ and sappers, then by
 * unit, with level pips, per-level effects, buy and refund, and Refund all.
 */
import { FACTIONS } from '../../data/factions';
import type { UnitKind } from '../../data/schema';
import type { UpgradeView } from '../contracts';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph, helmetIcon, unitIcon } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

interface Group {
  unit: UnitKind | null;
  name: string;
  items: UpgradeView[];
}

/** HQ and sapper upgrades first, then one group per unit in the order the data lists them. */
export function groupUpgrades(upgrades: readonly UpgradeView[]): Group[] {
  const hq: Group = { unit: null, name: 'HQ and sappers', items: [] };
  const groups: Group[] = [];
  for (const up of upgrades) {
    if (up.unit === null || up.unit === 'sapper') {
      hq.items.push(up);
      continue;
    }
    let group = groups.find((g) => g.unit === up.unit);
    if (!group) {
      group = { unit: up.unit, name: FACTIONS.british.unitNames[up.unit], items: [] };
      groups.push(group);
    }
    group.items.push(up);
  }
  return hq.items.length > 0 ? [hq, ...groups] : groups;
}

export const quartermasterScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-qm');
  root.dataset.screen = 'quartermaster';

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
  const pointsNum = el('span', 'th-points-num');
  pointsNum.dataset.testid = 'points-available';
  const pointsSub = el('span', 'th-points-sub');
  add(points, glyph('chevron', 'th-icon th-points-icon'), pointsNum, pointsSub);
  const refundAll = button({
    testid: 'refund-all',
    label: 'Refund all',
    className: 'th-btn-small',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.app.refundAll();
      ctx.reload();
    },
  });
  add(bar, back, stencil('h1', 'QUARTERMASTER', 'th-bar-title'), points, refundAll);

  const list = el('div', 'th-qm-list th-scroll');
  list.dataset.scroll = '';
  add(root, bar, list);

  function upgradeCard(up: UpgradeView): HTMLElement {
    const card = el('article', 'th-up');
    card.dataset.level = String(up.level);
    if (up.level >= up.maxLevel) card.classList.add('is-max');

    const text = el('div', 'th-up-text');
    const levels = el('ol', 'th-levels');
    for (let i = 0; i < up.maxLevel; i++) {
      const row = el('li', 'th-level');
      if (i < up.level) row.classList.add('is-owned');
      else if (i === up.level) row.classList.add('is-next');
      const pip = el('i', 'th-pip');
      if (i < up.level) pip.classList.add('is-on');
      add(row, pip, el('span', undefined, up.levelText[i] ?? `Level ${i + 1}`));
      levels.append(row);
    }
    add(text, el('h3', 'th-up-name', up.name), el('p', 'th-up-desc', up.description), levels);

    const actions = el('div', 'th-up-actions');
    const refund = button({
      testid: `upgrade-refund-${up.id}`,
      className: 'th-btn-small th-up-refund',
      label: 'Refund',
      aria: `Refund one level of ${up.name}`,
      onTap: () => {
        ctx.app.uiSound('click');
        ctx.app.refundUpgrade(up.id);
        ctx.reload();
      },
    });
    refund.disabled = !up.canRefund;
    const maxed = up.level >= up.maxLevel;
    const cost = el('span', 'th-btn-sub');
    if (maxed) cost.textContent = 'Full';
    else add(cost, glyph('chevron', 'th-icon th-icon-small'), String(up.cost));
    const buy = button({
      testid: `upgrade-buy-${up.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-up-buy',
      aria: maxed ? `${up.name} is at full level` : `Buy ${up.name} level ${up.level + 1} for ${up.cost} ${up.cost === 1 ? 'point' : 'points'}`,
      content: [el('span', 'th-btn-label', maxed ? 'Max' : 'Buy'), cost],
      onTap: () => {
        ctx.app.uiSound('confirm');
        ctx.app.buyUpgrade(up.id);
        ctx.reload();
      },
    });
    buy.disabled = !up.canBuy;
    add(actions, refund, buy);
    add(card, text, actions);
    return card;
  }

  function render(): void {
    const view = ctx.view();
    pointsNum.textContent = String(view.pointsAvailable);
    pointsSub.textContent = `to spend · ${view.pointsSpent} of ${view.pointsEarned} issued`;
    refundAll.disabled = view.pointsSpent <= 0;

    // Rebuild the list but keep the player's place and focus.
    const scrollTop = list.scrollTop;
    const active = document.activeElement instanceof HTMLElement && list.contains(document.activeElement) ? document.activeElement.dataset.testid : undefined;
    clear(list);
    const groups = groupUpgrades(view.upgrades);
    if (groups.length === 0) list.append(el('p', 'th-type th-qm-empty', 'Nothing in the stores yet.'));
    for (const group of groups) {
      const section = el('section', 'th-qm-group');
      const heading = el('h2', 'th-group');
      const icon = group.unit ? unitIcon(group.unit, 30, ctx.opts.paintUnitIcon) : helmetIcon('th-helmet th-unit-icon');
      icon.classList.add('th-group-icon');
      add(heading, icon, el('span', undefined, group.name));
      const grid = el('div', 'th-qm-grid');
      for (const up of group.items) grid.append(upgradeCard(up));
      add(section, heading, grid);
      list.append(section);
    }
    list.scrollTop = scrollTop;
    if (active) {
      const again = list.querySelector<HTMLButtonElement>(`[data-testid="${active}"]`);
      if (again) {
        if (!again.disabled) again.focus({ preventScroll: true });
        else {
          const sibling = again.parentElement ? again.parentElement.querySelector<HTMLButtonElement>('button:not(:disabled)') : null;
          if (sibling) sibling.focus({ preventScroll: true });
        }
      }
    }
  }

  render();

  return {
    el: root,
    refresh: render,
    back() {
      ctx.go('campaign');
    },
  };
};
