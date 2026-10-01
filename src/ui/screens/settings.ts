/** Settings screen: sound, default difficulty, hints, and reset progress behind a confirm step. */
import type { Difficulty } from '../../data/schema';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

export const settingsScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-settings');
  root.dataset.screen = 'settings';
  const plate = el('div', 'th-plate th-settings-plate');

  const head = el('header', 'th-settings-head');
  const back = button({
    testid: 'back',
    className: 'th-btn-icon',
    aria: 'Back',
    content: [glyph('back')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.go(ctx.session.settingsFrom);
    },
  });
  add(head, back, stencil('h1', 'SETTINGS', 'th-bar-title'));

  // Sound: the saved setting is "muted", the switch reads as "sound on".
  const muteIcon = el('span', 'th-toggle-icon');
  const muteState = el('span', 'th-toggle-state');
  const mute = button({
    testid: 'setting-mute',
    className: 'th-toggle',
    bare: true,
    content: [muteIcon, el('span', 'th-toggle-label', 'Sound'), muteState, el('span', 'th-switch')],
    onTap: () => {
      const muted = !ctx.view().settings.muted;
      ctx.app.setSetting('muted', muted);
      ctx.app.uiSound('click');
      ctx.reload();
    },
  });

  const hintsState = el('span', 'th-toggle-state');
  const hints = button({
    testid: 'setting-hints',
    className: 'th-toggle',
    bare: true,
    content: [el('span', 'th-toggle-label', 'Tutorial hints'), hintsState, el('span', 'th-switch')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.app.setSetting('hints', !ctx.view().settings.hints);
      ctx.reload();
    },
  });

  const diffRow = el('div', 'th-set-row');
  diffRow.append(el('div', 'th-label', 'Default difficulty'));
  const seg = el('div', 'th-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Default difficulty');
  const diffButtons = new Map<Difficulty, HTMLButtonElement>();
  for (const d of ctx.view().difficulties) {
    const node = button({
      testid: `setting-difficulty-${d.id}`,
      className: 'th-seg-btn',
      label: d.name,
      onTap: () => {
        ctx.app.uiSound('click');
        ctx.app.setSetting('difficulty', d.id);
        // A new default replaces whatever was picked in an earlier briefing.
        ctx.session.difficulty = null;
        ctx.reload();
      },
    });
    diffButtons.set(d.id, node);
    seg.append(node);
  }
  diffRow.append(seg);

  const reset = button({
    testid: 'setting-reset',
    label: 'Reset progress',
    className: 'th-btn-danger',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.confirm({
        title: 'Reset progress?',
        body: 'Cleared missions, upgrade points and upgrades will be wiped. This cannot be undone.',
        yes: 'Reset',
        no: 'Keep',
        onYes: () => {
          ctx.app.resetSave();
          ctx.session.missionId = 0;
          ctx.session.difficulty = null;
          ctx.session.result = null;
          ctx.reload();
        },
      });
    },
  });

  const grid = el('div', 'th-set-grid');
  add(grid, mute, hints, diffRow, reset);
  add(plate, head, grid);
  root.append(plate);

  function render(): void {
    const s = ctx.view().settings;
    const soundOn = !s.muted;
    mute.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    mute.dataset.state = soundOn ? 'on' : 'off';
    mute.dataset.muted = s.muted ? 'true' : 'false';
    muteState.textContent = soundOn ? 'On' : 'Off';
    clear(muteIcon);
    muteIcon.append(glyph(soundOn ? 'sound' : 'muted'));
    hints.setAttribute('aria-pressed', s.hints ? 'true' : 'false');
    hints.dataset.state = s.hints ? 'on' : 'off';
    hintsState.textContent = s.hints ? 'On' : 'Off';
    for (const [id, node] of diffButtons) {
      const on = id === s.difficulty;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  render();

  return {
    el: root,
    refresh: render,
    back() {
      ctx.go(ctx.session.settingsFrom);
    },
  };
};
