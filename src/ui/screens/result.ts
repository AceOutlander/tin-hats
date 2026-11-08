/** Result screen: victory or defeat, why, the tally, the medals a win earned with their score breakdown, and where to go next. */
import type { MedalResultView } from '../contracts';
import { add, button, el, formatCount, formatTime, stencil } from '../shell/dom';
import { glyph, helmetIcon } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

/** "1:30 / 2:00" style figures of one score line, and the marks it earned. */
function scoreRow(label: string, value: string, target: string, score: number): HTMLElement {
  const row = el('div', 'th-score-row');
  add(row, el('dt', undefined, label), el('dd', 'th-type', `${value} (target ${target})`), el('dd', 'th-type th-score-mark', `${Math.round(score * 100)}%`));
  return row;
}

/** The score breakdown of a win: time or HQ health, casualties, then the difficulty and replay factors. */
export function breakdown(m: MedalResultView): HTMLElement {
  const box = el('dl', 'th-score');
  box.dataset.testid = 'result-score';
  if (m.time) box.append(scoreRow('Time', formatTime(m.time.value), formatTime(m.time.target), m.time.score));
  box.append(scoreRow('Casualties', formatCount(m.casualties.value), formatCount(m.casualties.target), m.casualties.score));
  if (m.hq) box.append(scoreRow('HQ health', `${Math.round(m.hq.value * 100)}%`, `${Math.round(m.hq.target * 100)}%`, m.hq.score));
  const factors = el('div', 'th-score-row th-score-total');
  add(
    factors,
    el('dt', undefined, 'Medals'),
    el('dd', 'th-type', `${m.base} × ${m.difficultyMul} difficulty × ${m.replayPercent}% replay`),
    el('dd', 'th-type th-score-mark', String(m.medals)),
  );
  box.append(factors);
  return box;
}

export const resultScreen: ScreenFactory = (ctx) => {
  const result = ctx.session.result;
  const root = el('section', 'th-screen th-result');
  root.dataset.screen = 'result';
  const won = result ? result.won : false;
  root.classList.add(won ? 'is-won' : 'is-lost');
  root.dataset.outcome = won ? 'victory' : 'defeat';

  const plate = el('div', 'th-plate th-result-plate');

  const main = el('div', 'th-result-main');
  const banner = el('div', 'th-result-banner');
  const helmet = el('div', 'th-result-helmet');
  helmet.append(helmetIcon());
  const stamp = stencil('h1', won ? 'VICTORY' : 'DEFEAT', 'th-result-word');
  add(banner, helmet, stamp);

  const difficultyName = result ? (ctx.view().difficulties.find((d) => d.id === result.difficulty)?.name ?? result.difficulty) : '';
  const title = el('p', 'th-result-title', result ? `Mission ${result.missionId} · ${result.title} · ${difficultyName}` : '');
  const reason = el('p', 'th-type th-result-reason', result ? result.reason : 'No report received.');
  reason.dataset.testid = 'result-reason';
  add(main, banner, title, reason);
  if (result && result.pointsAwarded > 0) {
    const award = el('div', 'th-award');
    award.dataset.testid = 'result-points';
    add(
      award,
      glyph('medal', 'th-icon'),
      el('span', 'th-award-num', `+${result.pointsAwarded}`),
      el('span', 'th-award-text', result.pointsAwarded === 1 ? 'medal' : 'medals'),
    );
    main.append(award);
  }
  if (result && result.won && result.medals) main.append(breakdown(result.medals));

  const stats = el('dl', 'th-stats');
  const rows: [string, string][] = result
    ? [
        ['Time', formatTime(result.timeSec)],
        ['Trained', formatCount(result.unitsTrained)],
        ['Lost', formatCount(result.unitsLost)],
        ['Kills', formatCount(result.enemiesKilled)],
        ['Supplies', formatCount(result.suppliesGathered)],
      ]
    : [];
  for (const [label, value] of rows) {
    const row = el('div', 'th-stat');
    add(row, el('dt', undefined, label), el('dd', 'th-type', value));
    stats.append(row);
  }

  const actions = el('div', 'th-result-actions');
  const map = button({
    testid: 'result-map',
    label: 'Map',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go('campaign');
    },
  });
  const retry = button({
    testid: 'result-retry',
    label: won ? 'Replay' : 'Retry',
    onTap: () => {
      if (!result) return;
      ctx.app.uiSound('confirm');
      ctx.app.startMission(result.missionId, result.difficulty);
    },
  });
  retry.disabled = !result;
  add(actions, map, retry);
  const nextId = result && won ? result.nextMissionId : null;
  if (nextId !== null) {
    const next = button({
      testid: 'result-next',
      label: 'Next mission',
      className: 'th-btn-primary',
      onTap: () => {
        ctx.app.uiSound('click');
        ctx.go('briefing', { missionId: nextId });
      },
    });
    next.dataset.primary = '';
    actions.append(next);
  } else if (won) {
    map.classList.add('th-btn-primary');
    map.dataset.primary = '';
  } else {
    retry.classList.add('th-btn-primary');
    retry.dataset.primary = '';
  }

  const body = el('div', 'th-result-body');
  add(body, main, stats);
  add(plate, body, actions);
  root.append(plate);

  return {
    el: root,
    back() {
      ctx.go('campaign');
    },
  };
};
