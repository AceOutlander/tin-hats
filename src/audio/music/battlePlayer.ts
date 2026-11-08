/**
 * Plays a layered battle track (src/data/musicTracks) on the Music bus. Every layer of a section starts on the same
 * bar line through its own gain, so changing layer is a crossfade of gains on a bar line, never a cut. When a section
 * nears its end the next one is chosen (seeded, avoiding the last ones played; a quiet section or a rest of a few bars
 * now and then while the battle is calm; sometimes a second layer blended in softly) and started exactly on the bar
 * line, its predecessor's tail ringing over it. The battle end fades the layers out under a sting.
 *
 * Pieces arrive one by one while they render (add()); the music starts as soon as the opening section's build layer
 * is there, and a section is only chosen once its build layer is. All settings: MUSIC_BATTLE.player.
 */
import { MUSIC_BATTLE, MUSIC_LAYERS, type BattleTrackDef, type MusicLayer } from '../../data/musicBattle';
import { AUDIO } from '../../data/sounds';
import { barSeconds, introSection, resolveLayer, sectionSeconds, trackLayers, type BattlePiece, type StingName } from './battle';

type PlayerSettings = typeof MUSIC_BATTLE.player;

const CALM: readonly MusicLayer[] = ['build', 'prep'];
/** Seconds ahead the very first section is started (so its first note is not cut). */
const START_LEAD = 0.08;
/** Section history kept for choosing the next one. */
const HISTORY = 3;

export interface BattlePlayerStats {
  started: boolean;
  ended: boolean;
  /** The layer asked for (after the prep fallback) and the one actually up in the current section. */
  target: MusicLayer;
  active: MusicLayer;
  /** The current section's name ('rest' during a rest, '' before the start). */
  section: string;
  /** Gain of each layer now (0..its level), the player's fade 0..1, the blended layer. */
  gains: Record<MusicLayer, number>;
  fade: number;
  blend: MusicLayer | null;
  sectionsPlayed: number;
  rests: number;
  crossfades: number;
  /** Section indices in the order they were played (the last 64). */
  order: number[];
  sting: StingName | null;
}

interface Playing {
  source: AudioBufferSourceNode;
  end: number;
}

export class BattleMusicPlayer {
  readonly layers: MusicLayer[];
  private readonly buffers: (AudioBuffer | null)[][];
  private readonly stings: Record<StingName, AudioBuffer | null> = { victory: null, defeat: null };
  private ctx: BaseAudioContext | null = null;
  private out: GainNode | null = null;
  /** The bus the layers and the sting feed. */
  private dest: AudioNode | null = null;
  private readonly gains: GainNode[] = [];
  /** The level each layer gain was last told to go to. */
  private readonly wanted: number[] = [0, 0, 0, 0];
  private readonly playing: Playing[] = [];
  private target: MusicLayer = 'build';
  private active: MusicLayer = 'build';
  private blend: MusicLayer | null = null;
  private started = false;
  private ended = false;
  /** Current section (index, or -1 for a rest) and its bar grid; the next one once scheduled. */
  private current = -1;
  private sectionStart = 0;
  private sectionEnd = 0;
  private next: { section: number; start: number; end: number } | null = null;
  private readonly history: number[] = [];
  private sinceQuiet = 99;
  private sinceRest = 0;
  private sectionsPlayed = 0;
  private rests = 0;
  private crossfades = 0;
  private readonly order: number[] = [];
  private stingPlayed: StingName | null = null;
  private readonly statsOut: BattlePlayerStats;

  constructor(
    readonly def: BattleTrackDef,
    private readonly rng: () => number,
    private readonly P: PlayerSettings = MUSIC_BATTLE.player,
  ) {
    this.layers = trackLayers(def);
    this.buffers = def.sections.map(() => [null, null, null, null]);
    this.statsOut = {
      started: false,
      ended: false,
      target: 'build',
      active: 'build',
      section: '',
      gains: { build: 0, combat: 0, tense: 0, prep: 0 },
      fade: 0,
      blend: null,
      sectionsPlayed: 0,
      rests: 0,
      crossfades: 0,
      order: [],
      sting: null,
    };
  }

  /** A rendered piece arrived. */
  add(piece: BattlePiece, buffer: AudioBuffer): void {
    if (piece.sting) this.stings[piece.sting] = buffer;
    else if (piece.layer) this.buffers[piece.section][MUSIC_LAYERS.indexOf(piece.layer)] = buffer;
  }

  /** A rendered layer of a section, or null (debug hooks and the preview page). */
  buffer(section: number, layer: MusicLayer): AudioBuffer | null {
    return this.buffers[section]?.[MUSIC_LAYERS.indexOf(layer)] ?? null;
  }

  sting(name: StingName): AudioBuffer | null {
    return this.stings[name];
  }

  /** Bytes of sample memory held. */
  bytes(): number {
    let b = 0;
    const count = (buf: AudioBuffer | null): void => {
      if (buf) b += buf.length * buf.numberOfChannels * 4;
    };
    for (const row of this.buffers) row.forEach(count);
    count(this.stings.victory);
    count(this.stings.defeat);
    return b;
  }

  /** Hand over the context and the bus (the Music bus). */
  attach(ctx: BaseAudioContext, dest: AudioNode): void {
    if (this.out) return;
    this.ctx = ctx;
    this.dest = dest;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(dest);
    for (let i = 0; i < MUSIC_LAYERS.length; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(out);
      this.gains.push(g);
    }
    this.out = out;
  }

  /** The layer the battle asks for. Takes effect on the next bar line with a crossfade. */
  setTarget(layer: MusicLayer): void {
    const resolved = resolveLayer(this.def, layer);
    if (resolved === this.target) return;
    this.target = resolved;
    const ctx = this.ctx;
    if (!ctx || !this.started || this.ended) return;
    const now = ctx.currentTime;
    if (this.current < 0 && !CALM.includes(resolved) && this.next === null) {
      // A rest is cut short when the fighting starts: the next section comes in on the next bar line.
      this.sectionEnd = this.nextBar(now + this.P.lead);
      return;
    }
    if (this.current >= 0) this.choose(this.current, this.nextBar(now + this.P.lead), false);
  }

  /** Keep the sections coming. Call often (every frame is fine); it only does work near a section's end. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || this.ended) return;
    const now = ctx.currentTime;
    for (let i = this.playing.length - 1; i >= 0; i--) if (this.playing[i].end < now) this.playing.splice(i, 1);
    if (!this.started) {
      const first = this.firstReady();
      if (first < 0) return;
      this.started = true;
      const at = now + START_LEAD;
      const out = this.out.gain;
      out.cancelScheduledValues(now);
      out.setValueAtTime(0, now);
      out.linearRampToValueAtTime(this.P.level, now + this.P.fadeIn);
      this.begin(first, at);
      return;
    }
    if (this.next && now >= this.next.start) {
      const n = this.next;
      this.next = null;
      this.current = n.section;
      this.sectionStart = n.start;
      this.sectionEnd = n.end;
    }
    if (!this.next && now >= this.sectionEnd - this.P.lookahead) this.scheduleNext(Math.max(this.sectionEnd, now + START_LEAD));
  }

  /** The battle is over: the layers fade out and, if asked and rendered, the sting plays. True when a sting started. */
  end(won: boolean, sting: boolean): boolean {
    const ctx = this.ctx;
    if (this.ended || !ctx || !this.out) {
      this.ended = true;
      return false;
    }
    this.ended = true;
    const now = ctx.currentTime;
    this.fadeOut(now, this.P.stingFade);
    const name: StingName = won ? 'victory' : 'defeat';
    const buffer = this.stings[name];
    if (!sting || !buffer) return false;
    const g = ctx.createGain();
    g.gain.value = this.P.level * this.P.stingLevel;
    g.connect(this.dest ?? this.out);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(g);
    source.start(now + START_LEAD);
    this.playing.push({ source, end: now + START_LEAD + buffer.duration });
    this.stingPlayed = name;
    return true;
  }

  /** Fade everything out over `seconds` (0 = cut, for a frozen context) and stop. */
  stop(seconds: number): void {
    const ctx = this.ctx;
    this.ended = true;
    if (!ctx || !this.out) return;
    this.fadeOut(ctx.currentTime, seconds);
  }

  /** Start again from the top (a restarted mission): whatever plays stops, the buffers stay. */
  restart(): void {
    for (const p of this.playing) {
      try {
        p.source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.playing.length = 0;
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      for (const g of this.gains) {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0, now);
      }
      this.out?.gain.cancelScheduledValues(now);
      this.out?.gain.setValueAtTime(0, now);
    }
    this.wanted.fill(0);
    this.started = false;
    this.ended = false;
    this.current = -1;
    this.next = null;
    this.history.length = 0;
    this.blend = null;
    this.target = 'build';
    this.active = 'build';
    this.stingPlayed = null;
  }

  /** Let go of the buffers (sources still playing keep theirs until they stop). */
  dropBuffers(): void {
    for (const row of this.buffers) row.fill(null);
    this.stings.victory = null;
    this.stings.defeat = null;
  }

  /** Stop at once and let go of every buffer and node. */
  release(): void {
    for (const p of this.playing) {
      try {
        p.source.stop();
      } catch {
        // Already stopped.
      }
      p.source.disconnect();
    }
    this.playing.length = 0;
    for (const g of this.gains) g.disconnect();
    this.out?.disconnect();
    this.out = null;
    this.dest = null;
    this.ctx = null;
    this.gains.length = 0;
    for (const row of this.buffers) row.fill(null);
    this.stings.victory = null;
    this.stings.defeat = null;
    this.ended = true;
  }

  stats(): Readonly<BattlePlayerStats> {
    const s = this.statsOut;
    s.started = this.started;
    s.ended = this.ended;
    s.target = this.target;
    s.active = this.active;
    s.section = this.current >= 0 ? this.def.sections[this.current].name : this.started ? 'rest' : '';
    for (let i = 0; i < MUSIC_LAYERS.length; i++) s.gains[MUSIC_LAYERS[i]] = this.gains[i] ? this.gains[i].gain.value : 0;
    s.fade = this.out ? this.out.gain.value / this.P.level : 0;
    s.blend = this.blend;
    s.sectionsPlayed = this.sectionsPlayed;
    s.rests = this.rests;
    s.crossfades = this.crossfades;
    s.order = this.order.slice(-64);
    s.sting = this.stingPlayed;
    return s;
  }

  // --- inside ----------------------------------------------------------------

  private has(section: number, layer: MusicLayer): boolean {
    return this.buffers[section][MUSIC_LAYERS.indexOf(layer)] !== null;
  }

  private firstReady(): number {
    const intro = introSection(this.def);
    if (this.has(intro, 'build')) return intro;
    for (let i = 0; i < this.def.sections.length; i++) if (this.has(i, 'build')) return i;
    return -1;
  }

  /** The next bar line at or after `t` on the current grid. */
  private nextBar(t: number): number {
    const bar = barSeconds(this.def);
    return this.sectionStart + Math.max(0, Math.ceil((t - this.sectionStart) / bar - 1e-6)) * bar;
  }

  private begin(section: number, at: number): void {
    this.current = section;
    this.sectionStart = at;
    this.sectionEnd = at + sectionSeconds(this.def, section);
    this.play(section, at);
    this.choose(section, at, true);
  }

  private scheduleNext(at: number): void {
    const calm = CALM.includes(this.target);
    const R = this.P.rest;
    if (calm && this.sinceRest >= R.minGap && this.rng() < R.chance) {
      const bars = R.bars[0] + Math.floor(this.rng() * (R.bars[1] - R.bars[0] + 1));
      this.sinceRest = 0;
      this.rests++;
      this.next = { section: -1, start: at, end: at + bars * barSeconds(this.def) };
      return;
    }
    const section = this.pick(calm);
    if (section < 0) {
      // Nothing new is ready yet (a slow phone): play the current one again.
      const again = this.current >= 0 ? this.current : this.firstReady();
      if (again < 0) return;
      this.queue(again, at);
      return;
    }
    this.queue(section, at);
  }

  private queue(section: number, at: number): void {
    this.sinceRest++;
    this.next = { section, start: at, end: at + sectionSeconds(this.def, section) };
    this.play(section, at);
    this.choose(section, at, true);
  }

  /** Choose the next section: ready, not one of the last few, quiet ones now and then while calm; weighted by how long ago. */
  private pick(calm: boolean): number {
    const n = this.def.sections.length;
    const Q = this.P.quiet;
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < n; i++) {
      let w = 0;
      const s = this.def.sections[i];
      const recent = this.history.indexOf(i);
      if (this.has(i, 'build') && i !== this.current) {
        w = s.role === 'quiet' ? (calm && this.sinceQuiet >= Q.minGap ? Q.weight : 0) : 1;
        // Not one of the last few, unless there is nothing else.
        if (recent >= 0) w *= 0.05 * (recent + 1);
        // Sections with every layer ready are preferred while the rest still render.
        if (!this.layers.every((l) => this.has(i, l))) w *= 0.3;
      }
      weights.push(w);
      total += w;
    }
    if (total <= 0) return -1;
    let r = this.rng() * total;
    for (let i = 0; i < n; i++) {
      r -= weights[i];
      if (r <= 0 && weights[i] > 0) return i;
    }
    for (let i = n - 1; i >= 0; i--) if (weights[i] > 0) return i;
    return -1;
  }

  /** Start every rendered layer of a section at `at`, in sync. */
  private play(section: number, at: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.sectionsPlayed++;
    this.order.push(section);
    if (this.order.length > 256) this.order.splice(0, 128);
    this.history.unshift(section);
    if (this.history.length > HISTORY) this.history.length = HISTORY;
    this.sinceQuiet = this.def.sections[section].role === 'quiet' ? 0 : this.sinceQuiet + 1;
    for (const layer of this.layers) {
      const i = MUSIC_LAYERS.indexOf(layer);
      const buffer = this.buffers[section][i];
      if (!buffer) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gains[i]);
      source.start(at);
      this.playing.push({ source, end: at + buffer.duration });
    }
  }

  /**
   * Decide which layers are up in `section` from `at`: the target if this section has it rendered (else build), and
   * at a new section, sometimes a soft second layer while calm. Ramps the gains that change.
   */
  private choose(section: number, at: number, fresh: boolean): void {
    const target = this.has(section, this.target) ? this.target : 'build';
    const B = this.P.blend;
    let blend: MusicLayer | null = fresh ? null : this.blend;
    if (!CALM.includes(target)) blend = null;
    else if (fresh && this.rng() < B.chance && this.has(section, B.layer) && B.layer !== target) blend = B.layer;
    if (target !== this.active) this.crossfades++;
    this.active = target;
    this.blend = blend;
    const fade = this.P.crossfade[target];
    for (let i = 0; i < MUSIC_LAYERS.length; i++) {
      const layer = MUSIC_LAYERS[i];
      const level = layer === target ? this.def.layerLevel[layer] : layer === blend ? this.def.layerLevel[layer] * B.level : 0;
      if (Math.abs(level - this.wanted[i]) < 1e-6) continue;
      this.wanted[i] = level;
      this.ramp(this.gains[i].gain, at, level, fade);
    }
  }

  private ramp(p: AudioParam, at: number, to: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const v = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(v, now);
    p.setValueAtTime(v, Math.max(now, at));
    p.linearRampToValueAtTime(to, Math.max(now, at) + Math.max(0.01, seconds));
  }

  private fadeOut(now: number, seconds: number): void {
    const out = this.out;
    if (!out) return;
    const p = out.gain;
    const v = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(v, now);
    p.linearRampToValueAtTime(0, now + Math.max(0.005, seconds));
    const stopAt = now + Math.max(0.005, seconds) + AUDIO.stopPad;
    for (const pl of this.playing) {
      if (pl.end <= stopAt) continue;
      try {
        pl.source.stop(stopAt);
      } catch {
        // Some old browsers refuse a second stop(); it ends at its first.
      }
    }
    this.next = null;
  }
}
