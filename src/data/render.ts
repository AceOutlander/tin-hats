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
    /**
     * The view may pan this far (wu) past either end of the map, so each HQ, flag and gun slit sits clear of the
     * screen edge, a notch or a rounded corner.
     */
    edgeMargin: 64,
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
    doorFade: 14,
    /** ...and come out of the doorway's shadow (black silhouette to full colour) over this many wu. */
    doorShade: 34,
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
    /** Tank barrel recoil: seconds for the gun to run out again. */
    tankRecoilTime: 0.45,
    /**
     * Tank suspension (view only). bobAmp: hull bounce over the ground (wu) at bobFullSpeed (wu/s) and above, with
     * bobFreq bumps per wu travelled; rollRock: pitch wobble while rolling (fraction of the look's rockMax). The pitch
     * spring rings at rockFreq (rad/s) with rockDamping (0..1); fireKick is the pitch speed the gun's recoil gives it,
     * accelRock the pitch per wu/s^2 of acceleration (squat pulling away, nose dip stopping); speedEase smooths the
     * sim speed (s).
     */
    tank: {
      bobAmp: 0.9,
      bobFullSpeed: 30,
      bobFreq: 0.16,
      rollRock: 0.12,
      rockFreq: 11,
      rockDamping: 0.32,
      fireKick: 9,
      accelRock: 0.012,
      speedEase: 0.18,
      /** Driving over a trench: the hump at each lip (wu high, wu wide) that lifts and pitches the tank. */
      lipBump: 7,
      lipWidth: 34,
    },
    /** Seconds a figure and a tank take to turn round, and the narrowest they get mid-turn (fraction of their width). */
    turnTime: 0.16,
    turnMinK: 0.14,
    tankTurnTime: 0.7,
    tankTurnMinK: 0.32,
    /** Units on different rows of one formation column stand at the same x; spread them by up to this much (wu, view only). */
    xJitter: 8,
    /** Fixed x offset per depth row (wu, view only): a column of four reads as a staggered file, not one thick figure. */
    rowStagger: [-13, -4, 4, 13] as readonly number[],
    /** Within this distance of their own HQ door units leave their depth row and formation offset (file in and out). */
    doorFunnel: 80,
    /**
     * Crowd spread (view only): figures of one side (every row) closer than crowdGap (wu) along x open out behind the
     * leading man, by at most crowdMax each, easing over crowdEase seconds while walking faster than crowdMinSpeed
     * (wu/s).
     */
    crowdGap: 15,
    crowdMax: 80,
    crowdEase: 0.4,
    crowdMinSpeed: 4,
    /** A standing figure more than crowdDeadband wu from its spread place steps aside at crowdShuffle wu/s. */
    crowdDeadband: 5,
    crowdShuffle: 30,
    /** Seed salt for each unit's animation seed and death roll. */
    seedSalt: 0x51ed27,
    /**
     * Chance by depth row (0 = farthest) that a soldier with a kneeling stance (riflemen) kneels to fire rather than
     * stands: near ranks kneel and far ranks stand behind them, so a firing line reads in two tiers. And its salt.
     */
    kneelByRow: [0.1, 0.3, 0.75, 0.92] as readonly number[],
    kneelSalt: 0x6b1e3d,
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
    /** A man sunk deeper than this (wu) into a trench gets his ring drawn over the front parapet, at ground level. */
    ringSinkMin: 4,
    /** Targeting reticle scale (1 = it spans the call-in's reach), the most its height may grow (x the sprite's own) and the alpha of its ground line. */
    reticleScale: 1,
    reticleMaxTall: 1.5,
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

  /** The full effects pass (src/render/effects). */
  fx: {
    /** Low-priority effects (dust, casings, exhaust) stop at this many live particles. */
    softParticleCap: 900,
    /** Smoothed real frame time (s) above which low-priority effects thin out, and at which they stop. */
    slowFrame: 0.026,
    stopFrame: 0.045,
    /** Weight of the newest frame in that smoothing. */
    frameSmoothing: 0.08,
    /** Chance that a shot ejects a casing, by weapon id; other weapons use casingDefault. */
    casing: { rifle: 1, sniperRifle: 1, lmg: 0.5, smg: 0.45, coaxMg: 0.3, hqGun: 0.2, pillboxGun: 0.2, tankGun: 1, heavyGun: 1 } as Readonly<Record<string, number>>,
    casingDefault: 0.5,
    /** Footstep dust: infantry faster than minSpeed (wu/s) puff once per `stride` wu travelled; at most maxPerFrame puffs a frame. */
    foot: { minSpeed: 45, stride: 30, maxPerFrame: 8 },
    /** Tanks moving faster than minSpeed (wu/s) throw track dust from the rear of the hull every `trackDust` s; the exhaust puffs every `exhaust` s. */
    tank: { minSpeed: 5, trackDust: 0.12, exhaust: 0.2, trackDustY: -4 },
    /** A hit or miss is drawn when its tracer arrives: delay = distance / speed, at most this long (s). */
    impactMaxDelay: 0.45,
    /** Capacity of the delayed-effect queue. */
    delayedCapacity: 192,
    /** Explosion classes by radius (wu): up to smallMax = grenade, up to mediumMax = shell, above = big. Effects scale by radius / refRadius within the clamp. */
    explosion: {
      smallMax: 62,
      mediumMax: 100,
      refRadius: { small: 55, medium: 80, big: 110 },
      sizeMin: 0.8,
      sizeMax: 1.7,
      /** Extra blasts around a big explosion: count, spread (wu) and stagger (s). */
      secondary: { count: 2, spread: 0.55, stagger: 0.09 },
    },
    /** Ground decals: most at once, seconds shown at full strength, fade time and peak alpha. */
    decal: { max: 40, hold: 22, fade: 12, alpha: 0.9 },
    /** HQ damage: smoke starts below smokeBelow of its health, flames below fireBelow; both scale up toward 0. */
    hq: {
      smokeBelow: 0.8,
      fireBelow: 0.5,
      smokeInterval: [0.5, 0.14] as readonly [number, number],
      fireInterval: [0.2, 0.08] as readonly [number, number],
      fireSize: [0.8, 1.2] as readonly [number, number],
      /** The ruin keeps smouldering this many seconds after the collapse, then only smokes. */
      ruinFireTime: 25,
      /** Collapse: blasts along the bunker (count, stagger in s, and spread as a fraction of its half-width). */
      collapseBlasts: 5,
      collapseStagger: 0.16,
      collapseSpread: 0.9,
    },
    /** Burning tank wrecks: seconds of flames and of smoke after the tank is knocked out. */
    husk: { fireTime: 14, smokeTime: 40, fireSize: 1.35 },
    /** Smoke-screen clouds: puffs come faster the bigger the cloud (the preset's rate is for refRadius) and by `density`; height of the puffs above the ground (wu). */
    smokeScreen: { refRadius: 170, height: 70, density: 1.6 },
    /** Heights (wu above the ground) of the puff when training finishes and the pop when supplies arrive, both at the HQ door. */
    door: { puffY: 10, supplyY: 54 },
    floater: {
      max: 6,
      rise: 46,
      time: 1.35,
      fadeStart: 0.55,
      scale: 1.35,
      /** Where the +N starts above the ground at the HQ door (wu). */
      y: 96,
      /** Only the player's own deliveries get a floating +N. */
      ownSideOnly: true,
    },
    flight: {
      /** Most projectile sprites at once. */
      max: 48,
      /** Apex height of a lob as a fraction of its distance, with limits (wu). */
      apexRatio: 0.48,
      apexMin: 70,
      apexMax: 285,
      /** Direct shells and rockets sag slightly; this is the drop as a fraction of the distance, at most dropMax wu. */
      dropRatio: 0.03,
      dropMax: 26,
      /** Air-dropped ordnance starts this high above the ground (wu) at the launch x. */
      airAltitude: 245,
      /** Sprite size multiplier and spin (rad/s) by look. */
      scale: { grenade: 1, mortar: 1.2, rocket: 1.2, shell: 1.3, bomb: 1.5 } as Readonly<Record<string, number>>,
      spin: { grenade: 11, mortar: 0, rocket: 0, shell: 0, bomb: 0 } as Readonly<Record<string, number>>,
      /** Smoke trail preset by look ('' for none); it puffs at the preset's own interval. */
      trail: { grenade: '', mortar: 'projTrailThin', rocket: 'rocketTrail', shell: 'projTrailThin', bomb: 'projTrailThin' } as Readonly<Record<string, string>>,
      /** Shots at weapons that are not hitscan, with no projectile event the same step, are drawn as a fast flight of at least this length (s). */
      provisionalMin: 0.12,
      provisionalMax: 0.9,
    },
    /** Air strike: the aircraft's altitude above the ground line, speed limits, and how far past the target strip it flies before leaving. */
    aircraft: { altitude: 250, minSpeed: 380, maxSpeed: 900, overrun: 900, scale: 1, shadowAlpha: 0.9, exhaustInterval: 0.04 },
    /** Airdrop: seconds from the top of the screen to the ground, sway (wu) and rate (rad/s), crate and canopy sizes, and the canopy's collapse time. */
    airdrop: { fall: 4.2, startAbove: 140, swayX: 22, swayRate: 1.9, swayTilt: 0.09, canopyScale: 1, crateScale: 1, collapse: 1.6, crateLinger: 0.5, soundLead: 1.3 },
    /** Order marker at the hold line: seconds, rise (wu) and starting scale. */
    order: { time: 1.25, popTime: 0.18, scaleStart: 0.9, scale: 1.9, bob: 5, fadeStart: 0.6, tint: { advance: 0xffd45a, hold: 0xcfe6ff, fallBack: 0xff7a5a } as Readonly<Record<string, number>> },
  },

  /** Night tint: its alpha at full darkness (setDarkness(1)). */
  night: { maxAlpha: 0.52 },

  /** Weather view numbers that are not part of the weather data in src/data/weather.ts. */
  weather: {
    /** Salt mixed into the visual seed for the weather's own random source. */
    seedSalt: 0x7a1e5e,
    /** How far the rain layers slide with the camera (fraction of the pan, far and near); the field wraps. */
    parallax: [0.12, 0.3] as readonly [number, number],
    /** Rain streaks are drawn in this many wu beyond each side of the view. */
    margin: 30,
    /** Streak counts of the rain data are multiplied by this, and the lightning flash overlay's opacity by flashGain. */
    density: 1.4,
    flashGain: 1.35,
    /** Ground splash size multiplier. */
    splashSize: 1,
    /** Lightning bolt: the glow stroke is this many times wider than the core and this opaque. */
    boltGlowWidth: 5,
    boltGlowAlpha: 0.38,
    /** Share of the theatre's rain grade (darken, desaturate) applied to the whole scene, units included. */
    sceneGrade: 1,
  },

  /** Sound hookup (src/render/effects/sound.ts). */
  audio: {
    /** Smallest real-time gap (s) between plays of one sound, and a ceiling on all plays per second. */
    minGap: { rifleShot: 0.03, sniperShot: 0.05, smgShot: 0.04, mgShot: 0.045, bunkerMg: 0.05, tankGun: 0.15, mortarLaunch: 0.12, shellWhistle: 0.12, rocketLaunch: 0.12, grenadeExplosion: 0.06, explosionMedium: 0.08, explosionLarge: 0.12, unitTrained: 0.2, suppliesDelivered: 0.25, airdrop: 1, planeFlyby: 1.5, thunder: 0.5, ricochet: 0.15, dirtHit: 0.15 } as Readonly<Record<string, number>>,
    defaultGap: 0.05,
    maxPerSecond: 70,
    /** Shots further off screen than this many view widths are not played at all. */
    reachViews: 1.2,
    /** Rain loop and thunder volume. */
    rainVolume: 1,
    thunderVolume: 1,
    /** The tank engine loop plays while a tank is on screen, louder with more of them (full volume at tankLoopMax). */
    tankLoopVolume: 0.7,
    tankLoopMax: 3,
    /** Seconds without a tank in view before the loop stops. */
    tankLoopHold: 0.8,
    /** Volume scales for the shots of the other side (1 = the same). */
    enemyVolume: 1,
    /** Volume of the dull "ricochet" and "dirtHit" sounds for misses and wall hits (0 disables). */
    impactVolume: 0.5,
    /** Impact sounds: chance per miss/wall hit. */
    impactChance: 0.18,
  },

  /** Stats smoothing: weight of the newest sample. */
  statsSmoothing: 0.1,
} as const;
