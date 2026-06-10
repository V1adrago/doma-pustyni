import './mainMenu.css';
import { menuState, syncFactionStates } from './menuState.js';
import { loadProfile, saveProfile, rollHouse, getAvailableRouletteHouses } from '../services/profile-service.js';
import { loadWallet } from '../services/wallet-service.js';
import { MarketPage } from './marketPage.js';
import { PROGRESSION, HOUSES } from '../config/progression.js';
import {
  loadPresets, createPreset, updatePreset, deletePreset, MAX_PRESETS,
} from '../services/preset-service.js';
import { TutorialOverlay } from '../tutorial/tutorial-overlay.js';
import { MENU_TOUR_STEPS, TUTORIAL_LESSONS, UNIT_GUIDE, UNIT_CATEGORY_LABELS, getUnitStats } from '../tutorial/tutorial-data.js';
import { isMenuTourDone, markMenuTourDone, isLessonDone } from '../tutorial/tutorial-service.js';
import { CARD_DEFS, CARD_ICONS, CARD_COLORS } from '../cards.js';

export class MainMenu {
  constructor(onStartBattle) {
    this._onStartBattle    = onStartBattle;
    this._el               = document.getElementById('main-menu');
    this._modal            = document.getElementById('mm-modal');
    this._modalTitle       = document.getElementById('mm-modal-title');
    this._modalContent     = document.getElementById('mm-modal-content');
    this._activePresetId   = null;
    this._onDeckBuilt      = null;
    this._onStartTutorial  = null;
    this._menuTourOverlay  = new TutorialOverlay();
    this._currentPage      = 0;
    this._marketPage       = null;
    this._render();
    this._bindEvents();
    this._bindPresetScreenEvents();
    this._bindTutorialEvents();
    this._bindBottomNav();
  }

  /** Устанавливается из main.js: fn(lessonId) */
  setTutorialCallback(fn) { this._onStartTutorial = fn; }

  // onStartBattle(preset | null) — preset = объект или null (тогда DeckBuilder)
  show() {
    this._syncProfile();
    this._el.classList.remove('hidden');
    this._updateTutorialBadge();
    this._checkPendingLevelModal();
  }

  hide() {
    this._el.classList.add('hidden');
  }

  setDeckBuiltCallback(fn) { this._onDeckBuilt = fn; }

  /* ── Синхронизация профиля ──────────────────────────────── */

  _syncProfile() {
    const p = loadProfile();
    const w = loadWallet();
    menuState.player.level        = p.level;
    menuState.rating.value        = p.rating;
    menuState.resources.waterRings = w.waterRings;
    menuState.resources.spices     = w.metaSpices || 0;

    const currTier = PROGRESSION.find(t => t.level === p.level) ?? PROGRESSION[0];
    const nextTier = PROGRESSION.find(t => t.level === p.level + 1);

    if (nextTier) {
      menuState.player.xp    = p.rating - currTier.minRating;
      menuState.player.xpMax = nextTier.minRating - currTier.minRating;
      menuState.rating.nextLevelNeed = Math.max(0, nextTier.minRating - p.rating);
    } else {
      menuState.player.xp    = currTier.minRating;
      menuState.player.xpMax = currTier.minRating || 1;
      menuState.rating.nextLevelNeed = 0;
    }

    syncFactionStates(p);
    this._render();
  }

  /* ── Модалка открытия уровня ────────────────────────────── */

  _checkPendingLevelModal() {
    const p = loadProfile();
    if (p.pendingLevelUnlockModal === 2) {
      p.pendingLevelUnlockModal = null;
      saveProfile(p);
      // Показываем с небольшой задержкой чтобы меню успело отрисоваться
      setTimeout(() => {
        this.openModal(
          'Открыт уровень 2: Соляные разломы',
          'Новая карта доступна. На ней появляются бури специй.\nОни ускоряют инженеров и мешают дальним бойцам.\n\nВ рулетку добавлен новый дом: Пустынные Кланы.\nПервый прокрут — бесплатно.'
        );
      }, 300);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  _render() {
    const s      = menuState;
    const xpPct  = s.player.xpMax > 0
      ? Math.round((s.player.xp / s.player.xpMax) * 100)
      : 100;

    this._q('#mm-level').textContent        = s.player.level;
    this._q('#mm-player-name').textContent  = s.player.name;
    this._q('#mm-player-house').textContent = s.player.house;
    this._q('#mm-xp-fill').style.width      = xpPct + '%';

    const nextLvl = s.player.level < 5
      ? `${s.player.xp} / ${s.player.xpMax} до ур.${s.player.level + 1}`
      : `Рейтинг: ${s.rating.value}`;
    this._q('#mm-xp-text').textContent = nextLvl;

    this._q('#mm-spices-value').textContent      = s.resources.spices.toLocaleString('ru-RU');
    this._q('#mm-water-rings-value').textContent = s.resources.waterRings.toLocaleString('ru-RU');

    const loc = s.location;
    this._q('#mm-location-name').textContent  = loc.name.toUpperCase();
    this._q('#mm-location-level').textContent = `Уровень ${loc.level}`;

    const ratingEl = this._q('#mm-rating-value');
    if (ratingEl) ratingEl.textContent = s.rating.value.toLocaleString('ru-RU');

    this._renderFactions(s.factions);
    this._renderRouletteBtn();
  }

  _renderFactions(factions) {
    const row = this._q('#mm-factions-row');
    row.innerHTML = '';
    factions.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'mm-faction-card ' + this._factionCardClass(f.state);
      btn.dataset.factionId = f.id;

      const ariaLabel = {
        active:            `Выбрана фракция ${f.name}`,
        owned:             `Фракция ${f.name} — нажми чтобы выбрать`,
        roulette_available:`Фракция ${f.name} — доступна в рулетке`,
        locked:            `Фракция ${f.name} — открывается на уровне ${f.unlockLevel}`,
      }[f.state] ?? f.name;
      btn.setAttribute('aria-label', ariaLabel);

      switch (f.state) {
        case 'active':
          btn.innerHTML = `
            <svg class="mm-card-art" viewBox="0 0 280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <use href="${f.id === 'desert_clans' ? '#mm-card-desert-art' : '#mm-card-honor-art'}"/>
            </svg>
            <span class="mm-faction-glow"></span>
            <span class="mm-faction-check">✓</span>
            <span class="mm-faction-name">${this._factionLabel(f)}</span>`;
          break;
        case 'owned':
          btn.innerHTML = `
            <svg class="mm-card-art" viewBox="0 0 280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <use href="${f.id === 'desert_clans' ? '#mm-card-desert-art' : '#mm-card-honor-art'}"/>
            </svg>
            <span class="mm-faction-name">${this._factionLabel(f)}</span>`;
          break;
        case 'roulette_available':
          btn.innerHTML = `
            <svg class="mm-card-art" viewBox="0 0 280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <use href="#mm-card-roulette-art"/>
            </svg>
            <span class="mm-roulette-badge">🎰</span>
            <span class="mm-faction-name">${f.nameShort}</span>`;
          break;
        default: // locked
          btn.innerHTML = `
            <svg class="mm-card-art" viewBox="0 0 280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <use href="#mm-card-locked-art"/>
            </svg>
            <span class="mm-lock-badge">
              <span class="mm-lock-shackle"></span>
              <span class="mm-lock-body"></span>
            </span>
            <span class="mm-faction-name">${f.nameShort}</span>`;
      }

      row.appendChild(btn);
    });
  }

  _factionCardClass(state) {
    return {
      active:            'mm-faction-active',
      owned:             'mm-faction-owned',
      roulette_available:'mm-faction-roulette',
      locked:            'mm-faction-locked',
    }[state] ?? 'mm-faction-locked';
  }

  _factionLabel(f) {
    if (f.id === 'honor')        return 'ДОМ<br>ЧЕСТИ';
    if (f.id === 'desert_clans') return 'ПУСТЫННЫЕ<br>КЛАНЫ';
    return f.nameShort;
  }

  /* ── Кнопка рулетки ────────────────────────────────────── */

  _renderRouletteBtn() {
    const p = loadProfile();
    const available = getAvailableRouletteHouses(p);
    let btn = this._q('#mm-roulette-btn');

    // Показываем кнопку если есть незаполученные дома в рулетке
    const show = available.length > 0 || p.freeRouletteRolls > 0;

    if (!btn) {
      // Кнопка ещё не создана — добавим после строки фракций
      const factionsRow = this._q('#mm-factions-row');
      if (!factionsRow) return;
      btn = document.createElement('button');
      btn.id        = 'mm-roulette-btn';
      btn.className = 'mm-roulette-open-btn';
      btn.addEventListener('click', () => this._openRoulette());
      factionsRow.parentNode.insertBefore(btn, factionsRow.nextSibling);
    }

    btn.classList.toggle('hidden', !show);
    const rolls = p.freeRouletteRolls;
    btn.textContent = rolls > 0
      ? `Рулетка домов · ${rolls} бесплатн.`
      : 'Рулетка домов';
  }

  _openRoulette() {
    const p = loadProfile();
    const available = getAvailableRouletteHouses(p);

    if (p.freeRouletteRolls <= 0) {
      this.openModal('Рулетка домов', 'Бесплатных прокрутов нет.\n\nЗарабатывай бесплатные прокруты, открывая новые уровни.');
      return;
    }

    if (available.length === 0) {
      this.openModal('Рулетка домов', 'Все доступные дома уже получены!');
      return;
    }

    const result = rollHouse(p);

    if (result.type === 'house') {
      const houseDef = HOUSES.find(h => h.id === result.houseId);
      const houseName = houseDef?.name ?? result.houseId;
      this._syncProfile();
      this.openModal(
        `Получен новый дом: ${houseName}`,
        'Навыки дома доступны бесплатно.\nТеперь дом можно подключить в коллекции домов.'
      );
    } else if (result.type === 'no_free_rolls') {
      this.openModal('Рулетка домов', 'Бесплатных прокрутов нет.');
    } else {
      this.openModal('Рулетка домов', 'Все доступные дома уже получены!');
    }
  }

  /* ── Preset Screen ──────────────────────────────────────── */

  _openPresetScreen() {
    document.getElementById('preset-screen').classList.remove('hidden');
    this._renderPresetScreen();
  }

  _closePresetScreen() {
    document.getElementById('preset-screen').classList.add('hidden');
  }

  // Вызывается из main.js после сборки/сохранения колоды — возврат на экран пресетов
  returnToPresetScreen() {
    this._openPresetScreen();
  }

  _renderPresetScreen() {
    const list    = document.getElementById('ps-list');
    if (!list) return;
    const presets = loadPresets();
    list.innerHTML = '';

    if (presets.length === 0) {
      list.innerHTML = `<div class="ps-empty">Нет боевых колод.<br>Нажми «＋ Создать колоду» чтобы собрать первую.</div>`;
    } else {
      if (this._activePresetId && !presets.find(p => p.id === this._activePresetId)) {
        this._activePresetId = null;
      }
      presets.forEach(preset => {
        const isActive     = preset.id === this._activePresetId;
        const factionLabel = preset.faction === 'honor'
          ? '⛨ Дом Чести'
          : preset.faction === 'desert_clans'
            ? '🏜 Пустынные Кланы'
            : 'Без фракции';
        const cardCount    = preset.deck?.length ?? 0;

        const card = document.createElement('div');
        card.className = 'ps-card' + (isActive ? ' ps-card-active' : '');
        card.dataset.presetId = preset.id;
        card.innerHTML = `
          <div class="ps-card-check">${isActive ? '✓' : ''}</div>
          <div class="ps-card-info">
            <div class="ps-card-name">${this._escHtml(preset.name)}</div>
            <div class="ps-card-meta">${factionLabel} · ${cardCount} карт</div>
          </div>
          <div class="ps-card-btns">
            <button class="ps-card-btn ps-card-btn-rename" data-preset-id="${preset.id}" aria-label="Переименовать">✏</button>
            <button class="ps-card-btn ps-card-btn-del"    data-preset-id="${preset.id}" aria-label="Удалить">✕</button>
          </div>`;
        list.appendChild(card);
      });
    }

    const fightBtn  = document.getElementById('ps-btn-fight');
    const createBtn = document.getElementById('ps-btn-create');
    if (fightBtn)  fightBtn.disabled = !this._activePresetId;
    if (createBtn) createBtn.style.display = presets.length >= MAX_PRESETS ? 'none' : '';
  }

  _bindPresetScreenEvents() {
    const screen = document.getElementById('preset-screen');
    if (!screen) return;

    // Назад
    screen.querySelector('#ps-back-btn')?.addEventListener('click', () => {
      this._closePresetScreen();
      this.show();
    });

    // К БОЮ
    screen.querySelector('#ps-btn-fight')?.addEventListener('click', () => {
      const presets = loadPresets();
      const preset  = presets.find(p => p.id === this._activePresetId) ?? null;
      if (!preset) return;
      this._closePresetScreen();
      this._onStartBattle(preset);
    });

    // Создать колоду
    screen.querySelector('#ps-btn-create')?.addEventListener('click', () => {
      if (loadPresets().length >= MAX_PRESETS) return;
      this._closePresetScreen();
      if (this._onDeckBuilt) this._onDeckBuilt();
    });

    // Делегирование: выбор, rename, delete
    document.getElementById('ps-list')?.addEventListener('click', e => {
      const renameBtn = e.target.closest('.ps-card-btn-rename');
      const deleteBtn = e.target.closest('.ps-card-btn-del');
      const card      = e.target.closest('.ps-card');

      if (renameBtn) { e.stopPropagation(); this._renamePreset(renameBtn.dataset.presetId); return; }
      if (deleteBtn) { e.stopPropagation(); this._deletePreset(deleteBtn.dataset.presetId); return; }
      if (card)      { this._togglePreset(card.dataset.presetId); }
    });
  }

  _togglePreset(id) {
    this._activePresetId = (this._activePresetId === id) ? null : id;
    this._renderPresetScreen();
  }

  _renamePreset(id) {
    const preset = loadPresets().find(p => p.id === id);
    if (!preset) return;
    const newName = prompt('Новое название колоды:', preset.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    updatePreset(id, { name: trimmed });
    this._renderPresetScreen();
  }

  _deletePreset(id) {
    const preset = loadPresets().find(p => p.id === id);
    if (!preset) return;
    if (!confirm(`Удалить колоду «${preset.name}»?`)) return;
    deletePreset(id);
    if (this._activePresetId === id) this._activePresetId = null;
    this._renderPresetScreen();
  }

  // Сохраняет пресет после сборки колоды через DeckBuilder
  saveNewPreset(faction, selection, deck) {
    const name = prompt('Название колоды (до 24 символов):', 'Моя колода');
    if (name === null) return;
    const trimmed = name.trim().slice(0, 24) || 'Моя колода';
    const preset  = createPreset({ name: trimmed, faction, selection, deck });
    if (!preset) {
      alert(`Нельзя сохранить больше ${MAX_PRESETS} колод.`);
      return;
    }
    this._activePresetId = preset.id;
  }

  /* ── Events (главное меню) ──────────────────────────────── */

  _bindEvents() {
    this._on('#mm-player-block',    'click', () => this.openProfile());
    this._on('#mm-spices-btn',      'click', () => this.openSpicesInfo());
    this._on('#mm-water-rings-btn', 'click', () => this.openWaterRingsInfo());
    this._on('#mm-location-btn',    'click', () => this.openLocationMap());

    const battleBtn = this._q('#mm-battle-btn');
    battleBtn.addEventListener('pointerdown',  () => battleBtn.classList.add('mm-pressed'));
    battleBtn.addEventListener('pointerup',    () => battleBtn.classList.remove('mm-pressed'));
    battleBtn.addEventListener('pointerleave', () => battleBtn.classList.remove('mm-pressed'));
    battleBtn.addEventListener('click', () => this.startBattle());

    this._on('#mm-decks-btn',      'click', () => this._openDecks());
    this._on('#mm-collection-btn', 'click', () => this.openCardCollection());
    this._on('#mm-rating-btn',     'click', () => this.openRating());

    this._q('#mm-factions-row').addEventListener('click', e => {
      const card = e.target.closest('.mm-faction-card');
      if (!card) return;
      const id      = card.dataset.factionId;
      const faction = menuState.factions.find(f => f.id === id);
      if (!faction) return;
      this._handleFactionClick(faction, card);
    });

    this._q('#mm-modal-overlay')?.addEventListener('click', () => this.closeModal());
    this._on('#mm-modal-close', 'click', () => this.closeModal());

    // ── Онлайн-кнопки (уникальные ID, отличные от старого меню) ──
    this._on('#btn-mm-online-create', 'click', () => this._onlineCreate());
    this._on('#btn-mm-online-join',   'click', () => this._onlineJoin());

    // ── Кнопки «Назад» в экранах справочника и уроков ──
    document.getElementById('ug-back-btn')?.addEventListener('click', () => {
      document.getElementById('unit-guide-screen')?.classList.add('hidden');
      this.show();
    });
    document.getElementById('ug-detail-overlay')?.addEventListener('click', () => {
      document.getElementById('ug-detail')?.classList.add('hidden');
    });
    document.getElementById('ug-detail-close')?.addEventListener('click', () => {
      document.getElementById('ug-detail')?.classList.add('hidden');
    });
    document.getElementById('tl-back-btn')?.addEventListener('click', () => {
      document.getElementById('tutorial-lessons-screen')?.classList.add('hidden');
      this.show();
    });
  }

  _handleFactionClick(faction, cardEl) {
    switch (faction.state) {
      case 'locked':
        this.openModal(
          `Дом ${faction.nameShort}`,
          `${faction.name} — закрытая фракция.\n\nОткрывается на уровне ${faction.unlockLevel}.\n\nПродолжай сражения, чтобы открыть эту фракцию.`
        );
        this._shake(cardEl);
        break;

      case 'roulette_available':
        this.openModal(
          faction.name,
          'Дом доступен в рулетке. Получи его через прокрут.\n\nНажми кнопку «Рулетка домов» чтобы попробовать.'
        );
        break;

      case 'owned': {
        const p = loadProfile();
        p.selectedFaction = faction.id;
        saveProfile(p);
        this._syncProfile();
        break;
      }

      case 'active':
        // уже выбран — ничего не делаем
        break;
    }
  }

  // Переопределяется из main.js через setOnlineCallbacks
  _onlineCreate() { this._cbOnlineCreate?.(); }
  _onlineJoin()   { this._cbOnlineJoin?.(); }

  setOnlineCallbacks(onCreate, onJoin) {
    this._cbOnlineCreate = onCreate;
    this._cbOnlineJoin   = onJoin;
  }

  /* ── Handlers ───────────────────────────────────────────── */

  // "В БОЙ" — если есть пресеты, показать экран выбора; иначе DeckBuilder
  startBattle() {
    const presets = loadPresets();
    this.hide();
    if (presets.length > 0) {
      this._openPresetScreen();
    } else {
      this._onStartBattle(null);
    }
  }

  // Кнопка "Мои колоды" — открыть экран управления колодами
  _openDecks() {
    this.hide();
    this._openPresetScreen();
  }

  openProfile() {
    const p        = loadProfile();
    const nextNeed = menuState.rating.nextLevelNeed;
    const factionName = menuState.factions.find(f => f.id === p.selectedFaction)?.name ?? p.selectedFaction;
    this.openModal('Профиль воина',
      `Имя: ${menuState.player.name}\nФракция: ${factionName}\nУровень: ${p.level}\nРейтинг: ${p.rating} очков\nПобеды: ${p.wins} · Поражений: ${p.losses}\n${nextNeed > 0 ? `До следующего уровня: ${nextNeed} очков` : 'Максимальный уровень'}`);
  }

  openSpicesInfo() {
    this.openModal('Запасы специй', `У тебя: ${menuState.resources.spices.toLocaleString('ru-RU')} ед.\n\nЗапасы специй — мета-валюта аккаунта. Зарабатываются за каждый матч. В будущем можно тратить на улучшение карт и постройки.`);
  }

  openWaterRingsInfo() {
    this.openModal('Водные кольца', `У тебя: ${menuState.resources.waterRings.toLocaleString('ru-RU')}\n\nВодные кольца — редкая метавалюта. Зарабатываются за победы. Трать в Каравaнном рынке (вкладка Рынок) на тайники с наградами.`);
  }

  openLocationMap() {
    const loc = menuState.location;
    this.openModal(loc.name, `Уровень локации: ${loc.level}\n\nЗдесь разворачиваются основные сражения за ресурсы пустыни.`);
  }

  openCardCollection() {
    this.openModal('Коллекция карт', 'Система коллекции карт — в разработке.\n\nСкоро здесь появятся все твои карты, их характеристики и возможность улучшения.');
  }

  showLockedFactionModal(faction) {
    this.openModal(`Дом ${faction.nameShort}`,
      `${faction.name} — закрытая фракция.\n\nОткрывается на уровне ${faction.unlockLevel}.\n\nПродолжай сражения, чтобы открыть эту фракцию и её уникальные карты.`);
  }

  openRating() {
    const p        = loadProfile();
    const nextNeed = menuState.rating.nextLevelNeed;
    const nextInfo = nextNeed > 0 ? `До следующего уровня: ${nextNeed} очков` : 'Максимальный уровень достигнут';
    this.openModal('Рейтинг', `Твой рейтинг: ${p.rating} очков\nУровень: ${p.level}\n\n${nextInfo}\n\nРейтинг обновляется после каждого матча в режиме 1P.`);
  }

  openModal(title, content) {
    if (!this._modal) return;
    this._modalTitle.textContent   = title;
    this._modalContent.textContent = content;
    this._modal.classList.remove('hidden');
    requestAnimationFrame(() => this._modal.classList.add('mm-open'));
  }

  closeModal() {
    if (!this._modal) return;
    this._modal.classList.remove('mm-open');
    this._modal.addEventListener('transitionend', () => {
      this._modal.classList.add('hidden');
    }, { once: true });
  }

  /* ── Tutorial ───────────────────────────────────────────── */

  _updateTutorialBadge() {
    const badge = document.getElementById('mm-tutorial-badge');
    if (badge) badge.classList.toggle('hidden', isMenuTourDone());
  }

  _bindTutorialEvents() {
    document.getElementById('mm-btn-menu-tour')?.addEventListener('click', () => this._startMenuTour());
    document.getElementById('mm-btn-unit-guide')?.addEventListener('click', () => this._openUnitGuide());
    document.getElementById('mm-btn-lessons')?.addEventListener('click', () => this._openLessons());
  }

  _startMenuTour() {
    this._menuTourOverlay.showSteps(MENU_TOUR_STEPS, {
      onDone: () => { markMenuTourDone(); this._updateTutorialBadge(); },
      onSkip: () => { markMenuTourDone(); this._updateTutorialBadge(); },
    });
  }

  // ── Справочник юнитов ──

  _openUnitGuide() {
    this.hide();
    const screen = document.getElementById('unit-guide-screen');
    screen?.classList.remove('hidden');
    this._renderUnitGuide('all');

    // Фильтр
    const filterRow = document.getElementById('ug-filter-row');
    if (filterRow && !filterRow.dataset.bound) {
      filterRow.dataset.bound = '1';
      filterRow.addEventListener('click', e => {
        const btn = e.target.closest('.ug-filter-btn');
        if (!btn) return;
        filterRow.querySelectorAll('.ug-filter-btn').forEach(b => b.classList.remove('ug-filter-active'));
        btn.classList.add('ug-filter-active');
        this._renderUnitGuide(btn.dataset.cat);
      });
    }
  }

  _renderUnitGuide(cat) {
    const grid = document.getElementById('ug-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const unitIds = Object.keys(CARD_DEFS).filter(id => {
      if (cat === 'all') return true;
      return UNIT_GUIDE[id]?.category === cat;
    });

    unitIds.forEach(id => {
      const def   = CARD_DEFS[id];
      const guide = UNIT_GUIDE[id];
      if (!def || !guide) return;

      const card = document.createElement('button');
      card.className = 'ug-card';
      card.dataset.unitId = id;
      card.innerHTML = `
        <div class="ug-card-icon" style="background:${CARD_COLORS[id]}">${CARD_ICONS[id]}</div>
        <div class="ug-card-name">${def.name}</div>
        <div class="ug-card-role">${guide.role}</div>
        <div class="ug-card-cost">⚙ ${def.baseCost ?? def.cost ?? '?'}</div>`;
      card.addEventListener('click', () => this._openUnitDetail(id));
      grid.appendChild(card);
    });
  }

  _openUnitDetail(id) {
    const def   = CARD_DEFS[id];
    const guide = UNIT_GUIDE[id];
    const stats = getUnitStats(id);
    if (!def || !guide) return;

    document.getElementById('ug-detail-icon').textContent   = CARD_ICONS[id];
    document.getElementById('ug-detail-icon').style.background = CARD_COLORS[id];
    document.getElementById('ug-detail-name').textContent   = def.name;
    document.getElementById('ug-detail-role').textContent   = guide.role;

    const categoryLabel = UNIT_CATEGORY_LABELS[guide.category] ?? guide.category;

    document.getElementById('ug-detail-stats').innerHTML = `
      <div class="ug-stat"><span class="ug-stat-l">HP</span><span class="ug-stat-v">${stats.hp}</span></div>
      <div class="ug-stat"><span class="ug-stat-l">Скорость</span><span class="ug-stat-v">${stats.speed}</span></div>
      <div class="ug-stat"><span class="ug-stat-l">Урон</span><span class="ug-stat-v">${stats.attackDamage || '—'}</span></div>
      <div class="ug-stat"><span class="ug-stat-l">Урон по зданиям</span><span class="ug-stat-v">${stats.buildingDamage || '—'}</span></div>
      <div class="ug-stat"><span class="ug-stat-l">Стоимость</span><span class="ug-stat-v">${stats.baseCost} 🌶</span></div>
      <div class="ug-stat"><span class="ug-stat-l">Тип</span><span class="ug-stat-v">${categoryLabel}</span></div>`;

    const strong = guide.strongAgainst.map(s => CARD_DEFS[s]?.name ?? s).join(', ') || '—';
    const weak   = guide.weakAgainst.map(s => CARD_DEFS[s]?.name ?? s).join(', ')   || '—';

    document.getElementById('ug-detail-body').innerHTML = `
      <div class="ug-detail-section"><div class="ug-detail-label">Как использовать</div><div class="ug-detail-text">${this._escHtml(guide.use)}</div></div>
      <div class="ug-detail-section ug-detail-strong"><div class="ug-detail-label">Силён против</div><div class="ug-detail-text">${this._escHtml(strong)}</div></div>
      <div class="ug-detail-section ug-detail-weak"><div class="ug-detail-label">Слаб против</div><div class="ug-detail-text">${this._escHtml(weak)}</div></div>
      <div class="ug-detail-section"><div class="ug-detail-label">Как контрить</div><div class="ug-detail-text">${this._escHtml(guide.counter)}</div></div>
      <div class="ug-detail-section ug-detail-tip"><div class="ug-detail-label">Совет</div><div class="ug-detail-text">${this._escHtml(guide.tip)}</div></div>`;

    const detail = document.getElementById('ug-detail');
    detail?.classList.remove('hidden');
  }

  // ── Список уроков ──

  _openLessons() {
    this.hide();
    const screen = document.getElementById('tutorial-lessons-screen');
    screen?.classList.remove('hidden');
    this._renderLessons();
  }

  _renderLessons() {
    const screen = document.getElementById('tutorial-lessons-screen');
    if (!screen) return;

    const total     = TUTORIAL_LESSONS.length;
    const doneCount = TUTORIAL_LESSONS.filter(l => isLessonDone(l.id)).length;
    const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    // Прогресс-заголовок
    let progBlock = screen.querySelector('.tl-progress-block');
    if (!progBlock) {
      progBlock = document.createElement('div');
      progBlock.className = 'tl-progress-block';
      progBlock.innerHTML = `
        <div class="tl-progress-header">
          <span class="tl-progress-label">Прогресс обучения</span>
          <span class="tl-progress-count"></span>
        </div>
        <div class="tl-progress-bar-wrap">
          <div class="tl-progress-bar-fill"></div>
        </div>`;
      const list = document.getElementById('tl-list');
      if (list) list.parentNode.insertBefore(progBlock, list);
    }
    progBlock.querySelector('.tl-progress-count').textContent  = `${doneCount} / ${total}`;
    progBlock.querySelector('.tl-progress-bar-fill').style.width = pct + '%';

    // Список уроков
    const list = document.getElementById('tl-list');
    if (!list) return;
    list.innerHTML = '';
    TUTORIAL_LESSONS.forEach((lesson, idx) => {
      const done    = isLessonDone(lesson.id);
      const isLast  = lesson.id === 'lesson_3';
      const item    = document.createElement('div');
      item.className = 'tl-item' + (done ? ' tl-item-done' : '');
      item.innerHTML = `
        <div class="tl-item-num ${done ? 'tl-num-done' : ''}">${done ? '✓' : idx + 1}</div>
        <div class="tl-item-body">
          <div class="tl-item-title">${this._escHtml(lesson.title)}</div>
          <div class="tl-item-desc">${this._escHtml(lesson.desc)}</div>
        </div>
        <div class="tl-item-right">
          <button class="tl-start-btn ${isLast ? 'tl-start-btn-final' : ''}" data-lesson-id="${lesson.id}">
            ${done ? '↺ Повторить' : (isLast ? '⚔ В бой' : '▶ Начать')}
          </button>
        </div>`;
      list.appendChild(item);
    });

    if (!list.dataset.bound) {
      list.dataset.bound = '1';
      list.addEventListener('click', e => {
        const btn = e.target.closest('.tl-start-btn');
        if (!btn) return;
        const lessonId = btn.dataset.lessonId;
        screen.classList.add('hidden');
        this._onStartTutorial?.(lessonId);
      });
    }
  }

  /* ── Utils ──────────────────────────────────────────────── */

  _q(sel)          { return this._el.querySelector(sel) || document.querySelector(sel); }
  _on(sel, ev, fn) { const el = this._q(sel); if (el) el.addEventListener(ev, fn); }
  _escHtml(s)      { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  _shake(card) {
    card.classList.remove('mm-shaking');
    void card.offsetWidth;
    card.classList.add('mm-shaking');
    card.addEventListener('animationend', () => card.classList.remove('mm-shaking'), { once: true });
  }

  /* ── Bottom Navigation ──────────────────────────────────── */

  _bindBottomNav() {
    const nav = document.getElementById('mm-bottom-nav');
    if (!nav) return;
    nav.addEventListener('click', e => {
      const tab = e.target.closest('.mm-nav-tab');
      if (!tab) return;
      this._switchToPage(parseInt(tab.dataset.page, 10));
    });
    this._initSwipe();
  }

  _switchToPage(idx) {
    const track = document.getElementById('mm-pages-track');
    const nav   = document.getElementById('mm-bottom-nav');
    if (!track || !nav) return;

    track.style.transform = `translateX(calc(-${idx} * 100vw))`;
    nav.querySelectorAll('.mm-nav-tab').forEach((t, i) =>
      t.classList.toggle('mm-nav-tab--active', i === idx)
    );

    if (idx === 2 && !this._marketPage) {
      const mp = document.getElementById('mm-page-market');
      if (mp) this._marketPage = new MarketPage(mp);
    } else if (idx === 2 && this._marketPage) {
      this._marketPage.refresh();
    }

    this._currentPage = idx;
  }

  _initSwipe() {
    const viewport = this._el?.querySelector('.mm-pages-viewport');
    if (!viewport) return;
    let startX = 0, startY = 0;
    viewport.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
      const cur = this._currentPage ?? 0;
      if (dx < 0 && cur < 4) this._switchToPage(cur + 1);
      if (dx > 0 && cur > 0) this._switchToPage(cur - 1);
    }, { passive: true });
  }
}
