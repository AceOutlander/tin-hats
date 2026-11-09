/**
 * The admin panel itself: a sheet on the right with a tab row (data/admin.ts lists the tabs and their entries) over
 * a scrolling body. Every entry id has a builder here; an entry the data marks `pending` shows greyed out with its note.
 * The body is rebuilt from a fresh AdminInfo after every action, so it always shows the game as it is.
 */
import { ADMIN, type AdminEntryDef, type AdminTabId } from '../../data/admin';
import { DIFFICULTY_LIST } from '../../data/difficulty';
import type { Difficulty, UnitKind } from '../../data/schema';
import { TIMES_OF_DAY } from '../../data/theatres';
import { WEATHER_KINDS } from '../../data/weather';
import { UNIT_KINDS } from '../../data/units';
import { add, el } from '../shell/dom';
import type { AdminApi, AdminCommand, AdminInfo, AdminSide, OverlayLayer, SpawnSpec } from './contracts';

const DIFFICULTY_NAMES: Record<Difficulty, string> = { normal: 'Normal', hard: 'Hard', insane: 'Insane' };

export interface PanelHooks {
  /** A mode that needs the battlefield was armed: the panel gets out of the way. */
  hide(): void;
  /** The panel's Lock button. */
  lock(): void;
  /** The debug layers may have changed. */
  changed(info: AdminInfo): void;
}

export interface AdminPanel {
  el: HTMLElement;
  render(): void;
  showTab(tab: AdminTabId): void;
}

interface BtnOpts {
  testid?: string;
  pressed?: boolean;
  danger?: boolean;
  disabled?: boolean;
  wide?: boolean;
}

/** A panel button: a real <button>, thumb-sized. */
function btn(label: string, onTap: () => void, opts: BtnOpts = {}): HTMLButtonElement {
  const b = el('button', 'th-admin-btn', label);
  b.type = 'button';
  if (opts.testid) b.dataset.testid = opts.testid;
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  if (opts.danger) b.classList.add('is-danger');
  if (opts.wide) b.classList.add('is-wide');
  b.disabled = opts.disabled === true;
  b.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!b.disabled) onTap();
  });
  return b;
}

function row(...children: (Node | null | false)[]): HTMLElement {
  return add(el('div', 'th-admin-row'), ...children);
}

function note(text: string): HTMLElement {
  return el('p', 'th-admin-note', text);
}

export function createAdminPanel(api: AdminApi, hooks: PanelHooks): AdminPanel {
  const root = el('aside', 'th-admin-panel');
  root.dataset.testid = 'admin-panel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Admin');
  const head = el('div', 'th-admin-head');
  const tabs = el('div', 'th-admin-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'th-admin-body th-scroll');
  body.dataset.scroll = '';
  body.dataset.testid = 'admin-body';
  const close = btn('×', () => hooks.hide(), { testid: 'admin-close' });
  close.classList.add('th-admin-x');
  close.setAttribute('aria-label', 'Close');
  const lock = btn('Lock', () => hooks.lock(), { testid: 'admin-lock' });
  add(head, tabs, lock, close);
  add(root, head, body);

  let tab: AdminTabId = 'campaign';
  // Choices the panel remembers between renders.
  let jumpMission = 0;
  let jumpDifficulty: Difficulty = 'normal';
  let spawnWhat: string = 'rifle';
  let spawnSide: AdminSide = 'enemy';
  let spawnCount = ADMIN.batches[0];
  let saveText = '';
  let saveNote = '';
  let resetArmed = false;

  function run(command: AdminCommand): void {
    api.run(command);
    render();
  }

  function needBattle(info: AdminInfo, out: HTMLElement): boolean {
    if (info.battle) return true;
    out.append(note('Start a battle to use this.'));
    return false;
  }

  const builders: Record<string, (info: AdminInfo, out: HTMLElement) => void> = {
    // --- Campaign -------------------------------------------------------------
    unlockMissions(info, out) {
      out.append(
        row(
          btn(info.unlockedAll ? 'All missions open' : 'Unlock all missions', () => run({ type: 'unlockMissions' }), {
            testid: 'admin-unlock',
            pressed: info.unlockedAll,
            disabled: info.unlockedAll,
          }),
        ),
        note('For this session only: nothing is saved.'),
      );
    },
    jump(info, out) {
      if (!info.missions.some((m) => m.id === jumpMission)) jumpMission = info.missions[0]?.id ?? 0;
      const select = el('select', 'th-admin-select');
      select.dataset.testid = 'admin-jump-mission';
      for (const m of info.missions) {
        const option = el('option', undefined, `${m.id}. ${m.title}`);
        option.value = String(m.id);
        option.selected = m.id === jumpMission;
        select.append(option);
      }
      select.addEventListener('change', () => {
        jumpMission = Number(select.value);
      });
      out.append(
        row(select),
        row(
          ...DIFFICULTY_LIST.map((d) =>
            btn(
              DIFFICULTY_NAMES[d],
              () => {
                jumpDifficulty = d;
                render();
              },
              { pressed: d === jumpDifficulty },
            ),
          ),
          btn('Go', () => run({ type: 'jump', missionId: jumpMission, difficulty: jumpDifficulty }), { testid: 'admin-jump-go' }),
        ),
      );
    },
    medals(info, out) {
      out.append(
        row(el('span', 'th-admin-value', `${info.medals}`), ...ADMIN.medalGrants.map((n) => btn(`+${n}`, () => run({ type: 'medals', amount: n }), { testid: `admin-medals-${n}` }))),
      );
    },
    upgrades(info, out) {
      for (const u of info.upgrades) {
        out.append(
          row(
            el('span', 'th-admin-name', u.name),
            el('span', 'th-admin-value', `${u.level}/${u.max}`),
            btn('−', () => run({ type: 'upgrade', id: u.id, level: u.level - 1 }), { disabled: u.level <= 0, testid: `admin-up-${u.id}-down` }),
            btn('+', () => run({ type: 'upgrade', id: u.id, level: u.level + 1 }), { disabled: u.level >= u.max, testid: `admin-up-${u.id}-up` }),
          ),
        );
      }
    },
    save(_info, out) {
      const text = el('textarea', 'th-admin-text');
      text.dataset.testid = 'admin-save-text';
      text.value = saveText;
      text.spellcheck = false;
      text.setAttribute('autocomplete', 'off');
      text.addEventListener('input', () => {
        saveText = text.value;
      });
      add(
        out,
        row(
          btn('Export', () => {
            saveText = api.exportSave();
            saveNote = 'Copied below.';
            const clip = navigator.clipboard;
            if (clip) clip.writeText(saveText).then(() => undefined, () => undefined);
            render();
          }),
          btn('Import', () => {
            saveNote = api.importSave(saveText) ? 'Save imported.' : ADMIN.importRejected;
            render();
          }, { testid: 'admin-import' }),
          btn(resetArmed ? 'Tap again to reset' : 'Reset save', () => {
            if (!resetArmed) {
              resetArmed = true;
              render();
              return;
            }
            resetArmed = false;
            saveNote = 'Save reset.';
            run({ type: 'resetSave' });
          }, { danger: true, testid: 'admin-reset' }),
        ),
        text,
        saveNote ? note(saveNote) : null,
      );
    },

    // --- Battle ---------------------------------------------------------------
    supplies(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const b = info.battle;
      out.append(
        row(
          el('span', 'th-admin-value', `${b.supplies}`),
          ...ADMIN.supplyGrants.map((n) => btn(`+${n}`, () => run({ type: 'addSupplies', amount: n }), { testid: `admin-supplies-${n}` })),
          btn('0', () => run({ type: 'setSupplies', amount: 0 })),
        ),
        row(
          btn('Freeze', () => run({ type: 'freezeSupplies', on: !b.frozen }), { pressed: b.frozen, testid: 'admin-freeze' }),
          btn('Infinite', () => run({ type: 'infiniteSupplies', on: !b.infinite }), { pressed: b.infinite, testid: 'admin-infinite' }),
        ),
      );
    },
    instantTrain(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const on = info.battle.instantTrain;
      out.append(row(btn('Instant training', () => run({ type: 'instantTrain', on: !on }), { pressed: on, testid: 'admin-instant' })));
    },
    end(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const over = info.battle.over;
      out.append(
        row(
          btn('Win now', () => run({ type: 'end', win: true }), { disabled: over, testid: 'admin-win' }),
          btn('Lose now', () => run({ type: 'end', win: false }), { disabled: over, danger: true, testid: 'admin-lose' }),
        ),
        note('Not recorded: no clear and no medals.'),
      );
    },
    events(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      if (info.battle.events.length === 0) out.append(note('This mission has no scripted events.'));
      for (const ev of info.battle.events) {
        out.append(row(el('span', 'th-admin-name', ev.label), btn('Fire', () => run({ type: 'fireEvent', index: ev.index }), { testid: `admin-event-${ev.index}` })));
      }
      for (const p of info.battle.phases ?? []) {
        out.append(row(el('span', 'th-admin-name', p.label), btn('Jump', () => run({ type: 'jumpPhase', phase: p.id }), { pressed: p.current, testid: `admin-phase-${p.id}` })));
      }
    },
    difficulty(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const now = info.battle.difficulty;
      out.append(row(...DIFFICULTY_LIST.map((d) => btn(DIFFICULTY_NAMES[d], () => run({ type: 'restart', difficulty: d }), { pressed: d === now }))));
    },
    weather(info, out) {
      out.append(
        row(
          ...(['auto', 'rain', 'clear'] as const).map((w) =>
            btn(w === 'auto' ? 'Mission' : w === 'rain' ? 'Rain' : 'Clear', () => run({ type: 'weather', mode: w }), { pressed: info.weather === w }),
          ),
        ),
      );
      // The sim's scripted weather (visibility, aircraft, the blizzard), changed over 10 s.
      if (info.battle) out.append(row(...WEATHER_KINDS.map((k) => btn(k[0].toUpperCase() + k.slice(1), () => run({ type: 'sky', weather: k })))));
    },
    timeOfDay(info, out) {
      out.append(row(...ADMIN.timesOfDay.map((t) => btn(t.label, () => run({ type: 'timeOfDay', darkness: t.darkness }), { pressed: info.darkness === t.darkness }))));
      // The sim's time of day (night visibility, aircraft), changed over 10 s.
      if (info.battle) out.append(row(...TIMES_OF_DAY.map((t) => btn(t[0].toUpperCase() + t.slice(1), () => run({ type: 'sky', time: t })))));
    },

    // --- Units ----------------------------------------------------------------
    spawn(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const names = info.battle.names[spawnSide === 'mine' ? 0 : 1];
      const grid = el('div', 'th-admin-grid');
      for (const kind of UNIT_KINDS) {
        grid.append(btn(names[kind], () => ((spawnWhat = kind), render()), { pressed: spawnWhat === kind, testid: `admin-kind-${kind}` }));
      }
      for (const squad of ADMIN.squads) {
        grid.append(btn(squad.label, () => ((spawnWhat = squad.id), render()), { pressed: spawnWhat === squad.id, testid: `admin-kind-${squad.id}` }));
      }
      const spec: SpawnSpec = { what: spawnWhat, side: spawnSide, count: spawnCount };
      out.append(
        row(
          btn('Mine', () => ((spawnSide = 'mine'), render()), { pressed: spawnSide === 'mine', testid: 'admin-spawn-mine' }),
          btn('Enemy', () => ((spawnSide = 'enemy'), render()), { pressed: spawnSide === 'enemy', testid: 'admin-spawn-enemy' }),
          ...ADMIN.batches.map((n) => btn(`×${n}`, () => ((spawnCount = n), render()), { pressed: spawnCount === n, testid: `admin-batch-${n}` })),
        ),
        grid,
        row(
          btn(
            'Place on the field',
            () => {
              api.run({ type: 'place', spec });
              hooks.hide();
            },
            { wide: true, testid: 'admin-place' },
          ),
        ),
      );
    },
    fill(info, out) {
      if (!needBattle(info, out)) return;
      const kind: UnitKind = (UNIT_KINDS as readonly string[]).includes(spawnWhat) ? (spawnWhat as UnitKind) : ADMIN.fillKind;
      out.append(
        row(
          btn('Fill mine', () => run({ type: 'fill', side: 'mine', kind }), { testid: 'admin-fill-mine' }),
          btn('Fill enemy', () => run({ type: 'fill', side: 'enemy', kind }), { testid: 'admin-fill-enemy' }),
        ),
        note('With the kind picked under Spawn.'),
      );
    },
    pick(info, out) {
      if (!needBattle(info, out)) return;
      const s = info.selected;
      const pickBtn = btn(s ? 'Pick another' : 'Pick a unit', () => {
        api.run({ type: 'pick', on: true });
        hooks.hide();
      }, { testid: 'admin-pick' });
      if (!s) {
        out.append(row(pickBtn), note('Then tap a unit on the field, yours or the enemy’s.'));
        return;
      }
      out.append(
        row(el('span', 'th-admin-name', `${s.label} (${s.side === 'mine' ? 'mine' : 'enemy'}) ${s.hp}/${s.maxHp}`)),
        row(
          btn('Kill', () => run({ type: 'units', action: 'kill', target: 'selected' }), { danger: true, testid: 'admin-sel-kill' }),
          btn('Heal', () => run({ type: 'units', action: 'heal', target: 'selected' }), { testid: 'admin-sel-heal' }),
          btn('Invincible', () => run({ type: 'units', action: s.invincible ? 'mortal' : 'invincible', target: 'selected' }), { pressed: s.invincible, testid: 'admin-sel-god' }),
          s.side === 'enemy' ? btn('Take over', () => run({ type: 'takeOver', target: 'selected' }), { testid: 'admin-sel-take' }) : null,
        ),
        row(pickBtn),
      );
    },
    groups(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const god = info.battle.sideInvincible;
      for (const target of ['mine', 'enemy', 'all'] as const) {
        const on = target === 'all' ? god[0] && god[1] : god[target === 'mine' ? 0 : 1];
        out.append(
          row(
            el('span', 'th-admin-name', target === 'mine' ? 'Mine' : target === 'enemy' ? 'Enemy' : 'Everyone'),
            btn('Kill', () => run({ type: 'units', action: 'kill', target }), { danger: true, testid: `admin-kill-${target}` }),
            btn('Heal', () => run({ type: 'units', action: 'heal', target }), { testid: `admin-heal-${target}` }),
            btn('Invincible', () => run({ type: 'units', action: on ? 'mortal' : 'invincible', target }), { pressed: on, testid: `admin-god-${target}` }),
          ),
        );
      }
    },
    hq(info, out) {
      if (!needBattle(info, out) || !info.battle) return;
      const hq = info.battle.hqInvincible;
      out.append(
        row(
          btn('My HQ', () => run({ type: 'hqInvincible', side: 'mine', on: !hq[0] }), { pressed: hq[0], testid: 'admin-hq-mine' }),
          btn('Enemy HQ', () => run({ type: 'hqInvincible', side: 'enemy', on: !hq[1] }), { pressed: hq[1], testid: 'admin-hq-enemy' }),
        ),
      );
    },
    takeOver(info, out) {
      if (!needBattle(info, out)) return;
      out.append(row(btn('Take over every enemy unit', () => run({ type: 'takeOver', target: 'enemy' }), { testid: 'admin-take-all' })), note('They change sides where they stand.'));
    },

    // --- Speed ----------------------------------------------------------------
    speed(info, out) {
      out.append(
        row(
          ...ADMIN.timeScales.map((t) =>
            btn(t === 0 ? 'Pause' : `${t}×`, () => run({ type: 'speed', scale: t }), { pressed: info.timeScale === t, testid: `admin-speed-${t}` }),
          ),
        ),
        note('Pause freezes the battle; the panel still works on it.'),
      );
    },

    // --- Debug ----------------------------------------------------------------
    showFps(info, out) {
      out.append(row(btn('Show FPS', () => run({ type: 'showFps', on: !info.showFps }), { pressed: info.showFps, testid: 'admin-fps' })));
    },
    readout(info, out) {
      out.append(row(btn('Readout', () => run({ type: 'overlay', layer: 'readout', on: !info.overlays.readout }), { pressed: info.overlays.readout, testid: 'admin-readout' })));
    },
    overlays(info, out) {
      const layers: [OverlayLayer, string][] = [
        ['ranges', 'Weapon ranges'],
        ['hitboxes', 'Hitboxes'],
        ['points', 'Spawn and capture points'],
      ];
      out.append(row(...layers.map(([layer, label]) => btn(label, () => run({ type: 'overlay', layer, on: !info.overlays[layer] }), { pressed: info.overlays[layer], testid: `admin-layer-${layer}` }))));
    },
    revealHp(info, out) {
      if (!needBattle(info, out)) return;
      out.append(row(btn('Show enemy health', () => run({ type: 'revealHp', on: !info.hpRevealed }), { pressed: info.hpRevealed, testid: 'admin-reveal' })));
    },
  };

  function entry(def: AdminEntryDef, info: AdminInfo): HTMLElement {
    const section = el('section', 'th-admin-entry');
    section.dataset.entry = def.id;
    section.append(el('h3', 'th-admin-label', def.label));
    const build = builders[def.id];
    if (def.pending || !build) {
      section.classList.add('is-pending');
      section.append(note(def.pending ?? 'Not built yet.'));
      return section;
    }
    build(info, section);
    return section;
  }

  function render(): void {
    const info = api.info();
    const top = body.scrollTop;
    tabs.replaceChildren(
      ...ADMIN.tabs.map((t) => {
        const b = btn(t.label, () => showTab(t.id), { pressed: t.id === tab, testid: `admin-tab-${t.id}` });
        b.setAttribute('role', 'tab');
        return b;
      }),
    );
    const def = ADMIN.tabs.find((t) => t.id === tab) ?? ADMIN.tabs[0];
    if (def.id !== 'campaign') resetArmed = false;
    body.replaceChildren(...def.entries.map((e) => entry(e, info)));
    body.scrollTop = top;
    hooks.changed(info);
  }

  function showTab(next: AdminTabId): void {
    if (next !== tab) body.scrollTop = 0;
    tab = next;
    render();
  }

  return { el: root, render, showTab };
}
