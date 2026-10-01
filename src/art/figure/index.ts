/**
 * Stick-figure animation and figure art.
 *
 *   const anim = createFigureAnim(unit.kind, unit.faction, unit.id);
 *   const input = createFigureInput(unit.kind);      // reuse every frame
 *   const parts = createFigureLayout();               // reuse every frame
 *   // each frame: fill input, then
 *   updateFigure(anim, input, dt);
 *   layoutFigure(anim, parts);                        // copy parts onto pooled images
 *
 * Sprites: allFigureSprites() (keys "fig/..."). Canvas reference renderer:
 * drawFigure2d(), paintUnitIcon().
 */
export { chooseDeathVariant, updateFigure } from './animate';
export { drawFigure2d, drawFigureParts, figureBounds, paintUnitIcon } from './canvas';
export { FIGURE_PART_COUNT, FIGURE_RIM_PARTS, createFigureLayout, layoutFigure, type FigurePart } from './layout';
export { FACTION_FIGURE_KEYS, allFigureSprites, figureSpriteMap } from './parts';
export {
  FigureAnim,
  JOINT_NAMES,
  N_JOINTS,
  createFigureAnim,
  createFigureInput,
  isFigureKind,
  resetFigureAnim,
  type FigureDeath,
  type FigureInput,
} from './pose';
