/**
 * The game's sound engine: synthesised WebAudio, no audio files.
 *
 * - Every one-shot sound is rendered once into a buffer after the first user
 *   gesture, so playing it costs a single buffer source. Until its buffer is
 *   ready (a fraction of a second) the same sound is built live from oscillators.
 * - A fixed pool of voice channels caps how many sounds overlap. When the pool
 *   is full the quietest voice is dropped; each sound also has its own rate
 *   limit and overlap limit, so a whole army firing stays clean.
 * - Everything runs through a compressor and a soft clipper, so the output can
 *   never clip.
 * - Without AudioContext (Node tests, old browsers) every method does nothing.
 *
 * The engine never touches storage: the app passes the saved mute setting in
 * and persists changes itself.
 */
import { MENU_STORM } from '../data/menuStorm';
import {
  AUDIO,
  LOOP_NAMES,
  LOOPS,
  ONE_SHOT_NAMES,
  SOUNDS,
  VOLUME,
  CATALOGUE_LEVEL,
  busOf,
  layerGainSum,
  volumeGain,
  type AudioBus,
  type LoopDef,
  type SoundDef,
} from '../data/sounds';
import { MUSIC, MUSIC_TRACKS, type MusicTrackName } from '../data/music';
import { MUSIC_BATTLE, type BattleTrackDef, type MusicLayer } from '../data/musicBattle';
import { BATTLE_TRACKS, type BattleTrackName } from '../data/musicTracks';
import { makeClipCurve, seededRandom } from './dsp';
import { MusicPlayer, renderTrack, type RenderedTrack } from './music';
import { battlePieces, renderBattlePiece, trackBytes, type BattlePiece, type RenderedPiece } from './music/battle';
import { BattleMusicPlayer, type BattlePlayerStats } from './music/battlePlayer';
import { findOfflineContext, renderSound } from './render';
import { buildThunder, RainBed } from './storm';
import { buildLoop, buildOneShot, createNoiseBank, type NoiseBank } from './synth';

export interface PlayOptions {
  /** Stereo position, -1 (left) to 1 (right). Default 0. */
  pan?: number;
  /** Level multiplier. Default 1. */
  volume?: number;
  /** Playback-rate multiplier. Default 1. */
  pitch?: number;
}

export interface PlayAtOptions {
  volume?: number;
  pitch?: number;
}

export interface AudioStats {
  /** One-shot voices sounding right now. */
  voices: number;
  /** One-shots started, refused (rate limit, voice limit, too quiet) and cut short for a louder sound, since creation. */
  played: number;
  dropped: number;
  stolen: number;
  /** Buffers rendered so far. */
  rendered: number;
  /** 'none' until the context exists, then the AudioContext state. */
  state: string;
}

/** The mix as the debug hooks and the tests read it. */
export interface MixStats {
  /** Gain each bus runs at now (its slider through the volume curve; 0 before the context exists). */
  music: number;
  ambience: number;
  sfx: number;
  /** The title rain bed: asked for, its own fade level now (0..1 of its data volume), and its level after the Ambience bus. */
  bedOn: boolean;
  bed: number;
  rain: number;
  /** Thunder rumbles synthesised so far. */
  thunders: number;
  /** RMS of what leaves the engine (after the mute), over the last few hundredths of a second. */
  output: number;
}

/** A music track's state, for the debug hooks and the tests. */
export interface MusicStats {
  /** The track asked for, or null. */
  wanted: string | null;
  /** The track playing now, or null (null as soon as it is stopped, while its fade-out finishes). */
  current: string | null;
  /** 'idle' (never asked), 'rendering', 'ready', 'failed' or 'unavailable' (no OfflineAudioContext). */
  render: string;
  /** True while a source is looping on the Music bus. */
  playing: boolean;
  /** The player's fade now, 0..1, and the level after the Music bus (fade x player level x bus gain). */
  fade: number;
  level: number;
  /** The rendered loop: seconds, sample rate, channels, bytes held and render time (0 until it is ready). */
  seconds: number;
  sampleRate: number;
  channels: number;
  bytes: number;
  renderMs: number;
  /** Main-thread milliseconds spent building the score's graph (the render itself runs on the audio thread). */
  buildMs: number;
}

/** The battle music's state, for the debug hooks and the tests (the same object every time). */
export interface BattleMusicStats {
  /** The track asked for, or null. */
  track: BattleTrackName | null;
  /** 'idle', 'waiting' (the render starts shortly after the battle loads), 'rendering', 'ready', 'failed' or 'unavailable'. */
  state: string;
  piecesReady: number;
  piecesTotal: number;
  /** Bytes of samples held now, and what the whole track will hold. */
  bytes: number;
  budgetBytes: number;
  /** Wall-clock ms from the first piece to the last, and to the first piece being ready. */
  renderMs: number;
  firstMs: number;
  /** The longest main-thread graph build of one piece and all of them together (ms). */
  buildMs: number;
  buildMsTotal: number;
  /** Loudest sample of any piece, and the rate they were rendered at. */
  peak: number;
  sampleRate: number;
  /** Tracks prepared and released since the engine was made. */
  prepared: number;
  released: number;
  player: Readonly<BattlePlayerStats> | null;
}

export interface AudioOptions {
  /** Start muted (the app passes its saved setting). */
  muted?: boolean;
  /** Renders a music track (tests inject one; default: renderTrack on the browser's OfflineAudioContext). */
  renderMusic?: (name: MusicTrackName) => Promise<RenderedTrack>;
  /** Renders one piece of a battle track (tests inject one; default: renderBattlePiece on the browser's OfflineAudioContext). */
  renderPiece?: (def: BattleTrackDef, piece: BattlePiece, rate: number) => Promise<RenderedPiece>;
  /** Waits between battle-music pieces (tests make it instant; default: a timer). */
  wait?: (ms: number) => Promise<void>;
  /** Random source in 0..1 for pitch spread and variations. Default Math.random. */
  random?: () => number;
  /** Use this context instead of creating one on unlock(). For tests and offline rendering. */
  context?: BaseAudioContext;
}

export interface GameAudio {
  /** Call from user gestures (safe to call on every one): creates and starts the audio context. */
  unlock(): void;
  /** Play a one-shot sound in the centre of the mix. Unknown names are ignored. */
  play(name: string, opts?: PlayOptions): void;
  /** Play a one-shot at a world x: panned across the screen and quieter the further off-screen it is. */
  playAt(name: string, worldX: number, opts?: PlayAtOptions): void;
  /** Tell the engine what the camera sees: the world x at the centre of the screen and the visible width in wu. */
  setListener(centerX: number, viewWidth: number): void;
  /** Fade a loop in, or move a running loop to a new volume (0..1, default 1). */
  startLoop(name: string, volume?: number): void;
  /** Fade a loop out and stop it. */
  stopLoop(name: string): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Set a bus's volume slider, 0..1 of its travel (the engine applies the volume curve and glides there). */
  setVolume(bus: AudioBus, level: number): void;
  /**
   * The title screen's rain bed on the Ambience bus. Asked for before the first gesture, it starts with the sound;
   * either way it fades in over the storm data's time and drifts at random while it plays.
   */
  startRainBed(): void;
  /** Fade the rain bed out (the storm data's time) and stop it. */
  stopRainBed(): void;
  /** Keep the rain bed's random drift scheduled; call once a frame while it plays. Allocates nothing. */
  tickRainBed(): void;
  /** One synthesised thunder rumble on the Ambience bus. False when it could not sound (no context, muted, frozen). */
  thunder(loudness: number, length: number): boolean;
  /** The buses, the rain bed and the output level (debug hooks and tests). The same object every time. */
  mixStats(): Readonly<MixStats>;
  /**
   * Render a music track (src/data/music.ts) in the background, once: OfflineAudioContext needs no gesture. When it
   * cannot be rendered the game carries on in silence.
   */
  prepareMusic(name: MusicTrackName): void;
  /**
   * Loop a track on the Music bus with a fade in; asked for before it is rendered (see prepareMusic) or before the first
   * gesture, it starts then.
   */
  startMusic(name: MusicTrackName): void;
  /** Fade the music out and stop it. */
  stopMusic(): void;
  musicStats(): Readonly<MusicStats>;
  /** A rendered track (debug hooks, the preview page and the tests), or null until it is ready. */
  musicTrack(name: MusicTrackName): RenderedTrack | null;
  /** Let go of a looping track's buffer (fading it out first if it plays); asked for again, it is rendered again. */
  releaseMusic(name: MusicTrackName): void;
  /**
   * Start rendering a battle track in the background, a piece at a time, a moment after the battle loads (any earlier
   * battle music is released first). Its build layer fades in as soon as the first section is ready.
   */
  prepareBattleMusic(name: BattleTrackName): void;
  /** The layer the battle asks for; it crossfades on the next bar line. */
  setBattleLayer(layer: MusicLayer): void;
  /** Keep the battle music's sections coming; call every frame (it does work only near a section's end). */
  tickBattleMusic(): void;
  /** The battle ended: the layers fade out under the sting (if `sting`). True when a battle-music sting started. */
  endBattleMusic(won: boolean, sting: boolean): boolean;
  /** Fade the battle music out and free its buffers. */
  releaseBattleMusic(): void;
  battleMusicStats(): Readonly<BattleMusicStats>;
  /** The battle music player (debug hooks and the preview page), or null. */
  battleMusic(): BattleMusicPlayer | null;
  /** Freeze all sound (pause, tab hidden). One-shots requested while suspended are discarded. */
  suspend(): void;
  resume(): void;
  /** Resolves when every buffer requested so far has been rendered. */
  whenReady(): Promise<void>;
  /** Live counters. The same object is returned every time. */
  getStats(): Readonly<AudioStats>;
}

type ContextCtor = new () => AudioContext;

function findContext(): ContextCtor | null {
  const scope = globalThis as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function timer(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ignore(): void {
  // Deliberately empty: a refused suspend or resume is harmless and retried on the next gesture.
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

interface Voice {
  gain: GainNode;
  pan: StereoPannerNode | null;
  sources: AudioScheduledSourceNode[];
  /** Index of the sound playing, for the per-sound overlap limit. */
  sound: number;
  priority: number;
  /** Peak level it was started at, and the gain set on the channel. */
  loud: number;
  level: number;
  start: number;
  end: number;
  /** True while a stolen voice fades out: it no longer counts against the limits. */
  releasing: boolean;
  /** Which bus the channel feeds (OUT_SFX, OUT_BED, OUT_MUSIC or OUT_AMBIENCE). */
  out: number;
}

/** Where a voice channel is routed: the sound-effects bus, the gunfire bed (which feeds it), music or ambience. */
const OUT_SFX = 0;
const OUT_BED = 1;
const OUT_MUSIC = 2;
const OUT_AMBIENCE = 3;

function outFor(def: SoundDef): number {
  const bus = busOf(def);
  if (bus === 'music') return OUT_MUSIC;
  if (bus === 'ambience') return OUT_AMBIENCE;
  return def.bed === true ? OUT_BED : OUT_SFX;
}

interface LoopState {
  def: LoopDef;
  /** Requested volume, or -1 when the loop should be silent. Remembered until the context exists. */
  wanted: number;
  gain: GainNode | null;
  sources: AudioScheduledSourceNode[];
}

class AudioEngine implements GameAudio {
  private contextCtor: ContextCtor | null;
  /** The real output context, when the engine created it. */
  private live: AudioContext | null = null;
  private ctx: BaseAudioContext | null = null;
  /** The sound-effects bus: every sound that is not music or ambience. */
  private bus: GainNode | null = null;
  /** The gunfire bed: small arms play through it, and blasts dip its gain (see SoundDef.duck). It feeds the sound-effects bus. */
  private bedBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private duckFloor = 1;
  private duckUntil = -Infinity;
  private muteGain: GainNode | null = null;
  /** Slider positions 0..1 per bus, remembered until the context exists. */
  private readonly volumes: Record<AudioBus, number> = {
    music: VOLUME.defaults.music / 100,
    ambience: VOLUME.defaults.ambience / 100,
    sfx: VOLUME.defaults.sfx / 100,
  };
  private bedWanted = false;
  private rainBed: RainBed | null = null;
  private thunders = 0;
  private analyser: AnalyserNode | null = null;
  private analysis: Float32Array<ArrayBuffer> | null = null;
  private readonly mix: MixStats = { music: 0, ambience: 0, sfx: 0, bedOn: false, bed: 0, rain: 0, thunders: 0, output: 0 };
  private readonly music = new MusicPlayer(MUSIC.player.level, MUSIC.player.fadeIn, MUSIC.player.fadeOut);
  private readonly tracks = new Map<MusicTrackName, RenderedTrack>();
  private readonly renders = new Map<MusicTrackName, string>();
  private readonly renderMusic: ((name: MusicTrackName) => Promise<RenderedTrack>) | null;
  private musicWanted: MusicTrackName | null = null;
  private readonly musicOut: MusicStats = { wanted: null, current: null, render: 'idle', playing: false, fade: 0, level: 0, seconds: 0, sampleRate: 0, channels: 0, bytes: 0, renderMs: 0, buildMs: 0 };
  private readonly renderPiece: ((def: BattleTrackDef, piece: BattlePiece, rate: number) => Promise<RenderedPiece>) | null;
  private readonly wait: (ms: number) => Promise<void>;
  private battle: BattleMusicPlayer | null = null;
  private battleGen = 0;
  private battleLayer: MusicLayer = 'build';
  private readonly battleOut: BattleMusicStats = {
    track: null,
    state: 'idle',
    piecesReady: 0,
    piecesTotal: 0,
    bytes: 0,
    budgetBytes: 0,
    renderMs: 0,
    firstMs: 0,
    buildMs: 0,
    buildMsTotal: 0,
    peak: 0,
    sampleRate: 0,
    prepared: 0,
    released: 0,
    player: null,
  };

  private readonly rng: () => number;
  private readonly bank: NoiseBank = createNoiseBank();
  private readonly soundIndex = new Map<string, number>();
  private readonly loopIndex = new Map<string, number>();
  private readonly defs: SoundDef[] = [];
  private readonly buffers: AudioBuffer[][] = [];
  /** Channel gain that brings a live-built sound to roughly its target level. */
  private readonly liveGain: number[] = [];
  /** Per sound: its bus's catalogue level (CATALOGUE_LEVEL), so it plays as mixed at the default sliders. */
  private readonly catalogue: number[] = [];
  private readonly lastTime: number[] = [];
  private readonly lastLoud: number[] = [];
  private readonly voices: Voice[] = [];
  private readonly loops: LoopState[] = [];

  private muted: boolean;
  private paused = false;
  private primed = false;
  private hasListener = false;
  private listenerX = 0;
  private listenerHalf = 1;
  /** Context time before which no sound starts (see AUDIO.warmup). */
  private warmUntil = 0;
  private ready: Promise<void> = Promise.resolve();
  private readonly stats: AudioStats = { voices: 0, played: 0, dropped: 0, stolen: 0, rendered: 0, state: 'none' };

  constructor(options: AudioOptions) {
    this.muted = options.muted === true;
    this.rng = options.random ?? Math.random;
    this.renderMusic = options.renderMusic ?? null;
    this.renderPiece = options.renderPiece ?? null;
    this.wait = options.wait ?? timer;
    this.contextCtor = options.context ? null : findContext();
    for (const name of ONE_SHOT_NAMES) {
      const def: SoundDef = SOUNDS[name];
      this.soundIndex.set(name, this.defs.length);
      this.defs.push(def);
      this.buffers.push([]);
      this.liveGain.push(def.volume / Math.max(def.volume, layerGainSum(def)));
      this.catalogue.push(CATALOGUE_LEVEL[busOf(def)]);
      this.lastTime.push(-Infinity);
      this.lastLoud.push(0);
    }
    for (const name of LOOP_NAMES) {
      this.loopIndex.set(name, this.loops.length);
      this.loops.push({ def: LOOPS[name], wanted: -1, gain: null, sources: [] });
    }
    if (options.context) {
      try {
        this.attach(options.context);
      } catch {
        this.ctx = null;
      }
    }
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = this.contextCtor;
      if (!Ctor) return;
      try {
        const created = new Ctor();
        this.attach(created);
        this.live = created;
      } catch {
        // No usable audio on this device: stay silent for good.
        this.contextCtor = null;
        this.ctx = null;
        return;
      }
    }
    const live = this.live;
    if (!live) return;
    if (!this.paused && live.state !== 'running') this.resumeContext(live);
    if (!this.primed) {
      // A silent one-sample buffer started inside the gesture unlocks audio on iOS.
      this.primed = true;
      try {
        const source = live.createBufferSource();
        source.buffer = live.createBuffer(1, 1, live.sampleRate);
        source.connect(live.destination);
        source.start(0);
      } catch {
        // Not fatal: resume() above is enough everywhere else.
      }
    }
  }

  play(name: string, opts?: PlayOptions): void {
    const index = this.soundIndex.get(name);
    if (index === undefined) return;
    this.trigger(index, opts?.volume ?? 1, opts?.pan ?? 0, opts?.pitch ?? 1);
  }

  playAt(name: string, worldX: number, opts?: PlayAtOptions): void {
    const index = this.soundIndex.get(name);
    if (index === undefined) return;
    let volume = opts?.volume ?? 1;
    let pan = 0;
    if (this.hasListener) {
      const offset = worldX - this.listenerX;
      const half = this.listenerHalf;
      pan = clamp(offset / half, -1, 1) * AUDIO.panWidth;
      const beyond = Math.abs(offset) - half;
      if (beyond > 0) {
        const ratio = beyond / (AUDIO.falloffWu * this.defs[index].reach);
        volume /= 1 + ratio * ratio;
      }
    }
    this.trigger(index, volume, pan, opts?.pitch ?? 1);
  }

  setListener(centerX: number, viewWidth: number): void {
    if (!(viewWidth > 0) || !Number.isFinite(centerX)) return;
    this.listenerX = centerX;
    this.listenerHalf = viewWidth / 2;
    this.hasListener = true;
  }

  startLoop(name: string, volume = 1): void {
    const index = this.loopIndex.get(name);
    if (index === undefined) return;
    const loop = this.loops[index];
    loop.wanted = clamp(volume, 0, 1);
    if (this.ctx) this.applyLoop(loop);
  }

  stopLoop(name: string): void {
    const index = this.loopIndex.get(name);
    if (index === undefined) return;
    const loop = this.loops[index];
    loop.wanted = -1;
    const ctx = this.ctx;
    const gain = loop.gain;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    let fade = loop.def.fadeOut;
    const live = this.live;
    if (live && live.state !== 'running') {
      // Time is frozen, so a fade would only play after resume. Cut it now instead.
      fade = 0;
      gain.disconnect();
    } else {
      this.holdParam(gain.gain, now);
      gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    const sources = loop.sources;
    for (let i = 0; i < sources.length; i++) this.stopSource(sources[i], now + fade + AUDIO.stopPad);
    sources.length = 0;
    loop.gain = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    const gain = this.muteGain;
    if (!ctx || !gain) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(muted ? 0 : 1, now, AUDIO.muteFade);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(bus: AudioBus, level: number): void {
    const v = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    this.volumes[bus] = v;
    const node = this.busNode(bus);
    const ctx = this.ctx;
    if (!node || !ctx) return;
    const now = ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(volumeGain(v * 100), now, VOLUME.glide);
  }

  private busNode(bus: AudioBus): GainNode | null {
    return bus === 'music' ? this.musicBus : bus === 'ambience' ? this.ambienceBus : this.bus;
  }

  startRainBed(): void {
    this.bedWanted = true;
    if (this.ctx) this.makeBed();
  }

  stopRainBed(): void {
    this.bedWanted = false;
    const bed = this.rainBed;
    if (!bed) return;
    this.rainBed = null;
    const live = this.live;
    // Time is frozen in a suspended context, so a fade would only play after resume: cut it now instead.
    bed.stop(live && live.state !== 'running' ? 0 : MENU_STORM.rainAudio.fadeOut);
  }

  tickRainBed(): void {
    if (this.rainBed) this.rainBed.drift(MENU_STORM.rainAudio.lookahead);
  }

  private makeBed(): void {
    const ctx = this.ctx;
    const dest = this.ambienceBus;
    if (!ctx || !dest) return;
    if (!this.rainBed) this.rainBed = new RainBed(ctx, dest, MENU_STORM.rainAudio.layers, this.rng, this.bank);
    this.rainBed.fadeTo(MENU_STORM.rainAudio.volume, MENU_STORM.rainAudio.fadeIn);
  }

  thunder(loudness: number, length: number): boolean {
    const ctx = this.ctx;
    const dest = this.ambienceBus;
    if (!ctx || !dest || this.muted || this.paused) return false;
    const live = this.live;
    if (live && live.state !== 'running') return false;
    if (!(loudness > 0) || !(length > 0)) return false;
    const now = ctx.currentTime;
    buildThunder(ctx, dest, now < this.warmUntil ? this.warmUntil : now, loudness, length, MENU_STORM.thunder.synth, this.rng, this.bank);
    this.thunders++;
    return true;
  }

  mixStats(): Readonly<MixStats> {
    const m = this.mix;
    m.music = this.musicBus ? this.musicBus.gain.value : 0;
    m.ambience = this.ambienceBus ? this.ambienceBus.gain.value : 0;
    m.sfx = this.bus ? this.bus.gain.value : 0;
    m.bedOn = this.bedWanted;
    m.bed = this.rainBed ? this.rainBed.level() / MENU_STORM.rainAudio.volume : 0;
    m.rain = m.bed * m.ambience;
    m.thunders = this.thunders;
    m.output = this.outputLevel();
    return m;
  }

  prepareMusic(name: MusicTrackName): void {
    if (this.renders.has(name)) return;
    const Offline = findOfflineContext();
    const render = this.renderMusic ?? (Offline ? (n: MusicTrackName) => renderTrack(MUSIC_TRACKS[n], Offline) : null);
    if (!render) {
      this.renders.set(name, 'unavailable');
      return;
    }
    this.renders.set(name, 'rendering');
    let pending: Promise<RenderedTrack>;
    try {
      pending = render(name);
    } catch {
      this.renders.set(name, 'failed');
      return;
    }
    pending.then(
      (track) => {
        // Let go of meanwhile (releaseMusic): the buffer is dropped.
        if (this.renders.get(name) !== 'rendering') return;
        this.tracks.set(name, track);
        this.renders.set(name, 'ready');
        this.applyMusic();
      },
      () => {
        // No music on this device: everything else carries on.
        if (this.renders.get(name) === 'rendering') this.renders.set(name, 'failed');
      },
    );
  }

  startMusic(name: MusicTrackName): void {
    // Rendering is started by prepareMusic (the app calls it once the first picture is up); until then this only
    // remembers what to play.
    this.musicWanted = name;
    this.applyMusic();
  }

  stopMusic(): void {
    this.musicWanted = null;
    const ctx = this.ctx;
    if (!ctx || !this.music.playing) return;
    const live = this.live;
    this.music.stop(ctx, live !== null && live.state !== 'running');
  }

  /** Start the wanted track once there is a context, a Music bus and a rendered buffer. */
  private applyMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    const name = this.musicWanted;
    if (!ctx || !bus || !name) return;
    const track = this.tracks.get(name);
    if (!track) return;
    const live = this.live;
    this.music.start(ctx, bus, name, track, live !== null && live.state !== 'running');
  }

  musicStats(): Readonly<MusicStats> {
    const m = this.musicOut;
    const name = this.musicWanted ?? (this.music.current as MusicTrackName | null);
    const track = name ? this.tracks.get(name) : undefined;
    m.wanted = this.musicWanted;
    m.current = this.music.current;
    m.render = name ? (this.renders.get(name) ?? 'idle') : 'idle';
    m.playing = this.music.playing;
    m.fade = this.music.fade();
    m.level = m.fade * MUSIC.player.level * (this.musicBus ? this.musicBus.gain.value : 0);
    m.seconds = track ? track.loopSeconds : 0;
    m.sampleRate = track ? track.sampleRate : 0;
    m.channels = track ? track.channels : 0;
    m.bytes = track ? track.bytes : 0;
    m.renderMs = track ? track.renderMs : 0;
    m.buildMs = track ? track.buildMs : 0;
    return m;
  }

  musicTrack(name: MusicTrackName): RenderedTrack | null {
    return this.tracks.get(name) ?? null;
  }

  releaseMusic(name: MusicTrackName): void {
    if (this.musicWanted === name) this.stopMusic();
    else if (this.music.current === name && this.ctx) {
      const live = this.live;
      this.music.stop(this.ctx, live !== null && live.state !== 'running');
    }
    this.tracks.delete(name);
    this.renders.delete(name);
  }

  // --- battle music ------------------------------------------------------------

  prepareBattleMusic(name: BattleTrackName): void {
    const same = this.battle;
    if (same && this.battleOut.track === name && this.battleOut.state !== 'failed') {
      // The same track again (a restart): keep what is rendered, start from the top.
      same.restart();
      same.setTarget(this.battleLayer);
      return;
    }
    this.releaseBattleMusic();
    const def = BATTLE_TRACKS[name];
    const gen = ++this.battleGen;
    const player = new BattleMusicPlayer(def, seededRandom(Math.floor(this.rng() * 0x7fffffff)));
    this.battle = player;
    if (this.ctx && this.musicBus) player.attach(this.ctx, this.musicBus);
    player.setTarget(this.battleLayer);
    const b = this.battleOut;
    b.track = name;
    b.state = 'waiting';
    b.piecesReady = 0;
    b.piecesTotal = battlePieces(def).length;
    b.bytes = 0;
    b.budgetBytes = trackBytes(def);
    b.renderMs = 0;
    b.firstMs = 0;
    b.buildMs = 0;
    b.buildMsTotal = 0;
    b.peak = 0;
    b.sampleRate = 0;
    b.prepared++;
    const Offline = findOfflineContext();
    const render = this.renderPiece ?? (Offline ? (d: BattleTrackDef, p: BattlePiece, rate: number) => renderBattlePiece(d, p, Offline, rate, now, this.bank) : null);
    if (!render) {
      b.state = 'unavailable';
      return;
    }
    void this.renderBattle(gen, def, player, render);
  }

  /** Render the pieces one at a time, a short wait between them; anything that arrives after a release is dropped. */
  private async renderBattle(gen: number, def: BattleTrackDef, player: BattleMusicPlayer, render: (d: BattleTrackDef, p: BattlePiece, rate: number) => Promise<RenderedPiece>): Promise<void> {
    const R = MUSIC_BATTLE.render;
    const b = this.battleOut;
    await this.wait(R.startDelayMs);
    if (gen !== this.battleGen) return;
    b.state = 'rendering';
    const started = now();
    let rate: number = R.sampleRate;
    for (const piece of battlePieces(def)) {
      let done: RenderedPiece | null = null;
      for (let attempt = 0; attempt < 2 && !done; attempt++) {
        try {
          done = await render(def, piece, rate);
        } catch {
          // A browser that will not render at this rate gets one more try at the fallback rate, on the first piece.
          if (attempt > 0 || b.piecesReady > 0 || rate === R.fallbackRate) break;
          rate = R.fallbackRate;
        }
      }
      if (gen !== this.battleGen) return;
      if (!done) {
        b.state = 'failed';
        return;
      }
      player.add(piece, done.buffer);
      b.piecesReady++;
      b.sampleRate = done.buffer.sampleRate;
      b.bytes = player.bytes();
      b.buildMs = Math.max(b.buildMs, done.buildMs);
      b.buildMsTotal += done.buildMsTotal;
      b.peak = Math.max(b.peak, done.peak);
      if (b.piecesReady === 1) b.firstMs = now() - started;
      player.tick();
      await this.wait(R.gapMs);
      if (gen !== this.battleGen) return;
    }
    b.renderMs = now() - started;
    b.state = 'ready';
  }

  setBattleLayer(layer: MusicLayer): void {
    this.battleLayer = layer;
    this.battle?.setTarget(layer);
  }

  tickBattleMusic(): void {
    this.battle?.tick();
  }

  endBattleMusic(won: boolean, sting: boolean): boolean {
    const player = this.battle;
    if (!player) return false;
    return player.end(won, sting);
  }

  releaseBattleMusic(): void {
    this.battleGen++;
    this.battleLayer = 'build';
    const player = this.battle;
    this.battle = null;
    const b = this.battleOut;
    b.track = null;
    b.state = 'idle';
    b.bytes = 0;
    b.piecesReady = 0;
    if (!player) return;
    b.released++;
    const live = this.live;
    const frozen = live !== null && live.state !== 'running';
    const fade = frozen ? 0 : MUSIC_BATTLE.player.fadeOut;
    player.stop(fade);
    // The buffers go now; the nodes once the fade is over.
    player.dropBuffers();
    setTimeout(() => player.release(), fade * 1000 + 250);
  }

  battleMusicStats(): Readonly<BattleMusicStats> {
    const b = this.battleOut;
    const p = this.battle;
    b.player = p ? p.stats() : null;
    if (p) b.bytes = p.bytes();
    return b;
  }

  battleMusic(): BattleMusicPlayer | null {
    return this.battle;
  }

  /** RMS of the engine's output; the analyser is only made the first time something asks. */
  private outputLevel(): number {
    const ctx = this.ctx;
    const tap = this.muteGain;
    if (!ctx || !tap || typeof ctx.createAnalyser !== 'function') return 0;
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      tap.connect(this.analyser);
      this.analysis = new Float32Array(this.analyser.fftSize);
    }
    const data = this.analysis;
    if (!data) return 0;
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  suspend(): void {
    this.paused = true;
    const live = this.live;
    if (!live || live.state === 'closed') return;
    try {
      live.suspend().catch(ignore);
    } catch {
      // Old implementations may throw instead of rejecting.
    }
  }

  resume(): void {
    this.paused = false;
    const live = this.live;
    if (live && live.state !== 'closed') this.resumeContext(live);
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  getStats(): Readonly<AudioStats> {
    const stats = this.stats;
    const ctx = this.ctx;
    let active = 0;
    if (ctx) {
      const now = ctx.currentTime;
      const voices = this.voices;
      for (let i = 0; i < voices.length; i++) {
        if (now < voices[i].end && !voices[i].releasing) active++;
      }
    }
    stats.voices = active;
    stats.state = ctx ? (this.live ? this.live.state : ctx.state) : 'none';
    return stats;
  }

  /** Builds the master chain and the voice pool on a new context, then starts rendering buffers and wanted loops. */
  private attach(ctx: BaseAudioContext): void {
    // Three buses, one per volume slider: sound effects (with the gunfire bed feeding it), music and ambience.
    const bus = ctx.createGain();
    const bedBus = ctx.createGain();
    bedBus.connect(bus);
    const musicBus = ctx.createGain();
    const ambienceBus = ctx.createGain();
    bus.gain.value = volumeGain(this.volumes.sfx * 100);
    musicBus.gain.value = volumeGain(this.volumes.music * 100);
    ambienceBus.gain.value = volumeGain(this.volumes.ambience * 100);
    let tail: AudioNode;

    if (typeof ctx.createDynamicsCompressor === 'function') {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = AUDIO.compressor.threshold;
      compressor.knee.value = AUDIO.compressor.knee;
      compressor.ratio.value = AUDIO.compressor.ratio;
      compressor.attack.value = AUDIO.compressor.attack;
      compressor.release.value = AUDIO.compressor.release;
      tail = compressor;
    } else {
      tail = ctx.createGain();
    }
    bus.connect(tail);
    musicBus.connect(tail);
    ambienceBus.connect(tail);

    // The clip curve spans inputs of +-clipRange, so the signal is scaled down into the shaper's -1..1 input.
    const master = ctx.createGain();
    const canClip = typeof ctx.createWaveShaper === 'function';
    master.gain.value = canClip ? AUDIO.masterGain / AUDIO.clipRange : AUDIO.masterGain;
    tail.connect(master);
    tail = master;
    if (canClip) {
      const clipper = ctx.createWaveShaper();
      clipper.curve = makeClipCurve();
      tail.connect(clipper);
      tail = clipper;
    }

    const muteGain = ctx.createGain();
    muteGain.gain.value = this.muted ? 0 : 1;
    tail.connect(muteGain);
    muteGain.connect(ctx.destination);

    const canPan = typeof ctx.createStereoPanner === 'function';
    const count = AUDIO.maxVoices + AUDIO.spareVoices;
    for (let i = 0; i < count; i++) {
      const gain = ctx.createGain();
      let pan: StereoPannerNode | null = null;
      if (canPan) {
        pan = ctx.createStereoPanner();
        gain.connect(pan);
        pan.connect(bus);
      } else {
        gain.connect(bus);
      }
      this.voices.push({
        gain,
        pan,
        sources: [],
        sound: -1,
        priority: 0,
        loud: 0,
        level: 0,
        start: 0,
        end: -Infinity,
        releasing: false,
        out: OUT_SFX,
      });
    }

    this.ctx = ctx;
    this.bus = bus;
    this.bedBus = bedBus;
    this.musicBus = musicBus;
    this.ambienceBus = ambienceBus;
    this.muteGain = muteGain;
    this.warmUntil = ctx.currentTime + AUDIO.warmup;
    this.ready = this.prerender(ctx.sampleRate);
    for (let i = 0; i < this.loops.length; i++) {
      if (this.loops[i].wanted >= 0) this.applyLoop(this.loops[i]);
    }
    if (this.bedWanted) this.makeBed();
    this.applyMusic();
    this.battle?.attach(ctx, musicBus);
  }

  /** Renders every one-shot (and its variants) one after another, most-used sounds first as listed in the data. */
  private prerender(sampleRate: number): Promise<void> {
    const Offline = findOfflineContext();
    if (!Offline) return Promise.resolve();
    let chain: Promise<void> = Promise.resolve();
    let most = 1;
    for (const def of this.defs) most = Math.max(most, def.variants);
    // First one buffer of everything, then the extra variants.
    for (let variant = 0; variant < most; variant++) {
      for (let index = 0; index < this.defs.length; index++) {
        const def = this.defs[index];
        if (variant >= def.variants) continue;
        chain = chain
          .then(() => renderSound(Offline, def, sampleRate, this.rng, this.bank))
          .then(
            (buffer) => {
              this.buffers[index].push(buffer);
              this.stats.rendered++;
            },
            // A failed render leaves the sound on the live fallback.
            ignore,
          );
      }
    }
    return chain;
  }

  private trigger(index: number, volume: number, pan: number, pitch: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.paused) return;
    const live = this.live;
    if (live && live.state !== 'running') return;

    const def = this.defs[index];
    const stats = this.stats;
    const loud = def.volume * volume;
    // Written so that NaN is also refused.
    if (!(loud >= AUDIO.minAudible)) {
      stats.dropped++;
      return;
    }
    const now = ctx.currentTime;
    if (now - this.lastTime[index] < def.minInterval && loud <= this.lastLoud[index] * AUDIO.overrideRatio) {
      stats.dropped++;
      return;
    }

    // One pass over the pool: find a free channel, count the voices in use and note the weakest candidates to drop.
    const voices = this.voices;
    let free = -1;
    let active = 0;
    let same = 0;
    let weakest = -1;
    let weakestScore = Infinity;
    let weakestSame = -1;
    let weakestSameScore = Infinity;
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      if (now >= voice.end) {
        if (free < 0) free = i;
        continue;
      }
      if (voice.releasing) continue;
      active++;
      // Sounds decay, so a voice counts for less the further through it is.
      const left = (voice.end - now) / (voice.end - voice.start);
      const score = voice.priority * AUDIO.priorityScore + voice.loud * left;
      if (score < weakestScore) {
        weakestScore = score;
        weakest = i;
      }
      if (voice.sound === index) {
        same++;
        if (score < weakestSameScore) {
          weakestSameScore = score;
          weakestSame = i;
        }
      }
    }

    const score = def.priority * AUDIO.priorityScore + loud;
    let victim = -1;
    if (same >= def.maxVoices) {
      if (score <= weakestSameScore) {
        stats.dropped++;
        return;
      }
      victim = weakestSame;
    } else if (active >= AUDIO.maxVoices) {
      if (score <= weakestScore) {
        stats.dropped++;
        return;
      }
      victim = weakest;
    }
    if (free < 0) {
      stats.dropped++;
      return;
    }
    if (victim >= 0) {
      this.release(voices[victim], now);
      stats.stolen++;
    }

    const voice = voices[free];
    const old = voice.sources;
    for (let i = 0; i < old.length; i++) old[i].disconnect();
    old.length = 0;
    this.route(voice, outFor(def));

    let rate = pitch;
    if (def.pitchJitter > 0) rate *= 1 + (this.rng() * 2 - 1) * def.pitchJitter;
    rate = clamp(rate, AUDIO.pitchMin, AUDIO.pitchMax);

    // Only the first sounds after the context starts are held back, by a few hundredths of a second.
    const when = now < this.warmUntil ? this.warmUntil : now;
    const variants = this.buffers[index];
    let level: number;
    let end: number;
    if (variants.length > 0) {
      const pick = variants.length === 1 ? 0 : Math.min(variants.length - 1, (this.rng() * variants.length) | 0);
      const buffer = variants[pick];
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(voice.gain);
      source.start(when);
      voice.sources.push(source);
      level = volume * this.catalogue[index];
      end = when + buffer.duration / rate;
    } else {
      level = volume * this.liveGain[index] * this.catalogue[index];
      end = buildOneShot(ctx, def, voice.gain, when, this.rng, this.bank, rate, voice.sources);
    }
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(level, now);
    if (voice.pan) voice.pan.pan.setValueAtTime(clamp(pan, -1, 1), now);

    voice.sound = index;
    voice.priority = def.priority;
    voice.loud = loud;
    voice.level = level;
    voice.start = when;
    voice.end = end;
    voice.releasing = false;
    this.lastTime[index] = now;
    this.lastLoud[index] = loud;
    stats.played++;
    if (def.duck) this.duckBed(def.duck.depth, def.duck.seconds, when);
  }

  /** Point a free channel at its bus (only when that changes: the channel is silent). */
  private route(voice: Voice, target: number): void {
    if (voice.out === target) return;
    const bus = target === OUT_BED ? this.bedBus : target === OUT_MUSIC ? this.musicBus : target === OUT_AMBIENCE ? this.ambienceBus : this.bus;
    if (!bus) return;
    const out: AudioNode = voice.pan ?? voice.gain;
    out.disconnect();
    out.connect(bus);
    voice.out = target;
  }

  /**
   * Dip the gunfire bed by `depth` from time `at` for `seconds`, then let it swell back. A second duck while one
   * is running only ever deepens or lengthens it, so a small blast cannot cut a big one's dip short.
   */
  private duckBed(depth: number, seconds: number, at: number): void {
    const gain = this.bedBus?.gain;
    if (!gain) return;
    let floor = 1 - depth;
    let until = at + seconds;
    if (at < this.duckUntil) {
      floor = Math.min(floor, this.duckFloor);
      until = Math.max(until, this.duckUntil);
      if (floor === this.duckFloor && until === this.duckUntil) return;
    }
    gain.cancelScheduledValues(at);
    gain.setTargetAtTime(floor, at, AUDIO.duckAttack);
    gain.setTargetAtTime(1, until, AUDIO.duckRelease);
    this.duckFloor = floor;
    this.duckUntil = until;
  }

  /** Fades a voice out quickly and frees its channel once the fade is over. */
  private release(voice: Voice, now: number): void {
    const fadeEnd = now + AUDIO.stealFade;
    const gain = voice.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(voice.level, now);
    gain.linearRampToValueAtTime(0, fadeEnd);
    const sources = voice.sources;
    for (let i = 0; i < sources.length; i++) this.stopSource(sources[i], fadeEnd);
    voice.end = fadeEnd + AUDIO.stopPad;
    voice.releasing = true;
  }

  private applyLoop(loop: LoopState): void {
    const ctx = this.ctx;
    const bus = this.busNode(busOf(loop.def));
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    let gain = loop.gain;
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, now);
      gain.connect(bus);
      buildLoop(ctx, loop.def, gain, now, this.rng, this.bank, loop.sources);
      loop.gain = gain;
    } else {
      this.holdParam(gain.gain, now);
    }
    gain.gain.linearRampToValueAtTime(loop.def.volume * loop.wanted * CATALOGUE_LEVEL[busOf(loop.def)], now + loop.def.fadeIn);
  }

  /** Freezes a parameter at whatever value its automation has reached, ready for a new ramp. */
  private holdParam(param: AudioParam, now: number): void {
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now);
    } else {
      const value = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    }
  }

  private stopSource(source: AudioScheduledSourceNode, when: number): void {
    try {
      source.stop(when);
    } catch {
      // Some old browsers refuse a second stop(); the source ends at its first one.
    }
  }

  private resumeContext(live: AudioContext): void {
    try {
      live.resume().catch(ignore);
    } catch {
      // Old implementations may throw instead of rejecting.
    }
  }
}

/**
 * Creates the sound engine. Nothing is allocated in the browser's audio system
 * until unlock() is called from a user gesture.
 */
export function createAudio(options: AudioOptions = {}): GameAudio {
  return new AudioEngine(options);
}
