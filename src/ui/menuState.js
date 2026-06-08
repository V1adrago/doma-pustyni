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
    id:    'sand_outpost',
    name:  'Песчаный аванпост',
    level: 1,
  },
  rating: {
    value:         0,
    nextLevelNeed: 100,
  },
  selectedFaction: 'house_honor',
  factions: [
    { id: 'house_honor',  name: 'Дом Чести',       nameShort: 'ЧЕСТИ',  state: 'active', unlockLevel: 1 },
    { id: 'house_iron',   name: 'Дом Железа',       nameShort: 'ЖЕЛЕЗА', state: 'locked', unlockLevel: 2 },
    { id: 'desert_clans', name: 'Пустынные Кланы',  nameShort: 'КЛАНЫ',  state: 'locked', unlockLevel: 3 },
    { id: 'order_voice',  name: 'Орден Голоса',     nameShort: 'ГОЛОСА', state: 'locked', unlockLevel: 4 },
  ],
};
