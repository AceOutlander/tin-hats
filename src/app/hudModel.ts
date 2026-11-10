/**
 * Builds the HudState the DOM HUD polls every frame. One state object is
 * created per battle and refreshed in place: refresh() writes numbers into
 * existing objects and typed arrays and allocates nothing.
 */
import { APP } from '../data/app';
import { CONFIG } from '../data/config';
import { missionEra, resolveEra, unitDisplayName, type ResolvedEra } from '../data/eras';
import { FACTIONS } from '../data/factions';
import { GROUND_MINIMAP, groundArt } from '../data/ground';
import { PREP } from '../data/prep';
import type { Side } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { THEATRES } from '../data/theatres';
import { UNITS, UNIT_KINDS } from '../data/units';
import { DEPLOY_AUTO, DEPLOY_HQ, airGrounded, orderCost, orderPop, type Battle, type BattleState, type ObjectiveState } from '../sim';
import type { ControlState, HudState, MinimapState, PrepHudState, SupportButtonState, TrainButtonState } from '../ui/contracts';

/** Whose unit health the player may see (the battle view's HpReveal). */
export interface HpShownQuery {
  shows(side: Side, x: number): boolean;
}

interface HqDot {
  x: number;
  hp: number;
}

function emptyMinimap(unitSlots: number): MinimapState {
  return {
    length: 1,
    camX: 0,
    camW: 1,
    hq: [null, null],
    trenchX: new Float32Array(0),
    trenchW: new Float32Array(0),
    trenchOwner: new Int8Array(0),
    trenchCount: 0,
    pillboxX: new Float32Array(0),
    pillboxSide: new Int8Array(0),
    pillboxCount: 0,
    unitX: new Float32Array(unitSlots),
    unitSide: new Int8Array(unitSlots),
    unitBig: new Int8Array(unitSlots),
    unitCount: 0,
    colors: ['#8c7b4a', '#5d6964'],
  };
}

export class HudModel {
  readonly state: HudState;
  private readonly timer = { label: '', secondsLeft: 0, urgent: false };
  private readonly control: ControlState = {
    kind: 'rifle',
    name: '',
    hp: 0,
    maxHp: 1,
    hpShown: true,
    reload: 1,
    hasAbility: false,
    abilityName: '',
    abilityCharge: 1,
  };
  private readonly hqDots: [HqDot, HqDot] = [
    { x: 0, hp: 1 },
    { x: 0, hp: 1 },
  ];
  /** The player's nation in this battle's era (src/data/eras.ts): the names on the buttons and the unit card. */
  private era: ResolvedEra = resolveEra('british', null);

  constructor() {
    this.state = {
      supplies: 0,
      incomePerSec: 0,
      pop: 0,
      popCap: CONFIG.popCap,
      order: 'hold',
      train: [],
      supports: [],
      targeting: null,
      control: null,
      timer: null,
      objective: '',
      hqHp: 1,
      hqMaxHp: 1,
      enemyHqHp: null,
      enemyHqMaxHp: 1,
      paused: false,
      muted: false,
      banner: null,
      bannerSeq: 0,
      hint: null,
      tip: null,
      minimap: emptyMinimap(CONFIG.maxUnits),
      fps: null,
      prep: null,
    };
  }

  /** A new battle: the player's buttons, the objective text and the minimap's fixed parts. Allocates. */
  /** The prep phase panel of this battle (reused every frame), or null for a mission without one. */
  private prepPanel: PrepHudState | null = null;
  /** The sim's prep state the panel was made for: a phase's own prep phase (FOUNDATIONS.md 7.3) gets a new panel. */
  private prepSource: BattleState['prep'] = null;
  /** The call-ins offered when the buttons were made (a `support` event offers or withdraws one mid-battle). */
  private supportsKey = -1;
  /** What the phase line was made from (phase, objective, shown progress), so it is rebuilt only when that changes. */
  private phaseKey = -1;
  private sideKey = '';
  /** The "Deploy at" chip (reused) and what it was last made from. */
  private readonly deployChip = { label: '', place: '', front: false, closed: false };
  private deployKey = -9;
  /** The "Clear" chip (reused). */
  private readonly clearChip = { label: '', x: 0, busy: false };

  private makePrepPanel(prep: BattleState['prep']): void {
    this.prepSource = prep;
    this.prepPanel = prep
      ? {
          secondsLeft: prep.secondsLeft,
          builds: prep.buildables.map((id) => {
            const b = PREP.buildables[id];
            return { id, name: b.name, cost: b.cost, seconds: b.seconds, canAfford: false };
          }),
          placing: null,
          placeOk: false,
          sites: 0,
        }
      : null;
  }

  /** The support buttons for the call-ins the player is offered now. */
  private makeSupports(me: BattleState['sides'][0]): void {
    const st = this.state;
    st.supports = [];
    let key = 0;
    for (let k = 0; k < SUPPORT_KINDS.length; k++) {
      const kind = SUPPORT_KINDS[k];
      if (!me.supportAvailable[kind]) continue;
      key |= 1 << k;
      const btn: SupportButtonState = { kind, name: this.era.supportNames[kind], charge: 1, secondsLeft: 0, grounded: null, charges: -1 };
      st.supports.push(btn);
    }
    this.supportsKey = key;
  }

  private supportsNow(me: BattleState['sides'][0]): number {
    let key = 0;
    for (let k = 0; k < SUPPORT_KINDS.length; k++) if (me.supportAvailable[SUPPORT_KINDS[k]]) key |= 1 << k;
    return key;
  }

  begin(battle: Battle): void {
    this.makePrepPanel(battle.state.prep);
    this.phaseKey = -1;
    this.sideKey = '';
    const s = battle.state;
    const st = this.state;
    const me = s.sides[0];
    // Names by the mission's date (src/data/eras.ts): the PPD Trooper in 1941, the PPSh Trooper in 1942.
    const era = missionEra(battle.config.mission, me.faction);
    this.era = era;

    st.train = [];
    if (me.hasHq) {
      for (const kind of UNIT_KINDS) {
        if (!me.available[kind] || !UNITS[kind].trainable) continue;
        const btn: TrainButtonState = {
          kind,
          name: era.names[kind],
          label: era.buttonNames[kind] ?? era.names[kind],
          // Per training order: a squad kind (Soviet conscripts) costs and takes room for the whole squad.
          cost: orderCost(kind),
          pop: orderPop(kind),
          queued: 0,
          progress: 0,
          fielded: 0,
          affordable: false,
          ownOrder: null,
        };
        st.train.push(btn);
      }
    }

    this.makeSupports(me);

    st.targeting = null;
    st.phaseLine = null;
    st.sideObjectives = [];
    st.control = null;
    st.timer = null;
    st.objective = battle.config.mission.objective;
    st.popCap = me.popCap;
    st.paused = false;
    st.banner = null;
    st.bannerSeq = 0;
    st.hint = null;
    st.tip = null;

    const m = st.minimap;
    m.length = s.length;
    m.trenchX = new Float32Array(s.trenches.length);
    m.trenchW = new Float32Array(s.trenches.length);
    m.trenchOwner = new Int8Array(s.trenches.length);
    m.pillboxX = new Float32Array(s.pillboxes.length);
    m.pillboxSide = new Int8Array(s.pillboxes.length);
    m.colors = [FACTIONS[s.sides[0].faction].look.tint, FACTIONS[s.sides[1].faction].look.tint];
    // The ground by sector, shaded as it is drawn (FOUNDATIONS.md 4.1), and the capture points.
    const mission = battle.config.mission;
    const sectors = mission.sectors ?? [];
    const theatreStyle = THEATRES[mission.theatre].groundStyle;
    m.sectorFrom = new Float32Array(sectors.map((sec) => sec.from));
    m.sectorTo = new Float32Array(sectors.map((sec) => sec.to));
    m.sectorColor = sectors.map((sec) => GROUND_MINIMAP[groundArt(sec.ground, theatreStyle, mission.climate === 'winter')]);
    m.pointX = new Float32Array(s.points.map((p) => p.x));
    m.pointOwner = new Int8Array(s.points.length);
    m.pointCount = s.points.length;
    this.deployKey = -9;
    st.deploy = deployOptions(s).length > 2 ? this.deployChip : null;
    m.hq = [null, null];
    if (m.unitX.length < s.units.length) {
      m.unitX = new Float32Array(s.units.length);
      m.unitSide = new Int8Array(s.units.length);
      m.unitBig = new Int8Array(s.units.length);
    }
  }

  /**
   * Once per rendered frame. `camCenterX` and `camViewW` are the camera's view in wu. `hp` says whose unit health
   * the player sees (without it, only the player's own side's).
   */
  refresh(battle: Battle, camCenterX: number, camViewW: number, hp: HpShownQuery | null = null): void {
    const s = battle.state;
    const st = this.state;
    const me = s.sides[0];
    const foe = s.sides[1];

    st.supplies = me.supplies;
    st.incomePerSec = me.income;
    st.pop = me.pop;
    st.popCap = me.popCap;
    st.order = me.order;
    if (s.prep !== this.prepSource) this.makePrepPanel(s.prep);
    st.prep = fillPrep(this.prepPanel, s, me.supplies);
    if (this.supportsNow(me) !== this.supportsKey) this.makeSupports(me);

    const train = st.train;
    for (let i = 0; i < train.length; i++) {
      const t = train[i];
      const queued = me.queue[t.kind];
      t.queued = queued;
      t.progress = me.progress[t.kind];
      t.fielded = me.alive[t.kind];
      t.ownOrder = me.kindOrders[t.kind];
      // Room kept for scripted reinforcements waiting at the HQ counts as taken (sim canTrain).
      const room = me.pop + me.reservePop + t.pop <= me.popCap;
      t.affordable = me.supplies >= t.cost && room && queued < CONFIG.maxQueue;
    }

    const supports = st.supports;
    for (let i = 0; i < supports.length; i++) {
      const b = supports[i];
      const left = me.supportCooldown[b.kind];
      const total = me.supportCooldownFull[b.kind];
      b.secondsLeft = left;
      b.charge = left <= 0 || total <= 0 ? 1 : Math.max(0, 1 - left / total);
      // Fog, a blizzard or the night keeps the aircraft on the ground (FOUNDATIONS.md 4.7).
      b.grounded = airGrounded(s, 0, b.kind);
      b.charges = me.supportCharges[b.kind];
    }

    // The phase's own clock first, then the mission's, then a phase's "hold out" objective as a countdown.
    const timer = s.director.timer ?? s.timer;
    const survive = timer ? null : surviveObjective(s);
    if (timer) {
      const t = this.timer;
      t.label = timer.label;
      t.secondsLeft = timer.secondsLeft;
      t.urgent = timer.secondsLeft <= APP.timerUrgentSeconds;
      st.timer = t;
    } else if (survive) {
      const t = this.timer;
      t.label = survive.text;
      t.secondsLeft = Math.max(0, survive.target - survive.value);
      t.urgent = t.secondsLeft <= APP.timerUrgentSeconds;
      st.timer = t;
    } else {
      st.timer = null;
    }
    this.refreshPhase(s);

    const hq = me.hq;
    st.hqHp = hq ? Math.max(0, hq.hp) : 0;
    st.hqMaxHp = hq ? hq.maxHp : 1;
    const ehq = foe.hq;
    st.enemyHqHp = ehq ? Math.max(0, ehq.hp) : null;
    st.enemyHqMaxHp = ehq ? ehq.maxHp : 1;

    this.refreshControl(battle, hp);
    this.refreshMinimap(battle, camCenterX, camViewW);
    if (st.deploy) this.refreshDeploy(s);
    st.clear = this.refreshClear(s, camCenterX, camViewW);
  }

  /**
   * The "Clear" chip (FOUNDATIONS.md 4.6 and 4.8): the enemy minefield side 0 can see, or enemy obstacle, nearest the
   * middle of the view and within it; null when there is none or side 0 has no sapper. Allocation free.
   */
  private refreshClear(s: BattleState, camCenterX: number, camViewW: number): HudState['clear'] {
    if (s.over || (s.minefields.length === 0 && s.obstacles.length === 0) || s.sides[0].alive.sapper <= 0) return null;
    const half = camViewW / 2;
    let best = Infinity;
    let label = '';
    let x = 0;
    let target: 'minefield' | 'obstacle' = 'minefield';
    let index = -1;
    for (let k = 0; k < s.minefields.length; k++) {
      const f = s.minefields[k];
      if (!f.alive || f.owner === 0 || !f.known[0]) continue;
      const d = Math.max(0, Math.abs(f.x - camCenterX) - f.width / 2);
      if (d > half || d >= best) continue;
      best = d;
      label = 'Clear mines';
      x = f.x;
      target = 'minefield';
      index = k;
    }
    for (let k = 0; k < s.obstacles.length; k++) {
      const o = s.obstacles[k];
      if (!o.alive || o.owner === 0) continue;
      const d = Math.max(0, Math.abs(o.x - camCenterX) - o.width / 2);
      if (d > half || d >= best) continue;
      best = d;
      label = o.kind === 'tankTrap' ? 'Clear tank traps' : 'Clear road block';
      x = o.x;
      target = 'obstacle';
      index = k;
    }
    if (index < 0) return null;
    let busy = false;
    for (const job of s.clears) if (job.side === 0 && job.target === target && job.index === index) busy = true;
    const chip = this.clearChip;
    chip.label = busy ? 'Sappers clearing' : label;
    chip.x = x;
    chip.busy = busy;
    return chip;
  }

  /** The "Deploy at" chip: rebuilt only when the choice or where it resolves to changes. */
  private refreshDeploy(s: BattleState): void {
    const me = s.sides[0];
    const key = (me.deploy + 2) * 1000 + me.deployPoint + 1;
    if (key === this.deployKey) return;
    this.deployKey = key;
    const chip = this.deployChip;
    const at = me.deployPoint >= 0 ? s.points[me.deployPoint].label : 'HQ';
    chip.front = me.deploy === DEPLOY_AUTO;
    chip.place = me.deploy === DEPLOY_AUTO ? at : me.deploy === DEPLOY_HQ ? 'HQ' : s.points[me.deploy].label;
    if (me.deploy === DEPLOY_AUTO) chip.label = `Deploy: ${at} (front)`;
    else if (me.deploy === DEPLOY_HQ) chip.label = 'Deploy: HQ';
    else chip.label = `Deploy: ${s.points[me.deploy].label}`;
    // A chosen point the player does not hold now (lost or contested): they walk out of the front-most one meanwhile.
    chip.closed = me.deploy >= 0 && me.deployPoint !== me.deploy;
  }

  /**
   * The phase line (a mission of more than one phase): "Phase 2/3 · The crossroads · Tanks destroyed 7 / 12", rebuilt
   * only when what it shows changes; and the side objectives for the pause screen.
   */
  private refreshPhase(s: BattleState): void {
    const st = this.state;
    const d = s.director;
    if (d.count > 1) {
      let at = -1;
      for (let i = 0; i < d.objectives.length; i++) {
        if (!d.objectives[i].done) {
          at = i;
          break;
        }
      }
      const o = at >= 0 ? d.objectives[at] : null;
      const shown = o === null ? 0 : o.unit === 'seconds' ? Math.ceil(Math.max(0, o.target - o.value)) : Math.floor(o.value);
      const key = d.phase * 1e7 + (at + 1) * 1e5 + shown;
      if (key !== this.phaseKey) {
        this.phaseKey = key;
        const head = d.title !== '' ? `Phase ${d.phase + 1}/${d.count} · ${d.title}` : `Phase ${d.phase + 1}/${d.count}`;
        st.phaseLine = o === null ? head : `${head} · ${objectiveProgress(o.text, o.unit, shown, o.target)}`;
      }
    } else {
      st.phaseLine = null;
    }
    const list = d.side;
    let key = '';
    for (let i = 0; i < list.length; i++) key += list[i].status[0];
    if (key !== this.sideKey) {
      this.sideKey = key;
      st.sideObjectives = list.map((so) => ({ text: so.text, status: so.status }));
    }
  }

  private refreshControl(battle: Battle, hp: HpShownQuery | null): void {
    const st = this.state;
    const s = battle.state;
    const index = s.sides[0].controlled;
    if (index < 0 || index >= s.units.length || !s.units[index].alive) {
      st.control = null;
      return;
    }
    const u = s.units[index];
    const c = this.control;
    c.kind = u.kind;
    c.name = unitDisplayName(this.era, u.kind, u.look);
    c.hp = u.hp;
    c.maxHp = u.maxHp;
    // The sim only lets the player control their own units, but an enemy unit's health would stay hidden all the same.
    c.hpShown = hp !== null ? hp.shows(u.side, u.x) : u.side === 0;
    c.reload = u.weaponCharge;
    const second = u.mount2.weapon;
    c.hasAbility = second !== null;
    c.abilityName = APP.abilityNames[u.kind] ?? APP.abilityNameFallback;
    c.abilityCharge = second === null || u.mount2.cooldown <= 0 || second.cooldown <= 0 ? 1 : Math.max(0, 1 - u.mount2.cooldown / second.cooldown);
    st.control = c;
  }

  private refreshMinimap(battle: Battle, camCenterX: number, camViewW: number): void {
    const s = battle.state;
    const m = this.state.minimap;
    m.length = s.length;
    m.camX = camCenterX - camViewW / 2;
    m.camW = camViewW;

    for (let side = 0; side < 2; side++) {
      const hq = s.sides[side].hq;
      if (hq === null) {
        m.hq[side] = null;
        continue;
      }
      const dot = this.hqDots[side];
      dot.x = hq.x;
      dot.hp = hq.maxHp > 0 ? Math.max(0, hq.hp / hq.maxHp) : 0;
      m.hq[side] = dot;
    }

    const trenches = s.trenches;
    m.trenchCount = trenches.length;
    for (let i = 0; i < trenches.length; i++) {
      m.trenchX[i] = trenches[i].x;
      m.trenchW[i] = trenches[i].width;
      m.trenchOwner[i] = trenches[i].owner;
    }

    let pb = 0;
    for (let i = 0; i < s.pillboxes.length; i++) {
      const p = s.pillboxes[i];
      if (!p.alive) continue;
      m.pillboxX[pb] = p.x;
      m.pillboxSide[pb] = p.side;
      pb++;
    }
    m.pillboxCount = pb;

    let n = 0;
    const cap = m.unitX.length;
    for (let i = 0; i < s.unitCount && n < cap; i++) {
      const u = s.units[i];
      if (!u.alive || u.inside) continue;
      m.unitX[n] = u.x;
      m.unitSide[n] = u.side;
      m.unitBig[n] = u.def.class === 'vehicle' ? 1 : 0;
      n++;
    }
    m.unitCount = n;
    const points = s.points;
    const owners = m.pointOwner;
    if (owners) for (let i = 0; i < points.length && i < owners.length; i++) owners[i] = points[i].owner;
  }
}

/**
 * The "Deploy at" chip's choices in the order a tap steps through them: the front-most point (auto), the HQ, then each
 * spawn point the player may use. Only the first two when the mission has none, and the chip is then not shown.
 */
export function deployOptions(s: BattleState): ('auto' | 'hq' | number)[] {
  const out: ('auto' | 'hq' | number)[] = ['auto', 'hq'];
  for (let k = 0; k < s.points.length; k++) {
    const p = s.points[k];
    if (p.spawn && (p.spawnFor < 0 || p.spawnFor === 0)) out.push(k);
  }
  return out;
}

/** The choice after the player's current one, wrapping round. */
export function nextDeploy(s: BattleState): 'auto' | 'hq' | number {
  const options = deployOptions(s);
  const d = s.sides[0].deploy;
  const now = d === DEPLOY_AUTO ? 'auto' : d === DEPLOY_HQ ? 'hq' : d;
  const i = options.indexOf(now);
  return options[(i + 1) % options.length];
}

/** The prep panel's numbers this frame, or null once the prep phase is over (or the mission has none). */
function fillPrep(panel: PrepHudState | null, s: BattleState, money: number): PrepHudState | null {
  const prep = s.prep;
  if (panel === null || prep === null || !prep.active || s.over) return null;
  panel.secondsLeft = prep.secondsLeft;
  for (const b of panel.builds) b.canAfford = money >= b.cost;
  let sites = 0;
  for (const site of s.sites) if (site.side === 0) sites++;
  panel.sites = sites;
  return panel;
}

/** The current phase's first unfinished "hold out" objective, for the clock when the phase has no other. */
function surviveObjective(s: BattleState): ObjectiveState | null {
  for (const o of s.director.objectives) if (!o.done && o.type === 'survive') return o;
  return null;
}

/** "Tanks destroyed 7 / 12", "Hold the summit 2:40", or the bare line for a flag objective. */
export function objectiveProgress(text: string, unit: ObjectiveState['unit'], shown: number, target: number): string {
  if (unit === 'count') return `${text} ${shown} / ${target}`;
  if (unit === 'seconds') return `${text} ${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`;
  return text;
}
