/**
 * Settings screen: sound on or off, the Music, Ambience and Sound effects volumes, reduce flashing, show blood, tutorial hints, show FPS,
 * the default difficulty, and reset progress behind a confirm step. The controls sit in a scroll area with a cue,
 * so on the smallest phones the last row scrolls into view instead of being cut off.
 */
import type { Difficulty } from '../../data/schema';
import type { SettingsView } from '../contracts';
import { add, button, clear, el, stencil } from '../shell/dom';
import { glyph } from '../shell/icons';
import { withScrollCue } from '../shell/scrollCue';
import { slider, type Slider } from '../shell/slider';
import type { ScreenFactory } from '../shell/types';

type VolumeSetting = 'musicVolume' | 'ambienceVolume' | 'sfxVolume';

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

  // The three volumes act at once while the finger moves; Sound effects clicks at its new level when let go.
  const volume = (key: VolumeSetting, testid: string, label: string): Slider =>
    slider({
      testid,
      label,
      value: ctx.view().settings[key],
      onInput: (value) => ctx.app.setSetting(key, value),
      onCommit: () => {
        if (key === 'sfxVolume') ctx.app.uiSound('click');
        ctx.reload();
      },
    });
  const music = volume('musicVolume', 'setting-music', 'Music');
  const ambience = volume('ambienceVolume', 'setting-ambience', 'Ambience');
  const sfx = volume('sfxVolume', 'setting-sfx', 'Sound effects');

  const flashState = el('span', 'th-toggle-state');
  const reduceFlash = button({
    testid: 'setting-reduce-flash',
    className: 'th-toggle',
    bare: true,
    content: [el('span', 'th-toggle-label', 'Reduce flashing'), flashState, el('span', 'th-switch')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.app.setSetting('reduceFlash', !ctx.view().settings.reduceFlash);
      ctx.reload();
    },
  });

  const bloodState = el('span', 'th-toggle-state');
  const blood = button({
    testid: 'setting-blood',
    className: 'th-toggle',
    bare: true,
    content: [el('span', 'th-toggle-label', 'Show blood'), bloodState, el('span', 'th-switch')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.app.setSetting('showBlood', !ctx.view().settings.showBlood);
      ctx.reload();
    },
  });

  const fpsState = el('span', 'th-toggle-state');
  const fps = button({
    testid: 'setting-fps',
    className: 'th-toggle',
    bare: true,
    content: [el('span', 'th-toggle-label', 'Show FPS'), fpsState, el('span', 'th-switch')],
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.app.setSetting('showFps', !ctx.view().settings.showFps);
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

  // The guided tips are shown once and remembered; this brings them back.
  const replay = button({
    testid: 'setting-replay',
    label: 'Replay tutorial',
    onTap: () => {
      ctx.app.uiSound('confirm');
      ctx.app.replayHints();
      replay.dataset.done = 'true';
      replay.querySelector('.th-btn-label')?.replaceChildren('Tips reset');
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

  const grid = el('div', 'th-set-grid th-scroll');
  grid.dataset.scroll = '';
  add(grid, mute, music.el, ambience.el, sfx.el, reduceFlash, blood, hints, fps, diffRow, replay, reset);
  const cue = withScrollCue(grid, 'dark');
  add(plate, head, cue.el);
  root.append(plate);

  function toggle(node: HTMLButtonElement, state: HTMLElement, on: boolean): void {
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
    node.dataset.state = on ? 'on' : 'off';
    state.textContent = on ? 'On' : 'Off';
  }

  function render(): void {
    const s: SettingsView = ctx.view().settings;
    music.set(s.musicVolume);
    ambience.set(s.ambienceVolume);
    sfx.set(s.sfxVolume);
    toggle(reduceFlash, flashState, s.reduceFlash);
    toggle(blood, bloodState, s.showBlood);
    toggle(fps, fpsState, s.showFps);
    const soundOn = !s.muted;
    mute.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    mute.dataset.state = soundOn ? 'on' : 'off';
    mute.dataset.muted = s.muted ? 'true' : 'false';
    muteState.textContent = soundOn ? 'On' : 'Off';
    clear(muteIcon);
    muteIcon.append(glyph(soundOn ? 'sound' : 'muted'));
    toggle(hints, hintsState, s.hints);
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
    mounted: () => cue.update(),
    resize: () => cue.update(),
    destroy: () => cue.destroy(),
    back() {
      ctx.go(ctx.session.settingsFrom);
    },
  };
};
