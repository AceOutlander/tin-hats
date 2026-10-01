/**
 * A scroll cue for the menu screens: a fade and a bobbing chevron at the foot of a scrolling area for as long as
 * there is more below, so a sheet that runs past the screen says so. A touch screen shows no scroll bar, so
 * without this a player cannot tell that the briefing goes on.
 *
 * The scrolling element is wrapped, not changed: it keeps its own classes, `data-scroll` (which lets a one-finger
 * drag scroll it) and its wheel and keyboard behaviour. The cue never takes a tap or a drag.
 */
import { el } from './dom';
import { glyph } from './icons';

export interface ScrollCue {
  /** Put this where the scroller was going to go. */
  el: HTMLElement;
  /** Look again at whether there is more below: after the content or the size changed. */
  update(): void;
  destroy(): void;
}

/** Closer than this to the end (CSS px) counts as being at the end. */
const END_SLACK = 4;

export function withScrollCue(scroller: HTMLElement, variant: 'paper' | 'dark'): ScrollCue {
  const wrap = el('div', `th-scrollwrap is-${variant}`);
  const cue = el('div', 'th-scrollcue');
  cue.setAttribute('aria-hidden', 'true');
  cue.append(el('span', 'th-scrollcue-text', 'More'), glyph('chevron', 'th-icon th-scrollcue-icon'));
  wrap.append(scroller, cue);
  wrap.dataset.more = 'false';

  let last = false;
  const update = (): void => {
    const more = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > END_SLACK;
    if (more === last) return;
    last = more;
    wrap.dataset.more = more ? 'true' : 'false';
  };
  scroller.addEventListener('scroll', update, { passive: true });
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
  if (observer) observer.observe(scroller);

  return {
    el: wrap,
    update,
    destroy() {
      scroller.removeEventListener('scroll', update);
      if (observer) observer.disconnect();
    },
  };
}
