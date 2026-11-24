/**
 * The Shop's crate section and the Appearance tab's list (drawn by ./armoury.ts when the campaign view has them, which
 * it has only while cosmetics are switched on: src/data/cosmetics.ts). The game's rules are the app's: this only shows
 * what the view models say and reports what was pressed.
 *
 * A crate's whole table and its guarantee counters are on its card, before anything is bought, and again on the
 * confirmation every purchase goes through. Nothing here counts down, flashes for attention or hurries the player.
 */
import type { AppearanceView, CosmeticCardView, CrateCardView, CrateOpenedView, CratesView } from '../contracts';
import { paintCrateIcon } from '../shell/crateArt';
import { add, button, el, formatCount, iconCanvas } from '../shell/dom';
import { glyph } from '../shell/icons';
import type { ScreenCtx } from '../shell/types';
import { rarityBadge } from './crateOpening';

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

function crateCard(ctx: ScreenCtx, view: CratesView, card: CrateCardView, medals: number, show: (opened: CrateOpenedView) => void): HTMLElement {
  const T = view.text;
  const node = el('article', 'th-up th-crate');
  node.dataset.testid = `crate-card-${card.id}`;
  node.dataset.state = card.state;
  const pic = el('div', 'th-crate-pic');
  const canvas = iconCanvas(52, 'th-crate-icon');
  paintCrateIcon(canvas, card.tint);
  pic.append(canvas);

  const text = el('div', 'th-up-text');
  const name = el('h3', 'th-up-name', card.name);
  if (card.held > 0) {
    const held = el('span', 'th-arm-count', ` ×${card.held}`);
    held.dataset.testid = `crate-held-${card.id}`;
    name.append(held);
  }
  // The whole table, exactly: every rarity in words with its marks, and its chance.
  const odds = el('ul', 'th-odds');
  odds.dataset.testid = `crate-odds-${card.id}`;
  odds.setAttribute('aria-label', `${T.oddsHeading}: ${card.odds.map((o) => `${o.name} ${o.percent}`).join(', ')}`);
  for (const o of card.odds) {
    const row = el('li', 'th-odds-row');
    add(row, rarityBadge(o), el('b', 'th-odds-percent', o.percent));
    odds.append(row);
  }
  add(text, name, el('p', 'th-up-desc', card.blurb), odds);
  card.guarantees.forEach((line, i) => {
    const p = el('p', 'th-crate-line', line);
    p.dataset.testid = `crate-guarantee-${card.id}-${i}`;
    text.append(p);
  });
  if (card.completeNote !== null) {
    const note = el('p', 'th-crate-line th-crate-note', card.completeNote);
    note.dataset.testid = `crate-complete-${card.id}`;
    text.append(note);
  }

  const side = el('div', 'th-up-side');
  if (card.held > 0) {
    // A crate already held costs nothing to open, so nothing is asked.
    side.append(
      button({
        testid: `crate-open-${card.id}`,
        className: 'th-btn-small th-btn-stack th-crate-btn',
        aria: `Open a ${card.name} (${card.held} held)`,
        content: [el('span', 'th-btn-label', T.open), el('span', 'th-btn-sub', fill(T.held, { n: card.held }))],
        onTap: () => {
          const opened = ctx.app.openCrate ? ctx.app.openCrate(card.id) : null;
          if (!opened) {
            ctx.app.uiSound('deny');
            return;
          }
          ctx.app.uiSound('confirm');
          show(opened);
          ctx.reload();
        },
      }),
    );
  }
  if (card.state === 'soon') {
    const soon = button({
      testid: `crate-buy-${card.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-crate-btn th-crate-soon',
      aria: `${card.name}: ${formatCount(card.price)} medals, ${T.comingSoon.toLowerCase()}`,
      content: [el('span', 'th-btn-label', T.comingSoon), priceTag(card.price)],
      onTap: () => ctx.app.uiSound('deny'),
    });
    soon.disabled = true;
    side.append(soon);
  } else if (card.state !== 'none') {
    const buy = button({
      testid: `crate-buy-${card.id}`,
      className: 'th-btn-small th-btn-primary th-btn-stack th-crate-btn',
      aria: `Buy a ${card.name} for ${formatCount(card.price)} medals`,
      content: [el('span', 'th-btn-label', T.buy), priceTag(card.price)],
      onTap: () => {
        ctx.app.uiSound('click');
        // Every purchase is confirmed, with the price, the chances and the guarantees in front of the player.
        ctx.confirm({
          title: T.confirmTitle,
          body: fill(T.confirmBody, { name: card.name, price: formatCount(card.price), medals: formatCount(medals) }),
          details: [`${T.oddsHeading}: ${card.odds.map((o) => `${o.name} ${o.percent}`).join(', ')}.`, ...card.guarantees, ...(card.completeNote !== null ? [card.completeNote] : [])],
          yes: fill(T.confirmYes, { price: formatCount(card.price) }),
          no: T.confirmNo,
          plain: true,
          onYes: () => {
            const opened = ctx.app.buyCrate ? ctx.app.buyCrate(card.id) : null;
            if (!opened) {
              ctx.app.uiSound('deny');
              ctx.reload();
              return;
            }
            show(opened);
            ctx.reload();
          },
        });
      },
    });
    buy.disabled = card.state !== 'buy';
    side.append(buy);
  }
  add(node, pic, text, side);
  return node;
}

function priceTag(price: number): HTMLElement {
  const tag = el('span', 'th-btn-sub');
  add(tag, glyph('medal', 'th-icon th-icon-small'), formatCount(price));
  return tag;
}

/** The crate section: its heading, a line of what a crate is, and a card per crate. */
export function crateSection(ctx: ScreenCtx, view: CratesView, medals: number, show: (opened: CrateOpenedView) => void): HTMLElement {
  const section = el('section', 'th-qm-group th-crates');
  section.dataset.testid = 'crate-section';
  const heading = el('h2', 'th-group');
  add(heading, glyph('medal', 'th-icon th-group-icon'), el('span', undefined, view.heading));
  const intro = el('p', 'th-store-msg', view.intro);
  intro.dataset.testid = 'crate-intro';
  const grid = el('div', 'th-qm-grid th-crate-grid');
  for (const card of view.cards) grid.append(crateCard(ctx, view, card, medals, show));
  add(section, heading, intro, grid);
  return section;
}

function cosmeticCard(ctx: ScreenCtx, view: AppearanceView, item: CosmeticCardView, alive: () => boolean): HTMLElement {
  const T = view.text;
  const node = el('article', 'th-up th-cos');
  node.dataset.testid = `cosmetic-${item.id}`;
  node.dataset.worn = item.worn ? 'true' : 'false';
  if (item.worn) node.classList.add('is-worn');
  const pic = el('div', 'th-cos-pic');
  if (ctx.opts.paintCosmetic) {
    const canvas = iconCanvas(52, 'th-cos-icon');
    ctx.opts.paintCosmetic(canvas, item.id, alive);
    pic.append(canvas);
  }
  const text = el('div', 'th-up-text');
  const meta = el('p', 'th-cos-meta');
  add(meta, rarityBadge(item.rarity), item.worn && el('span', 'th-cos-worn', T.worn));
  add(text, el('h3', 'th-up-name', item.name), meta, el('p', 'th-up-desc', item.appliesTo));
  const wear = button({
    testid: `cosmetic-wear-${item.id}`,
    className: `th-btn-small th-crate-btn${item.worn ? '' : ' th-btn-primary'}`,
    label: item.worn ? T.takeOff : T.wear,
    aria: `${item.worn ? T.takeOff : T.wear}: ${item.name}`,
    onTap: () => {
      ctx.app.uiSound('click');
      if (ctx.app.wearCosmetic) ctx.app.wearCosmetic(item.id, !item.worn);
      ctx.reload();
    },
  });
  const side = el('div', 'th-up-side');
  side.append(wear);
  add(node, pic, text, side);
  return node;
}

/**
 * The Appearance tab's content: what the player owns, under "Your forces", "How the enemy looks to you" and "Your
 * headquarters", each with a button to wear it or take it off. `alive` says whether the list is still on show (a
 * portrait waiting for a picture to load is not painted into a list that has been replaced).
 */
export function appearanceList(ctx: ScreenCtx, view: AppearanceView, alive: () => boolean): HTMLElement[] {
  const T = view.text;
  if (view.items.length === 0) {
    const empty = el('p', 'th-type th-qm-empty', T.empty);
    empty.dataset.testid = 'appearance-empty';
    return [empty];
  }
  const out: HTMLElement[] = [];
  for (const [group, title] of [
    ['own', T.own],
    ['enemy', T.enemy],
    ['hq', T.hq],
  ] as const) {
    const items = view.items.filter((i) => i.group === group);
    if (items.length === 0) continue;
    const section = el('section', 'th-qm-group th-cos-group');
    section.dataset.testid = `appearance-group-${group}`;
    const heading = el('h2', 'th-group');
    add(heading, glyph('medal', 'th-icon th-group-icon'), el('span', undefined, title));
    const grid = el('div', 'th-qm-grid');
    for (const item of items) grid.append(cosmeticCard(ctx, view, item, alive));
    add(section, heading, grid);
    out.push(section);
  }
  return out;
}
