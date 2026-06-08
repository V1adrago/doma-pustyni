const STORAGE_KEY = 'dp-battle-settings-v1';

const defaults = {
  sound:           true,
  music:           true,
  vibration:       true,
  graphicsQuality: 'medium',
};

export function loadBattleSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveBattleSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
