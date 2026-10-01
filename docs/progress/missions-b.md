# missions-b track (Phase 3: missions 7 to 10)
Done: m07 to m10 authored (layouts, garrisons, events, plans, briefings, hints) and first-pass tuned with scratch tools (.tools/trace.ts, .tools/batch.ts, not committed). Normal bot wins: m7 about 80%, m8 about 70%, m9 about 94%, m10 about 80%; idle loses every seed.
Findings that shape the data: garrisons in rear trenches walk to the forward-most owned trench on the first Hold tick (defence in depth must be pillboxes and wire); a big start army eats the pop cap (a King Tiger counts 8); artillery shreds stacked blobs; German artillery made m7 a 20 minute slog so only m10 gives the Germans supports; m7 and m10 give the player scripted forward reinforcement waves on trench captures (long walks from the HQ); survival difficulty is a cliff (m9 Normal 94%, Hard about 30%).
In progress: second tuning pass (m8 win rate, m10 length), then tests/balance/missions-b.test.ts, DECISIONS, final report.
Next: commit, tests, report.
