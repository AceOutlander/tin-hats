/**
 * Scripted weather and time of day in the sim (FOUNDATIONS.md 4.7). The mission sets the start (MissionDef.weather,
 * timeOfDay, nightVisibility) and the director's weather, time and flare events change it. What it does, for both
 * sides alike (numbers in WEATHER_SIM, src/data/weather.ts):
 * - visibility caps the range at which direct-fire and hitscan weapons pick a target (src/sim/combat.ts); a flare
 *   lifts the cap over its stretch of ground for a while;
 * - fog, blizzard and night ground the aircraft call-ins (but the nation's night flyers);
 * - the blizzard slows men on foot and spoils long shots.
 * A change runs over `over` seconds: the sim switches at its midpoint, the view crossfades over the whole span.
 * A mission with none of it is clear by day (visibility 1, nothing grounded) and plays exactly as before.
 * No randomness: the random rain stays in the view (src/fx/weather.ts).
 */
import type { MissionDef, Side, SupportKind, TimeOfDay, WeatherKind } from '../data/schema';
import { WEATHER_SIM } from '../data/weather';
import type { BattleState, SkyState } from './types';
import type { World } from './world';

/** True if the mission scripts its weather: a starting weather or a weather event (in its events or a phase's). */
export function scriptsWeather(m: MissionDef): boolean {
  if (m.weather !== undefined) return true;
  if (m.events.some((e) => e.type === 'weather')) return true;
  return (m.phases ?? []).some((p) => (p.onEnter ?? []).some((e) => e.type === 'weather'));
}

/** The sky at battle creation. */
export function createSky(m: MissionDef): SkyState {
  const weather = m.weather ?? 'clear';
  const time = m.timeOfDay;
  const sky: SkyState = {
    scripted: scriptsWeather(m),
    weather,
    time,
    weatherFrom: weather,
    weatherTo: weather,
    weatherStart: 0,
    weatherOver: 0,
    timeFrom: time,
    timeTo: time,
    timeStart: 0,
    timeOver: 0,
    nightVisibility: m.nightVisibility ?? WEATHER_SIM.time.night,
    visibility: 1,
    infantrySpeed: 1,
    accuracyFar: 1,
    flares: [],
  };
  settle(sky);
  return sky;
}

/** Visibility of a weather and a time of day (the lower of the two). */
export function visibilityOf(weather: WeatherKind, time: TimeOfDay, nightVisibility: number = WEATHER_SIM.time.night): number {
  const w = WEATHER_SIM.visibility[weather];
  const t = time === 'night' ? nightVisibility : WEATHER_SIM.time[time];
  return w < t ? w : t;
}

/** Recompute what the current weather and time imply. */
function settle(sky: SkyState): void {
  sky.visibility = visibilityOf(sky.weather, sky.time, sky.nightVisibility);
  const blizzard = sky.weather === 'blizzard';
  sky.infantrySpeed = blizzard ? WEATHER_SIM.blizzard.infantrySpeed : 1;
  sky.accuracyFar = blizzard ? WEATHER_SIM.blizzard.accuracyFar : 1;
}

/** Start a weather change (the weather event): from what the sim has now to `to` over `over` seconds. */
export function changeWeather(w: World, to: WeatherKind, over: number): void {
  const s = w.state;
  const sky = s.sky;
  sky.weatherFrom = sky.weather;
  sky.weatherTo = to;
  sky.weatherStart = s.time;
  sky.weatherOver = over > 0 ? over : 0;
  sky.scripted = true;
  updateSky(w);
}

/** Start a change of the time of day (the time event). */
export function changeTime(w: World, to: TimeOfDay, over: number): void {
  const s = w.state;
  const sky = s.sky;
  sky.timeFrom = sky.time;
  sky.timeTo = to;
  sky.timeStart = s.time;
  sky.timeOver = over > 0 ? over : 0;
  updateSky(w);
}

/** A flare over x (the flare event): visibility 1 within width / 2 of x for `seconds`. */
export function fireFlare(w: World, x: number, side: Side, seconds?: number, width?: number, color: 'white' | 'green' = 'white'): void {
  const s = w.state;
  const half = (width ?? WEATHER_SIM.flare.width) / 2;
  s.sky.flares.push({ x, x0: x - half, x1: x + half, side, color, from: s.time, until: s.time + (seconds ?? WEATHER_SIM.flare.seconds) });
}

/** Every tick: a change past its midpoint takes effect, burnt-out flares go. */
export function updateSky(w: World): void {
  const s = w.state;
  const sky = s.sky;
  let changed = false;
  if (sky.weather !== sky.weatherTo && s.time >= sky.weatherStart + sky.weatherOver / 2 - 1e-9) {
    sky.weather = sky.weatherTo;
    changed = true;
  }
  if (sky.time !== sky.timeTo && s.time >= sky.timeStart + sky.timeOver / 2 - 1e-9) {
    sky.time = sky.timeTo;
    changed = true;
  }
  if (changed) settle(sky);
  const flares = sky.flares;
  for (let i = flares.length - 1; i >= 0; i--) if (s.time >= flares[i].until) flares.splice(i, 1);
}

/** True if a burning flare lights world x. */
export function flareLit(s: BattleState, x: number): boolean {
  const flares = s.sky.flares;
  for (let i = 0; i < flares.length; i++) {
    const f = flares[i];
    if (x >= f.x0 && x <= f.x1) return true;
  }
  return false;
}

/**
 * Why the side's aircraft of this call-in cannot fly now ('fog', 'blizzard', 'night'), or null if they can (or the
 * call-in is not flown). The HUD shows the reason on the button.
 */
export function airGrounded(s: BattleState, side: Side, kind: SupportKind): 'fog' | 'blizzard' | 'night' | null {
  if (!WEATHER_SIM.air.includes(kind)) return null;
  const sky = s.sky;
  if (WEATHER_SIM.groundedBy.includes(sky.weather)) return sky.weather as 'fog' | 'blizzard';
  if (sky.time === 'night') {
    const ok = WEATHER_SIM.nightAir[s.sides[side].faction];
    if (!ok || !ok.includes(kind)) return 'night';
  }
  return null;
}

/** 0..1 progress of the view's weather crossfade now (1 = done). */
export function weatherBlend(s: BattleState): number {
  const sky = s.sky;
  if (sky.weatherOver <= 0) return 1;
  const t = (s.time - sky.weatherStart) / sky.weatherOver;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** 0..1 progress of the view's time-of-day crossfade now (1 = done). */
export function timeBlend(s: BattleState): number {
  const sky = s.sky;
  if (sky.timeOver <= 0) return 1;
  const t = (s.time - sky.timeStart) / sky.timeOver;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}
