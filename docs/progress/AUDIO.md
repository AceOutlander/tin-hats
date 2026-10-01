AUDIO track: DONE and verified.
Built: src/audio/{dsp,synth,render,engine,index}.ts, src/data/sounds.ts, dev/audio-preview.{html,ts}, tests/unit/audio-{engine,sounds}.test.ts.
Verified: 85 unit tests pass, eslint clean, tsc clean on audio paths, dev/audio-preview.html via tools/shot.ts --ready --strict: ALL PASS (29 sounds, 4 mix scenarios).
Resume fix: uiDeny second buzz is now a lower square so its measured pitch falls.
Next: nothing; integrator wires createAudio() into src/app.
