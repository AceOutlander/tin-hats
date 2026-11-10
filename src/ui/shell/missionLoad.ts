/**
 * Starting a battle from a button (AppApi.loadMission): the button says "Loading" with a short bar along its bottom
 * and ignores further taps meanwhile; once the battle music's calm layer is in (usually already, from the briefing),
 * the bar fills, one frame is drawn so it shows, and the battle starts (owner, 2026-11-09: "Start the battle within
 * about 2 seconds ... Show a short loading bar if anything still takes time"). An app without loadMission starts at
 * once. cancel() (the screen's destroy) drops a start still waiting.
 */
import type { AppApi } from '../contracts';

export interface MissionStarter {
  /** Load `id`'s music, then call `go` (unless cancelled first). False for a tap while it loads (ignored). */
  start(id: number, go: () => void): boolean;
  cancel(): void;
}

/** How much of the bar the music's calm layer is; the rest fills just before the battle's own set-up. */
const MUSIC_SHARE = 0.6;

/** After the next frame has been drawn, or 100 ms at most (a hidden page draws none). */
function afterPaint(then: () => void): void {
  let done = false;
  const once = (): void => {
    if (done) return;
    done = true;
    then();
  };
  setTimeout(once, 100);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(once, 0));
}

export function missionStarter(app: AppApi, node: HTMLButtonElement): MissionStarter {
  const label = node.querySelector('.th-btn-label');
  let loading = false;
  let cancelled = false;
  const caption = (): string => (label ? (label.textContent ?? '') : '');
  let idle = caption();
  const bar = (fraction: number): void => node.style.setProperty('--th-load', String(Math.max(0, Math.min(1, fraction))));
  const restore = (): void => {
    loading = false;
    node.classList.remove('is-loading');
    node.removeAttribute('aria-busy');
    node.style.removeProperty('--th-load');
    if (label) label.textContent = idle;
  };
  return {
    start(id, go) {
      if (loading || cancelled) return false;
      const load = app.loadMission?.bind(app);
      if (!load) {
        go();
        return true;
      }
      loading = true;
      idle = caption();
      node.classList.add('is-loading');
      node.setAttribute('aria-busy', 'true');
      if (label) label.textContent = 'Loading';
      bar(0);
      const show = (fraction: number): void => {
        if (!cancelled) bar(fraction * MUSIC_SHARE);
      };
      const launch = (ok: boolean): void => {
        if (cancelled) return;
        if (!ok) {
          restore();
          return;
        }
        // The battle's set-up runs in one go: the full bar is drawn first.
        bar(1);
        afterPaint(() => {
          if (cancelled) return;
          restore();
          go();
        });
      };
      // loadMission never rejects; should a stand-in, the battle still starts.
      void load(id, show).then(launch, () => launch(true));
      return true;
    },
    cancel() {
      cancelled = true;
    },
  };
}
