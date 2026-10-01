/** Title screen: the logo on a translucent plate over whatever the battlefield canvas is showing. */
import { add, button, el, stencil } from '../shell/dom';
import { helmetIcon } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

export const titleScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-title');
  root.dataset.screen = 'title';

  const plate = el('div', 'th-plate th-title-plate');

  const logo = el('div', 'th-logo');
  const helmet = el('div', 'th-logo-helmet');
  helmet.append(helmetIcon());
  add(
    logo,
    helmet,
    stencil('h1', 'TIN HATS', 'th-logo-text'),
    el('p', 'th-type th-logo-tag', 'Western Europe & North Africa · 1940–45'),
  );

  const actions = el('div', 'th-title-actions');
  const play = button({
    testid: 'play',
    label: 'Play',
    className: 'th-btn-primary th-btn-big',
    onTap: () => {
      ctx.app.uiSound('confirm');
      ctx.go('campaign');
    },
  });
  play.dataset.primary = '';
  const settings = button({
    testid: 'settings',
    label: 'Settings',
    className: 'th-btn-big',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.session.settingsFrom = 'title';
      ctx.go('settings');
    },
  });
  add(actions, play, settings);

  add(plate, logo, actions);
  const version = el('div', 'th-type th-version', ctx.opts.version ?? '');
  version.dataset.testid = 'version';
  add(root, plate, version);

  return { el: root };
};
