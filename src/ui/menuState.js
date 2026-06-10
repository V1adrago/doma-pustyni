// Состояние главного меню. Синхронизируется с profile-service и wallet-service.
export const menuState = {
  player: {
    name:   'Игрок',
    house:  'Дом Чести',
    level:  1,
    xp:     0,
    xpMax:  100,
  },
  resources: {
    spices:     0,
    waterRings: 0,
  },
  location: {
    id:    'location_1',
    name:  'Песчаный аванпост',
    level: 1,
  },
  rating: {
    value:         0,
    nextLevelNeed: 100,
  },
  selectedFaction: 'honor',
  freeRouletteRolls: 0,
  factions: [
    { id: 'honor',        name: 'Дом Чести',      nameShort: 'ЧЕСТИ',  state: 'active', unlockLevel: 1 },
    { id: 'desert_clans', name: 'Пустынные Кланы', nameShort: 'КЛАНЫ',  state: 'locked', unlockLevel: 2 },
    { id: 'house_iron',   name: 'Дом Железа',      nameShort: 'ЖЕЛЕЗА', state: 'locked', unlockLevel: 3 },
    { id: 'order_voice',  name: 'Орден Голоса',    nameShort: 'ГОЛОСА', state: 'locked', unlockLevel: 4 },
  ],
};

// Compute faction states from profile and update menuState.factions
export function syncFactionStates(profile) {
  menuState.selectedFaction  = profile.selectedFaction ?? 'honor';
  menuState.freeRouletteRolls = profile.freeRouletteRolls ?? 0;

  menuState.factions = menuState.factions.map(f => {
    if (f.id === 'honor') {
      // Always owned; active if selected
      return { ...f, state: profile.selectedFaction === 'honor' ? 'active' : 'owned' };
    }

    const playerLevel  = profile.level ?? 1;
    const isOwned      = profile.ownedHouseIds?.includes(f.id);
    const isSelected   = profile.selectedFaction === f.id;
    const levelReached = playerLevel >= f.unlockLevel;
    const inRoulette   = profile.unlockedRouletteHouseIds?.includes(f.id);

    if (isOwned && isSelected) return { ...f, state: 'active' };
    if (isOwned)               return { ...f, state: 'owned' };
    if (levelReached && inRoulette) return { ...f, state: 'roulette_available' };
    return { ...f, state: 'locked' };
  });
}
