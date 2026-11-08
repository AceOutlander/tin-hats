# Campaign foundations (queue job 11, part 1)

The design for the Part 1 foundations of the Soviet spec in `docs/QUEUE.md`, written so building can start the day
jobs 1 to 10 land. It is built first and every campaign (`STALINGRAD.md`, `DDAY.md`, `BERLIN.md`, `AFRICA.md`) depends
on it. Nations are in `NATIONS.md`, sources in `HISTORY.md`.

It fits every decision already in the queue: a population cap of 100 for both sides on every difficulty; the four
difficulties with symmetric lethality and an Insane AI that has the player's income and cap; medals and the Armoury
in place of per-mission unlocks, with loans; unlockable passives; the prep phase; the new units of job 7; hidden enemy
HP; the resource called Money; music named per mission; no Nazi party, SS or fascist symbols anywhere.

Names used for job 7 and job 10 things (`apc`, `flame`, `commander`, `aaGun`, `lightTank`, `kingTiger`, `veteran`,
`bomber`, `fighter`, `recon`, medals, Armoury) are the ones the queue uses. If those jobs land with other identifiers,
map them; nothing here depends on the spelling.

## 0. What is new, at a glance

| Feature | Engine (sim, view, app) | Data only |
| --- | --- | --- |
| Mid-mission autosave and resume | **New**: full battle snapshot and restore, resume UI | snapshot version |
| Phases, objectives, scripted events | **New**: a mission director (state machine) in the sim | every mission's phases |
| Long maps with sectors and ground types | **New**: per-sector movement and visibility rules; backdrop per sector | sectors per mission |
| Capturable forward positions as spawn points | **New**: spawn points, deploy choice, rally-point Fall Back, AI use | points per mission |
| Ruined buildings and rubble | **New**: building structure, target class `infantryBuilding`, collapse to rubble | buildings per mission |
| Rivers, bridges, ferries | **New**: water ground, bridge spans, vehicle barrier, batched ferry spawns | per mission |
| Minefields | **New**: minefield structure, clearing by sappers, blasts | per mission |
| Weather and time of day changing mid-mission | **New**: scripted weather in the sim (visibility), view transitions | events |
| Snow and winter | small (ground types, ski tag) | ground, theatre variants |
| Nations as data, era-correct rosters | **Refactor**: faction id becomes nation id; per-unit nation; era resolver; look registries | nations, eras, equipment table |
| Campaign select | **New** screen; per-campaign map | campaign definitions, map shapes |
| 1x/2x speed | tiny (reuse the debug time-scale) | none |
| Casualty count on the end screen | tiny (counters exist in side stats) | none |
| Germans "mighty" early | none | mission setup only (section 9) |

## 1. Risks, riskiest first

1. **Snapshot and resume (section 2).** It touches every piece of battle state, and every later system adds more.
   A field that is not saved causes silent desyncs after a resume. Guard: a generic round-trip test that walks the whole
   state object graph, plus a determinism test (an interrupted run must equal an uninterrupted one bit for bit) on every
   mission, phase and difficulty. Job 9's human-like AI must keep all of its memory as plain serialisable data from its
   first commit; tell that job now.
2. **Mission director plus forward spawns (sections 3 and 4.5).** Phases change what the AI and the bot think the
   front is. The hold line today is the forward-most owned trench, so spawn points, rally-point Fall Back and per-phase
   AI postures all change order logic that the balance suite relies on. Guard: today's ten missions convert
   automatically to one-phase missions and must give identical results (same seeds, same winners, same times) before
   any new mission is written.
3. **Buildings (section 4.3).** A new target class touches the damage matrix, every weapon's `targets` list, trench
   occupancy code and the renderer (occupants in windows on several floors). City fighting is half of Stalingrad and
   most of Berlin, so it must be right before those missions are tuned.
4. **Long maps on phones (section 4.1).** Maps grow from 14,000 wu to as much as 32,000 wu, with up to two backdrop
   sets per mission. Risks: backdrop texture memory, minimap readability, long walks. Guard: perf runs (`tools/perf.ts`)
   on the longest map with 200 units, and a backdrop memory budget per mission.
5. **Nations as data (section 5).** It is a wide refactor rather than a hard one: every place that switches on
   `'british' | 'german'`, `helmet: 'brodie' | 'stahlhelm'` or a flag name becomes a lookup by look id. The danger is the
   single boot texture atlas. Thirty or more headgear, uniform and vehicle variants will not fit one page, so looks must
   be rasterised per battle for the nations in that battle only.
6. **Weather in the sim (section 4.7).** Weather has been view-only so far. Scripted weather and night now change the
   visible range for both sides. Random rain stays visual only, so its RNG still never touches the sim.
7. **Rivers, ferries and minefields (sections 4.4 and 4.6).** Contained features, but the AI has to know about them:
   it must not drive tanks into a river, and it must clear or shell mines.
8. **Campaign select, speed button and casualty count.** Low risk.

Build order (each step ends green on the full checks; see section 11 for tests):

1. Snapshot and restore of today's battles (no new features yet), with both round-trip tests.
2. Mission director; convert the ten British missions to one phase each; prove the results are identical.
3. Sectors, ground types, long maps, scripted weather and time.
4. Capture points, spawn points, the deploy choice, rally-point Fall Back, AI and bot use of them.
5. Buildings and rubble.
6. Rivers, bridges, ferries, minefields.
7. Nations as data, eras and the equipment table; Soviet, German and Romanian looks.
8. Campaign definitions, campaign select, per-campaign maps, save version bump.
9. 1x/2x, casualty count, resume UI, end screen.
10. Stalingrad content (`STALINGRAD.md`), then the full checks and push to live.

## 2. Mid-mission autosave and resume

### 2.1 Approach

A full **state snapshot**, not a command replay. Replay is simple, but resuming a 30-minute mission would mean
fast-forwarding 54,000 ticks; at an estimated 0.5 to 1 ms per tick with 200 units on a phone, that is 30 to 50 s. Replay
stays as a test tool: a logged command stream re-run from the seed must reach the same snapshot hash.

### 2.2 What is saved

One slot, key `tinhats.battle` (separate from `tinhats.save`, so a broken snapshot can never damage progress):

```ts
interface BattleSnapshot {
  v: number;                 // SNAPSHOT_VERSION, bumped by hand when sim state changes shape
  dataHash: string;          // hash of the mission def + units, weapons, damage, supports, config, difficulty tables
  savedAt: number;           // wall clock, for the "Continue" label only; never read by the sim
  missionId: number;
  difficulty: Difficulty;
  seed: number;
  /** Everything the player brought in: Armoury contents, upgrade levels, equipped passives. Frozen at battle start. */
  loadout: { armoury: UnitKind[]; upgrades: UpgradeLevels; passives: string[] };
  speed: 1 | 2;
  sim: {
    tick: number;
    rng: number[];           // full RNG state (mulberry32 is one uint32)
    sides: SideStateSnap[2]; // money, income estimate, pop, order, kindOrders, queues and progress,
                             // cooldowns, hq hp, stats (kills, casualties by kind), deployPoint
    units: number[];         // packed: one fixed-width record per live unit (see 2.3)
    projectiles: number[];
    smokes: number[];
    structures: { trenches; pillboxes; wires; buildings; bridges; minefields; points; prepSites };  // hp, owner, slots, progress
    director: DirectorSnap;  // phase id, phase start tick, objective progress, fired event ids, per-event repeat counters,
                             // pending delayed events, timers, weather and time state and their transitions
    reserve: number[];       // wave units waiting for population room
    commanders: [unknown, unknown];  // each commander's own serialise() output: plain JSON, no class instances
  };
}
```

Rules that make it safe:

- **The view, audio and music hold no game truth.** On restore the view rebuilds from the state: corpses and decals
  are cosmetic and need not survive. The music restarts on the build layer and lets the intensity logic catch up.
- **No hidden state in closures, Maps keyed by objects, or class instances** anywhere in `src/sim`. Commanders
  (AI, bot, human-like Insane AI) implement `serialise(): unknown` and `restore(data)`. All "human-like" randomness,
  such as reaction jitter and occasional mistakes, draws from the battle RNG so it is saved with it.
- **Pending commands** are flushed into the state before saving, by saving between ticks after `step()`, so the
  command queue is always empty in a snapshot.
- **Ids stay stable**: units keep their pool index and id; the id counter is saved.

### 2.3 Packing and size

Units go into one flat number array with a fixed field order, defined once in `src/sim/snapshot.ts` next to the unit
type, so a new unit field fails the round-trip test until it is added. Two hundred units at about 40 fields is 8,000
numbers, roughly 60 to 90 kB of JSON. Structures and the director are small. Budget: 250 kB per snapshot (localStorage
allows about 5 MB per origin, shared with nothing else under `/tin-hats/`).

### 2.4 When and how

- **Autosave** every 30 s of sim time, at every phase change (after its prep ends), on `visibilitychange` to hidden and
  on `pagehide`. Never during the first 10 s or after the battle ends. Serialising runs between frames. On a phone,
  `JSON.stringify` of 100 kB takes about 2 to 5 ms; if a frame probe shows a hitch, split it so the units array is
  built one frame and written the next.
- **On victory or defeat** the slot is cleared. **Quit to map** asks "Leave the battle? Progress is kept and you can
  continue later". The slot stays, so quitting is the same as closing the tab.
- **Resume**: the title screen and the campaign select show "Continue: Mamayev Kurgan, phase 2 (14:32)". The
  campaign map shows it on that mission's pin. Starting any other mission asks before discarding the slot. There is one
  slot; it does not grow.
- **Compatibility**: if `v` or `dataHash` does not match the running build (the game updated between sessions; the
  service worker never swaps mid-battle), the slot is dropped with a one-line notice: "The game was updated since you
  left this battle, so it starts again." A snapshot that throws on restore is copied to `tinhats.battle.unreadable` (like
  the save's unreadable slot) and dropped. Startup never fails because of it.
- **Admin panel**: when the panel is unlocked, an admin action (spawn, heal, win) marks the snapshot `admin: true`, so
  testing never mixes with real scores. Job 10 decides whether such wins pay medals.

## 3. The mission director: phases, objectives, triggers, events

### 3.1 Model

A mission is a list of **phases**. One is active at a time. A phase has required objectives (all done means the phase
is complete), optional side objectives, loss conditions, an optional timer, an optional prep phase at its start, and
events fired when it starts. When a phase completes, the director moves to `next`. When the last phase completes, the
mission is won. A mission written the old way, without `phases`, becomes one phase built from `mode`, `timer` and
`events`, so missions 1 to 10 run unchanged (build step 2).

```ts
type MissionMode = 'assault' | 'survival' | 'hold' | 'delay' | 'special';  // 'assault' | 'survival' exist today

interface PhaseDef {
  id: string;                         // 'landing', 'station', 'hold-summit'
  title: string;                      // HUD objective plate, 40 characters at most
  objectives: ObjectiveDef[];         // all must be done
  sideObjectives?: SideObjectiveDef[];// optional, pay a medal bonus
  lose?: LossDef[];                   // on top of the global "your HQ falls"
  timer?: { seconds: number; label: string; onExpire: 'complete' | 'lose' };
  prep?: PrepDef;                     // job 6 prep phase, run at phase start (section 7.3)
  onEnter?: MissionEventDef[];        // fired when the phase starts (after its prep, if any)
  next: string | null;                // null = the mission is won when this phase completes
  /** Admin "jump to phase" and phase-isolated balance tests build this state directly. */
  assume?: PhaseAssume;
}

type ObjectiveDef =
  | { id: string; type: 'destroyHq'; side: Side }
  | { id: string; type: 'capture'; point: string }                       // own the point (any capturable)
  | { id: string; type: 'hold'; point: string; seconds: number }          // own it continuously this long
  | { id: string; type: 'survive'; seconds: number }                      // the phase timer by another name
  | { id: string; type: 'kill'; side: Side; kinds?: UnitKind[]; count: number }  // Dubno: destroy N tanks
  | { id: string; type: 'destroy'; structures: StructureRef[] }           // Merville casemates, a bridge
  | { id: string; type: 'reach'; x: number; count: number; kinds?: UnitKind[] }  // N units at or past x
  | { id: string; type: 'exit'; count: number; kinds?: UnitKind[] }       // withdraw N units off the left edge
  | { id: string; type: 'surrender'; side: Side; hqBelow: number };       // HQ under this fraction: they give up

type LossDef =
  | { type: 'pointLost'; point: string }                       // e.g. the landing stage
  | { type: 'enemyReached'; x: number; count: number }         // delay missions: N enemies past x
  | { type: 'structureLost'; structures: StructureRef[] }
  | { type: 'unitLost'; tag: string };                         // a named unit (rarely used)

interface SideObjectiveDef { id: string; text: string; objective: ObjectiveDef; failIf?: LossDef; bonus: number }
type StructureRef = { kind: 'trench' | 'pillbox' | 'building' | 'bridge' | 'point' | 'minefield'; id: number | string };
```

**Mode** is a label for the HUD, the briefing card and medal scoring (section 7.1); behaviour comes from the phases:

- assault: ends with `destroyHq` or `surrender`.
- survival: timed phases with `survive`, no enemy HQ; scored on casualties and HQ health.
- hold: take something, then `hold` it, usually with a mid-mission prep phase.
- delay: timed, with `enemyReached` losses and often `kill`; scored like survival plus the kill count.
- special: anything else (river crossings, the flag on the Reichstag, raids).

### 3.2 Triggers (added to today's four)

```ts
type MissionTrigger =
  | { at: number } | { every: number; from: number; until?: number }             // today; now relative to the mission
  | { trenchCapturedBy: Side; trenchId: number; delay?: number }                   // today
  | { hqHpBelow: number; side: Side }                                              // today
  | { phase: string; delay?: number }                                              // seconds after that phase starts (after prep)
  | { phaseEvery: number; phase: string; from?: number; until?: number }           // repeating, only during that phase
  | { objective: string; delay?: number }                                          // when an objective completes
  | { pointCapturedBy: Side; point: string; delay?: number }
  | { kills: number; side: Side; kinds?: UnitKind[] }                              // side = the side that died
  | { structureDestroyed: StructureRef; delay?: number }
  | { enemyNear: { x: number; dist: number; side: Side } };                        // a unit of the other side comes this close
```

Every event gets an `id` (string, unique in the mission), so the admin panel can list and fire them and the
snapshot can record which have fired.

### 3.3 Events (added to `wave`, `airdrop`, `hint`, `announce`)

```ts
type MissionEventDef = { id: string; when: MissionTrigger } & (
  | { type: 'wave'; side: Side; forces: ForceDef[]; at?: string /* spawn point id */; announce?: string }   // today, plus `at`
  | { type: 'airdrop'; side: Side; money: number }
  | { type: 'hint' | 'announce'; text: string }
  | { type: 'banner'; text: string; sound: 'boss' | 'alarm' | 'horn' }   // King Tiger arrival, the barrage warning
  | { type: 'barrage'; side: Side; x: number; spread: number; rounds: number; duration: number; weapon: string; warning?: string }
  | { type: 'airRaid'; side: Side; support: SupportKind; x: number }      // free scripted call-in (Stukas, the Lancasters at Caen)
  | { type: 'weather'; to: WeatherKind; over: number }                    // section 4.7
  | { type: 'time'; to: TimeOfDay; over: number }
  | { type: 'income'; side: Side; mul: number }                           // supply line cut: Dubno, Volga
  | { type: 'posture'; side: Side; posture: 'hold' | 'advance' | 'counterattack' | 'free'; point?: string; seconds?: number }
  | { type: 'unlockKind'; side: Side; kind: UnitKind; nation?: NationId } // mission-only training (APC at Uranus)
  | { type: 'support'; side: Side; kind: SupportKind; enabled: boolean }
  | { type: 'reveal'; side: Side; seconds: number }                       // hidden HP shown, like the recon plane
  | { type: 'demolish'; bridge: number }                                  // a bridge blown on cue
  | { type: 'spawnPointState'; point: string; open: boolean }
  | { type: 'setOwner'; ref: StructureRef; owner: Side | -1 }
  | { type: 'disguise'; side: Side; seconds: number; x0: number; x1: number }  // Kalach: column not engaged for a while
  | { type: 'endMission'; winner: Side; reason: string }                  // surrender cutscene
);
```

`posture` is how a mission script steers the AI: `counterattack` sends the AI's army at `point` for `seconds`, then
back to its own judgement (`free`). `hold` forbids Advance for a while (an enemy waiting in its positions). The AI still
uses the player's controls and limits (job 9). The posture only sets its goal, so a scripted counter-attack on Insane
is executed cleverly rather than as a blind charge.

`disguise` is the one event that suspends targeting rules (Kalach bridge, 1942). Keep it data-driven, short and
deterministic: units of `side` inside `[x0, x1]` are not chosen as targets until they fire or `seconds` pass.

### 3.4 HUD

The objective plate shows the phase title and its first unfinished objective with progress ("Tanks destroyed 7 / 12",
"Hold the summit 2:40"). A phase change shows a banner ("Phase 2: The water tanks") with a short horn cue. Side
objectives sit on the pause screen and the end screen, not the battle HUD (phone space).

## 4. The battlefield

### 4.1 Long maps and sectors

- `length` up to 32,000 wu (32 screens). Most 15 to 30 minute missions use 16,000 to 28,000; tutorials 6,000 to 9,000.
- A **sector** is a stretch of map with its own ground and, optionally, its own backdrop set:

```ts
interface SectorDef {
  from: number; to: number;            // wu, contiguous and covering 0..length
  ground: GroundId;                    // movement and art
  backdrop?: TheatreId;                // at most 2 distinct backdrops per mission (memory)
  label?: string;                      // minimap and briefing ("Kholm Gate", "Red October")
  heightBonus?: number;                // range multiplier for units standing here (a hilltop), e.g. 1.1
}
```

- The **backdrop** crossfades over 600 wu between neighbouring sectors that use different theatres. A mission may
  use only two theatres, so only two sets of strips are rasterised. Ground art changes at the sector edge with a
  200 wu blend.
- **Minimap**: sectors are shaded by ground; spawn points, objectives and the front line are marked. Spawn point chips
  under the minimap jump the camera.

### 4.2 Ground types (`src/data/ground.ts`)

| Ground | Infantry speed | Vehicle speed | Other |
| --- | --- | --- | --- |
| grass, field, steppe | 1.0 | 1.0 | |
| road, cobble | 1.0 | 1.1 | |
| forest | 0.9 | 0.75 | infantry in the open take bullets x0.85 (trunks) |
| mud | 0.8 | 0.6 | |
| sand | 0.9 | 0.85 | dust |
| rock, scrub (East Africa) | 0.9 | 0.8 | |
| snow | 0.85 | 0.9 | footprints decal |
| deepSnow | 0.65 | 0.75 | ski-tagged units ignore it |
| ice (frozen river) | 0.9 | barrier unless `iceHoldsVehicles` | |
| rubble | 0.7 | 0.55 | infantry in the open take bullets x0.85 |
| marsh | 0.6 | barrier off causeways | Bagration; the Oderbruch |
| beach, shallows | 0.8 / 0.5 | 0.9 / 0.7 | Gold, Sword |
| water (river) | 0.35 (wading or boats) | barrier | bridges override it (4.4) |
| slope | 0.85 going up, 1.1 going down | 0.8 going up | `heightBonus` on the crest sector |

All numbers are starting points for the balance tests. Speeds multiply the unit's speed; the tick looks the
multiplier up from a per-wu table (`Float32Array` of 1 entry per 50 wu), built once at battle creation and changed only
when rubble appears, so there is no search in the hot loop.

### 4.3 Buildings and rubble

```ts
interface BuildingDef {
  id: number; x: number; width: number;
  floors: 1 | 2 | 3 | 4;               // upper floors are a view detail plus a small range bonus
  slotsPerFloor: number;               // a floor holds this many men (window slots)
  hpMul: number;                       // x config.buildingHp
  owner: Side | -1;
  look: BuildingLook;                  // 'ruin' | 'apartment' | 'factoryHall' | 'casemate' | 'house' | 'church'
                                       // | 'mill' | 'station' | 'waterTank' | 'barn' | 'farm' | 'villa' | 'ministry'
                                       // | 'reichstag' | 'fort' | 'store'
  spawn?: boolean;                     // also a spawn point when owned (4.5)
  collapse?: 'rubble' | 'none';        // default rubble
}
```

- **Occupancy** works like trench slots: infantry with `usesTrench` may enter an owned or empty building; they cannot
  enter while enemies occupy it; a side captures it by entering it empty; `garrison` behaviour holds it to the last man.
  Vehicles never enter.
- **Target class `infantryBuilding`** is a new damage matrix column. Starting values: bullet 0.15 (pillbox-like, as
  the spec asks), explosive 0.7, antiTank 0.5, fire (job 7's flamethrower) 1.8 with flush-out (occupants hit by fire
  leave the building). Grenades and mortars rank buildings with men in them like trenches (`dugIn: 'prefer'`).
- **Floors**: men on floor 2 and up get `range x 1.08` and are drawn in upper windows. When building hp falls below
  `(floors - n) / floors`, the top remaining floor collapses: its occupants take explosive damage and drop to the floor
  below if there is room, otherwise they are pushed out into the street.
- **At 0 hp** the building becomes rubble: the occupants are expelled, and the ground across its width becomes
  `rubble` for the rest of the battle (the speed table updates). Rubble decals and half-walls stay as scenery. A
  rubbled building can be re-entered as `rubbleCover` with half the slots and bullet x0.4, so a destroyed house is
  still worth fighting over, as it was at Stalingrad.
- **Building hp** is shown to both sides as damage states (cracks, holes, fires), like pillboxes; buildings are not
  units, so hidden HP does not apply.
- **The HQ may be a building look** (`hq.look`): Pavlov's House is the player's HQ in mission 7; the Univermag is the
  German HQ in mission 10; the Reichstag is the objective in Berlin 10.

### 4.4 Rivers, bridges and ferries

- A river is a `water` sector. Infantry wade or paddle across at 0.35 speed with no cover. Vehicles stop at the bank,
  like a front-clamp barrier, and the AI never orders vehicles into one.
- `BridgeDef { id, x0, x1, hp, owner, demolition?: { side, wired: boolean } }` overrides the water across its span:
  everyone moves at road speed, and vehicles can cross while it stands. A wired bridge can be blown by the `demolish`
  event or by the owner's sappers. A capturing player can cut the wires by holding the bridge's capture point
  (Pegasus Bridge, Kalach, the Moltke Bridge).
- **Ferry spawn points** (4.5, `batchEvery`) bring trained units across in batches: the Volga crossing, Dnieper rafts,
  the Juba. The crossing itself is a scripted visual (a boat drawn across); it can be hit by `barrage` events that sink
  a share of the load (data, deterministic RNG).
- A frozen river (`ice`) is crossed on foot at 0.9; vehicles only if `iceHoldsVehicles` (the Oder, January 1945: no).

### 4.5 Capture points, forward spawn points and rally Fall Back

```ts
interface CapturePointDef {
  id: string; x: number; width: number; label: string;
  owner: Side | -1;
  captureTime: number;      // seconds a side must hold the zone alone to flip it (0 = instant, like trenches)
  spawn: boolean;           // owned and uncontested = units can deploy here
  contestRadius: number;    // an armed enemy within this distance = contested (no deploying)
  batchEvery?: number;      // ferry: deployments arrive together every N s
  structure?: StructureRef; // the point is a trench or building (captured the trench or building way)
}
```

- **Deploy choice**: the training bar gets a "Deploy at" chip: HQ or any owned, uncontested spawn point. It defaults
  to the forward-most one. Trained units walk out of the spawn point (a dugout, a house door, a ferry landing) instead of
  the HQ door. Cost, population and queues are unchanged. Sappers always come from and go to the HQ: money still has
  to be hauled home.
- **Fall Back** sends units to the nearest owned rally point behind them (a spawn point) and holds them there, out of
  the line. Only units within 2,500 wu of the HQ, or with no rally point behind them, go into the HQ. Per-kind Fall
  Back follows the same rule.
- **The hold line** is the forward-most of: owned trench, owned building, owned capture point. It replaces "forward-most
  owned trench".
- **The AI** (job 9) uses the same controls: it deploys at its forward-most safe point. The director's `posture`
  events and `pointLost` triggers let a script make it counter-attack a lost point, the classic German counter-attack
  of 1942 to 1944.
- **Waves** of an HQ-less attacker (survival) enter at the map edge, or at a spawn point named in the wave (`at`).

### 4.6 Minefields

```ts
interface MinefieldDef {
  id: number; x: number; width: number; owner: Side;
  mines: 'ap' | 'at' | 'mixed';
  density: number;          // 0..1; each blast and each cleared metre lowers it
  marked: boolean;          // the enemy sees warning signs (most real fields were marked on the owner's side only)
}
```

- An enemy unit moving inside a minefield rolls, per 10 wu moved, `density x CONFIG.mineChance[mines][class]` on the
  battle RNG. A blast deals `mineDamage[mines][class]` (AT mines ignore infantry; AP mines barely scratch tanks) and
  lowers the density.
- **Clearing**: a sapper given the Clear job (the prep-phase job system of job 6, run in reverse) clears at
  `config.mineClearRate` wu/s; explosive splash lowers density; a flail tank (`avreFlail`, D-Day) clears as it drives.
- The owner sees its fields; the other side sees a field once one of its units has set off a mine there, or it is
  `marked`, or a recon plane passes over it.
- Prep phases may offer `minefield` as a buildable (Kursk, Pavlov's House).

### 4.7 Weather and time of day changing mid-mission

- **Scripted weather is sim state**: `{ kind: WeatherKind, t: 0..1 }` with
  `WeatherKind = 'clear' | 'overcast' | 'rain' | 'snow' | 'blizzard' | 'fog' | 'dust' | 'smoke'`.
- **Visibility** caps the range at which direct-fire and hitscan weapons may acquire a target, for both sides:
  fog 0.6, blizzard 0.7, night 0.65, dust 0.8, smoke 0.85 (city fires). Flares (an event, or a call-in later) restore
  1.0 for 20 s over 1,500 wu. Searchlights (Seelow) set visibility to 0.9 in a band, and dust from the barrage brings it
  back down.
- **Air call-ins** are unavailable in blizzard and fog, and at night except where data allows (Po-2 night bombers,
  Mosquitoes).
- **Blizzard** also slows infantry x0.9 and reduces `accuracyFar` x0.85.
- **Transitions**: `weather` and `time` events run over `over` seconds. The sim switches at the midpoint, while the
  view crossfades sky grade, tint, particles and ambience over the whole span.
- **Random rain** (`weather.rainChance`) remains purely visual and uses the view's own RNG, so the sim is untouched.
  Missions with scripted weather turn random rain off.
- **Snow**: theatres gain a `winter` variant (palette whitened, snow on roofs and trees, snowfall particles, breath puffs
  on figures). Ground types `snow` and `deepSnow` do the rest.

## 5. Nations as data

### 5.1 From factions to nations

`FactionId` becomes `NationId` (keep `FactionId` as an alias during the refactor). Units already carry a `faction`
field, so a side may field units of several nations. The Juba crossing has Gold Coast, Nigerian and South African
troops on one side.

```ts
type NationId = 'british' | 'german' | 'soviet' | 'italian' | 'vichy' | 'romanian'
  | 'eastAfrican' | 'westAfrican' | 'southAfrican' | 'ethiopian' | 'congolese' | 'chadian';

interface NationDef {
  id: NationId;
  name: string; adjective: string;
  flag: FlagId;                         // drawn in code (src/art/flags), list in NATIONS.md
  colours: { tint: string; tintDark: string; ui: string; uiDark: string };  // HUD accent and campaign card
  kinds: UnitKind[];                    // which roles this nation has at all
  signature: { units: UnitKind[]; supports: SupportKind[] };
  eras: NationEraDef[];                 // first match wins (most specific first)
  speech: Record<'advance' | 'hold' | 'fallBack', string[]>;   // the commander's lines (job 7)
  hqStyles: NationHqStyles;             // the upgradeLooks per-nation table
  grenades: 'mills' | 'stick' | 'rgd' | 'f1' | 'srcm' | 'french' ;
}

interface NationEraDef {
  from: string; to: string;             // 'YYYY-MM'
  climate?: Climate[];                  // 'temperate' | 'winter' | 'desert' | 'tropical' | 'city'
  names: Partial<Record<UnitKind, string>>;      // "PTRD Team", "Panzer III Ausf. E"
  supportNames: Partial<Record<SupportKind, string>>;  // "Il-2 Shturmovik", "Typhoon Air Strike"
  look: {
    uniform: { tint: string; tintDark: string };
    headgear: Partial<Record<UnitKind, HeadgearId>> & { default: HeadgearId };
    kit: Partial<Record<UnitKind, KitId>>;       // greatcoat roll, smock, sash, webbing
    weapon: Partial<Record<UnitKind, GunLookId>>;
    vehicle: Partial<Record<UnitKind, VehicleLookId>>;  // 't26', 'bt7', 't34_76', 't34_85', 'kv1', 'is2', ...
    aircraft: Partial<Record<SupportKind, AircraftLookId>>;
  };
}
```

- **Stats stay mirrored by role.** A T-34 and a Panzer IV of the same era share the `tank` stats; what differs is
  names, looks, sounds and availability. Real asymmetry comes from signature units (their own kinds with their own
  stats and a tested counter), from `lightTank`, `heavyTank` and `kingTiger` being separate kinds, and from mission
  setup. That keeps "core roles balanced" true by construction.
- **Era resolution**: a mission has `dateIso` ('1942-09-14') and `climate`. The era for a nation is the first
  `NationEraDef` whose date range contains it and whose climate list (if any) includes the mission's. Names and looks
  merge over the nation's defaults.
- **Per-kind nation**: `SideStart.nation` (the default) plus `rosterNation?: Partial<Record<UnitKind, NationId>>`
  (for example, in the African campaign, `lightTank: 'southAfrican'`) and `ForceDef.nation?`.
- **Look ids are strings** resolved through registries in `src/art` (`HEADGEAR`, `VEHICLES`, `FLAGS`, `AIRCRAFT`).
  The boot atlas keeps only the UI and title art. Each battle rasterises the limb, headgear and vehicle sprites for the
  nations and eras present into its own atlas page (two at most), freed when the battle ends (risk 5).
- **The Armoury** (job 10): buying a role unlocks it for every nation. Signature kinds are bought once and appear
  wherever their nation is played.

### 5.2 Era-correct rosters as a test

`src/data/equipment.ts` lists every vehicle, aircraft and weapon look with its service window, and the theatres it is
allowed in:

```ts
export const EQUIPMENT: Record<string, { from: string; to?: string; theatres?: string[]; note: string }> = {
  pz3e:      { from: '1939-09', to: '1941-12', note: 'Panzer III Ausf. E, 3.7 cm; owner rule: 1939-41 only' },
  tiger1:    { from: '1942-09', note: 'first action near Mga, Aug-Sep 1942; never in the Stalingrad pocket' },
  panther:   { from: '1943-07', note: 'Kursk, southern face' },
  kingTiger: { from: '1944-07', note: 'owner rule: mid-1944 on, only where mission data places it' },
  t34_85:    { from: '1944-03' }, is2: { from: '1944-04' }, ptrd: { from: '1941-11' },
  katyusha:  { from: '1941-07' }, panzerschreck: { from: '1943-11' }, panzerfaust: { from: '1943-10' },
  piat:      { from: '1943-07' }, firefly: { from: '1944-06' }, kangaroo: { from: '1944-08' }, /* ... HISTORY.md table */
};
```

A unit test resolves every mission's rosters, start forces, waves, supports and look overrides, and fails if any look
is used outside its window or theatre. It also fails on a forbidden flag or emblem id (the list in `NATIONS.md`).

## 6. Campaigns

```ts
type CampaignId = 'stalingrad' | 'dday' | 'berlin' | 'africa';

interface CampaignDef {
  id: CampaignId;
  nation: NationId;                    // the card's flag and colours ('africa' shows its contingents' flags, NATIONS.md)
  title: string; subtitle: string;     // 'Stalingrad', 'June 1941 to February 1943'
  missionIds: number[];                // in order
  unlock: { always: true } | { afterMission: number };
  map: CampaignMapDef;                 // bounds, land and water shapes, rivers, labels, mission pins come from mapPos
  theme: MotifName;                    // musicThemes.ts: 'theLine', 'sovietWinter', 'roadWest', 'africaRising'
  mapMusic: TrackName;                 // the between-missions track (job 8 style)
  card: string;                        // one-line blurb for the select screen
}
```

- **Mission ids**: four digits, so today's save validation (`/^[1-9][0-9]{0,3}$/`) keeps working: Stalingrad
  1001 to 1010, D-Day 2001 to 2010, Road to Berlin 3001 to 3010, Africa 4001 to 4010. Ids 1 to 10 (the scrapped British
  campaign) remain readable for the migration only.
- **Unlocks**: Stalingrad, D-Day and Africa are open from the start. Road to Berlin unlocks after Stalingrad mission
  10 (it is the sequel). Within a campaign, clearing a mission unlocks the next, as today. The admin panel unlocks all
  (per session, as the queue specifies).
- **Campaign select**: a landscape screen with one card per campaign (flag, title, dates, progress "4 / 10", medals
  earned there, a lock line if locked), plus a "Continue" strip if a battle snapshot exists. The order is Stalingrad,
  D-Day, Road to Berlin, Africa. France and the German DLC append later.
- **Campaign maps**: `MAP_BOUNDS` becomes per campaign. Coarse hand-made polygons in data (as today) for each region:
  - Stalingrad: lon 22 to 47, lat 46 to 57.5 (Brest to Stalingrad and Moscow; Volga, Don, Dnieper).
  - D-Day: lon -1.25 to 0.45, lat 48.65 to 49.45 (Calvados coast, Orne, Odon, Caen, Falaise; a close-up).
  - Road to Berlin: lon 12 to 38, lat 49 to 56 (Kursk to Berlin; Dnieper, Berezina, Vistula, Oder, Spree).
  - Africa: lon 18 to 52, lat -26 to 33 (Libya and Egypt, the Horn, Kenya, Madagascar). The Mercator stretch is
    acceptable; a small inset for the Western Desert pins is optional.

## 7. How medals, loans, prep phases, phases and passives interact

### 7.1 Medal scoring inputs (job 10 owns the formula)

Each mission's data carries:

```ts
interface MedalTargets {
  scoring: 'timed' | 'fixed';          // fixed = survival, delay and timed holds: no time component
  targetMinutes?: number;              // timed: sim minutes from the end of the first prep to victory
  targetCasualties: number;            // own casualties, counted as population lost (rifleman 1, LMG team 2, tank 5)
  hqHealthWeight?: number;             // fixed: share of the score from HQ health at the end (default 0.3)
}
```

- **Time** is sim time, so 2x speed does not change the score, and prep-phase seconds do not count.
- **Casualties** count every own unit lost, loaned units included (they are men too), and sappers. They do not include
  units that were "inside" the HQ when it fell (the loss screen ends it anyway).
- **Side objectives**: each completed one adds its `bonus` (typically +10% to +20% of the score, capped so a perfect
  run is still the job 10 maximum of about 100 medals).
- **Delay missions** add their `kill` objective progress above the minimum as a bonus.

### 7.2 Loans

```ts
interface LoanDef { kind: UnitKind; count: number; at: 'start' | string /* phase id */; nation?: NationId;
                    resend?: number /* seconds, while the kind is still needed */; note: string }
```

- At battle creation, for each loan whose kind is **not** in the player's Armoury, the loan is active: `count` units
  are placed at the start or delivered when its phase starts, and again every `resend` seconds while that phase lasts.
  Loaned units are normal units with a `loaned` flag (a small tag on the training-bar icon). The kind is not trainable
  unless bought.
- Each loan's `note` goes into the briefing automatically: "On loan for this mission: 3 PTRD teams of the 1075th
  Regiment."
- The mission screen's medal line also shows loans, so a player knows before starting.
- **Rule for authors**: every mission whose phases contain enemy tanks loans `at` (or the era's anti-tank kind) unless
  the player starts with it. Every mission with pillboxes or buildings to clear loans `assault`, `mortar` or `flame`.
  The balance suite runs each mission with the minimal Armoury (rifle and sapper only) and the bot must still win on
  Normal.

### 7.3 Prep phases inside phases

```ts
interface PrepDef { seconds: number; zone: { from: number; to: number } | 'ownHalfOfSector';
                    buildables: BuildableId[]; money?: number /* granted at prep start */ }
```

- A prep phase can run at mission start (survival and hold missions, as job 6 specifies) **or at the start of any
  phase**: take the summit, then 45 s to dig in before the counter-attack. This is the "take a line, hold it" rhythm the
  spec asks for.
- During prep: the enemy holds (`posture: 'hold'` is implied), the phase's events and timers wait, the music plays its
  prep layer, and the HUD shows the countdown and "Ready". Unfinished builds continue after prep, as job 6 specifies.
- The zone defaults to the player's side of the newest owned point, never beyond the front.
- Autosave runs when prep ends.

### 7.4 Passives, difficulty, Armoury and the start of a battle

The battle's `loadout` (Armoury contents, upgrades, equipped passives) is frozen at battle creation, saved in the
snapshot, and used for loans and scoring. Changing passives mid-battle is impossible. Difficulty sets lethality and AI
skill. **Scripted forces (start forces, garrisons, waves) are the same on every difficulty.** Job 9 may scale scripted
enemy waves down for Recruit only, by a data multiplier.

### 7.5 Hidden HP, recon and scripted reveals

Enemy HP stays hidden. Missions grant the Recon call-in where its plane existed for that nation and date (NATIONS.md).
A few scripted `reveal` events stand in for good intelligence (the Merville model, the Hillman plans).

### 7.6 The commander (job 7)

One per army. Missions with a historical commander name him only in the briefing; the in-battle commander is generic
("Lieutenant", "Major") with the nation's speech lines. A mission may set `commanderName` for flavour (Popel, Howard,
Otway). Never name a German or Italian commander in a speech line.

## 8. Saves

### 8.1 New fields (save version after job 10's)

```ts
interface SaveData {
  // existing: version, cleared, upgrades (job 10 turns these into medals), lastMission, settings
  campaigns: Record<CampaignId, { lastMission: number }>;    // the map opens on it
  lastCampaign: CampaignId | null;
  // job 10: medals, armoury, wins per mission and difficulty; job 5: passives and equipped
  legacy?: { britishCleared: Record<string, Difficulty[]> }; // the scrapped British campaign, kept for the record
}
```

`cleared` stays keyed by mission id. The new ids are four digits, so validation keeps working; `SaveRules.missionIds`
becomes the union of all campaigns' ids.

### 8.2 The British to D-Day migration (when D-Day ships)

One migration step (`MIGRATIONS[n]`):

1. Move `cleared["1".."10"]` into `legacy.britishCleared`; delete them from `cleared`; drop job 10's per-mission win
   counters for ids 1 to 10.
2. **Keep** medals, the Armoury, upgrade levels, passives and equipped passives exactly as they are (the owner's rule).
3. D-Day starts at mission 2001. A player who had cleared the old British mission 10 gets the D-Day tutorial marked as
   optional ("Skip the tutorial?"), not cleared, so medals are not double-paid.
4. `lastMission` 1 to 10 becomes 0; `campaigns.dday.lastMission` 2001.
5. A one-time notice on the campaign select: "The British campaign is now D-Day, Normandy 1944. Your medals,
   Armoury and passives are kept."

Idempotent and tested like the existing steps (old save in, expected save out; a corrupt legacy block is dropped,
not fatal). A battle snapshot of an old British mission fails the `dataHash` check and is dropped with its notice.

### 8.3 hunteracedev.com card text (for the site repo, `..\hunteracedev`)

Owner's push-to-live rule applies; the text, for the Tin Hats card:

> **Tin Hats**: a side-view Second World War strategy game for your phone. Command Soviet riflemen from Brest Fortress
> to the ruins of Stalingrad, British paratroopers and tanks from Pegasus Bridge to the Falaise Pocket, the long road
> to Berlin, and the African soldiers who fought from Somaliland to El Alamein. Raise an army, dig in, call in the guns,
> and earn your medals. Free, in your browser, no download.

## 9. Mission authoring rules (all campaigns)

1. **Era first**: set `dateIso` and `climate`; the equipment test refuses anything out of period.
2. **Mighty Germans (and Italians) early, through setup only**: more and better-placed start forces and garrisons,
   pre-built defences (trenches, buildings, wire, mines, pillboxes), more call-ins and earlier ones (Stukas from the
   first minute in 1941 to 1942), heavier scripted waves, the initiative (they attack first). **Never more income than
   the player**: enemy `incomeMul` is at most the player's. On Insane the enemy has the player's income by rule, so a
   mission that relied on a higher enemy income would get easier on Insane. **Never stat changes.** As the war turns,
   the balance shifts: by 1944 to 1945 the player has the call-ins, the heavier start and the initiative.
3. **The cap of 100** applies to both sides at all times. Enemy pre-placed forces plus garrisons stay at or below 70
   population, so the AI can still train and waves have room. Waves that would exceed the cap wait in the reserve, as
   today. Player start forces are 10 to 30 population, plus loans.
4. **Length**: most missions 15 to 30 minutes on Normal for the reasonable bot. `expectedMinutes` checks it. Tutorials
   and specials 8 to 15.
5. **Rhythm**: three to five phases, a scripted event at least every 90 to 120 s (barrage, raid, counter-attack,
   reinforcement, weather), a forward spawn point every 5,000 to 8,000 wu of advance, and at least one side objective.
6. **Every phase is beatable alone**: write `assume` for each phase, and the balance suite runs phase-isolated tests.
7. **Loans** wherever the phase needs a kind the player might not own (7.2).
8. **The last three missions of a campaign feature tanks** (the owner's note), with their counters on both sides.
9. **Briefings** are three short paragraphs (about 60 to 90 words each) in the voice of a commander of that army, in
   original words. No real quotations, and myths labelled as legend where they are mentioned at all.
10. **Symbols**: only the flags and emblems allowed in `NATIONS.md`.
11. **Music**: every mission names its own track; reuse only `sword`, `hill112`, `crusader` and `alamein`, where the
    campaign docs say.

## 10. Speed, casualties, end screen

- **1x/2x**: a button in the battle top bar (and `F` on a keyboard). At 2x the loop steps the sim twice per frame,
  reusing the debug time-scale path. Music and sounds stay at normal pitch. The speed is saved in the snapshot.
- **Casualty count**: side stats already count deaths. The end screen shows "Your casualties: 23 (men lost)" and
  "Enemy casualties", split by infantry and vehicles, plus side objectives and the medal breakdown (job 10).

## 11. Tests and checks added by Part 1

- `snapshot.test.ts`: the round-trip graph walk (every own enumerable field of the state equal after restore), and
  determinism (snapshot at random ticks, restore, run on, hash equals the uninterrupted run) for every mission, two
  seeds, every difficulty.
- `director.test.ts`: every trigger and event type; phase transitions; prep inside a phase; `assume`.
- Legacy equivalence: the ten British missions give identical results before and after the director.
- `ground.test.ts`, `buildings.test.ts`, `bridges.test.ts`, `mines.test.ts`, `spawn.test.ts`: the rules above.
- `equipment.test.ts`: era-correct rosters and the symbol list.
- Balance: every phase of every new mission is winnable by the reasonable bot on Normal with the minimal Armoury
  plus loans; the idle commander loses; signature units each have a counter in the matchup table; mirrored maps with
  each nation pair are about 50/50.
- Browser: campaign select, resume after a reload mid-battle (the e2e closes the page, reopens and continues), 2x
  speed, a building fight, and the end screen casualty line.
- Perf: `tools/perf.ts` on the longest map (Uranus, 30,000 wu) with 200 units and a building-heavy map (the factory
  district), plus the snapshot time.

## 12. Decisions to log in `docs/DECISIONS.md` when this is built

1. Snapshot, not replay, for resume; replay as a test tool.
2. Phases as a director over the existing event system; legacy missions as one phase.
3. Stats mirrored by role across nations; asymmetry from signature kinds and setup.
4. Enemy income never above the player's in mission data.
5. Fall Back to the nearest rally point, the HQ only when close.
6. Scripted weather affects visibility for both sides; random rain stays visual.
7. Buildings as a new target class; rubble keeps half cover.
8. Mission ids by campaign in thousands; the British legacy kept under `legacy`.
9. Road to Berlin unlocks after Stalingrad; others open.
10. Casualties counted as population lost, loans included.
