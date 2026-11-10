/**
 * Campaign select screen (FOUNDATIONS.md section 6): one dossier card per campaign, in the registry's order
 * (src/data/campaigns.ts), each with its nation's flag, its name and dates, a one-line pitch and how far the save has
 * got. Tapping a card puts that campaign on the map, where its Shop and Quartermaster are. The campaigns still to come
 * are greyed "Coming soon" cards that never start. Shown from the title's Play button (always, owner 2026-11-09); the
 * title storm keeps running behind it. The cards are large and sit side by side; when they do not fit the row scrolls
 * sideways (a swipe, the wheel or the arrow keys).
 */
import type { CampaignId } from '../../data/schema';
import type { CampaignCardView } from '../contracts';
import { add, button, el, stencil } from '../shell/dom';
import { glyph } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

/** The flag's drawing size in CSS px (3:2, as the flags are drawn). */
const FLAG_W = 66;
const FLAG_H = 44;

export const campaignsScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-campaigns');
  root.dataset.screen = 'campaigns';

  const plate = el('div', 'th-plate th-campaigns-plate');
  const head = el('div', 'th-campaigns-head');
  const back = button({
    testid: 'back',
    className: 'th-btn-icon',
    aria: 'Back to title',
    content: [glyph('back')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('title');
    },
  });
  add(head, back, stencil('h1', 'CAMPAIGNS', 'th-campaigns-title'));
  const list = el('div', 'th-campaigns-list');
  list.setAttribute('role', 'list');
  // When the cards do not fit, the row scrolls sideways (the page lockdown lets a data-scroll element scroll).
  list.dataset.scroll = '';
  add(plate, head, list);
  root.append(plate);

  let cards: HTMLButtonElement[] = [];

  function open(c: CampaignCardView): void {
    if (c.locked || c.comingSoon) {
      ctx.app.uiSound('deny');
      return;
    }
    ctx.app.uiSound('confirm');
    if (!c.current) {
      ctx.app.selectCampaign?.(c.id as CampaignId);
      // The map picks its own mission for a campaign it has not shown yet.
      ctx.session.missionId = 0;
    }
    ctx.go('campaign');
  }

  function flag(c: CampaignCardView): HTMLElement {
    const box = el('div', 'th-camp-flag');
    box.dataset.flag = c.flag;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `${c.nationName} flag`);
    if (ctx.opts.paintFlag) {
      const canvas = el('canvas', 'th-camp-flag-canvas');
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.round(FLAG_W * dpr);
      canvas.height = Math.round(FLAG_H * dpr);
      canvas.setAttribute('aria-hidden', 'true');
      ctx.opts.paintFlag(canvas, c.flag);
      box.append(canvas);
    }
    return box;
  }

  function card(c: CampaignCardView): HTMLButtonElement {
    const done = c.cleared >= c.total && c.total > 0;
    const stampText = c.comingSoon ? 'Coming soon' : c.locked ? 'Locked' : done ? 'Complete' : c.cleared > 0 ? 'In progress' : 'New';
    const top = el('div', 'th-camp-top');
    const titles = el('div', 'th-camp-titles');
    const years = el('p', 'th-type th-camp-dates', `${c.years} · ${c.nationName}`);
    add(titles, stencil('h2', c.title, 'th-camp-name'), years);
    const stamp = el('span', 'th-stamp th-camp-stamp', stampText);
    stamp.dataset.state = c.comingSoon ? 'soon' : c.locked ? 'locked' : done ? 'cleared' : 'open';
    add(top, flag(c), titles, stamp);

    const pitch = el('p', 'th-type th-camp-pitch', c.pitch);
    const progress = el('div', 'th-camp-progress');
    const bar = el('div', 'th-camp-bar');
    bar.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < c.total; i++) {
      const tick = el('i', 'th-camp-tick');
      if (i < c.cleared) tick.classList.add('is-on');
      bar.append(tick);
    }
    const count = el('span', 'th-type th-camp-count', c.comingSoon ? 'Not yet playable' : `${c.cleared} / ${c.total} missions`);
    count.dataset.testid = `campaign-progress-${c.id}`;
    if (c.comingSoon) progress.append(count);
    else add(progress, bar, count);
    const nextText = c.comingSoon
      ? 'Coming in a later update'
      : c.locked
        ? (c.lockNote ?? 'Locked')
        : c.next
          ? `Next: mission ${c.next.number}, ${c.next.title}`
          : 'Every mission cleared';
    const next = el('p', 'th-type th-camp-next', nextText);
    const status = c.comingSoon ? ' Coming soon.' : ` ${c.cleared} of ${c.total} missions completed.${c.locked ? ' Locked.' : ''}`;
    const node = button({
      testid: `campaign-${c.id}`,
      bare: true,
      className: 'th-paper th-camp',
      aria: `${c.title}, ${c.years}, ${c.nationName}. ${c.pitch}${status}`,
      content: [top, pitch, progress, next],
      onTap: () => open(c),
    });
    node.setAttribute('role', 'listitem');
    node.dataset.state = stamp.dataset.state;
    node.classList.toggle('is-current', c.current);
    node.classList.toggle('is-soon', c.comingSoon);
    if (c.locked || c.comingSoon) node.setAttribute('aria-disabled', 'true');
    // Enter with nothing focused opens the campaign on the map (or the first one).
    if (c.current) node.dataset.primary = '';
    return node;
  }

  function render(): void {
    const view = ctx.view();
    const all = view.campaigns ?? [];
    list.replaceChildren();
    cards = all.map(card);
    if (cards.length > 0 && !cards.some((n) => n.dataset.primary !== undefined)) cards[0].dataset.primary = '';
    list.append(...cards);
  }
  render();

  return {
    el: root,
    refresh: render,
    back() {
      ctx.go('title');
    },
    key(ev) {
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (dir === 0 || cards.length === 0) return false;
      const focused = cards.findIndex((n) => n === document.activeElement);
      const from = focused >= 0 ? focused : cards.findIndex((n) => n.dataset.primary !== undefined);
      const next = cards[Math.min(cards.length - 1, Math.max(0, from + dir))];
      next.focus({ preventScroll: false });
      return true;
    },
  };
};
