import { CARDS, SIN_OPTIONS, SIN_STARTER_DECKS, STARTER_DECK } from './cards.js';

const DEFAULT_SEED = 73129;
const STARTING_HEALTH = 12;
const STARTING_GOLD = 8;
const STARTING_HAND = 3;
const MAX_HAND = 4;
const FORMATION_BONUS = 25;

function copy(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0 || DEFAULT_SEED;
  let hash = 2166136261;
  for (const character of String(seed ?? DEFAULT_SEED)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || DEFAULT_SEED;
}

function sumSide(board, owner) {
  let mult = 0;
  let power = 0;
  for (const card of board) {
    if (card?.owner !== owner) continue;
    mult += Math.max(0, card.mult);
    power += Math.max(0, card.power);
  }
  return { mult, power, score: mult * power };
}

function resultForScores(player, enemy) {
  if (player.score > enemy.score) return 'win';
  if (player.score < enemy.score) return 'loss';
  return 'tie';
}

/**
 * Deterministic card battler and campaign state machine. It has no UI or API
 * dependencies. Commands return `{ ok, error?, state }`; `state` is also
 * available directly as `engine.state` for renderers that keep their own view.
 */
export class GameEngine {
  constructor({ seed = DEFAULT_SEED } = {}) {
    this.seed = seed;
    this._randomState = hashSeed(seed);
    this._nextUid = 1;
    this._initialize();
  }

  _initialize() {
    this._randomState = hashSeed(this.seed);
    this._nextUid = 1;
    this.state = {
      version: 1,
      phase: 'sin-select',
      seed: this.seed,
      player: {
        health: STARTING_HEALTH,
        maxHealth: STARTING_HEALTH,
        gold: STARTING_GOLD,
        sin: null,
        deck: [],
      },
      campaign: {
        stage: 0,
        wins: 0,
        battles: 0,
        tutorialComplete: false,
        map: [],
        nodeHistory: [],
        selectedNode: null,
        forgeCost: 4,
        tradeOffers: [],
      },
      trade: { offers: [] },
      battle: null,
    };
  }

  _random() {
    // Mulberry32: tiny, reproducible, and independent of browser APIs.
    let value = this._randomState += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this._randomState = value >>> 0;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  _shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(this._random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
  }

  _makeCard(cardId, owner = 'player', level = 1) {
    const definition = CARDS[cardId];
    if (!definition) throw new Error(`Unknown card: ${cardId}`);
    const upgrades = Math.max(0, level - 1);
    return {
      ...definition,
      uid: `card-${this._nextUid++}`,
      owner,
      level,
      power: definition.power + upgrades,
      mult: definition.mult + (upgrades > 0 ? Math.floor(upgrades / 2) : 0),
    };
  }

  _command(ok, error) {
    const result = { ok, state: this.getState() };
    if (error) result.error = error;
    return result;
  }

  _fail(message) {
    return this._command(false, message);
  }

  _ok() {
    return this._command(true);
  }

  getState() {
    return copy(this.state);
  }

  getLegalMoves(owner = 'player') {
    const battle = this.state.battle;
    if (!battle || this.state.phase !== 'battle') return [];
    const hand = owner === 'player' ? battle.hand : battle.enemyHand;
    if ((owner === 'player' && battle.turn !== 'player') || (owner === 'enemy' && battle.turn !== 'enemy')) return [];
    const moves = [];
    for (let handIndex = 0; handIndex < hand.length; handIndex += 1) {
      const card = hand[handIndex];
      for (let cellIndex = 0; cellIndex < battle.board.length; cellIndex += 1) {
        if (battle.board[cellIndex] === null) {
          moves.push({ handIndex, cardUid: card.uid, cellIndex });
        }
      }
    }
    return moves;
  }

  getAvailableMoves() {
    return this.getLegalMoves('player');
  }

  canPlay(handIndex, cellIndex) {
    return this.getLegalMoves().some((move) => move.handIndex === handIndex && move.cellIndex === cellIndex);
  }

  selectSin(sinId) {
    if (this.state.phase !== 'sin-select') return this._fail('Choose a sin only at run start.');
    const sin = SIN_OPTIONS.find((option) => option.id === sinId);
    if (!sin) return this._fail(`Unknown sin: ${sinId}`);

    this.state.player.sin = copy(sin);
    this.state.player.deck = (SIN_STARTER_DECKS[sinId] ?? STARTER_DECK).map((cardId) => this._makeCard(cardId));
    this._startBattle('tutorial', 0);
    return this._ok();
  }

  _gridSize(stage, kind) {
    if (kind === 'tutorial') return 3;
    if (kind === 'boss' || stage >= 4) return 5;
    if (stage >= 2) return 4;
    return 3;
  }

  _startBattle(kind, stage) {
    const size = this._gridSize(stage, kind);
    const enemyBaseDeck = this._shuffle([
      'wanderer', 'scout', 'broken_sigil', 'blockade', 'stray_blade',
      'crimson_bomb', 'crimson_serpent', 'gold_gargoyle', 'magma_fist',
      'enraged_minotaur', 'cursed_coin', 'poison_rose', 'wanderer', 'scout',
      'broken_sigil', 'blockade', 'stray_blade', 'crimson_serpent',
    ]);
    const enemyDeck = enemyBaseDeck.map((cardId) => this._makeCard(cardId, 'enemy'));
    const drawPile = this._shuffle(this.state.player.deck.map((card) => card.uid));
    const enemyDrawPile = this._shuffle(enemyDeck.map((card) => card.uid));
    const battle = {
      kind,
      stage,
      rows: size,
      cols: size,
      board: Array(size * size).fill(null),
      turn: 'player',
      round: 1,
      playerPlays: 0,
      enemyPlays: 0,
      hand: [],
      enemyHand: [],
      drawPile,
      enemyDrawPile,
      enemyDeck,
      enemy: {
        id: kind === 'boss' ? 'the-throne' : kind === 'tutorial' ? 'the-sinner' : `enemy-${stage + 1}`,
        name: kind === 'boss' ? 'The Throne' : kind === 'tutorial' ? 'The Sinner' : ['Bone Collector', 'Gold Warden', 'Crimson Judge'][stage % 3],
        artId: kind === 'boss' ? 'the-throne' : kind === 'tutorial' ? 'the-sinner' : ['bone-collector', 'gold-warden', 'crimson-judge'][stage % 3],
        health: kind === 'boss' ? 30 : 8 + stage * 3,
      },
      scores: {
        player: { mult: 0, power: 0, score: 0 },
        enemy: { mult: 0, power: 0, score: 0 },
      },
      formationBonuses: { player: 0, enemy: 0 },
      formation: null,
      result: null,
      demo: false,
      log: [{ type: 'battle-start', kind, size, enemy: kind === 'boss' ? 'The Throne' : kind === 'tutorial' ? 'The Sinner' : 'Enemy' }],
    };
    this.state.battle = battle;
    this._drawCards('player', STARTING_HAND);
    this._drawCards('enemy', STARTING_HAND);
    this.state.phase = 'battle';
    this._refreshScores();
  }

  _drawCards(owner, count = 1) {
    const battle = this.state.battle;
    const hand = owner === 'player' ? battle.hand : battle.enemyHand;
    const drawPile = owner === 'player' ? battle.drawPile : battle.enemyDrawPile;
    const deck = owner === 'player' ? this.state.player.deck : battle.enemyDeck;
    const limit = owner === 'player' ? MAX_HAND : MAX_HAND;
    const byUid = new Map(deck.map((card) => [card.uid, card]));
    for (let index = 0; index < count && hand.length < limit && drawPile.length > 0; index += 1) {
      const uid = drawPile.pop();
      const baseCard = byUid.get(uid);
      if (!baseCard) continue;
      hand.push({ ...copy(baseCard), owner });
    }
  }

  _refreshScores() {
    const battle = this.state.battle;
    if (!battle) return;
    for (const owner of ['player', 'enemy']) {
      const totals = sumSide(battle.board, owner);
      const bonus = battle.formationBonuses?.[owner] ?? 0;
      battle.scores[owner] = bonus > 0
        ? { ...totals, baseScore: totals.score, formationBonus: bonus, score: totals.score + bonus }
        : totals;
    }
  }

  _neighbors(cellIndex) {
    const battle = this.state.battle;
    const row = Math.floor(cellIndex / battle.cols);
    const col = cellIndex % battle.cols;
    const neighbors = [];
    if (row > 0) neighbors.push(cellIndex - battle.cols);
    if (row + 1 < battle.rows) neighbors.push(cellIndex + battle.cols);
    if (col > 0) neighbors.push(cellIndex - 1);
    if (col + 1 < battle.cols) neighbors.push(cellIndex + 1);
    return neighbors;
  }

  getAdjacentIndices(cellIndex) {
    if (!Number.isInteger(cellIndex) || !this.state.battle || cellIndex < 0 || cellIndex >= this.state.battle.board.length) return [];
    return this._neighbors(cellIndex);
  }

  _lineSets() {
    const battle = this.state.battle;
    const lines = [];
    for (let row = 0; row < battle.rows; row += 1) {
      lines.push(Array.from({ length: battle.cols }, (_, col) => row * battle.cols + col));
    }
    for (let col = 0; col < battle.cols; col += 1) {
      lines.push(Array.from({ length: battle.rows }, (_, row) => row * battle.cols + col));
    }
    lines.push(Array.from({ length: Math.min(battle.rows, battle.cols) }, (_, step) => step * battle.cols + step));
    lines.push(Array.from({ length: Math.min(battle.rows, battle.cols) }, (_, step) => step * battle.cols + (battle.cols - 1 - step)));
    return lines;
  }

  _hasFormation(owner) {
    const board = this.state.battle.board;
    return this._lineSets().some((line) => line.every((cellIndex) => board[cellIndex]?.owner === owner));
  }

  _winningFormation(owner) {
    const board = this.state.battle.board;
    return this._lineSets().find((line) => line.every((cellIndex) => board[cellIndex]?.owner === owner)) ?? null;
  }

  _playCard(handIndex, cellIndex, owner, options = {}) {
    const battle = this.state.battle;
    const hand = owner === 'player' ? battle.hand : battle.enemyHand;
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) return { ok: false, error: 'That card is not in hand.' };
    if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= battle.board.length) return { ok: false, error: 'That board space is invalid.' };
    if (battle.board[cellIndex] !== null) return { ok: false, error: 'That board space is occupied.' };
    const card = hand[handIndex];
    hand.splice(handIndex, 1);
    card.owner = owner;
    card.playedAt = cellIndex;
    battle.board[cellIndex] = card;
    if (owner === 'player') battle.playerPlays += 1;
    else battle.enemyPlays += 1;

    this._runEffect(card, cellIndex, options);
    this._resolveMarkedForTurn(owner);
    this._refreshScores();
    battle.log.push({ type: 'play', owner, cardId: card.id, cardName: card.name, cellIndex });

    const formation = this._winningFormation(owner);
    if (formation) {
      this._finishBattle('pending', 'formation', owner, formation);
    } else if (battle.board.every((cell) => cell !== null)) {
      const outcome = resultForScores(battle.scores.player, battle.scores.enemy);
      this._finishBattle(outcome, 'score');
    }

    return { ok: true };
  }

  _destroyCard(cellIndex) {
    const battle = this.state.battle;
    const card = battle.board[cellIndex];
    if (!card) return null;
    battle.board[cellIndex] = null;
    battle.log.push({ type: 'destroy', cardId: card.id, cardName: card.name, owner: card.owner, cellIndex });
    if (card.markedForDestruction) {
      const { owner, supportUid } = card.markedForDestruction;
      const support = battle.board.find((piece) => piece?.uid === supportUid && piece.owner === owner)
        ?? battle.board.filter((piece) => piece?.owner === owner).sort((left, right) => right.power - left.power)[0];
      if (support) support.power += 2;
    }
    return card;
  }

  _resolveMarkedForTurn(owner) {
    const battle = this.state.battle;
    for (let index = 0; index < battle.board.length; index += 1) {
      const card = battle.board[index];
      if (!card || card.owner !== owner || !card.markedForDestruction) continue;
      card.markedForDestruction = null;
      this._destroyCard(index);
    }
  }

  _highestCard(owner, stat) {
    const battle = this.state.battle;
    let best = null;
    for (let cellIndex = 0; cellIndex < battle.board.length; cellIndex += 1) {
      const card = battle.board[cellIndex];
      if (card?.owner !== owner || card.immune) continue;
      if (!best || card[stat] > best.card[stat]) best = { card, cellIndex };
    }
    return best?.card ?? null;
  }

  _runEffect(card, cellIndex, options = {}) {
    const battle = this.state.battle;
    const requestedTarget = options.targetIndex;
    const owner = card.owner;
    const enemy = owner === 'player' ? 'enemy' : 'player';
    const adjacent = this._neighbors(cellIndex);
    const allies = adjacent.map((index) => battle.board[index]).filter((piece) => piece?.owner === owner);
    const enemies = adjacent.map((index) => battle.board[index]).filter((piece) => piece?.owner === enemy);
    const targetByHighestMult = () => {
      let best = null;
      for (const piece of battle.board) {
        if (piece?.owner !== enemy || piece.immune) continue;
        if (!best || piece.mult > best.mult) best = piece;
      }
      return best;
    };

    switch (card.effect) {
      case 'scout':
        card.mult += allies.length;
        break;
      case 'wanderer':
      case 'strayBlade':
        if (enemies.length > 0) card.power += 1;
        break;
      case 'blockade':
        card.power += allies.length;
        break;
      case 'brokenSigil': {
        const target = targetByHighestMult();
        if (target) {
          target.mult = Math.max(0, target.mult - 1);
          target.power = Math.max(0, target.power - 1);
        }
        break;
      }
      case 'crimsonBomb':
        for (const index of [cellIndex, ...adjacent]) this._destroyCard(index);
        break;
      case 'crimsonSerpent': {
        const target = enemies
          .filter((piece) => !piece.immune)
          .sort((left, right) => right.power - left.power)[0];
        if (target) target.power = 0;
        break;
      }
      case 'poisonRose': {
        let targetIndex = -1;
        for (let index = 0; index < battle.board.length; index += 1) {
          const target = battle.board[index];
          if (target?.owner !== enemy || target.immune) continue;
          if (targetIndex === -1 || target.mult > battle.board[targetIndex].mult) targetIndex = index;
        }
        if (targetIndex !== -1) {
          const target = battle.board[targetIndex];
          if (target && !target.immune) {
            target.mult = Math.max(0, target.mult - 1);
            card.mult += 1;
          }
          [battle.board[cellIndex], battle.board[targetIndex]] = [battle.board[targetIndex], battle.board[cellIndex]];
        }
        break;
      }
      case 'enragedMinotaur': {
        const row = Math.floor(cellIndex / battle.cols);
        const rowAllies = Array.from({ length: battle.cols }, (_, col) => battle.board[row * battle.cols + col])
          .filter((piece) => piece?.owner === owner && piece.uid !== card.uid).length;
        card.power += 2 * rowAllies;
        break;
      }
      case 'magmaFist': {
        const requestedIsEnemy = Number.isInteger(requestedTarget)
          && requestedTarget >= 0
          && requestedTarget < battle.board.length
          && battle.board[requestedTarget]?.owner === enemy;
        let targetIndex = requestedIsEnemy ? requestedTarget : -1;
        if (targetIndex < 0) {
          let highest = -Infinity;
          battle.board.forEach((piece, index) => {
            if (piece?.owner === enemy && piece.power > highest) {
              highest = piece.power;
              targetIndex = index;
            }
          });
        }
        const target = battle.board[targetIndex];
        if (target?.owner === enemy) {
          const requestedSupport = options.supportIndex;
          const supportCard = Number.isInteger(requestedSupport)
            ? battle.board[requestedSupport]
            : null;
          const support = supportCard?.owner === owner
            ? supportCard
            : battle.board.filter((piece) => piece?.owner === owner).sort((left, right) => right.power - left.power)[0];
          target.markedForDestruction = { owner, supportUid: support?.uid ?? null };
        }
        break;
      }
      case 'cursedCoin':
        if (owner === 'player') this.state.player.gold += 2;
        break;
      case 'darkMerchant':
        if (owner === 'player') this.state.player.gold += allies.length;
        break;
      case 'goldenContract':
        {
          const row = Math.floor(cellIndex / battle.cols);
          const allyPower = Array.from({ length: battle.cols }, (_, col) => battle.board[row * battle.cols + col])
            .filter((piece) => piece?.owner === owner && piece.uid !== card.uid)
            .reduce((total, piece) => total + piece.power, 0);
          card.power += allyPower;
        }
        break;
      case 'emperor': {
        const copies = battle.board.filter((piece) => piece?.owner === owner && piece.id === card.id && piece.uid !== card.uid).length;
        card.power += copies;
        break;
      }
      case 'goldGargoyle':
      default:
        break;
    }
  }

  playCard(handIndex, cellIndex, options = {}) {
    if (this.state.phase !== 'battle') return this._fail('There is no active battle.');
    const battle = this.state.battle;
    if (battle.turn !== 'player') return this._fail('Wait for the enemy turn to finish.');
    const result = this._playCard(handIndex, cellIndex, 'player', options);
    if (!result.ok) return this._fail(result.error);
    if (this.state.phase === 'battle') {
      battle.turn = 'enemy';
      battle.enemyPending = true;
      this._drawCards('player', 1);
    }
    this._refreshScores();
    return this._ok();
  }

  endTurn() {
    if (this.state.phase !== 'battle') return this._fail('There is no active battle.');
    if (this.state.battle.turn !== 'player') return this._fail('It is not your turn.');
    this._resolveMarkedForTurn('player');
    this._refreshScores();
    this.state.battle.turn = 'enemy';
    this.state.battle.enemyPending = true;
    this.state.battle.log.push({ type: 'pass', owner: 'player' });
    return this._ok();
  }

  _chooseEnemyMove() {
    const battle = this.state.battle;
    const moves = this.getLegalMoves('enemy');
    if (moves.length === 0) return null;
    const lines = this._lineSets();
    let bestMove = null;
    let bestValue = -Infinity;
    for (const move of moves) {
      const card = battle.enemyHand[move.handIndex];
      const row = Math.floor(move.cellIndex / battle.cols);
      const col = move.cellIndex % battle.cols;
      let value = card.mult * card.power;
      value += Math.max(0, 2 - Math.abs(row - (battle.rows - 1) / 2) - Math.abs(col - (battle.cols - 1) / 2)) * 0.2;
      const adjacent = this._neighbors(move.cellIndex).map((index) => battle.board[index]);
      value += adjacent.filter((piece) => piece?.owner === 'enemy').length * (card.effect === 'scout' ? 2 : 0.4);
      value += adjacent.filter((piece) => piece?.owner === 'player').length * (card.effect === 'wanderer' ? 2 : 0.3);
      for (const line of lines) {
        if (!line.includes(move.cellIndex)) continue;
        const enemyCount = line.filter((index) => battle.board[index]?.owner === 'enemy').length;
        const playerCount = line.filter((index) => battle.board[index]?.owner === 'player').length;
        value += enemyCount * enemyCount * 1.3;
        if (playerCount === line.length - 1 && enemyCount === 0) value += 20;
      }
      const savedCard = battle.board[move.cellIndex];
      battle.board[move.cellIndex] = { ...card, owner: 'enemy' };
      if (this._hasFormation('enemy')) value += 1000;
      if (this._hasFormation('player')) value -= 1000;
      battle.board[move.cellIndex] = savedCard;
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    return bestMove;
  }

  resolveEnemyTurn() {
    if (this.state.phase !== 'battle') return this._fail('There is no active battle.');
    const battle = this.state.battle;
    if (battle.turn !== 'enemy') return this._fail('It is not the enemy turn.');
    if (battle.board.every((cell) => cell !== null)) {
      const outcome = resultForScores(battle.scores.player, battle.scores.enemy);
      this._finishBattle(outcome, 'score');
      return this._ok();
    }

    const move = this._chooseEnemyMove();
    if (move) {
      this._playCard(move.handIndex, move.cellIndex, 'enemy');
      if (this.state.phase === 'battle') this._drawCards('enemy', 1);
    } else {
      battle.log.push({ type: 'pass', owner: 'enemy' });
      this._resolveMarkedForTurn('enemy');
    }

    if (this.state.phase === 'battle') {
      battle.turn = 'player';
      battle.enemyPending = false;
      battle.round += 1;
      this._refreshScores();
      if (battle.hand.length === 0 && battle.drawPile.length === 0 && battle.enemyHand.length === 0 && battle.enemyDrawPile.length === 0) {
        this._finishBattle(resultForScores(battle.scores.player, battle.scores.enemy), 'score');
      }
    }
    return this._ok();
  }

  _finishBattle(outcome, reason, formationOwner = null, formation = null) {
    const battle = this.state.battle;
    if (battle.result) return;
    if (reason === 'formation' && formationOwner && !battle.formation) {
      battle.formation = { owner: formationOwner, cells: [...formation] };
      battle.formationBonuses[formationOwner] = FORMATION_BONUS;
    }
    this._refreshScores();
    if (outcome === 'pending') outcome = resultForScores(battle.scores.player, battle.scores.enemy);
    const difference = battle.scores.enemy.score - battle.scores.player.score;
    const damage = outcome === 'loss'
      ? reason === 'formation' ? 3 : Math.max(1, Math.min(4, 1 + Math.floor(Math.max(0, difference) / 40)))
      : outcome === 'tie' ? 1 : 0;
    battle.result = {
      outcome,
      reason,
      formationOwner,
      formationCells: formation ? [...formation] : null,
      formationBonus: reason === 'formation' ? FORMATION_BONUS : 0,
      damage,
      rewardGold: outcome === 'win' ? 3 : 0,
      playerScore: battle.scores.player.score,
      enemyScore: battle.scores.enemy.score,
      playerTotals: copy(battle.scores.player),
      enemyTotals: copy(battle.scores.enemy),
    };
    battle.turn = 'resolved';
    battle.enemyPending = false;
    battle.log.push({ type: 'battle-result', outcome, reason });
    this.state.phase = 'battle-result';
  }

  continueAfterBattle() {
    if (this.state.phase !== 'battle-result' || !this.state.battle?.result) return this._fail('There is no battle result to continue from.');
    const battle = this.state.battle;
    const result = battle.result;
    if (result.rewardApplied) return this._fail('This battle result was already applied.');
    result.rewardApplied = true;

    if (battle.kind === 'tutorial') this.state.campaign.tutorialComplete = true;
    if (result.outcome === 'win') {
      this.state.campaign.wins += 1;
      this.state.player.gold += result.rewardGold;
    } else if (result.outcome === 'tie') {
      this.state.player.health = Math.max(0, this.state.player.health - result.damage);
    } else {
      this.state.player.health = Math.max(0, this.state.player.health - result.damage);
    }
    this.state.campaign.battles += 1;
    if (this.state.player.health <= 0) {
      this.state.phase = 'lost';
      return this._ok();
    }
    if (battle.kind === 'boss' && result.outcome === 'win') {
      this.state.phase = 'won';
      return this._ok();
    }
    this._showMap();
    return this._ok();
  }

  _showMap() {
    const stage = this.state.campaign.stage;
    let types;
    if (stage >= 5) types = ['boss'];
    else if (stage === 4) types = ['boss', 'forge', 'trade'];
    else if (stage === 0) types = ['battle', 'forge', 'trade'];
    else if (stage === 1) types = ['battle', 'rest', 'trade'];
    else if (stage === 2) types = ['battle', 'forge', 'rest'];
    else types = ['battle', 'trade', 'rest'];
    this.state.campaign.map = types.map((type, lane) => ({
      id: `stage-${stage}-lane-${lane}`,
      type,
      label: ({ battle: 'Enemy', forge: 'Forge', trade: 'Trade', rest: 'Rest', boss: 'Boss' })[type],
      lane,
      stage,
      artId: `${type}-node`,
    }));
    this.state.campaign.selectedNode = null;
    this.state.campaign.tradeOffers = [];
    this.state.trade.offers = [];
    this.state.phase = 'map';
  }

  chooseNode(nodeId) {
    if (this.state.phase !== 'map') return this._fail('Choose a node from the campaign map.');
    const node = this.state.campaign.map.find((entry) => entry.id === nodeId);
    if (!node) return this._fail('That node is not available on this map.');
    this.state.campaign.selectedNode = copy(node);
    this.state.campaign.nodeHistory.push({ id: node.id, type: node.type, stage: node.stage });
    const chosenStage = this.state.campaign.stage;
    this.state.campaign.stage += 1;
    if (node.type === 'battle' || node.type === 'boss') {
      this._startBattle(node.type, chosenStage);
      return this._ok();
    }
    if (node.type === 'forge') {
      this.state.phase = 'forge';
      this.state.campaign.forgeCost = 4 + Math.floor(chosenStage / 2);
      return this._ok();
    }
    if (node.type === 'trade' || node.type === 'shop') {
      const owned = new Set(this.state.player.deck.map((card) => card.id));
      this.state.campaign.tradeOffers = Object.keys(CARDS)
        .filter((cardId) => !owned.has(cardId))
        .slice(0, 5)
        .map((cardId) => ({ ...copy(CARDS[cardId]), id: cardId }));
      this.state.trade.offers = copy(this.state.campaign.tradeOffers);
      this.state.phase = 'trade';
      return this._ok();
    }
    if (node.type === 'rest') {
      this.state.player.health = Math.min(this.state.player.maxHealth, this.state.player.health + 3);
      this.state.player.gold += 1;
    }
    this._showMap();
    return this._ok();
  }

  forge(cardUid, stat = 'power') {
    if (this.state.phase !== 'forge') return this._fail('You are not at the forge.');
    if (!['power', 'mult'].includes(stat)) return this._fail('Choose Power or Mult to improve.');
    const cost = this.state.campaign.forgeCost;
    if (this.state.player.gold < cost) return this._fail('Not enough gold to forge a card.');
    const card = this.state.player.deck.find((entry) => entry.uid === cardUid);
    if (!card) return this._fail('That card is not in your deck.');
    card[stat] += 1;
    card.level += 1;
    this.state.player.gold -= cost;
    this.state.campaign.nodeHistory[this.state.campaign.nodeHistory.length - 1].result = { cardUid, stat, cost };
    return this._ok();
  }

  trade(cardUid, cardId) {
    if (this.state.phase !== 'trade') return this._fail('You are not at a trader.');
    const cardIndex = this.state.player.deck.findIndex((entry) => entry.uid === cardUid);
    if (cardIndex < 0) return this._fail('Choose a card from your deck to trade away.');
    if (!this.state.campaign.tradeOffers.some((offer) => offer.id === cardId)) return this._fail('That card is not being offered.');
    const [removed] = this.state.player.deck.splice(cardIndex, 1);
    const added = this._makeCard(cardId);
    this.state.player.deck.push(added);
    this.state.campaign.nodeHistory[this.state.campaign.nodeHistory.length - 1].result = { removedCardId: removed.id, addedCardId: added.id };
    const owned = new Set(this.state.player.deck.map((card) => card.id));
    this.state.campaign.tradeOffers = this.state.campaign.tradeOffers.filter((offer) => !owned.has(offer.id));
    this.state.trade.offers = copy(this.state.campaign.tradeOffers);
    return this._ok();
  }

  leaveNode() {
    if (this.state.phase !== 'forge' && this.state.phase !== 'trade' && this.state.phase !== 'shop') {
      return this._fail('There is no service node to leave.');
    }
    this._showMap();
    return this._ok();
  }

  restart({ seed = this.seed } = {}) {
    this.seed = seed;
    this._initialize();
    return this._ok();
  }

  /** Put the engine into a populated 5x5 state matching the reference HUD totals. */
  loadDemo() {
    this._initialize();
    this.state.player.sin = copy(SIN_OPTIONS.find((sin) => sin.id === 'greed'));
    this.state.player.deck = (SIN_STARTER_DECKS.greed ?? STARTER_DECK).map((cardId) => this._makeCard(cardId));
    this.state.campaign = {
      stage: 4, wins: 4, battles: 7, tutorialComplete: true,
      map: [], nodeHistory: [], selectedNode: null, forgeCost: 6, tradeOffers: [],
    };
    this._startBattle('battle', 4);
    const battle = this.state.battle;
    battle.round = 7;
    battle.demo = true;
    battle.enemy = { id: 'gold-warden', name: 'Gold Warden', artId: 'gold-warden', health: 18 };
    battle.board = Array(25).fill(null);
    const playerCells = [7, 8, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24];
    const playerArt = ['living-treasure','gold-gargoyle','rising-crown','rising-crown','living-treasure','living-treasure','emperor','living-treasure','living-treasure','emperor','gold-gargoyle','golden-phoenix','living-treasure'];
    const playerMults = Array(9).fill(2).concat(Array(4).fill(1));
    const playerPowers = Array(12).fill(249).concat(506);
    playerCells.forEach((cellIndex,index)=>{
      const card=this._makeCard(playerArt[index]==='emperor'?'emperor':playerArt[index]==='rising-crown'?'golden_contract':'gold_gargoyle');
      card.artId=playerArt[index];card.owner='player';card.power=playerPowers[index];card.mult=playerMults[index];battle.board[cellIndex]=card;
    });
    const enemyCells=[0,1,2,4,11,15,19,23];
    const enemyArt=['portal','portal','raven','tower','tower','tower','pink-sigil','pink-sigil'];
    enemyCells.forEach((cellIndex,index)=>{
      const card=this._makeCard(index<2?'scout':index>5?'poison_rose':'wanderer','enemy');
      card.artId=enemyArt[index];card.owner='enemy';card.power=index===0?5:1;card.mult=1;battle.board[cellIndex]=card;
    });
    battle.enemy={id:'sloth',name:'Sloth',sin:'sloth',artId:'sloth',health:18};
    battle.hand=[this._makeCard('golden_contract'),this._makeCard('emperor'),this._makeCard('crimson_bomb')];
    this.state.player.health = 8;
    this.state.player.gold = 24;
    this._refreshScores();
    return this._ok();
  }
}

export { CARDS, SIN_OPTIONS, SIN_STARTER_DECKS, STARTER_DECK, resultForScores };
export default GameEngine;
