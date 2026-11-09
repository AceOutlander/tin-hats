/**
 * Starting a battle from a button once its music is made (AppApi.loadMission): the button shows the progress
 * ("Loading 40%") and ignores further taps meanwhile, then the battle starts. An app without loadMission starts at
 * once. cancel() (the screen's destroy) drops a start still waiting.
 */
import type { AppApi } from '../contracts';

export interface MissionStarter {
  /** Load `id`'s music, then call `go` (unless cancelled first). False for a tap while it loads (ignored). */
  start(id: number, go: () => void): boolean;
  cancel(): void;
}

export function missionStarter(app: AppApi, node: HTMLButtonElement): MissionStarter {
  const label = node.querySelector('.th-btn-label');
  let loading = false;
  let cancelled = false;
  const caption = (): string => (label ? (label.textContent ?? '') : '');
  let idle = caption();
  const restore = (): void => {
    loading = false;
    node.classList.remove('is-loading');
    node.removeAttribute('aria-busy');
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
      const show = (fraction: number): void => {
        if (!cancelled && label) label.textContent = `Loading ${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
      };
      void load(id, show).then(
        (ok) => {
          if (cancelled) return;
          restore();
          if (ok) go();
        },
        () => {
          // loadMission never rejects; should a stand-in, the battle still starts.
          if (cancelled) return;
          restore();
          go();
        },
      );
      return true;
    },
    cancel() {
      cancelled = true;
    },
  };
}
