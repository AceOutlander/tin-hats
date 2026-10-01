/**
 * Pointer bindings for HUD controls.
 *
 * Everything runs on pointer events rather than click, because browsers only
 * synthesise a click for a lone finger: with a thumb resting on the joystick a
 * second finger on FIRE or an order would never produce one. Each control
 * tracks its own pointer id, so any number of controls can be held at once.
 *
 * A click with detail 0 (keyboard activation, or element.click() from a script
 * or test) carries no pointer events, so it is honoured as a fallback.
 */

/** A finger may drift this far outside a control and still count as a tap on it (CSS px). */
const TAP_SLOP = 10;

export function isPrimaryPointer(e: PointerEvent): boolean {
  return e.pointerType !== 'mouse' || e.button === 0;
}

export function capturePointer(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // The pointer may already be gone (synthetic events); the control still works without capture.
  }
}

/** Fires `down` the moment a pointer lands and `up` when that pointer lifts or is cancelled. */
export function onPress(el: HTMLElement, down: () => void, up?: () => void): void {
  let pid = -1;
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pid) return;
    pid = -1;
    el.classList.remove('is-down');
    if (up) up();
  };
  el.addEventListener('pointerdown', (e) => {
    if (!isPrimaryPointer(e) || pid !== -1) return;
    pid = e.pointerId;
    capturePointer(el, pid);
    el.classList.add('is-down');
    e.preventDefault();
    down();
  });
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
  el.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    down();
    if (up) up();
  });
}

/**
 * Fires `tap` when a pointer lifts on the control it landed on. A native scroll
 * (the training bar) cancels the pointer, so dragging the bar never taps.
 */
export function onTap(el: HTMLElement, tap: () => void): void {
  let pid = -1;
  const clear = (e: PointerEvent): void => {
    if (e.pointerId !== pid) return;
    pid = -1;
    el.classList.remove('is-down');
  };
  el.addEventListener('pointerdown', (e) => {
    if (!isPrimaryPointer(e) || pid !== -1) return;
    pid = e.pointerId;
    capturePointer(el, pid);
    el.classList.add('is-down');
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pid) return;
    clear(e);
    const r = el.getBoundingClientRect();
    if (
      e.clientX >= r.left - TAP_SLOP &&
      e.clientX <= r.right + TAP_SLOP &&
      e.clientY >= r.top - TAP_SLOP &&
      e.clientY <= r.bottom + TAP_SLOP
    ) {
      tap();
    }
  });
  el.addEventListener('pointercancel', clear);
  el.addEventListener('lostpointercapture', clear);
  el.addEventListener('click', (e) => {
    if (e.detail === 0) tap();
  });
}
