/**
 * A stand-in store section for the browser tests (src/platform/types.ts StoreSection): the website's platform has no
 * store, so a test hands the Shop this one through the debug hooks. Its offers are made up and each ends one way:
 *   one    done after a moment, and gives 150 medals through the game (GameHost.grantMedals)
 *   two    cancelled
 *   three  pending, then settled by itself 1.5 s later (500 medals) with a change notice
 *   four   failed
 *   five   done, and owned from then on
 */
import type { Page } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import type { OfferOutcome, StoreSection } from '../../src/platform/types';

export const FAKE_STORE = {
  title: 'Field post',
  message: 'A line from the platform above its offers.',
  notes: ['A first line of small print, as the platform words it.', 'A second line: where the platform says to ask for help.'],
  done: 'Done: 150 medals added.',
  pending: 'Not settled yet. Nothing has been given.',
  failed: 'It did not go through. Nothing was changed.',
  kept: 'Yours to keep.',
} as const;

export async function installFakeStore(page: Page): Promise<void> {
  await page.evaluate((words) => {
    const th = (window as unknown as { __TH: DebugApi }).__TH;
    const listeners = new Set<() => void>();
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    let grants = 0;
    let unsettled = false;
    let kept = false;
    const store: StoreSection = {
      title: words.title,
      notes: words.notes,
      onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      list: async () => ({
        message: words.message,
        offers: [
          {
            id: 'one',
            title: 'Offer one',
            description: 'A short line from the platform.',
            priceLabel: 'LABEL 0.99',
            async buy(): Promise<OfferOutcome> {
              await wait(400);
              return th.grantMedals(150, `fake-${++grants}`) === 'granted' ? { kind: 'done', message: words.done } : { kind: 'failed', message: words.failed };
            },
          },
          {
            id: 'two',
            title: 'Offer two with a rather long name',
            description: 'A longer line from the platform, long enough that it has to wrap inside its card on a small phone.',
            priceLabel: 'A LONG LABEL 1,234.99',
            buy: async () => ({ kind: 'cancelled' }),
          },
          {
            id: 'three',
            title: 'Offer three',
            description: 'Settles a moment later.',
            priceLabel: 'LABEL 19,99',
            pending: unsettled ? words.pending : undefined,
            async buy(): Promise<OfferOutcome> {
              unsettled = true;
              setTimeout(() => {
                unsettled = false;
                th.grantMedals(500, 'fake-three');
                for (const l of listeners) l();
              }, 1500);
              return { kind: 'pending', message: words.pending };
            },
          },
          {
            id: 'four',
            title: 'Offer four',
            description: 'Never goes through.',
            priceLabel: 'Lb 329.000',
            buy: async () => ({ kind: 'failed', message: words.failed }),
          },
          {
            id: 'five',
            title: 'Offer five',
            description: 'Can be had once.',
            priceLabel: 'LABEL 2.99',
            owned: kept,
            async buy(): Promise<OfferOutcome> {
              kept = true;
              return { kind: 'done', message: words.kept };
            },
          },
        ],
      }),
    };
    th.setStore(store);
  }, FAKE_STORE);
}
