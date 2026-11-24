/**
 * Supply crates: what each holds, what it costs in medals, and every rule of opening one (src/meta/crates.ts draws from
 * this; the simulation never reads it). The owner's tables: docs/QUEUE.md, "Crate balance fix (owner, 2026-11-22)".
 *
 * Chances are whole parts of ODDS_PARTS (10,000), so 45.9% is 4590 and 0.01% is 1: every table adds up to exactly
 * 10,000 and the Shop shows the exact figures (tests/unit/crates-data.test.ts).
 */
import type { Rarity } from './cosmetics';

export type CrateId = 'standard' | 'premium' | 'elite' | 'titan' | 'god';

/** The parts a table's chances are counted in. */
export const ODDS_PARTS = 10_000;

export interface CrateOdds {
  rarity: Rarity;
  /** Parts of ODDS_PARTS. */
  parts: number;
}

/**
 * "A Rare every 5": after `every` - 1 crates of this type in a row without an item of exactly this rarity, the next
 * holds one, or something better if that is what it rolled (the guarantee then stays due for the crate after). So any
 * `every` crates in a row hold at least one item of this rarity or better, which is what the Shop says.
 */
export interface CrateGuarantee {
  rarity: Rarity;
  every: number;
}

export interface CrateDef {
  id: CrateId;
  name: string;
  /** Medals. */
  price: number;
  /** Lowest rarity first. */
  odds: readonly CrateOdds[];
  guarantees: readonly CrateGuarantee[];
  /** One line on its card. */
  blurb: string;
  /**
   * '#rrggbb' its wood is painted in, until it gets a look of its own; null = the Standard Crate's olive. Never a
   * rarity's colour, so a crate is not mistaken for what it holds.
   */
  tint: string | null;
  /** False: shown in the Shop as "Coming soon", never bought, opened or granted. */
  available: boolean;
}

export interface CrateOpeningTunables {
  /** Seconds of each step of the opening, in order: the padlock shakes, is torn off, the lid bursts, the colour pours out. */
  shake: number;
  rip: number;
  burst: number;
  flash: number;
  /** Seconds the flash takes to fade once it is at its brightest (one burst that fades, never a strobe). */
  fade: number;
  /** The shake: swings a second and degrees either way (well under three a second). */
  shakeHz: number;
  shakeDegrees: number;
  /** "Reduce flashing": the flash is this much dimmer and takes this many times longer to swell. */
  reducedAlpha: number;
  reducedSlow: number;
  /** Per rarity: how far the flash reaches (0..1 of the screen's shorter side), how bright (0..1), how many rays, how loud. */
  strength: Readonly<Record<Rarity, { reach: number; alpha: number; rays: number; volume: number; pitch: number }>>;
}

export interface CratesData {
  /** In Shop order. */
  defs: readonly CrateDef[];
  /**
   * Medals a duplicate turns into, per rarity: an item rolled when every item of its rarity is already owned. No value
   * is above the cheapest crate's price, so a duplicate never pays back more than the crate it came from cost.
   */
  duplicateMedals: Readonly<Record<Rarity, number>>;
  /** With every set complete, a crate may return at most this share of its price on average (the tests hold it). */
  duplicateMaxReturn: number;
  /**
   * Free crates from playing: one `crate` for every `firstWins` missions won for the first time (on any difficulty),
   * and `perCampaign` for each campaign completed for the first time. Counted from the save's progress, so nothing is
   * lost if they are switched on later.
   */
  free: { crate: CrateId; firstWins: number; perCampaign: number };
  /** Most crates of one type a save holds unopened. */
  maxHeld: number;
  /** Crates the admin panel's odds test opens in one run. */
  oddsTestRuns: number;
  opening: CrateOpeningTunables;
  /** Words of the Shop's crate section, the confirmation and the opening. `{…}` are filled in. */
  text: {
    heading: string;
    intro: string;
    buy: string;
    open: string;
    held: string;
    comingSoon: string;
    oddsHeading: string;
    guarantee: string;
    guaranteeNext: string;
    noGuarantee: string;
    complete: string;
    confirmTitle: string;
    confirmBody: string;
    confirmYes: string;
    confirmNo: string;
    skip: string;
    done: string;
    duplicate: string;
    newItem: string;
    freeEarned: string;
    freeEarnedMany: string;
  };
}

const p = (rarity: Rarity, percent: number): CrateOdds => ({ rarity, parts: Math.round(percent * 100) });

export const CRATES: CratesData = {
  defs: [
    {
      id: 'standard',
      name: 'Standard Crate',
      price: 350,
      odds: [p('common', 45.9), p('uncommon', 30), p('rare', 18), p('epic', 5), p('legendary', 1), p('mythic', 0.1)],
      guarantees: [
        { rarity: 'rare', every: 5 },
        { rarity: 'legendary', every: 30 },
      ],
      blurb: 'The everyday crate. Free crates earned by playing are these.',
      tint: null,
      available: true,
    },
    {
      id: 'premium',
      name: 'Premium Crate',
      price: 1000,
      odds: [p('common', 30), p('uncommon', 25), p('rare', 20), p('epic', 15), p('legendary', 8), p('mythic', 2)],
      guarantees: [
        { rarity: 'epic', every: 5 },
        { rarity: 'legendary', every: 15 },
      ],
      blurb: 'The best buy for an Epic.',
      tint: '#5f6b75',
      available: true,
    },
    {
      id: 'elite',
      name: 'Elite Crate',
      price: 3000,
      odds: [p('epic', 35), p('legendary', 45), p('mythic', 20)],
      guarantees: [],
      blurb: 'The best buy for a Legendary.',
      tint: '#6b4a2f',
      available: true,
    },
    {
      id: 'titan',
      name: 'Titan Crate',
      price: 5000,
      odds: [p('legendary', 60), p('mythic', 40)],
      guarantees: [],
      blurb: 'The best buy for a Mythic.',
      tint: '#2f3136',
      available: true,
    },
    {
      id: 'god',
      name: 'God Crate',
      price: 199_999,
      odds: [p('common', 0.01), p('secret', 99.99)],
      guarantees: [],
      blurb: 'For the commander who has everything else. Entirely sensible. Do not ask what is inside.',
      tint: '#b9a98a',
      available: false,
    },
  ],
  duplicateMedals: { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 240, mythic: 300, secret: 0, special: 0 },
  duplicateMaxReturn: 0.25,
  free: { crate: 'standard', firstWins: 3, perCampaign: 1 },
  maxHeld: 999,
  oddsTestRuns: 100_000,
  opening: {
    shake: 0.75,
    rip: 0.4,
    burst: 0.3,
    flash: 0.45,
    fade: 1.1,
    shakeHz: 2.5,
    shakeDegrees: 9,
    reducedAlpha: 0.45,
    reducedSlow: 2.5,
    strength: {
      common: { reach: 0.45, alpha: 0.55, rays: 6, volume: 0.5, pitch: 0.85 },
      uncommon: { reach: 0.55, alpha: 0.62, rays: 8, volume: 0.6, pitch: 0.92 },
      rare: { reach: 0.68, alpha: 0.7, rays: 10, volume: 0.7, pitch: 1 },
      epic: { reach: 0.82, alpha: 0.78, rays: 13, volume: 0.82, pitch: 1.08 },
      legendary: { reach: 1, alpha: 0.86, rays: 16, volume: 0.92, pitch: 1.16 },
      mythic: { reach: 1.2, alpha: 0.92, rays: 20, volume: 1, pitch: 1.24 },
      secret: { reach: 1.4, alpha: 0.95, rays: 24, volume: 1, pitch: 1.3 },
      special: { reach: 0.68, alpha: 0.7, rays: 10, volume: 0.7, pitch: 1 },
    },
  },
  text: {
    heading: 'Supply crates',
    intro: 'Each crate holds one thing to wear. Nothing in a crate changes how a battle plays. The chances are shown exactly.',
    buy: 'Buy',
    open: 'Open',
    held: '{n} held',
    comingSoon: 'Coming soon',
    oddsHeading: 'Chances',
    guarantee: '{rarity} or better at least every {every} crates',
    guaranteeNext: '{rarity} or better within the next {n}',
    noGuarantee: 'No guarantee: the chances are as shown.',
    complete: 'You own everything this crate can hold. It would only give medals back.',
    confirmTitle: 'Buy this crate?',
    confirmBody: '{name}: {price} medals. You have {medals}.',
    confirmYes: 'Buy for {price}',
    confirmNo: 'Not now',
    skip: 'Tap to skip',
    done: 'Done',
    duplicate: 'You already own every {rarity} item: {medals} medals instead.',
    newItem: 'New',
    freeEarned: 'Supply crate earned',
    freeEarnedMany: '{n} supply crates earned',
  },
};

/** The crate of this id, or undefined. */
export function crateDef(id: string): CrateDef | undefined {
  return CRATES.defs.find((c) => c.id === id);
}

/** "45.9%", "30%", "0.01%": a chance in parts of ODDS_PARTS as the Shop shows it, exactly. */
export function oddsPercent(parts: number): string {
  const whole = Math.floor(parts / 100);
  const frac = parts % 100;
  if (frac === 0) return `${whole}%`;
  return `${whole}.${frac % 10 === 0 ? String(frac / 10) : String(frac).padStart(2, '0')}%`;
}
