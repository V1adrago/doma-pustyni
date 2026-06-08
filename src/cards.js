// ? Стоимость инженера растёт с каждым использованием (I=2, II=3, III=4).
//   При доработке экономики пересмотреть: возможно, фиксированная стоимость + отдельная ветка апгрейдов.

export const CARD_DEFS = {
  engineer: {
    id: 'engineer',
    name: 'Инженер Узла',
    squadSize: 1,
    unitType: 'ground',
    armorClass: 'engineer',
    hp: 140,
    speed: 0.9,
    attackDamage: 0,
    buildingDamage: 0,
    attackCooldown: null,
    range: 0,
    targetTypes: [],
    canBlockGround: false,
    baseCost: 2,
    turnDelay: null,
    peelChance: 0,
    deployRules: {
      placementType: 'backline',
      allowedLanes: ['center'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
  scout: {
    id: 'scout',
    name: 'Ищейка Барханов',
    squadSize: 2,
    cost: 2,
    unitType: 'ground',
    armorClass: 'light',
    hp: 220,
    speed: 1.6,
    attackDamage: 32,
    buildingDamage: 16,
    attackCooldown: 0.8,
    range: 0.8,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    turnDelay: 0.15,
    peelChance: 0.65,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
  swordsman: {
    id: 'swordsman',
    name: 'Клинок Дома',
    squadSize: 3,
    cost: 2,
    unitType: 'ground',
    armorClass: 'medium',
    hp: 430,
    speed: 0.95,
    attackDamage: 45,
    buildingDamage: 32,
    attackCooldown: 1,
    range: 0.9,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    turnDelay: 0.25,
    peelChance: 0.65,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
  assault: {
    id: 'assault',
    name: 'Башнелом',
    squadSize: 2,
    cost: 3,
    unitType: 'ground',
    armorClass: 'assault',
    hp: 680,
    speed: 0.75,
    attackDamage: 42,
    buildingDamage: 95,
    attackCooldown: 1.2,
    range: 0.9,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    turnDelay: 0.45,
    peelChance: 0.65,
    deployRules: {
      placementType: 'backline',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0.4,
      canPlaceBehindEnemies: true,
    },
  },
  archer: {
    id: 'archer',
    name: 'Песчаный Стрелок',
    squadSize: 3,
    cost: 3,
    unitType: 'ground',
    armorClass: 'ranged',
    hp: 190,
    speed: 0.85,
    attackDamage: 19,
    airDamage: 15,
    buildingDamage: 9,
    attackCooldown: 1,
    range: 4.5,
    targetTypes: ['ground', 'air', 'building'],
    canBlockGround: true,
    turnDelay: 0.35,
    peelChance: 0.45,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
  spearman: {
    id: 'spearman',
    name: 'Пикейщик Каравана',
    squadSize: 3,
    cost: 3,
    unitType: 'ground',
    armorClass: 'antiHeavy',
    hp: 320,
    speed: 0.85,
    attackDamage: 35,
    buildingDamage: 18,
    attackCooldown: 0.9,
    range: 1.4,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    turnDelay: 0.3,
    peelChance: 0.65,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
  drone: {
    id: 'drone',
    name: 'Дюнный Сокол',
    squadSize: 1,
    cost: 4,
    unitType: 'air',
    armorClass: 'light',
    hp: 280,
    speed: 1.1,
    attackDamage: 20,
    buildingDamage: 17,
    attackCooldown: 1,
    range: 2.8,
    targetTypes: ['ground', 'building'],
    canBlockGround: false,
    turnDelay: 0.2,
    peelChance: 0,
    deployRules: {
      placementType: 'backline',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0.5,
      canPlaceBehindEnemies: true,
    },
  },
  heavy: {
    id: 'heavy',
    name: 'Латник Пустыни',
    squadSize: 1,
    cost: 5,
    unitType: 'ground',
    armorClass: 'heavy',
    hp: 900,
    speed: 0.5,
    attackDamage: 60,
    buildingDamage: 45,
    attackCooldown: 1.5,
    range: 0.9,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    turnDelay: 0.7,
    peelChance: 0,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0.6,
      canPlaceBehindEnemies: true,
    },
  },
  guard: {
    id: 'guard',
    name: 'Гвардеец Чести',
    squadSize: 2,
    cost: 4,
    unitType: 'ground',
    armorClass: 'guard',
    hp: 680,
    speed: 0.6,
    attackDamage: 40,
    buildingDamage: 18,
    attackCooldown: 1.1,
    range: 0.9,
    targetTypes: ['ground', 'building'],
    canBlockGround: true,
    factionOnly: 'honor',
    turnDelay: 0.4,
    peelChance: 0.65,
    deployRules: {
      placementType: 'own_half',
      allowedLanes: ['left', 'center', 'right'],
      deployDelay: 0,
      canPlaceBehindEnemies: true,
    },
  },
};

// Returns the spice cost to play a card given the player's current engineer stage
// ? Engineer escalating cost — revisit during economy balancing
export function getCardCost(cardId, engineerStage = 0) {
  if (cardId === 'engineer') {
    return Math.min(2 + engineerStage, 4);
  }
  return CARD_DEFS[cardId].cost;
}

// Минимальное время (секунды от старта матча) для вызова инженера каждой стадии
// Стадия 1 — с любого момента, стадия 2 — после 1 мин, стадия 3 — после 2 мин
export const ENGINEER_MIN_TIMES = [0, 60, 120];

// Returns true if the card can be played given the current game state
export function canPlayCard(cardId, economy, elapsedSeconds = 0) {
  if (cardId === 'engineer') {
    if (economy.engineerStage >= 3) return false; // max stage reached
    const minTime = ENGINEER_MIN_TIMES[economy.engineerStage]; // indexed by current stage
    if (elapsedSeconds < minTime) return false; // too early for next engineer
  }
  return economy.canAfford(getCardCost(cardId, economy.engineerStage));
}

export const CARD_ICONS = {
  engineer:  '⚙',
  scout:     '⚡',
  swordsman: '⚔',
  assault:   '🛡',
  archer:    '🏹',
  spearman:  '🔱',
  drone:     '✦',
  heavy:     '🪖',
  guard:     '⛨',
};

// Card background colors (header tint)
export const CARD_COLORS = {
  engineer:  '#7a5a10',
  scout:     '#0a5a5a',
  swordsman: '#0a2a6a',
  assault:   '#5a2a0a',
  archer:    '#0a4a1a',
  spearman:  '#2a4a1a',
  drone:     '#1a3060',
  heavy:     '#4a2a4a',
  guard:     '#5a3a00',
};

export const MAX_COPIES_PER_CARD = 3;
export const DECK_SIZE            = 10;

// Default AI deck for 1P mode (testing deck — covers all unit types)
export const AI_DECK = [
  'scout',
  'swordsman', 'swordsman',
  'assault', 'assault',
  'archer',
  'spearman',
  'drone',
  'heavy',
  'engineer',
];
