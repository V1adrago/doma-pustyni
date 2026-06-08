import { PROGRESSION, HOUSES } from './config/progression.js';
import { loadProfile, saveProfile, resetProfile } from './services/profile-service.js';

export class GameMenu {
  constructor(onStart) {
    this._onStart = onStart;
    this._mode    = null;
    this._side    = 'bottom';
    this._profile = loadProfile();
    this._bind();
  }

  show() {
    this._profile = loadProfile();
    this._renderProfile();
    this._renderLocations();
    document.getElementById('menu-overlay').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('ui-hidden');
  }

  hide() {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('ui-hidden');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _bind() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

    on('btn-mode-1p',  () => this._setMode('1p'));
    on('btn-mode-2p',  () => this._setMode('2p'));
    on('btn-mode-ai',  () => this._setMode('ai'));

    on('btn-side-bottom', () => this._setSide('bottom'));
    on('btn-side-top',    () => this._setSide('top'));
    on('btn-side-random', () => this._setSide('random'));

    on('btn-start-game', () => this._start());

    on('btn-reset-profile', () => {
      if (!confirm('Сбросить весь прогресс? Рейтинг, уровень и победы будут обнулены.')) return;
      this._profile = resetProfile();
      this._mode    = null;
      document.querySelectorAll('.hub-mode-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById('hub-side-section').classList.add('hidden');
      document.getElementById('btn-start-game').classList.add('hidden');
      this._renderProfile();
      this._renderLocations();
    });

    // Event delegation for locations list (loc cards + house chips)
    document.getElementById('hub-locations-list')?.addEventListener('click', e => {
      const chip = e.target.closest('.hub-house-chip[data-house]');
      if (chip) {
        e.stopPropagation();
        this._selectHouse(chip.dataset.house);
        return;
      }
      const card = e.target.closest('.hub-loc-card:not(.hub-loc-locked)');
      if (card && card.dataset.locId) {
        this._selectLocation(card.dataset.locId);
      }
    });
  }

  _setMode(mode) {
    this._mode = mode;
    document.querySelectorAll('.hub-mode-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`btn-mode-${mode}`)?.classList.add('selected');

    const sideSection = document.getElementById('hub-side-section');
    sideSection.classList.toggle('hidden', mode !== '1p');

    document.getElementById('btn-start-game').classList.remove('hidden');
  }

  _setSide(side) {
    this._side = side;
    document.querySelectorAll('.hub-side-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById(`btn-side-${side}`)?.classList.add('selected');
  }

  _start() {
    if (!this._mode) return;
    let side = this._side;
    if (side === 'random') side = Math.random() < 0.5 ? 'bottom' : 'top';

    // Validate selected location is still unlocked (e.g. after reset)
    const tier = PROGRESSION.find(t => t.locationId === this._profile.selectedLocationId);
    if (!tier || tier.level > this._profile.level) {
      this._profile.selectedLocationId = 'location_1';
      this._profile.selectedHouseId    = 'house_1';
      saveProfile(this._profile);
    }

    this.hide();
    this._onStart({
      mode:               this._mode,
      playerSide:         side,
      selectedLocationId: this._profile.selectedLocationId,
      selectedHouseId:    this._profile.selectedHouseId,
    });
  }

  _renderProfile() {
    const p       = this._profile;
    const curTier  = PROGRESSION.find(t => t.level === p.level);
    const nextTier = PROGRESSION.find(t => t.level === p.level + 1);
    const house    = HOUSES.find(h => h.id === p.selectedHouseId);

    _set('hub-rating',     p.rating);
    _set('hub-level',      p.level);
    _set('hub-wins',       `${p.wins} побед`);
    _set('hub-losses',     `${p.losses} пораж.`);
    _set('hub-house-name', house?.name ?? '—');

    const fill  = document.getElementById('hub-progress-fill');
    const label = document.getElementById('hub-progress-label');
    if (nextTier) {
      const from = curTier?.minRating ?? 0;
      const pct  = Math.min(100, Math.round(((p.rating - from) / (nextTier.minRating - from)) * 100));
      if (fill)  fill.style.width = `${pct}%`;
      if (label) label.textContent = `До уровня ${nextTier.level}: ${nextTier.minRating - p.rating} рейтинга`;
    } else {
      if (fill)  fill.style.width = '100%';
      if (label) label.textContent = 'Максимальный уровень';
    }
  }

  _renderLocations() {
    const list = document.getElementById('hub-locations-list');
    if (!list) return;
    list.innerHTML = '';

    for (const tier of PROGRESSION) {
      const isUnlocked = tier.level <= this._profile.level;
      const isSelected = tier.locationId === this._profile.selectedLocationId;

      const card = document.createElement('div');
      card.className = 'hub-loc-card'
        + (isUnlocked ? '' : ' hub-loc-locked')
        + (isSelected ? ' hub-loc-selected' : '');
      card.dataset.locId = tier.locationId;

      const houseCount = tier.unlockedHouseIds.length;
      const plural     = houseCount === 1 ? 'дом' : 'дома';
      const lockHtml   = isUnlocked ? '' : `<span class="hub-loc-lock">🔒 ур. ${tier.level}</span>`;

      card.innerHTML = `
        <div class="hub-loc-header">
          <div class="hub-loc-name">${tier.locationName}</div>
          ${lockHtml}
        </div>
        <div class="hub-loc-meta">Уровень ${tier.level} · ${houseCount} ${plural}</div>
        ${isSelected && isUnlocked ? this._housesHtml(tier) : ''}
      `;

      list.appendChild(card);
    }
  }

  _housesHtml(tier) {
    const chips = tier.unlockedHouseIds.map(id => {
      const house      = HOUSES.find(h => h.id === id);
      if (!house) return '';
      const isUnlocked = house.levelRequired <= this._profile.level;
      const isActive   = house.id === this._profile.selectedHouseId;
      if (!isUnlocked) {
        return `<div class="hub-house-chip hub-house-locked" title="Откроется на уровне ${house.levelRequired}">🔒 ${house.name}</div>`;
      }
      return `<div class="hub-house-chip${isActive ? ' hub-house-active' : ''}" data-house="${house.id}">${house.name}</div>`;
    }).join('');
    return `<div class="hub-houses-row">${chips}</div>`;
  }

  _selectLocation(locationId) {
    this._profile.selectedLocationId = locationId;

    // Default to first available house in this location if current isn't in it
    const tier = PROGRESSION.find(t => t.locationId === locationId);
    if (tier) {
      const available = tier.unlockedHouseIds
        .map(id => HOUSES.find(h => h.id === id))
        .filter(h => h && h.levelRequired <= this._profile.level);
      const currentInLocation = available.some(h => h.id === this._profile.selectedHouseId);
      if (!currentInLocation && available.length > 0) {
        this._profile.selectedHouseId = available[0].id;
      }
    }

    saveProfile(this._profile);
    this._renderProfile();
    this._renderLocations();
  }

  _selectHouse(houseId) {
    this._profile.selectedHouseId = houseId;
    saveProfile(this._profile);
    this._renderProfile();
    this._renderLocations();
  }
}

function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
