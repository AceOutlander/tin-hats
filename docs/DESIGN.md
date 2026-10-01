# Tin Hats: design reference

The detailed spec every implementer works from. `docs/PLAN.md` is the short overview and task list.
Numbers quoted here are starting points; the real values live in `src/data/*.ts` and get tuned by the balance tests.

## 1. Pillars

- Side-view WW2 RTS for phones in landscape. Feel: workers gather, you train an army, three army-wide orders, destroy the enemy HQ.
- Everything original. No names, art or audio from any other game. No swastikas, SS runes or other Nazi party symbols anywhere. The German flag is a Balkenkreuz: a plain straight-armed black cross with a white outline.
- Simulation is plain deterministic TypeScript (`src/sim`, `src/data`, `src/meta`): fixed timestep, seeded RNG, no Phaser, no DOM, no wall clock. It runs headless in Node for tests.
- Phaser 4 draws the battlefield. The HUD and menus are DOM elements over the canvas (crisp text, safe areas, easy touch targets). All art is drawn in code with Canvas 2D. All sound is synthesised with WebAudio.
- Every tunable number is in `src/data`. Logic files contain no gameplay constants.

## 2. Space, time, determinism

- World units (wu). x runs 0 (left edge) to `mission.length`. About 1000 wu is one screen. 540 wu are always visible vertically.
- Side 0 owns the left HQ and faces +x. Side 1 owns the right HQ and faces -x. `dir(side) = side === 0 ? 1 : -1`.
- Fixed tick: 30 Hz (`config.tickRate`), `DT = 1/30`. The renderer interpolates between ticks (`prevX` to `x`) and runs animation at display rate.
- One seeded RNG (mulberry32 or similar) owned by the battle. Same config + seed + command stream gives the same battle, bit for bit.
- The tick must be side-symmetric: no side may act on fresher information. Collect all damage dealt in a tick and apply it after every unit and structure has acted. A mirrored AI-vs-AI battle must be fair.
- Combat is resolved along x only. Units have a depth `row` (0..3) for visual spread; it never affects gameplay.
- No per-tick allocation in hot paths: pool units, projectiles and events; reuse scratch arrays; no closures in inner loops.

## 3. Simulation API (`src/sim/index.ts`)

```ts
createBattle(config: BattleConfig): Battle
// BattleConfig: { mission: MissionDef; difficulty: Difficulty; seed: number;
//                 upgrades: UpgradeLevels;          // applied to side 0 only
//                 commanders: [CommanderKind, CommanderKind] } // 'human' | 'ai' | 'bot' | 'idle'
battle.step(): void                 // advance exactly one tick
battle.command(side, cmd): void     // queued, applied at the start of the next tick
battle.state: BattleState           // read-only for the view
battle.events: EventBuffer          // events emitted during the last step (pooled, cleared each step)
runBattle(config, maxSeconds): BattleResult   // headless helper used by tests and tools
```

Commands: `train(kind)`, `order(order)`, `support(kind, x)`, `control(unitId | -1)`, `controlInput(moveX, fire, ability)`.
Commands from a human, the AI and the test bots go through the same queue and the same validation (cost, population, cooldown, availability).

### State the view may read

`BattleState`: `tick`, `time`, `length`, `mode`, `over`, `winner`, `endReason`, per-side `SideState`
(`supplies`, `income` estimate, `pop`, `order`, per-kind `queue` count and `progress`, support cooldowns, `hq` or null, stats),
`units` (dense pool with `alive`), `projectiles`, `smokes`, `trenches`, `pillboxes`, `wires`, `dumps`, mission `timer`.

Each unit exposes at least: `id, kind, side, faction, x, prevX, row, facing, hp, maxHp, action: UnitAction, actionTime,
velX (signed wu/s this tick), carrying, trenchId (-1 if none), controlled, aimX (x of what it is aiming at), weaponCharge (0..1)`.

Events (pooled flat records with a `type` and generic numeric fields, documented per type):
`shot` (shooter, weapon, from x/row, to x/row, hit or miss), `projectile` spawn, `explosion` (x, radius, kind),
`unitSpawned`, `unitDied` (kind, side, x, row, cause, direction of the blow), `unitHit`, `structureHit`, `structureDestroyed`,
`trenchCaptured`, `wireDestroyed`, `supplyDelivered`, `trainStarted`, `trainDone`, `orderChanged`,
`supportCalled`, `supportIncoming`, `smokeSpawned`, `wave`, `airdrop`, `announce`, `hint`, `controlLost`, `battleEnded`.

## 4. Economy and training

- One resource: Supplies. Each HQ gives a passive trickle (`config.hqIncomePerSec`).
- A supply dump sits `config.dumpDistance` in front of each HQ. Sappers walk HQ to dump, spend `loadTime` loading, and carry `sapperCarry` supplies back; supplies are credited when they reach the HQ door. The dump never runs dry.
- Training: each unit kind has its own queue; kinds train in parallel, one unit at a time per kind. Cost and population are paid when queued, so the cap (40) can never be exceeded. A finished unit appears at the HQ door and walks out.
- Population = population cost of living units plus queued units.
- Sides flagged `hasHq: false` (survival attackers) have no economy; their units arrive from mission events at their map edge.

## 5. Orders and movement

Each side has one current order. Changing it is instant and free.

- **Hold** (default). The hold line is the forward-most trench the side owns, or `config.holdLineOffset` in front of the HQ if it owns none. Trench-capable infantry fill the trench's slots (walk to slot x, drop in). Everyone else, and overflow, waits behind the line at `unit.formationDepth` plus a per-unit spacing offset so units never stack. Units fire at anything in range but do not chase. Sappers keep working.
- **Advance**. Units leave trenches and push toward the enemy. A unit moves forward until an enemy it can engage is within `range * engageFrac`, stops, and fights (most weapons require standing still). When nothing is in range it moves on: to the next enemy trench, pillbox, and finally the HQ. An empty or cleared enemy trench is captured by walking into it; ownership flips and the hold line moves up. Sappers keep working.
- **Fall Back**. Every unit including sappers runs to the HQ and goes `inside` (untargetable, not drawn). The HQ machine gun keeps firing. On another order they walk back out.
- Front clamp: no ground unit may move past the nearest living enemy blocker ahead of it (enemy unit on the field, occupied trench, live pillbox, HQ) minus `config.contactGap`. Lines never pass through each other.
- Wire slows enemy infantry inside it to `config.wireSlow` of their speed. Tanks crossing wire destroy it.
- `guard` units (boss tank) stay within `config.guardLeash` of their post and ignore orders. `assault` units (wave attackers) always advance.
- Units moving get `action: 'move'` with a signed `velX`; the walk/run animation is driven from distance travelled so feet never slide.

## 6. Combat

- Targeting: nearest valid enemy within range (and beyond `minRange`), preferring kinds in `weapon.prefer`. Valid target classes come from `weapon.targets`. Retarget only when the target dies, leaves range, or a preferred kind appears.
- Sequence: acquire target, `aim` for `aimTime`, `fire` (burst of `burst` shots `burstInterval` apart), then `reload` for `cooldown`. Moving resets the aim unless `moveAndFire`.
- Hitscan weapons roll to hit: chance falls linearly from `accuracyNear` to `accuracyFar` across the range. Every shot emits a `shot` event so the view draws a tracer, hit or miss.
- Lobbed weapons (mortar, grenade, artillery, bombs) spawn a projectile that lands after its flight time at the aim point plus `scatter`. Direct shells and rockets fly flat and fast. Explosions damage everything within `splashRadius` (both sides' structures included, friendly units excluded), falling off linearly.
- Damage = weapon damage x `DAMAGE[damageType][targetClass]` x upgrade and control multipliers. Target classes: infantry in the open, infantry in a trench, fortification (pillbox), vehicle, hq.
  Starting matrix: bullet 1.0 / 0.3 / 0.05 / 0.05 / 0.35; explosive 1.0 / 1.0 / 0.6 / 0.5 / 0.6; antiTank 0.3 / 0.2 / 0.8 / 1.6 / 0.8.
- Smoke: a cloud blocks direct fire (hitscan and direct weapons) along any line that crosses it or ends in it, unless the shooter is within `config.smokePointBlank` of the target. Lobbed weapons ignore smoke.
- Medics heal the most wounded friendly infantry within `healRange` at `healRate`; they follow the line and stay behind it.
- Because nearly everything shoots, range must not decide every fight: longer range means slower fire or higher cost, trenches cut bullet damage to 30%, smoke shuts down ranged fire, and assault troops are fast enough to cross the gap.

Unit roles (stats in `units.ts` and `weapons.ts`):

| Kind | Role |
| --- | --- |
| sapper | hauls supplies, unarmed, pop 1 |
| rifle | cheap, medium range (about 330), single aimed shots |
| lmg | long bursts, range about 380, slow to move, must stop and settle (long aim time) |
| assault | fast, SMG range about 170, throws grenades (explosive splash) at trenches and pillboxes |
| mortar | lob, range about 750, minimum range about 250, slow shots, helpless up close |
| sniper | range about 620, slow, fragile, prefers lmg, mortar, medic |
| medic | heals, unarmed |
| at | rocket, strong vs vehicles and fortifications, poor vs infantry |
| tank | vehicle, HE gun plus coaxial MG, expensive, pop 5 or so |
| heavyTank | boss, not trainable |

Counters to preserve: lmg beats infantry in the open; assault beats trenches and mortars; mortar beats trenches, pillboxes and lmg nests; sniper beats lmg, mortar, medic; at beats tank and pillbox; tank beats infantry without at; rifle is the efficient generalist that screens the specialists. No single unit spam may beat a sensible mixed army of equal cost.

## 7. Structures

- **HQ bunker**: health `config.hqHp` x mission multiplier x upgrades. Has a machine gun (weapon `hqGun`). Losing it loses the battle. Units spawn at and retreat into its door.
- **Trench**: `x`, `width`, `slots`, `owner` (-1, 0, 1). Occupants count as `infantryTrench`. A side cannot enter a trench while living enemies occupy it. Ownership changes when the other side's infantry enters; it persists when the trench is empty. Both sides get cover from the same trench. Tanks drive over and cannot occupy.
- **Pillbox**: fixed side, high health, target class `fortification`, machine gun (weapon `pillboxGun`). Destroyed pillboxes stay as rubble with no effect.
- **Wire**: `owner`, health; damaged only by explosive splash; crushed by tanks.
- **Supply dump**: indestructible scenery where sappers load.

## 8. Direct control

- The player may take over one controllable unit of their side. It ignores orders, moves with the joystick (still front-clamped), auto-aims at the nearest valid target, fires while the fire button is held, and uses its secondary weapon on the ability button.
- Buff while controlled: damage x `config.controlDamageMul` (1.25) and reload speed x `config.controlReloadMul` (1.25).
- A controlled infantryman standing in a trench that is not enemy-held, with a free slot, takes that slot and gets cover.
- Control ends when the player releases it, the unit dies (`controlLost` event), or the battle ends. Sappers cannot be controlled.

## 9. Support call-ins

Artillery Barrage (several explosive shells over a few seconds around the target), Smoke Screen (cloud blocking direct fire for a few seconds), Air Strike (a fighter-bomber crosses the map and rockets a strip: explosive with anti-tank punch). Each has its own cooldown per side. Availability comes from the mission. The AI uses the same three under the same rules.

## 10. AI commander

One implementation drives the enemy in the campaign, both sides in mirrored tests, and (with a different plan) the "reasonable player" test bot.

- Economy first: train sappers up to the plan's count, then follow the mission's build plan (`BuildStep[]`: keep `count` of `kind` alive after `after` seconds).
- Reactions: sees enemy tanks, add anti-tank teams; sees enemy infantry dug into trenches or pillboxes ahead, add mortars and assault troops; sees massed infantry in the open, add machine guns.
- Orders from relative army strength (sum of supply cost of living combat units, own vs enemy visible): Advance when own >= enemy x attack ratio and past `firstAttackAfter`; Fall Back when the enemy is at the hold line and own < enemy x retreat ratio; otherwise Hold. Hysteresis and a minimum time between changes prevent flapping.
- Supports: artillery on the densest enemy cluster or an occupied trench; smoke in front of its own advance; air strike on tanks or big clusters.
- Difficulty scales AI income, aggression (attack thresholds, wave strength) and think interval. It never changes unit stats.
- The idle commander does nothing (used to prove every mission is lost by a passive player).

## 11. Missions

Ten British missions defined entirely in `src/data/missions/`. See `docs/PLAN.md` for the list. Mission data sets map length (6000 wu in mission 1 up to 14000 in mission 10), theatre and time of day, trenches, pillboxes, wire, starting supplies and forces, available units and supports for each side, timers, scripted events (waves, airdrops, announcements, hints) and the AI and bot build plans.

- Assault missions: destroy the enemy HQ; lose if yours falls (or a deadline timer expires).
- Survival missions: side 1 has no HQ; waves enter from the right edge and always advance; the player wins when the timer runs out and loses if the HQ falls.
- Mission 5 has a deadline: the sky darkens as the timer runs down.
- Mission 9: no sappers, no tanks; supplies arrive as periodic airdrops.
- Mission 10: a King Tiger (`heavyTank`, `guard`) sits in front of the German HQ.

## 12. Campaign, upgrades, save (`src/meta`)

- Clearing a mission unlocks the next and awards 2 upgrade points the first time.
- Upgrades (3 levels each, 1 point per level, free refunds): sapper drill (speed and carry), HQ income, HQ health, HQ machine gun, plus health and damage per combat unit kind. Upgrades apply to the player's side only.
- Save: versioned JSON in localStorage through an injected storage interface (so it is testable in Node). Missing or corrupt data falls back to a fresh save without throwing. Stores progress, cleared difficulties, upgrade levels and settings.

## 13. Balance tests (`tests/balance`, `tools/`)

- Mirrored AI vs AI on a symmetric map: close to 50/50 over many seeds.
- Equal-cost matchup table for every unit pair, in the open and attacking a trench, saved to `docs/BALANCE.md`.
- On Normal with no upgrades every mission is won by the reasonable-player bot and lost by the idle bot.
- Health checks during long runs: no NaN, no negative supplies or population, no frozen units, battles always end.

## 14. Rendering (`src/render`, Phaser 4)

- Canvas fills the screen; camera zoom = canvas height / 540 so the same vertical slice shows on every phone, and wider phones simply see more of the front. Device pixel ratio is honoured up to 2.
- Draw order uses `DEPTH` in `src/data/view.ts`, back to front: sky, sun or moon, clouds, far, mid and near backdrop (parallax factors in `PARALLAX`), ground, decals, trench back walls, structures, shadows, unit rows 0..3, trench front parapets and front wire strands, markers, projectiles, effects, smoke screens, foreground parallax strip, night tint, rain, lightning flash. The DOM HUD is above the canvas.
- Units crossing a trench dip into it; occupants stay lowered behind the front parapet, which draws over their legs.
- Stick figures are skeletal: hip, spine, neck, head, two-bone arms and legs. The pose is a pure function of (kind, action, time, distance travelled, aim angle). Legs use a real gait cycle driven by distance travelled, with planted feet, knee bend, arm counter-swing and body bob. Poses blend smoothly between actions (no popping). Actions: idle (breathing, weight shift), run, aim, fire (recoil), reload, throw, carry crate, load, heal, crew-weapon deploy, in-trench stance, hit flinch, several death falls, victory cheer.
- Figures are black with rounded limbs. Sides are told apart by helmet shape and tint: Brodie "tin hat" in khaki, Stahlhelm in field grey, plus small kit in the faction tint.
- The figure is drawn by positioning pre-rasterised limb sprites (constant bone lengths, round caps) from one texture atlas, so 80 or more units cost one batch. The same pose code can draw to a 2D canvas for UI icons.
- Tanks: hull, turret, barrel recoil, rolling track and road wheels, exhaust puffs, hull rock on firing.
- Effects are pooled: tracers, muzzle flashes, shell casings, dust kicked up by feet and tracks, dirt and smoke from explosions, craters and scorch decals that fade, debris from pillboxes, wire snapping, crates, parachutes on airdrops, the strike aircraft's shadow and pass.
- Flags wave. The British HQ flies the Union Jack; the German HQ flies the Balkenkreuz flag.
- Weather (visual only, never touches the sim or its RNG): each battle has a `weather.rainChance` (0.40) chance of rain. While raining, a thunder check runs every `weather.thunderCheckInterval` (2 s) with `weather.thunderChance` (0.005): on success, lightning flashes the sky and thunder rolls. Rain has streaks at two depths, ground splashes, a darker sky grade and a rain sound loop.

## 15. User interface (`src/ui`, DOM)

- Landscape only; a "rotate your phone" overlay in portrait. Respect `env(safe-area-inset-*)`. Touch targets at least 48 CSS px. Nothing depends on hover. Mouse and keyboard also work.
- Battle HUD: top bar with supplies and income, population, timer or objective, both HQ health bars, minimap strip (tap or drag to jump the camera), mute and pause. Bottom bar with unit buttons (icon, cost, population cost, queue count, training progress). Three big order buttons within right-thumb reach, always visible. Support buttons with cooldown sweeps; tapping one enters targeting mode, then a tap on the battlefield calls it.
- Direct control: tap a friendly unit; a joystick appears bottom-left and fire, ability and release buttons bottom-right; tap the unit again or the release button to let go.
- Screens: title, campaign map with ten pins, briefing, Quartermaster, pause menu, result, settings.
- Browser scrolling, pinch-zoom, text selection and long-press menus are disabled over the game. The game pauses when the tab or app loses focus.

## 16. Audio (`src/audio`)

WebAudio synthesis only: rifle, machine-gun burst, SMG, sniper crack, grenade, mortar thump and whistle, tank gun, rocket, explosion sizes, ricochet, tank engine, UI clicks, order whistle, training done, supply delivered, victory and defeat stings, rain loop, thunder. A mute button; the setting is saved. Audio starts on the first user gesture.

## 17. Debug and test hooks

With `?debug=1` the page exposes `window.__TH`: start a mission directly, read a state summary, set the time scale, force weather, force a thunder strike, list HUD button rectangles, grant supplies, and report frame and sim-step timings. Smoke tests use it to fast-forward battles.
