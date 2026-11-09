/**
 * Briefing screen: typewritten orders on a paper sheet, the objective, a NEW
 * card for anything the mission introduces, the difficulty selector, Begin and Back.
 */
import type { Difficulty } from '../../data/schema';
import type { MissionCard } from '../contracts';
import { add, button, el, stencil } from '../shell/dom';
import { glyph, supportIcon, unitIcon } from '../shell/icons';
import { missionStarter, type MissionStarter } from '../shell/missionLoad';
import { withScrollCue } from '../shell/scrollCue';
import type { ScreenCtx, ScreenFactory } from '../shell/types';

/** Typing speed: at least this many characters per second, faster for long orders so nobody waits. */
const TYPE_MIN_CPS = 110;
const TYPE_MAX_SECONDS = 2.4;

function newCard(kindLabel: string, icon: Element, name: string, blurb: string): HTMLElement {
  const card = el('div', 'th-new');
  const iconBox = el('div', 'th-new-icon');
  iconBox.append(icon);
  const text = el('div', 'th-new-text');
  const top = el('div', 'th-new-top');
  add(top, el('span', 'th-new-flag', 'New'), el('span', 'th-new-kind', kindLabel));
  add(text, top, el('div', 'th-new-name', name), el('p', 'th-new-blurb', blurb));
  add(card, iconBox, text);
  return card;
}

function findMission(ctx: ScreenCtx): MissionCard | undefined {
  const missions = ctx.view().missions;
  return missions.find((m) => m.id === ctx.session.missionId) ?? missions[0];
}

export const briefingScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-briefing');
  root.dataset.screen = 'briefing';
  const mission = findMission(ctx);

  // --- The orders sheet --------------------------------------------------
  const sheet = el('div', 'th-paper th-sheet th-scroll');
  sheet.dataset.scroll = '';
  const sheetHead = el('div', 'th-sheet-head');
  add(
    sheetHead,
    el('span', 'th-type th-sheet-no', mission ? `Operation order No. ${mission.id}` : 'Operation order'),
    el('span', 'th-stamp th-stamp-secret', 'Most secret'),
  );
  const title = stencil('h1', mission ? mission.title : 'No orders', 'th-sheet-title');
  const meta = el('p', 'th-type th-sheet-meta', mission ? `${mission.location} — ${mission.date}` : '');
  const orders = el('div', 'th-type th-orders');
  const objective = el('div', 'th-objective');
  add(objective, el('span', 'th-objective-label', 'Objective'), el('span', 'th-type th-objective-text', mission ? mission.objective : ''));
  // The objective comes first so it is on screen at once even on the shortest phones; the orders type out below it.
  add(sheet, sheetHead, title, meta, objective, orders);

  // Typewriter: every paragraph is laid out in full (so nothing reflows) and revealed a character at a time.
  const typed: Text[] = [];
  const untyped: Text[] = [];
  const lengths: number[] = [];
  const paragraphs: HTMLElement[] = [];
  let total = 0;
  for (const text of mission ? mission.briefing : []) {
    const p = el('p', 'th-order');
    const shown = el('span', 'th-typed');
    const hidden = el('span', 'th-untyped');
    const a = document.createTextNode('');
    const b = document.createTextNode(text);
    shown.append(a);
    hidden.append(b);
    add(p, shown, hidden);
    orders.append(p);
    typed.push(a);
    untyped.push(b);
    lengths.push(text.length);
    paragraphs.push(p);
    total += text.length;
  }
  const texts = mission ? mission.briefing : [];
  let shownChars = -1;
  let raf = 0;
  let startTime = 0;
  const cps = Math.max(TYPE_MIN_CPS, total / TYPE_MAX_SECONDS);

  function reveal(count: number): void {
    if (count === shownChars) return;
    shownChars = count;
    let left = count;
    let active = -1;
    for (let i = 0; i < texts.length; i++) {
      const n = Math.max(0, Math.min(lengths[i], left));
      left -= n;
      const visible = texts[i].slice(0, n);
      if (typed[i].data !== visible) {
        typed[i].data = visible;
        untyped[i].data = texts[i].slice(n);
      }
      if (active === -1 && n < lengths[i]) active = i;
    }
    for (let i = 0; i < paragraphs.length; i++) paragraphs[i].classList.toggle('is-typing', i === active);
  }

  function tick(now: number): void {
    if (startTime === 0) startTime = now;
    const count = Math.min(total, Math.floor(((now - startTime) / 1000) * cps));
    reveal(count);
    raf = count < total ? requestAnimationFrame(tick) : 0;
  }

  function finishTyping(): void {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    reveal(total);
  }

  sheet.addEventListener('click', finishTyping);

  // --- Side column -------------------------------------------------------
  const side = el('aside', 'th-brief-side');
  const news = el('div', 'th-new-list th-scroll');
  news.dataset.scroll = '';
  if (mission && mission.newUnit) {
    news.append(newCard('Unit', unitIcon(mission.newUnit.kind, 44, ctx.opts.paintUnitIcon), mission.newUnit.name, mission.newUnit.blurb));
  }
  for (const unit of mission?.moreNewUnits ?? []) {
    news.append(newCard('Unit', unitIcon(unit.kind, 44, ctx.opts.paintUnitIcon), unit.name, unit.blurb));
  }
  if (mission && mission.newSupport) {
    news.append(newCard('Support', supportIcon(mission.newSupport.kind), mission.newSupport.name, mission.newSupport.blurb));
  }
  if (!news.firstChild) news.classList.add('is-empty');

  const diffBox = el('div', 'th-diff');
  diffBox.append(el('div', 'th-label', 'Difficulty'));
  const seg = el('div', 'th-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Difficulty');
  const view = ctx.view();
  let difficulty: Difficulty = ctx.session.difficulty ?? view.settings.difficulty;
  const diffButtons = new Map<Difficulty, HTMLButtonElement>();
  // The replay decay of the chosen difficulty ("Replay: 50% medals"), shown under the selector.
  const replay = el('p', 'th-type th-brief-replay');
  replay.dataset.testid = 'briefing-replay';
  const paintDifficulty = (): void => {
    for (const [id, node] of diffButtons) {
      const on = id === difficulty;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const percent = mission && mission.replayPercent ? mission.replayPercent[difficulty] : 100;
    replay.textContent = percent < 100 ? `Replay: ${percent}% medals` : 'First win: full medals';
    replay.classList.toggle('is-replay', percent < 100);
  };
  for (const d of view.difficulties) {
    const cleared = mission ? mission.cleared[d.id] : false;
    const content: Node[] = [el('span', 'th-btn-label', d.name)];
    if (cleared) content.push(glyph('tick', 'th-icon th-seg-tick'));
    const node = button({
      testid: `difficulty-${d.id}`,
      className: 'th-seg-btn',
      aria: cleared ? `${d.name} (cleared)` : d.name,
      content,
      onTap: () => {
        ctx.app.uiSound('click');
        difficulty = d.id;
        ctx.session.difficulty = d.id;
        // Remembered in the settings, so the next briefing (and the next visit) starts on it.
        ctx.app.setSetting('difficulty', d.id);
        paintDifficulty();
      },
    });
    diffButtons.set(d.id, node);
    seg.append(node);
  }
  paintDifficulty();
  diffBox.append(seg, replay);
  // What is lent for this mission only, because the Armoury does not own it yet.
  if (mission && mission.loans && mission.loans.length > 0) {
    const names = mission.loans.map((l) => `${l.count} ${l.name}`).join(', ');
    const loan = el('p', 'th-type th-brief-loan', `On loan for this mission: ${names}`);
    loan.dataset.testid = 'briefing-loans';
    diffBox.append(loan);
  }

  const actions = el('div', 'th-brief-actions');
  const back = button({
    testid: 'back',
    label: 'Back',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('campaign');
    },
  });
  // The battle starts once its music is made (begun when the briefing opens); Begin shows the progress meanwhile.
  let starter: MissionStarter | null = null;
  let preload = 0;
  const begin = button({
    testid: 'begin',
    label: 'Begin',
    className: 'th-btn-primary th-brief-begin',
    onTap: () => {
      if (!mission || !mission.unlocked) {
        ctx.app.uiSound('deny');
        return;
      }
      const id = mission.id;
      // A tap before the preload's tick: Begin's own load starts the render, and the preload must not follow it (a
      // later loadMission call takes over, and Begin's wait would then end without starting the battle).
      if (preload !== 0) window.clearTimeout(preload);
      preload = 0;
      if (starter?.start(id, () => ctx.app.startMission(id, difficulty))) ctx.app.uiSound('confirm');
    },
  });
  starter = missionStarter(ctx.app, begin);
  begin.dataset.primary = '';
  begin.disabled = !mission || !mission.unlocked;
  add(actions, back, begin);
  // Both columns can run past a short screen (the orders on a long briefing, the NEW cards of a mission that brings a
  // unit and a support): each says so with a fade and a chevron while there is more below.
  const sheetCue = withScrollCue(sheet, 'paper');
  const newsCue = withScrollCue(news, 'dark');
  add(side, newsCue.el, diffBox, actions);
  add(root, sheetCue.el, side);

  return {
    el: root,
    mounted() {
      sheetCue.update();
      newsCue.update();
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still || total === 0) reveal(total);
      else {
        reveal(0);
        raf = requestAnimationFrame(tick);
      }
      // The battle music renders while the orders are read (after the screen change has let go of the last battle's).
      if (mission && mission.unlocked && ctx.app.loadMission) {
        const id = mission.id;
        preload = window.setTimeout(() => {
          preload = 0;
          void ctx.app.loadMission?.(id);
        }, 0);
      }
    },
    resize() {
      sheetCue.update();
      newsCue.update();
    },
    back() {
      ctx.go('campaign');
    },
    destroy() {
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
      if (preload !== 0) window.clearTimeout(preload);
      preload = 0;
      starter?.cancel();
      sheetCue.destroy();
      newsCue.destroy();
    },
  };
};
