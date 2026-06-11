import { PROGRESSION, HOUSES, DESERT_CLANS_ID } from '../config/progression.js';

const STORAGE_KEY = 'desert_houses_profile_v1';

const DEFAULT = {
  rating: 0,
  level: 1,
  selectedLocationId: 'location_1',
  selectedHouseId: 'house_1',
  wins: 0,
  losses: 0,
  // Faction / house system
  selectedFaction: 'honor',
  ownedHouseIds: ['honor'],
  freeRouletteRolls: 0,
  unlockedRouletteHouseIds: [],
  lastUnlockedLevel: 1,
  pendingLevelUnlockModal: null,
  _level2FreeRollGranted: false,
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const profile = { ...DEFAULT, ...saved };

    // Migration: ensure all new fields exist
    if (!Array.isArray(profile.ownedHouseIds))            profile.ownedHouseIds = ['honor'];
    if (!profile.selectedFaction)                          profile.selectedFaction = 'honor';
    if (typeof profile.freeRouletteRolls !== 'number')     profile.freeRouletteRolls = 0;
    if (!Array.isArray(profile.unlockedRouletteHouseIds))  profile.unlockedRouletteHouseIds = [];
    if (!profile.lastUnlockedLevel)                        profile.lastUnlockedLevel = 1;
    if (profile.pendingLevelUnlockModal === undefined)     profile.pendingLevelUnlockModal = null;
    if (profile._level2FreeRollGranted === undefined)      profile._level2FreeRollGranted = false;

    // Ensure honor is always owned
    if (!profile.ownedHouseIds.includes('honor')) {
      profile.ownedHouseIds.unshift('honor');
    }

    return profile;
  } catch {
    return { ...DEFAULT };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function getLevelByRating(rating) {
  let level = 1;
  for (const tier of PROGRESSION) {
    if (rating >= tier.minRating) level = tier.level;
  }
  return level;
}

export function getUnlockedLocations(profile) {
  return PROGRESSION.filter(p => p.level <= profile.level);
}

export function getUnlockedHouses(profile) {
  return HOUSES.filter(h => h.levelRequired <= profile.level);
}

// Returns rating result object, or null if mode !== '1p'.
export function addMatchResult({ mode, winner }) {
  if (mode !== '1p') return null;

  const profile    = loadProfile();
  const prevLevel  = profile.level;
  const prevRating = profile.rating;
  const oldLevel   = getLevelByRating(prevRating);

  const delta     = winner ? 35 : -15;
  profile.rating  = Math.max(0, profile.rating + delta);

  if (winner) profile.wins++;
  else        profile.losses++;

  const newLevel = getLevelByRating(profile.rating);
  profile.level  = newLevel;

  // Level-up detection
  if (newLevel > oldLevel) {
    profile.lastUnlockedLevel    = newLevel;
    profile.pendingLevelUnlockModal = newLevel;
  }

  // Level 2 rewards
  if (newLevel >= 2) {
    if (!profile.unlockedRouletteHouseIds.includes(DESERT_CLANS_ID)) {
      profile.unlockedRouletteHouseIds.push(DESERT_CLANS_ID);
    }
    if (!profile._level2FreeRollGranted) {
      profile.freeRouletteRolls += 1;
      profile._level2FreeRollGranted = true;
    }
    if (!profile.selectedLocationId || profile.selectedLocationId === 'location_1') {
      profile.selectedLocationId = 'salt_rifts';
    }
  }

  const newlyUnlocked = [];
  if (newLevel > prevLevel) {
    const tier = PROGRESSION.find(p => p.level === newLevel);
    if (tier) {
      newlyUnlocked.push({ type: 'location', name: tier.locationName });
      // Roulette houses are not immediately unlocked — they come from the roulette
    }
  }

  saveProfile(profile);

  return {
    ratingDelta: delta,
    prevRating,
    newRating: profile.rating,
    prevLevel,
    newLevel,
    newlyUnlocked,
  };
}

export function resetProfile() {
  const p = { ...DEFAULT };
  saveProfile(p);
  return p;
}

// Roulette helpers

export function getAvailableRouletteHouses(profile) {
  return profile.unlockedRouletteHouseIds.filter(
    id => !profile.ownedHouseIds.includes(id)
  );
}

export function rollHouse(profile) {
  const pool = getAvailableRouletteHouses(profile);

  if (profile.freeRouletteRolls <= 0) {
    return { type: 'no_free_rolls' };
  }

  if (pool.length === 0) {
    return { type: 'empty' };
  }

  const houseId = pool[Math.floor(Math.random() * pool.length)];
  profile.freeRouletteRolls -= 1;
  profile.ownedHouseIds.push(houseId);

  saveProfile(profile);
  return { type: 'house', houseId };
}

// Платный прокрут: не тратит бесплатные прокруты, деньги уже списаны до вызова
export function rollHousePaid(profile) {
  const pool = getAvailableRouletteHouses(profile);

  if (pool.length === 0) {
    return { type: 'empty' };
  }

  const houseId = pool[Math.floor(Math.random() * pool.length)];
  profile.ownedHouseIds.push(houseId);

  saveProfile(profile);
  return { type: 'house', houseId };
}
