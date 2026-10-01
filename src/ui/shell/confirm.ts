/** A small modal confirm slip (used for "reset progress"). One at a time. */
import { add, button, el, stencil } from './dom';
import type { ConfirmRequest } from './types';

export interface ConfirmLayer {
  open(request: ConfirmRequest, sound: (name: 'click' | 'deny' | 'confirm') => void, focusFirst: boolean): void;
  /** Close without confirming (Esc, or the screen underneath went away). */
  cancel(): void;
  isOpen(): boolean;
  /** The element holding the dialog, for "press Enter with nothing focused". */
  el: HTMLElement;
}

export function createConfirmLayer(parent: HTMLElement, onChange: (open: boolean) => void): ConfirmLayer {
  const layer = el('div', 'th-modal');
  layer.hidden = true;
  parent.append(layer);
  let open = false;

  function close(): void {
    if (!open) return;
    open = false;
    layer.classList.remove('is-in');
    layer.hidden = true;
    layer.replaceChildren();
    onChange(false);
  }

  return {
    el: layer,
    isOpen: () => open,
    cancel: close,
    open(request, sound, focusFirst) {
      close();
      open = true;
      const slip = el('div', 'th-paper th-confirm');
      slip.setAttribute('role', 'alertdialog');
      slip.setAttribute('aria-modal', 'true');
      slip.setAttribute('aria-label', request.title);
      const no = button({
        testid: 'confirm-no',
        label: request.no,
        onTap: () => {
          sound('click');
          close();
        },
      });
      no.dataset.primary = '';
      const yes = button({
        testid: 'confirm-yes',
        label: request.yes,
        className: 'th-btn-danger',
        onTap: () => {
          sound('confirm');
          close();
          request.onYes();
        },
      });
      const actions = el('div', 'th-confirm-actions');
      add(actions, no, yes);
      add(slip, stencil('h2', request.title, 'th-confirm-title'), el('p', 'th-type th-confirm-body', request.body), actions);
      // Keep Tab inside the two buttons while the slip is up.
      slip.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Tab') return;
        ev.preventDefault();
        (document.activeElement === no ? yes : no).focus();
      });
      layer.append(slip);
      layer.hidden = false;
      void layer.offsetWidth;
      layer.classList.add('is-in');
      onChange(true);
      if (focusFirst) no.focus({ preventScroll: true });
    },
  };
}
