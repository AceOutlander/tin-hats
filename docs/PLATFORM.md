# The platform hooks

The game runs in a browser page. It can also be wrapped as an installed app (see `docs/CAPACITOR.md`), and a wrapper
may have things a web page has not: a system back button, a store, somewhere else to keep saves. The game reaches all
of that through one small interface, so it never knows which place it is in.

## The three files (`src/platform/`)

| File | What it is |
| --- | --- |
| `types.ts` | The interface, `Platform`. No imports, no code. |
| `index.ts` | The website's platform: `platform`, with every part absent. **The one file another build replaces.** |
| `shell.ts` | Joins an installed app's lifecycle and back action to the game (`installShell`, called once in `src/boot.ts`). |

Game code imports `platform` from `src/platform` and the types from `src/platform/types`. A build for another place
points the first import at its own module (a bundler alias or resolve hook on `src/platform/index.ts`); that module
must export a `platform` of the same type. Nothing else in the game changes.

## What a platform may provide

| Part | Website | Meaning |
| --- | --- | --- |
| `installed` | `false` | The game runs as an installed app. |
| `shell` | `null` | Lifecycle of an installed app: `onPause`, `onResume`, `onBack`, `keepAwake`. |
| `store` | `null` | A store section for the Shop: a title and a list of offers. An offer has a title, a description, a price label and a `buy()` that resolves with medals to grant, an entitlement, "cancelled" or "failed". Every word shown comes from the platform. |
| `reward` | `null` | A reward the player may ask for: whether one is available, how many are left today, and a `show()` that resolves with medals or nothing. |
| `cloud` | `null` | Somewhere besides the device to keep the save: `status`, `load`, `save`. |
| `entitlements()` | empty set | Ids of things the platform says the player owns. |
| `extraUnit` | `null` | An extra unit for the roster. Its shape is open until a platform provides one. |

Rules for anything built on these:

- With the part absent, the game shows nothing and does nothing for it: no empty section, no greyed button, no notice.
- The game holds no list of offers, labels or ids of its own. It draws what the platform hands it.
- The website build must be byte-for-byte free of other platforms' code (`tests/unit/platform.test.ts` checks the
  source, the packages and the built files).

## What is joined to the game today

Only the shell (`src/platform/shell.ts`):

- **Pause and resume.** The app goes to the background: the same as a hidden page (`App.pageHidden`): a running battle
  pauses and sound stops. It comes back: sound returns; the battle stays paused until the player resumes it.
- **Back.** The back action is passed on as the game's back key (Escape). It closes the panel on top, goes back one
  menu screen, and in a battle opens or closes the pause menu. It never leaves a battle. On the title nothing uses it,
  `onBack`'s listener returns false and the platform decides (typically: put the app away).
- **Screen.** `keepAwake(true)` on the battle screen, `keepAwake(false)` on every other.

The store, reward, cloud, entitlements and extra unit are typed but read by nothing yet.
