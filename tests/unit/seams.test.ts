/**
 * Integration seams between the parallel tracks: the sim's vocabulary against the
 * art, audio, effects and UI modules that consume it. These catch a name that one
 * track renamed and another still uses, which the type checker cannot see when the
 * consumer holds a plain string.
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../../src/data/factions';
import { FX_KEYS, FX_PROJECTILE_SPRITE, FX_TRACERS } from '../../src/data/fx';
import type { FactionId, Order, UnitAction, UnitKind } from '../../src/data/schema';
import { LOOP_NAMES, ONE_SHOT_NAMES, ORDER_WHISTLE, UI_SOUND, isSoundName } from '../../src/data/sounds';
import { SUPPORTS } from '../../src/data/supports';
import { UNIT_KINDS, UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { M01 } from '../../src/data/missions/m01';
import { listFxSprites } from '../../src/art/fx';
import {
  FACTION_FIGURE_KEYS,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  isFigureKind,
  layoutFigure,
  updateFigure,
  figureSpriteMap,
} from '../../src/art/figure';
import { DECAL_KEYS, RUBBLE_KEYS, SUPPLY_KEYS, propSpecs } from '../../src/art/props';
import { FLAG_KEYS, TRENCH_KEYS, WIRE_KEYS, hqKey, pillboxKey, structureSpecs } from '../../src/art/structures';
import { AIR_KEYS, TANK_KEYS, TANK_LOOKS, vehicleSpecs } from '../../src/art/vehicles';
import { createBattle } from '../../src/sim';
import { paintUnitPortrait } from '../../src/art/icons';
import type { CreateHud, PaintUnitIcon } from '../../src/ui';
import type { createHud } from '../../src/ui/hud';

const ALL_KINDS: UnitKind[] = [
  'sapper',
  'rifle',
  'conscript',
  'lmg',
  'assault',
  'mortar',
  'sniper',
  'medic',
  'at',
  'tank',
  'heavyTank',
  'apc',
  'flame',
  'commander',
  'aa',
  'lightTank',
];
const ALL_ACTIONS: UnitAction[] = ['idle', 'move', 'aim', 'fire', 'reload', 'throw', 'load', 'heal', 'deploy', 'inside'];
const ALL_FACTIONS: FactionId[] = ['british', 'german', 'soviet'];

/** Every string leaf of a nested key table. */
function leaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) leaves(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) leaves(v, out);
  return out;
}

describe('unit vocabulary', () => {
  it('has the same unit kinds in the schema list, the unit table and the faction tables', () => {
    expect([...UNIT_KINDS].sort()).toEqual([...ALL_KINDS].sort());
    expect(Object.keys(UNITS).sort()).toEqual([...ALL_KINDS].sort());
    for (const f of ALL_FACTIONS) {
      expect(Object.keys(FACTIONS[f].unitNames).sort(), f).toEqual([...ALL_KINDS].sort());
      expect(Object.keys(FACTIONS[f].unitBlurbs).sort(), f).toEqual([...ALL_KINDS].sort());
    }
  });

  it('draws every infantry kind as a stick figure and every vehicle kind as a tank rig', () => {
    for (const kind of ALL_KINDS) {
      const infantry = UNITS[kind].class === 'infantry';
      expect(isFigureKind(kind), kind).toBe(infantry);
    }
    for (const f of ALL_FACTIONS) {
      expect(TANK_LOOKS).toContain(FACTIONS[f].look.tank);
      expect(TANK_LOOKS).toContain(FACTIONS[f].look.heavyTank);
    }
  });

  it('animates every figure kind in every UnitAction without a bad number', () => {
    const parts = createFigureLayout();
    for (const faction of ALL_FACTIONS) {
      for (const kind of ALL_KINDS) {
        if (!isFigureKind(kind)) continue;
        for (const action of ALL_ACTIONS) {
          const anim = createFigureAnim(kind, faction, 7);
          const input = createFigureInput(kind);
          input.action = action;
          input.speed = action === 'move' ? 90 : 0;
          input.moved = action === 'move' ? 3 : 0;
          input.carrying = kind === 'sapper';
          for (let i = 0; i < 90; i++) updateFigure(anim, input, 1 / 60);
          layoutFigure(anim, parts);
          for (const p of parts) {
            const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rotation) && Number.isFinite(p.scaleX) && Number.isFinite(p.scaleY);
            expect(ok, `${faction}/${kind}/${action}/${p.key}`).toBe(true);
          }
        }
      }
    }
  });

  it('only produces kinds and actions in a real battle that the art and UI know about', () => {
    const battle = createBattle({ mission: M01, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['bot', 'ai'] });
    const seen = new Set<string>();
    // Long enough for the bot's first push (mission 1: about 105 s) to reach the enemy.
    for (let tick = 0; tick < 30 * 300 && !battle.state.over; tick++) {
      battle.step();
      if (tick % 3 !== 0) continue;
      const s = battle.state;
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive) continue;
        expect(ALL_KINDS, 'kind').toContain(u.kind);
        expect(ALL_ACTIONS, `action of ${u.kind}`).toContain(u.action);
        expect(ALL_FACTIONS, 'faction').toContain(u.faction);
        seen.add(`${u.kind}:${u.action}`);
      }
    }
    // A real fight must at least walk, aim and fire.
    const actions = new Set([...seen].map((k) => k.split(':')[1]));
    for (const a of ['idle', 'move', 'aim', 'fire', 'load']) expect(actions.has(a), a).toBe(true);
    // The figure module accepts each observed combination.
    const parts = createFigureLayout();
    for (const key of seen) {
      const [kind, action] = key.split(':') as [UnitKind, UnitAction];
      if (!isFigureKind(kind)) continue;
      const anim = createFigureAnim(kind, 'british', 1);
      const input = createFigureInput(kind);
      input.action = action;
      updateFigure(anim, input, 1 / 30);
      layoutFigure(anim, parts);
    }
  });
});

describe('weapons against audio and effects', () => {
  it('gives every weapon a fire sound that the audio engine really has, or none', () => {
    const oneShots = new Set<string>(ONE_SHOT_NAMES);
    for (const w of Object.values(WEAPONS)) {
      const valid = w.sound === 'none' || oneShots.has(w.sound);
      expect(valid, `${w.id}.sound = ${w.sound}`).toBe(true);
    }
  });

  it('gives every tracer and projectile look an effect sprite that exists', () => {
    const fxKeys = new Set(listFxSprites().map((s) => s.key));
    for (const w of Object.values(WEAPONS)) {
      if (w.tracer !== 'none') {
        expect(Object.keys(FX_TRACERS), `${w.id} tracer`).toContain(w.tracer);
        expect(fxKeys.has(FX_TRACERS[w.tracer].sprite), `${w.id} tracer sprite`).toBe(true);
      }
      if (w.projectileLook !== 'none') {
        const byFaction = FX_PROJECTILE_SPRITE[w.projectileLook];
        for (const f of ALL_FACTIONS) expect(fxKeys.has(byFaction[f]), `${w.id} projectile ${f}`).toBe(true);
      }
    }
  });

  it('refers to weapons that exist from units, structures and supports', () => {
    for (const u of Object.values(UNITS)) {
      if (u.weapon) expect(WEAPONS[u.weapon], `${u.kind}.weapon`).toBeDefined();
      if (u.secondary) expect(WEAPONS[u.secondary], `${u.kind}.secondary`).toBeDefined();
      expect(u.armed, `${u.kind}.armed`).toBe(u.weapon !== null);
    }
    for (const s of Object.values(SUPPORTS)) if (s.weapon) expect(WEAPONS[s.weapon], `${s.kind}.weapon`).toBeDefined();
  });

  it('maps every order and UI feedback name to a real one-shot sound', () => {
    const oneShots = new Set<string>(ONE_SHOT_NAMES);
    const orders: Order[] = ['fallBack', 'hold', 'advance'];
    for (const o of orders) expect(oneShots.has(ORDER_WHISTLE[o]), o).toBe(true);
    for (const n of ['click', 'deny', 'confirm'] as const) expect(oneShots.has(UI_SOUND[n]), n).toBe(true);
    expect(LOOP_NAMES.length).toBeGreaterThan(0);
    for (const name of [...ONE_SHOT_NAMES, ...LOOP_NAMES]) expect(isSoundName(name), name).toBe(true);
  });
});

describe('texture keys the renderer will ask for', () => {
  const have = new Set<string>([
    ...figureSpriteMap().keys(),
    ...structureSpecs().map((s) => s.key),
    ...vehicleSpecs().map((s) => s.key),
    ...propSpecs().map((s) => s.key),
    ...listFxSprites().map((s) => s.key),
  ]);

  function expectAll(label: string, keys: string[]): void {
    expect(keys.length, `${label} has keys`).toBeGreaterThan(0);
    expect(
      keys.filter((k) => !have.has(k)),
      `${label}: keys with no sprite`,
    ).toEqual([]);
  }

  it('has a sprite for every figure, structure, vehicle, prop and effect key table', () => {
    expectAll('FACTION_FIGURE_KEYS', leaves(FACTION_FIGURE_KEYS));
    expectAll('FLAG_KEYS', leaves(FLAG_KEYS));
    expectAll('TRENCH_KEYS', leaves(TRENCH_KEYS));
    expectAll('WIRE_KEYS', leaves(WIRE_KEYS));
    expectAll('TANK_KEYS', leaves(TANK_KEYS));
    expectAll('AIR_KEYS', leaves(AIR_KEYS));
    expectAll('SUPPLY_KEYS', leaves(SUPPLY_KEYS));
    expectAll('DECAL_KEYS', leaves(DECAL_KEYS));
    expectAll('RUBBLE_KEYS', [...RUBBLE_KEYS]);
    expectAll('FX_KEYS', leaves(FX_KEYS));
    expectAll(
      'hq and pillbox keys',
      [
        ...ALL_FACTIONS.flatMap((f) => (['intact', 'damaged', 'ruin'] as const).map((s) => hqKey(f, s))),
        ...(['intact', 'damaged', 'ruin'] as const).map((s) => pillboxKey(s)),
      ],
    );
  });
});

describe('UI wiring', () => {
  it('lets the HUD factory be passed wherever the UI shell expects a CreateHud', () => {
    // Compile-time check: this file fails `npm run typecheck` if createHud stops fitting CreateHud.
    type Fits = typeof createHud extends CreateHud ? true : false;
    const fits: Fits = true;
    expect(fits).toBe(true);
  });

  it('adapts the art portrait painter to the PaintUnitIcon the HUD and menus call', () => {
    // The UI calls paint(canvas, kind, side); the app picks the faction of each side.
    const factionOfSide: [FactionId, FactionId] = ['british', 'german'];
    const paint: PaintUnitIcon = (canvas, kind, side) => {
      paintUnitPortrait(canvas, kind, factionOfSide[side]);
    };
    expect(typeof paint).toBe('function');
  });
});
