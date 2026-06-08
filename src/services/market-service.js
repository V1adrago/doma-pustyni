import { loadWallet, saveWallet } from './wallet-service.js';

export const CHEST_DEFS = [
  {
    id: 'sand', name: 'Песчаный тайник', icon: '🪨', cost: 50,
    desc: 'Простые находки каравана', rarity: 'common',
    rewards: [
      { type: 'metaSpices', amount: [80,  150], weight: 60 },
      { type: 'waterRings', amount: [5,   15],  weight: 30 },
      { type: 'card_frag',  name: 'Ищейка Барханов',    weight: 10 },
    ],
  },
  {
    id: 'oasis', name: 'Оазисный тайник', icon: '🌿', cost: 150,
    desc: 'Дары оазиса пустыни', rarity: 'uncommon',
    rewards: [
      { type: 'metaSpices', amount: [200, 400], weight: 50 },
      { type: 'waterRings', amount: [15,  40],  weight: 30 },
      { type: 'card_frag',  name: 'Клинок Дома',        weight: 20 },
    ],
  },
  {
    id: 'caravan', name: 'Тайник каравана', icon: '🐪', cost: 350,
    desc: 'Сокровища торгового пути', rarity: 'rare',
    rewards: [
      { type: 'metaSpices', amount: [500, 900], weight: 40 },
      { type: 'waterRings', amount: [35,  80],  weight: 35 },
      { type: 'card_frag',  name: 'Пикейщик Каравана',  weight: 25 },
    ],
  },
  {
    id: 'imperial', name: 'Имперский тайник', icon: '👑', cost: 800,
    desc: 'Наследие имперских складов', rarity: 'epic',
    rewards: [
      { type: 'metaSpices', amount: [1200, 2000], weight: 35 },
      { type: 'waterRings', amount: [80,   200],  weight: 35 },
      { type: 'card_frag',  name: 'Латник Пустыни',     weight: 30 },
    ],
  },
  {
    id: 'lord', name: 'Тайник Владыки', icon: '⚜', cost: 1500,
    desc: 'Самые редкие артефакты пустыни', rarity: 'legendary',
    rewards: [
      { type: 'metaSpices', amount: [3000, 5000], weight: 30 },
      { type: 'waterRings', amount: [150,  400],  weight: 30 },
      { type: 'card_frag',  name: 'Дюнный Сокол',       weight: 40 },
    ],
  },
];

const BASE_CONTRACTS = [
  { id: 'c1', title: 'Победи 3 раза',     desc: '+120 Запасов специй',   total: 3, reward: { type: 'metaSpices', amount: 120 } },
  { id: 'c2', title: 'Сыграй 5 матчей',   desc: '+20 Водных колец',      total: 5, reward: { type: 'waterRings', amount: 20  } },
  { id: 'c3', title: 'Выиграй 2 подряд',  desc: '+60 Запасов специй',    total: 1, reward: { type: 'metaSpices', amount: 60  } },
];

const KEY_DATA = 'doma_pustyni_contracts_v1';
const KEY_DATE = 'doma_pustyni_contracts_date_v1';

export function loadContracts() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(KEY_DATE) !== today) {
    const fresh = BASE_CONTRACTS.map(c => ({ ...c, progress: 0, claimed: false }));
    localStorage.setItem(KEY_DATA, JSON.stringify(fresh));
    localStorage.setItem(KEY_DATE, today);
    return fresh;
  }
  try {
    const raw = localStorage.getItem(KEY_DATA);
    if (raw) return JSON.parse(raw);
  } catch {}
  return BASE_CONTRACTS.map(c => ({ ...c, progress: 0, claimed: false }));
}

export function saveContracts(contracts) {
  localStorage.setItem(KEY_DATA, JSON.stringify(contracts));
}

export function incrementContractProgress(contractId) {
  const contracts = loadContracts();
  const c = contracts.find(x => x.id === contractId);
  if (c && !c.claimed) {
    c.progress = Math.min(c.total, c.progress + 1);
    saveContracts(contracts);
  }
  return contracts;
}

function _pickReward(rewards) {
  const total = rewards.reduce((s, r) => s + r.weight, 0);
  let rand = Math.random() * total;
  for (const r of rewards) {
    rand -= r.weight;
    if (rand <= 0) return _resolve(r);
  }
  return _resolve(rewards[0]);
}

function _resolve(r) {
  const amount = Array.isArray(r.amount)
    ? Math.floor(r.amount[0] + Math.random() * (r.amount[1] - r.amount[0]))
    : r.amount;
  return { type: r.type, amount, name: r.name };
}

export function openChest(chestId) {
  const def = CHEST_DEFS.find(c => c.id === chestId);
  if (!def) return null;

  const wallet = loadWallet();
  if (wallet.waterRings < def.cost) return { error: 'not_enough' };

  wallet.waterRings -= def.cost;

  const newPity = wallet.caravanPity + 1;
  let reward;

  if (newPity >= 10) {
    wallet.caravanPity = 0;
    const rareRew = def.rewards.find(r => r.type === 'card_frag') ?? def.rewards.at(-1);
    reward = { ..._resolve(rareRew), guaranteed: true };
  } else {
    wallet.caravanPity = newPity;
    reward = _pickReward(def.rewards);
  }

  // Apply reward to wallet
  if (reward.type === 'waterRings') wallet.waterRings += reward.amount;
  if (reward.type === 'metaSpices') wallet.metaSpices  = (wallet.metaSpices || 0) + reward.amount;

  saveWallet(wallet);
  return { reward, wallet };
}

export const ROUTE_NODES = [
  { id: 'n1', name: 'Песчаный аванпост', icon: '🏕', winsRequired: 0,  reward: { type: 'waterRings', amount: 10  } },
  { id: 'n2', name: 'Оазис Хасана',      icon: '🌴', winsRequired: 5,  reward: { type: 'waterRings', amount: 25  } },
  { id: 'n3', name: 'Руины Карим-Вара',  icon: '🏛', winsRequired: 12, reward: { type: 'waterRings', amount: 50  } },
  { id: 'n4', name: 'Перевал Штормов',   icon: '⛰', winsRequired: 25, reward: { type: 'waterRings', amount: 100 } },
  { id: 'n5', name: 'Врата Пустыни',     icon: '🌅', winsRequired: 50, reward: { type: 'waterRings', amount: 250 } },
];

const KEY_ROUTE_CLAIMED = 'doma_pustyni_route_claimed_v1';

export function getClaimedRouteNodes() {
  try { return JSON.parse(localStorage.getItem(KEY_ROUTE_CLAIMED)) || []; } catch { return []; }
}

export function claimRouteNode(nodeId) {
  const claimed = getClaimedRouteNodes();
  if (claimed.includes(nodeId)) return null;
  const node = ROUTE_NODES.find(n => n.id === nodeId);
  if (!node) return null;
  const wallet = loadWallet();
  if (node.reward.type === 'waterRings') wallet.waterRings += node.reward.amount;
  if (node.reward.type === 'metaSpices') wallet.metaSpices  = (wallet.metaSpices || 0) + node.reward.amount;
  saveWallet(wallet);
  claimed.push(nodeId);
  localStorage.setItem(KEY_ROUTE_CLAIMED, JSON.stringify(claimed));
  return node.reward;
}
