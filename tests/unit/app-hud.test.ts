import { describe, expect, it } from 'vitest';
import { HudModel } from '../../src/app/hudModel';
import { APP } from '../../src/data/app';
import { CONFIG } from '../../src/data/config';
import { M01 } from '../../src/data/missions/m01';
import { SANDBOX } from '../../src/data/missions/sandbox';
import type { MissionDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { createBattle, type Battle, type UnitState } from '../../src/sim';

function battleOf(mission: MissionDef = M01): Battle {
  return createBattle({ mission, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['human', 'ai'] });
}

function run(battle: Battle, ticks: number): void {
  for (let i = 0; i < ticks; i++) battle.step();
}

describe('HudModel', () => {
  it('lists the training buttons of the mission with the player faction names', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    const train = model.state.train;
    expect(train.map((t) => t.kind)).toEqual(['sapper', 'rifle']);
    expect(train.map((t) => t.name)).toEqual(['Sapper', 'Rifleman']);
    expect(train[1].cost).toBe(UNITS.rifle.cost);
    expect(train[1].pop).toBe(UNITS.rifle.pop);
    expect(model.state.objective).toBe(M01.objective);
    expect(model.state.supports).toEqual([]);
    expect(model.state.minimap.colors).toHaveLength(2);
  });

  it('follows supplies, population, queue counts and progress', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const startSupplies = battle.state.sides[0].supplies;
    expect(model.state.supplies).toBe(startSupplies);
    expect(model.state.popCap).toBe(CONFIG.popCap);
    expect(model.state.train[1].affordable).toBe(true);
    expect(model.state.train[1].queued).toBe(0);

    battle.command(0, { type: 'train', kind: 'rifle' });
    run(battle, CONFIG.tickRate * 2);
    model.refresh(battle, 500, 1000);
    const rifle = model.state.train[1];
    expect(rifle.queued).toBeGreaterThanOrEqual(1);
    expect(rifle.progress).toBeGreaterThan(0);
    expect(rifle.progress).toBeLessThan(1);
    expect(model.state.pop).toBe(battle.state.sides[0].pop);
  });

  it('marks a button unaffordable when supplies run short', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    battle.state.sides[0].supplies = UNITS.rifle.cost - 1;
    model.refresh(battle, 500, 1000);
    expect(model.state.train[1].affordable).toBe(false);
    expect(model.state.train[0].affordable).toBe(UNITS.sapper.cost <= UNITS.rifle.cost - 1);
  });

  it('marks a button unaffordable when the population is full', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    battle.state.sides[0].supplies = 9999;
    battle.state.sides[0].pop = CONFIG.popCap;
    model.refresh(battle, 500, 1000);
    expect(model.state.train.every((t) => !t.affordable)).toBe(true);
  });

  it('reports the player order and both HQ health values', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    battle.command(0, { type: 'order', order: 'advance' });
    run(battle, 2);
    model.refresh(battle, 500, 1000);
    const s = model.state;
    expect(s.order).toBe('advance');
    expect(s.hqHp).toBe(battle.state.sides[0].hq?.hp);
    expect(s.hqMaxHp).toBe(battle.state.sides[0].hq?.maxHp);
    expect(s.enemyHqHp).toBe(battle.state.sides[1].hq?.hp);
    expect(s.timer).toBeNull();
    expect(s.control).toBeNull();
  });

  it('shows each kind its own order, and null for the kinds that follow the army', () => {
    const battle = battleOf(SANDBOX);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    expect(model.state.train.every((t) => t.ownOrder === null)).toBe(true);
    battle.command(0, { type: 'order', order: 'advance' });
    battle.command(0, { type: 'order', order: 'hold', kind: 'lmg' });
    run(battle, 1);
    model.refresh(battle, 500, 1000);
    expect(model.state.order).toBe('advance');
    for (const t of model.state.train) expect(t.ownOrder).toBe(t.kind === 'lmg' ? 'hold' : null);
    battle.command(0, { type: 'followArmy', kind: 'lmg' });
    run(battle, 1);
    model.refresh(battle, 500, 1000);
    expect(model.state.train.every((t) => t.ownOrder === null)).toBe(true);
  });

  it('fills the minimap from the battle', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    run(battle, CONFIG.tickRate * 20);
    model.refresh(battle, 1500, 900);
    const m = model.state.minimap;
    let expected = 0;
    for (let i = 0; i < battle.state.unitCount; i++) {
      const u = battle.state.units[i];
      if (u.alive && !u.inside) expected++;
    }
    expect(expected).toBeGreaterThan(0);
    expect(m.unitCount).toBe(expected);
    expect(m.length).toBe(M01.length);
    expect(m.camX).toBe(1050);
    expect(m.camW).toBe(900);
    expect(m.hq[0]).not.toBeNull();
    expect(m.hq[0]?.hp).toBe(1);
    expect(m.hq[1]?.x).toBeGreaterThan(m.hq[0]?.x ?? Infinity);
    for (let i = 0; i < m.unitCount; i++) expect([0, 1]).toContain(m.unitSide[i]);
  });

  it('shows trenches and live pillboxes on the minimap', () => {
    const mission: MissionDef = structuredClone(M01);
    mission.trenches = [{ id: 0, x: 2000, width: 200, slots: 6, owner: 0 }];
    mission.pillboxes = [
      { id: 0, x: 4200, side: 1, hpMul: 1 },
      { id: 1, x: 4500, side: 1, hpMul: 1 },
    ];
    const battle = battleOf(mission);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const m = model.state.minimap;
    expect(m.trenchCount).toBe(1);
    expect(m.trenchX[0]).toBe(2000);
    expect(m.trenchOwner[0]).toBe(0);
    expect(m.pillboxCount).toBe(2);
    battle.state.pillboxes[0].alive = false;
    model.refresh(battle, 500, 1000);
    expect(m.pillboxCount).toBe(1);
    expect(m.pillboxX[0]).toBe(4500);
  });

  it('shows the mission timer and flags it urgent near the end', () => {
    const mission: MissionDef = structuredClone(M01);
    mission.mode = 'survival';
    mission.timer = { seconds: 120, onExpire: 'win', label: 'Hold the line' };
    mission.start[1].hasHq = false;
    const battle = battleOf(mission);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const timer = model.state.timer;
    expect(timer).not.toBeNull();
    expect(timer?.label).toBe('Hold the line');
    expect(timer?.urgent).toBe(false);
    expect(model.state.enemyHqHp).toBeNull();
    run(battle, Math.ceil((120 - APP.timerUrgentSeconds + 1) * CONFIG.tickRate));
    model.refresh(battle, 500, 1000);
    expect(model.state.timer?.urgent).toBe(true);
    expect(model.state.timer).toBe(timer);
  });

  it('refreshes in place: the same objects and arrays every frame', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const s = model.state;
    const train = s.train;
    const buttons = [...train];
    const m = s.minimap;
    const arrays = [m.unitX, m.unitSide, m.unitBig, m.trenchX, m.pillboxX];
    const hq = [m.hq[0], m.hq[1]];
    for (let i = 0; i < 60; i++) {
      run(battle, 3);
      model.refresh(battle, 500 + i, 1000);
    }
    expect(model.state).toBe(s);
    expect(s.train).toBe(train);
    s.train.forEach((b, i) => expect(b).toBe(buttons[i]));
    expect(s.minimap).toBe(m);
    expect([m.unitX, m.unitSide, m.unitBig, m.trenchX, m.pillboxX]).toEqual(arrays);
    expect(m.unitX).toBe(arrays[0]);
    expect(m.hq[0]).toBe(hq[0]);
    expect(m.hq[1]).toBe(hq[1]);
  });

  describe('on the proving ground (every unit and call-in)', () => {
    const ground = (): Battle => battleOf(SANDBOX);

    function ownUnit(battle: Battle, kind: string): UnitState {
      for (let i = 0; i < battle.state.unitCount; i++) {
        const u = battle.state.units[i];
        if (u.alive && u.side === 0 && u.kind === kind) return u;
      }
      throw new Error(`no ${kind}`);
    }

    it('lists all nine trainable units and the three call-ins, and never the King Tiger', () => {
      const model = new HudModel();
      model.begin(ground());
      expect(model.state.train.map((t) => t.kind)).toEqual(['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank']);
      expect(model.state.train.map((t) => t.name)).toContain('Churchill');
      expect(model.state.supports.map((s) => s.kind)).toEqual(['artillery', 'smoke', 'airStrike']);
      expect(model.state.supports.map((s) => s.name)).toEqual(['Artillery Barrage', 'Smoke Screen', 'Typhoon Air Strike']);
    });

    it('sweeps a support button while it cools down and has it ready again afterwards', () => {
      const battle = ground();
      const model = new HudModel();
      model.begin(battle);
      model.refresh(battle, 500, 1000);
      expect(model.state.supports.every((s) => s.charge === 1 && s.secondsLeft === 0)).toBe(true);
      battle.command(0, { type: 'support', kind: 'smoke', x: 1500 });
      run(battle, 2);
      model.refresh(battle, 500, 1000);
      const smoke = model.state.supports.find((s) => s.kind === 'smoke');
      expect(smoke?.secondsLeft).toBeGreaterThan(40);
      expect(smoke?.charge).toBeGreaterThanOrEqual(0);
      expect(smoke?.charge).toBeLessThan(0.1);
      expect(model.state.supports.find((s) => s.kind === 'artillery')?.charge).toBe(1);
      run(battle, CONFIG.tickRate * 40);
      model.refresh(battle, 500, 1000);
      const later = model.state.supports.find((s) => s.kind === 'smoke');
      expect(later?.charge).toBeGreaterThan(0.8);
      run(battle, CONFIG.tickRate * 10);
      model.refresh(battle, 500, 1000);
      expect(model.state.supports.find((s) => s.kind === 'smoke')?.charge).toBe(1);
    });

    it('describes the controlled unit: card, reload and the secondary weapon button', () => {
      const battle = ground();
      const model = new HudModel();
      model.begin(battle);
      const rifle = ownUnit(battle, 'rifle');
      battle.command(0, { type: 'control', unit: rifle.id });
      run(battle, 2);
      model.refresh(battle, 500, 1000);
      const control = model.state.control;
      expect(control).not.toBeNull();
      expect(control?.kind).toBe('rifle');
      expect(control?.name).toBe('Rifleman');
      expect(control?.hasAbility).toBe(false);
      expect(control?.hp).toBe(rifle.hp);

      const grenadier = ownUnit(battle, 'assault');
      battle.command(0, { type: 'control', unit: grenadier.id });
      run(battle, 2);
      model.refresh(battle, 500, 1000);
      expect(model.state.control).toBe(control);
      expect(model.state.control?.kind).toBe('assault');
      expect(model.state.control?.hasAbility).toBe(true);
      expect(model.state.control?.abilityName).toBe(APP.abilityNames.assault);
      expect(model.state.control?.abilityCharge).toBe(1);

      battle.command(0, { type: 'control', unit: ownUnit(battle, 'tank').id });
      run(battle, 2);
      model.refresh(battle, 500, 1000);
      expect(model.state.control?.abilityName).toBe(APP.abilityNames.tank);

      battle.command(0, { type: 'control', unit: -1 });
      run(battle, 2);
      model.refresh(battle, 500, 1000);
      expect(model.state.control).toBeNull();
    });

    it('keeps every ability label short enough for its button', () => {
      for (const name of [...Object.values(APP.abilityNames), APP.abilityNameFallback]) expect(name.length).toBeLessThanOrEqual(8);
    });
  });

  it('survives a destroyed HQ', () => {
    const battle = battleOf();
    const model = new HudModel();
    model.begin(battle);
    const hq = battle.state.sides[0].hq;
    if (hq) hq.hp = -50;
    model.refresh(battle, 500, 1000);
    expect(model.state.hqHp).toBe(0);
    expect(model.state.minimap.hq[0]?.hp).toBe(0);
  });
});
