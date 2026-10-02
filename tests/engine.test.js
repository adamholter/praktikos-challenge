import assert from 'node:assert/strict';
import test from 'node:test';
import GameEngine, { CARDS, SIN_OPTIONS, SIN_STARTER_DECKS, resultForScores } from '../src/engine.js';

function start(seed = 12, sin = 'the_sinner') {
  const game = new GameEngine({ seed });
  const result = game.selectSin(sin);
  assert.equal(result.ok, true);
  return game;
}

let nextPiece = 0;
function piece(id, owner, power = 1, mult = 1) {
  return {
    uid: `${owner}-${id}-${nextPiece++}`,
    id,
    name: id,
    owner,
    power,
    mult,
    level: 1,
    effect: 'goldGargoyle',
    immune: false,
  };
}

test('sin selection starts a deterministic 3x3 battle with a playable hand', () => {
  const first = start(123, 'greed');
  const second = start(123, 'greed');
  assert.equal(first.state.phase, 'battle');
  assert.equal(first.state.player.sin.id, 'greed');
  assert.equal(first.state.battle.rows, 3);
  assert.equal(first.state.battle.cols, 3);
  assert.equal(first.state.battle.hand.length, 3);
  assert.deepEqual(first.state.battle.hand.map((card) => card.id), second.state.battle.hand.map((card) => card.id));
  assert.ok(first.getLegalMoves().length > 0);
});

test('Scout counts only orthogonally adjacent allies and recalculates product score', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[3] = piece('blockade', 'player', 2, 1);
  battle.hand = [{ ...piece('scout', 'player', 1, 1), effect: 'scout', immune: false }];
  assert.deepEqual(game.getAdjacentIndices(4).sort((a, b) => a - b), [1, 3, 5, 7]);
  const result = game.playCard(0, 4);
  assert.equal(result.ok, true);
  assert.equal(battle.board[4].mult, 2);
  assert.deepEqual(battle.scores.player, { mult: 3, power: 3, score: 9 });
  assert.equal(battle.turn, 'enemy');
});

test('Crimson Serpent weakens only the strongest adjacent enemy piece', () => {
  const game = start();
  const battle = game.state.battle;
  const strongestAdjacent = piece('enemy-near-strong', 'enemy', 7, 1);
  const weakerAdjacent = piece('enemy-near-weak', 'enemy', 3, 1);
  const strongerDistant = piece('enemy-distant', 'enemy', 10, 1);
  battle.board[1] = strongestAdjacent;
  battle.board[3] = weakerAdjacent;
  battle.board[0] = strongerDistant;
  battle.hand = [{ ...piece('crimson_serpent', 'player', 2, 1), effect: 'crimsonSerpent' }];

  assert.equal(game.playCard(0, 4).ok, true);
  assert.equal(strongestAdjacent.power, 0);
  assert.equal(weakerAdjacent.power, 3);
  assert.equal(strongerDistant.power, 10);
});

test('all cards are playable, while occupied spaces are rejected without changing turns', () => {
  const game = start();
  const battle = game.state.battle;
  battle.hand = [{ ...piece('emperor', 'player', 4, 3) }];
  battle.board[0] = piece('scout', 'player');

  const occupied = game.playCard(0, 0);
  assert.equal(occupied.ok, false);
  assert.match(occupied.error, /occupied/);
  assert.equal(battle.turn, 'player');
  assert.equal(game.canPlay(0, 1), true);
  assert.equal(game.playCard(0, 1).ok, true);
  assert.equal(game.state.battle.turn, 'enemy');
  assert.equal(game.getLegalMoves().length, 0);
  assert.ok(game.getLegalMoves('enemy').length > 0);
});

test('a formation ends combat and adds bonus points before the score is compared', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[0] = piece('scout', 'player');
  battle.board[1] = piece('blockade', 'player');
  battle.board[3] = piece('wanderer', 'enemy');
  battle.hand = [{ ...piece('emperor', 'player', 1, 1), effect: 'goldGargoyle' }];

  const played = game.playCard(0, 2);
  assert.equal(played.ok, true);
  assert.equal(game.state.phase, 'battle-result');
  assert.equal(game.state.battle.result.outcome, 'win');
  assert.equal(game.state.battle.result.reason, 'formation');
  assert.equal(game.state.battle.result.formationOwner, 'player');
  assert.equal(game.state.battle.result.formationBonus, 25);
  game.continueAfterBattle();
  assert.equal(game.state.phase, 'map');
  assert.equal(game.state.campaign.wins, 1);
});

test('enemy chooses a tactical formation and score comparison still decides the result', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[0] = piece('scout', 'enemy');
  battle.board[1] = piece('blockade', 'enemy');
  battle.board[3] = piece('wanderer', 'player');
  battle.hand = [];
  battle.enemyHand = [{ ...piece('emperor', 'enemy', 1, 1), effect: 'goldGargoyle' }];
  battle.turn = 'enemy';

  const result = game.resolveEnemyTurn();
  assert.equal(result.ok, true);
  assert.equal(game.state.phase, 'battle-result');
  assert.equal(game.state.battle.result.outcome, 'loss');
  assert.equal(game.state.battle.result.formationOwner, 'enemy');
  game.continueAfterBattle();
  assert.equal(game.state.player.health, 9);
  assert.equal(game.state.phase, 'map');
});

test('a formation can end combat without winning when the other side has more points', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[0] = piece('player-a', 'player', 1, 1);
  battle.board[1] = piece('player-b', 'player', 1, 1);
  battle.board[8] = piece('enemy-heavy', 'enemy', 10, 10);
  battle.hand = [{ ...piece('player-c', 'player', 1, 1), effect: 'goldGargoyle' }];

  assert.equal(game.playCard(0, 2).ok, true);
  assert.equal(game.state.phase, 'battle-result');
  assert.equal(game.state.battle.result.reason, 'formation');
  assert.equal(game.state.battle.result.formationOwner, 'player');
  assert.equal(game.state.battle.result.playerScore, 34);
  assert.equal(game.state.battle.result.enemyScore, 100);
  assert.equal(game.state.battle.result.outcome, 'loss');
});

test('a filled board with equal product scores is a tie and applies one point of damage', () => {
  const game = start();
  const battle = game.state.battle;
  const owners = ['player', 'enemy', 'player', 'player', 'enemy', 'enemy', 'enemy', 'player', null];
  owners.forEach((owner, index) => {
    if (owner === null) return;
    const mult = owner === 'enemy' && index === 1 ? 2 : 1;
    const power = owner === 'enemy' && index === 1 ? 2 : 1;
    battle.board[index] = piece(`p${index}`, owner, power, mult);
  });
  battle.hand = [{ ...piece('last', 'player'), effect: 'goldGargoyle' }];
  assert.equal(game.playCard(0, 8).ok, true);
  assert.equal(game.state.phase, 'battle-result');
  assert.deepEqual(game.state.battle.result.playerTotals, { mult: 5, power: 5, score: 25 });
  assert.deepEqual(game.state.battle.result.enemyTotals, { mult: 5, power: 5, score: 25 });
  assert.equal(game.state.battle.result.outcome, 'tie');
  game.continueAfterBattle();
  assert.equal(game.state.player.health, 11);
});

test('Golden Contract gains the Power of other allied cards in its row', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[0] = piece('ally-left', 'player', 2, 1);
  battle.board[2] = piece('ally-right', 'player', 3, 1);
  battle.hand = [{ ...piece('golden_contract', 'player', 1, 2), effect: 'goldenContract' }];

  assert.equal(game.playCard(0, 1).ok, true);
  assert.equal(battle.board[1].power, 6);
  assert.equal(battle.scores.player.power, 11);
});

test('Poison Rose swaps with the highest-Mult enemy and steals one Mult', () => {
  const game = start();
  const battle = game.state.battle;
  const rose = { ...piece('poison_rose', 'player', 2, 1), effect: 'poisonRose' };
  const highMultEnemy = piece('enemy-high', 'enemy', 4, 5);
  battle.board[8] = highMultEnemy;
  battle.hand = [rose];

  assert.equal(game.playCard(0, 4).ok, true);
  assert.equal(battle.board[8], rose);
  assert.equal(battle.board[4], highMultEnemy);
  assert.equal(rose.mult, 2);
  assert.equal(highMultEnemy.mult, 4);
});

test('Crimson Bomb destroys itself and every orthogonal neighbor', () => {
  const game = start();
  const battle = game.state.battle;
  battle.board[1] = piece('ally', 'player');
  battle.board[3] = piece('enemy', 'enemy');
  battle.board[0] = piece('diagonal', 'enemy');
  battle.hand = [{ ...piece('crimson_bomb', 'player', 0, 0), effect: 'crimsonBomb' }];

  assert.equal(game.playCard(0, 4).ok, true);
  assert.equal(battle.board[1], null);
  assert.equal(battle.board[3], null);
  assert.equal(battle.board[4], null);
  assert.notEqual(battle.board[0], null);
});

test('Magma Fist marks an enemy and destroys it at the end of its next turn', () => {
  const game = start();
  const battle = game.state.battle;
  const marked = piece('enemy-marked', 'enemy', 5, 2);
  const support = piece('support', 'player', 2, 1);
  battle.board[0] = marked;
  battle.board[8] = support;
  battle.hand = [{ ...piece('magma_fist', 'player', 1, 1), effect: 'magmaFist' }];
  battle.enemyHand = [{ ...piece('wanderer', 'enemy', 1, 1), effect: 'goldGargoyle' }];

  assert.equal(game.playCard(0, 4, { targetIndex: 0, supportIndex: 8 }).ok, true);
  assert.deepEqual(marked.markedForDestruction, { owner: 'player', supportUid: support.uid });
  assert.equal(battle.board[0], marked);
  assert.equal(game.resolveEnemyTurn().ok, true);
  assert.equal(battle.board[0], null);
  assert.equal(support.power, 2);
});

test('Magma Fist grants its selected ally +2 Power if the marked enemy leaves early', () => {
  const game = start();
  const battle = game.state.battle;
  const marked = piece('enemy-marked-early', 'enemy', 5, 2);
  const support = piece('support-early', 'player', 2, 1);
  battle.board[0] = marked;
  battle.board[8] = support;
  battle.hand = [{ ...piece('magma_fist', 'player', 1, 1), effect: 'magmaFist' }];
  battle.enemyHand = [{ ...piece('crimson_bomb', 'enemy', 0, 0), effect: 'crimsonBomb' }];

  assert.equal(game.playCard(0, 4, { targetIndex: 0, supportIndex: 8 }).ok, true);
  assert.equal(game.resolveEnemyTurn().ok, true);
  assert.equal(battle.board[0], null);
  assert.equal(support.power, 4);
});

test('end turn leaves the enemy response available for the renderer to animate', () => {
  const game = start();
  const battle = game.state.battle;
  assert.equal(battle.board.filter((card) => card?.owner === 'enemy').length, 0);
  assert.equal(game.endTurn().ok, true);
  assert.equal(battle.turn, 'enemy');
  assert.equal(battle.board.filter((card) => card?.owner === 'enemy').length, 0);
  assert.equal(game.resolveEnemyTurn().ok, true);
  assert.equal(battle.board.filter((card) => card?.owner === 'enemy').length, 1);
  assert.equal(battle.turn, 'player');
});

test('score adjudication distinguishes win, tie, and loss', () => {
  assert.equal(resultForScores({ score: 10 }, { score: 9 }), 'win');
  assert.equal(resultForScores({ score: 10 }, { score: 10 }), 'tie');
  assert.equal(resultForScores({ score: 9 }, { score: 10 }), 'loss');
});

test('restart resets campaign, resources, sin, and battle to the selection screen', () => {
  const game = start(909, 'wrath');
  game.state.player.health = 2;
  game.state.player.gold = 99;
  game.state.campaign.stage = 4;
  const result = game.restart({ seed: 909 });
  assert.equal(result.ok, true);
  assert.equal(game.state.phase, 'sin-select');
  assert.equal(game.state.player.health, 12);
  assert.equal(game.state.player.gold, 8);
  assert.equal(game.state.player.sin, null);
  assert.equal(game.state.campaign.stage, 0);
  assert.equal(game.state.battle, null);
});

test('all eight sins have distinct, themed starting decks', () => {
  assert.equal(SIN_OPTIONS.length, 8);
  const deckSignatures = new Set(Object.values(SIN_STARTER_DECKS).map((deck) => [...deck].sort().join(',')));
  assert.equal(deckSignatures.size, 8);
  assert.ok(SIN_STARTER_DECKS.greed.includes('golden_contract'));
  assert.ok(SIN_STARTER_DECKS.wrath.includes('crimson_bomb'));
  assert.ok(Object.values(CARDS).every((card) => !Object.hasOwn(card, 'cost')));
  const seenDecks = new Set();
  for (const sin of SIN_OPTIONS) {
    const game = start(500, sin.id);
    const ids = game.state.player.deck.map((card) => card.id);
    assert.ok(ids.length >= 18);
    assert.ok(ids.every((id) => CARDS[id]));
    seenDecks.add([...ids].sort().join(','));
  }
  assert.equal(seenDecks.size, SIN_OPTIONS.length);
});

test('forge, trade, and service-node exit mutate deck then return to the map', () => {
  const game = start(314, 'greed');
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  const forgeNode = game.state.campaign.map.find((node) => node.type === 'forge');
  game.chooseNode(forgeNode.id);
  assert.equal(game.state.phase, 'forge');
  const card = game.state.player.deck[0];
  const originalPower = card.power;
  assert.equal(game.forge(card.uid).ok, true);
  assert.equal(card.power, originalPower + 1);
  assert.equal(game.state.phase, 'forge');
  assert.equal(game.leaveNode().ok, true);
  assert.equal(game.state.phase, 'map');

  const tradeNode = game.state.campaign.map.find((node) => node.type === 'trade');
  game.chooseNode(tradeNode.id);
  const removable = game.state.player.deck.find((owned) => !game.state.campaign.tradeOffers.some((offer) => offer.id === owned.id));
  const offerId = game.state.campaign.tradeOffers[0].id;
  assert.equal(game.trade(removable.uid, offerId).ok, true);
  assert.ok(game.state.player.deck.some((owned) => owned.id === offerId));
  assert.equal(game.state.phase, 'trade');
  assert.equal(game.leaveNode().ok, true);
  assert.equal(game.state.phase, 'map');
});

test('campaign battles grow from 3x3 to 4x4 and then 5x5', () => {
  const game = start();
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  const chooseBattle = () => game.state.campaign.map.find((node) => node.type === 'battle' || node.type === 'boss');

  game.chooseNode(chooseBattle().id);
  assert.equal(game.state.battle.rows, 3);
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  game.chooseNode(chooseBattle().id);
  assert.equal(game.state.battle.rows, 3);
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  game.chooseNode(chooseBattle().id);
  assert.equal(game.state.battle.rows, 4);
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  game.chooseNode(chooseBattle().id);
  assert.equal(game.state.battle.rows, 4);
  game._finishBattle('win', 'score');
  game.continueAfterBattle();
  game.chooseNode(chooseBattle().id);
  assert.equal(game.state.battle.rows, 5);
});

test('demo preset reproduces the reference score products and leaves legal player moves', () => {
  const game = new GameEngine();
  game.loadDemo();
  assert.equal(game.state.phase, 'battle');
  assert.equal(game.state.battle.rows, 5);
  assert.deepEqual(game.state.battle.scores.player, { mult: 22, power: 3494, score: 76868 });
  assert.deepEqual(game.state.battle.scores.enemy, { mult: 8, power: 12, score: 96 });
  assert.ok(game.getLegalMoves().length > 0);
});
