# Cosmetics: design notes (from the owner)

Design notes for the cosmetic items that the supply crates will hold. Nothing here is built yet. The crate system
itself is queued in `docs/QUEUE.md` ("cosmetic supply crates"); the owner designs every item.

## Rules for every cosmetic

- Cosmetics are visual only and never affect stats.
- Skins don't have to be historically accurate; they're separate from the history and lore. (Owner, 2026-11-18.)
- No swastikas, SS runes or any other Nazi party symbols, as everywhere in the game.
- Rarity tiers, lowest first: Common, Uncommon, Rare, Epic, Legendary, Mythic, and the secret "???" above Mythic (one item, "Hacked", from the God Crate). ("Mythic" appears in the owner's
  Premium Crate odds of 2026-11-18; no Mythic item is designed yet.) "Uncommon" was added by the owner on
  2026-11-18, between Common and Rare; the crate spec in `docs/QUEUE.md` was written before it.
- "Special" (owner, 2026-11-21) is a rarity outside the crate tiers, for skins that never drop from crates.
- A skin can be for the enemy: the player chooses how the enemy soldiers look to them. Still visual only.

## Skin 1: "Night Ops" (Epic), British soldiers

Owner, verbatim (2026-11-18):

- A dark, modern tactical black helmet with attachments.
- Quad night-vision goggles with green lenses: flipped down and in use on night or rainy missions, flipped up on the
  helmet otherwise.
- Purely cosmetic, with no gameplay effect.

Status: design note only. Don't build it yet.

## "Royal" (Common), British Lieutenant

Owner, verbatim (2026-11-18):

- The British Lieutenant (commander) wears a ceremonial cavalry dress helmet, based on the attached reference photo:
  - A polished silver-steel dome with a gold trim along the brim and a short peak at the back.
  - A gold star plate on the front with a simple original centre emblem (don't copy any real regimental badge text).
  - A gold laurel band around the helmet, a gold rosette at each side, and a gold chin chain.
  - A tall, flowing cream horsehair plume from a gold top spike, swaying as he moves.
- Simplified to read clearly at phone size in the stick-figure style.
- Purely cosmetic, no gameplay change.

Status: design note only. Don't build it yet.

What the reference photo shows (described here because the photo is not ours to publish and is not in the repo;
the owner has it):

- A tall, rounded dome that narrows toward the top, in bright silver steel.
- The front peak is long and comes to a point low over the brow; the back peak is short. A thin gold edge runs
  round the whole brim.
- An eight-pointed rayed gold star on the front. Its centre is a round silver band with lettering and a badge
  inside: replace both with our own simple emblem and no lettering.
- A gold band of laurel leaves round the dome above the brim, ending at a gold rose-shaped boss on each side.
- A gold curb chain from the side boss, hanging in a loop under the chin.
- A gold leaf-shaped spike on top, a little taller than a hand is wide, with a ring of gold leaves at its foot.
- A cream horsehair plume from the spike, falling down the back to about the level of the chin.

## "Old Times" (Uncommon), enemy skin for German forces

Owner, verbatim (2026-11-18):

- The player chooses this as how enemy German soldiers look. Purely cosmetic, no gameplay change.
- A WW1 spiked helmet (Pickelhaube) based on the attached reference, but in plain field style: black leather with dull grey-steel fittings instead of gold, a small plain front plate, and a simple chin strap. No shiny brass or ornate badge.
- Full WW1 field gear: a field-grey tunic with buttons down the front, leather belts with ammo pouches, tall boots, a rolled blanket over the shoulder and a bayonet on the rifle.
- No Nazi symbols, as always.

Status: design note only. Don't build it yet.

What the reference photo shows (the photo is not ours to publish and is not in the repo; the owner has it). It is
a parade version; the owner wants the plain field version of the same shape:

- A low, rounded black leather skull with a short squared front peak and a short neck guard at the back.
- A spike on top: a round base plate, a short neck with small vent holes, then a smooth pointed cone.
- A metal edge round the front peak and a thin metal strip up the back of the skull.
- A round boss on each side holding the chin strap, which is worn up over the front peak or down under the chin.
- On the photo the fittings are brass and the front carries a large rayed star plate: for the skin, make the
  fittings dull grey steel and the plate small and plain, with no badge, crest or lettering.

## "Cyber Chassis" (Legendary), enemy skin for the German King Tiger

Owner, verbatim (2026-11-18):

- The player chooses this as how enemy King Tigers look. Purely cosmetic: it uses the King Tiger's exact hitbox, speed, armour, damage, reload and every other stat.
- The King Tiger becomes a towering two-legged combat mech, about as tall as a King Tiger is long, walking with heavy, stomping steps that shake the ground slightly.
- Dark gunmetal armour plating with glowing light-blue seams and a light-blue visor.
- Left arm: a large arm cannon. Its shot is a bright light-blue laser beam that ends in an explosion with a blue tint, firing on the King Tiger's normal reload.
- Right arm: a heavy machine gun firing light-blue tracers, replacing the tank's machine gun.
- On destruction it collapses to its knees and sparks, then breaks apart in a blue-tinted explosion.
- Readable at phone size and cheap to draw.

Owner, added later the same day (verbatim):

- More bulk: thicker legs and thighs, and wider, heavier feet, so it looks like it can carry the cannon.
- A bigger cannon arm, with a short glowing light-blue charge-up at the barrel just before each shot, timed to the King Tiger's normal reload so it stays purely cosmetic.
- Keep the height about where it is, or a touch taller than the King Tiger's length.

Reference sketch (ours, drawn for this note; version 2, with the changes above): `docs/cosmetics/cyber-chassis-concept.svg`.
It shows the mech from the side as an enemy, with a soldier and a King Tiger outline for scale, and an inset of the
charge-up. It is a concept drawing, not game art.

Status: design note only. Don't build it yet.

Notes for whoever builds it (not the owner's words): the mech is much taller than the tank it stands for, while
the hitbox stays the tank's, so shots that pass through its upper body will miss; check how that reads. The
ground shake is a picture effect only. A skin that changes a shot's look (beam, blue blast, blue tracers) must
not change its timing, range or damage. The charge-up glow plays inside the last moments of the normal reload; it must never
delay the shot.

## "Frost Ghoul" (Epic), Soviet Sniper

Owner, verbatim (2026-11-18):

- An all-white winter camouflage suit with a loose hood, white mittens and a white cloth face mask, based on the attached reference photo for the general look only.
- Modern tactical goggles worn over the face mask, with dark lenses and a strap around the hood.
- The rifle wrapped in white cloth strips.
- Purely cosmetic, no gameplay change.

Status: design note only. Don't build it yet.

What the reference photo shows (general look only; the photo is not ours to publish and is not in the repo; the
owner has it):

- A black-and-white wartime photo of a sniper lying in snow, seen from the front.
- A loose white hood, peaked at the top, falling over the shoulders like a cape; the whole suit is baggy.
- A white cloth mask over the whole face with two narrow eye slits and nothing else. (The skin puts the
  dark-lensed goggles over this.)
- Thick mittens, darker than the suit in the photo; the owner wants them white.
- A long bolt-action rifle with a wooden stock, held low along the snow. (The skin wraps it in white strips.)

## "Evolved" (Epic), Soviet Riflemen

Owner, verbatim (2026-11-18):

- A modern-day soldier look, based on the attached reference photo for the general look only: red berets, a modern green-and-tan digital/multi-tone camo uniform, a plate-carrier vest with pouches, tactical gloves and black combat boots.
- The rifle is drawn as a modern AK-12-style assault rifle.
- No real unit patches, badges or insignia copied; use simple generic shapes.
- Purely cosmetic: same fire rate, damage, range and everything else as the normal Rifleman. Single shots, not rapid fire, with only the rifle's look and sound changed.

Status: design note only. Don't build it yet.

What the reference photo shows (general look only; the photo is not ours to publish and is not in the repo; the
owner has it):

- A parade photo of soldiers marching in ranks, rifles held across the chest.
- Dark red berets worn pulled to one side.
- A camouflage uniform in small blotches of light green, tan and a little brown, jacket and trousers alike.
- A black belt, black gloves and tall black lace-up boots with the trousers tucked in.
- Black assault rifles with a folding stock and a curved magazine, on a sling.
- The photo has shoulder patches, a striped undershirt at the collar and no plate carrier. For the skin: no
  patches or badges at all, and add the plate-carrier vest with pouches that the owner asks for.

## "Night Wing" (Legendary), Allied bomber (every Allied nation)

Owner, verbatim (2026-11-18):

- The bomber call-in becomes a modern stealth flying-wing bomber, based on the attached reference photo for the general shape only: a dark grey tailless wing with a jagged, saw-tooth back edge, a smooth central hump for the cockpit and flush engine intakes on top.
- Drawn slightly tilted toward the camera so the wing shape reads in the side view, not as a flat sliver.
- Nearly silent fly-in with a low hum, and a faint heat shimmer behind it.
- No real squadron markings or tail numbers copied.
- Purely cosmetic: the same bombing run, area, damage, timing and cooldown as the normal bomber.

Status: design note only. Don't build it yet.

What the reference photo shows (general look only; the photo is not ours to publish and is not in the repo; the
owner has it):

- A stealth flying-wing bomber seen from above and slightly in front, banked toward the camera.
- One smooth dark grey wing with no tail and no separate body; the front edge is a straight swept V.
- The back edge is a saw-tooth: a large W of points across the whole span.
- A low rounded hump at the centre with a small dark windscreen at the nose.
- Two flush engine intakes on top, one each side of the hump, with shallow exhaust troughs behind them.
- Faint panel lines over the surface. The photo has a number and small emblems near the cockpit: leave all of
  them out.

Note for whoever builds it (not the owner's words): the normal bomber's engine sound is how the player hears a
run coming. A nearly silent fly-in must not hide a warning the player relies on; this skin is the player's own
bomber, so check that nothing about an enemy bomber changes.

## "Spetsnaz" (Epic), Soviet DP Gunner

Owner, verbatim (2026-11-18):

- A heavy, rounded olive-green armoured helmet with a thick flip-down visor that has a narrow eye slit, based on the attached reference photo for the general look only. Paint a short white stencilled code on the visor (an original one, not copied).
- A bulky, heavy look: a thick armoured vest with plates, padded shoulders, heavy gloves and boots, and pouches packed with spare round pan magazines.
- He carries the DP-28 light machine gun with its flat round pan magazine on top, as normal.
- He walks with a slightly slower, heavier-looking stride (animation only).
- Purely cosmetic: the same speed, health, damage, fire rate and everything else as the normal DP Gunner.

Status: design note only. Don't build it yet. The reference photo did not arrive with the note; ask the owner for it
before drawing.

Note for whoever builds it (not the owner's words): the heavier stride is a change of pose and timing of the
legs only. He must cover the same ground in the same time as the normal DP Gunner, so the feet must not appear
to slide.

## "Heaven's Gate" (Legendary), HQ (every nation)

Owner, verbatim (2026-11-18):

- The HQ becomes a pair of tall, ornate golden gates in an arched frame, with soft beams of warm white-gold light pouring out between the bars.
- It sits on a bank of soft white clouds and hovers slightly above the ground with a gentle up-and-down drift, the clouds slowly swirling around its base.
- Small glowing motes of light float upward from it now and then.
- Non-religious: no crosses, angels, scripture or religious symbols, just the gates, light and clouds.
- Units train and walk out through the gates as normal, and the light flares briefly each time.
- As the HQ takes damage, the light dims and flickers, and the gold gets scorched. When destroyed, the light bursts out and fades.
- It replaces the HQ's look at every Quartermaster upgrade level, so upgrades are shown with extra gold detail and more light instead.
- Purely cosmetic: same size, hitbox, health and everything else as the normal HQ.

Status: design note only. Don't build it yet.

Notes for whoever builds it (not the owner's words):

- The HQ flies the nation's flag and shows the HQ's health and upgrade level today; say where each goes on the
  gates, so a player can still tell whose HQ it is and how it stands.
- It hovers, but units walk on the ground: the clouds must reach the ground at the doorway so nobody steps out
  into the air, and the drift must not move the place shots land.
- The beams of light must not hide units or shots in front of the HQ.
- It needs a look for night and for bad weather that stays readable without lighting up the battlefield.

## "Furnace Walker" (Legendary), enemy skin for the German Flamethrower

Owner, verbatim (2026-11-18):

- The player chooses this as how enemy flamethrowers look. Use the attached image for the general dieselpunk-robot idea only; don't copy its design, colours or emblem.
- The flamethrower becomes a riveted iron robot soldier in soot-blackened steel with dull bronze joints, the same size and shape as a normal soldier.
- Its head is a squat, round iron furnace hatch with a single glowing orange grille for a face.
- A fuel tank built into its back, with two hoses running to a two-barrelled flame cannon held in both hands.
- Small exhaust pipes on its shoulders puff dark smoke, and the grille glows brighter while it fires.
- Clanking footsteps, with a hiss of steam when it stops.
- When the fuel tank is hit from behind, the usual fireball, and it collapses into a smoking heap of parts (no blood).
- No symbols or emblems.
- Purely cosmetic: same size, hitbox, speed, range, damage and everything else as the normal flamethrower.

Status: design note only. Don't build it yet. The reference image did not arrive with the note; ask the owner for
it before drawing. It is for the general idea only: nothing of its design, colours or emblem may be copied.

Notes for whoever builds it (not the owner's words): every death of this skin leaves parts and no blood, whatever
the blood setting. The footsteps and the steam hiss are sounds a normal flamethrower does not make; keep them no
louder than a soldier's so the skin gives no warning the normal look does not.

## "Iron Tommy" (Legendary), British Riflemen

Owner, verbatim (2026-11-18):

- Use the attached image for the general powered-exoskeleton idea only; don't copy its design.
- Each rifleman wears a light powered exoskeleton over his battledress: an open steel frame along the arms, spine and legs, with small pistons at the knees and elbows that move as he walks.
- A compact power pack on his back with a faint cool-white glow and a small exhaust vent.
- He keeps the classic British dish helmet, with a modern clear visor added and a thin glowing strip along the brim.
- Instead of holding a rifle, a compact gun is built into his right forearm. He raises the arm to aim and fires from it.
- Pistons hiss softly when he stops or kneels.
- Purely cosmetic: same size, hitbox, speed, health, damage, fire rate and everything else as the normal Rifleman.

Status: design note only. Don't build it yet. The reference image did not arrive with the note; ask the owner for
it before drawing. It is for the general idea only: nothing of its design may be copied.

Notes for whoever builds it (not the owner's words): this is the first skin that removes the held weapon, so every
rifleman pose (aim standing, kneeling, prone, in a trench, at a window, reloading, carrying) needs an arm-gun
version, and the shot must leave from where the rifle's muzzle would be so tracers and timing do not change. A
fallen rifleman drops no rifle.

## "Hacked" (??? rarity, the God Crate's item), every unit on the player's side

Owner, verbatim (2026-11-18):

- Every allied unit, vehicle, plane and call-in gets a black-and-neon-green hacker look: black bodies with glowing green outlines, flickering green code (generic terminal-style characters and binary, not copied from any film) scrolling across them, and glitchy colour-split edges.
- Infantry levitate a little off the ground in a broken, jittery way: snapping between poses, stuttering, and occasionally glitching a step forward or back.
- Instead of normal idle animations, they tap on floating green holographic hack panels, as if they're cheating. Small popups like "aimbot.exe" or "god_mode = true" flash above them now and then (just text, no real effect).
- Vehicles and planes flicker and leave glitch trails; tanks hover slightly with pixelated tracks.
- Shots leave green glitchy tracers, explosions burst into green pixels, and dead units dissolve into falling green code.
- Every unit must stay recognizable: keep each unit's silhouette, weapon shape and size, so players can tell a rifleman from a machine gunner or a medic at a glance.
- Purely cosmetic: same size, hitboxes, speed, health, damage and everything else as normal.

Status: design note only. Don't build it yet. The God Crate cannot be opened until this is built.

Notes for whoever builds it (not the owner's words):

- The glitch step forward or back and the levitation are drawn offsets only: the unit's true place, where shots
  land and what it can reach never move. A unit must not look as if it stands somewhere it does not.
- Units are black figures already; on night maps a black body with a green outline must still read, and the two
  sides must still be told apart at a glance.
- Flicker and colour-split: slow and soft, within the limit of three flashes a second, and switched off by any
  reduced-motion or reduced-flash setting.
- This is one skin over every unit, vehicle, plane, shot and explosion: it is by far the largest item to draw.
  Do it as a filter and overlay on the normal art where possible, and measure the frame rate with full armies.
- The popups are jokes about cheating. The game has no multiplayer, so nobody is deceived, but keep the wording
  plainly silly and never show them on a result or score screen.

## "Zeus" (Mythic), Mortar Team

Owner, verbatim (2026-11-18):

- The mortar team becomes a Greek-god figure: a white robe, a gold laurel wreath, a long flowing white beard, and a faint golden glow. An original design inspired by classical Greek art, not based on any modern game or film version.
- When standing still, he sits on a grand white marble-and-gold throne. When the unit moves, the throne fades away and reappears when he stops.
- To fire, he raises his arm and points at the target. A bolt of lightning crashes down from above onto the target spot with a flash and a thunder crack, instead of a mortar shell.
- The lightning lands on the mortar's normal target and timing, with the same splash area, so players can still read where it hits.
- Purely cosmetic: same size, hitbox, speed, range (including minimum range), damage, splash and reload as the normal mortar.

Status: design note only. Don't build it yet.

Notes for whoever builds it (not the owner's words):

- A mortar shell takes time to fly, and that flight is what a player watches to see where it will land. The
  bolt must strike at the moment the shell would have landed, not when he points: show the wait (his raised arm,
  a gathering glow in the sky over the target) for as long as the shell would be in the air.
- The mortar team is two men; with this skin it is just him (owner, 2026-11-21: "the morter team for zeus is just
  him"). The second man is not drawn; the unit's size and hitbox stay the team's.
- The thunder crack must not be mistaken for the weather's own thunder on storm maps, and the flash follows the
  three-flashes-a-second limit.
- The throne is as wide as the team's normal footprint or it will cover neighbours.

## "Constellation" (Uncommon), Soviet tanks

Owner, verbatim (2026-11-21):

- Every Soviet tank is painted a deep night-sky blue with small yellow stars scattered across the hull and turret, like a star map.
- Colour and paint only, no shape changes.
- Purely cosmetic, no gameplay change.

Status: design note only. Don't build it yet.

Notes (not the owner's words): a deep blue tank must still stand out on night maps, so give it a lighter edge or
keep the stars bright enough to carry the outline. Say whether the tank's red star marking stays over the paint;
it is how a player tells the side at a glance.

## "Bioblaster" (Epic), Soviet Flamethrower

Owner, verbatim (2026-11-21):

- He carries a black canister on his back with a glass window showing glowing green, acid-like liquid sloshing inside, with a hose running to his blaster.
- The blaster sprays a stream of glowing green liquid instead of fire, shaped and timed exactly like the normal flame, with green splashes and a faint green mist where it lands.
- Enemies it kills just fall like any other death, with no melting, burns or gore.
- When the canister is hit from behind, it bursts in a green splash instead of a fireball, leaving a small green puddle for the usual few seconds.
- Purely cosmetic: same range, damage, timing and everything else as the normal flamethrower.

Owner, 2026-11-21, confirming: "yeah no gore just like a green fire skin". Treat it as the normal flame recoloured
green, with the canister and splashes above: nothing more graphic than the fire it replaces.

Status: design note only. Don't build it yet.

Notes (not the owner's words):

- Keep it plainly science-fiction slime: bright, cartoon green, no gas clouds, no gas masks, no choking or
  coughing poses. A real chemical weapon in a Second World War game would change the content rating answers and
  the tone of the game; glowing slime from a ray-gun does not.
- The green mist is a picture only and hides nothing, unlike smoke.
- The puddle lies on the ground beside the body, as the fire does today, never on it.

## "Reinforced" (Rare), all tanks of every nation

Owner, verbatim (2026-11-22):

- Extra bolted-on steel plates on the hull and turret, side skirt shields over the tracks, and heavier armoured track links.
- A slightly scuffed, battle-worn look on the new plates.
- Purely cosmetic: same size, hitbox, armour, speed and everything else as the normal tank.

Status: design note only. Don't build it yet.

Notes (not the owner's words): this is a picture of armour that gives none, like "Sandbag Armour"; say so in the
item's description so a player does not expect it to help. The plates and skirts stay inside the tank's normal
outline, or shots will seem to pass through them. Each tank model needs its own set of plates, so this is one
item with as many drawings as there are tanks. "All tanks of every nation" is taken to mean the player's own
tanks, whichever nation they command; say if enemy tanks are meant too.

## "Legacy" (Mythic), HQ (every nation)

Owner, verbatim (2026-11-23):

- The HQ becomes a giant stone statue of a stick figure standing tall and pointing toward the enemy, on a carved stone pedestal. An original design of our own (our own pose, proportions and details), not a copy of any other game's statue.
- Weathered grey stone with moss in the cracks, and a faint golden glow in the carved eyes.
- Units train and walk out from a doorway in the pedestal.
- As the HQ takes damage, chunks crack and fall off the statue; when destroyed, it crumbles.
- It replaces the HQ's look at every Quartermaster upgrade level; upgrades add details like a bigger pedestal, banners and torches.
- Purely cosmetic: same size, hitbox, health and everything else as the normal HQ.

Owner, added 2026-11-23, for when it is actually built (verbatim):

- Standing tall and upright in a heroic stance, legs straight, one arm pointing firmly at the enemy, the other hand on a grounded rifle.
- Much bigger and grander: three to four times a soldier's height on the pedestal.
- Real stone shading with light from the upper left, chipped edges, carved texture, subtle cracks and a soft rim light.
- A wide stepped pedestal with a carved plaque (simple original emblem, no text) and an arched doorway.
- Moss and small vines in the cracks, a few birds, a faint golden glow in the eyes.
- Polished, but still in the game's clean flat art style and readable at phone size.

These notes go beyond the reference sketch, which the owner chose not to have redrawn: where they differ (the
sketch has a leaning stance, bent legs, a plain pedestal, no plaque, vines or birds), the notes win.

Status: design note only. Don't build it yet.

Reference sketch (ours, drawn for this note): `docs/cosmetics/legacy-hq-concept.svg`. It shows the statue as the
player's HQ, with a soldier for scale and insets for "damaged" and "upgraded". It is a concept drawing, not game
art. To keep it our own, the figure wears the game's tin hat, stands with a grounded rifle in one hand and points
with the other; it carries no spear, sword or shield.

Notes for whoever builds it (not the owner's words):

- Other stick-figure war games have a statue as the base. Ours must not look like any of them: keep the tin hat,
  the grounded rifle and the pointing arm, and check the finished art side by side with those games before it
  ships.
- The banners carry the nation's flag (never a Nazi symbol; the German flag in the game is the Iron Cross), so a
  player can still tell whose HQ it is. The helmet on the statue follows the nation too.
- The pointing arm reaches past the HQ's normal outline; keep the hitbox the normal HQ's and make sure shots do
  not seem to pass through stone.
- The eye glow dims with damage, as the light does on "Heaven's Gate".
- "Three to four times a soldier's height on the pedestal" is taken as the statue's own height, with the pedestal
  under it. That is taller than the normal HQ; the size and hitbox the game uses stay the normal HQ's, so check
  that the top of the statue is not cut off by the top bar and the objective banner at the three phone sizes.
- The birds are a picture only: they fly off when the HQ is first hit and do not come back during the battle.

## "Secret Agent" (Rare), British SMG troops (Assault Troopers with the Sten)

Owner, verbatim (2026-11-23):

- A dark fedora-style hat instead of the helmet, and a long dark trench-coat-style cloak jacket with the collar turned up.
- The coat's tail sways and flutters slightly in the wind, a bit more when running.
- Optional small touch: a thin scarf or tie in a muted colour.
- Purely cosmetic: same size, hitbox, speed, health, damage and everything else as normal.

Status: design note only. Don't build it yet.

Notes (not the owner's words): the game's figures are black, so a dark hat and a dark coat need a lighter edge or
a paler tone (charcoal grey, a tan lining) to read at phone size and on night maps. The hat's brim must stay
clearly different from the German helmet and the British dish helmet, so the side is still told at a glance.
The coat tail hangs inside the figure's normal outline when he lies prone or stands in a trench.

## The Common set (owner, 2026-11-18)

Owner, verbatim: "All are Common rarity, purely cosmetic, with no gameplay change, readable at phone size and cheap
to draw."

Status of every item in this section: design note only. Don't build it yet.

### British

- "Desert Rat" (Riflemen): a sand-coloured cloth cover on the dish helmet, tied with a cord, plus a loose khaki neck scarf that flaps slightly when they run. Uniforms get a faint sun-bleached tint.
- "Tea Time" (all British infantry): a dented tin mug hangs from the back of the webbing and swings as they move. When idle on Hold, every so often a soldier lifts the mug for a sip.
- "Highlander" (Riflemen): a small green-and-red tartan patch on the side of the helmet, and a matching tartan hackle (a short feather tuft) poking up from the helmet band.
- "Muddy Boots" (all British infantry): mud splatter on boots and trousers up to the knees, a few smears on the jacket, and darker, worn-looking webbing.

### Soviet

- "Ushanka" (Riflemen): a grey fur hat with the ear flaps tied up, replacing the helmet, with a small plain red star on the front.
- "Red Scarf" (all Soviet infantry): a bright red scarf wrapped around the neck, with one end trailing over the shoulder and fluttering when they move.
- "Patched Up" (Conscripts): white bandage wraps on one arm or the head (varying per soldier), plus darker cloth patches sewn onto the sleeves and knees.
- "Painted Star" (T-34): a large red star painted on both sides of the turret with a thin white outline, plus a short hand-painted slogan stripe (simple, no real text needed) along the hull.

### Enemy German (the player picks how enemies look)

- "Dust Coat": faded, dusty field-grey uniforms with lighter patches at the shoulders and knees, and dust puffs from their boots when they walk.
- "Splinter": helmet covers and smocks in a sharp, angular splinter camo pattern of greens and browns. No symbols.

### Vehicles and call-ins (every nation)

- "Kill Marks" (all tanks): a row of small white painted rings on the gun barrel near the turret, adding one ring each time that tank destroys an enemy vehicle in the battle.
- "Sandbag Armour" (all tanks): sandbags stacked along the front and sides of the hull, plus spare track links hung on the turret. Bags slip off one by one as the tank takes damage.
- "Nose Art" (fighter plane): an original cartoon shark mouth with teeth and an eye painted on the nose, plus a little pin-up-free cartoon mascot badge (an original design) on the side.
- "Red Smoke" (smoke screen call-in): red smoke instead of grey, with the same size, timing and effect.

### Every Allied nation (owner, 2026-11-21)

Owner, verbatim:

**"Frostbite" (Common), Riflemen of every Allied nation**

- A separate item for each nation's riflemen (British, Soviet and future Allied nations), each unlocked on its own.
- Colour change only, no shape or gear changes: uniforms and helmets turn white with a green camouflage pattern.
- Purely cosmetic, no gameplay change.

Status: design note only. Don't build it yet.

Note (not the owner's words): this is the simplest kind of skin, a recolour of the normal art, and a good first
one to prove the system with. Each nation's version counts as its own item in a set, for the no-duplicates rule.

Notes for whoever builds these (not the owner's words):

- Several of these move or change during a battle (the scarf, the mug and the sip, dust puffs, kill rings, sandbags
  slipping off). They read the battle; they never write to it. "Sandbag Armour" is a picture of armour and gives
  none.
- "Tea Time": the sip plays only while a soldier is idle and must never delay him aiming or firing.
- "Red Smoke" must hide exactly what grey smoke hides, to the eye as well as in the rules: same density and edge.
- "Dust Coat" and "Splinter" are enemy skins for every German soldier type unless the owner says otherwise.
- "Kill Marks": say how many rings fit on a barrel before they stop being added.
