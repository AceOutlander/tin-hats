/**
 * Page lockdown: makes the page behave like an app surface, not a document.
 *
 * Blocks browser scrolling and rubber-banding, pinch zoom (Safari gesture
 * events, multi-touch moves, ctrl+wheel), double-tap zoom, the long-press
 * context menu, text selection and drag-and-drop ghosts. Controls inside the
 * UI keep working: nothing here cancels touchstart, pointer events or the
 * click that follows a tap on a button, and one-finger moves inside an element
 * marked `data-scroll` still scroll that element.
 */

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_SLOP_PX = 40;
const NON_PASSIVE: AddEventListenerOptions = { passive: false };
const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, label, [data-interactive], [role="button"]';
const TEXT_ENTRY_SELECTOR = 'input, textarea, [contenteditable="true"]';

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

/** The nearest ancestor that is allowed to scroll and actually has overflow. */
function scrollerFor(target: EventTarget | null): HTMLElement | null {
  const start = asElement(target);
  let node = start ? start.closest<HTMLElement>('[data-scroll]') : null;
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) return node;
    node = node.parentElement ? node.parentElement.closest<HTMLElement>('[data-scroll]') : null;
  }
  return null;
}

/**
 * Install the lockdown on a document. Returns a function that removes every
 * listener again. Safe to call more than once (each call is independent).
 */
export function installLockdown(doc: Document = document): () => void {
  const win = doc.defaultView;
  const offs: (() => void)[] = [];
  const on = <T extends Event>(target: EventTarget, type: string, handler: (ev: T) => void, options?: AddEventListenerOptions): void => {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    offs.push(() => target.removeEventListener(type, listener, options));
  };
  const cancel = (ev: Event): void => {
    if (ev.cancelable) ev.preventDefault();
  };

  // Safari pinch and rotate gestures.
  on(doc, 'gesturestart', cancel, NON_PASSIVE);
  on(doc, 'gesturechange', cancel, NON_PASSIVE);
  on(doc, 'gestureend', cancel, NON_PASSIVE);

  // Two or more fingers never zoom or scroll; one finger scrolls only inside a marked scroller.
  on<TouchEvent>(
    doc,
    'touchmove',
    (ev) => {
      if (ev.touches.length > 1 || !scrollerFor(ev.target)) cancel(ev);
    },
    NON_PASSIVE,
  );

  // Double-tap zoom. Taps on controls are left alone (their touch-action already
  // stops the zoom) so a quick second tap on a button still produces its click.
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  on<TouchEvent>(
    doc,
    'touchend',
    (ev) => {
      if (ev.touches.length > 0) return;
      const touch = ev.changedTouches[0];
      if (!touch) return;
      const now = ev.timeStamp;
      const near = Math.abs(touch.clientX - lastTapX) < DOUBLE_TAP_SLOP_PX && Math.abs(touch.clientY - lastTapY) < DOUBLE_TAP_SLOP_PX;
      const isDouble = now - lastTapTime < DOUBLE_TAP_MS && near;
      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
      if (!isDouble) return;
      const target = asElement(ev.target);
      if (target && target.closest(CONTROL_SELECTOR)) return;
      cancel(ev);
    },
    NON_PASSIVE,
  );
  on<MouseEvent>(doc, 'dblclick', (ev) => {
    const target = asElement(ev.target);
    if (!target || !target.closest(TEXT_ENTRY_SELECTOR)) cancel(ev);
  });

  // Desktop pinch (trackpads report it as ctrl+wheel) and browser zoom by wheel.
  on<WheelEvent>(
    doc,
    'wheel',
    (ev) => {
      if (ev.ctrlKey || ev.metaKey) cancel(ev);
    },
    NON_PASSIVE,
  );

  // Long-press menu, selection and drag ghosts.
  on(doc, 'contextmenu', cancel);
  on(doc, 'selectstart', (ev) => {
    const target = asElement(ev.target);
    if (!target || !target.closest(TEXT_ENTRY_SELECTOR)) cancel(ev);
  });
  on(doc, 'dragstart', cancel);

  // If anything does manage to scroll the page (focus jumps, address-bar tricks), put it back.
  if (win) {
    on(win, 'scroll', () => {
      if (win.scrollX !== 0 || win.scrollY !== 0) win.scrollTo(0, 0);
    });
  }

  return () => {
    for (const off of offs) off();
    offs.length = 0;
  };
}
