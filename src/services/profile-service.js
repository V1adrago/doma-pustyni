import { PROGRESSION, HOUSES } from '../config/progression.js';

const STORAGE_KEY = 'desert_houses_profile_v1';

const DEFAULT = {
  rating: 0,
  level: 1,
  selectedLocationId: 'location_1',
  selectedHouseId: 'house_1',
  wins: 0,
  losses: 0,
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
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

  const delta     = winner ? 35 : -15;
  profile.rating  = Math.max(0, profile.rating + delta);

  if (winner) profile.wins++;
  else        profile.losses++;

  const newLevel = getLevelByRating(profile.rating);
  profile.level  = newLevel;

  const newlyUnlocked = [];
  if (newLevel > prevLevel) {
    const tier = PROGRESSION.find(p => p.level === newLevel);
    if (tier) {
      newlyUnlocked.push({ type: 'location', name: tier.locationName });
      const newHouse = HOUSES.find(h => h.levelRequired === newLevel);
      if (newHouse) newlyUnlocked.push({ type: 'house', name: newHouse.name });
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
