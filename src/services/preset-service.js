const STORAGE_KEY  = 'dp-deck-presets-v1';
export const MAX_PRESETS = 5;

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function _save(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function loadPresets() {
  return _load();
}

export function getPreset(id) {
  return _load().find(p => p.id === id) ?? null;
}

// Создаёт новый пресет. Возвращает сохранённый объект или null если лимит исчерпан.
export function createPreset({ name, faction, selection, deck }) {
  const presets = _load();
  if (presets.length >= MAX_PRESETS) return null;

  const preset = {
    id:        `preset-${Date.now()}`,
    name:      name.trim() || 'Колода',
    faction,
    selection: { ...selection },
    deck:      [...deck],
    createdAt: Date.now(),
  };
  presets.push(preset);
  _save(presets);
  return preset;
}

// Обновляет существующий пресет (имя, состав или всё вместе). Возвращает обновлённый.
export function updatePreset(id, changes) {
  const presets = _load();
  const idx     = presets.findIndex(p => p.id === id);
  if (idx === -1) return null;
  Object.assign(presets[idx], changes);
  _save(presets);
  return presets[idx];
}

export function deletePreset(id) {
  const presets = _load().filter(p => p.id !== id);
  _save(presets);
}
