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
  /** Visual seeds are the battle seed plus this. */
  visualSeedOffset: number;
  /** Name of the secondary-weapon button while a unit is controlled. */
  abilityNames: Partial<Record<UnitKind, string>>;
  abilityNameFallback: string;
  /** Result screen reason text. */
  reasons: Record<'hqDestroyed' | 'timerSurvived' | 'timerExpired' | 'draw', { win: string; lose: string }>;
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
  };
  /** Level text of an upgrade level whose effects change nothing. */
  effectNone: string;
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
  visualSeedOffset: 7919,
  abilityNames: { assault: 'Grenade', tank: 'Machine gun', heavyTank: 'Machine gun' },
  abilityNameFallback: 'Ability',
  reasons: {
    hqDestroyed: { win: 'Enemy HQ destroyed', lose: 'Your HQ was overrun' },
    timerSurvived: { win: 'You held the line until relief arrived', lose: 'Your HQ was overrun' },
    timerExpired: { win: 'Time ran out for the enemy', lose: 'Time ran out before the objective was taken' },
    draw: { win: 'Both headquarters fell together', lose: 'Both headquarters fell together' },
  },
  supportBlurbs: {
    artillery: 'Calls a barrage of shells down on a spot you choose. Hurts everything caught in the open.',
    smoke: 'Lays a screen that blocks direct fire for a few seconds. Cover an advance with it.',
    airStrike: 'A fighter-bomber rockets a strip of the battlefield. Strong against tanks and clusters.',
  },
  statLabels: {
    sapperSpeed: 'sapper speed',
    sapperCarry: 'supplies carried',
    hqIncome: 'HQ income',
    hqHealth: 'HQ health',
    hqGunDamage: 'HQ gun damage',
    hqGunRate: 'HQ gun fire rate',
    unitHealth: 'health',
    unitDamage: 'damage',
    unitHeal: 'healing',
  },
  effectNone: 'No change',
};

