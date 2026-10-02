# Reference mechanics notes

Reviewed `reference/contact.jpg` and extracted stills from the supplied 53-second clip at two-second intervals, then inspected the 6s, 8s, 10s, 12s, 18s, and 20s frames at full resolution.

## Visible rules

- The game opens on a Sin selection screen. Lust, Wrath, and Sloth are visible in the clip; the run asks the player to choose one before the first duel.
- The duel uses one shared square grid. The tutorial board is 3x3. Later boards shown in the clip are larger, including 4x4 and 5x5 layouts.
- Each card displays two diamond stats, Mult and Power. The large side score is their product after adding each side's cards together. The later reference HUD reads 22 Mult and 3494 Power for 76868 points, and 8 Mult and 12 Power for 96 points.
- Turns alternate between player and opponent placements. Card play effects can change stats or destroy pieces. The tooltip text below is legible in the sampled frames.
- A completed line, column, or diagonal ends combat but does not automatically win. It gives that side more points; compare the final scores to determine the winner. A filled board also ends combat and uses the score comparison.
- A campaign map offers paths toward the throne. The clip shows a forge encounter, card upgrades, a trade encounter, and several further battles before the throne.

## Card text legible in the clip

- **Scout Lv. 1:** Mult 1, Power 1. “On play, gain +1 Mult for each adjacent ally piece.”
- **Wanderer Lv. 1:** “On play, if adjacent to an enemy piece, gain +1 Power.”
- **Broken Sigil Lv. 1:** Mult 0, Power 1. “On play, the enemy piece with the highest Mult loses -1 Power and -1 Mult.”
- **Crimson Bomb Lv. 1:** “On play, destroy all adjacent pieces, including itself.”
- **Crimson Serpent Lv. 1:** Power 1, Mult 2. “On play, set the Power of the adjacent enemy piece with the highest Power to 0.”
- **Golden Contract Lv. 1:** “On enter, gain Power equal to the total Power of other allied pieces in the same row.”
- **Poison Rose Lv. 1:** swaps with the enemy piece with the highest Mult and steals 1 Mult.
- **Magma Fist:** “Choose an enemy piece. At the end of its next turn, destroy it. If it leaves early, choose one of your pieces to gain +2 Power.”
- **Enraged Minotaur Lv. 2:** Mult 3, Power 3. “On play, gain +2 Power for each ally piece in this row.”
- **Emperor, Gold Gargoyle, and Blockade** are visible in card art or names. Their complete tooltip copy is not clear enough in these frames to claim exact wording.

## Engine decisions

`src/engine.js` implements product scoring, orthogonal adjacency effects, line formations, alternate placements, a deterministic enemy, campaign route choices, forge/trade actions, and run restart. The sampled frames show Mult, Power, and the resulting score. They do not show a separate mana meter or card cost, so the engine lets the player use any card in hand on any open board space.

The official Steam page confirms that formations end combat and add points rather than guarantee a win. It does not give an exact bonus amount, so this prototype adds 25 points to the side that forms first. Source: [Praktikos on Steam](https://store.steampowered.com/app/4475910/Praktikos/), “About This Game” and “Scoring through formations.”

Each Sin has its own themed starting deck. The clip clearly identifies Lust, Wrath, The Sinner, Sloth, Gluttony, and Greed. Envy and Pride are supported by the official color-coded cards but their names are not printed in the supplied selection frames.

The card catalog contains art IDs in kebab case for asset matching. Effects whose supplied tooltip was not legible use concise prototype rules in `src/cards.js`; the verified entries above match the sampled reference text.
