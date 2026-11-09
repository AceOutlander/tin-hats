/**
 * The hidden admin panel's controller: the lock (adminLock.ts) and every action the panel offers, carried out on the
 * app, the battle (through BattleSession.admin, so it works paused or frozen) and the view. No DOM here: the panel
 * itself is src/ui/admin, and talks to this through AdminApi only.
 *
 * Nothing it does writes an invalid save: medals and upgrade levels go through the same clamps the game uses,
 * an import is checked by sanitizeSave before it replaces anything, unlocking missions is for this session only, and a
 * battle the panel ends is never recorded.
 */
import { ADMIN, type AdminSquadDef } from '../data/admin';
import { APP } from '../data/app';
import { DIFFICULTY_LIST } from '../data/difficulty';
import { FACTIONS } from '../data/factions';
import type { MissionEventDef, Side, UnitKind } from '../data/schema';
import { UNIT_KINDS } from '../data/units';
import { VIEW, VIEW_TOP_WU } from '../data/view';
import { maxLevel, sanitizeSave } from '../meta';
import type { BattleView } from '../render/contracts';
import type { AdminAction, UnitState } from '../sim';
import {
  MARK_EDGE,
  MARK_HQ,
  MARK_TRENCH,
  MARK_WAVE,
  type AdminApi,
  type AdminBattleInfo,
  type AdminCommand,
  type AdminDebugFrame,
  type AdminInfo,
  type AdminSelected,
  type AdminSide,
  type AdminTarget,
  type OverlayLayer,
  type SpawnSpec,
  type WeatherChoice,
} from '../ui/admin/contracts';
import type { UiApi } from '../ui/contracts';
import type { App } from './app';
import { AdminLock } from './adminLock';

const SIDE: Record<AdminSide, Side> = { mine: 0, enemy: 1 };

function sideOf(side: AdminSide): Side {
  return SIDE[side];
}

function isKind(what: string): what is UnitKind {
  return (UNIT_KINDS as readonly string[]).includes(what);
}

function squadOf(what: string): AdminSquadDef | undefined {
  return ADMIN.squads.find((s) => s.id === what);
}

/** A short line for a scripted event in the panel's list. */
function eventLabel(ev: MissionEventDef, index: number): string {
  const when = ev.when;
  const at = 'at' in when ? ` at ${when.at}s` : 'every' in when ? ` every ${when.every}s` : 'trenchCapturedBy' in when ? ` on trench ${when.trenchId}` : ' on HQ damage';
  const what =
    ev.type === 'wave' ? `Wave (${ev.side === 0 ? 'mine' : 'enemy'})` : ev.type === 'airdrop' ? `Airdrop (${ev.side === 0 ? 'mine' : 'enemy'})` : ev.type === 'hint' ? 'Hint' : 'Announcement';
  return `${index + 1}. ${what}${at}`;
}

/** Add one debug mark (CSS x, MARK_* kind, owning side or -1) while there is room. */
function mark(out: AdminDebugFrame, x: number, kind: number, owner: number): void {
  if (out.markCount * 3 + 3 > out.marks.length) return;
  const m = out.markCount * 3;
  out.marks[m] = x;
  out.marks[m + 1] = kind;
  out.marks[m + 2] = owner;
  out.markCount++;
}

export interface AdminDeps {
  app: App;
  view: BattleView;
  /** Shows a screen and refreshes the current one (the app's own UI). */
  ui: () => UiApi | null;
  /** The lock to use (tests give one with a test hash). */
  lock?: AdminLock;
}

export class AdminController implements AdminApi {
  readonly lockState: AdminLock;
  onChange: (() => void) | null = null;

  private readonly app: App;
  private readonly view: BattleView;
  private readonly ui: () => UiApi | null;
  private placing: SpawnSpec | null = null;
  private picking = false;
  private selectedId = -1;
  private readonly overlays: Record<OverlayLayer, boolean> = { readout: false, ranges: false, hitboxes: false, points: false };

  constructor(deps: AdminDeps) {
    this.app = deps.app;
    this.view = deps.view;
    this.ui = deps.ui;
    this.lockState = deps.lock ?? new AdminLock();
  }

  // --- the lock ------------------------------------------------------------

  helmetTap(): boolean {
    return this.lockState.tap();
  }

  submitCode(code: string): boolean {
    return this.lockState.submit(code);
  }

  isUnlocked(): boolean {
    return this.lockState.unlocked;
  }

  /** Lock again: the modes and the debug drawing stop. What was done in the battle stays done. */
  lock(): void {
    this.lockState.lock();
    this.placing = null;
    this.picking = false;
    this.selectedId = -1;
    for (const key of Object.keys(this.overlays) as OverlayLayer[]) this.overlays[key] = false;
    this.syncTaps();
  }

  /** The app showed another screen: a mode armed in the last battle ends with it. */
  screenChanged(): void {
    if (!this.app.session) {
      this.placing = null;
      this.picking = false;
      this.selectedId = -1;
      this.syncTaps();
    }
    this.onChange?.();
  }

  // --- what the panel shows -------------------------------------------------

  info(): AdminInfo {
    const app = this.app;
    return {
      medals: app.save.medals,
      missions: app.missions.map((m) => ({ id: m.id, title: m.title })),
      upgrades: app.upgradeDefs.map((d) => ({ id: d.id, name: d.name, level: app.save.upgrades[d.id] ?? 0, max: maxLevel(d) })),
      unlockedAll: app.missionsUnlocked,
      battle: this.battleInfo(),
      timeScale: app.loop.timeScale,
      weather: app.weatherMode,
      darkness: app.adminDarkness,
      showFps: app.save.settings.showFps,
      hpRevealed: app.session ? this.view.hpReveal.enemyShown() : false,
      overlays: { ...this.overlays },
      placing: this.placing ? { ...this.placing } : null,
      picking: this.picking,
      selected: this.selected(),
    };
  }

  private battleInfo(): AdminBattleInfo | null {
    const session = this.app.session;
    if (!session) return null;
    const s = session.battle.state;
    const [mine, enemy] = s.sides;
    return {
      missionTitle: session.mission.title,
      difficulty: session.difficulty,
      over: s.over,
      supplies: Math.floor(mine.supplies),
      frozen: mine.cheats.holdSupplies >= 0 && mine.cheats.holdSupplies !== ADMIN.infiniteSupplies,
      infinite: mine.cheats.holdSupplies === ADMIN.infiniteSupplies,
      instantTrain: mine.cheats.instantTrain,
      hqInvincible: [mine.cheats.hqInvincible, enemy.cheats.hqInvincible],
      sideInvincible: [mine.cheats.invincible, enemy.cheats.invincible],
      events: session.mission.events.map((ev, index) => ({ index, label: eventLabel(ev, index) })),
      names: [FACTIONS[mine.faction].unitNames, FACTIONS[enemy.faction].unitNames],
    };
  }

  private findUnit(id: number): UnitState | null {
    const session = this.app.session;
    if (!session || id < 0) return null;
    const s = session.battle.state;
    for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive && s.units[i].id === id) return s.units[i];
    return null;
  }

  private selected(): AdminSelected | null {
    const u = this.findUnit(this.selectedId);
    if (!u) return null;
    return {
      id: u.id,
      label: FACTIONS[u.faction].unitNames[u.kind],
      side: u.side === 0 ? 'mine' : 'enemy',
      hp: Math.ceil(u.hp),
      maxHp: Math.ceil(u.maxHp),
      invincible: u.invincible,
    };
  }

  // --- actions ---------------------------------------------------------------

  /** Apply a battle action now; 0 outside a battle. */
  private act(action: AdminAction): number {
    const session = this.app.session;
    return session ? session.admin(action) : 0;
  }

  run(command: AdminCommand): void {
    const app = this.app;
    switch (command.type) {
      case 'unlockMissions':
        app.adminUnlockMissions();
        break;
      case 'jump':
        if (DIFFICULTY_LIST.includes(command.difficulty)) app.beginMission(command.missionId, command.difficulty, undefined, true);
        break;
      case 'medals':
        app.giveMedals(command.amount);
        break;
      case 'upgrade': {
        const def = app.upgradeDefs.find((d) => d.id === command.id);
        if (!def) break;
        const level = Math.max(0, Math.min(maxLevel(def), Math.floor(command.level)));
        app.setUpgrades({ ...app.save.upgrades, [def.id]: level });
        break;
      }
      case 'resetSave':
        app.resetSave();
        this.ui()?.show('title');
        break;
      case 'addSupplies': {
        const session = app.session;
        if (session) this.act({ type: 'setSupplies', side: 0, amount: session.battle.state.sides[0].supplies + command.amount });
        break;
      }
      case 'setSupplies':
        this.act({ type: 'setSupplies', side: 0, amount: command.amount });
        break;
      case 'freezeSupplies': {
        const session = app.session;
        if (session) this.act({ type: 'holdSupplies', side: 0, amount: command.on ? session.battle.state.sides[0].supplies : null });
        break;
      }
      case 'infiniteSupplies':
        this.act({ type: 'holdSupplies', side: 0, amount: command.on ? ADMIN.infiniteSupplies : null });
        break;
      case 'instantTrain':
        this.act({ type: 'instantTrain', side: 0, on: command.on });
        break;
      case 'end':
        this.act({ type: 'end', winner: command.win ? 0 : 1 });
        // The result screen follows after a little battle time, so a frozen battle is let run again.
        if (app.loop.timeScale <= 0) app.loop.timeScale = 1;
        break;
      case 'fireEvent':
        this.act({ type: 'fireEvent', index: command.index });
        break;
      case 'restart':
        if (DIFFICULTY_LIST.includes(command.difficulty)) app.restartOn(command.difficulty);
        break;
      case 'weather':
        this.setWeather(command.mode);
        break;
      case 'timeOfDay':
        app.adminDarkness = command.darkness === null ? null : Math.min(1, Math.max(0, command.darkness));
        break;
      case 'place':
        this.placing = command.spec && app.session ? { ...command.spec } : null;
        if (this.placing) this.picking = false;
        this.syncTaps();
        break;
      case 'pick':
        this.picking = command.on && app.session !== null;
        if (this.picking) this.placing = null;
        this.syncTaps();
        break;
      case 'units':
        this.unitAction(command.action, command.target);
        break;
      case 'hqInvincible':
        this.act({ type: 'hqInvincible', side: sideOf(command.side), on: command.on });
        break;
      case 'takeOver':
        if (command.target === 'enemy') this.act({ type: 'takeOver', side: 0 });
        else if (this.findUnit(this.selectedId)?.side === 1) {
          this.act({ type: 'takeOver', side: 0, unit: this.selectedId });
          this.selectedId = -1;
        }
        break;
      case 'fill':
        this.act({ type: 'fillArmy', side: sideOf(command.side), kind: command.kind });
        break;
      case 'speed':
        app.loop.timeScale = Number.isFinite(command.scale) ? Math.min(Math.max(command.scale, 0), APP.maxTimeScale) : 1;
        break;
      case 'showFps':
        app.setSetting('showFps', command.on);
        break;
      case 'overlay':
        this.overlays[command.layer] = command.on;
        break;
      case 'revealHp':
        this.view.hpReveal.setEnemyShown(command.on);
        break;
    }
  }

  private setWeather(mode: WeatherChoice): void {
    this.app.weatherMode = mode;
    if (mode !== 'auto' && this.app.session) this.view.forceWeather(mode);
  }

  private unitAction(action: 'kill' | 'heal' | 'invincible' | 'mortal', target: AdminTarget): void {
    let side: Side | -1 = -1;
    let unit: number | undefined;
    if (target === 'selected') {
      if (!this.findUnit(this.selectedId)) return;
      unit = this.selectedId;
    } else if (target !== 'all') {
      side = sideOf(target);
    }
    if (action === 'kill') this.act({ type: 'kill', side, unit });
    else if (action === 'heal') this.act({ type: 'heal', side, unit });
    else this.act({ type: 'invincible', side, unit, on: action === 'invincible' });
  }

  /** Battlefield taps go to the panel while a mode is armed. */
  private syncTaps(): void {
    this.app.adminTaps = this.placing || this.picking ? { ground: (x) => this.tapGround(x), unit: (id) => this.tapUnit(id) } : null;
  }

  private tapGround(x: number): boolean {
    if (this.placing) {
      this.spawnAt(this.placing, x);
      this.onChange?.();
      return true;
    }
    if (this.picking) {
      this.selectNear(x);
      return true;
    }
    return false;
  }

  private tapUnit(id: number): boolean {
    const u = this.findUnit(id);
    if (!u) return false;
    if (this.placing) return this.tapGround(u.x);
    if (!this.picking) return false;
    this.selectedId = id;
    this.picking = false;
    this.syncTaps();
    this.onChange?.();
    return true;
  }

  /** The nearest unit on the field (either side) to world x, within ADMIN.pickRadiusWu. */
  private selectNear(x: number): void {
    const session = this.app.session;
    if (!session) return;
    const s = session.battle.state;
    let best = -1;
    let bestD = ADMIN.pickRadiusWu;
    for (let i = 0; i < s.unitCount; i++) {
      const u = s.units[i];
      if (!u.alive || u.inside) continue;
      const d = Math.abs(u.x - x);
      if (d <= bestD) {
        bestD = d;
        best = u.id;
      }
    }
    if (best < 0) return;
    this.selectedId = best;
    this.picking = false;
    this.syncTaps();
    this.onChange?.();
  }

  /** One spawn tap: `spec.count` units, or squads, for its side at world x. */
  spawnAt(spec: SpawnSpec, x: number): number {
    const side = sideOf(spec.side);
    const count = Math.max(1, Math.floor(spec.count));
    if (isKind(spec.what)) return this.act({ type: 'spawn', side, kind: spec.what, x, count });
    const squad = squadOf(spec.what);
    if (!squad) return 0;
    const dir = side === 0 ? 1 : -1;
    let n = 0;
    for (const m of squad.members) {
      n += this.act({ type: 'spawn', side, kind: m.kind, x: x - dir * (m.behind ?? 0), count: m.count * count, veteran: m.veteran === true });
    }
    return n;
  }

  // --- save ----------------------------------------------------------------

  exportSave(): string {
    return JSON.stringify(this.app.save);
  }

  importSave(text: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return false;
    }
    const data = sanitizeSave(parsed, { missionIds: this.app.missions.map((m) => m.id), upgradeDefs: this.app.upgradeDefs });
    if (!data) return false;
    this.app.replaceSave(data);
    return true;
  }

  // --- debug view ----------------------------------------------------------

  /** True while a battlefield layer of the debug view is on (the panel then draws a frame each animation frame). */
  get drawing(): boolean {
    return this.overlays.ranges || this.overlays.hitboxes || this.overlays.points;
  }

  debugFrame(out: AdminDebugFrame): boolean {
    const session = this.app.session;
    if (!session) return false;
    const camera = this.view.camera;
    const stats = this.view.getStats();
    const k = stats.canvasW / Math.max(1, stats.dpr) / camera.viewWidthWu;
    const left = camera.centerX - camera.viewWidthWu / 2;
    const width = camera.viewWidthWu * k;
    const s = session.battle.state;
    out.groundY = (VIEW.groundY - VIEW_TOP_WU) * k;
    out.boxCount = 0;
    out.rangeCount = 0;
    out.markCount = 0;
    const boxes = this.overlays.hitboxes;
    const ranges = this.overlays.ranges;
    for (let i = 0; i < s.unitCount && (boxes || ranges); i++) {
      const u = s.units[i];
      if (!u.alive || u.inside) continue;
      const cx = (u.x - left) * k;
      if (cx < -u.def.width * k || cx > width + u.def.width * k) continue;
      const row = Math.max(0, Math.min(VIEW.rows - 1, u.row));
      const feet = (VIEW.groundY + VIEW.rowDy[row] - VIEW_TOP_WU) * k;
      const tall = (u.def.class === 'vehicle' ? u.def.width * ADMIN.debug.vehicleHeight : VIEW.figureHeight * VIEW.rowScale[row]) * k;
      if (boxes && out.boxCount * 4 + 4 <= out.boxes.length) {
        const b = out.boxCount * 4;
        out.boxes[b] = cx - (u.def.width * k) / 2;
        out.boxes[b + 1] = feet - tall;
        out.boxes[b + 2] = u.def.width * k;
        out.boxes[b + 3] = tall;
        out.boxSide[out.boxCount] = u.side;
        out.boxCount++;
      }
      const weapon = u.mount.weapon;
      if (ranges && weapon && out.rangeCount * 4 + 4 <= out.ranges.length) {
        const r = out.rangeCount * 4;
        out.ranges[r] = cx;
        out.ranges[r + 1] = (u.x + u.facing * weapon.range - left) * k;
        out.ranges[r + 2] = feet - tall * 0.6;
        out.ranges[r + 3] = u.side;
        out.rangeCount++;
      }
    }
    if (this.overlays.points) {
      for (let si = 0; si < 2; si++) {
        const hq = s.sides[si].hq;
        if (hq) mark(out, (hq.doorX - left) * k, MARK_HQ, si);
        else mark(out, ((si === 0 ? 0 : s.length) - left) * k, MARK_EDGE, si);
      }
      for (const t of s.trenches) mark(out, (t.x - left) * k, MARK_TRENCH, t.owner);
      for (const ev of session.mission.events) {
        if (ev.type !== 'wave') continue;
        for (const f of ev.forces) if (f.x !== undefined) mark(out, (f.x - left) * k, MARK_WAVE, ev.side);
      }
    }
    return true;
  }

  readout(): string {
    const session = this.app.session;
    if (!session) return 'No battle';
    const s = session.battle.state;
    const lines: string[] = [];
    const fps = this.view.getStats().fps;
    lines.push(`FPS ${Math.round(fps)}  tick ${s.tick}  t ${s.time.toFixed(1)}s  x${this.app.loop.timeScale}`);
    for (let si = 0; si < 2; si++) {
      const side = s.sides[si];
      const counts = UNIT_KINDS.filter((kind) => side.alive[kind] > 0)
        .map((kind) => `${kind} ${side.alive[kind]}`)
        .join(', ');
      const hq = side.hq ? `HQ ${Math.ceil(Math.max(0, side.hq.hp))}/${Math.ceil(side.hq.maxHp)}` : 'no HQ';
      lines.push(`${si === 0 ? 'Mine' : 'Enemy'}: pop ${side.pop}/${side.popCap}, order ${side.order}, ${hq}`);
      lines.push(`  ${counts || 'no units'}`);
      const ai = session.battle.inspectAi(si as Side);
      if (ai) {
        const wants = Object.entries(ai.wants)
          .map(([kind, n]) => `${kind} ${n}`)
          .join(', ');
        const contact = ai.sinceContact < 0 ? 'no contact' : `contact ${ai.sinceContact.toFixed(0)}s`;
        lines.push(`  AI (${ai.commander}) aggression ${ai.aggression}, order ${ai.order} for ${ai.sinceOrder.toFixed(0)}s, ${contact}, first attack after ${ai.firstAttackAfter}s`);
        lines.push(`  plan wants: ${wants || 'nothing'}`);
      }
    }
    const spawn = s.sides.map((side, si) => (side.hq ? `${si === 0 ? 'mine' : 'enemy'} HQ door ${Math.round(side.hq.doorX)}` : `${si === 0 ? 'mine' : 'enemy'} edge`)).join(', ');
    lines.push(`Spawn: ${spawn}`);
    const trenches = s.trenches.map((t) => `${t.id}@${Math.round(t.x)} ${t.owner === 0 ? 'mine' : t.owner === 1 ? 'enemy' : 'empty'}`).join(', ');
    lines.push(`Capture points: ${trenches || 'none'}`);
    return lines.join('\n');
  }
}
