/**
 * Card catalog for the standalone Culpo-like engine.
 * `power` and `mult` are the two printed diamond values; a side scores
 * (sum of its Power) * (sum of its Mult) across every card it owns on board.
 */
export const CARDS = {
  scout: {
    id: 'scout', name: 'Scout', artId: 'scout', faction: 'blue',
    power: 1, mult: 1,
    text: 'On play, gain +1 Mult for each adjacent ally piece.',
    effect: 'scout',
  },
  wanderer: {
    id: 'wanderer', name: 'Wanderer', artId: 'wanderer', faction: 'blue',
    power: 1, mult: 1,
    text: 'On play, if adjacent to an enemy piece, gain +1 Power.',
    effect: 'wanderer',
  },
  broken_sigil: {
    id: 'broken_sigil', name: 'Broken Sigil', artId: 'broken-sigil', faction: 'blue',
    power: 1, mult: 0,
    text: 'On play, the enemy piece with the highest Mult loses 1 Power and 1 Mult.',
    effect: 'brokenSigil',
  },
  blockade: {
    id: 'blockade', name: 'Blockade', artId: 'blockade', faction: 'blue',
    power: 2, mult: 0,
    text: 'On play, gain +1 Power for each adjacent ally piece.',
    effect: 'blockade',
  },
  stray_blade: {
    id: 'stray_blade', name: 'Stray Blade', artId: 'stray-blade', faction: 'blue',
    power: 2, mult: 1,
    text: 'On play, gain +1 Power when adjacent to an enemy piece.',
    effect: 'strayBlade',
  },
  crimson_bomb: {
    id: 'crimson_bomb', name: 'Crimson Bomb', artId: 'crimson-bomb', faction: 'red',
    power: 0, mult: 0,
    text: 'On play, destroy all adjacent pieces, including this card.',
    effect: 'crimsonBomb',
  },
  crimson_serpent: {
    id: 'crimson_serpent', name: 'Crimson Serpent', artId: 'crimson-serpent', faction: 'red',
    power: 2, mult: 1,
    text: 'On play, set the Power of the adjacent enemy piece with the highest Power to 0.',
    effect: 'crimsonSerpent',
  },
  poison_rose: {
    id: 'poison_rose', name: 'Poison Rose', artId: 'poison-rose', faction: 'pink',
    power: 2, mult: 1,
    text: 'On play, swap with the enemy piece with the highest Mult and steal 1 Mult.',
    effect: 'poisonRose',
  },
  enraged_minotaur: {
    id: 'enraged_minotaur', name: 'Enraged Minotaur', artId: 'enraged-minotaur', faction: 'red',
    power: 3, mult: 3,
    text: 'On play, gain +2 Power for each ally piece in this row.',
    effect: 'enragedMinotaur',
  },
  magma_fist: {
    id: 'magma_fist', name: 'Magma Fist', artId: 'magma-fist', faction: 'red',
    power: 1, mult: 1,
    text: 'Choose an enemy piece. At the end of its next turn, destroy it. If it leaves early, choose one of your pieces to gain +2 Power.',
    effect: 'magmaFist',
  },
  gold_gargoyle: {
    id: 'gold_gargoyle', name: 'Gold Gargoyle', artId: 'gold-gargoyle', faction: 'gold',
    power: 2, mult: 1,
    text: 'Immune to enemy card effects.',
    effect: 'goldGargoyle', immune: true,
  },
  cursed_coin: {
    id: 'cursed_coin', name: 'Cursed Coin', artId: 'cursed-coin', faction: 'gold',
    power: 1, mult: 1,
    text: 'On play, gain 2 gold.',
    effect: 'cursedCoin',
  },
  dark_merchant: {
    id: 'dark_merchant', name: 'Dark Merchant', artId: 'dark-merchant', faction: 'gold',
    power: 1, mult: 2,
    text: 'On play, gain 1 gold for each adjacent ally piece.',
    effect: 'darkMerchant',
  },
  golden_contract: {
    id: 'golden_contract', name: 'Golden Contract', artId: 'golden-contract', faction: 'gold',
    power: 1, mult: 2,
    text: 'On enter, gain Power equal to the total Power of other ally pieces in this row.',
    effect: 'goldenContract',
  },
  emperor: {
    id: 'emperor', name: 'Emperor', artId: 'emperor', faction: 'gold',
    power: 4, mult: 3,
    text: 'On play, gain +1 Power for each other allied Emperor.',
    effect: 'emperor',
  },
};

export const STARTER_DECK = [
  'scout', 'scout', 'wanderer', 'wanderer', 'broken_sigil', 'blockade',
  'stray_blade', 'crimson_bomb', 'crimson_serpent', 'poison_rose',
  'cursed_coin', 'gold_gargoyle', 'enraged_minotaur', 'magma_fist', 'scout',
  'wanderer', 'broken_sigil', 'crimson_serpent', 'blockade', 'gold_gargoyle',
];

export const SIN_STARTER_DECKS = {
  the_sinner: [
    'scout', 'scout', 'wanderer', 'wanderer', 'broken_sigil', 'blockade',
    'stray_blade', 'crimson_bomb', 'crimson_serpent', 'poison_rose',
    'cursed_coin', 'gold_gargoyle', 'enraged_minotaur', 'magma_fist', 'scout',
    'wanderer', 'broken_sigil', 'crimson_serpent', 'blockade', 'gold_gargoyle',
  ],
  lust: [
    'scout', 'scout', 'wanderer', 'poison_rose', 'poison_rose', 'crimson_serpent',
    'crimson_serpent', 'stray_blade', 'broken_sigil', 'blockade', 'gold_gargoyle', 'magma_fist',
    'scout', 'scout', 'wanderer', 'poison_rose', 'crimson_serpent', 'stray_blade',
  ],
  wrath: [
    'crimson_bomb', 'crimson_bomb', 'crimson_serpent', 'crimson_serpent', 'enraged_minotaur',
    'enraged_minotaur', 'magma_fist', 'magma_fist', 'stray_blade', 'wanderer', 'blockade', 'scout',
    'crimson_bomb', 'crimson_serpent', 'enraged_minotaur', 'magma_fist', 'stray_blade', 'wanderer',
  ],
  sloth: [
    'blockade', 'blockade', 'broken_sigil', 'broken_sigil', 'scout', 'scout', 'wanderer',
    'wanderer', 'stray_blade', 'gold_gargoyle', 'poison_rose', 'crimson_serpent',
    'blockade', 'broken_sigil', 'scout', 'wanderer', 'stray_blade', 'gold_gargoyle',
  ],
  greed: [
    'cursed_coin', 'cursed_coin', 'dark_merchant', 'dark_merchant', 'gold_gargoyle', 'gold_gargoyle',
    'golden_contract', 'golden_contract', 'emperor', 'emperor', 'wanderer', 'scout',
    'cursed_coin', 'dark_merchant', 'gold_gargoyle', 'golden_contract', 'emperor', 'wanderer',
  ],
  pride: [
    'emperor', 'emperor', 'gold_gargoyle', 'gold_gargoyle', 'golden_contract', 'scout',
    'scout', 'blockade', 'blockade', 'wanderer', 'stray_blade', 'broken_sigil',
    'emperor', 'gold_gargoyle', 'golden_contract', 'scout', 'blockade', 'stray_blade',
  ],
  envy: [
    'broken_sigil', 'broken_sigil', 'poison_rose', 'poison_rose', 'crimson_serpent', 'crimson_serpent',
    'stray_blade', 'stray_blade', 'wanderer', 'scout', 'magma_fist', 'gold_gargoyle',
    'broken_sigil', 'poison_rose', 'crimson_serpent', 'stray_blade', 'magma_fist', 'wanderer',
  ],
  gluttony: [
    'crimson_bomb', 'crimson_bomb', 'magma_fist', 'magma_fist', 'enraged_minotaur', 'enraged_minotaur',
    'crimson_serpent', 'wanderer', 'scout', 'blockade', 'cursed_coin', 'gold_gargoyle',
    'crimson_bomb', 'magma_fist', 'enraged_minotaur', 'crimson_serpent', 'blockade', 'wanderer',
  ],
};

export const SIN_OPTIONS = [
  { id: 'lust', name: 'Lust', artId: 'lust', color: '#d72c83', passive: 'A deck built around Scouts, Poison Roses, and Serpents.' },
  { id: 'wrath', name: 'Wrath', artId: 'wrath', color: '#e15325', passive: 'A deck built around Bombs, Serpents, and Minotaurs.' },
  { id: 'the_sinner', name: 'The Sinner', artId: 'the-sinner', color: '#8a9b6c', passive: 'A balanced deck with cards from every faction.' },
  { id: 'sloth', name: 'Sloth', artId: 'sloth', color: '#4694c9', passive: 'A deck built around Blockades and weakening Sigils.' },
  { id: 'greed', name: 'Greed', artId: 'greed', color: '#d5a331', passive: 'A deck built around coins, contracts, and gold cards.' },
  { id: 'pride', name: 'Pride', artId: 'pride', color: '#ba62b5', passive: 'A deck built around Emperors and other high-value cards.' },
  { id: 'envy', name: 'Envy', artId: 'envy', color: '#5d9f54', passive: 'A deck built around stealing and weakening enemy stats.' },
  { id: 'gluttony', name: 'Gluttony', artId: 'gluttony', color: '#a45d43', passive: 'A deck built around destruction and heavy pieces.' },
];

export function getCardDefinition(cardId) {
  return CARDS[cardId] ?? null;
}
