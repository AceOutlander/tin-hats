/**
 * Every unit button label fits (owner, 2026-11-09: "Unit labels are cut off again ... every unit button label must fit
 * at every phone size ... with an automated test that checks every unit name in every nation fits"). The built game in
 * a real battle, measured with the browser's own font metrics: a training button of the bar is cloned at its narrowest
 * (the bar lets buttons give up width down to their min-width before it scrolls), and every label any nation shows in
 * any era, date and climate (and every infantry look's names) is put in it, at the smallest supported phone (568x320)
 * and the largest (932x430). Each label's text must fit inside the button's name line, with no clipping.
 */
import type { Page } from '@playwright/test';
import { INFANTRY_LOOKS, resolveEra } from '../../src/data/eras';
import type { Climate, FactionId, UnitKind } from '../../src/data/schema';
import { UNITS, UNIT_KINDS } from '../../src/data/units';
import { MISSIONS } from '../../src/data/missions';
import { deployPlaceFit, trainButtonName } from '../../src/ui/hud/format';
import { expect, open, startMission, startSandbox, test } from './helpers';

const NATIONS: readonly FactionId[] = ['british', 'german', 'soviet'];
const CLIMATES: readonly Climate[] = ['temperate', 'winter', 'desert', 'tropical', 'city'];
/** The smallest and the largest supported phone, landscape. */
const PHONES = [
  { width: 568, height: 320 },
  { width: 932, height: 430 },
] as const;

/** Every label a training button can show: each nation's defaults and every month of the war in every climate. */
function everyLabel(): { label: string; from: string }[] {
  const seen = new Map<string, string>();
  const add = (raw: string, from: string): void => {
    const label = trainButtonName(raw);
    if (!seen.has(label)) seen.set(label, from);
  };
  const kinds = UNIT_KINDS.filter((k) => UNITS[k].trainable);
  for (const nation of NATIONS) {
    const dates: (string | null)[] = [null];
    for (let y = 1939; y <= 1945; y++) for (let m = 1; m <= 12; m++) dates.push(`${y}-${String(m).padStart(2, '0')}-15`);
    for (const date of dates) {
      for (const climate of CLIMATES) {
        const era = resolveEra(nation, date, climate);
        for (const kind of kinds) add(era.buttonNames[kind] ?? era.names[kind], `${nation} ${date ?? 'default'} ${climate} ${kind}`);
      }
    }
  }
  for (const [id, look] of Object.entries(INFANTRY_LOOKS)) {
    for (const [kind, name] of Object.entries(look.names)) add(look.buttonNames?.[kind as UnitKind] ?? name, `${id} look ${kind}`);
  }
  return [...seen].map(([label, from]) => ({ label, from }));
}

/** The labels that do not fit a training button at its narrowest, with their widths (px). */
async function cutOff(page: Page, labels: string[]): Promise<{ label: string; need: number; room: number; font: string }[]> {
  return page.evaluate((all) => {
    const real = document.querySelector<HTMLElement>('.th-tbtn[data-testid^="train-"]');
    if (!real) throw new Error('no training button');
    const probe = real.cloneNode(true) as HTMLElement;
    probe.removeAttribute('data-testid');
    const min = getComputedStyle(real).minWidth;
    probe.style.width = min;
    probe.style.flex = 'none';
    real.parentElement?.append(probe);
    const name = probe.querySelector<HTMLElement>('.th-tbtn-name');
    if (!name) throw new Error('no name line');
    const out: { label: string; need: number; room: number; font: string }[] = [];
    for (const label of all) {
      name.textContent = label;
      // Text wider than its line (clipped by overflow: hidden), or the line wider than the button's content box.
      const inner = probe.clientWidth - parseFloat(getComputedStyle(probe).paddingLeft) - parseFloat(getComputedStyle(probe).paddingRight);
      const room = Math.min(name.clientWidth, inner);
      const need = name.scrollWidth;
      if (need > room) out.push({ label, need, room, font: getComputedStyle(name).fontSize });
    }
    probe.remove();
    return out;
  }, labels);
}

for (const size of PHONES) {
  test.describe(`unit button labels at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    test('every unit name of every nation, era and look fits its training button', async ({ page, problems }) => {
      await open(page);
      await startSandbox(page);
      await expect(page.locator('.th-tbtn[data-testid^="train-"]').first()).toBeVisible();
      const labels = everyLabel();
      expect(labels.length).toBeGreaterThan(20);
      const bad = await cutOff(
        page,
        labels.map((l) => l.label),
      );
      const where = new Map(labels.map((l) => [l.label, l.from]));
      expect(
        bad.map((b) => `${b.label} (${where.get(b.label)}): ${b.need} px of text in ${b.room} px at ${b.font}`),
        'labels cut off',
      ).toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}

/** Where the "Deploy at" button sits and whether its words fit. */
async function deployLayout(page: Page): Promise<{ inBar: boolean; overlaps: string[]; clipped: string[]; label: string }> {
  return page.evaluate(() => {
    const dep = document.querySelector<HTMLElement>('[data-testid="deploy-at"]');
    const wrap = dep?.parentElement;
    if (!dep || !wrap) throw new Error('no Deploy at button');
    const d = dep.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const inBar = d.top >= w.top - 0.5 && d.bottom <= w.bottom + 0.5 && d.left >= w.left - 0.5 && d.right <= w.right + 0.5;
    const overlaps: string[] = [];
    for (const b of document.querySelectorAll<HTMLElement>('.th-tbtn[data-testid^="train-"]')) {
      const r = b.getBoundingClientRect();
      const visible = Math.min(r.right, w.right) - Math.max(r.left, d.right);
      if (r.left < d.right - 0.5 && r.right > d.left + 0.5 && visible < r.width) overlaps.push(b.dataset.testid ?? '');
    }
    const clipped: string[] = [];
    for (const part of dep.querySelectorAll<HTMLElement>('span')) {
      if (part.offsetParent === null) continue;
      if (part.scrollWidth > part.clientWidth + 1 || part.scrollHeight > part.clientHeight + 1) clipped.push(part.textContent ?? '');
    }
    return { inBar, overlaps, clipped, label: dep.getAttribute('aria-label') ?? '' };
  });
}

for (const size of [PHONES[0], { width: 844, height: 390 }] as const) {
  test.describe(`Deploy at, ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    test('sits in the training bar, hides nothing of the battlefield, and its words fit', async ({ page, problems }) => {
      await open(page);
      await startMission(page, 1002);
      const deploy = page.getByTestId('deploy-at');
      await expect(deploy).toBeVisible();
      const first = await deployLayout(page);
      expect(first.inBar, 'inside the bottom bar').toBe(true);
      expect(first.overlaps, 'over no unit button').toEqual([]);
      expect(first.clipped, 'words cut off').toEqual([]);
      // Each tap steps to the next spawn point; the long name of Dubno crossroads fits too.
      const seen = new Set([first.label]);
      for (let i = 0; i < 3; i++) {
        await deploy.tap();
        await expect.poll(async () => (await deployLayout(page)).label).not.toBe([...seen].at(-1));
        const now = await deployLayout(page);
        seen.add(now.label);
        expect(now.clipped, `words cut off (${now.label})`).toEqual([]);
        expect(now.inBar).toBe(true);
      }
      expect(seen.size).toBeGreaterThanOrEqual(3);
      // Every spawn point of every mission, set in the button as the HUD sets it.
      const places = [...new Set(MISSIONS.flatMap((m) => (m.capturePoints ?? []).filter((p) => p.spawn).map((p) => p.label)))];
      expect(places.length).toBeGreaterThan(5);
      const cut = await page.evaluate((all) => {
        const dep = document.querySelector<HTMLElement>('[data-testid="deploy-at"]');
        const text = dep?.querySelector<HTMLElement>('.th-deploy-text');
        if (!dep || !text) throw new Error('no Deploy at text');
        const out: string[] = [];
        for (const [place, fit] of all) {
          text.textContent = place;
          dep.style.setProperty('--dep-fit', String(fit));
          if (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1) out.push(place);
        }
        return out;
      }, places.map((p) => [p, deployPlaceFit(p)] as [string, number]));
      expect(cut, 'spawn point names cut off').toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}
