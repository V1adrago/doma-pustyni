import { TutorialBattleHint } from './tutorial-overlay.js';
import { TUTORIAL_LESSONS }   from './tutorial-data.js';
import { markLessonDone }     from './tutorial-service.js';
import { LANE_X }             from '../units.js';
import { CARD_DEFS, getCardCost } from '../cards.js';

export class TutorialController {
  constructor(callbacks) {
    this._cb       = callbacks;
    this._hint     = new TutorialBattleHint();
    this._lesson   = null;
    this._active   = false;
    this._elapsed  = 0;

    // Bot script
    this._botQueue = [];
    this._botIdx   = 0;

    // Sequential step state
    this._steps          = [];
    this._stepIdx        = 0;
    this._awaitingStep   = false; // хинт открыт, ждём нажатия
    this._awaitingAction = false; // ждём сыгранной карты

    // Event hints (lesson_3)
    this._shownEvents  = new Set();
    this._hintCooldown = 0;

    this._highlightedCards = [];
  }

  start(lessonId) {
    const lesson = TUTORIAL_LESSONS.find(l => l.id === lessonId);
    if (!lesson) return;
    this._lesson         = lesson;
    this._active         = true;
    this._elapsed        = 0;
    this._botIdx         = 0;
    this._stepIdx        = 0;
    this._awaitingStep   = false;
    this._awaitingAction = false;
    this._shownEvents.clear();
    this._hintCooldown   = 0;

    this._steps    = [...(lesson.steps ?? [])];
    this._botQueue = [...(lesson.botScript ?? [])].sort((a, b) => a.time - b.time);

    this._showNextStep();
  }

  stop() {
    this._active = false;
    this._hint.hide();
    this._clearHighlights();
  }

  update(delta, state) {
    if (!this._active) return;
    this._elapsed = state.elapsed;

    if (this._hintCooldown > 0) this._hintCooldown -= delta;

    if (!this._lesson.useNormalAI) {
      this._runBotScript(state);
    }

    if (this._lesson.eventHints) {
      this._checkEventHints(state);
    }

    this._checkCompletion(state);
  }

  /** Вызывается из main.js когда игрок сыграл карту */
  onCardPlayed(cardId, lane) {
    if (!this._active) return;
    if (this._awaitingAction) {
      this._awaitingAction = false;
      this._clearHighlights();
      this._stepIdx++;
      this._showNextStep();
    } else {
      this._clearHighlights();
    }
  }

  // ── Step flow ────────────────────────────────────────────────────────────────

  _showNextStep() {
    if (this._stepIdx >= this._steps.length) return;
    this._showStep(this._steps[this._stepIdx]);
  }

  _showStep(step) {
    this._awaitingStep = true;
    this._cb.pauseGame();

    if (step.highlightCards) this._setHighlights(step.highlightCards);
    if (step.highlightHand)  this._highlightFullHand(true);

    const hasAction = !!step.requireCardPlay;

    this._hint.show({
      title:      step.title || 'Наставник',
      text:       step.text  || '',
      pauseMode:  !hasAction,
      actionMode: hasAction,
      onDismiss: () => {
        this._awaitingStep = false;
        if (hasAction) {
          // Снимаем паузу, ждём карту — выделение карт остаётся
          this._awaitingAction = true;
          this._cb.resumeGame();
          // Страховка: если у игрока нет специй — дать на одну карту
          this._topUpIfNeeded(step.highlightCards);
        } else {
          // Сразу следующий шаг (игра остаётся на паузе между шагами)
          this._stepIdx++;
          this._showNextStep();
          // Если шаги закончились — снимаем паузу
          if (this._stepIdx >= this._steps.length) {
            this._cb.resumeGame();
          }
        }
      },
    });
  }

  // ── Spice top-up ─────────────────────────────────────────────────────────────

  _topUpIfNeeded(cardIds) {
    if (!cardIds?.length) return;
    const eco = this._cb.getPlayerEconomy?.();
    if (!eco) return;
    const minCost = Math.min(...cardIds.map(id => getCardCost(id, eco.engineerStage ?? 0)));
    if (!eco.canAfford(minCost)) {
      eco.spices = Math.min(minCost, eco.spiceBank);
    }
  }

  // ── Bot script ───────────────────────────────────────────────────────────────

  _runBotScript(state) {
    while (this._botIdx < this._botQueue.length) {
      const spawn = this._botQueue[this._botIdx];
      if (state.elapsed < spawn.time) break;
      this._botIdx++;

      const eco     = this._cb.getEnemyEconomy();
      const cost    = getCardCost(spawn.cardId, eco.engineerStage ?? 0);
      const deployZ = spawn.cardId === 'engineer' ? -10.5 : -4.0;
      const laneX   = LANE_X[spawn.lane] ?? 0;

      if (eco.canAfford(cost)) {
        this._cb.spendEnemy(cost);
        this._cb.playEnemyHand(spawn.cardId);
        this._cb.spawnUnit(spawn.cardId, 'enemy', spawn.lane, { x: laneX, z: deployZ });
      }
    }
  }

  // ── Event hints (lesson_3) ────────────────────────────────────────────────────

  _checkEventHints(state) {
    const hints = this._lesson.eventHints ?? [];

    const eco = state.playerEconomy;
    if (eco && eco.spices >= eco.bankMax && !this._shownEvents.has('playerBankFull') && this._hintCooldown <= 0) {
      this._shownEvents.add('playerBankFull');
      this._fireStaticHint(hints, 'playerBankFull');
    }

    const tm = state.towerManager;
    if (tm) {
      const leftDead  = !tm.isTowerAlive?.('enemy_left');
      const rightDead = !tm.isTowerAlive?.('enemy_right');
      if ((leftDead || rightDead) && !this._shownEvents.has('enemyTowerExposed') && this._hintCooldown <= 0) {
        this._shownEvents.add('enemyTowerExposed');
        this._fireStaticHint(hints, 'enemyTowerExposed');
      }

      const playerLeftHp  = tm.towers?.player_left?.hp  ?? 1300;
      const playerRightHp = tm.towers?.player_right?.hp ?? 1300;
      const playerCitHp   = tm.towers?.player_citadel?.hp ?? 2200;
      if ((playerLeftHp < 900 || playerRightHp < 900 || playerCitHp < 1600)
          && !this._shownEvents.has('playerTowerUnderAttack') && this._hintCooldown <= 0) {
        this._shownEvents.add('playerTowerUnderAttack');
        this._fireStaticHint(hints, 'playerTowerUnderAttack');
      }
    }
  }

  _fireStaticHint(hints, event) {
    const match = hints.find(h => h.event === event);
    if (!match) return;
    this._hint.show({ title: 'Наставник', text: match.text, autoDismissMs: 7000 });
    this._hintCooldown = 8;
  }

  // ── Card highlights ──────────────────────────────────────────────────────────

  _setHighlights(cardIds) {
    this._clearHighlights();
    this._highlightedCards = cardIds;
    const slots = document.querySelectorAll('#player-hand-panel .hand-card[id^="player-card-"]');
    slots.forEach(slot => {
      const matchByName = cardIds.some(id => {
        const def = CARD_DEFS[id];
        return def && slot.querySelector('.ch-name')?.textContent === def.name;
      });
      if (matchByName) {
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

  // ── Completion ───────────────────────────────────────────────────────────────

  _checkCompletion(state) {
    const cond = this._lesson.completionCondition;
    if (!cond) return;
    if (cond.type === 'timedOut' && state.elapsed >= cond.seconds) {
      this._complete();
    }
    // matchEnd обрабатывается в showWinScreen в main.js
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
