/**
 * A platform's section in the Shop: whatever the platform offers (src/platform), drawn as the platform words it. The
 * game holds no offer, label or price of its own. The Shop has up to three: the store section and, under it, the
 * reward section and the membership section (`name` tells their test ids apart). A build whose platform has none
 * never creates one.
 *
 * States of an offer: idle (its button carries the price label), busy (asked for, waiting on the platform), then the
 * platform's own line under it: done, pending, failed or unavailable. A cancelled request leaves nothing behind. An
 * offer the platform marks unavailable shows the platform's line and its button waits.
 */
import type { OfferOutcome, StoreListing, StoreOffer, StoreSection } from '../../platform/types';
import { add, button, clear, el } from '../shell/dom';
import { glyph } from '../shell/icons';

export interface StoreSectionHooks {
  sound(name: 'click' | 'deny' | 'confirm'): void;
  /** The section changed height (the list around it may need its scroll cue updated). */
  changed(): void;
}

export interface StoreSectionView {
  el: HTMLElement;
  destroy(): void;
}

type Shown = Exclude<OfferOutcome['kind'], 'cancelled'>;

export function createStoreSection(store: StoreSection, hooks: StoreSectionHooks, name: 'store' | 'reward' | 'membership' = 'store'): StoreSectionView {
  const root = el('section', 'th-qm-group th-store');
  root.dataset.testid = `${name}-section`;
  const heading = el('h2', 'th-group');
  add(heading, glyph('medal', 'th-icon th-group-icon'), el('span', undefined, store.title));
  const message = el('p', 'th-store-msg');
  message.dataset.testid = `${name}-message`;
  message.setAttribute('role', 'status');
  const grid = el('div', 'th-qm-grid');
  const notes = el('div', 'th-store-notes');
  for (const line of store.notes ?? []) notes.append(el('p', 'th-store-note', line));
  add(root, heading, message, grid, notes);

  let listing: StoreListing | null = null;
  let busy: string | null = null;
  /** The last thing the platform said about an offer, kept until that offer is asked for again. */
  const said = new Map<string, { kind: Shown; message: string }>();
  let asked = 0;
  let gone = false;
  // Nothing shows until the platform has answered once: a platform with nothing to offer never flashes a heading.
  root.hidden = true;

  function offerCard(offer: StoreOffer): HTMLElement {
    const card = el('article', 'th-up th-store-offer');
    card.dataset.testid = `${name}-offer-${offer.id}`;
    const last = said.get(offer.id);
    const state = busy === offer.id ? 'busy' : offer.owned ? 'owned' : offer.pending !== undefined ? 'pending' : offer.unavailable !== undefined ? 'unavailable' : (last?.kind ?? 'idle');
    card.dataset.state = state;
    const text = el('div', 'th-up-text');
    add(text, el('h3', 'th-up-name', offer.title), el('p', 'th-up-desc', offer.description));
    const line = offer.pending ?? offer.unavailable ?? last?.message ?? '';
    if (line !== '' && state !== 'busy') {
      const status = el('p', 'th-store-status', line);
      status.dataset.testid = `${name}-status-${offer.id}`;
      status.setAttribute('role', 'status');
      text.append(status);
    }
    const label = state === 'busy' ? '…' : offer.owned ? 'Owned' : offer.priceLabel;
    const buy = button({
      testid: `${name}-buy-${offer.id}`,
      className: 'th-btn-small th-btn-primary th-store-buy',
      label,
      aria: offer.owned ? `${offer.title}: owned` : `${offer.title}: ${offer.priceLabel}`,
      onTap: () => void ask(offer),
    });
    buy.disabled = busy !== null || offer.owned === true || offer.pending !== undefined || offer.unavailable !== undefined;
    const side = el('div', 'th-up-side');
    side.append(buy);
    add(card, text, side);
    return card;
  }

  function render(): void {
    const text = listing?.message ?? '';
    message.textContent = text;
    message.hidden = text === '';
    clear(grid);
    for (const offer of listing?.offers ?? []) grid.append(offerCard(offer));
    grid.hidden = grid.childElementCount === 0;
    hooks.changed();
  }

  async function load(): Promise<void> {
    const mine = ++asked;
    let next: StoreListing;
    try {
      next = await store.list();
    } catch (err) {
      console.warn('Tin Hats UI: the store section could not be listed', err);
      next = { offers: [] };
    }
    if (gone || mine !== asked) return;
    listing = next;
    root.hidden = next.offers.length === 0 && (next.message ?? '') === '';
    render();
  }

  async function ask(offer: StoreOffer): Promise<void> {
    if (busy !== null) return;
    hooks.sound('confirm');
    busy = offer.id;
    said.delete(offer.id);
    render();
    let outcome: OfferOutcome;
    try {
      outcome = await offer.buy();
    } catch (err) {
      console.warn('Tin Hats UI: a store offer failed', err);
      outcome = { kind: 'failed', message: 'Something went wrong. Nothing was changed.' };
    }
    if (gone) return;
    busy = null;
    if (outcome.kind !== 'cancelled') said.set(offer.id, { kind: outcome.kind, message: outcome.message });
    if (outcome.kind === 'failed') hooks.sound('deny');
    render();
    void load();
  }

  const unsubscribe = store.onChange?.(() => {
    // Whatever was unsettled has been settled: the platform's new listing says how things stand.
    for (const [id, last] of said) if (last.kind === 'pending') said.delete(id);
    void load();
  });
  render();
  void load();

  return {
    el: root,
    destroy() {
      gone = true;
      unsubscribe?.();
    },
  };
}
