/**
 * Tunables of the Phaser battlefield renderer (src/render). View only: the
 * simulation never reads this file. Distances in wu, times in seconds,
 * screen distances in CSS px.
 */
export const RENDER = {
  /** Largest atlas page in texture pixels (also capped by the GPU's MAX_TEXTURE_SIZE). */
  atlasMaxSize: 4096,
  /** Empty texture pixels between atlas frames, filled by repeating the frame's edge pixels. */
  atlasPadding: 2,

  /** Camera. */
  camera: {
    /** Seconds for a non-immediate setCenter() to cover most of the distance (exponential glide). */
    glideTime: 0.18,
    /** Pan inertia: velocity kept per second after the finger lifts (exponential decay rate, 1/s). */
    inertiaDecay: 5,
    /** Inertia stops below this speed (wu/s). */
    inertiaStop: 8,
    /** Fastest fling (wu/s). */
    maxFling: 6000,
    /** Wheel: wu panned per wheel delta pixel. */
    wheelWuPerPx: 1.4,
  },

  /** Input. */
  input: {
    /** A press that moves less than this (CSS px) and lasts less than tapTime is a tap. */
    tapSlop: 12,
    tapTime: 0.35,
    /** Generous pick radius around a unit's body centre (CSS px). */
    pickRadius: 44,
    /** Drag samples older than this (s) are ignored when measuring the fling speed. */
    flingWindow: 0.1,
  },

  /** Unit views. */
  unit: {
    /** Contact shadow: width as a multiple of the unit's footprint (figures use figureShadowW), height, alpha. */
    figureShadowW: 30,
    figureShadowH: 7,
    tankShadowPad: 1.05,
    tankShadowH: 16,
    shadowAlpha: 0.38,
    /** Spawned units fade in over this many wu from the HQ door; units entering it fade out over the same distance. */
    doorFade: 26,
    /** Seconds a body lies still after its fall before it starts to fade, and the fade time. */
    corpseLinger: 6,
    corpseFade: 1.5,
    /** Seconds a tank husk stays before fading, and its fade. */
    huskLinger: 20,
    huskFade: 2,
    /** Health pips: count, size of one pip (wu), gap, height above the head (wu). */
    pips: 4,
    pipW: 5,
    pipH: 2.4,
    pipGap: 1.2,
    pipLift: 9,
    /** Pip colours (0xRRGGBB): filled for each side, empty, and the dark backing. */
    pipFill: [0x9fd36a, 0xe0a050] as readonly number[],
    pipEmpty: 0x3a3a34,
    pipBack: 0x101010,
    /** Seconds over which a unit sinks into or climbs out of a trench. */
    trenchSinkTime: 0.25,
    /** Units off screen by more than this many wu are not laid out. */
    cullMargin: 160,
    /** Tank barrel recoil: seconds to return, hull rock on firing (fraction of rockMax) and its spring decay (1/s). */
    tankRecoilTime: 0.45,
    tankFireRock: 1,
    tankRockDecay: 4,
    /** Units on different rows of one formation column stand at the same x; spread them by up to this much (wu, view only). */
    xJitter: 7,
    /** Seed salt for each unit's animation seed and death roll. */
    seedSalt: 0x51ed27,
  },

  /** Structures. */
  structure: {
    /** HQ damage states by health fraction: above `damaged` = intact, above 0 = damaged, destroyed = ruin. */
    hqDamaged: 0.5,
    pillboxDamaged: 0.5,
    /** HQ gun-slit muzzle flash: seconds visible after a shot and scale. */
    slitFlashTime: 0.06,
    slitFlashScale: 0.75,
    /** Flag waving speed multiplier, and the phase offset (s) between the two sides' flags. */
    flagSpeed: 1,
    flagPhase: 1.7,
  },

  /** Markers. */
  marker: {
    /** Select ring under the controlled unit: scale and alpha; a tank's ring widens by its length / ringBaseW, its height by at most ringMaxTall. */
    ringScale: 1,
    ringBaseW: 60,
    ringMaxTall: 1.6,
    ringAlpha: 0.85,
    /** Targeting reticle scale and the alpha of its ground line. */
    reticleScale: 1,
    reticleLineAlpha: 0.35,
  },

  /** Basic shot effects (the full effects pass extends these). */
  shots: {
    /** Tracer size multiplier (the streak sprite's own length and thickness at 1). */
    tracerScale: 1,
    /** Seconds a tracer may live at most (safety). */
    tracerMaxLife: 0.6,
    /** Most tracers alive at once. */
    maxTracers: 160,
    /** Muzzle height above the ground for structure and default shots (wu). */
    muzzleY: 34,
    /** Height above the feet a bullet aims at (wu, at row scale 1). */
    aimY: 30,
    /** Height of the HQ gun's target for HQ hits (wu), randomised by this fraction either way. */
    hqHitY: 50,
    hqHitSpread: 0.4,
    /** Hits land between these fractions of the target's body height (from the feet). */
    hitLow: 0.45,
    hitHigh: 0.65,
    /** A miss lands this far past the target (wu, min + random spread) and within this much of its row's ground line. */
    missMin: 20,
    missSpread: 90,
    missDy: 8,
    /** Most particle images drawn per frame. */
    maxParticleImages: 1536,
  },

  /** Stats smoothing: weight of the newest sample. */
  statsSmoothing: 0.1,
} as const;
