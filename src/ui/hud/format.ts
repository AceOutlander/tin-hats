/**
 * Pure helpers for the battle HUD: quantising, text formatting and joystick maths.
 * No DOM here, so the unit tests can run them in Node.
 */

/** Sweeps and bars are quantised to this many steps so the DOM is written at most STEPS times per fill. */
export const STEPS = 100;

const fracTable: string[] = [];
for (let i = 0; i <= STEPS; i++) fracTable.push(String(i / STEPS));

/** FRAC[q] is the CSS number for quantised step q ("0", "0.01" ... "1"), prebuilt so updates never build strings. */
export const FRAC: readonly string[] = fracTable;

/** Clamp a 0..1 fraction and quantise it to 0..STEPS. NaN and negatives give 0. */
export function quant(v: number): number {
  if (!(v > 0)) return 0;
  if (v >= 1) return STEPS;
  return Math.round(v * STEPS);
}

/** Health colour band for a quantised fraction: 2 = good, 1 = worn, 0 = critical. */
export function hpLevel(q: number): 0 | 1 | 2 {
  if (q > STEPS * 0.5) return 2;
  if (q > STEPS * 0.25) return 1;
  return 0;
}

/** Whole seconds shown on a countdown: rounds up so the clock reads 0:00 only when time is really out. */
export function clockSeconds(secondsLeft: number): number {
  if (!(secondsLeft > 0)) return 0;
  return Math.ceil(secondsLeft);
}

/** "m:ss" for a whole number of seconds. */
export function formatClock(wholeSeconds: number): string {
  const s = wholeSeconds > 0 ? Math.floor(wholeSeconds) : 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Income is cached in tenths of a supply per second; this is its label, e.g. 25 -> "+2.5/s". */
export function incomeTenths(perSec: number): number {
  if (!Number.isFinite(perSec)) return 0;
  return Math.round(perSec * 10);
}

export function formatIncome(tenths: number): string {
  const sign = tenths < 0 ? '-' : '+';
  const a = Math.abs(tenths);
  return `${sign}${Math.floor(a / 10)}.${a % 10}/s`;
}

/** The "Show FPS" readout, e.g. "60 fps · 16.7 ms avg · 33.4 max" (frames per second, then ms per frame over the last second). */
export function formatFps(fps: number, avgMs: number, worstMs: number): string {
  const f = Number.isFinite(fps) ? Math.round(fps) : 0;
  const a = Number.isFinite(avgMs) ? avgMs : 0;
  const w = Number.isFinite(worstMs) ? worstMs : 0;
  return `${f} fps · ${a.toFixed(1)} ms avg · ${w.toFixed(1)} max`;
}

/**
 * A label short enough for a narrow button: the full name when it fits,
 * otherwise its first word ("Assault Trooper" -> "Assault").
 */
export function shortName(name: string, maxChars: number): string {
  const n = name.trim();
  if (n.length <= maxChars) return n;
  const space = n.indexOf(' ');
  if (space >= 3) return n.slice(0, space);
  return n;
}

/** Longest label that fits a training or support button before it is cut to its first word. */
export const BUTTON_NAME_CHARS = 10;

/**
 * The name a training button shows for a unit kind's label (its era's short button name, else its full name).
 * tests/e2e/hud-labels.spec.ts holds every label of every nation, era and look to the button's width.
 */
export function trainButtonName(label: string): string {
  return shortName(label, BUTTON_NAME_CHARS);
}

/**
 * Joystick deflection for a horizontal offset of dx pixels from the stick centre.
 * Returns -1..1 with a dead zone in the middle, rounded to 0.05 so tiny finger
 * tremors do not flood the app with actions.
 */
export function stickValue(dx: number, radius: number, deadZone: number): number {
  if (!(radius > 0) || !Number.isFinite(dx)) return 0;
  let v = dx / radius;
  if (v > 1) v = 1;
  else if (v < -1) v = -1;
  const a = Math.abs(v);
  if (a <= deadZone) return 0;
  const scaled = (a - deadZone) / (1 - deadZone);
  const stepped = Math.round(scaled * 20) / 20;
  return v < 0 ? -stepped : stepped;
}

/** Fraction 0..1 of the way along a strip for a pointer at x, given the strip's left edge, width and inner padding. */
export function stripFrac(x: number, left: number, width: number, pad: number): number {
  const inner = width - pad * 2;
  if (!(inner > 0)) return 0;
  const f = (x - left - pad) / inner;
  if (f < 0) return 0;
  if (f > 1) return 1;
  return f;
}

/** Letters of one word the "Deploy at" button's place line holds at full size; a longer word is set smaller. */
export const DEPLOY_WORD_CHARS = 10;

/**
 * The "Deploy at" place line's size factor: 1, or smaller for a word longer than DEPLOY_WORD_CHARS (never below 0.7),
 * so a long name (Perelazovsky) is set a little smaller rather than broken or cut.
 */
export function deployPlaceFit(place: string): number {
  const longest = place.split(/\s+/).reduce((n, w) => Math.max(n, w.length), 0);
  return longest <= DEPLOY_WORD_CHARS ? 1 : Math.max(0.7, DEPLOY_WORD_CHARS / longest);
}
