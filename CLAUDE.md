# Tin Hats

A 2D side-view WW2 real-time strategy game for phone browsers: TypeScript, Vite, Phaser 4.2.1, installable as a PWA.
It is being built unattended from a long overnight spec. This folder (`this folder`) is the only live copy; the older
copy in a cloud-synced folder (`an older folder`) is stale and must not be edited.

## Start here

1. `docs/PROGRESS.md`: what is done, what is in progress, what is next, known issues. Carry on from "In progress" and "Next".
2. `docs/PLAN.md` (architecture and phases), `docs/DESIGN.md` (rules), `docs/DECISIONS.md` (choices made for the owner).
3. `docs/AGENT_GUIDE.md`: working rules for anyone, human or agent, changing this repo.

## Running commands

Node, npm and git are not installed on this PC. Portable copies live in `.tools`, and every command goes through the wrapper:

```powershell
.\x.cmd npm run typecheck
.\x.cmd npm run lint
.\x.cmd npm run test:unit
.\x.cmd npm run test:balance
.\x.cmd npm run build
.\x.cmd npm run test:e2e      # about 35 minutes: real battles in headless Chromium
.\x.cmd git status --short
```

The shell is Windows PowerShell 5.1 (no `&&`). Never install anything globally, never push or deploy, stay inside this folder.

## How the owner wants the work done

- Work without asking questions; log choices in `docs/DECISIONS.md`; keep `docs/PROGRESS.md` current; commit after every task.
- Never weaken or skip a test to get a green run, and never report something as working unless it was run and seen to pass.
- All tunable numbers live in `src/data`. `src/sim`, `src/data` and `src/meta` stay headless (no Phaser, no DOM).
- No external art or audio. No Nazi party symbols anywhere; the German flag is the plain Balkenkreuz.
- The Claude plan has tight usage limits: run subagents on Sonnet (Opus only for the hardest one or two), keep each
  batch of work small enough to finish at a commit, and have agents keep notes in `docs/progress/`.
