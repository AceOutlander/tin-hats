/**
 * A volume slider for the menus: a label and value over a track, the whole cell (at least 48 px tall) is the touch
 * target. It is driven by pointer events with the pointer captured, so it works under the page lockdown (which blocks
 * the browser's own touch scrolling) and the same with a finger, a mouse or a pen; arrow keys, Page Up and Down,
 * Home and End work when it has focus. Values are whole numbers 0..100.
 */
import { el } from './dom';

export interface SliderSpec {
  testid: string;
  label: string;
  value: number;
  /** Every change while dragging or stepping: apply it live. */
  onInput(value: number): void;
  /** The finger lifted or a key was pressed: the value is final. */
  onCommit(value: number): void;
}

export interface Slider {
  el: HTMLElement;
  /** Show a value (from the saved settings) unless the player is dragging this slider right now. */
  set(value: number): void;
}

const KEY_STEP = 5;
const PAGE_STEP = 10;

export function slider(spec: SliderSpec): Slider {
  const root = el('div', 'th-slider');
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-label', spec.label);
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.tabIndex = 0;
  root.dataset.testid = spec.testid;
  root.dataset.interactive = '';
  const head = el('span', 'th-slider-head');
  const valueText = el('span', 'th-slider-value');
  head.append(el('span', 'th-slider-label', spec.label), valueText);
  const track = el('span', 'th-slider-track');
  const fill = el('span', 'th-slider-fill');
  const thumb = el('span', 'th-slider-thumb');
  track.append(fill, thumb);
  root.append(head, track);

  let value = -1;
  let dragging = -1;

  function show(v: number): void {
    const next = Math.min(100, Math.max(0, Math.round(v)));
    if (next === value) return;
    value = next;
    root.setAttribute('aria-valuenow', String(next));
    root.setAttribute('aria-valuetext', `${next}%`);
    root.dataset.value = String(next);
    valueText.textContent = String(next);
    fill.style.width = `${next}%`;
    thumb.style.left = `${next}%`;
  }

  function change(v: number): void {
    const before = value;
    show(v);
    if (value !== before) spec.onInput(value);
  }

  function fromPointer(clientX: number): number {
    const r = track.getBoundingClientRect();
    return r.width > 0 ? ((clientX - r.left) / r.width) * 100 : value;
  }

  root.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || dragging >= 0) return;
    dragging = ev.pointerId;
    try {
      root.setPointerCapture(ev.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured; the move and up events still arrive.
    }
    root.classList.add('is-dragging');
    change(fromPointer(ev.clientX));
    ev.preventDefault();
  });
  root.addEventListener('pointermove', (ev) => {
    if (ev.pointerId === dragging) change(fromPointer(ev.clientX));
  });
  const release = (ev: PointerEvent): void => {
    if (ev.pointerId !== dragging) return;
    dragging = -1;
    root.classList.remove('is-dragging');
    spec.onCommit(value);
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('keydown', (ev) => {
    let next = value;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next -= KEY_STEP;
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') next += KEY_STEP;
    else if (ev.key === 'PageDown') next -= PAGE_STEP;
    else if (ev.key === 'PageUp') next += PAGE_STEP;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = 100;
    else return;
    ev.preventDefault();
    change(next);
    spec.onCommit(value);
  });

  show(spec.value);
  return {
    el: root,
    set(v: number) {
      if (dragging < 0) show(v);
    },
  };
}
