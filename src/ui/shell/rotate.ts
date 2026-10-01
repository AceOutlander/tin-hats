/**
 * The "rotate your phone" overlay. CSS shows it under an orientation media
 * query; this module adds the JS resize check (class `is-portrait` on the UI
 * root) so it also appears where the media query lags, and tells the app.
 */
import { add, el, stencil } from './dom';

export interface RotateOverlay {
  el: HTMLElement;
  /** Re-measure the viewport; returns true when the page is portrait. */
  check(): boolean;
  isPortrait(): boolean;
}

export function createRotateOverlay(root: HTMLElement, onChange: (portrait: boolean) => void): RotateOverlay {
  const overlay = el('div', 'th-rotate');
  overlay.dataset.testid = 'rotate-overlay';
  overlay.dataset.interactive = '';
  overlay.setAttribute('role', 'alert');

  const art = el('div', 'th-rotate-art');
  const phone = el('div', 'th-rotate-phone');
  phone.append(el('div', 'th-rotate-screen'));
  add(art, phone, el('div', 'th-rotate-arrow'));

  add(
    overlay,
    art,
    stencil('div', 'ROTATE YOUR PHONE', 'th-rotate-title'),
    el('p', 'th-type th-rotate-text', 'Tin Hats is played with the phone held sideways.'),
  );
  root.append(overlay);

  let portrait: boolean | null = null;

  function check(): boolean {
    const win = root.ownerDocument.defaultView ?? window;
    const now = win.innerHeight > win.innerWidth;
    if (now !== portrait) {
      portrait = now;
      root.classList.toggle('is-portrait', now);
      onChange(now);
    }
    return now;
  }

  return { el: overlay, check, isPortrait: () => portrait === true };
}
