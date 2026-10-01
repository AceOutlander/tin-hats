/**
 * View-space constants shared by the art, render and UI code.
 * The simulation never reads this file.
 */

export const VIEW = {
  /** Height of the scene in wu: the backdrop, sky and ground art span y = 0 .. heightWu. */
  heightWu: 540,
  /**
   * World units visible vertically, whatever the aspect ratio. The camera zoom is canvasHeight / viewHeightWu and
   * the view is anchored at the bottom of the scene (y = heightWu), so a value below heightWu crops only upper sky
   * and makes the battlefield bigger. Wider phones see more of the front.
   */
  viewHeightWu: 410,
  /** Nominal width of one screen in wu, used to size missions. */
  screenWu: 1000,
  /** y of the centre of the walkable band (feet line of the middle rows). */
  groundY: 404,
  /** y where the backdrop meets the ground plane. */
  horizonY: 352,
  /** Units are spread over a few depth rows purely for looks. Row 0 is farthest from the camera. */
  rows: 4,
  rowDy: [-27, -9, 9, 27],
  rowScale: [0.92, 0.97, 1.03, 1.08],
  /** Standing stick-figure height, feet to helmet top, in wu at scale 1. */
  figureHeight: 58,
  /** How far an occupant sinks into a trench (wu). */
  trenchDepth: 24,
  /**
   * Drawn feet line of trench occupants and of units crossing a trench (wu): every row steps down onto the fire step
   * just behind the front parapet, so head, shoulders and weapon show over the sandbags whatever the row. The rows
   * keep trenchRowSpread of their depth offset (a trench is narrow).
   */
  trenchFeetY: 434,
  trenchRowSpread: 0.25,
  /** Art canvases are rasterised at this multiple of wu so they stay crisp on high-dpi phones. */
  textureScale: 2,
  maxDevicePixelRatio: 2,
} as const;

/** World y of the top edge of the battle view (everything above it is cropped sky). */
export const VIEW_TOP_WU: number = VIEW.heightWu - VIEW.viewHeightWu;

/** Draw order, back to front. Everything in the battlefield scene uses these depths. */
export const DEPTH = {
  sky: 0,
  celestial: 1,
  clouds: 2,
  farBackdrop: 3,
  midBackdrop: 4,
  nearBackdrop: 5,
  ground: 10,
  groundDecals: 11,
  trenchBack: 12,
  structures: 14,
  shadows: 18,
  /** Row r draws at unitRow0 + r, so nearer rows cover farther ones. */
  unitRow0: 20,
  trenchFront: 30,
  wireFront: 31,
  /** A tank driving over a trench or wire rides above the front parapet and strands. */
  vehicleOver: 32,
  markers: 34,
  projectiles: 40,
  effects: 41,
  smokeScreen: 42,
  foreground: 50,
  nightTint: 55,
  rain: 60,
  lightningFlash: 61,
} as const;

/** Parallax scroll factors per backdrop layer (1 = moves with the ground). */
export const PARALLAX = {
  sky: 0,
  celestial: 0.02,
  clouds: 0.06,
  farBackdrop: 0.15,
  midBackdrop: 0.35,
  nearBackdrop: 0.6,
  ground: 1,
  foreground: 1.25,
} as const;
