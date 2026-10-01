/**
 * Phaser 4 battlefield renderer. See ./contracts.ts for the API and the loop.
 *
 *   const view = await createBattleView(document.getElementById('game')!);
 *   view.attach(battle, { playerSide: 0, visualSeed: seed });
 */
export { createBattleView, BattleViewImpl, type RenderInternals } from './view';
export type { AttachOptions, BattleCamera, BattleView, RenderStats, TargetingKind, WeatherMode } from './contracts';
export { EFFECT_HANDLERS, EffectContext, type EffectHandler } from './effects';
export { createLayers, type LayerName, type Layers } from './layers';
export { SpriteRegistry, packSprites, type SpriteFrame } from './atlas';
