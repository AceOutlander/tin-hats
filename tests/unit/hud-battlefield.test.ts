/**
 * The long-map battlefield in the HUD and the art (FOUNDATIONS.md 4.1 and 4.5): the "Deploy at" chip and the choices a
 * tap steps through, the minimap's sector shading and capture points, and the ground painted in each sector's style.
 */
import { describe, expect, it } from 'vitest';
import { HudModel, deployOptions, nextDeploy } from '../../src/app/hudModel';
import { getBackdrop, getGroundLayer, type BackdropLayer } from '../../src/art/backdrops';
import { GROUND, GROUND_IDS, GROUND_MINIMAP, GROUND_PALETTES, groundArt } from '../../src/data/ground';
import { getMission } from '../../src/data/missions';
import type { CapturePointDef, MissionDef } from '../../src/data/schema';
import { THEATRES } from '../../src/data/theatres';
import { createBattle, type Battle } from '../../src/sim';
import { FIELD } from './fixtures';

const POINT: CapturePointDef = { id: 'P1', x: 3000, width: 300, label: 'The crossroads', owner: 0, captureTime: 10, spawn: true, contestRadius: 600 };

function battleOf(mission: MissionDef): Battle {
  return createBattle({ mission, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['human', 'ai'] });
}

describe('the "Deploy at" chip', () => {
  it('is not shown on a mission without spawn points', () => {
    const model = new HudModel();
    const battle = battleOf(FIELD);
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    expect(model.state.deploy).toBeNull();
    expect(deployOptions(battle.state)).toEqual(['auto', 'hq']);
  });

  it('names where trained men walk out, and steps through the front, the HQ and each spawn point', () => {
    const battle = battleOf({ ...FIELD, capturePoints: [POINT, { ...POINT, id: 'P2', x: 4500, label: 'Far post', owner: 1 }] });
    const model = new HudModel();
    model.begin(battle);
    battle.step();
    model.refresh(battle, 500, 1000);
    expect(model.state.deploy?.label).toBe('Deploy: The crossroads (front)');
    expect(deployOptions(battle.state)).toEqual(['auto', 'hq', 0, 1]);
    expect(nextDeploy(battle.state)).toBe('hq');
    battle.command(0, { type: 'deploy', at: 'hq' });
    battle.step();
    model.refresh(battle, 500, 1000);
    expect(model.state.deploy?.label).toBe('Deploy: HQ');
    expect(nextDeploy(battle.state)).toBe(0);
    // A point the enemy holds can be chosen, but is crossed out until it is ours.
    battle.command(0, { type: 'deploy', at: 1 });
    battle.step();
    model.refresh(battle, 500, 1000);
    expect(model.state.deploy?.label).toBe('Deploy: Far post');
    expect(model.state.deploy?.closed).toBe(true);
    expect(nextDeploy(battle.state)).toBe('auto');
  });

  it('leaves out the spawn points that only the other side may use', () => {
    const battle = battleOf({ ...FIELD, capturePoints: [POINT, { ...POINT, id: 'P2', spawnFor: 1 }] });
    expect(deployOptions(battle.state)).toEqual(['auto', 'hq', 0]);
  });
});

describe('the minimap on a mission in sectors', () => {
  it('shades every sector as its ground is drawn and flies each point in its holder\'s colours', () => {
    const m = getMission(1004)!;
    const battle = battleOf(m);
    const model = new HudModel();
    model.begin(battle);
    model.refresh(battle, 500, 1000);
    const mm = model.state.minimap;
    const sectors = m.sectors!;
    expect(Array.from(mm.sectorFrom!)).toEqual(sectors.map((s) => s.from));
    expect(Array.from(mm.sectorTo!)).toEqual(sectors.map((s) => s.to));
    const style = THEATRES[m.theatre].groundStyle;
    expect(mm.sectorColor).toEqual(sectors.map((s) => GROUND_MINIMAP[groundArt(s.ground, style, true)]));
    expect(mm.pointCount).toBe(3);
    expect(Array.from(mm.pointOwner!)).toEqual(battle.state.points.map((p) => p.owner));
  });

  it('keeps the plain ground of a mission without sectors', () => {
    const battle = battleOf(FIELD);
    const model = new HudModel();
    model.begin(battle);
    expect(model.state.minimap.sectorColor).toEqual([]);
    expect(model.state.minimap.pointCount).toBe(0);
  });
});

/** A context that records every call and property write as a hash, so painters run without a canvas. */
function transcript(layer: BackdropLayer): number {
  let h = 0x811c9dc5;
  const feed = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(3) : typeof v === 'string' ? v : typeof v);
  const gradient = { addColorStop: (o: number, c: string) => feed(`stop${fmt(o)}${c}`) };
  const target = {} as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        feed(prop + args.map(fmt).join(','));
        return prop.startsWith('create') ? gradient : undefined;
      };
    },
    set(_t, prop: string, value: unknown) {
      target[prop] = value;
      feed(`${prop}=${fmt(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  layer.draw(ctx);
  return h >>> 0;
}

describe('the ground art by sector', () => {
  it('gives every ground a style, and snow, deep snow, rubble and steppe their own colours', () => {
    for (const id of GROUND_IDS) expect(GROUND[id].art, id).toBeDefined();
    for (const style of ['snow', 'deepSnow', 'rubble', 'steppe'] as const) expect(GROUND_PALETTES[style], style).toBeDefined();
    expect(groundArt('steppe', 'grass', true)).toBe('snow');
    expect(groundArt('steppe', 'grass', false)).toBe('steppe');
    expect(groundArt('field', 'mud', false)).toBe('mud');
  });

  it('paints each style differently, the same way every time, on the ground slot', () => {
    const seen = new Set<number>();
    for (const style of ['snow', 'deepSnow', 'rubble', 'steppe', 'forest', 'cobble'] as const) {
      const a = getGroundLayer('germany', 'day', 7, style, 1024);
      const b = getGroundLayer('germany', 'day', 7, style, 1024);
      expect(a.slot).toBe('ground');
      expect(a.w).toBe(1024);
      const ground = getBackdrop('germany', 'day', 7).find((l) => l.slot === 'ground')!;
      expect(a.y).toBe(ground.y);
      expect(a.h).toBe(ground.h);
      expect(a.scale).toBe(ground.scale);
      const h = transcript(a);
      expect(transcript(b)).toBe(h);
      seen.add(h);
    }
    expect(seen.size).toBe(6);
  });
});
