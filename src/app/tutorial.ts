/**
 * The tutorial driver: decides which guided tip is on screen, from the battle
 * and from what the player has done. The steps are data (src/data/tutorial.ts).
 *
 * One tip at a time. A step starts once the steps it follows have ended and its
 * conditions hold, and ends when the player does the thing or its time runs out
 * (or the player closes it). In a campaign mission an ended tip is remembered for
 * good, so it never comes back. Basic Training (its own mission) runs its whole
 * course every time it is played, whatever the hints setting, and remembers
 * nothing. Nothing here pauses or blocks the battle.
 *
 * Plain TypeScript with no DOM: runs in unit tests with a real battle.
 */
import type { MissionDef, Order, SupportKind, UnitKind } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { MEDALS } from '../data/medals';
import { TUTORIAL, type TutorialCond, type TutorialStep } from '../data/tutorial';
import { UNIT_KINDS, UNITS } from '../data/units';
import type { StorageLike } from '../meta';
import type { Battle, SimEvent } from '../sim';
import type { HudAction, HudState, TipState } from '../ui/contracts';

const ID_PATTERN = /^[A-Za-z0-9:_-]{1,48}$/;
const ORDERS: readonly Order[] = ['fallBack', 'hold', 'advance'];
/** Counts every tip ever started, so a new battle's first tip never looks like the last battle's. */
let tipCounter = 0;

/** The ids of the tips that have ended, kept under their own storage key so the save format is untouched. */
export class TipMemory {
  private readonly ids = new Set<string>();

  constructor(private readonly storage: StorageLike | null) {
    let text: string | null;
    try {
      text = storage ? storage.getItem(TUTORIAL.storageKey) : null;
    } catch {
      text = null;
    }
    if (text === null) return;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) return;
      for (const id of parsed) {
        if (typeof id === 'string' && ID_PATTERN.test(id) && this.ids.size < TUTORIAL.maxRemembered) this.ids.add(id);
      }
    } catch {
      // A damaged entry is the same as none: the tips simply come round again.
    }
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    if (this.ids.has(id) || this.ids.size >= TUTORIAL.maxRemembered) return;
    this.ids.add(id);
    this.write();
  }

  clear(): void {
    this.ids.clear();
    try {
      if (this.storage) this.storage.removeItem(TUTORIAL.storageKey);
    } catch {
      // Nothing to do: a store that refuses to delete cannot be fixed from here.
    }
  }

  private write(): void {
    try {
      if (this.storage) this.storage.setItem(TUTORIAL.storageKey, JSON.stringify([...this.ids]));
    } catch {
      // Full or private storage: the tips are remembered for this page only.
    }
  }
}

function countRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of keys) out[key] = 0;
  return out;
}

/**
 * Basic Training's course as it can be taught today: steps that need an engine feature not built yet are left out,
 * and a step that follows one of those follows the steps before it instead.
 */
export function trainingSteps(): TutorialStep[] {
  const offered = TUTORIAL.steps.filter((s) => s.needs === undefined || TUTORIAL.features[s.needs]);
  const ids = new Set(offered.map((s) => s.id));
  return offered.map((s) => (s.after === undefined ? s : { ...s, after: s.after.filter((id) => ids.has(id)) }));
}

/** True for the Basic Training mission. */
export function isTraining(mission: MissionDef): boolean {
  return mission.id === TUTORIAL.trainingMission;
}

/** The steps a mission offers: Basic Training's course, or a tip for each new unit and support of a campaign mission. */
export function stepsFor(mission: MissionDef): TutorialStep[] {
  if (isTraining(mission)) return trainingSteps();
  const out: TutorialStep[] = [];
  const unit = mission.newUnit;
  const unitTip = unit !== null ? TUTORIAL.newUnit.tips[unit] : undefined;
  if (unit !== null && unitTip !== undefined && mission.units[0].includes(unit)) {
    out.push({
      id: `new-unit-${unit}`,
      text: unitTip.text,
      target: `train-${unit}`,
      when: [{ t: 'time', min: TUTORIAL.newUnit.startAfter }],
      done: [{ t: 'trained', kind: unit, min: 1 }],
      seconds: TUTORIAL.newUnit.seconds,
    });
  }
  const support = mission.newSupport;
  if (support !== null && mission.supports[0].includes(support)) {
    out.push({
      id: `new-support-${support}`,
      text: TUTORIAL.newSupport.tips[support].text,
      target: `support-${support}`,
      // Behind the unit tip when a mission brings both.
      after: unit !== null && unitTip !== undefined ? [`new-unit-${unit}`] : undefined,
      when: [{ t: 'time', min: TUTORIAL.newSupport.startAfter }],
      done: [{ t: 'called', support, min: 1 }],
      seconds: TUTORIAL.newSupport.seconds,
    });
  }
  return out;
}

/** A step with the button it points at worked out once, so the per-frame checks never build a string. */
interface Compiled {
  def: TutorialStep;
  unit: UnitKind | null;
  support: SupportKind | null;
}

function compile(def: TutorialStep): Compiled {
  const unit = UNIT_KINDS.find((kind) => def.target === `train-${kind}`) ?? null;
  const support = SUPPORT_KINDS.find((kind) => def.target === `support-${kind}`) ?? null;
  return { def, unit, support };
}

export class Tutorial {
  /** What the HUD shows: the one tip object, or null. */
  tip: TipState | null = null;
  /** True when the mission's own scripted `hint` events are replaced by the guided steps. */
  readonly replacesScriptedHints: boolean;
  /** Basic Training: every step runs every time, whatever the hints setting, and nothing is remembered. */
  readonly course: boolean;

  private readonly steps: Compiled[];
  private readonly shown: TipState = { seq: 0, text: '', target: 'field' };
  private active: Compiled | null = null;
  private activeSince = 0;
  private lastEnd = -Infinity;
  private nextEval = 0;
  private readonly seen = new Set<string>();

  // What the player has done.
  private readonly trained = countRecord<UnitKind>(UNIT_KINDS);
  private readonly ordered = countRecord<Order>(ORDERS);
  private readonly called = countRecord<SupportKind>(SUPPORT_KINDS);
  private kindOrders = 0;
  /** Build sites the player has placed (prep phase), and whether the prep phase is over. */
  private placed = 0;
  private prepOver = false;
  private pans = 0;
  private controls = 0;
  private wasDragging = false;
  private wasControlling = false;

  // What the battle looks like.
  private army = 0;
  private armyPeak = 0;
  private threat = false;
  private time = 0;
  private supplies = 0;
  private armyOrder: Order = 'hold';
  private entrenched = 0;
  private trenches = 0;

  constructor(
    mission: MissionDef,
    private readonly memory: TipMemory,
  ) {
    this.replacesScriptedHints = TUTORIAL.replacesScriptedHints.includes(mission.id);
    this.course = isTraining(mission);
    this.steps = stepsFor(mission).map(compile);
    if (!this.course) for (const step of this.steps) if (memory.has(step.def.id)) this.seen.add(step.def.id);
  }

  /**
   * True once the last step of this battle has ended and no tip is up (Basic Training: the course is through). Steps
   * that come up only on condition (the urgent Fall Back, steering a unit the player never took) may never have shown.
   */
  get finished(): boolean {
    const last = this.steps.length > 0 ? this.steps[this.steps.length - 1] : null;
    return this.active === null && (last === null || this.seen.has(last.def.id));
  }

  /** How many steps this battle offers, and how many have ended (for the debug hooks). */
  get progress(): { done: number; total: number } {
    let done = 0;
    for (let i = 0; i < this.steps.length; i++) if (this.seen.has(this.steps[i].def.id)) done++;
    return { done, total: this.steps.length };
  }

  /** The id of the step on screen, or null. */
  get activeId(): string | null {
    return this.active === null ? null : this.active.def.id;
  }

  /** An event of the last sim step. */
  note(e: SimEvent): void {
    if (e.type === 'prepEnded') this.prepOver = true;
    if (e.side !== 0) return;
    if (e.type === 'trainStarted' && e.kind !== null) this.trained[e.kind]++;
    else if (e.type === 'supportCalled' && e.support !== null) this.called[e.support]++;
    else if (e.type === 'buildStarted') this.placed++;
  }

  /** The player did something on the HUD. */
  noteAction(action: HudAction): void {
    if (action.type === 'order') {
      if (action.kind === undefined) this.ordered[action.order]++;
      else this.kindOrders++;
    }
    else if (action.type === 'minimap') this.pans++;
    else if (action.type === 'dismissTip') this.dismiss();
  }

  /** The player closed the tip on screen: it counts as seen. */
  dismiss(): void {
    if (this.active !== null) this.finish(this.active);
  }

  /**
   * Once per rendered frame. `dragging` = a finger is dragging the battlefield view; `hintsOn` = the hints setting.
   * Writes the tip into `hud.tip`.
   */
  update(battle: Battle, dragging: boolean, hintsOn: boolean, hud: HudState): void {
    const state = battle.state;
    this.time = state.time;
    if (dragging && !this.wasDragging) this.pans++;
    this.wasDragging = dragging;
    const controlling = state.sides[0].controlled >= 0;
    if (controlling && !this.wasControlling) this.controls++;
    this.wasControlling = controlling;

    if (!hintsOn && !this.course) {
      // Switched off: nothing is shown, and nothing is used up.
      this.active = null;
      this.tip = null;
      hud.tip = null;
      return;
    }
    if (state.time >= this.nextEval) {
      this.nextEval = state.time + TUTORIAL.evalSeconds;
      this.look(battle);
      this.advance(hud);
    }
    hud.tip = this.tip;
  }

  // ---- the logic ---------------------------------------------------------------------------------------------------

  /** Refresh the few facts that are read off the battle. */
  private look(battle: Battle): void {
    const state = battle.state;
    const me = state.sides[0];
    this.supplies = me.supplies;
    this.armyOrder = me.order;
    let army = 0;
    for (let i = 0; i < UNIT_KINDS.length; i++) {
      const kind = UNIT_KINDS[i];
      if (UNITS[kind].armed) army += me.alive[kind];
    }
    this.army = army;
    if (army > this.armyPeak) this.armyPeak = army;

    let entrenched = 0;
    for (let i = 0; i < state.unitCount; i++) {
      const u = state.units[i];
      if (u.alive && u.side === 0 && u.trenchId >= 0) entrenched++;
    }
    this.entrenched = entrenched;
    let trenches = 0;
    for (let i = 0; i < state.trenches.length; i++) if (state.trenches[i].owner === 0) trenches++;
    this.trenches = trenches;

    const hq = me.hq;
    let threat = false;
    if (hq !== null && hq.maxHp > 0) {
      threat = hq.hp < hq.maxHp * TUTORIAL.threatHqFrac;
      for (let i = 0; i < state.unitCount && !threat; i++) {
        const u = state.units[i];
        if (u.alive && u.side === 1 && !u.inside && Math.abs(u.x - hq.x) < TUTORIAL.threatRange) threat = true;
      }
    }
    this.threat = threat;
  }

  private advance(hud: HudState): void {
    const active = this.active;
    if (active !== null) {
      if (active.def.done.length > 0 && this.holdsAll(active.def.done)) {
        this.finish(active);
      } else if (this.time - this.activeSince >= active.def.seconds) {
        this.finish(active);
      } else {
        // An urgent step (the HQ is in danger) may cut in; the tip it cuts comes back later.
        if (active.def.urgent !== true) {
          const urgent = this.pick(hud, true);
          if (urgent !== null) this.start(urgent, hud);
        }
        return;
      }
    }
    if (this.time - this.lastEnd >= TUTORIAL.gapSeconds) {
      const next = this.pick(hud, false);
      if (next !== null) this.start(next, hud);
    }
  }

  /** The first step, in list order, that is ready to start. Steps the player has already done are marked seen. */
  private pick(hud: HudState, urgentOnly: boolean): Compiled | null {
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      if (this.seen.has(step.def.id) || step === this.active) continue;
      if (urgentOnly && step.def.urgent !== true) continue;
      if (!this.ready(step, hud)) continue;
      if (step.def.done.length > 0 && this.holdsAll(step.def.done)) {
        this.markSeen(step.def.id);
        continue;
      }
      return step;
    }
    return null;
  }

  private ready(step: Compiled, hud: HudState): boolean {
    const after = step.def.after;
    if (after !== undefined) {
      for (let i = 0; i < after.length; i++) if (!this.seen.has(after[i])) return false;
    }
    // A step that points at a button this mission does not have cannot be shown.
    if (step.unit !== null && this.trainButton(hud, step.unit) === null) return false;
    if (step.support !== null && this.supportButton(hud, step.support) === null) return false;
    return this.holdsAll(step.def.when);
  }

  private trainButton(hud: HudState, kind: UnitKind): string | null {
    for (let i = 0; i < hud.train.length; i++) if (hud.train[i].kind === kind) return hud.train[i].name;
    return null;
  }

  private supportButton(hud: HudState, kind: SupportKind): string | null {
    for (let i = 0; i < hud.supports.length; i++) if (hud.supports[i].kind === kind) return hud.supports[i].name;
    return null;
  }

  private start(step: Compiled, hud: HudState): void {
    this.active = step;
    this.activeSince = this.time;
    const shown = this.shown;
    shown.seq = ++tipCounter;
    shown.text = this.fill(step, hud);
    shown.target = step.def.target;
    this.tip = shown;
  }

  /** Put the faction's own name for the unit or support, and Basic Training's reward, into the text. */
  private fill(step: Compiled, hud: HudState): string {
    let text = step.def.text;
    if (text.includes('{reward}')) text = text.replace('{reward}', String(MEDALS.trainingReward));
    if (!text.includes('{name}')) return text;
    const name = step.unit !== null ? this.trainButton(hud, step.unit) : step.support !== null ? this.supportButton(hud, step.support) : null;
    return text.replace('{name}', name ?? '');
  }

  private finish(step: Compiled): void {
    this.markSeen(step.def.id);
    if (this.active === step) {
      this.active = null;
      this.tip = null;
    }
    this.lastEnd = this.time;
  }

  private markSeen(id: string): void {
    this.seen.add(id);
    if (!this.course) this.memory.add(id);
  }

  private holdsAll(conds: readonly TutorialCond[]): boolean {
    for (let i = 0; i < conds.length; i++) if (!this.holds(conds[i])) return false;
    return true;
  }

  private holds(c: TutorialCond): boolean {
    switch (c.t) {
      case 'time':
        return this.time >= c.min;
      case 'idle':
        return this.time - this.lastEnd >= c.min;
      case 'supplies':
        return this.supplies >= c.min;
      case 'trained':
        return this.trained[c.kind] >= c.min;
      case 'army':
        return this.army >= c.min;
      case 'ordered':
        return this.ordered[c.order] >= c.min;
      case 'armyOrder':
        return this.armyOrder === c.order;
      case 'placed':
        return this.placed >= c.min;
      case 'prepOver':
        return this.prepOver;
      case 'kindOrdered':
        return this.kindOrders >= c.min;
      case 'entrenched':
        return this.entrenched >= c.min;
      case 'trenches':
        return this.trenches >= c.min;
      case 'called':
        return this.called[c.support] >= c.min;
      case 'threat':
        return this.threat;
      case 'beaten':
        return this.armyPeak >= TUTORIAL.beaten.minPeak && this.army <= this.armyPeak * TUTORIAL.beaten.frac;
      case 'panned':
        return this.pans > 0;
      case 'controlled':
        return this.controls > 0;
      case 'controlling':
        return this.wasControlling;
      case 'released':
        return this.controls > 0 && !this.wasControlling;
      case 'any':
        for (let i = 0; i < c.of.length; i++) if (this.holds(c.of[i])) return true;
        return false;
      case 'all':
        return this.holdsAll(c.of);
    }
  }
}
