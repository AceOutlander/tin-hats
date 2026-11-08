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
  flam, rim, roll), hand (dum, tek), bell, anvil. Ranges are in the kit.
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
notes), `step` (scale steps). Orchestration is the part you put it in. The Soviet campaign gets its own motif later.

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
- The map track ("Between the Lines", `src/data/musicMap.ts`) renders when the campaign screen first opens and is freed
  when a battle starts.
