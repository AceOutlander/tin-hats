# Track verify3 (Phase 3 verification and visual QA)
Done: baseline checks (all green except e2e missions.spec mission 5 clock race: fixed in the spec, 4x for the last two minutes).
Sim: wave reserve under the pop cap (strict invariant restored), 'garrison' behaviour (m06, m08, m10 rear lines), aiPopCapMul by difficulty, tests/unit/sim-reserve.test.ts. Debug autopilot hook; tools/qa.ts --only=missions,campaign.
Trench art rebuilt as a pit cut into the ground in the theatre's earth (src/art/structures/trench.ts, palette via render/view.ts).
In progress: second capture round (.tools/shots/v3b) with the new trench art.
Next: review captures, fix, final captures to docs/screenshots/phase3-*.png, full checks, docs, commit.
