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

One more module can be exchanged by a build, by the game's own switch: `src/adminPanel/index.ts` (see "A build
without the admin panel").

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
| `reward` | `null` | A second section for the Shop, under the store's: things the player may choose to do for a reward (below). The same shape as `store`; every word shown comes from the platform. |
| `membership` | absent | A third section for the Shop, under the reward's: standing arrangements the player may take up, change or end, set side by side (below). The same shape as `store`; every word shown comes from the platform. |
| `settings` | `null` | A section for Settings: a title, plain lines and buttons (below). Every word shown comes from the platform. |
| `entitlements()` | empty set | Ids of things the platform says the player owns. |
| `extraUnit` | `null` | An extra unit for the roster: the entitlement that owns it and how it is drawn (below). |
| `testMode` | `null` | One switch for the admin panel, in the platform's words: its services run against stand-ins while it is on. Nothing reads it in a build made without the panel (below). |
| `releaseStage` | absent | The word before the version number on the title and in Settings. Absent: the game's own, "Beta". An empty text: none (below). |
| `badge()` | absent | A short label the platform gives the player, shown on the title screen (below). |
| `onScreen(screen, from)` | absent | Told each time the game shows another screen (below). |
| `crateBuying()` | absent | Whether supply crates may be bought with medals where the game is running (below). |
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
| `unavailable` | The platform's line, in the usual colour and without the "refused" sound: there is none to be had just now, through nobody's fault. Nothing changed and it can be asked for again. |

An offer may also carry an `unavailable` line of its own (none left for now): the line shows under the offer and its
button waits, as with `pending`.

After every outcome the Shop asks for the listing again, and also whenever the platform calls its `onChange`
listener (something unsettled was settled). The section shows nothing until the first listing arrives, and stays
hidden when a listing has neither offers nor a message. The game never gives anything for an outcome itself.

### The reward section (the same file, in the Shop)

When `platform.reward` is not null the Shop shows one more section under the store section (or under the call-in
charges when there is no store). It is a `StoreSection` like the store's and is drawn by the same code: a title, a
message, cards with a button, small print, the same outcomes. What an offer asks of the player and what it gives are
the platform's business; whatever it gives, the platform gives itself through `GameHost.grantMedals`. The game adds
two promises of its own: nothing of the section ever happens unless the player presses one of its buttons, and it is
drawn in the Shop only, never during a battle and never as a panel over another screen. Its test ids start with
`reward-` where the store's start with `store-`.

### The membership section (the same file, in the Shop)

When `platform.membership` is there and not null the Shop shows a third section, last of the platform's (under the
reward section, or under whichever of the others exist). It is a `StoreSection` like the other two and is drawn by
the same code: a title, a message, one card per offer with a button, small print, the same outcomes and states. It
is meant for standing arrangements a platform keeps for the player, set side by side so they can be compared: an
offer the player holds reads as `owned`, the others carry the platform's label, and what taking one up, changing it
or ending it means is the platform's business and said in the platform's words. The game adds the same promises as
for the reward section: nothing of it happens unless the player presses one of its buttons, and it is drawn in the
Shop only. Its test ids start with `membership-`.

### The badge (`src/ui/screens/title.ts`)

When `platform.badge` is there and returns a text that is not empty, the title screen shows it on a small plate in
the bottom right corner, above the version (`data-testid="platform-badge"`): one line, cut with an ellipsis past 40%
of the screen's width. It is read each time the title is drawn. The game keeps nothing of it, writes nothing of it
to the save and gives nothing for it. Null, an empty text or no hook: no plate.

### The change of screen (`screenReporter` in `src/platform/shell.ts`)

When `platform.onScreen` is there the game calls it after every change of screen with the screen now showing and the
one before it (`null` the first time): `onScreen('campaign', 'result')`. The names are the game's own: `title`,
`campaigns` (the campaign select), `campaign` (a campaign's map), `briefing`, `quartermaster`, `armoury` (the
Shop), `battle`, `result`, `settings`. The same screen is never told twice in a row. The game does not wait for the
hook, takes no answer from it and catches whatever it throws, so a platform can never hold a screen back; what a
platform does with the moment between two screens is its own business. The website has no such hook and nothing is
called.

### What the game lends a platform (`GameHost`, handed to `attach`)

`grantMedals(medals, grantId)` gives the player medals once. The id (letters, digits and `. : _ -`, 96 characters at
most) names the grant; the medals and the id are written to the save together before the call returns
(`SaveData.grants`), and the save remembers the newest 1,000 ids.

| Answer | Meaning |
| --- | --- |
| `granted` | Given and saved. |
| `already` | The save already holds this id: nothing changed. Safe to ask again after anything went wrong. |
| `failed` | Not given: the save could not be written, the id or amount is unusable, or the medals would not all fit under the medal cap. |

`grantCrate(crate, grantId)` and `grantItem(item, grantId)` give one supply crate or one cosmetic item once, under a
grant id, exactly as `grantMedals` gives medals: the thing and the id are one write of the save, before the call
returns, and a grant the save already holds answers `already` and changes nothing. A crate is one of the game's own
types that can be opened (`standard`, `premium`, `elite`, `titan`); it is held until the player opens it in the
Shop, free of charge. An item is named by its id in `src/data/cosmetics.ts`, of any rarity, the `special` one
included, which no crate ever holds. An item the save already owns is not a failure: the grant is taken and nothing
else changes. `failed`: the game has no such crate or item, the id is unusable, the save could not be written, or no
more of that crate can be held. What is granted is kept in the save whether or not cosmetics are on show in this
build (see "Supply crates").

The game also lends a platform the save itself, so that a platform can keep it somewhere besides the device. The
game does not know where, when or how: it only hands the save over as text and takes one back.

| Function | Meaning |
| --- | --- |
| `saveText()` | The save as it stands now, as text (the same document the game stores). |
| `readSave(text)` | A copy from elsewhere, possibly made by an older version: brought up to date and checked exactly as the game checks its own stored save. The clean save as text, or `null` when this version cannot read it (damaged, not a save, or from a newer version). Changes nothing. |
| `replaceSave(text)` | Put that save in place of the game's. `replaced`: checked, written, in use, its settings applied and the screens redrawn. `busy`: a battle is on; nothing changed, ask again later. `failed`: unreadable or it could not be written; nothing changed. |
| `onSaveChanged(listener)` | Called after every change of the save on this device: any write, a grant, a replaced save, a reset. |

### Supply crates (`src/ui/screens/cosmetics.ts`, in the Shop)

The game has cosmetic supply crates of its own: bought with medals, or given for playing, each holding one cosmetic
item (`src/data/crates.ts`, `src/data/cosmetics.ts`). They are the game's, not a platform's, and they are hidden in
every build while `COSMETICS.enabled` is false. A platform has one say in them.

When `platform.crateBuying` is there and returns false, no crate can be bought: the Shop's crate section shows only
the crate that free crates come as, and any other type the player holds, each with its chances and an Open button
when one is held; it names no price and has no Buy button, and `App.buyCrate` refuses whatever asks. Crates the
player is given (by playing, or through `grantCrate`) are opened as everywhere else. The hook is asked each time the
Shop is drawn and each time a crate is asked for, so its answer may change while the game runs. Absent, or true:
crates are sold as the game has them. The website has no such hook.

### The Settings section (`src/ui/screens/settings.ts`)

When `platform.settings` is not null, Settings shows one more block above "Replay tutorial": the section's `title`,
the `lines` of its `panel()` and one button per action (`label`; `disabled` greys it). Pressing a button calls its
`run()`; every button of the section waits until it resolves, then the panel is read again. The panel is also read
again whenever the platform calls its `onChange` listener. The game keeps nothing of it and writes nothing of it to
the save.

### The test mode switch

When `platform.testMode` is not null, the admin panel's Campaign tab lists "Platform test mode": one button with the
platform's `label` (pressed while `on()`), calling `set`, and its `note` under it. The panel is the only way to it:
a build made without the panel (below) has no such entry and never reads `testMode`, so a platform that makes such a
build should leave its stand-ins out of it too.

### The release stage

The title's corner and the first line of Settings' "About" show the version as `versionLabel` words it
(`src/data/version.ts`, the one place the stage is put before the number; the UI asks it once, in `src/ui/index.ts`).
On the website that is the game's own stage and the number: "Beta v0.9.0". A platform names another with
`releaseStage` ("Early access" gives "Early access v0.9.0"), or none with an empty text ("v0.9.0"). Nothing else the
game shows carries the stage: the "What's new" heading names the number alone, and the update notice, the page's
title and the manifest name no version (`tests/unit/version.test.ts` holds the source to that;
`tests/e2e/version-label.spec.ts` reads the website's two lines).

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
Shop opens) and `window.__TH.grantMedals` is the host's method. `window.__TH.setRewardSection(section)` does the same for the reward
section, `window.__TH.setMembershipSection(section)` for the membership section, and `window.__TH.setBadge(label)`
stands a label in for the platform's badge (from the next time the title is drawn). `tests/e2e/fake-store.ts` holds a
made-up store, a made-up reward and a made-up membership section, used by `tests/e2e/shop-store.spec.ts` and
`tests/e2e/screen-labels.spec.ts`. The change of screen is covered by `tests/unit/platform.test.ts`.

`window.__TH.cosmetics` holds the hooks for cosmetics and crates: `enable(on)` shows them for the session,
`setCrateBuying(false | true | null)` stands an answer in for the platform's `crateBuying` (null: the platform's
own), `grantCrate` and `grantItem` are the host's methods, and `giveCrates`, `giveItems`, `wear`, `clear`,
`lastCrate` and `stats` serve the specs (`tests/e2e/crates.spec.ts`; `tests/unit/app-cosmetics.test.ts` covers the
switch and the grants without a browser).

An extra unit has to be there before the game loads, so a test page carries it: with `?debug=1`, a
`window.__TH_EXTRA_UNIT = { data, slot }` set before the game's scripts run stands in for a platform's unit, owned
(`standInExtraUnit`; without the switch it is ignored). `tests/e2e/fake-extra-unit.ts` is a made-up one, used by
`tests/e2e/extra-unit.spec.ts` and by `tests/e2e/screen-labels.spec.ts` (one more unit in the train bar at the three
phone sizes). `window.__TH.extraUnit()` says whether one is installed, owned, drawn yet, and how many speech bubbles
are up. The unit tests install the same made-up unit before importing the sim (`tests/unit/extra-unit.test.ts`).

## A build without the admin panel

The website has a hidden admin panel for testing (seven taps on the title's helmet, or a key combination, then a
code). A build may leave it out: not hidden or switched off, absent from what is built.

**How.** The game reaches the panel through one module, `src/adminPanel/index.ts` (`createAdminPanel`, called once in
`src/boot.ts`). Next to it sits `src/adminPanel/none.ts`, which exports the same function and returns null. A build
made with this set in its environment gets `none.ts` in place of `index.ts`:

```
TIN_HATS_ADMIN_PANEL=off
```

The switch is the game's own (`adminPanelSwitch` in `vite.config.ts`), so a build that drives the game's Vite with
the game's config only has to set the variable before it builds (`process.env.TIN_HATS_ADMIN_PANEL = 'off'`). Unset,
empty or `on` keeps the panel; anything else stops the build, and so does a build told to leave the panel out that
never came across the module. The website's build never sets it.

A build with a Vite config of its own (one that does not load the game's `vite.config.ts`, so the switch is not
there to read the variable) does the same exchange itself, with the alias or resolve hook it already uses for
`src/platform/index.ts`: point `src/adminPanel/index.ts` at `src/adminPanel/none.ts`. Both files are the game's, so
nothing is copied or forked. Either way, check the built output for the texts listed under "How to prove it".

**What is then not in the build.** Everything that is the panel's own, because nothing else imports any of it
(`tests/unit/admin-panel-build.test.ts` holds the source to that):

| Left out | Where it lives |
| --- | --- |
| The controller and every action it offers | `src/app/admin.ts` |
| The lock: the tap run, the code check, its SHA-256 | `src/app/adminLock.ts` |
| The panel's data: the salt and salted hash of the code, the key combination, tabs, squads, the "Platform test mode" entry | `src/data/admin.ts` |
| The prompt, the button, the panel, the mode bar, the debug drawing, their styles | `src/ui/admin/` (with `admin.css`) |
| The secret entry: the mark on the title's helmet and the two listeners | `markAdminEntry`, `installAdminUi` in `src/ui/admin/index.ts` |
| The debug hook `window.__TH.admin` | it is `null` (`src/app/debug.ts` takes the hooks from the panel) |

The title's helmet is then a plain picture: it carries no mark and nothing listens for taps on it.

**What stays, and why.** A few entry points in code the game uses for other things, which the panel was the only
caller of. With the panel gone nothing calls them and nothing on screen leads to them: the battle's `admin(action)`
and the per-side cheat flags it sets (part of the sim, `src/sim/admin.ts`, read by the tick and covered by the sim's
tests), `BattleSession.admin`, and on `App` the fields and methods named `admin…` (`adminTaps`, `adminDarkness`,
`adminUnlockMissions`, `adminJump`). Two pieces of text stay with them: the result line for a battle the panel
ended (`APP.reasons.admin`, never reached) and the old release note that announced the panel (in `WHATS_NEW`;
Settings shows the newest note only).

**How to prove it.** None of these may occur in any `.js`, `.css` or `.html` file of the build; every one of them
occurs in the website's build:

| Text | What it is |
| --- | --- |
| `th-admin-` | every class of the panel's elements and styles |
| `admin-prompt`, `admin-code`, `admin-button` | the test ids of the prompt, the code field and the button |
| `data-admin-tap` | the mark of the secret entry and the listener that looks for it |
| `useHash` | the debug hook |
| `Platform test mode` | the panel's entry for a platform's test mode |
| the values of `ADMIN.passcode.salt` and `ADMIN.passcode.sha256` in `src/data/admin.ts` | the code's salt and salted hash (read them from the file; do not copy them anywhere) |

`tests/unit/admin-panel-build.test.ts` makes both builds (about two seconds each, into temporary folders) and checks
exactly this list both ways, that the two builds have the same files otherwise, and that a misspelt switch stops the
build.

In the running page, `window.__TH.admin` is `null` with `?debug=1`, the helmet has no `data-admin-tap`, seven taps
on it or the key combination open nothing, and no style rule of the page names `th-admin`. A browser spec of its own
makes such a build, serves it and checks that, and that the menus, the Shop and a battle work in it
(`tests/noadmin/no-admin-panel.spec.ts`, with its own config, port and server; `dist` is not touched):

```powershell
.\x.cmd npx playwright test -c playwright.noadmin.config.ts
```

`tools/no-admin-preview.ts`, which that config starts, shows what another repo's build does: set the variable, then
call the game's Vite `build()` with the game's config.
