/**
 * The sounds the app itself plays for simulation events. Everything that
 * happens on the battlefield and has a picture (shots, blasts, deliveries,
 * order whistles, aircraft, rain, thunder, engines) is played by the renderer
 * once view.setAudio(audio) is set. What is left is played here: the things
 * the renderer draws silently (a trench taken, wire parting, a smoke canister,
 * a grenade leaving a hand, a pillbox giving way), the radio call of a
 * support, the end-of-battle sting, and the warnings (enemy wave, the clock).
 *
 * Which sound, and how loud, is data (EVENT_SOUND and SFX in src/data/sounds.ts).
 */
import type { GameAudio } from '../audio';
import { EVENT_SOUND, SFX } from '../data/sounds';
import type { SimEvent } from '../sim';

export type SfxAudio = Pick<GameAudio, 'play' | 'playAt' | 'endBattleMusic'>;

/** Play the sound this event of the last tick deserves, if it is one of the app's. `playerSide` is the side the player commands. */
export function playEventSound(audio: SfxAudio, e: SimEvent, playerSide: number): void {
  switch (e.type) {
    case 'battleEnded':
      // The battle music's own sting when it has one ready; the catalogue sting otherwise.
      if (!audio.endBattleMusic(e.side === playerSide, true)) audio.play(e.side === playerSide ? 'victorySting' : 'defeatSting');
      break;
    case 'trenchCaptured':
      // The same call for either side, lower and quieter when the enemy takes a trench.
      if (e.side === playerSide) audio.playAt(EVENT_SOUND.trenchCaptured, e.x);
      else audio.playAt(EVENT_SOUND.trenchCaptured, e.x, SFX.enemyCapture);
      break;
    case 'pointCaptured':
      // A capture point of open ground (one that is a trench has just sounded its trenchCaptured).
      if (e.hit) break;
      if (e.side === playerSide) audio.playAt(EVENT_SOUND.trenchCaptured, e.x);
      else audio.playAt(EVENT_SOUND.trenchCaptured, e.x, SFX.enemyCapture);
      break;
    case 'wireDestroyed':
      audio.playAt(EVENT_SOUND.wireDestroyed, e.x);
      break;
    case 'smokeSpawned':
      audio.playAt(EVENT_SOUND.smokeSpawned, e.x);
      break;
    case 'supportCalled':
      if (e.side === playerSide) audio.play(EVENT_SOUND.supportCalled);
      break;
    case 'projectile':
      // Only a grenade leaving a hand: shells and rockets have their launch sound from the renderer.
      if (e.weapon === 'grenade') audio.playAt(EVENT_SOUND.grenadeThrown, e.x);
      break;
    case 'structureDestroyed':
      if (e.target === 'pillbox') audio.playAt(EVENT_SOUND.pillboxDestroyed, e.x);
      break;
    default:
      break;
  }
}

/** The warning for an enemy wave. */
export function playWaveWarning(audio: SfxAudio): void {
  audio.play(EVENT_SOUND.waveWarning);
}

/** The King Tiger's arrival: a warning horn heard wherever the camera is. */
export function playBossWarning(audio: SfxAudio): void {
  audio.play(EVENT_SOUND.bossWarning);
}

/**
 * One tick of the clock for a mission timer with `secondsLeft` to go, louder in the last few seconds.
 * `lastTicked` is the whole second ticked last (-1 at the start); a second is ticked once. Returns the whole second
 * last ticked, which the caller keeps for the next call.
 */
export function playClockTick(audio: SfxAudio, secondsLeft: number, lastTicked: number): number {
  const whole = Math.ceil(secondsLeft);
  if (whole > SFX.tickSeconds || whole < 1 || whole === lastTicked) return lastTicked;
  audio.play(EVENT_SOUND.timerTick, whole <= SFX.loudSeconds ? { volume: SFX.loudTickVolume } : undefined);
  return whole;
}
