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
 *
 * Upgrade gear and the sapper's handcart stage (remembered on the anim, cleared by resetFigureAnim):
 *   setFigureGear(anim, { health, damage });   // after create / reset
 *   setFigureCrateKey(anim, key | null);       // a bigger load instead of the crate
 *   setFigurePushing(anim, on);                // hands on the handcart handle (SAPPER_CART_HANDLE)
 *   setFigureHeadgear(anim, 'ushanka' | null); // a cap instead of the helmet (FIGURE_HEADGEAR)
 *   setFigureClothing(anim, 'telogreika' | null); // winter clothing over the body (FIGURE_CLOTHING)
 */
export { chooseDeathVariant, updateFigure } from './animate';
export { drawFigure2d, drawFigureParts, figureBounds, paintUnitIcon } from './canvas';
export { figureGearKeys, gearSpriteKey, setFigureClothing, setFigureCrateKey, setFigureGear, setFigureHeadgear, setFigurePointing, setFigurePushing, setFigureRocketItem, setFigureWeapon, type FigureGearKeys } from './gear';
export { MOLOTOV_KEY } from './eraWeapons';
export { FIGURE_PART_COUNT, FIGURE_RIM_PARTS, createFigureLayout, layoutFigure, type FigurePart } from './layout';
export { FACTION_FIGURE_KEYS, allFigureSprites, figureSpriteMap } from './parts';
export {
  FigureAnim,
  JOINT_NAMES,
  J_CHEST,
  J_HIP,
  N_JOINTS,
  createFigureAnim,
  createFigureInput,
  isFigureKind,
  resetFigureAnim,
  type FigureDeath,
  type FigureInput,
} from './pose';
