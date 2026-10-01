# Decisions made while you were asleep

Each entry: what was chosen and why. Newest at the bottom.

1. **The game lives in `tin-hats/` with its own git repo.** The folder you opened already held another game (`index.html`) and `magic-academy/`. A subfolder keeps those untouched and out of the new repo.
2. **Node, npm and git are project-local.** None of them were installed on this PC and global installs were ruled out, so portable Node 24 LTS (nodejs.org, checksum verified) and MinGit 2.56 (git-for-windows release, checksum verified) sit in `tin-hats/.tools`. The npm cache and the Playwright browser are kept there too. `x.cmd` runs any command with them on PATH. Nothing outside the project folder was changed.
3. **TypeScript 6.0 instead of 7.0.** typescript-eslint 8 only supports TypeScript below 6.1, and lint with zero warnings was required.
4. **HUD and menus are DOM elements; Phaser draws the battlefield.** DOM gives crisp text at any pixel ratio, native safe-area handling and reliable 48 px touch targets, and it keeps the Phaser 4 API surface small. The simulation stays free of both.
5. **The simulation ticks at 30 Hz and the renderer interpolates.** Animation runs at display rate, so motion is smooth while headless tests run twice as fast as a 60 Hz sim would.
6. **The damage matrix has a fifth column, `hq`.** With pillboxes nearly immune to bullets, a shared fortification column would make the rifles-only tutorial unwinnable. The HQ gets its own multipliers.
7. **Barbed wire slows only the other side's infantry.** The side that laid it knows the gaps. This stops the AI crippling its own counter-attacks.
8. **Each unit type has its own training queue, and types train in parallel.** That is what "queue count and training progress" on every button implies. Cost and population are paid when queued so the cap of 40 can never be exceeded.
9. **Sappers cannot be directly controlled.** They do not fight, and a tap on a sapper would otherwise interrupt income.
10. **Rain can happen in every theatre, including the desert.** The request was a flat 40% per map. Thunder is checked every 2 seconds at 0.5% while it rains. Weather uses its own random source and never touches gameplay.
11. **Git commits are authored as "Tin Hats build" with your email**, set in the repo's local config only.
