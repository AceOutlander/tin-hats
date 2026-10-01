# Working rules for everyone building Tin Hats

Read this, then `docs/PLAN.md` and `docs/DESIGN.md`, before writing code.

## The situation

The owner is asleep. Work on your own until your task is finished and verified. Never ask a question and never wait for approval.
When something is unclear, impossible or a bad idea, pick the closest sensible option, add a line to `docs/DECISIONS.md`
(what you chose and why), and keep going. After five serious failed attempts at one problem, take the simplest working
alternative and note it under Known issues in `docs/PROGRESS.md`.

## Where things are

- Project root: `the project folder` (a git repo). Your shell usually starts one level up in the parent folder. Never touch anything outside `tin-hats`.
- Node, npm and git are NOT installed on this machine. Project-local copies live in `tin-hats\.tools`. Run every command through the wrapper, which sets PATH and changes into the project root:

```powershell
.\tin-hats\x.cmd npm run typecheck
.\tin-hats\x.cmd npx vitest run tests/unit/economy.test.ts
.\tin-hats\x.cmd git status --short
```

  If your shell is already inside `tin-hats`, use `.\x.cmd ...`. Use absolute paths with the file tools.
- The shell is Windows PowerShell 5.1: no `&&`, no `||`. Chain with `;`.
- Never install anything globally. Never push, deploy or publish. New npm packages only if truly needed (ask yourself twice).

## Commands

| Purpose | Command |
| --- | --- |
| Type-check everything | `x.cmd npm run typecheck` |
| Type-check the headless code only (no DOM) | `x.cmd npx tsc --noEmit -p tsconfig.sim.json` |
| Lint | `x.cmd npm run lint` |
| Unit tests (single run) | `x.cmd npm run test:unit` |
| One test file | `x.cmd npx vitest run tests/unit/<file>` |
| Balance tests | `x.cmd npm run test:balance` |
| Production build | `x.cmd npm run build` |
| Browser smoke tests (needs a build) | `x.cmd npm run test:e2e` |
| Screenshot a dev page or the game | `x.cmd npx tsx tools/shot.ts <urlPath> <out.png> [flags]` (see the header of `tools/shot.ts`) |

Never run anything that waits for input or never exits: no watch mode, no foreground dev server. `tools/shot.ts` and
Playwright start and stop their own servers. If you must start a server yourself, start it in the background on your own
port and stop it before you finish.

Other agents may be working in the same folder at the same time on other files. If a whole-project type-check or lint
shows errors in files you do not own, ignore them and check only your own files (for example `x.cmd npx eslint src/art`).
Do not edit files outside the paths you were given, except to add a line to the docs listed above.

## Code rules

- TypeScript strict. No `any` unless unavoidable and commented. No `// @ts-ignore`. No unused code.
- Every tunable number goes in `src/data` (typed by `src/data/schema.ts`). No gameplay or visual magic numbers in logic.
- `src/sim`, `src/data`, `src/meta`: no Phaser, no DOM, no `Math.random`, no `Date.now`, no `console`. Use the battle's seeded RNG. Lint and `tsconfig.sim.json` enforce this.
- Hot paths (sim tick, per-frame render and HUD update) must not allocate: pool and reuse objects, no closures or array literals in inner loops.
- Phaser is version 4.2.1. Do not assume Phaser 3 APIs: check `node_modules/phaser/types/phaser.d.ts` and the source in `node_modules/phaser/src` before using anything.
- No external art or audio files. Draw with Canvas 2D in code, synthesise sound with WebAudio.
- Content must be original. No swastikas, SS runes or other Nazi party symbols in art, text or UI; the German flag is the plain Balkenkreuz (straight-armed black cross, white outline).
- Tests: never weaken, skip or delete a test to get a green run. Fix the code, or fix a test that is genuinely wrong and say so. Never report something as working unless you ran it and saw it pass.

## Looking at your work

Visual work must be looked at, not assumed. Take screenshots with `tools/shot.ts` into `docs/screenshots/` (or the scratch
folder `tin-hats/.tools/shots/` for throwaway ones) and open the PNG with the Read tool. Check for overlapping, cut-off or
unreadable elements, wrong layering, and stiff or broken poses. Iterate until it looks good.

## Git

Commit only when your task brief tells you to. When you do: stage only your own paths, write a short message without
special characters, and retry after a couple of seconds if the index is locked.

```powershell
.\tin-hats\x.cmd git add src/sim tests/unit
.\tin-hats\x.cmd git commit -m "Sim core with economy, orders and rifle combat"
```

## Your final message

Your final message is read by the orchestrator, not a human. Make it a compact report: what you built (files), the public
API others need (names and signatures), exactly which checks you ran with their results, decisions you logged, and known
issues or follow-ups. No filler.
