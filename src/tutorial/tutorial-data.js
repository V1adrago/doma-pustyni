import { CARD_DEFS } from '../cards.js';

export const UNIT_GUIDE = {
  engineer: {
    role: 'Экономика',
    category: 'economy',
    strongAgainst: [],
    weakAgainst: ['scout', 'archer', 'swordsman'],
    use: 'Идёт к центральному узлу и увеличивает доход специй. Не боевой юнит — не атакует.',
    counter: 'Останови его быстрым юнитом или стрелком. Не позволяй дойти до узла.',
    tip: 'Максимум 3 инженера за матч. Каждый следующий стоит дороже.',
  },
  scout: {
    role: 'Быстрый перехватчик',
    category: 'melee',
    strongAgainst: ['archer', 'engineer'],
    weakAgainst: ['swordsman', 'guard', 'heavy'],
    use: 'Быстро закрывает стрелков, инженеров и слабые цели на любой линии.',
    counter: 'Остановить мечниками, гвардейцами или башней со стрелковой поддержкой.',
    tip: 'Отряд из 2 ищеек. Скорость — главное преимущество.',
  },
  swordsman: {
    role: 'Базовая пехота',
    category: 'melee',
    strongAgainst: ['engineer', 'scout', 'archer'],
    weakAgainst: ['heavy', 'spearman'],
    use: 'Надёжная базовая пехота. Хорош на передней линии и для задержки врага.',
    counter: 'Тяжёлые юниты и пикейщики превосходят мечников в прямом столкновении.',
    tip: 'Отряд 3 клинков. Дёшев и эффективен в связке.',
  },
  assault: {
    role: 'Осада башен',
    category: 'assault',
    strongAgainst: ['building'],
    weakAgainst: ['spearman', 'swordsman', 'guard'],
    use: 'Лучший юнит для сноса башен. Огромный урон по зданиям — обязательно прикрывай его.',
    counter: 'Перехвати быстрым юнитом или пехотой до башни.',
    tip: 'Выставляй после тяжёлого юнита или мечника. Всегда прикрывай.',
  },
  archer: {
    role: 'Дальняя поддержка',
    category: 'ranged',
    strongAgainst: ['heavy', 'drone'],
    weakAgainst: ['scout', 'swordsman'],
    use: 'Стреляет с дистанции по земле и воздуху. Идеален за прикрытием тяжёлых юнитов.',
    counter: 'Слаб в ближнем бою. Закрой быстрым юнитом или пехотой.',
    tip: 'Отряд 3 стрелков. Хорош против дронов и тяжёлых целей.',
  },
  spearman: {
    role: 'Анти-тяжёлый',
    category: 'melee',
    strongAgainst: ['heavy', 'assault'],
    weakAgainst: ['archer', 'drone'],
    use: 'Специализируется на тяжёлых целях. Высокий урон по броне.',
    counter: 'Уязвим к дистанционным атакам и дронам.',
    tip: 'Отряд 3 пикейщиков. Главный счётчик тяжёлых юнитов.',
  },
  drone: {
    role: 'Воздушная угроза',
    category: 'air',
    strongAgainst: ['engineer'],
    weakAgainst: ['archer'],
    use: 'Летит над наземными юнитами. Ближняя пехота не всегда может его остановить.',
    counter: 'Нужен Стрелок или башня со стрелковой поддержкой.',
    tip: 'Единственный воздушный юнит. Обходит часть наземных блокаторов.',
  },
  heavy: {
    role: 'Танк',
    category: 'tank',
    strongAgainst: ['scout', 'swordsman'],
    weakAgainst: ['spearman', 'archer'],
    use: 'Принимает много урона и продавливает линию. Прикрывает других юнитов.',
    counter: 'Пикейщики наносят повышенный урон тяжёлым целям. Стрелки работают сзади.',
    tip: 'Самый крепкий юнит. Выставляй первым в связке с Башнеломом.',
  },
  guard: {
    role: 'Фракционная защита',
    category: 'melee',
    strongAgainst: ['scout', 'swordsman', 'assault'],
    weakAgainst: ['spearman', 'archer'],
    use: 'Крепкий защитник фракции Дом Чести. Надёжная передняя линия.',
    counter: 'Уязвим к пикейщикам и стрелкам. Медленный — легко обойти.',
    tip: 'Только у Дома Чести. Хорош в паре с Башнеломом для осады.',
  },
};

export const UNIT_CATEGORY_LABELS = {
  melee:   'Пехота',
  ranged:  'Дальний бой',
  assault: 'Осада',
  economy: 'Экономика',
  air:     'Воздух',
  tank:    'Танк',
};

export const COUNTER_GUIDE = {
  archer: {
    threat: 'Стрелок силён на дистанции, но слаб в ближнем бою.',
    good: ['scout', 'swordsman', 'guard', 'heavy'],
    bad: ['assault'],
    hint: 'Против стрелков выпускай быстрых юнитов или пехоту. Не отправляй одинокого Башнелома.',
  },
  heavy: {
    threat: 'Тяжёлый юнит принимает много урона и продавливает линию.',
    good: ['spearman', 'archer'],
    bad: ['scout'],
    hint: 'Против тяжёлых целей используй Пикейщика и стрелковую поддержку.',
  },
  assault: {
    threat: 'Башнелом опасен, если дошёл до башни.',
    good: ['spearman', 'swordsman', 'guard'],
    bad: [],
    hint: 'Перехватывай Башнелома до башни. Не давай ему бесплатно бить здание.',
  },
  drone: {
    threat: 'Дрон летит над землёй и не всегда блокируется ближней пехотой.',
    good: ['archer'],
    bad: [],
    hint: 'Против дрона нужен Стрелок или башня со стрелковой поддержкой.',
  },
  engineer: {
    threat: 'Инженер усиливает экономику, если дошёл до узла.',
    good: ['scout', 'archer', 'swordsman'],
    bad: [],
    hint: 'Не игнорируй Инженера. Перехвати его быстрым юнитом или стрелком.',
  },
};

export const MENU_TOUR_STEPS = [
  {
    id: 'profile',
    title: 'Твой Дом',
    text: 'Здесь отображается твой профиль, уровень и выбранный Дом. Уровень растёт вместе с рейтингом.',
    targetSelector: '#mm-player-block',
    placement: 'bottom',
  },
  {
    id: 'battle',
    title: 'В бой',
    text: 'Эта кнопка запускает бой. Если у тебя есть боевая колода — выбери её. Иначе откроется сборщик колоды.',
    targetSelector: '.mm-battle-wrap',
    placement: 'top',
  },
  {
    id: 'deck',
    title: 'Боевые колоды',
    text: 'Здесь хранятся твои колоды. Колода определяет, какие юниты будут доступны в бою — 10 карт.',
    targetSelector: '#mm-decks-btn',
    placement: 'top',
  },
  {
    id: 'online',
    title: 'Игра по сети',
    text: 'Здесь можно создать комнату и пригласить другого игрока по ссылке или коду.',
    targetSelector: '.mm-online-section',
    placement: 'top',
  },
  {
    id: 'factions',
    title: 'Фракции',
    text: 'Фракции дают особые бонусы. Сейчас доступен Дом Чести. Другие фракции открываются по мере роста рейтинга.',
    targetSelector: '#mm-factions-row',
    placement: 'top',
  },
  {
    id: 'rating',
    title: 'Рейтинг',
    text: 'Рейтинг открывает новые уровни, локации и дома. Побеждай в боях, чтобы расти.',
    targetSelector: '#mm-rating-btn',
    placement: 'top',
  },
  {
    id: 'training',
    title: 'Учебный бой',
    text: 'Теперь перейди к учебному бою, чтобы понять механику юнитов и башен.',
    targetSelector: '#mm-tutorial-block',
    placement: 'top',
  },
];

export const TUTORIAL_LESSONS = [
  {
    id: 'lesson_1',
    title: 'Урок 1: Основы боя',
    desc: 'Специи, линии, инженер и первые юниты.',
    playerDeck: ['engineer', 'swordsman', 'scout', 'archer', 'engineer', 'swordsman', 'scout', 'spearman', 'heavy', 'assault'],
    botScript: [
      { time: 8,  cardId: 'scout',     lane: 'center' },
      { time: 18, cardId: 'swordsman', lane: 'left'   },
      { time: 30, cardId: 'archer',    lane: 'right'  },
      { time: 45, cardId: 'scout',     lane: 'center' },
      { time: 60, cardId: 'swordsman', lane: 'left'   },
    ],
    steps: [
      {
        title: 'Специи',
        text: 'Специи — твой ресурс. Копятся автоматически. Когда банк полон — прирост останавливается. Трать специи регулярно, не жди.',
      },
      {
        title: 'Три линии',
        text: 'Поле разделено на три линии: левая, центр и правая. Снеси боковую башню врага — откроется его цитадель. Защищай свои башни.',
      },
      {
        title: 'Рука карт',
        text: 'Нажми на карту внизу — появятся кнопки линий для выбора. Или перетащи карту прямо на поле. Попробуй нажать на любую карту.',
        highlightHand: true,
      },
      {
        title: 'Выставь юнита',
        text: 'Поставь Клинка (⚔) или Ищейку (⚡) на центральную линию. Они выделены в твоей руке внизу. Юниты идут вперёд и атакуют всё на пути.',
        highlightCards: ['swordsman', 'scout'],
        requireCardPlay: true,
      },
      {
        title: 'Инженер',
        text: 'Инженер не воюет — он идёт к центральному узлу и увеличивает доход специй. Выставь его на центральную линию.',
        highlightCards: ['engineer'],
        requireCardPlay: true,
      },
      {
        title: 'Давление',
        text: 'Отлично! Посылай несколько юнитов — башне сложнее справиться с группой. Удачи в бою, командир!',
      },
    ],
    completionCondition: { type: 'timedOut', seconds: 90 },
  },
  {
    id: 'lesson_2',
    title: 'Урок 2: Тактика и осада',
    desc: 'Как контрить угрозы и ломать башни связкой.',
    playerDeck: ['heavy', 'assault', 'archer', 'spearman', 'scout', 'swordsman', 'guard', 'assault', 'heavy', 'archer'],
    botScript: [
      { time: 5,  cardId: 'archer',    lane: 'center' },
      { time: 18, cardId: 'heavy',     lane: 'right'  },
      { time: 35, cardId: 'archer',    lane: 'left'   },
      { time: 55, cardId: 'swordsman', lane: 'center' },
      { time: 70, cardId: 'heavy',     lane: 'left'   },
    ],
    steps: [
      {
        title: 'Контры',
        text: 'Каждый юнит имеет слабости. Стрелок (⛶) бьёт далеко, но слаб в ближнем бою — быстрый юнит или пехота легко его закрывают.',
      },
      {
        title: 'Закрой стрелка',
        text: 'Противник поставил Стрелка. Выставь Ищейку (⚡) или Клинка (⚔) — быстрая пехота добежит до него раньше, чем он накопит урон.',
        highlightCards: ['scout', 'swordsman', 'guard'],
        requireCardPlay: true,
      },
      {
        title: 'Против брони',
        text: 'Противник поставил Латника — тяжёлый бронированный юнит. Лучший ответ — Пикейщик: у него бонусный урон по броне.',
        highlightCards: ['spearman', 'archer'],
        requireCardPlay: true,
      },
      {
        title: 'Связка: танк первым',
        text: 'Для сноса башни нужна связка. Сначала выставь Латника или Гвардейца — они принимают удары башни на себя.',
        highlightCards: ['heavy', 'guard'],
        requireCardPlay: true,
      },
      {
        title: 'Башнелом',
        text: 'Теперь выставь Башнелома следом — он нанесёт огромный урон башне, пока танк отвлекает огонь.',
        highlightCards: ['assault'],
        requireCardPlay: true,
      },
      {
        title: 'Поддержка',
        text: 'Стрелок за связкой добивает остатки и отбивает защитников. Держи давление — не давай врагу восстановиться.',
        highlightCards: ['archer'],
        requireCardPlay: true,
      },
    ],
    completionCondition: { type: 'timedOut', seconds: 100 },
  },
  {
    id: 'lesson_3',
    title: 'Урок 3: Первый бой',
    desc: 'Полный бой против бота — без подсказок. Применяй всё, что узнал.',
    playerDeck: null,
    botScript: [],
    steps: [],
    useNormalAI: true,
    completionCondition: { type: 'matchEnd' },
  },
];

// Возвращает параметры юнита из CARD_DEFS для справочника
export function getUnitStats(cardId) {
  const def = CARD_DEFS[cardId];
  if (!def) return null;
  return {
    name:          def.name,
    hp:            def.hp,
    speed:         def.speed,
    attackDamage:  def.attackDamage,
    buildingDamage: def.buildingDamage,
    range:          def.range,
    baseCost:       def.baseCost ?? def.cost,
    armorClass:     def.armorClass,
    squadSize:      def.squadSize,
  };
}
