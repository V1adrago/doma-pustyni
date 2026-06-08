import { TutorialBattleHint } from './tutorial-overlay.js';
import { TUTORIAL_LESSONS }   from './tutorial-data.js';
import { markLessonDone }     from './tutorial-service.js';
import { LANE_X }             from '../units.js';
import { CARD_DEFS, getCardCost } from '../cards.js';

/**
 * TutorialController — управляет учебным боем.
 *
 * Конструктор принимает объект callbacks:
 *   spawnUnit(cardId, side, lane, deployPoint) — спавнит юнита
 *   spendEnemy(cost)                           — тратит специи врага
 *   playEnemyHand(cardId)                      — продвигает руку врага
 *   getEnemyEconomy()                          — возвращает SpiceEconomy врага
 *   pauseGame()                                — ставит бой на паузу
 *   resumeGame()                               — снимает паузу
 *   onLessonComplete(lessonId)                 — вызывается по завершению урока
 */
export class TutorialController {
  constructor(callbacks) {
    this._cb       = callbacks;
    this._hint     = new TutorialBattleHint();
    this._lesson   = null;
    this._active   = false;
    this._elapsed  = 0;

    // Scripted bot state
    this._botQueue   = [];   // pending bot spawns sorted by time
    this._botIdx     = 0;

    // Step state
    this._stepQueue  = [];
    this._stepIdx    = 0;
    this._shownSteps = new Set();

    // Event hints (guided_match)
    this._shownEvents = new Set();
    this._hintCooldown = 0; // seconds, prevent hint spam

    // Card highlights
    this._highlightedCards = [];
  }

  start(lessonId) {
    const lesson = TUTORIAL_LESSONS.find(l => l.id === lessonId);
    if (!lesson) return;
    this._lesson  = lesson;
    this._active  = true;
    this._elapsed = 0;
    this._botIdx  = 0;
    this._stepIdx = 0;
    this._shownSteps.clear();
    this._shownEvents.clear();
    this._hintCooldown = 0;

    // Sort bot script by time
    this._botQueue = [...(lesson.botScript ?? [])].sort((a, b) => a.time - b.time);

    // Show first step if at time=0 and pauseOnShow
    this._checkSteps(0);
  }

  stop() {
    this._active = false;
    this._hint.hide();
    this._clearHighlights();
  }

  /**
   * Вызывается каждый тик из game loop.
   * state = { elapsed, unitManager, towerManager, playerEconomy, enemyEconomy }
   */
  update(delta, state) {
    if (!this._active) return;
    this._elapsed = state.elapsed;

    if (this._hintCooldown > 0) this._hintCooldown -= delta;

    // Run scripted bot
    if (!this._lesson.useNormalAI) {
      this._runBotScript(state);
    }

    // Check step triggers
    this._checkSteps(state.elapsed);

    // Check event hints (guided_match)
    if (this._lesson.eventHints) {
      this._checkEventHints(state);
    }

    // Check completion
    this._checkCompletion(state);
  }

  /** Вызывается из main.js когда игрок сыграл карту */
  onCardPlayed(cardId, lane) {
    if (!this._active) return;
    this._clearHighlights();
  }

  /** Вызывается из main.js когда враг сыграл карту */
  onEnemyCardPlayed(cardId) {
    if (!this._active || !this._lesson.eventHints) return;
    this._fireEventHint('enemyPlayed', cardId);
  }

  // ── Bot script ─────────────────────────────────────────────────────────────

  _runBotScript(state) {
    while (this._botIdx < this._botQueue.length) {
      const spawn = this._botQueue[this._botIdx];
      if (state.elapsed < spawn.time) break;
      this._botIdx++;

      const eco = this._cb.getEnemyEconomy();
      const cost = getCardCost(spawn.cardId, eco.engineerStage ?? 0);
      const deployZ = spawn.cardId === 'engineer' ? -10.5 : -4.0;
      const laneX   = LANE_X[spawn.lane] ?? 0;

      if (eco.canAfford(cost)) {
        this._cb.spendEnemy(cost);
        this._cb.playEnemyHand(spawn.cardId);
        this._cb.spawnUnit(spawn.cardId, 'enemy', spawn.lane, { x: laneX, z: deployZ });
        this.onEnemyCardPlayed(spawn.cardId);
      }
    }
  }

  // ── Step hints ──────────────────────────────────────────────────────────────

  _checkSteps(elapsed) {
    const steps = this._lesson.steps ?? [];
    steps.forEach((step, i) => {
      if (this._shownSteps.has(i)) return;
      if (elapsed < (step.time ?? 0)) return;

      this._shownSteps.add(i);
      this._showStep(step);
    });
  }

  _showStep(step) {
    if (step.pauseOnShow) this._cb.pauseGame();

    this._hint.show({
      title:      step.title || 'Наставник',
      text:       step.text  || '',
      pauseMode:  !!step.pauseOnShow,
      onDismiss:  step.pauseOnShow ? () => this._cb.resumeGame() : null,
    });

    if (step.highlightCards) this._setHighlights(step.highlightCards);
    if (step.highlightHand)  this._highlightFullHand(true);
  }

  // ── Event hints (guided_match) ──────────────────────────────────────────────

  _checkEventHints(state) {
    const hints = this._lesson.eventHints ?? [];

    // playerBankFull
    const eco = state.playerEconomy;
    if (eco && eco.spices >= eco.bankMax && !this._shownEvents.has('playerBankFull') && this._hintCooldown <= 0) {
      this._shownEvents.add('playerBankFull');
      this._fireStaticHint(hints, 'playerBankFull');
    }

    // enemyTowerExposed: противник потерял боковую башню и нет его юнитов на линии
    const tm = state.towerManager;
    if (tm) {
      const leftDead  = !tm.isTowerAlive?.('enemy_left');
      const rightDead = !tm.isTowerAlive?.('enemy_right');
      if ((leftDead || rightDead) && !this._shownEvents.has('enemyTowerExposed') && this._hintCooldown <= 0) {
        this._shownEvents.add('enemyTowerExposed');
        this._fireStaticHint(hints, 'enemyTowerExposed');
      }

      // playerTowerUnderAttack
      const playerLeftHp   = tm.towers?.player_left?.hp   ?? 1300;
      const playerRightHp  = tm.towers?.player_right?.hp  ?? 1300;
      const playerCitHp    = tm.towers?.player_citadel?.hp ?? 2200;
      if ((playerLeftHp < 900 || playerRightHp < 900 || playerCitHp < 1600)
          && !this._shownEvents.has('playerTowerUnderAttack') && this._hintCooldown <= 0) {
        this._shownEvents.add('playerTowerUnderAttack');
        this._fireStaticHint(hints, 'playerTowerUnderAttack');
      }
    }
  }

  _fireEventHint(event, cardId) {
    if (this._hintCooldown > 0) return;
    const hints = this._lesson.eventHints ?? [];
    const key   = `${event}:${cardId}`;
    if (this._shownEvents.has(key)) return;

    const match = hints.find(h => h.event === event && h.cardId === cardId);
    if (!match) return;
    this._shownEvents.add(key);
    this._hint.show({ title: 'Наставник', text: match.text, autoDismissMs: 7000 });
    this._hintCooldown = 8;
  }

  _fireStaticHint(hints, event) {
    const match = hints.find(h => h.event === event);
    if (!match) return;
    this._hint.show({ title: 'Наставник', text: match.text, autoDismissMs: 7000 });
    this._hintCooldown = 8;
  }

  // ── Card highlights ─────────────────────────────────────────────────────────

  _setHighlights(cardIds) {
    this._clearHighlights();
    this._highlightedCards = cardIds;

    const slots = document.querySelectorAll('#player-hand-panel .hand-card[id^="player-card-"]');
    slots.forEach(slot => {
      const nameEl  = slot.querySelector('.ch-name');
      const cardName = nameEl?.textContent?.trim() || '';

      const matchId = cardIds.some(id => {
        const def = CARD_DEFS[id];
        return def && (def.name === cardName || slot.id === `player-card-${id}`);
      });

      // Use icon bg color to match
      const iconEl  = slot.querySelector('.ch-icon');
      const matchByColor = cardIds.some(id => {
        const def = CARD_DEFS[id];
        return def && slot.querySelector('.ch-name')?.textContent === def.name;
      });

      if (matchByColor) {
        slot.classList.add('tut-highlight');
        let badge = slot.querySelector('.tut-hint-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'tut-hint-badge';
          badge.textContent = 'Совет';
          slot.appendChild(badge);
        }
      }
    });
  }

  _highlightFullHand(on) {
    const slots = document.querySelectorAll('#player-hand-panel .hand-card[id^="player-card-"]');
    slots.forEach(slot => {
      if (on) slot.classList.add('tut-highlight');
      else    slot.classList.remove('tut-highlight');
    });
  }

  _clearHighlights() {
    this._highlightedCards = [];
    document.querySelectorAll('.hand-card.tut-highlight').forEach(el => {
      el.classList.remove('tut-highlight');
      el.querySelector('.tut-hint-badge')?.remove();
    });
  }

  // ── Completion ──────────────────────────────────────────────────────────────

  _checkCompletion(state) {
    const cond = this._lesson.completionCondition;
    if (!cond) return;
    if (cond.type === 'timedOut' && state.elapsed >= cond.seconds) {
      this._complete();
    }
    // matchEnd is handled by showWinScreen in main.js
  }

  _complete() {
    if (!this._active) return;
    this._active = false;
    this._clearHighlights();
    this._hint.hide();
    markLessonDone(this._lesson.id);
    this._cb.onLessonComplete(this._lesson.id);
  }
}
