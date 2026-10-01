/**
 * Event dispatch table for battlefield effects: one handler per sim event
 * type. The renderer calls EFFECT_HANDLERS[event.type] for every event of
 * every step while effects are enabled (they are off while fast-forwarding).
 *
 * To add an effect (explosions, projectiles, craters, smoke screens, weather
 * reactions, sounds...), write a handler with the EffectHandler signature and
 * add it to the table, or wrap an existing one. Handlers must not allocate:
 * use the scratch points on the context.
 *
 * Bookkeeping that must happen even with effects off (deaths, firing poses,
 * flinches, gun-slit flashes) is done by the view before this table runs.
 */
import { FX_TRACERS } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { SimEvent, SimEventType } from '../../sim';
import { WEAPONS } from '../../data/weapons';
import { VIEW } from '../../data/view';
import type { EffectContext } from './index';

export type EffectHandler = (fx: EffectContext, e: SimEvent) => void;

const SH = RENDER.shots;

/** A bullet or shell fired: muzzle flash and a tracer, dirt where a miss lands, a puff where a hit lands. */
function onShot(fx: EffectContext, e: SimEvent): void {
  if (!fx.onScreen(e.x, e.x2)) return;
  const from = fx.p0;
  const to = fx.p1;
  fx.shotOrigin(e, from);
  fx.shotTarget(e, to);
  const weapon = e.weapon ? WEAPONS[e.weapon] : undefined;
  const dir = e.dir === 0 ? (to.x >= from.x ? 1 : -1) : e.dir;
  const big = weapon !== undefined && weapon.damageType !== 'bullet';
  fx.particles.spawn(big ? 'tankMuzzle' : 'muzzleFlash', from.x, from.y, to.x - from.x, to.y - from.y, fx.groundY(e.row), 1);
  if (weapon && weapon.tracer !== 'none' && FX_TRACERS[weapon.tracer]) {
    fx.tracers.spawn(weapon.tracer, from.x, from.y, to.x, to.y);
  }
  if (e.hit) {
    if (e.target === 'unit') fx.particles.spawn('hitPuff', to.x, to.y, dir, 0, fx.groundY(e.row2), 1);
  } else {
    fx.particles.spawn('bulletDirt', to.x, to.y, dir, 0, to.y, 1);
  }
}

/** A soldier went down: a last puff of dust where he stood. */
function onUnitDied(fx: EffectContext, e: SimEvent): void {
  if (!fx.onScreen(e.x, e.x)) return;
  const row = e.row >= 0 ? e.row : 1;
  const gy = fx.groundY(row);
  fx.particles.spawn('hitPuff', e.x, gy - SH.aimY * VIEW.rowScale[row], e.dir === 0 ? 1 : e.dir, 0, gy, VIEW.rowScale[row]);
}

/** Every effect handler by event type. Extend this table; leave types out to ignore them. */
export const EFFECT_HANDLERS: Partial<Record<SimEventType, EffectHandler>> = {
  shot: onShot,
  unitDied: onUnitDied,
};
