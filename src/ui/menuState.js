// Состояние главного меню. Заменить на данные из profile-service при интеграции.
export const menuState = {
  player: {
    name:   'Игрок',
    house:  'Дом Чести',
    level:  12,
    xp:     1250,
    xpMax:  2000,
  },
  resources: {
    spices:   4250,
    crystals: 560,
  },
  location: {
    id:    'sand_outpost',
    name:  'Песчаный аванпост',
    level: 1,
  },
  rating: {
    value:         1250,
    nextLevelNeed: 750,
  },
  selectedFaction: 'house_honor',
  factions: [
    { id: 'house_honor',  name: 'Дом Чести',       nameShort: 'ЧЕСТИ',  state: 'active', unlockLevel: 1 },
    { id: 'house_iron',   name: 'Дом Железа',       nameShort: 'ЖЕЛЕЗА', state: 'locked', unlockLevel: 2 },
    { id: 'desert_clans', name: 'Пустынные Кланы',  nameShort: 'КЛАНЫ',  state: 'locked', unlockLevel: 3 },
    { id: 'order_voice',  name: 'Орден Голоса',     nameShort: 'ГОЛОСА', state: 'locked', unlockLevel: 4 },
  ],
};
