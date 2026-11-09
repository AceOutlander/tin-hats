# Music

All music is synthesised in code (no audio files) and rendered with OfflineAudioContext. Looping tracks (menu, campaign
map) use `TrackDef` in `src/data/music.ts`; battle tracks are layered `BattleTrackDef`s in `src/data/musicTracks/`.

## Battle track format (`src/data/musicBattle.ts`)

- A track is `bpm`, `beatsPerBar`, `tonic`, `layerLevel`, `gain`, instruments (start from `BATTLE_KIT` in
  `musicTracks/kit.ts`), `mix`, `reverb`, `sections` and two `stings` (victory, defeat; 3 to 10 s).
- A section is `{ name, bars, role, layers: { build, combat, tense, prep? } }`. Every layer is a list of
  `part(inst, events)`; events are `{ at, len, note, vel, art }` in beats from the section start. All layers of a
  section share its bars: the player starts them together on one bar line and crossfades their gains.
- Roles: one `intro` (plays first), `main` sections, at least one `quiet` (sparse; only chosen while calm).
- Instruments: strings (short, long, trem), brass (long, stab), horn, pad, timpani (hit, roll), snare (hit, ghost,
  flam, rim, roll), hand (dum, tek), bell, anvil, choir (a wordless vowel pad: sawtooths through formant band-passes,
  held notes) and wind (looping noise through a band-pass on the note that wanders and gusts, held notes). Ranges are
  in the kit. `mix.reverbHighpass` (optional, Hz) puts a high-pass on the reverb return: a bright room without boom.
- `prep` is optional: write it in every section for a defensive mission's prep phase, or leave it out and prep plays
  build.

## Composing a mission track (stage 2)

1. Copy `musicTracks/arras.ts` to `musicTracks/<name>.ts`. Keep its recipe functions (`buildLayer`, `combatLayer`,
   `tenseLayer`, `quietSection`) or write your own: change tempo, key, chords, patterns, instruments, mix and reverb
   to suit the setting (desert: dry reverb, `hand` drums; Italy: `bell`, longer reverb; Hill 112: `anvil`).
2. Write 6 to 9 sections of 8 bars: chords with `prog`, string ostinatos with `ostinato`, drums with `hits`/`tile`
   step patterns (`x X g f F r R - .`, `|` and spaces ignored), timpani on the harmony with `onRoots`, bass with `bass`,
   melody with `line` or `motif` (`src/data/musicKit.ts`). Every section must make sense after any other: start near
   the tonic, end open (dominant or a chord that leads anywhere).
3. Use the campaign motif in several forms across the sections and the stings (below).
4. Add the name to `BattleTrackName` in `src/data/schema.ts`, the def to `BATTLE_TRACKS` in `musicTracks/index.ts`, and
   set `music: '<name>'` in the mission file.
5. Check: `x.cmd npx vitest run tests/unit/music-battle.test.ts` (grid, ranges, 180 s distinct, budget) and
   `x.cmd npx tsx tools/battle-music-report.ts <name> --pieces` (render time, memory, peaks, mix against the army of 80;
   it must print PASS). Listen on `dev/music-preview.html` (Render, then the layer and sting buttons).
6. Everything original: no existing melody, march, bugle call, hymn, folk tune, film or game score.

## The British motif (`src/data/musicThemes.ts`)

"The Line": two bars in scale degrees (0 = tonic), dotted rhythms, rising a fifth and ending open on the fifth:
`0 (1.5) 4 (.5) 3 (.75) 4 (.25) 2 (1) | 1 (1.5) 2 (.5) 4 (2)`. Its answer comes home to the tonic. Call
`motif(BRITISH_MOTIF, form)` with `tonic` (key and register) and any of: `colour` (minor, harmonic, phrygian,
dorian, major for hope), `invert`, `retrograde`, `augment` (2 slower, 0.5 faster), `displace` (beats), `take` (first n
notes), `step` (scale steps). Orchestration is the part you put it in.

## The Soviet motif and the cold tracks (Stalingrad)

- "The Long Winter" (`SOVIET_MOTIF`, theme `sovietWinter`): three bars of 4/4 in natural minor,
  `0 (1) 0 (.5) -1 (.5) 0 (2) | 3 (1.5) 2 (.5) 4 (1) 1 (1) 2 (1) -3 (3)`, level on the tonic, up to the fifth, ending
  open on the low dominant. Its answer (`SOVIET_ANSWER`, one bar) climbs home: `-3 (.5) 0 (.5) 2 (1) 3 (.5) 0 (1.5)`.
  Motif and answer make a four-bar phrase, two to an eight-bar section. The brief's `3 2` after the fifth became `1 2`
  (its F A G F in D minor is a Korobeiniki phrase); `tests/unit/music-score.test.ts` guards Korobeiniki and Katyusha
  among the well-known tunes, and checks every track for its own campaign's motif (`def.theme`).
- Every Soviet track starts from `SOVIET_KIT`, `SOVIET_MIX` and `SOVIET_REVERB` (`musicTracks/sovietKit.ts`): glassy
  strings (narrow detune, bright, fast shallow tremolo, bow air), dark low brass in unison (root and octave, not
  chords), a straight muted horn, a celesta-like bell, a short high anvil, dry timpani, a tight martial snare, the choir
  and the wind; a long bright room with its low end cut (`reverbHighpass` 380 Hz). Open fifths and fourths in the
  harmony; the snare and the string ostinatos keep the drive.
- `volokolamsk` ("First Snow on the Highway", E minor, 120 BPM): the snow of 1941. Bell figures over string harmonics
  and the wind (build), a march snare under unison brass with the motif inverted in the horns (combat), a glassy
  tremolo and a heartbeat (tense), a slow timpani heartbeat under open fifths climbing bar by bar (prep), the choir in
  the wind (quiet, six bars). 27.7 MB, 368 s distinct, rendered in 11.6 s in headless Chromium (longest graph build
  18 ms).
- `factories` ("The Cold Furnaces", D minor, 136 BPM): the Stalingrad ruins. A low string ostinato in stacked diatonic
  fourths, the anvil on the off-beats, brass stabs and the motif in diminution hammered on anvil and brass (combat), a
  high cluster tremolo (tense), a slow metallic clank (prep), the choir and a draught through the halls (quiet).
  25.8 MB, 339 s distinct, rendered in 15.7 s (longest graph build 28 ms). For comparison, same machine: Arras 25.4 MB
  in 19.4 s, Dunkirk 27.3 MB in 20.8 s.
- `brest` ("Four in the Morning", D minor, 112 BPM): Brest Fortress at dawn, the one summer morning. Its groove is a
  3 + 3 + 2 grouping under every layer. A single high violin tremolo over distant timpani (the four-bar opening), a cold
  pulse of open fifths struck together (build), a driving snare with low brass stabs in the grouping and the motif on
  unison brass (combat), the high tremolo in octaves over a low pedal (tense), a ticking rim in the grouping over a
  string pedal that climbs a step every two bars (prep), the muted horn (darker horn settings) alone with the motif and
  its answer over choir and smoke (quiet, six bars); the defeat sting ends on a bare D-A fifth. 27.2 MB, 360 s
  distinct, rendered in 14.0 s (longest graph build 24 ms). Mix (army over it, full / phone): build 18.9 / 19.2, combat
  12.2 / 16.3, tense 15.0 / 19.0 LU.
- `dubno` ("Iron in the Rye", A minor, 132 BPM): the tank battle, heavy and mechanical. The tracks: a low string
  ostinato in sixteenths grinding on the root and the semitone above it, accented every third step against the bar,
  with the anvil clanking on the same three-step cycle (combat); idling in eighths under a heat shimmer of high strings
  on a narrower, quicker tremolo (build); a half-time backbeat and pounding timpani under the motif augmented to six
  bars on unison brass in octaves (combat); the treads breaking up under a high semitone shimmer and a ticking anvil
  (tense); the engines warming (prep); choir and wind at dusk (quiet). 26.5 MB, 349 s distinct, rendered in 12.9 s
  (longest graph build 16 ms). Mix: build 19.0 / 19.5, combat 11.1 / 15.7, tense 14.6 / 18.4 LU.
- `klin` ("Forty Below", F# minor, A major in the section "Klin", 126 BPM): the coldest and brightest. A gallop (an
  eighth and two sixteenths) on sleigh-like bells (short rings, a harder strike) over a pad of open fifths (build); the
  snare and timpani take the gallop up as a march that swells through each section while the low brass climb the
  motif's answer a step at a time (combat); the bells frozen to single strokes in the blizzard (tense); the forming-up
  in the forest, one bell a bar and the timpani breathing (prep); choir and wind in the birches (quiet, six bars). The
  brightest room (2.6 s, `brightHz` 6000). 26.6 MB, 350 s distinct, rendered in 9.7 s (longest graph build 17 ms).
  Mix: build 19.9 / 17.9, combat 12.0 / 15.3, tense 15.1 / 18.7 LU.
- `volga` ("The Far Bank", C minor, 118 BPM): the night crossing. The oars: a deep hand-drum stroke every two beats and
  two light ones on the recovery, under a low pad and the strings' slow measured tremolo swelling with each stroke, and
  far timpani falling irregularly like guns across the river (build, timpani further back in the room); the oars
  doubled, urgent bariolage strings, a running snare and the motif torn into three-note fragments thrown between brass
  and horn as well as whole on the strings (combat); a clock-like rim on every beat with a tick-tock on the bell (tense);
  dawn on the bank, a far chime every two bars (prep); choir and wind halfway across (quiet). The longest room (2.8 s).
  Its low register falls below a phone speaker, so its layers sit higher (`layerLevel` build 1.7, combat 1.12, tense
  1.5, prep 1.6). 27.0 MB, 358 s distinct, rendered in 14.5 s (longest graph build 19 ms). Mix: build 16.4 / 19.7,
  combat 13.1 / 16.2, tense 16.0 / 18.4 LU.
- The four later tracks share their small writing helpers (`leads`, `rep`, `spanBeats`, `windBand`) in
  `musicTracks/sovietParts.ts`. Render times are from one machine under load (the same track varies by up to 4 s from
  run to run); all are a third of the 45 s budget or less.
- `stalingradMap` ("Versts of Snow", `src/data/musicMapSoviet.ts`, A minor, 60 BPM, 128 s): the campaign map track,
  the motif on a glassy high piano, then the horn with its answer, once in C major, inverted at the end. 11.9 MB at
  22.05 kHz, rendered in 14.9 s ("Between the Lines": 10.9 MB in 16.3 s). Registered in `MUSIC_TRACKS`; the campaign
  select job plays it on the Stalingrad map.
- Which mission plays which: `STALINGRAD_MUSIC` in `src/data/musicCampaigns.ts` (`missions[id]` today, `planned[id]`
  for the brief's own track still to be written; see `docs/campaigns/STALINGRAD_BUILD.md`). A mission file sets
  `music: STALINGRAD_MUSIC.missions[1003]`.
- Every Stalingrad mission gets a track of its own: `tests/unit/music-soviet.test.ts` fails if two missions on their
  own tracks share one, if a mission file plays anything but its row of `STALINGRAD_MUSIC.missions`, or if two cold
  tracks fight on the same instruments in nearly the same groove (combat onsets per sixteenth, L1 distance under 0.2).
- Checks: `x.cmd npx vitest run tests/unit/music-soviet.test.ts`, the battle report as above, and for a looping track
  `x.cmd npx tsx tools/battle-music-report.ts stalingradMap --loop` (or `dev/music-preview.html?loop=stalingradMap`).

## Layer rules (`MUSIC_BATTLE.intensity`, `src/app/musicIntensity.ts`)

- combat: 20 or more armed soldiers on each side within 450 wu of the other front (ends below 14 a side). The fight is
  counted at every check, also while the music is tense, so combat after a threat needs 20 a side again.
- tense: player HQ hit in the last 8 s, an enemy within 650 wu of it (clear beyond 900), or a clock under 60 s.
- prep: `app.setPrepPhase(true)`; build otherwise. Tense outranks combat outranks prep.
- A change must be wanted 1 to 6 s (`confirm`); calming down waits the layer's `hold` (10 to 20 s), rising waits
  `escalateHold` (4 s). Crossfades of 3 to 6 s start on the next bar line. The battle end fades the layers under the
  sting (1.6 s). Sections are chosen at random among the ready ones, never the last few, with rests of 2 to 4 bars and a
  soft second layer now and then while calm.

## Budgets (`MUSIC_BATTLE.render` and `budget`)

- Mono at 16 kHz (22.05 kHz if a browser refuses); each piece (one layer of one section, or a sting) keeps 2 s of tail.
- At most 30 MB of samples per mission, at least 180 s of distinct material. Arras: 25.4 MB, 334 s.
- Rendered when the battle loads (0.9 s after), one piece at a time with 24 ms between pieces; the build layer starts
  as soon as the opening section's build piece is ready. Whole track at most 45 s in headless Chromium, no piece's graph
  build over 60 ms of main thread: a piece's notes are added to its graph 2 s of music at a time
  (`render.chunkSeconds`), each chunk while the offline render is suspended just before it, so a busy section is never
  one long task. Only the current mission's music is held; it is freed when the battle is left. The menu theme and the
  map track are let go of when a battle starts too (the title and the map render theirs again), and the reverb's room
  is kept for the current track only.
- Mix: the army of 80 over each layer at default sliders, full range and phone speaker: build 12 to 22 LU, combat
  8 to 18, tense 10 to 20 (`MUSIC_BATTLE.mix`, enforced by `tests/e2e/battle-music.spec.ts`).
- The map track (`src/data/musicMap.ts`, below) renders when the campaign screen first opens and is freed when a battle
  starts.

## The campaign map theme: "Roll of Honour" (`src/data/musicMap.ts`)

Slow, noble and hymn-like, remembering the men who served: warm and bittersweet, not grim like the menu requiem and not
driving like the battle music. Mood reference from the owner: the main theme of a WW2 television series; only the mood
was taken (slow hymn, solo brass over strings, wordless choir, one climax). Melody, harmony and rhythm are original.

- E flat major, 62 BPM, 4/4, 42 bars: 162.6 s before it repeats. Colour: the borrowed minor iv (A flat minor, its C flat
  the only note outside the key), iii and vi chords, a B flat sus4 before the dominant.
- Sections: **First light** (4 bars, the string pad and one soft line), **The horn** (8, the solo horn sings the main
  melody, two four-bar phrases ending open on the third), **Remembrance** (8, a higher second strain through A flat
  minor; the choir enters on "oo"), **The strings take it up** (8, the full strings in octaves carry the melody home,
  horn counter-line below, choir underneath), **The long climb** (4, a rising line, the choir opening from "oo" to "ah",
  a soft timpani roll on B flat), **Roll of honour** (6, the climax: the melody an octave up on strings and horn, full
  choir on "ah", timpani), **Quiet fields** (4, the horn far off with the opening phrase, the choir fading, home on E flat
  and straight back into the opening).
- Instruments (`TrackDef.instruments`): the string pad (sawtooths, per-chord swell, `kRate` sweeps), a solo horn with a
  swell on long notes (`HornSettings.swell`), a string section on the melody (`strings`: detuned sawtooths, slow bowed
  attack, late vibrato, swell; `MusicSection.strings`), a wordless choir (`choir`: buzzy detuned sawtooths through
  three band-pass formants that glide from "oo" to "ah", one formant set per chord; `MusicSection.choir` chords with a
  `vowel` pair) and a tuned timpani with rolls (`DrumHit.roll`, `DrumSettings.roll`).
- Render: mono 22.05 kHz, 15.0 MB, about 7.5 s in headless Chromium (the menu theme 4.5 s): the graph is built 4 s of
  music at a time while the offline render is suspended (`TrackDef.chunk`), since a graph holding every note of a long
  track renders about three times slower; the first chunk is 17 ms of main thread. Pad chords share one filter pair
  (`playPadChord`), and the strings' and choir's sweeps and vibrato run at k-rate. -18.1 LUFS full range, -20.7 on a
  phone; the climax is the loudest section, the opening and the end about 9 and 7 dB under it.
  `tools/music-loop-report.ts map [--stems] [--wav <dir> --clip name:from:to]` prints length, memory, render time,
  loudness, the seam and every section's (and every instrument's) level, and writes WAVs to listen to.
- Checks: `tests/unit/music.test.ts` (key, ranges, the brief's shape, a deterministic graph within a node budget, the
  Music bus), `tests/unit/music-score.test.ts` (no well-known tune) and `tests/e2e/battle-music.spec.ts` (rendered in the
  browser: length, peak, seam, section levels, memory, graph-build time).
