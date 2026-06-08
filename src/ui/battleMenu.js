import './battleMenu.css';
import { loadBattleSettings, saveBattleSettings } from './battleMenuState.js';

/**
 * Внутриигровое меню боя.
 *
 * Callbacks (все обязательные):
 *   pauseGame()     — поставить бой на паузу
 *   resumeGame()    — снять паузу
 *   onSurrender()   — завершить бой поражением
 *   onExitToMenu()  — вернуться в главное меню
 *   getMode()       — () => 'bot' | 'pvp'
 *   isMatchRunning()— () => boolean
 */
export class BattleMenu {
  constructor({ pauseGame, resumeGame, onSurrender, onExitToMenu, getMode, isMatchRunning }) {
    this._pauseGame      = pauseGame;
    this._resumeGame     = resumeGame;
    this._onSurrender    = onSurrender;
    this._onExitToMenu   = onExitToMenu;
    this._getMode        = getMode;
    this._isMatchRunning = isMatchRunning;

    this._settings    = loadBattleSettings();
    this._isOpen      = false;
    this._view        = 'main';   // 'main' | 'settings' | 'confirm'
    this._confirmType = null;     // 'exit' | 'surrender'

    this._bindElements();
    this._bindEvents();
    this._applySettings();
  }

  // ── Public API ───────────────────────────────────────────

  get isOpen() { return this._isOpen; }

  open() {
    if (this._isOpen || !this._isMatchRunning()) return;
    this._isOpen = true;

    if (this._getMode() !== 'pvp') this._pauseGame();

    this._showView('main');
    this._updateStatus();

    // Убрать hidden → затем добавить bm-visible для анимации
    this._overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this._overlay.classList.add('bm-visible'));
    });

    setTimeout(() => this._btnContinue?.focus(), 120);
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    if (this._getMode() !== 'pvp') this._resumeGame();

    this._overlay.classList.remove('bm-visible');
    const handler = () => {
      if (!this._isOpen) this._overlay.classList.add('hidden');
    };
    this._overlay.addEventListener('transitionend', handler, { once: true });

    document.getElementById('btn-battle-menu')?.focus();
  }

  toggle() {
    if (this._isOpen) this.close();
    else this.open();
  }

  /** Закрыть без resume — вызывается из onExitToMenu/onSurrender пути */
  forceClose() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._overlay.classList.remove('bm-visible');
    this._overlay.classList.add('hidden');
  }

  /**
   * Обработка Escape с учётом текущего состояния:
   *   - подтверждение открыто → назад к main
   *   - меню открыто → закрыть (= продолжить бой)
   *   - меню закрыто → открыть
   */
  handleEscape() {
    if (this._view === 'confirm') {
      this._showView('main');
    } else if (this._view === 'settings') {
      this._showView('main');
    } else if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  // ── DOM ─────────────────────────────────────────────────

  _bindElements() {
    this._overlay         = document.getElementById('battle-menu-overlay');
    this._statusEl        = document.getElementById('bm-status');

    this._mainView        = document.getElementById('bm-main-view');
    this._settingsView    = document.getElementById('bm-settings-view');
    this._confirmView     = document.getElementById('bm-confirm-view');

    this._btnContinue     = document.getElementById('bm-btn-continue');
    this._confirmTitle    = document.getElementById('bm-confirm-title');
    this._confirmText     = document.getElementById('bm-confirm-text');
    this._confirmActionBtn= document.getElementById('bm-confirm-action');
  }

  _bindEvents() {
    // Кнопка открытия меню (в timer-bar)
    document.getElementById('btn-battle-menu')
      ?.addEventListener('click', () => this.toggle());

    // Задник — клик = продолжить
    document.getElementById('bm-backdrop')
      ?.addEventListener('click', () => this.close());

    // Продолжить
    this._btnContinue
      ?.addEventListener('click', () => this.close());

    // Настройки
    document.getElementById('bm-btn-settings')
      ?.addEventListener('click', () => this._showView('settings'));

    // Сдаться
    document.getElementById('bm-btn-surrender')
      ?.addEventListener('click', () => this._showConfirm('surrender'));

    // Главное меню
    document.getElementById('bm-btn-exit')
      ?.addEventListener('click', () => this._showConfirm('exit'));

    // Назад из настроек
    document.getElementById('bm-settings-back')
      ?.addEventListener('click', () => this._showView('main'));

    // Отмена подтверждения
    document.getElementById('bm-confirm-cancel')
      ?.addEventListener('click', () => this._showView('main'));

    // Подтвердить действие
    this._confirmActionBtn
      ?.addEventListener('click', () => this._executeConfirm());

    // Переключатели ВКЛ/ВЫКЛ
    for (const key of ['sound', 'music', 'vibration']) {
      document.getElementById(`bm-${key}-toggle`)
        ?.addEventListener('click', () => {
          this._settings[key] = !this._settings[key];
          this._applySettings();
          saveBattleSettings(this._settings);
        });
    }

    // Качество графики — event delegation
    this._overlay?.addEventListener('click', e => {
      const btn = e.target.closest('[data-quality]');
      if (!btn) return;
      this._settings.graphicsQuality = btn.dataset.quality;
      this._applySettings();
      saveBattleSettings(this._settings);
    });
  }

  // ── Переключение view ────────────────────────────────────

  _showView(view) {
    this._view = view;
    this._mainView    ?.classList.toggle('hidden', view !== 'main');
    this._settingsView?.classList.toggle('hidden', view !== 'settings');
    this._confirmView ?.classList.toggle('hidden', view !== 'confirm');

    if (view === 'main') {
      setTimeout(() => this._btnContinue?.focus(), 50);
    } else if (view === 'settings') {
      setTimeout(() => document.getElementById('bm-settings-back')?.focus(), 50);
    } else if (view === 'confirm') {
      setTimeout(() => document.getElementById('bm-confirm-cancel')?.focus(), 50);
    }
  }

  _showConfirm(type) {
    this._confirmType = type;
    if (type === 'exit') {
      this._confirmTitle.textContent = 'Выйти из боя?';
      this._confirmText.textContent  = 'Текущий бой будет завершён. Прогресс матча не сохранится.';
      this._confirmActionBtn.textContent = 'Выйти';
    } else if (this._isTutorial) {
      this._confirmTitle.textContent     = 'Завершить урок?';
      this._confirmText.textContent      = 'Урок будет закрыт без сохранения прогресса.';
      this._confirmActionBtn.textContent = 'Завершить';
    } else {
      this._confirmTitle.textContent = 'Сдаться?';
      this._confirmText.textContent  = 'Вы завершите бой поражением.';
      this._confirmActionBtn.textContent = 'Сдаться';
    }
    this._showView('confirm');
  }

  _executeConfirm() {
    const type = this._confirmType;
    this.forceClose();

    if (type === 'exit') {
      this._resumeGame();    // сброс isPaused перед очисткой
      this._onExitToMenu();
    } else {
      this._resumeGame();    // матч продолжится на один тик, затем остановится
      this._onSurrender();
    }
  }

  setTutorialMode(isTutorial) {
    this._isTutorial = isTutorial;
    const btn = document.getElementById('bm-btn-surrender');
    if (btn) btn.textContent = isTutorial ? 'Завершить урок' : 'Сдаться';
  }

  // ── Статус ───────────────────────────────────────────────

  _updateStatus() {
    if (!this._statusEl) return;
    if (this._getMode() === 'pvp') {
      this._statusEl.textContent = '● Онлайн-бой продолжается';
      this._statusEl.className   = 'bm-status bm-status-pvp';
    } else {
      this._statusEl.textContent = '⏸ Пауза';
      this._statusEl.className   = 'bm-status bm-status-paused';
    }
  }

  // ── Настройки ────────────────────────────────────────────

  _applySettings() {
    const s = this._settings;

    for (const key of ['sound', 'music', 'vibration']) {
      const btn = document.getElementById(`bm-${key}-toggle`);
      if (!btn) continue;
      btn.textContent = s[key] ? 'ВКЛ' : 'ВЫКЛ';
      btn.classList.toggle('bm-toggle-on',  s[key]);
      btn.classList.toggle('bm-toggle-off', !s[key]);
      btn.setAttribute('aria-pressed', String(s[key]));
    }

    this._overlay?.querySelectorAll('[data-quality]').forEach(btn => {
      btn.classList.toggle('bm-quality-active', btn.dataset.quality === s.graphicsQuality);
    });
  }
}
