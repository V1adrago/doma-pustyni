import * as THREE from 'three';
import { createScene }    from './scene.js';
import { createMap }      from './map.js';
import { TowerManager }   from './towers.js';
import { SpiceEconomy }   from './economy.js';
import { UI }             from './ui.js';
import { CONFIG }         from './config.js';
import { GameMenu }       from './menu.js';
import { UnitManager }    from './unit-manager.js';
import { LANE_X }          from './units.js';
import { Hand }           from './hand.js';
import { DeckBuilder }    from './deck-builder.js';
import { FactionManager } from './factions.js';
import { CARD_DEFS, CARD_ICONS, CARD_COLORS, getCardCost, canPlayCard, ENGINEER_MIN_TIMES, AI_DECK } from './cards.js';
import { PROGRESSION }   from './config/progression.js';
import { addMatchResult } from './services/profile-service.js';
import { RoomScreen }     from './room-screen.js';
import { parseRoomIdFromUrl } from './services/room-service.js';
import { isOnlineAuthEnabled } from './services/auth-service.js';
import { MainMenu }        from './ui/mainMenu.js';
import { BattleMenu }      from './ui/battleMenu.js';
import {
  onOpponentAction, onHostSnapshot, onNetworkError,
  sendPlayCard, sendHostSnapshot, sendSurrender,
  getNetworkState,
} from './services/network-service.js';
import { DevConsole } from './dev-console.js';
import { TutorialController } from './tutorial/tutorial-controller.js';
import { TUTORIAL_LESSONS } from './tutorial/tutorial-data.js';

// ── Scene setup ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const { scene, camera, renderer, controls } = createScene(canvas);

const { node: resourceNode } = createMap(scene);

const towerManager  = new TowerManager(scene);
const playerEconomy = new SpiceEconomy(towerManager.getPlayerTowerState());
const enemyEconomy  = new SpiceEconomy(towerManager.getEnemyTowerState());

const factionManager = new FactionManager();
const ui             = new UI(playerEconomy, enemyEconomy, towerManager, factionManager);
const unitManager    = new UnitManager(scene, factionManager);
const deckBuilder    = new DeckBuilder();

// ── Online match state ────────────────────────────────────────────────────────

let isOnlineMatch  = false;
let onlineRole     = null;   // 'host' | 'guest'
let onlineRoomId   = null;
// localSide: which Three.js side the local player controls
// host → 'player' (bottom, z > 0), guest → 'enemy' (top, z < 0)
let localSide      = null;
let _snapshotTimer = 0;
const SNAPSHOT_INTERVAL = 1.0; // seconds between host_snapshot sends

// ── Network event handlers (register once at startup) ────────────────────────

onOpponentAction((cmd) => {
  if (!matchRunning || !isOnlineMatch) return;
  // Determine which side the opponent plays on
  const oppSide = localSide === 'player' ? 'enemy' : 'player';
  unitManager.spawn(cmd.cardId, oppSide, cmd.lane, cmd.deployPoint ?? null);

  // Approximate opponent economy deduction for display consistency
  const eco = oppSide === 'player' ? playerEconomy : enemyEconomy;
  const cost = getCardCost(cmd.cardId, eco.engineerStage);
  if (eco.canAfford(cost)) eco.spend(cost);

  // Advance opponent hand if we're tracking it (best-effort)
  const oppHand = oppSide === 'player' ? playerHand : enemyHand;
  if (oppHand && cmd.handIndex !== undefined) {
    const idx = Number(cmd.handIndex);
    if (idx >= 0 && idx < 4) oppHand.play(idx);
  }

  if (cmd.cardId === 'engineer') {
    resourceNode.material.emissive.setHex(0xcc6600);
    setTimeout(() => resourceNode.material.emissive.setHex(0x7a3800), 300);
  }
});

onHostSnapshot((snap) => {
  if (!matchRunning || !isOnlineMatch || onlineRole !== 'guest') return;

  const timeDrift = Math.abs(elapsedSeconds - snap.elapsedSeconds);
  const unitDrift = Math.abs(unitManager.units.length - snap.unitCount);

  // Hard-sync time if drift is significant (tab was hidden, etc.)
  if (timeDrift > 1.5) {
    _matchStartWallMs = Date.now() - (snap.elapsedSeconds * 1000) - _totalPausedMs;
    elapsedSeconds    = snap.elapsedSeconds;
  }

  const warn = document.getElementById('online-sync-warning');
  const severe = timeDrift > 5 || unitDrift > 4;
  if (warn) {
    warn.classList.toggle('hidden', !severe);
    if (severe) warn.textContent = '⚠ Синхронизация боя нестабильна';
  }
});

onNetworkError((err) => {
  if (err.code === 'opponent_surrendered') {
    if (matchRunning && isOnlineMatch) {
      // Opponent surrendered → local player wins
      const localWon = true; // local is always "the winner" when opponent surrenders
      showWinScreen(localSide === 'player' ? localWon : !localWon);
    }
  } else if (err.code === 'opponent_disconnected') {
    if (matchRunning && isOnlineMatch) {
      _showOnlineDisconnect();
    }
  }
});

function _showOnlineDisconnect() {
  matchRunning = false;
  let el = document.getElementById('online-disconnect-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id        = 'online-disconnect-overlay';
    el.className = 'online-disconnect-overlay';
    el.innerHTML = `
      <div class="online-disconnect-card">
        <div class="od-icon">📡</div>
        <div class="od-title">Противник отключился</div>
        <div class="od-sub">Соединение потеряно</div>
        <button id="btn-od-menu" class="od-btn">← В меню</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('btn-od-menu')?.addEventListener('click', () => {
      el.classList.add('hidden');
      onGoToMenu();
    });
  }
  el.classList.remove('hidden');
}

// ── Room screen ───────────────────────────────────────────────────────────────

// Called by RoomScreen when match_start event received from server.
function startOnlineMatch(matchData) {
  // matchData = { role, roomId, seed, hostSide, guestSide, startedAt }
  onlineRole   = matchData.role;
  onlineRoomId = matchData.roomId;
  localSide    = onlineRole === 'host' ? 'player' : 'enemy';
  isOnlineMatch = true;

  gameConfig = {
    ...gameConfig,
    mode:           'online',
    playerSide:     'bottom',
    playerFaction:  'none',
    enemyFaction:   'none',
  };

  // Show DeckBuilder for local player
  const label = onlineRole === 'host' ? 'Host — выбери колоду' : 'Guest — выбери колоду';
  deckBuilder.show(label, (deck, faction) => {
    if (localSide === 'player') {
      playerHand = new Hand(deck);
      gameConfig.playerFaction = faction;
      // Guest hand is a dummy (opponent actions drive it)
      enemyHand  = new Hand([...AI_DECK]);
      gameConfig.enemyFaction = 'none';
    } else {
      // Guest controls enemy (top) side
      enemyHand  = new Hand(deck);
      gameConfig.enemyFaction  = faction;
      playerHand = new Hand([...AI_DECK]);
      gameConfig.playerFaction = 'none';
    }
    beginMatch();
  }, () => {
    // Cancelled — go back to menu
    isOnlineMatch = false;
    onlineRole    = null;
    onlineRoomId  = null;
    localSide     = null;
    mainMenu.show();
  });
}

// Legacy local 2P startRoomMatch — kept for backward compat with old local flow
function startRoomMatch() {
  gameConfig = { ...gameConfig, mode: '2p', playerSide: 'bottom' };
  deckBuilder.show('Игрок 1 — выбери колоду', (deck1, faction1) => {
    playerHand = new Hand(deck1);
    gameConfig.playerFaction = faction1;
    deckBuilder.show('Игрок 2 — выбери колоду', (deck2, faction2) => {
      enemyHand = new Hand(deck2);
      gameConfig.enemyFaction = faction2;
      beginMatch();
    }, () => mainMenu.show());
  }, () => mainMenu.show());
}

// ── Main menu (mobile game screen) ───────────────────────────────────────────

const mainMenu = new MainMenu((preset) => {
  gameConfig = { ...gameConfig, mode: '1p', playerSide: 'bottom' };

  if (preset) {
    playerHand = new Hand([...preset.deck]);
    gameConfig.playerFaction = preset.faction;
    gameConfig.enemyFaction  = 'none';
    enemyHand  = new Hand([...AI_DECK]);
    beginMatch();
  } else {
    deckBuilder.show('Выбери свою колоду', (deck, faction, selection) => {
      playerHand = new Hand(deck);
      gameConfig.playerFaction = faction;
      gameConfig.enemyFaction  = 'none';
      enemyHand  = new Hand([...AI_DECK]);
      beginMatch();
    }, () => mainMenu.show());
  }
});

mainMenu.setDeckBuiltCallback(() => {
  deckBuilder.show('Сборка боевой колоды', (deck, faction, selection) => {
    mainMenu.saveNewPreset(faction, selection, deck);
    mainMenu.returnToPresetScreen();
  }, () => mainMenu.returnToPresetScreen(), 'СОХРАНИТЬ');
});

mainMenu.setTutorialCallback(startTutorialBattle);

const roomScreen = new RoomScreen(startOnlineMatch, () => mainMenu.show());

// ── Match state ───────────────────────────────────────────────────────────────

let elapsedSeconds    = 0;
let matchRunning      = false;
let isPaused          = false;
let _matchStartWallMs = 0;   // wall-clock ms when match started
let _totalPausedMs    = 0;   // accumulated paused time
let _pauseStartMs     = null; // wall-clock ms when current pause began
let devSpeedMult   = 1.0;
let _ratingApplied = false;
let gameConfig     = {
  mode: '1p',
  playerSide: 'bottom',
  playerFaction: 'none',
  enemyFaction:  'none',
  selectedLocationId: 'location_1',
  selectedHouseId:    'house_1',
};

let playerHand = null;
let enemyHand  = null;

let tutorialController = null;
let currentLessonId    = null;

let selectedPlayer = null;
let selectedEnemy  = null;

let _dragState     = null;  // active drag: { cardIndex, cardSide, cardId, ghostEl }
let _pendingDrag   = null;  // potential drag before move threshold
let _deployOverlay = null;  // Three.js deploy zone meshes

let aiSpawnTimer       = 0;
let aiSpawnTimerPlayer = 0;
const AI_SPAWN_INTERVAL = 6.5;

let _matchStats = null;

// ── Win screen ────────────────────────────────────────────────────────────────

const winOverlay  = document.getElementById('win-overlay');
const winCard     = document.getElementById('win-card');
const winIcon     = document.getElementById('win-icon');
const winTitle    = document.getElementById('win-title');
const winSubtitle = document.getElementById('win-subtitle');

document.getElementById('btn-win-restart').addEventListener('click', onRestartSame);
document.getElementById('btn-win-next').addEventListener('click', onRestartSame);
document.getElementById('btn-win-menu').addEventListener('click', onGoToMenu);
document.getElementById('btn-restart').addEventListener('click', onRestartSame);

function showWinScreen(bottomSideWon) {
  matchRunning = false;
  document.getElementById('win-stats').innerHTML = '';
  document.getElementById('win-rating-block').classList.add('hidden');
  document.getElementById('win-unlock-block').classList.add('hidden');

  const btnNext = document.getElementById('btn-win-next');
  if (btnNext) btnNext.classList.toggle('hidden', gameConfig.mode !== '1p');

  if (gameConfig.mode === 'online') {
    // Translate bottomSideWon into local win/lose
    // bottomSideWon = true → bottom side (player) won
    const localWon = localSide === 'player'
      ? bottomSideWon === true
      : bottomSideWon === false;

    winCard.className       = bottomSideWon === null ? 'aitest' : (localWon ? 'victory' : 'defeat');
    winIcon.textContent     = bottomSideWon === null ? '⏱' : (localWon ? '🏆' : '💀');
    winTitle.textContent    = bottomSideWon === null ? 'НИЧЬЯ' : (localWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ');
    winSubtitle.textContent = bottomSideWon === null
      ? 'Время вышло — цитадели устояли'
      : (localWon ? 'Цитадель противника уничтожена' : 'Ваша цитадель уничтожена');

  } else if (gameConfig.mode === 'ai') {
    const winner = bottomSideWon === null ? 'draw' : (bottomSideWon ? 'player' : 'enemy');
    winCard.className        = 'aitest';
    winIcon.textContent      = winner === 'draw' ? '⏱' : '📊';
    winTitle.textContent     = winner === 'draw' ? 'НИЧЬЯ' : (winner === 'player' ? 'СИНИЙ ИИ ПОБЕДИЛ' : 'КРАСНЫЙ ИИ ПОБЕДИЛ');
    winSubtitle.textContent  = winner === 'draw' ? 'Матч завершился по времени' : 'Тест баланса завершён';
    document.getElementById('win-stats').innerHTML = _buildStatsHtml(winner);
  } else if (gameConfig.mode === '2p') {
    winCard.className       = bottomSideWon === null ? 'aitest' : (bottomSideWon ? 'victory' : 'defeat');
    winIcon.textContent     = bottomSideWon === null ? '⏱' : '🏆';
    winTitle.textContent    = bottomSideWon === null ? 'НИЧЬЯ' : (bottomSideWon ? 'ИГРОК 1 ПОБЕДИЛ' : 'ИГРОК 2 ПОБЕДИЛ');
    winSubtitle.textContent = bottomSideWon === null
      ? 'Время вышло — цитадели устояли'
      : (bottomSideWon ? 'Синяя сторона уничтожила цитадель красных' : 'Красная сторона уничтожила цитадель синих');
  } else if (gameConfig.mode === 'tutorial') {
    tutorialController?.stop();
    winCard.className       = 'victory';
    winIcon.textContent     = '🎓';
    winTitle.textContent    = 'УРОК ЗАВЕРШЁН';
    winSubtitle.textContent = 'Отличная работа, командир!';
    const btnNext = document.getElementById('btn-win-next');
    if (btnNext) btnNext.classList.add('hidden');
  } else {
    winCard.className       = bottomSideWon === null ? 'aitest' : (bottomSideWon ? 'victory' : 'defeat');
    winIcon.textContent     = bottomSideWon === null ? '⏱' : (bottomSideWon ? '🏆' : '💀');
    winTitle.textContent    = bottomSideWon === null ? 'НИЧЬЯ' : (bottomSideWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ');
    winSubtitle.textContent = bottomSideWon === null
      ? 'Время вышло — цитадели устояли'
      : (bottomSideWon ? 'Цитадель противника уничтожена' : 'Ваша цитадель уничтожена');

    if (!_ratingApplied) {
      _ratingApplied = true;
      const result = addMatchResult({ mode: '1p', winner: bottomSideWon === true });
      if (result) _showRatingBlock(result);
    }
  }
  winOverlay.classList.remove('hidden');
}

function _showRatingBlock(result) {
  const block = document.getElementById('win-rating-block');
  if (!block) return;
  const sign = result.ratingDelta > 0 ? '+' : '';
  const cls  = result.ratingDelta > 0 ? 'rating-delta-pos' : (result.ratingDelta < 0 ? 'rating-delta-neg' : 'rating-delta-zero');
  block.innerHTML = `
    <div class="rating-delta ${cls}">${sign}${result.ratingDelta} рейтинга</div>
    <div class="rating-total">Рейтинг: ${result.newRating} · Уровень: ${result.newLevel}</div>
  `;
  block.classList.remove('hidden');
  if (result.newlyUnlocked.length > 0) {
    const ub = document.getElementById('win-unlock-block');
    if (ub) {
      ub.innerHTML = `<div class="win-unlock-title">ОТКРЫТО</div>` +
        result.newlyUnlocked.map(u => `<div class="win-unlock-item">✦ ${u.name}</div>`).join('');
      ub.classList.remove('hidden');
    }
  }
}

function _buildStatsHtml(winner) {
  if (!_matchStats) return '';
  const fmt = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const t    = elapsedSeconds;
  const pLost = _matchStats.towersLost.player;
  const eLost = _matchStats.towersLost.enemy;

  const towerLine = (label, losses) => {
    if (losses.length === 0) return `<div class="stat-row stat-good">${label}: все башни целы</div>`;
    const detail = losses.map(l =>
      `<span class="stat-tower-name">${l.name}</span> <span class="stat-time">${fmt(l.time)}</span>`
    ).join(', ');
    return `<div class="stat-row">${label}: потерял ${detail}</div>`;
  };

  const recs = [];
  if (winner === 'draw') {
    recs.push('Ничья по времени — башни слишком прочные или урон юнитов по зданиям мал');
  } else {
    if (t < 90)       recs.push(`Победа за ${fmt(t)} — слишком быстро`);
    else if (t < 165) recs.push(`Темп матча хороший (${fmt(t)}) — в целевом диапазоне`);
    else              recs.push(`Матч затянулся (${fmt(t)}). Башни возможно слишком прочные`);
  }
  const loserLosses = winner === 'player' ? eLost : (winner === 'enemy' ? pLost : []);
  if (loserLosses.length > 0) {
    const citadel = loserLosses.find(l => l.name === 'Цитадель');
    const sides   = loserLosses.filter(l => l.name !== 'Цитадель');
    if (citadel && sides.length === 0) recs.push('Цитадель пала без потери боковых башен — центральная линия уязвима');
    else if (citadel) recs.push('Прогрессия нормальная: боковые башни → цитадель');
    else recs.push('Боковые башни снесены, но цитадель устояла');
  }
  const winnerLosses = winner === 'player' ? pLost : (winner === 'enemy' ? eLost : []);
  if (winner !== 'draw' && winnerLosses.length === 0)
    recs.push('Победитель не потерял ни одной башни — проведи 3–5 прогонов для проверки баланса');

  return `
    <div class="stats-panel">
      <div class="stats-row-group">
        <span class="stats-label">Время:</span><span class="stats-val">${fmt(t)}</span>
        <span class="stats-sep">|</span>
        <span class="stats-label">Синий:</span><span class="stats-val">${_matchStats.spawns.player} юн.</span>
        <span class="stats-sep">|</span>
        <span class="stats-label">Красный:</span><span class="stats-val">${_matchStats.spawns.enemy} юн.</span>
      </div>
      <div class="stats-towers">${towerLine('Синий ИИ', pLost)}${towerLine('Красный ИИ', eLost)}</div>
      <div class="stats-recs-label">Рекомендации</div>
      <div class="stats-recs">${recs.map(r => `<div class="stat-rec">• ${r}</div>`).join('')}</div>
    </div>`;
}

const _TOWER_NAMES = {
  player_left: 'Левая', player_citadel: 'Цитадель', player_right: 'Правая',
  enemy_left:  'Левая', enemy_citadel:  'Цитадель', enemy_right:  'Правая',
};

function onTowerDestroyed(towerId) {
  if (_matchStats) {
    const side = towerId.startsWith('player') ? 'player' : 'enemy';
    _matchStats.towersLost[side].push({ name: _TOWER_NAMES[towerId], time: elapsedSeconds });
  }
  if (towerId === 'enemy_citadel')  showWinScreen(true);
  if (towerId === 'player_citadel') showWinScreen(false);
}

// ── Game flow ─────────────────────────────────────────────────────────────────

const gameMenu = new GameMenu(config => {
  gameConfig = { ...gameConfig, ...config };
  gameMenu.hide();

  if (config.mode === '2p') {
    deckBuilder.show('Игрок 1 — выбери колоду', (deck1, faction1) => {
      playerHand = new Hand(deck1);
      gameConfig.playerFaction = faction1;
      deckBuilder.show('Игрок 2 — выбери колоду', (deck2, faction2) => {
        enemyHand = new Hand(deck2);
        gameConfig.enemyFaction = faction2;
        beginMatch();
      }, () => mainMenu.show());
    }, () => mainMenu.show());
  } else if (config.mode === 'ai') {
    gameConfig.playerFaction = 'none';
    gameConfig.enemyFaction  = 'none';
    playerHand = new Hand([...AI_DECK]);
    enemyHand  = new Hand([...AI_DECK]);
    beginMatch();
  } else {
    deckBuilder.show('Выбери свою колоду', (deck, faction) => {
      playerHand = new Hand(deck);
      gameConfig.playerFaction = faction;
      gameConfig.enemyFaction  = 'none';
      enemyHand  = new Hand([...AI_DECK]);
      beginMatch();
    }, () => mainMenu.show());
  }
});

// ── Pause / resume ────────────────────────────────────────────────

function pauseBattle() {
  if (!matchRunning || isPaused) return;
  isPaused = true;
  _pauseStartMs = Date.now();
}

function resumeBattle() {
  if (!isPaused) return;
  isPaused = false;
  if (_pauseStartMs !== null) {
    _totalPausedMs += Date.now() - _pauseStartMs;
    _pauseStartMs = null;
  }
}

// ── Battle menu ───────────────────────────────────────────────────

const battleMenu = new BattleMenu({
  pauseGame:      pauseBattle,
  resumeGame:     resumeBattle,
  onSurrender:    () => {
    if (isOnlineMatch && onlineRoomId) sendSurrender(onlineRoomId);
    showWinScreen(false);
  },
  onExitToMenu:   onGoToMenu,
  getMode:        () => (gameConfig.mode === '2p' || gameConfig.mode === 'online') ? 'pvp' : 'bot',
  isMatchRunning: () => matchRunning,
});

// ── Dev console ───────────────────────────────────────────────────────────────

const devConsole = new DevConsole({
  onQuickAI: () => {
    mainMenu.hide();
    winOverlay.classList.add('hidden');
    document.getElementById('win-rating-block')?.classList.add('hidden');
    document.getElementById('win-unlock-block')?.classList.add('hidden');
    isOnlineMatch = false;
    gameConfig = { ...gameConfig, mode: 'ai', playerFaction: 'none', enemyFaction: 'none' };
    playerHand = new Hand([...AI_DECK]);
    enemyHand  = new Hand([...AI_DECK]);
    beginMatch();
  },
  onQuickVsAI: () => {
    mainMenu.hide();
    winOverlay.classList.add('hidden');
    document.getElementById('win-rating-block')?.classList.add('hidden');
    document.getElementById('win-unlock-block')?.classList.add('hidden');
    isOnlineMatch = false;
    gameConfig = { ...gameConfig, mode: '1p', playerFaction: 'none', enemyFaction: 'none' };
    playerHand = new Hand([...AI_DECK]);
    enemyHand  = new Hand([...AI_DECK]);
    beginMatch();
  },
  on2P: () => {
    mainMenu.hide();
    winOverlay.classList.add('hidden');
    document.getElementById('win-rating-block')?.classList.add('hidden');
    document.getElementById('win-unlock-block')?.classList.add('hidden');
    isOnlineMatch = false;
    gameConfig = { ...gameConfig, mode: '2p', playerFaction: 'none', enemyFaction: 'none' };
    playerHand = new Hand([...AI_DECK]);
    enemyHand  = new Hand([...AI_DECK]);
    beginMatch();
  },
  onSpawnUnit: (cardId, side, lane) => {
    if (!matchRunning) return;
    const deployZ = _getDefaultDeployZ(cardId, side);
    unitManager.spawn(cardId, side, lane, { x: LANE_X[lane], z: deployZ });
  },
  onPause:    pauseBattle,
  onResume:   resumeBattle,
  onStop:     onGoToMenu,
  onSetSpeed: (mult) => { devSpeedMult = mult; },
  getState:   () => ({
    matchRunning,
    isPaused,
    mode:      gameConfig.mode,
    elapsed:   elapsedSeconds,
    unitCount: unitManager.units.length,
  }),
});

// ── Online menu buttons ───────────────────────────────────────────────────────

// Новые кнопки в MainMenu (уникальные IDs, не дублируют старый GameMenu)
mainMenu.setOnlineCallbacks(
  () => { mainMenu.hide(); roomScreen.show(null); },
  () => {
    const code = prompt('Введи код комнаты (6 символов):');
    if (code?.trim()) { mainMenu.hide(); roomScreen.show(code.trim().toUpperCase()); }
  }
);

// Старые кнопки в GameMenu (hub) — оставляем для совместимости
document.getElementById('btn-online-create')?.addEventListener('click', () => {
  mainMenu.hide();
  roomScreen.show(null);
});

document.getElementById('btn-online-join')?.addEventListener('click', () => {
  const code = prompt('Введи код комнаты (6 символов):');
  if (code?.trim()) {
    mainMenu.hide();
    roomScreen.show(code.trim().toUpperCase());
  }
});

document.getElementById('btn-online-auth')?.addEventListener('click', () => {
  if (!isOnlineAuthEnabled()) {
    document.getElementById('online-auth-notice')?.classList.toggle('hidden');
  }
});

// ── Browser routing ───────────────────────────────────────────────────────────

window.addEventListener('popstate', () => {
  const rid = parseRoomIdFromUrl();
  if (rid) {
    roomScreen.show(rid);
  } else {
    roomScreen.hideQuiet();
    mainMenu.show();
  }
});

const _startRoomId = parseRoomIdFromUrl();
if (_startRoomId) {
  roomScreen.show(_startRoomId);
} else if (new URLSearchParams(location.search).get('ai') !== null) {
  // ?ai — auto-start AI vs AI for visual testing
  gameConfig = { ...gameConfig, mode: 'ai', playerFaction: 'none', enemyFaction: 'none' };
  playerHand = new Hand([...AI_DECK]);
  enemyHand  = new Hand([...AI_DECK]);
  beginMatch();
} else {
  mainMenu.show();
}

function startTutorialBattle(lessonId) {
  const lesson = TUTORIAL_LESSONS.find(l => l.id === lessonId);
  if (!lesson) return;

  currentLessonId = lessonId;
  tutorialController?.stop();
  tutorialController = null;

  mainMenu.hide();
  winOverlay.classList.add('hidden');
  document.getElementById('win-rating-block')?.classList.add('hidden');
  document.getElementById('win-unlock-block')?.classList.add('hidden');
  isOnlineMatch = false;

  gameConfig = {
    ...gameConfig,
    mode:          'tutorial',
    playerSide:    'bottom',
    playerFaction: 'none',
    enemyFaction:  'none',
  };

  playerHand = new Hand(lesson.playerDeck ? [...lesson.playerDeck] : [...AI_DECK]);
  enemyHand  = new Hand([...AI_DECK]);

  tutorialController = new TutorialController({
    spawnUnit:        (cardId, side, lane, deployPoint) => unitManager.spawn(cardId, side, lane, deployPoint),
    spendEnemy:       (cost)   => enemyEconomy.spend(cost),
    playEnemyHand:    (cardId) => { const idx = enemyHand.cards.indexOf(cardId); if (idx >= 0) enemyHand.play(idx); },
    getEnemyEconomy:  ()       => enemyEconomy,
    getPlayerEconomy: ()       => playerEconomy,
    pauseGame:        pauseBattle,
    resumeGame:       resumeBattle,
    onLessonComplete: (_id) => { showWinScreen(true); },
  });

  beginMatch();
  tutorialController.start(lessonId);
}

function beginMatch() {
  elapsedSeconds        = 0;
  matchRunning          = true;
  _ratingApplied        = false;
  selectedPlayer        = null;
  selectedEnemy         = null;
  aiSpawnTimer          = 0;
  aiSpawnTimerPlayer    = 0;
  _snapshotTimer        = 0;
  isPaused              = false;
  _matchStartWallMs     = Date.now();
  _totalPausedMs        = 0;
  _pauseStartMs         = null;

  battleMenu.forceClose();
  document.getElementById('ui-overlay')?.classList.remove('ui-hidden');

  // Hide sync warning
  const syncWarn = document.getElementById('online-sync-warning');
  if (syncWarn) syncWarn.classList.add('hidden');

  const locLabel = document.getElementById('match-location-label');
  if (locLabel) {
    const tier = PROGRESSION.find(t => t.locationId === gameConfig.selectedLocationId);
    locLabel.textContent = tier?.locationName ?? '';
  }
  _matchStats = gameConfig.mode === 'ai'
    ? { spawns: { player: 0, enemy: 0 }, towersLost: { player: [], enemy: [] } }
    : null;

  factionManager.reset();
  factionManager.setFaction('player', gameConfig.playerFaction ?? 'none');
  factionManager.setFaction('enemy',  gameConfig.enemyFaction  ?? 'none');

  playerEconomy.reset();
  enemyEconomy.reset();
  towerManager.resetAll();
  unitManager.reset();
  playerHand.reset();
  enemyHand.reset();

  towerManager.applyFactionColors('player', gameConfig.playerFaction ?? 'none');
  towerManager.applyFactionColors('enemy',  gameConfig.enemyFaction  ?? 'none');
  console.log('[beginMatch] mode:', gameConfig.mode, '| localSide:', localSide);

  battleMenu.setTutorialMode(gameConfig.mode === 'tutorial');
  ui.configure(gameConfig);
  document.body.classList.toggle('mode-2p', gameConfig.mode === '2p' || gameConfig.mode === 'online');
  document.body.classList.toggle('mode-ai', gameConfig.mode === 'ai');

  const playerPanel = document.getElementById('player-panel');
  const enemyPanel  = document.getElementById('enemy-panel');
  if (playerPanel) playerPanel.classList.toggle('honor-faction', gameConfig.playerFaction === 'honor');
  if (enemyPanel)  enemyPanel.classList.toggle('honor-faction',  gameConfig.enemyFaction  === 'honor');

  // In online mode, always show both hand panels
  const enemyHandPanel = document.getElementById('enemy-hand-panel');
  if (enemyHandPanel) {
    enemyHandPanel.classList.toggle('hidden', gameConfig.mode !== '2p' && gameConfig.mode !== 'online');
  }

  renderHandUI('player', playerHand);
  renderHandUI('enemy', enemyHand);
}

function onRestartSame() {
  if (isOnlineMatch) {
    // Don't restart online matches — go back to menu
    winOverlay.classList.add('hidden');
    onGoToMenu();
    return;
  }
  winOverlay.classList.add('hidden');
  document.getElementById('win-rating-block')?.classList.add('hidden');
  document.getElementById('win-unlock-block')?.classList.add('hidden');
  playerHand.reset();
  enemyHand.reset();
  beginMatch();
}

function onGoToMenu() {
  tutorialController?.stop();
  tutorialController = null;
  currentLessonId    = null;
  matchRunning  = false;
  isPaused      = false;
  isOnlineMatch = false;
  onlineRole    = null;
  onlineRoomId  = null;
  localSide     = null;

  battleMenu.forceClose();
  winOverlay.classList.add('hidden');
  document.getElementById('win-rating-block')?.classList.add('hidden');
  document.getElementById('win-unlock-block')?.classList.add('hidden');
  document.getElementById('ui-overlay')?.classList.add('ui-hidden');
  document.getElementById('online-disconnect-overlay')?.classList.add('hidden');
  playerEconomy.reset();
  enemyEconomy.reset();
  towerManager.resetAll();
  unitManager.reset();
  elapsedSeconds    = 0;
  _matchStartWallMs = 0;
  _totalPausedMs    = 0;
  _pauseStartMs     = null;
  document.body.classList.remove('mode-2p');
  document.body.classList.remove('mode-ai');
  document.getElementById('player-panel')?.classList.remove('honor-faction');
  document.getElementById('enemy-panel')?.classList.remove('honor-faction');
  history.pushState(null, '', '/');
  mainMenu.show();
}

// ── Card hand UI ──────────────────────────────────────────────────────────────

function renderHandUI(prefix, hand) {
  if (!hand) return;
  const cards = hand.cards;
  for (let i = 0; i < 4; i++) {
    const cardId  = cards[i];
    const def     = CARD_DEFS[cardId];
    const economy = prefix === 'player' ? playerEconomy : enemyEconomy;
    const cost    = getCardCost(cardId, economy.engineerStage);
    const playable = canPlayCard(cardId, economy, elapsedSeconds);

    const slot = document.getElementById(`${prefix}-card-${i}`);
    if (!slot) continue;

    slot.dataset.index = i;
    slot.querySelector('.ch-icon').textContent         = CARD_ICONS[cardId];
    slot.querySelector('.ch-icon').style.background    = CARD_COLORS[cardId];
    slot.querySelector('.ch-name').textContent         = def.name;
    slot.querySelector('.ch-cost').textContent         = cost;

    // In online mode, opponent's hand is display-only (always "unplayable" visually)
    const isLocalPrefix = _isLocalControlPrefix(prefix);
    const isSelected = prefix === 'player' ? selectedPlayer === i : selectedEnemy === i;

    slot.classList.toggle('selected',   isSelected);
    slot.classList.toggle('unplayable', (!playable || !isLocalPrefix) && !isSelected);

    const timerEl = slot.querySelector('.ch-timer');
    if (timerEl) {
      if (cardId === 'engineer' && economy.engineerStage < 3 && isLocalPrefix) {
        const minTime = ENGINEER_MIN_TIMES[economy.engineerStage];
        if (elapsedSeconds < minTime) {
          const waitSec = Math.ceil(minTime - elapsedSeconds);
          const mm = Math.floor(waitSec / 60), ss = waitSec % 60;
          timerEl.textContent = `⏳ ${mm > 0 ? mm + ':' + String(ss).padStart(2, '0') : ss + 'с'}`;
        } else {
          timerEl.textContent = '';
        }
      } else {
        timerEl.textContent = '';
      }
    }
  }

  const nextId = hand.nextCard;
  const nextEl = document.getElementById(`${prefix}-card-next`);
  if (nextEl && nextId) {
    nextEl.querySelector('.ch-icon').textContent       = CARD_ICONS[nextId];
    nextEl.querySelector('.ch-icon').style.background  = CARD_COLORS[nextId];
  }

  const hasSelection = prefix === 'player' ? selectedPlayer !== null : selectedEnemy !== null;
  ['left', 'center', 'right'].forEach(lane => {
    const btn = document.getElementById(`btn-${prefix}-lane-${lane}`);
    if (btn) btn.disabled = !hasSelection || !matchRunning || !_isLocalControlPrefix(prefix);
  });
}

// Returns true if the given prefix is controllable by the local player.
function _isLocalControlPrefix(prefix) {
  if (!isOnlineMatch) return true;
  // host controls 'player' (bottom); guest controls 'enemy' (top)
  return (localSide === 'player' && prefix === 'player') ||
         (localSide === 'enemy'  && prefix === 'enemy');
}

// ── Card clicks & drag-and-drop ────────────────────────────────────────────────

function bindHandClicks(prefix) {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`${prefix}-card-${i}`);
    if (!slot) continue;
    // pointerdown starts drag or click (distinguished by move distance in global handlers)
    slot.addEventListener('pointerdown', (e) => {
      if (!matchRunning || !_isLocalControlPrefix(prefix)) return;
      const economy = prefix === 'player' ? playerEconomy : enemyEconomy;
      const hand    = prefix === 'player' ? playerHand    : enemyHand;
      const cardId  = hand.cards[i];
      if (!canPlayCard(cardId, economy, elapsedSeconds)) return;
      e.preventDefault();
      _pendingDrag = {
        cardIndex: i,
        cardSide:  prefix,
        cardId,
        startX:    e.clientX,
        startY:    e.clientY,
        moved:     false,
      };
    });
  }

  // Lane buttons: fallback click-to-deploy with default deploy Z
  ['left', 'center', 'right'].forEach(lane => {
    const btn = document.getElementById(`btn-${prefix}-lane-${lane}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const idx = prefix === 'player' ? selectedPlayer : selectedEnemy;
      if (idx === null || !matchRunning) return;
      if (!_isLocalControlPrefix(prefix)) return;
      const hand   = prefix === 'player' ? playerHand : enemyHand;
      const cardId = hand.cards[idx];
      const deployZ = _getDefaultDeployZ(cardId, prefix);
      _executeCardPlay(idx, prefix, cardId, lane, { x: LANE_X[lane], z: deployZ });
    });
  });
}

bindHandClicks('player');
bindHandClicks('enemy');

_initDeployOverlay();

// ── Keyboard shortcuts ────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (matchRunning) battleMenu.handleEscape();
  } else if ((e.key === 'p' || e.key === 'P') && matchRunning && gameConfig.mode !== '2p' && gameConfig.mode !== 'online') {
    if (!battleMenu.isOpen) {
      if (isPaused) resumeBattle();
      else          pauseBattle();
    }
  }
});

// ── Deploy zone & drag-and-drop ──────────────────────────────────────────────

const DEPLOY_ZONES = {
  player: {
    own_half: { zMin: 1.0,   zMax: 13.5 },
    backline: { zMin: 8.0,   zMax: 13.5 },
  },
  enemy: {
    own_half: { zMin: -13.5, zMax: -1.0  },
    backline: { zMin: -13.5, zMax: -8.0  },
  },
};

const DEFAULT_DEPLOY_Z = {
  player: { own_half: 4.0,  backline: 10.5 },
  enemy:  { own_half: -4.0, backline: -10.5 },
};

function _snapToLane(x) {
  const dists = { left: Math.abs(x + 6), center: Math.abs(x), right: Math.abs(x - 6) };
  return Object.keys(dists).reduce((a, b) => dists[a] < dists[b] ? a : b);
}

function isDeployPointAllowed(cardId, side, lane, z) {
  const def = CARD_DEFS[cardId];
  if (!def?.deployRules) return true;
  const rules = def.deployRules;
  if (!rules.allowedLanes.includes(lane)) return false;
  const zone = DEPLOY_ZONES[side]?.[rules.placementType];
  if (!zone) return false;
  return z >= zone.zMin && z <= zone.zMax;
}

function _getDefaultDeployZ(cardId, side) {
  const rules = CARD_DEFS[cardId]?.deployRules;
  if (!rules) return side === 'player' ? 14.5 : -14.5;
  return DEFAULT_DEPLOY_Z[side][rules.placementType] ?? (side === 'player' ? 14.5 : -14.5);
}

function _getAiDeployPoint(cardId, side) {
  const rules        = CARD_DEFS[cardId]?.deployRules;
  const allowedLanes = rules?.allowedLanes ?? ['left', 'center', 'right'];
  const lane         = allowedLanes[Math.floor(Math.random() * allowedLanes.length)];
  const z            = _getDefaultDeployZ(cardId, side);
  return { lane, deployPoint: { x: LANE_X[lane], z } };
}

function _getWorldPosFromPointer(e) {
  if (!_deployOverlay?.groundPlane) return null;
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
  const py = -((e.clientY - rect.top)  / rect.height) *  2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(px, py), camera);
  const hits = raycaster.intersectObject(_deployOverlay.groundPlane);
  return hits.length > 0 ? hits[0].point : null;
}

function _initDeployOverlay() {
  const groundGeo  = new THREE.PlaneGeometry(60, 60);
  const groundMat  = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = 0;
  scene.add(groundPlane);

  const zoneGeo = new THREE.PlaneGeometry(1, 1);
  const zoneMat = new THREE.MeshBasicMaterial({
    color: 0x44ff88, transparent: true, opacity: 0.13,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
  zoneMesh.rotation.x = -Math.PI / 2;
  zoneMesh.position.y = 0.05;
  zoneMesh.visible    = false;
  scene.add(zoneMesh);

  const markerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16);
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0x44ff88, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const markerMesh = new THREE.Mesh(markerGeo, markerMat);
  markerMesh.position.y = 0.08;
  markerMesh.visible    = false;
  scene.add(markerMesh);

  const ringGeo = new THREE.RingGeometry(0.55, 0.70, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd700, transparent: true, opacity: 0.85,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.09;
  ringMesh.visible    = false;
  scene.add(ringMesh);

  _deployOverlay = { groundPlane, zoneMesh, zoneMat, markerMesh, markerMat, ringMesh };
}

function _showDeployZone(cardId, side) {
  if (!_deployOverlay) return;
  const { zoneMesh, zoneMat } = _deployOverlay;
  const rules = CARD_DEFS[cardId]?.deployRules;
  if (!rules) { zoneMesh.visible = false; return; }

  zoneMat.color.setHex(0x44ff88);
  const isPlayer = side === 'player';
  if (rules.placementType === 'own_half') {
    zoneMesh.position.set(0, 0.05, isPlayer ? 7.25 : -7.25);
    zoneMesh.scale.set(14, 12.5, 1);
  } else {
    zoneMesh.position.set(0, 0.05, isPlayer ? 10.75 : -10.75);
    zoneMesh.scale.set(14, 5.5, 1);
  }
  zoneMesh.visible = true;
}

function _hideDeployZone() {
  if (!_deployOverlay) return;
  _deployOverlay.zoneMesh.visible   = false;
  _deployOverlay.markerMesh.visible = false;
  _deployOverlay.ringMesh.visible   = false;
}

function _updateGhostPos(ghostEl, clientX, clientY) {
  ghostEl.style.left = clientX + 'px';
  ghostEl.style.top  = clientY + 'px';
}

function _startCardDrag(cardIndex, cardSide, cardId, e) {
  const ghostEl = document.createElement('div');
  ghostEl.className = 'deploy-ghost';
  ghostEl.innerHTML = `<div class="dg-icon" style="background:${CARD_COLORS[cardId] ?? '#333'}">${CARD_ICONS[cardId] ?? '?'}</div><div class="dg-name">${CARD_DEFS[cardId].name}</div>`;
  document.body.appendChild(ghostEl);
  _updateGhostPos(ghostEl, e.clientX, e.clientY);
  _dragState = { cardIndex, cardSide, cardId, ghostEl };
  _showDeployZone(cardId, cardSide);
  document.body.style.cursor = 'grabbing';
}

function _updateDrag(e) {
  if (!_dragState || !_deployOverlay) return;
  _updateGhostPos(_dragState.ghostEl, e.clientX, e.clientY);

  const worldPos = _getWorldPosFromPointer(e);
  if (!worldPos) {
    _deployOverlay.markerMesh.visible = false;
    _deployOverlay.ringMesh.visible   = false;
    return;
  }

  const lane  = _snapToLane(worldPos.x);
  const laneX = LANE_X[lane];
  const rules = CARD_DEFS[_dragState.cardId]?.deployRules;

  let clampedZ = worldPos.z;
  if (rules) {
    const zone = DEPLOY_ZONES[_dragState.cardSide]?.[rules.placementType];
    if (zone) clampedZ = Math.max(zone.zMin, Math.min(zone.zMax, worldPos.z));
  }

  const valid = isDeployPointAllowed(_dragState.cardId, _dragState.cardSide, lane, worldPos.z);
  _deployOverlay.markerMat.color.setHex(valid ? 0x44ff88 : 0xff4444);
  _deployOverlay.markerMesh.position.set(laneX, 0.08, clampedZ);
  _deployOverlay.markerMesh.visible = true;
  _deployOverlay.ringMesh.position.set(laneX, 0.09, clampedZ);
  _deployOverlay.ringMesh.visible = true;
}

function _endDrag(e) {
  if (!_dragState) return;
  const { cardIndex, cardSide, cardId, ghostEl } = _dragState;
  ghostEl.remove();
  document.body.style.cursor = '';
  _hideDeployZone();
  _dragState = null;

  const worldPos = _getWorldPosFromPointer(e);
  if (worldPos && matchRunning) {
    const lane  = _snapToLane(worldPos.x);
    const valid = isDeployPointAllowed(cardId, cardSide, lane, worldPos.z);
    if (valid) {
      _executeCardPlay(cardIndex, cardSide, cardId, lane, { x: LANE_X[lane], z: worldPos.z });
      return;
    }
  }

  if (cardSide === 'player') selectedPlayer = null;
  else                       selectedEnemy  = null;
  renderHandUI('player', playerHand);
  renderHandUI('enemy',  enemyHand);
}

function _executeCardPlay(handIdx, side, cardId, lane, deployPoint) {
  const hand    = side === 'player' ? playerHand    : enemyHand;
  const economy = side === 'player' ? playerEconomy : enemyEconomy;
  if (!canPlayCard(cardId, economy, elapsedSeconds)) return;
  const cost = getCardCost(cardId, economy.engineerStage);

  if (isOnlineMatch && onlineRoomId) {
    sendPlayCard({
      roomId:     onlineRoomId,
      side,
      cardId,
      handIndex:  handIdx,
      lane,
      deployPoint,
      clientSeq:  Date.now(),
      clientTime: elapsedSeconds,
    });
  }

  economy.spend(cost);
  hand.play(handIdx);
  unitManager.spawn(cardId, side, lane, deployPoint);

  if (side === 'player' && gameConfig.mode === 'tutorial' && tutorialController) {
    tutorialController.onCardPlayed(cardId, lane);
  }

  if (side === 'player') selectedPlayer = null;
  else                   selectedEnemy  = null;
  renderHandUI('player', playerHand);
  renderHandUI('enemy',  enemyHand);

  if (cardId === 'engineer') {
    resourceNode.material.emissive.setHex(0xcc6600);
    setTimeout(() => resourceNode.material.emissive.setHex(0x7a3800), 300);
  }
}

// Global drag pointer handlers (registered once at module startup)
document.addEventListener('pointermove', (e) => {
  if (_pendingDrag && !_pendingDrag.moved) {
    const dx = e.clientX - _pendingDrag.startX;
    const dy = e.clientY - _pendingDrag.startY;
    if (Math.sqrt(dx * dx + dy * dy) > 6) {
      _pendingDrag.moved = true;
      _startCardDrag(_pendingDrag.cardIndex, _pendingDrag.cardSide, _pendingDrag.cardId, e);
    }
  } else if (_dragState) {
    _updateDrag(e);
  }
});

document.addEventListener('pointerup', (e) => {
  if (_dragState) {
    _endDrag(e);
    _pendingDrag = null;
    return;
  }
  if (_pendingDrag) {
    const { cardIndex, cardSide } = _pendingDrag;
    _pendingDrag = null;
    if (matchRunning && _isLocalControlPrefix(cardSide)) {
      const economy  = cardSide === 'player' ? playerEconomy : enemyEconomy;
      const hand     = cardSide === 'player' ? playerHand    : enemyHand;
      const cId      = hand.cards[cardIndex];
      const playable = canPlayCard(cId, economy, elapsedSeconds);
      if (cardSide === 'player') {
        selectedPlayer = (selectedPlayer === cardIndex) ? null : (playable ? cardIndex : null);
        selectedEnemy  = null;
      } else {
        selectedEnemy  = (selectedEnemy === cardIndex) ? null : (playable ? cardIndex : null);
        selectedPlayer = null;
      }
      renderHandUI('player', playerHand);
      renderHandUI('enemy',  enemyHand);
    }
  }
});

// ── Raycasting (tower hover cursor) ──────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

canvas.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * -2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(towerManager.hitTargets);
  canvas.classList.toggle('hovering-tower', hits.length > 0);
});

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTimestamp = null;

function animate(timestamp) {
  requestAnimationFrame(animate);

  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
    renderer.render(scene, camera);
    return;
  }

  const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1) * devSpeedMult;
  lastTimestamp = timestamp;

  resourceNode.rotation.y += delta * 0.7;
  resourceNode.position.y  = 1.6 + Math.sin(timestamp * 0.001) * 0.15;

  if (matchRunning && !isPaused) {
    elapsedSeconds = (Date.now() - _matchStartWallMs - _totalPausedMs) / 1000;

    if (elapsedSeconds >= CONFIG.matchDurationSeconds) {
      showWinScreen(null);
    }

    if (matchRunning) {
      playerEconomy.tick(delta);
      enemyEconomy.tick(delta);

      unitManager.update(
        delta,
        towerManager,
        towerId => onTowerDestroyed(towerId),
        side    => {
          const eco = side === 'player' ? playerEconomy : enemyEconomy;
          eco.activateEngineerStage();
          resourceNode.material.emissive.setHex(0x00cc44);
          setTimeout(() => resourceNode.material.emissive.setHex(0x7a3800), 600);
        }
      );

      if (gameConfig.mode === 'tutorial' && tutorialController) {
        tutorialController.update(delta, {
          elapsed:       elapsedSeconds,
          unitManager,
          towerManager,
          playerEconomy,
          enemyEconomy,
        });
      }

      factionManager.update(delta);

      for (const side of ['player', 'enemy']) {
        const isActive  = factionManager.shieldActive[side];
        const isVisible = towerManager.isShieldVisualActive(side);
        if (isActive && !isVisible)  towerManager.activateShieldVisual(side);
        else if (!isActive && isVisible) towerManager.deactivateShieldVisual(side);
      }

      // AI — only in non-online modes
      const _tutorialUsesNormalAI = gameConfig.mode === 'tutorial' &&
        TUTORIAL_LESSONS.find(l => l.id === currentLessonId)?.useNormalAI;
      if (!isOnlineMatch) {
        if (gameConfig.mode === '1p' || gameConfig.mode === 'ai' || _tutorialUsesNormalAI) {
          aiSpawnTimer += delta;
          if (aiSpawnTimer >= AI_SPAWN_INTERVAL) {
            aiSpawnTimer = 0;
            const aiCard = pickAiCardForSide('enemy');
            if (aiCard) {
              const { lane, deployPoint } = _getAiDeployPoint(aiCard, 'enemy');
              const cost  = getCardCost(aiCard, enemyEconomy.engineerStage);
              enemyEconomy.spend(cost);
              enemyHand.play(enemyHand.cards.indexOf(aiCard));
              unitManager.spawn(aiCard, 'enemy', lane, deployPoint);
              if (_matchStats) _matchStats.spawns.enemy++;
            }
          }
        }

        if (gameConfig.mode === 'ai') {
          aiSpawnTimerPlayer += delta;
          if (aiSpawnTimerPlayer >= AI_SPAWN_INTERVAL) {
            aiSpawnTimerPlayer = 0;
            const aiCard = pickAiCardForSide('player');
            if (aiCard) {
              const { lane, deployPoint } = _getAiDeployPoint(aiCard, 'player');
              const cost  = getCardCost(aiCard, playerEconomy.engineerStage);
              playerEconomy.spend(cost);
              playerHand.play(playerHand.cards.indexOf(aiCard));
              unitManager.spawn(aiCard, 'player', lane, deployPoint);
              if (_matchStats) _matchStats.spawns.player++;
            }
          }
        }
      }

      // Host snapshot — send once per second
      if (isOnlineMatch && onlineRole === 'host' && onlineRoomId) {
        _snapshotTimer += delta;
        if (_snapshotTimer >= SNAPSHOT_INTERVAL) {
          _snapshotTimer = 0;
          sendHostSnapshot({
            roomId:         onlineRoomId,
            elapsedSeconds,
            unitCount:      unitManager.units.length,
            playerHp:       Object.fromEntries(
              Object.entries(towerManager.towers).filter(([k]) => k.startsWith('player')).map(([k, t]) => [k, t.hp])
            ),
            enemyHp:        Object.fromEntries(
              Object.entries(towerManager.towers).filter(([k]) => k.startsWith('enemy')).map(([k, t]) => [k, t.hp])
            ),
            playerSpices:   playerEconomy.spices,
            enemySpices:    enemyEconomy.spices,
          });
        }
      }

      // Refresh hand display
      if (gameConfig.mode !== 'ai') renderHandUI('player', playerHand);
      if (gameConfig.mode === '2p' || gameConfig.mode === 'online') renderHandUI('enemy', enemyHand);
    }
  }

  towerManager.updateShieldPulse(timestamp);
  ui.update(elapsedSeconds, matchRunning, factionManager);
  devConsole.update();
  controls.update();
  renderer.render(scene, camera);
}

function pickAiCardForSide(side) {
  const hand = side === 'player' ? playerHand : enemyHand;
  const eco  = side === 'player' ? playerEconomy : enemyEconomy;
  if (!hand) return null;
  const affordable = hand.cards.filter(id => canPlayCard(id, eco, elapsedSeconds));
  if (affordable.length === 0) return null;
  return affordable[Math.floor(Math.random() * affordable.length)];
}

requestAnimationFrame(animate);
