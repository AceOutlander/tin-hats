# MENUS track progress

STATUS: COMPLETE. Only the integrator's build/e2e/commit remain.
- All screens, shell, lockdown, rotate overlay, confirm layer, campaignMap data, dev/ui-menus page done and reviewed at 568x320, 667x375, 844x390, 932x430 and portrait.
- Fixes in the resume pass: CSS margin reset via :where; briefing objective above the orders; difficulty tick corner badge; campaign map fits all pins on big phones/tablets (layoutPins/boxPan in screens/mapLayout.ts, fit* numbers in data/campaignMap.ts), pans on small phones; objective teaser on mission card; compact map header; title helmet spacing.
- Checks: eslint clean, tsc clean on my paths, tests/unit/ui-maplayout.test.ts 6/6, scratch audit (.tools/shots/menus/audit.ts) clean: touch targets >= 48px, no overflow, full flow, keyboard, lockdown, portrait overlay.
- Final shots: docs/screenshots/ui-*.png (title, campaign, briefing, quartermaster, result, result-defeat, settings, confirm, battle, rotate).
