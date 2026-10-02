# Praktikos challenge

A browser recreation of BitHammer Studios' **Praktikos**, made from the supplied gameplay trailer and the official Steam gallery.

[Play](https://praktikos-challenge.adamholter.chatgpt.site) · [Play the golden board](https://praktikos-challenge.adamholter.chatgpt.site/?scene=golden) · [Gameplay video](https://praktikos-challenge.adamholter.chatgpt.site/demo.mp4) · [Original game](https://store.steampowered.com/app/4475910/Praktikos/)

Choose a sin, place cards, build formations, and grow your score through card effects. The campaign has 3×3, 4×4, and 5×5 duels, eight starting decks, a branching route, a forge, a trader, and a final battle. Music and effects are synthesized locally. No AI APIs or paid generation services are used at build time or runtime.

## Play

Click a card, then an empty space. Magma Fist prompts for an enemy target and a supporting ally. Hover or select cards to read their effects. Total multiplier × total power determines the score. A completed row, column, or diagonal ends the duel and adds a formation bonus; the higher total wins.

Arrow keys change the selected sin. Enter begins a run. Keys 1–4 select hand cards, M toggles sound, and Escape cancels a selection or closes a panel. Mouse and touch are supported. Landscape works best on phones.

## Run locally

```sh
npm install
npm run dev -- --port 5183
```

```sh
npm run validate
```

## Reference fidelity

Card art, character portraits, cavern textures, the logo, and the forge art are cropped from the supplied trailer and official Steam screenshots. `public/assets/manifest.json` records their sources and crop rectangles. Artwork, characters, and the Praktikos name belong to BitHammer Studios. This repository does not relicense those assets or imply an official release.

This is a reconstruction of visible gameplay, not the original game's source. The campaign balance, some card effects, and the 25-point formation bonus are inferred implementations. The reference confirms that formations end combat and grant points, but does not expose the precise bonus formula. `reference/mechanics.md` separates observed rules from inferred ones.

The golden board is a playable, staged late-game position matching the reference score of 76,868 against 96. The demonstration video combines a fresh duel and late-game setup with actual browser interactions.

## Implementation

`src/engine.js` contains the deterministic rules and campaign. `src/cards.js` contains card definitions and decks. `src/game.js` renders a composable pixel-art board, animates card effects, and exposes semantic controls for keyboard and browser testing. `src/audio.js` synthesizes event sounds with Web Audio. `reference/audio-composer.py` produces the original looping score.

Automated tests cover scoring, formations, card effects, enemy decisions, deck changes, board growth, restart, and terminal states. Browser checks cover card selection and placement, enemy turns, result continuation, forge upgrades, trading, audio activation, and desktop/phone layouts.
