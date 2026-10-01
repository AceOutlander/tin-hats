# Track campaign (Phase 3: campaign flow, Quartermaster, difficulties, saving in the real game): DONE
Done: save v2 + migration + SaveRules clamping + fuzz tests; real UPGRADES in the app; darkness from timer.progress; airdrop and plain-wave banners; `{label}` deadline defeat text; difficulty remembered; map opens on the last mission; debug hooks unlockAll, setUpgrades, save, missions, result, state().upgrades/darkness; HUD objective wraps to two lines; Quartermaster descriptions without repeated percentages.
Tests: unit meta-save (32), app-campaign (27); browser campaign.spec.ts (13) and missions.spec.ts (10) plus the old specs: 70 browser tests green on a fresh build. Pictures docs/screenshots/e2e-campaign-*.png, e2e-mission-NN*.png looked at.
Checks on the final tree: typecheck, sim typecheck, lint (0 warnings), 42 unit files (634 tests), build, 70 browser tests.
Open: see docs/PROGRESS.md known issues (campaign line). DECISIONS 158 to 166.
