/**
 * Builds the HudState the DOM HUD polls every frame. One state object is
 * created per battle and refreshed in place: refresh() writes numbers into
 * existing objects and typed arrays and allocates nothing.
 */
import { APP } from '../data/app';
import { CONFIG } from '../data/config';
import { FACTIONS } from '../data/factions';
import type { Side, UnitKind } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { UNITS, UNIT_KINDS } from '../data/units';
import type { Battle } from '../sim';
import type { ControlState, HudState, MinimapState, SupportButtonState, TrainButtonState } from '../ui/contracts';

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
  private unitNames = {} as Record<UnitKind, string>;

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
    };
  }

  /** A new battle: the player's buttons, the objective text and the minimap's fixed parts. Allocates. */
  begin(battle: Battle): void {
    const s = battle.state;
    const st = this.state;
    const me = s.sides[0];
    const faction = FACTIONS[me.faction];
    this.unitNames = faction.unitNames;

    st.train = [];
    if (me.hasHq) {
      for (const kind of UNIT_KINDS) {
        if (!me.available[kind] || !UNITS[kind].trainable) continue;
        const btn: TrainButtonState = {
          kind,
          name: faction.unitNames[kind],
          label: faction.buttonNames[kind] ?? faction.unitNames[kind],
          cost: UNITS[kind].cost,
          pop: UNITS[kind].pop,
          queued: 0,
          progress: 0,
          fielded: 0,
          affordable: false,
          ownOrder: null,
        };
        st.train.push(btn);
      }
    }

    st.supports = [];
    for (const kind of SUPPORT_KINDS) {
      if (!me.supportAvailable[kind]) continue;
      const btn: SupportButtonState = { kind, name: faction.supportNames[kind], charge: 1, secondsLeft: 0 };
      st.supports.push(btn);
    }

    st.targeting = null;
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
    }

    const timer = s.timer;
    if (timer) {
      const t = this.timer;
      t.label = timer.label;
      t.secondsLeft = timer.secondsLeft;
      t.urgent = timer.secondsLeft <= APP.timerUrgentSeconds;
      st.timer = t;
    } else {
      st.timer = null;
    }

    const hq = me.hq;
    st.hqHp = hq ? Math.max(0, hq.hp) : 0;
    st.hqMaxHp = hq ? hq.maxHp : 1;
    const ehq = foe.hq;
    st.enemyHqHp = ehq ? Math.max(0, ehq.hp) : null;
    st.enemyHqMaxHp = ehq ? ehq.maxHp : 1;

    this.refreshControl(battle, hp);
    this.refreshMinimap(battle, camCenterX, camViewW);
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
    c.name = this.unitNames[u.kind];
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
  }
}
