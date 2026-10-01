/**
 * The sounds the app itself plays for simulation events. Everything that
 * happens on the battlefield (shots, blasts, deliveries, order whistles, rain,
 * thunder, engines) is played by the renderer once view.setAudio(audio) is set;
 * what is left here is the end-of-battle sting, which the renderer has no reason to know about.
 */
import type { SimEvent } from '../sim';
import type { GameAudio } from '../audio';

export type SfxAudio = Pick<GameAudio, 'play'>;

/** Play the sound this event of the last tick deserves, if it is one of the app's. `playerSide` is the side the player commands. */
export function playEventSound(audio: SfxAudio, e: SimEvent, playerSide: number): void {
  switch (e.type) {
    case 'battleEnded':
      audio.play(e.side === playerSide ? 'victorySting' : 'defeatSting');
      break;
    default:
      break;
  }
}
