# Cosmetics: design notes (from the owner)

Design notes for the cosmetic items that the supply crates will hold. Nothing here is built yet. The crate system
itself is queued in `docs/QUEUE.md` ("cosmetic supply crates"); the owner designs every item.

## Rules for every cosmetic

- Cosmetics are visual only and never affect stats.
- Skins don't have to be historically accurate; they're separate from the history and lore. (Owner, 2026-11-18.)
- No swastikas, SS runes or any other Nazi party symbols, as everywhere in the game.
- Rarity tiers, lowest first: Common, Uncommon, Rare, Epic, Legendary. "Uncommon" was added by the owner on
  2026-11-18, between Common and Rare; the crate spec in `docs/QUEUE.md` was written before it.
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

Status: design note only. Don't build it yet. The reference photo did not arrive with the note; ask the owner for it
before drawing.

## "Evolved" (Epic), Soviet Riflemen

Owner, verbatim (2026-11-18):

- A modern-day soldier look, based on the attached reference photo for the general look only: red berets, a modern green-and-tan digital/multi-tone camo uniform, a plate-carrier vest with pouches, tactical gloves and black combat boots.
- The rifle is drawn as a modern AK-12-style assault rifle.
- No real unit patches, badges or insignia copied; use simple generic shapes.
- Purely cosmetic: same fire rate, damage, range and everything else as the normal Rifleman. Single shots, not rapid fire, with only the rifle's look and sound changed.

Status: design note only. Don't build it yet. The reference photo did not arrive with the note; ask the owner for it
before drawing.

## "Night Wing" (Legendary), Allied bomber (every Allied nation)

Owner, verbatim (2026-11-18):

- The bomber call-in becomes a modern stealth flying-wing bomber, based on the attached reference photo for the general shape only: a dark grey tailless wing with a jagged, saw-tooth back edge, a smooth central hump for the cockpit and flush engine intakes on top.
- Drawn slightly tilted toward the camera so the wing shape reads in the side view, not as a flat sliver.
- Nearly silent fly-in with a low hum, and a faint heat shimmer behind it.
- No real squadron markings or tail numbers copied.
- Purely cosmetic: the same bombing run, area, damage, timing and cooldown as the normal bomber.

Status: design note only. Don't build it yet. The reference photo did not arrive with the note; ask the owner for it
before drawing.

Note for whoever builds it (not the owner's words): the normal bomber's engine sound is how the player hears a
run coming. A nearly silent fly-in must not hide a warning the player relies on; this skin is the player's own
bomber, so check that nothing about an enemy bomber changes.
