export const DESERT_CLANS_ID = 'desert_clans';
export const HONOR_ID = 'honor';

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
    locationId: 'salt_rifts',
    locationName: 'Соляные разломы',
    unlockedHouseIds: ['house_1', 'house_2'],
    rouletteHouseIds: ['desert_clans'],
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
  {
    id: 'desert_clans',
    name: 'Пустынные Кланы',
    nameShort: 'Кланы',
    levelRequired: 2,
    obtainMethod: 'roulette',
    skillsAreFree: true,
    description: 'Мобильный дом пустыни. Сильнее использует бури специй и темповые атаки.',
  },
];

export const LOCATIONS = [
  {
    id: 'location_1',
    name: 'Песчаный аванпост',
    levelRequired: 1,
    minRating: 0,
    description: 'Базовая карта пустыни.',
  },
  {
    id: 'salt_rifts',
    name: 'Соляные разломы',
    levelRequired: 2,
    minRating: 100,
    description: 'Карта с бурями специй, которые меняют темп боя и усиливают инженеров.',
  },
];
