/**
 * Quartermaster screen: the upgrade list grouped by HQ and sappers, then by
 * unit, with level pips, per-level effects, buy and refund, and Refund all.
 */
import type { SupportKind, UnitKind } from '../../data/schema';
import type { UpgradeView } from '../contracts';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph, helmetIcon, supportIcon, unitIcon } from '../shell/icons';
import { withScrollCue } from '../shell/scrollCue';
import type { ScreenFactory } from '../shell/types';

/** Size of an upgrade's battle preview in CSS px: as wide as the Refund and Buy buttons under it. */
const PREVIEW_W = 118;
const PREVIEW_H = 44;

interface Group {
  unit: UnitKind | null;
  support: SupportKind | null;
  name: string;
  items: UpgradeView[];
}

/**
 * HQ and sapper upgrades first, then one group per unit and per call-in in the order the data lists them. Group
 * names come with the view (the player's own nation).
 */
export function groupUpgrades(upgrades: readonly UpgradeView[]): Group[] {
  let hq: Group | null = null;
  const groups: Group[] = [];
  for (const up of upgrades) {
    if (up.support === null && (up.unit === null || up.unit === 'sapper')) {
      if (!hq) hq = { unit: null, support: null, name: up.group, items: [] };
      hq.items.push(up);
      continue;
    }
    const unit = up.support === null ? up.unit : null;
    let group = groups.find((g) => g.unit === unit && g.support === up.support);
    if (!group) {
      group = { unit, support: up.support, name: up.group, items: [] };
      groups.push(group);
    }
    group.items.push(up);
  }
  return hq ? [hq, ...groups] : groups;
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
  add(points, glyph('medal', 'th-icon th-points-icon'), pointsNum, pointsSub);
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
  const listCue = withScrollCue(list, 'dark');
  add(root, bar, listCue.el);

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
    else add(cost, glyph('medal', 'th-icon th-icon-small'), String(up.cost));
    const buy = button({
      testid: `upgrade-buy-${up.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-up-buy',
      aria: maxed ? `${up.name} is at full level` : `Buy ${up.name} level ${up.level + 1} for ${up.cost} ${up.cost === 1 ? 'medal' : 'medals'}`,
      content: [el('span', 'th-btn-label', maxed ? 'Max' : 'Buy'), cost],
      onTap: () => {
        ctx.app.uiSound('confirm');
        ctx.app.buyUpgrade(up.id);
        ctx.reload();
      },
    });
    buy.disabled = !up.canBuy;
    add(actions, refund, buy);
    const side = el('div', 'th-up-side');
    const preview = upgradePreview(up);
    if (preview) side.append(preview);
    side.append(actions);
    add(card, text, side);
    return card;
  }

  /** How the next level looks in battle (the top level once it is full), when the app can paint it. */
  function upgradePreview(up: UpgradeView): HTMLElement | null {
    const paint = ctx.opts.paintUpgradePreview;
    if (!paint || up.maxLevel <= 0) return null;
    const maxed = up.level >= up.maxLevel;
    const level = maxed ? up.maxLevel : up.level + 1;
    const fig = el('figure', 'th-up-preview');
    fig.dataset.testid = `upgrade-preview-${up.id}`;
    fig.dataset.level = String(level);
    const canvas = el('canvas', 'th-up-preview-pic');
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(PREVIEW_W * dpr);
    canvas.height = Math.round(PREVIEW_H * dpr);
    canvas.setAttribute('aria-hidden', 'true');
    try {
      if (!paint(canvas, up.id, level)) return null;
    } catch (err) {
      console.warn('Tin Hats UI: paintUpgradePreview failed', err);
      return null;
    }
    const caption = el('figcaption', 'th-up-preview-cap', maxed ? 'In battle' : `Level ${level}`);
    fig.setAttribute('aria-label', maxed ? `${up.name} as it looks in battle` : `${up.name} level ${level} as it will look in battle`);
    add(fig, canvas, caption);
    return fig;
  }

  function render(): void {
    const view = ctx.view();
    pointsNum.textContent = String(view.pointsAvailable);
    pointsSub.textContent = `medals to spend · ${view.pointsSpent} in upgrades`;
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
      const icon = group.support
        ? supportIcon(group.support, 'th-support-icon th-unit-icon')
        : group.unit
          ? unitIcon(group.unit, 30, ctx.opts.paintUnitIcon)
          : helmetIcon('th-helmet th-unit-icon');
      icon.classList.add('th-group-icon');
      add(heading, icon, el('span', undefined, group.name));
      const grid = el('div', 'th-qm-grid');
      for (const up of group.items) grid.append(upgradeCard(up));
      add(section, heading, grid);
      list.append(section);
    }
    list.scrollTop = scrollTop;
    listCue.update();
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
    resize: () => listCue.update(),
    destroy: () => listCue.destroy(),
    back() {
      ctx.go('campaign');
    },
  };
};
