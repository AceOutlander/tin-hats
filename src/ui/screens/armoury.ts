/**
 * The Shop (it was the Armoury; screen id and test ids kept): call-in charges bought with medals, one at a time (each
 * use in battle spends one; owner, 2026-11-09), the extras (the Battle for Poland as a locked entry with its medal
 * price, listed only once that campaign exists: until then there is no card and no "Extras" heading; no purchase
 * flow in this repo), and every unit type (free, unlocked, or locked with the mission that unlocks it; units are
 * unlocked by missions, never sold). Reached from the campaign map. When the platform has a store section
 * (src/platform; the website has none) it sits under the call-in charges, drawn by ./storeSection, and the platform's
 * reward section, when it has one, sits under that, drawn the same way.
 *
 * While cosmetics are switched on (src/data/cosmetics.ts; they are off) the campaign view also carries the supply
 * crates and the Appearance tab: the crates as one more section under the call-in charges, the tab as a second page of
 * this screen ("Shop" and "Appearance" in the bar), both drawn by ./cosmetics. Without them in the view nothing of
 * either is built.
 */
import type { SupportKind, UnitKind } from '../../data/schema';
import type { ArmouryItemView, CrateOpenedView } from '../contracts';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph, supportIcon, unitIcon } from '../shell/icons';
import { withScrollCue } from '../shell/scrollCue';
import type { ScreenFactory } from '../shell/types';
import { appearanceList, crateSection } from './cosmetics';
import { openCrateOverlay, type CrateOpeningHandle } from './crateOpening';
import { createStoreSection } from './storeSection';

interface Section {
  name: string;
  items: ArmouryItemView[];
}

/**
 * Call-in charges, then the extras, then the core roles (free ones first) and the new units. A section with nothing
 * in it is left out, heading and all.
 */
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
  // The two pages of the screen, only while the view has an Appearance tab (cosmetics switched on).
  let tab: 'shop' | 'appearance' = 'shop';
  const tabs = el('div', 'th-tabs');
  tabs.setAttribute('role', 'tablist');
  const tabButtons = (['shop', 'appearance'] as const).map((id) => {
    const b = button({
      testid: `shop-tab-${id}`,
      className: 'th-btn-small th-tab',
      label: '',
      onTap: () => {
        if (tab === id) return;
        ctx.app.uiSound('click');
        tab = id;
        list.scrollTop = 0;
        render();
      },
    });
    b.setAttribute('role', 'tab');
    return b;
  });
  add(tabs, ...tabButtons);
  // The tabs join the bar only when there is an Appearance tab to show (render): without one the bar is as it was.
  add(bar, back, stencil('h1', 'SHOP', 'th-bar-title'), points);

  const list = el('div', 'th-qm-list th-scroll');
  list.dataset.scroll = '';
  const listCue = withScrollCue(list, 'dark');
  add(root, bar, listCue.el);

  // The platform's own section, when it has one: built once so its state outlives a refresh of the list.
  const platformStore = ctx.opts.store?.() ?? null;
  const sectionHooks = { sound: (name: 'click' | 'deny' | 'confirm') => ctx.app.uiSound(name), changed: () => listCue.update() };
  const store = platformStore ? createStoreSection(platformStore, sectionHooks) : null;
  const platformReward = ctx.opts.reward?.() ?? null;
  const reward = platformReward ? createStoreSection(platformReward, sectionHooks, 'reward') : null;
  const platformMembership = ctx.opts.membership?.() ?? null;
  const membership = platformMembership ? createStoreSection(platformMembership, sectionHooks, 'membership') : null;
  const platformSections = [store, reward, membership].filter((s) => s !== null);

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
      // "Coming later" ran 16 px out of the 56 px button (DECISIONS 456): the button says "Soon", the full note is read out.
      label = item.lockedNote === undefined ? 'Locked' : 'Soon';
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

  // A crate being opened, over the screen (one at a time).
  let opening: CrateOpeningHandle | null = null;
  // Counts redraws of the list: a portrait still waiting for its picture is not painted into a list that was replaced.
  let drawn = 0;

  function showCrate(opened: CrateOpenedView): void {
    opening?.close();
    const T = ctx.view().crates?.text;
    opening = openCrateOverlay(
      root,
      opened,
      { skip: T?.skip ?? '', done: T?.done ?? 'Done', newItem: T?.newItem ?? '' },
      {
        sound: (step) => ctx.app.crateSound?.(step, opened.rarity.id),
        paintItem: ctx.opts.paintCosmetic,
        closed: () => {
          opening = null;
          list.removeAttribute('inert');
        },
      },
    );
    list.setAttribute('inert', '');
  }

  function render(): void {
    const view = ctx.view();
    medalsNum.textContent = String(view.medals ?? 0);
    const scrollTop = list.scrollTop;
    clear(list);
    const mine = ++drawn;
    const appearance = view.appearance;
    if (appearance === undefined) {
      tab = 'shop';
      tabs.remove();
    } else {
      if (!tabs.isConnected) bar.insertBefore(tabs, points);
      tabButtons.forEach((b, i) => {
        const id = i === 0 ? 'shop' : 'appearance';
        const label = b.querySelector('.th-btn-label');
        if (label) label.textContent = id === 'shop' ? appearance.text.shopTab : appearance.text.tab;
        b.classList.toggle('is-on', tab === id);
        b.setAttribute('aria-selected', tab === id ? 'true' : 'false');
      });
    }
    if (appearance !== undefined) root.dataset.tab = tab;
    else delete root.dataset.tab;
    if (tab === 'appearance' && appearance !== undefined) {
      // The Appearance tab: what the player owns, to wear or take off.
      for (const node of appearanceList(ctx, appearance, () => mine === drawn)) list.append(node);
      list.scrollTop = scrollTop;
      listCue.update();
      return;
    }
    const crates = view.crates ? crateSection(ctx, view.crates, view.medals ?? 0, showCrate) : null;
    const sections = armourySections(view.armoury ?? []);
    if (sections.length === 0 && platformSections.length === 0) list.append(el('p', 'th-type th-qm-empty', 'The Shop is empty.'));
    // Under the call-in charges (what medals are spent on), above the extras and the units.
    const storeAt = sections[0]?.items[0]?.type === 'support' ? 1 : 0;
    sections.forEach((s, at) => {
      if (at === storeAt) {
        // The supply crates come first of what medals buy besides charges, then the platform's own sections.
        if (crates) list.append(crates);
        for (const s of platformSections) list.append(s.el);
      }
      const section = el('section', 'th-qm-group');
      const heading = el('h2', 'th-group');
      add(heading, glyph('medal', 'th-icon th-group-icon'), el('span', undefined, s.name));
      const grid = el('div', 'th-qm-grid');
      for (const item of s.items) grid.append(itemCard(item));
      add(section, heading, grid);
      list.append(section);
    });
    if (sections.length <= storeAt) {
      if (crates) list.append(crates);
      for (const s of platformSections) list.append(s.el);
    }
    list.scrollTop = scrollTop;
    listCue.update();
  }

  render();

  return {
    el: root,
    refresh: render,
    resize: () => listCue.update(),
    destroy: () => {
      opening?.close();
      drawn++;
      for (const s of platformSections) s.destroy();
      listCue.destroy();
    },
    back() {
      // Back during an opening skips to what the crate held; once that is on show, back closes it.
      if (opening) {
        if (opening.revealed()) opening.close();
        else opening.skip();
        return;
      }
      ctx.go('campaign');
    },
  };
};
