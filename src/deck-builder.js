import { CARD_DEFS, CARD_ICONS, CARD_COLORS, DECK_SIZE, MAX_COPIES_PER_CARD } from './cards.js';

const DECK_STORAGE_KEY = 'dp-saved-deck-v1';

// Парсит сохранённую колоду из localStorage; возвращает { faction, selection } или null.
function _parseSavedDeck() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return null;
    const { faction, selection } = JSON.parse(raw);
    if (!faction || !selection) return null;
    if (faction !== 'none' && faction !== 'honor') return null;
    const validSel = {};
    let total = 0;
    for (const [id, def] of Object.entries(CARD_DEFS)) {
      if (def.factionOnly && def.factionOnly !== faction) continue;
      const n = Math.max(0, Math.min(Number(selection[id]) || 0, MAX_COPIES_PER_CARD));
      validSel[id] = n;
      total += n;
    }
    if (total > DECK_SIZE) return null;
    return { faction, selection: validSel };
  } catch { return null; }
}

// Возвращает последнюю сохранённую колоду с массивом deck[] или null.
export function loadSavedDeck() {
  const parsed = _parseSavedDeck();
  if (!parsed) return null;
  const deck = [];
  for (const [id, n] of Object.entries(parsed.selection)) {
    for (let i = 0; i < n; i++) deck.push(id);
  }
  return { ...parsed, deck };
}

export class DeckBuilder {
  constructor() {
    this._overlay      = document.getElementById('deck-builder-overlay');
    this._label        = document.getElementById('deck-builder-player-label');
    this._countDisp    = document.getElementById('deck-builder-count');
    this._confirmBtn   = document.getElementById('btn-deck-confirm');
    this._cancelBtn    = document.getElementById('btn-deck-cancel');
    this._faction      = 'none';
    this._selection    = {};
    this._onComplete   = null;
    this._onCancel     = null;
    this._confirmLabel = null;
    this._bind();
  }

  // onComplete(deck: string[], factionId: string, selection: object)
  // onCancel() — вызывается при нажатии «Отмена»
  // confirmLabel — текст кнопки подтверждения (по умолчанию «⚔ К БОЮ»)
  show(playerLabel, onComplete, onCancel = null, confirmLabel = null) {
    this._onComplete   = onComplete;
    this._onCancel     = onCancel;
    this._confirmLabel = confirmLabel;
    this._label.textContent = playerLabel;

    // Попытка восстановить сохранённую колоду
    const saved = this._loadSavedDeck();
    if (saved) {
      this._faction   = saved.faction;
      this._buildGrid();
      this._selection = saved.selection;
    } else {
      this._faction = 'none';
      this._buildGrid();
      this._resetSelection();
    }

    this._refresh();
    this._updateFactionButtons();
    this._overlay.classList.remove('hidden');
  }

  hide() {
    this._overlay.classList.add('hidden');
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _buildGrid() {
    const grid = document.getElementById('deck-builder-grid');
    grid.innerHTML = '';

    for (const [id, def] of Object.entries(CARD_DEFS)) {
      // Hide cards restricted to a faction the player hasn't chosen
      if (def.factionOnly && def.factionOnly !== this._faction) continue;

      const costLabel = id === 'engineer' ? '2–4 🌶' : `${def.cost} 🌶`;

      const el = document.createElement('div');
      el.className = 'db-card';
      if (def.factionOnly) el.classList.add('db-card-faction');
      el.innerHTML = `
        <div class="db-card-header" style="background:${CARD_COLORS[id]}">
          <span class="db-card-icon">${CARD_ICONS[id]}</span>
        </div>
        <div class="db-card-body">
          <div class="db-card-name">${def.name}</div>
          <div class="db-card-cost">${costLabel}</div>
          <div class="db-card-controls">
            <button class="db-minus" id="db-minus-${id}">−</button>
            <span   class="db-count" id="db-count-${id}">0</span>
            <button class="db-plus"  id="db-plus-${id}">+</button>
          </div>
        </div>
      `;
      grid.appendChild(el);
    }
  }

  _resetSelection() {
    this._selection = {};
    for (const [id, def] of Object.entries(CARD_DEFS)) {
      if (def.factionOnly && def.factionOnly !== this._faction) continue;
      this._selection[id] = 0;
    }
  }

  _setFaction(factionId) {
    this._faction = factionId;
    this._buildGrid();
    this._resetSelection();
    this._refresh();
    this._updateFactionButtons();
  }

  _updateFactionButtons() {
    const btnNone  = document.getElementById('db-faction-none');
    const btnHonor = document.getElementById('db-faction-honor');
    if (!btnNone || !btnHonor) return;
    btnNone.classList.toggle('selected',  this._faction === 'none');
    btnHonor.classList.toggle('selected', this._faction === 'honor');
    btnHonor.classList.toggle('honor-active', this._faction === 'honor');
  }

  _bind() {
    // Faction buttons
    document.getElementById('db-faction-none')?.addEventListener('click', () => this._setFaction('none'));
    document.getElementById('db-faction-honor')?.addEventListener('click', () => this._setFaction('honor'));

    // Card +/- (event delegation — works with dynamically rebuilt grid)
    this._overlay.addEventListener('click', e => {
      const minus = e.target.closest('.db-minus');
      const plus  = e.target.closest('.db-plus');
      if (minus) this._change(minus.id.replace('db-minus-', ''), -1);
      if (plus)  this._change(plus.id.replace('db-plus-',  ''), +1);
    });

    // Confirm
    this._confirmBtn.addEventListener('click', () => {
      if (this._total() !== DECK_SIZE) return;
      const deck = [];
      for (const [id, n] of Object.entries(this._selection)) {
        for (let i = 0; i < n; i++) deck.push(id);
      }
      this._saveDeck();
      this.hide();
      this._onComplete(deck, this._faction, { ...this._selection });
    });

    // Cancel
    this._cancelBtn?.addEventListener('click', () => {
      this.hide();
      if (this._onCancel) this._onCancel();
    });
  }

  _change(cardId, delta) {
    if (!(cardId in this._selection)) return;
    const cur   = this._selection[cardId] ?? 0;
    const total = this._total();
    if (delta > 0 && (total >= DECK_SIZE || cur >= MAX_COPIES_PER_CARD)) return;
    if (delta < 0 && cur <= 0) return;
    this._selection[cardId] = cur + delta;
    this._refresh();
  }

  _total() {
    return Object.values(this._selection).reduce((s, v) => s + v, 0);
  }

  _refresh() {
    const total     = this._total();
    const baseLabel = this._confirmLabel ?? 'К БОЮ';
    this._countDisp.textContent  = `${total} / ${DECK_SIZE} карт`;
    this._confirmBtn.disabled    = total !== DECK_SIZE;
    this._confirmBtn.textContent = total === DECK_SIZE
      ? baseLabel
      : `${baseLabel} (${total}/${DECK_SIZE})`;

    for (const id of Object.keys(this._selection)) {
      const cur     = this._selection[id] ?? 0;
      const countEl = document.getElementById(`db-count-${id}`);
      const plusEl  = document.getElementById(`db-plus-${id}`);
      const minusEl = document.getElementById(`db-minus-${id}`);
      if (countEl)  countEl.textContent  = cur;
      if (plusEl)   plusEl.disabled  = total >= DECK_SIZE || cur >= MAX_COPIES_PER_CARD;
      if (minusEl)  minusEl.disabled = cur <= 0;
    }
  }

  // ── Сохранение / загрузка колоды ─────────────────────────────────────────

  _saveDeck() {
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({
        faction:   this._faction,
        selection: { ...this._selection },
      }));
    } catch {}
  }

  _loadSavedDeck() {
    return _parseSavedDeck();
  }
}
