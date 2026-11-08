/**
 * A looping track (the menu theme or the campaign map track) in numbers, for composing and tuning src/data/music.ts and
 * src/data/musicMap.ts without a browser window: renders it in headless Chromium exactly as the game does and prints
 * the loop length, memory, render and graph-build times, peak, loudness (full range and through the phone speaker
 * model), the loop seam and every section's level. --stems renders each instrument alone too and prints its level per
 * section (as heard in the full mix, before the shared levelling), to balance the parts. --wav <dir> writes the whole
 * loop as a 16-bit mono WAV plus any clips asked for with --clip <name>:<from s>:<to s> (a clip may run past the loop
 * end and wraps round to the start, so the seam can be heard), at the track's own sample rate.
 *
 *   x.cmd npx tsx tools/music-loop-report.ts [menu|map] [--stems] [--wav <dir>] [--clip seam:150:175 ...]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface SectionReport {
  name: string;
  start: number;
  end: number;
  rmsDb: number;
  peakDb: number;
  lufs: number;
}

interface LoopReport {
  title: string;
  seconds: number;
  sampleRate: number;
  bytes: number;
  renderMs: number;
  buildMs: number;
  rawPeak: number;
  peak: number;
  rmsDb: number;
  lufs: number;
  phoneLufs: number;
  momentaryMax: number;
  shortTermMax: number;
  seam: { step: number; localStep: number; rmsBefore: number; rmsAfter: number };
  sections: SectionReport[];
  stems: { instrument: string; sections: number[] }[];
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createNetServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => ok(port));
    });
  });
}

/** Runs in the page (a string, so the bundler of this script never sees the browser-side imports). */
const PAGE_CODE = `async (args) => {
  const music = await import('/src/audio/music/index.ts');
  const data = await import('/src/data/music.ts');
  const render = await import('/src/audio/render.ts');
  const Offline = render.findOfflineContext();
  if (!Offline) throw new Error('no OfflineAudioContext');
  const def = data.MUSIC_TRACKS[args.track];
  const track = await music.renderTrack(def, Offline);
  const rate = track.sampleRate;
  const frames = track.loopFrames;
  const all = track.buffer.getChannelData(0);
  const loop = all.subarray(0, frames);
  const db = music.db;
  const loud = music.loudnessOf(loop, rate);
  const phone = music.loudnessOf(music.phoneSpeaker(loop, rate, data.MUSIC.mix.phone), rate);
  const times = music.sectionTimes(def);
  const sections = times.map((s) => {
    const a = Math.round(s.start * rate);
    const b = Math.min(frames, Math.round(s.end * rate));
    return { name: s.name, start: s.start, end: s.end, rmsDb: db(music.rmsOf(loop, a, b)), peakDb: db(music.peakOf(loop, a, b)), lufs: music.loudnessOf(loop.subarray(a, b), rate).integrated };
  });
  const stems = [];
  if (args.stems) {
    // Each instrument alone, scaled back to where it sits before the full mix was levelled.
    const scale = def.peak / track.rawPeak;
    const keep = (s, inst) => ({
      ...s,
      chords: inst === 'pad' ? s.chords : [],
      horn: inst === 'horn' ? s.horn : [],
      piano: inst === 'piano' ? s.piano : [],
      drums: inst === 'drum' ? s.drums : [],
      strings: inst === 'strings' ? s.strings : [],
      choir: inst === 'choir' ? s.choir : [],
    });
    for (const inst of ['pad', 'horn', 'piano', 'strings', 'choir', 'drum']) {
      const used = def.sections.some((s) => (inst === 'pad' ? s.chords : inst === 'drum' ? s.drums : s[inst] ?? []).length > 0);
      if (!used) continue;
      const solo = await music.renderTrack({ ...def, sections: def.sections.map((s) => keep(s, inst)) }, Offline);
      const d = solo.buffer.getChannelData(0);
      const k = (solo.rawPeak / def.peak) * scale;
      stems.push({ instrument: inst, sections: times.map((s) => db(k * music.rmsOf(d, Math.round(s.start * rate), Math.min(frames, Math.round(s.end * rate))))) });
    }
  }
  const clips = {};
  if (args.wav) {
    const pcm = (from, to) => {
      const a = Math.round(from * rate);
      const b = Math.round(to * rate);
      const out = new Int16Array(Math.max(0, b - a));
      for (let i = a; i < b; i++) out[i - a] = Math.max(-32767, Math.min(32767, Math.round(loop[((i % frames) + frames) % frames] * 32767)));
      let s = '';
      const bytes = new Uint8Array(out.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
    clips.loop = pcm(0, frames / rate);
    for (const c of args.clips) clips[c.name] = pcm(c.from, c.to);
  }
  return {
    report: {
      title: def.title,
      seconds: track.loopSeconds,
      sampleRate: rate,
      bytes: track.bytes,
      renderMs: track.renderMs,
      buildMs: track.buildMs,
      rawPeak: track.rawPeak,
      peak: music.peakOf(loop),
      rmsDb: db(music.rmsOf(loop)),
      lufs: loud.integrated,
      phoneLufs: phone.integrated,
      momentaryMax: loud.momentaryMax,
      shortTermMax: loud.shortTermMax,
      seam: music.seamOf(all, frames, rate),
      sections,
      stems,
    },
    clips,
  };
}`;

/** A 16-bit mono PCM WAV file. */
function wav(pcm: Buffer, rate: number): Buffer {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const track = argv.find((a, i) => !a.startsWith('--') && !['--wav', '--clip'].includes(argv[i - 1] ?? '')) ?? 'map';
  const wavAt = argv.indexOf('--wav');
  const wavDir = wavAt >= 0 ? argv[wavAt + 1] : null;
  const clips: { name: string; from: number; to: number }[] = [];
  argv.forEach((a, i) => {
    if (argv[i - 1] !== '--clip') return;
    const [name, from, to] = a.split(':');
    clips.push({ name, from: Number(from), to: Number(to) });
  });
  const port = await freePort();
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    clearScreen: false,
    cacheDir: resolve(ROOT, '.tools', 'vite-cache', `loop-${process.pid}`),
    server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
  });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/package.json`);
    const run = `(${PAGE_CODE})(${JSON.stringify({ track, stems: argv.includes('--stems'), wav: wavDir !== null, clips })})`;
    const out = (await page.evaluate(run)) as { report: LoopReport; clips: Record<string, string> };
    const r = out.report;
    const f = (n: number): string => n.toFixed(1);
    console.log(`${r.title}: ${f(r.seconds)} s at ${r.sampleRate} Hz, ${(r.bytes / 1e6).toFixed(2)} MB; rendered in ${r.renderMs.toFixed(0)} ms (graph ${r.buildMs.toFixed(0)} ms)`);
    console.log(`peak ${r.peak.toFixed(3)} (raw ${r.rawPeak.toFixed(3)}), rms ${f(r.rmsDb)} dB; ${f(r.lufs)} LUFS full range, ${f(r.phoneLufs)} on a phone; momentary max ${f(r.momentaryMax)}, short-term max ${f(r.shortTermMax)}`);
    console.log(`seam step ${r.seam.step.toExponential(2)} (largest nearby ${r.seam.localStep.toExponential(2)}), rms ${f(20 * Math.log10(r.seam.rmsBefore))} / ${f(20 * Math.log10(r.seam.rmsAfter))} dB`);
    for (const s of r.sections) console.log(`  ${s.name.padEnd(28)} ${f(s.start).padStart(6)} to ${f(s.end).padStart(6)} s  rms ${f(s.rmsDb).padStart(6)}  peak ${f(s.peakDb).padStart(6)}  ${f(s.lufs).padStart(6)} LUFS`);
    if (r.stems.length > 0) {
      console.log(`stems (rms dB per section, as mixed): ${r.sections.map((s) => s.name).join(' | ')}`);
      for (const st of r.stems) console.log(`  ${st.instrument.padEnd(8)} ${st.sections.map((v) => f(v).padStart(6)).join(' ')}`);
    }
    if (wavDir) {
      mkdirSync(wavDir, { recursive: true });
      for (const [name, b64] of Object.entries(out.clips)) {
        const path = join(wavDir, `${track}-${name}.wav`);
        writeFileSync(path, wav(Buffer.from(b64, 'base64'), r.sampleRate));
        console.log(`wrote ${path}`);
      }
    }
    if (errors.length > 0) console.log(`page errors: ${errors.join('; ')}`);
    return errors.length === 0 ? 0 : 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
