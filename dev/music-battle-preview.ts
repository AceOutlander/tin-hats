/**
 * The battle tracks and the campaign map track on the music preview page: render a battle track piece by piece as the
 * game does (timings, memory, peaks), play it with the game's own player, switch layers live to hear the crossfades,
 * fire the stings, and measure the army of 80 against every layer. ?battle=<track> renders and measures on load and
 * sets window.__battle for scripts.
 */
import { createAudio } from '../src/audio';
import { MusicPlayer, renderTrack } from '../src/audio/music';
import { battlePieces, renderBattlePiece, trackBytes, distinctSeconds, type BattlePiece } from '../src/audio/music/battle';
import { measureBattleMix, type BattleMixReport } from '../src/audio/music/battleMix';
import { BattleMusicPlayer } from '../src/audio/music/battlePlayer';
import { db, peakOf, rmsOf } from '../src/audio/music';
import { findOfflineContext } from '../src/audio/render';
import { createNoiseBank } from '../src/audio/synth';
import { MUSIC, MUSIC_TRACKS } from '../src/data/music';
import { MUSIC_BATTLE, MUSIC_LAYERS, type MusicLayer } from '../src/data/musicBattle';
import { BATTLE_TRACKS, BATTLE_TRACK_NAMES, type BattleTrackName } from '../src/data/musicTracks';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing`);
  return node as T;
}

interface BattleReport {
  track: string;
  pieces: number;
  bytes: number;
  budgetBytes: number;
  distinctSeconds: number;
  renderMs: number;
  firstMs: number;
  buildMsMax: number;
  peakDb: number;
  rows: { piece: string; seconds: number; buildMs: number; renderMs: number; peakDb: number; rmsDb: number }[];
  mix: BattleMixReport | null;
}

let live: AudioContext | null = null;
let player: BattleMusicPlayer | null = null;
let loop: MusicPlayer | null = null;
let timer = 0;

function context(): AudioContext {
  if (!live) live = new AudioContext();
  void live.resume();
  return live;
}

function label(def: (typeof BATTLE_TRACKS)[BattleTrackName], p: BattlePiece): string {
  return p.sting ? `sting: ${p.sting}` : `${def.sections[p.section].name} / ${p.layer}`;
}

async function renderBattle(name: BattleTrackName, measure: boolean): Promise<BattleReport> {
  const Offline = findOfflineContext();
  if (!Offline) throw new Error('no OfflineAudioContext');
  const def = BATTLE_TRACKS[name];
  const next = new BattleMusicPlayer(def, Math.random);
  const bank = createNoiseBank();
  const rate = MUSIC_BATTLE.render.sampleRate;
  const report: BattleReport = { track: def.title, pieces: 0, bytes: 0, budgetBytes: trackBytes(def), distinctSeconds: distinctSeconds(def), renderMs: 0, firstMs: 0, buildMsMax: 0, peakDb: -120, rows: [], mix: null };
  const started = performance.now();
  const now = el('bnow');
  for (const p of battlePieces(def)) {
    const r = await renderBattlePiece(def, p, Offline, rate, () => performance.now(), bank);
    next.add(p, r.buffer);
    const data = r.buffer.getChannelData(0);
    report.rows.push({ piece: label(def, p), seconds: r.buffer.duration, buildMs: r.buildMs, renderMs: r.renderMs, peakDb: db(r.peak), rmsDb: db(rmsOf(data)) });
    report.pieces++;
    report.buildMsMax = Math.max(report.buildMsMax, r.buildMs);
    report.peakDb = Math.max(report.peakDb, db(r.peak));
    if (report.pieces === 1) report.firstMs = performance.now() - started;
    now.textContent = `Rendering ${def.title}: ${report.pieces} of ${battlePieces(def).length} pieces...`;
    await new Promise((ok) => setTimeout(ok, MUSIC_BATTLE.render.gapMs));
  }
  report.renderMs = performance.now() - started;
  report.bytes = next.bytes();
  if (measure) {
    const join = (layer: 'build' | 'combat' | 'tense'): Float32Array => {
      const parts = def.sections.map((_, i) => next.buffer(i, layer)).filter((b): b is AudioBuffer => b !== null);
      const out = new Float32Array(parts.reduce((n, b) => n + b.length, 0));
      let at = 0;
      for (const b of parts) {
        out.set(b.getChannelData(0), at);
        at += b.length;
      }
      return out;
    };
    const stingPeak = Math.max(peakOf(next.sting('victory')?.getChannelData(0) ?? new Float32Array(1)), peakOf(next.sting('defeat')?.getChannelData(0) ?? new Float32Array(1)));
    report.mix = await measureBattleMix(Offline, createAudio, def, { build: join('build'), combat: join('combat'), tense: join('tense') }, rate, stingPeak);
  }
  player?.release();
  player = next;
  show(report);
  return report;
}

function show(r: BattleReport): void {
  const out = el('bout');
  const summary = document.createElement('p');
  summary.textContent =
    `${r.track}: ${r.pieces} pieces, ${(r.bytes / 1e6).toFixed(1)} MB (budget ${(MUSIC_BATTLE.budget.maxBytes / 1e6).toFixed(0)} MB, computed ${(r.budgetBytes / 1e6).toFixed(1)} MB), ` +
    `${r.distinctSeconds.toFixed(0)} s of distinct music; rendered in ${(r.renderMs / 1000).toFixed(1)} s (first piece after ${r.firstMs.toFixed(0)} ms), ` +
    `longest graph build ${r.buildMsMax.toFixed(1)} ms; loudest piece ${r.peakDb.toFixed(1)} dBFS.`;
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>piece</th><th>s</th><th>build ms</th><th>render ms</th><th>peak dB</th><th>rms dB</th></tr>';
  for (const row of r.rows) {
    const tr = document.createElement('tr');
    for (const v of [row.piece, row.seconds.toFixed(1), row.buildMs.toFixed(1), row.renderMs.toFixed(0), row.peakDb.toFixed(1), row.rmsDb.toFixed(1)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(td);
    }
    table.append(tr);
  }
  const parts: HTMLElement[] = [summary];
  if (r.mix) {
    const m = document.createElement('p');
    m.className = r.mix.pass ? 'pass' : 'fail';
    m.textContent =
      `Army of 80 at default sliders: ${r.mix.army.fullLufs.toFixed(1)} LUFS full range, ${r.mix.army.phoneLufs.toFixed(1)} on a phone. Over each layer: ` +
      r.mix.layers.map((l) => `${l.layer} ${l.armyOverFull.toFixed(1)} / ${l.armyOverPhone.toFixed(1)} LU`).join(', ') +
      (r.mix.pass ? '. All mix targets met.' : `. Missed: ${r.mix.failures.join('; ')}`);
    parts.push(m);
  }
  parts.push(table);
  out.replaceChildren(...parts);
}

function enableLayers(on: boolean): void {
  for (const b of el('blayers').querySelectorAll('button')) (b as HTMLButtonElement).disabled = !on;
  el<HTMLButtonElement>('bstop').disabled = !on;
}

function stopAll(): void {
  if (player) player.stop(1);
  if (loop && live) loop.stop(live, false);
  window.clearInterval(timer);
}

function playBattle(): void {
  const p = player;
  if (!p) return;
  const ctx = context();
  p.attach(ctx, ctx.destination);
  p.restart();
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    p.tick();
    const s = p.stats();
    el('bnow').textContent =
      `section "${s.section}", asked ${s.target}, up ${s.active}${s.blend ? ` (+${s.blend})` : ''}; gains ` +
      MUSIC_LAYERS.map((l) => `${l} ${s.gains[l].toFixed(2)}`).join(' ') +
      `; fade ${s.fade.toFixed(2)}; ${s.sectionsPlayed} sections, ${s.rests} rests, ${s.crossfades} crossfades` +
      (s.sting ? `; sting ${s.sting}` : '');
  }, 100);
}

async function main(): Promise<void> {
  const select = el<HTMLSelectElement>('btrack');
  for (const name of BATTLE_TRACK_NAMES) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = `${name}: ${BATTLE_TRACKS[name].title}`;
    select.append(o);
  }
  el('brender').addEventListener('click', () => {
    void renderBattle(select.value as BattleTrackName, true).then(() => {
      enableLayers(true);
      playBattle();
    });
  });
  for (const b of el('blayers').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      const layer = (b as HTMLElement).dataset.layer as MusicLayer | undefined;
      const sting = (b as HTMLElement).dataset.sting;
      if (!player) return;
      if (layer) {
        if (player.stats().ended) playBattle();
        player.setTarget(layer);
      } else if (sting) {
        player.end(sting === 'victory', true);
      }
    });
  }
  el('bstop').addEventListener('click', stopAll);
  el('bmap').addEventListener('click', () => {
    const Offline = findOfflineContext();
    if (!Offline) return;
    el('bnow').textContent = 'Rendering the map track...';
    void renderTrack(MUSIC_TRACKS.map, Offline).then((track) => {
      const ctx = context();
      stopAll();
      loop = new MusicPlayer(MUSIC.player.level, MUSIC.player.fadeIn, MUSIC.player.fadeOut);
      loop.start(ctx, ctx.destination, 'map', track, false);
      el<HTMLButtonElement>('bstop').disabled = false;
      el('bnow').textContent =
        `Map track "${MUSIC_TRACKS.map.title}": ${track.loopSeconds.toFixed(1)} s, ${(track.bytes / 1e6).toFixed(1)} MB, rendered in ${track.renderMs.toFixed(0)} ms ` +
        `(graph ${track.buildMs.toFixed(0)} ms), peak before levelling ${track.rawPeak.toFixed(2)}.`;
    });
  });
  const auto = new URLSearchParams(window.location.search).get('battle') as BattleTrackName | null;
  if (auto && auto in BATTLE_TRACKS) {
    try {
      Reflect.set(window, '__battle', await renderBattle(auto, true));
    } catch (err) {
      Reflect.set(window, '__battleError', String(err));
    }
    Reflect.set(window, '__battleReady', true);
  }
}

void main();
