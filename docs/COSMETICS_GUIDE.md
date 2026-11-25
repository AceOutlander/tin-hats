# Adding a cosmetic item

How to add an item to the game without a programmer: your art (if it needs any) in one folder, and one entry in one
data file. This guide also says plainly what that can and cannot do.

Cosmetics are hidden from players until the switch at the top of `src/data/cosmetics.ts` (`enabled`) is turned on. It
is off. Everything below can be done and looked at with it off.

## What an item can be

The game's soldiers, vehicles and HQ are drawn in code and move as separate parts. An item changes how those parts
are drawn. It can do any mix of these, all given in its data entry:

| What | Example | Needs a file? |
| --- | --- | --- |
| **Repaint** parts in a colour, with an optional pattern of blotches, spots or stripes | white uniforms with green camouflage; a night-blue tank with yellow stars | no |
| **Swap** in headgear, clothing or a weapon the game already draws | a fur hat instead of the helmet | no |
| **Hide** a part | no helmet, no pack | no |
| **Add your own picture**, pinned to a part so that it moves and turns with it | a hat, a scarf, a badge, plates on a hull, a sign on the HQ | yes |
| **Swing** a picture gently about its pin (wider while the unit moves) | a mug on a strap, a plume, a chain | the picture |
| **Glow**: a soft light at a pin, steady or slowly swelling | glowing eyes, a lit power pack | no |

The parts that can be repainted or hidden:

- a soldier: `body` (head, torso, arms, legs, boots), `helmet`, `kit` (pack, pouches, straps), `weapon`;
- a vehicle: `hull`, `turret`, `gun`, `tracks` (tracks and wheels);
- the HQ: `hq` (the building while it stands).

The places a picture or a glow can be pinned:

- a soldier: `head` (the centre of the head), `body` (the middle of the torso), `weapon` (the hand that grips it);
- a vehicle: `hull`, `turret`;
- the HQ: `hq` (the ground under the building).

An item is for the player's own side (`side: 'own'`) or is how the enemy looks to the player (`side: 'enemy'`), for
some nations or all, and for some unit types, a group (`'infantry'`, `'tanks'`, `'all'`) or the HQ.

## What needs a programmer

Be clear-eyed about this before designing an item. None of the following can be done by dropping in a file:

- **A new shape for something the game already draws**: a different weapon outline, a bulkier body, a mech in place
  of a tank, a statue in place of the HQ building's own states. A picture can cover a part or stand in for it, but it
  is one still picture: it does not bend, aim, recoil or break up, and the muzzle flash stays where the game's own
  weapon ends.
- **Any new animation**: sitting on a throne, sipping tea, hovering, a heavier stride, a coat tail in the wind
  (beyond the simple swing above), pistons that move, a death of its own.
- **Anything that changes with the battle**: goggles down at night, sandbags that fall off with damage, kill rings
  that add up, a glow that dims as health drops, a charge-up before a shot.
- **Shots, explosions, smoke and sounds**: a laser, green flame, red smoke, lightning instead of a shell, a new
  weapon sound.
- **Planes and call-ins**, **the flags**, **dead vehicles and the ruined HQ** (they stay the game's own), and things
  that differ from one soldier to the next.
- **Nameplates, victory animations and Shop or menu themes**: the game has no place for these yet.

Most of the designs in `docs/COSMETICS.md` need some of this. The simple ones ("Frostbite", "Constellation", a cap
or a scarf) do not.

Other limits worth knowing:

- One item per unit type at a time. Wearing an item puts it on every unit it is for; wearing a second one takes
  over the units both are for.
- An item is for unit types (rifleman, tank, heavy tank), not for one vehicle model. "Soviet tanks" dresses whatever
  the Soviet tank of that mission's date is.
- At most three pictures and glows per item.
- Nothing an item does can change a battle. The battle's rules never see what is worn; a test holds that.

## Your art

Only needed for pictures.

- **Where:** `src/cosmetics/art/`
- **Name:** small letters, digits and dashes, for example `royal-helmet.svg`.
- **Format:** SVG. It is text, it stays sharp at any size, and it keeps the repo free of binary files. A PNG with a
  transparent background also works, but the repo's rule is "no binaries beyond the app icons", so use SVG unless you
  decide to relax that rule.
- **An SVG must:** state `width`, `height` and `viewBox` on its first line (some browsers will not draw it
  otherwise); have a transparent background; use shapes only: no lettering in a font (fonts are not carried along;
  convert text to outlines), no linked images, no scripts.
- **A PNG must:** have a transparent background and be about 8 pixels for each game unit of its size (below).
- **Which way:** draw it seen from the side, **facing right**. The game mirrors it for units facing left. A weapon
  picture is drawn lying flat, muzzle to the right.
- **How big:** you give the size in *game units* in the data entry, not in the file. A soldier is 58 units tall and
  his head 10 across; a helmet is about 16 wide and 11 tall; a tank is about 120 to 260 long. On a phone one unit is about
  two screen pixels, so a hat is some 30 pixels wide: bold shapes and strong contrast, no fine detail. The game's
  figures are black, so give dark things a lighter edge.

## The one data entry

Open `src/data/cosmetics.ts` and add an entry to the list of items. This one is a cap for British and Soviet
riflemen, drawn by you, in place of the helmet, with a khaki repaint of the body:

```ts
{
  id: 'desert-cap',                      // small letters, digits, dashes; never change it once players can own it
  name: 'Desert Cap',
  rarity: 'common',                      // common, uncommon, rare, epic, legendary, mythic, secret (the "???"), special
  blurb: 'A sand-coloured cap and sun-bleached battledress.',
  target: { side: 'own', nations: ['british', 'soviet'], units: ['rifle'] },
  look: {
    recolours: [{ parts: ['body'], colour: '#b9ad7c', strength: 0.5 }],
    images: [{ file: 'desert-cap.svg', pin: 'head', w: 16, h: 11, ax: 0.5, ay: 0.82, replaces: true }],
  },
},
```

What the fields mean:

| Field | Meaning |
| --- | --- |
| `target.side` | `'own'` (your units) or `'enemy'` (how the enemy looks to you) |
| `target.nations` | a list from `'british'`, `'soviet'`, `'german'`, or `'all'` |
| `target.units` | a list of unit types (`'rifle'`, `'lmg'`, `'assault'`, `'mortar'`, `'sniper'`, `'medic'`, `'at'`, `'flame'`, `'commander'`, `'aa'`, `'sapper'`, `'conscript'`, `'tank'`, `'heavyTank'`, `'lightTank'`, `'apc'`), or `'infantry'`, `'tanks'`, `'all'`, or `'hq'` |
| `recolours` | each: `parts` (leave out for every part), `colour` (`'#rrggbb'`), `strength` (1 = flat colour, 0.5 = half, so the part's own shading shows), and an optional `pattern: { kind: 'blotches' \| 'spots' \| 'stripes', colour, size, cover }` (`size` in game units, `cover` the share covered, 0 to 1) |
| `headgear`, `clothing`, `weapon` | one the game already draws, by its name in the game's data; it only takes effect for a nation that has that art |
| `hide` | parts not drawn, for example `['helmet']` |
| `images` | each: `file`, `pin`, `w` and `h` in game units, `ax` and `ay` (the point of the picture that sits on the pin, as fractions: `0.5, 1` is the bottom centre), optional `x` and `y` (a nudge in game units: x toward the way the unit faces, y down), `replaces: true` (the game's own part at that pin is not drawn: the helmet for `head`, the weapon for `weapon`, the hull or turret, the HQ building), and `swing: { degrees, perSecond }` |
| `glows` | each: `pin`, `colour`, `size` (across, in game units), `alpha` (0 to 1), `pulse` (swells a second; 0 = steady; keep it under 1), optional `x`, `y` |

The 13 placeholder entries already in the file show every one of these in use. Copy the nearest.

An item of rarity `special` never comes out of a crate (it is given some other way). Any other item goes into the
crates only once it has `finished: true` in its entry: set that after you have looked at it in a battle at phone size
(both 844x390 and 667x375). Until then it can be given and worn for a look (the admin panel's "Give every item") but
no crate, free crate or platform grant hands it to a player. A crate none of whose rarities has a finished item is not
shown in the Shop.

## Checking it

1. Run the checks: `.\x.cmd npm run check`. They fail, with the item's id, on a badly formed id, a colour that is not
   `#rrggbb`, a picture file that is missing or has no `width` and `height`, a file in the folder that no item uses,
   and more than three pictures and glows.
2. Look at it in the game:
   - start the game on this computer: `.\x.cmd npm run dev`, then open the address it prints in a browser window
     made phone-shaped and landscape;
   - open the admin panel (seven quick taps on the title's helmet, then the code);
   - **Crates** tab: press **Show crates and Appearance**, then **Give every item**;
   - close the panel, go to the map, open the **Shop**, then **Appearance**: the item is there with its portrait.
     Press **Wear**;
   - start any mission and look at the unit. A picture sits where its `pin`, `ax`, `ay`, `x` and `y` put it: change
     the numbers, save the file, and the page reloads.
3. The same **Crates** tab grants crates to open and runs the odds test.

## Before players see any of it

- Placeholders are never finished, so no player can get one from a crate or a grant (DECISIONS 589); they stay in
  the data for the tests and the admin panel. To take them out for good, remove the entries and the three
  `placeholder-` pictures. A test fails if the website's switch is on while a placeholder is still in the list, and
  several tests name the placeholders: a small programmer's job, done once.
- Then set `enabled: true` in `src/data/cosmetics.ts`. That one line shows the crate section, the Appearance tab and
  free crates to everyone.
