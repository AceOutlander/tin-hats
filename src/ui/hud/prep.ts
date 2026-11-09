/**
 * The prep phase panel, under the objective plate: the countdown and Ready, a button per build (name, money and
 * build time), and while placing, Place and Cancel with a short tip. Undo takes back the newest site. Thumb sized; the
 * panel hides itself once the prep phase is over.
 */
import type { BuildableId } from '../../data/schema';
import type { BuildButtonState, HudAction, PrepHudState } from '../contracts';
import { formatClock } from './format';
import { ICONS, type IconName } from './icons';
import { onTap } from './input';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function button(cls: string, testId: string, label: string, parent: HTMLElement): HTMLButtonElement {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.tabIndex = -1;
  b.dataset.testid = testId;
  b.setAttribute('aria-label', label);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

function icon(name: IconName, parent: HTMLElement): void {
  const s = el('span', 'th-ico', parent);
  s.innerHTML = ICONS[name];
}

export class PrepPanel {
  readonly root: HTMLDivElement;
  private readonly time: HTMLSpanElement;
  private readonly builds: HTMLDivElement;
  private readonly place: HTMLDivElement;
  private readonly confirm: HTMLButtonElement;
  private readonly undo: HTMLButtonElement;
  private readonly buttons = new Map<BuildableId, HTMLButtonElement>();
  private ids = '';
  private lastClock = -1;
  private lastOn: boolean | null = null;
  private lastPlacing: BuildableId | null | undefined = undefined;

  constructor(
    parent: HTMLElement,
    private readonly act: (action: HudAction) => void,
  ) {
    const root = el('div', 'th-prep', parent);
    root.dataset.testid = 'prep-panel';
    root.hidden = true;
    this.root = root;
    const head = el('div', 'th-prep-head', root);
    el('span', 'th-prep-label', head, 'Prepare');
    this.time = el('span', 'th-prep-time', head);
    this.time.dataset.testid = 'prep-time';
    this.undo = button('th-prep-btn th-prep-undo', 'build-undo', 'Undo the last build', head);
    icon('close', this.undo);
    el('span', '', this.undo, 'Undo');
    onTap(this.undo, () => this.act({ type: 'undoBuild' }));
    const ready = button('th-prep-btn th-prep-ready', 'prep-ready', 'Ready: start the attack now', head);
    el('span', '', ready, 'Ready');
    onTap(ready, () => this.act({ type: 'ready' }));

    this.builds = el('div', 'th-prep-builds', root);
    const place = el('div', 'th-prep-place', root);
    place.hidden = true;
    this.place = place;
    el('span', 'th-prep-tip', place, 'Tap the ground or drag the field');
    this.confirm = button('th-prep-btn th-prep-confirm', 'build-confirm', 'Build it here', place);
    el('span', '', this.confirm, 'Build here');
    onTap(this.confirm, () => this.act({ type: 'confirmBuild' }));
    const cancel = button('th-prep-btn', 'build-cancel', 'Cancel', place);
    icon('close', cancel);
    el('span', '', cancel, 'Cancel');
    onTap(cancel, () => this.act({ type: 'cancelPlacing' }));
  }

  private rebuild(builds: readonly BuildButtonState[]): void {
    this.builds.textContent = '';
    this.buttons.clear();
    for (const b of builds) {
      const btn = button('th-prep-btn th-prep-build', `build-${b.id}`, `Build ${b.name} for ${b.cost} money, ${b.seconds} seconds of work`, this.builds);
      el('span', 'th-prep-name', btn, b.name);
      const cost = el('span', 'th-prep-cost', btn);
      icon('money', cost);
      el('span', '', cost, String(b.cost));
      el('span', 'th-prep-secs', cost, `${b.seconds}s`);
      const id = b.id;
      onTap(btn, () => this.act({ type: 'build', kind: id }));
      this.buttons.set(b.id, btn);
    }
    this.ids = builds.map((b) => b.id).join(',');
  }

  update(p: PrepHudState | null): void {
    const on = p !== null;
    if (on !== this.lastOn) {
      this.lastOn = on;
      this.root.hidden = !on;
    }
    if (p === null) return;
    const ids = p.builds.map((b) => b.id).join(',');
    if (ids !== this.ids) this.rebuild(p.builds);
    const clock = Math.ceil(p.secondsLeft);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.time.textContent = formatClock(clock);
    }
    for (const b of p.builds) {
      const btn = this.buttons.get(b.id);
      if (!btn) continue;
      btn.disabled = !b.canAfford;
      btn.classList.toggle('is-active', p.placing === b.id);
    }
    this.undo.hidden = p.sites === 0;
    if (p.placing !== this.lastPlacing) {
      this.lastPlacing = p.placing;
      this.place.hidden = p.placing === null;
      this.builds.hidden = p.placing !== null;
    }
    this.confirm.disabled = !p.placeOk;
  }
}
