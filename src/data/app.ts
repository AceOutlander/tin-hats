/**
 * Tunables and texts of the app glue (src/app): the game loop, the HUD model,
 * sound mapping, the result screen and the Quartermaster texts.
 */
import type { SupportKind, UnitKind } from './schema';

export interface AppTunables {
  /** The longest real frame the loop simulates (milliseconds); longer frames are cut. */
  maxFrameMs: number;
  /** Most simulation steps in one frame; the rest of the time is dropped. */
  maxStepsPerFrame: number;
  /** Debug fast-forward limit. */
  maxTimeScale: number;
  /** Above this time scale the cosmetic effects are switched off. */
  effectsMaxTimeScale: number;
  /** Above this time scale no sound effects are played. */
  soundMaxTimeScale: number;
  /** Scaled seconds between the end of the battle and the result screen. */
  resultDelaySeconds: number;
  /** Battle seconds an announcement banner stays up. */
  bannerSeconds: number;
  /** Battle seconds a tutorial hint stays up. */
  hintSeconds: number;
  /** A mission timer under this many seconds is shown as urgent. */
  timerUrgentSeconds: number;
  /** Explosions with a radius from this many wu use the medium and large sounds. */
  explosionMediumRadius: number;
  explosionLargeRadius: number;
  /** Smoothing of the frame-time averages reported by the debug hooks (0..1). */
  perfSmoothing: number;
  /**
   * The "Show FPS" readout: it covers the frames of the last windowMs, is refreshed every updateMs, and keeps at most
   * ring frame times (enough for windowMs at 240 Hz). A frame slower than hitchMs (a missed 30 fps frame) is a hitch.
   */
  fps: { windowMs: number; updateMs: number; ring: number; hitchMs: number };
  /** Visual seeds are the battle seed plus this. */
  visualSeedOffset: number;
  /**
   * Camera follow of a directly controlled unit: the view stays still while the unit is within deadZone (fraction of
   * the view width) of its anchor, then glides after it, leaving it settle (0..1) of the dead zone off the anchor. The
   * anchor sits lead (fraction of the view width) behind the centre, away from the enemy, so the player sees what is
   * ahead and the unit stays clear of the FIRE cluster in the bottom-right corner.
   */
  follow: { deadZone: number; settle: number; lead: number };
  /** Name of the secondary-weapon button while a unit is controlled. */
  abilityNames: Partial<Record<UnitKind, string>>;
  abilityNameFallback: string;
  /**
   * Result screen reason text. `{label}` in a line stands for the mission timer's label ("Nightfall"), so a deadline
   * mission can say what ran out.
   */
  reasons: Record<'hqDestroyed' | 'timerSurvived' | 'timerExpired' | 'draw' | 'admin', { win: string; lose: string }>;
  /** Short banners for scripted events that carry no text of their own. `{n}` = the supplies delivered. */
  /** HUD banners: an airdrop, a survival wave, the King Tiger's arrival (bossArrived). */
  notices: { airdrop: string; wave: string; boss: string };
  /** One line per support for the briefing's "new support" card. */
  supportBlurbs: Record<SupportKind, string>;
  /** Quartermaster level text: "+X% label" per stat. */
  statLabels: {
    sapperSpeed: string;
    sapperCarry: string;
    hqIncome: string;
    hqHealth: string;
    hqGunDamage: string;
    hqGunRate: string;
    unitHealth: string;
    unitDamage: string;
    unitHeal: string;
    supportRate: string;
    supportReach: string;
    supportTime: string;
  };
  /** Level text of an upgrade level whose effects change nothing. */
  effectNone: string;
  /** Quartermaster: the heading of the HQ and sapper upgrades. */
  upgradeHqGroup: string;
}

export const APP: AppTunables = {
  maxFrameMs: 250,
  maxStepsPerFrame: 240,
  maxTimeScale: 240,
  effectsMaxTimeScale: 4,
  soundMaxTimeScale: 4,
  resultDelaySeconds: 2.5,
  bannerSeconds: 4,
  hintSeconds: 12,
  timerUrgentSeconds: 30,
  explosionMediumRadius: 45,
  explosionLargeRadius: 100,
  perfSmoothing: 0.1,
  fps: { windowMs: 1000, updateMs: 250, ring: 256, hitchMs: 1000 / 30 },
  visualSeedOffset: 7919,
  follow: { deadZone: 0.14, settle: 0.5, lead: 0.1 },
  abilityNames: { assault: 'Grenade', tank: 'Hull MG', heavyTank: 'Hull MG' },
  abilityNameFallback: 'Ability',
  reasons: {
    hqDestroyed: { win: 'Enemy HQ destroyed', lose: 'Your HQ was overrun' },
    timerSurvived: { win: 'You held the line until relief arrived', lose: 'Your HQ was overrun' },
    timerExpired: { win: 'Time ran out for the enemy', lose: '{label} came before the enemy HQ was destroyed' },
    draw: { win: 'Both headquarters fell together', lose: 'Both headquarters fell together' },
    // Only the hidden admin panel ends a battle this way.
    admin: { win: 'Victory declared from the admin panel', lose: 'Defeat declared from the admin panel' },
  },
  notices: { airdrop: 'Airdrop: +{n} supplies', wave: 'Enemy wave incoming', boss: 'Warning: King Tiger sighted' },
  supportBlurbs: {
    artillery: 'Calls a barrage of shells down on a spot you choose. Hurts everything caught in the open.',
    smoke: 'Lays a screen that blocks direct fire for a few seconds. Cover an advance with it.',
    airStrike: 'A fighter-bomber rockets a strip of the battlefield. Strong against tanks and clusters.',
    bomber: 'A bomber flies over and carpets a wide stretch of the battlefield with bombs.',
    fighter: 'A fighter dives in and strafes the spot you choose with its guns.',
    recon: 'A recon plane circles overhead and shows enemy health in a wide area for a while.',
    katyusha: 'A rocket battery fires a huge salvo over a wide area. Inaccurate and slow to reload: hurts most where men bunch up.',
  },
  statLabels: {
    // Short: each level line sits in a narrow column beside the card's buttons, and the card's own name
    // already says what is improved (Sapper Drill, HQ Vickers Gun).
    sapperSpeed: 'speed',
    sapperCarry: 'load',
    hqIncome: 'HQ income',
    hqHealth: 'HQ health',
    hqGunDamage: 'damage',
    hqGunRate: 'fire rate',
    unitHealth: 'health',
    unitDamage: 'damage',
    unitHeal: 'healing',
    // The rate shows as the cooldown it shortens (describeEffect).
    supportRate: 'cooldown',
    supportReach: 'area',
    supportTime: 'time',
  },
  effectNone: 'No change',
  upgradeHqGroup: 'HQ and sappers',
};

