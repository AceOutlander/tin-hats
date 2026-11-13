/**
 * Giving the browser a turn between pieces of work, so a long job (the game's startup above all) never holds the page.
 * Kept in a module of its own so the page's small loader (src/main.ts) can use it without the renderer.
 */

/** A turn for the browser (input, painting, timers) before the next piece of work: resolves in a new task. */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    // A message is not clamped to 4 ms as nested timers are, nor held back to once a second in a background tab.
    const ch = new MessageChannel();
    ch.port1.onmessage = (): void => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });
}
