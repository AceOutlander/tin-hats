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
| `store` | `null` | A store section for the Shop: a title, small print, and a listing of offers (below). Every word shown comes from the platform. |
| `reward` | `null` | A reward the player may ask for: whether one is available, how many are left today, and a `show()` that resolves with medals or nothing. |
| `cloud` | `null` | Somewhere besides the device to keep the save: `status`, `load`, `save`. |
| `entitlements()` | empty set | Ids of things the platform says the player owns. |
| `extraUnit` | `null` | An extra unit for the roster. Its shape is open until a platform provides one. |
| `testMode` | `null` | One switch for the admin panel, in the platform's words: its services run against stand-ins while it is on. |
| `attach(game)` | absent | Called once at start with what the game lends the platform (`GameHost`, below). |

Rules for anything built on these:

- With the part absent, the game shows nothing and does nothing for it: no empty section, no greyed button, no notice.
- The game holds no list of offers, labels or ids of its own. It draws what the platform hands it.
- The website build must be byte-for-byte free of other platforms' code (`tests/unit/platform.test.ts` checks the
  source, the packages and the built files).

## What is joined to the game today

### The shell (`src/platform/shell.ts`)

- **Pause and resume.** The app goes to the background: the same as a hidden page (`App.pageHidden`): a running battle
  pauses and sound stops. It comes back: sound returns; the battle stays paused until the player resumes it.
- **Back.** The back action is passed on as the game's back key (Escape). It closes the panel on top, goes back one
  menu screen, and in a battle opens or closes the pause menu. It never leaves a battle. On the title nothing uses it,
  `onBack`'s listener returns false and the platform decides (typically: put the app away).
- **Screen.** `keepAwake(true)` on the battle screen, `keepAwake(false)` on every other.

### The store section (`src/ui/screens/storeSection.ts`, in the Shop)

When `platform.store` is not null the Shop shows one more section, under the call-in charges:

- its `title` as the heading, `list()`'s `message` (if any) above the offers, its `notes` as small print under them;
- one card per offer: `title`, `description`, and a button carrying `priceLabel` (as wide as the label needs, up to
  132 px). An offer marked `owned` shows "Owned" and cannot be pressed; one with a `pending` line shows that line and
  cannot be pressed.

Pressing the button calls the offer's `buy()`. While it runs, every offer's button waits. It resolves with a state,
and the platform's own line for it is shown under the offer until that offer is asked for again:

| Outcome | What the player sees |
| --- | --- |
| `done` | The platform's line. Whatever was offered has already been given by the platform. |
| `pending` | The platform's line. Nothing has been given yet; the platform settles it later by itself. |
| `cancelled` | Nothing: the card is as it was. |
| `failed` | The platform's line, in red. |

After every outcome the Shop asks for the listing again, and also whenever the platform calls its `onChange`
listener (something unsettled was settled). The section shows nothing until the first listing arrives, and stays
hidden when a listing has neither offers nor a message. The game never gives anything for an outcome itself.

### What the game lends a platform (`GameHost`, handed to `attach`)

`grantMedals(medals, grantId)` gives the player medals once. The id (letters, digits and `. : _ -`, 96 characters at
most) names the grant; the medals and the id are written to the save together before the call returns
(`SaveData.grants`), and the save remembers the newest 1,000 ids.

| Answer | Meaning |
| --- | --- |
| `granted` | Given and saved. |
| `already` | The save already holds this id: nothing changed. Safe to ask again after anything went wrong. |
| `failed` | Not given: the save could not be written, the id or amount is unusable, or the medals would not all fit under the medal cap. |

### The test mode switch

When `platform.testMode` is not null, the admin panel's Campaign tab lists "Platform test mode": one button with the
platform's `label` (pressed while `on()`), calling `set`, and its `note` under it.

### For tests

With `?debug=1`, `window.__TH.setStore(section)` stands a store section in for the platform's (from the next time the
Shop opens) and `window.__TH.grantMedals` is the host's method. `tests/e2e/fake-store.ts` is a made-up store used by
`tests/e2e/shop-store.spec.ts` and `tests/e2e/screen-labels.spec.ts`.

The reward, cloud saves, entitlements and extra unit are typed but read by nothing yet.
