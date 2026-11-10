/**
 * How buildings, rubble, cover props and the mission HQ buildings are drawn (FOUNDATIONS.md 4.3; the art is in
 * src/art/structures/buildings.ts and hqBuildings.ts, the views in src/render/buildings.ts). View only: the sim never
 * reads this file.
 *
 * A building is drawn as a stack of floor pieces, each FLOOR.h tall, with a roof piece on the top standing floor (a
 * broken top once a floor has fallen), and rubble when it falls. Every piece has its origin at the bottom centre, on
 * the line its floor stands on; the building's ground floor stands on VIEW.groundY. The facade pieces are drawn over the
 * units (so the men inside show only at the windows and the door) with the windows cut out at the slot positions; the
 * dark interior is a plain strip under the units.
 */
import { ART_COLORS as C, type ArtBox, type ArtPoint } from './artLayout';
import type { BuildingLook, CoverPropLook } from './schema';
import type { HqStyleLayout } from './looksHq';

export const BUILDING_LAYOUT = {
  /** Height of one floor (wu). Four floors and a roof fit under the top of the battle view. */
  floorH: 56,
  /** Window sill and lintel above the floor line, and the window width (wu). */
  sillY: -17,
  lintelY: -48,
  windowW: 14,
  /** Margin round the footprint in every piece's box (eaves, chunks, cornices). */
  pad: 10,
  /** Roof pieces: box height above the top floor line. */
  roofH: 64,
  /** Rubble: the back stumps' box height, and the front heap's box (above and below the ground line). */
  rubbleBackH: 56,
  rubbleFrontUp: 22,
  rubbleFrontDown: 58,
  /** The ground floor's door: width and how far its centre sits in from the left end. */
  doorW: 14,
  doorInset: 11,
  /** Health fraction at or below which a building shows the damaged pieces. */
  damaged: 0.6,
  /** The dark interior seen through the windows (a tinted strip, not a sprite). */
  interior: 0x15130f,
  /** Window occupants stand this far above their floor line (on the floorboards behind the sill). */
  occupantDy: -2,
} as const;

/** Wall material of a look. */
export type WallMaterial = 'brick' | 'plaster' | 'logs' | 'concrete' | 'planks';
/** Roof of a look. */
export type RoofShape = 'gable' | 'flat' | 'dome' | 'sawtooth' | 'vault' | 'cone' | 'hip';
/** Window of a look. */
export type WindowShape = 'square' | 'arch' | 'tall' | 'slit' | 'carved';

export interface BuildingStyle {
  material: WallMaterial;
  wall: string;
  wallDark: string;
  wallRim: string;
  /** Window frames, cornices and sills. */
  trim: string;
  roof: RoofShape;
  roofColour: string;
  roofRim: string;
  window: WindowShape;
  /** Brick showing through broken plaster (plaster looks), or the darker course colour. */
  under: string;
}

const BRICK = '#7a4630';
const BRICK_DARK = '#4f2e20';
const BRICK_RIM = '#a8705a';
const PLASTER = '#9c9580';
const PLASTER_DARK = '#6c6756';
const PLASTER_RIM = '#c4bda5';
const LOG = '#6b5236';
const LOG_DARK = '#3e2f1f';
const LOG_RIM = '#94775a';
const SHEET = '#4d544e';
const SHEET_RIM = '#7c847c';
const SHINGLE = '#5b4a36';

export const BUILDING_STYLES: Record<BuildingLook, BuildingStyle> = {
  // The ring barracks at Brest: a metre and more of red brick, arched windows, earth on the roof.
  casemate: { material: 'brick', wall: BRICK, wallDark: BRICK_DARK, wallRim: BRICK_RIM, trim: '#8f5a43', roof: 'flat', roofColour: C.earth, roofRim: C.grass, window: 'arch', under: BRICK_DARK },
  // A plastered parish church with an onion dome (the garrison club at Brest, Klin's church).
  church: { material: 'plaster', wall: '#a59f8b', wallDark: PLASTER_DARK, wallRim: '#cbc5ae', trim: '#c9c2aa', roof: 'dome', roofColour: '#4a5a52', roofRim: '#7d9086', window: 'arch', under: BRICK },
  // A log house with carved, painted window frames.
  izba: { material: 'logs', wall: LOG, wallDark: LOG_DARK, wallRim: LOG_RIM, trim: '#b9b39b', roof: 'gable', roofColour: SHINGLE, roofRim: '#866f52', window: 'carved', under: LOG_DARK },
  // A one- or two-storey town house, plaster over brick.
  house: { material: 'plaster', wall: '#8f8a74', wallDark: PLASTER_DARK, wallRim: PLASTER_RIM, trim: '#b3ac95', roof: 'gable', roofColour: SHEET, roofRim: SHEET_RIM, window: 'square', under: BRICK },
  // A block of flats: plaster, a flat roof behind a cornice.
  apartment: { material: 'plaster', wall: PLASTER, wallDark: PLASTER_DARK, wallRim: PLASTER_RIM, trim: '#b8b19a', roof: 'flat', roofColour: '#5e5a4c', roofRim: '#8c8670', window: 'square', under: BRICK },
  // A railway station: yellow plaster, tall windows, a hipped roof with a clock.
  station: { material: 'plaster', wall: '#a8956a', wallDark: '#76674a', wallRim: '#cdb98d', trim: '#d2c6a4', roof: 'hip', roofColour: SHEET, roofRim: SHEET_RIM, window: 'arch', under: BRICK },
  // A works hall: brick piers, tall many-paned windows, a sawtooth roof.
  factoryHall: { material: 'brick', wall: '#6e4a36', wallDark: '#463023', wallRim: '#97705a', trim: '#5a4232', roof: 'sawtooth', roofColour: '#3f4440', roofRim: '#6d746c', window: 'tall', under: BRICK_DARK },
  // A concrete water tank on the crest, its slits turned into embrasures.
  waterTank: { material: 'concrete', wall: C.concrete, wallDark: C.concreteDark, wallRim: C.concreteRim, trim: C.concreteRim, roof: 'cone', roofColour: C.concreteDark, roofRim: C.concreteRim, window: 'slit', under: C.concreteDark },
  // A brick mill (as the Gerhardt mill).
  mill: { material: 'brick', wall: '#83503a', wallDark: BRICK_DARK, wallRim: BRICK_RIM, trim: '#9a6a52', roof: 'flat', roofColour: '#4a3a30', roofRim: '#7a6050', window: 'arch', under: BRICK_DARK },
  // A department store: a grand plastered front with big windows.
  store: { material: 'plaster', wall: '#a49b84', wallDark: '#6f6858', wallRim: '#cbc2a8', trim: '#cfc6ac', roof: 'flat', roofColour: '#55524a', roofRim: '#8a8676', window: 'tall', under: BRICK },
  // An airfield hangar: planks and sheet over a curved roof.
  hangar: { material: 'planks', wall: '#5d5a4c', wallDark: '#3a382f', wallRim: '#878370', trim: '#72705f', roof: 'vault', roofColour: '#4a504b', roofRim: '#7a827a', window: 'square', under: '#3a382f' },
  // Goods sheds: weathered planks under a low gable of sheet.
  sheds: { material: 'planks', wall: '#5f4d36', wallDark: '#3a2f21', wallRim: '#86704f', trim: '#6e5b40', roof: 'gable', roofColour: SHEET, roofRim: SHEET_RIM, window: 'square', under: '#3a2f21' },
};

/** Cover props: the box of the scenery piece behind the men (origin bottom centre on the ground line). */
export const PROP_LAYOUT: Record<CoverPropLook, { h: number }> = {
  wagons: { h: 70 },
  ju52Wreck: { h: 74 },
  he111Wreck: { h: 60 },
};

/** The HQ buildings a mission may put an HQ in (SideStart.hqLook), beside the Quartermaster's HQ styles. */
export type MissionHqStyle = 'casemate' | 'mill' | 'store';
export const MISSION_HQ_STYLES: readonly MissionHqStyle[] = ['casemate', 'mill', 'store'];

function hqLayout(w: number, h: number, bodyW: number, bodyH: number, doorX: number, flag: ArtPoint, fires: ArtPoint[]): HqStyleLayout {
  const box: ArtBox = { w, h, ox: w / 2, oy: h - 14 };
  return {
    box,
    bodyW,
    bodyH,
    doorX,
    doorW: 34,
    doorH: 60,
    flagBase: { x: flag.x, y: -bodyH },
    flagTop: { x: flag.x, y: flag.y },
    fires,
    gunNest: { x: bodyW / 2 + 60, y: 0 },
  };
}

/** Layouts of the mission HQ buildings, in the conventions of HQ_STYLE_LAYOUT (src/data/looksHq.ts). */
export const MISSION_HQ_LAYOUT: Record<MissionHqStyle, HqStyleLayout> = {
  // The ring barracks' casemate at Brest: long, low, red brick under a bank of earth.
  casemate: hqLayout(360, 236, 300, 112, 70, { x: -90, y: -206 }, [
    { x: -90, y: -60 },
    { x: 0, y: -84 },
    { x: 90, y: -50 },
  ]),
  // The Gerhardt mill: three storeys of shell-scarred brick.
  mill: hqLayout(300, 290, 220, 168, 50, { x: -60, y: -262 }, [
    { x: -60, y: -120 },
    { x: 10, y: -150 },
    { x: 60, y: -70 },
  ]),
  // The Univermag: a department store of four storeys, its cellars the last headquarters.
  store: hqLayout(360, 290, 300, 176, 80, { x: -110, y: -270 }, [
    { x: -100, y: -130 },
    { x: 0, y: -160 },
    { x: 100, y: -90 },
  ]),
};
