/**
 * The hidden admin panel's DOM: the secret entry (seven quick taps on the title helmet, or the key combination in
 * data/admin.ts), the passcode prompt, the small admin button that stays up while unlocked, the panel, the bar shown
 * while a spawn or pick mode waits for a tap on the field, and the debug drawing.
 *
 * Until the code is accepted nothing of this is in the page but two listeners: the prompt is built when the secret
 * run completes and removed when it closes, and a wrong code just closes it.
 */
import { ADMIN } from '../../data/admin';
import { el } from '../shell/dom';
import './admin.css';
import type { AdminApi, AdminInfo } from './contracts';
import { createDebugLayer, type DebugLayer } from './overlay';
import { createAdminPanel, type AdminPanel } from './panel';

export type { AdminApi } from './contracts';

export interface AdminUiHandle {
  /** Remove everything this added. */
  destroy(): void;
}

/** True for the computer's secret key combination. */
export function isAdminCombo(ev: KeyboardEvent): boolean {
  const k = ADMIN.keys;
  return ev.code === k.code && ev.ctrlKey === k.ctrl && ev.altKey === k.alt && ev.shiftKey === k.shift && !ev.metaKey;
}

export function installAdminUi(root: HTMLElement, api: AdminApi): AdminUiHandle {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  let prompt: HTMLElement | null = null;
  let fab: HTMLButtonElement | null = null;
  let panel: AdminPanel | null = null;
  let bar: HTMLElement | null = null;
  let debug: DebugLayer | null = null;

  // --- the prompt --------------------------------------------------------------
  function closePrompt(): void {
    prompt?.remove();
    prompt = null;
  }

  function openPrompt(): void {
    if (prompt) return;
    const layer = el('div', 'th-admin-modal');
    layer.dataset.testid = 'admin-prompt';
    const form = el('form', 'th-paper th-admin-prompt');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-label', 'Code');
    const input = el('input', 'th-admin-input');
    input.type = 'password';
    input.dataset.testid = 'admin-code';
    input.maxLength = ADMIN.maxCodeLength;
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Code');
    const ok = el('button', 'th-btn th-btn-primary', 'OK');
    ok.type = 'submit';
    ok.dataset.testid = 'admin-code-ok';
    const cancel = el('button', 'th-btn', 'Cancel');
    cancel.type = 'button';
    cancel.dataset.testid = 'admin-code-cancel';
    cancel.addEventListener('click', closePrompt);
    const actions = el('div', 'th-admin-prompt-actions');
    actions.append(cancel, ok);
    form.append(input, actions);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const right = api.submitCode(input.value);
      input.value = '';
      // Right or wrong, the prompt simply closes: a wrong code gets no hint.
      closePrompt();
      if (right) {
        showFab();
        openPanel();
      }
    });
    layer.addEventListener('pointerdown', (ev) => {
      if (ev.target === layer) closePrompt();
    });
    layer.append(form);
    root.append(layer);
    prompt = layer;
    input.focus({ preventScroll: true });
  }

  // --- the admin button and the panel ------------------------------------------
  function showFab(): void {
    if (fab) return;
    fab = el('button', 'th-admin-fab', 'ADM');
    fab.type = 'button';
    fab.dataset.testid = 'admin-button';
    fab.setAttribute('aria-label', 'Admin panel');
    fab.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (panel && panel.el.isConnected) hidePanel();
      else openPanel();
    });
    root.append(fab);
  }

  function changed(info: AdminInfo): void {
    syncBar(info);
    if (info.overlays.readout || info.overlays.ranges || info.overlays.hitboxes || info.overlays.points) {
      if (!debug) {
        debug = createDebugLayer(api);
        root.append(debug.el);
      }
      debug.set(info.overlays);
    } else if (debug) {
      debug.destroy();
      debug = null;
    }
  }

  function openPanel(tab?: Parameters<AdminPanel['showTab']>[0]): void {
    if (!api.isUnlocked()) return;
    if (!panel) {
      panel = createAdminPanel(api, { hide: hidePanel, lock: lockAll, changed });
    }
    if (!panel.el.isConnected) root.append(panel.el);
    if (tab) panel.showTab(tab);
    else panel.render();
  }

  function hidePanel(): void {
    panel?.el.remove();
    syncBar(api.info());
  }

  function lockAll(): void {
    api.lock();
    panel?.el.remove();
    panel = null;
    fab?.remove();
    fab = null;
    bar?.remove();
    bar = null;
    debug?.destroy();
    debug = null;
  }

  // --- the mode bar --------------------------------------------------------------
  function syncBar(info: AdminInfo): void {
    const mode = info.placing ? 'place' : info.picking ? 'pick' : null;
    if (!mode || (panel && panel.el.isConnected)) {
      bar?.remove();
      bar = null;
      return;
    }
    if (!bar) {
      bar = el('div', 'th-admin-bar');
      bar.dataset.testid = 'admin-bar';
      root.append(bar);
    }
    const text = el('span', 'th-admin-bar-text');
    if (info.placing) {
      const p = info.placing;
      const squad = ADMIN.squads.find((s) => s.id === p.what);
      const names = info.battle ? info.battle.names[p.side === 'mine' ? 0 : 1] : null;
      const what = squad ? squad.label : names && p.what in names ? names[p.what as keyof typeof names] : p.what;
      text.textContent = `Tap the field: ${p.count} × ${what} (${p.side === 'mine' ? 'mine' : 'enemy'})`;
    } else {
      text.textContent = 'Tap a unit to pick it';
    }
    const done = el('button', 'th-admin-btn', info.placing ? 'Done' : 'Cancel');
    done.type = 'button';
    done.dataset.testid = 'admin-bar-done';
    done.addEventListener('click', (ev) => {
      ev.preventDefault();
      api.run(info.placing ? { type: 'place', spec: null } : { type: 'pick', on: false });
      openPanel('units');
    });
    bar.replaceChildren(text, done);
  }

  api.onChange = () => {
    const info = api.info();
    // A unit picked on the field: back to the panel, to act on it.
    if (panel && !panel.el.isConnected && info.selected && !info.picking && !info.placing && bar) {
      openPanel('units');
      return;
    }
    if (panel && panel.el.isConnected) panel.render();
    else changed(info);
  };

  // --- the secret entry ------------------------------------------------------------
  function onPointerDown(ev: PointerEvent): void {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !target.closest('[data-admin-tap]')) return;
    // No mouse events follow the tap, so the browser does not move the focus away from the prompt it may open.
    ev.preventDefault();
    if (!api.helmetTap()) return;
    if (api.isUnlocked()) {
      showFab();
      openPanel();
    } else {
      openPrompt();
    }
  }

  // Capture phase: these keys never reach the screens underneath (Escape would go back, Enter would press Play).
  function onKeyDown(ev: KeyboardEvent): void {
    if (isAdminCombo(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (api.isUnlocked()) {
        showFab();
        if (panel && panel.el.isConnected) hidePanel();
        else openPanel();
      } else if (prompt) {
        closePrompt();
      } else {
        openPrompt();
      }
      return;
    }
    const open = prompt ?? (panel && panel.el.isConnected ? panel.el : null);
    if (!open) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      if (prompt) closePrompt();
      else hidePanel();
      return;
    }
    const focused = doc.activeElement;
    if (focused instanceof Node && open.contains(focused)) ev.stopPropagation();
  }

  root.addEventListener('pointerdown', onPointerDown, true);
  win.addEventListener('keydown', onKeyDown, true);

  return {
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown, true);
      win.removeEventListener('keydown', onKeyDown, true);
      closePrompt();
      lockAll();
      api.onChange = null;
    },
  };
}
