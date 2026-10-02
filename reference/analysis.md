# Praktikos reference analysis

Research and asset pass: 2026-10-02.

## Identity and sources

The trailer is for **Praktikos**, Steam app 4475910. The current Steam store page names BitHammer Studios as developer and publisher. SteamDB lists the developer's social profile as [@mrculpo on X](https://x.com/mrculpo). The profile itself did not load in the public web reader, so the Steam page and screenshots are the primary references used here.

- [Official Steam page](https://store.steampowered.com/app/4475910/)
- [Steam gallery screenshot 11, branching map](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4475910/f6585766d837a08f1512998745b3d0e2173a01e0/ss_f6585766d837a08f1512998745b3d0e2173a01e0.1920x1080.jpg?t=1790909455)
- [Steam gallery screenshot 07, Magma Fist and combat](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4475910/6e3a35e8f742ee66377ee61f1d13ed79686efe12/ss_6e3a35e8f742ee66377ee61f1d13ed79686efe12.1920x1080.jpg?t=1790909455)
- [Steam gallery screenshot 08, card library](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4475910/480e141b54e44c24249293621052f45dfa222aef/ss_480e141b54e44c24249293621052f45dfa222aef.1920x1080.jpg?t=1790909455)
- [SteamDB app record and X relation](https://steamdb.info/app/4475910/)
- [Public Steam app-details endpoint](https://store.steampowered.com/api/appdetails?appids=4475910) supplied the 14 official 1920×1080 gallery image URLs. No paid API or generation service was used.

## Game loop and rules

The official description calls Praktikos a tactical roguelite card game. A run follows a branching map through battles, events, shops, forges, and elite fights. Players collect relics and improve cards, then face the other Sins and the final throne challenge.

Combat begins on a 3×3 board, with 4×4 and 5×5 formats opening later. Players place cards to complete a full row, column, or diagonal. Completing a formation ends combat and scores points; filling the board also ends combat. The higher score wins. Card placement matters because cards have Power, Multiplier, and effects that change allies, enemies, or positions.

Each Sin has an Arsenal of up to nine cards and five unlockable special abilities. A run equips up to two abilities. The official page describes the character identities this way: Gluttony devours and absorbs; Wrath destroys and punishes; Lust manipulates positions; Greed accumulates advantages; Envy steals; Pride controls the center; Sloth weakens and delays; The Sinner starts simply and can surprise.

## Readable card names and effects

These names and effects are legible in the supplied trailer or Steam screenshots. Wording below follows the visible text; the card art crops are stored separately from their outer card frames.

| Card | Visible effect | Source |
|---|---|---|
| Crimson Bomb | On play, destroy all adjacent pieces, including itself. | Trailer, 16s |
| Crimson Serpent | On play, set the Power of the adjacent enemy piece with the highest Power to 0. | Trailer, 23s |
| Golden Contract | On enter, gain Power equal to the total Power of other allied pieces in the same row. | Trailer, 25s |
| Enraged Minotaur | On play, gain +2 Power for each ally in this row. | Trailer, 20s |
| Poison Rose | On play, swap with the enemy piece with the highest Multiplier and steal +1 Multiplier. | Trailer, 43s |
| Broken Sigil | On play, the enemy piece with the highest Multiplier loses 1 Power and 1 Multiplier. | Steam screenshot 08 |
| Magma Fist | Choose an enemy piece. At the end of its next turn, destroy it. If it leaves early, choose one of your pieces to gain +2 Power. | Steam screenshot 07 |

Steam screenshot 08 also gives clean names and art for Blockade, Drifter, Flicker, Last Light, Outpost, Scout, Stray Blade, and Wanderer. `gold-gargoyle` and `dark-merchant` are provisional visual matches only; their title text was not readable in the source crop.

## Extracted asset set

`public/assets/manifest.json` is the stable asset catalog. It has 54 entries covering 53 image files plus one Sinner HUD alias. Each entry has `id`, `kind`, public asset `path`, source ID, source filename or URL, source rectangle, and a confidence note where needed. Rectangles are `[x, y, width, height]` in the original 1280×720 trailer frame or 1920×1080 Steam screenshot. The public manifest contains no machine-local paths.

- 19 card-art files cover the 15 catalog art IDs plus four extra named cards visible in Steam screenshot 08.
- Eight Sin portrait files cover the select-screen roster. Lust, Wrath, The Sinner, and Sloth have labeled source art. Greed, Envy, and Gluttony use unlabeled adjacent carousel art; Pride uses an unlabeled HUD face crop. Those four assignments are explicitly marked inferred or unverified.
- Eight small HUD face crops come from gameplay screenshots. Six have likely Sin matches; two are deliberately left as unlabeled candidates.
- `backgrounds/cavern-purple.png`, `cavern-red.png`, and `cavern-green.png` are clean side-wall strips suitable for mirror/tile use. `backgrounds/map-route.png` is the Steam map crop with the legend removed.
- `board-tiles/` contains the seven exact board art crops requested for demo placement. `ui/board-slot-empty.png` and the top/left board-frame strips preserve the in-game board texture. `ui/forge-anvil-scene.png` is the clean anvil scene from the trailer. `ui/logo-praktikos.png` is the trailer end-card wordmark with only edge-connected black removed. `preview-card-red.png` and `preview-card-golden.png` are full fixed-card references for frame/layout inspection, not reusable card art.

All raster assets are direct crops from the supplied video or official Steam screenshots. No image was generated. A visual contact sheet was reviewed after extraction to catch and repair the wrong Magma Fist and map crops, and to tighten card and portrait edges. The seven board-tile crops use the 25s trailer frame, before the floating Golden Contract obscures the Raven tile at 26s. The reviewed contact sheet is `reference/assets-contact.jpg`.
