import './mainMenu.css';
import { menuState } from './menuState.js';
import { loadProfile } from '../services/profile-service.js';
import { PROGRESSION } from '../config/progression.js';
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
    this._onStartTutorial  = null; // callback(lessonId)
    this._menuTourOverlay  = new TutorialOverlay();
    this._render();
    this._bindEvents();
    this._bindPresetScreenEvents();
    this._bindTutorialEvents();
  }

  /** Устанавливается из main.js: fn(lessonId) */
  setTutorialCallback(fn) { this._onStartTutorial = fn; }

  // onStartBattle(preset | null) — preset = объект или null (тогда DeckBuilder)
  show() {
    this._syncProfile();
    this._el.classList.remove('hidden');
    this._updateTutorialBadge();
  }

  hide() {
    this._el.classList.add('hidden');
  }

  setDeckBuiltCallback(fn) { this._onDeckBuilt = fn; }

  /* ── Синхронизация профиля ──────────────────────────────── */

  _syncProfile() {
    const p = loadProfile();
    menuState.player.level = p.level;
    menuState.rating.value = p.rating;

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

    this._render();
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

    this._q('#mm-spices-value').textContent   = s.resources.spices.toLocaleString('ru-RU');
    this._q('#mm-crystals-value').textContent = s.resources.crystals.toLocaleString('ru-RU');

    const loc = s.location;
    this._q('#mm-location-name').textContent  = loc.name.toUpperCase();
    this._q('#mm-location-level').textContent = `Уровень ${loc.level}`;

    const ratingEl = this._q('#mm-rating-value');
    if (ratingEl) ratingEl.textContent = s.rating.value.toLocaleString('ru-RU');

    this._renderFactions(s.factions);
  }

  _renderFactions(factions) {
    const row = this._q('#mm-factions-row');
    row.innerHTML = '';
    factions.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'mm-faction-card ' +
        (f.state === 'active' ? 'mm-faction-active' : 'mm-faction-locked');
      btn.dataset.factionId = f.id;
      btn.setAttribute('aria-label',
        f.state === 'active'
          ? `Выбрана фракция ${f.name}`
          : `Фракция ${f.name} — открывается на уровне ${f.unlockLevel}`);

      if (f.state === 'active') {
        btn.innerHTML = `
          <svg class="mm-card-art" viewBox="0 0 280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <use href="#mm-card-honor-art"/>
          </svg>
          <span class="mm-faction-glow"></span>
          <span class="mm-faction-check">✓</span>
          <span class="mm-faction-name">ДОМ<br>ЧЕСТИ</span>`;
      } else {
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
        const factionLabel = preset.faction === 'honor' ? '⛨ Дом Чести' : 'Без фракции';
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
    this._on('#mm-player-block', 'click', () => this.openProfile());
    this._on('#mm-spices-btn',   'click', () => this.openSpicesInfo());
    this._on('#mm-crystals-btn', 'click', () => this.openCrystalsInfo());
    this._on('#mm-location-btn', 'click', () => this.openLocationMap());

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
      if (faction.state === 'locked') { this.showLockedFactionModal(faction); this._shake(card); }
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
    this.openModal('Профиль воина',
      `Имя: ${menuState.player.name}\nФракция: ${menuState.player.house}\nУровень: ${p.level}\nРейтинг: ${p.rating} очков\nПобеды: ${p.wins} · Поражений: ${p.losses}\n${nextNeed > 0 ? `До следующего уровня: ${nextNeed} очков` : 'Максимальный уровень'}`);
  }

  openSpicesInfo() {
    this.openModal('Специи', `У тебя: ${menuState.resources.spices.toLocaleString('ru-RU')} ед.\n\nСпеции — основная валюта. Зарабатываются в бою: захватывай башни, контролируй узлы ресурсов.`);
  }

  openCrystalsInfo() {
    this.openModal('Кристаллы', `У тебя: ${menuState.resources.crystals.toLocaleString('ru-RU')} ед.\n\nКристаллы — редкая валюта за победы на высоком рейтинге.`);
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
}
