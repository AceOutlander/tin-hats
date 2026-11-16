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
| `extraUnit.ts` | The extra unit as the game asks about it: is there one, how is it drawn, may the player field it. |

Game code imports `platform` from `src/platform` and the types from `src/platform/types`. A build for another place
points the first import at its own module (a bundler alias or resolve hook on `src/platform/index.ts`); that module
must export a `platform` of the same type. Nothing else in the game changes. Every import names the folder
(`'../platform'`), never the file (`'./index'`), files inside the folder included: a build swaps the module under that
one name (`tests/unit/platform-imports.test.ts`).

The page's entry (`src/main.ts`) reads the platform before anything else of the game, so a platform's module runs
before the game's own data is read (see "The extra unit").

## What a platform may provide

| Part | Website | Meaning |
| --- | --- | --- |
| `installed` | `false` | The game runs as an installed app. |
| `shell` | `null` | Lifecycle of an installed app: `onPause`, `onResume`, `onBack`, `keepAwake`. |
| `store` | `null` | A store section for the Shop: a title, small print, and a listing of offers (below). Every word shown comes from the platform. |
| `reward` | `null` | A reward the player may ask for: whether one is available, how many are left today, and a `show()` that resolves with medals or nothing. |
| `cloud` | `null` | Somewhere besides the device to keep the save: `status`, `load`, `save`. |
| `entitlements()` | empty set | Ids of things the platform says the player owns. |
| `extraUnit` | `null` | An extra unit for the roster: the entitlement that owns it and how it is drawn (below). |
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

### The extra unit

A platform may add one unit to the game: a complete unit of its own (rules, weapons, sounds, words, pictures), which
appears in the train bar of every campaign's missions when the platform says the player owns it. The game ships
none, and with none installed nothing is different: the kind is in no table, there is no button, no picture is
drawn, and every battle runs tick for tick as before (`tests/unit/extra-unit-absent.test.ts`).

It comes in two halves.

**The data** (`src/data/extraUnit.ts`, headless). The platform calls `installExtraUnit(data)` while its own module
loads. `ExtraUnitData` holds a `UnitDef` whose kind is `'extra'`, the weapons and one-shot sounds it brings (new
ids), its name, button name and line, and what it shouts when it charges with the sound that goes with the shout.
The game's tables (units, weapons, sounds, the nations' names) are built once, when their modules are first read, and
they take the unit in then; the kind comes last in the train bar. A unit installed after the data was read is
refused with an error, never half taken.

**The slot** (`Platform.extraUnit`, an `ExtraUnitSlot` in `src/platform/types.ts`):

| Field | Meaning |
| --- | --- |
| `entitlement` | The id among `platform.entitlements()` that says the player owns the unit. |
| `art.pictures` | Its pictures, drawn in code like the game's sprites (key, size and anchor in world units, a `draw`). The unit faces right; the anchor is the point on the ground under the middle of its body. Keys start with `extra/`. |
| `art.idle`, `move`, `charge`, `strike`, `death` | Which pictures show what, and how fast: per second for standing, striking and falling, per world unit travelled for moving and charging. |
| `art.height`, `length`, `reach` | Where its health pips and its shout go, the size of its shadow, and where its weapon strikes from. |
| `art.portrait(ctx, w, h)` | Its portrait for the train button. |

What the game does with it:

- **Who fields it.** As each battle starts the game asks `ownsExtraUnit()` (`src/platform/extraUnit.ts`): a unit is
  installed, the platform has a slot for it, and `entitlements()` holds the slot's id. Then `BattleConfig.extraUnit`
  is true and side 0 may train it wherever it has an HQ: every campaign mission and the proving grounds, not Basic
  Training. No mission list hands it out, the enemy never gets it, and nothing about it is written to the save.
- **Pictures.** They are made into textures (with the bubbles of its shouts) the first time a battle may field the
  unit, never at startup: a player who does not own it never pays for them.
- **In the battle.** It is drawn one picture at a time from its own sheet (`SheetView` in `src/render/units.ts`):
  standing, moving, charging (`UnitState.charging`), striking each time its weapon fires, falling when it dies. Its
  name and its line are the same under every flag and date.

The sim capabilities it may lean on are generic, and no unit of the game uses them yet:

| Capability | Where | What it does |
| --- | --- | --- |
| A blow that needs contact | `WeaponDef.delivery: 'melee'` | Lands at once on a target within reach, with no hit roll, tracer or flash. Reach is measured to a man in the open, or to the edge of the trench, building or rubble a man is in (the lines never come nearer than that). A unit with such a weapon stands and strikes whenever something is within reach. |
| A charge | `UnitDef.charge` | While it advances with the enemy's front within `range` it moves at `speedMul` x its speed; the start of a charge raises the `charge` event at most once every `every` seconds. The view shows the extra unit's shout over its head and plays its sound. |
| A limit per battle | `UnitDef.perBattle` | A side may train this many in one battle, counting those alive, queued and lost. The train button reads as out of reach once they are used. |
| A heavy body | `UnitDef.class: 'vehicle'` | As before: hits are taken in the vehicle column of the damage matrix, with `armour` front and rear if given. A vehicle-class kind that is not one of the nations' vehicles carries its own weapon and is drawn from its sheet. |

### For tests

With `?debug=1`, `window.__TH.setStore(section)` stands a store section in for the platform's (from the next time the
Shop opens) and `window.__TH.grantMedals` is the host's method. `tests/e2e/fake-store.ts` is a made-up store used by
`tests/e2e/shop-store.spec.ts` and `tests/e2e/screen-labels.spec.ts`.

An extra unit has to be there before the game loads, so a test page carries it: with `?debug=1`, a
`window.__TH_EXTRA_UNIT = { data, slot }` set before the game's scripts run stands in for a platform's unit, owned
(`standInExtraUnit`; without the switch it is ignored). `tests/e2e/fake-extra-unit.ts` is a made-up one, used by
`tests/e2e/extra-unit.spec.ts` and by `tests/e2e/screen-labels.spec.ts` (one more unit in the train bar at the three
phone sizes). `window.__TH.extraUnit()` says whether one is installed, owned, drawn yet, and how many speech bubbles
are up. The unit tests install the same made-up unit before importing the sim (`tests/unit/extra-unit.test.ts`).

The reward and cloud saves are typed but read by nothing yet.
