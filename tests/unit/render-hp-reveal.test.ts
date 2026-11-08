import { describe, expect, it } from 'vitest';
import { HudModel } from '../../src/app/hudModel';
import { SANDBOX } from '../../src/data/missions/sandbox';
import { RENDER } from '../../src/data/render';
import { HpReveal } from '../../src/render/hpReveal';
import { createBattle, type Battle } from '../../src/sim';

function ground(): Battle {
  return createBattle({ mission: SANDBOX, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['human', 'ai'] });
}

describe('hidden enemy health: HpReveal', () => {
  it('hides the enemy and shows the player by default, from the data', () => {
    expect(RENDER.hpReveal.revealOwnHp).toBe(true);
    expect(RENDER.hpReveal.revealEnemyHp).toBe(false);
    const r = new HpReveal();
    r.reset(0);
    expect(r.shows(0, 1000)).toBe(true);
    expect(r.shows(1, 1000)).toBe(false);
    expect(r.enemyShown()).toBe(false);
    expect(r.activeReveals()).toBe(0);
  });

  it('follows the side the player commands', () => {
    const r = new HpReveal();
    r.reset(1);
    expect(r.player).toBe(1);
    expect(r.enemy).toBe(0);
    expect(r.shows(1, 0)).toBe(true);
    expect(r.shows(0, 0)).toBe(false);
  });

  it('reveals the whole enemy side with the switch, and hides it again', () => {
    const r = new HpReveal();
    r.reset(0);
    r.setEnemyShown(true);
    expect(r.enemyShown()).toBe(true);
    expect(r.shows(1, -5000)).toBe(true);
    expect(r.shows(1, 90000)).toBe(true);
    r.setEnemyShown(false);
    expect(r.shows(1, 0)).toBe(false);
    expect(r.shows(0, 0)).toBe(true);
    // A side switch is per side: hiding the player's own works too (the admin panel may want it).
    r.setSideShown(0, false);
    expect(r.shows(0, 0)).toBe(false);
  });

  it('reveals enemy health only inside the radius, and only for the duration (on battle time)', () => {
    const r = new HpReveal();
    r.reset(0);
    r.update(10);
    r.revealEnemy(2000, 300, 20);
    expect(r.activeReveals()).toBe(1);
    expect(r.shows(1, 2000)).toBe(true);
    expect(r.shows(1, 1700)).toBe(true);
    expect(r.shows(1, 2300)).toBe(true);
    expect(r.shows(1, 1699)).toBe(false);
    expect(r.shows(1, 2301)).toBe(false);
    // The area reveals the enemy only: the player's own units are unaffected (they show anyway).
    expect(r.shows(0, 5000)).toBe(true);
    r.update(29.9);
    expect(r.shows(1, 2000)).toBe(true);
    r.update(30);
    expect(r.shows(1, 2000)).toBe(false);
    expect(r.activeReveals()).toBe(0);
  });

  it('takes Infinity for the whole field or no end, ignores empty reveals, and clears on demand', () => {
    const r = new HpReveal();
    r.reset(0);
    r.revealEnemy(0, Infinity, 5);
    expect(r.shows(1, 123456)).toBe(true);
    r.update(5);
    expect(r.shows(1, 0)).toBe(false);
    r.revealEnemy(100, 50, Infinity);
    r.update(1e9);
    expect(r.shows(1, 120)).toBe(true);
    r.clearReveals();
    expect(r.shows(1, 120)).toBe(false);
    r.revealEnemy(100, 0, 10);
    r.revealEnemy(100, 50, 0);
    r.revealEnemy(100, -1, 10);
    r.revealEnemy(Number.NaN, 50, 10);
    r.revealEnemy(100, 50, Number.NaN);
    expect(r.activeReveals()).toBe(0);
  });

  it('keeps a fixed pool of areas: past the cap the one ending soonest is replaced', () => {
    const r = new HpReveal(2);
    r.reset(0);
    r.revealEnemy(0, 10, 5);
    r.revealEnemy(1000, 10, 50);
    r.revealEnemy(2000, 10, 30);
    expect(r.activeReveals()).toBe(2);
    expect(r.shows(1, 0)).toBe(false);
    expect(r.shows(1, 1000)).toBe(true);
    expect(r.shows(1, 2000)).toBe(true);
  });

  it('starts every battle from the data defaults with no areas', () => {
    const r = new HpReveal();
    r.reset(0);
    r.setEnemyShown(true);
    r.revealEnemy(0, 100, 100);
    r.update(50);
    r.reset(0);
    expect(r.enemyShown()).toBe(false);
    expect(r.activeReveals()).toBe(0);
    expect(r.shows(1, 0)).toBe(false);
    // The clock went back to 0 too: a new area lasts its full time.
    r.revealEnemy(0, 100, 10);
    r.update(9.9);
    expect(r.shows(1, 0)).toBe(true);
  });
});

describe('hidden enemy health: the HUD', () => {
  it('shows the health of the player\'s own controlled unit', () => {
    const battle = ground();
    const model = new HudModel();
    model.begin(battle);
    const reveal = new HpReveal();
    reveal.reset(0);
    let own = -1;
    for (let i = 0; i < battle.state.unitCount; i++) {
      const u = battle.state.units[i];
      if (u.alive && u.side === 0 && u.kind === 'rifle') own = u.id;
    }
    battle.command(0, { type: 'control', unit: own });
    battle.step();
    battle.step();
    model.refresh(battle, 500, 1000, reveal);
    expect(model.state.control?.hpShown).toBe(true);
  });

  it('hides an enemy unit\'s health on the direct-control card unless it is revealed', () => {
    const battle = ground();
    const model = new HudModel();
    model.begin(battle);
    const reveal = new HpReveal();
    reveal.reset(0);
    const s = battle.state;
    let enemy = -1;
    for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive && s.units[i].side === 1) enemy = i;
    expect(enemy).toBeGreaterThanOrEqual(0);
    // The sim never lets the player take an enemy unit; force it to prove the card would still hide its health.
    s.sides[0].controlled = enemy;
    model.refresh(battle, 500, 1000, reveal);
    expect(model.state.control?.hpShown).toBe(false);
    model.refresh(battle, 500, 1000);
    expect(model.state.control?.hpShown).toBe(false);
    reveal.revealEnemy(s.units[enemy].x, 100, 30);
    model.refresh(battle, 500, 1000, reveal);
    expect(model.state.control?.hpShown).toBe(true);
  });

  it('leaves structures alone: the enemy HQ health stays in the HUD and on the minimap', () => {
    const battle = ground();
    const model = new HudModel();
    model.begin(battle);
    const reveal = new HpReveal();
    reveal.reset(0);
    const ehq = battle.state.sides[1].hq;
    expect(ehq).not.toBeNull();
    if (!ehq) return;
    ehq.hp = ehq.maxHp * 0.4;
    model.refresh(battle, 500, 1000, reveal);
    expect(model.state.enemyHqHp).toBeCloseTo(ehq.maxHp * 0.4);
    expect(model.state.enemyHqMaxHp).toBe(ehq.maxHp);
    expect(model.state.minimap.hq[1]?.hp).toBeCloseTo(0.4);
    // Pillboxes keep their health in the state the structure views draw their damage from; nothing gates it.
    expect(battle.state.pillboxes.length).toBeGreaterThan(0);
    for (const p of battle.state.pillboxes) expect(p.maxHp).toBeGreaterThan(0);
  });
});
