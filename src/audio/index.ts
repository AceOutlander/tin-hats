/**
 * Public surface of the audio track. See engine.ts for how it works.
 *
 *   const audio = createAudio({ muted: savedMute });
 *   window.addEventListener('pointerdown', () => audio.unlock());
 *   audio.setListener(cameraCentreX, visibleWidthWu);   // whenever the camera moves
 *   audio.playAt('rifleShot', shooterX);
 *   audio.play(ORDER_WHISTLE[order]);
 *   audio.startLoop('rain');
 *   audio.setVolume('ambience', 0.8);                   // the three sliders: music, ambience, sfx
 */
export { createAudio } from './engine';
export type { AudioOptions, AudioStats, BattleMusicStats, GameAudio, MixStats, MusicStats, PlayAtOptions, PlayOptions } from './engine';
export type { RenderedTrack } from './music';
export {
  AUDIO_BUSES,
  type AudioBus,
  LOOP_NAMES,
  ONE_SHOT_NAMES,
  ORDER_WHISTLE,
  SOUND_NAMES,
  UI_SOUND,
  isSoundName,
  type LoopName,
  type OneShotName,
  type SoundName,
} from '../data/sounds';
