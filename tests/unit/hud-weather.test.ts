/**
 * The HUD's share of scripted weather (FOUNDATIONS.md 4.7): an aircraft call-in grounded by fog, a blizzard or the
 * night says so and is not ready; the guns stay ready; the button comes back when the weather clears.
 */
import { describe, expect, it } from 'vitest';
import { HudModel } from '../../src/app/hudModel';
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

const FOGGY: MissionDef = {
  ...FIELD,
  weather: 'fog',
  supports: [['artillery', 'airStrike', 'recon'], []],
  events: [{ type: 'weather', when: { at: 5 }, to: 'clear', over: 4 }],
};

describe('call-in buttons in scripted weather', () => {
  it('show the aircraft grounded in fog, the guns ready, and the aircraft back once it clears', () => {
    const battle = battleOf(FOGGY);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const by = (kind: string) => model.state.supports.find((b) => b.kind === kind)!;
    expect(by('airStrike').grounded).toBe('fog');
    expect(by('recon').grounded).toBe('fog');
    expect(by('artillery').grounded).toBeNull();
    run(battle, 8);
    model.refresh(battle, 500, 1000);
    expect(by('airStrike').grounded).toBeNull();
  });

  it('ground the aircraft at night, but the Soviet Po-2', () => {
    const night: MissionDef = { ...FOGGY, weather: undefined, events: [], timeOfDay: 'night', start: [{ ...FIELD.start[0], faction: 'soviet' }, FIELD.start[1]] };
    const battle = battleOf(night);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const by = (kind: string) => model.state.supports.find((b) => b.kind === kind)!;
    expect(by('airStrike').grounded).toBe('night');
    expect(by('recon').grounded).toBeNull();
  });
});
