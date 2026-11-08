/**
 * The music system: instruments that schedule notes on any BaseAudioContext, a generated dark reverb, renderTrack()
 * that renders a score from src/data/music.ts once into a seamlessly looping buffer, and the player that loops it on
 * the Music bus. The audio engine (../engine.ts) owns the rendered tracks and the player.
 */
export { makeImpulse, midiHz, playChoir, playDrum, playHorn, playPad, playPiano, playStringLead } from './instruments';
export { MusicPlayer, type LoopedTrack } from './player';
export { buildTrack, foldAndLevel, renderTrack, type RenderedTrack } from './render';
export { choirChords, drumBeats, inKey, instrumentRange, loopBeats, loopSeconds, scoreNotes, sectionTimes, secondsPerBeat, type ScoreChoirChord, type ScoreNote } from './score';
export {
  band,
  db,
  kWeight,
  loudestStart,
  loudestWindow,
  loudnessOf,
  peakOf,
  phoneSpeaker,
  rmsOf,
  seamOf,
  sumLoudness,
  type Loudness,
  type SeamReport,
} from './analyse';
export { measureMix, type ChainReport, type LoudnessReport, type MixReport } from './mix';
