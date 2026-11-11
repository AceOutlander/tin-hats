# Tin Hats

A 2D side-view WW2 real-time strategy game for phone browsers: TypeScript, Vite, Phaser 4.2.1, installable as a PWA.
Published at https://hunteracedev.com/tin-hats/ from the public GitHub repo `AceOutlander/tin-hats`.
An older copy of this project in a cloud-synced folder is stale and must not be edited.

## Start here

1. `docs/PROGRESS.md`: what is done, what is in progress, what is next, known issues. Carry on from "In progress" and "Next".
2. `docs/PLAN.md` (architecture and phases), `docs/DESIGN.md` (rules), `docs/DECISIONS.md` (choices made for the owner).
3. `docs/AGENT_GUIDE.md`: working rules for anyone, human or agent, changing this repo.

## Running commands

Node is not installed on this PC. A portable copy lives in `.tools` (git-ignored), and every npm command goes through
the wrapper, which also puts a portable git and the Playwright browser on PATH:

```powershell
.\x.cmd npm run typecheck
.\x.cmd npm run lint
.\x.cmd npm run test:unit
.\x.cmd npm run test:balance
.\x.cmd npm run build
.\x.cmd npm run test:e2e      # about 40 minutes: real battles in headless Chromium
.\x.cmd git status --short
```

Git for Windows and the GitHub CLI (`gh`, signed in as AceOutlander) are also installed system-wide.
The shell is Windows PowerShell 5.1 (no `&&`). Never install anything globally and stay inside this folder.

## Push to live

"Push to live" means publishing the current game to https://hunteracedev.com/tin-hats/. Do it only when the owner says
so, and follow every step:

0. **Bump the version** (the game is in beta, numbered 0.X.Y; owner, 2026-11-08): in `package.json` (and the top of
   `package-lock.json`) raise the middle number for an update with any new feature, or the last number for a
   bug-fix-only update, and put a new entry first in `WHATS_NEW` in `src/data/version.ts` listing the changes in plain
   words. `tests/unit/version.test.ts` fails if the two do not match. Docs-only pushes keep the version. When you tell
   the owner something is live, always say the version number (for example "live as Beta v0.10.0").
1. **Check.** `.\x.cmd npm run check` (type-check, lint, build, unit tests) must pass. For anything that touches the menus,
   audio or saving, also run the related browser specs (`.\x.cmd npx playwright test tests/e2e/<spec>`).
2. **Preview locally at the real address.** The site repo sits next to this one (`..\hunteracedev`). Start its preview
   server in the background, which serves this folder's `dist` at `/tin-hats/` exactly as the live site will:
   `.\x.cmd node ..\hunteracedev\tools\preview.mjs`, then open http://localhost:8080/tin-hats/ in a phone-sized
   landscape viewport, start a mission, and check the console is clean. Stop the server afterwards.
3. **Commit** the change on `main` (only source: `.tools`, `dist`, test output and `docs/screenshots` are git-ignored
   and must stay out of the repo; commits use the owner's no-reply address set in the local git config).
4. **Push:** `git push origin main`. GitHub Actions (`.github/workflows/deploy.yml`) runs the type-check, lint and unit
   tests on a clean machine, builds the game and publishes `dist` to GitHub Pages. If any step fails, nothing is published.
5. **Wait for the deploy:** `gh run watch --exit-status` (or `gh run list --workflow deploy.yml --limit 1`) until it
   finishes green.
6. **Confirm it is really live:** load https://hunteracedev.com/tin-hats/ and check that the page references the same
   script file as the local build (the hashed `assets/index-*.js` name in `dist/index.html`), then open it in a browser
   and start a mission. Pages can take a minute to refresh its cache. Players who already have the game are moved
   onto the new version by the game itself: it asks for one at every launch and whenever its tab comes back into view,
   shows "Updating…" and reloads (src/pwa; never during a briefing, a battle or its result).

The game's service worker, cache and saves are confined to `/tin-hats/`: the worker's scope is `/tin-hats/`, its caches
are named after that scope, and every storage key starts with `tinhats.`, so nothing can touch Bulwark or the home page.
Keep it that way (the asset base stays relative, `./`).

## How the owner wants the work done

- Ask the owner when a decision is genuinely theirs; otherwise log choices in `docs/DECISIONS.md`, keep
  `docs/PROGRESS.md` current and commit after every task.
- Never weaken or skip a test to get a green run, and never report something as working unless it was run and seen to pass.
- All tunable numbers live in `src/data`. `src/sim`, `src/data` and `src/meta` stay headless (no Phaser, no DOM).
- No external art or audio. No Nazi party symbols anywhere; the German flag is the plain Balkenkreuz.
- Nothing personal goes into the repo: no local paths, no personal email addresses, no binaries beyond the app icons.
