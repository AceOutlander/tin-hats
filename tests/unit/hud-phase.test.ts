/**
 * The HUD's share of the mission director (FOUNDATIONS.md 3.4): the phase line under the objective plate with the
 * first unfinished objective's progress, a phase's "hold out" objective as the clock when there is no other, the side
 * objectives for the pause screen, call-in buttons that follow a `support` event, and a fresh prep panel for a phase's
 * own prep phase.
 */
import { describe, expect, it } from 'vitest';
import { HudModel, objectiveProgress } from '../../src/app/hudModel';
import { CONFIG } from '../../src/data/config';
import type { MissionDef } from '../../src/data/schema';
import { createBattle, type Battle } from '../../src/sim';
import { FIELD } from './fixtures';

function battleOf(mission: MissionDef): Battle {
  return createBattle({ mission, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['human', 'human'] });
}

function run(battle: Battle, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * CONFIG.tickRate); i++) battle.step();
}

const PHASED: MissionDef = {
  ...FIELD,
  events: [{ type: 'support', when: { phase: 'two' }, side: 0, kind: 'artillery', enabled: true }],
  supports: [['artillery'], []],
  start: [{ ...FIELD.start[0], supportsOff: ['artillery'] }, { ...FIELD.start[1], forces: [{ kind: 'rifle', count: 4, x: 5000 }] }],
  phases: [
    {
      id: 'one',
      title: 'The first morning',
      objectives: [{ id: 's', type: 'survive', seconds: 10, text: 'Hold out' }],
      sideObjectives: [{ id: 'quick', text: 'Win in a minute', within: 60, bonus: 0.1 }],
      next: 'two',
    },
    {
      id: 'two',
      title: 'Hold the crossroads',
      prep: { seconds: 5 },
      objectives: [{ id: 'k', type: 'kill', side: 1, count: 4, text: 'Riflemen down' }],
      next: null,
    },
  ],
};

describe('the HUD and the mission director', () => {
  it('formats objective progress', () => {
    expect(objectiveProgress('Tanks destroyed', 'count', 7, 12)).toBe('Tanks destroyed 7 / 12');
    expect(objectiveProgress('Hold the summit', 'seconds', 160, 360)).toBe('Hold the summit 2:40');
    expect(objectiveProgress('Take the station', 'flag', 0, 1)).toBe('Take the station');
  });

  it('shows the phase line, the hold-out clock, the side objectives, and follows a phase change', () => {
    const battle = battleOf(PHASED);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const st = model.state;
    expect(st.phaseLine).toBe('Phase 1/2 · The first morning · Hold out 0:10');
    expect(st.timer?.label).toBe('Hold out');
    expect(st.timer?.secondsLeft).toBe(10);
    expect(st.sideObjectives).toEqual([{ text: 'Win in a minute', status: 'open' }]);
    expect(st.supports).toEqual([]);
    expect(st.prep).toBeNull();
    run(battle, 11);
    model.refresh(battle, 500, 1000);
    expect(st.phaseLine).toBe('Phase 2/2 · Hold the crossroads · Riflemen down 0 / 4');
    // Phase two's own prep phase gets its panel.
    expect(st.prep).not.toBeNull();
    run(battle, 6);
    model.refresh(battle, 500, 1000);
    // The call-in it offers gets a button.
    expect(st.supports.map((b) => b.kind)).toEqual(['artillery']);
    expect(st.prep).toBeNull();
  });

  it('shows no phase line for a mission of one phase', () => {
    const battle = battleOf(FIELD);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    expect(model.state.phaseLine).toBeNull();
    expect(model.state.objective).toBe(FIELD.objective);
  });
});
