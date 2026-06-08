import { addWaterRings, addMetaSpices, loadWallet } from './wallet-service.js';
import { recordWin, recordLoss, getStreakBonus } from './streak-service.js';
import { incrementContractProgress } from './market-service.js';

export function processMatchReward({ mode, winner, elapsedSeconds = 0 }) {
  if (mode !== '1p') return null;

  let waterRingsDelta = 0;
  let metaSpicesDelta = 0;
  let streakData      = null;
  let bonusLabel      = null;

  if (winner) {
    streakData = recordWin();
    const base        = 8 + Math.floor(Math.random() * 8);
    const streakBonus = getStreakBonus(streakData.currentStreak);
    waterRingsDelta   = base + streakBonus;
    metaSpicesDelta   = 120 + Math.floor(Math.random() * 80) + Math.floor(elapsedSeconds * 2);
    if (streakBonus > 0) bonusLabel = `Серия ×${streakData.currentStreak}! +${streakBonus} 💧`;

    // Contract: win progress
    incrementContractProgress('c1');
    if (streakData.currentStreak >= 2) incrementContractProgress('c3');
  } else {
    streakData = recordLoss();
    waterRingsDelta = 2 + Math.floor(Math.random() * 3);
    metaSpicesDelta = 30 + Math.floor(Math.random() * 30);
  }

  // Contract: matches played
  incrementContractProgress('c2');

  addWaterRings(waterRingsDelta);
  addMetaSpices(metaSpicesDelta);

  const wallet = loadWallet();

  return {
    waterRingsDelta,
    metaSpicesDelta,
    bonusLabel,
    streak: streakData?.currentStreak ?? 0,
    wallet,
  };
}
