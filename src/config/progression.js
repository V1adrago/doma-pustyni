export const PROGRESSION = [
  {
    level: 1,
    minRating: 0,
    locationId: 'location_1',
    locationName: 'Песчаный аванпост',
    unlockedHouseIds: ['house_1'],
  },
  {
    level: 2,
    minRating: 100,
    locationId: 'location_2',
    locationName: 'Дюны добытчиков',
    unlockedHouseIds: ['house_1', 'house_2'],
  },
  {
    level: 3,
    minRating: 250,
    locationId: 'location_3',
    locationName: 'Каменный проход',
    unlockedHouseIds: ['house_1', 'house_2', 'house_3'],
  },
  {
    level: 4,
    minRating: 500,
    locationId: 'location_4',
    locationName: 'Поле бурь',
    unlockedHouseIds: ['house_1', 'house_2', 'house_3', 'house_4'],
  },
  {
    level: 5,
    minRating: 850,
    locationId: 'location_5',
    locationName: 'Красная цитадель',
    unlockedHouseIds: ['house_1', 'house_2', 'house_3', 'house_4', 'house_5'],
  },
];

export const HOUSES = [
  {
    id: 'house_1',
    name: 'Дом Первой Дюны',
    description: 'Базовый дом. Доступен с начала.',
    levelRequired: 1,
  },
  {
    id: 'house_2',
    name: 'Дом Соляных Ветров',
    description: 'Открывается на 2 уровне.',
    levelRequired: 2,
  },
  {
    id: 'house_3',
    name: 'Дом Каменного Клинка',
    description: 'Открывается на 3 уровне.',
    levelRequired: 3,
  },
  {
    id: 'house_4',
    name: 'Дом Песчаной Бури',
    description: 'Открывается на 4 уровне.',
    levelRequired: 4,
  },
  {
    id: 'house_5',
    name: 'Дом Красной Цитадели',
    description: 'Открывается на 5 уровне.',
    levelRequired: 5,
  },
];
