# The site account line in `index.html`

`index.html` carries one inline script just under `<title>` (it starts `/* HunterAceDev site account`). On
hunteracedev.com it loads `/account/hace.js` from the site's own repository (`aceoutlander.github.io`); anywhere else
(local previews, tests, the Android app) it does nothing at all.

That site script is switched off until the owner sets its `CONFIG` line. When it is on it does three things for Tin
Hats, without any change to the game's own code:

- a signed-out player is asked "Sign in to save your progress" (Sign in or Skip) before the game starts, once a visit;
- a guest's progress and each account's progress are kept apart in the browser (a new account starts fresh);
- the game's saves (`tinhats.save`, `tinhats.tips`) are copied to the player's account and back, so progress follows
  them to any computer. The newest play wins.

It has nothing to do with Google Play: purchases, medals packs and the Android app's own saves are untouched, and the
script never runs inside the app. Keep the line when editing `index.html`.
